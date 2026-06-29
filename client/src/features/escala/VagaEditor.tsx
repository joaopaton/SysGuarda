import { useState } from "react";
import type { Pessoa, Person } from "../../lib/types";
import { SeletorPessoa } from "../../components/SeletorPessoa";

export interface Vaga {
  num: string;
  nome: string;
  falta?: boolean;
  obs?: string | null;
}

/** Editor de uma vaga: troca a pessoa, marca falta e registra observação. */
export function VagaEditor({
  atual,
  opcoes,
  onAplicar,
  onCancelar,
}: {
  atual: Pessoa;
  opcoes: Person[];
  onAplicar: (v: Vaga) => void;
  onCancelar: () => void;
}) {
  const vazio = atual.num === "---" || atual.nome === "VAZIO";
  const [pessoa, setPessoa] = useState<Pessoa>(atual);
  const [falta, setFalta] = useState(!!atual.falta);
  const [obs, setObs] = useState(atual.obs ?? "");
  const [trocando, setTrocando] = useState(vazio);

  const ehVazio = pessoa.num === "---" || pessoa.nome === "VAZIO";

  if (trocando) {
    return (
      <SeletorPessoa
        atual={pessoa}
        opcoes={opcoes}
        onSelecionar={(p) => {
          if (p.num === "---") {
            onAplicar({ num: "---", nome: "VAZIO" });
            return;
          }
          setPessoa({ num: p.num, nome: p.nome });
          setTrocando(false);
        }}
        onCancelar={onCancelar}
      />
    );
  }

  return (
    <div className="relative w-[210px] bg-superficie border border-verde rounded-md p-2 text-xs shadow-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          <span className="text-textoTen font-mono mr-1">{pessoa.num}</span>
          <span className="text-texto">{pessoa.nome}</span>
        </span>
        <button
          onClick={() => setTrocando(true)}
          className="text-[10px] text-verdeTexto underline shrink-0"
        >
          trocar
        </button>
      </div>

      {!ehVazio && (
        <>
          <label className="flex items-center gap-1.5 cursor-pointer text-texto">
            <input
              type="checkbox"
              checked={falta}
              onChange={(e) => setFalta(e.target.checked)}
              className="accent-vermelho"
            />
            Faltou na guarda
          </label>
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação (opcional)"
            maxLength={300}
            className="w-full bg-cartao border border-borda text-texto rounded-md px-2 py-1 focus:outline-none focus:border-verde"
          />
        </>
      )}

      <div className="flex justify-end gap-1.5">
        <button
          onClick={onCancelar}
          className="px-2 py-1 rounded-md border border-borda text-textoSec hover:bg-cartaoAlt"
        >
          Cancelar
        </button>
        <button
          onClick={() =>
            onAplicar({ num: pessoa.num, nome: pessoa.nome, falta, obs })
          }
          className="px-2.5 py-1 rounded-md bg-verde text-noVerde font-medium"
        >
          OK
        </button>
      </div>
    </div>
  );
}
