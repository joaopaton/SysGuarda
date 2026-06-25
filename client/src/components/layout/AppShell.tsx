import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useNav } from "../../state/NavContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  onLogout,
  children,
}: {
  onLogout: () => void;
  children: ReactNode;
}) {
  const { erro } = useNav();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="min-h-screen flex bg-fundo text-texto">
      <Sidebar
        onLogout={onLogout}
        mobileAberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenu={() => setMenuAberto(true)} />
        <main className="flex-1">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-5 sm:py-7">
            {erro && (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-vermelho bg-vermelhoTint text-vermelho px-4 py-2.5 text-sm">
                <AlertTriangle size={16} className="shrink-0" /> {erro}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
