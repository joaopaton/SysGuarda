export type Segmento = { valor: number; cor: string; rotulo?: string };
export type BarraDados = { rotulo: string; segmentos: Segmento[] };

/**
 * Gráfico de barras horizontais (empilháveis), 100% CSS — sem dependências.
 * Cada barra soma seus segmentos; a largura é proporcional ao maior total.
 */
export function BarChart({
  dados,
  unidade = "",
  vazio = "Sem dados.",
}: {
  dados: BarraDados[];
  unidade?: string;
  vazio?: string;
}) {
  const totais = dados.map((d) => d.segmentos.reduce((a, s) => a + s.valor, 0));
  const max = Math.max(1, ...totais);

  if (dados.length === 0 || totais.every((t) => t === 0)) {
    return <p className="text-textoSec text-sm py-2">{vazio}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {dados.map((d, i) => {
        const total = totais[i];
        return (
          <div key={d.rotulo} className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-xs text-textoSec text-right truncate">
              {d.rotulo}
            </div>
            <div className="flex-1 h-6 rounded-md bg-cartaoAlt overflow-hidden flex">
              {d.segmentos.map((s, j) =>
                s.valor > 0 ? (
                  <div
                    key={j}
                    className="h-full transition-[width] duration-500"
                    style={{
                      width: `${(s.valor / max) * 100}%`,
                      background: s.cor,
                    }}
                    title={`${s.rotulo ?? d.rotulo}: ${s.valor}${unidade}`}
                  />
                ) : null
              )}
            </div>
            <div className="w-12 shrink-0 text-xs font-semibold text-texto tabular-nums">
              {total}
              {unidade}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Legenda compacta de cores (rótulo + amostra). */
export function Legenda({
  itens,
}: {
  itens: { rotulo: string; cor: string }[];
}) {
  return (
    <div className="flex gap-3 flex-wrap mt-3">
      {itens.map((it) => (
        <div key={it.rotulo} className="flex items-center gap-1.5 text-xs text-textoSec">
          <span className="w-3 h-3 rounded" style={{ background: it.cor }} />
          {it.rotulo}
        </div>
      ))}
    </div>
  );
}
