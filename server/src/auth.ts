import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

function igual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Login simples via HTTP Basic Auth.
 * Só protege quando APP_PASSWORD está definido (produção); em dev fica aberto.
 * /api/health continua livre para health-check/monitoramento.
 */
export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const senha = process.env.APP_PASSWORD;
  if (!senha) return next(); // sem senha configurada => aberto (dev)
  if (req.path === "/api/health") return next();

  const usuario = process.env.APP_USER || "admin";
  const header = req.headers.authorization || "";
  const [scheme, enc] = header.split(" ");
  if (scheme === "Basic" && enc) {
    const [u, p] = Buffer.from(enc, "base64").toString().split(":");
    if (u && p && igual(u, usuario) && igual(p, senha)) return next();
  }

  res
    .set("WWW-Authenticate", 'Basic realm="SysGuarda", charset="UTF-8"')
    .status(401)
    .send("Autenticação necessária.");
}
