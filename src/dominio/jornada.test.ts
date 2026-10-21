import { describe, expect, it } from 'vitest';
import { gradeUniforme, gradeVazia } from '../dados/padroes';
import {
  calcularInterjornadas,
  descreverGrade,
  intervaloMinimoExigido,
  intervaloPresumido,
  problemasCLT,
  resumirGrade,
  validarGrade,
  type OpcoesValidacao,
} from './jornada';
import type { DiaSemana } from './tipos';

const SEG_SEX: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex'];
const SEG_SAB: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const op = (o: Partial<OpcoesValidacao> = {}): OpcoesValidacao => ({
  etapa: 1,
  acordoAmpliaDiaria: 'nao',
  acordoRegimeCompensatorio: 'nao',
  domingoFolgaACadaSemanas: 4,
  ...o,
});
const codigos = (r: { problemas: { codigo: string }[] }) => r.problemas.map((p) => p.codigo);

describe('resumo da grade', () => {
  it('soma horas, dias e maior jornada diária', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '17:24', 60); // 8h24 x 5 = 42h
    const r = resumirGrade(g);
    expect(r.totalSemanalMin).toBe(42 * 60);
    expect(r.diasTrabalhados).toBe(5);
    expect(r.diasFolga).toBe(2);
    expect(r.maxDiarioMin).toBe(504);
    expect(r.trabalhaDomingo).toBe(false);
  });

  it('trata turno noturno que vira a meia-noite', () => {
    const g = gradeUniforme(['seg'], '22:00', '06:00', 60);
    const r = resumirGrade(g);
    expect(r.totalSemanalMin).toBe(7 * 60);
    expect(r.dias[1].viraMeiaNoite).toBe(true);
  });

  it('grade vazia não tem horas', () => {
    expect(resumirGrade(gradeVazia()).totalSemanalMin).toBe(0);
  });
});

describe('intervalo intrajornada (CLT art. 71)', () => {
  it('exige 1 h acima de 6 h, 15 min entre 4 e 6 h, nada até 4 h', () => {
    expect(intervaloMinimoExigido(8 * 60)).toBe(60);
    expect(intervaloMinimoExigido(6 * 60 + 1)).toBe(60);
    expect(intervaloMinimoExigido(6 * 60)).toBe(15);
    expect(intervaloMinimoExigido(4 * 60 + 1)).toBe(15);
    expect(intervaloMinimoExigido(4 * 60)).toBe(0);
  });

  it('presume o intervalo mínimo a partir do período bruto', () => {
    expect(intervaloPresumido(9 * 60)).toBe(60);
    expect(intervaloPresumido(6 * 60 + 15)).toBe(15);
    expect(intervaloPresumido(6 * 60 + 16)).toBe(60);
    expect(intervaloPresumido(4 * 60)).toBe(0);
  });

  it('acusa intervalo insuficiente', () => {
    const g = gradeUniforme(['seg'], '08:00', '16:30', 30);
    expect(problemasCLT(g).map((p) => p.codigo)).toContain('INTERVALO_INSUFICIENTE');
  });

  it('aceita 15 min para 6 h de trabalho', () => {
    const g = gradeUniforme(['seg'], '08:00', '14:15', 15);
    expect(problemasCLT(g)).toHaveLength(0);
  });

  it('avisa intervalo acima de 2 h', () => {
    const g = gradeUniforme(['seg'], '08:00', '19:00', 180);
    expect(problemasCLT(g).map((p) => p.codigo)).toContain('INTERVALO_EXCESSIVO');
  });
});

describe('interjornada (CLT art. 66)', () => {
  it('calcula o descanso entre dias consecutivos, inclusive sábado → domingo', () => {
    const g = gradeUniforme(['sab', 'dom'], '14:00', '22:00', 60);
    const ij = calcularInterjornadas(g);
    const sabDom = ij.find((x) => x.de === 'sab');
    expect(sabDom?.descansoMin).toBe(16 * 60);
  });

  it('acusa descanso menor que 11 h', () => {
    const g = gradeUniforme(['seg'], '14:00', '23:00', 60);
    g.ter = { trabalha: true, entrada: '07:00', saida: '15:00', intervaloMin: 60 };
    expect(problemasCLT(g).map((p) => p.codigo)).toContain('INTERJORNADA');
  });

  it('considera turno noturno na interjornada', () => {
    const g = gradeUniforme(['seg', 'ter'], '22:00', '06:00', 60);
    const ij = calcularInterjornadas(g).find((x) => x.de === 'seg');
    expect(ij?.descansoMin).toBe(16 * 60);
  });
});

