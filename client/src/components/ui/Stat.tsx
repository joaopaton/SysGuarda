type Tone = "neutro" | "verde" | "vermelho" | "ambar";

const COR: Record<Tone, string> = {
  neutro: "text-texto",
  verde: "text-verdeTexto",
  vermelho: "text-vermelho",
  ambar: "text-ambar",
};

/** Cartão de métrica: rótulo pequeno + número grande. */
export function Stat({
  label,
  value,
  tone = "neutro",
}: {
  label: string;
  value: number | string;
  tone?: Tone;
}) {
  return (
    <div className="bg-cartaoAlt rounded-lg px-4 py-3">
      <div className="text-[13px] text-textoSec">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${COR[tone]}`}>{value}</div>
    </div>
  );
}
