import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { contextoDiagnostico, diagnosticar, type Diagnostico } from '../../dominio/diagnostico';
import { formatarData, formatarDuracao, formatarMoeda } from '../../dominio/tempo';
import type { Funcionario, StatusDiagnostico } from '../../dominio/tipos';
import { useContexto, useFuncionarios } from '../../hooks/useDados';
import { BotaoLink } from '../../componentes/ui/Botao';
import { CabecalhoPagina, Carregando, Cartao, SeloStatus } from '../../componentes/ui/Basicos';
import { CampoSelect, CampoTexto } from '../../componentes/ui/Campos';

const OPCOES_STATUS: { valor: '' | StatusDiagnostico; texto: string }[] = [
  { valor: '', texto: 'Todos' },
  { valor: 'ajustar_etapa1', texto: 'Ajustar até a etapa 1' },
  { valor: 'ajustar_etapa2', texto: 'Ajustar até a etapa 2' },
  { valor: 'depende_acordo', texto: 'Depende de acordo coletivo' },
  { valor: 'adequado', texto: 'Adequado' },
];

export default function ListaFuncionarios() {
  const funcionarios = useFuncionarios();
  const { empresa, prazos } = useContexto();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [setor, setSetor] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const status = (params.get('status') ?? '') as '' | StatusDiagnostico;

  const linhas = useMemo(() => {
    if (!funcionarios) return [];
    const ctx = contextoDiagnostico(prazos, empresa?.config);
    return funcionarios.map((f) => ({ f, d: diagnosticar(f, ctx) }));
  }, [funcionarios, prazos, empresa]);

  const setores = useMemo(() => [...new Set(linhas.map((l) => l.f.setor))].sort(), [linhas]);

  const filtradas = linhas.filter(({ f, d }) => {
    const t = busca.trim().toLowerCase();
    return (
      (!t || f.nome.toLowerCase().includes(t) || f.cargo.toLowerCase().includes(t) || (f.matricula ?? '').includes(t)) &&
      (!setor || f.setor === setor) &&
      (!status || d.status === status)
    );
  });

  if (!funcionarios) return <Carregando />;

  const alternar = (id: string) => {
    const s = new Set(selecionados);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelecionados(s);
  };
  const todosSelecionados = filtradas.length > 0 && filtradas.every(({ f }) => selecionados.has(f.id));
  const idsSel = [...selecionados].filter((id) => linhas.some((l) => l.f.id === id));

  return (
    <>
      <CabecalhoPagina
        titulo="Funcionários e diagnóstico"
        descricao="Cadastre a equipe e veja quem precisa de ajuste em cada etapa e por quê."
        acoes={
          <>
            <BotaoLink to="/funcionarios/novo">Novo funcionário</BotaoLink>
            <BotaoLink to="/funcionarios/importar" variante="secundario">
              Importar CSV/XLSX
            </BotaoLink>
          </>
        }
      />

      <Cartao className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoTexto rotulo="Buscar" type="search" placeholder="Nome, cargo ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <CampoSelect
            rotulo="Setor"
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            opcoes={[{ valor: '', texto: 'Todos' }, ...setores.map((s) => ({ valor: s, texto: s }))]}
          />
          <CampoSelect
            rotulo="Situação"
            value={status}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              if (e.target.value) p.set('status', e.target.value);
              else p.delete('status');
              setParams(p, { replace: true });
            }}
            opcoes={OPCOES_STATUS}
          />
        </div>
      </Cartao>

      {idsSel.length > 0 && (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-marca-700 bg-marca-50 p-3" role="region" aria-label="Ações com selecionados">
          <span className="text-sm font-medium">{idsSel.length} selecionado(s)</span>
          <BotaoLink to={`/jornada?ids=${idsSel.join(',')}`} tamanho="pequeno">
            Simular nova jornada
          </BotaoLink>
          <button type="button" className="text-sm underline" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </button>
        </div>
      )}

      <p className="mb-2 text-sm text-slate-700" aria-live="polite">
        Mostrando {filtradas.length} de {linhas.length} funcionário(s).
      </p>

      {linhas.length === 0 ? (
        <Cartao>
          <p className="mb-3">Nenhum funcionário cadastrado.</p>
          <div className="flex flex-wrap gap-2">
            <BotaoLink to="/funcionarios/novo">Cadastrar o primeiro</BotaoLink>
            <BotaoLink to="/funcionarios/importar" variante="secundario">Importar planilha</BotaoLink>
            <BotaoLink to="/backup" variante="fantasma">Usar dados de exemplo</BotaoLink>
          </div>
        </Cartao>
      ) : (
        <>
          {/* Tabela (telas médias e grandes) */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="tabela">
              <caption className="sr-only">Funcionários e diagnóstico</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-marca-700"
                      aria-label="Selecionar todos os listados"
                      checked={todosSelecionados}
                      onChange={() => {
                        const s = new Set(selecionados);
                        filtradas.forEach(({ f }) => (todosSelecionados ? s.delete(f.id) : s.add(f.id)));
                        setSelecionados(s);
                      }}
                    />
                  </th>
                  <th scope="col">Nome</th>
                  <th scope="col">Setor / cargo</th>
                  <th scope="col">Escala</th>
                  <th scope="col" className="text-right">Horas/sem.</th>
                  <th scope="col">Situação</th>
                  <th scope="col">O que ajustar</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(({ f, d }) => (
                  <Linha key={f.id} f={f} d={d} selecionado={selecionados.has(f.id)} alternar={alternar} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartões (celular) */}
          <ul className="space-y-3 md:hidden">
            {filtradas.map(({ f, d }) => (
              <li key={f.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-marca-700"
                    aria-label={`Selecionar ${f.nome}`}
                    checked={selecionados.has(f.id)}
                    onChange={() => alternar(f.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <Link to={`/funcionarios/${f.id}`} className="font-semibold text-marca-800 underline">
                      {f.nome}
                    </Link>
                    <p className="text-sm text-slate-700">
                      {f.setor} · {f.cargo} · {f.escalaAtual} · {formatarDuracao(d.semanalConsideradoMin)}/sem.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SeloStatus status={d.status} />
                      {d.prazo && <span className="text-xs text-slate-700">até {formatarData(d.prazo)}</span>}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{d.resumoCurto}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Linha({ f, d, selecionado, alternar }: { f: Funcionario; d: Diagnostico; selecionado: boolean; alternar: (id: string) => void }) {
  return (
    <tr className={selecionado ? 'bg-marca-50' : ''}>
      <td>
        <input
          type="checkbox"
          className="h-5 w-5 accent-marca-700"
          aria-label={`Selecionar ${f.nome}`}
          checked={selecionado}
          onChange={() => alternar(f.id)}
        />
      </td>
      <td>
        <Link to={`/funcionarios/${f.id}`} className="font-medium text-marca-800 underline">
          {f.nome}
        </Link>
        <span className="block text-xs text-slate-600">{formatarMoeda(f.salario)}</span>
      </td>
      <td>
        {f.setor}
        <span className="block text-xs text-slate-600">{f.cargo}</span>
      </td>
      <td>
        {f.escalaAtual}
        {f.gradeNova && <span className="block text-xs text-marca-800">nova grade definida</span>}
      </td>
      <td className="text-right tabular-nums">{formatarDuracao(d.semanalConsideradoMin)}</td>
      <td>
        <SeloStatus status={d.status} />
        {d.prazo && <span className="mt-1 block text-xs text-slate-700">até {formatarData(d.prazo)}</span>}
      </td>
      <td className="max-w-sm text-sm text-slate-700">{d.resumoCurto}</td>
    </tr>
  );
}
