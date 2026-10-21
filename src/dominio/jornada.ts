/**
 * Cálculos e validações de uma grade semanal (horas, intervalos, interjornada, repousos).
 * Limites vêm de REGRAS (via etapas.ts).
 */
import { REGRAS } from '../config/regras-ec141';
import { limitesDaEtapa, type NumeroEtapa } from './etapas';
import { duracaoPeriodo, formatarDuracao, horarioValido, paraMinutos } from './tempo';
import {
  DIAS_SEMANA,
  NOME_DIA,
  type DiaFuncionamento,
  type DiaSemana,
  type GradeSemanal,
  type Motivo,
  type SimNaoNaoSei,
} from './tipos';

export interface ResumoDia {
  dia: DiaSemana;
  trabalha: boolean;
  valido: boolean;
  /** Tempo entre entrada e saída. */
  brutoMin: number;
  intervaloMin: number;
  /** Tempo efetivamente trabalhado (bruto − intervalo). */
  trabalhadoMin: number;
  /** Minutos desde domingo 00:00 da semana. */
  inicioAbs: number;
  fimAbs: number;
  viraMeiaNoite: boolean;
}

export interface ResumoGrade {
  dias: ResumoDia[];
  totalSemanalMin: number;
  diasTrabalhados: number;
  diasFolga: number;
  maxDiarioMin: number;
  trabalhaDomingo: boolean;
}

export function resumirDia(dia: DiaSemana, g: GradeSemanal): ResumoDia {
  const d = g[dia];
  const indice = DIAS_SEMANA.indexOf(dia);
  const vazio: ResumoDia = {
    dia,
    trabalha: false,
    valido: true,
    brutoMin: 0,
    intervaloMin: 0,
    trabalhadoMin: 0,
    inicioAbs: indice * 1440,
    fimAbs: indice * 1440,
    viraMeiaNoite: false,
  };
  if (!d.trabalha) return vazio;
  if (!horarioValido(d.entrada) || !horarioValido(d.saida) || d.entrada === d.saida) {
    return { ...vazio, trabalha: true, valido: false };
  }
  const bruto = duracaoPeriodo(d.entrada, d.saida);
  const intervalo = Math.max(0, d.intervaloMin || 0);
  const inicio = indice * 1440 + paraMinutos(d.entrada);
  return {
    dia,
    trabalha: true,
    valido: intervalo < bruto,
    brutoMin: bruto,
    intervaloMin: intervalo,
    trabalhadoMin: Math.max(0, bruto - intervalo),
    inicioAbs: inicio,
    fimAbs: inicio + bruto,
    viraMeiaNoite: paraMinutos(d.saida) <= paraMinutos(d.entrada),
  };
}

export function resumirGrade(g: GradeSemanal): ResumoGrade {
  const dias = DIAS_SEMANA.map((d) => resumirDia(d, g));
  const trabalhados = dias.filter((d) => d.trabalha);
  return {
    dias,
    totalSemanalMin: trabalhados.reduce((s, d) => s + d.trabalhadoMin, 0),
    diasTrabalhados: trabalhados.length,
    diasFolga: 7 - trabalhados.length,
    maxDiarioMin: trabalhados.reduce((m, d) => Math.max(m, d.trabalhadoMin), 0),
    trabalhaDomingo: g.dom.trabalha,
  };
}

/** Intervalo intrajornada mínimo exigido pela CLT (art. 71) para um tempo trabalhado. */
export function intervaloMinimoExigido(trabalhadoMin: number): number {
  const r = REGRAS.clt.intervaloIntrajornada;
  if (trabalhadoMin > r.limiteJornada6hMin) return r.acimaDe6hMin;
  if (trabalhadoMin > r.limiteJornada4hMin) return r.de4a6hMin;
  return 0;
}

/**
 * Intervalo mínimo que torna válido um período bruto (entrada→saída) quando o intervalo não foi informado.
 * Ex.: 8h20 brutas → 60 min; 6h brutas → 15 min; 4h brutas → 0.
 */
export function intervaloPresumido(brutoMin: number): number {
  const r = REGRAS.clt.intervaloIntrajornada;
  if (brutoMin > r.limiteJornada6hMin + r.de4a6hMin) return r.acimaDe6hMin;
  if (brutoMin > r.limiteJornada4hMin) return r.de4a6hMin;
  return 0;
}

export interface Interjornada {
  de: DiaSemana;
  para: DiaSemana;
  descansoMin: number;
}

/**
 * Descanso entre o fim de um dia trabalhado e o início do próximo dia trabalhado
 * (considera a semana circular: sábado → domingo seguinte).
 */
