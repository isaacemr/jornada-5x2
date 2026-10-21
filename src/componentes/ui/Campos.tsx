import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface Base {
  rotulo: ReactNode;
  dica?: ReactNode;
  erro?: string | null;
  className?: string;
}

function Rodape({ dicaId, erroId, dica, erro }: { dicaId: string; erroId: string; dica?: ReactNode; erro?: string | null }) {
  return (
    <>
      {dica && (
        <p id={dicaId} className="mt-1 text-sm text-slate-600">
          {dica}
        </p>
      )}
      {erro && (
        <p id={erroId} className="mt-1 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}
    </>
  );
}

function descritoPor(dicaId: string, erroId: string, dica?: ReactNode, erro?: string | null) {
  return [dica ? dicaId : '', erro ? erroId : ''].filter(Boolean).join(' ') || undefined;
}

type PropsTexto = Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>;

export function CampoTexto({ rotulo, dica, erro, className = '', ...resto }: PropsTexto) {
  const id = useId();
  const dicaId = `${id}-dica`;
  const erroId = `${id}-erro`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <input
        id={id}
        className="campo-input"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor(dicaId, erroId, dica, erro)}
        {...resto}
      />
      <Rodape dicaId={dicaId} erroId={erroId} dica={dica} erro={erro} />
    </div>
  );
}

type PropsSelect = Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  opcoes: { valor: string; texto: string }[];
};

export function CampoSelect({ rotulo, dica, erro, className = '', opcoes, ...resto }: PropsSelect) {
  const id = useId();
  const dicaId = `${id}-dica`;
  const erroId = `${id}-erro`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <select
        id={id}
        className="campo-input"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor(dicaId, erroId, dica, erro)}
        {...resto}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      <Rodape dicaId={dicaId} erroId={erroId} dica={dica} erro={erro} />
    </div>
  );
}

type PropsArea = Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export function CampoArea({ rotulo, dica, erro, className = '', ...resto }: PropsArea) {
  const id = useId();
  const dicaId = `${id}-dica`;
  const erroId = `${id}-erro`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <textarea
        id={id}
        className="campo-input min-h-24"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor(dicaId, erroId, dica, erro)}
        {...resto}
      />
      <Rodape dicaId={dicaId} erroId={erroId} dica={dica} erro={erro} />
    </div>
  );
}

type PropsCheck = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  rotulo: ReactNode;
  dica?: ReactNode;
  className?: string;
};

export function CampoCheckbox({ rotulo, dica, className = '', ...resto }: PropsCheck) {
  const id = useId();
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-500 accent-marca-700"
        aria-describedby={dica ? `${id}-dica` : undefined}
        {...resto}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {rotulo}
        </label>
        {dica && (
          <p id={`${id}-dica`} className="text-sm text-slate-600">
            {dica}
          </p>
        )}
      </div>
    </div>
  );
}

/** Grupo de opções exclusivas (rádio) com legenda acessível. */
export function GrupoRadio<T extends string>({
  legenda,
  nome,
  valor,
  opcoes,
  onChange,
  dica,
  className = '',
}: {
  legenda: ReactNode;
  nome: string;
  valor: T;
  opcoes: { valor: T; texto: string }[];
  onChange: (v: T) => void;
  dica?: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-1 text-sm font-medium text-slate-800">{legenda}</legend>
      {dica && <p className="mb-2 text-sm text-slate-600">{dica}</p>}
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              valor === o.valor ? 'border-marca-700 bg-marca-50 font-medium' : 'border-slate-400 bg-white'
            }`}
          >
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => onChange(o.valor)}
              className="h-4 w-4 accent-marca-700"
            />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
