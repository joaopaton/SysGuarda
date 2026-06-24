import { Router } from "express";
import { prisma } from "../prisma.js";
import { str, bool, isSuperadmin, podeTurma, turmaAlvo } from "../scope.js";
import { requireSuperadmin } from "../auth.js";

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
    where: {
      active: true,
      isMonitor: true,
      ...(isSuperadmin(req) ? {} : { turmaId: req.user?.turmaId ?? "__sem_turma__" }),
    },
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

// POST /api/people/atribuir-turma  { ids: string[], turmaId }  -> em massa
// Só o Comandante. Caminho distinto de "/" e "/:id" (sem conflito de rota).
peopleRouter.post("/atribuir-turma", requireSuperadmin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.filter((x: unknown) => typeof x === "string").slice(0, 1000)
    : [];
  const turmaId = str(req.body?.turmaId, 40) || null;
  if (ids.length === 0) {
    return res.status(400).json({ error: "Selecione ao menos uma pessoa." });
  }
  if (turmaId) {
    const t = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (!t || !t.active) return res.status(400).json({ error: "Turma inválida." });
  }
  const r = await prisma.person.updateMany({
    where: { id: { in: ids } },
    data: { turmaId },
  });
  res.json({ atualizadas: r.count });
});

// POST /api/people  { num, nome, isMonitor, turmaId }
peopleRouter.post("/", async (req, res) => {
  const nome = str(req.body?.nome, 80).toUpperCase();
  const num = str(req.body?.num, 10) || "---";
  const isMonitor = bool(req.body?.isMonitor);
  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });

  // Monitores e guardas pertencem a uma turma (forçada à do instrutor/monitor).
  const turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  if (!isSuperadmin(req) && !turmaId) {
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
