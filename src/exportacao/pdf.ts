/** Utilitários de PDF (jsPDF carregado sob demanda). */
import type { jsPDF as JsPDF } from 'jspdf';
import { AVISO_LEGAL } from '../config/textos-juridicos';
import type { Bloco } from '../dominio/documento';

export type Doc = JsPDF;

/** A fonte padrão do PDF (WinAnsi) não tem alguns símbolos: troca por equivalentes. */
export function pdfSeguro(s: string): string {
  return s
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/[✔✓]/g, 'OK')
    .replace(/[✖✗]/g, 'X')
    .replace(/⚠/g, '!')
    .replace(/ℹ/g, 'i')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–/g, '-')
    .replace(/[^\x00-\xFF—…•]/g, '');
}

export async function criarPdf(orientacao: 'p' | 'l' = 'p'): Promise<Doc> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  return doc;
}

export async function tabela(doc: Doc, opcoes: Parameters<typeof import('jspdf-autotable').default>[1]): Promise<void> {
  const autoTable = (await import('jspdf-autotable')).default;
  autoTable(doc, {
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 81, 50], textColor: 255 },
    margin: { left: 12, right: 12, bottom: 18 },
    ...opcoes,
  });
}

/** Posição Y após a última tabela. */
export function yAposTabela(doc: Doc, padrao: number): number {
  return ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? padrao) + 6;
}

export function cabecalho(doc: Doc, titulo: string, subtitulo?: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(pdfSeguro(titulo), 12, 15);
  let y = 15;
  if (subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(pdfSeguro(subtitulo), doc.internal.pageSize.getWidth() - 24);
    doc.text(linhas, 12, 21);
    y = 21 + linhas.length * 4;
  }
  return y + 4;
}

/** Marca d'água diagonal e rodapé com aviso legal e numeração em todas as páginas. */
export function finalizar(doc: Doc, marcaDagua?: string): void {
  const total = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (marcaDagua) {
      const d = doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void; saveGraphicsState: () => void; restoreGraphicsState: () => void };
      d.saveGraphicsState();
      d.setGState(new d.GState({ opacity: 0.12 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(46);
      doc.setTextColor(180, 0, 0);
      doc.text(pdfSeguro(marcaDagua), w / 2, h / 2, { angle: 35, align: 'center' });
      d.restoreGraphicsState();
      doc.setTextColor(0, 0, 0);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const aviso = doc.splitTextToSize(pdfSeguro(AVISO_LEGAL), w - 40);
    doc.text(aviso, 12, h - 9);
    doc.text(`Página ${i} de ${total}`, w - 12, h - 9, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

/** Escreve blocos de texto com quebra automática de página. */
export function escreverBlocos(doc: Doc, blocos: Bloco[], yInicial: number): number {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const largura = w - 24;
  let y = yInicial;
  const garantir = (altura: number) => {
    if (y + altura > h - 20) {
      doc.addPage();
      y = 18;
    }
  };
  for (const b of blocos) {
    if (b.tipo === 'espaco') {
      y += 4;
      continue;
    }
    if (b.tipo === 'quebra_pagina') {
      doc.addPage();
      y = 18;
      continue;
    }
    const texto = pdfSeguro(b.texto ?? '');
    const estilos: Record<Exclude<Bloco['tipo'], 'espaco' | 'quebra_pagina'>, [string, number, number]> = {
      titulo: ['bold', 13, 6],
      subtitulo: ['bold', 10.5, 5],
      paragrafo: ['normal', 10, 4.6],
      item: ['normal', 10, 4.6],
      destaque: ['bold', 10, 4.6],
      assinatura: ['normal', 10, 4.6],
    };
    const [fonte, tamanho, entrelinha] = estilos[b.tipo];
    doc.setFont('helvetica', fonte);
    doc.setFontSize(tamanho);
    if (b.tipo === 'assinatura') {
      garantir(20);
      y += 12;
      doc.line(12, y, 100, y);
      doc.text(texto, 12, y + 5);
      y += 10;
      continue;
    }
    const recuo = b.tipo === 'item' ? 5 : 0;
    const linhas: string[] = doc.splitTextToSize(b.tipo === 'item' ? `• ${texto}` : texto, largura - recuo);
    for (const l of linhas) {
      garantir(entrelinha);
      doc.text(l, 12 + recuo, y);
      y += entrelinha;
    }
    y += b.tipo === 'titulo' ? 3 : b.tipo === 'subtitulo' ? 1.5 : 2;
  }
  return y;
}

export function pdfParaBlob(doc: Doc): Blob {
  return doc.output('blob');
}
