import { FUNCOES, VAGAS, type DiaEscala } from "./types";

function csvCampo(v: unknown): string {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function baixar(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta a escala em CSV (separador `;` + BOM para Excel PT-BR). */
export function exportarEscalaCSV(dias: string[], escala: DiaEscala[]) {
  const sep = ";";
  const linhas: string[] = [];
  linhas.push(["ESCALA DE SERVIÇO TG 05-003"].join(sep));
  linhas.push([`Período: ${dias[0]} a ${dias[dias.length - 1]}`].join(sep));
  linhas.push("");
  linhas.push(["FUNÇÃO", ...dias].map(csvCampo).join(sep));

  for (const func of FUNCOES) {
    for (let v = 0; v < VAGAS[func]; v++) {
      const cels = dias.map((_, d) => {
        const p = escala[d]?.[func]?.[v];
        return p ? `${p.num} ${p.nome}` : "";
      });
      const rotulo = v === 0 ? func : "";
      linhas.push([rotulo, ...cels].map(csvCampo).join(sep));
    }
  }
  baixar(
    "escala_servico_t2.csv",
    "﻿" + linhas.join("\n"),
    "text/csv;charset=utf-8"
  );
}

/** Exporta a escala em PDF via janela de impressão (paisagem). */
export function exportarPDF(dias: string[], escala: DiaEscala[]) {
  const periodo = `${dias[0]} a ${dias[dias.length - 1]}`;
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Escala de Serviço TG 05-003</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    * { font-family: Arial, sans-serif; box-sizing: border-box; }
    body { color: #1a1d12; }
    h1 { font-size: 18px; margin: 0; letter-spacing: 1px; }
    .sub { font-size: 11px; color: #555; margin: 2px 0 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 5px 7px; font-size: 11px; text-align: left; vertical-align: top; }
    th { background: #3a4220; color: #fff; text-align: center; letter-spacing: 1px; }
    td.func { font-weight: bold; background: #eee; white-space: nowrap; }
    .num { color: #6b5d1e; font-weight: bold; }
    .foot { margin-top: 16px; font-size: 9px; color: #777; text-align: center; letter-spacing: 1px; }
    .star { font-size: 22px; }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #3a4220;padding-bottom:8px;margin-bottom:6px;">
    <span class="star">★</span><div><h1>ESCALA DE SERVIÇO · TG 05-003</h1></div>
  </div>
  <div class="sub">TG 05-003 · LONDRINA-PR &nbsp;·&nbsp; PERÍODO: ${periodo}</div>
  <table><thead><tr><th>FUNÇÃO</th>`;
  dias.forEach((d) => (html += `<th>${d}</th>`));
  html += `</tr></thead><tbody>`;
  for (const func of FUNCOES) {
    html += `<tr><td class="func">${func.toUpperCase()}</td>`;
    dias.forEach((_, d) => {
      const cels = (escala[d]?.[func] || [])
        .map((p) => `<span class="num">${p.num}</span> ${p.nome}`)
        .join("<br>");
      html += `<td>${cels}</td>`;
    });
    html += `</tr>`;
  }
  html += `</tbody></table>
  <div class="foot">▬▬▬ DOCUMENTO SUJEITO A ALTERAÇÃO ▬▬▬ &nbsp; Emitido em ${new Date().toLocaleDateString(
    "pt-BR"
  )}</div></body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para gerar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

interface HorasPessoaExport {
  num: string;
  nome: string;
  isMonitor: boolean;
  meses: Record<string, number>;
  total: number;
}

const NOME_MES_PDF = [
  "", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

/** Exporta o relatório de horas em PDF (retrato), uma tabela por turma. */
export function exportarHorasPDF(
  meses: number[],
  grupos: { titulo: string; pessoas: HorasPessoaExport[] }[]
) {
  const cols = meses.map((m) => `<th>${NOME_MES_PDF[m]}</th>`).join("");
  const tabelas = grupos
    .filter((g) => g.pessoas.length > 0)
    .map((g) => {
      const linhas = g.pessoas
        .map((p) => {
          const cels = meses
            .map((m) => `<td class="n">${p.meses[m] ?? "-"}</td>`)
            .join("");
          return `<tr><td class="nome"><b>${p.num}</b> ${p.nome}${
            p.isMonitor ? ' <span class="mon">(mon)</span>' : ""
          }</td>${cels}<td class="tot">${p.total}</td></tr>`;
        })
        .join("");
      return `<h2>${g.titulo}</h2>
      <table><thead><tr><th class="hnome">MILITAR</th>${cols}<th>TOTAL</th></tr></thead>
      <tbody>${linhas}</tbody></table>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Horas de Serviço</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { font-family: Arial, sans-serif; box-sizing: border-box; }
    body { color: #1a1d12; }
    h1 { font-size: 18px; margin: 0; letter-spacing: 1px; }
    .sub { font-size: 11px; color: #555; margin: 2px 0 14px; }
    h2 { font-size: 12px; margin: 16px 0 4px; color: #3a4220; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #333; padding: 3px 6px; font-size: 10px; }
    th { background: #3a4220; color: #fff; text-align: center; }
    th.hnome { text-align: left; }
    td.nome { white-space: nowrap; }
    td.n { text-align: center; }
    td.tot { text-align: center; font-weight: bold; background: #eee; }
    .mon { color: #777; }
    .foot { margin-top: 16px; font-size: 9px; color: #777; text-align: center; letter-spacing: 1px; }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #3a4220;padding-bottom:8px;margin-bottom:6px;">
    <span style="font-size:22px">★</span><div><h1>HORAS DE SERVIÇO · TG 05-003</h1></div>
  </div>
  <div class="sub">PERMANÊNCIA 6H &nbsp;·&nbsp; NOITE/CMT 12H</div>
  ${tabelas}
  <div class="foot">▬▬▬ Emitido em ${new Date().toLocaleDateString(
    "pt-BR"
  )} ▬▬▬</div></body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para gerar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

// ===== Presença (instrução da manhã) =====

interface PresencaLinha {
  num: string;
  nome: string;
  isMonitor: boolean;
  status: string;
}

function imprimir(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para gerar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

const CABECALHO_PDF = `
  * { font-family: Arial, sans-serif; box-sizing: border-box; }
  body { color: #1a1d12; }
  h1 { font-size: 18px; margin: 0; letter-spacing: 1px; }
  .sub { font-size: 11px; color: #555; margin: 2px 0 14px; }
  h2 { font-size: 12px; margin: 16px 0 4px; color: #3a4220; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #333; padding: 4px 6px; font-size: 10px; }
  th { background: #3a4220; color: #fff; text-align: center; }
  th.hnome { text-align: left; }
  .foot { margin-top: 16px; font-size: 9px; color: #777; text-align: center; letter-spacing: 1px; }`;

/** Lista de presença em PDF (retrato) com coluna de status e assinatura. */
export function exportarPresencaPDF(
  dataLabel: string,
  turmaLabel: string,
  linhas: PresencaLinha[]
) {
  const corpo = linhas
    .map(
      (p, i) =>
        `<tr><td class="c">${i + 1}</td><td class="nome"><b>${p.num}</b> ${p.nome}${
          p.isMonitor ? ' <span class="mon">(mon)</span>' : ""
        }</td><td class="c">${p.status}</td><td></td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Lista de Presença</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    ${CABECALHO_PDF}
    td.c { text-align: center; }
    td.nome { white-space: nowrap; }
    .mon { color: #777; }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #3a4220;padding-bottom:8px;margin-bottom:6px;">
    <span style="font-size:22px">★</span><div><h1>LISTA DE PRESENÇA · INSTRUÇÃO</h1></div>
  </div>
  <div class="sub">${turmaLabel} &nbsp;·&nbsp; DATA: ${dataLabel}</div>
  <table><thead><tr><th style="width:30px">#</th><th class="hnome">MILITAR</th><th style="width:90px">STATUS</th><th style="width:30%">ASSINATURA</th></tr></thead>
  <tbody>${corpo}</tbody></table>
  <div class="foot">▬▬▬ Emitido em ${new Date().toLocaleDateString("pt-BR")} ▬▬▬</div>
  </body></html>`;
  imprimir(html);
}

/** Lista de presença em CSV (`;` + BOM). */
export function exportarPresencaCSV(
  dataLabel: string,
  turmaLabel: string,
  linhas: PresencaLinha[]
) {
  const sep = ";";
  const out = [`LISTA DE PRESENÇA${sep}${turmaLabel}${sep}${dataLabel}`, ""];
  out.push(["Nº", "NOME", "MONITOR", "STATUS"].join(sep));
  for (const p of linhas)
    out.push([p.num, p.nome, p.isMonitor ? "SIM" : "", p.status].join(sep));
  baixar("lista_presenca.csv", "﻿" + out.join("\n"), "text/csv;charset=utf-8");
}

// ===== Histórico de presença (consolidado) =====

interface HistPessoaExport {
  num: string;
  nome: string;
  isMonitor: boolean;
  presentes: number;
  faltas: number;
  justificados: number;
}

/** Histórico de presença (totais por pessoa) em CSV. */
export function exportarHistoricoPresencaCSV(
  periodoLabel: string,
  grupos: { titulo: string; pessoas: HistPessoaExport[] }[]
) {
  const sep = ";";
  const out = [`HISTÓRICO DE PRESENÇA${sep}${periodoLabel}`, ""];
  for (const g of grupos) {
    if (g.pessoas.length === 0) continue;
    out.push(g.titulo);
    out.push(["Nº", "NOME", "PRESENÇAS", "FALTAS", "JUSTIFICADOS", "DIAS"].join(sep));
    for (const p of g.pessoas)
      out.push(
        [
          p.num,
          p.nome,
          p.presentes,
          p.faltas,
          p.justificados,
          p.presentes + p.faltas + p.justificados,
        ].join(sep)
      );
    out.push("");
  }
  baixar("historico_presenca.csv", "﻿" + out.join("\n"), "text/csv;charset=utf-8");
}

/** Histórico de presença (totais por pessoa) em PDF (retrato), por turma. */
export function exportarHistoricoPresencaPDF(
  periodoLabel: string,
  grupos: { titulo: string; pessoas: HistPessoaExport[] }[]
) {
  const tabelas = grupos
    .filter((g) => g.pessoas.length > 0)
    .map((g) => {
      const linhas = g.pessoas
        .map(
          (p) =>
            `<tr><td class="nome"><b>${p.num}</b> ${p.nome}${
              p.isMonitor ? ' <span class="mon">(mon)</span>' : ""
            }</td><td class="c">${p.presentes}</td><td class="c">${p.faltas}</td><td class="c">${p.justificados}</td><td class="c tot">${
              p.presentes + p.faltas + p.justificados
            }</td></tr>`
        )
        .join("");
      return `<h2>${g.titulo}</h2>
      <table><thead><tr><th class="hnome">MILITAR</th><th>P</th><th>F</th><th>J</th><th>DIAS</th></tr></thead>
      <tbody>${linhas}</tbody></table>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Histórico de Presença</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    ${CABECALHO_PDF}
    td.c { text-align: center; }
    td.nome { white-space: nowrap; }
    td.tot { font-weight: bold; background: #eee; }
    .mon { color: #777; }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #3a4220;padding-bottom:8px;margin-bottom:6px;">
    <span style="font-size:22px">★</span><div><h1>HISTÓRICO DE PRESENÇA · TG 05-003</h1></div>
  </div>
  <div class="sub">PERÍODO: ${periodoLabel} &nbsp;·&nbsp; P=presente · F=falta · J=justificado</div>
  ${tabelas}
  <div class="foot">▬▬▬ Emitido em ${new Date().toLocaleDateString("pt-BR")} ▬▬▬</div>
  </body></html>`;
  imprimir(html);
}

// ===== Horas complementares (missões) =====

interface MissoesPessoaExport {
  num: string;
  nome: string;
  isMonitor: boolean;
  total: number;
  abaixo: boolean;
}

/** Relatório de missões em PDF (retrato): total por pessoa, abaixo da meta em vermelho. */
export function exportarMissoesPDF(
  meta: number,
  grupos: { titulo: string; pessoas: MissoesPessoaExport[] }[]
) {
  const tabelas = grupos
    .filter((g) => g.pessoas.length > 0)
    .map((g) => {
      const linhas = g.pessoas
        .map(
          (p) =>
            `<tr class="${p.abaixo ? "abaixo" : ""}"><td class="nome"><b>${p.num}</b> ${p.nome}${
              p.isMonitor ? ' <span class="mon">(mon)</span>' : ""
            }</td><td class="tot">${p.total}h</td><td class="c">${
              p.abaixo ? "ABAIXO" : "OK"
            }</td></tr>`
        )
        .join("");
      return `<h2>${g.titulo}</h2>
      <table><thead><tr><th class="hnome">MILITAR</th><th>TOTAL</th><th>META (${meta}h)</th></tr></thead>
      <tbody>${linhas}</tbody></table>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Horas Complementares (Missões)</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    ${CABECALHO_PDF}
    td.c { text-align: center; }
    td.nome { white-space: nowrap; }
    td.tot { text-align: center; font-weight: bold; background: #eee; }
    tr.abaixo td { color: #b00020; font-weight: bold; }
    .mon { color: #777; }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:10px;border-bottom:3px solid #3a4220;padding-bottom:8px;margin-bottom:6px;">
    <span style="font-size:22px">★</span><div><h1>HORAS COMPLEMENTARES (MISSÕES) · TG 05-003</h1></div>
  </div>
  <div class="sub">META MÍNIMA: ${meta}h por militar &nbsp;·&nbsp; em vermelho = abaixo da meta</div>
  ${tabelas}
  <div class="foot">▬▬▬ Emitido em ${new Date().toLocaleDateString("pt-BR")} ▬▬▬</div>
  </body></html>`;
  imprimir(html);
}

/** Relatório de missões em CSV (`;` + BOM). */
export function exportarMissoesCSV(
  meta: number,
  grupos: { titulo: string; pessoas: MissoesPessoaExport[] }[]
) {
  const sep = ";";
  const out = [`HORAS COMPLEMENTARES (MISSÕES)${sep}META ${meta}h`, ""];
  out.push(["TURMA", "Nº", "NOME", "TOTAL (h)", "ABAIXO DA META"].join(sep));
  for (const g of grupos)
    for (const p of g.pessoas)
      out.push([g.titulo, p.num, p.nome, p.total, p.abaixo ? "SIM" : ""].join(sep));
  baixar("missoes.csv", "﻿" + out.join("\n"), "text/csv;charset=utf-8");
}

/** Exporta o histórico (contagem da escala atual) em CSV. */
export function exportarHistoricoCSV(
  registros: { num: string; nome: string; guardas: number }[]
) {
  const linhas = ["num,nome,guardas"];
  registros.forEach((r) => linhas.push(`${r.num},${r.nome},${r.guardas}`));
  baixar(
    "historico_guardas.csv",
    linhas.join("\n"),
    "text/csv;charset=utf-8"
  );
}
