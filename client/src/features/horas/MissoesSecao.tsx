import { useCallback, useEffect, useState } from "react";
import { Flag, FileSpreadsheet, Printer, Upload, Plus, Check, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import type { MissoesReport } from "../../lib/types";
import { dataBR } from "../../lib/dates";
import { exportarMissoesPDF, exportarMissoesCSV } from "../../lib/export";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { EmptyState } from "../../components/ui/EmptyState";

export function MissoesSecao() {
  const { isSuper } = useAppData();
  const { turmaFoco, setErro } = useNav();
  const [rep, setRep] = useState<MissoesReport | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [num, setNum] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [horas, setHoras] = useState("");
  const [data, setData] = useState("");
  const [metaEdit, setMetaEdit] = useState("");

  const carregar = useCallback(async () => {
    try {
      setRep(await api.getMissions(isSuper ? turmaFoco || null : null));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [isSuper, turmaFoco, setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lancar = async () => {
    setMsg(null);
    if (!nome.trim() || !horas) return;
    try {
      await api.addMission({
        num: num.trim() || "---",
        nome: nome.trim().toUpperCase(),
        date: data || null,
        descricao: descricao.trim(),
        horas: Number(horas.replace(",", ".")),
        turmaId: isSuper ? turmaFoco || null : null,
      });
      setNum("");
      setNome("");
      setDescricao("");
      setHoras("");
      setData("");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const importar = async (file: File) => {
    setMsg(null);
    try {
      const r = await api.importMissions(await file.text());
      const ign = r.ignorados ? ` · ${r.ignorados} fora da turma ignorado(s)` : "";
      setMsg(`${r.importadas} missão(ões) importada(s)${ign}.`);
      carregar();
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
    }
  };

  const remover = async (id: string) => {
    try {
      await api.removeMission(id);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const salvarMeta = async () => {
    const m = parseInt(metaEdit, 10);
    if (!Number.isFinite(m) || m < 0) return;
    try {
      await api.saveMissaoConfig(m);
      setMetaEdit("");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const grupos = rep
    ? [
        ...rep.turmas.map((t) => ({ titulo: `${t.codigo} · ${t.apelido}`, pessoas: t.pessoas })),
        ...(rep.semTurma.length ? [{ titulo: "Sem turma", pessoas: rep.semTurma }] : []),
      ]
    : [];
  const temDados = grupos.some((g) => g.pessoas.length > 0);

  return (
    <div>
      <SectionHeader
        title="Horas complementares (missões)"
        subtitle={`Meta mínima: ${rep?.meta ?? "—"}h por militar · abaixo da meta em vermelho · sem teto.`}
        right={
          <>
            {isSuper && (
              <div className="flex items-center gap-1 border border-borda rounded-lg px-2 py-1">
                <span className="text-xs text-textoSec">Meta</span>
                <input
                  type="number"
                  min={0}
                  placeholder={String(rep?.meta ?? 60)}
                  value={metaEdit}
                  onChange={(e) => setMetaEdit(e.target.value)}
                  className="w-14 bg-transparent border border-borda rounded text-texto px-1.5 py-0.5 text-xs"
                />
                <button onClick={salvarMeta} className="text-verde hover:text-verdeEsc px-1" aria-label="Salvar meta">
                  <Check size={15} />
                </button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => rep && exportarMissoesCSV(rep.meta, grupos)}>
              <FileSpreadsheet size={14} /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => rep && exportarMissoesPDF(rep.meta, grupos)}>
              <Printer size={14} /> PDF
            </Button>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-verde text-noVerde hover:bg-verdeEsc px-3 py-1.5 text-xs font-medium transition-colors">
              <Upload size={14} /> Importar CSV
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importar(f);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        }
      />

      <Card className="p-3 mb-5 border-dashed">
        <p className="text-xs text-textoSec mb-2">
          Lançar missão · CSV esperado:{" "}
          <span className="text-verdeTexto font-mono">num ; nome ; data ; descrição ; horas</span>
        </p>
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Nº" value={num} onChange={(e) => setNum(e.target.value)} className="w-[70px]" />
          <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1 min-w-[130px]" />
          <Input placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="flex-1 min-w-[130px]" />
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-auto" />
          <Input
            placeholder="Horas"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lancar()}
            className="w-[80px]"
          />
          <Button variant="primary" onClick={lancar}>
            <Plus size={15} /> Lançar
          </Button>
        </div>
      </Card>

      {msg && (
        <div className="mb-4 rounded-lg border border-verde bg-verdeTint text-verdeTexto px-4 py-2.5 text-sm">
          {msg}
        </div>
      )}

      {!rep ? (
        <p className="text-textoSec text-sm">Carregando…</p>
      ) : !temDados ? (
        <EmptyState icon={<Flag size={40} />}>Nenhuma missão lançada ainda.</EmptyState>
      ) : (
        grupos
          .filter((g) => g.pessoas.length > 0)
          .map((g) => (
            <div key={g.titulo} className="mb-6">
              <h3 className="text-sm font-semibold text-texto mb-2">{g.titulo}</h3>
              <Card className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[480px]">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda">Militar</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda">Lançamentos</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.pessoas.map((p) => (
                      <tr key={p.num + p.nome} className="border-b border-borda last:border-0">
                        <td className="px-3 py-2 text-sm whitespace-nowrap align-top">
                          <span className="text-textoTen font-mono mr-2">{p.num}</span>
                          <span className="text-texto">{p.nome}</span>
                          {p.isMonitor && <span className="text-[11px] text-textoTen ml-1.5">(mon)</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex flex-col gap-0.5">
                            {p.lancamentos.map((l) => (
                              <span key={l.id} className="flex items-center gap-1.5 text-textoSec">
                                <span className="text-verdeTexto font-mono">{l.horas}h</span>
                                {l.date && <span className="text-textoTen">{dataBR(l.date)}</span>}
                                <span className="truncate max-w-[220px]">{l.descricao || "—"}</span>
                                <button onClick={() => remover(l.id)} className="text-vermelho ml-0.5" aria-label="Remover">
                                  <Trash2 size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-center font-semibold font-mono ${p.abaixo ? "text-vermelho" : "text-verdeTexto"}`}>
                          {p.total}h
                          {p.abaixo && <div className="text-[11px] font-normal">abaixo</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ))
      )}
    </div>
  );
}
