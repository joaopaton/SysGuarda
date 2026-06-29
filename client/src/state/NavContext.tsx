import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type Secao =
  | "painel"
  | "escala"
  | "salvas"
  | "calendario"
  | "presenca"
  | "horas"
  | "missoes"
  | "efetivo"
  | "comando"
  | "usuarios"
  | "auditoria";

interface NavCtx {
  secao: Secao;
  irPara: (s: Secao) => void;
  turmaFoco: string; // "" = todas as turmas (visão do Comandante)
  aplicarFoco: (id: string) => void;
  erro: string | null;
  setErro: (e: string | null) => void;
}

const Ctx = createContext<NavCtx | null>(null);

export function NavProvider({
  isSuper = false,
  children,
}: {
  isSuper?: boolean;
  children: ReactNode;
}) {
  const [secao, setSecao] = useState<Secao>(isSuper ? "painel" : "escala");
  const [turmaFoco, setTurmaFoco] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const irPara = useCallback((s: Secao) => {
    setErro(null);
    setSecao(s);
  }, []);

  const aplicarFoco = useCallback((id: string) => setTurmaFoco(id), []);

  return (
    <Ctx.Provider
      value={{ secao, irPara, turmaFoco, aplicarFoco, erro, setErro }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNav() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNav fora do NavProvider");
  return c;
}
