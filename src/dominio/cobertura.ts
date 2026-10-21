/**
 * Calculadora de cobertura para atividades contínuas na escala 5x2:
 * quantas pessoas por turno, revezamento de folgas (com domingos), lacuna e custos.
 */
import { REGRAS } from '../config/regras-ec141';
import { limitesDaEtapa } from './etapas';
import { arred2 } from './remuneracao';
import { duracaoPeriodo, formatarDuracao } from './tempo';
import { DIAS_SEMANA, type DiaSemana, type TurnoBase, type TurnoCobertura } from './tipos';

/** Tempo efetivamente trabalhado num turno (sem o intervalo). */
export function duracaoTrabalhadaTurno(t: TurnoBase): number {
  return Math.max(0, duracaoPeriodo(t.inicio, t.fim) - (t.intervaloMin || 0));
}

// ---------------------------------------------------------------- revezamento

export interface ParamsRevezamento {
  pessoas: number;
  demanda: Record<DiaSemana, number>;
  semanas: number;
  /** Ao menos 1 domingo de folga a cada N semanas. */
  domingoFolgaACadaSemanas: number;
  /** Folgas por semana (padrão 2 = escala 5x2). */
  folgasPorSemana?: number;
  /** Deslocamento para variar quem folga primeiro (útil com vários turnos). */
  deslocamento?: number;
}

export interface Revezamento {
  /** trabalha[semana][pessoa][dia] (dia 0 = domingo). */
  trabalha: boolean[][][];
  /** Pessoas trabalhando por semana e dia. */
  cobertura: number[][];
  /** Vagas não cobertas por semana e dia. */
  descoberto: number[][];
  totalDescoberto: number;
  /** Maior sequência de semanas sem folga aos domingos, por pessoa (considerando o ciclo repetido). */
  maiorEsperaDomingo: number[];
  domingoOk: boolean;
}

/**
 * Gera um revezamento de folgas: cada pessoa tem `folgasPorSemana` folgas;
 * as folgas de domingo giram para que todos folguem ao menos 1 domingo a cada N semanas;
 * as demais folgas vão para os dias com mais sobra de pessoas.
 */
export function gerarRevezamento(p: ParamsRevezamento): Revezamento {
  const n = Math.max(0, Math.floor(p.pessoas));
  const folgasMeta = p.folgasPorSemana ?? 2;
  const dem = DIAS_SEMANA.map((d) => Math.max(0, p.demanda[d] || 0));
  const desl = p.deslocamento ?? 0;
  const trabalha: boolean[][][] = [];
  const cobertura: number[][] = [];
  const descoberto: number[][] = [];
  const desdeDomingo = Array.from({ length: n }, () => 0);
  const historicoDomingo: boolean[][] = Array.from({ length: n }, () => []);

  for (let w = 0; w < p.semanas; w++) {
    const t = Array.from({ length: n }, () => Array<boolean>(7).fill(true));
    const folgas = Array<number>(n).fill(0);

    // Dias sem operação: todos folgam.
    dem.forEach((q, d) => {
      if (q === 0) for (let i = 0; i < n; i++) {
        t[i][d] = false;
        folgas[i]++;
      }
    });

    // Domingo: quem está há mais tempo sem folgar no domingo folga primeiro.
    if (dem[0] > 0) {
      const k = Math.max(0, n - dem[0]);
      const ordem = [...Array(n).keys()].sort((a, b) => desdeDomingo[b] - desdeDomingo[a] || ((a - w * k - desl) % n + n) % n - ((b - w * k - desl) % n + n) % n);
      for (const i of ordem.slice(0, k)) {
        t[i][0] = false;
        folgas[i]++;
      }
    }
    for (let i = 0; i < n; i++) {
      const folgou = !t[i][0];
      historicoDomingo[i].push(folgou);
      desdeDomingo[i] = folgou ? 0 : desdeDomingo[i] + 1;
    }

    // Demais folgas: dia com maior sobra; preferência por folgas consecutivas.
    const cob = dem.map((_, d) => t.reduce((s, linha) => s + (linha[d] ? 1 : 0), 0));
    const pendentes = () => [...Array(n).keys()].filter((i) => folgas[i] < folgasMeta);
    let guarda = n * 7 + 10;
    while (pendentes().length > 0 && guarda-- > 0) {
      const ps = pendentes().sort((a, b) => folgas[a] - folgas[b] || ((a + w + desl) % n) - ((b + w + desl) % n));
      const i = ps[0];
      let melhor = -1;
      let melhorNota = -Infinity;
      for (let d = 1; d < 7; d++) {
        if (!t[i][d]) continue;
        const sobra = cob[d] - dem[d];
        const vizinhoFolga = (!t[i][(d + 6) % 7] ? 1 : 0) + (!t[i][(d + 1) % 7] ? 1 : 0);
        const nota = sobra * 10 + vizinhoFolga * 3 - ((d + i + w + desl) % 6) * 0.1;
        if (nota > melhorNota) {
          melhorNota = nota;
          melhor = d;
        }
      }
      if (melhor < 0) break;
      t[i][melhor] = false;
      cob[melhor]--;
      folgas[i]++;
    }

    trabalha.push(t);
    cobertura.push(cob);
    const desc = dem.map((q, d) => Math.max(0, q - cob[d]));
    descoberto.push(desc);
  }

  // Maior espera por domingo de folga (ciclo repetido).
  const maiorEsperaDomingo = historicoDomingo.map((h) => {
    if (h.length === 0) return 0;
    if (!h.some(Boolean)) return Infinity;
    const duplo = [...h, ...h];
    let maior = 0;
    let atual = 0;
    for (const f of duplo) {
      atual = f ? 0 : atual + 1;
      maior = Math.max(maior, atual);
    }
    return maior;
  });
  const N = p.domingoFolgaACadaSemanas;
  const domingoOk = dem[0] === 0 || maiorEsperaDomingo.every((x) => x + 1 <= N);

  return {
    trabalha,
    cobertura,
    descoberto,
    totalDescoberto: descoberto.flat().reduce((s, x) => s + x, 0),
    maiorEsperaDomingo,
    domingoOk,
  };
}

