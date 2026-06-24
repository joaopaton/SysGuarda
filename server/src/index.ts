import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basicAuth } from "./auth.js";
import { peopleRouter } from "./routes/people.js";
import { scheduleRouter } from "./routes/schedule.js";
import { historyRouter } from "./routes/history.js";
import { aditamentoRouter } from "./routes/aditamento.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(basicAuth);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/people", peopleRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/history", historyRouter);
app.use("/api/aditamento", aditamentoRouter);

// Em produção, o próprio Express serve o frontend já compilado (mesma origem).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist =
  process.env.CLIENT_DIST || path.resolve(__dirname, "../../client/dist");

if (process.env.NODE_ENV === "production" && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: qualquer rota não-API devolve o index.html.
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
