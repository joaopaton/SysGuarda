import type { ReactNode } from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bg-cartao border border-borda rounded-xl ${className}`}>
      {children}
    </div>
  );
}
