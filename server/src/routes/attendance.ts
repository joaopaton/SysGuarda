import { Router } from "express";
import { prisma } from "../prisma.js";
import { isSuperadmin, str, turmaAlvo } from "../scope.js";

export const attendanceRouter = Router();

const STATUS = new Set(["PRESENTE", "FALTA", "JUSTIFICADO"]);

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
    faltas: number;
    justificados: number;
    dias: Record<string, string>;
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
        justificados: 0,
        dias: {},
      };
      g.set(k, l);
    }
    l.dias[dISO] = r.status;
    if (r.status === "FALTA") l.faltas++;
    else if (r.status === "JUSTIFICADO") l.justificados++;
    else l.presentes++;
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
  const porChave = new Map(registros.map((r) => [r.personNum + r.personNome, r.status]));

  const linhas = efetivo.map((p) => ({
    num: p.num,
    nome: p.nome,
    isMonitor: p.isMonitor,
    status: porChave.get(p.num + p.nome) ?? "PRESENTE",
  }));

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

  const dados: {
    date: Date;
    status: string;
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
    dados.push({
      date,
      status,
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
