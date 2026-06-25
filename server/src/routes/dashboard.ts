import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireSuperadmin } from "../auth.js";

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
    };
  });

  const semTurma = people.filter((p) => !p.turmaId).length;
  res.json({ proximaTurmaId, turmas: resumo, semTurma });
});
