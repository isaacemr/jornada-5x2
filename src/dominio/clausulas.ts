/**
 * Checklist de compatibilidade das cláusulas de jornada com os limites de cada etapa.
 */
import { REGRAS } from '../config/regras-ec141';
import { limitesDaEtapa } from './etapas';
import { formatarDuracao } from './tempo';
import type { AvaliacaoClausula, Clausula, Instrumento, TipoInstrumento } from './tipos';

export const ROTULO_AVALIACAO: Record<AvaliacaoClausula, string> = {
  compativel: 'Compatível',
  incompativel: 'Incompatível — perde eficácia',
  revisar: 'Revisar com sindicato/advogado',
};

export interface AvaliacaoAuto {
  resultado: AvaliacaoClausula;
  motivo: string;
}

export function eColetivo(tipo: TipoInstrumento): boolean {
  return tipo === 'CCT' || tipo === 'ACT';
}

/** Avaliação automática de uma cláusula para a etapa indicada. */
export function avaliarClausula(c: Clausula, tipoInstrumento: TipoInstrumento, etapa: 1 | 2, domingoACadaSemanas: number): AvaliacaoAuto {
  const L = limitesDaEtapa(etapa);
  const coletivo = eColetivo(tipoInstrumento);
  const p = c.parametros;
  const nomeEtapa = `etapa ${etapa}`;
  const perde = REGRAS.excecoes.clausulasIncompativeisPerdemEficacia.valor ? ' — perde eficácia' : '';

  switch (c.tipo) {
    case 'jornada_semanal': {
      if (p.jornadaSemanalMin === undefined) return { resultado: 'revisar', motivo: 'Informe o limite semanal previsto na cláusula para avaliar.' };
      return p.jornadaSemanalMin > L.limiteSemanalMin
        ? { resultado: 'incompativel', motivo: `Prevê ${formatarDuracao(p.jornadaSemanalMin)} semanais; o limite na ${nomeEtapa} é ${formatarDuracao(L.limiteSemanalMin)}${perde}.` }
        : { resultado: 'compativel', motivo: `${formatarDuracao(p.jornadaSemanalMin)} semanais está dentro do limite de ${formatarDuracao(L.limiteSemanalMin)}.` };
    }
    case 'jornada_diaria': {
      if (p.jornadaDiariaMin === undefined) return { resultado: 'revisar', motivo: 'Informe a jornada diária prevista na cláusula para avaliar.' };
      const v = p.jornadaDiariaMin;
      if (v <= L.limiteDiarioMin) return { resultado: 'compativel', motivo: `${formatarDuracao(v)} por dia está dentro do limite de ${formatarDuracao(L.limiteDiarioMin)}.` };
      if (etapa === 1 && L.limiteDiarioComAcordoMin !== null && v <= L.limiteDiarioComAcordoMin) {
        return coletivo
          ? {
              resultado: 'revisar',
              motivo: `${formatarDuracao(v)} por dia: na etapa 1 a convenção/acordo coletivo pode ampliar a jornada diária para viabilizar as 42 h em 5 dias. Confirme se a cláusula tem essa finalidade e respeita as 42 h.`,
            }
          : { resultado: 'incompativel', motivo: `${formatarDuracao(v)} por dia: acima de 8 h só por convenção/acordo coletivo na etapa 1 — acordo individual não basta${perde}.` };
      }
      return { resultado: 'incompativel', motivo: `${formatarDuracao(v)} por dia: acima do limite de ${formatarDuracao(L.limiteDiarioMin)} na ${nomeEtapa}${perde}.` };
    }
    case 'escala': {
      const dias = p.diasTrabalhoSemana;
      if (dias === undefined) return { resultado: 'revisar', motivo: 'Informe quantos dias de trabalho por semana a cláusula prevê.' };
      if (dias <= L.diasTrabalhoMax) {
        if (p.domingoFolgaACadaSemanas && p.domingoFolgaACadaSemanas > domingoACadaSemanas) {
          return { resultado: 'revisar', motivo: `Escala compatível, mas a folga dominical a cada ${p.domingoFolgaACadaSemanas} semanas é menos frequente que a regra adotada (${domingoACadaSemanas}).` };
        }
        return { resultado: 'compativel', motivo: `${dias} dias de trabalho por semana com 2 de repouso.` };
      }
      if (coletivo && p.regimeCompensatorioExcepcional && REGRAS.excecoes.regimeCompensatorioPorAcordoColetivo.permitido) {
        return { resultado: 'revisar', motivo: `${dias} dias por semana como regime compensatório excepcional: permitido por convenção/acordo coletivo, desde que respeite ${formatarDuracao(L.limiteSemanalMin)} semanais. Confira a redação.` };
      }
      return {
        resultado: 'incompativel',
        motivo: coletivo
          ? `${dias} dias de trabalho por semana (ex.: 6x1) deixa de ser a regra. Só vale se a convenção/acordo coletivo o instituir expressamente como regime compensatório excepcional, respeitando os novos limites${perde}.`
          : `${dias} dias de trabalho por semana: exceções à 5x2 só por convenção/acordo coletivo${perde}.`,
      };
    }
    case 'banco_horas': {
      const prazo = p.prazoBancoMeses;
      const max = coletivo ? REGRAS.clt.bancoDeHoras.prazoMaxAcordoColetivoMeses : REGRAS.clt.bancoDeHoras.prazoMaxAcordoIndividualMeses;
      if (prazo === undefined) return { resultado: 'revisar', motivo: 'Informe o prazo de compensação do banco de horas.' };
      if (prazo > max) return { resultado: 'incompativel', motivo: `Prazo de ${prazo} meses acima do máximo de ${max} meses (CLT art. 59)${perde}.` };
      return {
        resultado: 'compativel',
        motivo: `Prazo de ${prazo} meses dentro do limite. Atualize a jornada de referência (${formatarDuracao(L.limiteSemanalMin)}) e o divisor usados no cálculo do saldo.`,
      };
    }
    case 'regime_12x36': {
      const media = REGRAS.clt.regime12x36.mediaSemanalMin;
      if (media > L.limiteSemanalMin) {
        return { resultado: 'incompativel', motivo: `A 12x36 tem média de ${formatarDuracao(media)} semanais, acima do limite de ${formatarDuracao(L.limiteSemanalMin)} na ${nomeEtapa}. Precisa ser redesenhada${perde}.` };
      }
      return coletivo
        ? { resultado: 'revisar', motivo: `Média de ${formatarDuracao(media)} dentro do limite da ${nomeEtapa}, mas a 12x36 passa a ser regime compensatório excepcional: confirme a redação com o sindicato.` }
        : { resultado: 'incompativel', motivo: `Exceções à 5x2 (como a 12x36) passam a depender de convenção/acordo coletivo; acordo individual não basta${perde}.` };
    }
    case 'domingos': {
      const n = p.domingoFolgaACadaSemanas;
      if (n === undefined) return { resultado: 'revisar', motivo: 'Informe a cada quantas semanas a folga coincide com o domingo.' };
      return n <= domingoACadaSemanas
        ? { resultado: 'compativel', motivo: `Folga dominical a cada ${n} semanas atende à regra adotada (a cada ${domingoACadaSemanas}).` }
        : { resultado: 'revisar', motivo: `Folga dominical a cada ${n} semanas é menos frequente que a regra adotada (a cada ${domingoACadaSemanas}). A EC prevê um dos repousos preferencialmente aos domingos.` };
    }
    default:
      return { resultado: 'revisar', motivo: 'Cláusula sem avaliação automática: revise o texto com o sindicato ou advogado.' };
  }
}

