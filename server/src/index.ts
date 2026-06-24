import express from "express";
import cors from "cors";
import { peopleRouter } from "./routes/people.js";
import { scheduleRouter } from "./routes/schedule.js";
import { historyRouter } from "./routes/history.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/people", peopleRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/history", historyRouter);

const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, () => {
  console.log(`SysGuarda API em http://localhost:${PORT}`);
});
