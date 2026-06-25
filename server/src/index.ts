import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  loginAtivo,
  usuarioDaSessao,
  emitirSessao,
  limparSessao,
  requireAuth,
  requireSuperadmin,
} from "./auth.js";
import { prisma } from "./prisma.js";
import { verifyPassword } from "./password.js";
import { peopleRouter } from "./routes/people.js";
import { scheduleRouter } from "./routes/schedule.js";
import { historyRouter } from "./routes/history.js";
import { aditamentoRouter } from "./routes/aditamento.js";
import { usersRouter } from "./routes/users.js";
import { turmasRouter } from "./routes/turmas.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();

app.use(cors({ credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ===== Rotas públicas (sem login) =====
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/me", async (req, res) => {
  const u = await usuarioDaSessao(req);
  if (!u) return res.json({ authenticated: false });
  let turma: { id: string; codigo: string; apelido: string } | null = null;
  if (u.turmaId) {
    const t = await prisma.turma.findUnique({ where: { id: u.turmaId } });
    if (t) turma = { id: t.id, codigo: t.codigo, apelido: t.apelido };
  }
  res.json({
    authenticated: true,
    user: { username: u.username, role: u.role, turma },
  });
});

app.post("/api/login", async (req, res) => {
  if (!loginAtivo()) {
    emitirSessao(res, "dev");
    return res.json({ ok: true });
  }
  const usuario = String(req.body?.usuario ?? "").trim().toLowerCase();
  const senha = String(req.body?.senha ?? "");
  const user = await prisma.user.findUnique({ where: { username: usuario } });
  if (user && user.active && verifyPassword(senha, user.passwordHash)) {
    emitirSessao(res, user.id);
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
app.use("/api/turmas", turmasRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/people", peopleRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/history", historyRouter);
app.use("/api/aditamento", aditamentoRouter);
// Gestão de usuários: só o Comandante (superadmin).
app.use("/api/users", requireSuperadmin, usersRouter);

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
