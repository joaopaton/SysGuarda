import { Router } from "express";
import { prisma } from "../prisma.js";
import { hashPassword } from "../password.js";
import { str } from "../scope.js";

export const usersRouter = Router();

const incluirTurma = { turma: { select: { codigo: true, apelido: true } } };

function papelValido(role: string): "superadmin" | "instrutor" {
  return role === "superadmin" ? "superadmin" : "instrutor";
}

async function turmaValida(turmaId: string | null): Promise<boolean> {
  if (!turmaId) return true;
  const t = await prisma.turma.findUnique({ where: { id: turmaId } });
  return !!t && t.active;
}

// GET /api/users -> lista (sem expor o hash)
usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      ...incluirTurma,
    },
  });
  res.json(users);
});

// POST /api/users { username, password, role, turmaId }
usersRouter.post("/", async (req, res) => {
  const username = str(req.body?.username, 40).toLowerCase();
  const password = str(req.body?.password, 200);
  const role = papelValido(str(req.body?.role, 20));
  const turmaId = str(req.body?.turmaId, 40) || null;

  if (!username || password.length < 4) {
    return res
      .status(400)
      .json({ error: "Usuário obrigatório e senha com ao menos 4 caracteres." });
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return res.status(400).json({ error: "Usuário: use apenas letras, números, . _ -" });
  }
  if (!(await turmaValida(turmaId))) {
    return res.status(400).json({ error: "Turma inválida." });
  }
  const existe = await prisma.user.findUnique({ where: { username } });
  if (existe && existe.active) {
    return res.status(409).json({ error: "Já existe um usuário com esse nome." });
  }
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hashPassword(password), active: true, role, turmaId },
    create: { username, passwordHash: hashPassword(password), role, turmaId },
    select: { id: true, username: true, role: true },
  });
  res.status(201).json(user);
});

// PATCH /api/users/:id  { password?, role?, turmaId? }
usersRouter.patch("/:id", async (req, res) => {
  const alvo = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(404).json({ error: "não encontrado" });

  const data: { passwordHash?: string; role?: string; turmaId?: string | null } = {};
  const body = req.body ?? {};

  if ("password" in body) {
    const password = str(body.password, 200);
    if (password.length < 4) {
      return res.status(400).json({ error: "Senha com ao menos 4 caracteres." });
    }
    data.passwordHash = hashPassword(password);
  }
  if ("role" in body) {
    const novo = papelValido(str(body.role, 20));
    // Não deixa rebaixar o último superadmin.
    if (alvo.role === "superadmin" && novo !== "superadmin") {
      const supers = await prisma.user.count({
        where: { active: true, role: "superadmin" },
      });
      if (supers <= 1) {
        return res
          .status(400)
          .json({ error: "É preciso ao menos um Comandante (superadmin)." });
      }
    }
    data.role = novo;
  }
  if ("turmaId" in body) {
    const turmaId = str(body.turmaId, 40) || null;
    if (!(await turmaValida(turmaId))) {
      return res.status(400).json({ error: "Turma inválida." });
    }
    data.turmaId = turmaId;
  }

  await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ ok: true });
});

// DELETE /api/users/:id  (não deixa remover o último superadmin)
usersRouter.delete("/:id", async (req, res) => {
  const alvo = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!alvo) return res.status(204).end();
  if (alvo.role === "superadmin") {
    const supers = await prisma.user.count({
      where: { active: true, role: "superadmin" },
    });
    if (supers <= 1) {
      return res
        .status(400)
        .json({ error: "Não é possível remover o último Comandante." });
    }
  }
  await prisma.user.update({
    where: { id: req.params.id },
    data: { active: false },
  });
  res.status(204).end();
});
