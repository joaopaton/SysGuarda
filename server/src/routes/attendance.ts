import { Router } from "express";
import { prisma } from "../prisma.js";
import { bool, isSuperadmin, podeClassificar, str, turmaAlvo } from "../scope.js";
import { calcularPontos, PONTOS_INICIAL } from "../domain.js";

export const attendanceRouter = Router();

// A chamada (monitor) só marca presença/falta; "justificada" é um flag separado
// que só instrutor/admin alteram via PATCH /justificar.
const STATUS = new Set(["PRESENTE", "FALTA"]);

/** Normaliza "YYYY-MM-DD" (ou Date) para 00:00 local. Inválido -> hoje. */
function diaZero(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Turma alvo da consulta/escrita: super usa o pedido; instrutor/monitor a sua. */
function turmaDaReq(req: Parameters<typeof isSuperadmin>[0], pedido: string | null) {
  return isSuperadmin(req)
    ? pedido || null
    : req.user?.turmaId ?? "__sem_turma__";
}

// GET /api/attendance/historico?turmaId=&from=&to=
// Histórico consolidado: por turma, cada pessoa com contagem P/F/J no período
// e o status de cada dia (para o detalhe "específico"). Escopo por papel/turma.
attendanceRouter.get("/historico", async (req, res) => {
  const turmaFiltroId = isSuperadmin(req)
    ? str(req.query?.turmaId, 40) || null
    : req.user?.turmaId ?? "__none__";
  const from = str(req.query?.from, 10);
  const to = str(req.query?.to, 10);

  const where: {
    turmaId?: string;
    date?: { gte?: Date; lte?: Date };
  } = {};
  if (turmaFiltroId) where.turmaId = turmaFiltroId;
  if (from) where.date = { ...(where.date || {}), gte: diaZero(from) };
  if (to) where.date = { ...(where.date || {}), lte: diaZero(to) };

  const registros = await prisma.attendance.findMany({
    where,
    orderBy: { date: "asc" },
  });
  const people = await prisma.person.findMany({ where: { active: true } });
  const isMon = new Map(people.map((p) => [p.num + p.nome, p.isMonitor]));
  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });

  type Linha = {
    num: string;
    nome: string;
    isMonitor: boolean;
    presentes: number;
    faltas: number; // total de faltas (justificadas + não)
    faltasJustificadas: number;
    faltasNaoJustificadas: number;
    pontos: number; // saldo cumulativo no período consultado
    dias: Record<string, { status: string; justificada: boolean }>;
  };
  const datasSet = new Set<string>();
  const grupos = new Map<string, Map<string, Linha>>();
  for (const r of registros) {
    const dISO = r.date.toISOString().slice(0, 10);
    datasSet.add(dISO);
    const gid = r.turmaId ?? "sem";
    let g = grupos.get(gid);
    if (!g) grupos.set(gid, (g = new Map()));
    const k = r.personNum + r.personNome;
    let l = g.get(k);
    if (!l) {
      l = {
        num: r.personNum,
        nome: r.personNome,
        isMonitor: isMon.get(k) ?? false,
        presentes: 0,
        faltas: 0,
        faltasJustificadas: 0,
        faltasNaoJustificadas: 0,
        pontos: 0,
        dias: {},
      };
      g.set(k, l);
    }
    l.dias[dISO] = { status: r.status, justificada: r.justificada };
    if (r.status === "FALTA") {
      l.faltas++;
      if (r.justificada) l.faltasJustificadas++;
      else l.faltasNaoJustificadas++;
    } else l.presentes++;
    l.pontos = calcularPontos(l.faltasJustificadas, l.faltasNaoJustificadas);
  }

  const ordenar = (m?: Map<string, Linha>) =>
    [...(m?.values() ?? [])].sort(
      (a, b) =>
        Number(b.isMonitor) - Number(a.isMonitor) || a.num.localeCompare(b.num)
    );
  const datas = [...datasSet].sort();
  const turmasOut = turmas
    .filter((t) => !turmaFiltroId || t.id === turmaFiltroId)
    .map((t) => ({
      id: t.id,
      codigo: t.codigo,
      apelido: t.apelido,
      pessoas: ordenar(grupos.get(t.id)),
    }));
  const semTurma =
    !turmaFiltroId && isSuperadmin(req) ? ordenar(grupos.get("sem")) : [];

  res.json({ datas, turmas: turmasOut, semTurma });
});

