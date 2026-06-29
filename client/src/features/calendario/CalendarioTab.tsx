import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, CalendarRange } from "lucide-react";
import { api } from "../../lib/api";
import { corTurma } from "../../lib/types";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { useEscala } from "../../state/EscalaContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Legenda } from "../../components/ui/BarChart";

type Salva = {
  id: string;
  startDate: string;
  status?: string;
  turma?: { id: string; codigo: string; apelido: string } | null;
};

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** ISO "YYYY-MM-DD..." -> Date local à meia-noite (evita off-by-one de fuso). */
function dataLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const chave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const somaDias = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

type Faixa = { salva: Salva; offset: number; cor: string };

export function CalendarioTab() {
  const { turmas } = useAppData();
  const { setErro } = useNav();
  const { abrir, scheduleId } = useEscala();
  const [todas, setTodas] = useState<Salva[]>([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const [ref, setRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setTodas((await api.list()) as Salva[]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Cor estável por turma (segue a ordem do rodízio na lista de turmas).
  const corPorTurma = useMemo(() => {
    const m = new Map<string, string>();
    turmas.forEach((t, i) => m.set(t.id, corTurma(i)));
    return m;
  }, [turmas]);

  // Para cada dia (YYYY-MM-DD), as faixas de escala que o cobrem (7 dias da terça).
  const porDia = useMemo(() => {
    const mapa = new Map<string, Faixa[]>();
    for (const s of todas) {
      const ini = dataLocal(s.startDate);
      const cor = (s.turma && corPorTurma.get(s.turma.id)) || "#94a3b8";
      for (let off = 0; off < 7; off++) {
        const k = chave(somaDias(ini, off));
        (mapa.get(k) ?? mapa.set(k, []).get(k)!).push({ salva: s, offset: off, cor });
      }
    }
    return mapa;
  }, [todas, corPorTurma]);

  // 6 semanas (42 células) começando no domingo da semana do dia 1.
  const celulas = useMemo(() => {
    const inicioGrade = somaDias(ref, -ref.getDay());
    return Array.from({ length: 42 }, (_, i) => somaDias(inicioGrade, i));
  }, [ref]);

  const hojeK = chave(hoje);
  const mudarMes = (delta: number) =>
    setRef((r) => new Date(r.getFullYear(), r.getMonth() + delta, 1));

  // Turmas presentes no mês visível (para a legenda).
  const turmasNoMes = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const c of celulas) {
      if (c.getMonth() !== ref.getMonth()) continue;
      for (const f of porDia.get(chave(c)) ?? []) {
        if (f.salva.turma) vistos.set(f.salva.turma.codigo, f.cor);
      }
    }
    return [...vistos].map(([rotulo, cor]) => ({ rotulo, cor }));
  }, [celulas, porDia, ref]);

  return (
    <div>
      <SectionHeader
        title="Calendário de escalas"
        subtitle="Cada faixa é uma semana de guarda (terça a segunda). Toque para abrir."
        right={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-semibold text-texto w-36 text-center">
              {MESES[ref.getMonth()]} {ref.getFullYear()}
            </span>
            <Button variant="outline" size="sm" onClick={() => mudarMes(1)} aria-label="Próximo mês">
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
            >
              Hoje
            </Button>
          </div>
        }
      />

      {carregando ? (
        <p className="text-textoSec text-sm">Carregando…</p>
      ) : todas.length === 0 ? (
        <EmptyState icon={<CalendarRange size={40} />}>
          Nenhuma escala salva ainda. Gere e salve uma escala para vê-la no calendário.
        </EmptyState>
      ) : (
        <Card className="p-3 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 mb-1.5">
              {DIAS.map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-textoTen py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((c) => {
                const k = chave(c);
                const doMes = c.getMonth() === ref.getMonth();
                const ehHoje = k === hojeK;
                const faixas = porDia.get(k) ?? [];
                return (
                  <div
                    key={k}
                    className={`min-h-[78px] rounded-lg border p-1 flex flex-col gap-1 ${
                      doMes ? "border-borda bg-cartao" : "border-transparent bg-cartaoAlt/40"
                    } ${ehHoje ? "ring-1 ring-verde" : ""}`}
                  >
                    <div
                      className={`text-[11px] leading-none px-0.5 ${
                        ehHoje
                          ? "text-verde font-bold"
                          : doMes
                          ? "text-textoSec"
                          : "text-textoTen"
                      }`}
                    >
                      {c.getDate()}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {faixas.map((f) => {
                        const fechada = f.salva.status === "FECHADA";
                        const emEdicao = f.salva.id === scheduleId;
                        return (
                          <button
                            key={f.salva.id + f.offset}
                            onClick={() => abrir(f.salva.id)}
                            title={`${f.salva.turma?.codigo ?? "Escala"} — ${
                              fechada ? "fechada" : "aberta"
                            }`}
                            className={`h-4 rounded-[3px] text-[9px] font-semibold text-white/95 px-1 flex items-center gap-0.5 truncate ${
                              emEdicao ? "ring-1 ring-offset-1 ring-texto" : ""
                            }`}
                            style={{
                              background: f.cor,
                              opacity: fechada ? 0.6 : 1,
                              borderTopLeftRadius: f.offset === 0 ? undefined : 0,
                              borderBottomLeftRadius: f.offset === 0 ? undefined : 0,
                            }}
                          >
                            {f.offset === 0 && (
                              <>
                                {fechada && <Lock size={8} className="shrink-0" />}
                                <span className="truncate">{f.salva.turma?.codigo ?? "Escala"}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {turmasNoMes.length > 0 && <Legenda itens={turmasNoMes} />}
    </div>
  );
}
