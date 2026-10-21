/**
 * Diagnóstico automático de cada funcionário frente às etapas da EC 141/2026.
 */
import { REGRAS } from '../config/regras-ec141';
import { limitesDaEtapa, type Prazos } from './etapas';
import { problemasCLT, resumirGrade, type ResumoGrade } from './jornada';
import { formatarData, formatarDuracao } from './tempo';
import type { ConfigEmpresa, Funcionario, GradeSemanal, Motivo, SimNaoNaoSei, StatusDiagnostico } from './tipos';

export interface ContextoDiagnostico {
  prazos: Prazos;
  config: Pick<ConfigEmpresa, 'acordoAmpliaJornadaEtapa1' | 'acordoRegimeCompensatorio' | 'domingoFolgaACadaSemanas'>;
}

type Resultado = 'ok' | 'depende' | 'falha';

export interface AvaliacaoEtapa {
  resultado: Resultado;
  motivos: Motivo[];
}

export interface Diagnostico {
  status: StatusDiagnostico;
  /** Data-limite para o ajuste (null se adequado). */
  prazo: string | null;
  /** Frase curta com os pontos a ajustar (para listas). */
  resumoCurto: string;
  motivos: Motivo[];
  etapa1: AvaliacaoEtapa;
  etapa2: AvaliacaoEtapa;
  adequadoEtapa1: boolean;
  adequadoEtapa2: boolean;
  semanalConsideradoMin: number;
  maxDiarioConsideradoMin: number;
  diasTrabalhados: number;
  resumo: ResumoGrade;
  /** Qual grade foi analisada. */
  base: 'atual' | 'nova';
}

const pior = (a: Resultado, b: Resultado): Resultado =>
  a === 'falha' || b === 'falha' ? 'falha' : a === 'depende' || b === 'depende' ? 'depende' : 'ok';

/** Converte a resposta "há acordo coletivo?" no resultado da checagem. */
function porAcordo(resposta: SimNaoNaoSei): Resultado {
  return resposta === 'sim' ? 'ok' : resposta === 'nao' ? 'falha' : 'depende';
}

interface Medidas {
  semanal: number;
  maxDiario: number;
  dias: number;
  e12x36: boolean;
}

function medir(f: Funcionario, grade: GradeSemanal, resumo: ResumoGrade): Medidas {
  const e12x36 = f.escalaAtual === '12x36' && grade === f.gradeAtual;
  if (e12x36) {
    const maxDiario = resumo.maxDiarioMin || 11 * 60;
    return { semanal: f.jornadaSemanalContratualMin || REGRAS.clt.regime12x36.mediaSemanalMin, maxDiario, dias: 3.5, e12x36 };
  }
  const semanal = resumo.diasTrabalhados > 0 ? resumo.totalSemanalMin : f.jornadaSemanalContratualMin;
  return { semanal, maxDiario: resumo.maxDiarioMin, dias: resumo.diasTrabalhados, e12x36 };
}

