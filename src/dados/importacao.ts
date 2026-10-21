/**
 * Importação de funcionários a partir de CSV ou XLSX.
 * Colunas (cabeçalho, sem diferenciar maiúsculas/acentos):
 *   nome*, cargo, setor, salario*, jornada_semanal (horas), escala (6x1|5x2|12x36|outra),
 *   intervalo_min (padrão para todos os dias), dom, seg, ter, qua, qui, sex, sab,
 *   matricula, cpf, admissao
 * Cada dia: "08:00-16:20" (usa intervalo_min) ou "08:00-16:20/60" (intervalo do dia); vazio ou "folga" = não trabalha.
 */
import Papa from 'papaparse';
import { intervaloPresumido } from '../dominio/jornada';
import { carregarExcelJS } from '../exportacao/exceljs';
import { duracaoPeriodo, horarioValido, lerDuracao, lerMoeda } from '../dominio/tempo';
import { DIAS_SEMANA, type DiaSemana, type Escala, type Funcionario, type GradeSemanal } from '../dominio/tipos';
import { funcionarioSchema, mensagensDeErro } from './esquemas';
import { agoraISO, diaFolga, gradeVazia, novoId } from './padroes';

export type LinhaBruta = Record<string, unknown>;

export const COLUNAS_MODELO = [
  'nome',
  'matricula',
  'cargo',
  'setor',
  'salario',
  'jornada_semanal',
  'escala',
  'intervalo_min',
  'dom',
  'seg',
  'ter',
  'qua',
  'qui',
  'sex',
  'sab',
  'admissao',
] as const;

export const LINHAS_MODELO: Record<(typeof COLUNAS_MODELO)[number], string>[] = [
  { nome: 'Maria da Silva (exemplo)', matricula: '101', cargo: 'Operadora de caixa', setor: 'Caixa', salario: '1.850,00', jornada_semanal: '44', escala: '6x1', intervalo_min: '60', dom: '08:00-14:00/15', seg: '07:00-15:20', ter: '07:00-15:20', qua: 'folga', qui: '07:00-15:20', sex: '07:00-15:20', sab: '07:00-15:20', admissao: '15/03/2021' },
  { nome: 'João Souza (exemplo)', matricula: '102', cargo: 'Auxiliar administrativo', setor: 'Administrativo', salario: '2500', jornada_semanal: '44', escala: '5x2', intervalo_min: '60', dom: '', seg: '08:00-17:48', ter: '08:00-17:48', qua: '08:00-17:48', qui: '08:00-17:48', sex: '08:00-17:48', sab: '', admissao: '04/01/2022' },
];

export interface ErroLinha {
  linha: number;
  nome: string;
  erros: string[];
}

export interface ResultadoImportacao {
  funcionarios: Funcionario[];
  erros: ErroLinha[];
  avisos: ErroLinha[];
  totalLinhas: number;
}

