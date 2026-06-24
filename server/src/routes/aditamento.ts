import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireSuperadmin } from "../auth.js";
import { str } from "../scope.js";

export const aditamentoRouter = Router();

// ===== Instrutores (SGTs) =====

aditamentoRouter.get("/instructors", async (_req, res) => {
  const rows = await prisma.instructor.findMany({
    where: { active: true },
    orderBy: { nome: "asc" },
  });
  res.json(rows);
});

aditamentoRouter.post("/instructors", requireSuperadmin, async (req, res) => {
  const nome = str(req.body?.nome, 80).toUpperCase();
  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
  const inst = await prisma.instructor.upsert({
    where: { nome },
    update: { active: true },
    create: { nome },
  });
  res.status(201).json(inst);
});

aditamentoRouter.delete("/instructors/:id", requireSuperadmin, async (req, res) => {
  await prisma.instructor.update({
    where: { id: String(req.params.id) },
    data: { active: false },
  });
  res.status(204).end();
});

// ===== Configuração (linha única) =====

const SINGLETON = "singleton";

aditamentoRouter.get("/config", async (_req, res) => {
  const cfg = await prisma.aditamentoConfig.upsert({
    where: { id: SINGLETON },
    update: {},
    create: { id: SINGLETON },
  });
  res.json(cfg);
});

aditamentoRouter.put("/config", requireSuperadmin, async (req, res) => {
  const b = req.body ?? {};
  const campos = [
    "tg",
    "cidade",
    "numero",
    "uniforme",
    "assinante",
    "posto",
    "funcaoAssinante",
    "lema",
  ] as const;
  const data: Record<string, string> = {};
  for (const c of campos) if (typeof b[c] === "string") data[c] = b[c];

  const cfg = await prisma.aditamentoConfig.upsert({
    where: { id: SINGLETON },
    update: data,
    create: { id: SINGLETON, ...data },
  });
  res.json(cfg);
});