function avaliarEtapa(etapa: 1 | 2, m: Medidas, ctx: ContextoDiagnostico): AvaliacaoEtapa {
  const L = limitesDaEtapa(etapa);
  const motivos: Motivo[] = [];
  let r: Resultado = 'ok';
  const nome = `etapa ${etapa}`;

  if (m.e12x36) {
    if (m.semanal > L.limiteSemanalMin) {
      r = 'falha';
      motivos.push({
        codigo: `E${etapa}_12X36_MEDIA`,
        severidade: 'erro',
        texto: `Escala 12x36 com média de ${formatarDuracao(m.semanal)} por semana — acima do limite de ${formatarDuracao(L.limiteSemanalMin)} da ${nome}. Será preciso mudar a escala ou reduzir as horas.`,
      });
    } else {
      r = porAcordo(ctx.config.acordoRegimeCompensatorio);
      motivos.push({
        codigo: `E${etapa}_12X36`,
        severidade: r === 'ok' ? 'info' : 'aviso',
        texto:
          r === 'ok'
            ? `Escala 12x36 mantida como regime compensatório previsto em convenção/acordo coletivo (média de ${formatarDuracao(m.semanal)}).`
            : `Escala 12x36 só pode continuar se a convenção/acordo coletivo a previr como regime compensatório excepcional, respeitando ${formatarDuracao(L.limiteSemanalMin)} de média.`,
      });
    }
    return { resultado: r, motivos };
  }

  if (m.semanal > L.limiteSemanalMin) {
    r = 'falha';
    motivos.push({
      codigo: `E${etapa}_SEMANAL`,
      severidade: 'erro',
      texto: `Trabalha ${formatarDuracao(m.semanal)} por semana; o limite na ${nome} é ${formatarDuracao(L.limiteSemanalMin)}. Reduzir ${formatarDuracao(m.semanal - L.limiteSemanalMin)}, sem reduzir o salário.`,
    });
  }

  if (m.dias > L.diasTrabalhoMax) {
    const porCompensacao = porAcordo(ctx.config.acordoRegimeCompensatorio);
    const jaReduzida = m.semanal <= REGRAS.etapa2.limiteSemanalMin;
    r = pior(r, porCompensacao);
    motivos.push({
      codigo: `E${etapa}_DIAS`,
      severidade: porCompensacao === 'ok' ? 'info' : porCompensacao === 'depende' ? 'aviso' : 'erro',
      texto:
        porCompensacao === 'ok'
          ? `Trabalha ${m.dias} dias por semana: permitido apenas pelo regime compensatório previsto em convenção/acordo coletivo.`
          : jaReduzida && REGRAS.excecoes.quemJaCumpre40hOuMenos.ganhaDoisDiasDeRepouso
            ? `Já trabalha ${formatarDuracao(m.semanal)} por semana — não há nova redução de horas, mas passa a ter direito a 2 dias de repouso (hoje trabalha ${m.dias} dias).`
            : `Trabalha ${m.dias} dias por semana; a regra passa a ser 5 dias de trabalho e 2 de repouso (5x2). Outra escala só com regime compensatório em convenção/acordo coletivo.`,
    });
  }

  if (m.maxDiario > L.limiteDiarioMin) {
    const max = formatarDuracao(m.maxDiario);
    if (etapa === 1 && L.limiteDiarioComAcordoMin !== null && m.maxDiario <= L.limiteDiarioComAcordoMin) {
      const porAmpliacao = porAcordo(ctx.config.acordoAmpliaJornadaEtapa1);
      r = pior(r, porAmpliacao);
      motivos.push({
        codigo: 'E1_DIARIO',
        severidade: porAmpliacao === 'ok' ? 'info' : porAmpliacao === 'depende' ? 'aviso' : 'erro',
        texto:
          porAmpliacao === 'ok'
            ? `Jornada diária de ${max}: permitida na etapa 1 porque há convenção/acordo coletivo.`
            : `Jornada diária de ${max}: acima de 8 h só é permitida na etapa 1 com convenção/acordo coletivo${porAmpliacao === 'falha' ? ' — e a empresa informou que não há.' : '.'}`,
      });
    } else {
      r = 'falha';
      motivos.push({
        codigo: `E${etapa}_DIARIO`,
        severidade: 'erro',
        texto:
          etapa === 2
            ? `Jornada diária de ${max}: na etapa 2 o limite é ${formatarDuracao(L.limiteDiarioMin)} por dia (o excedente vira hora extra ou banco de horas).`
            : `Jornada diária de ${max}: acima do teto de ${formatarDuracao(L.limiteDiarioComAcordoMin ?? L.limiteDiarioMin)} mesmo com acordo coletivo.`,
      });
    }
  }

  return { resultado: r, motivos };
}

function resumoCurto(status: StatusDiagnostico, m: Medidas, temCLT: boolean): string {
  if (status === 'adequado') return 'Já atende às etapas 1 e 2.';
  const alvo = status === 'ajustar_etapa2' ? REGRAS.etapa2 : REGRAS.etapa1;
  const partes: string[] = [];
  if (m.e12x36) partes.push(`escala 12x36 (média de ${formatarDuracao(m.semanal)})`);
  else {
    if (m.dias > alvo.diasTrabalhoMaxSemana) partes.push(`${m.dias} dias de trabalho — precisa de 2 folgas`);
    if (m.semanal > alvo.limiteSemanalMin) partes.push(`${formatarDuracao(m.semanal)} semanais — limite ${formatarDuracao(alvo.limiteSemanalMin)}`);
    if (m.maxDiario > alvo.limiteDiarioMin) partes.push(`dia de ${formatarDuracao(m.maxDiario)} — acima de ${formatarDuracao(alvo.limiteDiarioMin)}`);
  }
  if (temCLT) partes.push('intervalo/descanso fora da CLT');
  const texto = partes.join('; ') || 'jornada fora dos novos limites';
  const frase = texto.charAt(0).toUpperCase() + texto.slice(1);
  return status === 'depende_acordo' ? `${frase} — pode continuar só se a convenção/acordo coletivo permitir.` : `${frase}.`;
}

/**
 * Diagnostica um funcionário. Por padrão analisa a grade que vai valer:
 * a nova (se já definida no simulador) ou a atual.
 */