// ---------------------------------------------------------------- dimensionamento

export interface LimitesCobertura {
  limiteSemanalMin: number;
  limiteDiarioMin: number;
  diasTrabalhoMax: number;
}

export function limitesParaCobertura(etapa: 1 | 2, acordoAmpliaDiaria: boolean): LimitesCobertura {
  const L = limitesDaEtapa(etapa);
  return {
    limiteSemanalMin: L.limiteSemanalMin,
    limiteDiarioMin: acordoAmpliaDiaria && L.limiteDiarioComAcordoMin ? L.limiteDiarioComAcordoMin : L.limiteDiarioMin,
    diasTrabalhoMax: L.diasTrabalhoMax,
  };
}

export interface ResultadoTurno {
  turno: TurnoCobertura;
  duracaoMin: number;
  diasPorPessoa: number;
  vagasSemana: number;
  pico: number;
  minimoPorCarga: number;
  minimoPorDomingo: number;
  pessoasNecessarias: number;
  pessoasAlocadas: number;
  revezamento: Revezamento;
  horasDescobertasSemana: number;
  horasDescobertasDomingoSemana: number;
  alertas: string[];
}

/** Menor número de pessoas que cobre o turno com o revezamento (sem vagas descobertas e respeitando domingos). */
export function dimensionarTurno(t: TurnoCobertura, L: LimitesCobertura, domingoACadaSemanas: number): Omit<ResultadoTurno, 'pessoasAlocadas' | 'revezamento' | 'horasDescobertasSemana' | 'horasDescobertasDomingoSemana'> {
  const alertas: string[] = [];
  const dur = duracaoTrabalhadaTurno(t);
  if (dur > L.limiteDiarioMin) {
    alertas.push(`Turno de ${formatarDuracao(dur)} passa do limite diário de ${formatarDuracao(L.limiteDiarioMin)}. Divida em dois turnos.`);
  }
  let diasPorPessoa = dur > 0 ? Math.min(L.diasTrabalhoMax, Math.floor(L.limiteSemanalMin / dur)) : L.diasTrabalhoMax;
  if (diasPorPessoa < L.diasTrabalhoMax) {
    alertas.push(
      `Com ${formatarDuracao(dur)} por dia, cada pessoa só pode trabalhar ${diasPorPessoa} dias sem passar de ${formatarDuracao(L.limiteSemanalMin)} semanais.`,
    );
  }
  diasPorPessoa = Math.max(1, diasPorPessoa);
  const dem = DIAS_SEMANA.map((d) => Math.max(0, t.demanda[d] || 0));
  const vagas = dem.reduce((s, x) => s + x, 0);
  const pico = Math.max(0, ...dem);
  const minimoPorCarga = Math.ceil(vagas / diasPorPessoa);
  let minimoPorDomingo = 0;
  if (dem[0] > 0) {
    if (domingoACadaSemanas <= 1) {
      alertas.push('Com folga em todos os domingos não é possível manter este turno aos domingos.');
      minimoPorDomingo = dem[0];
    } else {
      minimoPorDomingo = Math.ceil((dem[0] * domingoACadaSemanas) / (domingoACadaSemanas - 1));
    }
  }
  let n = Math.max(minimoPorCarga, pico, minimoPorDomingo);
  if (vagas > 0) {
    // Confirma com o revezamento real (o arredondamento pode exigir mais 1 ou 2 pessoas).
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const r = gerarRevezamento({ pessoas: n, demanda: t.demanda, semanas: Math.max(domingoACadaSemanas, 1), domingoFolgaACadaSemanas: domingoACadaSemanas, folgasPorSemana: 7 - diasPorPessoa });
      if (r.totalDescoberto === 0 && (r.domingoOk || domingoACadaSemanas <= 1)) break;
      n++;
    }
  }
  return { turno: t, duracaoMin: dur, diasPorPessoa, vagasSemana: vagas, pico, minimoPorCarga, minimoPorDomingo, pessoasNecessarias: n, alertas };
}