describe('validação por etapa', () => {
  it('5 x 8h = 40 h é válida em todas as etapas', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '17:00', 60);
    expect(validarGrade(g, op({ etapa: 1 })).valida).toBe(true);
    expect(validarGrade(g, op({ etapa: 2 })).valida).toBe(true);
  });

  it('8h24 x 5: na etapa 1 sem acordo é erro', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '17:24', 60);
    const r = validarGrade(g, op({ etapa: 1 }));
    expect(r.valida).toBe(false);
    expect(r.problemas.find((p) => p.codigo === 'DIARIO_ACIMA_ETAPA1')?.texto).toMatch(/só é permitida na etapa 1 com acordo coletivo/);
  });

  it('8h24 x 5: na etapa 1 com acordo é válida (com aviso)', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '17:24', 60);
    const r = validarGrade(g, op({ etapa: 1, acordoAmpliaDiaria: 'sim' }));
    expect(r.valida).toBe(true);
    expect(codigos(r)).toContain('DIARIO_ACIMA_ETAPA1');
  });

  it('8h24 x 5: na etapa 2 é inválida mesmo com acordo (diária e semanal)', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '17:24', 60);
    const r = validarGrade(g, op({ etapa: 2, acordoAmpliaDiaria: 'sim' }));
    expect(r.valida).toBe(false);
    expect(codigos(r)).toEqual(expect.arrayContaining(['DIARIO_ACIMA', 'SEMANAL_ACIMA']));
  });

  it('acima do teto diário com acordo é erro na etapa 1', () => {
    const g = gradeUniforme(['seg', 'ter', 'qua', 'qui'], '07:00', '18:30', 60); // 10h30
    const r = validarGrade(g, op({ etapa: 1, acordoAmpliaDiaria: 'sim' }));
    expect(codigos(r)).toContain('DIARIO_ACIMA');
  });

  it('6x1 com 44 h: erro de dias e de horas na etapa 1', () => {
    const g = gradeUniforme(SEG_SAB, '08:00', '16:20', 60);
    const r = validarGrade(g, op({ etapa: 1 }));
    expect(codigos(r)).toEqual(expect.arrayContaining(['DIAS_ACIMA', 'SEMANAL_ACIMA']));
  });

  it('6x1 com 44 h é válida pela regra antiga (etapa 0)', () => {
    const g = gradeUniforme(SEG_SAB, '08:00', '16:20', 60);
    expect(validarGrade(g, op({ etapa: 0 })).valida).toBe(true);
  });

  it('6 dias com regime compensatório coletivo e 40 h: aviso, não erro', () => {
    const g = gradeUniforme(SEG_SAB, '08:00', '15:40', 60); // 6h40 x 6 = 40h
    const r = validarGrade(g, op({ etapa: 2, acordoRegimeCompensatorio: 'sim' }));
    expect(r.valida).toBe(true);
    expect(codigos(r)).toContain('DIAS_ACIMA_COM_ACORDO');
  });

  it('7 dias é inválido até na regra antiga', () => {
    const g = gradeUniforme([...SEG_SAB, 'dom'], '08:00', '12:00', 0);
    expect(codigos(validarGrade(g, op({ etapa: 0 })))).toContain('DIAS_ACIMA');
  });

  it('informa sobre domingos a partir da etapa 1', () => {
    const g = gradeUniforme(['dom', 'seg', 'ter', 'qua', 'qui'], '08:00', '16:00', 60);
    const r = validarGrade(g, op({ etapa: 1, domingoFolgaACadaSemanas: 3 }));
    expect(r.problemas.find((p) => p.codigo === 'DOMINGO')?.texto).toMatch(/a cada 3 semanas/);
  });

  it('avisa trabalho em dia em que a empresa está fechada', () => {
    const g = gradeUniforme(SEG_SEX, '08:00', '17:00', 60);
    const funcionamento = Object.fromEntries(
      (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as DiaSemana[]).map((d) => [d, { aberto: d !== 'seg', abre: '08:00', fecha: '18:00' }]),
    ) as OpcoesValidacao['funcionamento'];
    expect(codigos(validarGrade(g, op({ funcionamento })))).toContain('FORA_FUNCIONAMENTO');
  });

  it('horário inválido é erro', () => {
    const g = gradeUniforme(['seg'], '08:00', '08:00', 0);
    expect(codigos(validarGrade(g, op()))).toContain('HORARIO_INVALIDO');
  });
});

describe('descrição', () => {
  it('descreve grade uniforme', () => {
    expect(descreverGrade(gradeUniforme(SEG_SEX, '08:00', '17:00', 60))).toBe('Seg, Ter, Qua, Qui, Sex · 08:00–17:00');
    expect(descreverGrade(gradeVazia())).toBe('Sem dias de trabalho');
  });
});
