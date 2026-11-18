/**
 * Montador de escala: validação de cada linha (pessoa), cobertura por dia e sugestão automática.
 */
import { REGRAS } from '../config/regras-ec141';
import { alocarPessoas, dimensionarTurno, duracaoTrabalhadaTurno, gerarRevezamento, type LimitesCobertura } from './cobertura';
import { domingoACadaSemanas as regraDaPessoa, textoRegraDomingo } from './domingos';
import { formatarData, formatarDuracao, paraMinutos, somarDias } from './tempo';
import { DIAS_SEMANA, FOLGA, NOME_DIA_CURTO, type CelulaEscala, type CoberturaSetor, type EscalaSetor, type Funcionario, type Motivo, type TurnoBase, type TurnoCobertura } from './tipos';

export interface ProblemaLinha extends Motivo {
  /** Índice da célula (dia) relacionado, se houver. */
  celula?: number;
}

/** Data ISO da célula i de uma escala que começa em `inicio`. */
export function dataDaCelula(inicio: string, i: number): string {
  return somarDias(inicio, i);
}

export function validarLinha(
  celulas: CelulaEscala[],
  turnos: TurnoBase[],
  L: LimitesCobertura,
  domingoACadaSemanas: number,
  inicio: string,
  /** 'erro' quando a regra não admite exceção (mulheres, CLT art. 386). */
  severidadeDomingo: 'aviso' | 'erro' = 'aviso',
): ProblemaLinha[] {
  const p: ProblemaLinha[] = [];
  const porId = new Map(turnos.map((t) => [t.id, t]));
  const semanas = Math.floor(celulas.length / 7);
  const dias = DIAS_SEMANA.length;

  for (let w = 0; w < semanas; w++) {
    const sem = celulas.slice(w * dias, (w + 1) * dias);
    const folgas = sem.filter((c) => c === FOLGA || !porId.has(c)).length;
    const minutos = sem.reduce((s, c) => s + (porId.has(c) ? duracaoTrabalhadaTurno(porId.get(c)!) : 0), 0);
    if (folgas < REGRAS.regraGeral.diasRepousoSemanal) {
      p.push({ codigo: 'FOLGAS', severidade: 'erro', texto: `Semana ${w + 1}: ${folgas} folga(s) — são necessárias ${REGRAS.regraGeral.diasRepousoSemanal}.` });
    }
    if (minutos > L.limiteSemanalMin) {
      p.push({ codigo: 'SEMANAL', severidade: 'erro', texto: `Semana ${w + 1}: ${formatarDuracao(minutos)} — acima de ${formatarDuracao(L.limiteSemanalMin)}.` });
    }
  }

  celulas.forEach((c, i) => {
    const t = porId.get(c);
    if (!t) return;
    const dur = duracaoTrabalhadaTurno(t);
    if (dur > L.limiteDiarioMin) {
      p.push({ codigo: 'DIARIO', severidade: 'erro', celula: i, texto: `${formatarData(dataDaCelula(inicio, i))}: turno de ${formatarDuracao(dur)} acima de ${formatarDuracao(L.limiteDiarioMin)}.` });
    }
    const prox = porId.get(celulas[i + 1]);
    if (prox) {
      const fim = paraMinutos(t.fim) <= paraMinutos(t.inicio) ? paraMinutos(t.fim) + 1440 : paraMinutos(t.fim);
      const descanso = 1440 + paraMinutos(prox.inicio) - fim;
      if (descanso < REGRAS.clt.interjornadaMin.valor) {
        p.push({
          codigo: 'INTERJORNADA',
          severidade: 'erro',
          celula: i + 1,
          texto: `${formatarData(dataDaCelula(inicio, i + 1))}: só ${formatarDuracao(descanso)} de descanso desde o turno anterior (mínimo 11h).`,
        });
      }
    }
  });

  // Domingos de folga
  const domingos = celulas.map((c, i) => ({ i, folga: c === FOLGA || !porId.has(c) })).filter(({ i }) => i % 7 === 0);
  if (domingos.length >= domingoACadaSemanas) {
    let seguidos = 0;
    for (const d of domingos) {
      seguidos = d.folga ? 0 : seguidos + 1;
      if (seguidos >= domingoACadaSemanas) {
        p.push({
          codigo: 'DOMINGO',
          severidade: severidadeDomingo,
          celula: d.i,
          texto: `${domingoACadaSemanas} domingos seguidos de trabalho (até ${formatarData(dataDaCelula(inicio, d.i))}). Garanta ${textoRegraDomingo([domingoACadaSemanas])}.`,
        });
        break;
      }
    }
  } else if (domingos.length > 0 && !domingos.some((d) => d.folga)) {
    p.push({ codigo: 'DOMINGO', severidade: 'info', texto: `Nenhum domingo de folga nestas ${domingos.length} semana(s). Confira o período seguinte.` });
  }

  return p;
}

