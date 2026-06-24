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
}

export interface Instrutor {
  id: string;
  nome: string;
}

export type Papel = "superadmin" | "instrutor";

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
  "Cmt Gd TG": "#d4b942",
  "Permanência Manhã": "#8a9a4d",
  "Permanência Tarde": "#a89968",
  "Guardas do TG": "#c9bd9e",
};