/** Distribui `total` pessoas entre turnos proporcionalmente à necessidade (maiores restos). */
export function alocarPessoas(total: number, necessidades: number[]): number[] {
  const soma = necessidades.reduce((s, x) => s + x, 0);
  if (soma === 0 || total <= 0) return necessidades.map(() => 0);
  if (total >= soma) {
    // Sobra: distribui o excedente proporcionalmente também.
    const extra = total - soma;
    const base = necessidades.map((x) => x + Math.floor((extra * x) / soma));
    let resto = total - base.reduce((s, x) => s + x, 0);
    for (let i = 0; resto > 0; i = (i + 1) % base.length, resto--) base[i]++;
    return base;
  }
  const exatos = necessidades.map((x) => (total * x) / soma);
  const base = exatos.map(Math.floor);
  let resto = total - base.reduce((s, x) => s + x, 0);
  const ordem = exatos.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordem) {
    if (resto <= 0) break;
    base[i]++;
    resto--;
  }
  return base;
}

// ---------------------------------------------------------------- custos

export interface ParamsCusto {
  /** Salário de referência para a função. */
  salarioReferencia: number;
  /** Encargos (0,7 = 70%); null = não informado. */
  encargosPercentual: number | null;
  divisor: number;
  adicionalHoraExtra: number;
  adicionalDomingo: number;
  pessoasAtuais: number;
}

export interface Alternativa {
  id: 'contratar' | 'hora_extra' | 'banco_horas' | 'horario';
  titulo: string;
  custoMensal: number | null;
  detalhe: string;
  observacoes: string[];
  viavel: boolean;
}

export interface ResultadoCobertura {
  turnos: ResultadoTurno[];
  pessoasNecessarias: number;
  pessoasAtuais: number;
  faltam: number;
  horasDescobertasSemana: number;
  horasDescobertasMes: number;
  alternativas: Alternativa[];
}

export interface ParamsCalculo {
  turnos: TurnoCobertura[];
  limites: LimitesCobertura;
  domingoFolgaACadaSemanas: number;
  pessoasAtuais: number;
  custo: Omit<ParamsCusto, 'pessoasAtuais'>;
}

export function calcularCobertura(p: ParamsCalculo): ResultadoCobertura {
  const N = Math.max(1, p.domingoFolgaACadaSemanas);
  const dims = p.turnos.map((t) => dimensionarTurno(t, p.limites, N));
  const necessidades = dims.map((d) => d.pessoasNecessarias);
  const alocadas = alocarPessoas(p.pessoasAtuais, necessidades);

  const turnos: ResultadoTurno[] = dims.map((d, i) => {
    const r = gerarRevezamento({
      pessoas: alocadas[i],
      demanda: d.turno.demanda,
      semanas: N,
      domingoFolgaACadaSemanas: N,
      folgasPorSemana: 7 - d.diasPorPessoa,
      deslocamento: i,
    });
    const horasSemana = r.descoberto.reduce((s, sem) => s + sem.reduce((a, b) => a + b, 0), 0) / Math.max(1, r.descoberto.length);
    const horasDomingo = r.descoberto.reduce((s, sem) => s + sem[0], 0) / Math.max(1, r.descoberto.length);
    const alertas = [...d.alertas];
    if (alocadas[i] > 0 && !r.domingoOk && d.turno.demanda.dom > 0) {
      alertas.push(`Com ${alocadas[i]} pessoa(s) não dá para garantir a todos 1 domingo de folga a cada ${N} semanas.`);
    }
    return {
      ...d,
      alertas,
      pessoasAlocadas: alocadas[i],
      revezamento: r,
      horasDescobertasSemana: (horasSemana * d.duracaoMin) / 60,
      horasDescobertasDomingoSemana: (horasDomingo * d.duracaoMin) / 60,
    };
  });

  const pessoasNecessarias = necessidades.reduce((s, x) => s + x, 0);
  const horasSemana = arred2(turnos.reduce((s, t) => s + t.horasDescobertasSemana, 0));
  const horasDomingoSemana = turnos.reduce((s, t) => s + t.horasDescobertasDomingoSemana, 0);
  const horasMes = arred2(horasSemana * REGRAS.semanasPorMes);
  const faltam = Math.max(0, pessoasNecessarias - p.pessoasAtuais);

  return {
    turnos,
    pessoasNecessarias,
    pessoasAtuais: p.pessoasAtuais,
    faltam,
    horasDescobertasSemana: horasSemana,
    horasDescobertasMes: horasMes,
    alternativas: estimarAlternativas({ ...p.custo, pessoasAtuais: p.pessoasAtuais }, faltam, horasSemana, horasDomingoSemana, turnos),
  };
}

