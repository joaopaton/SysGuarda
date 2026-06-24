import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { Login } from "./Login";

type Estado = "carregando" | "dentro" | "fora";

/** Gate de autenticação: mostra Login até a sessão estar válida. */
export function AuthGate({
  children,
}: {
  children: (logout: () => void) => ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>("carregando");

  const checar = useCallback(async () => {
    try {
      const { authenticated } = await api.me();
      setEstado(authenticated ? "dentro" : "fora");
    } catch {
      setEstado("fora");
    }
  }, []);

  useEffect(() => {
    checar();
  }, [checar]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setEstado("fora");
    }
  }, []);

  if (estado === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center text-areia font-mono text-sm tracking-[2px]">
        CARREGANDO…
      </div>
    );
  }

  if (estado === "fora") {
    return <Login onSuccess={() => setEstado("dentro")} />;
  }

  return <>{children(logout)}</>;
}
