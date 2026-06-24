import type { AditamentoConfig, DiaEscala, Pessoa } from "./types";
import { BRASAO } from "./brasao";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// 0=Dom ... 6=Sáb
const DIA_EXTENSO = [
  "DOMINGO", "2ª Feira", "3ª Feira", "4ª Feira",
  "5ª Feira", "6ª Feira", "SÁBADO",
];

const diaSemana = (d: Date) => DIA_EXTENSO[d.getDay()];
const dataExtenso = (d: Date) =>
  `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const valido = (p?: Pessoa) => !!p && p.num !== "---" && p.nome !== "VAZIO";
const fmtPessoa = (p: Pessoa) => `Atdr ${p.num} ${p.nome}`;

/** Lista com vírgulas; último item com " e " (estilo do modelo, p/ Guardas). */
function listaComE(pessoas: Pessoa[]) {
  const itens = pessoas.filter(valido).map(fmtPessoa);
  if (itens.length <= 1) return itens.join("");
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}

/** Lista só com vírgulas (Permanência). */
const listaVirgula = (pessoas: Pessoa[]) =>
  pessoas.filter(valido).map(fmtPessoa).join(", ");

export interface AditamentoMeta extends AditamentoConfig {
  /** Data de emissão (ISO YYYY-MM-DD) do cabeçalho. */
  dataEmissao: string;
  /** Instrutor de Sobreaviso por dia (índice 0..6). */
  instrutores: string[];
}

export function buildAditamentoHTML(
  startDateISO: string,
  escala: DiaEscala[],
  meta: AditamentoMeta
): string {
  const inicio = new Date(startDateISO);
  const emissao = new Date(meta.dataEmissao + "T00:00:00");

  const linha = (lbl: string, val: string) =>
    `<tr><td class="lbl">${lbl}</td><td>${esc(val)}</td></tr>`;

  let blocos = "";
  escala.forEach((dia, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const mesUp = MESES[d.getMonth()].toUpperCase();
    const instrutor = meta.instrutores[i]?.trim() || "";

    blocos += `
    <table class="srv">
      <tr><th colspan="2">${i + 1}. SERVIÇO PARA O DIA ${d.getDate()} DE ${mesUp} DE ${d.getFullYear()} - (${diaSemana(d)})</th></tr>
      ${linha("Instrutor de Sobreaviso", instrutor)}
      ${linha("Permanência da Manhã", listaVirgula(dia["Permanência Manhã"] || []))}
      ${linha("Permanência da Tarde", listaVirgula(dia["Permanência Tarde"] || []))}
      ${linha("Comandante da Guarda", (dia["Cmt Gd TG"] || []).filter(valido).map(fmtPessoa).join(""))}
      ${linha("Guardas do TG", listaComE(dia["Guardas do TG"] || []))}
      ${linha("Uniforme", meta.uniforme)}
    </table>`;
  });

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Aditamento Nº ${esc(meta.numero)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 16mm; }
  * { font-family: Arial, "Helvetica Neue", sans-serif; box-sizing: border-box; }
  body { color: #000; font-size: 11pt; line-height: 1.25; }
  p { margin: 6px 0; text-align: justify; }
  .center { text-align: center; }

  /* Cabeçalho (brasão | textos | célula vazia) */
  table.cab { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  table.cab td { border: 1px solid #000; vertical-align: middle; padding: 4px; }
  table.cab .brasao { width: 120px; text-align: center; padding: 6px; }
  table.cab .brasao img { height: 96px; width: auto; display: block; margin: 0 auto; }
  table.cab .meio { text-align: center; font-weight: bold; line-height: 1.4; }
  table.cab .dir { width: 130px; }

  h2 { font-size: 11pt; margin: 12px 0 6px; }

  /* Tabela de serviço de cada dia (com bordas) */
  table.srv { width: 100%; border-collapse: collapse; margin: 10px 0; }
  table.srv th, table.srv td { border: 1px solid #000; padding: 3px 6px; font-size: 11pt; text-align: left; vertical-align: top; }
  table.srv th { text-align: center; font-weight: bold; }
  table.srv td.lbl { width: 34%; font-weight: bold; }

  .obs { margin-top: 12px; }
  .obs div { margin: 2px 0; text-align: justify; }
  .parte { margin-top: 10px; }
  .assina { margin-top: 70px; text-align: center; line-height: 1.5; }
  .assina .linha { width: 320px; margin: 0 auto 2px; border-top: 1px solid #000; }
  .lema { margin-top: 46px; text-align: center; font-weight: bold; }
</style></head><body>

  <table class="cab">
    <tr>
      <td class="brasao"><img src="${BRASAO}" alt="Brasão"></td>
      <td class="meio">MINISTÉRIO DA DEFESA<br>EXÉRCITO BRASILEIRO<br>TIRO DE GUERRA ${esc(meta.tg)}</td>
      <td class="dir"></td>
    </tr>
  </table>

  <p>Tiro de Guerra em ${esc(meta.cidade)}, em ${dataExtenso(emissao)} – (${diaSemana(emissao)}).</p>
  <p class="center"><b>ADITAMENTO Nº ${esc(meta.numero)}</b></p>
  <p>Para conhecimento deste Tiro de Guerra e devida execução, publico o seguinte:</p>

  <h2><b>1ª PARTE - SERVIÇOS DIÁRIOS</b></h2>
  ${blocos}

  <div class="obs">
    <p style="margin-bottom:2px"><b>Observação:</b></p>
    <div>a. O serviço de Guarda do TG, terá início às 20:00h e término as 08:00h do dia seguinte.</div>
    <div>b. O serviço de Permanência será dividido em dois turnos (manhã e tarde).</div>
    <div>c. O serviço de Permanência da Manhã terá início às 08:00h e término as 14:00h.</div>
    <div>d. O serviço de Permanência da Tarde terá início às 14:00h e término as 20:00h.</div>
    <div>e. Parada Diária/Revista do Recolher terá início às 19:45h.</div>
  </div>

  <div class="parte center"><h2><b>2ª PARTE – INSTRUÇÃO</b></h2>- Sem alteração -</div>
  <div class="parte center"><h2><b>3ª PARTE - ASSUNTOS GERAIS E ADMINISTRATIVOS</b></h2>- Sem alteração -</div>
  <div class="parte center"><h2><b>4ª PARTE – JUSTIÇA E DISCIPLINA</b></h2>- Sem alteração -</div>

  <div class="assina">
    <div class="linha">&nbsp;</div>
    <div><b>${esc(meta.assinante)} – ${esc(meta.posto)}</b></div>
    <div>${esc(meta.funcaoAssinante)}</div>
  </div>

  <div class="lema">"${esc(meta.lema)}"</div>
</body></html>`;
}

export function imprimirAditamento(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para gerar o aditamento.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}
