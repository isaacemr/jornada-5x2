import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../dados/db';
import { agoraISO, novoId } from '../../dados/padroes';
import { NOME_ETAPA, etapaVigente } from '../../dominio/etapas';
import { gerarTarefasAuto, mesclarTarefas, situacaoTarefa, type SituacaoTarefa, type TarefaPlano } from '../../dominio/planoAcao';
import { diferencaDias, formatarData } from '../../dominio/tempo';
import type { EtapaTarefa, Tarefa } from '../../dominio/tipos';
import { baixarBlob } from '../../exportacao/baixar';
import { useContexto, useFuncionarios } from '../../hooks/useDados';
import { Botao } from '../../componentes/ui/Botao';
import { BarraProgresso, CabecalhoPagina, Carregando, Cartao, Selo } from '../../componentes/ui/Basicos';
import { CampoCheckbox, CampoSelect, CampoTexto } from '../../componentes/ui/Campos';

const GRUPOS: { id: EtapaTarefa; nome: string }[] = [
  { id: 'geral', nome: 'Geral' },
  { id: 'etapa1', nome: 'Até a etapa 1' },
  { id: 'terceirizada', nome: 'Contratos com o poder público' },
  { id: 'etapa2', nome: 'Até a etapa 2' },
];

const SELO: Record<SituacaoTarefa, { texto: string; cor: 'verde' | 'vermelho' | 'amarelo' | 'cinza' }> = {
  concluida: { texto: 'Concluída', cor: 'verde' },
  atrasada: { texto: 'Atrasada', cor: 'vermelho' },
  proxima: { texto: 'Próximos 14 dias', cor: 'amarelo' },
  futura: { texto: 'A fazer', cor: 'cinza' },
};

function paraSalvar(t: TarefaPlano): Tarefa {
  const { rota: _rota, cumpridaAuto: _auto, ...resto } = t;
  return resto;
}

