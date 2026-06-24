import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma.js";

const COOKIE = "sg_session";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type Papel = "superadmin" | "instrutor" | "monitor";

/** Normaliza a string de papel vinda do banco. */
export function normalizarPapel(role: string): Papel {
  if (role === "superadmin") return "superadmin";
  if (role === "monitor") return "monitor";
  return "instrutor";
}

export interface SessionUser {
  uid: string;
  username: string;
  role: Papel;
  turmaId: string | null;
}

// Disponibiliza req.user nas rotas tipadas.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

function igual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function segredo() {
  // Em produção defina APP_SECRET; senão deriva da senha do app.
  return process.env.APP_SECRET || process.env.APP_PASSWORD || "dev-secret";
}

function b64url(s: string) {
  return Buffer.from(s).toString("base64url");
}

function assinar(payload: string) {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}

/** Token autônomo (stateless): payload assinado com HMAC + uid + expiração. */
function criarToken(uid: string) {
  const payload = b64url(JSON.stringify({ uid, exp: Date.now() + VALIDADE_MS }));
  return `${payload}.${assinar(payload)}`;
}

function payloadValido(token?: string): { uid?: string; exp: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!igual(sig, assinar(payload))) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof obj?.exp === "number" && obj.exp > Date.now()) return obj;
    return null;
  } catch {
    return null;
  }
}

function lerCookie(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const par of raw.split(";")) {
    const [k, ...v] = par.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Login exigido em produção (ou se APP_PASSWORD estiver definido). */
export function loginAtivo() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.APP_PASSWORD);
}

// Em dev (login desativado) usamos um superadmin sintético com acesso total.
const DEV_SUPER: SessionUser = {
  uid: "dev",
  username: "dev",
  role: "superadmin",
  turmaId: null,
};

/** Resolve o usuário da sessão (ou null). Em dev sem login, vira superadmin. */
export async function usuarioDaSessao(req: Request): Promise<SessionUser | null> {
  if (!loginAtivo()) return DEV_SUPER;
  const p = payloadValido(lerCookie(req));
  if (!p?.uid) return null;
  const u = await prisma.user.findUnique({ where: { id: p.uid } });
  if (!u || !u.active) return null;
  return {
    uid: u.id,
    username: u.username,
    role: normalizarPapel(u.role),
    turmaId: u.turmaId,
  };
}

export function emitirSessao(res: Response, uid: string) {
  res.cookie(COOKIE, criarToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // ainda em HTTP por IP; ligar quando houver HTTPS
    maxAge: VALIDADE_MS,
    path: "/",
  });
}

export function limparSessao(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

/** Middleware: exige sessão válida e popula req.user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const u = await usuarioDaSessao(req);
  if (!u) return res.status(401).json({ error: "Não autenticado." });
  req.user = u;
  next();
}

/** Middleware: só o Comandante (superadmin). Use depois de requireAuth. */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ error: "Acesso restrito ao Comandante do TG." });
  }
  next();
}
