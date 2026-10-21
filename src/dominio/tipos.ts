/** Tipos de domínio compartilhados (persistidos no IndexedDB e usados nos cálculos). */

export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const NOME_DIA: Record<DiaSemana, string> = {
  dom: 'Domingo',
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
};

export const NOME_DIA_CURTO: Record<DiaSemana, string> = {
  dom: 'Dom',
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
};

/** Jornada de um dia. Horários 'HH:MM'; saída menor que entrada = vira a meia-noite. */
export interface DiaJornada {
  trabalha: boolean;
  entrada: string;
  saida: string;
  /** Duração total do intervalo intrajornada, em minutos. */
  intervaloMin: number;
}

export type GradeSemanal = Record<DiaSemana, DiaJornada>;

export type Porte = 'MEI' | 'ME' | 'EPP' | 'DEMAIS';
export type Escala = '6x1' | '5x2' | '12x36' | 'outra';
export type SimNaoNaoSei = 'sim' | 'nao' | 'nao_sei';

export interface DiaFuncionamento {
  aberto: boolean;
  abre: string;
  fecha: string;
}

export interface ConfigEmpresa {
  /** Divisores mensais por carga semanal (horas → divisor). Sobrepõe REGRAS.divisores. */
  divisores: { 44: number; 42: number; 40: number };
  /** Adicional de hora extra em dias comuns (0,5 = 50%). */
  adicionalHoraExtra: number;
  /** Adicional em domingos/feriados (1 = 100%). */
  adicionalDomingoFeriado: number;
  /** Ao menos 1 domingo de folga a cada N semanas. */
  domingoFolgaACadaSemanas: number;
  /** Encargos sobre salário para estimar custo de contratação (%); null = não informado. */
  encargosPercentual: number | null;
  /** A convenção/acordo coletivo permite jornada diária acima de 8 h na etapa 1? */
  acordoAmpliaJornadaEtapa1: SimNaoNaoSei;
  /** A convenção/acordo coletivo prevê regime compensatório diferente da 5x2? */
  acordoRegimeCompensatorio: SimNaoNaoSei;
  /** Datas próprias para MEI/ME/EPP (quando a lei complementar sair); null = usar datas gerais. */
  transicaoPequenas: { inicioEtapa1: string | null; inicioEtapa2: string | null };
}

export interface Empresa {
  id: 'principal';
  razaoSocial: string;
  cnpj: string;
  porte: Porte;
  ramo: string;
  atividadeContinua: boolean;
  prestaServicoPoderPublico: boolean;
  sindicato: string;
  convencaoAplicavel: string;
  responsavelDP: string;
  funcionamento: Record<DiaSemana, DiaFuncionamento>;
  config: ConfigEmpresa;
  atualizadoEm: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  cpf?: string;
  matricula?: string;
  cargo: string;
  setor: string;
  salario: number;
  jornadaSemanalContratualMin: number;
  escalaAtual: Escala;
  trabalhaDomingo: boolean;
  gradeAtual: GradeSemanal;
  /** Nova grade definida no simulador (módulo 2) ou no montador. */
  gradeNova?: GradeSemanal;
  /** Data a partir da qual a nova grade vale. */
  vigenciaNovaGrade?: string;
  admissao?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ------------------------------------------------------------ módulo 3 — escala e cobertura

export interface TurnoBase {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  intervaloMin: number;
}

/** Turno com a quantidade de pessoas necessárias em cada dia da semana. */
export interface TurnoCobertura extends TurnoBase {
  demanda: Record<DiaSemana, number>;
}

export interface CoberturaSetor {
  /** Usa o nome do setor como chave. */
  id: string;
  setor: string;
  turnos: TurnoCobertura[];
  /** Salário de referência para estimar contratação; se vazio, usa a média do setor. */
  salarioReferencia: number | null;
  atualizadoEm: string;
}

/** Célula do montador: id do turno ou 'F' (folga). */
export type CelulaEscala = string;
export const FOLGA = 'F';

export interface EscalaSetor {
  id: string;
  setor: string;
  nome: string;
  /** Primeiro dia (domingo) da escala. */
  inicio: string;
  semanas: number;
  turnos: TurnoBase[];
  linhas: { funcionarioId: string; celulas: CelulaEscala[] }[];
  atualizadoEm: string;
}

// ------------------------------------------------------------ módulo 4 — instrumentos coletivos

export type TipoInstrumento = 'CCT' | 'ACT' | 'acordo_individual_compensacao' | 'banco_horas' | '12x36';

export const NOME_TIPO_INSTRUMENTO: Record<TipoInstrumento, string> = {
  CCT: 'Convenção coletiva (CCT)',
  ACT: 'Acordo coletivo (ACT)',
  acordo_individual_compensacao: 'Acordo individual de compensação',
  banco_horas: 'Acordo de banco de horas',
  '12x36': 'Acordo de jornada 12x36',
};

export type TipoClausula =
  | 'jornada_semanal'
  | 'jornada_diaria'
  | 'escala'
  | 'banco_horas'
  | 'regime_12x36'
  | 'domingos'
  | 'outra';

export const NOME_TIPO_CLAUSULA: Record<TipoClausula, string> = {
  jornada_semanal: 'Limite de horas semanais',
  jornada_diaria: 'Jornada diária / compensação',
  escala: 'Escala (dias de trabalho por semana)',
  banco_horas: 'Banco de horas',
  regime_12x36: 'Regime 12x36',
  domingos: 'Trabalho e folga aos domingos',
  outra: 'Outra cláusula de jornada',
};

export type AvaliacaoClausula = 'compativel' | 'incompativel' | 'revisar';

export interface Clausula {
  id: string;
  numero: string;
  titulo: string;
  texto: string;
  tipo: TipoClausula;
  parametros: {
    jornadaSemanalMin?: number;
    jornadaDiariaMin?: number;
    diasTrabalhoSemana?: number;
    prazoBancoMeses?: number;
    domingoFolgaACadaSemanas?: number;
    /** A cláusula institui regime compensatório excepcional (diferente da 5x2) respeitando os novos limites? */
    regimeCompensatorioExcepcional?: boolean;
  };
  /** Decisão manual de quem revisou; sobrepõe a avaliação automática. */
  avaliacaoManual: AvaliacaoClausula | null;
  observacao: string;
}

export interface Instrumento {
  id: string;
  tipo: TipoInstrumento;
  nome: string;
  sindicato: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  clausulas: Clausula[];
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ------------------------------------------------------------ módulos 5 e 6

/** Estado de um item de checklist (a definição dos itens fica no código). */
export interface EstadoChecklist {
  id: string;
  feito: boolean;
  feitoEm: string | null;
  observacao: string;
}

export type EtapaTarefa = 'etapa1' | 'etapa2' | 'terceirizada' | 'geral';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  etapa: EtapaTarefa;
  origem: 'auto' | 'manual';
  concluida: boolean;
  concluidaEm: string | null;
  /** Tarefa automática que o usuário ocultou. */
  oculta: boolean;
}

export type StatusDiagnostico ='adequado' | 'ajustar_etapa1' | 'ajustar_etapa2' | 'depende_acordo';

export type Severidade = 'erro' | 'aviso' | 'info';

export interface Motivo {
  codigo: string;
  texto: string;
  severidade: Severidade;
}
