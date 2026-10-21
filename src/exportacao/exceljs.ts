/** Carrega o exceljs sob demanda (biblioteca pesada, só usada ao importar/exportar). */
import type ExcelJSNs from 'exceljs';

export type ExcelJS = typeof ExcelJSNs;

export async function carregarExcelJS(): Promise<ExcelJS> {
  const mod = (await import('exceljs')) as unknown as { default?: ExcelJS } & ExcelJS;
  return mod.default ?? mod;
}

/** Converte o workbook em Blob para download. */
export async function workbookParaBlob(wb: ExcelJSNs.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const ESTILO_CABECALHO: Partial<ExcelJSNs.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } },
  alignment: { vertical: 'middle', wrapText: true },
};
