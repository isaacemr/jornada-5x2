/** Documento neutro (independe do formato): blocos que viram PDF, DOCX ou HTML. */
export interface Bloco {
  tipo: 'titulo' | 'subtitulo' | 'paragrafo' | 'item' | 'destaque' | 'espaco' | 'assinatura' | 'quebra_pagina';
  texto?: string;
}

export const titulo = (texto: string): Bloco => ({ tipo: 'titulo', texto });
export const subtitulo = (texto: string): Bloco => ({ tipo: 'subtitulo', texto });
export const paragrafo = (texto: string): Bloco => ({ tipo: 'paragrafo', texto });
export const item = (texto: string): Bloco => ({ tipo: 'item', texto });
export const destaque = (texto: string): Bloco => ({ tipo: 'destaque', texto });
export const espaco = (): Bloco => ({ tipo: 'espaco' });
export const assinatura = (texto: string): Bloco => ({ tipo: 'assinatura', texto });
export const quebraPagina = (): Bloco => ({ tipo: 'quebra_pagina' });

/** Texto corrido (para pré-visualização e testes). */
export function blocosParaTexto(blocos: Bloco[]): string {
  return blocos
    .map((b) => (b.tipo === 'item' ? `• ${b.texto}` : b.tipo === 'espaco' || b.tipo === 'quebra_pagina' ? '' : b.texto ?? ''))
    .join('\n');
}
