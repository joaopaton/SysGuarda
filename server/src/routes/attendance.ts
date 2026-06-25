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
