import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import type { MeUser, Person, Turma } from "../lib/types";
import { useNav } from "./NavContext";

interface AppDataCtx {
  user: MeUser | null;
  isSuper: boolean;
  turmas: Turma[];
  monitores: Person[];
  guardas: Person[];
  recarregarEfetivo: () => Promise<void>;
  recarregarTurmas: () => Promise<void>;
}

const Ctx = createContext<AppDataCtx | null>(null);

export function AppDataProvider({
  user,
  children,
}: {
  user: MeUser | null;
  children: ReactNode;
}) {
  const { setErro } = useNav();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [monitores, setMonitores] = useState<Person[]>([]);
  const [guardas, setGuardas] = useState<Person[]>([]);

  const recarregarEfetivo = useCallback(async () => {
    try {
      const { monitores, guardas } = await api.getPeople();
      setMonitores(monitores);
      setGuardas(guardas);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [setErro]);

  const recarregarTurmas = useCallback(async () => {
    try {
      setTurmas(await api.getTurmas());
    } catch {
      /* turmas são opcionais para algumas telas */
    }
  }, []);

  useEffect(() => {
    recarregarEfetivo();
    recarregarTurmas();
  }, [recarregarEfetivo, recarregarTurmas]);

  return (
    <Ctx.Provider
      value={{
        user,
        isSuper: user?.role === "superadmin",
        turmas,
        monitores,
        guardas,
        recarregarEfetivo,
        recarregarTurmas,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppData fora do AppDataProvider");
  return c;
}
