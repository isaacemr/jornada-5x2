/**
 * ============================================================================
 *  REGRAS DA EC 141/2026 E DA CLT USADAS PELO ASSISTENTE
 * ============================================================================
 *
 *  Este é o ÚNICO lugar do código onde ficam datas, limites e parâmetros legais.
 *  Nenhuma tela ou função de cálculo deve fixar esses valores: todas leem daqui
 *  (diretamente ou por meio de `src/dominio/etapas.ts`).
 *
 *  Como atualizar quando sair regulamentação ou o texto oficial for conferido:
 *   1. Altere o valor correspondente abaixo.
 *   2. Ajuste `fonte` e marque `confirmarNoTextoOficial: false` quando o valor
 *      tiver sido conferido no Diário Oficial / Planalto.
 *   3. Atualize `versaoRegras` (data da revisão).
 *   4. Rode `npm test` — os testes usam estes valores e indicam o que mudou.
 *
 *  Unidades: tempos em MINUTOS; datas em ISO 'AAAA-MM-DD' (data local, sem fuso).
 * ============================================================================
 */

const h = (horas: number, minutos = 0) => horas * 60 + minutos;

/** Metadados de origem de cada regra. */
export interface Fonte {
  /** Dispositivo legal / documento de onde a regra foi extraída. */
  fonte: string;
  /** true = valor ainda não conferido no texto publicado; a interface mostra um alerta. */
  confirmarNoTextoOficial: boolean;
}

