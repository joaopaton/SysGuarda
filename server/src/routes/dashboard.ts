import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireSuperadmin } from "../auth.js";
import { calcularPontos, PONTOS_INICIAL } from "../domain.js";

export const dashboardRouter = Router();

// GET /api/dashboard -> resumo por turma p/ o Comandante (visão "Todas").
dashboardRouter.get("/", requireSuperadmin, async (_req, res) => {
  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });
  const people = await prisma.person.findMany({ where: { active: true } });
  const schedules = await prisma.schedule.findMany({
    where: { turmaId: { not: null } },
    orderBy: { startDate: "desc" },
    select: { turmaId: true, startDate: true },
  });

  // Faltas (instrução) por pessoa, p/ o saldo de pontos médio da turma.
  const faltas = await prisma.attendance.findMany({
    where: { status: "FALTA" },
    select: { personNum: true, personNome: true, justificada: true },
  });
  const faltasPorPessoa = new Map<string, { j: number; nj: number }>();
  for (const f of faltas) {
    const k = f.personNum + f.personNome;
    const acc = faltasPorPessoa.get(k) ?? { j: 0, nj: 0 };
    if (f.justificada) acc.j++;
    else acc.nj++;
    faltasPorPessoa.set(k, acc);
  }
  const pontosDe = (num: string, nome: string) => {
    const a = faltasPorPessoa.get(num + nome);
    return a ? calcularPontos(a.j, a.nj) : PONTOS_INICIAL;
  };

  // Próxima turma do rodízio (após a turma da escala mais recente).
  let proximaTurmaId: string | null = turmas[0]?.id ?? null;
  if (schedules[0]?.turmaId) {
    const idx = turmas.findIndex((t) => t.id === schedules[0].turmaId);
    if (idx >= 0) proximaTurmaId = turmas[(idx + 1) % turmas.length].id;
  }

  const resumo = turmas.map((t) => {
    const daTurma = people.filter((p) => p.turmaId === t.id);
    const guardas = daTurma.filter((p) => !p.isMonitor);
    const monitores = daTurma.filter((p) => p.isMonitor);
    const sch = schedules.filter((s) => s.turmaId === t.id);
    const saldos = daTurma.map((p) => pontosDe(p.num, p.nome));
    const pontosMedia = saldos.length
      ? Math.round(saldos.reduce((a, b) => a + b, 0) / saldos.length)
      : PONTOS_INICIAL;
    return {
      id: t.id,
      codigo: t.codigo,
      apelido: t.apelido,
      ordem: t.ordem,
      guardas: guardas.length,
      guardasAusentes: guardas.filter((p) => !p.available).length,
      monitores: monitores.length,
      monitoresAusentes: monitores.filter((p) => !p.available).length,
      escalas: sch.length,
      ultimaEscala: sch[0]?.startDate ?? null,
      pontosMedia,
    };
  });

  const semTurma = people.filter((p) => !p.turmaId).length;
  res.json({ proximaTurmaId, turmas: resumo, semTurma });
});