export interface ClausulaAvaliada {
  clausula: Clausula;
  etapa1: AvaliacaoAuto;
  etapa2: AvaliacaoAuto;
  /** Resultado considerado: decisão manual, se houver; senão o pior entre as etapas. */
  final: AvaliacaoClausula;
  manual: boolean;
}

const PESO: Record<AvaliacaoClausula, number> = { compativel: 0, revisar: 1, incompativel: 2 };

export function avaliarInstrumento(inst: Instrumento, domingoACadaSemanas: number): ClausulaAvaliada[] {
  return inst.clausulas.map((c) => {
    const e1 = avaliarClausula(c, inst.tipo, 1, domingoACadaSemanas);
    const e2 = avaliarClausula(c, inst.tipo, 2, domingoACadaSemanas);
    const auto = PESO[e1.resultado] >= PESO[e2.resultado] ? e1.resultado : e2.resultado;
    return { clausula: c, etapa1: e1, etapa2: e2, final: c.avaliacaoManual ?? auto, manual: c.avaliacaoManual !== null };
  });
}

export function resumoAvaliacoes(av: ClausulaAvaliada[]): Record<AvaliacaoClausula, number> {
  const r: Record<AvaliacaoClausula, number> = { compativel: 0, incompativel: 0, revisar: 0 };
  for (const a of av) r[a.final]++;
  return r;
}

/** Situação da vigência do instrumento numa data. */
export function situacaoVigencia(inst: Instrumento, hoje: string): 'vigente' | 'vencido' | 'futuro' | 'sem_data' {
  if (!inst.vigenciaInicio && !inst.vigenciaFim) return 'sem_data';
  if (inst.vigenciaInicio && hoje < inst.vigenciaInicio) return 'futuro';
  if (inst.vigenciaFim && hoje > inst.vigenciaFim) return 'vencido';
  return 'vigente';
}
