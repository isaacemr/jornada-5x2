/** Esquemas zod: validam backup JSON, importação e formulários. */
import { z } from 'zod';
import { DIAS_SEMANA } from '../dominio/tipos';

const hora = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM');
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD');
const simNao = z.enum(['sim', 'nao', 'nao_sei']);

const porDia = <T extends z.ZodTypeAny>(s: T) =>
  z.object(Object.fromEntries(DIAS_SEMANA.map((d) => [d, s])) as Record<(typeof DIAS_SEMANA)[number], T>);

export const diaJornadaSchema = z.object({
  trabalha: z.boolean(),
  entrada: hora,
  saida: hora,
  intervaloMin: z.number().int().min(0).max(600),
});
export const gradeSchema = porDia(diaJornadaSchema);

export const empresaSchema = z.object({
  id: z.literal('principal'),
  razaoSocial: z.string(),
  cnpj: z.string(),
  porte: z.enum(['MEI', 'ME', 'EPP', 'DEMAIS']),
  ramo: z.string(),
  atividadeContinua: z.boolean(),
  prestaServicoPoderPublico: z.boolean(),
  sindicato: z.string(),
  convencaoAplicavel: z.string(),
  responsavelDP: z.string(),
  funcionamento: porDia(z.object({ aberto: z.boolean(), abre: hora, fecha: hora })),
  config: z.object({
    divisores: z.object({ 44: z.number().positive(), 42: z.number().positive(), 40: z.number().positive() }),
    adicionalHoraExtra: z.number().min(0),
    adicionalDomingoFeriado: z.number().min(0),
    domingoFolgaACadaSemanas: z.number().int().min(1).max(52),
    encargosPercentual: z.number().min(0).nullable(),
    acordoAmpliaJornadaEtapa1: simNao,
    acordoRegimeCompensatorio: simNao,
    transicaoPequenas: z.object({ inicioEtapa1: dataIso.nullable(), inicioEtapa2: dataIso.nullable() }),
  }),
  atualizadoEm: z.string(),
});

export const funcionarioSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1, 'Informe o nome'),
  cpf: z.string().optional(),
  matricula: z.string().optional(),
  cargo: z.string(),
  setor: z.string(),
  salario: z.number().min(0, 'Salário não pode ser negativo'),
  jornadaSemanalContratualMin: z.number().int().min(0).max(80 * 60),
  escalaAtual: z.enum(['6x1', '5x2', '12x36', 'outra']),
  trabalhaDomingo: z.boolean(),
  gradeAtual: gradeSchema,
  gradeNova: gradeSchema.optional(),
  vigenciaNovaGrade: dataIso.optional(),
  admissao: dataIso.optional(),
  observacoes: z.string().optional(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

const turnoBaseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  inicio: hora,
  fim: hora,
  intervaloMin: z.number().int().min(0),
});

export const coberturaSchema = z.object({
  id: z.string(),
  setor: z.string(),
  turnos: z.array(turnoBaseSchema.extend({ demanda: porDia(z.number().int().min(0)) })),
  salarioReferencia: z.number().nullable(),
  atualizadoEm: z.string(),
});

export const escalaSchema = z.object({
  id: z.string(),
  setor: z.string(),
  nome: z.string(),
  inicio: dataIso,
  semanas: z.number().int().min(1).max(12),
  turnos: z.array(turnoBaseSchema),
  linhas: z.array(z.object({ funcionarioId: z.string(), celulas: z.array(z.string()) })),
  atualizadoEm: z.string(),
});

const avaliacao = z.enum(['compativel', 'incompativel', 'revisar']);

export const instrumentoSchema = z.object({
  id: z.string(),
  tipo: z.enum(['CCT', 'ACT', 'acordo_individual_compensacao', 'banco_horas', '12x36']),
  nome: z.string(),
  sindicato: z.string(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string(),
  clausulas: z.array(
    z.object({
      id: z.string(),
      numero: z.string(),
      titulo: z.string(),
      texto: z.string(),
      tipo: z.enum(['jornada_semanal', 'jornada_diaria', 'escala', 'banco_horas', 'regime_12x36', 'domingos', 'outra']),
      parametros: z.object({
        jornadaSemanalMin: z.number().optional(),
        jornadaDiariaMin: z.number().optional(),
        diasTrabalhoSemana: z.number().optional(),
        prazoBancoMeses: z.number().optional(),
        domingoFolgaACadaSemanas: z.number().optional(),
        regimeCompensatorioExcepcional: z.boolean().optional(),
      }),
      avaliacaoManual: avaliacao.nullable(),
      observacao: z.string(),
    }),
  ),
  observacoes: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

export const checklistSchema = z.object({
  id: z.string(),
  feito: z.boolean(),
  feitoEm: z.string().nullable(),
  observacao: z.string(),
});

export const tarefaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  responsavel: z.string(),
  prazo: z.string(),
  etapa: z.enum(['etapa1', 'etapa2', 'terceirizada', 'geral']),
  origem: z.enum(['auto', 'manual']),
  concluida: z.boolean(),
  concluidaEm: z.string().nullable(),
  oculta: z.boolean(),
});

export const backupSchema = z.object({
  app: z.literal('jornada-5x2'),
  versao: z.number().int(),
  exportadoEm: z.string(),
  versaoRegras: z.string().optional(),
  dados: z.object({
    empresa: z.array(empresaSchema),
    funcionarios: z.array(funcionarioSchema),
    instrumentos: z.array(instrumentoSchema).default([]),
    coberturas: z.array(coberturaSchema).default([]),
    escalas: z.array(escalaSchema).default([]),
    checklist: z.array(checklistSchema).default([]),
    tarefas: z.array(tarefaSchema).default([]),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

/** Formata erros do zod em português simples. */
export function mensagensDeErro(erro: z.ZodError): string[] {
  return erro.issues.slice(0, 20).map((i) => `${i.path.join(' › ') || 'arquivo'}: ${i.message}`);
}
