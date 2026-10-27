/**
 * Plano de ação gerado a partir da situação atual (empresa, equipe, escalas)
 * com prazos calculados a partir das datas das etapas.
 * Tarefas feitas fora do assistente (sindicato, aditivos, ponto, eSocial) são marcadas manualmente.
 */
import { REGRAS } from '../config/regras-ec141';
import { contextoDiagnostico, diagnosticar } from './diagnostico';
import { PORTES_PEQUENOS, type Prazos } from './etapas';
import { formatarData, lerData, dataISO, somarDias } from './tempo';
import type { Empresa, EscalaSetor, Funcionario, Tarefa } from './tipos';

export interface TarefaPlano extends Tarefa {
  /** Tela do assistente onde a tarefa é feita. */
  rota?: string;
  /** Condição detectada automaticamente como cumprida. */
  cumpridaAuto: boolean;
}

export interface EntradaPlano {
  empresa: Empresa | null;
  funcionarios: Funcionario[];
  escalas: EscalaSetor[];
  prazos: Prazos;
}

/** Dia N do mês seguinte a uma data (prazo usual do eSocial). */
export function diaDoMesSeguinte(iso: string, dia: number): string {
  const d = lerData(iso);
  return dataISO(new Date(d.getFullYear(), d.getMonth() + 1, dia));
}

