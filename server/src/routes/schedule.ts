import { Router } from "express";
import { prisma } from "../prisma.js";
import {
  FUNCOES,
  NUM_DIAS,
  ajustarParaTerca,
  getRotulos,
  keyOf,
  type Funcao,
} from "../domain.js";
import { gerarEscala, type Escala, type Historico } from "../generate.js";
import { isSuperadmin, podeTurma, turmaAlvo, str } from "../scope.js";

export const scheduleRouter = Router();

const incluirTurma = { turma: { select: { id: true, codigo: true, apelido: true } } };

// Efetivo disponível para gerar a escala de UMA turma:
//  - monitores: TG-wide (todos os disponíveis).
//  - guardas: apenas os da turma (disponíveis).
//  - byKey: mapa completo (ativos) p/ vincular personId ao salvar.
async function efetivoAtivo(turmaId: string | null) {
  const people = await prisma.person.findMany({ where: { active: true } });
  const disponiveis = people.filter((p) => p.available);
  return {
    monitores: disponiveis.filter((p) => p.isMonitor && p.turmaId === turmaId),
    guardas: disponiveis.filter((p) => !p.isMonitor && p.turmaId === turmaId),
    byKey: new Map(people.map((p) => [keyOf(p), p])),
  };
}

/** Próxima turma do rodízio (após a turma da escala mais recente). */
async function proximaTurma(): Promise<string | null> {
  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });
  if (turmas.length === 0) return null;
  const ultima = await prisma.schedule.findFirst({
    where: { turmaId: { not: null } },
    orderBy: { startDate: "desc" },
  });
  if (!ultima?.turmaId) return turmas[0].id;
  const idx = turmas.findIndex((t) => t.id === ultima.turmaId);
  return turmas[(idx + 1) % turmas.length].id;
}

/**
 * Histórico de balanceamento de UMA turma: conta as guardas nas escalas
 * salvas dessa turma + o histórico manual das pessoas dela.
 */
async function historicoDoBanco(turmaId: string | null, limite = 4): Promise<Historico> {
  const ultimas = await prisma.schedule.findMany({
    where: { turmaId },
    orderBy: { startDate: "desc" },
    take: limite,
    include: { assignments: true },
  });
  const hist: Historico = {};
  for (const sch of ultimas) {
    for (const a of sch.assignments) {
      if (a.personNum === "---") continue;
      const k = a.personNum + a.personNome;
      hist[k] = (hist[k] || 0) + 1;
    }
  }

  // Histórico manual apenas das pessoas da turma.
  const daTurma = await prisma.person.findMany({ where: { turmaId } });
  const chaves = new Set(daTurma.map((p) => p.num + p.nome));
  const manual = await prisma.manualHistory.findMany();
  for (const m of manual) {
    const k = m.num + m.nome;
    if (chaves.has(k)) hist[k] = (hist[k] || 0) + m.guardas;
  }
  return hist;
}

function escalaParaDTO(
  inicio: Date,
  escala: Escala,
  turma: { id: string; codigo: string; apelido: string } | null,
  status: string = "ABERTA"
) {
  return {
    startDate: inicio.toISOString(),
    dias: getRotulos(inicio),
    escala,
    turmaId: turma?.id ?? null,
    turma,
    status,
  };
}

// POST /api/schedule/generate  { startDate, balancear, turmaId }
scheduleRouter.post("/generate", async (req, res) => {
  const { startDate, balancear } = req.body ?? {};
  // Turma alvo: instrutor é forçado à sua; superadmin escolhe (ou rodízio).
  let turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  if (!turmaId && isSuperadmin(req)) turmaId = await proximaTurma();
  if (!turmaId) {
    return res.status(400).json({ error: "Selecione a turma da semana." });
  }
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: { id: true, codigo: true, apelido: true, active: true },
  });
  if (!turma || !turma.active) {
    return res.status(400).json({ error: "Turma inválida." });
  }

  const base = startDate ? new Date(startDate) : new Date();
  const inicio = ajustarParaTerca(base);
  const { monitores, guardas } = await efetivoAtivo(turmaId);
  const historico = balancear ? await historicoDoBanco(turmaId) : {};
  const escala = gerarEscala(guardas, monitores, NUM_DIAS, historico);
  res.json({
    ...escalaParaDTO(inicio, escala, {
      id: turma.id,
      codigo: turma.codigo,
      apelido: turma.apelido,
    }),
    balanceado: Object.keys(historico).length > 0,
    monitoresCount: monitores.length,
    guardasCount: guardas.length,
  });
});

// Monta os registros de Assignment a partir da escala + efetivo atual.
async function assignmentsData(escala: Escala, turmaId: string | null) {
  const { byKey } = await efetivoAtivo(turmaId);
  return escala.flatMap((dia, dayIndex) =>
    FUNCOES.flatMap((func: Funcao) =>
      (dia[func] || []).map((p, slot) => {
        const person = byKey.get(keyOf(p));
        const obs =
          typeof p.obs === "string" && p.obs.trim()
            ? p.obs.trim().slice(0, 300)
            : null;
        return {
          dayIndex,
          funcao: func,
          slot,
          personId: person?.id ?? null,
          personNum: p.num,
          personNome: p.nome,
          falta: !!p.falta,
          obs,
        };
      })
    )
  );
}

