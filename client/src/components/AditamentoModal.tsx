import { useEffect, useState } from "react";
import { api } from "../api";
import type { AditamentoConfig, DiaEscala, Instrutor } from "../types";
import { buildAditamentoHTML, imprimirAditamento } from "../aditamento";
import { FileText, X, AlertTriangle, Gem, Plus, Printer } from "lucide-react";

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

export function AditamentoModal({
  startDate,
  dias,
  escala,
  onClose,
  isSuper,
}: Props) {
  const [cfg, setCfg] = useState<AditamentoConfig>(CFG_VAZIA);
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);
  const [porDia, setPorDia] = useState<string[]>(Array(dias.length).fill(""));
  const [dataEmissao, setDataEmissao] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [novoSgt, setNovoSgt] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregarInstrutores = async () => {
    setInstrutores(await api.getInstrutores());
  };

  useEffect(() => {
    api.getAditamentoConfig().then(setCfg).catch((e) => setErro(e.message));
    carregarInstrutores().catch((e) => setErro((e as Error).message));
  }, []);

  const set = (k: keyof AditamentoConfig, v: string) =>
    setCfg((c) => ({ ...c, [k]: v }));

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
      // Só o Comandante persiste os textos fixos (config é global/compartilhada).
      // Instrutor/monitor geram o documento usando a config atual (sem salvar).
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
    "w-full bg-preto border border-linha text-caquiClaro px-2 py-1.5 text-xs font-mono";
  const labelCls = "text-[10px] text-areia block mb-1 tracking-wide font-mono";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="bg-olivaEsc border border-amareloMil w-full max-w-[680px] p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="m-0 text-base text-amareloMil font-estencil tracking-[2px] flex items-center gap-2">
            <FileText size={17} /> GERAR ADITAMENTO
          </h2>
          <button
            onClick={onClose}
            className="text-areia leading-none hover:text-vermelho"
          >
            <X size={20} />
          </button>
        </div>

        {erro && (
          <div className="mb-3 border border-vermelho bg-vermelho/20 text-caquiClaro px-3 py-2 text-xs font-mono flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {erro}
          </div>
        )}

        {/* Cabeçalho / metadados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>Nº DO ADITAMENTO</label>
            <input
              className={inputCls}
              value={cfg.numero}
              onChange={(e) => set("numero", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>DATA DE EMISSÃO</label>
            <input
              type="date"
              className={inputCls}
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>TIRO DE GUERRA</label>
            <input
              className={inputCls}
              value={cfg.tg}
              onChange={(e) => set("tg", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>CIDADE/UF</label>
            <input
              className={inputCls}
              value={cfg.cidade}
              onChange={(e) => set("cidade", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>UNIFORME</label>
            <input
              className={inputCls}
              value={cfg.uniforme}
              onChange={(e) => set("uniforme", e.target.value)}
            />
          </div>
        </div>

        {/* Instrutor de Sobreaviso por dia */}
        <div className="mb-4">
          <h3 className="text-[11px] text-verdeBrilho tracking-[2px] font-mono mb-2 flex items-center gap-1.5">
            <Gem size={13} /> INSTRUTOR DE SOBREAVISO (POR DIA)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {dias.map((dia, i) => (
              <div key={dia} className="flex items-center gap-2">
                <span className="text-[10px] text-amareloMil font-mono w-20 shrink-0">
                  {dia}
                </span>
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

          {/* Cadastro de SGTs — só o Comandante (add/remove são globais). */}
          {isSuper && (
            <div className="bg-preto border border-linha p-2.5">
              <div className="flex gap-2 mb-2">
                <input
                  placeholder="Cadastrar SGT (ex.: SGT SCHÜTZ)"
                  value={novoSgt}
                  onChange={(e) => setNovoSgt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSgt()}
                  className={inputCls}
                />
                <button
                  onClick={addSgt}
                  className="bg-verdeMil text-caquiClaro px-3 py-1.5 text-[11px] font-bold font-mono whitespace-nowrap inline-flex items-center gap-1"
                >
                  <Plus size={13} /> ADD
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {instrutores.map((ins) => (
                  <span
                    key={ins.id}
                    className="inline-flex items-center gap-1 bg-oliva border border-linha px-2 py-0.5 text-[10px] text-caquiClaro font-mono"
                  >
                    {ins.nome}
                    <button
                      onClick={() => removeSgt(ins.id)}
                      className="text-vermelho inline-flex items-center"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assinatura / lema */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className={labelCls}>ASSINANTE</label>
            <input
              className={inputCls}
              value={cfg.assinante}
              onChange={(e) => set("assinante", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>POSTO/GRAD.</label>
            <input
              className={inputCls}
              value={cfg.posto}
              onChange={(e) => set("posto", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>FUNÇÃO DO ASSINANTE</label>
            <input
              className={inputCls}
              value={cfg.funcaoAssinante}
              onChange={(e) => set("funcaoAssinante", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>LEMA (RODAPÉ)</label>
            <input
              className={inputCls}
              value={cfg.lema}
              onChange={(e) => set("lema", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-transparent border border-areia text-areia px-4 py-2 text-xs font-bold font-mono"
          >
            CANCELAR
          </button>
          <button
            onClick={gerar}
            className="bg-amareloMil text-preto px-5 py-2 text-xs font-bold tracking-wide font-mono inline-flex items-center gap-1.5"
          >
            <Printer size={14} /> GERAR PDF
          </button>
        </div>
      </div>
    </div>
  );
}
