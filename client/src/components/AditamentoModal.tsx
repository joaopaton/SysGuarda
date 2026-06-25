import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AditamentoConfig, DiaEscala, Instrutor } from "../lib/types";
import { buildAditamentoHTML, imprimirAditamento } from "../aditamento";
import { FileText, X, AlertTriangle, Gem, Plus, Printer } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  startDate: string;
  dias: string[];
  escala: DiaEscala[];
  onClose: () => void;
  isSuper: boolean;
}

const CFG_VAZIA: AditamentoConfig = {
  tg: "",
  cidade: "",
  numero: "",
  uniforme: "",
  assinante: "",
  posto: "",
  funcaoAssinante: "",
  lema: "",
};

export function AditamentoModal({ startDate, dias, escala, onClose, isSuper }: Props) {
  const [cfg, setCfg] = useState<AditamentoConfig>(CFG_VAZIA);
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);
  const [porDia, setPorDia] = useState<string[]>(Array(dias.length).fill(""));
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split("T")[0]);
  const [novoSgt, setNovoSgt] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregarInstrutores = async () => {
    setInstrutores(await api.getInstrutores());
  };

  useEffect(() => {
    api.getAditamentoConfig().then(setCfg).catch((e) => setErro(e.message));
    carregarInstrutores().catch((e) => setErro((e as Error).message));
  }, []);

  const set = (k: keyof AditamentoConfig, v: string) => setCfg((c) => ({ ...c, [k]: v }));

  const addSgt = async () => {
    const nome = novoSgt.trim();
    if (!nome) return;
    await api.addInstrutor(nome);
    setNovoSgt("");
    carregarInstrutores();
  };

  const removeSgt = async (id: string) => {
    await api.removeInstrutor(id);
    carregarInstrutores();
  };

  const gerar = async () => {
    setErro(null);
    try {
      if (isSuper) await api.saveAditamentoConfig(cfg);
      const html = buildAditamentoHTML(startDate, escala, {
        ...cfg,
        dataEmissao,
        instrutores: porDia,
      });
      imprimirAditamento(html);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const inputCls =
    "w-full bg-superficie border border-borda text-texto rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-verde";
  const labelCls = "text-xs text-textoSec block mb-1";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="bg-cartao border border-borda rounded-2xl w-full max-w-[680px] p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-texto flex items-center gap-2">
            <FileText size={17} className="text-verde" /> Gerar aditamento
          </h2>
          <button onClick={onClose} className="text-textoSec hover:text-vermelho" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {erro && (
          <div className="mb-3 rounded-lg border border-vermelho bg-vermelhoTint text-vermelho px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {erro}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>Nº do aditamento</label>
            <input className={inputCls} value={cfg.numero} onChange={(e) => set("numero", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data de emissão</label>
            <input type="date" className={inputCls} value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tiro de guerra</label>
            <input className={inputCls} value={cfg.tg} onChange={(e) => set("tg", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Cidade/UF</label>
            <input className={inputCls} value={cfg.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Uniforme</label>
            <input className={inputCls} value={cfg.uniforme} onChange={(e) => set("uniforme", e.target.value)} />
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-medium text-texto mb-2 flex items-center gap-1.5">
            <Gem size={14} className="text-verde" /> Instrutor de sobreaviso (por dia)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {dias.map((dia, i) => (
              <div key={dia} className="flex items-center gap-2">
                <span className="text-xs text-textoSec font-mono w-20 shrink-0">{dia}</span>
                <select
                  className={inputCls}
                  value={porDia[i]}
                  onChange={(e) =>
                    setPorDia((p) => {
                      const n = [...p];
                      n[i] = e.target.value;
                      return n;
                    })
                  }
                >
                  <option value="">— (em branco) —</option>
                  {instrutores.map((ins) => (
                    <option key={ins.id} value={ins.nome}>
                      {ins.nome}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {isSuper && (
            <div className="bg-cartaoAlt border border-borda rounded-lg p-2.5">
              <div className="flex gap-2 mb-2">
                <input
                  placeholder="Cadastrar SGT (ex.: SGT SCHÜTZ)"
                  value={novoSgt}
                  onChange={(e) => setNovoSgt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSgt()}
                  className={inputCls}
                />
                <Button variant="primary" size="sm" onClick={addSgt} className="whitespace-nowrap">
                  <Plus size={13} /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {instrutores.map((ins) => (
                  <span
                    key={ins.id}
                    className="inline-flex items-center gap-1 bg-cartao border border-borda rounded-md px-2 py-0.5 text-xs text-texto"
                  >
                    {ins.nome}
                    <button onClick={() => removeSgt(ins.id)} className="text-vermelho inline-flex items-center">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className={labelCls}>Assinante</label>
            <input className={inputCls} value={cfg.assinante} onChange={(e) => set("assinante", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Posto/grad.</label>
            <input className={inputCls} value={cfg.posto} onChange={(e) => set("posto", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Função do assinante</label>
            <input className={inputCls} value={cfg.funcaoAssinante} onChange={(e) => set("funcaoAssinante", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Lema (rodapé)</label>
            <input className={inputCls} value={cfg.lema} onChange={(e) => set("lema", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={gerar}>
            <Printer size={14} /> Gerar PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