export function diagnosticar(f: Funcionario, ctx: ContextoDiagnostico, base?: 'atual' | 'nova'): Diagnostico {
  const usar = base ?? (f.gradeNova ? 'nova' : 'atual');
  const grade = usar === 'nova' && f.gradeNova ? f.gradeNova : f.gradeAtual;
  const resumo = resumirGrade(grade);
  const m = medir(f, grade, resumo);
  const e1 = avaliarEtapa(1, m, ctx);
  const e2 = avaliarEtapa(2, m, ctx);
  const clt = m.e12x36 ? [] : problemasCLT(grade).filter((p) => p.severidade === 'erro');
  const temCLT = clt.length > 0;

  let status: StatusDiagnostico;
  let prazo: string | null;
  if (e1.resultado === 'falha' || temCLT) {
    status = 'ajustar_etapa1';
    prazo = ctx.prazos.inicioEtapa1;
  } else if (e1.resultado === 'depende') {
    status = 'depende_acordo';
    prazo = ctx.prazos.inicioEtapa1;
  } else if (e2.resultado === 'falha') {
    status = 'ajustar_etapa2';
    prazo = ctx.prazos.inicioEtapa2;
  } else if (e2.resultado === 'depende') {
    status = 'depende_acordo';
    prazo = ctx.prazos.inicioEtapa2;
  } else {
    status = 'adequado';
    prazo = null;
  }

  const motivos: Motivo[] = [];
  if (status === 'adequado') {
    motivos.push({
      codigo: 'OK',
      severidade: 'info',
      texto: `${usar === 'nova' ? 'A nova grade' : 'A jornada atual'} (${formatarDuracao(m.semanal)} por semana, ${m.e12x36 ? '12x36' : `${m.dias} dias`}) já atende às etapas 1 e 2.`,
    });
  }
  if (temCLT) {
    motivos.push(...clt.map((p) => ({ ...p, texto: `${p.texto} (problema que já existe hoje pela CLT)` })));
  }
  motivos.push(...e1.motivos.map((x) => ({ ...x, texto: `Etapa 1 (${formatarData(ctx.prazos.inicioEtapa1)}): ${x.texto}` })));
  motivos.push(...e2.motivos.map((x) => ({ ...x, texto: `Etapa 2 (${formatarData(ctx.prazos.inicioEtapa2)}): ${x.texto}` })));

  if (!m.e12x36 && resumo.diasTrabalhados > 0 && usar === 'atual') {
    const dif = Math.abs(resumo.totalSemanalMin - f.jornadaSemanalContratualMin);
    if (f.jornadaSemanalContratualMin > 0 && dif > 30) {
      motivos.push({
        codigo: 'GRADE_DIFERE_CONTRATO',
        severidade: 'info',
        texto: `Os horários somam ${formatarDuracao(resumo.totalSemanalMin)}, mas o contrato diz ${formatarDuracao(f.jornadaSemanalContratualMin)}. Confira o cadastro — o diagnóstico usa os horários.`,
      });
    }
  }
  if (resumo.trabalhaDomingo) {
    motivos.push({
      codigo: 'DOMINGO',
      severidade: 'info',
      texto: `Trabalha aos domingos: o revezamento deve garantir ao menos 1 domingo de folga a cada ${ctx.config.domingoFolgaACadaSemanas} semanas.`,
    });
  }

  return {
    status,
    prazo,
    resumoCurto: resumoCurto(status, m, temCLT),
    motivos,
    etapa1: e1,
    etapa2: e2,
    adequadoEtapa1: e1.resultado === 'ok' && !temCLT,
    adequadoEtapa2: e2.resultado === 'ok' && !temCLT,
    semanalConsideradoMin: m.semanal,
    maxDiarioConsideradoMin: m.maxDiario,
    diasTrabalhados: resumo.diasTrabalhados,
    resumo,
    base: usar,
  };
}

export interface IndicadoresAdequacao {
  total: number;
  adequadosEtapa1: number;
  adequadosEtapa2: number;
  percEtapa1: number;
  percEtapa2: number;
  porStatus: Record<StatusDiagnostico, number>;
}

export function indicadores(diags: Diagnostico[]): IndicadoresAdequacao {
  const porStatus: Record<StatusDiagnostico, number> = { adequado: 0, ajustar_etapa1: 0, ajustar_etapa2: 0, depende_acordo: 0 };
  for (const d of diags) porStatus[d.status]++;
  const total = diags.length;
  const a1 = diags.filter((d) => d.adequadoEtapa1).length;
  const a2 = diags.filter((d) => d.adequadoEtapa2).length;
  return {
    total,
    adequadosEtapa1: a1,
    adequadosEtapa2: a2,
    percEtapa1: total ? (a1 / total) * 100 : 0,
    percEtapa2: total ? (a2 / total) * 100 : 0,
    porStatus,
  };
}

export function contextoDiagnostico(prazos: Prazos, config?: ConfigEmpresa | null): ContextoDiagnostico {
  return {
    prazos,
    config: {
      acordoAmpliaJornadaEtapa1: config?.acordoAmpliaJornadaEtapa1 ?? 'nao_sei',
      acordoRegimeCompensatorio: config?.acordoRegimeCompensatorio ?? 'nao_sei',
      domingoFolgaACadaSemanas: config?.domingoFolgaACadaSemanas ?? REGRAS.domingos.folgaACadaSemanasPadrao,
    },
  };
}
