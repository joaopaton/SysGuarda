import { useMemo, useState } from "react";
import { X, Flag, AlertTriangle, Search, Users } from "lucide-react";
import { api } from "../../lib/api";
import type { Person } from "../../lib/types";
import { useAppData } from "../../state/AppDataContext";
import { Button } from "../../components/ui/Button";
import { Input, Label } from "../../components/ui/Field";
import { hojeISO } from "../../lib/dates";

/** Lançamento de UMA missão (mesma data/descrição/horas) para vários militares. */
export function MissaoLoteModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { monitores, guardas, turmas } = useAppData();
  const [descricao, setDescricao] = useState("");
  const [horas, setHoras] = useState("");
  const [data, setData] = useState(hojeISO());
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Efetivo agrupado por turma (monitores + guardas), aplicando a busca.
  const grupos = useMemo(() => {
    const todos: Person[] = [...monitores, ...guardas];
    const q = busca.trim().toLowerCase();
    const filtrados = q
      ? todos.filter((p) => `${p.num} ${p.nome}`.toLowerCase().includes(q))
      : todos;

    const porTurma = new Map<string, Person[]>();
    for (const p of filtrados) {
      const gid = p.turmaId ?? "sem";
      (porTurma.get(gid) ?? porTurma.set(gid, []).get(gid)!).push(p);
    }
    const ordenados = (l: Person[]) =>
      l.sort(
        (a, b) =>
          Number(b.isMonitor) - Number(a.isMonitor) || a.num.localeCompare(b.num)
      );

    const out = turmas
      .filter((t) => porTurma.has(t.id))
      .map((t) => ({
        id: t.id,
        titulo: `${t.codigo} · ${t.apelido}`,
        pessoas: ordenados(porTurma.get(t.id)!),
      }));
    if (porTurma.has("sem")) {
      out.push({ id: "sem", titulo: "Sem turma", pessoas: ordenados(porTurma.get("sem")!) });
    }
    return out;
  }, [monitores, guardas, turmas, busca]);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Marca/desmarca todos os (visíveis) de um grupo.
  const toggleGrupo = (pessoas: Person[]) =>
    setSel((s) => {
      const n = new Set(s);
      const todosMarcados = pessoas.every((p) => n.has(p.id));
      pessoas.forEach((p) => (todosMarcados ? n.delete(p.id) : n.add(p.id)));
      return n;
    });

  const lancar = async () => {
    setErro(null);
    const h = Number(horas.replace(",", "."));
    if (!Number.isFinite(h) || h <= 0) {
      setErro("Informe as horas da missão.");
      return;
    }
    if (sel.size === 0) {
      setErro("Selecione ao menos um militar.");
      return;
    }
    setSalvando(true);
    try {
      const r = await api.addMissionsLote({
        date: data || null,
        descricao: descricao.trim(),
        horas: h,
        ids: [...sel],
      });
      const ign = r.ignorados ? ` · ${r.ignorados} fora da turma ignorado(s)` : "";
      onDone(`${r.criadas} lançamento(s) criado(s)${ign}.`);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="bg-cartao border border-borda rounded-2xl w-full max-w-[640px] p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-texto flex items-center gap-2">
            <Flag size={17} className="text-verde" /> Lançar missão para vários
          </h2>
          <button onClick={onClose} className="text-textoSec hover:text-vermelho" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {erro && (
          <div className="mb-3 rounded-lg border border-vermelho bg-vermelhoTint text-vermelho px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {erro}
          </div>
        )}

        {/* Dados compartilhados por todos os selecionados */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mb-4">
          <div>
            <Label>Descrição</Label>
            <Input
              placeholder="Ex.: Apoio ao desfile cívico"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Horas</Label>
            <Input
              placeholder="0"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className="w-[90px]"
            />
          </div>
        </div>

        {/* Busca */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textoTen" />
          <Input
            placeholder="Buscar por nome ou número…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Roster com checkboxes, por turma */}
        <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-borda divide-y divide-borda mb-4">
          {grupos.length === 0 ? (
            <p className="text-textoSec text-sm p-4">Nenhum militar encontrado.</p>
          ) : (
            grupos.map((g) => {
              const todos = g.pessoas.every((p) => sel.has(p.id));
              const marcados = g.pessoas.filter((p) => sel.has(p.id)).length;
              return (
                <div key={g.id}>
                  <button
                    onClick={() => toggleGrupo(g.pessoas)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-cartaoAlt text-left sticky top-0"
                  >
                    <input type="checkbox" checked={todos} readOnly className="accent-verde" />
                    <Users size={13} className="text-textoSec" />
                    <span className="text-xs font-semibold text-texto">{g.titulo}</span>
                    <span className="text-[11px] text-textoTen ml-auto">
                      {marcados}/{g.pessoas.length}
                    </span>
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    {g.pessoas.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-cartaoAlt"
                      >
                        <input
                          type="checkbox"
                          checked={sel.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="accent-verde"
                        />
                        <span className="text-textoTen font-mono text-xs">{p.num}</span>
                        <span className="text-texto truncate">{p.nome}</span>
                        {p.isMonitor && <span className="text-[10px] text-textoTen">(mon)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-textoSec">
            <strong className="text-texto">{sel.size}</strong> selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={lancar} disabled={salvando || sel.size === 0}>
              <Flag size={15} /> {salvando ? "Lançando…" : `Lançar para ${sel.size}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
