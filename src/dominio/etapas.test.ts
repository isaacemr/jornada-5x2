import { describe, expect, it } from 'vitest';
import { REGRAS, regrasPendentesDeConfirmacao } from '../config/regras-ec141';
import { calcularPrazos, contagemRegressiva, etapaVigente, limitesDaEtapa } from './etapas';
import { diferencaDias } from './tempo';

const geral = calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: false });

describe('arquivo de regras', () => {
  it('etapa 1 começa 61 dias após a promulgação ("60 dias após", contando a partir do dia seguinte)', () => {
    expect(diferencaDias(REGRAS.norma.promulgacao, REGRAS.etapa1.inicio)).toBe(61);
  });
  it('etapa 1 termina na véspera da etapa 2', () => {
    expect(diferencaDias(REGRAS.etapa1.fim, REGRAS.etapa2.inicio)).toBe(1);
  });
  it('lista as regras pendentes de confirmação', () => {
    const p = regrasPendentesDeConfirmacao();
    expect(p.length).toBeGreaterThan(3);
    expect(p.map((x) => x.chave)).toContain('etapa1');
  });
});

describe('prazos por perfil', () => {
  it('empresa comum usa as datas gerais', () => {
    expect(geral.inicioEtapa1).toBe('2026-12-16');
    expect(geral.inicioEtapa2).toBe('2027-12-16');
    expect(geral.terceirizadaPublica).toBeNull();
    expect(geral.pequenaEmpresaPendente).toBe(false);
  });

  it('terceirizada da administração pública tem a etapa 1 em 16/10/2027', () => {
    const p = calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: true });
    expect(p.inicioEtapa1).toBe('2027-10-16');
    expect(p.terceirizadaPublica).toBe('2027-10-16');
    expect(p.inicioEtapa2).toBe('2027-12-16');
  });

  it('MEI/ME/EPP: pendente de regulamentação, usa datas gerais por padrão', () => {
    const p = calcularPrazos({ porte: 'EPP', prestaServicoPoderPublico: false });
    expect(p.pequenaEmpresaPendente).toBe(true);
    expect(p.inicioEtapa1).toBe(REGRAS.etapa1.inicio);
    expect(p.observacoes.join(' ')).toMatch(/lei complementar/);
  });

  it('MEI/ME/EPP: aceita datas configuradas', () => {
    const p = calcularPrazos({
      porte: 'ME',
      prestaServicoPoderPublico: false,
      transicaoPequenas: { inicioEtapa1: '2027-06-01', inicioEtapa2: '2028-06-01' },
    });
    expect(p.inicioEtapa1).toBe('2027-06-01');
    expect(p.inicioEtapa2).toBe('2028-06-01');
  });

  it('datas configuradas fora de ordem são corrigidas', () => {
    const p = calcularPrazos({
      porte: 'ME',
      prestaServicoPoderPublico: false,
      transicaoPequenas: { inicioEtapa1: '2028-01-01', inicioEtapa2: null },
    });
    expect(p.inicioEtapa2 >= p.inicioEtapa1).toBe(true);
  });

  it('configuração de pequena empresa é ignorada para porte "demais"', () => {
    const p = calcularPrazos({
      porte: 'DEMAIS',
      prestaServicoPoderPublico: false,
      transicaoPequenas: { inicioEtapa1: '2027-06-01', inicioEtapa2: null },
    });
    expect(p.inicioEtapa1).toBe('2026-12-16');
  });
});

describe('etapa vigente', () => {
  it('identifica as transições exatas', () => {
    expect(etapaVigente('2026-10-21', geral)).toBe(0);
    expect(etapaVigente('2026-12-15', geral)).toBe(0);
    expect(etapaVigente('2026-12-16', geral)).toBe(1);
    expect(etapaVigente('2027-12-15', geral)).toBe(1);
    expect(etapaVigente('2027-12-16', geral)).toBe(2);
  });

  it('limites de cada etapa vêm do arquivo de regras', () => {
    expect(limitesDaEtapa(0).limiteSemanalMin).toBe(44 * 60);
    expect(limitesDaEtapa(1).limiteSemanalMin).toBe(42 * 60);
    expect(limitesDaEtapa(1).limiteDiarioComAcordoMin).toBe(REGRAS.etapa1.limiteDiarioComAcordoMin);
    expect(limitesDaEtapa(2).limiteSemanalMin).toBe(40 * 60);
    expect(limitesDaEtapa(2).limiteDiarioComAcordoMin).toBeNull();
    expect(limitesDaEtapa(2).diasRepouso).toBe(2);
  });
});

describe('contagem regressiva', () => {
  it('calcula dias, horas e minutos', () => {
    const c = contagemRegressiva('2026-12-16', new Date(2026, 9, 21, 10, 30));
    expect(c.passou).toBe(false);
    expect(c.dias).toBe(55);
    expect(c.horas).toBe(13);
    expect(c.minutos).toBe(30);
    expect(c.diasCalendario).toBe(56);
  });
  it('indica quando a data já passou', () => {
    const c = contagemRegressiva('2026-12-16', new Date(2026, 11, 16, 0, 1));
    expect(c.passou).toBe(true);
    expect(c.dias).toBe(0);
  });
});
