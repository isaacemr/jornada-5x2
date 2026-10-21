/** Exporta o plano de ação em PDF. */
import { situacaoTarefa, type TarefaPlano } from '../dominio/planoAcao';
import type { Prazos } from '../dominio/etapas';
import { formatarData } from '../dominio/tempo';
import { cabecalho, criarPdf, finalizar, pdfParaBlob, tabela, yAposTabela } from './pdf';

export const NOME_GRUPO = {
  geral: 'Geral',
  etapa1: 'Até a etapa 1',
  terceirizada: 'Contratos com o poder público',
  etapa2: 'Até a etapa 2',
} as const;

const SITUACAO = { concluida: 'Concluída', atrasada: 'ATRASADA', proxima: 'Próxima', futura: 'A fazer' } as const;

export async function pdfPlano(tarefas: TarefaPlano[], prazos: Prazos, empresa: string, hoje: string): Promise<Blob> {
  const doc = await criarPdf('p');
  let y = cabecalho(
    doc,
    'Plano de ação — EC 141/2026',
    `${empresa ? `${empresa} · ` : ''}Gerado em ${formatarData(hoje)} · Etapa 1: ${formatarData(prazos.inicioEtapa1)} · Etapa 2: ${formatarData(prazos.inicioEtapa2)}${prazos.terceirizadaPublica ? ` · Poder público: ${formatarData(prazos.terceirizadaPublica)}` : ''}`,
  );
  for (const g of ['geral', 'etapa1', 'terceirizada', 'etapa2'] as const) {
    const lista = tarefas.filter((t) => t.etapa === g && !t.oculta);
    if (!lista.length) continue;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 18;
    }
    doc.text(NOME_GRUPO[g], 12, y);
    await tabela(doc, {
      startY: y + 2,
      head: [['Prazo', 'Tarefa', 'Responsável', 'Situação']],
      body: lista.map((t) => [formatarData(t.prazo), `${t.titulo}\n${t.descricao}`, t.responsavel, SITUACAO[situacaoTarefa(t, hoje)]]),
      columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 38 }, 3: { cellWidth: 24 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3 && d.cell.raw === 'ATRASADA') d.cell.styles.textColor = [176, 0, 0];
      },
    });
    y = yAposTabela(doc, y) + 2;
  }
  finalizar(doc);
  return pdfParaBlob(doc);
}
