// Helpers de data compartilhados pela UI.

/** Próxima terça-feira em YYYY-MM-DD (início padrão de uma escala). */
export function proximaTercaISO(): string {
  const d = new Date();
  const diff = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/** Data de hoje em YYYY-MM-DD (fuso local). */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "DD/MM/AAAA" a partir de "YYYY-MM-DD". */
export function dataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
}
