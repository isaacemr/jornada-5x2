import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../dados/db';
import { agoraISO } from '../../dados/padroes';
import { calcularCobertura, limitesParaCobertura, type ResultadoTurno } from '../../dominio/cobertura';
import { divisorPara } from '../../dominio/remuneracao';
import { formatarDuracao, formatarMoeda, formatarNumero } from '../../dominio/tempo';
import { DIAS_SEMANA, NOME_DIA_CURTO, type CoberturaSetor, type TurnoCobertura } from '../../dominio/tipos';
import { useContexto, useFuncionarios } from '../../hooks/useDados';
import { corTurno, EditorTurnos, novoTurno } from '../../componentes/EditorTurnos';
import { Botao } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Selo } from '../../componentes/ui/Basicos';
import { CampoSelect, CampoTexto, GrupoRadio } from '../../componentes/ui/Campos';

export default function Cobertura() {
  const funcionarios = useFuncionarios();
  const coberturas = useLiveQuery(() => db.coberturas.toArray(), []);
  const { empresa, etapaHoje } = useContexto();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const [etapa, setEtapa] = useState<1 | 2>(etapaHoje === 2 ? 2 : 1);
  const [dados, setDados] = useState<CoberturaSetor | null>(null);
  const [salarioTxt, setSalarioTxt] = useState('');

  const setores = useMemo(
    () => [...new Set([...(funcionarios ?? []).map((f) => f.setor), ...(coberturas ?? []).map((c) => c.setor)])].filter(Boolean).sort(),
    [funcionarios, coberturas],
  );
  const setor = params.get('setor') ?? setores[0] ?? '';
  const equipe = useMemo(() => (funcionarios ?? []).filter((f) => f.setor === setor), [funcionarios, setor]);
  const salarioMedio = equipe.length ? equipe.reduce((s, f) => s + f.salario, 0) / equipe.length : 0;

  // Carrega/cria a configuração do setor
  useEffect(() => {
    if (!coberturas || !setor) return;
    if (dados?.setor === setor) return;
    const existente = coberturas.find((c) => c.id === setor);
    const novo: CoberturaSetor = existente ?? { id: setor, setor, turnos: [novoTurno(true)], salarioReferencia: null, atualizadoEm: agoraISO() };
    setDados(novo);
    setSalarioTxt(novo.salarioReferencia ? formatarNumero(novo.salarioReferencia) : '');
  }, [coberturas, setor, dados?.setor]);

  // Salva automaticamente
  useEffect(() => {
    if (!dados) return;
    const t = setTimeout(() => void db.coberturas.put({ ...dados, atualizadoEm: agoraISO() }), 400);
    return () => clearTimeout(t);
  }, [dados]);

  const N = empresa?.config.domingoFolgaACadaSemanas ?? 4;
  const acordo = empresa?.config.acordoAmpliaJornadaEtapa1 === 'sim' && etapa === 1;
  const limites = limitesParaCobertura(etapa, acordo);
  const salarioRef = dados?.salarioReferencia ?? salarioMedio;

  // `limites` é recriado a cada render: as dependências usam seus valores.
  const resultado = useMemo(() => {
    if (!dados) return null;
    const cfg = empresa?.config;
    return calcularCobertura({
      turnos: dados.turnos,
      limites,
      domingoFolgaACadaSemanas: N,
      pessoasAtuais: equipe.length,
      custo: {
        salarioReferencia: salarioRef,
        encargosPercentual: cfg?.encargosPercentual ?? null,
        divisor: divisorPara(limites.limiteSemanalMin, cfg?.divisores ?? { 44: 220, 42: 210, 40: 200 }),
        adicionalHoraExtra: cfg?.adicionalHoraExtra ?? 0.5,
        adicionalDomingo: cfg?.adicionalDomingoFeriado ?? 1,
      },
    });
  }, [dados, limites.limiteSemanalMin, limites.limiteDiarioMin, N, equipe.length, salarioRef, empresa]);

  if (!funcionarios || !coberturas) return <Carregando />;

  return (
    <>
      <CabecalhoPagina
        titulo="Calculadora de cobertura"
        descricao="Para quem funciona muitos dias ou horas por semana: descubra quantas pessoas cada turno precisa na 5x2, com revezamento de folgas e domingos."
        acoes={
          <Link to={`/escala?setor=${encodeURIComponent(setor)}`} className="underline">
            Ir para o montador de escala
          </Link>
        }
      />

      {setores.length === 0 ? (
        <Alerta tipo="info">Cadastre funcionários com setor para usar a calculadora.</Alerta>
      ) : (
        <div className="space-y-5">
          <Cartao>
            <div className="grid gap-4 md:grid-cols-3">
              <CampoSelect
                rotulo="Setor"
                value={setor}
                onChange={(e) => {
                  setParams({ setor: e.target.value }, { replace: true });
                  setDados(null);
                }}
                opcoes={setores.map((s) => ({ valor: s, texto: s }))}
                dica={`${equipe.length} pessoa(s) cadastradas neste setor.`}
              />
              <GrupoRadio
                legenda="Calcular para"
                nome="etapa-cob"
                valor={String(etapa) as '1' | '2'}
                onChange={(v) => setEtapa(Number(v) as 1 | 2)}
                opcoes={[
                  { valor: '1', texto: 'Etapa 1 (42 h)' },
                  { valor: '2', texto: 'Etapa 2 (40 h)' },
                ]}
              />
              <CampoTexto
                rotulo="Salário de referência (R$)"
                inputMode="decimal"
                placeholder={salarioMedio ? `Média do setor: ${formatarNumero(salarioMedio)}` : ''}
                value={salarioTxt}
                onChange={(e) => {
                  setSalarioTxt(e.target.value);
                  const v = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
                  if (dados) setDados({ ...dados, salarioReferencia: e.target.value.trim() && Number.isFinite(v) ? v : null });
                }}
                dica="Usado para estimar custo de contratar e de horas extras. Vazio = média do setor."
              />
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Regras usadas: até {formatarDuracao(limites.limiteSemanalMin)} por semana, {formatarDuracao(limites.limiteDiarioMin)} por dia
              {acordo ? ' (com acordo coletivo)' : ''}, 2 folgas por semana e ao menos 1 domingo de folga a cada {N} semanas.{' '}
              <Link to="/empresa" className="underline">
                Alterar regra de domingos
              </Link>
            </p>
          </Cartao>

          {dados && (
            <Cartao titulo="Turnos e pessoas necessárias" descricao="Informe cada turno e quantas pessoas precisam estar trabalhando ao mesmo tempo em cada dia. Use 0 nos dias em que o turno não funciona.">
              <EditorTurnos<TurnoCobertura> turnos={dados.turnos} comDemanda criar={() => novoTurno(true)} onChange={(t) => setDados({ ...dados, turnos: t })} />
            </Cartao>
          )}

          {resultado && (
            <>
              <Cartao titulo="Resultado">
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Indicador rotulo="Pessoas necessárias" valor={String(resultado.pessoasNecessarias)} />
                  <Indicador rotulo="Pessoas no setor hoje" valor={String(resultado.pessoasAtuais)} />
                  <Indicador rotulo="Faltam" valor={String(resultado.faltam)} destaque={resultado.faltam > 0} />
                  <Indicador
                    rotulo="Horas descobertas"
                    valor={`${formatarNumero(resultado.horasDescobertasSemana, 1)} h/sem.`}
                    extra={`≈ ${formatarNumero(resultado.horasDescobertasMes, 0)} h/mês`}
                    destaque={resultado.horasDescobertasSemana > 0}
                  />
                </dl>
              </Cartao>

              {resultado.turnos.map((t, i) => (
                <ResultadoDoTurno key={t.turno.id} r={t} indice={i} nomes={equipe.map((f) => f.nome)} />
              ))}

              <Cartao titulo="Como cobrir a lacuna — custo estimado por mês" descricao="Estimativas simples para comparar caminhos. Confirme os valores com seu contador.">
                <div className="grid gap-3 md:grid-cols-2">
                  {resultado.alternativas.map((a) => (
                    <article key={a.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3>{a.titulo}</h3>
                        {!a.viavel && <Selo cor="vermelho">Não resolve sozinho</Selo>}
                      </div>
                      <p className="mt-1 text-2xl font-bold">{a.custoMensal === null ? '—' : formatarMoeda(a.custoMensal)}</p>
                      <p className="text-sm text-slate-700">{a.detalhe}</p>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                        {a.observacoes.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </Cartao>

              <div className="flex flex-wrap gap-2">
                <Botao onClick={() => navegar(`/escala?setor=${encodeURIComponent(setor)}&sugerir=1`)}>Montar escala do setor com esta sugestão</Botao>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Indicador({ rotulo, valor, extra, destaque }: { rotulo: string; valor: string; extra?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${destaque ? 'border-red-700 bg-red-50' : 'border-slate-200'}`}>
      <dt className="text-sm text-slate-700">{rotulo}</dt>
      <dd className="text-2xl font-bold">{valor}</dd>
      {extra && <dd className="text-sm text-slate-700">{extra}</dd>}
    </div>
  );
}

function ResultadoDoTurno({ r, indice, nomes }: { r: ResultadoTurno; indice: number; nomes: string[] }) {
  const [semana, setSemana] = useState(0);
  const rev = r.revezamento;
  const total = rev.trabalha.length;
  const w = Math.min(semana, Math.max(0, total - 1));
  return (
    <Cartao
      titulo={
        <span className="flex items-center gap-2">
          <span className={`inline-block h-4 w-4 rounded border ${corTurno(indice)}`} aria-hidden="true" />
          Turno {r.turno.nome} ({r.turno.inicio}–{r.turno.fim})
        </span>
      }
      descricao={`${formatarDuracao(r.duracaoMin)} de trabalho por dia · ${r.diasPorPessoa} dias por pessoa · ${r.vagasSemana} vagas-dia por semana`}
    >
      <p className="mb-2">
        Precisa de <strong>{r.pessoasNecessarias}</strong> pessoa(s). Com a equipe atual, ficam <strong>{r.pessoasAlocadas}</strong> neste turno.
      </p>
      <p className="mb-3 text-sm text-slate-700">
        Cálculo: {r.vagasSemana} vagas ÷ {r.diasPorPessoa} dias = {r.minimoPorCarga}; pico diário {r.pico}
        {r.minimoPorDomingo > 0 && <>; para folgas de domingo: {r.minimoPorDomingo}</>}.
      </p>
      {r.alertas.map((a) => (
        <Alerta key={a} tipo="aviso" className="mb-2">
          {a}
        </Alerta>
      ))}

      {r.pessoasAlocadas > 0 && total > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="mr-2">Revezamento sugerido</h3>
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSemana(i)}
                aria-pressed={i === w}
                className={`min-h-9 rounded-md border px-3 text-sm ${i === w ? 'border-marca-700 bg-marca-700 text-white' : 'border-slate-400'}`}
              >
                Semana {i + 1}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="tabela text-center">
              <caption className="sr-only">Revezamento do turno {r.turno.nome}, semana {w + 1}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left">Pessoa</th>
                  {DIAS_SEMANA.map((d) => (
                    <th key={d} scope="col">
                      {NOME_DIA_CURTO[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rev.trabalha[w].map((linha, p) => (
                  <tr key={p}>
                    <th scope="row" className="!bg-transparent text-left font-normal">
                      Pessoa {p + 1}
                    </th>
                    {linha.map((trab, d) => (
                      <td key={d} className={trab ? corTurno(indice) : 'bg-slate-100 text-slate-700'}>
                        {trab ? 'T' : 'Folga'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="!bg-white text-left">
                    Trabalhando / necessário
                  </th>
                  {DIAS_SEMANA.map((d, i) => {
                    const falta = rev.descoberto[w][i] > 0;
                    return (
                      <td key={d} className={`font-semibold ${falta ? 'bg-red-50 text-red-800' : ''}`}>
                        {rev.cobertura[w][i]}/{r.turno.demanda[d]}
                        {falta && <span className="sr-only"> (faltam {rev.descoberto[w][i]})</span>}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            “T” = trabalha. O ciclo de {total} semana(s) se repete. {nomes.length > 0 && 'Os nomes reais são distribuídos no montador de escala.'}
          </p>
        </div>
      )}
    </Cartao>
  );
}