export function gerarTarefasAuto(e: EntradaPlano): TarefaPlano[] {
  const E1 = e.prazos.inicioEtapa1;
  const E2 = e.prazos.inicioEtapa2;
  const ctx = contextoDiagnostico(e.prazos, e.empresa?.config);
  const diags = e.funcionarios.map((f) => ({ f, d: diagnosticar(f, ctx, 'atual'), dv: diagnosticar(f, ctx) }));
  const precisamE1 = diags.filter((x) => x.d.status !== 'adequado');
  const semNovaE1 = precisamE1.filter((x) => !x.f.gradeNova);
  const precisamE2 = diags.filter((x) => !x.dv.adequadoEtapa2);
  const N = e.empresa?.config.domingoFolgaACadaSemanas ?? REGRAS.domingos.folgaACadaSemanasPadrao;
  const setores = new Set(e.funcionarios.map((f) => f.setor));
  const continua = !!e.empresa?.atividadeContinua;
  const acordoIndefinido = !e.empresa || e.empresa.config.acordoAmpliaJornadaEtapa1 === 'nao_sei' || e.empresa.config.acordoRegimeCompensatorio === 'nao_sei';

  const t: TarefaPlano[] = [];
  const add = (x: Omit<TarefaPlano, 'origem' | 'concluida' | 'concluidaEm' | 'oculta'>) =>
    t.push({ ...x, origem: 'auto', concluida: x.cumpridaAuto, concluidaEm: null, oculta: false });

  // ------------------------------------------------ etapa 1
  add({
    id: 'auto:empresa',
    titulo: 'Cadastrar os dados da empresa',
    descricao: 'Porte, atividade, convenção coletiva e horário de funcionamento definem seus prazos e exceções.',
    responsavel: 'RH/DP',
    prazo: somarDias(E1, -55),
    etapa: 'etapa1',
    rota: '/empresa',
    cumpridaAuto: !!e.empresa?.razaoSocial,
  });
  add({
    id: 'auto:funcionarios',
    titulo: 'Cadastrar ou importar todos os funcionários',
    descricao: 'Com os horários de cada dia, para o diagnóstico automático.',
    responsavel: 'RH/DP',
    prazo: somarDias(E1, -50),
    etapa: 'etapa1',
    rota: '/funcionarios',
    cumpridaAuto: e.funcionarios.length > 0,
  });
  add({
    id: 'auto:acordos',
    titulo: 'Revisar a convenção/acordo coletivo',
    descricao: 'Identificar cláusulas que perdem eficácia (ex.: 44 h semanais, 6x1 sem regime compensatório) e as que precisam ser renegociadas, com o sindicato ou advogado.',
    responsavel: 'Jurídico + RH',
    prazo: somarDias(E1, -45),
    etapa: 'etapa1',
    cumpridaAuto: false,
  });
  if (acordoIndefinido) {
    add({
      id: 'auto:sindicato',
      titulo: 'Negociar com o sindicato',
      descricao: 'Distribuição das 42 h na transição, regime compensatório, banco de horas e domingos. Registrar o resultado em aditivo à convenção/acordo e atualizar as respostas em “Dados da empresa”.',
      responsavel: 'Diretoria + Jurídico',
      prazo: somarDias(E1, -30),
      etapa: 'etapa1',
      rota: '/empresa',
      cumpridaAuto: false,
    });
  }
  add({
    id: 'auto:jornadas',
    titulo: semNovaE1.length ? `Definir a nova jornada de ${semNovaE1.length} funcionário(s)` : 'Definir a nova jornada dos funcionários afetados',
    descricao: 'Usar o simulador para distribuir as horas em 5 dias, sem reduzir salário.',
    responsavel: 'RH/DP + gestores',
    prazo: somarDias(E1, -30),
    etapa: 'etapa1',
    rota: '/jornada',
    cumpridaAuto: e.funcionarios.length > 0 && semNovaE1.length === 0,
  });
  if (continua) {
    add({
      id: 'auto:cobertura',
      titulo: 'Calcular a cobertura e decidir como cobrir lacunas',
      descricao: 'Pessoas necessárias por turno, revezamento de folgas e domingos; comparar contratar, hora extra, banco de horas ou ajuste de horário.',
      responsavel: 'Diretoria + gestores',
      prazo: somarDias(E1, -30),
      etapa: 'etapa1',
      rota: '/escala/cobertura',
      cumpridaAuto: false,
    });
    add({
      id: 'auto:contratacoes',
      titulo: 'Iniciar contratações (se a cobertura indicar falta de pessoas)',
      descricao: 'Recrutamento, exames admissionais e treinamento levam tempo.',
      responsavel: 'RH',
      prazo: somarDias(E1, -21),
      etapa: 'etapa1',
      rota: '/escala/cobertura',
      cumpridaAuto: false,
    });
  }
  add({
    id: 'auto:escalas',
    titulo: 'Montar as escalas 5x2 de cada setor',
    descricao: `Garantir 2 folgas por semana e ao menos 1 domingo de folga a cada ${N} semanas.`,
    responsavel: 'Gestores',
    prazo: somarDias(E1, -15),
    etapa: 'etapa1',
    rota: '/escala',
    cumpridaAuto: setores.size > 0 && [...setores].every((s) => e.escalas.some((x) => x.setor === s)),
  });
  add({
    id: 'auto:comunicar',
    titulo: 'Comunicar a equipe sobre os novos horários',
    descricao: 'Explicar a nova escala, os dias de folga e que não há redução de salário.',
    responsavel: 'Gestores',
    prazo: somarDias(E1, -10),
    etapa: 'etapa1',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:aditivos',
    titulo: 'Assinar os termos aditivos de contrato',
    descricao: 'Formalizar a nova jornada de cada funcionário (revisar o modelo com o jurídico ou contador) e colher as assinaturas.',
    responsavel: 'RH/DP',
    prazo: somarDias(E1, -7),
    etapa: 'etapa1',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:ponto',
    titulo: 'Atualizar o ponto eletrônico',
    descricao: 'Novos horários, escalas, tolerâncias, limite de hora extra e banco de horas.',
    responsavel: 'RH/DP + fornecedor do ponto',
    prazo: somarDias(E1, -3),
    etapa: 'etapa1',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:folha',
    titulo: 'Atualizar a folha de pagamento (divisor e valor-hora)',
    descricao: `Divisor ${REGRAS.divisores.porHorasSemanais[42]} para 42 h; conferir que nenhum salário foi reduzido.`,
    responsavel: 'Contador',
    prazo: E1,
    etapa: 'etapa1',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:esocial1',
    titulo: `Enviar o ${REGRAS.esocial.eventoAlteracaoContratual} ao eSocial (alteração de jornada)`,
    descricao: `Prazo usual: até o dia ${REGRAS.esocial.diaLimiteMesSeguinte} do mês seguinte à alteração. Confirme com o contador.`,
    responsavel: 'Contador',
    prazo: diaDoMesSeguinte(E1, REGRAS.esocial.diaLimiteMesSeguinte),
    etapa: 'etapa1',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:acompanhar1',
    titulo: 'Acompanhar o primeiro mês da nova jornada',
    descricao: 'Verificar horas extras, banco de horas, cobertura dos turnos e folgas aos domingos.',
    responsavel: 'RH/DP + gestores',
    prazo: somarDias(E1, 30),
    etapa: 'etapa1',
    cumpridaAuto: false,
  });

  // ------------------------------------------------ terceirizada / pequenas
  if (e.prazos.terceirizadaPublica) {
    const T = e.prazos.terceirizadaPublica;
    add({
      id: 'auto:terceirizada-contrato',
      titulo: 'Rever contratos com a administração pública',
      descricao: 'Avaliar com o órgão contratante o impacto da nova jornada no contrato (postos, custos, repactuação).',
      responsavel: 'Diretoria + Jurídico',
      prazo: somarDias(T, -90),
      etapa: 'terceirizada',
      cumpridaAuto: false,
    });
    add({
      id: 'auto:terceirizada-jornada',
      titulo: 'Adequar a jornada da equipe alocada em órgãos públicos',
      descricao: `Prazo especial de 12 meses após a promulgação: ${formatarData(T)}.`,
      responsavel: 'RH/DP',
      prazo: T,
      etapa: 'terceirizada',
      rota: '/jornada',
      cumpridaAuto: false,
    });
  }
  if (e.empresa && PORTES_PEQUENOS.includes(e.empresa.porte) && e.prazos.pequenaEmpresaPendente) {
    add({
      id: 'auto:lei-complementar',
      titulo: 'Acompanhar a lei complementar para MEI/ME/EPP',
      descricao: 'Pode haver transição própria para pequenas empresas. Até lá, siga as datas gerais.',
      responsavel: 'Contador',
      prazo: somarDias(E1, -30),
      etapa: 'geral',
      rota: '/entenda',
      cumpridaAuto: false,
    });
  }

  // ------------------------------------------------ etapa 2
  add({
    id: 'auto:planejar2',
    titulo: precisamE2.length ? `Planejar a redução para 40 h (${precisamE2.length} funcionário(s))` : 'Planejar a redução para 40 h',
    descricao: 'Quem ainda tem mais de 40 h semanais ou mais de 8 h por dia precisa de nova jornada.',
    responsavel: 'RH/DP',
    prazo: somarDias(E2, -90),
    etapa: 'etapa2',
    rota: '/jornada',
    cumpridaAuto: e.funcionarios.length > 0 && precisamE2.length === 0,
  });
  add({
    id: 'auto:acordos2',
    titulo: 'Revisar acordos de transição',
    descricao: `Autorizações de jornada acima de 8 h valem só até ${formatarData(REGRAS.etapa1.fim)}. Renegociar banco de horas e regimes compensatórios para 40 h.`,
    responsavel: 'Jurídico + RH',
    prazo: somarDias(E2, -60),
    etapa: 'etapa2',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:aditivos2',
    titulo: 'Assinar aditivos da jornada de 40 h',
    descricao: 'Para quem mudar de jornada na etapa 2.',
    responsavel: 'RH/DP',
    prazo: somarDias(E2, -7),
    etapa: 'etapa2',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:ponto2',
    titulo: `Atualizar ponto e folha para 40 h (divisor ${REGRAS.divisores.porHorasSemanais[40]})`,
    descricao: 'Limite de 8 h diárias; excedente vira hora extra ou banco de horas.',
    responsavel: 'RH/DP + contador',
    prazo: somarDias(E2, -3),
    etapa: 'etapa2',
    cumpridaAuto: false,
  });
  add({
    id: 'auto:esocial2',
    titulo: `Enviar o ${REGRAS.esocial.eventoAlteracaoContratual} das alterações da etapa 2`,
    descricao: 'Para cada funcionário com nova jornada.',
    responsavel: 'Contador',
    prazo: diaDoMesSeguinte(E2, REGRAS.esocial.diaLimiteMesSeguinte),
    etapa: 'etapa2',
    cumpridaAuto: false,
  });
  return t;
}

/** Combina as tarefas automáticas com as alterações e tarefas manuais salvas pelo usuário. */
export function mesclarTarefas(auto: TarefaPlano[], salvas: Tarefa[]): TarefaPlano[] {
  const porId = new Map(salvas.map((s) => [s.id, s]));
  const r: TarefaPlano[] = auto.map((a) => {
    const s = porId.get(a.id);
    return s ? { ...a, responsavel: s.responsavel || a.responsavel, prazo: s.prazo || a.prazo, concluida: s.concluida, concluidaEm: s.concluidaEm, oculta: s.oculta } : a;
  });
  for (const s of salvas) if (s.origem === 'manual') r.push({ ...s, cumpridaAuto: false });
  return r.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export type SituacaoTarefa = 'concluida' | 'atrasada' | 'proxima' | 'futura';

export function situacaoTarefa(t: Tarefa, hoje: string, diasProxima = 14): SituacaoTarefa {
  if (t.concluida) return 'concluida';
  if (t.prazo < hoje) return 'atrasada';
  if (t.prazo <= somarDias(hoje, diasProxima)) return 'proxima';
  return 'futura';
}
