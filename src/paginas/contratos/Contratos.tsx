import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { gerarAditivo, podeGerarAditivo, type OpcoesAditivo } from '../../dominio/aditivo';
import { MARCA_MODELO_ADITIVO } from '../../config/textos-juridicos';
import { contextoDiagnostico, diagnosticar } from '../../dominio/diagnostico';
import { eColetivo } from '../../dominio/clausulas';
import { descreverGrade, resumirGrade } from '../../dominio/jornada';
import { configRemuneracaoPadrao } from '../../dominio/remuneracao';
import { formatarData, formatarDuracao } from '../../dominio/tempo';
import type { Funcionario } from '../../dominio/tipos';
import { baixarBlob, nomeSeguro } from '../../exportacao/baixar';
import { useContexto, useFuncionarios, useInstrumentos } from '../../hooks/useDados';
import { VisualizarDocumento } from '../../componentes/VisualizarDocumento';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Modal, SeloStatus } from '../../componentes/ui/Basicos';
import { CampoCheckbox, CampoSelect, CampoTexto } from '../../componentes/ui/Campos';

export default function Contratos() {
  const funcionarios = useFuncionarios();
  const instrumentos = useInstrumentos();
  const { empresa, prazos, hoje } = useContexto();
  const [cidade, setCidade] = useState('');
  const [data, setData] = useState(hoje);
  const [instId, setInstId] = useState('');
  const [revezamento, setRevezamento] = useState(false);
  // Atividade contínua costuma ter folgas em revezamento: usa como padrão quando a empresa carrega.
  useEffect(() => {
    if (empresa) setRevezamento(empresa.atividadeContinua);
  }, [empresa]);
  const [previa, setPrevia] = useState<Funcionario | null>(null);
  const [gerando, setGerando] = useState('');

  const cfg = empresa?.config ?? configRemuneracaoPadrao();
  const coletivos = (instrumentos ?? []).filter((i) => eColetivo(i.tipo));
  const op: OpcoesAditivo = {
    cidade,
    dataAssinatura: data || hoje,
    instrumentoColetivo: coletivos.find((i) => i.id === instId) ?? null,
    folgasEmRevezamento: revezamento,
  };

  const linhas = useMemo(() => {
    if (!funcionarios) return [];
    const ctx = contextoDiagnostico(prazos, empresa?.config);
    return funcionarios.map((f) => ({ f, atual: diagnosticar(f, ctx, 'atual'), nova: f.gradeNova ? diagnosticar(f, ctx, 'nova') : null }));
  }, [funcionarios, prazos, empresa]);

  if (!funcionarios || !instrumentos) return <Carregando />;

  const prontos = linhas.filter((l) => podeGerarAditivo(l.f));
  const pendentes = linhas.filter((l) => !podeGerarAditivo(l.f) && l.atual.status !== 'adequado');

  async function baixar(lista: Funcionario[], tipo: 'docx' | 'pdf', nome: string) {
    setGerando(nome);
    try {
      const { blocosParaDocx, blocosParaPdf } = await import('../../exportacao/docx');
      const secoes = lista.map((f) => gerarAditivo(f, empresa ?? null, op, cfg));
      const blob =
        tipo === 'docx' ? await blocosParaDocx(secoes, { marca: MARCA_MODELO_ADITIVO, titulo: 'Termo aditivo' }) : await blocosParaPdf(secoes, 'MODELO');
      baixarBlob(blob, `${nome}-MODELO.${tipo}`);
    } finally {
      setGerando('');
    }
  }

  async function baixarDePara() {
    setGerando('depara');
    try {
      const { xlsxDePara } = await import('../../exportacao/dePara');
      baixarBlob(await xlsxDePara(funcionarios!, cfg, empresa?.razaoSocial ?? ''), `de-para-jornada-${hoje}.xlsx`);
    } finally {
      setGerando('');
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Contratos e ponto"
        descricao="Gere os termos aditivos com a nova jornada, a planilha de-para e acompanhe o checklist do ponto e do eSocial."
        acoes={<BotaoLink to="/contratos/ponto">Checklist do ponto e eSocial</BotaoLink>}
      />
      <Alerta tipo="aviso" className="mb-4" titulo="Documentos modelo">
        Os termos aditivos saem marcados como “{MARCA_MODELO_ADITIVO}”. Revise com seu advogado ou contador antes de colher assinaturas.
      </Alerta>

      <div className="space-y-5">
        <Cartao titulo="Dados para os termos aditivos">
          <div className="grid gap-4 md:grid-cols-3">
            <CampoTexto rotulo="Cidade da assinatura" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            <CampoTexto rotulo="Data da assinatura" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <CampoSelect
              rotulo="Instrumento coletivo (para jornada acima de 8 h)"
              value={instId}
              onChange={(e) => setInstId(e.target.value)}
              opcoes={[{ valor: '', texto: 'Nenhum / informar depois' }, ...coletivos.map((i) => ({ valor: i.id, texto: i.nome }))]}
            />
            <CampoCheckbox
              className="md:col-span-3"
              rotulo="As folgas seguem escala de revezamento (não são dias fixos)"
              checked={revezamento}
              onChange={(e) => setRevezamento(e.target.checked)}
            />
          </div>
        </Cartao>

        <Cartao
          titulo={`Prontos para o aditivo (${prontos.length})`}
          descricao="Funcionários com nova jornada definida no simulador."
          acoes={
            prontos.length > 0 && (
              <>
                <Botao tamanho="pequeno" disabled={!!gerando} onClick={() => void baixar(prontos.map((l) => l.f), 'docx', 'aditivos-todos')}>
                  Baixar todos (DOCX)
                </Botao>
                <Botao tamanho="pequeno" variante="secundario" disabled={!!gerando} onClick={() => void baixar(prontos.map((l) => l.f), 'pdf', 'aditivos-todos')}>
                  Baixar todos (PDF)
                </Botao>
              </>
            )
          }
        >
          {gerando && (
            <p role="status" className="mb-2 text-sm">
              Gerando arquivo…
            </p>
          )}
          {prontos.length === 0 ? (
            <p className="text-slate-700">
              Ninguém tem nova jornada definida ainda. Use o <Link to="/jornada" className="underline">simulador de jornada</Link> e salve a nova grade.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Funcionário</th>
                    <th scope="col">Nova jornada</th>
                    <th scope="col">Vigência</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Termo aditivo</th>
                  </tr>
                </thead>
                <tbody>
                  {prontos.map(({ f, nova }) => (
                    <tr key={f.id}>
                      <td>
                        <Link to={`/funcionarios/${f.id}`} className="font-medium underline">
                          {f.nome}
                        </Link>
                        <span className="block text-xs text-slate-600">{f.cargo}</span>
                      </td>
                      <td className="text-sm">
                        {formatarDuracao(resumirGrade(f.gradeNova!).totalSemanalMin)} · {descreverGrade(f.gradeNova!)}
                      </td>
                      <td>{f.vigenciaNovaGrade ? formatarData(f.vigenciaNovaGrade) : formatarData(prazos.inicioEtapa1)}</td>
                      <td>{nova && <SeloStatus status={nova.status} />}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Botao tamanho="pequeno" variante="secundario" onClick={() => setPrevia(f)}>
                            Ver
                          </Botao>
                          <Botao tamanho="pequeno" variante="secundario" disabled={!!gerando} onClick={() => void baixar([f], 'docx', `aditivo-${nomeSeguro(f.nome)}`)}>
                            DOCX
                          </Botao>
                          <Botao tamanho="pequeno" variante="secundario" disabled={!!gerando} onClick={() => void baixar([f], 'pdf', `aditivo-${nomeSeguro(f.nome)}`)}>
                            PDF
                          </Botao>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        {pendentes.length > 0 && (
          <Cartao titulo={`Precisam de nova jornada antes do aditivo (${pendentes.length})`}>
            <ul className="flex flex-wrap gap-2">
              {pendentes.map(({ f, atual }) => (
                <li key={f.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                  <Link to={`/jornada?ids=${f.id}`} className="underline">
                    {f.nome}
                  </Link>
                  <SeloStatus status={atual.status} />
                </li>
              ))}
            </ul>
            <BotaoLink className="mt-3" to={`/jornada?ids=${pendentes.map((p) => p.f.id).join(',')}`} tamanho="pequeno">
              Simular todos os pendentes
            </BotaoLink>
          </Cartao>
        )}

        <Cartao titulo="Planilha de-para" descricao="Jornada antiga → nova de todos os funcionários, para enviar ao contador ou ao fornecedor do ponto.">
          <Botao onClick={() => void baixarDePara()} disabled={!!gerando || funcionarios.length === 0}>
            Baixar planilha (XLSX)
          </Botao>
        </Cartao>
      </div>

      <Modal aberto={!!previa} aoFechar={() => setPrevia(null)} titulo={`Termo aditivo — ${previa?.nome ?? ''}`} largura="max-w-4xl">
        {previa && <VisualizarDocumento blocos={gerarAditivo(previa, empresa ?? null, op, cfg)} marca="MODELO" />}
      </Modal>
    </>
  );
}
