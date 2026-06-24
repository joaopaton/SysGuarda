import { Router } from "express";
import { prisma } from "../prisma.js";
import { parseHistoricoText, type LinhaHistorico } from "../parseHistorico.js";

export const historyRouter = Router();

function normalizar(raw: unknown): LinhaHistorico[] {
  if (!Array.isArray(raw)) return [];
  const out: LinhaHistorico[] = [];
  for (const r of raw) {
    const num = String(r?.num ?? "").trim() || "---";
    const nome = String(r?.nome ?? "").trim().toUpperCase();
    const guardas = Number(r?.guardas);
    if (!nome || !Number.isFinite(guardas)) continue;
    out.push({ num, nome, guardas: Math.max(0, Math.trunc(guardas)) });
  }
  return out;
}

/**
 * Reconcilia as linhas com o efetivo ativo: se um (num+nome) não bater mas o
 * NOME existir no efetivo, usa o número atual do efetivo. Resolve o caso em que
 * a planilha antiga usa um número que mudou (ex.: 229 ZUCA → 230 ZUCA).
 */
async function reconciliarPorNome(linhas: LinhaHistorico[]): Promise<LinhaHistorico[]> {
  const people = await prisma.person.findMany({ where: { active: true } });
  const porChave = new Set(people.map((p) => p.num + p.nome));
  const porNome = new Map<string, { num: string; nome: string }>();
  for (const p of people) if (!porNome.has(p.nome)) porNome.set(p.nome, p);

  return linhas.map((l) => {
    if (porChave.has(l.num + l.nome)) return l;
    const m = porNome.get(l.nome);
    return m ? { ...l, num: m.num } : l;
  });
}

// GET /api/history -> contagens manuais salvas
historyRouter.get("/", async (_req, res) => {
  const rows = await prisma.manualHistory.findMany({ orderBy: { num: "asc" } });
  res.json(rows);
});

// POST /api/history  { csv?: string, entries?: [...], mode: "replace" | "add" }
// Aceita CSV bruto (contagem OU grade de escala) ou linhas já parseadas.
historyRouter.post("/", async (req, res) => {
  const { csv, entries, mode } = req.body ?? {};
  let linhas =
    typeof csv === "string" && csv.trim()
      ? parseHistoricoText(csv)
      : normalizar(entries);

  if (linhas.length === 0) {
    return res
      .status(400)
      .json({ error: "Nenhuma linha válida (esperado: num/nome/guardas ou grade de escala)." });
  }

  linhas = await reconciliarPorNome(linhas);

  await prisma.$transaction(async (tx) => {
    if (mode !== "add") await tx.manualHistory.deleteMany();
    for (const e of linhas) {
      const existente =
        mode === "add"
          ? await tx.manualHistory.findUnique({
              where: { num_nome: { num: e.num, nome: e.nome } },
            })
          : null;
      await tx.manualHistory.upsert({
        where: { num_nome: { num: e.num, nome: e.nome } },
        update: { guardas: (existente?.guardas ?? 0) + e.guardas },
        create: { num: e.num, nome: e.nome, guardas: e.guardas },
      });
    }
  });

  const total = await prisma.manualHistory.count();
  res.status(201).json({ importadas: linhas.length, total });
});

// DELETE /api/history -> limpa o histórico manual
historyRouter.delete("/", async (_req, res) => {
  await prisma.manualHistory.deleteMany();
  res.status(204).end();
});
