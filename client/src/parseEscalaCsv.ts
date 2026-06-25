// Parser tolerante de uma escala em CSV -> EscalaDTO (p/ gerar o Aditamento).
// Aceita o CSV exportado pelo app (grade FUNÇÃO × DIA, células "NUM NOME") e a
// planilha de previsão (Google Sheets), que tem colunas vazias antes dos dias,
// datas com mês por extenso ("30/jun.") e o rótulo da função só na 1ª vaga.
//
// Estratégia: detecta em qual COLUNA fica cada dia (pelo cabeçalho) e lê os dados
// exatamente nessas colunas — assim colunas vazias no meio não desalinham nada.

import { FUNCOES, type DiaEscala, type Funcao, type Pessoa } from "./lib/types";

const SEP = /[;,\t]/;

export interface EscalaImportada {
  startDate: string;
  dias: string[];
  escala: DiaEscala[];
}

// "DD/MM" ou "DD/mmm" (mês numérico ou por extenso, pt-BR).
const DIA_RE = /^\s*"?\s*\d{1,2}\/(\d{1,2}|[a-zà-ú]{3,})/i;

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Casa o rótulo da função com uma das funções conhecidas (tolerante). */
function acharFuncao(label: string): Funcao | null {
  const n = label.trim().toLowerCase();
  if (!n) return null;
  for (const f of FUNCOES) if (f.toLowerCase() === n) return f;
  if (n.includes("cmt") || n.includes("comand")) return "Cmt Gd TG";
  if (n.includes("manh")) return "Permanência Manhã";
  if (n.includes("tarde")) return "Permanência Tarde";
  if (n.includes("guarda")) return "Guardas do TG";
  return null;
}

/** Lê uma célula "NUM NOME" (ou só NOME) em uma pessoa; ignora vazias/VAZIO. */
function lerPessoa(cell: string): Pessoa | null {
  const t = (cell || "").trim().replace(/^"|"$/g, "").trim();
  if (!t || /vazio/i.test(t) || /^-+$/.test(t.replace(/\s+/g, ""))) return null;
  const m = t.match(/^(\d{2,4})\s+(.+?)\s*$/);
  if (m) return { num: m[1], nome: m[2].toUpperCase() };
  if (/^[A-Za-zÀ-ÿ.'\- ]{3,}$/.test(t)) return { num: "---", nome: t.toUpperCase() };
  return null;
}

/** "DD/MM[/AAAA]" ou "DD/mmm" -> ISO (meio-dia local, evita off-by-one de fuso). */
function parseDataISO(label: string, ano: number): string | null {
  const t = label.trim();
  let dd: number | undefined;
  let mm: number | undefined;
  let yyyy = ano;

  const num = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (num) {
    dd = +num[1];
    mm = +num[2];
    if (num[3]) yyyy = +num[3] < 100 ? 2000 + +num[3] : +num[3];
  } else {
    const ext = t.match(/(\d{1,2})\/([a-zà-ú]{3,})/i);
    if (ext) {
      dd = +ext[1];
      mm = MESES[ext[2].slice(0, 3).toLowerCase()];
    }
  }
  if (!dd || !mm) return null;
  return new Date(yyyy, mm - 1, dd, 12, 0, 0).toISOString();
}

export function parseEscalaCsv(texto: string): EscalaImportada {
  const limpo = texto.replace(/^﻿/, "");
  const matriz = limpo.split(/\r?\n/).map((l) => l.split(SEP));

  // Ano: pega o 1º "20xx" que aparecer no arquivo (ex.: "... de 2026").
  const anoMatch = limpo.match(/\b(20\d{2})\b/);
  const ano = anoMatch ? +anoMatch[1] : new Date().getFullYear();

  // Cabeçalho = primeira linha com 2+ células que parecem data.
  const headerIdx = matriz.findIndex(
    (r) => r.filter((c) => DIA_RE.test(c)).length >= 2
  );
  if (headerIdx === -1) {
    throw new Error("CSV inválido: não encontrei a linha de datas (ex.: 30/jun.).");
  }

  // Em QUAIS colunas estão os dias — usadas também para ler os dados.
  const header = matriz[headerIdx];
  const dayCols: number[] = [];
  header.forEach((c, i) => {
    if (DIA_RE.test(c)) dayCols.push(i);
  });
  const dias = dayCols.map((i) => header[i].trim().replace(/^"|"$/g, ""));
  const primeiraDataCol = dayCols[0];

  const escala: DiaEscala[] = Array.from({ length: dias.length }, () => ({
    "Cmt Gd TG": [],
    "Permanência Manhã": [],
    "Permanência Tarde": [],
    "Guardas do TG": [],
  }));

  let atual: Funcao | null = null;
  for (let i = headerIdx + 1; i < matriz.length; i++) {
    const row = matriz[i];
    // Rótulo da função: 1ª célula não-vazia antes da 1ª coluna de dia.
    const label = row.slice(0, primeiraDataCol).find((c) => c.trim()) || "";
    const f = acharFuncao(label);
    if (f) atual = f;
    if (!atual) continue;
    dayCols.forEach((col, d) => {
      const p = lerPessoa(row[col] || "");
      if (p) escala[d][atual!].push(p);
    });
  }

  const temGente = escala.some((dia) => FUNCOES.some((f) => dia[f].length > 0));
  if (!temGente) {
    throw new Error("CSV lido, mas nenhuma pessoa foi encontrada nas células.");
  }

  const startDate = parseDataISO(dias[0], ano) ?? new Date().toISOString();
  return { startDate, dias, escala };
}
