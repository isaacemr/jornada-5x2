/**
 * Itens do checklist de ponto eletrônico, eSocial e folha.
 * Os textos citam valores de REGRAS para acompanhar atualizações do arquivo de regras.
 */
import { formatarDuracao } from '../dominio/tempo';
import { REGRAS } from './regras-ec141';

export interface ItemChecklistDef {
  id: string;
  grupo: 'Ponto eletrônico' | 'eSocial' | 'Folha de pagamento' | 'Contratos e equipe';
  texto: string;
  detalhe?: string;
}

const d = REGRAS.divisores.porHorasSemanais;
const tol = REGRAS.clt.toleranciaPonto;
const bh = REGRAS.clt.bancoDeHoras;

export const ITENS_CHECKLIST_PONTO: ItemChecklistDef[] = [
  {
    id: 'ponto-horarios',
    grupo: 'Ponto eletrônico',
    texto: 'Cadastrar os novos horários contratuais de cada funcionário no sistema de ponto (REP-C, REP-A ou REP-P).',
    detalhe: 'Use a planilha de-para como base. Confira entrada, saída, intervalo e dias de folga.',
  },
  {
    id: 'ponto-escalas',
    grupo: 'Ponto eletrônico',
    texto: 'Cadastrar as escalas 5x2 e o revezamento de folgas (inclusive domingos).',
  },
  {
    id: 'ponto-tolerancia',
    grupo: 'Ponto eletrônico',
    texto: `Revisar as regras de tolerância: até ${tol.porMarcacaoMin} min por marcação, no máximo ${tol.maxDiariaMin} min por dia.`,
    detalhe: tol.fonte,
  },
  {
    id: 'ponto-limite-he',
    grupo: 'Ponto eletrônico',
    texto: `Ajustar a partir de quando o sistema conta hora extra: ${formatarDuracao(REGRAS.etapa1.limiteSemanalMin)} semanais na etapa 1; ${formatarDuracao(REGRAS.etapa2.limiteDiarioMin)} diárias e ${formatarDuracao(REGRAS.etapa2.limiteSemanalMin)} semanais na etapa 2.`,
  },
  {
    id: 'ponto-banco',
    grupo: 'Ponto eletrônico',
    texto: 'Atualizar os parâmetros do banco de horas: jornada de referência, limite diário e prazo de compensação.',
    detalhe: `Prazo máximo: ${bh.prazoMaxAcordoIndividualMeses} meses (acordo individual) ou ${bh.prazoMaxAcordoColetivoMeses} meses (acordo coletivo).`,
  },
  {
    id: 'ponto-intervalos',
    grupo: 'Ponto eletrônico',
    texto: `Conferir no sistema os intervalos intrajornada e a interjornada mínima de ${formatarDuracao(REGRAS.clt.interjornadaMin.valor)}.`,
  },
  {
    id: 'ponto-dsr',
    grupo: 'Ponto eletrônico',
    texto: 'Configurar os 2 dias de repouso semanal remunerado (DSR) por funcionário.',
  },
  {
    id: 'esocial-s2206',
    grupo: 'eSocial',
    texto: `Enviar o evento ${REGRAS.esocial.eventoAlteracaoContratual} (alteração contratual) para cada funcionário com a nova jornada.`,
    detalhe: `Informe duração semanal, tipo de jornada e descrição do horário contratual. Prazo usual: até o dia ${REGRAS.esocial.diaLimiteMesSeguinte} do mês seguinte à alteração — confirme com o contador.`,
  },
  {
    id: 'esocial-conferencia',
    grupo: 'eSocial',
    texto: 'Conferir com o contador se os horários informados ao eSocial batem com os do ponto e dos aditivos.',
  },
  {
    id: 'folha-divisor',
    grupo: 'Folha de pagamento',
    texto: `Atualizar o divisor de horas na folha: ${d[44]} (44 h) → ${d[42]} (42 h) → ${d[40]} (40 h), ou o divisor previsto na convenção.`,
  },
  {
    id: 'folha-valorhora',
    grupo: 'Folha de pagamento',
    texto: 'Revisar o cálculo do valor-hora, das horas extras, do adicional noturno e dos reflexos com o novo divisor.',
  },
  {
    id: 'folha-salario',
    grupo: 'Folha de pagamento',
    texto: 'Confirmar que nenhum salário foi reduzido com a mudança de jornada.',
  },
  {
    id: 'contratos-aditivos',
    grupo: 'Contratos e equipe',
    texto: 'Assinar os termos aditivos com todos os funcionários afetados e arquivar as vias.',
  },
  {
    id: 'contratos-depara',
    grupo: 'Contratos e equipe',
    texto: 'Enviar a planilha de-para ao contador e ao fornecedor do sistema de ponto.',
  },
  {
    id: 'equipe-comunicacao',
    grupo: 'Contratos e equipe',
    texto: 'Comunicar a equipe sobre os novos horários e a escala com antecedência (mural, e-mail ou reunião).',
  },
];
