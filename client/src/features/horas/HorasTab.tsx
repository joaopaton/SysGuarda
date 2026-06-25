import { useCallback, useEffect, useState } from "react";
import { Clock, Flag, FileSpreadsheet, Printer, Upload } from "lucide-react";
import { api } from "../../lib/api";
import type { HoursReport } from "../../lib/types";
import { NOME_MES } from "../../lib/constants";
import { exportarHorasPDF } from "../../lib/export";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { MissoesSecao } from "./MissoesSecao";

export function HorasTab() {
  const { isSuper } = useAppData();
  const { turmaFoco, setErro } = useNav();
  const [rep, setRep] = useState<HoursReport | null>(null);
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const [sub, setSub] = useState<"servico" | "missoes">("servico");

  const carregar = useCallback(async () => {
    try {
      setRep(await api.getHours(isSuper ? turmaFoco || null : null));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [isSuper, turmaFoco, setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const importarFicha = async (file: File) => {
    setImpMsg(null);
    try {
      const r = await api.importarFicha(await file.text());
      const ign = r.ignorados ? ` · ${r.ignorados} fora da turma ignorado(s)` : "";
      setImpMsg(`${r.importadas} registro(s) importado(s)${ign}.`);
      carregar();
    } catch (e) {
      setImpMsg(`Erro: ${(e as Error).message}`);
    }
  };

  const grupos = rep
    ? [
        ...rep.turmas.map((t) => ({ titulo: `${t.codigo} · ${t.apelido}`, pessoas: t.pessoas })),
        ...(rep.semTurma.length ? [{ titulo: "Sem turma", pessoas: rep.semTurma }] : []),
      ]
    : [];

  const exportarCsv = () => {
    if (!rep) return;
    const sep = ";";
    const linhas = ["HORAS DE SERVIÇO"];
    linhas.push(["TURMA", "Nº", "NOME", ...rep.meses.map((m) => NOME_MES[m]), "TOTAL"].join(sep));
    for (const g of grupos)
      for (const p of g.pessoas)
        linhas.push([g.titulo, p.num, p.nome, ...rep.meses.map((m) => p.meses[m] ?? 0), p.total].join(sep));
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "horas_servico.csv";
    a.click();
  };

  const semDados = grupos.every((g) => g.pessoas.length === 0);

  return (
    <div>
      <div className="inline-flex gap-1 p-1 mb-5 rounded-lg bg-cartaoAlt border border-borda">
        {(["servico", "missoes"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
              sub === s ? "bg-verde text-noVerde" : "text-textoSec hover:text-texto"
            }`}
          >
            {s === "servico" ? <Clock size={15} /> : <Flag size={15} />}
            {s === "servico" ? "Serviço" : "Missões"}
          </button>
        ))}
      </div>

      {sub === "missoes" ? (
        <MissoesSecao />
      ) : (
        <>
          <SectionHeader
            title="Horas de serviço"
            subtitle="Guardas fechadas + saldo da ficha · manhã/tarde 6h · noite 12h."
            right={
              <>
                <Button variant="outline" size="sm" onClick={exportarCsv}>
                  <FileSpreadsheet size={14} /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => rep && exportarHorasPDF(rep.meses, grupos)}>
                  <Printer size={14} /> PDF
                </Button>
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-verde text-noVerde hover:bg-verdeEsc px-3 py-1.5 text-xs font-medium transition-colors">
                  <Upload size={14} /> Importar ficha{isSuper ? "" : " (minha turma)"}
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importarFicha(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </>
            }
          />

          {impMsg && (
            <div className="mb-4 rounded-lg border border-verde bg-verdeTint text-verdeTexto px-4 py-2.5 text-sm">
              {impMsg}
            </div>
          )}

          {!rep ? (
            <p className="text-textoSec text-sm">Carregando…</p>
          ) : semDados ? (
            <EmptyState icon={<Clock size={40} />}>
              Sem horas ainda. Feche uma guarda ou importe a ficha.
            </EmptyState>
          ) : (
            grupos
              .filter((g) => g.pessoas.length > 0)
              .map((g) => (
                <div key={g.titulo} className="mb-6">
                  <h3 className="text-sm font-semibold text-texto mb-2">{g.titulo}</h3>
                  <Card className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[480px]">
                      <thead>
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-textoSec border-b border-borda">Militar</th>
                          {rep.meses.map((m) => (
                            <th key={m} className="px-2 py-2.5 text-center text-xs font-medium text-textoSec border-b border-borda">
                              {NOME_MES[m]}
                            </th>
                          ))}
                          <th className="px-2 py-2.5 text-center text-xs font-medium text-textoSec border-b border-borda">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.pessoas.map((p) => (
                          <tr key={p.num + p.nome} className="border-b border-borda last:border-0">
                            <td className="px-3 py-2 text-sm whitespace-nowrap">
                              <span className="text-textoTen font-mono mr-2">{p.num}</span>
                              <span className="text-texto">{p.nome}</span>
                              {p.isMonitor && <span className="text-[11px] text-textoTen ml-1.5">(mon)</span>}
                            </td>
                            {rep.meses.map((m) => (
                              <td key={m} className="px-2 py-2 text-center text-sm text-textoSec font-mono">
                                {p.meses[m] ?? "—"}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center font-semibold text-verdeTexto font-mono">{p.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              ))
          )}
        </>
      )}
    </div>
  );
}
