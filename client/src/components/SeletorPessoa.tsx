import { useState } from "react";
import type { Pessoa } from "../types";

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
        className="w-full bg-preto border border-amareloMil text-caquiClaro px-2 py-1 text-xs font-mono tracking-wide box-border"
      />
      <div className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-preto border border-amareloMil max-h-44 overflow-y-auto shadow-2xl min-w-40">
        <div
          onClick={() => onSelecionar({ num: "---", nome: "VAZIO" })}
          className="px-2.5 py-1.5 text-[11px] text-areia cursor-pointer border-b border-olivaEsc font-mono hover:bg-olivaEsc"
        >
          — DEIXAR VAZIO —
        </div>
        {filtradas.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-areia font-mono">
            SEM REGISTRO
          </div>
        ) : (
          filtradas.map((p, i) => (
            <div
              key={i}
              onClick={() => onSelecionar(p)}
              className="px-2.5 py-1.5 text-xs cursor-pointer flex gap-2 items-center font-mono hover:bg-olivaEsc"
            >
              <span className="text-amareloMil font-bold">{p.num}</span>
              <span className="text-caquiClaro">{p.nome}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
