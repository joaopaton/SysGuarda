import { useState } from "react";
import { Users, Gem, Plus, Check, Upload } from "lucide-react";
import { api } from "../../lib/api";
import type { Person } from "../../lib/types";
import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Field";
import { Cartao } from "./Cartao";

export function EfetivoTab() {
  const { monitores: monitoresAll, guardas: guardasAll, turmas, isSuper, user, recarregarEfetivo } =
    useAppData();
  const { turmaFoco, setErro } = useNav();

  const monitores = turmaFoco ? monitoresAll.filter((p) => p.turmaId === turmaFoco) : monitoresAll;
  const guardas = turmaFoco ? guardasAll.filter((p) => p.turmaId === turmaFoco) : guardasAll;

  const [novoNum, setNovoNum] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaTurma, setNovaTurma] = useState("");
  const [monNum, setMonNum] = useState("");
  const [monNome, setMonNome] = useState("");
  const [monTurma, setMonTurma] = useState("");
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkTurma, setBulkTurma] = useState("");

  const turmaPadrao = (escolhida: string | null) =>
    isSuper ? escolhida : user?.turma?.id ?? null;

  const addGuarda = async () => {
    if (!novoNome.trim()) return;
    try {
      await api.addPerson({
        num: novoNum.trim() || "---",
        nome: novoNome.trim().toUpperCase(),
        isMonitor: false,
        turmaId: turmaPadrao(novaTurma || null),
      });
      setNovoNum("");
      setNovoNome("");
      recarregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const addMonitor = async () => {
    if (!monNome.trim()) return;
    try {
      await api.addPerson({
        num: monNum.trim() || "---",
        nome: monNome.trim().toUpperCase(),
        isMonitor: true,
        turmaId: turmaPadrao(monTurma || null),
      });
      setMonNum("");
      setMonNome("");
      recarregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const remover = async (id: string) => {
    await api.removePerson(id);
    recarregarEfetivo();
  };
  const toggle = async (id: string, available: boolean) => {
    await api.setAvailable(id, available);
    recarregarEfetivo();
  };
  const definirTurma = async (id: string, turmaId: string | null) => {
    try {
      await api.setTurma(id, turmaId);
      recarregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const todos = [...monitores, ...guardas];
  const aplicarBulk = async () => {
    if (sel.size === 0) return;
    try {
      await api.atribuirTurma([...sel], bulkTurma || null);
      setSel(new Set());
      recarregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const importarTurmas = async (file: File) => {
    setImpMsg(null);
    try {
      const r = await api.importarTurmas(await file.text());
      const extra =
        r.naoEncontrados.length + r.turmaInvalida.length > 0
          ? ` · ${r.naoEncontrados.length} não encontrado(s), ${r.turmaInvalida.length} turma inválida`
          : "";
      setImpMsg(`${r.atualizadas} pessoa(s) atribuída(s)${extra}.`);
      recarregarEfetivo();
    } catch (e) {
      setImpMsg(`Erro: ${(e as Error).message}`);
    }
  };

  const selProps = (p: Person) =>
    isSuper ? { selecionado: sel.has(p.id), onToggleSel: () => toggleSel(p.id) } : {};
  const ausentes =
    monitores.filter((m) => !m.available).length + guardas.filter((g) => !g.available).length;

  return (
    <div>
      <SectionHeader
        title="Efetivo"
        subtitle={
          !isSuper && user?.turma
            ? `${user.turma.codigo} · ${user.turma.apelido}`
            : "Monitores e guardas do TG 05-003"
        }
      />

      {isSuper && (
        <Card className="p-3 mb-5 border-dashed flex items-center gap-2 flex-wrap text-sm">
          <span className="text-textoSec">Atribuição em massa:</span>
          <span className="text-textoTen">{sel.size} selecionado(s)</span>
          <Button variant="subtle" size="sm" onClick={() => setSel(new Set(todos.map((p) => p.id)))}>
            Todos ({todos.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>
            Limpar
          </Button>
          <span className="text-textoTen ml-auto">Mover para</span>
          <Select value={bulkTurma} onChange={(e) => setBulkTurma(e.target.value)} className="w-auto">
            <option value="">— sem turma —</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} {t.apelido}
              </option>
            ))}
          </Select>
          <Button variant="primary" size="sm" onClick={aplicarBulk} disabled={sel.size === 0}>
            <Check size={14} /> Atribuir
          </Button>
          <span className="w-full border-t border-borda my-1" />
          <span className="text-textoTen">
            Ou importar CSV <span className="text-verdeTexto font-mono">num ; nome ; turma</span>:
          </span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-borda px-3 py-1.5 text-xs text-textoSec hover:bg-cartaoAlt">
            <Upload size={13} /> Importar turmas
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarTurmas(f);
                e.target.value = "";
              }}
            />
          </label>
          {impMsg && <span className="w-full text-verdeTexto mt-1">{impMsg}</span>}
        </Card>
      )}

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold text-texto flex items-center gap-2 mb-1">
          <Gem size={16} className="text-verde" /> Monitores — Cmt Gd TG
        </h3>
        <p className="text-xs text-textoSec mb-3">Habilitados a comandar a guarda (por turma).</p>
        <div className="flex gap-2 flex-wrap mb-4">
          <Input placeholder="Nº" value={monNum} onChange={(e) => setMonNum(e.target.value)} className="w-[90px]" />
          <Input
            placeholder="Nome do monitor"
            value={monNome}
            onChange={(e) => setMonNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMonitor()}
            className="flex-1 min-w-[140px]"
          />
          {isSuper && (
            <Select value={monTurma} onChange={(e) => setMonTurma(e.target.value)} className="w-auto">
              <option value="">— turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} {t.apelido}
                </option>
              ))}
            </Select>
          )}
          <Button variant="primary" onClick={addMonitor}>
            <Plus size={15} /> Monitor
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
          {monitores.map((g) => (
            <Cartao
              key={g.id}
              p={g}
              destaque
              onRemover={() => remover(g.id)}
              onToggle={() => toggle(g.id, !g.available)}
              isSuper={isSuper}
              turmas={turmas}
              onDefinirTurma={definirTurma}
              {...selProps(g)}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5 mb-5">
        <h3 className="text-sm font-semibold text-texto flex items-center gap-2 mb-1">
          <Users size={16} /> Efetivo de guarda
        </h3>
        <p className="text-xs text-textoSec mb-3">Permanência e guardas do TG.</p>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Nº" value={novoNum} onChange={(e) => setNovoNum(e.target.value)} className="w-[90px]" />
          <Input
            placeholder="Nome"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGuarda()}
            className="flex-1 min-w-[140px]"
          />
          {isSuper && (
            <Select value={novaTurma} onChange={(e) => setNovaTurma(e.target.value)} className="w-auto">
              <option value="">— turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} {t.apelido}
                </option>
              ))}
            </Select>
          )}
          <Button variant="primary" onClick={addGuarda}>
            <Plus size={15} /> Incluir
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
        {guardas.map((g) => (
          <Cartao
            key={g.id}
            p={g}
            onRemover={() => remover(g.id)}
            onToggle={() => toggle(g.id, !g.available)}
            isSuper={isSuper}
            turmas={turmas}
            onDefinirTurma={definirTurma}
            {...selProps(g)}
          />
        ))}
      </div>
      <p className="text-textoSec text-xs mt-4">
        {guardas.length} guarda(s) ·{" "}
        <span className={ausentes > 0 ? "text-vermelho" : "text-verdeTexto"}>{ausentes} ausente(s)</span>.
      </p>
    </div>
  );
}
