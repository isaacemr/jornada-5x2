/**
 * Gera opções de grade semanal para 42 h (etapa 1) e 40 h (etapa 2),
 * respeitando intervalo intrajornada, interjornada e os dois dias de repouso.
 */
import { REGRAS } from '../config/regras-ec141';
import { gradeVazia } from '../dados/padroes';
import type { NumeroEtapa } from './etapas';
import { intervaloMinimoExigido, validarGrade, type OpcoesValidacao, type ResultadoValidacao } from './jornada';
import { formatarDuracao, paraHorario, paraMinutos } from './tempo';
import { DIAS_SEMANA, type DiaJornada, type DiaSemana, type GradeSemanal } from './tipos';

/** Monta um dia a partir da entrada e do tempo a trabalhar, já com o intervalo mínimo legal. */
export function montarDia(entrada: string, trabalhadoMin: number): DiaJornada {
  const intervalo = intervaloMinimoExigido(trabalhadoMin);
  return {
    trabalha: true,
    entrada,
    saida: paraHorario(paraMinutos(entrada) + trabalhadoMin + intervalo),
    intervaloMin: intervalo,
  };
}

/** Grade com uma duração para cada dia indicado (na ordem dada). */
export function gradeComDuracoes(dias: DiaSemana[], duracoes: number[], entrada: string): GradeSemanal {
  const g = gradeVazia();
  dias.forEach((d, i) => {
    g[d] = montarDia(entrada, duracoes[i] ?? duracoes[duracoes.length - 1]);
  });
  return g;
}

export type ClassificacaoOpcao = 'valida' | 'valida_com_acordo' | 'depende_acordo' | 'invalida';

export interface OpcaoGrade {
  id: string;
  titulo: string;
  descricao: string;
  grade: GradeSemanal;
  totalSemanalMin: number;
  /** Exige convenção/acordo coletivo para ser usada. */
  requerAcordo: boolean;
  classificacao: ClassificacaoOpcao;
  validacao: ResultadoValidacao;
}

export interface ParametrosOpcoes {
  etapa: 1 | 2;
  /** Horário de entrada padrão. */
  entrada: string;
  /** Cinco dias de trabalho escolhidos (ordem da semana). */
  diasTrabalho: DiaSemana[];
  validacao: Omit<OpcoesValidacao, 'etapa'>;
}

/** Ordena dias na ordem da semana (dom..sab). */
export function ordenarDias(dias: DiaSemana[]): DiaSemana[] {
  return DIAS_SEMANA.filter((d) => dias.includes(d));
}

/** Escolhe um sexto dia (para regimes compensatórios) — o primeiro dia livre depois do último dia de trabalho. */
function sextoDia(dias: DiaSemana[]): DiaSemana | null {
  const livres = DIAS_SEMANA.filter((d) => !dias.includes(d));
  if (livres.length === 0) return null;
  const preferencia: DiaSemana[] = ['sab', 'seg', 'ter', 'qua', 'qui', 'sex', 'dom'];
  return preferencia.find((d) => livres.includes(d)) ?? livres[0];
}

interface Modelo {
  id: string;
  titulo: string;
  descricao: string;
  duracoes: number[];
  seisDias?: boolean;
  requerAcordo: boolean;
}

