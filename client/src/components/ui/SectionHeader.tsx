import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-texto leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-textoSec">{subtitle}</p>}
      </div>
      {right && (
        <div className="flex gap-2 flex-wrap items-center">{right}</div>
      )}
    </div>
  );
}
