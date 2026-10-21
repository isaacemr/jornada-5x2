/** Conversões de horário, duração e datas. Funções puras. */

const RE_HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function horarioValido(hhmm: string): boolean {
  return RE_HORA.test(hhmm.trim());
}

/** 'HH:MM' → minutos desde 00:00. Lança erro se inválido. */
export function paraMinutos(hhmm: string): number {
  const m = RE_HORA.exec(hhmm.trim());
  if (!m) throw new Error(`Horário inválido: "${hhmm}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutos desde 00:00 (aceita ≥ 1440 ou negativos, faz o módulo) → 'HH:MM'. */
export function paraHorario(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Duração em minutos → '8h24', '8h', '0h15', '-1h30'. */
export function formatarDuracao(minutos: number): string {
  const sinal = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutos));
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sinal}${hh}h${mm ? String(mm).padStart(2, '0') : ''}`;
}

/** Duração em minutos → horas decimais (ex.: 504 → 8.4). */
export function paraHorasDecimais(minutos: number): number {
  return minutos / 60;
}

/** Aceita '8h24', '8:24', '8,4', '8.4', '44' (horas) → minutos. Retorna null se não entender. */
export function lerDuracao(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  let m = /^(\d{1,3})h(\d{1,2})?(min)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d{1,3}):(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})(?:[.,](\d+))?$/.exec(t);
  if (m) return Math.round(Number(`${m[1]}.${m[2] ?? '0'}`) * 60);
  return null;
}

/**
 * Duração de um período em minutos. Se a saída for menor ou igual à entrada,
 * considera que o período atravessa a meia-noite.
 */
export function duracaoPeriodo(entrada: string, saida: string): number {
  const e = paraMinutos(entrada);
  let s = paraMinutos(saida);
  if (s <= e) s += 1440;
  return s - e;
}

// ---------------------------------------------------------------- datas

/** 'AAAA-MM-DD' → Date local à meia-noite (sem problema de fuso). */
export function lerData(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`Data inválida: "${iso}"`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date → 'AAAA-MM-DD' (data local). */
export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hojeISO(): string {
  return dataISO(new Date());
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export function formatarData(iso: string): string {
  const d = lerData(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Data por extenso: '16 de dezembro de 2026'. */
export function formatarDataExtenso(iso: string): string {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const d = lerData(iso);
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Soma dias a uma data ISO. */
export function somarDias(iso: string, dias: number): string {
  const d = lerData(iso);
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

/** Diferença em dias de calendário (b − a). */
export function diferencaDias(aIso: string, bIso: string): number {
  const a = lerData(aIso);
  const b = lerData(bIso);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** Índice do dia da semana (0 = domingo) de uma data ISO. */
export function diaDaSemana(iso: string): number {
  return lerData(iso).getDay();
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarNumero(valor: number, casas = 2): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Lê valores monetários em formatos '1.850,50', '1850,5', '1850.50', 'R$ 2.000'. */
export function lerMoeda(texto: string | number): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  let t = texto.replace(/R\$|\s/gi, '').trim();
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
