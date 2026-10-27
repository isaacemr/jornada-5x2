import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../../dados/db';
import { agoraISO } from '../../dados/padroes';
import { contextoDiagnostico, diagnosticar } from '../../dominio/diagnostico';
import { validarGrade } from '../../dominio/jornada';
import { gerarOpcoes, sugerirDiasTrabalho, type ClassificacaoOpcao } from '../../dominio/redistribuicao';
import { compararRemuneracao, configRemuneracaoPadrao } from '../../dominio/remuneracao';
import { formatarData, formatarDuracao, formatarMoeda, formatarNumero } from '../../dominio/tempo';
import { DIAS_SEMANA, NOME_DIA_CURTO, type DiaSemana, type GradeSemanal } from '../../dominio/tipos';
import { useContexto, useFuncionarios } from '../../hooks/useDados';
import { EditorGradeSemanal } from '../../componentes/GradeSemanal';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Modal, Selo } from '../../componentes/ui/Basicos';
import { CampoSelect, CampoTexto, GrupoRadio } from '../../componentes/ui/Campos';

const SELO_CLASSIFICACAO: Record<ClassificacaoOpcao, { texto: string; cor: 'verde' | 'amarelo' | 'vermelho' | 'azul' }> = {
  valida: { texto: 'Válida', cor: 'verde' },
  valida_com_acordo: { texto: 'Válida (há acordo coletivo)', cor: 'amarelo' },
  depende_acordo: { texto: 'Depende de acordo coletivo', cor: 'azul' },
  invalida: { texto: 'Não permitida com sua configuração', cor: 'vermelho' },
};

const ROTULO_ACORDO = { sim: 'sim', nao: 'não', nao_sei: 'não sei' } as const;

