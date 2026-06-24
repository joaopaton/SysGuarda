// Algoritmo de geração ponderada da escala (seção 4 da especificação).
import { FUNCOES, VAGAS, VAZIO, keyOf, type Funcao, type Pessoa } from "./domain.js";

export type Historico = Record<string, number>;

/** Uma escala = lista de dias; cada dia mapeia função -> pessoas das vagas. */
export type Escala = Record<Funcao, Pessoa[]>[];

function ordenarPorHistorico(
  monitores: Pessoa[],
  historico: Historico,
  contagem: Historico
): Pessoa[] {
  return [...monitores]
    .map((m) => ({
      m,
      peso:
        (historico[keyOf(m)] || 0) +
        (contagem[keyOf(m)] || 0) +
        Math.random() * 0.5,
    }))
    .sort((a, b) => a.peso - b.peso)
    .map((x) => x.m);
}

export function gerarEscala(
  guardas: Pessoa[],
  monitores: Pessoa[],
  numDias: number,
  historico: Historico = {}
): Escala {
  const numsMonitores = new Set(monitores.map(keyOf));
  const guardasValidos = guardas.filter((g) => !numsMonitores.has(keyOf(g)));

  const contagem: Historico = {};
  [...guardasValidos, ...monitores].forEach((p) => (contagem[keyOf(p)] = 0));

  // peso: quanto menos guardas (histórico + atual), maior a chance.
  const pesoBase = (p: Pessoa) => {
    const hist = historico[keyOf(p)] || 0;
    const atual = contagem[keyOf(p)] || 0;
    return 1 / (1 + hist + atual * 2);
  };

  const sortearPonderado = (
    pool: Pessoa[],
    n: number,
    jaUsadosNoDia: Set<string>
  ): Pessoa[] => {
    const escolhidos: Pessoa[] = [];
    const disponiveis = pool.filter((p) => !jaUsadosNoDia.has(keyOf(p)));
    for (let i = 0; i < n; i++) {
      const candidatos = disponiveis.filter(
        (p) => !escolhidos.some((e) => keyOf(e) === keyOf(p))
      );
      if (candidatos.length === 0) {
        escolhidos.push({ ...VAZIO });
        continue;
      }
      const pesos = candidatos.map(pesoBase);
      const total = pesos.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let sel = candidatos[0];
      for (let j = 0; j < candidatos.length; j++) {
        r -= pesos[j];
        if (r <= 0) {
          sel = candidatos[j];
          break;
        }
      }
      escolhidos.push(sel);
      contagem[keyOf(sel)] = (contagem[keyOf(sel)] || 0) + 1;
    }
    return escolhidos;
  };

  let filaMonitores = ordenarPorHistorico(monitores, historico, contagem);
  let mIdx = 0;

  const escala: Escala = [];
  for (let dia = 0; dia < numDias; dia++) {
    const doDia = {} as Record<Funcao, Pessoa[]>;
    const usadosNoDia = new Set<string>();

    for (const func of FUNCOES) {
      if (func === "Cmt Gd TG") {
        if (mIdx >= filaMonitores.length) {
          filaMonitores = ordenarPorHistorico(monitores, historico, contagem);
          mIdx = 0;
        }
        const m = filaMonitores[mIdx] || { ...VAZIO };
        mIdx++;
        contagem[keyOf(m)] = (contagem[keyOf(m)] || 0) + 1;
        usadosNoDia.add(keyOf(m));
        doDia[func] = [{ ...m }];
      } else {
        const escolhidos = sortearPonderado(
          guardasValidos,
          VAGAS[func],
          usadosNoDia
        );
        escolhidos.forEach((e) => usadosNoDia.add(keyOf(e)));
        doDia[func] = escolhidos.map((e) => ({ ...e }));
      }
    }
    escala.push(doDia);
  }
  return escala;
}
