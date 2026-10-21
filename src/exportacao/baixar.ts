/** Dispara o download de um arquivo gerado no navegador. */
export function baixarBlob(conteudo: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(conteudo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baixarTexto(texto: string, nomeArquivo: string, tipo = 'text/plain;charset=utf-8'): void {
  baixarBlob(new Blob([texto], { type: tipo }), nomeArquivo);
}

/** Nome de arquivo seguro a partir de um texto livre. */
export function nomeSeguro(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'arquivo'
  );
}
