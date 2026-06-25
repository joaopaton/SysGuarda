import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import {
  COR_FUNC,
  FUNCOES,
  VAGAS,
  type DiaEscala,
  type EscalaDTO,
  type MeUser,
  type Person,
  type Turma,
} from "./types";
import { SeletorPessoa } from "./components/SeletorPessoa";
import { AditamentoModal } from "./components/AditamentoModal";
import { exportarEscalaCSV, exportarHistoricoCSV, exportarPDF } from "./export";
import { parseEscalaCsv } from "./parseEscalaCsv";
import {
  Star,
  LogOut,
  CalendarDays,
  Users,
  Settings,
  UserCog,
  Scale,
  Upload,
  Download,
  Flag,
  FileText,
  FileSpreadsheet,
  Printer,
  Shuffle,
  Save,
  Plus,
  Check,
  X,
  Trash2,
  AlertTriangle,
  RotateCw,
  Gem,
  CircleUserRound,
  Archive,
  FolderOpen,
  LayoutDashboard,
  ChevronRight,
  Clock,
  Lock,
  Unlock,
} from "lucide-react";

type Aba =
  | "painel"
  | "escala"
  | "guardas"
  | "config"
  | "usuarios"
  | "salvas"
  | "horas";
type Editando = { dia: number; func: (typeof FUNCOES)[number]; idx: number } | null;

