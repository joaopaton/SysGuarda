import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../../lib/api";
import type { PresencaHistorico, PresencaLinha, AttendanceStatus } from "../../lib/types";
import { dataBR } from "../../lib/dates";
import {
  exportarHistoricoPresencaCSV,
  exportarHistoricoPresencaPDF,
} from "../../lib/export";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

const COR: Record<AttendanceStatus, string> = {
  PRESENTE: "bg-verde text-noVerde",
  FALTA: "bg-vermelho text-white",
  JUSTIFICADO: "bg-ambar text-white",
};
const SIGLA: Record<AttendanceStatus, string> = {
  PRESENTE: "P",
  FALTA: "F",
  JUSTIFICADO: "J",
};

export function HistoricoPresenca() {
  const { isSuper } = useAppData();
  const { turmaFoco, setErro } = useNav();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rep, setRep] = useState<PresencaHistorico | null>(null);
  const [aberto, setAberto] = useState<Set<string>>(new Set());

  const turmaId = isSuper ? turmaFoco || null : null;

  const carregar = useCallback(async () => {
    try {
      setRep(await api.getHistoricoPresenca(turmaId, from, to));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [turmaId, from, to, setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const grupos = rep
    ? [
        ...rep.turmas.map((t) => ({
          titulo: `${t.codigo} · ${t.apelido}`,
          pessoas: t.pessoas,
        })),
        ...(rep.semTurma.length
          ? [{ titulo: "Sem turma", pessoas: rep.semTurma }]
          : []),
      ]
    : [];

  const periodoLabel =
    from || to
      ? `${from ? dataBR(from) : "início"} a ${to ? dataBR(to) : "hoje"}`
      : "todo o período";

  const toggle = (k: string) =>
    setAberto((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const totalPessoas = grupos.reduce((a, g) => a + g.pessoas.length, 0);

  const detalhe = (p: PresencaLinha) => {
    const datas = Object.keys(p.dias).sort();
    return (
      <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
        {datas.map((d) => (
          <span
            key={d}
            className="inline-flex items-center gap-1 text-[11px] text-textoSec bg-superficie border border-borda rounded-md px-1.5 py-0.5"
          >
            {dataBR(d).slice(0, 5)}
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold ${
                COR[p.dias[d]]
              }`}
            >
              {SIGLA[p.dias[d]]}
            </span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-textoSec">
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block bg-superficie border border-borda text-texto rounded-lg px-3 py-2 text-sm mt-1"
            />
          </label>
          <label className="text-xs text-textoSec">
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block bg-superficie border border-borda text-texto rounded-lg px-3 py-2 text-sm mt-1"
            />
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarHistoricoPresencaCSV(periodoLabel, grupos)}
          >
            <FileSpreadsheet size={14} /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarHistoricoPresencaPDF(periodoLabel, grupos)}
          >
            <Printer size={14} /> PDF
          </Button>
        </div>
      </div>

      {totalPessoas === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />}>
          Nenhuma chamada registrada no período. Faça a chamada na aba Presença.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map((g) =>
            g.pessoas.length === 0 ? null : (
              <div key={g.titulo}>
                <h3 className="text-sm font-semibold text-texto mb-2">
                  {g.titulo}{" "}
                  <span className="text-textoTen font-normal">
                    ({g.pessoas.length})
                  </span>
                </h3>
                <div className="flex flex-col gap-1.5">
                  {g.pessoas.map((p) => {
                    const k = g.titulo + p.num + p.nome;
                    const exp = aberto.has(k);
                    return (
                      <div
                        key={k}
                        className="bg-cartao border border-borda rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggle(k)}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-cartaoAlt transition-colors"
                        >
                          {exp ? (
                            <ChevronDown size={15} className="text-textoTen shrink-0" />
                          ) : (
                            <ChevronRight size={15} className="text-textoTen shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block text-sm text-texto font-medium truncate">
                              {p.nome}
                            </span>
                            <span className="block text-xs text-textoTen font-mono">
                              {p.num}
                              {p.isMonitor ? " · monitor" : ""}
                            </span>
                          </span>
                          <span className="flex gap-1.5 shrink-0 text-xs font-medium">
                            <span className="text-verdeTexto">{p.presentes}P</span>
                            <span className="text-vermelho">{p.faltas}F</span>
                            <span className="text-ambar">{p.justificados}J</span>
                          </span>
                        </button>
                        {exp && detalhe(p)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
