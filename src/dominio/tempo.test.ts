import { describe, expect, it } from 'vitest';
import {
  dataISO,
  diferencaDias,
  duracaoPeriodo,
  formatarData,
  formatarDuracao,
  horarioValido,
  lerData,
  lerDuracao,
  lerMoeda,
  paraHorario,
  paraMinutos,
  somarDias,
} from './tempo';

describe('horários', () => {
  it('converte HH:MM em minutos e de volta', () => {
    expect(paraMinutos('08:24')).toBe(504);
    expect(paraMinutos('0:00')).toBe(0);
    expect(paraHorario(504)).toBe('08:24');
    expect(paraHorario(1440 + 30)).toBe('00:30');
    expect(paraHorario(-30)).toBe('23:30');
  });

  it('rejeita horários inválidos', () => {
    expect(horarioValido('24:00')).toBe(false);
    expect(horarioValido('8:60')).toBe(false);
    expect(horarioValido('abc')).toBe(false);
    expect(() => paraMinutos('25:00')).toThrow();
  });

  it('calcula duração inclusive virando a meia-noite', () => {
    expect(duracaoPeriodo('08:00', '17:00')).toBe(540);
    expect(duracaoPeriodo('22:00', '06:00')).toBe(480);
    expect(duracaoPeriodo('19:00', '07:00')).toBe(720);
  });

  it('formata duração', () => {
    expect(formatarDuracao(504)).toBe('8h24');
    expect(formatarDuracao(480)).toBe('8h');
    expect(formatarDuracao(2520)).toBe('42h');
    expect(formatarDuracao(15)).toBe('0h15');
    expect(formatarDuracao(-90)).toBe('-1h30');
  });

  it('lê durações em vários formatos', () => {
    expect(lerDuracao('8h24')).toBe(504);
    expect(lerDuracao('8:24')).toBe(504);
    expect(lerDuracao('8,4')).toBe(504);
    expect(lerDuracao('44')).toBe(2640);
    expect(lerDuracao('42h')).toBe(2520);
    expect(lerDuracao('')).toBeNull();
    expect(lerDuracao('x')).toBeNull();
  });
});

describe('datas', () => {
  it('lê e escreve datas sem problema de fuso', () => {
    expect(dataISO(lerData('2026-12-16'))).toBe('2026-12-16');
    expect(formatarData('2026-12-16')).toBe('16/12/2026');
  });

  it('soma e subtrai dias', () => {
    expect(somarDias('2026-10-16', 61)).toBe('2026-12-16');
    expect(diferencaDias('2026-10-21', '2026-12-16')).toBe(56);
    expect(diferencaDias('2027-12-16', '2027-12-15')).toBe(-1);
  });
});

describe('moeda', () => {
  it('lê formatos brasileiros e internacionais', () => {
    expect(lerMoeda('1.850,50')).toBe(1850.5);
    expect(lerMoeda('R$ 2.000')).toBe(2000);
    expect(lerMoeda('1850.5')).toBe(1850.5);
    expect(lerMoeda(1999)).toBe(1999);
    expect(lerMoeda('')).toBeNull();
    expect(lerMoeda('abc')).toBeNull();
  });
});
