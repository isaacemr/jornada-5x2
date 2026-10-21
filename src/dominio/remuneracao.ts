/**
 * Valor-hora, divisor mensal e hora extra — mantendo o salário (sem redução salarial).
 */
import { REGRAS } from '../config/regras-ec141';
import type { ConfigEmpresa } from './tipos';

export type ConfigRemuneracao = Pick<ConfigEmpresa, 'divisores' | 'adicionalHoraExtra' | 'adicionalDomingoFeriado'>;

export function configRemuneracaoPadrao(): ConfigRemuneracao {
  return {
    divisores: { 44: REGRAS.divisores.porHorasSemanais[44], 42: REGRAS.divisores.porHorasSemanais[42], 40: REGRAS.divisores.porHorasSemanais[40] },
    adicionalHoraExtra: REGRAS.clt.horaExtra.adicionalPadrao,
    adicionalDomingoFeriado: REGRAS.clt.horaExtra.adicionalDomingoFeriadoPadrao,
  };
}

/**
 * Divisor mensal para uma carga semanal. Usa o divisor configurado para 44/42/40 h;
 * para outras cargas aplica a fórmula horas semanais × 5 (÷ 6 × 30).
 */
export function divisorPara(semanalMin: number, divisores: ConfigRemuneracao['divisores']): number {
  const horas = semanalMin / 60;
  if (horas === 44 || horas === 42 || horas === 40) return divisores[horas];
  return Math.round(horas * REGRAS.divisores.fatorPadrao * 100) / 100;
}

export const arred2 = (v: number) => Math.round(v * 100) / 100;

export interface QuadroRemuneracao {
  semanalMin: number;
  divisor: number;
  /** Horas mensais remuneradas (= divisor, inclui o repouso remunerado). */
  horasMensaisRemuneradas: number;
  /** Horas efetivamente trabalhadas no mês, em média (semanal × 52 ÷ 12). */
  horasMensaisTrabalhadas: number;
  salario: number;
  valorHora: number;
  horaExtra: number;
  horaExtraDomingo: number;
}

export function quadroRemuneracao(
  salario: number,
  semanalMin: number,
  cfg: ConfigRemuneracao,
  divisorForcado?: number | null,
): QuadroRemuneracao {
  const divisor = divisorForcado && divisorForcado > 0 ? divisorForcado : divisorPara(semanalMin, cfg.divisores);
  const valorHora = divisor > 0 ? salario / divisor : 0;
  return {
    semanalMin,
    divisor,
    horasMensaisRemuneradas: divisor,
    horasMensaisTrabalhadas: arred2((semanalMin / 60) * REGRAS.semanasPorMes),
    salario,
    valorHora: arred2(valorHora),
    horaExtra: arred2(valorHora * (1 + cfg.adicionalHoraExtra)),
    horaExtraDomingo: arred2(valorHora * (1 + cfg.adicionalDomingoFeriado)),
  };
}

export interface ComparativoRemuneracao {
  antes: QuadroRemuneracao;
  depois: QuadroRemuneracao;
  /** Variação percentual do valor-hora (ex.: 4,76 = +4,76%). */
  variacaoValorHoraPerc: number;
  reducaoSemanalMin: number;
}

/** Compara antes/depois mantendo o mesmo salário. */
export function compararRemuneracao(
  salario: number,
  semanalAntesMin: number,
  semanalDepoisMin: number,
  cfg: ConfigRemuneracao,
  divisoresForcados: { antes?: number | null; depois?: number | null } = {},
): ComparativoRemuneracao {
  const antes = quadroRemuneracao(salario, semanalAntesMin, cfg, divisoresForcados.antes);
  const depois = quadroRemuneracao(salario, semanalDepoisMin, cfg, divisoresForcados.depois);
  return {
    antes,
    depois,
    variacaoValorHoraPerc: antes.valorHora > 0 ? arred2((depois.valorHora / antes.valorHora - 1) * 100) : 0,
    reducaoSemanalMin: semanalAntesMin - semanalDepoisMin,
  };
}

/** Custo de N horas extras no mês. */
export function custoHorasExtras(horas: number, valorHora: number, adicional: number): number {
  return arred2(horas * valorHora * (1 + adicional));
}