// GET /api/attendance?turmaId=&date=  -> lista do efetivo da turma + status do dia.
// Sem registro salvo = "PRESENTE" (default não marcado).
attendanceRouter.get("/", async (req, res) => {
  const turmaId = turmaDaReq(req, str(req.query?.turmaId, 40) || null);
  const date = diaZero(str(req.query?.date, 10));

  // Sem turma definida (instrutor/monitor): nada a mostrar.
  if (turmaId === "__sem_turma__") {
    return res.json({ date: date.toISOString().slice(0, 10), turmaId: null, linhas: [] });
  }

  const efetivo = await prisma.person.findMany({
    where: { active: true, ...(turmaId ? { turmaId } : { turmaId: null }) },
    orderBy: [{ isMonitor: "desc" }, { num: "asc" }],
  });

  const registros = await prisma.attendance.findMany({
    where: { date, ...(turmaId ? { turmaId } : { turmaId: null }) },
  });
  const porChave = new Map(registros.map((r) => [r.personNum + r.personNome, r]));

  const linhas = efetivo.map((p) => {
    const r = porChave.get(p.num + p.nome);
    return {
      num: p.num,
      nome: p.nome,
      isMonitor: p.isMonitor,
      status: r?.status ?? "PRESENTE",
      justificada: r?.justificada ?? false,
    };
  });

  res.json({ date: date.toISOString().slice(0, 10), turmaId, linhas });
});

// POST /api/attendance  { date, turmaId, registros: [{num, nome, status}] }
// Substitui (replace) os registros daquele dia+turma.
attendanceRouter.post("/", async (req, res) => {
  const turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  if (!isSuperadmin(req) && !turmaId) {
    return res.status(403).json({ error: "Seu usuário não tem turma definida." });
  }
  const date = diaZero(str(req.body?.date, 10));
  const entrada = Array.isArray(req.body?.registros) ? req.body.registros : [];

  // Casa cada registro com o efetivo da turma (escopo) e valida o status.
  const efetivo = await prisma.person.findMany({
    where: { active: true, ...(turmaId ? { turmaId } : { turmaId: null }) },
  });
  const porChave = new Map(efetivo.map((p) => [p.num + p.nome, p]));

  // Classificação (justificada) existente: a chamada faz replace, mas não pode
  // perder o que o instrutor já justificou. Reaproveitamos o flag por pessoa.
  const anteriores = await prisma.attendance.findMany({
    where: { date, ...(turmaId ? { turmaId } : { turmaId: null }) },
  });
  const justAnterior = new Map(
    anteriores.map((a) => [a.personNum + a.personNome, a.justificada])
  );

  const dados: {
    date: Date;
    status: string;
    justificada: boolean;
    turmaId: string | null;
    personId: string | null;
    personNum: string;
    personNome: string;
  }[] = [];
  for (const r of entrada) {
    const num = str(r?.num, 10) || "---";
    const nome = str(r?.nome, 80).toUpperCase();
    const status = str(r?.status, 20).toUpperCase();
    if (!nome || !STATUS.has(status)) continue;
    const p = porChave.get(num + nome);
    if (!p) continue; // fora do escopo da turma: ignora
    // Só FALTA carrega o flag; PRESENTE zera. Preserva classificação anterior.
    const justificada = status === "FALTA" && (justAnterior.get(num + nome) ?? false);
    dados.push({
      date,
      status,
      justificada,
      turmaId,
      personId: p.id,
      personNum: num,
      personNome: nome,
    });
  }

  await prisma.$transaction([
    prisma.attendance.deleteMany({
      where: { date, ...(turmaId ? { turmaId } : { turmaId: null }) },
    }),
    ...(dados.length ? [prisma.attendance.createMany({ data: dados })] : []),
  ]);

  res.json({ salvos: dados.length });
});