function escalaValida(escala: unknown): escala is Escala {
  return Array.isArray(escala) && escala.length > 0 && escala.length <= 31;
}

// POST /api/schedule  { startDate, escala, turmaId }
scheduleRouter.post("/", async (req, res) => {
  const { startDate, escala } = req.body ?? {};
  if (!startDate || !escalaValida(escala)) {
    return res.status(400).json({ error: "startDate e escala são obrigatórios" });
  }
  const turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || null);
  if (!podeTurma(req, turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta turma." });
  }
  const inicio = ajustarParaTerca(new Date(startDate));
  const created = await prisma.schedule.create({
    data: {
      startDate: inicio,
      turmaId,
      assignments: { create: await assignmentsData(escala, turmaId) },
    },
  });
  res.status(201).json({ id: created.id });
});

// PUT /api/schedule/:id  { startDate, escala, turmaId }
scheduleRouter.put("/:id", async (req, res) => {
  const { startDate, escala } = req.body ?? {};
  if (!startDate || !escalaValida(escala)) {
    return res.status(400).json({ error: "startDate e escala são obrigatórios" });
  }
  const existe = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!existe) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, existe.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta escala." });
  }
  if (existe.status === "FECHADA") {
    return res
      .status(409)
      .json({ error: "Escala FECHADA — reabra antes de editar." });
  }
  const turmaId = turmaAlvo(req, str(req.body?.turmaId, 40) || existe.turmaId);

  const inicio = ajustarParaTerca(new Date(startDate));
  const data = await assignmentsData(escala, turmaId);
  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { scheduleId: req.params.id } }),
    prisma.schedule.update({
      where: { id: req.params.id },
      data: { startDate: inicio, turmaId, assignments: { create: data } },
    }),
  ]);
  res.json({ id: req.params.id });
});

// POST /api/schedule/:id/fechar  -> classifica a guarda como FECHADA (trava edição)
scheduleRouter.post("/:id/fechar", async (req, res) => {
  const sch = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!sch) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, sch.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta escala." });
  }
  await prisma.schedule.update({
    where: { id: req.params.id },
    data: { status: "FECHADA", closedAt: new Date() },
  });
  res.json({ id: req.params.id, status: "FECHADA" });
});

// POST /api/schedule/:id/reabrir  -> volta para ABERTA (permite editar de novo)
scheduleRouter.post("/:id/reabrir", async (req, res) => {
  const sch = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!sch) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, sch.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta escala." });
  }
  await prisma.schedule.update({
    where: { id: req.params.id },
    data: { status: "ABERTA", closedAt: null },
  });
  res.json({ id: req.params.id, status: "ABERTA" });
});

// DELETE /api/schedule/:id
scheduleRouter.delete("/:id", async (req, res) => {
  const existe = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!existe) return res.status(204).end();
  if (!podeTurma(req, existe.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta escala." });
  }
  await prisma.schedule.delete({ where: { id: req.params.id } }).catch(() => {});
  res.status(204).end();
});

// GET /api/schedule -> lista escalas salvas (filtradas por turma p/ instrutor)
scheduleRouter.get("/", async (req, res) => {
  const lista = await prisma.schedule.findMany({
    where: isSuperadmin(req) ? {} : { turmaId: req.user?.turmaId ?? "__sem_turma__" },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      startDate: true,
      createdAt: true,
      status: true,
      ...incluirTurma,
    },
  });
  res.json(lista);
});

// GET /api/schedule/:id -> reconstrói a escala salva
scheduleRouter.get("/:id", async (req, res) => {
  const sch = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { assignments: true, ...incluirTurma },
  });
  if (!sch) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, sch.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta escala." });
  }

  const escala: Escala = Array.from({ length: NUM_DIAS }, () => ({}) as any);
  for (const a of sch.assignments) {
    const dia = (escala[a.dayIndex] ??= {} as any);
    (dia[a.funcao as Funcao] ??= [])[a.slot] = {
      num: a.personNum,
      nome: a.personNome,
      falta: a.falta || undefined,
      obs: a.obs || undefined,
    };
  }
  res.json(escalaParaDTO(sch.startDate, escala, sch.turma, sch.status));
});

// GET /api/schedule/:id/history -> contagem por pessoa (CSV no client)
scheduleRouter.get("/:id/history", async (req, res) => {
  const sch = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { assignments: true },
  });
  if (!sch) return res.status(404).json({ error: "não encontrada" });
  if (!podeTurma(req, sch.turmaId)) {
    return res.status(403).json({ error: "Sem acesso a esta escala." });
  }
  const cont: Record<string, { num: string; nome: string; guardas: number }> = {};
  for (const a of sch.assignments) {
    if (a.personNum === "---") continue;
    const k = a.personNum + a.personNome;
    cont[k] ??= { num: a.personNum, nome: a.personNome, guardas: 0 };
    cont[k].guardas++;
  }
  res.json(Object.values(cont));
});
