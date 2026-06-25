import { useCallback, useEffect, useState } from "react";
import { Flag, Scale, Upload, FileText, Check, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAppData } from "../../state/AppDataContext";
import { useEscala } from "../../state/EscalaContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Label, Select } from "../../components/ui/Field";

export function ConfigTab() {
  const { isSuper, turmas, user } = useAppData();
  const {
    inicio,
    setInicio,
    balancear,
    setBalancear,
    gerar,
    turmaGerar,
    setTurmaGerar,
    importarEscalaCsv,
  } = useEscala();

  const [histCount, setHistCount] = useState(0);
  const [histMsg, setHistMsg] = useState<string | null>(null);

  const carregarHistorico = useCallback(async () => {
    try {
      setHistCount((await api.getManualHistory()).length);
    } catch {
      /* opcional */
    }
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const importarHistorico = async (file: File, mode: "replace" | "add") => {
    setHistMsg(null);
    try {
      const r = await api.importHistory(await file.text(), mode);
      setHistMsg(`${r.importadas} pessoas importadas · ${r.total} no histórico.`);
      carregarHistorico();
    } catch (e) {
      setHistMsg(`Erro: ${(e as Error).message}`);
    }
  };

  const limparHistorico = async () => {
    await api.clearHistory();
    setHistMsg(null);
    carregarHistorico();
  };

  return (
    <div className="max-w-[520px]">
      <SectionHeader
        title="Ordem de serviço"
        subtitle="Defina a turma e a semana e gere a escala."
      />

      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <div>
            <Label>Turma da semana</Label>
            {isSuper ? (
              <Select value={turmaGerar} onChange={(e) => setTurmaGerar(e.target.value)}>
                <option value="">Automático (rodízio T1→T4)</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} · {t.apelido}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="rounded-lg bg-cartaoAlt border border-borda px-3 py-2.5 text-sm text-verdeTexto font-medium">
                {user?.turma ? `${user.turma.codigo} · ${user.turma.apelido}` : "Sem turma definida"}
              </div>
            )}
            <p className="mt-1.5 text-xs text-textoSec">A guarda desta semana é tirada por esta turma.</p>
          </div>

          <div>
            <Label>Terça-feira inicial</Label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-full bg-superficie border border-borda text-texto rounded-lg px-3 py-2.5 text-sm"
            />
            <p className="mt-1.5 text-xs text-textoSec">Ajuste automático para terça (no servidor).</p>
          </div>

          <div className="rounded-lg bg-cartaoAlt border border-borda px-3 py-2.5 text-sm">
            <span className="text-textoSec">Período: </span>
            <span className="text-verdeTexto font-medium">Ter → Seg · 7 dias</span>
          </div>

          <label className="rounded-lg border border-borda px-3 py-3 flex items-start gap-2.5 cursor-pointer hover:bg-cartaoAlt">
            <input
              type="checkbox"
              checked={balancear}
              onChange={(e) => setBalancear(e.target.checked)}
              className="mt-0.5 accent-verde"
            />
            <span>
              <span className="text-sm text-texto font-medium inline-flex items-center gap-1.5">
                <Scale size={14} className="text-verde" /> Balanceamento por histórico
              </span>
              <span className="block text-xs text-textoSec mt-0.5">
                Usa as escalas salvas + o histórico importado. Quem fez mais guardas entra menos vezes.
              </span>
            </span>
          </label>

          {isSuper && (
            <div className="rounded-lg border border-dashed border-borda px-3 py-3">
              <span className="text-sm text-texto font-medium flex items-center gap-1.5 mb-1">
                <Upload size={14} /> Importar histórico (planilha / CSV)
              </span>
              <p className="text-xs text-textoSec mb-2.5">
                Suba a planilha do mês (grade função×dia) ou uma contagem{" "}
                <span className="text-verdeTexto font-mono">num ; nome ; guardas</span>.
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-verde text-noVerde hover:bg-verdeEsc px-3 py-1.5 text-xs font-medium">
                  Substituir
                  <input type="file" accept=".csv,.txt,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importarHistorico(f, "replace"); e.target.value = ""; }} />
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-verde text-verdeTexto hover:bg-verdeTint px-3 py-1.5 text-xs font-medium">
                  + Somar
                  <input type="file" accept=".csv,.txt,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importarHistorico(f, "add"); e.target.value = ""; }} />
                </label>
                {histCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={limparHistorico} className="hover:text-vermelho">
                    <X size={13} /> Limpar ({histCount})
                  </Button>
                )}
              </div>
              {histMsg && (
                <p className="mt-2 text-xs text-verdeTexto flex items-center gap-1.5">
                  <Check size={12} /> {histMsg}
                </p>
              )}
            </div>
          )}

          <Button variant="primary" onClick={gerar} className="py-3 text-base">
            <Flag size={18} /> Gerar escala
          </Button>

          <div className="rounded-lg border border-dashed border-borda px-3 py-3">
            <span className="text-sm text-texto font-medium flex items-center gap-1.5 mb-1">
              <FileText size={14} /> Aditamento a partir de CSV
            </span>
            <p className="text-xs text-textoSec mb-2.5">
              Suba uma escala em CSV (mesmo formato do botão CSV da escala). Abre o aditamento já preenchido.
            </p>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-verde text-noVerde hover:bg-verdeEsc px-3 py-1.5 text-xs font-medium">
              <Upload size={13} /> Importar escala (CSV)
              <input type="file" accept=".csv,.txt,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importarEscalaCsv(f); e.target.value = ""; }} />
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}
