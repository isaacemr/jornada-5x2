import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { REGRAS } from '../../config/regras-ec141';
import { db } from '../../dados/db';
import { funcionarioSchema, mensagensDeErro } from '../../dados/esquemas';
import { agoraISO, gradeUniforme, novoId } from '../../dados/padroes';
import { contextoDiagnostico, diagnosticar } from '../../dominio/diagnostico';
import { domingoACadaSemanas } from '../../dominio/domingos';
import { aplicarTurnoNaLinha, turnosPorSetor } from '../../dominio/escala';
import { descreverGrade, validarGrade } from '../../dominio/jornada';
import { formatarData, formatarDuracao, formatarNumero, lerDuracao, lerMoeda } from '../../dominio/tempo';
import type { Escala, Funcionario, Sexo } from '../../dominio/tipos';
import { useContexto, useFuncionarios, useTurnosPorSetor } from '../../hooks/useDados';
import { EditorGradeSemanal } from '../../componentes/GradeSemanal';
import { DiagnosticoDetalhe } from '../../componentes/DiagnosticoDetalhe';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Modal } from '../../componentes/ui/Basicos';
import { CampoArea, CampoCheckbox, CampoSelect, CampoTexto } from '../../componentes/ui/Campos';

function novoFuncionario(): Funcionario {
  const agora = agoraISO();
  return {
    id: novoId(),
    nome: '',
    cargo: '',
    setor: '',
    salario: 0,
    jornadaSemanalContratualMin: 44 * 60,
    escalaAtual: '6x1',
    trabalhaDomingo: false,
    gradeAtual: gradeUniforme(['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], '08:00', '16:20', 60),
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export default function FormFuncionario() {
  const { id } = useParams();
  const novo = !id || id === 'novo';
  const navegar = useNavigate();
  const { empresa, prazos, etapaHoje } = useContexto();
  const todos = useFuncionarios();
  const turnosSetores = useTurnosPorSetor();
  const [f, setF] = useState<Funcionario | null>(null);
  const [salarioTxt, setSalarioTxt] = useState('');
  const [jornadaTxt, setJornadaTxt] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  // Turno salvo, para saber se mudou e atualizar a escala do setor.
  const [turnoOriginal, setTurnoOriginal] = useState<string | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const base = novo ? novoFuncionario() : await db.funcionarios.get(id!);
      if (!ativo) return;
      if (!base) {
        setNaoEncontrado(true);
        return;
      }
      setF(base);
      setTurnoOriginal(base.turnoId);
      setSalarioTxt(base.salario ? formatarNumero(base.salario) : '');
      setJornadaTxt(formatarDuracao(base.jornadaSemanalContratualMin));
    })();
    return () => {
      ativo = false;
    };
  }, [id, novo]);

  const setores = useMemo(() => [...new Set((todos ?? []).map((x) => x.setor).filter(Boolean))].sort(), [todos]);
  const turnosDoSetor = (f && turnosSetores?.get(f.setor.trim())) ?? [];

  const diag = useMemo(() => (f ? diagnosticar(f, contextoDiagnostico(prazos, empresa?.config), 'atual') : null), [f, prazos, empresa]);
  const diagNova = useMemo(
    () => (f?.gradeNova ? diagnosticar(f, contextoDiagnostico(prazos, empresa?.config), 'nova') : null),
    [f, prazos, empresa],
  );
  const validacaoAtual = useMemo(
    () =>
      f
        ? validarGrade(f.gradeAtual, {
            etapa: etapaHoje,
            acordoAmpliaDiaria: empresa?.config.acordoAmpliaJornadaEtapa1 ?? 'nao_sei',
            acordoRegimeCompensatorio: empresa?.config.acordoRegimeCompensatorio ?? 'nao_sei',
            domingoFolgaACadaSemanas: domingoACadaSemanas(f.sexo, empresa?.config.domingoFolgaACadaSemanas ?? REGRAS.domingos.homensRegraGeral),
          })
        : undefined,
    [f, etapaHoje, empresa],
  );

  if (naoEncontrado) {
    return (
      <>
        <CabecalhoPagina titulo="Funcionário não encontrado" />
        <BotaoLink to="/funcionarios">Voltar à lista</BotaoLink>
      </>
    );
  }
  if (!f || !diag) return <Carregando />;

  const set = <K extends keyof Funcionario>(k: K, v: Funcionario[K]) => setF({ ...f, [k]: v });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const problemas: string[] = [];
    const salario = lerMoeda(salarioTxt);
    if (salario === null) problemas.push('Salário: informe um valor (ex.: 1.850,00).');
    const jornada = lerDuracao(jornadaTxt);
    if (jornada === null) problemas.push('Jornada semanal: informe as horas (ex.: 44 ou 44h).');
    if (!f!.sexo) problemas.push('Sexo: informe para aplicar a regra certa de folga aos domingos.');
    const dados: Funcionario = {
      ...f!,
      nome: f!.nome.trim(),
      setor: f!.setor.trim() || 'Geral',
      salario: salario ?? 0,
      jornadaSemanalContratualMin: jornada ?? 0,
      atualizadoEm: agoraISO(),
    };
    const r = funcionarioSchema.safeParse(dados);
    if (!r.success) problemas.push(...mensagensDeErro(r.error));
    if (problemas.length) {
      setErros(problemas);
      window.scrollTo(0, 0);
      return;
    }
    await db.transaction('rw', [db.funcionarios, db.escalas, db.coberturas], async () => {
      // O turno só vale se existir no setor (pode ter mudado de setor).
      const turnos = turnosPorSetor(await db.escalas.toArray(), await db.coberturas.toArray()).get(dados.setor) ?? [];
      const turnoId = turnos.some((t) => t.id === f!.turnoId) ? f!.turnoId : undefined;
      await db.funcionarios.put({ ...dados, turnoId });
      // Turno trocado: os dias trabalhados dessa pessoa passam para o novo turno na escala do setor.
      if (turnoId && turnoId !== turnoOriginal) {
        const escala = await db.escalas.get(dados.setor);
        if (escala?.turnos.some((t) => t.id === turnoId)) {
          const linhas = escala.linhas.map((l) => (l.funcionarioId === dados.id ? { ...l, celulas: aplicarTurnoNaLinha(l.celulas, turnoId) } : l));
          await db.escalas.put({ ...escala, linhas, atualizadoEm: agoraISO() });
        }
      }
    });
    navegar('/funcionarios');
  }

  async function excluir() {
    await db.funcionarios.delete(f!.id);
    navegar('/funcionarios');
  }

  return (
    <form onSubmit={salvar} noValidate>
      <CabecalhoPagina
        titulo={novo ? 'Novo funcionário' : f.nome || 'Funcionário'}
        acoes={
          <>
            <Botao type="submit">Salvar</Botao>
            <BotaoLink to="/funcionarios" variante="secundario">
              Cancelar
            </BotaoLink>
          </>
        }
      />
      {erros.length > 0 && (
        <Alerta tipo="erro" titulo="Confira os dados" vivo className="mb-4">
          <ul className="list-disc pl-5">{erros.map((x) => <li key={x}>{x}</li>)}</ul>
        </Alerta>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-5">
          <Cartao titulo="Dados do contrato">
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto rotulo="Nome completo *" required value={f.nome} onChange={(e) => set('nome', e.target.value)} autoComplete="off" />
              <CampoTexto rotulo="Matrícula" value={f.matricula ?? ''} onChange={(e) => set('matricula', e.target.value || undefined)} />
              <CampoSelect
                rotulo="Sexo *"
                value={f.sexo ?? ''}
                onChange={(e) => set('sexo', (e.target.value || undefined) as Sexo | undefined)}
                opcoes={[
                  { valor: '', texto: 'Selecione' },
                  { valor: 'F', texto: 'Feminino' },
                  { valor: 'M', texto: 'Masculino' },
                ]}
                dica={`Muda a folga aos domingos: mulheres folgam a cada ${REGRAS.domingos.mulheres} domingos (CLT art. 386).`}
              />
              <CampoTexto rotulo="Cargo" value={f.cargo} onChange={(e) => set('cargo', e.target.value)} />
              <div>
                <CampoTexto rotulo="Setor" list="lista-setores" value={f.setor} onChange={(e) => set('setor', e.target.value)} />
                <datalist id="lista-setores">
                  {setores.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <CampoSelect
                rotulo="Turno na escala"
                value={turnosDoSetor.some((t) => t.id === f.turnoId) ? f.turnoId : ''}
                onChange={(e) => set('turnoId', e.target.value || undefined)}
                disabled={turnosDoSetor.length === 0}
                opcoes={[
                  { valor: '', texto: 'Automático (pelo horário de entrada)' },
                  ...turnosDoSetor.map((t, i) => ({ valor: t.id, texto: `${i + 1}. ${t.nome} (${t.inicio}–${t.fim})` })),
                ]}
                dica={
                  turnosDoSetor.length
                    ? 'Turno em que a pessoa aparece em Opções de horário. Ao trocar, os dias trabalhados dela passam para o novo turno.'
                    : 'O setor ainda não tem turnos. Defina-os em Opções de horário.'
                }
              />
              <CampoTexto
                rotulo="Salário mensal (R$) *"
                inputMode="decimal"
                value={salarioTxt}
                onChange={(e) => setSalarioTxt(e.target.value)}
                dica="O salário não pode ser reduzido na adequação."
              />
              <CampoTexto
                rotulo="Jornada semanal contratual"
                value={jornadaTxt}
                onChange={(e) => {
                  setJornadaTxt(e.target.value);
                  const m = lerDuracao(e.target.value);
                  if (m !== null) set('jornadaSemanalContratualMin', m);
                }}
                dica="Ex.: 44, 44h, 42h, 36h30"
              />
              <CampoSelect
                rotulo="Escala atual"
                value={f.escalaAtual}
                onChange={(e) => set('escalaAtual', e.target.value as Escala)}
                opcoes={[
                  { valor: '6x1', texto: '6x1 — seis dias de trabalho, um de folga' },
                  { valor: '5x2', texto: '5x2 — cinco dias de trabalho, dois de folga' },
                  { valor: '12x36', texto: '12x36 — 12 h de trabalho por 36 h de descanso' },
                  { valor: 'outra', texto: 'Outra' },
                ]}
              />
              <CampoTexto rotulo="Data de admissão" type="date" value={f.admissao ?? ''} onChange={(e) => set('admissao', e.target.value || undefined)} />
              <CampoCheckbox
                className="sm:col-span-2"
                rotulo="Trabalha aos domingos (inclusive em revezamento)"
                checked={f.trabalhaDomingo}
                onChange={(e) => set('trabalhaDomingo', e.target.checked)}
              />
              <CampoArea className="sm:col-span-2" rotulo="Observações" value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value || undefined)} />
            </div>
          </Cartao>

          <Cartao
            titulo="Jornada atual"
            descricao={f.escalaAtual === '12x36' ? 'Para 12x36, informe uma semana típica; o diagnóstico usa a média contratual.' : 'Informe os horários de uma semana típica.'}
          >
            <EditorGradeSemanal
              grade={f.gradeAtual}
              validacao={validacaoAtual}
              legenda="Horários atuais"
              mensagemValida="Sem problemas pelas regras que valem hoje. Veja ao lado o que muda nas etapas 1 e 2."
              onChange={(g) => setF({ ...f, gradeAtual: g, trabalhaDomingo: g.dom.trabalha !== f.gradeAtual.dom.trabalha ? g.dom.trabalha : f.trabalhaDomingo })}
            />
          </Cartao>

          {f.gradeNova && (
            <Cartao
              titulo="Nova jornada planejada"
              descricao={`${descreverGrade(f.gradeNova)}${f.vigenciaNovaGrade ? ` · vigência a partir de ${formatarData(f.vigenciaNovaGrade)}` : ''}`}
              acoes={
                <>
                  <BotaoLink to={`/jornada?ids=${f.id}`} variante="secundario" tamanho="pequeno">
                    Editar no simulador
                  </BotaoLink>
                  <Botao
                    variante="fantasma"
                    tamanho="pequeno"
                    onClick={() => setF({ ...f, gradeNova: undefined, vigenciaNovaGrade: undefined })}
                  >
                    Remover
                  </Botao>
                </>
              }
            >
              <EditorGradeSemanal grade={f.gradeNova} onChange={() => undefined} somenteLeitura legenda="Horários novos" />
            </Cartao>
          )}

          {!novo && (
            <div className="flex justify-between gap-2">
              <Botao variante="perigo" onClick={() => setConfirmarExclusao(true)}>
                Excluir funcionário
              </Botao>
              <Botao type="submit">Salvar</Botao>
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <div className="space-y-5 xl:sticky xl:top-20">
            <Cartao titulo="Diagnóstico da jornada atual">
              <DiagnosticoDetalhe diag={diag} />
            </Cartao>
            {diagNova && (
              <Cartao titulo="Diagnóstico da nova jornada">
                <DiagnosticoDetalhe diag={diagNova} />
              </Cartao>
            )}
            {diag.status !== 'adequado' && !f.gradeNova && !novo && (
              <BotaoLink to={`/jornada?ids=${f.id}`} className="w-full">
                Simular nova jornada
              </BotaoLink>
            )}
          </div>
        </aside>
      </div>

      <Modal aberto={confirmarExclusao} aoFechar={() => setConfirmarExclusao(false)} titulo="Excluir funcionário?">
        <p className="mb-4">Excluir {f.nome} deste navegador? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmarExclusao(false)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={excluir}>
            Excluir
          </Botao>
        </div>
      </Modal>
    </form>
  );
}
