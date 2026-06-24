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

export interface Person extends Pessoa {
  id: string;
  isMonitor: boolean;
  available: boolean;
}

export type DiaEscala = Record<Funcao, Pessoa[]>;

export interface EscalaDTO {
  startDate: string;
  dias: string[];
  escala: DiaEscala[];
  balanceado?: boolean;
  monitoresCount?: number;
}

export interface Instrutor {
  id: string;
  nome: string;
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
