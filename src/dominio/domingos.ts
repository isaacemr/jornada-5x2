/**
 * Folga aos domingos: regra por pessoa.
 * Mulheres: revezamento quinzenal (CLT art. 386), que acordo coletivo não pode afastar.
 * Homens (e quem não teve o sexo informado): a regra configurada pela empresa (comércio: 3 semanas; regra geral: 7).
 */
import { REGRAS } from '../config/regras-ec141';
import type { Sexo } from './tipos';

/** Ao menos 1 domingo de folga a cada quantas semanas, para esta pessoa. */
export function domingoACadaSemanas(sexo: Sexo | undefined, regraHomens: number): number {
  const homens = Math.max(1, Math.round(regraHomens) || 1);
  return sexo === 'F' ? Math.min(REGRAS.domingos.mulheres, homens) : homens;
}

/** Sugestão da regra dos homens pelo ramo de atividade: comércio 3 semanas; demais 7. */
export function regraHomensPorRamo(ramo: string): number {
  const r = ramo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /comerci|varej|atacad|supermercad|mercado|loja|shopping/.test(r) ? REGRAS.domingos.homensComercio : REGRAS.domingos.homensRegraGeral;
}

/** Quantas pessoas de cada sexo: k mulheres (proporção arredondada) e o restante pela regra dos homens. */
export function domingosDaEquipe(pessoas: number, proporcaoMulheres: number, regraHomens: number): number[] {
  const n = Math.max(0, Math.floor(pessoas));
  const k = Math.round(n * Math.min(1, Math.max(0, proporcaoMulheres)));
  return Array.from({ length: n }, (_, i) => domingoACadaSemanas(i < k ? 'F' : 'M', regraHomens));
}

/** Menor ciclo (em semanas) em que todas as regras se repetem — mínimo comum, limitado a 14 semanas. */
export function cicloDomingos(regras: number[]): number {
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
  const unicos = [...new Set(regras.filter((x) => x >= 1))];
  if (unicos.length === 0) return 1;
  const mmc = unicos.reduce((a, b) => (a * b) / mdc(a, b), 1);
  return mmc <= 14 ? mmc : Math.max(...unicos);
}

/** Frase da regra para uma ou mais pessoas: "ao menos 1 domingo de folga a cada 3 semanas". */
export function textoRegraDomingo(regras: number[]): string {
  const unicos = [...new Set(regras)].sort((a, b) => a - b);
  const cada = (n: number) => (n === 2 ? 'a cada 2 semanas (domingo sim, domingo não)' : `a cada ${n} semanas`);
  if (unicos.length === 0) return '';
  if (unicos.length === 1) return `ao menos 1 domingo de folga ${cada(unicos[0])}`;
  return `ao menos 1 domingo de folga — mulheres: ${cada(unicos[0])}, pela CLT art. 386; homens: ${cada(unicos[unicos.length - 1])}`;
}
