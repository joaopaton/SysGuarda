// Cria/atualiza um usuário de acesso.
// Uso: tsx prisma/createUser.ts <usuario> <senha>
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";

const prisma = new PrismaClient();

async function main() {
  const username = (process.argv[2] || "").trim().toLowerCase();
  const senha = process.argv[3] || "";
  if (!username || senha.length < 4) {
    throw new Error('Uso: tsx prisma/createUser.ts <usuario> <senha (min 4)>');
  }
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hashPassword(senha), active: true },
    create: { username, passwordHash: hashPassword(senha) },
  });
  console.log(`Usuário "${username}" criado/atualizado.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
