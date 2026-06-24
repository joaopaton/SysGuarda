// Importa uma escala/contagem (CSV) como histórico manual, em processo.
// Uso: tsx prisma/importEscala.ts "<caminho.csv>" [replace|add]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { parseHistoricoText } from "../src/parseHistorico.js";

const prisma = new PrismaClient();

async function main() {
  const arquivo = process.argv[2];
  const mode = (process.argv[3] as "replace" | "add") || "replace";
  if (!arquivo) throw new Error("Informe o caminho do CSV.");

  const texto = readFileSync(arquivo, "utf8");
  let linhas = parseHistoricoText(texto);
  if (linhas.length === 0) throw new Error("Nenhuma linha válida no CSV.");

  // Reconcilia números pela identidade de nome no efetivo ativo.
  const people = await prisma.person.findMany({ where: { active: true } });
  const porChave = new Set(people.map((p) => p.num + p.nome));
  const porNome = new Map<string, { num: string }>();
  for (const p of people) if (!porNome.has(p.nome)) porNome.set(p.nome, p);
  linhas = linhas.map((l) => {
    if (porChave.has(l.num + l.nome)) return l;
    const m = porNome.get(l.nome);
    return m ? { ...l, num: m.num } : l;
  });

  if (mode !== "add") await prisma.manualHistory.deleteMany();
  for (const e of linhas) {
    const existente =
      mode === "add"
        ? await prisma.manualHistory.findUnique({
            where: { num_nome: { num: e.num, nome: e.nome } },
          })
        : null;
    await prisma.manualHistory.upsert({
      where: { num_nome: { num: e.num, nome: e.nome } },
      update: { guardas: (existente?.guardas ?? 0) + e.guardas },
      create: { num: e.num, nome: e.nome, guardas: e.guardas },
    });
  }

  const total = await prisma.manualHistory.count();
  console.log(`Importadas ${linhas.length} pessoas · ${total} no histórico (modo ${mode}).`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
