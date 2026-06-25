import { Router } from "express";
import { prisma } from "../prisma.js";
import { isSuperadmin, str, intIn, podeTurma, turmaAlvo } from "../scope.js";
import { requireSuperadmin } from "../auth.js";

export const missionsRouter = Router();

/** Lê a meta de horas complementares (singleton). Cria com 60 se não existir. */
async function getMeta(): Promise<number> {
  const cfg = await prisma.missaoConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return cfg.metaHoras;
}

// ===== Config da meta =====

// GET /api/missions/config -> { metaHoras }
missionsRouter.get("/config", async (_req, res) => {
  res.json({ metaHoras: await getMeta() });
});

// PUT /api/missions/config { metaHoras } -> só o Comandante.
missionsRouter.put("/config", requireSuperadmin, async (req, res) => {
  const metaHoras = intIn(req.body?.metaHoras, 0, 100000);
  if (metaHoras === null) {
    return res.status(400).json({ error: "metaHoras inválida." });
  }
  const cfg = await prisma.missaoConfig.upsert({
    where: { id: "singleton" },
    update: { metaHoras },
    create: { id: "singleton", metaHoras },
  });
  res.json({ metaHoras: cfg.metaHoras });
});

// GET /api/missions[?turmaId=] -> relatório agrupado por turma.
// Soma as horas das missões por pessoa e compara com a meta (abaixo = total < meta).
missionsRouter.get("/", async (req, res) => {
  const turmaFiltro = isSuperadmin(req)
    ? str(req.query?.turmaId, 40) || null
    : req.user?.turmaId ?? "__sem_turma__";

  const meta = await getMeta();
  const missoes = await prisma.mission.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  type Lanc = {
    id: string;
    date: string | null;
    descricao: string;
    horas: number;
  };
  const porChave = new Map<
    string,
    { num: string; nome: string; turmaId: string | null; total: number; lancamentos: Lanc[] }
  >();
  for (const m of missoes) {
    const k = m.personNum + m.personNome;
    let v = porChave.get(k);
    if (!v)
      porChave.set(
        k,
        (v = { num: m.personNum, nome: m.personNome, turmaId: m.turmaId, total: 0, lancamentos: [] })
      );
    v.total += m.horas;
    v.lancamentos.push({
      id: m.id,
      date: m.date ? m.date.toISOString().slice(0, 10) : null,
      descricao: m.descricao,
      horas: m.horas,
    });
  }

  // Mapa do efetivo p/ vincular pessoa -> turma/isMonitor.
  const people = await prisma.person.findMany({ where: { active: true } });
  const porPessoa = new Map(people.map((p) => [p.num + p.nome, p]));
  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });

  type Linha = {
    num: string;
    nome: string;
    isMonitor: boolean;
    total: number;
    abaixo: boolean;
    lancamentos: Lanc[];
  };
  const grupos = new Map<string, Linha[]>(); // turmaId | "sem" -> linhas
  for (const v of porChave.values()) {
    const pessoa = porPessoa.get(v.num + v.nome);
    // turma da pessoa (preferida) ou a registrada na missão.
    const gid = pessoa?.turmaId ?? v.turmaId ?? "sem";
    const linha: Linha = {
      num: v.num,
      nome: v.nome,
      isMonitor: pessoa?.isMonitor ?? false,
      total: v.total,
      abaixo: v.total < meta,
      lancamentos: v.lancamentos,
    };
    (grupos.get(gid) ?? grupos.set(gid, []).get(gid)!).push(linha);
  }

  const ordenar = (l: Linha[]) =>
    l.sort((a, b) => a.num.localeCompare(b.num) || a.nome.localeCompare(b.nome));

  const turmasOut = turmas
    .filter((t) => !turmaFiltro || t.id === turmaFiltro)
    .map((t) => ({
      id: t.id,
      codigo: t.codigo,
      apelido: t.apelido,
      pessoas: ordenar(grupos.get(t.id) ?? []),
    }));

  const semTurma =
    !turmaFiltro && isSuperadmin(req) ? ordenar(grupos.get("sem") ?? []) : [];

  res.json({ meta, turmas: turmasOut, semTurma });
});

