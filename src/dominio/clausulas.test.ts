import { describe, expect, it } from 'vitest';
import { instrumentosExemplo } from '../dados/exemplo';
import { avaliarClausula, avaliarInstrumento, resumoAvaliacoes, situacaoVigencia } from './clausulas';
import { blocosParaTexto } from './documento';
import { calcularPrazos } from './etapas';
import { gerarPauta, TOPICOS_PADRAO } from './pauta';
import type { Clausula } from './tipos';

const cl = (tipo: Clausula['tipo'], parametros: Clausula['parametros'] = {}): Clausula => ({
  id: 'c',
  numero: '1',
  titulo: 't',
  texto: '',
  tipo,
  parametros,
  avaliacaoManual: null,
  observacao: '',
});
const h = (x: number, m = 0) => x * 60 + m;

describe('avaliação de cláusulas', () => {
  it('44 h semanais é incompatível e perde eficácia nas duas etapas', () => {
    const a1 = avaliarClausula(cl('jornada_semanal', { jornadaSemanalMin: h(44) }), 'CCT', 1, 4);
    expect(a1.resultado).toBe('incompativel');
    expect(a1.motivo).toMatch(/perde eficácia/);
    expect(avaliarClausula(cl('jornada_semanal', { jornadaSemanalMin: h(44) }), 'CCT', 2, 4).resultado).toBe('incompativel');
  });

  it('42 h: compatível na etapa 1, incompatível na etapa 2', () => {
    const c = cl('jornada_semanal', { jornadaSemanalMin: h(42) });
    expect(avaliarClausula(c, 'CCT', 1, 4).resultado).toBe('compativel');
    expect(avaliarClausula(c, 'CCT', 2, 4).resultado).toBe('incompativel');
  });

  it('jornada diária de 8h24: revisar na etapa 1 (coletivo), incompatível se individual ou etapa 2', () => {
    const c = cl('jornada_diaria', { jornadaDiariaMin: h(8, 24) });
    expect(avaliarClausula(c, 'CCT', 1, 4).resultado).toBe('revisar');
    expect(avaliarClausula(c, 'acordo_individual_compensacao', 1, 4).resultado).toBe('incompativel');
    expect(avaliarClausula(c, 'CCT', 2, 4).resultado).toBe('incompativel');
  });

  it('jornada diária acima do teto é incompatível mesmo na etapa 1', () => {
    expect(avaliarClausula(cl('jornada_diaria', { jornadaDiariaMin: h(10, 30) }), 'CCT', 1, 4).resultado).toBe('incompativel');
  });

  it('6x1: incompatível, salvo regime compensatório coletivo expresso (revisar)', () => {
    expect(avaliarClausula(cl('escala', { diasTrabalhoSemana: 6 }), 'CCT', 1, 4).resultado).toBe('incompativel');
    expect(avaliarClausula(cl('escala', { diasTrabalhoSemana: 6, regimeCompensatorioExcepcional: true }), 'ACT', 1, 4).resultado).toBe('revisar');
    expect(avaliarClausula(cl('escala', { diasTrabalhoSemana: 6, regimeCompensatorioExcepcional: true }), 'acordo_individual_compensacao', 1, 4).resultado).toBe('incompativel');
    expect(avaliarClausula(cl('escala', { diasTrabalhoSemana: 5 }), 'CCT', 2, 4).resultado).toBe('compativel');
  });

  it('banco de horas respeita prazos da CLT', () => {
    expect(avaliarClausula(cl('banco_horas', { prazoBancoMeses: 12 }), 'CCT', 1, 4).resultado).toBe('compativel');
    expect(avaliarClausula(cl('banco_horas', { prazoBancoMeses: 12 }), 'banco_horas', 1, 4).resultado).toBe('incompativel');
    expect(avaliarClausula(cl('banco_horas', { prazoBancoMeses: 6 }), 'banco_horas', 1, 4).resultado).toBe('compativel');
  });

  it('12x36: revisar na etapa 1 (coletivo) e incompatível na etapa 2', () => {
    expect(avaliarClausula(cl('regime_12x36'), 'CCT', 1, 4).resultado).toBe('revisar');
    expect(avaliarClausula(cl('regime_12x36'), '12x36', 1, 4).resultado).toBe('incompativel');
    expect(avaliarClausula(cl('regime_12x36'), 'CCT', 2, 4).resultado).toBe('incompativel');
  });

  it('domingos: compara com a regra configurada', () => {
    expect(avaliarClausula(cl('domingos', { domingoFolgaACadaSemanas: 3 }), 'CCT', 1, 4).resultado).toBe('compativel');
    expect(avaliarClausula(cl('domingos', { domingoFolgaACadaSemanas: 7 }), 'CCT', 1, 4).resultado).toBe('revisar');
  });

  it('sem parâmetros ou "outra": revisar', () => {
    expect(avaliarClausula(cl('jornada_semanal'), 'CCT', 1, 4).resultado).toBe('revisar');
    expect(avaliarClausula(cl('outra'), 'CCT', 1, 4).resultado).toBe('revisar');
  });
});

describe('instrumento', () => {
  it('a decisão manual prevalece e o resumo conta corretamente', () => {
    const [cct] = instrumentosExemplo();
    const av = avaliarInstrumento(cct, 4);
    const r = resumoAvaliacoes(av);
    expect(r.compativel + r.incompativel + r.revisar).toBe(cct.clausulas.length);
    expect(av.find((a) => a.clausula.id === 'c20')!.final).toBe('incompativel');
    expect(av.find((a) => a.clausula.id === 'c25')!.final).toBe('compativel');
    const comManual = { ...cct, clausulas: cct.clausulas.map((c) => (c.id === 'c20' ? { ...c, avaliacaoManual: 'revisar' as const } : c)) };
    const av2 = avaliarInstrumento(comManual, 4).find((a) => a.clausula.id === 'c20')!;
    expect(av2.final).toBe('revisar');
    expect(av2.manual).toBe(true);
  });

  it('situação de vigência', () => {
    const [cct] = instrumentosExemplo();
    expect(situacaoVigencia(cct, '2026-10-21')).toBe('vigente');
    expect(situacaoVigencia(cct, '2027-05-01')).toBe('vencido');
    expect(situacaoVigencia({ ...cct, vigenciaInicio: '', vigenciaFim: '' }, '2026-10-21')).toBe('sem_data');
  });
});

describe('pauta', () => {
  const base = {
    empresa: null,
    instrumentos: instrumentosExemplo(),
    topicos: TOPICOS_PADRAO,
    prazos: calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: false }),
    domingoACadaSemanas: 4,
    observacoes: '',
    dataDocumento: '2026-10-21',
  };

  it('é marcada como MODELO e traz os tópicos e cláusulas a revisar', () => {
    const t = blocosParaTexto(gerarPauta(base));
    expect(t.startsWith('MODELO')).toBe(true);
    expect(t).toMatch(/Distribuição das 42h/);
    expect(t).toMatch(/Banco de horas/);
    expect(t).toMatch(/cláusula 20/);
    expect(t).toMatch(/16\/12\/2026/);
  });

  it('respeita os tópicos escolhidos e inclui observações', () => {
    const t = blocosParaTexto(gerarPauta({ ...base, topicos: { ...TOPICOS_PADRAO, bancoHoras: false }, observacoes: 'Proposta de contrapartida.' }));
    expect(t).not.toMatch(/Prazo de compensação/);
    expect(t).toMatch(/Proposta de contrapartida/);
  });
});
