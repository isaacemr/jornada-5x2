import { describe, expect, it } from 'vitest';
import { compararRemuneracao, configRemuneracaoPadrao, custoHorasExtras, divisorPara, quadroRemuneracao } from './remuneracao';

const cfg = configRemuneracaoPadrao();

describe('divisor', () => {
  it('usa 220 → 210 → 200 para 44, 42 e 40 h', () => {
    expect(divisorPara(44 * 60, cfg.divisores)).toBe(220);
    expect(divisorPara(42 * 60, cfg.divisores)).toBe(210);
    expect(divisorPara(40 * 60, cfg.divisores)).toBe(200);
  });
  it('aplica a fórmula horas × 5 para outras cargas', () => {
    expect(divisorPara(36 * 60, cfg.divisores)).toBe(180);
    expect(divisorPara(42 * 60 + 25, cfg.divisores)).toBeCloseTo(212.08, 2);
  });
  it('respeita divisor configurado pela empresa', () => {
    expect(divisorPara(40 * 60, { 44: 220, 42: 210, 40: 220 })).toBe(220);
  });
});

describe('valor-hora e hora extra', () => {
  it('calcula valor-hora e horas extras', () => {
    const q = quadroRemuneracao(2200, 44 * 60, cfg);
    expect(q.valorHora).toBe(10);
    expect(q.horaExtra).toBe(15);
    expect(q.horaExtraDomingo).toBe(20);
    expect(q.horasMensaisRemuneradas).toBe(220);
  });

  it('aceita divisor forçado', () => {
    expect(quadroRemuneracao(2000, 40 * 60, cfg, 220).divisor).toBe(220);
  });

  it('mantém o salário e aumenta o valor-hora ao reduzir a jornada', () => {
    const c = compararRemuneracao(2100, 44 * 60, 42 * 60, cfg);
    expect(c.antes.salario).toBe(c.depois.salario);
    expect(c.antes.valorHora).toBe(9.55);
    expect(c.depois.valorHora).toBe(10);
    expect(c.variacaoValorHoraPerc).toBeCloseTo(4.71, 1);
    expect(c.reducaoSemanalMin).toBe(120);
  });

  it('44 → 40 h: valor-hora sobe 10%', () => {
    const c = compararRemuneracao(2200, 44 * 60, 40 * 60, cfg);
    expect(c.depois.valorHora).toBe(11);
    expect(c.variacaoValorHoraPerc).toBe(10);
    expect(c.depois.horaExtra).toBe(16.5);
  });

  it('respeita adicionais configurados', () => {
    const q = quadroRemuneracao(2000, 40 * 60, { ...cfg, adicionalHoraExtra: 0.6, adicionalDomingoFeriado: 1.5 });
    expect(q.horaExtra).toBe(16);
    expect(q.horaExtraDomingo).toBe(25);
  });

  it('custo de horas extras', () => {
    expect(custoHorasExtras(10, 10, 0.5)).toBe(150);
  });

  it('salário zero não quebra', () => {
    expect(quadroRemuneracao(0, 0, cfg).valorHora).toBe(0);
  });
});
