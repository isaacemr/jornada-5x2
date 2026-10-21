import { describe, expect, it } from 'vitest';
import { funcionariosExemplo } from '../dados/exemplo';
import { gradeUniforme } from '../dados/padroes';
import { contextoDiagnostico, diagnosticar, indicadores, type ContextoDiagnostico } from './diagnostico';
import { calcularPrazos } from './etapas';
import type { ConfigEmpresa, DiaSemana, Funcionario, GradeSemanal } from './tipos';

const SEG_SEX: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex'];
const SEG_SAB: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const prazos = calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: false });

function ctx(c: Partial<ConfigEmpresa> = {}): ContextoDiagnostico {
  return contextoDiagnostico(prazos, {
    acordoAmpliaJornadaEtapa1: 'nao_sei',
    acordoRegimeCompensatorio: 'nao_sei',
    domingoFolgaACadaSemanas: 4,
    ...c,
  } as ConfigEmpresa);
}

function func(grade: GradeSemanal, extra: Partial<Funcionario> = {}): Funcionario {
  return {
    id: 't',
    nome: 'Teste',
    cargo: '',
    setor: 'S',
    salario: 2000,
    jornadaSemanalContratualMin: 44 * 60,
    escalaAtual: '6x1',
    trabalhaDomingo: false,
    gradeAtual: grade,
    criadoEm: '',
    atualizadoEm: '',
    ...extra,
  };
}

