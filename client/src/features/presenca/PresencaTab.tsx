import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, FileSpreadsheet, Printer, Save } from "lucide-react";
import { api } from "../../lib/api";
import type { AttendanceRow, AttendanceStatus } from "../../lib/types";
import { hojeISO, dataBR } from "../../lib/dates";
import { exportarPresencaPDF, exportarPresencaCSV } from "../../lib/export";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { HistoricoPresenca } from "./HistoricoPresenca";

const STATUS: { valor: AttendanceStatus; label: string; on: string }[] = [
  { valor: "PRESENTE", label: "P", on: "bg-verde text-noVerde border-verde" },
  { valor: "FALTA", label: "F", on: "bg-vermelho text-white border-vermelho" },
  { valor: "JUSTIFICADO", label: "J", on: "bg-ambar text-white border-ambar" },
];

export function PresencaTab() {
  const { isSuper, user, turmas } = useAppData();
  const { turmaFoco, setErro } = useNav();
  const [date, setDate] = useState(hojeISO());
  const [linhas, setLinhas] = useState<AttendanceRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sub, setSub] = useState<"chamada" | "historico">("chamada");

  const turmaId = isSuper ? turmaFoco || null : user?.turma?.id ?? null;
  const turmaSemFoco = isSuper && !turmaFoco;
  const turmaObj = turmas.find((t) => t.id === turmaId);
  const turmaLabel = turmaObj
    ? `${turmaObj.codigo} · ${turmaObj.apelido}`
    : user?.turma
    ? `${user.turma.codigo} · ${user.turma.apelido}`
    : "—";

  const carregar = useCallback(async () => {
    if (turmaSemFoco) {
      setLinhas([]);
      return;
    }
    try {
      const r = await api.getAttendance(turmaId, date);
      setLinhas(r.linhas);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [turmaId, date, turmaSemFoco, setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const setStatus = (i: number, status: AttendanceStatus) =>
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, status } : l)));

  const salvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await api.saveAttendance(date, turmaId, linhas);
      setMsg(`Presença salva (${r.salvos} registro(s)).`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const presentes = linhas.filter((l) => l.status === "PRESENTE").length;
  const faltas = linhas.filter((l) => l.status === "FALTA").length;
  const justificados = linhas.filter((l) => l.status === "JUSTIFICADO").length;

  return (
    <div>
      <SectionHeader
        title="Presença"
        subtitle={
          sub === "chamada"
            ? `Chamada da instrução · ${turmaLabel}`
            : "Histórico consolidado · visão geral e detalhe por militar"
        }
        right={
          <div className="flex bg-superficie border border-borda rounded-lg p-0.5">
            <button
              onClick={() => setSub("chamada")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                sub === "chamada" ? "bg-verde text-noVerde" : "text-textoSec"
              }`}
            >
              Chamada
            </button>
            <button
              onClick={() => setSub("historico")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                sub === "historico" ? "bg-verde text-noVerde" : "text-textoSec"
              }`}
            >
              Histórico
            </button>
          </div>
        }
      />

      {sub === "historico" ? (
        <HistoricoPresenca />
      ) : (
        <>
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-superficie border border-borda text-texto rounded-lg px-3 py-2 text-sm"
        />
        <Button variant="outline" size="sm" onClick={() => exportarPresencaCSV(dataBR(date), turmaLabel, linhas)}>
          <FileSpreadsheet size={14} /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportarPresencaPDF(dataBR(date), turmaLabel, linhas)}>
          <Printer size={14} /> PDF
        </Button>
        <Button variant="primary" size="sm" onClick={salvar}>
          <Save size={14} /> {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-verde bg-verdeTint text-verdeTexto px-4 py-2.5 text-sm">
          {msg}
        </div>
      )}

      {turmaSemFoco ? (
        <EmptyState icon={<ClipboardCheck size={40} />}>
          Selecione uma turma no filtro acima para fazer a chamada.
        </EmptyState>
      ) : linhas.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={40} />}>Sem efetivo nesta turma.</EmptyState>
      ) : (
        <>
          <p className="text-sm text-textoSec mb-4">
            <span className="text-verdeTexto font-medium">{presentes} presentes</span> ·{" "}
            <span className="text-vermelho font-medium">{faltas} faltas</span> ·{" "}
            <span className="text-ambar font-medium">{justificados} justificados</span>
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
            {linhas.map((l, i) => (
              <div
                key={l.num + l.nome}
                className="bg-cartao border border-borda rounded-xl px-3.5 py-3 flex items-center justify-between gap-3"
              >
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm text-texto font-medium truncate">{l.nome}</span>
                  <span className="block text-xs text-textoTen font-mono">
                    {l.num}
                    {l.isMonitor ? " · monitor" : ""}
                  </span>
                </span>
                <span className="flex gap-1.5 shrink-0">
                  {STATUS.map((s) => (
                    <button
                      key={s.valor}
                      onClick={() => setStatus(i, s.valor)}
                      title={s.valor}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold border transition-colors ${
                        l.status === s.valor
                          ? s.on
                          : "border-borda text-textoTen hover:bg-cartaoAlt"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="text-textoTen text-xs mt-4">
            P = presente · F = falta · J = justificado · não marcado conta como presente.
          </p>
        </>
      )}
        </>
      )}
    </div>
  );
}