/** Quantas pessoas em cada turno por dia (índice da célula). */
export function contarCobertura(linhas: { celulas: CelulaEscala[] }[], turnoId: string, totalCelulas: number): number[] {
  const r = Array<number>(totalCelulas).fill(0);
  for (const l of linhas) l.celulas.forEach((c, i) => c === turnoId && i < totalCelulas && r[i]++);
  return r;
}

/** Rótulos das colunas: 'Dom 14/12'. */
export function rotulosColunas(inicio: string, semanas: number): string[] {
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const iso = dataDaCelula(inicio, i);
    return `${NOME_DIA_CURTO[DIAS_SEMANA[i % 7]]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  });
}

/** Domingo da semana de uma data (para alinhar o início da escala). */
export function domingoDaSemana(iso: string): string {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return somarDias(iso, -d.getDay());
}

/**
 * Turnos de cada setor, como aparecem em Opções de horário: os da escala montada ou, se ainda não houver escala,
 * os da calculadora de cobertura.
 */
export function turnosPorSetor(
  escalas: Pick<EscalaSetor, 'setor' | 'turnos'>[],
  coberturas: Pick<CoberturaSetor, 'setor' | 'turnos'>[],
): Map<string, TurnoBase[]> {
  const m = new Map<string, TurnoBase[]>();
  for (const c of coberturas) if (c.turnos.length) m.set(c.setor, c.turnos.map(({ id, nome, inicio, fim, intervaloMin }) => ({ id, nome, inicio, fim, intervaloMin })));
  for (const e of escalas) if (e.turnos.length) m.set(e.setor, e.turnos);
  return m;
}

/** Troca o turno de todos os dias trabalhados da linha (as folgas ficam onde estão). */
export function aplicarTurnoNaLinha(celulas: CelulaEscala[], turnoId: string): CelulaEscala[] {
  return celulas.map((c) => (c === FOLGA ? c : turnoId));
}

/** Parcela de mulheres na equipe (0 a 1). */
export function proporcaoMulheres(funcionarios: Pick<Funcionario, 'sexo'>[]): number {
  return funcionarios.length ? funcionarios.filter((f) => f.sexo === 'F').length / funcionarios.length : 0;
}

/** Primeiro horário de entrada da grade atual (para associar pessoas a turnos). */
function entradaReferencia(f: Funcionario): number {
  const g = f.gradeNova ?? f.gradeAtual;
  const d = DIAS_SEMANA.map((x) => g[x]).find((x) => x.trabalha);
  return d ? paraMinutos(d.entrada) : 8 * 60;
}

/**
 * Gera uma escala sugerida: distribui as pessoas entre os turnos (pela proximidade do horário atual)
 * e aplica o revezamento de folgas com domingos — cada pessoa com a sua regra (mulheres: a cada 2 semanas).
 * `domingoACadaSemanas` é a regra dos homens.
 */
export function sugerirEscala(
  funcionarios: Funcionario[],
  turnos: TurnoCobertura[],
  semanas: number,
  domingoACadaSemanas: number,
  L: LimitesCobertura,
): { funcionarioId: string; celulas: CelulaEscala[] }[] {
  if (turnos.length === 0) return funcionarios.map((f) => ({ funcionarioId: f.id, celulas: Array(semanas * 7).fill(FOLGA) }));
  const N = Math.max(1, domingoACadaSemanas);
  const dims = turnos.map((t) => dimensionarTurno(t, L, N, proporcaoMulheres(funcionarios)));
  const qtd = alocarPessoas(funcionarios.length, dims.map((d) => d.pessoasNecessarias || 1));
  const pessoas = [...funcionarios].sort((a, b) => entradaReferencia(a) - entradaReferencia(b));
  const ordemTurnos = turnos.map((t, i) => ({ t, i })).sort((a, b) => paraMinutos(a.t.inicio) - paraMinutos(b.t.inicio));

  // Quem tem turno definido no cadastro fica nele; os demais completam as vagas, pela ordem do horário de entrada.
  const ids = new Set(turnos.map((t) => t.id));
  const grupos = turnos.map((t) => pessoas.filter((f) => f.turnoId === t.id));
  const livres = pessoas.filter((f) => !f.turnoId || !ids.has(f.turnoId));
  for (const { i } of ordemTurnos) {
    const vagas = Math.max(0, qtd[i] - grupos[i].length);
    grupos[i].push(...livres.splice(0, vagas));
  }
  // Sobra (só acontece se faltar vaga): vai para o último turno.
  if (livres.length) grupos[ordemTurnos[ordemTurnos.length - 1].i].push(...livres);

  const resultado: { funcionarioId: string; celulas: CelulaEscala[] }[] = [];
  for (const { t, i } of ordemTurnos) {
    const grupo = grupos[i].sort((a, b) => entradaReferencia(a) - entradaReferencia(b));
    if (grupo.length === 0) continue;
    const r = gerarRevezamento({
      pessoas: grupo.length,
      demanda: t.demanda,
      semanas,
      domingoFolgaACadaSemanas: N,
      domingoPorPessoa: grupo.map((f) => regraDaPessoa(f.sexo, N)),
      folgasPorSemana: 7 - dims[i].diasPorPessoa,
      deslocamento: i,
    });
    grupo.forEach((f, p) => {
      const celulas: CelulaEscala[] = [];
      for (let w = 0; w < semanas; w++) for (let d = 0; d < 7; d++) celulas.push(r.trabalha[w][p][d] ? t.id : FOLGA);
      resultado.push({ funcionarioId: f.id, celulas });
    });
  }
  // Ordem original dos funcionários
  const ordem = new Map(funcionarios.map((f, i) => [f.id, i]));
  return resultado.sort((a, b) => (ordem.get(a.funcionarioId) ?? 0) - (ordem.get(b.funcionarioId) ?? 0));
}

/**
 * Agrupa as linhas da semana pelo turno em que cada pessoa mais trabalha (empate: o turno que vem primeiro).
 * Quem folga a semana toda fica num grupo à parte. Guarda o índice original da linha para edição e arraste.
 */
export function agruparPorTurno<L extends { celulas: CelulaEscala[] }>(linhas: L[], turnos: TurnoBase[], semana: number) {
  const grupos = turnos.map((turno, indice) => ({ turno: turno as TurnoBase | null, indice, itens: [] as { l: L; li: number }[] }));
  const semTurno = { turno: null as TurnoBase | null, indice: -1, itens: [] as { l: L; li: number }[] };
  linhas.forEach((l, li) => {
    const dias = l.celulas.slice(semana * 7, semana * 7 + 7);
    const cont = turnos.map((t) => dias.filter((c) => c === t.id).length);
    const max = Math.max(0, ...cont);
    (max === 0 ? semTurno : grupos[cont.indexOf(max)]).itens.push({ l, li });
  });
  return [...grupos, semTurno].filter((g) => g.itens.length > 0);
}
