import type { ReactNode } from "react";

type Tone = "verde" | "vermelho" | "ambar" | "neutro";

const TONE: Record<Tone, string> = {
  verde: "bg-verdeTint text-verdeTexto",
  vermelho: "bg-vermelhoTint text-vermelho",
  ambar: "bg-ambarTint text-ambar",
  neutro: "bg-cartaoAlt text-textoSec border border-borda",
};

export function Badge({
  tone = "neutro",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