// PATCH /api/attendance/justificar  { date, turmaId, num, nome, justificada }
// Classifica uma FALTA como justificada (-2) ou não (-4). Só instrutor/admin.
attendanceRouter.patch("/justificar", async (req, res) => {
  if (!podeClassificar(req)) {
    return res.status(403).json({ error: "Só o instrutor ou o Comandante podem justificar faltas." });
  }
  const turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  const date = diaZero(str(req.body?.date, 10));
  const num = str(req.body?.num, 10) || "---";
  const nome = str(req.body?.nome, 80).toUpperCase();
  const justificada = bool(req.body?.justificada);
  if (!nome) return res.status(400).json({ error: "Militar inválido." });

  const reg = await prisma.attendance.findFirst({
    where: {
      date,
      personNum: num,
      personNome: nome,
      ...(turmaId ? { turmaId } : {}),
    },
  });
  if (!reg || reg.status !== "FALTA") {
    return res.status(404).json({ error: "Falta não encontrada para esse dia." });
  }
  await prisma.attendance.update({ where: { id: reg.id }, data: { justificada } });
  res.json({ ok: true, justificada });
});

// GET /api/attendance/pontos?turmaId=
// Saldo de pontos (cumulativo, todo o curso) por pessoa, com o detalhe das faltas.
// Escopo por papel/turma. Inclui todo o efetivo ativo (mesmo sem faltas = 120).
attendanceRouter.get("/pontos", async (req, res) => {
  const turmaFiltroId = isSuperadmin(req)
    ? str(req.query?.turmaId, 40) || null
    : req.user?.turmaId ?? "__none__";

  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });
  const efetivo = await prisma.person.findMany({
    where: {
      active: true,
      ...(turmaFiltroId ? { turmaId: turmaFiltroId } : {}),
    },
  });
  const registros = await prisma.attendance.findMany({
    where: {
      status: "FALTA",
      ...(turmaFiltroId ? { turmaId: turmaFiltroId } : {}),
    },
    orderBy: { date: "asc" },
  });

  type Pessoa = {
    num: string;
    nome: string;
    isMonitor: boolean;
    faltasJustificadas: number;
    faltasNaoJustificadas: number;
    pontos: number;
    faltas: { date: string; justificada: boolean }[];
  };
  // Inicia todo o efetivo com 120 (mesmo quem nunca faltou).
  const porPessoa = new Map<string, Pessoa>();
  const turmaDaPessoa = new Map<string, string>();
  for (const p of efetivo) {
    const k = p.num + p.nome;
    porPessoa.set(k, {
      num: p.num,
      nome: p.nome,
      isMonitor: p.isMonitor,
      faltasJustificadas: 0,
      faltasNaoJustificadas: 0,
      pontos: PONTOS_INICIAL,
      faltas: [],
    });
    turmaDaPessoa.set(k, p.turmaId ?? "sem");
  }
  for (const r of registros) {
    const k = r.personNum + r.personNome;
    const l = porPessoa.get(k);
    if (!l) continue; // falta de alguém fora do efetivo ativo: ignora
    if (r.justificada) l.faltasJustificadas++;
    else l.faltasNaoJustificadas++;
    l.faltas.push({ date: r.date.toISOString().slice(0, 10), justificada: r.justificada });
    l.pontos = calcularPontos(l.faltasJustificadas, l.faltasNaoJustificadas);
  }

  const ordenar = (gid: string) =>
    [...porPessoa.entries()]
      .filter(([k]) => turmaDaPessoa.get(k) === gid)
      .map(([, v]) => v)
      .sort(
        (a, b) =>
          a.pontos - b.pontos || // menor saldo primeiro (quem está pior em cima)
          Number(b.isMonitor) - Number(a.isMonitor) ||
          a.num.localeCompare(b.num)
      );

  const turmasOut = turmas
    .filter((t) => !turmaFiltroId || t.id === turmaFiltroId)
    .map((t) => ({ id: t.id, codigo: t.codigo, apelido: t.apelido, pessoas: ordenar(t.id) }));
  const semTurma = !turmaFiltroId && isSuperadmin(req) ? ordenar("sem") : [];

  res.json({ inicial: PONTOS_INICIAL, turmas: turmasOut, semTurma });
});
