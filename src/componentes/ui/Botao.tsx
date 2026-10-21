import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
type Tamanho = 'normal' | 'pequeno';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-700 text-white hover:bg-marca-800',
  secundario: 'border border-slate-400 bg-white text-slate-900 hover:bg-slate-100',
  perigo: 'bg-red-700 text-white hover:bg-red-800',
  fantasma: 'text-marca-800 hover:bg-marca-50 underline-offset-2 hover:underline',
};
const TAMANHOS: Record<Tamanho, string> = {
  normal: 'min-h-11 px-4 py-2 text-base',
  pequeno: 'min-h-9 px-3 py-1.5 text-sm',
};

export function classesBotao(variante: Variante = 'primario', tamanho: Tamanho = 'normal', extra = '') {
  return `${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${extra}`;
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  children: ReactNode;
}

export function Botao({ variante = 'primario', tamanho = 'normal', className = '', type = 'button', ...resto }: Props) {
  return <button type={type} className={classesBotao(variante, tamanho, className)} {...resto} />;
}

interface PropsLink extends LinkProps {
  variante?: Variante;
  tamanho?: Tamanho;
}

export function BotaoLink({ variante = 'primario', tamanho = 'normal', className = '', ...resto }: PropsLink) {
  return <Link className={classesBotao(variante, tamanho, className)} {...resto} />;
}
