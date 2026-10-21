/** Exportação da escala em PDF e XLSX. */
import { CORES_TURNO_ARGB } from '../componentes/EditorTurnos';
import { duracaoTrabalhadaTurno } from '../dominio/cobertura';
import { rotulosColunas } from '../dominio/escala';
import { formatarData, formatarDuracao, somarDias } from '../dominio/tempo';
import { FOLGA, type EscalaSetor, type Funcionario } from '../dominio/tipos';
import { carregarExcelJS, ESTILO_CABECALHO, workbookParaBlob } from './exceljs';
import { cabecalho, criarPdf, finalizar, pdfParaBlob, tabela, yAposTabela } from './pdf';

export interface TabelaEscala {
  titulo: string;
  periodo: string;
  colunas: string[];
  linhas: { nome: string; celulas: string[]; horasPorSemana: string[] }[];
  legenda: { sigla: string; descricao: string; indice: number }[];
}

/** Sigla curta do turno para caber na célula (primeiras letras). */
export function siglaTurno(nome: string, indice: number): string {
  const s = nome.trim().slice(0, 3).toUpperCase();
  return s || `T${indice + 1}`;
}

/** Siglas únicas para cada turno (acrescenta número em caso de repetição). */
export function siglasUnicas(nomes: string[]): string[] {
  const usadas = new Set<string>(['F']);
  return nomes.map((n, i) => {
    let s = siglaTurno(n, i);
    let k = 2;
    while (usadas.has(s)) s = `${siglaTurno(n, i).slice(0, 2)}${k++}`;
    usadas.add(s);
    return s;
  });
}

export function montarTabelaEscala(e: EscalaSetor, funcionarios: Funcionario[]): TabelaEscala {
  const siglas = siglasUnicas(e.turnos.map((t) => t.nome));
  const porId = new Map(e.turnos.map((t, i) => [t.id, { t, i, sigla: siglas[i] }]));
  const nomes = new Map(funcionarios.map((f) => [f.id, f.nome]));
  const fim = somarDias(e.inicio, e.semanas * 7 - 1);
  return {
    titulo: `Escala — ${e.setor}`,
    periodo: `${formatarData(e.inicio)} a ${formatarData(fim)}`,
    colunas: rotulosColunas(e.inicio, e.semanas),
    linhas: e.linhas.map((l) => ({
      nome: nomes.get(l.funcionarioId) ?? '(funcionário removido)',
      celulas: l.celulas.map((c) => (c === FOLGA || !porId.has(c) ? 'F' : porId.get(c)!.sigla)),
      horasPorSemana: Array.from({ length: e.semanas }, (_, w) =>
        formatarDuracao(
          l.celulas.slice(w * 7, w * 7 + 7).reduce((s, c) => s + (porId.has(c) ? duracaoTrabalhadaTurno(porId.get(c)!.t) : 0), 0),
        ),
      ),
    })),
    legenda: [
      ...e.turnos.map((t, i) => ({ sigla: siglas[i], descricao: `${t.nome}: ${t.inicio}-${t.fim} (intervalo ${t.intervaloMin} min)`, indice: i })),
      { sigla: 'F', descricao: 'Folga (repouso semanal)', indice: -1 },
    ],
  };
}

const RGB_TURNO: [number, number, number][] = [
  [224, 242, 254],
  [254, 243, 199],
  [237, 233, 254],
  [204, 251, 241],
  [255, 228, 230],
];

export async function pdfEscala(e: EscalaSetor, funcionarios: Funcionario[], empresa: string): Promise<Blob> {
  const t = montarTabelaEscala(e, funcionarios);
  const doc = await criarPdf('l');
  let y = cabecalho(doc, t.titulo, `${empresa ? `${empresa} · ` : ''}Período: ${t.periodo}`);
  const siglaIndice = new Map(t.legenda.map((l) => [l.sigla, l.indice]));
  for (let w = 0; w < e.semanas; w++) {
    await tabela(doc, {
      startY: y,
      head: [['Funcionário', ...t.colunas.slice(w * 7, w * 7 + 7), 'Horas']],
      body: t.linhas.map((l) => [l.nome, ...l.celulas.slice(w * 7, w * 7 + 7), l.horasPorSemana[w]]),
      styles: { fontSize: 8, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 55 } },
      didParseCell: (d) => {
        if (d.section !== 'body' || d.column.index === 0 || d.column.index > 7) return;
        const i = siglaIndice.get(String(d.cell.raw));
        if (i === -1) d.cell.styles.fillColor = [226, 232, 240];
        else if (i !== undefined) d.cell.styles.fillColor = RGB_TURNO[i % RGB_TURNO.length];
      },
    });
    y = yAposTabela(doc, y);
  }
  doc.setFontSize(8);
  doc.text(t.legenda.map((l) => `${l.sigla} = ${l.descricao}`).join('   |   '), 12, Math.min(y, doc.internal.pageSize.getHeight() - 16), {
    maxWidth: doc.internal.pageSize.getWidth() - 24,
  });
  finalizar(doc);
  return pdfParaBlob(doc);
}

export async function xlsxEscala(e: EscalaSetor, funcionarios: Funcionario[], empresa: string): Promise<Blob> {
  const t = montarTabelaEscala(e, funcionarios);
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Escala', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
  ws.addRow([`${t.titulo}${empresa ? ` — ${empresa}` : ''}`]).font = { bold: true, size: 13 };
  ws.addRow([`Período: ${t.periodo}`]);
  const cab = ws.addRow(['Funcionário', ...t.colunas, ...t.linhas[0]?.horasPorSemana.map((_, w) => `Horas sem. ${w + 1}`) ?? []]);
  cab.eachCell((c) => Object.assign(c, { style: ESTILO_CABECALHO }));
  const siglaIndice = new Map(t.legenda.map((l) => [l.sigla, l.indice]));
  for (const l of t.linhas) {
    const r = ws.addRow([l.nome, ...l.celulas, ...l.horasPorSemana]);
    l.celulas.forEach((s, i) => {
      const idx = siglaIndice.get(s);
      const cor = idx === -1 ? 'FFE2E8F0' : idx !== undefined ? CORES_TURNO_ARGB[idx % CORES_TURNO_ARGB.length] : undefined;
      const cel = r.getCell(i + 2);
      cel.alignment = { horizontal: 'center' };
      if (cor) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
    });
  }
  ws.getColumn(1).width = 30;
  for (let i = 2; i <= t.colunas.length + 1; i++) ws.getColumn(i).width = 10;
  ws.addRow([]);
  ws.addRow(['Legenda']).font = { bold: true };
  for (const l of t.legenda) ws.addRow([`${l.sigla} = ${l.descricao}`]);
  return workbookParaBlob(wb);
}
