import { useCallback, useEffect, useState } from "react";
import { CalendarDays, FolderOpen, Trash2, Lock, Archive } from "lucide-react";
import { api } from "../../lib/api";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { useEscala } from "../../state/EscalaContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

type Salva = {
  id: string;
  startDate: string;
  createdAt: string;
  status?: string;
  turma?: { codigo: string; apelido: string } | null;
};

export function SalvasTab() {
  const { turmas } = useAppData();
  const { turmaFoco, setErro } = useNav();
  const { abrir, scheduleId } = useEscala();
  const [todas, setTodas] = useState<Salva[]>([]);
  const [carregando, setCarregando] = useState(true);

  const focoCod = turmas.find((t) => t.id === turmaFoco)?.codigo;
  const lista = focoCod ? todas.filter((s) => s.turma?.codigo === focoCod) : todas;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setTodas(await api.list());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const excluir = async (id: string) => {
    setErro(null);
    if (!confirm("Excluir esta escala salva? Esta ação não pode ser desfeita.")) return;
    try {
      await api.remove(id);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const periodo = (iso: string) => {
    const ini = new Date(iso);
    const fim = new Date(ini);
    fim.setDate(ini.getDate() + 6);
    return `${fmt(ini.toISOString())} → ${fmt(fim.toISOString())}`;
  };

  return (
    <div>
      <SectionHeader
        title="Escalas salvas"
        subtitle="Abra para visualizar ou editar — ao salvar, a mesma escala é atualizada."
      />

      {carregando ? (
        <p className="text-textoSec text-sm">Carregando…</p>
      ) : lista.length === 0 ? (
        <EmptyState icon={<Archive size={40} />}>
          Nenhuma escala salva ainda. Gere ou importe uma e toque em salvar.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((s) => (
            <Card
              key={s.id}
              className={`px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${
                s.id === scheduleId ? "ring-1 ring-verde" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm text-texto flex items-center gap-2 flex-wrap">
                  <CalendarDays size={15} className="text-verde shrink-0" />
                  <span className="font-mono">{periodo(s.startDate)}</span>
                  {s.turma && <Badge tone="verde">{s.turma.codigo} · {s.turma.apelido}</Badge>}
                  {s.status === "FECHADA" && (
                    <Badge tone="neutro">
                      <Lock size={10} /> Fechada
                    </Badge>
                  )}
                  {s.id === scheduleId && <Badge tone="verde">Em edição</Badge>}
                </div>
                <div className="text-xs text-textoTen mt-1">Salva em {fmt(s.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="primary" size="sm" onClick={() => abrir(s.id)}>
                  <FolderOpen size={14} /> Abrir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => excluir(s.id)}
                  className="hover:text-vermelho"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
