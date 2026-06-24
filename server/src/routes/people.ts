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

// POST /api/people/importar-turmas  { csv }  -> atribui turma em lote por CSV.
// Linhas tolerantes: "num;nome;turma" ou "nome;turma". Turma por código (T1),
// apelido (Caveira) ou número (1). Casa a pessoa por (num+nome) ou só por nome.
peopleRouter.post("/importar-turmas", requireSuperadmin, async (req, res) => {
  const csv = str(req.body?.csv, 200000).replace(/^﻿/, "");
  if (!csv) return res.status(400).json({ error: "CSV vazio." });

  const turmas = await prisma.turma.findMany({ where: { active: true } });
  const turmaPorChave = new Map<string, string>();
  for (const t of turmas) {
    turmaPorChave.set(t.codigo.toLowerCase(), t.id);
    turmaPorChave.set(t.apelido.toLowerCase(), t.id);
    turmaPorChave.set(String(t.ordem), t.id);
  }
  const acharTurma = (raw: string): string | undefined => {
    const v = raw.trim().toLowerCase();
    if (!v) return undefined;
    if (turmaPorChave.has(v)) return turmaPorChave.get(v);
    const n = v.replace(/[^0-9]/g, "");
    return n ? turmaPorChave.get(n) : undefined;
  };

  const people = await prisma.person.findMany({ where: { active: true } });
  const porChave = new Map<string, string>();
  const porNome = new Map<string, string[]>();
  for (const p of people) {
    porChave.set((p.num + p.nome).toUpperCase(), p.id);
    const k = p.nome.toUpperCase();
    (porNome.get(k) ?? porNome.set(k, []).get(k)!).push(p.id);
  }

  const byTurma = new Map<string, string[]>();
  const naoEncontrados: string[] = [];
  const turmaInvalida: string[] = [];

  const linhas = csv.split(/\r?\n/);
  linhas.forEach((linha, i) => {
    const cols = linha.split(/[;,\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
    if (cols.every((c) => !c)) return;
    // pula cabeçalho
    if (i === 0 && /turma/i.test(linha) && !/^\d{2,4}\b/.test(cols[0])) return;

    let num = "";
    let nome = "";
    let turmaRaw = "";
    if (cols.length >= 3) [num, nome, turmaRaw] = cols;
    else if (cols.length === 2) [nome, turmaRaw] = cols;
    else return;
    nome = nome.toUpperCase();
    if (!nome || !turmaRaw) return;

    const turmaId = acharTurma(turmaRaw);
    if (!turmaId) {
      turmaInvalida.push(`${nome} (${turmaRaw})`);
      return;
    }
    let pid = num ? porChave.get((num + nome).toUpperCase()) : undefined;
    if (!pid) {
      const hits = porNome.get(nome);
      if (hits && hits.length === 1) pid = hits[0];
    }
    if (!pid) {
      naoEncontrados.push(num ? `${num} ${nome}` : nome);
      return;
    }
    (byTurma.get(turmaId) ?? byTurma.set(turmaId, []).get(turmaId)!).push(pid);
  });

  let atualizadas = 0;
  for (const [turmaId, ids] of byTurma) {
    const r = await prisma.person.updateMany({
      where: { id: { in: ids } },
      data: { turmaId },
    });
    atualizadas += r.count;
  }
  res.json({ atualizadas, naoEncontrados, turmaInvalida });
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
