/** Planilha de-para (jornada antiga → nova) para contador e fornecedor do ponto. */
import { linhasDePara } from '../dominio/aditivo';
import type { ConfigRemuneracao } from '../dominio/remuneracao';
import { DIAS_SEMANA, NOME_DIA_CURTO, type Funcionario } from '../dominio/tipos';
import { AVISO_LEGAL } from '../config/textos-juridicos';
import { carregarExcelJS, ESTILO_CABECALHO, workbookParaBlob } from './exceljs';

export async function xlsxDePara(funcionarios: Funcionario[], cfg: ConfigRemuneracao, empresa: string): Promise<Blob> {
  const linhas = linhasDePara(funcionarios, cfg);
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jornada 5x2';
  const ws = wb.addWorksheet('De-para', { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }] });
  ws.addRow([`Jornada antiga → nova${empresa ? ` — ${empresa}` : ''}`]).font = { bold: true, size: 13 };
  ws.addRow([AVISO_LEGAL]).font = { italic: true, size: 9 };
  const cab = [
    'Matrícula',
    'Nome',
    'Cargo',
    'Setor',
    'Salário (R$)',
    'Escala antiga',
    'Horas/sem. antes',
    'Horas/sem. depois',
    'Folgas antes',
    'Folgas depois',
    ...DIAS_SEMANA.flatMap((d) => [`${NOME_DIA_CURTO[d]} antes`, `${NOME_DIA_CURTO[d]} depois`]),
    'Divisor antes',
    'Divisor depois',
    'Valor-hora antes (R$)',
    'Valor-hora depois (R$)',
    'Vigência',
    'Situação',
  ];
  const r = ws.addRow(cab);
  r.eachCell((c) => (c.style = ESTILO_CABECALHO));
  r.height = 32;
  for (const l of linhas) {
    ws.addRow([
      l.matricula,
      l.nome,
      l.cargo,
      l.setor,
      l.salario,
      l.escalaAntiga,
      l.horasSemanaisAntes,
      l.horasSemanaisDepois,
      l.diasFolgaAntes,
      l.diasFolgaDepois,
      ...DIAS_SEMANA.flatMap((d) => [l.dias[d].antes, l.dias[d].depois]),
      l.divisorAntes,
      l.divisorDepois,
      l.valorHoraAntes,
      l.valorHoraDepois,
      l.vigencia,
      l.situacao,
    ]);
  }
  ws.columns.forEach((c, i) => {
    c.width = i === 1 ? 30 : i >= 10 && i < 24 ? 22 : 14;
  });
  // Colunas: 1–10 dados; 11–24 dias (antes/depois); 25–26 divisores; 27–28 valor-hora.
  for (const col of [5, 27, 28]) ws.getColumn(col).numFmt = '#,##0.00';
  return workbookParaBlob(wb);
}
