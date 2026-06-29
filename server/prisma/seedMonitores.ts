/**
 * Seed pontual: cadastra os monitores das 4 séries (= turmas T1..T4) no efetivo
 * (isMonitor=true, vinculados à turma) E cria o login de cada um (papel monitor,
 * senha 1234). Idempotente — pode rodar de novo sem duplicar.
 *
 * Uso:  npm run seed:monitores     (dev: SQLite | prod: Postgres, conforme .env)
 *
 * O username é derivado do nome: minúsculo, sem acento, espaço vira ".".
 * (URBANO -> urbano | JOÃO PAULO -> joao.paulo | FRANÇA -> franca)
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";

const prisma = new PrismaClient();

const SENHA = "1234";

// Série = turma. Cada item: nº do militar + nome (identidade do efetivo).
const MONITORES: { num: string; nome: string; turma: string }[] = [
  // Série 1 -> T1
  { num: "103", nome: "URBANO", turma: "T1" },
  { num: "116", nome: "LEPERA", turma: "T1" },
  { num: "123", nome: "BARBOSA", turma: "T1" },
  { num: "128", nome: "MIRANDA", turma: "T1" },
  { num: "135", nome: "FREJUELLO", turma: "T1" },
  { num: "136", nome: "IMANISHI", turma: "T1" },
  { num: "139", nome: "FRANÇA", turma: "T1" },
  { num: "148", nome: "PEROTTI", turma: "T1" },
  // Série 2 -> T2
  { num: "221", nome: "DE PAULA", turma: "T2" },
  { num: "225", nome: "PERCOSKI", turma: "T2" },
  { num: "227", nome: "MATHEUS", turma: "T2" },
  { num: "229", nome: "COUTO", turma: "T2" },
  { num: "235", nome: "MANZATO", turma: "T2" },
  { num: "237", nome: "ERICK", turma: "T2" },
  { num: "243", nome: "CORNETO", turma: "T2" },
  { num: "249", nome: "ROMANHOLI", turma: "T2" },
  // Série 3 -> T3
  { num: "319", nome: "NOGUEIRA", turma: "T3" },
  { num: "333", nome: "BAZZACO", turma: "T3" },
  { num: "334", nome: "VELLONI", turma: "T3" },
  { num: "337", nome: "ANDREY", turma: "T3" },
  { num: "342", nome: "ALVES", turma: "T3" },
  { num: "343", nome: "MASSONI", turma: "T3" },
  { num: "346", nome: "CALIJURI", turma: "T3" },
  { num: "350", nome: "PIETRO", turma: "T3" },
  // Série 4 -> T4
  { num: "409", nome: "JOÃO PAULO", turma: "T4" },
  { num: "422", nome: "ADRIEL", turma: "T4" },
  { num: "427", nome: "PEDRAÇA", turma: "T4" },
  { num: "430", nome: "OSMAR", turma: "T4" },
  { num: "431", nome: "CORTE", turma: "T4" },
  { num: "437", nome: "BERNARDO", turma: "T4" },
  { num: "446", nome: "ARRAIS", turma: "T4" },
  { num: "450", nome: "NAPOLEÃO", turma: "T4" },
];

/** Nome -> username (minúsculo, sem acento, espaço vira ".", só [a-z0-9._-]). */
function usernameDe(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

async function main() {
  // Mapa código -> id das turmas (precisam existir; rode o seed normal antes).
  const turmas = await prisma.turma.findMany();
  const turmaPorCodigo = new Map(turmas.map((t) => [t.codigo, t.id]));

  let criadosEfetivo = 0;
  let criadosLogin = 0;
  const logins: string[] = [];

  for (const m of MONITORES) {
    const turmaId = turmaPorCodigo.get(m.turma) ?? null;
    if (!turmaId) {
      console.warn(`! Turma ${m.turma} não encontrada — pulando ${m.nome}.`);
      continue;
    }

    // 1) Efetivo: monitor da turma.
    const pEx = await prisma.person.findUnique({
      where: { num_nome: { num: m.num, nome: m.nome } },
    });
    await prisma.person.upsert({
      where: { num_nome: { num: m.num, nome: m.nome } },
      update: { isMonitor: true, active: true, turmaId },
      create: { num: m.num, nome: m.nome, isMonitor: true, turmaId },
    });
    if (!pEx) criadosEfetivo++;

    // 2) Login: papel monitor, senha 1234.
    const username = usernameDe(m.nome);
    const uEx = await prisma.user.findUnique({ where: { username } });
    await prisma.user.upsert({
      where: { username },
      update: { role: "monitor", turmaId, active: true, passwordHash: hashPassword(SENHA) },
      create: { username, passwordHash: hashPassword(SENHA), role: "monitor", turmaId },
    });
    if (!uEx) criadosLogin++;
    logins.push(`${username} (${m.turma})`);
  }

  console.log(
    `\nConcluído: ${MONITORES.length} monitores processados.\n` +
      `  efetivo: ${criadosEfetivo} novo(s) / ${MONITORES.length - criadosEfetivo} atualizado(s)\n` +
      `  logins:  ${criadosLogin} novo(s) / ${MONITORES.length - criadosLogin} atualizado(s) — senha "${SENHA}"\n` +
      `  usuários: ${logins.join(", ")}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