describe('diagnóstico', () => {
  it('6x1 com 44 h precisa ajustar até a etapa 1', () => {
    const d = diagnosticar(func(gradeUniforme(SEG_SAB, '08:00', '16:20', 60)), ctx());
    expect(d.status).toBe('ajustar_etapa1');
    expect(d.prazo).toBe('2026-12-16');
    expect(d.adequadoEtapa1).toBe(false);
    expect(d.motivos.map((m) => m.codigo)).toEqual(expect.arrayContaining(['E1_SEMANAL', 'E1_DIAS', 'E2_SEMANAL']));
    expect(d.resumoCurto).toBe('6 dias de trabalho — precisa de 2 folgas; 44h semanais — limite 42h.');
  });

  it('5x2 com 40 h e 8 h/dia é adequado', () => {
    const d = diagnosticar(func(gradeUniforme(SEG_SEX, '08:00', '17:00', 60), { escalaAtual: '5x2', jornadaSemanalContratualMin: 2400 }), ctx());
    expect(d.status).toBe('adequado');
    expect(d.prazo).toBeNull();
    expect(d.adequadoEtapa1 && d.adequadoEtapa2).toBe(true);
  });

  it('5 x 8h24 (42 h): depende de acordo na etapa 1 se a empresa não sabe', () => {
    const d = diagnosticar(func(gradeUniforme(SEG_SEX, '08:00', '17:24', 60), { escalaAtual: '5x2' }), ctx());
    expect(d.status).toBe('depende_acordo');
    expect(d.prazo).toBe('2026-12-16');
  });

  it('5 x 8h24 com acordo: ok na etapa 1, ajustar até a etapa 2', () => {
    const d = diagnosticar(func(gradeUniforme(SEG_SEX, '08:00', '17:24', 60), { escalaAtual: '5x2' }), ctx({ acordoAmpliaJornadaEtapa1: 'sim' }));
    expect(d.status).toBe('ajustar_etapa2');
    expect(d.prazo).toBe('2027-12-16');
    expect(d.adequadoEtapa1).toBe(true);
    expect(d.adequadoEtapa2).toBe(false);
  });

  it('5 x 8h24 quando a empresa diz que NÃO há acordo: ajustar na etapa 1', () => {
    const d = diagnosticar(func(gradeUniforme(SEG_SEX, '08:00', '17:24', 60), { escalaAtual: '5x2' }), ctx({ acordoAmpliaJornadaEtapa1: 'nao' }));
    expect(d.status).toBe('ajustar_etapa1');
  });

  it('quem já cumpre 40 h ou menos em 6 dias: sem nova redução, mas ganha 2 repousos', () => {
    const g = gradeUniforme(SEG_SAB, '08:00', '14:15', 15); // 6h x 6 = 36h
    const d = diagnosticar(func(g, { jornadaSemanalContratualMin: 36 * 60 }), ctx({ acordoRegimeCompensatorio: 'nao' }));
    expect(d.status).toBe('ajustar_etapa1');
    expect(d.motivos.some((m) => /não há nova redução/.test(m.texto) && /2 dias de repouso/.test(m.texto))).toBe(true);
    expect(d.motivos.some((m) => m.codigo === 'E1_SEMANAL')).toBe(false);
  });

  it('6 dias com 40 h e regime compensatório coletivo: adequado', () => {
    const g = gradeUniforme(SEG_SAB, '08:00', '15:40', 60);
    const d = diagnosticar(func(g, { jornadaSemanalContratualMin: 2400 }), ctx({ acordoRegimeCompensatorio: 'sim' }));
    expect(d.status).toBe('adequado');
  });

  it('6 dias sem saber do acordo: depende de acordo coletivo', () => {
    const g = gradeUniforme(SEG_SAB, '08:00', '15:40', 60);
    const d = diagnosticar(func(g, { jornadaSemanalContratualMin: 2400 }), ctx());
    expect(d.status).toBe('depende_acordo');
  });

  it('12x36 (média 42 h): depende de acordo na etapa 1 e precisa mudar na etapa 2', () => {
    const g = gradeUniforme(['seg', 'qua', 'sex'], '19:00', '07:00', 60);
    const d = diagnosticar(func(g, { escalaAtual: '12x36', jornadaSemanalContratualMin: 42 * 60 }), ctx());
    expect(d.status).toBe('depende_acordo');
    expect(d.etapa2.resultado).toBe('falha');
  });

  it('12x36 com acordo: ajustar até a etapa 2', () => {
    const g = gradeUniforme(['seg', 'qua', 'sex'], '19:00', '07:00', 60);
    const d = diagnosticar(func(g, { escalaAtual: '12x36', jornadaSemanalContratualMin: 42 * 60 }), ctx({ acordoRegimeCompensatorio: 'sim' }));
    expect(d.status).toBe('ajustar_etapa2');
  });

  it('problema de CLT (intervalo) impede "adequado"', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '16:30', 30); // 8h trabalhadas com 30 min
    const d = diagnosticar(func(g, { escalaAtual: '5x2' }), ctx());
    expect(d.status).toBe('ajustar_etapa1');
    expect(d.motivos.some((m) => /CLT/.test(m.texto))).toBe(true);
  });

  it('usa a nova grade quando definida', () => {
    const f = func(gradeUniforme(SEG_SAB, '08:00', '16:20', 60), { gradeNova: gradeUniforme(SEG_SEX, '08:00', '17:00', 60) });
    expect(diagnosticar(f, ctx()).status).toBe('adequado');
    expect(diagnosticar(f, ctx()).base).toBe('nova');
    expect(diagnosticar(f, ctx(), 'atual').status).toBe('ajustar_etapa1');
  });

  it('avisa quando a grade não bate com o contrato', () => {
    const d = diagnosticar(func(gradeUniforme(SEG_SEX, '08:00', '17:00', 60), { jornadaSemanalContratualMin: 44 * 60 }), ctx());
    expect(d.motivos.map((m) => m.codigo)).toContain('GRADE_DIFERE_CONTRATO');
  });

  it('terceirizada pública tem prazo especial para a etapa 1', () => {
    const p = calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: true });
    const d = diagnosticar(func(gradeUniforme(SEG_SAB, '08:00', '16:20', 60)), { ...ctx(), prazos: p });
    expect(d.prazo).toBe('2027-10-16');
  });
});

describe('indicadores e dados de exemplo', () => {
  it('calcula percentuais', () => {
    const c = ctx();
    const diags = [
      diagnosticar(func(gradeUniforme(SEG_SEX, '08:00', '17:00', 60)), c),
      diagnosticar(func(gradeUniforme(SEG_SAB, '08:00', '16:20', 60)), c),
    ];
    const i = indicadores(diags);
    expect(i.total).toBe(2);
    expect(i.percEtapa1).toBe(50);
    expect(i.porStatus.adequado).toBe(1);
  });

  it('exemplo: maioria precisa ajustar até a etapa 1, um adequado, o vigia depende de acordo', () => {
    const c = ctx();
    const diags = funcionariosExemplo().map((f) => diagnosticar(f, c));
    const i = indicadores(diags);
    expect(i.total).toBeGreaterThanOrEqual(15);
    expect(i.porStatus.adequado).toBe(1);
    expect(i.porStatus.depende_acordo).toBe(1);
    expect(i.porStatus.ajustar_etapa1).toBe(i.total - 2);
  });
});
