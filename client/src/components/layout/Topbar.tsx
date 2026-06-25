import { Menu } from "lucide-react";
import { BRASAO } from "../../brasao";
import { useAppData } from "../../state/AppDataContext";
import { FiltroTurma } from "./FiltroTurma";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { isSuper } = useAppData();
  return (
    <header className="h-16 shrink-0 border-b border-borda bg-superficie flex items-center gap-3 px-4 sm:px-6">
      <button
        onClick={onMenu}
        className="md:hidden text-textoSec p-1 -ml-1"
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>
      <div className="md:hidden flex items-center gap-2">
        <img src={BRASAO} alt="Brasão" className="w-7 h-7 object-contain" />
        <span className="font-bold text-texto text-sm">SysGuarda</span>
      </div>
      {isSuper && (
        <div className="ml-auto min-w-0">
          <FiltroTurma />
        </div>
      )}
    </header>
  );
}
