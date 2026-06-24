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

export const scheduleRouter = Router();

async function efetivoAtivo() {
  const people = await prisma.person.findMany({ where: { active: true } });
  // Geração usa apenas quem está disponível (não doente/afastado).
  const disponiveis = people.filter((p) => p.available);
  return {
    monitores: disponiveis.filter((p) => p.isMonitor),
    guardas: disponiveis.filter((p) => !p.isMonitor),
    byKey: new Map(people.map((p) => [keyOf(p), p])), // mapa completo p/ salvar
  };
}

/**
 * Histórico de balanceamento a partir das escalas já salvas no banco.
 * Conta quantas guardas cada (num+nome) fez nas últimas N escalas.
 */
async function historicoDoBanco(limite = 1): Promise<Historico> {
  const ultimas = await prisma.schedule.findMany({
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

  // Soma o histórico manual importado (guardas feitas à mão).
  const manual = await prisma.manualHistory.findMany();
  for (const m of manual) {
    const k = m.num + m.nome;
    hist[k] = (hist[k] || 0) + m.guardas;
  }
  return hist;
}

function escalaParaDTO(inicio: Date, escala: Escala) {
  return {
    startDate: inicio.toISOString(),
    dias: getRotulos(inicio),
    escala, // Funcao -> Pessoa[] por dia
  };
}

// POST /api/schedule/generate  { startDate, balancear }
// Gera (sem salvar) — preview que o usuário pode reembaralhar/editar.
scheduleRouter.post("/generate", async (req, res) => {
  const { startDate, balancear } = req.body ?? {};
  const base = startDate ? new Date(startDate) : new Date();
  const inicio = ajustarParaTerca(base);
  const { monitores, guardas } = await efetivoAtivo();
  const historico = balancear ? await historicoDoBanco() : {};
  const escala = gerarEscala(guardas, monitores, NUM_DIAS, historico);
  res.json({
    ...escalaParaDTO(inicio, escala),
    balanceado: Object.keys(historico).length > 0,
    monitoresCount: monitores.length,
  });
});

// POST /api/schedule  { startDate, escala }  -> persiste a escala
scheduleRouter.post("/", async (req, res) => {
  const { startDate, escala } = req.body ?? {};
  if (!startDate || !Array.isArray(escala)) {
    return res.status(400).json({ error: "startDate e escala são obrigatórios" });
  }
  const inicio = ajustarParaTerca(new Date(startDate));
  const { byKey } = await efetivoAtivo();

  const created = await prisma.schedule.create({
    data: {
      startDate: inicio,
      assignments: {
        create: (escala as Escala).flatMap((dia, dayIndex) =>
          FUNCOES.flatMap((func: Funcao) =>
            (dia[func] || []).map((p, slot) => {
              const person = byKey.get(keyOf(p));
              return {
                dayIndex,
                funcao: func,
                slot,
                personId: person?.id ?? null,
                personNum: p.num,
                personNome: p.nome,
              };
            })
          )
        ),
      },
    },
  });
  res.status(201).json({ id: created.id });
});

// GET /api/schedule -> lista escalas salvas
scheduleRouter.get("/", async (_req, res) => {
  const lista = await prisma.schedule.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, startDate: true, createdAt: true },
  });
  res.json(lista);
});

// GET /api/schedule/:id -> reconstrói a escala salva
scheduleRouter.get("/:id", async (req, res) => {
  const sch = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { assignments: true },
  });
  if (!sch) return res.status(404).json({ error: "não encontrada" });

  const escala: Escala = Array.from({ length: NUM_DIAS }, () => ({}) as any);
  for (const a of sch.assignments) {
    const dia = (escala[a.dayIndex] ??= {} as any);
    (dia[a.funcao as Funcao] ??= [])[a.slot] = {
      num: a.personNum,
      nome: a.personNome,
    };
  }
  res.json(escalaParaDTO(sch.startDate, escala));
});

// GET /api/schedule/:id/history -> contagem por pessoa (CSV no client)
scheduleRouter.get("/:id/history", async (req, res) => {
  const sch = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { assignments: true },
  });
  if (!sch) return res.status(404).json({ error: "não encontrada" });
  const cont: Record<string, { num: string; nome: string; guardas: number }> = {};
  for (const a of sch.assignments) {
    if (a.personNum === "---") continue;
    const k = a.personNum + a.personNome;
    cont[k] ??= { num: a.personNum, nome: a.personNome, guardas: 0 };
    cont[k].guardas++;
  }
  res.json(Object.values(cont));
});
