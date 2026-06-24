import { Router } from "express";
import { prisma } from "../prisma.js";
import { str, bool, isSuperadmin, podeTurma, turmaAlvo } from "../scope.js";

export const peopleRouter = Router();

const incluirTurma = { turma: { select: { codigo: true, apelido: true } } };

// Garante que a turma existe (e está ativa). Lança 400 via retorno null.
async function turmaValida(turmaId: string | null): Promise<boolean> {
  if (!turmaId) return true; // sem turma é permitido (monitores)
  const t = await prisma.turma.findUnique({ where: { id: turmaId } });
  return !!t && t.active;
}

// GET /api/people -> { monitores, guardas }
// Monitores são TG-wide (todos veem). Guardas: superadmin vê todas; instrutor
// vê apenas as da sua turma.
peopleRouter.get("/", async (req, res) => {
  const monitores = await prisma.person.findMany({
    where: { active: true, isMonitor: true },
    orderBy: { num: "asc" },
    include: incluirTurma,
  });
  const guardas = await prisma.person.findMany({
    where: {
      active: true,
      isMonitor: false,
      ...(isSuperadmin(req) ? {} : { turmaId: req.user?.turmaId ?? "__sem_turma__" }),
    },
    orderBy: { num: "asc" },
    include: incluirTurma,
  });
  res.json({ monitores, guardas });
});

// POST /api/people  { num, nome, isMonitor, turmaId }
peopleRouter.post("/", async (req, res) => {
  const nome = str(req.body?.nome, 80).toUpperCase();
  const num = str(req.body?.num, 10) || "---";
  const isMonitor = bool(req.body?.isMonitor);
  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

  // Instrutor só cadastra guardas na própria turma; monitores são do Comandante.
  if (isMonitor && !isSuperadmin(req)) {
    return res.status(403).json({ error: "Apenas o Comandante cadastra monitores." });
  }
  // Monitores não têm turma; guardas têm (forçada à do instrutor, se for o caso).
  const turmaId = isMonitor ? null : turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  if (!isMonitor && !isSuperadmin(req) && !turmaId) {
    return res.status(403).json({ error: "Seu usuário não tem turma definida." });
  }
  if (!(await turmaValida(turmaId))) {
    return res.status(400).json({ error: "Turma inválida." });
  }

  const person = await prisma.person.upsert({
    where: { num_nome: { num, nome } },
    update: { active: true, isMonitor, turmaId },
    create: { num, nome, isMonitor, turmaId },
    include: incluirTurma,
  });
  res.status(201).json(person);
});

// PATCH /api/people/:id  { available?, turmaId? }
peopleRouter.patch("/:id", async (req, res) => {
  const alvo = await prisma.person.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, alvo.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta pessoa." });
  }

  const data: { available?: boolean; turmaId?: string | null } = {};
  if ("available" in (req.body ?? {})) data.available = bool(req.body.available);
  // Trocar a turma é só do Comandante.
  if ("turmaId" in (req.body ?? {}) && isSuperadmin(req)) {
    const nova = str(req.body.turmaId, 40) || null;
    if (!(await turmaValida(nova))) {
      return res.status(400).json({ error: "Turma inválida." });
    }
    data.turmaId = nova;
  }

  const person = await prisma.person.update({
    where: { id: req.params.id },
    data,
    include: incluirTurma,
  });
  res.json(person);
});

// DELETE /api/people/:id  (soft delete -> active=false, preserva escalas antigas)
peopleRouter.delete("/:id", async (req, res) => {
  const alvo = await prisma.person.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, alvo.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta pessoa." });
  }
  await prisma.person.update({
    where: { id: req.params.id },
    data: { active: false },
  });
  res.status(204).end();
});
