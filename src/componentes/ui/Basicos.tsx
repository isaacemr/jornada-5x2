import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Severidade, StatusDiagnostico } from '../../dominio/tipos';

type TipoAlerta = 'info' | 'aviso' | 'erro' | 'sucesso';

const ESTILO_ALERTA: Record<TipoAlerta, { caixa: string; icone: string; rotulo: string }> = {
  info: { caixa: 'border-sky-700 bg-sky-50 text-sky-950', icone: 'ℹ', rotulo: 'Informação' },
  aviso: { caixa: 'border-amber-600 bg-amber-50 text-amber-950', icone: '⚠', rotulo: 'Atenção' },
  erro: { caixa: 'border-red-700 bg-red-50 text-red-950', icone: '✖', rotulo: 'Problema' },
  sucesso: { caixa: 'border-marca-700 bg-marca-50 text-marca-900', icone: '✔', rotulo: 'Tudo certo' },
};

export function severidadeParaAlerta(s: Severidade): TipoAlerta {
  return s === 'erro' ? 'erro' : s === 'aviso' ? 'aviso' : 'info';
}

export function Alerta({
  tipo = 'info',
  titulo,
  children,
  className = '',
  vivo = false,
}: {
  tipo?: TipoAlerta;
  titulo?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Anuncia mudanças para leitores de tela. */
  vivo?: boolean;
}) {
  const e = ESTILO_ALERTA[tipo];
  return (
    <div
      className={`flex gap-3 rounded-md border-l-4 p-3 text-sm ${e.caixa} ${className}`}
      role={vivo ? (tipo === 'erro' ? 'alert' : 'status') : undefined}
    >
      <span aria-hidden="true" className="text-base leading-5">
        {e.icone}
      </span>
      <div className="min-w-0">
        <span className="sr-only">{e.rotulo}: </span>
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function Cartao({
  titulo,
  descricao,
  acoes,
  children,
  className = '',
  id,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(titulo || acoes) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-sm text-slate-600">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  useEffect(() => {
    document.title = `${titulo} · Jornada 5x2`;
  }, [titulo]);
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{titulo}</h1>
        {descricao && <p className="mt-1 max-w-3xl text-slate-700">{descricao}</p>}
      </div>
      {acoes && <div className="nao-imprimir flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

const STATUS: Record<StatusDiagnostico, { texto: string; classe: string }> = {
  adequado: { texto: 'Adequado', classe: 'bg-marca-100 text-marca-900 border-marca-700' },
  ajustar_etapa1: { texto: 'Ajustar até etapa 1', classe: 'bg-red-50 text-red-900 border-red-700' },
  ajustar_etapa2: { texto: 'Ajustar até etapa 2', classe: 'bg-amber-50 text-amber-950 border-amber-600' },
  depende_acordo: { texto: 'Depende de acordo coletivo', classe: 'bg-sky-50 text-sky-950 border-sky-700' },
};

export function SeloStatus({ status, texto }: { status: StatusDiagnostico; texto?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.classe}`}>
      {texto ?? s.texto}
    </span>
  );
}

export function Selo({ children, cor = 'cinza' }: { children: ReactNode; cor?: 'cinza' | 'verde' | 'amarelo' | 'vermelho' | 'azul' }) {
  const cores = {
    cinza: 'bg-slate-100 text-slate-800 border-slate-400',
    verde: 'bg-marca-100 text-marca-900 border-marca-700',
    amarelo: 'bg-amber-50 text-amber-950 border-amber-600',
    vermelho: 'bg-red-50 text-red-900 border-red-700',
    azul: 'bg-sky-50 text-sky-950 border-sky-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cores[cor]}`}>
      {children}
    </span>
  );
}

/** Diálogo modal acessível usando <dialog> nativo. */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  largura = 'max-w-2xl',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal?.();
    if (!aberto && d.open) d.close?.();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      aria-labelledby={tituloId}
      className={`m-auto w-[calc(100%-2rem)] ${largura} rounded-lg p-0 shadow-xl backdrop:bg-slate-900/50`}
    >
      {aberto && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={tituloId}>{titulo}</h2>
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-md px-2 text-2xl leading-none text-slate-700 hover:bg-slate-100"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p role="status" className="p-6 text-slate-600">
      {texto}
    </p>
  );
}

/** Barra de progresso acessível. */
export function BarraProgresso({ valor, rotulo, cor = 'bg-marca-700' }: { valor: number; rotulo: string; cor?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-800">{rotulo}</span>
        <span className="font-semibold">{v}%</span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={rotulo}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${cor}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
