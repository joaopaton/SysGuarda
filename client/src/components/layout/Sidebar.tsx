import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Settings,
  Archive,
  ClipboardCheck,
  ShieldAlert,
  Clock,
  Flag,
  Users,
  UserCog,
  ScrollText,
  LogOut,
  KeyRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { BRASAO } from "../../brasao";
import { useAppData } from "../../state/AppDataContext";
import { useNav, type Secao } from "../../state/NavContext";
import { ThemeToggle } from "../ui/ThemeToggle";
import { SenhaModal } from "../SenhaModal";

type Item = { secao: Secao; label: string; icon: typeof Clock; super?: boolean };

const GRUPOS: { grupo: string; itens: Item[] }[] = [
  {
    grupo: "VISÃO",
    itens: [{ secao: "painel", label: "Painel", icon: LayoutDashboard, super: true }],
  },
  {
    grupo: "OPERAÇÃO",
    itens: [
      { secao: "comando", label: "Ordem de serviço", icon: Settings },
      { secao: "escala", label: "Escala", icon: CalendarDays },
      { secao: "salvas", label: "Escalas salvas", icon: Archive },
      { secao: "calendario", label: "Calendário", icon: CalendarRange },
      { secao: "presenca", label: "Presença", icon: ClipboardCheck },
      { secao: "pontos", label: "Pontos", icon: ShieldAlert },
      { secao: "horas", label: "Horas de serviço", icon: Clock },
      { secao: "missoes", label: "Missões", icon: Flag },
    ],
  },
  {
    grupo: "CADASTRO",
    itens: [
      { secao: "efetivo", label: "Efetivo", icon: Users },
      { secao: "usuarios", label: "Usuários", icon: UserCog, super: true },
      { secao: "auditoria", label: "Auditoria", icon: ScrollText },
    ],
  },
];

export function Sidebar({
  onLogout,
  mobileAberto,
  onFechar,
}: {
  onLogout: () => void;
  mobileAberto: boolean;
  onFechar: () => void;
}) {
  const { user, isSuper } = useAppData();
  const { secao, irPara } = useNav();
  const [senhaAberta, setSenhaAberta] = useState(false);
  const iniciais = (user?.username ?? "?").slice(0, 2).toUpperCase();
  const papel =
    user?.role === "superadmin"
      ? "Comandante"
      : user?.role === "monitor"
      ? "Monitor"
      : "Instrutor";

  return (
    <>
      {mobileAberto && (
        <div
          onClick={onFechar}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-40 h-[100dvh] w-[208px] bg-superficie border-r border-borda flex flex-col transition-transform md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${
          mobileAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
          <img src={BRASAO} alt="Brasão" className="w-8 h-8 object-contain shrink-0" />
          <div className="leading-tight min-w-0">
            <div className="font-bold text-texto text-[15px]">SysGuarda</div>
            <div className="text-[11px] text-textoTen font-mono">TG 05-003</div>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto md:hidden text-textoSec p-1"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2">
          {GRUPOS.map((g) => {
            const itens = g.itens.filter((i) => !i.super || isSuper);
            if (itens.length === 0) return null;
            return (
              <div key={g.grupo} className="mb-1">
                <div className="px-2.5 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-textoTen">
                  {g.grupo}
                </div>
                {itens.map((it) => {
                  const ativo = secao === it.secao;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.secao}
                      onClick={() => {
                        irPara(it.secao);
                        onFechar();
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
                        ativo
                          ? "bg-verdeTint text-verdeTexto font-semibold"
                          : "text-textoSec hover:bg-cartaoAlt hover:text-texto"
                      }`}
                    >
                      <Icon
                        size={17}
                        className={ativo ? "text-verde" : ""}
                      />
                      {it.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-borda p-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-verdeTint text-verdeTexto flex items-center justify-center text-xs font-semibold shrink-0">
              {iniciais}
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-[13px] text-texto truncate">{user?.username}</div>
              <div className="text-[11px] text-textoTen truncate">
                {papel}
                {user?.turma ? ` · ${user.turma.codigo}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSenhaAberta(true)}
              title="Trocar senha"
              aria-label="Trocar senha"
              className="flex-1 h-9 rounded-lg border border-borda text-textoSec hover:bg-cartaoAlt hover:text-verde transition-colors inline-flex items-center justify-center"
            >
              <KeyRound size={16} />
            </button>
            <ThemeToggle />
            <button
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
              className="flex-1 h-9 rounded-lg border border-borda text-textoSec hover:bg-cartaoAlt hover:text-vermelho transition-colors inline-flex items-center justify-center"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {senhaAberta && <SenhaModal onClose={() => setSenhaAberta(false)} />}
    </>
  );
}
