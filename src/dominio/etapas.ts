/**
 * Etapas da EC 141/2026, prazos por perfil de empresa e limites vigentes.
 * Todas as datas e números vêm de REGRAS (src/config/regras-ec141.ts).
 */
import { REGRAS } from '../config/regras-ec141';
import { diferencaDias, lerData } from './tempo';
import type { ConfigEmpresa, Empresa, Porte } from './tipos';

export type NumeroEtapa = 0 | 1 | 2;

/** Perfil mínimo da empresa necessário para calcular prazos. */
export interface PerfilPrazos {
  porte: Porte;
  prestaServicoPoderPublico: boolean;
  transicaoPequenas?: ConfigEmpresa['transicaoPequenas'];
}

export interface Prazos {
  inicioEtapa1: string;
  inicioEtapa2: string;
  /** Fim da janela em que o acordo coletivo pode ampliar a jornada diária. */
  fimJanelaAcordoEtapa1: string;
  /** Data da regra especial de terceirizadas da administração pública, se aplicável. */
  terceirizadaPublica: string | null;
  pequenaEmpresaPendente: boolean;
  observacoes: string[];
}

export const PORTES_PEQUENOS: Porte[] = ['MEI', 'ME', 'EPP'];

export function perfilDaEmpresa(e: Pick<Empresa, 'porte' | 'prestaServicoPoderPublico' | 'config'> | null | undefined): PerfilPrazos {
  return {
    porte: e?.porte ?? 'DEMAIS',
    prestaServicoPoderPublico: e?.prestaServicoPoderPublico ?? false,
    transicaoPequenas: e?.config.transicaoPequenas,
  };
}

/** Calcula as datas de início de cada etapa para o perfil informado. */
export function calcularPrazos(perfil: PerfilPrazos): Prazos {
  const obs: string[] = [];
  let inicioEtapa1: string = REGRAS.etapa1.inicio;
  let inicioEtapa2: string = REGRAS.etapa2.inicio;
  let terceirizadaPublica: string | null = null;

  const pequena = PORTES_PEQUENOS.includes(perfil.porte);
  const pendente = pequena && REGRAS.excecoes.meiMeEpp.status === 'pendente_regulamentacao';

  if (pequena) {
    const t = perfil.transicaoPequenas;
    if (t?.inicioEtapa1) inicioEtapa1 = t.inicioEtapa1;
    if (t?.inicioEtapa2) inicioEtapa2 = t.inicioEtapa2;
    if (pendente) {
      obs.push(
        t?.inicioEtapa1 || t?.inicioEtapa2
          ? 'Datas próprias de MEI/ME/EPP configuradas pela empresa (a lei complementar ainda está pendente).'
          : 'MEI/ME/EPP: a lei complementar pode criar uma transição própria. Até lá, usamos as datas gerais (por segurança).',
      );
    }
  }

  if (perfil.prestaServicoPoderPublico) {
    terceirizadaPublica = REGRAS.excecoes.terceirizadaAdministracaoPublica.prazoEtapa1;
    if (terceirizadaPublica > inicioEtapa1) inicioEtapa1 = terceirizadaPublica;
    obs.push(
      'Terceirizada que presta serviço à administração pública: prazo especial de 12 meses após a promulgação para os contratos com o poder público.',
    );
  }

  if (inicioEtapa2 < inicioEtapa1) inicioEtapa2 = inicioEtapa1;

  return {
    inicioEtapa1,
    inicioEtapa2,
    fimJanelaAcordoEtapa1: REGRAS.etapa1.fim,
    terceirizadaPublica,
    pequenaEmpresaPendente: pendente,
    observacoes: obs,
  };
}

/** Etapa vigente numa data: 0 = antes da etapa 1; 1 = transição (42 h); 2 = definitiva (40 h). */
export function etapaVigente(dataIso: string, prazos: Prazos): NumeroEtapa {
  if (dataIso < prazos.inicioEtapa1) return 0;
  if (dataIso < prazos.inicioEtapa2) return 1;
  return 2;
}

export interface Limites {
  etapa: NumeroEtapa;
  limiteSemanalMin: number;
  limiteDiarioMin: number;
  /** Teto diário se houver acordo coletivo (só na etapa 1); null se não se aplica. */
  limiteDiarioComAcordoMin: number | null;
  diasTrabalhoMax: number;
  diasRepouso: number;
}

export function limitesDaEtapa(etapa: NumeroEtapa): Limites {
  if (etapa === 0) {
    const r = REGRAS.regimeAnterior;
    return {
      etapa,
      limiteSemanalMin: r.limiteSemanalMin,
      limiteDiarioMin: r.limiteDiarioMin,
      limiteDiarioComAcordoMin: null,
      diasTrabalhoMax: r.diasTrabalhoMaxSemana,
      diasRepouso: r.diasRepousoSemanal,
    };
  }
  if (etapa === 1) {
    const r = REGRAS.etapa1;
    return {
      etapa,
      limiteSemanalMin: r.limiteSemanalMin,
      limiteDiarioMin: r.limiteDiarioMin,
      limiteDiarioComAcordoMin: r.acordoColetivoPodeAmpliarDiaria ? r.limiteDiarioComAcordoMin : null,
      diasTrabalhoMax: r.diasTrabalhoMaxSemana,
      diasRepouso: r.diasRepousoSemanal,
    };
  }
  const r = REGRAS.etapa2;
  return {
    etapa,
    limiteSemanalMin: r.limiteSemanalMin,
    limiteDiarioMin: r.limiteDiarioMin,
    limiteDiarioComAcordoMin: null,
    diasTrabalhoMax: r.diasTrabalhoMaxSemana,
    diasRepouso: r.diasRepousoSemanal,
  };
}

export const NOME_ETAPA: Record<NumeroEtapa, string> = {
  0: 'Antes da etapa 1 (regra antiga ainda vale)',
  1: 'Etapa 1 — transição (42 h semanais)',
  2: 'Etapa 2 — regra definitiva (40 h semanais)',
};

export interface Contagem {
  dias: number;
  horas: number;
  minutos: number;
  passou: boolean;
  /** Dias de calendário restantes (negativo se já passou). */
  diasCalendario: number;
}

/** Contagem regressiva de `agora` até a meia-noite (local) da data alvo. */
export function contagemRegressiva(alvoIso: string, agora: Date): Contagem {
  const alvo = lerData(alvoIso).getTime();
  const diff = alvo - agora.getTime();
  const hojeIso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  const diasCalendario = diferencaDias(hojeIso, alvoIso);
  if (diff <= 0) return { dias: 0, horas: 0, minutos: 0, passou: true, diasCalendario };
  const totalMin = Math.floor(diff / 60_000);
  return {
    dias: Math.floor(totalMin / 1440),
    horas: Math.floor((totalMin % 1440) / 60),
    minutos: totalMin % 60,
    passou: false,
    diasCalendario,
  };
}
