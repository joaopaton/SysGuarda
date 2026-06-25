import { useState } from "react";
import type { Pessoa } from "../lib/types";

interface Props {
  opcoes: Pessoa[];
  atual: Pessoa;
  onSelecionar: (p: Pessoa) => void;
  onCancelar: () => void;
}

export function SeletorPessoa({ opcoes, atual, onSelecionar, onCancelar }: Props) {
  const [busca, setBusca] = useState("");
  const termo = busca.toLowerCase().trim();
  const filtradas = opcoes.filter(
    (p) =>
      !termo ||
      p.num.toLowerCase().includes(termo) ||
      p.nome.toLowerCase().includes(termo)
  );

  return (
    <div className="relative mb-1">
      <input
        autoFocus
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={`${atual.num} ${atual.nome}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancelar();
          if (e.key === "Enter" && filtradas.length > 0)
            onSelecionar(filtradas[0]);
        }}
        className="w-full bg-superficie border border-verde text-texto rounded-md px-2 py-1 text-xs box-border focus:outline-none"
      />
      <div className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-superficie border border-borda rounded-md max-h-44 overflow-y-auto shadow-xl min-w-40">
        <div
          onClick={() => onSelecionar({ num: "---", nome: "VAZIO" })}
          className="px-2.5 py-1.5 text-[11px] text-textoSec cursor-pointer border-b border-borda hover:bg-cartaoAlt"
        >
          — deixar vazio —
        </div>
        {filtradas.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-textoSec">Sem registro</div>
        ) : (
          filtradas.map((p, i) => (
            <div
              key={i}
              onClick={() => onSelecionar(p)}
              className="px-2.5 py-1.5 text-xs cursor-pointer flex gap-2 items-center hover:bg-cartaoAlt"
            >
              <span className="text-textoTen font-mono">{p.num}</span>
              <span className="text-texto">{p.nome}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
