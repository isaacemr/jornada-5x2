// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { empresaExemplo, funcionariosExemplo, instrumentosExemplo } from '../dados/exemplo';
import { gradeUniforme } from '../dados/padroes';
import { blocosParaDocx, blocosParaPdf } from '../exportacao/docx';
import { xlsxDePara } from '../exportacao/dePara';
import { lerXLSX } from '../dados/importacao';
import { descreverDias, gerarAditivo, linhasDePara, podeGerarAditivo, type OpcoesAditivo } from './aditivo';
import { blocosParaTexto } from './documento';
import { configRemuneracaoPadrao } from './remuneracao';
import type { DiaSemana } from './tipos';

const SEG_SEX: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex'];
const cfg = configRemuneracaoPadrao();
const op: OpcoesAditivo = { cidade: 'Vila Esperança', dataAssinatura: '2026-12-01', folgasEmRevezamento: false, instrumentoColetivo: null };
const empresa = empresaExemplo();
const base = funcionariosExemplo()[2]; // Carla Mendes: 6x1, 44h
const comNova = { ...base, gradeNova: gradeUniforme(SEG_SEX, '07:00', '16:00', 60), vigenciaNovaGrade: '2026-12-16' };

describe('termo aditivo', () => {
  it('exige nova jornada definida', () => {
    expect(podeGerarAditivo(base)).toBe(false);
    expect(podeGerarAditivo(comNova)).toBe(true);
    expect(() => gerarAditivo(base, empresa, op, cfg)).toThrow();
  });

  it('traz marca MODELO, partes, horários, repousos, salário mantido e vigência', () => {
    const t = blocosParaTexto(gerarAditivo(comNova, empresa, op, cfg));
    expect(t.startsWith('MODELO — revisar antes de assinar')).toBe(true);
    expect(t).toMatch(/Supermercado Vila Esperança/);
    expect(t).toMatch(/Carla Mendes/);
    expect(t).toMatch(/A partir de 16\/12\/2026/);
    expect(t).toMatch(/40h semanais, distribuídas em 5 dias/);
    expect(t).toMatch(/Segunda-feira: das 07:00 às 16:00/);
    expect(t).toMatch(/Domingo: repouso semanal remunerado/);
    expect(t).toMatch(/domingo e sábado/);
    expect(t).toMatch(/salário mensal de R\$\s?1\.850,00, sem qualquer redução/);
    expect(t).toMatch(/divisor 200 \(antes 220\)/);
    expect(t).toMatch(/1 de dezembro de 2026/);
    expect(t).not.toMatch(/TRANSIÇÃO/);
  });

  it('jornada acima de 8 h cita o instrumento coletivo e o fim da etapa 1', () => {
    const f = { ...base, gradeNova: gradeUniforme(SEG_SEX, '07:00', '16:24', 60) };
    const inst = instrumentosExemplo()[0];
    const t = blocosParaTexto(gerarAditivo(f, empresa, { ...op, instrumentoColetivo: inst }, cfg));
    expect(t).toMatch(/JORNADA DIÁRIA NA TRANSIÇÃO/);
    expect(t).toMatch(/CCT Comerciários/);
    expect(t).toMatch(/15\/12\/2027/);
    expect(t).toMatch(/divisor 210/);
  });

  it('folgas em revezamento citam a regra de domingos', () => {
    const t = blocosParaTexto(gerarAditivo(comNova, empresa, { ...op, folgasEmRevezamento: true }, cfg));
    expect(t).toMatch(/revezamento/);
    expect(t).toMatch(/a cada 4 semanas/);
  });

  it('descreve os dias, com intervalo', () => {
    expect(descreverDias(comNova.gradeNova)[1]).toBe('Segunda-feira: das 07:00 às 16:00, com intervalo de 1h para repouso e alimentação');
  });
});

describe('de-para', () => {
  it('compara jornada antiga e nova', () => {
    const [l] = linhasDePara([comNova], cfg);
    expect(l.horasSemanaisAntes).toBe('44h');
    expect(l.horasSemanaisDepois).toBe('40h');
    expect(l.divisorAntes).toBe(220);
    expect(l.divisorDepois).toBe(200);
    expect(l.dias.sab.antes).toMatch(/07:00-15:20/);
    expect(l.dias.sab.depois).toBe('Folga');
    expect(l.situacao).toBe('Nova jornada definida');
  });

  it('marca pendentes sem nova jornada', () => {
    expect(linhasDePara([base], cfg)[0].situacao).toMatch(/Pendente/);
  });
});

describe('arquivos', () => {
  it('gera DOCX em lote e PDF', async () => {
    const secoes = [gerarAditivo(comNova, empresa, op, cfg), gerarAditivo(comNova, empresa, op, cfg)];
    const docx = await blocosParaDocx(secoes, { marca: 'MODELO' });
    expect(docx.size).toBeGreaterThan(3000);
    const bytes = new Uint8Array(await docx.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK'); // arquivo zip (OOXML)
    const pdf = await blocosParaPdf(secoes, 'MODELO');
    expect(pdf.size).toBeGreaterThan(2000);
  });

  it('gera a planilha de-para legível', async () => {
    const blob = await xlsxDePara([comNova, base], cfg, 'Teste');
    const linhas = await lerXLSX(await blob.arrayBuffer());
    expect(linhas.length).toBeGreaterThanOrEqual(3);
  });
});
