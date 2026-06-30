// Helpers de validação de entrada e de escopo por turma (autorização).
import type { Request } from "express";

/** Normaliza para string limpa, com tamanho máximo (evita payloads abusivos). */
export function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Booleano tolerante (aceita true/false ou ausência). */
export function bool(v: unknown): boolean {
  return v === true || v === "true";
}

/** Inteiro dentro de [min, max] ou null se inválido. */
export function intIn(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.trunc(n);
}

export function isSuperadmin(req: Request): boolean {
  return req.user?.role === "superadmin";
}

/** Pode classificar falta como justificada? Só instrutor e Comandante (monitor não). */
export function podeClassificar(req: Request): boolean {
  return req.user?.role === "superadmin" || req.user?.role === "instrutor";
}

/**
 * Filtro de turma para consultas Prisma:
 *  - superadmin: {} (vê tudo)
 *  - instrutor:  { turmaId: <sua turma> }  (ou turma impossível se não tiver)
 */
export function filtroTurma(req: Request): { turmaId?: string } {
  if (isSuperadmin(req)) return {};
  return { turmaId: req.user?.turmaId ?? "__sem_turma__" };
}

/** O usuário pode agir sobre algo desta turma? */
export function podeTurma(req: Request, turmaId: string | null | undefined): boolean {
  if (isSuperadmin(req)) return true;
  return !!turmaId && turmaId === req.user?.turmaId;
}

/** Turma alvo de uma operação de escrita: instrutor é sempre forçado à sua. */
export function turmaAlvo(req: Request, pedido: string | null): string | null {
  if (isSuperadmin(req)) return pedido;
  return req.user?.turmaId ?? null;
}
