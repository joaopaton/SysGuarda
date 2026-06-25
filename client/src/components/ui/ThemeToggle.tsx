import { Moon, Sun } from "lucide-react";
import { useTema } from "../../state/ThemeContext";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  const noite = tema === "noite";
  return (
    <button
      onClick={alternar}
      title={noite ? "Mudar para tema claro" : "Mudar para tema escuro"}
      aria-label={noite ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-borda text-textoSec hover:bg-cartaoAlt hover:text-texto transition-colors ${className}`}
    >
      {noite ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
