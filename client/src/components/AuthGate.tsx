import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import type { MeUser } from "../types";
import { Login } from "./Login";

type Estado = "carregando" | "dentro" | "fora";

/** Gate de autenticação: mostra Login até a sessão estar válida. */
export function AuthGate({
  children,
}: {
  children: (logout: () => void, user: MeUser | null) => ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [user, setUser] = useState<MeUser | null>(null);

  const checar = useCallback(async () => {
    try {
      const r = await api.me();
      setUser(r.user ?? null);
      setEstado(r.authenticated ? "dentro" : "fora");
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
      setUser(null);
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
    return <Login onSuccess={checar} />;
  }

  return <>{children(logout, user)}</>;
}
