import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "danger" | "ghost" | "subtle";
type Size = "sm" | "md";

const VAR: Record<Variant, string> = {
  primary: "bg-verde text-noVerde border border-transparent hover:bg-verdeEsc",
  outline:
    "bg-transparent text-texto border border-borda hover:bg-cartaoAlt hover:border-bordaForte",
  danger: "bg-vermelho text-white border border-transparent hover:opacity-90",
  ghost:
    "bg-transparent text-textoSec border border-transparent hover:bg-cartaoAlt hover:text-texto",
  subtle: "bg-cartaoAlt text-texto border border-borda hover:bg-superficie",
};

export function Button({
  variant = "outline",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sz =
    size === "sm" ? "px-3 py-1.5 text-xs gap-1.5" : "px-4 py-2 text-sm gap-2";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${VAR[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