function proximaTercaISO(): string {
  const d = new Date();
  const diff = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export default function App({
  onLogout,
  user,
}: {
  onLogout: () => void;
  user: MeUser | null;
}) {
  const isSuper = user?.role === "superadmin";
  const [aba, setAba] = useState<Aba>(isSuper ? "painel" : "escala");
  const [monitores, setMonitores] = useState<Person[]>([]);
  const [guardas, setGuardas] = useState<Person[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSel, setTurmaSel] = useState<string>(user?.turma?.id ?? "");
  // Filtro global do Comandante: "" = todas as turmas.
  const [turmaFoco, setTurmaFoco] = useState<string>("");
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
  // id da escala salva atualmente aberta (null = escala nova, ainda não salva).
  const [scheduleId, setScheduleId] = useState<string | null>(null);

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
    api.getTurmas().then(setTurmas).catch(() => {});
  }, [carregarEfetivo, carregarHistorico]);

  // Turma a usar ao gerar/salvar: a escolhida, ou a da escala aberta, ou a do usuário.
  const turmaAtiva = () => dto?.turmaId ?? turmaSel ?? user?.turma?.id ?? null;

  // Filtro global do Comandante: foca uma turma (ou todas) em todas as abas.
  const aplicarFoco = useCallback((id: string) => {
    setTurmaFoco(id);
    setTurmaSel(id); // a geração já vem com a turma em foco
  }, []);

  const gerar = useCallback(async () => {
    setErro(null);
    setMsg(null);
    try {
      const turmaId = turmaSel || user?.turma?.id || null;
      const novo = await api.generate(inicio, balancear, turmaId);
      setDto(novo);
      if (novo.turmaId) setTurmaSel(novo.turmaId);
      setScheduleId(null); // escala nova, ainda não salva
      setAba("escala");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [inicio, balancear, turmaSel, user]);

  // Importa uma escala em CSV e já abre o Aditamento baseado nela.
  const importarEscalaCsv = useCallback(
    async (file: File) => {
      setErro(null);
      setMsg(null);
      try {
        const texto = await file.text();
        const imp = parseEscalaCsv(texto);
        const turmaId = turmaSel || user?.turma?.id || null;
        setDto({ ...imp, balanceado: false, turmaId });
        setScheduleId(null); // escala nova, ainda não salva
        setAba("escala");
        setShowAditamento(true);
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [turmaSel, user]
  );

  // Abre uma escala salva no editor.
  const abrirEscala = useCallback(async (id: string) => {
    setErro(null);
    setMsg(null);
    try {
      const e = await api.get(id);
      setDto(e);
      setScheduleId(id);
      setAba("escala");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

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

  const adicionarGuarda = async (turmaId: string | null) => {
    if (!novoNome.trim()) return;
    try {
      await api.addPerson({
        num: novoNum.trim() || "---",
        nome: novoNome.trim().toUpperCase(),
        isMonitor: false,
        turmaId: isSuper ? turmaId : user?.turma?.id ?? null,
      });
      setNovoNum("");
      setNovoNome("");
      carregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const definirTurma = async (id: string, turmaId: string | null) => {
    try {
      await api.setTurma(id, turmaId);
      carregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const atribuirTurmaEmMassa = async (ids: string[], turmaId: string | null) => {
    try {
      await api.atribuirTurma(ids, turmaId);
      carregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const importarTurmasCsv = async (file: File) => {
    const texto = await file.text();
    const r = await api.importarTurmas(texto);
    carregarEfetivo();
    return r;
  };

  const adicionarMonitor = async (
    num: string,
    nome: string,
    turmaId: string | null
  ) => {
    if (!nome.trim()) return;
    try {
      await api.addPerson({
        num: num.trim() || "---",
        nome: nome.trim().toUpperCase(),
        isMonitor: true,
        turmaId: isSuper ? turmaId : user?.turma?.id ?? null,
      });
      carregarEfetivo();
    } catch (e) {
      setErro((e as Error).message);
    }
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
    setErro(null);
    try {
      const turmaId = turmaAtiva();
      if (scheduleId) {
        await api.update(scheduleId, dto.startDate, dto.escala, turmaId);
        setMsg("Escala atualizada no banco.");
      } else {
        const r = await api.save(dto.startDate, dto.escala, turmaId);
        setScheduleId(r.id);
        setMsg("Escala salva no banco — já entra no balanceamento futuro.");
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const fecharGuarda = async () => {
    if (!dto || !scheduleId) return;
    setErro(null);
    setMsg(null);
    try {
      await api.fecharEscala(scheduleId);
      setDto((d) => (d ? { ...d, status: "FECHADA" } : d));
      setMsg("Guarda FECHADA — horas contabilizadas no relatório.");
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const reabrirGuarda = async () => {
    if (!dto || !scheduleId) return;
    setErro(null);
    try {
      await api.reabrirEscala(scheduleId);
      setDto((d) => (d ? { ...d, status: "ABERTA" } : d));
      setMsg("Guarda reaberta para edição.");
    } catch (e) {
      setErro((e as Error).message);
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
      <Header onLogout={onLogout} user={user} />
      <Tabs aba={aba} setAba={setAba} isSuper={isSuper} />
      {isSuper && aba !== "painel" && aba !== "usuarios" && (
        <FiltroTurma turmas={turmas} foco={turmaFoco} onFoco={aplicarFoco} />
      )}

      <div className="max-w-[1100px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {erro && (
          <div className="mb-4 border border-vermelho bg-vermelho/20 text-caquiClaro px-4 py-2 text-xs font-mono flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {erro}
          </div>
        )}

        {aba === "painel" && isSuper && (
          <PainelTab
            onAbrirTurma={(id) => {
              aplicarFoco(id);
              setAba("guardas");
            }}
            onGerarTurma={(id) => {
              aplicarFoco(id);
              setAba("config");
            }}
            onErro={setErro}
          />
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
            onImportarEscala={importarEscalaCsv}
            isSuper={isSuper}
            turmas={turmas}
            turmaSel={turmaSel}
            setTurmaSel={setTurmaSel}
            user={user}
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
            onAdicionarMonitor={adicionarMonitor}
            onRemover={removerPessoa}
            onToggle={alternarDisponibilidade}
            onDefinirTurma={definirTurma}
            onAtribuirEmMassa={atribuirTurmaEmMassa}
            onImportarTurmas={importarTurmasCsv}
            isSuper={isSuper}
            turmas={turmas}
            turmaFoco={turmaFoco}
            user={user}
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
            onImportarEscala={importarEscalaCsv}
            onVerSalvas={() => setAba("salvas")}
            salvoId={scheduleId}
            onFechar={fecharGuarda}
            onReabrir={reabrirGuarda}
          />
        )}

        {aba === "horas" && (
          <HorasTab
            isSuper={isSuper}
            turmaFoco={turmaFoco}
            onErro={setErro}
          />
        )}

        {aba === "salvas" && (
          <SalvasTab
            currentId={scheduleId}
            onAbrir={abrirEscala}
            onErro={setErro}
            turmas={turmas}
            turmaFoco={turmaFoco}
          />
        )}

        {aba === "usuarios" && isSuper && (
          <UsuariosTab onErro={setErro} turmas={turmas} />
        )}
      </div>

      {showAditamento && dto && (
        <AditamentoModal
          startDate={dto.startDate}
          dias={dto.dias}
          escala={dto.escala}
          onClose={() => setShowAditamento(false)}
          isSuper={isSuper}
        />
      )}

      <div className="text-center py-5 text-[10px] text-areia font-mono tracking-[2px]">
        ▬▬▬ DOCUMENTO SUJEITO A ALTERAÇÃO ▬▬▬
      </div>
    </div>
  );
}

function Header({
  onLogout,
  user,
}: {
  onLogout: () => void;
  user: MeUser | null;
}) {
  const papel =
    user?.role === "superadmin"
      ? "COMANDANTE"
      : user?.role === "monitor"
      ? "MONITOR"
      : "INSTRUTOR";
  const turmaLbl = user?.turma
    ? `${user.turma.codigo} · ${user.turma.apelido}`
    : null;
  return (
    <div className="bg-olivaEsc border-b-[3px] border-amareloMil px-4 sm:px-6 py-3 sm:py-[18px]">
      <div className="max-w-[1100px] mx-auto flex items-center gap-3 sm:gap-4">
        <div className="w-11 h-11 sm:w-[52px] sm:h-[52px] border-2 border-amareloMil rounded-full flex items-center justify-center shrink-0 bg-oliva text-amareloMil">
          <Star size={26} className="fill-amareloMil" />
        </div>
        <div className="min-w-0">
          <h1 className="m-0 text-lg sm:text-2xl font-bold text-caquiClaro font-estencil tracking-[2px] leading-tight">
            ESCALA DE SERVIÇO · T2
          </h1>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-amareloMil tracking-[2px] sm:tracking-[4px] font-mono truncate">
            // PREVISÃO OPERACIONAL DE GUARDA
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {user && (
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-[11px] text-caquiClaro font-mono">
                {user.username}{" "}
                <span className="text-areia">· {papel}</span>
              </div>
              {turmaLbl && (
                <div className="text-[10px] text-amareloMil font-mono tracking-wide">
                  {turmaLbl}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onLogout}
            title="Sair"
            className="text-[10px] text-amareloMil border border-amareloMil/50 px-2 py-1 font-mono tracking-wide hover:bg-amareloMil hover:text-preto inline-flex items-center gap-1"
          >
            <LogOut size={12} /> SAIR
          </button>
        </div>
      </div>
    </div>
  );
}

function Tabs({
  aba,
  setAba,
  isSuper,
}: {
  aba: Aba;
  setAba: (a: Aba) => void;
  isSuper: boolean;
}) {
  const tabs: [Aba, string, typeof CalendarDays][] = [
    ...(isSuper
      ? ([["painel", "PAINEL", LayoutDashboard]] as [Aba, string, typeof CalendarDays][])
      : []),
    ["escala", "ESCALA", CalendarDays],
    ["salvas", "SALVAS", Archive],
    ["horas", "HORAS", Clock],
    ["guardas", "EFETIVO", Users],
    ["config", "COMANDO", Settings],
    ...(isSuper
      ? ([["usuarios", "USUÁRIOS", UserCog]] as [Aba, string, typeof CalendarDays][])
      : []),
  ];
  return (
    <div className="bg-olivaEsc border-b border-linha px-2 sm:px-6">
      <div className="max-w-[1100px] mx-auto flex overflow-x-auto">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-3 sm:px-[22px] py-3 text-[12px] sm:text-[13px] font-semibold tracking-[1px] sm:tracking-[2px] font-mono border-b-[3px] whitespace-nowrap inline-flex items-center gap-1.5 ${
              aba === id
                ? "bg-oliva border-amareloMil text-amareloMil"
                : "border-transparent text-areia"
            }`}
          >
            <Icon size={15} /> {label}
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
  onImportarEscala,
  isSuper,
  turmas,
  turmaSel,
  setTurmaSel,
  user,
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
  onImportarEscala: (file: File) => void;
  isSuper: boolean;
  turmas: Turma[];
  turmaSel: string;
  setTurmaSel: (s: string) => void;
  user: MeUser | null;
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
              TURMA DA SEMANA
            </label>
            {isSuper ? (
              <select
                value={turmaSel}
                onChange={(e) => setTurmaSel(e.target.value)}
                className="w-full bg-preto border border-linha text-caquiClaro px-3 py-2.5 text-sm box-border font-mono"
              >
                <option value="">— AUTOMÁTICO (RODÍZIO T1→T4) —</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} · {t.apelido}
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-preto border border-linha px-3 py-2.5 text-[13px] text-amareloMil font-bold font-mono">
                {user?.turma
                  ? `${user.turma.codigo} · ${user.turma.apelido}`
                  : "— SEM TURMA DEFINIDA —"}
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-areia font-mono">
              &gt; A GUARDA DESTA SEMANA É TIRADA POR ESTA TURMA.
            </p>
          </div>

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
              <span className="text-[11px] text-verdeBrilho tracking-[2px] font-mono inline-flex items-center gap-1.5">
                <Scale size={13} /> BALANCEAMENTO POR HISTÓRICO
              </span>
              <span className="text-[10px] text-areia font-mono leading-relaxed">
                &gt; USA AS ESCALAS SALVAS + O HISTÓRICO IMPORTADO. QUEM FEZ MAIS
                GUARDAS ENTRA MENOS VEZES.
              </span>
            </span>
          </label>

          {isSuper && (
          <div className="bg-preto border border-dashed border-areia px-3 py-3">
            <span className="text-[11px] text-areia mb-1 tracking-[2px] font-mono flex items-center gap-1.5">
              <Upload size={13} /> IMPORTAR HISTÓRICO (PLANILHA / CSV)
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
                  className="bg-transparent border border-vermelho text-vermelho px-3 py-1.5 text-[11px] tracking-wide font-mono inline-flex items-center gap-1"
                >
                  <X size={12} /> LIMPAR ({histCount})
                </button>
              )}
            </div>
            {histMsg && (
              <p className="mt-2 text-[11px] text-amareloMil font-mono flex items-center gap-1.5">
                <Check size={12} /> {histMsg}
              </p>
            )}
            {histCount > 0 && !histMsg && (
              <p className="mt-2 text-[11px] text-verdeBrilho font-mono flex items-center gap-1.5">
                <Scale size={12} /> {histCount} pessoas no histórico importado.
              </p>
            )}
          </div>
          )}

          <button
            onClick={onGerar}
            className="bg-amareloMil text-preto py-3.5 text-[15px] font-bold tracking-[2px] font-estencil inline-flex items-center justify-center gap-2"
          >
            <Flag size={18} /> GERAR ESCALA
          </button>

          <div className="bg-preto border border-dashed border-amareloMil px-3 py-3">
            <span className="text-[11px] text-amareloMil mb-1 tracking-[2px] font-mono flex items-center gap-1.5">
              <FileText size={13} /> ADITAMENTO A PARTIR DE CSV
            </span>
            <p className="text-[10px] text-areia font-mono leading-relaxed mb-2.5">
              &gt; SUBA UMA ESCALA EM CSV (GRADE FUNÇÃO×DIA, CÉLULAS{" "}
              <span className="text-amareloMil">NUM NOME</span> — O MESMO FORMATO
              DO BOTÃO <span className="text-amareloMil">CSV</span> DA ESCALA). ABRE
              O ADITAMENTO JÁ PREENCHIDO.
            </p>
            <label className="inline-flex items-center gap-1.5 bg-amareloMil text-preto px-3 py-1.5 text-[11px] font-bold cursor-pointer tracking-wide font-mono">
              <Upload size={13} /> IMPORTAR ESCALA (CSV)
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportarEscala(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function EfetivoTab({
  monitores: monitoresAll,
  guardas: guardasAll,
  novoNum,
  novoNome,
  setNovoNum,
  setNovoNome,
  onAdicionar,
  onAdicionarMonitor,
  onRemover,
  onToggle,
  onDefinirTurma,
  onAtribuirEmMassa,
  onImportarTurmas,
  isSuper,
  turmas,
  turmaFoco,
  user,
}: {
  monitores: Person[];
  guardas: Person[];
  novoNum: string;
  novoNome: string;
  setNovoNum: (s: string) => void;
  setNovoNome: (s: string) => void;
  onAdicionar: (turmaId: string | null) => void;
  onAdicionarMonitor: (num: string, nome: string, turmaId: string | null) => void;
  onRemover: (id: string) => void;
  onToggle: (id: string, available: boolean) => void;
  onDefinirTurma: (id: string, turmaId: string | null) => void;
  onAtribuirEmMassa: (ids: string[], turmaId: string | null) => void;
  onImportarTurmas: (file: File) => Promise<{
    atualizadas: number;
    naoEncontrados: string[];
    turmaInvalida: string[];
  }>;
  isSuper: boolean;
  turmas: Turma[];
  turmaFoco: string;
  user: MeUser | null;
}) {
  // Filtro global do Comandante (Todas/T1..T4).
  const monitores = turmaFoco
    ? monitoresAll.filter((p) => p.turmaId === turmaFoco)
    : monitoresAll;
  const guardas = turmaFoco
    ? guardasAll.filter((p) => p.turmaId === turmaFoco)
    : guardasAll;
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const importarTurmas = async (file: File) => {
    setImpMsg(null);
    try {
      const r = await onImportarTurmas(file);
      const extra =
        r.naoEncontrados.length + r.turmaInvalida.length > 0
          ? ` · ${r.naoEncontrados.length} não encontrado(s), ${r.turmaInvalida.length} turma inválida`
          : "";
      setImpMsg(`${r.atualizadas} pessoa(s) atribuída(s)${extra}.`);
    } catch (e) {
      setImpMsg(`Erro: ${(e as Error).message}`);
    }
  };
  const [novaTurma, setNovaTurma] = useState("");
  const [monNum, setMonNum] = useState("");
  const [monNome, setMonNome] = useState("");
  const [monTurma, setMonTurma] = useState("");
  const addMonitor = () => {
    onAdicionarMonitor(monNum, monNome, monTurma || null);
    setMonNum("");
    setMonNome("");
  };

  // Seleção em massa (só Comandante).
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkTurma, setBulkTurma] = useState("");
  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const todos = [...monitores, ...guardas];
  const selecionarTodos = () => setSel(new Set(todos.map((p) => p.id)));
  const limparSel = () => setSel(new Set());
  const aplicarBulk = () => {
    if (sel.size === 0) return;
    onAtribuirEmMassa([...sel], bulkTurma || null);
    limparSel();
  };
  const selProps = (p: Person) =>
    isSuper
      ? { selecionado: sel.has(p.id), onToggleSel: () => toggleSel(p.id) }
      : {};
  const ausentes =
    monitores.filter((m) => !m.available).length +
    guardas.filter((g) => !g.available).length;
  return (
    <div>
      {isSuper && (
        <div className="bg-preto border border-dashed border-amareloMil px-3 py-3 mb-5 flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="text-amareloMil tracking-wide">
            ATRIBUIÇÃO EM MASSA:
          </span>
          <span className="text-areia">{sel.size} selecionado(s)</span>
          <button
            onClick={selecionarTodos}
            className="border border-linha text-caqui px-2 py-1 hover:text-amareloMil"
          >
            TODOS ({todos.length})
          </button>
          <button
            onClick={limparSel}
            className="border border-linha text-areia px-2 py-1 hover:text-vermelho"
          >
            LIMPAR
          </button>
          <span className="text-areia ml-auto">→ MOVER PARA</span>
          <select
            value={bulkTurma}
            onChange={(e) => setBulkTurma(e.target.value)}
            className="bg-preto border border-linha text-caquiClaro px-2 py-1 font-mono"
          >
            <option value="">— sem turma —</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} {t.apelido}
              </option>
            ))}
          </select>
          <button
            onClick={aplicarBulk}
            disabled={sel.size === 0}
            className="bg-amareloMil text-preto px-3 py-1 font-bold tracking-wide disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Check size={13} /> ATRIBUIR
          </button>
          <span className="w-full border-t border-linha/60 my-1" />
          <span className="text-areia">
            OU IMPORTAR CSV{" "}
            <span className="text-amareloMil">num ; nome ; turma</span>:
          </span>
          <label className="border border-verdeBrilho text-verdeBrilho px-2 py-1 cursor-pointer inline-flex items-center gap-1 hover:bg-verdeMil hover:text-caquiClaro">
            <Upload size={12} /> IMPORTAR TURMAS
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarTurmas(f);
                e.target.value = "";
              }}
            />
          </label>
          {impMsg && (
            <span className="w-full text-amareloMil mt-1">✓ {impMsg}</span>
          )}
        </div>
      )}

      <div className="bg-olivaEsc border border-amareloMil p-5 mb-6">
        <h2 className="m-0 mb-1 text-[15px] text-amareloMil font-estencil tracking-[2px] flex items-center gap-2">
          <Gem size={16} /> MONITORES — CMT GD TG
          {!isSuper && user?.turma && (
            <span className="text-[11px] text-amareloMil font-mono">
              · {user.turma.codigo} {user.turma.apelido}
            </span>
          )}
        </h2>
        <p className="m-0 mb-3.5 text-[11px] text-areia font-mono">
          &gt; HABILITADOS A COMANDAR A GUARDA (POR TURMA)
        </p>
        <div className="flex gap-2.5 flex-wrap mb-3.5">
          <input
            placeholder="Nº"
            value={monNum}
            onChange={(e) => setMonNum(e.target.value)}
            className="w-[90px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          <input
            placeholder="NOME DO MONITOR"
            value={monNome}
            onChange={(e) => setMonNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMonitor()}
            className="flex-1 min-w-[140px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          {isSuper && (
            <select
              value={monTurma}
              onChange={(e) => setMonTurma(e.target.value)}
              className="bg-preto border border-linha text-caquiClaro px-2 py-2 text-sm font-mono"
            >
              <option value="">— turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} {t.apelido}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={addMonitor}
            className="bg-amareloMil text-preto px-[18px] py-2 font-bold text-[13px] tracking-wide font-mono inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> MONITOR
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
          {monitores.map((g) => (
            <Cartao
              key={g.id}
              p={g}
              onRemover={() => onRemover(g.id)}
              onToggle={() => onToggle(g.id, !g.available)}
              isSuper={isSuper}
              turmas={turmas}
              onDefinirTurma={onDefinirTurma}
              destaque
              {...selProps(g)}
            />
          ))}
        </div>
      </div>

      <div className="bg-olivaEsc border border-linha p-5 mb-5">
        <h2 className="m-0 mb-1 text-[15px] text-caquiClaro font-estencil tracking-[2px] flex items-center gap-2">
          <Users size={16} /> EFETIVO DE GUARDA
          {!isSuper && user?.turma && (
            <span className="text-[11px] text-amareloMil font-mono">
              · {user.turma.codigo} {user.turma.apelido}
            </span>
          )}
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
            onKeyDown={(e) => e.key === "Enter" && onAdicionar(novaTurma || null)}
            className="flex-1 min-w-[140px] bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono"
          />
          {isSuper && (
            <select
              value={novaTurma}
              onChange={(e) => setNovaTurma(e.target.value)}
              className="bg-preto border border-linha text-caquiClaro px-2 py-2 text-sm font-mono"
            >
              <option value="">— turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} {t.apelido}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => onAdicionar(novaTurma || null)}
            className="bg-verdeMil text-caquiClaro px-[18px] py-2 font-bold text-[13px] tracking-wide font-mono inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> INCLUIR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
        {guardas.map((g) => (
          <Cartao
            key={g.id}
            p={g}
            onRemover={() => onRemover(g.id)}
            onToggle={() => onToggle(g.id, !g.available)}
            isSuper={isSuper}
            turmas={turmas}
            onDefinirTurma={onDefinirTurma}
            {...selProps(g)}
          />
        ))}
      </div>
      <p className="text-areia text-[11px] mt-4 font-mono">
        &gt; EFETIVO CADASTRADO: {guardas.length} HOMENS ·{" "}
        <span className={ausentes > 0 ? "text-vermelho" : "text-verdeBrilho"}>
          {ausentes} AUSENTE(S)
        </span>{" "}
        — TOQUE NO{" "}
        <Check size={12} className="inline align-[-2px] text-verdeBrilho" />/
        <X size={12} className="inline align-[-2px] text-areia" /> PARA MARCAR
        PRESENTE/AUSENTE.
      </p>
    </div>
  );
}

function Cartao({
  p,
  onRemover,
  onToggle,
  destaque,
  isSuper,
  turmas,
  onDefinirTurma,
  selecionado,
  onToggleSel,
}: {
  p: Person;
  onRemover: () => void;
  onToggle: () => void;
  destaque?: boolean;
  isSuper?: boolean;
  turmas?: Turma[];
  onDefinirTurma?: (id: string, turmaId: string | null) => void;
  selecionado?: boolean;
  onToggleSel?: () => void;
}) {
  const ausente = !p.available;
  return (
    <div
      className={`${
        destaque ? "bg-oliva border-amareloMil/40" : "bg-olivaEsc border-linha"
      } border px-3 py-2.5 font-mono ${ausente ? "opacity-50" : ""} ${
        selecionado ? "ring-1 ring-amareloMil" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] truncate flex items-center">
          {onToggleSel && (
            <input
              type="checkbox"
              checked={!!selecionado}
              onChange={onToggleSel}
              className="mr-2 accent-amareloMil shrink-0"
            />
          )}
          <span className="text-amareloMil font-bold mr-2">{p.num}</span>
          <span
            className={ausente ? "text-areia line-through" : "text-caquiClaro"}
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
            title={
              ausente ? "Marcar presente" : "Marcar ausente (doente/afastado)"
            }
            className={`leading-none ${
              ausente ? "text-areia" : "text-verdeBrilho"
            }`}
          >
            {ausente ? <X size={16} /> : <Check size={16} />}
          </button>
          <button
            onClick={onRemover}
            title="Remover do efetivo"
            className="text-vermelho leading-none"
          >
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      {(
        <div className="mt-1.5 text-[10px]">
          {isSuper && turmas && onDefinirTurma ? (
            <select
              value={p.turmaId ?? ""}
              onChange={(e) => onDefinirTurma(p.id, e.target.value || null)}
              className="w-full bg-preto border border-linha text-areia px-1.5 py-1 text-[10px] font-mono"
            >
              <option value="">— sem turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} {t.apelido}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-areia">
              {p.turma ? `${p.turma.codigo} · ${p.turma.apelido}` : "sem turma"}
            </span>
          )}
        </div>
      )}
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
  onImportarEscala,
  onVerSalvas,
  salvoId,
  onFechar,
  onReabrir,
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
  onImportarEscala: (file: File) => void;
  onVerSalvas: () => void;
  salvoId: string | null;
  onFechar: () => void;
  onReabrir: () => void;
}) {
  if (!dto) {
    return (
      <div className="text-center py-16 px-5">
        <Flag size={48} className="mx-auto mb-3 text-amareloMil" />
        <p className="text-caqui text-sm mb-6 tracking-wide font-mono">
          NENHUMA ESCALA EM VIGOR — EMITA A ORDEM DE SERVIÇO
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={onIrConfig}
            className="w-full sm:w-auto bg-amareloMil text-preto px-7 py-3 font-bold text-sm tracking-[2px] font-estencil inline-flex items-center justify-center gap-2"
          >
            <Settings size={16} /> IR AO COMANDO
          </button>
          <button
            onClick={onVerSalvas}
            className="w-full sm:w-auto bg-transparent border border-amareloMil text-amareloMil px-7 py-3 font-bold text-sm tracking-[2px] font-mono inline-flex items-center justify-center gap-2"
          >
            <Archive size={16} /> ESCALAS SALVAS
          </button>
          <label className="w-full sm:w-auto bg-transparent border border-amareloMil text-amareloMil px-7 py-3 font-bold text-sm tracking-[2px] font-mono cursor-pointer inline-flex items-center justify-center gap-2">
            <Upload size={16} /> ADITAMENTO VIA CSV
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportarEscala(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  const { dias, escala } = dto;
  // monitoresCount vem do backend já filtrado por disponibilidade.
  const monitoresDisp = dto.monitoresCount ?? monitores.length;
  const monitorRepete = dias.length > monitoresDisp;
  const fechada = dto.status === "FECHADA";

  return (
    <div>
      <div className="flex justify-between items-end mb-4 flex-wrap gap-2.5">
        <div>
          <h2 className="m-0 text-base text-amareloMil font-estencil tracking-[2px] flex items-center gap-2 flex-wrap">
            ESCALA EM VIGOR
            {dto.turma && (
              <span className="text-[11px] bg-amareloMil text-preto px-2 py-0.5 tracking-wide font-mono">
                {dto.turma.codigo} · {dto.turma.apelido}
              </span>
            )}
            {fechada && (
              <span className="text-[11px] bg-verdeMil text-caquiClaro px-2 py-0.5 tracking-wide font-mono inline-flex items-center gap-1">
                <Lock size={11} /> FECHADA
              </span>
            )}
          </h2>
          <p className="mt-1 text-areia text-[11px] font-mono">
            {fechada ? (
              <span className="text-verdeBrilho inline-flex items-center gap-1.5">
                <Lock size={12} /> GUARDA FECHADA · HORAS CONTABILIZADAS ·
                SOMENTE LEITURA
              </span>
            ) : salvoId ? (
              <span className="text-verdeBrilho inline-flex items-center gap-1.5">
                <Archive size={12} /> EDITANDO ESCALA SALVA · &gt; TOQUE NO NOME
                PARA SUBSTITUIR
              </span>
            ) : (
              <>&gt; TOQUE NO NOME PARA SUBSTITUIR</>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BtnAcao onClick={onVerSalvas} variant="outline">
            <Archive size={14} /> SALVAS
          </BtnAcao>
          {!fechada && (
            <BtnAcao onClick={onReembaralhar} variant="outline">
              <Shuffle size={14} /> REEMBARALHAR
            </BtnAcao>
          )}
          <BtnAcao onClick={onAditamento} variant="amarelo">
            <FileText size={14} /> ADITAMENTO
          </BtnAcao>
          <BtnAcao
            onClick={() => exportarPDF(dias, escala)}
            variant="vermelho"
          >
            <Printer size={14} /> PDF GRADE
          </BtnAcao>
          <BtnAcao
            onClick={() => exportarEscalaCSV(dias, escala)}
            variant="areia"
          >
            <FileSpreadsheet size={14} /> CSV
          </BtnAcao>
          <BtnAcao onClick={onHistorico} variant="verde">
            <Download size={14} /> HISTÓRICO
          </BtnAcao>
          {!fechada && (
            <BtnAcao onClick={onSalvar} variant="amarelo">
              <Save size={14} />{" "}
              {salvando ? "SALVANDO…" : salvoId ? "ATUALIZAR" : "SALVAR"}
            </BtnAcao>
          )}
          {salvoId && !fechada && (
            <BtnAcao onClick={onFechar} variant="verde">
              <Lock size={14} /> FECHAR GUARDA
            </BtnAcao>
          )}
          {fechada && (
            <BtnAcao onClick={onReabrir} variant="outline">
              <Unlock size={14} /> REABRIR
            </BtnAcao>
          )}
        </div>
      </div>

      {msg && (
        <div className="bg-verdeMil/20 border border-verdeBrilho px-3.5 py-2 mb-4 text-[11px] text-caquiClaro font-mono flex items-center gap-2">
          <Check size={13} className="shrink-0" /> {msg}
        </div>
      )}

      {dto.balanceado && (
        <div className="bg-verdeMil/20 border border-verdeBrilho px-3.5 py-2 mb-4 text-[11px] text-caquiClaro font-mono flex items-center gap-2">
          <Scale size={13} className="shrink-0" /> BALANCEAMENTO ATIVO — SORTEIO
          AJUSTADO PELO HISTÓRICO SALVO.
        </div>
      )}

      {monitorRepete && (
        <div className="bg-vermelho/20 border border-vermelho px-3.5 py-2.5 mb-4 text-xs text-caquiClaro font-mono flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" /> ATENÇÃO: {dias.length}{" "}
          DIAS PARA {monitoresDisp} MONITORES DISPONÍVEIS — HAVERÁ REPETIÇÃO NO
          COMANDO.
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
                        return esta && !fechada ? (
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
                            onClick={() =>
                              !fechada && setEditando({ dia, func, idx })
                            }
                            title={fechada ? "Escala fechada" : "Substituir"}
                            className={`bg-preto px-2 py-1 mb-1 text-[11px] flex gap-1.5 items-center font-mono ${
                              fechada ? "" : "cursor-pointer hover:bg-olivaClaro"
                            }`}
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

function UsuariosTab({
  onErro,
  turmas,
}: {
  onErro: (e: string | null) => void;
  turmas: Turma[];
}) {
  const [usuarios, setUsuarios] = useState<import("./types").Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<import("./types").Papel>("instrutor");
  const [turmaId, setTurmaId] = useState("");
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
      await api.addUser(nome.trim(), senha, role, turmaId || null);
      setMsg(`Usuário "${nome.trim().toLowerCase()}" criado.`);
      setNome("");
      setSenha("");
      setTurmaId("");
      setRole("instrutor" as import("./types").Papel);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  const trocarTurma = async (id: string, novo: string) => {
    onErro(null);
    try {
      await api.updateUser(id, { turmaId: novo || null });
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  const trocarPapel = async (id: string, novo: import("./types").Papel) => {
    onErro(null);
    try {
      await api.updateUser(id, { role: novo });
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  const idDaTurma = (cod?: string) =>
    cod ? turmas.find((t) => t.codigo === cod)?.id ?? "" : "";

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

  const inputCls =
    "w-full bg-preto border border-linha text-caquiClaro px-3 py-2 text-sm font-mono";
  const labelCls = "text-[10px] text-areia block mb-1 tracking-[2px] font-mono";
  const papelLabel = (r: import("./types").Papel) =>
    r === "superadmin" ? "COMANDANTE" : r === "monitor" ? "MONITOR" : "INSTRUTOR";
  const papelCls = (r: import("./types").Papel) =>
    r === "superadmin"
      ? "bg-amareloMil text-preto"
      : r === "monitor"
      ? "border border-verdeBrilho text-verdeBrilho"
      : "border border-areia text-areia";

  return (
    <div className="max-w-[680px]">
      <div className="bg-olivaEsc border border-amareloMil p-5 mb-5">
        <h2 className="m-0 mb-1 text-[15px] text-amareloMil font-estencil tracking-[2px] flex items-center gap-2">
          <UserCog size={16} /> NOVO USUÁRIO DE ACESSO
        </h2>
        <p className="m-0 mb-4 text-[11px] text-areia font-mono">
          &gt; COMANDANTE VÊ TUDO · INSTRUTOR/MONITOR SÓ A SUA TURMA. SENHAS
          GUARDADAS CRIPTOGRAFADAS.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>USUÁRIO</label>
            <input
              placeholder="ex.: schutz"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>SENHA (MÍN. 4)</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>PAPEL</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as import("./types").Papel)}
              className={inputCls}
            >
              <option value="instrutor">Instrutor</option>
              <option value="monitor">Monitor</option>
              <option value="superadmin">Comandante</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              TURMA {role === "superadmin" && "(opcional)"}
            </label>
            <select
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              className={inputCls}
            >
              <option value="">— sem turma —</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} {t.apelido}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={adicionar}
          className="mt-4 w-full bg-verdeMil text-caquiClaro py-2.5 font-bold text-[13px] tracking-wide font-mono inline-flex items-center justify-center gap-1.5"
        >
          <Plus size={15} /> CRIAR USUÁRIO
        </button>
        {msg && (
          <p className="mt-3 text-[11px] text-amareloMil font-mono flex items-center gap-1.5">
            <Check size={12} /> {msg}
          </p>
        )}
      </div>

      <h3 className="text-[12px] text-areia font-mono tracking-[2px] mb-2">
        &gt; {usuarios.length} USUÁRIO(S) ATIVO(S)
      </h3>
      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="bg-olivaEsc border border-linha px-3 py-3 font-mono"
          >
            <div className="flex items-center gap-2 mb-2">
              <CircleUserRound size={16} className="text-amareloMil shrink-0" />
              <span className="text-[14px] text-caquiClaro truncate">
                {u.username}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 tracking-wide shrink-0 ${papelCls(
                  u.role
                )}`}
              >
                {papelLabel(u.role)}
              </span>
              {u.turma && (
                <span className="text-[10px] text-amareloMil ml-auto">
                  {u.turma.codigo} · {u.turma.apelido}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[9px] text-areia tracking-wide">PAPEL</label>
              <select
                value={u.role}
                onChange={(e) =>
                  trocarPapel(u.id, e.target.value as import("./types").Papel)
                }
                className="bg-preto border border-linha text-caqui px-1.5 py-1 text-[10px] font-mono"
              >
                <option value="instrutor">Instrutor</option>
                <option value="monitor">Monitor</option>
                <option value="superadmin">Comandante</option>
              </select>
              <label className="text-[9px] text-areia tracking-wide ml-1">
                TURMA
              </label>
              <select
                value={idDaTurma(u.turma?.codigo)}
                onChange={(e) => trocarTurma(u.id, e.target.value)}
                className="bg-preto border border-linha text-caqui px-1.5 py-1 text-[10px] font-mono"
              >
                <option value="">— sem turma —</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} {t.apelido}
                  </option>
                ))}
              </select>
              <button
                onClick={() => redefinir(u.id, u.username)}
                className="ml-auto text-[10px] text-areia border border-linha px-2 py-1 hover:text-amareloMil inline-flex items-center gap-1"
              >
                <RotateCw size={11} /> SENHA
              </button>
              <button
                onClick={() => remover(u.id, u.username)}
                className="text-vermelho leading-none p-1"
                title="Remover"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalvasTab({
  currentId,
  onAbrir,
  onErro,
  turmas,
  turmaFoco,
}: {
  currentId: string | null;
  onAbrir: (id: string) => void;
  onErro: (e: string | null) => void;
  turmas: Turma[];
  turmaFoco: string;
}) {
  const [todasSalvas, setTodasSalvas] = useState<
    {
      id: string;
      startDate: string;
      createdAt: string;
      status?: string;
      turma?: { codigo: string; apelido: string } | null;
    }[]
  >([]);
  const [carregando, setCarregando] = useState(true);
  const focoCod = turmas.find((t) => t.id === turmaFoco)?.codigo;
  const lista = focoCod
    ? todasSalvas.filter((s) => s.turma?.codigo === focoCod)
    : todasSalvas;
  const setLista = setTodasSalvas;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await api.list());
    } catch (e) {
      onErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const excluir = async (id: string) => {
    onErro(null);
    if (!confirm("Excluir esta escala salva? Esta ação não pode ser desfeita."))
      return;
    try {
      await api.remove(id);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const periodo = (iso: string) => {
    const ini = new Date(iso);
    const fim = new Date(ini);
    fim.setDate(ini.getDate() + 6);
    return `${fmt(ini.toISOString())} → ${fmt(fim.toISOString())}`;
  };

  return (
    <div className="max-w-[680px]">
      <div className="bg-olivaEsc border border-amareloMil p-5 mb-5">
        <h2 className="m-0 mb-1 text-[15px] text-amareloMil font-estencil tracking-[2px] flex items-center gap-2">
          <Archive size={16} /> ESCALAS SALVAS
        </h2>
        <p className="m-0 text-[11px] text-areia font-mono">
          &gt; ABRA PARA VISUALIZAR/EDITAR. AO SALVAR, A MESMA ESCALA É
          ATUALIZADA.
        </p>
      </div>

      {carregando ? (
        <p className="text-areia text-[12px] font-mono">CARREGANDO…</p>
      ) : lista.length === 0 ? (
        <p className="text-areia text-[12px] font-mono">
          &gt; NENHUMA ESCALA SALVA AINDA. GERE OU IMPORTE UMA E TOQUE EM SALVAR.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((s) => (
            <div
              key={s.id}
              className={`bg-olivaEsc border px-3 py-3 flex items-center justify-between gap-3 font-mono flex-wrap ${
                s.id === currentId ? "border-amareloMil" : "border-linha"
              }`}
            >
              <div className="min-w-0">
                <div className="text-[13px] text-caquiClaro flex items-center gap-2 flex-wrap">
                  <CalendarDays size={14} className="text-amareloMil shrink-0" />
                  {periodo(s.startDate)}
                  {s.turma && (
                    <span className="text-[9px] bg-amareloMil text-preto px-1.5 py-0.5 tracking-wide">
                      {s.turma.codigo} · {s.turma.apelido}
                    </span>
                  )}
                  {s.status === "FECHADA" && (
                    <span className="text-[9px] bg-verdeMil text-caquiClaro px-1.5 py-0.5 tracking-wide inline-flex items-center gap-1">
                      <Lock size={9} /> FECHADA
                    </span>
                  )}
                  {s.id === currentId && (
                    <span className="text-[9px] text-verdeBrilho border border-verdeBrilho px-1.5 py-0.5 tracking-wide">
                      EM EDIÇÃO
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-areia mt-1">
                  &gt; SALVA EM {fmt(s.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onAbrir(s.id)}
                  className="bg-amareloMil text-preto px-3 py-1.5 text-[11px] font-bold tracking-wide inline-flex items-center gap-1.5"
                >
                  <FolderOpen size={13} /> ABRIR
                </button>
                <button
                  onClick={() => excluir(s.id)}
                  title="Excluir"
                  className="text-vermelho leading-none"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-areia text-[11px] mt-4 font-mono">
        &gt; {lista.length} ESCALA(S) SALVA(S).
      </p>
    </div>
  );
}

function FiltroTurma({
  turmas,
  foco,
  onFoco,
}: {
  turmas: Turma[];
  foco: string;
  onFoco: (id: string) => void;
}) {
  const opcoes: [string, string][] = [
    ["", "TODAS"],
    ...turmas.map((t) => [t.id, `${t.codigo} · ${t.apelido}`] as [string, string]),
  ];
  return (
    <div className="bg-oliva border-b border-linha px-3 sm:px-6">
      <div className="max-w-[1100px] mx-auto flex items-center gap-2 py-2 overflow-x-auto">
        <span className="text-[10px] text-areia font-mono tracking-[2px] shrink-0">
          VISÃO:
        </span>
        {opcoes.map(([id, label]) => (
          <button
            key={id || "todas"}
            onClick={() => onFoco(id)}
            className={`px-2.5 py-1 text-[11px] font-mono tracking-wide whitespace-nowrap border ${
              foco === id
                ? "bg-amareloMil text-preto border-amareloMil font-bold"
                : "bg-preto text-caqui border-linha hover:border-amareloMil"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PainelTab({
  onAbrirTurma,
  onGerarTurma,
  onErro,
}: {
  onAbrirTurma: (id: string) => void;
  onGerarTurma: (id: string) => void;
  onErro: (e: string | null) => void;
}) {
  const [dash, setDash] = useState<import("./types").Dashboard | null>(null);

  useEffect(() => {
    api.getDashboard().then(setDash).catch((e) => onErro((e as Error).message));
  }, [onErro]);

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })
      : "—";

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="m-0 text-base text-amareloMil font-estencil tracking-[2px]">
            PAINEL DO COMANDO
          </h2>
          <p className="mt-1 text-areia text-[11px] font-mono">
            &gt; VISÃO GERAL DAS TURMAS DO TG 05-003
          </p>
        </div>
        {dash && dash.semTurma > 0 && (
          <span className="text-[11px] text-vermelho font-mono border border-vermelho px-2 py-1">
            ⚠ {dash.semTurma} pessoa(s) sem turma
          </span>
        )}
      </div>

      {!dash ? (
        <p className="text-areia text-[12px] font-mono">CARREGANDO…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dash.turmas.map((t) => {
            const naSemana = t.id === dash.proximaTurmaId;
            return (
              <div
                key={t.id}
                className={`bg-olivaEsc border p-4 ${
                  naSemana ? "border-amareloMil" : "border-linha"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[15px] text-amareloMil font-estencil tracking-[2px]">
                    {t.codigo}
                  </span>
                  <span className="text-[13px] text-caquiClaro font-mono">
                    {t.apelido}
                  </span>
                  {naSemana && (
                    <span className="ml-auto text-[9px] bg-amareloMil text-preto px-1.5 py-0.5 tracking-wide font-mono">
                      PRÓXIMA NA ESCALA
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center font-mono">
                  <Stat n={t.guardas} label="GUARDAS" />
                  <Stat n={t.monitores} label="MONITORES" cor="text-amareloMil" />
                  <Stat
                    n={t.guardasAusentes + t.monitoresAusentes}
                    label="AUSENTES"
                    cor={
                      t.guardasAusentes + t.monitoresAusentes > 0
                        ? "text-vermelho"
                        : "text-verdeBrilho"
                    }
                  />
                </div>

                <div className="text-[10px] text-areia font-mono mb-3">
                  &gt; {t.escalas} escala(s) salva(s) · última: {fmt(t.ultimaEscala)}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onAbrirTurma(t.id)}
                    className="flex-1 bg-transparent border border-linha text-caqui px-2 py-1.5 text-[11px] font-mono hover:border-amareloMil inline-flex items-center justify-center gap-1"
                  >
                    <Users size={12} /> EFETIVO
                  </button>
                  <button
                    onClick={() => onGerarTurma(t.id)}
                    className="flex-1 bg-amareloMil text-preto px-2 py-1.5 text-[11px] font-bold font-mono inline-flex items-center justify-center gap-1"
                  >
                    <Flag size={12} /> GERAR <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  n,
  label,
  cor = "text-caquiClaro",
}: {
  n: number;
  label: string;
  cor?: string;
}) {
  return (
    <div className="bg-preto border border-linha py-2">
      <div className={`text-xl font-bold ${cor}`}>{n}</div>
      <div className="text-[9px] text-areia tracking-wide">{label}</div>
    </div>
  );
}

const NOME_MES = [
  "", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

function HorasTab({
  isSuper,
  turmaFoco,
  onErro,
}: {
  isSuper: boolean;
  turmaFoco: string;
  onErro: (e: string | null) => void;
}) {
  const [rep, setRep] = useState<import("./types").HoursReport | null>(null);
  const [impMsg, setImpMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setRep(await api.getHours(isSuper ? turmaFoco || null : null));
    } catch (e) {
      onErro((e as Error).message);
    }
  }, [isSuper, turmaFoco, onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const importarFicha = async (file: File) => {
    setImpMsg(null);
    try {
      const r = await api.importarFicha(await file.text());
      const ign = r.ignorados ? ` · ${r.ignorados} fora da turma ignorado(s)` : "";
      setImpMsg(`${r.importadas} registro(s) importado(s)${ign}.`);
      carregar();
    } catch (e) {
      setImpMsg(`Erro: ${(e as Error).message}`);
    }
  };

  const exportarCsv = () => {
    if (!rep) return;
    const sep = ";";
    const linhas: string[] = ["HORAS DE SERVIÇO"];
    const cab = ["TURMA", "Nº", "NOME", ...rep.meses.map((m) => NOME_MES[m]), "TOTAL"];
    linhas.push(cab.join(sep));
    const grupos = [
      ...rep.turmas.map((t) => [`${t.codigo} ${t.apelido}`, t.pessoas] as const),
      ...(rep.semTurma.length ? [["SEM TURMA", rep.semTurma] as const] : []),
    ];
    for (const [nome, pessoas] of grupos)
      for (const p of pessoas)
        linhas.push(
          [
            nome,
            p.num,
            p.nome,
            ...rep.meses.map((m) => p.meses[m] ?? 0),
            p.total,
          ].join(sep)
        );
    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "horas_servico.csv";
    a.click();
  };

  const grupos = rep
    ? [
        ...rep.turmas.map((t) => ({
          titulo: `${t.codigo} · ${t.apelido}`,
          pessoas: t.pessoas,
        })),
        ...(rep.semTurma.length
          ? [{ titulo: "SEM TURMA", pessoas: rep.semTurma }]
          : []),
      ]
    : [];

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="m-0 text-base text-amareloMil font-estencil tracking-[2px] flex items-center gap-2">
            <Clock size={16} /> HORAS DE SERVIÇO
          </h2>
          <p className="mt-1 text-areia text-[11px] font-mono">
            &gt; SOMA DAS GUARDAS FECHADAS + SALDO DA FICHA · MANHÃ/TARDE 6H ·
            NOITE 12H
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BtnAcao onClick={exportarCsv} variant="areia">
            <FileSpreadsheet size={14} /> CSV
          </BtnAcao>
          <label className="bg-verdeMil text-caquiClaro px-4 py-2 font-bold text-xs tracking-wide font-mono inline-flex items-center gap-1.5 cursor-pointer">
            <Upload size={14} /> IMPORTAR FICHA{isSuper ? "" : " (MINHA TURMA)"}
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarFicha(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {impMsg && (
        <div className="bg-verdeMil/20 border border-verdeBrilho px-3.5 py-2 mb-4 text-[11px] text-caquiClaro font-mono">
          {impMsg}
        </div>
      )}

      {!rep ? (
        <p className="text-areia text-[12px] font-mono">CARREGANDO…</p>
      ) : grupos.every((g) => g.pessoas.length === 0) ? (
        <p className="text-areia text-[12px] font-mono">
          &gt; SEM HORAS AINDA. FECHE UMA GUARDA OU IMPORTE A FICHA.
        </p>
      ) : (
        grupos
          .filter((g) => g.pessoas.length > 0)
          .map((g) => (
            <div key={g.titulo} className="mb-6">
              <h3 className="text-[13px] text-amareloMil font-mono tracking-[2px] mb-2">
                {g.titulo}
              </h3>
              <div className="border border-linha overflow-x-auto">
                <table className="w-full border-collapse min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="bg-preto px-3 py-2 text-left text-[11px] text-amareloMil border-b-2 border-amareloMil font-mono tracking-wide">
                        MILITAR
                      </th>
                      {rep.meses.map((m) => (
                        <th
                          key={m}
                          className="bg-preto px-2 py-2 text-center text-[11px] text-caquiClaro border-b-2 border-amareloMil border-l border-linha font-mono"
                        >
                          {NOME_MES[m]}
                        </th>
                      ))}
                      <th className="bg-preto px-2 py-2 text-center text-[11px] text-amareloMil border-b-2 border-amareloMil border-l border-linha font-mono">
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.pessoas.map((p, i) => (
                      <tr
                        key={p.num + p.nome}
                        className={i % 2 === 0 ? "bg-oliva" : "bg-olivaEsc"}
                      >
                        <td className="px-3 py-1.5 text-[11px] font-mono whitespace-nowrap">
                          <span className="text-amareloMil font-bold mr-2">
                            {p.num}
                          </span>
                          <span className="text-caquiClaro">{p.nome}</span>
                          {p.isMonitor && (
                            <span className="text-[9px] text-areia ml-1.5">
                              (mon)
                            </span>
                          )}
                        </td>
                        {rep.meses.map((m) => (
                          <td
                            key={m}
                            className="px-2 py-1.5 text-center text-[11px] text-caqui font-mono border-l border-linha"
                          >
                            {p.meses[m] ?? "—"}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center text-[12px] text-amareloMil font-bold font-mono border-l border-linha">
                          {p.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
      )}
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
      className={`px-4 py-2 font-bold text-xs tracking-wide font-mono inline-flex items-center gap-1.5 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