export function calcularInterjornadas(g: GradeSemanal): Interjornada[] {
  const dias = DIAS_SEMANA.map((d) => resumirDia(d, g)).filter((d) => d.trabalha && d.valido);
  if (dias.length < 2) return [];
  const r: Interjornada[] = [];
  for (let i = 0; i < dias.length; i++) {
    const atual = dias[i];
    const proximo = dias[(i + 1) % dias.length];
    const inicioProx = i + 1 < dias.length ? proximo.inicioAbs : proximo.inicioAbs + 7 * 1440;
    r.push({ de: atual.dia, para: proximo.dia, descansoMin: inicioProx - atual.fimAbs });
  }
  return r;
}

export interface OpcoesValidacao {
  etapa: NumeroEtapa;
  /** Convenção/acordo coletivo permite jornada diária acima de 8 h na etapa 1. */
  acordoAmpliaDiaria: SimNaoNaoSei;
  /** Convenção/acordo coletivo prevê regime compensatório diferente da 5x2. */
  acordoRegimeCompensatorio: SimNaoNaoSei;
  domingoFolgaACadaSemanas: number;
  funcionamento?: Record<DiaSemana, DiaFuncionamento>;
}

export interface ResultadoValidacao {
  resumo: ResumoGrade;
  problemas: Motivo[];
  /** Sem nenhum problema de severidade "erro". */
  valida: boolean;
}

const ROTULO_ETAPA: Record<NumeroEtapa, string> = { 0: 'hoje (regra antiga)', 1: 'na etapa 1', 2: 'na etapa 2' };

/** Problemas de CLT que valem em qualquer etapa (intervalo, interjornada, horários). */
export function problemasCLT(g: GradeSemanal): Motivo[] {
  const p: Motivo[] = [];
  const r = REGRAS.clt.intervaloIntrajornada;
  for (const d of DIAS_SEMANA.map((x) => resumirDia(x, g))) {
    if (!d.trabalha) continue;
    const nome = NOME_DIA[d.dia];
    if (!d.valido) {
      p.push({ codigo: 'HORARIO_INVALIDO', severidade: 'erro', texto: `${nome}: horários de entrada/saída ou intervalo inválidos.` });
      continue;
    }
    const minimo = intervaloMinimoExigido(d.trabalhadoMin);
    if (d.intervaloMin < minimo) {
      p.push({
        codigo: 'INTERVALO_INSUFICIENTE',
        severidade: 'erro',
        texto: `${nome}: intervalo de ${formatarDuracao(d.intervaloMin)} — para ${formatarDuracao(d.trabalhadoMin)} de trabalho o mínimo é ${formatarDuracao(minimo)} (CLT art. 71).`,
      });
    }
    if (d.intervaloMin > r.maximoSemAcordoMin) {
      p.push({
        codigo: 'INTERVALO_EXCESSIVO',
        severidade: 'aviso',
        texto: `${nome}: intervalo acima de ${formatarDuracao(r.maximoSemAcordoMin)} só é válido com acordo escrito ou coletivo.`,
      });
    }
  }
  for (const ij of calcularInterjornadas(g)) {
    if (ij.descansoMin < REGRAS.clt.interjornadaMin.valor) {
      p.push({
        codigo: 'INTERJORNADA',
        severidade: 'erro',
        texto: `Entre ${NOME_DIA[ij.de]} e ${NOME_DIA[ij.para]} o descanso é de ${formatarDuracao(ij.descansoMin)}; o mínimo é ${formatarDuracao(REGRAS.clt.interjornadaMin.valor)} (CLT art. 66).`,
      });
    }
  }
  return p;
}

