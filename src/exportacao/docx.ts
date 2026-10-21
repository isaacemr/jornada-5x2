/** Gera DOCX a partir de blocos (biblioteca `docx` carregada sob demanda). */
import { AVISO_LEGAL } from '../config/textos-juridicos';
import type { Bloco } from '../dominio/documento';

export interface OpcoesDocx {
  /** Texto exibido em vermelho no cabeçalho de todas as páginas (ex.: "MODELO — revisar antes de assinar"). */
  marca?: string;
  titulo?: string;
}

/** Converte uma ou mais seções (cada uma começa em nova página) em DOCX. */
export async function blocosParaDocx(secoes: Bloco[][], op: OpcoesDocx = {}): Promise<Blob> {
  const d = await import('docx');
  const { AlignmentType, Document, Footer, Header, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } = d;

  const paragrafos = (blocos: Bloco[]) =>
    blocos.map((b) => {
      switch (b.tipo) {
        case 'titulo':
          return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 160 }, children: [new TextRun({ text: b.texto ?? '', bold: true })] });
        case 'subtitulo':
          return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 80 }, children: [new TextRun({ text: b.texto ?? '', bold: true })] });
        case 'item':
          return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(b.texto ?? '')] });
        case 'destaque':
          return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: b.texto ?? '', bold: true, color: 'B00000' })] });
        case 'espaco':
          return new Paragraph({ children: [] });
        case 'quebra_pagina':
          return new Paragraph({ children: [new PageBreak()] });
        case 'assinatura':
          return new Paragraph({
            spacing: { before: 600, after: 120 },
            children: [new TextRun('______________________________________________'), new TextRun({ text: b.texto ?? '', break: 1 })],
          });
        default:
          return new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun(b.texto ?? '')] });
      }
    });

  const header = op.marca
    ? new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: op.marca, bold: true, color: 'B00000', size: 22 })] })] })
    : undefined;
  const footer = new Footer({ children: [new Paragraph({ children: [new TextRun({ text: AVISO_LEGAL, size: 16, color: '555555' })] })] });

  const doc = new Document({
    creator: 'Jornada 5x2',
    title: op.titulo ?? 'Documento',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: secoes.map((blocos) => ({
      headers: header ? { default: header } : undefined,
      footers: { default: footer },
      children: paragrafos(blocos),
    })),
  });
  return Packer.toBlob(doc);
}

/** Converte seções em PDF (uma seção por página inicial). */
export async function blocosParaPdf(secoes: Bloco[][], marca?: string): Promise<Blob> {
  const { criarPdf, escreverBlocos, finalizar, pdfParaBlob } = await import('./pdf');
  const doc = await criarPdf('p');
  secoes.forEach((s, i) => {
    if (i > 0) doc.addPage();
    escreverBlocos(doc, s, 18);
  });
  finalizar(doc, marca);
  return pdfParaBlob(doc);
}
