import { useState } from "react";
import { api } from "../lib/api";
import { AlertTriangle, LogIn } from "lucide-react";
import { BRASAO } from "../brasao";
import { ThemeToggle } from "./ui/ThemeToggle";

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-fundo text-texto">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={entrar}
        className="w-full max-w-[380px] bg-cartao border border-borda rounded-2xl p-7"
      >
        <div className="flex items-center gap-3 mb-6">
          <img src={BRASAO} alt="Brasão" className="w-12 h-12 object-contain shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-texto">SysGuarda</h1>
            <p className="text-xs text-textoSec font-mono tracking-wide">
              TG 05-003 · acesso restrito
            </p>
          </div>
        </div>

        {erro && (
          <div className="mb-4 rounded-lg border border-vermelho bg-vermelhoTint text-vermelho px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" /> {erro}
          </div>
        )}

        <label className="block mb-1.5 text-xs font-medium text-textoSec">Usuário</label>
        <input
          autoFocus
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          className="w-full bg-superficie border border-borda text-texto rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:border-verde"
        />

        <label className="block mb-1.5 text-xs font-medium text-textoSec">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          className="w-full bg-superficie border border-borda text-texto rounded-lg px-3 py-2.5 text-sm mb-6 focus:outline-none focus:border-verde"
        />

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-verde text-noVerde rounded-lg py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 hover:bg-verdeEsc transition-colors"
        >
          <LogIn size={16} /> {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
