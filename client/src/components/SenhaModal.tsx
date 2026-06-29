import { useState } from "react";
import { KeyRound, X, AlertTriangle, Check } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Label, Input } from "./ui/Field";

/** Modal para o usuário logado trocar a própria senha. */
export function SenhaModal({ onClose }: { onClose: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (nova.length < 4) {
      setErro("A nova senha precisa ter ao menos 4 caracteres.");
      return;
    }
    if (nova !== confirma) {
      setErro("A confirmação não bate com a nova senha.");
      return;
    }
    setSalvando(true);
    try {
      await api.trocarMinhaSenha(atual, nova);
      setOk(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center overflow-y-auto py-12 px-4"
      onClick={onClose}
    >
      <div
        className="bg-cartao border border-borda rounded-2xl w-full max-w-[400px] p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-texto flex items-center gap-2">
            <KeyRound size={17} className="text-verde" /> Trocar senha
          </h2>
          <button onClick={onClose} className="text-textoSec hover:text-vermelho" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {ok ? (
          <div className="rounded-lg border border-verde bg-verdeTint text-verdeTexto px-3 py-2.5 text-sm flex items-center gap-2">
            <Check size={15} className="shrink-0" /> Senha alterada com sucesso.
          </div>
        ) : (
          <>
            {erro && (
              <div className="mb-3 rounded-lg border border-vermelho bg-vermelhoTint text-vermelho px-3 py-2 text-sm flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" /> {erro}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={atual}
                  onChange={(e) => setAtual(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label>Nova senha (mín. 4)</Label>
                <Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} />
              </div>
              <div>
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvar()}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button variant="primary" onClick={salvar} disabled={salvando} className="flex-1">
                <KeyRound size={15} /> {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
