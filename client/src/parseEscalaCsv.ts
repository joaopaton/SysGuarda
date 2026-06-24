// Parser tolerante de uma escala em CSV -> EscalaDTO (p/ gerar o Aditamento).
// Aceita o próprio CSV exportado pelo app (grade FUNÇÃO × DIA, células "NUM NOME")
// e variações: separador `;`, `,` ou tab, com ou sem BOM, rótulo da função só na
// primeira vaga (linhas seguintes herdam a função), datas "DD/MM" ou "DD/MM/AAAA".

import { FUNCOES, type DiaEscala, type Funcao, type Pessoa } from "./types";

const SEP = /[;,\t]/;

export interface EscalaImportada {
  startDate: string;
  dias: string[];
  escala: DiaEscala[];
}

/** Casa o rótulo da 1ª coluna com uma das funções conhecidas (tolerante). */
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
  // sem número: aceita apenas se parecer um nome (letras, sem dígitos/pontuação estranha)
  if (/^[A-Za-zÀ-ÿ.'\- ]{3,}$/.test(t)) return { num: "---", nome: t.toUpperCase() };
  return null;
}

/** "DD/MM" ou "DD/MM/AAAA" -> ISO (meio-dia local, evita off-by-one de fuso). */
function parseDataISO(label: string, anoFallback: number): string | null {
  const m = label.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  const dd = +m[1];
  const mm = +m[2];
  let yyyy = m[3] ? +m[3] : anoFallback;
  if (yyyy < 100) yyyy += 2000;
  return new Date(yyyy, mm - 1, dd, 12, 0, 0).toISOString();
}

export function parseEscalaCsv(texto: string): EscalaImportada {
  const limpo = texto.replace(/^﻿/, "");
  const matriz = limpo.split(/\r?\n/).map((l) => l.split(SEP));

  // 1) acha o cabeçalho: 1ª coluna ~ "FUNÇÃO" ...
  let headerIdx = matriz.findIndex((r) => /fun[çc]/i.test((r[0] || "").trim()));
  // ... ou, na falta, uma linha com 2+ células de data.
  if (headerIdx === -1) {
    headerIdx = matriz.findIndex(
      (r) => r.filter((c) => /\d{1,2}\/\d{1,2}/.test(c)).length >= 2
    );
  }
  if (headerIdx === -1) {
    throw new Error("CSV inválido: não encontrei o cabeçalho de dias (FUNÇÃO;DIA…).");
  }

  const dias = matriz[headerIdx]
    .slice(1)
    .map((d) => d.trim().replace(/^"|"$/g, ""))
    .filter((d) => d);
  if (dias.length === 0) {
    throw new Error("CSV inválido: nenhuma coluna de dia no cabeçalho.");
  }

  const escala: DiaEscala[] = Array.from({ length: dias.length }, () => ({
    "Cmt Gd TG": [],
    "Permanência Manhã": [],
    "Permanência Tarde": [],
    "Guardas do TG": [],
  }));

  let atual: Funcao | null = null;
  for (let i = headerIdx + 1; i < matriz.length; i++) {
    const row = matriz[i];
    const f = acharFuncao(row[0] || "");
    if (f) atual = f;
    if (!atual) continue; // ainda não entrou em nenhuma função
    for (let d = 0; d < dias.length; d++) {
      const p = lerPessoa(row[d + 1] || "");
      if (p) escala[d][atual].push(p);
    }
  }

  const temGente = escala.some((dia) =>
    FUNCOES.some((f) => dia[f].length > 0)
  );
  if (!temGente) {
    throw new Error("CSV lido, mas nenhuma pessoa foi encontrada nas células.");
  }

  const startDate =
    parseDataISO(dias[0], new Date().getFullYear()) ?? new Date().toISOString();
  return { startDate, dias, escala };
}
