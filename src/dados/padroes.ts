/** Fábricas de valores padrão. */
import { REGRAS } from '../config/regras-ec141';
import { DIAS_SEMANA, type DiaJornada, type DiaSemana, type Empresa, type GradeSemanal } from '../dominio/tipos';

export function novoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}

export function diaFolga(): DiaJornada {
  return { trabalha: false, entrada: '08:00', saida: '17:00', intervaloMin: 60 };
}

export function gradeVazia(): GradeSemanal {
  return Object.fromEntries(DIAS_SEMANA.map((d) => [d, diaFolga()])) as GradeSemanal;
}

/** Grade com os mesmos horários nos dias informados. */
export function gradeUniforme(dias: DiaSemana[], entrada: string, saida: string, intervaloMin: number): GradeSemanal {
  const g = gradeVazia();
  for (const d of dias) g[d] = { trabalha: true, entrada, saida, intervaloMin };
  return g;
}

export function empresaPadrao(): Empresa {
  const funcionamento = Object.fromEntries(
    DIAS_SEMANA.map((d) => [d, { aberto: d !== 'dom', abre: '08:00', fecha: d === 'sab' ? '13:00' : '18:00' }]),
  ) as Empresa['funcionamento'];
  return {
    id: 'principal',
    razaoSocial: '',
    cnpj: '',
    porte: 'DEMAIS',
    ramo: '',
    atividadeContinua: false,
    prestaServicoPoderPublico: false,
    sindicato: '',
    convencaoAplicavel: '',
    responsavelDP: '',
    funcionamento,
    config: {
      divisores: {
        44: REGRAS.divisores.porHorasSemanais[44],
        42: REGRAS.divisores.porHorasSemanais[42],
        40: REGRAS.divisores.porHorasSemanais[40],
      },
      adicionalHoraExtra: REGRAS.clt.horaExtra.adicionalPadrao,
      adicionalDomingoFeriado: REGRAS.clt.horaExtra.adicionalDomingoFeriadoPadrao,
      domingoFolgaACadaSemanas: REGRAS.domingos.folgaACadaSemanasPadrao,
      encargosPercentual: null,
      acordoAmpliaJornadaEtapa1: 'nao_sei',
      acordoRegimeCompensatorio: 'nao_sei',
      transicaoPequenas: { inicioEtapa1: null, inicioEtapa2: null },
    },
    atualizadoEm: agoraISO(),
  };
}
