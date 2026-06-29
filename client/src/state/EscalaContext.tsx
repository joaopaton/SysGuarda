import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { FUNCOES, type DiaEscala, type EscalaDTO } from "../lib/types";
import { proximaTercaISO } from "../lib/dates";
import { parseEscalaCsv } from "../parseEscalaCsv";
import { exportarHistoricoCSV } from "../lib/export";
import { useAppData } from "./AppDataContext";
import { useNav } from "./NavContext";

type Func = (typeof FUNCOES)[number];

interface EscalaCtx {
  dto: EscalaDTO | null;
  scheduleId: string | null;
  inicio: string;
  setInicio: (s: string) => void;
  balancear: boolean;
  setBalancear: (b: boolean) => void;
  turmaGerar: string;
  setTurmaGerar: (s: string) => void;
  salvando: boolean;
  msg: string | null;
  setMsg: (m: string | null) => void;
  showAditamento: boolean;
  setShowAditamento: (b: boolean) => void;
  gerar: () => Promise<void>;
  salvar: () => Promise<void>;
  abrir: (id: string) => Promise<void>;
  fechar: () => Promise<void>;
  reabrir: () => Promise<void>;
  importarEscalaCsv: (file: File) => Promise<void>;
  editarCelula: (
    dia: number,
    func: Func,
    idx: number,
    pessoa: { num: string; nome: string }
  ) => void;
  aplicarVaga: (
    dia: number,
    func: Func,
    idx: number,
    vaga: { num: string; nome: string; falta?: boolean; obs?: string | null }
  ) => void;
  baixarHistorico: () => void;
}

const Ctx = createContext<EscalaCtx | null>(null);

export function EscalaProvider({ children }: { children: ReactNode }) {
  const { user } = useAppData();
  const { turmaFoco, irPara, setErro } = useNav();

  const [dto, setDto] = useState<EscalaDTO | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [inicio, setInicio] = useState(proximaTercaISO());
  const [balancear, setBalancear] = useState(true);
  const [turmaGerar, setTurmaGerar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAditamento, setShowAditamento] = useState(false);

  // O filtro global de turma define a turma padrão da geração.
  useEffect(() => {
    setTurmaGerar(turmaFoco);
  }, [turmaFoco]);

  const turmaAtiva = useCallback(
    () => dto?.turmaId ?? turmaGerar ?? user?.turma?.id ?? null,
    [dto, turmaGerar, user]
  );

  const gerar = useCallback(async () => {
    setErro(null);
    setMsg(null);
    try {
      const turmaId = turmaGerar || user?.turma?.id || null;
      const novo = await api.generate(inicio, balancear, turmaId);
      setDto(novo);
      if (novo.turmaId) setTurmaGerar(novo.turmaId);
      setScheduleId(null);
      irPara("escala");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [inicio, balancear, turmaGerar, user, irPara, setErro]);

  const importarEscalaCsv = useCallback(
    async (file: File) => {
      setErro(null);
      setMsg(null);
      try {
        const imp = parseEscalaCsv(await file.text());
        const turmaId = turmaGerar || user?.turma?.id || null;
        setDto({ ...imp, balanceado: false, turmaId });
        setScheduleId(null);
        irPara("escala");
        setShowAditamento(true);
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [turmaGerar, user, irPara, setErro]
  );

  const abrir = useCallback(
    async (id: string) => {
      setErro(null);
      setMsg(null);
      try {
        const e = await api.get(id);
        setDto(e);
        setScheduleId(id);
        irPara("escala");
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    [irPara, setErro]
  );

  const salvar = useCallback(async () => {
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
        setMsg("Escala salva — já entra no balanceamento futuro.");
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }, [dto, scheduleId, turmaAtiva, setErro]);

  const fechar = useCallback(async () => {
    if (!dto || !scheduleId) return;
    setErro(null);
    setMsg(null);
    try {
      await api.fecharEscala(scheduleId);
      setDto((d) => (d ? { ...d, status: "FECHADA" } : d));
      setMsg("Guarda fechada — horas contabilizadas no relatório.");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [dto, scheduleId, setErro]);

  const reabrir = useCallback(async () => {
    if (!dto || !scheduleId) return;
    setErro(null);
    try {
      await api.reabrirEscala(scheduleId);
      setDto((d) => (d ? { ...d, status: "ABERTA" } : d));
      setMsg("Guarda reaberta para edição.");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [dto, scheduleId, setErro]);

  const editarCelula = useCallback(
    (dia: number, func: Func, idx: number, pessoa: { num: string; nome: string }) => {
      setDto((prev) => {
        if (!prev) return prev;
        const escala = prev.escala.map((d) => ({ ...d }) as DiaEscala);
        const arr = [...(escala[dia][func] || [])];
        while (arr.length <= idx) arr.push({ num: "---", nome: "VAZIO" });
        arr[idx] = { num: pessoa.num, nome: pessoa.nome };
        escala[dia][func] = arr;
        return { ...prev, escala };
      });
    },
    []
  );

  // Aplica pessoa + registro (falta/observação) à vaga, preservando o resto.
  const aplicarVaga = useCallback(
    (
      dia: number,
      func: Func,
      idx: number,
      vaga: { num: string; nome: string; falta?: boolean; obs?: string | null }
    ) => {
      setDto((prev) => {
        if (!prev) return prev;
        const escala = prev.escala.map((d) => ({ ...d }) as DiaEscala);
        const arr = [...(escala[dia][func] || [])];
        while (arr.length <= idx) arr.push({ num: "---", nome: "VAZIO" });
        arr[idx] = {
          num: vaga.num,
          nome: vaga.nome,
          falta: vaga.falta || undefined,
          obs: vaga.obs?.trim() ? vaga.obs.trim() : undefined,
        };
        escala[dia][func] = arr;
        return { ...prev, escala };
      });
    },
    []
  );

  const baixarHistorico = useCallback(() => {
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
  }, [dto]);

  return (
    <Ctx.Provider
      value={{
        dto,
        scheduleId,
        inicio,
        setInicio,
        balancear,
        setBalancear,
        turmaGerar,
        setTurmaGerar,
        salvando,
        msg,
        setMsg,
        showAditamento,
        setShowAditamento,
        gerar,
        salvar,
        abrir,
        fechar,
        reabrir,
        importarEscalaCsv,
        editarCelula,
        aplicarVaga,
        baixarHistorico,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEscala() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEscala fora do EscalaProvider");
  return c;
}
