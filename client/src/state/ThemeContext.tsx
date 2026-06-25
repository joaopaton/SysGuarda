import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Tema = "dia" | "noite";

interface ThemeCtx {
  tema: Tema;
  alternar: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const CHAVE = "sysguarda-tema";

function temaInicial(): Tema {
  const salvo = localStorage.getItem(CHAVE);
  if (salvo === "dia" || salvo === "noite") return salvo;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "dia"
    : "noite";
}

/** Aplica/remove a classe `dark` no <html> conforme o tema. */
function aplicar(tema: Tema) {
  document.documentElement.classList.toggle("dark", tema === "noite");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    aplicar(tema);
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  const alternar = useCallback(
    () => setTema((t) => (t === "noite" ? "dia" : "noite")),
    []
  );

  return <Ctx.Provider value={{ tema, alternar }}>{children}</Ctx.Provider>;
}

export function useTema() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTema fora do ThemeProvider");
  return c;
}