function modelos(etapa: 1 | 2): Modelo[] {
  const alvo = etapa === 1 ? REGRAS.etapa1.limiteSemanalMin : REGRAS.etapa2.limiteSemanalMin;
  const oito = REGRAS.etapa2.limiteDiarioMin;
  const igual5 = Math.round(alvo / 5);
  const igual6 = Math.round(alvo / 6);
  if (etapa === 1) {
    const nove = 9 * 60;
    const resto = alvo - 4 * nove;
    const oitoMeia = 8 * 60 + 30;
    const resto2 = alvo - 4 * oitoMeia;
    return [
      {
        id: 'e1-5-iguais',
        titulo: `${formatarDuracao(igual5)} × 5 dias`,
        descricao: `Distribui as ${formatarDuracao(alvo)} igualmente em 5 dias. Mais de 8 h por dia: só na etapa 1 e com convenção/acordo coletivo.`,
        duracoes: [igual5],
        requerAcordo: igual5 > oito,
      },
      {
        id: 'e1-4x9-1x6',
        titulo: `${formatarDuracao(nove)} × 4 dias + ${formatarDuracao(resto)} no 5º dia`,
        descricao: 'Quatro dias longos e um dia curto (ex.: sexta mais cedo). Exige convenção/acordo coletivo.',
        duracoes: [nove, nove, nove, nove, resto],
        requerAcordo: true,
      },
      {
        id: 'e1-4x830-1x8',
        titulo: `${formatarDuracao(oitoMeia)} × 4 dias + ${formatarDuracao(resto2)} no 5º dia`,
        descricao: 'Variação mais suave, também acima de 8 h em alguns dias. Exige convenção/acordo coletivo.',
        duracoes: [oitoMeia, oitoMeia, oitoMeia, oitoMeia, resto2],
        requerAcordo: true,
      },
      {
        id: 'e1-5x8',
        titulo: `${formatarDuracao(oito)} × 5 dias (já em 40 h)`,
        descricao: 'Antecipa a regra da etapa 2: não depende de acordo e evita um segundo ajuste em 2027.',
        duracoes: [oito],
        requerAcordo: false,
      },
      {
        id: 'e1-6dias',
        titulo: `${formatarDuracao(igual6)} × 6 dias (regime compensatório)`,
        descricao: 'Mantém 6 dias de trabalho dentro das 42 h. Só é possível se a convenção/acordo coletivo prever regime compensatório excepcional.',
        duracoes: [igual6],
        seisDias: true,
        requerAcordo: true,
      },
    ];
  }
  return [
    {
      id: 'e2-5x8',
      titulo: `${formatarDuracao(oito)} × 5 dias`,
      descricao: 'Formato padrão da etapa 2: 8 h por dia, 5 dias, 2 de repouso.',
      duracoes: [oito],
      requerAcordo: false,
    },
    {
      id: 'e2-5-iguais-menor',
      titulo: `${formatarDuracao(7 * 60 + 48)} × 5 dias (39 h)`,
      descricao: 'Abaixo do limite, com folga para tolerâncias e trocas de turno sem gerar hora extra.',
      duracoes: [7 * 60 + 48],
      requerAcordo: false,
    },
    {
      id: 'e2-6dias',
      titulo: `${formatarDuracao(igual6)} × 6 dias (regime compensatório)`,
      descricao: 'Mantém 6 dias de trabalho dentro das 40 h. Só com regime compensatório previsto em convenção/acordo coletivo.',
      duracoes: [igual6],
      seisDias: true,
      requerAcordo: true,
    },
  ];
}

/**
 * Classifica a opção. Se os únicos impedimentos dependem de um acordo coletivo
 * cuja existência a empresa ainda não sabe ("não sei"), a opção "depende de acordo".
 */
export function classificar(v: ResultadoValidacao, requerAcordo: boolean, op: Omit<OpcoesValidacao, 'etapa'>): ClassificacaoOpcao {
  if (v.valida) return requerAcordo ? 'valida_com_acordo' : 'valida';
  const erros = v.problemas.filter((p) => p.severidade === 'erro').map((p) => p.codigo);
  const resolvivelPorAcordo = erros.every(
    (c) =>
      (c === 'DIARIO_ACIMA_ETAPA1' && op.acordoAmpliaDiaria === 'nao_sei') ||
      (c === 'DIAS_ACIMA' && op.acordoRegimeCompensatorio === 'nao_sei'),
  );
  return resolvivelPorAcordo ? 'depende_acordo' : 'invalida';
}

/** Gera as opções de grade para a etapa escolhida e valida cada uma. */
export function gerarOpcoes(p: ParametrosOpcoes): OpcaoGrade[] {
  const dias5 = ordenarDias(p.diasTrabalho).slice(0, 5);
  if (dias5.length === 0) return [];
  return modelos(p.etapa).map((m) => {
    let dias = dias5;
    if (m.seisDias) {
      const extra = sextoDia(dias5);
      dias = extra ? ordenarDias([...dias5, extra]) : dias5;
    }
    const grade = gradeComDuracoes(dias, m.duracoes, p.entrada);
    const validacao = validarGrade(grade, { ...p.validacao, etapa: p.etapa as NumeroEtapa });
    return {
      id: m.id,
      titulo: m.titulo,
      descricao: m.descricao,
      grade,
      totalSemanalMin: validacao.resumo.totalSemanalMin,
      requerAcordo: m.requerAcordo,
      classificacao: classificar(validacao, m.requerAcordo, p.validacao),
      validacao,
    };
  });
}

/** Sugere os 5 dias de trabalho a partir da grade atual (mantém os dias já trabalhados; tira o de menor carga). */
export function sugerirDiasTrabalho(atual: GradeSemanal): DiaSemana[] {
  const trab = DIAS_SEMANA.filter((d) => atual[d].trabalha);
  if (trab.length === 5) return trab;
  if (trab.length < 5) return ordenarDias([...trab, ...(['seg', 'ter', 'qua', 'qui', 'sex'] as DiaSemana[])]).slice(0, 5);
  // Mais de 5 dias: retira primeiro o sábado, depois o domingo, depois os demais.
  const ordemRetirada: DiaSemana[] = ['sab', 'dom', 'seg', 'sex', 'ter', 'qui', 'qua'];
  const r = [...trab];
  for (const d of ordemRetirada) {
    if (r.length <= 5) break;
    const i = r.indexOf(d);
    if (i >= 0) r.splice(i, 1);
  }
  return ordenarDias(r);
}
