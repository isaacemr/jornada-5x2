import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../../dados/db';
import { agoraISO } from '../../dados/padroes';
import { limitesParaCobertura } from '../../dominio/cobertura';
import { contarCobertura, domingoDaSemana, rotulosColunas, sugerirEscala, validarLinha, type ProblemaLinha } from '../../dominio/escala';
import { hojeISO, paraMinutos } from '../../dominio/tempo';
import { DIAS_SEMANA, FOLGA, type EscalaSetor, type Funcionario, type TurnoBase, type TurnoCobertura } from '../../dominio/tipos';
import { baixarBlob, nomeSeguro } from '../../exportacao/baixar';
import { useContexto, useFuncionarios } from '../../hooks/useDados';
import { corTurno, EditorTurnos, novoTurno } from '../../componentes/EditorTurnos';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Modal, severidadeParaAlerta } from '../../componentes/ui/Basicos';
import { CampoSelect, CampoTexto } from '../../componentes/ui/Campos';

/** Turnos a partir das grades dos funcionários (horários distintos mais comuns). */
function turnosDasGrades(equipe: Funcionario[]): TurnoBase[] {
  const cont = new Map<string, { t: TurnoBase; n: number }>();
  for (const f of equipe) {
    const g = f.gradeNova ?? f.gradeAtual;
    for (const d of DIAS_SEMANA) {
      const dia = g[d];
      if (!dia.trabalha) continue;
      const k = `${dia.entrada}-${dia.saida}-${dia.intervaloMin}`;
      const atual = cont.get(k);
      if (atual) atual.n++;
      else cont.set(k, { t: { id: k, nome: '', inicio: dia.entrada, fim: dia.saida, intervaloMin: dia.intervaloMin }, n: 1 });
    }
  }
  const lista = [...cont.values()].sort((a, b) => b.n - a.n).slice(0, 4).map((x) => x.t);
  lista.sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio));
  return lista.map((t, i) => ({ ...t, nome: lista.length === 1 ? 'Turno' : ['Manhã', 'Tarde', 'Noite', 'Extra'][i] ?? `Turno ${i + 1}` }));
}

/** Monta as linhas a partir das grades (para visualizar a escala atual/nova). */
function linhasDasGrades(equipe: Funcionario[], turnos: TurnoBase[], semanas: number) {
  return equipe.map((f) => {
    const g = f.gradeNova ?? f.gradeAtual;
    const celulas: string[] = [];
    for (let w = 0; w < semanas; w++)
      for (const d of DIAS_SEMANA) {
        const dia = g[d];
        // Turno com início mais próximo da entrada da pessoa.
        const t = dia.trabalha
          ? [...turnos].sort((a, b) => Math.abs(paraMinutos(a.inicio) - paraMinutos(dia.entrada)) - Math.abs(paraMinutos(b.inicio) - paraMinutos(dia.entrada)))[0]
          : undefined;
        celulas.push(t ? t.id : FOLGA);
      }
    return { funcionarioId: f.id, celulas };
  });
}

