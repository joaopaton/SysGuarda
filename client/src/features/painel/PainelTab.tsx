import { useEffect, useState } from "react";
import { Users, Flag, ChevronRight, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import type { Dashboard } from "../../lib/types";
import { useNav } from "../../state/NavContext";
import { Card } from "../../components/ui/Card";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Stat } from "../../components/ui/Stat";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export function PainelTab() {
  const { aplicarFoco, irPara, setErro } = useNav();
  const [dash, setDash] = useState<Dashboard | null>(null);

  useEffect(() => {
    api.getDashboard().then(setDash).catch((e) => setErro((e as Error).message));
  }, [setErro]);

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

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Stat label="Guardas" value={t.guardas} />
                  <Stat label="Monitores" value={t.monitores} tone="verde" />
                  <Stat
                    label="Ausentes"
                    value={ausentes}
                    tone={ausentes > 0 ? "vermelho" : "verde"}
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
      )}
    </div>
  );
}