// POST /api/missions { num?, nome, date?, descricao, horas, turmaId } -> lançamento manual.
missionsRouter.post("/", async (req, res) => {
  const turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  if (!isSuperadmin(req) && !turmaId) {
    return res.status(403).json({ error: "Seu usuário não tem turma definida." });
  }
  const nome = str(req.body?.nome, 80).toUpperCase();
  const num = str(req.body?.num, 10) || "---";
  const descricao = str(req.body?.descricao, 200);
  const horas = Number(req.body?.horas);
  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
  if (!Number.isFinite(horas) || horas <= 0) {
    return res.status(400).json({ error: "horas inválidas" });
  }
  const dataRaw = str(req.body?.date, 10);
  const date = /^\d{4}-\d{2}-\d{2}/.test(dataRaw) ? new Date(dataRaw) : null;

  // Vincula ao efetivo (e força a turma da pessoa quando existir).
  const pessoa = await prisma.person.findFirst({
    where: { active: true, num, nome },
  });

  const m = await prisma.mission.create({
    data: {
      date,
      descricao,
      horas,
      turmaId: pessoa?.turmaId ?? turmaId,
      personId: pessoa?.id ?? null,
      personNum: num,
      personNome: nome,
    },
  });
  res.status(201).json({ id: m.id });
});

// POST /api/missions/importar { csv } -> importação em lote escopada por turma.
// Colunas toleradas: num;nome;data;descricao;horas (separador ; , \t).
const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

missionsRouter.post("/importar", async (req, res) => {
  const sup = isSuperadmin(req);
  if (!sup && !req.user?.turmaId) {
    return res.status(403).json({ error: "Seu usuário não tem turma definida." });
  }
  const csv = str(req.body?.csv, 500000).replace(/^﻿/, "");
  if (!csv) return res.status(400).json({ error: "CSV vazio." });

  // Escopo: super = todo o efetivo; instrutor/monitor = só a sua turma.
  const escopo = await prisma.person.findMany({
    where: { active: true, ...(sup ? {} : { turmaId: req.user!.turmaId }) },
  });
  const porChave = new Map(escopo.map((p) => [(p.num + p.nome).toUpperCase(), p]));
  const porNome = new Map<string, typeof escopo>();
  for (const p of escopo) {
    const k = p.nome.toUpperCase();
    (porNome.get(k) ?? porNome.set(k, []).get(k)!).push(p);
  }

  const linhas = csv.split(/\r?\n/);
  type Reg = {
    date: Date | null;
    descricao: string;
    horas: number;
    turmaId: string | null;
    personId: string;
    personNum: string;
    personNome: string;
  };
  const registros: Reg[] = [];
  let foraDoEscopo = 0;

  linhas.forEach((linha, i) => {
    const cols = linha.split(/[;,\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
    if (cols.every((c) => !c)) return;
    // pula cabeçalho
    if (i === 0 && /nome/i.test(semAcento(linha)) && /hora/i.test(semAcento(linha))) return;
    if (cols.length < 2) return;

    const [num, nome, dataRaw, descricao, horasRaw] = [
      cols[0] || "",
      (cols[1] || "").toUpperCase(),
      cols[2] || "",
      cols[3] || "",
      cols[4] || "",
    ];
    if (!nome) return;
    const horas = parseFloat((horasRaw || "").replace(",", "."));
    if (!Number.isFinite(horas) || horas <= 0) return;

    let pessoa = porChave.get((num + nome).toUpperCase());
    if (!pessoa) {
      const hits = porNome.get(nome);
      if (hits && hits.length === 1) pessoa = hits[0];
    }
    if (!pessoa) {
      foraDoEscopo++;
      return;
    }
    const date = /^\d{4}-\d{2}-\d{2}/.test(dataRaw) ? new Date(dataRaw) : null;
    registros.push({
      date,
      descricao: descricao.slice(0, 200),
      horas,
      turmaId: pessoa.turmaId,
      personId: pessoa.id,
      personNum: pessoa.num,
      personNome: pessoa.nome,
    });
  });

  if (registros.length === 0) {
    return res.status(400).json({ error: "Nenhuma missão válida da sua turma no CSV." });
  }
  await prisma.mission.createMany({ data: registros });
  res.json({ importadas: registros.length, ignorados: foraDoEscopo });
});

// DELETE /api/missions/:id
missionsRouter.delete("/:id", async (req, res) => {
  const alvo = await prisma.mission.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, alvo.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta missão." });
  }
  await prisma.mission.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
