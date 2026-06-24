import { Router } from "express";
import { prisma } from "../prisma.js";

export const peopleRouter = Router();

// GET /api/people -> { monitores, guardas }
peopleRouter.get("/", async (_req, res) => {
  const people = await prisma.person.findMany({
    where: { active: true },
    orderBy: { num: "asc" },
  });
  res.json({
    monitores: people.filter((p) => p.isMonitor),
    guardas: people.filter((p) => !p.isMonitor),
  });
});

// POST /api/people  { num, nome, isMonitor }
peopleRouter.post("/", async (req, res) => {
  const { num, nome, isMonitor } = req.body ?? {};
  if (!nome || typeof nome !== "string") {
    return res.status(400).json({ error: "nome é obrigatório" });
  }
  const person = await prisma.person.upsert({
    where: { num_nome: { num: num?.trim() || "---", nome: nome.trim().toUpperCase() } },
    update: { active: true, isMonitor: Boolean(isMonitor) },
    create: {
      num: num?.trim() || "---",
      nome: nome.trim().toUpperCase(),
      isMonitor: Boolean(isMonitor),
    },
  });
  res.status(201).json(person);
});

// PATCH /api/people/:id  { available }  -> marca presente/ausente (ex.: doente)
peopleRouter.patch("/:id", async (req, res) => {
  const { available } = req.body ?? {};
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: { available: Boolean(available) },
  });
  res.json(person);
});

// DELETE /api/people/:id  (soft delete -> active=false, preserva escalas antigas)
peopleRouter.delete("/:id", async (req, res) => {
  await prisma.person.update({
    where: { id: req.params.id },
    data: { active: false },
  });
  res.status(204).end();
});
