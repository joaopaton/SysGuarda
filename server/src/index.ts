import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  loginAtivo,
  sessaoValida,
  emitirSessao,
  limparSessao,
  credenciaisOk,
  requireAuth,
} from "./auth.js";
import { peopleRouter } from "./routes/people.js";
import { scheduleRouter } from "./routes/schedule.js";
import { historyRouter } from "./routes/history.js";
import { aditamentoRouter } from "./routes/aditamento.js";

const app = express();

app.use(cors({ credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ===== Rotas públicas (sem login) =====
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/me", (req, res) => {
  res.json({ authenticated: !loginAtivo() || sessaoValida(req) });
});

app.post("/api/login", (req, res) => {
  if (!loginAtivo()) {
    emitirSessao(res);
    return res.json({ ok: true });
  }
  const { usuario, senha } = req.body ?? {};
  if (credenciaisOk(String(usuario ?? ""), String(senha ?? ""))) {
    emitirSessao(res);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Usuário ou senha inválidos." });
});

app.post("/api/logout", (_req, res) => {
  limparSessao(res);
  res.json({ ok: true });
});

// ===== Rotas protegidas =====
app.use("/api", requireAuth);
app.use("/api/people", peopleRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/history", historyRouter);
app.use("/api/aditamento", aditamentoRouter);

// ===== Frontend (produção) =====
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist =
  process.env.CLIENT_DIST || path.resolve(__dirname, "../../client/dist");

if (process.env.NODE_ENV === "production" && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`Servindo frontend de ${clientDist}`);
}

const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, () => {
  console.log(`SysGuarda API em http://localhost:${PORT}`);
});
