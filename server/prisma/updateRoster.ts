// Atualiza o efetivo de GUARDAS a partir da relação de ATIRADORES (T2).
// Desativa guardas fora da lista e ativa/insere os atuais. Monitores intactos.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Relação atual extraída de "Escalas das guardas - ATIRADORES.csv".
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

// Monitores (Cmt Gd TG) — relação fixa, vista na escala de Julho.
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

async function main() {
  const manter = new Set([
    ...GUARDAS.map((g) => g.num + g.nome),
    ...MONITORES.map((m) => m.num + m.nome),
  ]);

  // Desativa quem não está mais nas listas.
  const todos = await prisma.person.findMany();
  for (const p of todos) {
    if (!manter.has(p.num + p.nome) && p.active) {
      await prisma.person.update({ where: { id: p.id }, data: { active: false } });
    }
  }

  for (const g of GUARDAS) {
    await prisma.person.upsert({
      where: { num_nome: g },
      update: { isMonitor: false, active: true },
      create: { ...g, isMonitor: false },
    });
  }
  for (const m of MONITORES) {
    await prisma.person.upsert({
      where: { num_nome: m },
      update: { isMonitor: true, active: true },
      create: { ...m, isMonitor: true },
    });
  }

  const ativos = await prisma.person.count({ where: { active: true } });
  const mon = await prisma.person.count({ where: { active: true, isMonitor: true } });
  console.log(`Roster atualizado: ${ativos} ativos (${mon} monitores, ${ativos - mon} guardas).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
