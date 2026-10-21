import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../dados/db';
import { instrumentoSchema, mensagensDeErro } from '../../dados/esquemas';
import { agoraISO, novoId } from '../../dados/padroes';
import { avaliarInstrumento, ROTULO_AVALIACAO } from '../../dominio/clausulas';
import {
  NOME_TIPO_CLAUSULA,
  NOME_TIPO_INSTRUMENTO,
  type AvaliacaoClausula,
  type Clausula,
  type Instrumento,
  type TipoClausula,
  type TipoInstrumento,
} from '../../dominio/tipos';
import { useEmpresa } from '../../hooks/useDados';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Modal, Selo } from '../../componentes/ui/Basicos';
import { CampoArea, CampoCheckbox, CampoSelect, CampoTexto } from '../../componentes/ui/Campos';
import { CampoDuracao } from '../../componentes/ui/CampoDuracao';

const COR: Record<AvaliacaoClausula, 'verde' | 'vermelho' | 'amarelo'> = { compativel: 'verde', incompativel: 'vermelho', revisar: 'amarelo' };

function novoInstrumento(): Instrumento {
  const agora = agoraISO();
  return { id: novoId(), tipo: 'CCT', nome: '', sindicato: '', vigenciaInicio: '', vigenciaFim: '', clausulas: [], observacoes: '', criadoEm: agora, atualizadoEm: agora };
}

function novaClausula(): Clausula {
  return { id: novoId(), numero: '', titulo: '', texto: '', tipo: 'jornada_semanal', parametros: {}, avaliacaoManual: null, observacao: '' };
}

