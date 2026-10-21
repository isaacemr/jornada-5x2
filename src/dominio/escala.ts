/**
 * Montador de escala: validação de cada linha (pessoa), cobertura por dia e sugestão automática.
 */
import { REGRAS } from '../config/regras-ec141';
import { alocarPessoas, dimensionarTurno, duracaoTrabalhadaTurno, gerarRevezamento, type LimitesCobertura } from './cobertura';
import { formatarData, formatarDuracao, paraMinutos, somarDias } from './tempo';
import { DIAS_SEMANA, FOLGA, NOME_DIA_CURTO, type CelulaEscala, type Funcionario, type Motivo, type TurnoBase, type TurnoCobertura } from './tipos';

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
          severidade: 'aviso',
          celula: d.i,
          texto: `${domingoACadaSemanas} domingos seguidos de trabalho (até ${formatarData(dataDaCelula(inicio, d.i))}). Garanta 1 domingo de folga a cada ${domingoACadaSemanas} semanas.`,
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

/** Primeiro horário de entrada da grade atual (para associar pessoas a turnos). */
function entradaReferencia(f: Funcionario): number {
  const g = f.gradeNova ?? f.gradeAtual;
  const d = DIAS_SEMANA.map((x) => g[x]).find((x) => x.trabalha);
  return d ? paraMinutos(d.entrada) : 8 * 60;
}

/**
 * Gera uma escala sugerida: distribui as pessoas entre os turnos (pela proximidade do horário atual)
 * e aplica o revezamento de folgas com domingos.
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
  const dims = turnos.map((t) => dimensionarTurno(t, L, N));
  const qtd = alocarPessoas(funcionarios.length, dims.map((d) => d.pessoasNecessarias || 1));
  const pessoas = [...funcionarios].sort((a, b) => entradaReferencia(a) - entradaReferencia(b));
  const ordemTurnos = turnos.map((t, i) => ({ t, i })).sort((a, b) => paraMinutos(a.t.inicio) - paraMinutos(b.t.inicio));

  const resultado: { funcionarioId: string; celulas: CelulaEscala[] }[] = [];
  let cursor = 0;
  for (const { t, i } of ordemTurnos) {
    const grupo = pessoas.slice(cursor, cursor + qtd[i]);
    cursor += qtd[i];
    if (grupo.length === 0) continue;
    const r = gerarRevezamento({
      pessoas: grupo.length,
      demanda: t.demanda,
      semanas,
      domingoFolgaACadaSemanas: N,
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
