import { useEffect, useMemo, useState } from "react";
import { Users, Flag, ChevronRight, AlertTriangle, BarChart3, Clock, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import type { Dashboard, HoursReport } from "../../lib/types";
import { corTurma } from "../../lib/types";
import { useNav } from "../../state/NavContext";
import { Card } from "../../components/ui/Card";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Stat } from "../../components/ui/Stat";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { BarChart, Legenda } from "../../components/ui/BarChart";

const COR_MONITOR = "#22c55e";

export function PainelTab() {
  const { aplicarFoco, irPara, setErro } = useNav();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [horas, setHoras] = useState<HoursReport | null>(null);

  useEffect(() => {
    api.getDashboard().then(setDash).catch((e) => setErro((e as Error).message));
    api.getHours().then(setHoras).catch(() => {});
  }, [setErro]);

  // Cor estável por turma (segue a ordem do rodízio).
  const corPorTurma = useMemo(() => {
    const m = new Map<string, string>();
    dash?.turmas.forEach((t, i) => m.set(t.id, corTurma(i)));
    return m;
  }, [dash]);

  const efetivoPorTurma = useMemo(
    () =>
      (dash?.turmas ?? []).map((t) => ({
        rotulo: t.codigo,
        segmentos: [
          { valor: t.guardas, cor: corPorTurma.get(t.id) ?? "#3b82f6", rotulo: "Guardas" },
          { valor: t.monitores, cor: COR_MONITOR, rotulo: "Monitores" },
        ],
      })),
    [dash, corPorTurma]
  );

  const horasPorTurma = useMemo(
    () =>
      (horas?.turmas ?? [])
        .map((t) => ({
          rotulo: t.codigo,
          segmentos: [
            {
              valor: t.pessoas.reduce((a, p) => a + p.total, 0),
              cor: corPorTurma.get(t.id) ?? "#3b82f6",
              rotulo: "Horas",
            },
          ],
        }))
        .filter((b) => b.segmentos[0].valor > 0),
    [horas, corPorTurma]
  );

  const pontosPorTurma = useMemo(
    () =>
      (dash?.turmas ?? []).map((t) => ({
        rotulo: t.codigo,
        segmentos: [
          {
            valor: t.pontosMedia,
            cor: corPorTurma.get(t.id) ?? "#3b82f6",
            rotulo: "Pontos médios",
          },
        ],
      })),
    [dash, corPorTurma]
  );

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      : "—";

  const abrirTurma = (id: string) => {
    aplicarFoco(id);
    irPara("efetivo");
  };
  const gerarTurma = (id: string) => {
    aplicarFoco(id);
    irPara("comando");
  };

  return (
    <div>
      <SectionHeader
        title="Painel do comando"
        subtitle="Visão geral das turmas do TG 05-003"
        right={
          dash && dash.semTurma > 0 ? (
            <Badge tone="vermelho">
              <AlertTriangle size={12} /> {dash.semTurma} sem turma
            </Badge>
          ) : undefined
        }
      />

      {!dash ? (
        <p className="text-textoSec text-sm">Carregando…</p>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-texto">
              <BarChart3 size={16} className="text-verde" /> Efetivo por turma
            </div>
            <BarChart dados={efetivoPorTurma} />
            <Legenda
              itens={[
                { rotulo: "Guardas", cor: "#3b82f6" },
                { rotulo: "Monitores", cor: COR_MONITOR },
              ]}
            />
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-texto">
              <Clock size={16} className="text-verde" /> Horas contabilizadas por turma
            </div>
            <BarChart
              dados={horasPorTurma}
              unidade="h"
              vazio="Nenhuma guarda fechada ainda — feche guardas para contabilizar horas."
            />
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-texto">
              <ShieldAlert size={16} className="text-verde" /> Pontos médios por turma
            </div>
            <BarChart dados={pontosPorTurma} />
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dash.turmas.map((t) => {
            const naSemana = t.id === dash.proximaTurmaId;
            const ausentes = t.guardasAusentes + t.monitoresAusentes;
            return (
              <Card
                key={t.id}
                className={`p-4 ${naSemana ? "ring-1 ring-verde" : ""}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base font-semibold text-texto">
                    {t.codigo}
                  </span>
                  <span className="text-sm text-textoSec">{t.apelido}</span>
                  {naSemana && (
                    <Badge tone="verde" className="ml-auto">
                      Próxima na escala
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <Stat label="Guardas" value={t.guardas} />
                  <Stat label="Monitores" value={t.monitores} tone="verde" />
                  <Stat
                    label="Ausentes"
                    value={ausentes}
                    tone={ausentes > 0 ? "vermelho" : "verde"}
                  />
                  <Stat
                    label="Pontos méd."
                    value={t.pontosMedia}
                    tone={t.pontosMedia < 100 ? "vermelho" : "verde"}
                  />
                </div>

                <p className="text-xs text-textoSec mb-3">
                  {t.escalas} escala(s) salva(s) · última: {fmt(t.ultimaEscala)}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => abrirTurma(t.id)}
                  >
                    <Users size={14} /> Efetivo
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => gerarTurma(t.id)}
                  >
                    <Flag size={14} /> Gerar <ChevronRight size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
