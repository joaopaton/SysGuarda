import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";

const prisma = new PrismaClient();

const MONITORES = [
  { num: "221", nome: "DE PAULA" },
  { num: "225", nome: "PERCOSKI" },
  { num: "227", nome: "MATHEUS" },
  { num: "229", nome: "COUTO" },
  { num: "235", nome: "MANZATO" },
  { num: "237", nome: "ERICK" },
  { num: "243", nome: "CORNETO" },
  { num: "249", nome: "ROMANHOLI" },
];

const GUARDAS = [
  { num: "201", nome: "CHON" },
  { num: "202", nome: "FARÃO" },
  { num: "203", nome: "PICONI" },
  { num: "204", nome: "BIBIANO" },
  { num: "205", nome: "CAVALCANTE" },
  { num: "206", nome: "VICTOR" },
  { num: "207", nome: "CARLOTO" },
  { num: "208", nome: "RHASLLER" },
  { num: "209", nome: "PATON" },
  { num: "210", nome: "VILLA" },
  { num: "211", nome: "YAHN" },
  { num: "212", nome: "DA LUZ" },
  { num: "213", nome: "RAPHAEL" },
  { num: "214", nome: "ATHOS" },
  { num: "215", nome: "COELHO" },
  { num: "216", nome: "BASTOS" },
  { num: "217", nome: "MASSARO" },
  { num: "218", nome: "FILHO" },
  { num: "219", nome: "EDUARDO" },
  { num: "220", nome: "YADNAK" },
  { num: "222", nome: "GALVÃO" },
  { num: "223", nome: "ANTONIO" },
  { num: "224", nome: "FERNANDES" },
  { num: "226", nome: "NICACIO" },
  { num: "228", nome: "CESAR" },
  { num: "230", nome: "ZUCA" },
  { num: "231", nome: "SALES" },
  { num: "232", nome: "DE OLIVEIRA" },
  { num: "233", nome: "OTAVIO" },
  { num: "236", nome: "PELUSO" },
  { num: "239", nome: "DOS SANTOS" },
  { num: "240", nome: "ABREU" },
  { num: "241", nome: "HARTHMAN" },
  { num: "242", nome: "A EMANUEL" },
  { num: "244", nome: "VITAL" },
  { num: "245", nome: "PIZONI" },
  { num: "246", nome: "FUJARA" },
  { num: "247", nome: "HIDEKI" },
  { num: "248", nome: "PATERNO" },
  { num: "250", nome: "MASENA" },
];

// Turmas do TG 05-003 (rodízio T1 -> T4).
const TURMAS = [
  { codigo: "T1", apelido: "Caveira", ordem: 1 },
  { codigo: "T2", apelido: "Pantera", ordem: 2 },
  { codigo: "T3", apelido: "Cães de Guerra", ordem: 3 },
  { codigo: "T4", apelido: "Aço", ordem: 4 },
];

// Contas iniciais. Senha padrão (trocar no 1º acesso): SEED_PASSWORD ou "mudar123".
// role superadmin = Comandante do TG (vê tudo); instrutor = Sgt da turma.
const CONTAS = [
  { username: "mario", role: "superadmin", turma: "T3" }, // S Ten Mario Gomes
  { username: "lucas", role: "instrutor", turma: "T1" }, // Sgt Lucas
  { username: "schutz", role: "instrutor", turma: "T2" }, // Sgt Schütz
  { username: "robson", role: "instrutor", turma: "T4" }, // Sgt Robson
  { username: "corneto", role: "monitor", turma: "T2" }, // Monitor da T2
];

async function main() {
  // Turmas primeiro (necessárias p/ vincular pessoas e contas).
  const turmaPorCodigo = new Map<string, string>();
  for (const t of TURMAS) {
    const turma = await prisma.turma.upsert({
      where: { codigo: t.codigo },
      update: { apelido: t.apelido, ordem: t.ordem, active: true },
      create: t,
    });
    turmaPorCodigo.set(t.codigo, turma.id);
  }

  for (const m of MONITORES) {
    await prisma.person.upsert({
      where: { num_nome: { num: m.num, nome: m.nome } },
      update: { isMonitor: true, active: true },
      create: { ...m, isMonitor: true },
    });
  }
  for (const g of GUARDAS) {
    await prisma.person.upsert({
      where: { num_nome: { num: g.num, nome: g.nome } },
      update: { isMonitor: false, active: true },
      create: { ...g, isMonitor: false },
    });
  }
  const INSTRUTORES = [
    "SGT SCHÜTZ",
    "SGT ST MARIO GOMES",
    "SGT ROBSON",
    "SGT LUCAS",
  ];
  for (const nome of INSTRUTORES) {
    await prisma.instructor.upsert({
      where: { nome },
      update: { active: true },
      create: { nome },
    });
  }

  // Contas: comandante (superadmin) + instrutores. Senha só é definida na
  // CRIAÇÃO — não sobrescreve a senha de quem já existe.
  const senhaPadrao = process.env.SEED_PASSWORD || "mudar123";
  for (const c of CONTAS) {
    await prisma.user.upsert({
      where: { username: c.username },
      update: { role: c.role, turmaId: turmaPorCodigo.get(c.turma) ?? null, active: true },
      create: {
        username: c.username,
        passwordHash: hashPassword(senhaPadrao),
        role: c.role,
        turmaId: turmaPorCodigo.get(c.turma) ?? null,
      },
    });
  }

  // Usuário inicial do .env (compat): garante ao menos 1 superadmin de socorro.
  const u = (process.env.APP_USER || "admin").trim().toLowerCase();
  await prisma.user.upsert({
    where: { username: u },
    update: { role: "superadmin", active: true },
    create: {
      username: u,
      passwordHash: hashPassword(process.env.APP_PASSWORD || senhaPadrao),
      role: "superadmin",
    },
  });

  const total = await prisma.person.count();
  console.log(
    `Seed concluído: ${total} pessoas, ${TURMAS.length} turmas, ` +
      `${CONTAS.length + 1} contas (senha padrão das novas: "${senhaPadrao}").`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
