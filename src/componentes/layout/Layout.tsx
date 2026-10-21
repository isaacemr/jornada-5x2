import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { REGRAS } from '../../config/regras-ec141';
import { AVISO_LEGAL, AVISO_PRIVACIDADE } from '../../config/textos-juridicos';
import { formatarData } from '../../dominio/tempo';

export const MENU = [
  { para: '/', texto: 'Painel', numero: '0' },
  { para: '/funcionarios', texto: 'Funcionários', numero: '1' },
  { para: '/jornada', texto: 'Redistribuir jornada', numero: '2' },
  { para: '/escala', texto: 'Escala e cobertura', numero: '3' },
  { para: '/acordos', texto: 'Acordos coletivos', numero: '4' },
  { para: '/contratos', texto: 'Contratos e ponto', numero: '5' },
  { para: '/plano', texto: 'Plano de ação', numero: '6' },
  { para: '/entenda', texto: 'Entenda a EC 141', numero: '?' },
] as const;

function ItensMenu({ aoClicar }: { aoClicar?: () => void }) {
  return (
    <ul className="space-y-1">
      {MENU.map((m) => (
        <li key={m.para}>
          <NavLink
            to={m.para}
            end={m.para === '/'}
            onClick={aoClicar}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-marca-800 text-white' : 'text-slate-800 hover:bg-slate-200'
              }`
            }
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs"
            >
              {m.numero}
            </span>
            {m.texto}
          </NavLink>
        </li>
      ))}
      <li className="pt-2">
        <NavLink
          to="/empresa"
          onClick={aoClicar}
          className={({ isActive }) =>
            `flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${isActive ? 'bg-marca-800 text-white' : 'text-slate-700 hover:bg-slate-200'}`
          }
        >
          Dados da empresa
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/backup"
          onClick={aoClicar}
          className={({ isActive }) =>
            `flex min-h-11 items-center rounded-md px-3 py-2 text-sm ${isActive ? 'bg-marca-800 text-white' : 'text-slate-700 hover:bg-slate-200'}`
          }
        >
          Backup e dados de exemplo
        </NavLink>
      </li>
    </ul>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();

  // Ao trocar de página, fecha o menu e leva o foco ao conteúdo (leitores de tela).
  useEffect(() => {
    setMenuAberto(false);
    document.getElementById('conteudo')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [local.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-3"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('conteudo')?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <header className="nao-imprimir sticky top-0 z-30 bg-marca-800 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold">
            <span aria-hidden="true" className="rounded bg-white px-1.5 py-0.5 text-sm text-marca-800">
              5x2
            </span>
            <span>
              Jornada 5x2 <span className="hidden font-normal sm:inline">— Adequação à EC 141/2026</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="min-h-11 rounded-md border border-white/60 px-3 text-sm lg:hidden"
            aria-expanded={menuAberto}
            aria-controls="menu-movel"
            onClick={() => setMenuAberto((v) => !v)}
          >
            {menuAberto ? 'Fechar menu' : 'Menu'}
          </button>
        </div>
      </header>

      {menuAberto && (
        <nav id="menu-movel" aria-label="Menu principal" className="nao-imprimir border-b border-slate-300 bg-slate-50 p-3 lg:hidden">
          <ItensMenu aoClicar={() => setMenuAberto(false)} />
        </nav>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-5">
        <nav aria-label="Menu principal" className="nao-imprimir hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20">
            <ItensMenu />
          </div>
        </nav>
        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>

      <footer className="border-t border-slate-300 bg-white">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{AVISO_LEGAL}</p>
          <p>{AVISO_PRIVACIDADE}</p>
          <p>
            Regras cadastradas conforme a {REGRAS.norma.nomeCurto} (promulgada em {formatarData(REGRAS.norma.promulgacao)}) — revisão de{' '}
            {formatarData(REGRAS.versaoRegras)}.
          </p>
        </div>
      </footer>
    </div>
  );
}
