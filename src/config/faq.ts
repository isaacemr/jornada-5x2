/**
 * Perguntas frequentes em linguagem simples. Os números e datas vêm de REGRAS,
 * então a FAQ acompanha automaticamente qualquer atualização do arquivo de regras.
 */
import { formatarData, formatarDuracao, formatarMoeda } from '../dominio/tempo';
import { REGRAS } from './regras-ec141';

export interface Pergunta {
  pergunta: string;
  resposta: string[];
}

const e1 = REGRAS.etapa1;
const e2 = REGRAS.etapa2;
const ex = REGRAS.excecoes;
const div = REGRAS.divisores.porHorasSemanais;

export const RESUMO: { titulo: string; texto: string }[] = [
  {
    titulo: 'Fim da 6x1 como regra',
    texto: `A escala passa a ser 5x2: cinco dias de trabalho e dois dias de repouso semanal remunerado, um deles preferencialmente no domingo.`,
  },
  { titulo: 'Sem redução de salário', texto: 'As horas diminuem, mas o salário mensal continua o mesmo. Por isso o valor de cada hora aumenta.' },
  {
    titulo: `Etapa 1 — a partir de ${formatarData(e1.inicio)}`,
    texto: `Escala 5x2 obrigatória e no máximo ${formatarDuracao(e1.limiteSemanalMin)} por semana. Até ${formatarData(e1.fim)}, convenção ou acordo coletivo pode permitir mais de ${formatarDuracao(e1.limiteDiarioMin)} por dia (ex.: ${formatarDuracao(Math.round(e1.limiteSemanalMin / 5))} em 5 dias).`,
  },
  {
    titulo: `Etapa 2 — a partir de ${formatarData(e2.inicio)}`,
    texto: `No máximo ${formatarDuracao(e2.limiteDiarioMin)} por dia e ${formatarDuracao(e2.limiteSemanalMin)} por semana, em 5 dias. O que passar disso é hora extra ou banco de horas.`,
  },
];

export const FAQ: Pergunta[] = [
  {
    pergunta: 'Minha empresa abre aos domingos. Ainda posso funcionar?',
    resposta: [
      'Sim. A EC muda quantos dias cada pessoa trabalha, não os dias em que a empresa abre. Para manter o funcionamento, organize um revezamento: cada pessoa trabalha 5 dias e folga 2, e as folgas giram entre a equipe.',
      `Um dos repousos deve cair preferencialmente no domingo. Este assistente usa como padrão ao menos 1 domingo de folga a cada ${REGRAS.domingos.folgaACadaSemanasPadrao} semanas (você pode mudar). No comércio, a Lei 10.101/2000 prevê ${REGRAS.domingos.referenciaComercio} semanas.`,
      'Use a calculadora de cobertura para saber quantas pessoas cada turno precisa.',
    ],
  },
  {
    pergunta: 'Posso reduzir o salário porque as horas diminuíram?',
    resposta: ['Não. A EC proíbe redução salarial na adequação. O salário mensal fica igual e o valor da hora sobe.'],
  },
  {
    pergunta: 'Como fica o valor da hora e da hora extra?',
    resposta: [
      `O valor da hora é o salário dividido pelo divisor mensal. Com 44 h usa-se ${div[44]}; com 42 h, ${div[42]}; com 40 h, ${div[40]}. Exemplo: salário de R$ 2.200 → ${formatarMoeda(2200 / div[44])} por hora (44 h) → ${formatarMoeda(2200 / div[40])} por hora (40 h).`,
      `A hora extra é o valor da hora com adicional de no mínimo ${Math.round(REGRAS.clt.horaExtra.adicionalPadrao * 100)}%. Como a hora fica mais cara, a hora extra também fica.`,
    ],
  },
  {
    pergunta: 'Posso continuar com a escala 6x1?',
    resposta: [
      'Só como exceção: convenção ou acordo COLETIVO (com o sindicato) pode prever um regime compensatório diferente da 5x2, inclusive 6x1, desde que respeite os novos limites de horas.',
      `Exemplo: 6 dias de 7 h = 42 h na etapa 1; 6 dias de 6h40 = 40 h na etapa 2. Acordo individual com o funcionário não basta.`,
    ],
  },
  {
    pergunta: 'Posso fazer mais de 8 horas por dia?',
    resposta: [
      `Na etapa 1 (até ${formatarData(e1.fim)}), sim, se houver convenção ou acordo coletivo, para distribuir as ${formatarDuracao(e1.limiteSemanalMin)} em 5 dias (ex.: ${formatarDuracao(Math.round(e1.limiteSemanalMin / 5))} por dia, ou 9 h em 4 dias e 6 h no quinto).`,
      `Na etapa 2 o limite é ${formatarDuracao(e2.limiteDiarioMin)} por dia; o que passar é hora extra ou banco de horas.`,
    ],
  },
  {
    pergunta: 'E quem já trabalha 40 horas ou menos?',
    resposta: [
      'Não há nova redução de horas. Mas, se essa pessoa trabalha 6 dias por semana, passa a ter direito aos 2 dias de repouso — as mesmas horas precisam caber em 5 dias.',
    ],
  },
  {
    pergunta: 'O que acontece com a minha convenção coletiva atual?',
    resposta: [
      'As cláusulas incompatíveis com os novos limites perdem eficácia (por exemplo, 44 h semanais ou 6x1 sem regime compensatório). As demais continuam valendo.',
      'Use a revisão de acordos para marcar cada cláusula e gerar uma pauta de negociação com o sindicato.',
    ],
  },
  {
    pergunta: 'Preciso fazer aditivo no contrato de cada funcionário?',
    resposta: [
      `É recomendável formalizar a nova jornada por termo aditivo. Contratos aditados a partir de ${formatarData(ex.aditivosDevemObservarNovasRegrasApartirDe.data)} já devem seguir as novas regras.`,
      `Também é preciso atualizar o ponto eletrônico e informar a alteração contratual ao eSocial (evento ${REGRAS.esocial.eventoAlteracaoContratual}).`,
    ],
  },
  {
    pergunta: 'Sou MEI, ME ou EPP. Tenho prazo diferente?',
    resposta: [
      'A EC prevê que uma lei complementar pode criar uma transição própria para pequenas empresas, mas ela ainda não existe. Até lá, o mais seguro é seguir as datas gerais.',
      'Quando a lei sair, você pode informar as novas datas em “Dados da empresa”.',
    ],
  },
  {
    pergunta: 'Presto serviço terceirizado para órgão público. Muda algo?',
    resposta: [
      `Sim: para esses contratos o prazo é de 12 meses após a promulgação (${formatarData(ex.terceirizadaAdministracaoPublica.prazoEtapa1)}). Converse também com o órgão contratante sobre o impacto no contrato.`,
    ],
  },
  {
    pergunta: 'E a escala 12x36?',
    resposta: [
      `A 12x36 tem média de ${formatarDuracao(REGRAS.clt.regime12x36.mediaSemanalMin)} por semana. Na etapa 1 pode continuar se a convenção/acordo coletivo a previr como regime compensatório. Na etapa 2 (limite de ${formatarDuracao(e2.limiteSemanalMin)}) precisará ser redesenhada.`,
    ],
  },
  {
    pergunta: 'Meus dados ficam guardados onde?',
    resposta: [
      'Somente no seu navegador, neste computador ou celular. Nada é enviado para servidores. Por isso, faça backups periodicamente na tela “Backup”.',
    ],
  },
];
