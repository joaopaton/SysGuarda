import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "sg_session";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

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

/** Token autônomo (stateless): payload assinado com HMAC + expiração. */
function criarToken() {
  const payload = b64url(JSON.stringify({ exp: Date.now() + VALIDADE_MS }));
  return `${payload}.${assinar(payload)}`;
}

function tokenValido(token?: string) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!igual(sig, assinar(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
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

/** Login protegido ativo somente quando APP_PASSWORD está definido. */
export function loginAtivo() {
  return Boolean(process.env.APP_PASSWORD);
}

export function sessaoValida(req: Request) {
  return tokenValido(lerCookie(req));
}

export function emitirSessao(res: Response) {
  res.cookie(COOKIE, criarToken(), {
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

export function credenciaisOk(usuario: string, senha: string) {
  const u = process.env.APP_USER || "admin";
  const p = process.env.APP_PASSWORD || "";
  return Boolean(usuario) && Boolean(senha) && igual(usuario, u) && igual(senha, p);
}

/** Middleware: bloqueia rotas protegidas quando o login está ativo. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!loginAtivo()) return next(); // dev: aberto
  if (sessaoValida(req)) return next();
  res.status(401).json({ error: "Não autenticado." });
}
