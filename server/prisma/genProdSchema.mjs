// Gera schema.production.prisma a partir do schema.prisma (dev/SQLite),
// trocando apenas o provider para PostgreSQL. Mantém um único schema-fonte.
import { readFileSync, writeFileSync } from "node:fs";

const src = new URL("./schema.prisma", import.meta.url);
const dst = new URL("./schema.production.prisma", import.meta.url);

const conteudo = readFileSync(src, "utf8").replace(
  'provider = "sqlite"',
  'provider = "postgresql"'
);

writeFileSync(
  dst,
  "// GERADO automaticamente por genProdSchema.mjs — NÃO EDITE À MÃO.\n" +
    "// Fonte: schema.prisma (apenas o provider muda para postgresql).\n\n" +
    conteudo
);

console.log("prisma/schema.production.prisma gerado (provider = postgresql).");
