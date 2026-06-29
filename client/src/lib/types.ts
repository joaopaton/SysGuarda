export const FUNCOES = [
  "Cmt Gd TG",
  "Permanência Manhã",
  "Permanência Tarde",
  "Guardas do TG",
] as const;

export type Funcao = (typeof FUNCOES)[number];

export const VAGAS: Record<Funcao, number> = {
  "Cmt Gd TG": 1,
  "Permanência Manhã": 2,
  "Permanência Tarde": 2,
  "Guardas do TG": 5,
};

export interface Pessoa {
  num: string;
  nome: string;
}

export interface TurmaResumo {
  codigo: string;
  apelido: string;
}

export interface Turma extends TurmaResumo {
  id: string;
  ordem: number;
}

export interface Person extends Pessoa {
  id: string;
  isMonitor: boolean;
  available: boolean;
  turmaId?: string | null;
  turma?: TurmaResumo | null;
}

export type DiaEscala = Record<Funcao, Pessoa[]>;

export interface EscalaDTO {
  startDate: string;
  dias: string[];
  escala: DiaEscala[];
  balanceado?: boolean;
  monitoresCount?: number;
  guardasCount?: number;
  turmaId?: string | null;
  turma?: { id: string; codigo: string; apelido: string } | null;
  status?: "ABERTA" | "FECHADA";
}

export interface HoursPessoa {
  num: string;
  nome: string;
  isMonitor: boolean;
  meses: Record<string, number>;
  total: number;
}

export interface HoursTurma {
  id: string;
  codigo: string;
  apelido: string;
  pessoas: HoursPessoa[];
}

export interface HoursReport {
  meses: number[];
  turmas: HoursTurma[];
  semTurma: HoursPessoa[];
}

export type AttendanceStatus = "PRESENTE" | "FALTA" | "JUSTIFICADO";

export interface AttendanceRow {
  num: string;
  nome: string;
  isMonitor: boolean;
  status: AttendanceStatus;
}

export interface AttendanceDTO {
  date: string;
  turmaId: string | null;
  linhas: AttendanceRow[];
}

export interface PresencaLinha {
  num: string;
  nome: string;
  isMonitor: boolean;
  presentes: number;
  faltas: number;
  justificados: number;
  dias: Record<string, AttendanceStatus>;
}

export interface PresencaHistorico {
  datas: string[];
  turmas: {
    id: string;
    codigo: string;
    apelido: string;
    pessoas: PresencaLinha[];
  }[];
  semTurma: PresencaLinha[];
}

export interface MissaoLancamento {
  id: string;
  date: string | null;
  descricao: string;
  horas: number;
}

export interface MissoesPessoa {
  num: string;
  nome: string;
  isMonitor: boolean;
  total: number;
  abaixo: boolean;
  lancamentos: MissaoLancamento[];
}

export interface MissoesTurma {
  id: string;
  codigo: string;
  apelido: string;
  pessoas: MissoesPessoa[];
}

export interface MissoesReport {
  meta: number;
  turmas: MissoesTurma[];
  semTurma: MissoesPessoa[];
}

export interface Instrutor {
  id: string;
  nome: string;
}

export type Papel = "superadmin" | "instrutor" | "monitor";

export interface MeUser {
  username: string;
  role: Papel;
  turma: { id: string; codigo: string; apelido: string } | null;
}

export interface Usuario {
  id: string;
  username: string;
  role: Papel;
  createdAt: string;
  turma?: TurmaResumo | null;
}

export interface TurmaResumoPainel {
  id: string;
  codigo: string;
  apelido: string;
  ordem: number;
  guardas: number;
  guardasAusentes: number;
  monitores: number;
  monitoresAusentes: number;
  escalas: number;
  ultimaEscala: string | null;
}

export interface Dashboard {
  proximaTurmaId: string | null;
  turmas: TurmaResumoPainel[];
  semTurma: number;
}

export interface AditamentoConfig {
  tg: string;
  cidade: string;
  numero: string;
  uniforme: string;
  assinante: string;
  posto: string;
  funcaoAssinante: string;
  lema: string;
}

export const COR_FUNC: Record<Funcao, string> = {
  "Cmt Gd TG": "#22c55e",
  "Permanência Manhã": "#3b82f6",
  "Permanência Tarde": "#8b5cf6",
  "Guardas do TG": "#f59e0b",
};

/** Paleta estável para distinguir turmas em calendário e gráficos. */
export const CORES_TURMA = [
  "#3b82f6", // azul
  "#f59e0b", // âmbar
  "#8b5cf6", // violeta
  "#10b981", // esmeralda
  "#ec4899", // rosa
  "#06b6d4", // ciano
] as const;

/** Cor de uma turma pela sua posição (ordem do rodízio / índice na lista). */
export function corTurma(indice: number): string {
  return CORES_TURMA[((indice % CORES_TURMA.length) + CORES_TURMA.length) % CORES_TURMA.length];
}