export default function FormInstrumento() {
  const { id } = useParams();
  const novo = !id || id === 'novo';
  const navegar = useNavigate();
  const empresa = useEmpresa();
  /** undefined = carregando; null = não encontrado. */
  const [inst, setInst] = useState<Instrumento | null | undefined>(undefined);
  const [erros, setErros] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const N = empresa?.config.domingoFolgaACadaSemanas ?? 4;

  useEffect(() => {
    (async () => {
      if (novo) {
        setInst({ ...novoInstrumento(), sindicato: empresa?.sindicato ?? '', nome: empresa?.convencaoAplicavel ?? '' });
      } else {
        const i = await db.instrumentos.get(id!);
        setInst(i ?? null);
      }
    })();
    // Carrega só ao abrir/trocar de instrumento (não ao mudar os dados da empresa).
  }, [id, novo]);

  const avaliacoes = useMemo(() => (inst ? avaliarInstrumento(inst, N) : []), [inst, N]);

  if (inst === null) {
    return (
      <>
        <CabecalhoPagina titulo="Instrumento não encontrado" />
        <BotaoLink to="/acordos">Voltar</BotaoLink>
      </>
    );
  }
  if (!inst) return <Carregando />;

  const set = <K extends keyof Instrumento>(k: K, v: Instrumento[K]) => {
    setInst({ ...inst, [k]: v });
    setSalvo(false);
  };
  const setClausula = (i: number, v: Partial<Clausula>) => set('clausulas', inst.clausulas.map((c, j) => (j === i ? { ...c, ...v } : c)));
  const setParam = (i: number, v: Partial<Clausula['parametros']>) => setClausula(i, { parametros: { ...inst.clausulas[i].parametros, ...v } });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados = { ...inst!, atualizadoEm: agoraISO() };
    const r = instrumentoSchema.safeParse(dados);
    if (!r.success) {
      setErros(mensagensDeErro(r.error));
      return;
    }
    setErros([]);
    await db.instrumentos.put(dados);
    setSalvo(true);
    if (novo) navegar(`/acordos/${dados.id}`, { replace: true });
  }

  return (
    <form onSubmit={salvar} noValidate>
      <CabecalhoPagina
        titulo={novo ? 'Novo instrumento coletivo' : inst.nome || 'Instrumento'}
        acoes={
          <>
            <Botao type="submit">Salvar</Botao>
            <BotaoLink to="/acordos" variante="secundario">
              Voltar
            </BotaoLink>
          </>
        }
      />
      {erros.length > 0 && (
        <Alerta tipo="erro" vivo className="mb-4" titulo="Confira os dados">
          <ul className="list-disc pl-5">{erros.map((x) => <li key={x}>{x}</li>)}</ul>
        </Alerta>
      )}
      {salvo && (
        <Alerta tipo="sucesso" vivo className="mb-4">
          Salvo.
        </Alerta>
      )}

      <div className="space-y-5">
        <Cartao titulo="Identificação">
          <div className="grid gap-4 md:grid-cols-2">
            <CampoSelect
              rotulo="Tipo"
              value={inst.tipo}
              onChange={(e) => set('tipo', e.target.value as TipoInstrumento)}
              opcoes={(Object.keys(NOME_TIPO_INSTRUMENTO) as TipoInstrumento[]).map((t) => ({ valor: t, texto: NOME_TIPO_INSTRUMENTO[t] }))}
            />
            <CampoTexto rotulo="Nome" placeholder="Ex.: CCT Comerciários 2026/2027" value={inst.nome} onChange={(e) => set('nome', e.target.value)} />
            <CampoTexto rotulo="Sindicato" value={inst.sindicato} onChange={(e) => set('sindicato', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <CampoTexto rotulo="Vigência — início" type="date" value={inst.vigenciaInicio} onChange={(e) => set('vigenciaInicio', e.target.value)} />
              <CampoTexto rotulo="Vigência — fim" type="date" value={inst.vigenciaFim} onChange={(e) => set('vigenciaFim', e.target.value)} />
            </div>
            <CampoArea className="md:col-span-2" rotulo="Observações" value={inst.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </div>
        </Cartao>

        <section aria-labelledby="titulo-clausulas">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-clausulas">Cláusulas de jornada e checklist</h2>
            <Botao variante="secundario" tamanho="pequeno" onClick={() => set('clausulas', [...inst.clausulas, novaClausula()])}>
              + Adicionar cláusula
            </Botao>
          </div>
          {inst.clausulas.length === 0 && <p className="text-slate-700">Adicione as cláusulas que tratam de jornada, escala, banco de horas, 12x36 e domingos.</p>}
          <ol className="space-y-4">
            {inst.clausulas.map((c, i) => {
              const av = avaliacoes[i];
              return (
                <li key={c.id}>
                  <Cartao
                    titulo={`Cláusula ${c.numero || i + 1}${c.titulo ? ` — ${c.titulo}` : ''}`}
                    acoes={
                      <Botao variante="fantasma" tamanho="pequeno" onClick={() => set('clausulas', inst.clausulas.filter((_, j) => j !== i))}>
                        Remover
                      </Botao>
                    }
                  >
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="grid content-start gap-3 sm:grid-cols-[6rem_1fr]">
                        <CampoTexto rotulo="Nº" value={c.numero} onChange={(e) => setClausula(i, { numero: e.target.value })} />
                        <CampoTexto rotulo="Título" value={c.titulo} onChange={(e) => setClausula(i, { titulo: e.target.value })} />
                        <CampoSelect
                          className="sm:col-span-2"
                          rotulo="Assunto"
                          value={c.tipo}
                          onChange={(e) => setClausula(i, { tipo: e.target.value as TipoClausula, parametros: {} })}
                          opcoes={(Object.keys(NOME_TIPO_CLAUSULA) as TipoClausula[]).map((t) => ({ valor: t, texto: NOME_TIPO_CLAUSULA[t] }))}
                        />
                        <CampoArea className="sm:col-span-2" rotulo="Texto da cláusula (resumo)" value={c.texto} onChange={(e) => setClausula(i, { texto: e.target.value })} />
                        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          {c.tipo === 'jornada_semanal' && (
                            <CampoDuracao rotulo="Horas semanais previstas" valorMin={c.parametros.jornadaSemanalMin} onChange={(v) => setParam(i, { jornadaSemanalMin: v })} />
                          )}
                          {c.tipo === 'jornada_diaria' && (
                            <CampoDuracao rotulo="Jornada diária máxima" valorMin={c.parametros.jornadaDiariaMin} onChange={(v) => setParam(i, { jornadaDiariaMin: v })} />
                          )}
                          {c.tipo === 'escala' && (
                            <>
                              <CampoTexto
                                rotulo="Dias de trabalho por semana"
                                type="number"
                                min={1}
                                max={7}
                                value={c.parametros.diasTrabalhoSemana ?? ''}
                                onChange={(e) => setParam(i, { diasTrabalhoSemana: e.target.value ? Number(e.target.value) : undefined })}
                              />
                              <CampoTexto
                                rotulo="Folga no domingo a cada (semanas)"
                                type="number"
                                min={1}
                                value={c.parametros.domingoFolgaACadaSemanas ?? ''}
                                onChange={(e) => setParam(i, { domingoFolgaACadaSemanas: e.target.value ? Number(e.target.value) : undefined })}
                              />
                              <CampoCheckbox
                                className="sm:col-span-2"
                                rotulo="A cláusula institui regime compensatório excepcional (diferente da 5x2), respeitando os novos limites"
                                checked={!!c.parametros.regimeCompensatorioExcepcional}
                                onChange={(e) => setParam(i, { regimeCompensatorioExcepcional: e.target.checked })}
                              />
                            </>
                          )}
                          {c.tipo === 'banco_horas' && (
                            <CampoTexto
                              rotulo="Prazo de compensação (meses)"
                              type="number"
                              min={1}
                              value={c.parametros.prazoBancoMeses ?? ''}
                              onChange={(e) => setParam(i, { prazoBancoMeses: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          )}
                          {c.tipo === 'domingos' && (
                            <CampoTexto
                              rotulo="Folga no domingo a cada (semanas)"
                              type="number"
                              min={1}
                              value={c.parametros.domingoFolgaACadaSemanas ?? ''}
                              onChange={(e) => setParam(i, { domingoFolgaACadaSemanas: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          )}
                        </div>
                      </div>

                      <div className="rounded-md bg-slate-50 p-3">
                        <h3 className="mb-2">Checklist</h3>
                        {av && (
                          <dl className="space-y-2 text-sm">
                            <div>
                              <dt className="font-medium">Etapa 1 (42 h)</dt>
                              <dd>
                                <Selo cor={COR[av.etapa1.resultado]}>{ROTULO_AVALIACAO[av.etapa1.resultado]}</Selo>
                                <p className="mt-1 text-slate-700">{av.etapa1.motivo}</p>
                              </dd>
                            </div>
                            <div>
                              <dt className="font-medium">Etapa 2 (40 h)</dt>
                              <dd>
                                <Selo cor={COR[av.etapa2.resultado]}>{ROTULO_AVALIACAO[av.etapa2.resultado]}</Selo>
                                <p className="mt-1 text-slate-700">{av.etapa2.motivo}</p>
                              </dd>
                            </div>
                          </dl>
                        )}
                        <fieldset className="mt-3">
                          <legend className="text-sm font-medium">Decisão após revisão</legend>
                          <div className="mt-1 flex flex-col gap-1">
                            {([null, 'compativel', 'incompativel', 'revisar'] as (AvaliacaoClausula | null)[]).map((v) => (
                              <label key={String(v)} className="flex min-h-9 items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  className="h-4 w-4 accent-marca-700"
                                  name={`decisao-${c.id}`}
                                  checked={c.avaliacaoManual === v}
                                  onChange={() => setClausula(i, { avaliacaoManual: v })}
                                />
                                {v === null ? `Usar avaliação automática (${ROTULO_AVALIACAO[av?.final ?? 'revisar'].toLowerCase()})` : ROTULO_AVALIACAO[v]}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <CampoArea className="mt-2" rotulo="Anotações da revisão" value={c.observacao} onChange={(e) => setClausula(i, { observacao: e.target.value })} />
                      </div>
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex flex-wrap justify-between gap-2">
          {!novo ? (
            <Botao variante="perigo" onClick={() => setExcluir(true)}>
              Excluir instrumento
            </Botao>
          ) : (
            <span />
          )}
          <Botao type="submit">Salvar</Botao>
        </div>
      </div>

      <Modal aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir instrumento?">
        <p className="mb-4">Excluir “{inst.nome}” e suas cláusulas? Não dá para desfazer.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setExcluir(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={async () => {
              await db.instrumentos.delete(inst.id);
              navegar('/acordos');
            }}
          >
            Excluir
          </Botao>
        </div>
      </Modal>
    </form>
  );
}
