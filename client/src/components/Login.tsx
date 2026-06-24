import { useState } from "react";
import { api } from "../api";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.login(usuario.trim(), senha);
      onSuccess();
    } catch (err) {
      setErro((err as Error).message || "Falha no login.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-cond">
      <form
        onSubmit={entrar}
        className="w-full max-w-[360px] bg-olivaEsc border border-amareloMil p-7"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 border-2 border-amareloMil rounded-full flex items-center justify-center text-xl bg-oliva shrink-0">
            ★
          </div>
          <div>
            <h1 className="m-0 text-lg font-bold text-caquiClaro font-estencil tracking-[2px]">
              SYSGUARDA
            </h1>
            <p className="m-0 text-[10px] text-amareloMil tracking-[3px] font-mono">
              ACESSO RESTRITO
            </p>
          </div>
        </div>
        <div className="h-0.5 my-4 bg-[repeating-linear-gradient(90deg,#d4b942_0_10px,transparent_10px_18px)]" />

        {erro && (
          <div className="mb-3 border border-vermelho bg-vermelho/20 text-caquiClaro px-3 py-2 text-xs font-mono">
            ⚠ {erro}
          </div>
        )}

        <label className="text-[10px] text-areia block mb-1 tracking-[2px] font-mono">
          USUÁRIO
        </label>
        <input
          autoFocus
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full bg-preto border border-linha text-caquiClaro px-3 py-2.5 text-sm mb-3 font-mono"
        />

        <label className="text-[10px] text-areia block mb-1 tracking-[2px] font-mono">
          SENHA
        </label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full bg-preto border border-linha text-caquiClaro px-3 py-2.5 text-sm mb-5 font-mono"
        />

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-amareloMil text-preto py-3 text-sm font-bold tracking-[2px] font-estencil disabled:opacity-60"
        >
          {enviando ? "ENTRANDO…" : "⚐ ENTRAR"}
        </button>
      </form>
    </div>
  );
}