export default function SimuladorJornada() {
  const funcionarios = useFuncionarios();
  const { empresa, prazos } = useContexto();
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => (params.get('ids') ?? '').split(',').filter(Boolean), [params]);

  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [entrada, setEntrada] = useState('08:00');
  const [dias, setDias] = useState<DiaSemana[]>(['seg', 'ter', 'qua', 'qui', 'sex']);
  const [grade, setGrade] = useState<GradeSemanal | null>(null);
  const [vigencia, setVigencia] = useState('');
  const [divAntes, setDivAntes] = useState('');
  const [divDepois, setDivDepois] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [aplicado, setAplicado] = useState('');
  const [diasIniciados, setDiasIniciados] = useState(false);

  const selecionados = useMemo(() => (funcionarios ?? []).filter((f) => ids.includes(f.id)), [funcionarios, ids]);
  const ctxDiag = useMemo(() => contextoDiagnostico(prazos, empresa?.config), [prazos, empresa]);
  const cfgRem = empresa?.config ?? configRemuneracaoPadrao();

  // Sugere os dias de trabalho a partir do primeiro selecionado (uma vez).
  useEffect(() => {
    if (!diasIniciados && selecionados.length > 0) {
      setDias(sugerirDiasTrabalho(selecionados[0].gradeAtual));
      const e = DIAS_SEMANA.map((d) => selecionados[0].gradeAtual[d]).find((d) => d.trabalha);
      if (e) setEntrada(e.entrada);
      setDiasIniciados(true);
    }
  }, [selecionados, diasIniciados]);

  useEffect(() => {
    setVigencia(etapa === 1 ? prazos.inicioEtapa1 : prazos.inicioEtapa2);
  }, [etapa, prazos]);

  const opcValidacao = useMemo(
    () => ({
      acordoAmpliaDiaria: empresa?.config.acordoAmpliaJornadaEtapa1 ?? ('nao_sei' as const),
      acordoRegimeCompensatorio: empresa?.config.acordoRegimeCompensatorio ?? ('nao_sei' as const),
      domingoFolgaACadaSemanas: empresa?.config.domingoFolgaACadaSemanas ?? 4,
      funcionamento: empresa?.funcionamento,
    }),
    [empresa],
  );

  const opcoes = useMemo(() => gerarOpcoes({ etapa, entrada, diasTrabalho: dias, validacao: opcValidacao }), [etapa, entrada, dias, opcValidacao]);
  const validacao = useMemo(() => (grade ? validarGrade(grade, { ...opcValidacao, etapa }) : undefined), [grade, etapa, opcValidacao]);

  if (!funcionarios) return <Carregando />;

  const setIds = (novos: string[]) => {
    const p = new URLSearchParams(params);
    if (novos.length) p.set('ids', novos.join(','));
    else p.delete('ids');
    setParams(p, { replace: true });
    setAplicado('');
  };
  const disponiveis = funcionarios.filter((f) => !ids.includes(f.id));
  const precisam = funcionarios.filter((f) => diagnosticar(f, ctxDiag, 'atual').status !== 'adequado').map((f) => f.id);

  const alternarDia = (d: DiaSemana) => {
    setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : DIAS_SEMANA.filter((x) => x === d || atual.includes(x))));
  };

  async function aplicar() {
    if (!grade) return;
    const agora = agoraISO();
    await db.transaction('rw', db.funcionarios, async () => {
      for (const f of selecionados) {
        await db.funcionarios.update(f.id, { gradeNova: grade, vigenciaNovaGrade: vigencia || undefined, atualizadoEm: agora });
      }
    });
    setConfirmar(false);
    setAplicado(`Nova grade salva para ${selecionados.length} funcionário(s), com vigência a partir de ${vigencia ? formatarData(vigencia) : '—'}.`);
  }

  const divA = Number(divAntes.replace(',', '.')) || null;
  const divD = Number(divDepois.replace(',', '.')) || null;
  const semanalNovo = validacao?.resumo.totalSemanalMin ?? 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Redistribuir a jornada"
        descricao="Simule como distribuir 42 h (etapa 1) ou 40 h (etapa 2) em 5 dias, sem reduzir o salário, e veja o impacto no valor da hora."
      />

      <div className="space-y-5">
        <Cartao titulo="1. Quem entra na simulação" descricao="A mesma grade será aplicada a todos os selecionados. Para turnos diferentes, simule em grupos separados.">
          {selecionados.length === 0 ? (
            <p className="mb-3 text-slate-700">Nenhum funcionário selecionado. Você pode simular mesmo assim, ou escolha abaixo.</p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {selecionados.map((f) => (
                <li key={f.id} className="flex items-center gap-1 rounded-full border border-slate-400 bg-slate-50 py-1 pr-1 pl-3 text-sm">
                  <Link to={`/funcionarios/${f.id}`} className="underline">
                    {f.nome}
                  </Link>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-200"
                    aria-label={`Remover ${f.nome} da simulação`}
                    onClick={() => setIds(ids.filter((x) => x !== f.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <CampoSelect
              className="min-w-64"
              rotulo="Adicionar funcionário"
              value=""
              onChange={(e) => e.target.value && setIds([...ids, e.target.value])}
              opcoes={[{ valor: '', texto: 'Escolha…' }, ...disponiveis.map((f) => ({ valor: f.id, texto: `${f.nome} — ${f.setor}` }))]}
            />
            <Botao variante="secundario" onClick={() => setIds([...new Set([...ids, ...precisam])])} disabled={precisam.length === 0}>
              Adicionar todos que precisam ajustar ({precisam.length})
            </Botao>
            {ids.length > 0 && (
              <Botao variante="fantasma" onClick={() => setIds([])}>
                Limpar
              </Botao>
            )}
          </div>
        </Cartao>

        <Cartao titulo="2. Parâmetros">
          <div className="grid gap-4 lg:grid-cols-3">
            <GrupoRadio
              legenda="Meta"
              nome="etapa"
              valor={String(etapa) as '1' | '2'}
              onChange={(v) => setEtapa(Number(v) as 1 | 2)}
              opcoes={[
                { valor: '1', texto: `Etapa 1 — 42 h (a partir de ${formatarData(prazos.inicioEtapa1)})` },
                { valor: '2', texto: `Etapa 2 — 40 h (a partir de ${formatarData(prazos.inicioEtapa2)})` },
              ]}
            />
            <CampoTexto rotulo="Horário de entrada" type="time" value={entrada} onChange={(e) => setEntrada(e.target.value || '08:00')} />
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-800">Dias de trabalho (escolha 5)</legend>
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d) => (
                  <label
                    key={d}
                    className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-2 text-sm ${
                      dias.includes(d) ? 'border-marca-700 bg-marca-700 text-white' : 'border-slate-400 bg-white'
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={dias.includes(d)} onChange={() => alternarDia(d)} />
                    {NOME_DIA_CURTO[d]}
                  </label>
                ))}
              </div>
              {dias.length !== 5 && (
                <p className="mt-1 text-sm font-medium text-red-700" role="status">
                  Selecionados {dias.length} dias — escolha exatamente 5 (dois de repouso).
                </p>
              )}
            </fieldset>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Configuração da empresa: acordo coletivo permite mais de 8 h/dia na etapa 1? <strong>{ROTULO_ACORDO[opcValidacao.acordoAmpliaDiaria]}</strong>.
            Regime compensatório diferente da 5x2? <strong>{ROTULO_ACORDO[opcValidacao.acordoRegimeCompensatorio]}</strong>.{' '}
            <Link to="/empresa" className="underline">
              Alterar
            </Link>
          </p>
        </Cartao>

        <section aria-labelledby="titulo-opcoes">
          <h2 id="titulo-opcoes" className="mb-2">
            3. Opções de grade para {etapa === 1 ? '42 h' : '40 h'}
          </h2>
          {dias.length !== 5 ? (
            <Alerta tipo="aviso">Escolha 5 dias de trabalho para gerar as opções.</Alerta>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {opcoes.map((o) => {
                const s = SELO_CLASSIFICACAO[o.classificacao];
                const erros = o.validacao.problemas.filter((p) => p.severidade !== 'info');
                return (
                  <article key={o.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
                    <h3>{o.titulo}</h3>
                    <p className="mt-1 text-sm text-slate-700">
                      Total: <strong>{formatarDuracao(o.totalSemanalMin)}</strong> por semana
                    </p>
                    <div className="mt-2">
                      <Selo cor={s.cor}>{s.texto}</Selo>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{o.descricao}</p>
                    {erros.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                        {erros.slice(0, 3).map((p, i) => (
                          <li key={i}>{p.texto}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto pt-3">
                      <Botao variante="secundario" tamanho="pequeno" onClick={() => setGrade(structuredClone(o.grade))}>
                        Usar e ajustar esta grade
                      </Botao>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <Cartao titulo="4. Ajuste fino da nova grade" descricao="Altere horários e intervalos; os alertas são atualizados em tempo real.">
          {grade ? (
            <EditorGradeSemanal grade={grade} onChange={setGrade} validacao={validacao} legenda={`Nova grade — validação pela etapa ${etapa}`} />
          ) : (
            <p className="text-slate-700">Escolha uma das opções acima para começar.</p>
          )}
        </Cartao>

        {grade && (
          <Cartao titulo="5. Comparativo antes e depois (mesmo salário)">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:w-2/3">
              <CampoTexto
                rotulo="Divisor antes (opcional)"
                inputMode="decimal"
                placeholder="Automático"
                value={divAntes}
                onChange={(e) => setDivAntes(e.target.value)}
                dica="Vazio = conforme a carga (44 h → 220)."
              />
              <CampoTexto
                rotulo="Divisor depois (opcional)"
                inputMode="decimal"
                placeholder="Automático"
                value={divDepois}
                onChange={(e) => setDivDepois(e.target.value)}
                dica={`Vazio = conforme a carga (42 h → ${cfgRem.divisores[42]}; 40 h → ${cfgRem.divisores[40]}).`}
              />
            </div>
            {selecionados.length === 0 ? (
              <ComparativoGenerico semanalNovo={semanalNovo} cfg={cfgRem} divA={divA} divD={divD} />
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <caption className="sr-only">Comparativo por funcionário</caption>
                  <thead>
                    <tr>
                      <th scope="col">Funcionário</th>
                      <th scope="col">Salário</th>
                      <th scope="col">Horas/semana</th>
                      <th scope="col">Horas/mês (divisor)</th>
                      <th scope="col">Valor da hora</th>
                      <th scope="col">Hora extra {Math.round(cfgRem.adicionalHoraExtra * 100)}%</th>
                      <th scope="col">Hora extra {Math.round(cfgRem.adicionalDomingoFeriado * 100)}%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selecionados.map((f) => {
                      // O salário remunera a jornada contratual: o valor-hora "antes" usa o contrato.
                      const antesMin = f.jornadaSemanalContratualMin || diagnosticar(f, ctxDiag, 'atual').semanalConsideradoMin;
                      const c = compararRemuneracao(f.salario, antesMin, semanalNovo, cfgRem, { antes: divA, depois: divD });
                      return (
                        <tr key={f.id}>
                          <th scope="row" className="!bg-transparent font-medium">
                            {f.nome}
                          </th>
                          <td>{formatarMoeda(f.salario)}</td>
                          <td className="whitespace-nowrap">
                            {formatarDuracao(c.antes.semanalMin)} → <strong>{formatarDuracao(c.depois.semanalMin)}</strong>
                          </td>
                          <td className="whitespace-nowrap">
                            {formatarNumero(c.antes.divisor, 0)} → <strong>{formatarNumero(c.depois.divisor, 0)}</strong>
                          </td>
                          <td className="whitespace-nowrap">
                            {formatarMoeda(c.antes.valorHora)} → <strong>{formatarMoeda(c.depois.valorHora)}</strong>
                            <span className="block text-xs text-slate-700">{c.variacaoValorHoraPerc >= 0 ? '+' : ''}{formatarNumero(c.variacaoValorHoraPerc)}%</span>
                          </td>
                          <td className="whitespace-nowrap">
                            {formatarMoeda(c.antes.horaExtra)} → <strong>{formatarMoeda(c.depois.horaExtra)}</strong>
                          </td>
                          <td className="whitespace-nowrap">
                            {formatarMoeda(c.antes.horaExtraDomingo)} → <strong>{formatarMoeda(c.depois.horaExtraDomingo)}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-sm text-slate-700">
              O salário mensal não muda. Como as horas diminuem, o valor de cada hora (e da hora extra) aumenta. Horas/mês = divisor usado para calcular o
              valor da hora (inclui o repouso remunerado).
            </p>
          </Cartao>
        )}

        {grade && (
          <Cartao titulo="6. Salvar a nova grade">
            {aplicado && (
              <Alerta tipo="sucesso" vivo className="mb-3">
                {aplicado}{' '}
                <Link to="/escala" className="underline">
                  Montar a escala
                </Link>
              </Alerta>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <CampoTexto rotulo="Vale a partir de" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
              <Botao disabled={selecionados.length === 0} onClick={() => (validacao?.valida ? void aplicar() : setConfirmar(true))}>
                Salvar para {selecionados.length} funcionário(s)
              </Botao>
              {selecionados.length === 0 && <BotaoLink to="/funcionarios" variante="fantasma">Selecionar funcionários</BotaoLink>}
            </div>
          </Cartao>
        )}
      </div>

      <Modal aberto={confirmar} aoFechar={() => setConfirmar(false)} titulo="A grade tem problemas">
        <p className="mb-2">A nova grade ainda tem alertas que impedem o uso pela etapa {etapa}:</p>
        <ul className="mb-4 list-disc pl-5 text-sm">
          {validacao?.problemas.filter((p) => p.severidade === 'erro').map((p, i) => <li key={i}>{p.texto}</li>)}
        </ul>
        <p className="mb-4">Deseja salvar mesmo assim (por exemplo, para revisar depois)?</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmar(false)}>
            Voltar e ajustar
          </Botao>
          <Botao onClick={aplicar}>Salvar mesmo assim</Botao>
        </div>
      </Modal>
    </>
  );
}

function ComparativoGenerico({
  semanalNovo,
  cfg,
  divA,
  divD,
}: {
  semanalNovo: number;
  cfg: ReturnType<typeof configRemuneracaoPadrao>;
  divA: number | null;
  divD: number | null;
}) {
  const [salario, setSalario] = useState('2000');
  const [antes, setAntes] = useState('44');
  const s = Number(salario.replace(/\./g, '').replace(',', '.')) || 0;
  const c = compararRemuneracao(s, (Number(antes.replace(',', '.')) || 44) * 60, semanalNovo, cfg, { antes: divA, depois: divD });
  return (
    <div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:w-2/3">
        <CampoTexto rotulo="Salário de exemplo (R$)" inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} />
        <CampoTexto rotulo="Horas semanais antes" inputMode="decimal" value={antes} onChange={(e) => setAntes(e.target.value)} />
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Horas/semana', `${formatarDuracao(c.antes.semanalMin)} → ${formatarDuracao(c.depois.semanalMin)}`],
          ['Horas/mês (divisor)', `${formatarNumero(c.antes.divisor, 0)} → ${formatarNumero(c.depois.divisor, 0)}`],
          ['Valor da hora', `${formatarMoeda(c.antes.valorHora)} → ${formatarMoeda(c.depois.valorHora)}`],
          [`Hora extra ${Math.round(cfg.adicionalHoraExtra * 100)}%`, `${formatarMoeda(c.antes.horaExtra)} → ${formatarMoeda(c.depois.horaExtra)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-slate-200 p-3">
            <dt className="text-sm text-slate-700">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
