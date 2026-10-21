// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resumirGrade } from '../dominio/jornada';
import { bufferXLSXModelo, converterLinhas, csvModelo, lerCSV, lerPeriodoDia, lerXLSX, normalizarCabecalho } from './importacao';

describe('leitura de período do dia', () => {
  it('lê formatos comuns', () => {
    expect(lerPeriodoDia('08:00-17:00', 60)).toEqual({ entrada: '08:00', saida: '17:00', intervaloMin: 60 });
    expect(lerPeriodoDia('8:00 às 14:00/15', 60)).toEqual({ entrada: '08:00', saida: '14:00', intervaloMin: 15 });
    expect(lerPeriodoDia('22:00 - 06:00', null)).toEqual({ entrada: '22:00', saida: '06:00', intervaloMin: null });
  });
  it('reconhece folga', () => {
    expect(lerPeriodoDia('', 60)).toBeNull();
    expect(lerPeriodoDia('Folga', 60)).toBeNull();
    expect(lerPeriodoDia('DSR', 60)).toBeNull();
  });
  it('rejeita lixo', () => {
    expect(lerPeriodoDia('manhã', 60)).toBe('invalido');
    expect(lerPeriodoDia('25:00-26:00', 60)).toBe('invalido');
  });
});

describe('cabeçalhos', () => {
  it('normaliza acentos e espaços', () => {
    expect(normalizarCabecalho(' Salário Base ')).toBe('salario_base');
    expect(normalizarCabecalho('Sábado')).toBe('sabado');
  });
});

describe('conversão de linhas', () => {
  it('importa o CSV modelo', () => {
    const r = converterLinhas(lerCSV(csvModelo()));
    expect(r.erros).toHaveLength(0);
    expect(r.funcionarios).toHaveLength(2);
    const [maria, joao] = r.funcionarios;
    expect(maria.salario).toBe(1850);
    expect(maria.escalaAtual).toBe('6x1');
    expect(maria.trabalhaDomingo).toBe(true);
    expect(maria.gradeAtual.dom.intervaloMin).toBe(15);
    expect(maria.gradeAtual.qua.trabalha).toBe(false);
    expect(maria.admissao).toBe('2021-03-15');
    expect(resumirGrade(joao.gradeAtual).totalSemanalMin).toBe(44 * 60);
  });

  it('aceita cabeçalhos com sinônimos e vírgula como separador', () => {
    const csv = 'Funcionário,Salário Mensal,Segunda,Terça,Carga Horária\nAna,"2.000,00",08:00-12:00,08:00-12:00,20';
    const r = converterLinhas(lerCSV(csv));
    expect(r.erros).toHaveLength(0);
    expect(r.funcionarios[0].nome).toBe('Ana');
    expect(r.funcionarios[0].salario).toBe(2000);
    expect(r.funcionarios[0].jornadaSemanalContratualMin).toBe(1200);
    expect(r.funcionarios[0].gradeAtual.seg.intervaloMin).toBe(0);
  });

  it('aponta erros por linha e ignora linhas vazias', () => {
    const r = converterLinhas([
      { nome: '', salario: '1000' },
      { nome: 'B', salario: 'abc' },
      { nome: 'C', salario: '1500', seg: 'manhã' },
      { nome: '', salario: '' },
    ]);
    expect(r.funcionarios).toHaveLength(0);
    expect(r.erros.map((e) => e.linha)).toEqual([2, 3, 4]);
    expect(r.erros[2].erros[0]).toMatch(/seg/);
  });

  it('presume intervalo e avisa quando não informado', () => {
    const r = converterLinhas([{ nome: 'D', salario: 1800, seg: '08:00-17:00' }]);
    expect(r.funcionarios[0].gradeAtual.seg.intervaloMin).toBe(60);
    expect(r.avisos[0].erros.join(' ')).toMatch(/assumido 60 min/);
  });

  it('deduz a escala pelos dias trabalhados', () => {
    const r = converterLinhas([
      { nome: 'E', salario: 1800, seg: '08:00-16:20', ter: '08:00-16:20', qua: '08:00-16:20', qui: '08:00-16:20', sex: '08:00-16:20', sab: '08:00-16:20', intervalo_min: 60 },
    ]);
    expect(r.funcionarios[0].escalaAtual).toBe('6x1');
  });
});

describe('XLSX', () => {
  it('gera o modelo e lê de volta', async () => {
    const buf = await bufferXLSXModelo();
    const linhas = await lerXLSX(buf);
    const r = converterLinhas(linhas);
    expect(r.erros).toHaveLength(0);
    expect(r.funcionarios.map((f) => f.nome)).toEqual(['Maria da Silva (exemplo)', 'João Souza (exemplo)']);
  });
});
