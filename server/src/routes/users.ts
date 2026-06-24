import { Router } from "express";
import { prisma } from "../prisma.js";
import { hashPassword } from "../password.js";

export const usersRouter = Router();

// GET /api/users -> lista (sem expor o hash)
usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { username: "asc" },
    select: { id: true, username: true, createdAt: true },
  });
  res.json(users);
});

// POST /api/users { username, password }
usersRouter.post("/", async (req, res) => {
  const username = String(req.body?.username ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!username || password.length < 4) {
    return res
      .status(400)
      .json({ error: "Usuário obrigatório e senha com ao menos 4 caracteres." });
  }
  const existe = await prisma.user.findUnique({ where: { username } });
  if (existe && existe.active) {
    return res.status(409).json({ error: "Já existe um usuário com esse nome." });
  }
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hashPassword(password), active: true },
    create: { username, passwordHash: hashPassword(password) },
  });
  res.status(201).json({ id: user.id, username: user.username });
});

// PATCH /api/users/:id  { password }  -> redefine senha
usersRouter.patch("/:id", async (req, res) => {
  const password = String(req.body?.password ?? "");
  if (password.length < 4) {
    return res.status(400).json({ error: "Senha com ao menos 4 caracteres." });
  }
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: hashPassword(password) },
  });
  res.json({ ok: true });
});

// DELETE /api/users/:id  (não deixa remover o último usuário ativo)
usersRouter.delete("/:id", async (req, res) => {
  const ativos = await prisma.user.count({ where: { active: true } });
  if (ativos <= 1) {
    return res
      .status(400)
      .json({ error: "Não é possível remover o último usuário." });
  }
  await prisma.user.update({
    where: { id: req.params.id },
    data: { active: false },
  });
  res.status(204).end();
});
