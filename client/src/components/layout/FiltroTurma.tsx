import { useAppData } from "../../state/AppDataContext";
import { useNav } from "../../state/NavContext";

/** Filtro global de turma (só Comandante): "Todas" + T1..T4 como pills. */
export function FiltroTurma() {
  const { turmas } = useAppData();
  const { turmaFoco, aplicarFoco } = useNav();
  const opcoes: [string, string][] = [
    ["", "Todas"],
    ...turmas.map((t) => [t.id, t.codigo] as [string, string]),
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {opcoes.map(([id, label]) => (
        <button
          key={id || "todas"}
          onClick={() => aplicarFoco(id)}
          title={turmas.find((t) => t.id === id)?.apelido}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            turmaFoco === id
              ? "bg-verde text-noVerde"
              : "bg-cartao text-textoSec border border-borda hover:border-bordaForte hover:text-texto"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