/** Valida a grade contra os limites da etapa escolhida. Usada para alertas em tempo real. */
export function validarGrade(g: GradeSemanal, op: OpcoesValidacao): ResultadoValidacao {
  const resumo = resumirGrade(g);
  const L = limitesDaEtapa(op.etapa);
  const p: Motivo[] = [...problemasCLT(g)];
  const quando = ROTULO_ETAPA[op.etapa];

  if (resumo.diasTrabalhados === 0) {
    p.push({ codigo: 'SEM_DIAS', severidade: 'aviso', texto: 'Nenhum dia de trabalho marcado.' });
  }

  // Limite semanal
  if (resumo.totalSemanalMin > L.limiteSemanalMin) {
    p.push({
      codigo: 'SEMANAL_ACIMA',
      severidade: 'erro',
      texto: `Total de ${formatarDuracao(resumo.totalSemanalMin)} por semana — o limite ${quando} é ${formatarDuracao(L.limiteSemanalMin)}.`,
    });
  }

  // Dias de repouso
  if (resumo.diasTrabalhados > L.diasTrabalhoMax) {
    if (op.etapa === 0) {
      p.push({ codigo: 'DIAS_ACIMA', severidade: 'erro', texto: 'É obrigatório ao menos 1 dia de repouso por semana.' });
    } else if (op.acordoRegimeCompensatorio === 'sim') {
      p.push({
        codigo: 'DIAS_ACIMA_COM_ACORDO',
        severidade: 'aviso',
        texto: `${resumo.diasTrabalhados} dias de trabalho: só é permitido porque há regime compensatório previsto em convenção/acordo coletivo (exceção à 5x2), respeitando os limites de horas.`,
      });
    } else {
      p.push({
        codigo: 'DIAS_ACIMA',
        severidade: 'erro',
        texto: `${resumo.diasTrabalhados} dias de trabalho e ${resumo.diasFolga} de repouso — a regra ${quando} é 5 dias de trabalho e ${L.diasRepouso} de repouso (5x2). Outra escala só com regime compensatório previsto em convenção/acordo coletivo.`,
      });
    }
  }

  // Limite diário
  if (resumo.maxDiarioMin > L.limiteDiarioMin) {
    const max = formatarDuracao(resumo.maxDiarioMin);
    if (op.etapa === 0) {
      p.push({
        codigo: 'DIARIO_ACIMA',
        severidade: 'aviso',
        texto: `Jornada diária de ${max}: acima de 8 h só com acordo de compensação (CLT art. 59).`,
      });
    } else if (op.etapa === 1 && L.limiteDiarioComAcordoMin !== null && resumo.maxDiarioMin <= L.limiteDiarioComAcordoMin) {
      p.push({
        codigo: 'DIARIO_ACIMA_ETAPA1',
        severidade: op.acordoAmpliaDiaria === 'sim' ? 'aviso' : 'erro',
        texto:
          op.acordoAmpliaDiaria === 'sim'
            ? `Jornada diária de ${max}: permitida somente na etapa 1 e porque há convenção/acordo coletivo. A partir da etapa 2 o limite volta a ser 8 h.`
            : `Jornada diária de ${max}: jornada diária acima de 8 h só é permitida na etapa 1 com acordo coletivo.`,
      });
    } else {
      p.push({
        codigo: 'DIARIO_ACIMA',
        severidade: 'erro',
        texto:
          op.etapa === 1
            ? `Jornada diária de ${max}: acima do teto de ${formatarDuracao(L.limiteDiarioComAcordoMin ?? L.limiteDiarioMin)} adotado mesmo com acordo coletivo.`
            : `Jornada diária de ${max}: o limite ${quando} é ${formatarDuracao(L.limiteDiarioMin)} por dia; o excedente é hora extra ou banco de horas.`,
      });
    }
  }

  // Domingos
  if (resumo.trabalhaDomingo && op.etapa >= 1) {
    p.push({
      codigo: 'DOMINGO',
      severidade: 'info',
      texto: `Trabalha aos domingos: garanta pelo revezamento ao menos 1 domingo de folga a cada ${op.domingoFolgaACadaSemanas} semanas.`,
    });
  }

  // Horário de funcionamento
  if (op.funcionamento) {
    for (const d of resumo.dias) {
      if (!d.trabalha || !d.valido) continue;
      const f = op.funcionamento[d.dia];
      const dia = g[d.dia];
      if (!f.aberto) {
        p.push({ codigo: 'FORA_FUNCIONAMENTO', severidade: 'aviso', texto: `${NOME_DIA[d.dia]}: a empresa está marcada como fechada neste dia.` });
      } else if (!d.viraMeiaNoite && horarioValido(f.abre) && horarioValido(f.fecha) && paraMinutos(f.fecha) > paraMinutos(f.abre)) {
        if (paraMinutos(dia.entrada) < paraMinutos(f.abre) - 120 || paraMinutos(dia.saida) > paraMinutos(f.fecha) + 120) {
          p.push({
            codigo: 'FORA_FUNCIONAMENTO',
            severidade: 'info',
            texto: `${NOME_DIA[d.dia]}: horário ${dia.entrada}–${dia.saida} bem fora do funcionamento (${f.abre}–${f.fecha}).`,
          });
        }
      }
    }
  }

  return { resumo, problemas: p, valida: !p.some((x) => x.severidade === 'erro') };
}

/** Rótulo curto da grade, ex.: 'Seg–Sex 08:00–17:00' ou 'Dom, Seg, Ter… (6 dias)'. */
export function descreverGrade(g: GradeSemanal): string {
  const trab = DIAS_SEMANA.filter((d) => g[d].trabalha);
  if (trab.length === 0) return 'Sem dias de trabalho';
  const horarios = new Set(trab.map((d) => `${g[d].entrada}–${g[d].saida}`));
  const nomes = trab.map((d) => NOME_DIA[d].slice(0, 3)).join(', ');
  return horarios.size === 1 ? `${nomes} · ${[...horarios][0]}` : `${nomes} · horários variados`;
}
