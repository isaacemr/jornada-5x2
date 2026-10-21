import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { REGRAS } from '../../config/regras-ec141';
import { carregarExemplo } from '../../dados/exemplo';
import { contextoDiagnostico, diagnosticar, indicadores } from '../../dominio/diagnostico';
import { calcularPrazos, contagemRegressiva, NOME_ETAPA, perfilDaEmpresa } from '../../dominio/etapas';
import { formatarData, formatarDuracao } from '../../dominio/tempo';
import { useAgora, useContexto, useFuncionarios } from '../../hooks/useDados';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, BarraProgresso, CabecalhoPagina, Carregando, Cartao, SeloStatus } from '../../componentes/ui/Basicos';
import type { StatusDiagnostico } from '../../dominio/tipos';

function ContagemRegressiva({ titulo, data, descricao, destaque }: { titulo: string; data: string; descricao: string; destaque?: boolean }) {
  const agora = useAgora(30_000);
  const c = contagemRegressiva(data, agora);
  return (
    <div className={`rounded-lg border p-4 ${destaque ? 'border-marca-700 bg-marca-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      <p className="text-sm text-slate-600">{formatarData(data)}</p>
      {c.passou ? (
        <p className="mt-2 text-xl font-bold text-marca-800">Já está valendo</p>
      ) : (
        <p className="mt-2" aria-label={`Faltam ${c.dias} dias, ${c.horas} horas e ${c.minutos} minutos`}>
          <span className="text-4xl font-bold text-slate-900">{c.dias}</span>
          <span className="ml-1 text-lg text-slate-700">dias</span>
          <span className="ml-2 text-sm text-slate-600">
            {c.horas}h {String(c.minutos).padStart(2, '0')}min
          </span>
        </p>
      )}
      <p className="mt-2 text-sm text-slate-700">{descricao}</p>
    </div>
  );
}

const ROTULO_STATUS: Record<StatusDiagnostico, string> = {
  adequado: 'Adequados',
  ajustar_etapa1: 'Precisam ajustar até a etapa 1',
  ajustar_etapa2: 'Precisam ajustar até a etapa 2',
  depende_acordo: 'Dependem de acordo coletivo',
};

export default function Painel() {
  const { empresa, prazos, etapaHoje } = useContexto();
  const funcionarios = useFuncionarios();
  const [carregando, setCarregando] = useState(false);

  const prazosGerais = useMemo(
    () => calcularPrazos({ ...perfilDaEmpresa(empresa), prestaServicoPoderPublico: false }),
    [empresa],
  );

  const ind = useMemo(() => {
    if (!funcionarios) return null;
    const ctx = contextoDiagnostico(prazos, empresa?.config);
    return indicadores(funcionarios.map((f) => diagnosticar(f, ctx)));
  }, [funcionarios, prazos, empresa]);

  if (empresa === undefined || funcionarios === undefined) return <Carregando />;

  return (
    <>
      <CabecalhoPagina
        titulo="Painel"
        descricao="Acompanhe os prazos da EC 141/2026 e quanto da sua equipe já está adequada à nova jornada."
      />

      {!empresa && (
        <Cartao className="mb-5 border-marca-700" titulo="Bem-vindo! Vamos começar?">
          <p className="mb-3 text-slate-700">
            Este assistente ajuda a adequar a jornada da sua equipe à escala 5x2, com 42 h semanais a partir de{' '}
            {formatarData(REGRAS.etapa1.inicio)} e 40 h a partir de {formatarData(REGRAS.etapa2.inicio)}. Tudo fica salvo só neste
            navegador.
          </p>
          <div className="flex flex-wrap gap-2">
            <BotaoLink to="/empresa">Cadastrar minha empresa</BotaoLink>
            <Botao
              variante="secundario"
              disabled={carregando}
              onClick={async () => {
                setCarregando(true);
                await carregarExemplo();
                setCarregando(false);
              }}
            >
              {carregando ? 'Carregando…' : 'Ver com dados de exemplo'}
            </Botao>
          </div>
        </Cartao>
      )}

      <section aria-labelledby="titulo-prazos" className="mb-5">
        <h2 id="titulo-prazos" className="mb-2">
          Contagem regressiva
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ContagemRegressiva
            titulo="Etapa 1 — escala 5x2 e 42 h semanais"
            data={prazosGerais.inicioEtapa1}
            descricao="Dois dias de repouso por semana e no máximo 42 h. Acordo coletivo pode permitir mais de 8 h por dia até o fim da etapa."
            destaque={etapaHoje === 0}
          />
          <ContagemRegressiva
            titulo="Etapa 2 — 8 h por dia e 40 h semanais"
            data={prazosGerais.inicioEtapa2}
            descricao="Limite de 8 h diárias e 40 h semanais em 5 dias. O que passar disso vira hora extra ou banco de horas."
            destaque={etapaHoje === 1}
          />
          {prazos.terceirizadaPublica && (
            <ContagemRegressiva
              titulo="Terceirizada do poder público — prazo especial"
              data={prazos.terceirizadaPublica}
              descricao="Para contratos de prestação de serviço à administração pública, o prazo é de 12 meses após a promulgação."
            />
          )}
        </div>
        <p className="mt-2 text-sm text-slate-700">
          <strong>Hoje:</strong> {NOME_ETAPA[etapaHoje]}.
        </p>
        {prazos.observacoes.map((o) => (
          <Alerta key={o} tipo="aviso" className="mt-2">
            {o}
          </Alerta>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao
          titulo="Situação da equipe"
          descricao="Considera a nova grade quando ela já foi definida; senão, a jornada atual."
          acoes={<BotaoLink to="/funcionarios" variante="secundario" tamanho="pequeno">Ver funcionários</BotaoLink>}
        >
          {ind && ind.total > 0 ? (
            <div className="space-y-4">
              <BarraProgresso
                valor={ind.percEtapa1}
                rotulo={`Adequados à etapa 1 (${ind.adequadosEtapa1} de ${ind.total})`}
              />
              <BarraProgresso
                valor={ind.percEtapa2}
                rotulo={`Adequados à etapa 2 (${ind.adequadosEtapa2} de ${ind.total})`}
                cor="bg-sky-700"
              />
              <ul className="divide-y divide-slate-200 text-sm">
                {(Object.keys(ROTULO_STATUS) as StatusDiagnostico[]).map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2 py-2">
                    <Link to={`/funcionarios?status=${s}`} className="flex items-center gap-2 hover:underline">
                      <SeloStatus status={s} texto={String(ind.porStatus[s])} />
                      {ROTULO_STATUS[s]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-slate-700">Nenhum funcionário cadastrado ainda.</p>
              <div className="flex flex-wrap gap-2">
                <BotaoLink to="/funcionarios/novo" tamanho="pequeno">Cadastrar funcionário</BotaoLink>
                <BotaoLink to="/funcionarios/importar" variante="secundario" tamanho="pequeno">Importar planilha</BotaoLink>
              </div>
            </div>
          )}
        </Cartao>

        <Cartao
          titulo="Sua empresa"
          acoes={<BotaoLink to="/empresa" variante="secundario" tamanho="pequeno">{empresa ? 'Editar' : 'Cadastrar'}</BotaoLink>}
        >
          {empresa ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="font-medium text-slate-700">Empresa</dt>
              <dd>{empresa.razaoSocial || '—'}</dd>
              <dt className="font-medium text-slate-700">Porte</dt>
              <dd>{empresa.porte === 'DEMAIS' ? 'Média/grande' : empresa.porte}</dd>
              <dt className="font-medium text-slate-700">Atividade contínua</dt>
              <dd>{empresa.atividadeContinua ? 'Sim' : 'Não'}</dd>
              <dt className="font-medium text-slate-700">Serviço ao poder público</dt>
              <dd>{empresa.prestaServicoPoderPublico ? 'Sim' : 'Não'}</dd>
              <dt className="font-medium text-slate-700">Convenção</dt>
              <dd>{empresa.convencaoAplicavel || '—'}</dd>
              <dt className="font-medium text-slate-700">Limites hoje</dt>
              <dd>
                {etapaHoje === 0
                  ? `Regra antiga (${formatarDuracao(REGRAS.regimeAnterior.limiteSemanalMin)}) até ${formatarData(prazos.inicioEtapa1)}`
                  : etapaHoje === 1
                    ? `${formatarDuracao(REGRAS.etapa1.limiteSemanalMin)} semanais, 5x2`
                    : `${formatarDuracao(REGRAS.etapa2.limiteSemanalMin)} semanais, 8 h/dia, 5x2`}
              </dd>
            </dl>
          ) : (
            <p className="text-slate-700">Cadastre porte, atividade e convenção para calcular seus prazos corretamente.</p>
          )}
        </Cartao>
      </div>

      <Cartao className="mt-5" titulo="Passo a passo sugerido">
        <ol className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ['/funcionarios', '1. Cadastre ou importe os funcionários e veja o diagnóstico'],
            ['/jornada', '2. Simule a nova distribuição das horas (42 h e 40 h)'],
            ['/escala', '3. Monte a nova escala e confira a cobertura do horário'],
            ['/acordos', '4. Revise a convenção e os acordos coletivos'],
            ['/contratos', '5. Gere os aditivos e atualize o ponto e o eSocial'],
            ['/plano', '6. Acompanhe o plano de ação até cada prazo'],
          ].map(([para, texto]) => (
            <li key={para}>
              <Link to={para} className="flex min-h-11 items-center rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50 hover:underline">
                {texto}
              </Link>
            </li>
          ))}
        </ol>
      </Cartao>
    </>
  );
}
