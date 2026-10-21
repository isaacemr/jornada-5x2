import { describe, expect, it } from 'vitest';
import { gradeUniforme } from '../dados/padroes';
import { calcularInterjornadas, problemasCLT, resumirGrade } from './jornada';
import { gerarOpcoes, montarDia, sugerirDiasTrabalho, type ParametrosOpcoes } from './redistribuicao';
import type { DiaSemana } from './tipos';

const SEG_SEX: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex'];

const params = (o: Partial<ParametrosOpcoes> = {}, acordo: 'sim' | 'nao' | 'nao_sei' = 'nao', comp: 'sim' | 'nao' | 'nao_sei' = 'nao'): ParametrosOpcoes => ({
  etapa: 1,
  entrada: '08:00',
  diasTrabalho: SEG_SEX,
  validacao: { acordoAmpliaDiaria: acordo, acordoRegimeCompensatorio: comp, domingoFolgaACadaSemanas: 4 },
  ...o,
});

describe('montar dia', () => {
  it('inclui o intervalo mínimo legal', () => {
    expect(montarDia('08:00', 504)).toEqual({ trabalha: true, entrada: '08:00', saida: '17:24', intervaloMin: 60 });
    expect(montarDia('08:00', 360)).toEqual({ trabalha: true, entrada: '08:00', saida: '14:15', intervaloMin: 15 });
    expect(montarDia('22:00', 420).saida).toBe('06:00');
  });
});

describe('opções para 42 h (etapa 1)', () => {
  it('todas as opções somam no máximo 42 h e têm 2 folgas (exceto o regime compensatório)', () => {
    for (const o of gerarOpcoes(params())) {
      expect(o.totalSemanalMin).toBeLessThanOrEqual(42 * 60);
      const r = resumirGrade(o.grade);
      if (o.id !== 'e1-6dias') expect(r.diasFolga).toBe(2);
      expect(problemasCLT(o.grade)).toHaveLength(0);
    }
  });

  it('8h24 x 5 exige acordo: inválida sem acordo, válida com acordo', () => {
    const sem = gerarOpcoes(params()).find((o) => o.id === 'e1-5-iguais')!;
    expect(sem.titulo).toMatch(/8h24/);
    expect(sem.totalSemanalMin).toBe(42 * 60);
    expect(sem.classificacao).toBe('invalida');
    const com = gerarOpcoes(params({}, 'sim')).find((o) => o.id === 'e1-5-iguais')!;
    expect(com.classificacao).toBe('valida_com_acordo');
    const naoSei = gerarOpcoes(params({}, 'nao_sei')).find((o) => o.id === 'e1-5-iguais')!;
    expect(naoSei.classificacao).toBe('depende_acordo');
  });

  it('9h x 4 + 6h é válida com acordo', () => {
    const o = gerarOpcoes(params({}, 'sim')).find((x) => x.id === 'e1-4x9-1x6')!;
    expect(o.totalSemanalMin).toBe(42 * 60);
    expect(o.grade.sex.saida).toBe('14:15');
    expect(o.classificacao).toBe('valida_com_acordo');
  });

  it('8h x 5 é sempre válida', () => {
    const o = gerarOpcoes(params()).find((x) => x.id === 'e1-5x8')!;
    expect(o.classificacao).toBe('valida');
    expect(o.totalSemanalMin).toBe(40 * 60);
  });

  it('6 dias só com regime compensatório', () => {
    expect(gerarOpcoes(params()).find((x) => x.id === 'e1-6dias')!.classificacao).toBe('invalida');
    expect(gerarOpcoes(params({}, 'nao', 'nao_sei')).find((x) => x.id === 'e1-6dias')!.classificacao).toBe('depende_acordo');
    const ok = gerarOpcoes(params({}, 'nao', 'sim')).find((x) => x.id === 'e1-6dias')!;
    expect(ok.classificacao).toBe('valida_com_acordo');
    expect(resumirGrade(ok.grade).diasTrabalhados).toBe(6);
    expect(ok.totalSemanalMin).toBe(42 * 60);
  });
});

describe('opções para 40 h (etapa 2)', () => {
  it('8h x 5 é válida e nada passa de 8 h por dia', () => {
    const ops = gerarOpcoes(params({ etapa: 2 }));
    expect(ops.find((o) => o.id === 'e2-5x8')!.classificacao).toBe('valida');
    for (const o of ops) {
      expect(resumirGrade(o.grade).maxDiarioMin).toBeLessThanOrEqual(480);
      expect(o.totalSemanalMin).toBeLessThanOrEqual(40 * 60);
    }
  });
});

describe('respeita interjornada e dias escolhidos', () => {
  it('turno noturno gera interjornada válida', () => {
    const o = gerarOpcoes(params({ etapa: 2, entrada: '22:00' })).find((x) => x.id === 'e2-5x8')!;
    expect(calcularInterjornadas(o.grade).every((i) => i.descansoMin >= 11 * 60)).toBe(true);
  });

  it('usa os dias escolhidos (ex.: domingo a quinta)', () => {
    const o = gerarOpcoes(params({ etapa: 2, diasTrabalho: ['dom', 'seg', 'ter', 'qua', 'qui'] }))[0];
    expect(o.grade.dom.trabalha).toBe(true);
    expect(o.grade.sex.trabalha).toBe(false);
    expect(o.grade.sab.trabalha).toBe(false);
  });

  it('sem dias escolhidos não gera opções', () => {
    expect(gerarOpcoes(params({ diasTrabalho: [] }))).toHaveLength(0);
  });
});

describe('sugestão de dias', () => {
  it('6x1 de segunda a sábado → segunda a sexta', () => {
    expect(sugerirDiasTrabalho(gradeUniforme(['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], '08:00', '16:20', 60))).toEqual(SEG_SEX);
  });
  it('6x1 com domingo e folga na quarta → mantém o domingo e retira o sábado', () => {
    const g = gradeUniforme(['dom', 'seg', 'ter', 'qui', 'sex', 'sab'], '08:00', '16:20', 60);
    expect(sugerirDiasTrabalho(g)).toEqual(['dom', 'seg', 'ter', 'qui', 'sex']);
  });
  it('menos de 5 dias completa com dias úteis', () => {
    expect(sugerirDiasTrabalho(gradeUniforme(['seg', 'ter'], '08:00', '12:00', 0))).toEqual(SEG_SEX);
  });
});
