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
import { hashPassword, verifyPassword } from "./password.js";
import { peopleRouter } from "./routes/people.js";
import { scheduleRouter } from "./routes/schedule.js";
import { historyRouter } from "./routes/history.js";
import { aditamentoRouter } from "./routes/aditamento.js";
import { usersRouter } from "./routes/users.js";
import { turmasRouter } from "./routes/turmas.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { hoursRouter } from "./routes/hours.js";
import { attendanceRouter } from "./routes/attendance.js";
import { missionsRouter } from "./routes/missions.js";
import { auditoriaMiddleware, auditRouter } from "./audit.js";

const app = express();

// Atrás do Nginx (proxy reverso): confia no 1º hop p/ IP/protocolo reais.
app.set("trust proxy", 1);

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
  // Trim: alinha com a definição da senha (str() apara espaços), evitando que um
  // espaço acidental do teclado/gerenciador faça a senha correta ser rejeitada.
  const senha = String(req.body?.senha ?? "").trim();
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
app.use("/api", auditoriaMiddleware); // trilha de auditoria (após resolver o usuário)

// Trocar a própria senha (qualquer papel, estando logado).
app.post("/api/me/password", async (req, res) => {
  if (!loginAtivo()) {
    return res.status(400).json({ error: "Sem login em modo de desenvolvimento." });
  }
  // Trim em ambas: a definição da senha apara espaços (str()), então a verificação
  // precisa aparar também — senão um espaço invisível dá "Senha atual incorreta".
  const atual = String(req.body?.atual ?? "").trim();
  const nova = String(req.body?.nova ?? "").trim();
  if (nova.length < 4) {
    return res.status(400).json({ error: "Nova senha com ao menos 4 caracteres." });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.uid } });
  if (!user || !user.active) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }
  if (!verifyPassword(atual, user.passwordHash)) {
    return res.status(401).json({ error: "Senha atual incorreta." });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(nova) },
  });
  res.json({ ok: true });
});

app.use("/api/turmas", turmasRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/hours", hoursRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/missions", missionsRouter);
app.use("/api/people", peopleRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/history", historyRouter);
app.use("/api/aditamento", aditamentoRouter);
// Gestão de usuários: só o Comandante (superadmin).
app.use("/api/users", requireSuperadmin, usersRouter);
// Trilha de auditoria: Comandante vê tudo; instrutor/monitor só a sua turma (no router).
app.use("/api/audit", auditRouter);

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
