// Parser tolerante de histórico. Aceita dois formatos:
//   1. Contagem:  num ; nome ; guardas   (uma linha por pessoa)
//   2. Grade da escala: tabela função×dia com células "NUM NOME"
//      (ex.: a planilha mensal exportada como CSV) — conta as ocorrências.

export interface LinhaHistorico {
  num: string;
  nome: string;
  guardas: number;
}

const SEP = /[;,\t]/;

/** Agrega uma lista em contagens por num+nome. */
function agregar(itens: { num: string; nome: string; inc: number }[]): LinhaHistorico[] {
  const mapa = new Map<string, LinhaHistorico>();
  for (const it of itens) {
    const k = it.num + it.nome;
    const atual = mapa.get(k);
    if (atual) atual.guardas += it.inc;
    else mapa.set(k, { num: it.num, nome: it.nome, guardas: it.inc });
  }
  return [...mapa.values()];
}

/** Conta células no formato "NUM NOME" em qualquer posição da planilha. */
function tallyGrade(linhas: string[]): LinhaHistorico[] {
  const itens: { num: string; nome: string; inc: number }[] = [];
  for (const linha of linhas) {
    for (const cell of linha.split(SEP)) {
      const m = cell.trim().match(/^(\d{2,4})\s+(.+?)\s*$/);
      if (!m) continue;
      itens.push({ num: m[1], nome: m[2].toUpperCase(), inc: 1 });
    }
  }
  return agregar(itens);
}

/** Lê o formato de contagem num;nome;guardas. */
function lerContagem(linhas: string[]): LinhaHistorico[] {
  const itens: { num: string; nome: string; inc: number }[] = [];
  linhas.forEach((linha, i) => {
    const partes = linha.split(SEP).map((s) => s.trim());
    if (i === 0 && /num/i.test(partes[0] ?? "")) return; // cabeçalho
    if (partes.length < 3) return;
    const [num, nome, qtd] = partes;
    const g = parseInt(qtd, 10);
    if (!nome || Number.isNaN(g)) return;
    itens.push({ num: num || "---", nome: nome.toUpperCase(), inc: Math.max(0, g) });
  });
  return agregar(itens);
}

export function parseHistoricoText(texto: string): LinhaHistorico[] {
  const limpo = texto.replace(/^﻿/, "");
  const linhas = limpo.split(/\r?\n/).filter((l) => l.trim());

  // Grade tem várias células "NUM NOME"; contagem não. Tenta grade primeiro.
  const grade = tallyGrade(linhas);
  if (grade.length >= 3) return grade;

  return lerContagem(linhas);
}
