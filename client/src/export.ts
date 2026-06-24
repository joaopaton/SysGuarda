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
  linhas.push(["ESCALA DE SERVIÇO T2"].join(sep));
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
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Escala de Serviço T2</title>
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
    <span class="star">★</span><div><h1>ESCALA DE SERVIÇO · T2</h1></div>
  </div>
  <div class="sub">PREVISÃO OPERACIONAL DE GUARDA &nbsp;·&nbsp; PERÍODO: ${periodo}</div>
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
