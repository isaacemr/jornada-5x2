import { Component, type ReactNode } from 'react';

interface Estado {
  erro: Error | null;
}

/** Mostra uma mensagem amigável se uma página falhar, sem derrubar o restante do app. */
export class LimiteErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="rounded-lg border-l-4 border-red-700 bg-red-50 p-4 text-red-950">
        <h1 className="text-xl">Algo deu errado nesta tela</h1>
        <p className="mt-2">Seus dados continuam salvos neste navegador. Tente voltar ao painel ou recarregar a página.</p>
        <p className="mt-2 text-sm">Detalhe técnico: {this.state.erro.message}</p>
        <div className="mt-3 flex gap-2">
          <a href="#/" className="underline" onClick={() => this.setState({ erro: null })}>
            Voltar ao painel
          </a>
          <button type="button" className="underline" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