/** 'Salário Base' → 'salario_base'. */
export function normalizarCabecalho(c: string): string {
  return c
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const SINONIMOS: Record<string, string> = {
  funcionario: 'nome',
  nome_completo: 'nome',
  salario_base: 'salario',
  salario_mensal: 'salario',
  jornada: 'jornada_semanal',
  horas_semanais: 'jornada_semanal',
  carga_horaria: 'jornada_semanal',
  carga_horaria_semanal: 'jornada_semanal',
  escala_atual: 'escala',
  intervalo: 'intervalo_min',
  domingo: 'dom',
  segunda: 'seg',
  terca: 'ter',
  quarta: 'qua',
  quinta: 'qui',
  sexta: 'sex',
  sabado: 'sab',
  data_admissao: 'admissao',
  departamento: 'setor',
  funcao: 'cargo',
};

function texto(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Lê "08:00-16:20" ou "08:00 às 16:20/60". Retorna null se folga. */
export function lerPeriodoDia(
  valor: string,
  intervaloPadrao: number | null,
): { entrada: string; saida: string; intervaloMin: number | null } | null | 'invalido' {
  const t = valor.trim().toLowerCase();
  if (!t || ['folga', 'f', '-', 'dsr', 'descanso', 'nao', 'não'].includes(t)) return null;
  const m = /^(\d{1,2}:\d{2})\s*(?:-|–|a|as|às|ate|até)\s*(\d{1,2}:\d{2})\s*(?:\/\s*(\d{1,3}))?$/.exec(t);
  if (!m) return 'invalido';
  const pad = (h: string) => h.padStart(5, '0');
  const entrada = pad(m[1]);
  const saida = pad(m[2]);
  if (!horarioValido(entrada) || !horarioValido(saida)) return 'invalido';
  return { entrada, saida, intervaloMin: m[3] !== undefined ? Number(m[3]) : intervaloPadrao };
}

function lerEscala(v: string): Escala | null {
  const t = v.toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  if (['6x1', '6por1', '6/1'].includes(t)) return '6x1';
  if (['5x2', '5por2', '5/2'].includes(t)) return '5x2';
  if (['12x36', '12por36', '12/36'].includes(t)) return '12x36';
  return 'outra';
}

function lerDataBR(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  const t = texto(v);
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return undefined;
}

/** Converte linhas já lidas (objeto por cabeçalho) em funcionários validados. */
export function converterLinhas(linhas: LinhaBruta[], primeiraLinha = 2): ResultadoImportacao {
  const funcionarios: Funcionario[] = [];
  const erros: ErroLinha[] = [];
  const avisos: ErroLinha[] = [];
  const agora = agoraISO();

  linhas.forEach((bruta, i) => {
    const linha = primeiraLinha + i;
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) {
      const n = normalizarCabecalho(k);
      r[SINONIMOS[n] ?? n] = v;
    }
    const valores = Object.values(r).map(texto).filter(Boolean);
    if (valores.length === 0) return; // linha vazia

    const nome = texto(r.nome);
    const e: string[] = [];
    const a: string[] = [];
    if (!nome) e.push('Nome não informado.');

    const salario = lerMoeda(typeof r.salario === 'number' ? r.salario : texto(r.salario));
    if (salario === null) e.push(`Salário inválido: "${texto(r.salario)}".`);

    const intervaloTxt = texto(r.intervalo_min);
    const intervaloPadrao = intervaloTxt ? Number(intervaloTxt.replace(',', '.')) : null;
    if (intervaloTxt && !Number.isFinite(intervaloPadrao)) e.push(`Intervalo inválido: "${intervaloTxt}".`);

    const grade: GradeSemanal = gradeVazia();
    for (const d of DIAS_SEMANA) {
      const p = lerPeriodoDia(texto(r[d]), Number.isFinite(intervaloPadrao) ? intervaloPadrao : null);
      if (p === 'invalido') {
        e.push(`Horário de ${d} inválido: "${texto(r[d])}". Use 08:00-17:00 ou 08:00-17:00/60.`);
      } else if (p) {
        let intervalo = p.intervaloMin;
        if (intervalo === null) {
          // Sem intervalo informado: assume o mínimo legal para o tempo bruto.
          intervalo = intervaloPresumido(duracaoPeriodo(p.entrada, p.saida));
          a.push(`Intervalo de ${d} não informado; assumido ${intervalo} min.`);
        }
        grade[d as DiaSemana] = { ...diaFolga(), trabalha: true, entrada: p.entrada, saida: p.saida, intervaloMin: intervalo };
      }
    }
    const diasTrab = DIAS_SEMANA.filter((d) => grade[d].trabalha).length;
    if (diasTrab === 0) a.push('Nenhum horário diário informado — o diagnóstico usará só a jornada semanal.');

    const jornadaTxt = texto(r.jornada_semanal);
    let jornada = jornadaTxt ? lerDuracao(jornadaTxt) : null;
    if (jornadaTxt && jornada === null) e.push(`Jornada semanal inválida: "${jornadaTxt}".`);
    if (jornada === null) {
      jornada = 44 * 60;
      if (!jornadaTxt) a.push('Jornada semanal não informada; assumido 44 h.');
    }

    const escala = lerEscala(texto(r.escala)) ?? (diasTrab === 6 ? '6x1' : diasTrab === 5 ? '5x2' : 'outra');

    if (e.length) {
      erros.push({ linha, nome: nome || '(sem nome)', erros: e });
      return;
    }

    const f: Funcionario = {
      id: novoId(),
      nome,
      matricula: texto(r.matricula) || undefined,
      cpf: texto(r.cpf) || undefined,
      cargo: texto(r.cargo),
      setor: texto(r.setor) || 'Geral',
      salario: salario!,
      jornadaSemanalContratualMin: jornada,
      escalaAtual: escala,
      trabalhaDomingo: grade.dom.trabalha,
      gradeAtual: grade,
      admissao: lerDataBR(r.admissao),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    const v = funcionarioSchema.safeParse(f);
    if (!v.success) {
      erros.push({ linha, nome, erros: mensagensDeErro(v.error) });
      return;
    }
    funcionarios.push(f);
    if (a.length) avisos.push({ linha, nome, erros: a });
  });

  return { funcionarios, erros, avisos, totalLinhas: linhas.length };
}

/** Lê texto CSV (separador ; ou , detectado automaticamente). */
export function lerCSV(conteudo: string): LinhaBruta[] {
  const r = Papa.parse<LinhaBruta>(conteudo.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
  });
  return r.data;
}

/** Lê a primeira aba de um arquivo XLSX. */
export async function lerXLSX(buffer: ArrayBuffer): Promise<LinhaBruta[]> {
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const cabecalhos: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => {
    cabecalhos[col] = texto(valorCelula(c.value));
  });
  const linhas: LinhaBruta[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const o: LinhaBruta = {};
    row.eachCell({ includeEmpty: true }, (c, col) => {
      const k = cabecalhos[col];
      if (k) o[k] = valorCelula(c.value);
    });
    linhas.push(o);
  });
  return linhas;
}