export function estimarAlternativas(
  c: ParamsCusto,
  faltam: number,
  horasSemana: number,
  horasDomingoSemana: number,
  turnos: ResultadoTurno[],
): Alternativa[] {
  const spm = REGRAS.semanasPorMes;
  const valorHora = c.divisor > 0 ? c.salarioReferencia / c.divisor : 0;
  const horasMes = horasSemana * spm;
  const domingoMes = horasDomingoSemana * spm;
  const comumMes = horasMes - domingoMes;

  // Contratar
  const custoPessoa = c.encargosPercentual === null ? c.salarioReferencia : c.salarioReferencia * (1 + c.encargosPercentual);
  const contratar: Alternativa = {
    id: 'contratar',
    titulo: 'Contratar',
    custoMensal: faltam > 0 ? arred2(faltam * custoPessoa) : 0,
    detalhe: faltam > 0 ? `${faltam} pessoa(s) × ${moeda(custoPessoa)}` : 'Equipe atual é suficiente.',
    observacoes:
      c.encargosPercentual === null
        ? ['Encargos não informados: valor considera só o salário. Preencha o % de encargos em “Dados da empresa”.']
        : [`Inclui encargos de ${Math.round(c.encargosPercentual * 100)}% sobre o salário.`],
    viavel: true,
  };

  // Hora extra
  const capacidadeHE = c.pessoasAtuais * 5 * (REGRAS.clt.horaExtra.maxHorasExtrasDiariasMin / 60);
  const custoHE = comumMes * valorHora * (1 + c.adicionalHoraExtra) + domingoMes * valorHora * (1 + c.adicionalDomingo);
  const horaExtra: Alternativa = {
    id: 'hora_extra',
    titulo: 'Hora extra',
    custoMensal: arred2(custoHE),
    detalhe: `${num(horasMes)} h/mês × valor-hora ${moeda(valorHora)} + adicional (${Math.round(c.adicionalHoraExtra * 100)}%; domingos ${Math.round(c.adicionalDomingo * 100)}%)`,
    observacoes: [
      `Limite legal: 2 h extras por dia por pessoa (≈ ${num(capacidadeHE)} h/semana com a equipe atual).`,
      'Hora extra habitual gera reflexos (DSR, férias, 13º, FGTS) não incluídos aqui.',
      'Trabalho em dia de folga não é hora extra comum: a folga precisa ser mantida.',
    ],
    viavel: horasSemana <= capacidadeHE,
  };

  // Banco de horas
  const banco: Alternativa = {
    id: 'banco_horas',
    titulo: 'Banco de horas',
    custoMensal: 0,
    detalhe: `Sem custo imediato, mas acumula ${num(horasMes)} h/mês a compensar com folgas.`,
    observacoes: [
      `Prazo para compensar: até ${REGRAS.clt.bancoDeHoras.prazoMaxAcordoIndividualMeses} meses (acordo individual) ou ${REGRAS.clt.bancoDeHoras.prazoMaxAcordoColetivoMeses} meses (acordo coletivo).`,
      'Não resolve falta permanente de pessoas: as folgas de compensação criam nova lacuna. Use para picos sazonais.',
    ],
    viavel: horasSemana === 0,
  };

  // Ajuste do horário de funcionamento
  const mediaPessoasTurno =
    turnos.length > 0 ? turnos.reduce((s, t) => s + t.vagasSemana, 0) / Math.max(1, turnos.reduce((s, t) => s + DIAS_SEMANA.filter((d) => t.turno.demanda[d] > 0).length, 0)) : 1;
  const horasFechar = mediaPessoasTurno > 0 ? horasSemana / mediaPessoasTurno : 0;
  const horario: Alternativa = {
    id: 'horario',
    titulo: 'Ajustar horário de funcionamento',
    custoMensal: 0,
    detalhe: horasSemana > 0 ? `Reduzir cerca de ${num(horasFechar)} h de funcionamento por semana (ex.: abrir mais tarde ou fechar mais cedo em dias de menor movimento).` : 'Não é necessário.',
    observacoes: ['Sem custo de pessoal, mas pode reduzir vendas/atendimento. Confira regras locais de funcionamento.'],
    viavel: true,
  };

  return [contratar, horaExtra, banco, horario];
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
