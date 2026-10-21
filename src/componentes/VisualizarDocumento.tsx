import type { Bloco } from '../dominio/documento';

/** Pré-visualização em HTML de um documento em blocos, com marca d'água opcional. */
export function VisualizarDocumento({ blocos, marca }: { blocos: Bloco[]; marca?: string }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-slate-300 bg-white p-5 shadow-inner sm:p-8">
      {marca && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-30 text-4xl font-black whitespace-nowrap text-red-700/10 sm:text-6xl">{marca}</span>
        </div>
      )}
      <div className="relative space-y-2 text-[0.95rem] leading-relaxed">
        {blocos.map((b, i) => {
          switch (b.tipo) {
            case 'titulo':
              return (
                <h3 key={i} className="text-lg font-bold">
                  {b.texto}
                </h3>
              );
            case 'subtitulo':
              return (
                <h4 key={i} className="pt-2 font-semibold">
                  {b.texto}
                </h4>
              );
            case 'item':
              return (
                <p key={i} className="pl-5 -indent-3">
                  • {b.texto}
                </p>
              );
            case 'destaque':
              return (
                <p key={i} className="font-bold text-red-800">
                  {b.texto}
                </p>
              );
            case 'espaco':
              return <div key={i} className="h-2" />;
            case 'quebra_pagina':
              return <hr key={i} className="my-6 border-dashed border-slate-400" />;
            case 'assinatura':
              return (
                <div key={i} className="pt-8">
                  <div className="w-72 max-w-full border-t border-slate-800" />
                  <p>{b.texto}</p>
                </div>
              );
            default:
              return (
                <p key={i} className="text-justify">
                  {b.texto}
                </p>
              );
          }
        })}
      </div>
    </div>
  );
}
