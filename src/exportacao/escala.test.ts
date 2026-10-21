// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { funcionariosExemplo } from '../dados/exemplo';
import { lerXLSX } from '../dados/importacao';
import { FOLGA, type EscalaSetor } from '../dominio/tipos';
import { montarTabelaEscala, pdfEscala, siglasUnicas, xlsxEscala } from './escala';
import { pdfSeguro } from './pdf';

const func = funcionariosExemplo().slice(0, 2);
const escala: EscalaSetor = {
  id: 'Caixa',
  setor: 'Caixa',
  nome: 'Escala Caixa',
  inicio: '2026-12-13',
  semanas: 1,
  turnos: [
    { id: 'm', nome: 'Manhã', inicio: '07:00', fim: '16:00', intervaloMin: 60 },
    { id: 't', nome: 'Tarde', inicio: '12:00', fim: '21:00', intervaloMin: 60 },
  ],
  linhas: [
    { funcionarioId: func[0].id, celulas: [FOLGA, 'm', 'm', 'm', 'm', 'm', FOLGA] },
    { funcionarioId: func[1].id, celulas: ['t', FOLGA, 't', 't', 't', FOLGA, 't'] },
  ],
  atualizadoEm: '',
};

describe('tabela da escala', () => {
  it('monta colunas, siglas e horas por semana', () => {
    const t = montarTabelaEscala(escala, func);
    expect(t.colunas[0]).toBe('Dom 13/12');
    expect(t.linhas[0].celulas).toEqual(['F', 'MAN', 'MAN', 'MAN', 'MAN', 'MAN', 'F']);
    expect(t.linhas[0].horasPorSemana[0]).toBe('40h');
    expect(t.periodo).toBe('13/12/2026 a 19/12/2026');
  });

  it('gera siglas únicas', () => {
    expect(siglasUnicas(['Manhã', 'Manhã 2', 'F'])).toEqual(['MAN', 'MA2', 'F2']);
  });
});

describe('arquivos', () => {
  it('gera PDF', async () => {
    const b = await pdfEscala(escala, func, 'Empresa Teste');
    expect(b.size).toBeGreaterThan(1000);
  });

  it('gera XLSX legível', async () => {
    const b = await xlsxEscala(escala, func, 'Empresa Teste');
    const linhas = await lerXLSX(await b.arrayBuffer());
    expect(linhas.length).toBeGreaterThan(2);
  });

  it('remove símbolos que a fonte do PDF não tem', () => {
    expect(pdfSeguro('44h → 42h ≈ ok ✔')).toBe('44h -> 42h ~ ok OK');
  });
});
