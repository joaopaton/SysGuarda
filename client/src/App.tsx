import type { MeUser } from "./lib/types";
import { NavProvider, useNav } from "./state/NavContext";
import { AppDataProvider, useAppData } from "./state/AppDataContext";
import { EscalaProvider, useEscala } from "./state/EscalaContext";
import { AppShell } from "./components/layout/AppShell";
import { AditamentoModal } from "./components/AditamentoModal";
import { PainelTab } from "./features/painel/PainelTab";
import { ConfigTab } from "./features/comando/ConfigTab";
import { EscalaTab } from "./features/escala/EscalaTab";
import { SalvasTab } from "./features/salvas/SalvasTab";
import { CalendarioTab } from "./features/calendario/CalendarioTab";
import { PresencaTab } from "./features/presenca/PresencaTab";
import { HorasTab } from "./features/horas/HorasTab";
import { MissoesSecao } from "./features/horas/MissoesSecao";
import { EfetivoTab } from "./features/efetivo/EfetivoTab";
import { UsuariosTab } from "./features/usuarios/UsuariosTab";
import { AuditoriaTab } from "./features/auditoria/AuditoriaTab";

function Conteudo() {
  const { secao } = useNav();
  const { isSuper } = useAppData();
  switch (secao) {
    case "painel":
      return isSuper ? <PainelTab /> : <EscalaTab />;
    case "comando":
      return <ConfigTab />;
    case "escala":
      return <EscalaTab />;
    case "salvas":
      return <SalvasTab />;
    case "calendario":
      return <CalendarioTab />;
    case "presenca":
      return <PresencaTab />;
    case "horas":
      return <HorasTab />;
    case "missoes":
      return <MissoesSecao />;
    case "efetivo":
      return <EfetivoTab />;
    case "usuarios":
      return isSuper ? <UsuariosTab /> : <EscalaTab />;
    case "auditoria":
      return <AuditoriaTab />;
    default:
      return <EscalaTab />;
  }
}

function AditamentoHost() {
  const { isSuper } = useAppData();
  const { dto, showAditamento, setShowAditamento } = useEscala();
  if (!showAditamento || !dto) return null;
  return (
    <AditamentoModal
      startDate={dto.startDate}
      dias={dto.dias}
      escala={dto.escala}
      onClose={() => setShowAditamento(false)}
      isSuper={isSuper}
    />
  );
}

export default function App({
  onLogout,
  user,
}: {
  onLogout: () => void;
  user: MeUser | null;
}) {
  return (
    <NavProvider isSuper={user?.role === "superadmin"}>
      <AppDataProvider user={user}>
        <EscalaProvider>
          <AppShell onLogout={onLogout}>
            <Conteudo />
          </AppShell>
          <AditamentoHost />
        </EscalaProvider>
      </AppDataProvider>
    </NavProvider>
  );
}
