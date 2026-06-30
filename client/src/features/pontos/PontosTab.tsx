import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ChevronDown, ChevronRight, Check, Undo2, Search } from "lucide-react";
import { api } from "../../lib/api";
import type { PontosReport, PontosPessoa } from "../../lib/types";
import { PONTOS_INICIAL } from "../../lib/types";
import { dataBR } from "../../lib/dates";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";

/** Cor do saldo conforme a gravidade (quanto menor, mais alarmante). */
function corSaldo(pontos: number): string {
  if (pontos >= 100) return "bg-cartaoAlt text-textoSec";
  if (pontos >= 60) return "bg-ambar/15 text-ambar";
  return "bg-vermelho/15 text-vermelho";
}

export function PontosTab() {
  const { isSuper, user } = useAppData();
  const { turmaFoco, setErro } = useNav();
  // Só instrutor e Comandante classificam falta (justificada). Monitor não.
  const podeClassificar =
    user?.role === "superadmin" || user?.role === "instrutor";

  const [rep, setRep] = useState<PontosReport | null>(null);
  const [aberto, setAberto] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");

  const turmaId = isSuper ? turmaFoco || null : null;

  const carregar = useCallback(async () => {
    try {
      setRep(await api.getPontos(turmaId));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [turmaId, setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const termo = busca.trim().toLowerCase();
  const casa = (p: PontosPessoa) =>
    !termo ||
    p.nome.toLowerCase().includes(termo) ||
    p.num.toLowerCase().includes(termo);

  const grupos = rep
    ? [
        ...rep.turmas.map((t) => ({
          id: t.id,
          titulo: `${t.codigo} · ${t.apelido}`,
          pessoas: t.pessoas.filter(casa),
        })),
        ...(rep.semTurma.length
          ? [{ id: null, titulo: "Sem turma", pessoas: rep.semTurma.filter(casa) }]
          : []),
      ]
    : [];

  const toggle = (k: string) =>
    setAberto((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Justifica/desjustifica uma falta e recarrega o saldo.
  const classificar = async (
    grupoTurmaId: string | null,
    p: PontosPessoa,
    date: string,
    justificada: boolean
  ) => {
    try {
      await api.justificarFalta(date, grupoTurmaId, p.num, p.nome, justificada);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const totalPessoas = grupos.reduce((a, g) => a + g.pessoas.length, 0);

  return (
    <div>
      <SectionHeader
        title="Pontos"
        subtitle={`Saldo disciplinar · cada militar começa com ${PONTOS_INICIAL} · falta −4, justificada −2`}
        right={
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-textoTen pointer-events-none"
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº ou nome…"
              className="w-full sm:w-64 bg-superficie border border-borda text-texto rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-textoTen"
            />
          </div>
        }
      />

      {totalPessoas === 0 ? (
        <EmptyState icon={<ShieldAlert size={40} />}>
          {isSuper && !turmaFoco
            ? "Selecione uma turma no filtro acima."
            : termo
            ? `Nenhum militar encontrado para “${busca.trim()}”.`
            : "Sem efetivo para exibir."}
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
                    const temFaltas = p.faltas.length > 0;
                    return (
                      <div
                        key={k}
                        className="bg-cartao border border-borda rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => temFaltas && toggle(k)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                            temFaltas ? "hover:bg-cartaoAlt" : "cursor-default"
                          }`}
                        >
                          {temFaltas ? (
                            exp ? (
                              <ChevronDown size={15} className="text-textoTen shrink-0" />
                            ) : (
                              <ChevronRight size={15} className="text-textoTen shrink-0" />
                            )
                          ) : (
                            <span className="w-[15px] shrink-0" />
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
                          <span className="flex items-center gap-1.5 shrink-0 text-xs font-medium">
                            {p.faltasNaoJustificadas > 0 && (
                              <span className="text-vermelho">
                                {p.faltasNaoJustificadas}F
                              </span>
                            )}
                            {p.faltasJustificadas > 0 && (
                              <span className="text-ambar">
                                {p.faltasJustificadas}J
                              </span>
                            )}
                            <span
                              className={`ml-1 rounded-md px-2 py-0.5 font-mono font-semibold ${corSaldo(
                                p.pontos
                              )}`}
                            >
                              {p.pontos}
                              <span className="opacity-60">/{PONTOS_INICIAL}</span>
                            </span>
                          </span>
                        </button>

                        {exp && temFaltas && (
                          <div className="border-t border-borda px-3.5 py-3 flex flex-col gap-2">
                            <p className="text-[11px] text-textoTen mb-0.5">
                              {p.faltas.length} falta(s) na instrução
                              {podeClassificar
                                ? " · justifique para reduzir o desconto de −4 para −2"
                                : ""}
                            </p>
                            {p.faltas.map((f) => (
                              <div
                                key={f.date}
                                className="flex items-center gap-3 flex-wrap rounded-lg bg-superficie border border-borda px-3 py-2"
                              >
                                <span className="text-sm font-medium text-texto w-12 shrink-0">
                                  {dataBR(f.date).slice(0, 5)}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1 ${
                                    f.justificada
                                      ? "bg-ambar/15 text-ambar"
                                      : "bg-vermelho/15 text-vermelho"
                                  }`}
                                >
                                  {f.justificada ? (
                                    <>
                                      <Check size={13} /> Justificada
                                      <span className="opacity-70">(−2 pts)</span>
                                    </>
                                  ) : (
                                    <>
                                      Não justificada
                                      <span className="opacity-70">(−4 pts)</span>
                                    </>
                                  )}
                                </span>
                                {podeClassificar && (
                                  <span className="ml-auto">
                                    {f.justificada ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => classificar(g.id, p, f.date, false)}
                                      >
                                        <Undo2 size={13} /> Reverter
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="subtle"
                                        size="sm"
                                        onClick={() => classificar(g.id, p, f.date, true)}
                                      >
                                        <Check size={13} /> Justificar falta
                                      </Button>
                                    )}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
