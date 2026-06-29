import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { prisma } from "./prisma.js";

// Métodos que alteram dados (os que entram na trilha de auditoria).
const MUTACOES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Rótulos amigáveis por método + rota normalizada. Sem match = "MÉTODO /rota".
const ROTULOS: Record<string, string> = {
  "POST /api/schedule/generate": "Gerou escala",
  "POST /api/schedule": "Salvou escala",
  "PUT /api/schedule/:id": "Editou escala",
  "POST /api/schedule/:id/fechar": "Fechou guarda",
  "POST /api/schedule/:id/reabrir": "Reabriu guarda",
  "DELETE /api/schedule/:id": "Excluiu escala",
  "POST /api/users": "Criou usuário",
  "PATCH /api/users/:id": "Alterou usuário",
  "DELETE /api/users/:id": "Removeu usuário",
  "POST /api/me/password": "Trocou a própria senha",
  "POST /api/missions": "Lançou missão",
  "POST /api/missions/lote": "Lançou missão (lote)",
  "POST /api/missions/importar": "Importou missões (CSV)",
  "PUT /api/missions/config": "Alterou meta de missões",
  "DELETE /api/missions/:id": "Removeu missão",
  "POST /api/attendance": "Registrou presença",
  "POST /api/people": "Cadastrou militar",
  "PATCH /api/people/:id": "Editou militar",
  "DELETE /api/people/:id": "Removeu militar",
  "POST /api/people/atribuir-turma": "Atribuiu turma (em massa)",
  "POST /api/people/importar-turmas": "Importou turmas (CSV)",
  "POST /api/hours/importar-ficha": "Importou FICHA de horas",
  "POST /api/history": "Importou histórico",
  "DELETE /api/history": "Limpou histórico",
  "PUT /api/aditamento/config": "Alterou config. do aditamento",
  "POST /api/aditamento/instructors": "Adicionou instrutor (sobreaviso)",
  "DELETE /api/aditamento/instructors/:id": "Removeu instrutor (sobreaviso)",
};

// Campos seguros do corpo p/ resumir no detalhe (NUNCA inclui senha/hash).
const CAMPOS_DETALHE = [
  "username", "nome", "num", "descricao", "startDate",
  "date", "status", "role", "horas", "metaHoras", "mode",
];

/** Troca segmentos com cara de id (cuid/numérico) por ":id" e devolve o último id. */
function normalizarRota(caminho: string): { rota: string; alvoId: string | null } {
  let alvoId: string | null = null;
  const rota = caminho
    .split("/")
    .map((seg) => {
      if (/^[a-z0-9]{20,}$/i.test(seg) || /^\d+$/.test(seg)) {
        alvoId = seg;
        return ":id";
      }
      return seg;
    })
    .join("/");
  return { rota, alvoId };
}

/** Resumo legível de campos seguros do corpo (sem expor senhas/CSV bruto). */
function resumoCorpo(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const partes: string[] = [];
  for (const k of CAMPOS_DETALHE) {
    const v = b[k];
    if ((typeof v === "string" || typeof v === "number") && v !== "") {
      partes.push(`${k}: ${String(v).slice(0, 40)}`);
    }
  }
  if (Array.isArray(b.ids)) partes.push(`${b.ids.length} militar(es)`);
  if (Array.isArray(b.registros)) partes.push(`${b.registros.length} registro(s)`);
  if (typeof b.csv === "string" && b.csv) partes.push("via CSV");
  const s = partes.join(" · ");
  return s ? s.slice(0, 240) : null;
}

// Retenção: apaga registros mais antigos que N dias (env AUDIT_RETENTION_DIAS).
const RETENCAO_DIAS = Number(process.env.AUDIT_RETENTION_DIAS) || 90;
let ultimaLimpeza = 0;

/** Poda registros antigos — no máximo 1x/hora, best-effort. */
function limparAntigos() {
  const agora = Date.now();
  if (agora - ultimaLimpeza < 60 * 60 * 1000) return;
  ultimaLimpeza = agora;
  const corte = new Date(agora - RETENCAO_DIAS * 24 * 60 * 60 * 1000);
  prisma.auditLog.deleteMany({ where: { createdAt: { lt: corte } } }).catch(() => {});
}

/** Grava uma entrada de auditoria — best-effort, nunca derruba a requisição. */
function registrar(data: {
  userId: string | null;
  username: string;
  role: string;
  turmaId: string | null;
  acao: string;
  method: string;
  rota: string;
  status: number;
  alvoId: string | null;
  detalhe: string | null;
}) {
  prisma.auditLog.create({ data }).catch(() => {
    /* nunca interrompe o fluxo principal por falha de log */
  });
  limparAntigos();
}

/**
 * Middleware (após requireAuth): registra cada escrita bem-sucedida.
 * Captura método/rota/status/usuário automaticamente — sem tocar nas rotas.
 */
export function auditoriaMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!MUTACOES.has(req.method)) return next();

  const caminho = req.originalUrl.split("?")[0];
  const { rota, alvoId } = normalizarRota(caminho);
  const chave = `${req.method} ${rota}`;
  const acao = ROTULOS[chave] ?? chave;
  const detalhe = resumoCorpo(req.body);
  const u = req.user;

  res.on("finish", () => {
    // Só registra mudanças efetivadas (respostas de sucesso).
    if (res.statusCode >= 400) return;
    registrar({
      userId: u?.uid ?? null,
      username: u?.username ?? "?",
      role: u?.role ?? "?",
      turmaId: u?.turmaId ?? null,
      acao,
      method: req.method,
      rota,
      status: res.statusCode,
      alvoId,
      detalhe,
    });
  });

  next();
}

// ===== Consulta (só o Comandante) =====
export const auditRouter = Router();

// GET /api/audit?limit=&offset=  -> página de entradas (mais recentes primeiro).
auditRouter.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 200);
  const offset = Math.max(Number(req.query?.offset) || 0, 0);
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count(),
  ]);
  res.json({ logs, total, offset, limit, retencaoDias: RETENCAO_DIAS });
});