export default function PlanoAcao() {
  const { empresa, prazos, hoje } = useContexto();
  const funcionarios = useFuncionarios();
  const escalas = useLiveQuery(() => db.escalas.toArray(), []);
  const salvas = useLiveQuery(() => db.tarefas.toArray(), []);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(true);
  const [nova, setNova] = useState({ titulo: '', responsavel: '', prazo: '', etapa: 'etapa1' as EtapaTarefa });

  const tarefas = useMemo(() => {
    if (!funcionarios || !escalas || !salvas || empresa === undefined) return null;
    const auto = gerarTarefasAuto({ empresa, funcionarios, escalas, prazos });
    return mesclarTarefas(auto, salvas);
  }, [empresa, funcionarios, escalas, salvas, prazos]);

  if (!tarefas) return <Carregando />;

  const visiveis = tarefas.filter((t) => !t.oculta && (mostrarConcluidas || !t.concluida));
  const concluidas = tarefas.filter((t) => !t.oculta && t.concluida).length;
  const totalVisiveis = tarefas.filter((t) => !t.oculta).length;
  const atrasadas = tarefas.filter((t) => !t.oculta && situacaoTarefa(t, hoje) === 'atrasada').length;

  const atualizar = (t: TarefaPlano, v: Partial<Tarefa>) => db.tarefas.put({ ...paraSalvar(t), ...v });

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nova.titulo.trim() || !nova.prazo) return;
    await db.tarefas.put({
      id: novoId(),
      titulo: nova.titulo.trim(),
      descricao: '',
      responsavel: nova.responsavel.trim(),
      prazo: nova.prazo,
      etapa: nova.etapa,
      origem: 'manual',
      concluida: false,
      concluidaEm: null,
      oculta: false,
    });
    setNova({ ...nova, titulo: '', responsavel: '' });
  }

  async function exportar() {
    const { pdfPlano } = await import('../../exportacao/plano');
    baixarBlob(await pdfPlano(tarefas!, prazos, empresa?.razaoSocial ?? '', hoje), `plano-de-acao-ec141-${hoje}.pdf`);
  }

  const marcos = [
    { data: hoje, nome: 'Hoje' },
    ...(prazos.terceirizadaPublica ? [{ data: prazos.terceirizadaPublica, nome: 'Prazo poder público' }] : []),
    { data: prazos.inicioEtapa1, nome: 'Etapa 1 (42 h, 5x2)' },
    { data: prazos.inicioEtapa2, nome: 'Etapa 2 (40 h, 8 h/dia)' },
  ].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <>
      <CabecalhoPagina
        titulo="Plano de ação"
        descricao="Tarefas geradas automaticamente a partir da situação da sua empresa, com prazos até cada etapa. Edite responsáveis e prazos ou acrescente tarefas."
        acoes={<Botao onClick={() => void exportar()}>Exportar PDF</Botao>}
      />

      <Cartao className="mb-5" titulo="Linha do tempo">
        <ol className="relative grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {marcos.map((m) => {
            const dias = diferencaDias(hoje, m.data);
            return (
              <li key={m.nome} className={`rounded-md border-t-4 p-3 ${m.nome === 'Hoje' ? 'border-marca-700 bg-marca-50' : 'border-slate-400 bg-slate-50'}`}>
                <p className="text-sm font-semibold">{m.nome}</p>
                <p className="text-lg font-bold">{formatarData(m.data)}</p>
                {m.nome !== 'Hoje' && <p className="text-sm text-slate-700">{dias > 0 ? `em ${dias} dias` : dias === 0 ? 'hoje' : `há ${-dias} dias`}</p>}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-slate-700">Agora: {NOME_ETAPA[etapaVigente(hoje, prazos)]}.</p>
      </Cartao>

      <Cartao className="mb-5">
        <BarraProgresso valor={totalVisiveis ? (concluidas / totalVisiveis) * 100 : 0} rotulo={`${concluidas} de ${totalVisiveis} tarefas concluídas`} />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {atrasadas > 0 && <Selo cor="vermelho">{atrasadas} atrasada(s)</Selo>}
          <CampoCheckbox rotulo="Mostrar concluídas" checked={mostrarConcluidas} onChange={(e) => setMostrarConcluidas(e.target.checked)} />
          {tarefas.some((t) => t.oculta) && (
            <button type="button" className="text-sm underline" onClick={() => tarefas.filter((t) => t.oculta).forEach((t) => void atualizar(t, { oculta: false }))}>
              Reexibir tarefas ocultas
            </button>
          )}
        </div>
      </Cartao>

      <div className="space-y-5">
        {GRUPOS.map((g) => {
          const lista = visiveis.filter((t) => t.etapa === g.id);
          if (!lista.length) return null;
          return (
            <Cartao key={g.id} titulo={g.nome}>
              <ol className="divide-y divide-slate-200">
                {lista.map((t) => {
                  const s = situacaoTarefa(t, hoje);
                  return (
                    <li key={t.id} className="grid gap-3 py-3 md:grid-cols-[1fr_12rem_10rem]">
                      <div className="flex items-start gap-3">
                        <input
                          id={`t-${t.id}`}
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 shrink-0 accent-marca-700"
                          checked={t.concluida}
                          onChange={(e) => void atualizar(t, { concluida: e.target.checked, concluidaEm: e.target.checked ? agoraISO() : null })}
                        />
                        <div className="min-w-0">
                          <label htmlFor={`t-${t.id}`} className={`font-medium ${t.concluida ? 'text-slate-600 line-through' : ''}`}>
                            {t.titulo}
                          </label>
                          {t.descricao && <p className="text-sm text-slate-700">{t.descricao}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <Selo cor={SELO[s].cor}>{SELO[s].texto}</Selo>
                            {t.cumpridaAuto && !t.concluida && <span className="text-xs text-slate-600">(detectada como feita — confirme)</span>}
                            {t.rota && (
                              <Link to={t.rota} className="text-marca-800 underline">
                                Ir para a tela
                              </Link>
                            )}
                            <button
                              type="button"
                              className="text-slate-700 underline"
                              onClick={() => (t.origem === 'manual' ? void db.tarefas.delete(t.id) : void atualizar(t, { oculta: true }))}
                            >
                              {t.origem === 'manual' ? 'Excluir' : 'Ocultar'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium">Responsável</span>
                        <input className="campo-input !py-1" defaultValue={t.responsavel} onBlur={(e) => e.target.value !== t.responsavel && void atualizar(t, { responsavel: e.target.value })} />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium">Prazo</span>
                        <input
                          type="date"
                          className="campo-input !py-1"
                          value={t.prazo}
                          onChange={(e) => e.target.value && void atualizar(t, { prazo: e.target.value })}
                        />
                      </label>
                    </li>
                  );
                })}
              </ol>
            </Cartao>
          );
        })}

        <Cartao titulo="Adicionar tarefa">
          <form onSubmit={adicionar} className="grid gap-3 md:grid-cols-[1fr_12rem_10rem_12rem_auto] md:items-end">
            <CampoTexto rotulo="Tarefa" value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} required />
            <CampoTexto rotulo="Responsável" value={nova.responsavel} onChange={(e) => setNova({ ...nova, responsavel: e.target.value })} />
            <CampoTexto rotulo="Prazo" type="date" value={nova.prazo} onChange={(e) => setNova({ ...nova, prazo: e.target.value })} required />
            <CampoSelect
              rotulo="Grupo"
              value={nova.etapa}
              onChange={(e) => setNova({ ...nova, etapa: e.target.value as EtapaTarefa })}
              opcoes={GRUPOS.map((g) => ({ valor: g.id, texto: g.nome }))}
            />
            <Botao type="submit">Adicionar</Botao>
          </form>
        </Cartao>
      </div>
    </>
  );
}