export default function MontadorEscala() {
  const funcionarios = useFuncionarios();
  const coberturas = useLiveQuery(() => db.coberturas.toArray(), []);
  const escalas = useLiveQuery(() => db.escalas.toArray(), []);
  const { empresa, prazos } = useContexto();
  const [params, setParams] = useSearchParams();
  const [escala, setEscala] = useState<EscalaSetor | null>(null);
  const [vista, setVista] = useState<'semana' | 'mes'>('semana');
  const [semana, setSemana] = useState(0);
  const [confirmarSugestao, setConfirmarSugestao] = useState(false);
  const [msg, setMsg] = useState('');
  const [exportando, setExportando] = useState(false);

  const setores = useMemo(() => [...new Set((funcionarios ?? []).map((f) => f.setor))].filter(Boolean).sort(), [funcionarios]);
  const setor = params.get('setor') ?? setores[0] ?? '';
  const equipe = useMemo(() => (funcionarios ?? []).filter((f) => f.setor === setor), [funcionarios, setor]);
  const cobertura = coberturas?.find((c) => c.id === setor);
  const N = empresa?.config.domingoFolgaACadaSemanas ?? 4;
  // Limites conforme a etapa em que a escala começa.
  const etapaEscala = escala && escala.inicio >= prazos.inicioEtapa2 ? 2 : 1;
  const Lescala = limitesParaCobertura(etapaEscala, empresa?.config.acordoAmpliaJornadaEtapa1 === 'sim' && etapaEscala === 1);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // Carrega ou cria a escala do setor
  useEffect(() => {
    if (!escalas || !coberturas || !funcionarios || !setor) return;
    if (escala?.setor === setor) return;
    const existente = escalas.find((e) => e.id === setor);
    const semanas = Math.max(N, 4) <= 8 ? Math.max(N, 4) : 8;
    const inicioBase = hojeISO() > prazos.inicioEtapa1 ? hojeISO() : prazos.inicioEtapa1;
    let e: EscalaSetor;
    if (existente) {
      e = existente;
    } else {
      const turnos: TurnoBase[] = cobertura?.turnos.length
        ? cobertura.turnos.map(({ demanda: _d, ...t }) => t)
        : turnosDasGrades(equipe).length
          ? turnosDasGrades(equipe)
          : [novoTurno(false)];
      e = {
        id: setor,
        setor,
        nome: `Escala ${setor}`,
        inicio: domingoDaSemana(inicioBase),
        semanas,
        turnos,
        linhas: linhasDasGrades(equipe, turnos, semanas),
        atualizadoEm: agoraISO(),
      };
    }
    // Sincroniza com a equipe atual do setor
    const ids = new Set(equipe.map((f) => f.id));
    const linhas = e.linhas.filter((l) => ids.has(l.funcionarioId));
    for (const f of equipe) if (!linhas.some((l) => l.funcionarioId === f.id)) linhas.push({ funcionarioId: f.id, celulas: Array(e.semanas * 7).fill(FOLGA) });
    setEscala({ ...e, linhas });
    setSemana(0);
  }, [escalas, coberturas, funcionarios, setor, escala?.setor, equipe, cobertura, N, prazos]);

  // Sugestão vinda da calculadora (?sugerir=1): aplica uma vez quando a escala do setor é carregada.
  useEffect(() => {
    if (escala && params.get('sugerir') === '1' && cobertura) {
      aplicarSugestao();
      const p = new URLSearchParams(params);
      p.delete('sugerir');
      setParams(p, { replace: true });
    }
  }, [escala?.setor, cobertura]);

  // Salva automaticamente
  useEffect(() => {
    if (!escala) return;
    const t = setTimeout(() => void db.escalas.put({ ...escala, atualizadoEm: agoraISO() }), 400);
    return () => clearTimeout(t);
  }, [escala]);

  const problemas = useMemo(() => {
    const m = new Map<string, ProblemaLinha[]>();
    if (escala) for (const l of escala.linhas) m.set(l.funcionarioId, validarLinha(l.celulas, escala.turnos, Lescala, N, escala.inicio));
    return m;
  }, [escala, Lescala.limiteDiarioMin, Lescala.limiteSemanalMin, N]);

  if (!funcionarios || !escalas || !coberturas) return <Carregando />;

  function aplicarSugestao() {
    if (!escala || !cobertura) return;
    const turnos: TurnoCobertura[] = cobertura.turnos;
    const linhas = sugerirEscala(equipe, turnos, escala.semanas, N, Lescala);
    setEscala({ ...escala, turnos: turnos.map(({ demanda: _d, ...t }) => t), linhas });
    setMsg('Escala sugerida gerada a partir da calculadora de cobertura. Ajuste à vontade.');
    setConfirmarSugestao(false);
  }

  const total = (escala?.semanas ?? 0) * 7;
  const colunas = escala ? rotulosColunas(escala.inicio, escala.semanas) : [];
  const nomes = new Map(equipe.map((f) => [f.id, f.nome]));
  const idxTurno = new Map(escala?.turnos.map((t, i) => [t.id, i]) ?? []);

  const ciclo = (atual: string): string => {
    if (!escala) return FOLGA;
    const ordem = [FOLGA, ...escala.turnos.map((t) => t.id)];
    const i = ordem.indexOf(atual);
    return ordem[(i + 1) % ordem.length];
  };
  const setCelula = (linha: number, col: number, valor: string) => {
    if (!escala) return;
    setEscala({ ...escala, linhas: escala.linhas.map((l, i) => (i === linha ? { ...l, celulas: l.celulas.map((c, j) => (j === col ? valor : c)) } : l)) });
  };

  function aoSoltar(ev: DragEndEvent) {
    if (!escala || !ev.over) return;
    const [la, ca] = String(ev.active.id).split(':').map(Number);
    const [lb, cb] = String(ev.over.id).split(':').map(Number);
    if (la === lb && ca === cb) return;
    if (la !== lb && ca !== cb) {
      setMsg('Arraste dentro da mesma linha (troca dias da pessoa) ou da mesma coluna (troca turnos entre pessoas no mesmo dia).');
      return;
    }
    const linhas = escala.linhas.map((l) => ({ ...l, celulas: [...l.celulas] }));
    const a = linhas[la].celulas[ca];
    linhas[la].celulas[ca] = linhas[lb].celulas[cb];
    linhas[lb].celulas[cb] = a;
    setEscala({ ...escala, linhas });
    setMsg('');
  }

  function mudarSemanas(n: number) {
    if (!escala) return;
    const s = Math.min(8, Math.max(1, n));
    setEscala({
      ...escala,
      semanas: s,
      linhas: escala.linhas.map((l) => ({ ...l, celulas: Array.from({ length: s * 7 }, (_, i) => l.celulas[i % l.celulas.length] ?? FOLGA) })),
    });
    setSemana((w) => Math.min(w, s - 1));
  }

  async function exportar(tipo: 'pdf' | 'xlsx') {
    if (!escala) return;
    setExportando(true);
    try {
      const mod = await import('../../exportacao/escala');
      const blob = tipo === 'pdf' ? await mod.pdfEscala(escala, equipe, empresa?.razaoSocial ?? '') : await mod.xlsxEscala(escala, equipe, empresa?.razaoSocial ?? '');
      baixarBlob(blob, `escala-${nomeSeguro(escala.setor)}-${escala.inicio}.${tipo}`);
    } finally {
      setExportando(false);
    }
  }

  const semanasVisiveis = vista === 'semana' ? [semana] : Array.from({ length: escala?.semanas ?? 0 }, (_, i) => i);
  const totalErros = [...problemas.values()].flat().filter((p) => p.severidade === 'erro').length;

  return (
    <>
      <CabecalhoPagina
        titulo="Montador de escala"
        descricao="Monte a escala 5x2 por setor. Arraste uma célula para trocar dias (mesma pessoa) ou turnos (mesmo dia). Clique para alternar entre folga e turnos."
        acoes={
          <>
            <BotaoLink to={`/escala/cobertura?setor=${encodeURIComponent(setor)}`} variante="secundario">
              Calculadora de cobertura
            </BotaoLink>
          </>
        }
      />

      {setores.length === 0 ? (
        <Alerta tipo="info">Cadastre funcionários com setor para montar escalas.</Alerta>
      ) : !escala ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          <Cartao>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoSelect
                rotulo="Setor"
                value={setor}
                onChange={(e) => {
                  setParams({ setor: e.target.value }, { replace: true });
                  setEscala(null);
                }}
                opcoes={setores.map((s) => ({ valor: s, texto: s }))}
              />
              <CampoTexto
                rotulo="Começa no domingo"
                type="date"
                value={escala.inicio}
                onChange={(e) => e.target.value && setEscala({ ...escala, inicio: domingoDaSemana(e.target.value) })}
              />
              <CampoTexto rotulo="Semanas" type="number" min={1} max={8} value={escala.semanas} onChange={(e) => mudarSemanas(Number(e.target.value) || 1)} />
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-800">Visualização</span>
                <div className="flex gap-1" role="group" aria-label="Visualização">
                  {(['semana', 'mes'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={vista === v}
                      onClick={() => setVista(v)}
                      className={`min-h-11 flex-1 rounded-md border px-3 text-sm ${vista === v ? 'border-marca-700 bg-marca-700 text-white' : 'border-slate-400 bg-white'}`}
                    >
                      {v === 'semana' ? 'Semanal' : 'Mensal'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => setConfirmarSugestao(true)} disabled={!cobertura}>
                Gerar revezamento automático
              </Botao>
              <Botao variante="secundario" onClick={() => void exportar('pdf')} disabled={exportando}>
                Exportar PDF
              </Botao>
              <Botao variante="secundario" onClick={() => void exportar('xlsx')} disabled={exportando}>
                Exportar XLSX
              </Botao>
            </div>
            {!cobertura && (
              <p className="mt-2 text-sm text-slate-700">
                Para gerar o revezamento automático, informe as pessoas necessárias por turno na{' '}
                <Link className="underline" to={`/escala/cobertura?setor=${encodeURIComponent(setor)}`}>
                  calculadora de cobertura
                </Link>
                .
              </p>
            )}
          </Cartao>

          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold">Turnos desta escala ({escala.turnos.length})</summary>
            <div className="mt-3">
              <EditorTurnos<TurnoBase>
                turnos={escala.turnos}
                comDemanda={false}
                criar={() => novoTurno(false)}
                onChange={(t) => {
                  const ids = new Set(t.map((x) => x.id));
                  setEscala({ ...escala, turnos: t, linhas: escala.linhas.map((l) => ({ ...l, celulas: l.celulas.map((c) => (ids.has(c) ? c : FOLGA)) })) });
                }}
              />
            </div>
          </details>

          {msg && (
            <Alerta tipo="info" vivo>
              {msg}
            </Alerta>
          )}
          <Alerta tipo={totalErros ? 'erro' : 'sucesso'} vivo>
            {totalErros ? `${totalErros} problema(s) na escala — veja os detalhes abaixo de cada semana.` : 'Nenhum erro: 2 folgas por semana, limites de horas e interjornada respeitados.'}
          </Alerta>

          <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Legenda">
            <span className="font-medium">Legenda:</span>
            {escala.turnos.map((t, i) => (
              <span key={t.id} className={`rounded border px-2 py-1 ${corTurno(i)}`}>
                {t.nome} {t.inicio}–{t.fim}
              </span>
            ))}
            <span className="rounded border border-slate-400 bg-slate-200 px-2 py-1">Folga</span>
          </div>

          {vista === 'semana' && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Semana exibida">
              {Array.from({ length: escala.semanas }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={i === semana}
                  onClick={() => setSemana(i)}
                  className={`min-h-9 rounded-md border px-3 text-sm ${i === semana ? 'border-marca-700 bg-marca-700 text-white' : 'border-slate-400 bg-white'}`}
                >
                  Semana {i + 1}
                </button>
              ))}
            </div>
          )}

          <DndContext
            sensors={sensores}
            onDragEnd={aoSoltar}
            accessibility={{
              screenReaderInstructions: { draggable: 'Use o clique (ou Enter) para alternar o valor da célula. Com o mouse ou toque, arraste para trocar.' },
              announcements: {
                onDragStart: () => 'Movendo célula.',
                onDragOver: () => '',
                onDragEnd: ({ over }) => (over ? 'Células trocadas.' : 'Movimento cancelado.'),
                onDragCancel: () => 'Movimento cancelado.',
              },
            }}
          >
            {semanasVisiveis.map((w) => (
              <section key={w} aria-label={`Semana ${w + 1}`} className="rounded-lg border border-slate-200 bg-white p-2 sm:p-3">
                <h2 className="mb-2 px-1 text-base">
                  Semana {w + 1} <span className="font-normal text-slate-700">({colunas[w * 7]} a {colunas[w * 7 + 6]})</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className="sticky left-0 z-10 bg-white p-1 text-left">
                          Funcionário
                        </th>
                        {colunas.slice(w * 7, w * 7 + 7).map((c, i) => (
                          <th key={c} scope="col" className={`p-1 text-center font-semibold ${i === 0 ? 'text-red-800' : ''}`}>
                            {c}
                          </th>
                        ))}
                        <th scope="col" className="p-1 text-center">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {escala.linhas.map((l, li) => {
                        const probs = (problemas.get(l.funcionarioId) ?? []).filter((p) => p.texto.startsWith(`Semana ${w + 1}:`) || (p.celula !== undefined && Math.floor(p.celula / 7) === w) || p.codigo === 'DOMINGO');
                        const erros = probs.filter((p) => p.severidade === 'erro').length;
                        return (
                          <tr key={l.funcionarioId} className="border-t border-slate-200">
                            <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-white p-1 text-left font-medium">
                              {nomes.get(l.funcionarioId)}
                            </th>
                            {l.celulas.slice(w * 7, w * 7 + 7).map((c, i) => {
                              const col = w * 7 + i;
                              const ti = idxTurno.get(c);
                              const turno = ti !== undefined ? escala.turnos[ti] : undefined;
                              const comErro = probs.some((p) => p.celula === col && p.severidade === 'erro');
                              return (
                                <td key={col} className="p-0.5">
                                  <Celula
                                    id={`${li}:${col}`}
                                    texto={turno ? turno.nome : 'Folga'}
                                    classe={turno ? corTurno(ti!) : 'bg-slate-200 text-slate-800 border-slate-400'}
                                    erro={comErro}
                                    rotulo={`${nomes.get(l.funcionarioId)}, ${colunas[col]}: ${turno ? `${turno.nome} ${turno.inicio}–${turno.fim}` : 'folga'}. Clique para alternar.`}
                                    onClick={() => setCelula(li, col, ciclo(c))}
                                  />
                                </td>
                              );
                            })}
                            <td className="p-1 text-center">
                              {erros ? (
                                <span className="font-semibold text-red-800">{erros} erro(s)</span>
                              ) : (
                                <span className="text-marca-800">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {cobertura && (
                      <tfoot>
                        {escala.turnos.map((t, ti) => {
                          const ct = cobertura.turnos.find((x) => x.id === t.id);
                          if (!ct) return null;
                          const cont = contarCobertura(escala.linhas, t.id, total);
                          return (
                            <tr key={t.id} className="border-t-2 border-slate-300">
                              <th scope="row" className="sticky left-0 bg-white p-1 text-left text-xs font-medium">
                                {t.nome}: escalados / necessários
                              </th>
                              {DIAS_SEMANA.map((d, i) => {
                                const col = w * 7 + i;
                                const falta = cont[col] < ct.demanda[d];
                                return (
                                  <td key={d} className={`p-1 text-center text-xs font-semibold ${falta ? 'bg-red-50 text-red-800' : 'text-slate-800'}`}>
                                    {cont[col]}/{ct.demanda[d]}
                                    {falta && <span className="sr-only"> faltam pessoas</span>}
                                  </td>
                                );
                              })}
                              <td className={`p-1 ${corTurno(ti)}`} aria-hidden="true" />
                            </tr>
                          );
                        })}
                      </tfoot>
                    )}
                  </table>
                </div>
                <ListaProblemas linhas={escala.linhas} problemas={problemas} nomes={nomes} semana={w} />
              </section>
            ))}
          </DndContext>
        </div>
      )}

      <Modal aberto={confirmarSugestao} aoFechar={() => setConfirmarSugestao(false)} titulo="Gerar revezamento automático?">
        <p className="mb-4">A escala atual deste setor será substituída por uma sugestão baseada na calculadora de cobertura. Deseja continuar?</p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmarSugestao(false)}>
            Cancelar
          </Botao>
          <Botao onClick={aplicarSugestao}>Gerar</Botao>
        </div>
      </Modal>
    </>
  );
}

function Celula({ id, texto, classe, erro, rotulo, onClick }: { id: string; texto: string; classe: string; erro: boolean; rotulo: string; onClick: () => void }) {
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  const estilo = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`, zIndex: 20, position: 'relative' as const } : undefined;
  return (
    <button
      type="button"
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.listeners}
      aria-label={rotulo}
      onClick={onClick}
      style={estilo}
      className={`flex min-h-11 w-full touch-none items-center justify-center rounded border px-1 text-xs font-medium select-none ${classe} ${
        erro ? 'ring-2 ring-red-700' : ''
      } ${drop.isOver ? 'outline-2 outline-marca-700' : ''} ${drag.isDragging ? 'opacity-80 shadow-lg' : ''}`}
    >
      {texto}
    </button>
  );
}

function ListaProblemas({
  linhas,
  problemas,
  nomes,
  semana,
}: {
  linhas: EscalaSetor['linhas'];
  problemas: Map<string, ProblemaLinha[]>;
  nomes: Map<string, string>;
  semana: number;
}) {
  const itens = linhas.flatMap((l) =>
    (problemas.get(l.funcionarioId) ?? [])
      .filter((p) => p.texto.startsWith(`Semana ${semana + 1}:`) || (p.celula !== undefined && Math.floor(p.celula / 7) === semana))
      .map((p) => ({ ...p, nome: nomes.get(l.funcionarioId) ?? '' })),
  );
  if (itens.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {itens.map((p, i) => (
        <li key={i}>
          <Alerta tipo={severidadeParaAlerta(p.severidade)}>
            <strong>{p.nome}:</strong> {p.texto}
          </Alerta>
        </li>
      ))}
    </ul>
  );
}
