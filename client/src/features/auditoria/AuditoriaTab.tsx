import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollText, Search, RotateCw } from "lucide-react";
import { api } from "../../lib/api";
import type { AuditEntry } from "../../lib/types";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { EmptyState } from "../../components/ui/EmptyState";

const COR_METODO: Record<string, "verde" | "ambar" | "vermelho" | "neutro"> = {
  POST: "verde",
  PUT: "ambar",
  PATCH: "ambar",
  DELETE: "vermelho",
};

export function AuditoriaTab() {
  const { turmas } = useAppData();
  const { setErro } = useNav();
  const [logs, setLogs] = useState<AuditEntry[] | null>(null);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLogs(await api.getAudit(500));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [setErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const codTurma = useCallback(
    (id: string | null) => (id ? turmas.find((t) => t.id === id)?.codigo ?? null : null),
    [turmas]
  );

  const papel = (r: string) =>
    r === "superadmin" ? "Comandante" : r === "monitor" ? "Monitor" : r === "instrutor" ? "Instrutor" : r;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filtrados = useMemo(() => {
    if (!logs) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.username} ${l.acao} ${l.detalhe ?? ""} ${l.rota}`.toLowerCase().includes(q)
    );
  }, [logs, busca]);

  return (
    <div>
      <SectionHeader
        title="Auditoria"
        subtitle="Trilha de ações — quem fez o quê e quando. Apenas o Comandante visualiza."
        right={
          <Button variant="outline" size="sm" onClick={carregar}>
            <RotateCw size={14} /> Atualizar
          </Button>
        }
      />

      <div className="relative mb-4 max-w-[380px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textoTen" />
        <Input
          placeholder="Filtrar por usuário, ação ou detalhe…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {!logs ? (
        <p className="text-textoSec text-sm">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <EmptyState icon={<ScrollText size={40} />}>
          {busca ? "Nenhum registro para esse filtro." : "Nenhuma ação registrada ainda."}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[680px]">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda whitespace-nowrap">Quando</th>
                <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda">Usuário</th>
                <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda">Ação</th>
                <th className="px-3 py-2.5 text-xs font-medium text-textoSec border-b border-borda">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => {
                const cod = codTurma(l.turmaId);
                return (
                  <tr key={l.id} className="border-b border-borda last:border-0">
                    <td className="px-3 py-2 text-xs text-textoSec whitespace-nowrap font-mono align-top">
                      {fmt(l.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-sm align-top whitespace-nowrap">
                      <span className="text-texto">{l.username}</span>
                      <span className="text-[11px] text-textoTen ml-1.5">
                        {papel(l.role)}
                        {cod ? ` · ${cod}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone={COR_METODO[l.method] ?? "neutro"}>{l.method}</Badge>
                        <span className="text-texto">{l.acao}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-textoSec align-top">
                      {l.detalhe || <span className="text-textoTen">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
