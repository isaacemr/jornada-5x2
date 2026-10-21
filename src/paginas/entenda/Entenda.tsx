import { Link } from 'react-router-dom';
import { FAQ, RESUMO } from '../../config/faq';
import { REGRAS, regrasPendentesDeConfirmacao } from '../../config/regras-ec141';
import { AVISO_LEGAL } from '../../config/textos-juridicos';
import { formatarData, formatarDuracao } from '../../dominio/tempo';
import { Alerta, CabecalhoPagina, Cartao } from '../../componentes/ui/Basicos';

export default function Entenda() {
  const pendentes = regrasPendentesDeConfirmacao();
  const e1 = REGRAS.etapa1;
  const e2 = REGRAS.etapa2;
  return (
    <>
      <CabecalhoPagina
        titulo="Entenda a EC 141/2026"
        descricao={`O que muda na jornada de trabalho com a ${REGRAS.norma.nome}, promulgada em ${formatarData(REGRAS.norma.promulgacao)}, em linguagem simples.`}
      />
      <Alerta tipo="aviso" className="mb-5">
        {AVISO_LEGAL}
      </Alerta>

      <section aria-labelledby="titulo-resumo" className="mb-6">
        <h2 id="titulo-resumo" className="mb-3">
          Em resumo
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {RESUMO.map((r) => (
            <Cartao key={r.titulo} titulo={r.titulo}>
              <p className="text-slate-800">{r.texto}</p>
            </Cartao>
          ))}
        </div>
      </section>

      <Cartao className="mb-6" titulo="Comparação rápida">
        <div className="overflow-x-auto">
          <table className="tabela">
            <caption className="sr-only">Regras antes e depois da EC 141/2026</caption>
            <thead>
              <tr>
                <th scope="col">Regra</th>
                <th scope="col">Antes</th>
                <th scope="col">Etapa 1 ({formatarData(e1.inicio)})</th>
                <th scope="col">Etapa 2 ({formatarData(e2.inicio)})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="!bg-transparent">Horas por semana</th>
                <td>{formatarDuracao(REGRAS.regimeAnterior.limiteSemanalMin)}</td>
                <td>{formatarDuracao(e1.limiteSemanalMin)}</td>
                <td>{formatarDuracao(e2.limiteSemanalMin)}</td>
              </tr>
              <tr>
                <th scope="row" className="!bg-transparent">Horas por dia</th>
                <td>{formatarDuracao(REGRAS.regimeAnterior.limiteDiarioMin)}</td>
                <td>{formatarDuracao(e1.limiteDiarioMin)} (mais, só com acordo coletivo)</td>
                <td>{formatarDuracao(e2.limiteDiarioMin)}</td>
              </tr>
              <tr>
                <th scope="row" className="!bg-transparent">Dias de repouso por semana</th>
                <td>{REGRAS.regimeAnterior.diasRepousoSemanal}</td>
                <td>{e1.diasRepousoSemanal}</td>
                <td>{e2.diasRepousoSemanal}</td>
              </tr>
              <tr>
                <th scope="row" className="!bg-transparent">Divisor do valor-hora</th>
                <td>{REGRAS.divisores.porHorasSemanais[44]}</td>
                <td>{REGRAS.divisores.porHorasSemanais[42]}</td>
                <td>{REGRAS.divisores.porHorasSemanais[40]}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Cartao>

      <section aria-labelledby="titulo-faq" className="mb-6">
        <h2 id="titulo-faq" className="mb-3">
          Perguntas frequentes
        </h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.pergunta} className="group rounded-lg border border-slate-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
                {f.pergunta}
                <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="space-y-2 px-4 pb-4 text-slate-800">
                {f.resposta.map((r) => (
                  <p key={r}>{r}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <Cartao titulo="Pontos ainda a conferir no texto oficial" descricao={`Regras cadastradas na revisão de ${formatarData(REGRAS.versaoRegras)}. Os itens abaixo estão marcados para confirmação.`}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {pendentes.map((p) => (
            <li key={p.chave}>
              <code className="text-xs">{p.chave}</code> — {p.fonte}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-700">
          Confira o texto publicado no Diário Oficial da União e no site do Planalto, e também a sua convenção coletiva. Para começar a adequação, vá ao{' '}
          <Link to="/" className="underline">
            painel
          </Link>
          .
        </p>
      </Cartao>
    </>
  );
}
