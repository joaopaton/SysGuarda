import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import {
  COR_FUNC,
  FUNCOES,
  VAGAS,
  type DiaEscala,
  type EscalaDTO,
  type Person,
} from "./types";
import { SeletorPessoa } from "./components/SeletorPessoa";
import { AditamentoModal } from "./components/AditamentoModal";
import { exportarEscalaCSV, exportarHistoricoCSV, exportarPDF } from "./export";

type Aba = "escala" | "guardas" | "config" | "usuarios";
type Editando = { dia: number; func: (typeof FUNCOES)[number]; idx: number } | null;

function proximaTercaISO(): string {
  const d = new Date();
  const diff = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export default function App({ onLogout }: { onLogout: () => void }) {
  const [aba, setAba] = useState<Aba>("escala");
  const [monitores, setMonitores] = useState<Person[]>([]);
  const [guardas, setGuardas] = useState<Person[]>([]);
  const [inicio, setInicio] = useState(proximaTercaISO());
  const [balancear, setBalancear] = useState(true);
  const [dto, setDto] = useState<EscalaDTO | null>(null);
  const [editando, setEditando] = useState<Editando>(null);
  const [novoNum, setNovoNum] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [histCount, setHistCount] = useState(0);
  const [histMsg, setHistMsg] = useState<string | null>(null);
  const [showAditamento, setShowAditamento] = useState(false);

  const carregarEfetivo = useCallback(async () => {
    try {
      const { monitores, guardas } = await api.getPeople();
      setMonitores(monitores);
      setGuardas(guardas);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  const carregarHistorico = useCallback(async () => {
    try {
      const rows = await api.getManualHistory();
      setHistCount(rows.length);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  const importarHistorico = useCallback(
    async (file: File, mode: "replace" | "add") => {
      setErro(null);
      setHistMsg(null);
      try {
        const texto = await file.text();
        const r = await api.importHistory(texto, mode);
        setHistMsg(
          `${r.importadas} pessoas importadas · ${r.total} no histórico.`
        );
        carregarHistorico();
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [carregarHistorico]
  );

  const limparHistorico = useCallback(async () => {
    await api.clearHistory();
    setHistMsg(null);
    carregarHistorico();
  }, [carregarHistorico]);

  useEffect(() => {
    carregarEfetivo();
    carregarHistorico();
  }, [carregarEfetivo, carregarHistorico]);

  const gerar = useCallback(async () => {
    setErro(null);
    try {
      const novo = await api.generate(inicio, balancear);
      setDto(novo);
      setAba("escala");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [inicio, balancear]);

  const editarCelula = (
    dia: number,
    func: (typeof FUNCOES)[number],
    idx: number,
    pessoa: { num: string; nome: string }
  ) => {
    setDto((prev) => {
      if (!prev) return prev;
      const escala = prev.escala.map((d) => ({ ...d }) as DiaEscala);
      escala[dia][func] = [...escala[dia][func]];
      escala[dia][func][idx] = { num: pessoa.num, nome: pessoa.nome };
      return { ...prev, escala };
    });
    setEditando(null);
  };

  const adicionarGuarda = async () => {
    if (!novoNome.trim()) return;
    await api.addPerson({
      num: novoNum.trim() || "---",
      nome: novoNome.trim().toUpperCase(),
      isMonitor: false,
    });
    setNovoNum("");
    setNovoNome("");
    carregarEfetivo();
  };

  const removerPessoa = async (id: string) => {
    await api.removePerson(id);
    carregarEfetivo();
  };

  const alternarDisponibilidade = async (id: string, available: boolean) => {
    await api.setAvailable(id, available);
    carregarEfetivo();
  };

  const salvar = async () => {
    if (!dto) return;
    setSalvando(true);
    setMsg(null);
    try {
      await api.save(dto.startDate, dto.escala);
      setMsg("Escala salva no banco — já entra no balanceamento futuro.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const baixarHistorico = () => {
    if (!dto) return;
    const cont: Record<string, { num: string; nome: string; guardas: number }> = {};
    dto.escala.forEach((d) =>
      FUNCOES.forEach((f) =>
        (d[f] || []).forEach((p) => {
          if (p.num === "---") return;
          const k = p.num + p.nome;
          cont[k] ??= { num: p.num, nome: p.nome, guardas: 0 };
          cont[k].guardas++;
        })
      )
    );
    exportarHistoricoCSV(Object.values(cont));
  };

  return (
    <div className="min-h-screen text-caqui font-cond">
      <Header onLogout={onLogout} />
      <Tabs aba={aba} setAba={setAba} />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        {erro && (
          <div className="mb-4 border border-vermelho bg-vermelho/20 text-caquiClaro px-4 py-2 text-xs font-mono">
            ⚠ {erro}
          </div>
        )}

        {aba === "config" && (
          <ConfigTab
            inicio={inicio}
            setInicio={setInicio}
            balancear={balancear}
            setBalancear={setBalancear}
            onGerar={gerar}
            histCount={histCount}
            histMsg={histMsg}
            onImportar={importarHistorico}
            onLimpar={limparHistorico}
          />
        )}

        {aba === "guardas" && (
          <EfetivoTab
            monitores={monitores}
            guardas={guardas}
            novoNum={novoNum}
            novoNome={novoNome}
            setNovoNum={setNovoNum}
            setNovoNome={setNovoNome}
            onAdicionar={adicionarGuarda}
            onRemover={removerPessoa}
            onToggle={alternarDisponibilidade}
          />
        )}

        {aba === "escala" && (
          <EscalaTab
            dto={dto}
            monitores={monitores}
            guardas={guardas}
            editando={editando}
            setEditando={setEditando}
            onEditar={editarCelula}
            onReembaralhar={gerar}
            onSalvar={salvar}
            salvando={salvando}
            msg={msg}
            onIrConfig={() => setAba("config")}
            onHistorico={baixarHistorico}
            onAditamento={() => setShowAditamento(true)}
          />
        )}

        {aba === "usuarios" && <UsuariosTab onErro={setErro} />}
      </div>

      {showAditamento && dto && (
        <AditamentoModal
          startDate={dto.startDate}
          dias={dto.dias}
          escala={dto.escala}
          onClose={() => setShowAditamento(false)}
        />
      )}

      <div className="text-center py-5 text-[10px] text-areia font-mono tracking-[2px]">
        ▬▬▬ DOCUMENTO SUJEITO A ALTERAÇÃO ▬▬▬
      </div>
    </div>
  );
}

function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="bg-olivaEsc border-b-[3px] border-amareloMil px-6 py-[18px] relative">
      <div className="max-w-[1100px] mx-auto flex items-center gap-4">
        <div className="w-[52px] h-[52px] border-2 border-amareloMil rounded-full flex items-center justify-center text-2xl shrink-0 bg-oliva">
          ★
        </div>
        <div>
          <h1 className="m-0 text-2xl font-bold text-caquiClaro font-estencil tracking-[2px]">
            ESCALA DE SERVIÇO · T2
          </h1>
          <p className="mt-0.5 text-[11px] text-amareloMil tracking-[4px] font-mono">
            // PREVISÃO OPERACIONAL DE GUARDA
          </p>
        </div>
      </div>
      <div className="absolute top-2 right-4 flex items-center gap-3">
        <span className="text-[10px] text-areia font-mono tracking-wide">
          CLASSIF: USO INTERNO
        </span>
        <button
          onClick={onLogout}
          title="Sair"
          className="text-[10px] text-amareloMil border border-amareloMil/50 px-2 py-0.5 font-mono tracking-wide hover:bg-amareloMil hover:text-preto"
        >
          ⏻ SAIR
        </button>
      </div>
    </div>
  );
}

function Tabs({ aba, setAba }: { aba: Aba; setAba: (a: Aba) => void }) {
  const tabs: [Aba, string][] = [
    ["escala", "▣ ESCALA"],
    ["guardas", "▤ EFETIVO"],
    ["config", "▦ COMANDO"],
    ["usuarios", "▥ USUÁRIOS"],
  ];
  return (
    <div className="bg-olivaEsc border-b border-linha px-6">
      <div className="max-w-[1100px] mx-auto flex">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-[22px] py-3 text-[13px] font-semibold tracking-[2px] font-mono border-b-[3px] ${
              aba === id
                ? "bg-oliva border-amareloMil text-amareloMil"
                : "border-transparent text-areia"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfigTab({
  inicio,
  setInicio,
  balancear,
  setBalancear,
  onGerar,
  histCount,
  histMsg,
  onImportar,
  onLimpar,
}: {
  inicio: string;
  setInicio: (s: string) => void;
  balancear: boolean;
  setBalancear: (b: boolean) => void;
  onGerar: () => void;
  histCount: number;
  histMsg: string | null;
  onImportar: (file: File, mode: "replace" | "add") => void;
  onLimpar: () => void;
}) {
  return (
    <div className="max-w-[480px]">
      <div className="bg-olivaEsc border border-linha p-6">
        <h2 className="m-0 mb-1 text-base text-amareloMil font-estencil tracking-[2px]">
          ORDEM DE SERVIÇO
        </h2>
        <div className="h-0.5 mb-5 bg-[repeating-linear-gradient(90deg,#d4b942_0_10px,transparent_10px_18px)]" />
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-caqui block mb-1.5 tracking-[2px] font-mono">
              TERÇA-FEIRA INICIAL
            </label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-full bg-preto border border-linha text-caquiClaro px-3 py-2.5 text-sm box-border font-mono"
            />
            <p className="mt-1.5 text-[10px] text-areia font-mono">
              &gt; AJUSTE AUTOMÁTICO PARA TERÇA (NO SERVIDOR)
            </p>
          </div>

          <div className="bg-preto border border-linha px-3 py-2.5">
            <span className="text-[11px] text-areia tracking-wide font-mono">
              PERÍODO:{" "}
            </span>
            <span className="text-[13px] text-amareloMil font-bold font-mono">
              TER → SEG · 07 DIAS
            </span>
          </div>

          <label className="bg-preto border border-dashed border-verdeBrilho px-3 py-3 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={balancear}
              onChange={(e) => setBalancear(e.target.checked)}
              className="mt-0.5 accent-verdeBrilho"
            />
            <span>
              <span className="text-[11px] text-verdeBrilho block tracking-[2px] font-mono">
                ⚖ BALANCEAMENTO POR HISTÓRICO
              </span>
              <span className="text-[10px] text-areia font-mono leading-relaxed">
                &gt; USA AS ESCALAS SALVAS + O HISTÓRICO IMPORTADO. QUEM FEZ MAIS
                GUARDAS ENTRA MENOS VEZES.
              </span>
            </span>
          </label>

          <div className="bg-preto border border-dashed border-areia px-3 py-3">
            <span className="text-[11px] text-areia block mb-1 tracking-[2px] font-mono">
              ↥ IMPORTAR HISTÓRICO (PLANILHA / CSV)
            </span>
            <p className="text-[10px] text-areia font-mono leading-relaxed mb-2.5">
              &gt; SUBA A PLANILHA DA GUARDA DO MÊS (GRADE FUNÇÃO×DIA) OU UMA
              CONTAGEM <span className="text-amareloMil">num ; nome ; guardas</span>.
              O SISTEMA CONTA E AJUSTA OS NÚMEROS PELO EFETIVO ATUAL.
            </p>
            <div className="flex gap-2 flex-wrap">
              <label className="bg-verdeMil text-caquiClaro px-3 py-1.5 text-[11px] font-bold cursor-pointer tracking-wide font-mono">
                SUBSTITUIR
                <input
                  type="file"
                  accept=".csv,.txt,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportar(f, "replace");
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="bg-transparent border border-verdeBrilho text-verdeBrilho px-3 py-1.5 text-[11px] font-bold cursor-pointer tracking-wide font-mono">
                + SOMAR
                <input
                  type="file"
                  accept=".csv,.txt,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportar(f, "add");
                    e.target.value = "";
                  }}
                />
              </label>
              {histCount > 0 && (
                <button
                  onClick={onLimpar}
                  className="bg-transparent border border-vermelho text-vermelho px-3 py-1.5 text-[11px] tracking-wide font-mono"
                >
                  ✕ LIMPAR ({histCount})
                </button>
              )}
            </div>
            {histMsg && (
              <p className="mt-2 text-[11px] text-amareloMil font-mono">
                ✓ {histMsg}
              </p>
            )}
            {histCount > 0 && !histMsg && (
              <p className="mt-2 text-[11px] text-verdeBrilho font-mono">
                ⚖ {histCount} pessoas no histórico importado.
              </p>
            )}
          </div>

          <button
            onClick={onGerar}
            className="bg-amareloMil text-preto py-3.5 text-[15px] font-bold tracking-[2px] font-estencil"
          >
            ⚐ GERAR ESCALA
          </button>
        </div>
      </div>
    </div>
  );
}

function EfetivoTab({
  monitores,
  guardas,
  novoNum,
  novoNome,
  setNovoNum,
  setNovoNome,
  onAdicionar,
  onRemover,
  onToggle,
}: {
  monitores: Person[];
  guardas: Person[];
  novoNum: string;
  novoNome: string;
  setNovoNum: (s: string) => void;
  setNovoNome: (s: string) => void;
  onAdicionar: () => void;
  onRemover: (id: string) => void;
  onToggle: (id: string, available: boolean) => void;
}) {
  const ausentes =
    monitores.filter((m) => !m.available).length +
    guardas.filter((g) => !g.available).length;
  return (
    <div>
      <div className="bg-olivaEsc border border-amareloMil p-5 mb-6">
        <h2 className="m-0 mb-1 text-[15px] text-amareloMil font-estencil tracking-[2px]">
          ◆ MONITORES — CMT GD TG
        </h2>
        <p className="m-0 mb-3.5 text-[11px] text-areia font-mono">
          &gt; HABILITADOS A COMANDAR A GUARDA
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {monitores.map((g) => (
            <Cartao
              key={g.id}
              p={g}
              onRemover={() => onRemover(g.id)}
              onToggle={() => onToggle(g.id, !g.available)}
              destaque
            />
          ))}
        </div>
      </div>

      <div className="bg-olivaEsc border border-linha p-5 mb-5">
        <h2 className="m-0 mb-1 text-[15px] text-caquiClaro font-estencil tracking-[2px]">
          ▣ EFETIVO DE GUARDA
        </h2>
        <p className="m-0 mb-3.5 text-[11px] text-areia font-mono">
          &gt; PERMANÊNCIA E GUARDAS DO TG
        </p>
        <div className="flex gap-2.5 flex-wrap">
          <input
            placeholder="Nº"
            value={novoNum}
            onChange={(e) => setNovoNum(e.target.value)}
            className="w-[90px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          <input
            placeholder="NOME"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdicionar()}
            className="flex-1 min-w-[140px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={onAdicionar}
            className="bg-verdeMil text-caquiClaro px-[18px] py-2 font-bold text-[13px] tracking-wide font-mono"
          >
            + INCLUIR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {guardas.map((g) => (
          <Cartao
            key={g.id}
            p={g}
            onRemover={() => onRemover(g.id)}
            onToggle={() => onToggle(g.id, !g.available)}
          />
        ))}
      </div>
      <p className="text-areia text-[11px] mt-4 font-mono">
        &gt; EFETIVO CADASTRADO: {guardas.length} HOMENS ·{" "}
        <span className={ausentes > 0 ? "text-vermelho" : "text-verdeBrilho"}>
          {ausentes} AUSENTE(S)
        </span>{" "}
        — TOQUE NO ✓/✕ PARA MARCAR PRESENTE/AUSENTE.
      </p>
    </div>
  );
}

function Cartao({
  p,
  onRemover,
  onToggle,
  destaque,
}: {
  p: Person;
  onRemover: () => void;
  onToggle: () => void;
  destaque?: boolean;
}) {
  const ausente = !p.available;
  return (
    <div
      className={`${
        destaque ? "bg-oliva border-amareloMil/40" : "bg-olivaEsc border-linha"
      } border px-3 py-2.5 flex items-center justify-between gap-2 font-mono ${
        ausente ? "opacity-50" : ""
      }`}
    >
      <span className="text-[13px] truncate">
        <span className="text-amareloMil font-bold mr-2">{p.num}</span>
        <span
          className={
            ausente ? "text-areia line-through" : "text-caquiClaro"
          }
        >
          {p.nome}
        </span>
        {ausente && (
          <span className="text-vermelho text-[10px] ml-1.5">AUSENTE</span>
        )}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onToggle}
          title={ausente ? "Marcar presente" : "Marcar ausente (doente/afastado)"}
          className={`text-base leading-none ${
            ausente ? "text-areia" : "text-verdeBrilho"
          }`}
        >
          {ausente ? "✕" : "✓"}
        </button>
        <button
          onClick={onRemover}
          title="Remover do efetivo"
          className="text-vermelho text-base leading-none"
        >
          🗑
        </button>
      </span>
    </div>
  );
}

function EscalaTab({
  dto,
  monitores,
  guardas,
  editando,
  setEditando,
  onEditar,
  onReembaralhar,
  onSalvar,
  salvando,
  msg,
  onIrConfig,
  onHistorico,
  onAditamento,
}: {
  dto: EscalaDTO | null;
  monitores: Person[];
  guardas: Person[];
  editando: Editando;
  setEditando: (e: Editando) => void;
  onEditar: (
    dia: number,
    func: (typeof FUNCOES)[number],
    idx: number,
    p: { num: string; nome: string }
  ) => void;
  onReembaralhar: () => void;
  onSalvar: () => void;
  salvando: boolean;
  msg: string | null;
  onIrConfig: () => void;
  onHistorico: () => void;
  onAditamento: () => void;
}) {
  if (!dto) {
    return (
      <div className="text-center py-16 px-5">
        <div className="text-5xl mb-3">⚐</div>
        <p className="text-caqui text-sm mb-6 tracking-wide font-mono">
          NENHUMA ESCALA EM VIGOR — EMITA A ORDEM DE SERVIÇO
        </p>
        <button
          onClick={onIrConfig}
          className="bg-amareloMil text-preto px-7 py-3 font-bold text-sm tracking-[2px] font-estencil"
        >
          ▦ IR AO COMANDO
        </button>
      </div>
    );
  }

  const { dias, escala } = dto;
  // monitoresCount vem do backend já filtrado por disponibilidade.
  const monitoresDisp = dto.monitoresCount ?? monitores.length;
  const monitorRepete = dias.length > monitoresDisp;

  return (
    <div>
      <div className="flex justify-between items-end mb-4 flex-wrap gap-2.5">
        <div>
          <h2 className="m-0 text-base text-amareloMil font-estencil tracking-[2px]">
            ESCALA EM VIGOR
          </h2>
          <p className="mt-1 text-areia text-[11px] font-mono">
            &gt; TOQUE NO NOME PARA SUBSTITUIR
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BtnAcao onClick={onReembaralhar} variant="outline">
            ⟳ REEMBARALHAR
          </BtnAcao>
          <BtnAcao onClick={onAditamento} variant="amarelo">
            📄 ADITAMENTO
          </BtnAcao>
          <BtnAcao
            onClick={() => exportarPDF(dias, escala)}
            variant="vermelho"
          >
            ⎙ PDF GRADE
          </BtnAcao>
          <BtnAcao
            onClick={() => exportarEscalaCSV(dias, escala)}
            variant="areia"
          >
            ▤ CSV
          </BtnAcao>
          <BtnAcao onClick={onHistorico} variant="verde">
            ↧ HISTÓRICO
          </BtnAcao>
          <BtnAcao onClick={onSalvar} variant="amarelo">
            {salvando ? "SALVANDO…" : "💾 SALVAR"}
          </BtnAcao>
        </div>
      </div>

      {msg && (
        <div className="bg-verdeMil/20 border border-verdeBrilho px-3.5 py-2 mb-4 text-[11px] text-caquiClaro font-mono">
          ✓ {msg}
        </div>
      )}

      {dto.balanceado && (
        <div className="bg-verdeMil/20 border border-verdeBrilho px-3.5 py-2 mb-4 text-[11px] text-caquiClaro font-mono">
          ⚖ BALANCEAMENTO ATIVO — SORTEIO AJUSTADO PELO HISTÓRICO SALVO.
        </div>
      )}

      {monitorRepete && (
        <div className="bg-vermelho/20 border border-vermelho px-3.5 py-2.5 mb-4 text-xs text-caquiClaro font-mono">
          ⚠ ATENÇÃO: {dias.length} DIAS PARA {monitoresDisp} MONITORES
          DISPONÍVEIS — HAVERÁ REPETIÇÃO NO COMANDO.
        </div>
      )}

      <div
        className="border border-linha"
        style={{ overflowX: editando ? "visible" : "auto" }}
      >
        <table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr>
              <th className="bg-preto px-3.5 py-2.5 text-left text-[11px] text-amareloMil tracking-[2px] border-b-2 border-amareloMil w-40 font-mono">
                FUNÇÃO
              </th>
              {dias.map((dia) => (
                <th
                  key={dia}
                  className="bg-preto px-2 py-2.5 text-center text-[11px] text-caquiClaro tracking-wide border-b-2 border-amareloMil border-l border-linha whitespace-nowrap font-mono"
                >
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FUNCOES.map((func, fi) => {
              const cor = COR_FUNC[func];
              return (
                <tr
                  key={func}
                  className={fi % 2 === 0 ? "bg-oliva" : "bg-olivaEsc"}
                >
                  <td
                    className="px-3.5 py-3 font-bold text-xs align-top tracking-wide font-mono"
                    style={{ borderLeft: `4px solid ${cor}`, color: cor }}
                  >
                    {func.toUpperCase()}
                  </td>
                  {dias.map((_, dia) => (
                    <td
                      key={dia}
                      className="p-1.5 align-top border-l border-linha"
                    >
                      {(escala[dia]?.[func] || []).map((g, idx) => {
                        const esta =
                          editando?.dia === dia &&
                          editando?.func === func &&
                          editando?.idx === idx;
                        return esta ? (
                          <SeletorPessoa
                            key={idx}
                            atual={g}
                            opcoes={func === "Cmt Gd TG" ? monitores : guardas}
                            onSelecionar={(p) => onEditar(dia, func, idx, p)}
                            onCancelar={() => setEditando(null)}
                          />
                        ) : (
                          <div
                            key={idx}
                            onClick={() => setEditando({ dia, func, idx })}
                            title="Substituir"
                            className="bg-preto px-2 py-1 mb-1 cursor-pointer text-[11px] flex gap-1.5 items-center font-mono hover:bg-olivaClaro"
                            style={{
                              border: `1px solid ${cor}44`,
                              borderLeft: `2px solid ${cor}`,
                            }}
                          >
                            <span className="text-amareloMil font-bold">
                              {g.num}
                            </span>
                            <span className="text-caquiClaro">{g.nome}</span>
                          </div>
                        );
                      })}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 flex-wrap mt-4">
        {FUNCOES.map((f) => (
          <div
            key={f}
            className="flex items-center gap-1.5 text-[10px] text-caqui font-mono"
          >
            <div className="w-3 h-3" style={{ background: COR_FUNC[f] }} />
            {f.toUpperCase()} ({VAGAS[f]})
          </div>
        ))}
      </div>
    </div>
  );
}

function UsuariosTab({ onErro }: { onErro: (e: string | null) => void }) {
  const [usuarios, setUsuarios] = useState<import("./types").Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setUsuarios(await api.getUsers());
    } catch (e) {
      onErro((e as Error).message);
    }
  }, [onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = async () => {
    onErro(null);
    setMsg(null);
    try {
      await api.addUser(nome.trim(), senha);
      setMsg(`Usuário "${nome.trim().toLowerCase()}" criado.`);
      setNome("");
      setSenha("");
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  const remover = async (id: string, username: string) => {
    onErro(null);
    if (!confirm(`Remover o usuário "${username}"?`)) return;
    try {
      await api.removeUser(id);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  const redefinir = async (id: string, username: string) => {
    const nova = prompt(`Nova senha para "${username}" (mín. 4):`);
    if (!nova) return;
    try {
      await api.resetUserPassword(id, nova);
      setMsg(`Senha de "${username}" redefinida.`);
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  return (
    <div className="max-w-[560px]">
      <div className="bg-olivaEsc border border-amareloMil p-5 mb-5">
        <h2 className="m-0 mb-1 text-[15px] text-amareloMil font-estencil tracking-[2px]">
          ▥ USUÁRIOS DE ACESSO
        </h2>
        <p className="m-0 mb-3.5 text-[11px] text-areia font-mono">
          &gt; QUEM PODE ENTRAR NO SISTEMA. SENHAS GUARDADAS CRIPTOGRAFADAS.
        </p>
        <div className="flex gap-2.5 flex-wrap">
          <input
            placeholder="usuário"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="flex-1 min-w-[120px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          <input
            type="password"
            placeholder="senha (mín. 4)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className="flex-1 min-w-[120px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={adicionar}
            className="bg-verdeMil text-caquiClaro px-[18px] py-2 font-bold text-[13px] tracking-wide font-mono"
          >
            + CRIAR
          </button>
        </div>
        {msg && (
          <p className="mt-2 text-[11px] text-amareloMil font-mono">✓ {msg}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="bg-olivaEsc border border-linha px-3 py-2.5 flex items-center justify-between font-mono"
          >
            <span className="text-[13px] text-caquiClaro">
              <span className="text-amareloMil mr-2">◉</span>
              {u.username}
            </span>
            <span className="flex items-center gap-2">
              <button
                onClick={() => redefinir(u.id, u.username)}
                className="text-[10px] text-areia border border-linha px-2 py-0.5 hover:text-amareloMil"
              >
                ⟳ SENHA
              </button>
              <button
                onClick={() => remover(u.id, u.username)}
                className="text-vermelho text-base leading-none"
                title="Remover"
              >
                🗑
              </button>
            </span>
          </div>
        ))}
      </div>
      <p className="text-areia text-[11px] mt-4 font-mono">
        &gt; {usuarios.length} USUÁRIO(S) ATIVO(S).
      </p>
    </div>
  );
}

function BtnAcao({
  onClick,
  children,
  variant,
}: {
  onClick: () => void;
  children: ReactNode;
  variant: "outline" | "vermelho" | "areia" | "verde" | "amarelo";
}) {
  const styles: Record<string, string> = {
    outline: "bg-transparent border border-amareloMil text-amareloMil",
    vermelho: "bg-vermelho text-caquiClaro",
    areia: "bg-areia text-preto",
    verde: "bg-verdeMil text-caquiClaro",
    amarelo: "bg-amareloMil text-preto",
  };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-bold text-xs tracking-wide font-mono ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
