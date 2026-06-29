import { useState } from "react";
import {
  Flag,
  Settings,
  Archive,
  Upload,
  Shuffle,
  FileText,
  Printer,
  FileSpreadsheet,
  Download,
  Save,
  Lock,
  Unlock,
  Check,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { COR_FUNC, FUNCOES, VAGAS } from "../../lib/types";
import { exportarPDF, exportarEscalaCSV } from "../../lib/export";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { useEscala } from "../../state/EscalaContext";
import { VagaEditor } from "./VagaEditor";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";

type Func = (typeof FUNCOES)[number];
type Editando = { dia: number; func: Func; idx: number } | null;

export function EscalaTab() {
  const { monitores, guardas } = useAppData();
  const { irPara } = useNav();
  const {
    dto,
    scheduleId,
    gerar,
    salvar,
    salvando,
    msg,
    fechar,
    reabrir,
    aplicarVaga,
    baixarHistorico,
    setShowAditamento,
    importarEscalaCsv,
  } = useEscala();
  const [editando, setEditando] = useState<Editando>(null);

  if (!dto) {
    return (
      <EmptyState icon={<Flag size={44} />}>
        <span className="block mb-5">Nenhuma escala em vigor — emita a ordem de serviço.</span>
        <span className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={() => irPara("comando")}>
            <Settings size={16} /> Ir à ordem de serviço
          </Button>
          <Button variant="outline" onClick={() => irPara("salvas")}>
            <Archive size={16} /> Escalas salvas
          </Button>
          <label className="inline-flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-borda px-4 py-2 text-sm text-texto hover:bg-cartaoAlt">
            <Upload size={16} /> Aditamento via CSV
            <input type="file" accept=".csv,.txt,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importarEscalaCsv(f); e.target.value = ""; }} />
          </label>
        </span>
      </EmptyState>
    );
  }

  const { dias, escala } = dto;
  const monitoresDisp = dto.monitoresCount ?? monitores.length;
  const monitorRepete = dias.length > monitoresDisp;
  const fechada = dto.status === "FECHADA";

  return (
    <div>
      <div className="flex justify-between items-end mb-4 flex-wrap gap-2.5">
        <div>
          <h2 className="text-lg font-semibold text-texto flex items-center gap-2 flex-wrap">
            Escala em vigor
            {dto.turma && <Badge tone="verde">{dto.turma.codigo} · {dto.turma.apelido}</Badge>}
            {fechada && (
              <Badge tone="neutro">
                <Lock size={11} /> Fechada
              </Badge>
            )}
          </h2>
          <p className="mt-0.5 text-[13px] text-textoSec">
            {fechada
              ? "Guarda fechada · horas contabilizadas · somente leitura."
              : scheduleId
              ? "Editando escala salva · toque no nome para substituir."
              : "Toque no nome para substituir."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => irPara("salvas")}>
            <Archive size={14} /> Salvas
          </Button>
          {!fechada && (
            <Button variant="outline" size="sm" onClick={gerar}>
              <Shuffle size={14} /> Reembaralhar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAditamento(true)}>
            <FileText size={14} /> Aditamento
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportarPDF(dias, escala)}>
            <Printer size={14} /> PDF grade
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportarEscalaCSV(dias, escala)}>
            <FileSpreadsheet size={14} /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={baixarHistorico}>
            <Download size={14} /> Histórico
          </Button>
          {!fechada && (
            <Button variant="primary" size="sm" onClick={salvar}>
              <Save size={14} /> {salvando ? "Salvando…" : scheduleId ? "Atualizar" : "Salvar"}
            </Button>
          )}
          {scheduleId && !fechada && (
            <Button variant="primary" size="sm" onClick={fechar}>
              <Lock size={14} /> Fechar guarda
            </Button>
          )}
          {fechada && (
            <Button variant="outline" size="sm" onClick={reabrir}>
              <Unlock size={14} /> Reabrir
            </Button>
          )}
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-verde bg-verdeTint text-verdeTexto px-4 py-2.5 text-sm flex items-center gap-2">
          <Check size={14} className="shrink-0" /> {msg}
        </div>
      )}

      {dto.balanceado && (
        <div className="mb-4 rounded-lg border border-verde bg-verdeTint text-verdeTexto px-4 py-2.5 text-sm flex items-center gap-2">
          <Scale size={14} className="shrink-0" /> Balanceamento ativo — sorteio ajustado pelo histórico salvo.
        </div>
      )}

      {monitorRepete && (
        <div className="mb-4 rounded-lg border border-ambar bg-ambarTint text-ambar px-4 py-2.5 text-sm flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" /> {dias.length} dias para {monitoresDisp} monitores
          disponíveis — haverá repetição no comando.
        </div>
      )}

      <div
        className="rounded-xl border border-borda"
        style={{ overflowX: editando ? "visible" : "auto" }}
      >
        <table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr>
              <th className="bg-cartaoAlt px-3.5 py-2.5 text-left text-xs font-medium text-textoSec border-b border-borda w-40 rounded-tl-xl">
                Função
              </th>
              {dias.map((dia) => (
                <th key={dia} className="bg-cartaoAlt px-2 py-2.5 text-center text-xs font-medium text-textoSec border-b border-l border-borda whitespace-nowrap">
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FUNCOES.map((func) => {
              const cor = COR_FUNC[func];
              return (
                <tr key={func} className="bg-cartao">
                  <td className="px-3.5 py-3 font-medium text-sm align-top border-b border-borda"
                    style={{ borderLeft: `3px solid ${cor}`, color: cor }}>
                    {func}
                  </td>
                  {dias.map((_, dia) => (
                    <td key={dia} className="p-1.5 align-top border-l border-b border-borda">
                      {Array.from({ length: VAGAS[func] }).map((_, idx) => {
                        const g = escala[dia]?.[func]?.[idx] ?? { num: "---", nome: "VAZIO" };
                        const vazio = g.num === "---" || g.nome === "VAZIO";
                        const esta =
                          editando?.dia === dia && editando?.func === func && editando?.idx === idx;
                        return esta && !fechada ? (
                          <VagaEditor
                            key={idx}
                            atual={g}
                            opcoes={func === "Cmt Gd TG" ? monitores : guardas}
                            onAplicar={(v) => { aplicarVaga(dia, func, idx, v); setEditando(null); }}
                            onCancelar={() => setEditando(null)}
                          />
                        ) : (
                          <div
                            key={idx}
                            onClick={() => !fechada && setEditando({ dia, func, idx })}
                            title={
                              fechada
                                ? g.obs || "Escala fechada"
                                : g.obs
                                ? `Obs: ${g.obs}`
                                : vazio
                                ? "Preencher vaga"
                                : "Substituir / marcar falta"
                            }
                            className={`px-2 py-1 mb-1 text-xs rounded-md bg-cartaoAlt ${
                              fechada ? "" : "cursor-pointer hover:bg-superficie"
                            }`}
                            style={{
                              border: g.falta
                                ? `1px solid var(--vermelho, #c0392b)`
                                : vazio
                                ? `1px dashed ${cor}66`
                                : `1px solid ${cor}44`,
                              borderLeft: `2px solid ${g.falta ? "#c0392b" : cor}`,
                            }}
                          >
                            <span className="flex gap-1.5 items-center">
                              {vazio ? (
                                <span className="text-textoTen italic">{fechada ? "—" : "+ preencher"}</span>
                              ) : (
                                <>
                                  <span className="text-textoTen font-mono">{g.num}</span>
                                  <span className={g.falta ? "text-vermelho line-through" : "text-texto"}>
                                    {g.nome}
                                  </span>
                                  {g.falta && (
                                    <span className="text-[9px] font-bold text-vermelho">FALTOU</span>
                                  )}
                                </>
                              )}
                            </span>
                            {g.obs && (
                              <span className="block text-[10px] text-ambar truncate mt-0.5">
                                ⚑ {g.obs}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 flex-wrap mt-4">
        {FUNCOES.map((f) => (
          <div key={f} className="flex items-center gap-1.5 text-xs text-textoSec">
            <div className="w-3 h-3 rounded" style={{ background: COR_FUNC[f] }} />
            {f} ({VAGAS[f]})
          </div>
        ))}
      </div>
    </div>
  );
}
