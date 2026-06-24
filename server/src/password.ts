import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/** Gera "salt:hash" usando scrypt (sem dependência externa). */
export function hashPassword(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Compara a senha em texto com o hash guardado, em tempo constante. */
export function verifyPassword(senha: string, guardado: string): boolean {
  const [salt, hash] = guardado.split(":");
  if (!salt || !hash) return false;
  const atual = scryptSync(senha, salt, 64);
  const esperado = Buffer.from(hash, "hex");
  return atual.length === esperado.length && timingSafeEqual(atual, esperado);
}
