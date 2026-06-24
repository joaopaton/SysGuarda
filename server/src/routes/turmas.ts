import { Router } from "express";
import { prisma } from "../prisma.js";

export const turmasRouter = Router();

// GET /api/turmas -> turmas ativas (ordenadas pelo rodízio). Qualquer usuário
// autenticado pode listar (a UI restringe a seleção conforme o papel).
turmasRouter.get("/", async (_req, res) => {
  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
    select: { id: true, codigo: true, apelido: true, ordem: true },
  });
  res.json(turmas);
});
