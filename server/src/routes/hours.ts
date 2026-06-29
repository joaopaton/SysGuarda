import { Router } from "express";
import { prisma } from "../prisma.js";
import { HORAS, type Funcao } from "../domain.js";
import { isSuperadmin, str } from "../scope.js";

export const hoursRouter = Router();

type PorMes = Record<number, number>;
const addH = (m: PorMes, mes: number, h: number) => (m[mes] = (m[mes] || 0) + h);

// GET /api/hours[?turmaId=]  -> relatório de horas por turma e mês.
// Soma as horas das escalas FECHADAS + o saldo manual (FICHA importada).
hoursRouter.get("/", async (req, res) => {
  const turmaFiltro = isSuperadmin(req)
    ? str(req.query?.turmaId, 40) || null
    : req.user?.turmaId ?? "__sem_turma__";

  const fechadas = await prisma.schedule.findMany({
    where: { status: "FECHADA" },
    include: { assignments: true },
  });

  // Horas calculadas por (num+nome) e mês.
  const porChave = new Map<string, { num: string; nome: string; meses: PorMes }>();
  const obter = (num: string, nome: string) => {
    const k = num + nome;
    let v = porChave.get(k);
    if (!v) porChave.set(k, (v = { num, nome, meses: {} }));
    return v;
  };
  for (const sch of fechadas) {
    for (const a of sch.assignments) {
      if (a.personNum === "---" || a.falta) continue; // faltou: não conta horas
      const d = new Date(sch.startDate);
      d.setDate(d.getDate() + a.dayIndex);
      const mes = d.getMonth() + 1;
      addH(obter(a.personNum, a.personNome).meses, mes, HORAS[a.funcao as Funcao] ?? 0);
    }
  }

  // Saldo manual (FICHA).
  const manual = await prisma.manualHours.findMany();
  for (const m of manual) addH(obter(m.num, m.nome).meses, m.mes, m.horas);

  // Mapa do efetivo p/ vincular pessoa -> turma/isMonitor.
  const people = await prisma.person.findMany({ where: { active: true } });
  const porPessoa = new Map(people.map((p) => [p.num + p.nome, p]));
  const turmas = await prisma.turma.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });

  // Agrupa por turma da pessoa.
  type Linha = {
    num: string;
    nome: string;
    isMonitor: boolean;
    meses: PorMes;
    total: number;
  };
  const grupos = new Map<string, Linha[]>(); // turmaId | "sem" -> linhas
  const mesesSet = new Set<number>();
  for (const v of porChave.values()) {
    const total = Object.values(v.meses).reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    Object.keys(v.meses).forEach((m) => mesesSet.add(Number(m)));
    const pessoa = porPessoa.get(v.num + v.nome);
    const gid = pessoa?.turmaId ?? "sem";
    const linha: Linha = {
      num: v.num,
      nome: v.nome,
      isMonitor: pessoa?.isMonitor ?? false,
      meses: v.meses,
      total,
    };
    (grupos.get(gid) ?? grupos.set(gid, []).get(gid)!).push(linha);
  }

  const meses = [...mesesSet].sort((a, b) => a - b);
  const ordenar = (l: Linha[]) =>
    l.sort((a, b) => a.num.localeCompare(b.num) || a.nome.localeCompare(b.nome));

  const turmasOut = turmas
    .filter((t) => !turmaFiltro || t.id === turmaFiltro)
    .map((t) => ({
      id: t.id,
      codigo: t.codigo,
      apelido: t.apelido,
      pessoas: ordenar(grupos.get(t.id) ?? []),
    }));

  // Sem turma só aparece na visão "todas" (Comandante).
  const semTurma =
    !turmaFiltro && isSuperadmin(req) ? ordenar(grupos.get("sem") ?? []) : [];

  res.json({ meses, turmas: turmasOut, semTurma });
});

// ===== Importar FICHA.csv como saldo inicial (Comandante) =====

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// POST /api/hours/importar-ficha  { csv }  -> substitui o saldo manual.
// Comandante importa todas as turmas; instrutor/monitor só a própria turma
// (só as pessoas da turma são consideradas e têm o saldo substituído).
hoursRouter.post("/importar-ficha", async (req, res) => {
  const sup = isSuperadmin(req);
  if (!sup && !req.user?.turmaId) {
    return res.status(403).json({ error: "Seu usuário não tem turma definida." });
  }
  const csv = str(req.body?.csv, 200000).replace(/^﻿/, "");
  if (!csv) return res.status(400).json({ error: "CSV vazio." });
  const matriz = csv.split(/\r?\n/).map((l) => l.split(/[;,\t]/));

  // Acha o cabeçalho de meses (linha com "abril"/"maio"/... nas colunas).
  const headerIdx = matriz.findIndex(
    (r) => r.filter((c) => MESES[semAcento(c)]).length >= 2
  );
  if (headerIdx === -1) {
    return res.status(400).json({ error: "Não achei a linha de meses na FICHA." });
  }
  const colMes: Record<number, number> = {};
  matriz[headerIdx].forEach((c, i) => {
    const m = MESES[semAcento(c)];
    if (m) colMes[i] = m;
  });

  // Escopo: super = todo o efetivo; instrutor/monitor = só a sua turma.
  const escopo = await prisma.person.findMany({
    where: { active: true, ...(sup ? {} : { turmaId: req.user!.turmaId }) },
  });
  const porNome = new Map<string, string>();
  const contagem = new Map<string, number>();
  for (const p of escopo) {
    contagem.set(p.nome, (contagem.get(p.nome) || 0) + 1);
    porNome.set(p.nome, p.num);
  }

  const registros: { num: string; nome: string; mes: number; horas: number }[] = [];
  const foraDoEscopo: string[] = [];
  for (let i = headerIdx + 1; i < matriz.length; i++) {
    const row = matriz[i];
    const nome = (row[0] || "").trim().toUpperCase();
    if (!nome || /^(nome|monitores|horas de sv)$/i.test(nome)) continue;
    // Fora do escopo (não é da turma): ignora.
    if (!contagem.has(nome)) {
      foraDoEscopo.push(nome);
      continue;
    }
    const num = (contagem.get(nome) === 1 && porNome.get(nome)) || "---";
    for (const [idxStr, mes] of Object.entries(colMes)) {
      const h = parseInt((row[Number(idxStr)] || "").trim(), 10);
      if (Number.isFinite(h) && h > 0) registros.push({ num, nome, mes, horas: h });
    }
  }
  if (registros.length === 0) {
    return res
      .status(400)
      .json({ error: "Nenhuma hora válida da sua turma na FICHA." });
  }

  // Substitui só o saldo das pessoas do escopo (não mexe nas outras turmas).
  const chaves = escopo.map((p) => ({ num: p.num, nome: p.nome }));
  await prisma.$transaction([
    sup
      ? prisma.manualHours.deleteMany()
      : prisma.manualHours.deleteMany({ where: { OR: chaves } }),
    ...registros.map((r) => prisma.manualHours.create({ data: r })),
  ]);
  res.json({ importadas: registros.length, ignorados: foraDoEscopo.length });
});
