import type { ReactNode } from "react";

export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 text-textoSec">
      {icon && <div className="mb-3 text-textoTen">{icon}</div>}
      <p className="text-sm">{children}</p>
    </div>
  );
}
