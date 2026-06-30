// Definições de domínio da escala — compartilhadas entre algoritmo e rotas.

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

/** Horas de serviço por função: permanência = 6h, guarda noturna/Cmt = 12h. */
export const HORAS: Record<Funcao, number> = {
  "Cmt Gd TG": 12,
  "Permanência Manhã": 6,
  "Permanência Tarde": 6,
  "Guardas do TG": 12,
};

/** Pontuação disciplinar: saldo inicial e penalidades por falta na instrução. */
export const PONTOS_INICIAL = 120;
export const PENALIDADE_NAO_JUSTIFICADA = 4;
export const PENALIDADE_JUSTIFICADA = 2;

/** Saldo a partir das faltas (cumulativo, mínimo 0). */
export function calcularPontos(faltasJustificadas: number, faltasNaoJustificadas: number): number {
  const desconto =
    faltasJustificadas * PENALIDADE_JUSTIFICADA +
    faltasNaoJustificadas * PENALIDADE_NAO_JUSTIFICADA;
  return Math.max(0, PONTOS_INICIAL - desconto);
}

export const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export const NUM_DIAS = 7;

export const VAZIO = { num: "---", nome: "VAZIO" };

export interface Pessoa {
  num: string;
  nome: string;
  /** Registro da guarda (opcional): faltou? + observação. */
  falta?: boolean;
  obs?: string | null;
}

export const keyOf = (p: Pessoa) => p.num + p.nome;

/** Ajusta qualquer data para a terça-feira daquela semana (ou a próxima). */
export function ajustarParaTerca(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=Dom .. 2=Ter
  const diff = (2 - dow + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Rótulos de coluna "DD/MM SIG" a partir da terça inicial. */
export function getRotulos(inicio: Date, dias = NUM_DIAS): string[] {
  const out: string[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const sig = DIAS_SEMANA[d.getDay() === 0 ? 6 : d.getDay() - 1];
    out.push(
      `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")} ${sig}`
    );
  }
  return out;
}
