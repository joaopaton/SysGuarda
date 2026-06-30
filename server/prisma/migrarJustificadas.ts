// Migração única: registros antigos de presença com status "JUSTIFICADO" passam
// a ser "FALTA" + justificada=true (a falta justificada agora é um flag, não um
// status próprio). Rode UMA vez após aplicar o novo schema (db:push):
//   npx tsx prisma/migrarJustificadas.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.attendance.updateMany({
    where: { status: "JUSTIFICADO" },
    data: { status: "FALTA", justificada: true },
  });
  console.log(`Convertidos ${r.count} registro(s) JUSTIFICADO -> FALTA (justificada).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