/** Normaliza valores de célula do exceljs (texto rico, fórmulas, horários). */
function valorCelula(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('result' in o) return valorCelula(o.result);
    if ('text' in o) return o.text;
  }
  return v;
}

/** Planilha modelo (.xlsx) com aba de dados e aba de instruções. */
export async function bufferXLSXModelo(): Promise<ArrayBuffer> {
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jornada 5x2';
  const ws = wb.addWorksheet('Funcionarios');
  ws.columns = COLUNAS_MODELO.map((c) => ({ header: c, key: c, width: ['nome', 'cargo'].includes(c) ? 28 : 15 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } };
  for (const l of LINHAS_MODELO) ws.addRow(l);
  // Força texto nas colunas de horário para o Excel não converter.
  for (let col = 1; col <= COLUNAS_MODELO.length; col++) ws.getColumn(col).numFmt = '@';

  const inst = wb.addWorksheet('Instrucoes');
  inst.getColumn(1).width = 110;
  [
    'COMO PREENCHER',
    'Uma linha por funcionário. Apague as linhas de exemplo antes de importar.',
    'nome e salario são obrigatórios. Salário pode ser 1.850,00 ou 1850.',
    'jornada_semanal: horas contratuais por semana (ex.: 44, 42, 40, 36).',
    'escala: 6x1, 5x2, 12x36 ou outra.',
    'intervalo_min: intervalo de almoço/descanso em minutos, usado em todos os dias.',
    'dom, seg, ter, qua, qui, sex, sab: horário do dia no formato 08:00-17:00.',
    '  Para um intervalo diferente naquele dia, use 08:00-14:00/15 (15 minutos).',
    '  Deixe vazio ou escreva "folga" nos dias de descanso. Saída menor que a entrada = vira a meia-noite (ex.: 22:00-06:00).',
    'admissao: data no formato DD/MM/AAAA (opcional).',
    'Os dados ficam somente no seu navegador.',
  ].forEach((t, i) => {
    const r = inst.addRow([t]);
    if (i === 0) r.font = { bold: true };
  });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function csvModelo(): string {
  const linhas = [COLUNAS_MODELO.join(';'), ...LINHAS_MODELO.map((l) => COLUNAS_MODELO.map((c) => l[c]).join(';'))];
  return `﻿${linhas.join('\r\n')}\r\n`;
}
