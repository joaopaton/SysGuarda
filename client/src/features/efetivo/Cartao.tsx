import { Check, X, Trash2 } from "lucide-react";
import type { Person, Turma } from "../../lib/types";

export function Cartao({
  p,
  onRemover,
  onToggle,
  destaque,
  isSuper,
  turmas,
  onDefinirTurma,
  selecionado,
  onToggleSel,
}: {
  p: Person;
  onRemover: () => void;
  onToggle: () => void;
  destaque?: boolean;
  isSuper?: boolean;
  turmas?: Turma[];
  onDefinirTurma?: (id: string, turmaId: string | null) => void;
  selecionado?: boolean;
  onToggleSel?: () => void;
}) {
  const ausente = !p.available;
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 transition-colors ${
        destaque ? "bg-verdeTint border-verde/30" : "bg-cartao border-borda"
      } ${ausente ? "opacity-60" : ""} ${selecionado ? "ring-1 ring-verde" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm truncate flex items-center min-w-0">
          {onToggleSel && (
            <input
              type="checkbox"
              checked={!!selecionado}
              onChange={onToggleSel}
              className="mr-2 accent-verde shrink-0"
            />
          )}
          <span className="text-textoTen font-mono mr-2 shrink-0">{p.num}</span>
          <span className={`truncate ${ausente ? "text-textoSec line-through" : "text-texto"}`}>
            {p.nome}
          </span>
          {ausente && <span className="text-vermelho text-[11px] ml-1.5 shrink-0">ausente</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggle}
            title={ausente ? "Marcar presente" : "Marcar ausente (doente/afastado)"}
            className={ausente ? "text-textoTen" : "text-verde"}
          >
            {ausente ? <X size={17} /> : <Check size={17} />}
          </button>
          <button onClick={onRemover} title="Remover do efetivo" className="text-vermelho">
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      <div className="mt-2 text-xs">
        {isSuper && turmas && onDefinirTurma ? (
          <select
            value={p.turmaId ?? ""}
            onChange={(e) => onDefinirTurma(p.id, e.target.value || null)}
            className="w-full bg-superficie border border-borda text-textoSec rounded-md px-2 py-1 text-xs"
          >
            <option value="">— sem turma —</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} {t.apelido}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-textoTen">
            {p.turma ? `${p.turma.codigo} · ${p.turma.apelido}` : "sem turma"}
          </span>
        )}
      </div>
    </div>
  );
}