export const REGRAS = {
  /** Data da última revisão deste arquivo. Exibida no rodapé e na página "Entenda". */
  versaoRegras: '2026-10-21',

  norma: {
    nome: 'Emenda Constitucional nº 141/2026',
    nomeCurto: 'EC 141/2026',
    promulgacao: '2026-10-16',
    fonte: 'EC 141/2026 — data de promulgação conforme divulgação oficial do Congresso Nacional',
    confirmarNoTextoOficial: true,
  },

  /** Regra geral permanente: fim da 6x1 como regra, 5x2 com dois repousos. */
  regraGeral: {
    escala: '5x2',
    diasTrabalhoMaxSemana: 5,
    diasRepousoSemanal: 2,
    /** Um dos dois repousos preferencialmente aos domingos. */
    domingoPreferencial: true,
    /** É vedada a redução salarial em razão da adequação. */
    semReducaoSalarial: true,
    fonte: 'EC 141/2026 — nova redação do art. 7º, XIII e XV, da Constituição (conforme resumo oficial)',
    confirmarNoTextoOficial: true,
  },

  /**
   * Situação anterior à EC (CLT/CF redação antiga). Usada para o "antes" dos
   * comparativos e para o período entre a promulgação e o início da etapa 1.
   */
  regimeAnterior: {
    limiteDiarioMin: h(8),
    limiteSemanalMin: h(44),
    diasTrabalhoMaxSemana: 6,
    diasRepousoSemanal: 1,
    fonte: 'CF art. 7º, XIII e XV (redação anterior); CLT arts. 58 e 67',
    confirmarNoTextoOficial: false,
  },

  /** Etapa 1 — 60 dias após a promulgação. */
  etapa1: {
    inicio: '2026-12-16',
    fim: '2027-12-15',
    limiteSemanalMin: h(42),
    limiteDiarioMin: h(8),
    diasTrabalhoMaxSemana: 5,
    diasRepousoSemanal: 2,
    /**
     * Durante a etapa 1, convenção ou acordo COLETIVO pode ampliar a jornada
     * diária acima de 8 h para viabilizar as 42 h (ex.: 8h24 x 5 dias).
     */
    acordoColetivoPodeAmpliarDiaria: true,
    /**
     * Teto diário adotado pela ferramenta quando há acordo coletivo na etapa 1.
     * A EC não fixa número; usamos 10 h (8 h + 2 h, por analogia ao art. 59 da CLT).
     * Ajuste se a regulamentação definir outro teto.
     */
    limiteDiarioComAcordoMin: h(10),
    fonte: 'EC 141/2026 — regra de transição (etapa 1); teto diário com acordo: CLT art. 59 por analogia',
    confirmarNoTextoOficial: true,
  },

  /** Etapa 2 — regra definitiva. */
  etapa2: {
    inicio: '2027-12-16',
    limiteSemanalMin: h(40),
    limiteDiarioMin: h(8),
    diasTrabalhoMaxSemana: 5,
    diasRepousoSemanal: 2,
    /** O excedente passa a ser hora extra ou banco de horas. */
    excedenteViraHoraExtraOuBanco: true,
    fonte: 'EC 141/2026 — regra definitiva (etapa 2)',
    confirmarNoTextoOficial: true,
  },

  excecoes: {
    /** Convenção/acordo coletivo pode prever regime compensatório diferente da 5x2 (inclusive 6x1), respeitando os novos limites. */
    regimeCompensatorioPorAcordoColetivo: {
      permitido: true,
      inclusive6x1: true,
      deveRespeitarLimitesDaEtapa: true,
      fonte: 'EC 141/2026 — exceção por negociação coletiva',
      confirmarNoTextoOficial: true,
    },
    /** Cláusulas de convenções/acordos incompatíveis com os novos limites perdem eficácia. */
    clausulasIncompativeisPerdemEficacia: {
      valor: true,
      fonte: 'EC 141/2026 — disposição sobre instrumentos coletivos vigentes',
      confirmarNoTextoOficial: true,
    },
    /** Contratos aditados a partir desta data já devem observar as novas regras. */
    aditivosDevemObservarNovasRegrasApartirDe: {
      data: '2026-12-16',
      fonte: 'EC 141/2026 — aplicação a contratos aditados',
      confirmarNoTextoOficial: true,
    },
    /** Terceirizadas que prestam serviço à administração pública: 12 meses após a promulgação. */
    terceirizadaAdministracaoPublica: {
      prazoEtapa1: '2027-10-16',
      fonte: 'EC 141/2026 — prazo de 12 meses para contratos com a administração pública',
      confirmarNoTextoOficial: true,
    },
    /** MEI/ME/EPP: lei complementar pode criar transição própria. */
    meiMeEpp: {
      status: 'pendente_regulamentacao' as 'pendente_regulamentacao' | 'regulamentado',
      /** Enquanto pendente, a ferramenta usa as datas gerais, salvo se a empresa configurar outras. */
      usarDatasGeraisEnquantoPendente: true,
      fonte: 'EC 141/2026 — remissão a lei complementar (ainda não editada em 21/10/2026)',
      confirmarNoTextoOficial: true,
    },
    /** Quem já cumpre 40 h ou menos não tem nova redução, mas ganha os 2 dias de repouso. */
    quemJaCumpre40hOuMenos: {
      semNovaReducao: true,
      ganhaDoisDiasDeRepouso: true,
      fonte: 'EC 141/2026 — situação de quem já cumpre jornada reduzida',
      confirmarNoTextoOficial: true,
    },
  },

  /**
   * Divisor mensal para cálculo do valor-hora (salário ÷ divisor).
   * Fórmula usual: horas semanais ÷ 6 × 30 (= horas semanais × 5). TST Súmula 431 (40 h → 200).
   * A empresa pode alterar o divisor nas configurações.
   */
  divisores: {
    porHorasSemanais: { 44: 220, 42: 210, 40: 200 } as Record<number, number>,
    fatorPadrao: 5,
    fonte: 'CLT art. 64; TST Súmula 431',
    confirmarNoTextoOficial: false,
  },

  /** Repouso aos domingos — padrão da ferramenta (configurável por empresa). */
  domingos: {
    /** Ao menos 1 domingo de folga a cada N semanas. */
    folgaACadaSemanasPadrao: 4,
    /** Referência: comércio em geral — Lei 10.101/2000, art. 6º, parágrafo único (1 a cada 3 semanas). */
    referenciaComercio: 3,
    fonte: 'Padrão da ferramenta; comércio: Lei 10.101/2000 art. 6º; CLT art. 386 (mulheres: quinzenal)',
    confirmarNoTextoOficial: false,
  },

  /** Regras da CLT que continuam valendo e são usadas nas validações. */
  clt: {
    intervaloIntrajornada: {
      /** Jornada acima de 6 h: mínimo de 1 h. */
      acimaDe6hMin: h(1),
      /** Máximo sem acordo escrito/coletivo. */
      maximoSemAcordoMin: h(2),
      /** Jornada acima de 4 h e até 6 h: mínimo de 15 min. */
      de4a6hMin: 15,
      limiteJornada6hMin: h(6),
      limiteJornada4hMin: h(4),
      fonte: 'CLT art. 71, caput e §1º',
      confirmarNoTextoOficial: false,
    },
    interjornadaMin: {
      valor: h(11),
      fonte: 'CLT art. 66',
      confirmarNoTextoOficial: false,
    },
    horaExtra: {
      adicionalPadrao: 0.5,
      adicionalDomingoFeriadoPadrao: 1.0,
      maxHorasExtrasDiariasMin: h(2),
      fonte: 'CF art. 7º, XVI; CLT art. 59; Lei 605/1949 art. 9º',
      confirmarNoTextoOficial: false,
    },
    toleranciaPonto: {
      porMarcacaoMin: 5,
      maxDiariaMin: 10,
      fonte: 'CLT art. 58, §1º',
      confirmarNoTextoOficial: false,
    },
    bancoDeHoras: {
      prazoMaxAcordoIndividualMeses: 6,
      prazoMaxAcordoColetivoMeses: 12,
      compensacaoMesmoMesMeses: 1,
      fonte: 'CLT art. 59, §§2º, 5º e 6º',
      confirmarNoTextoOficial: false,
    },
    regime12x36: {
      mediaSemanalMin: h(42),
      fonte: 'CLT art. 59-A',
      confirmarNoTextoOficial: false,
    },
  },

  esocial: {
    eventoAlteracaoContratual: 'S-2206',
    /** Prazo usual: até o dia 15 do mês seguinte ao da alteração (ou antes do fechamento da folha). */
    diaLimiteMesSeguinte: 15,
    fonte: 'Manual de Orientação do eSocial — evento S-2206',
    confirmarNoTextoOficial: true,
  },

  /** Semanas por mês usadas nas estimativas de custo (52 ÷ 12). */
  semanasPorMes: 52 / 12,
} as const;

/** Lista legível das regras que ainda precisam ser conferidas (usada na página "Entenda"). */
export function regrasPendentesDeConfirmacao(): { chave: string; fonte: string }[] {
  const pendentes: { chave: string; fonte: string }[] = [];
  const visitar = (obj: unknown, caminho: string) => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;
    if (o.confirmarNoTextoOficial === true && typeof o.fonte === 'string') {
      pendentes.push({ chave: caminho, fonte: o.fonte });
    }
    for (const [k, v] of Object.entries(o)) visitar(v, caminho ? `${caminho}.${k}` : k);
  };
  visitar(REGRAS, '');
  return pendentes;
}
