/**
 * Gerador de pauta/minuta para negociação com o sindicato. Sempre marcado como MODELO.
 */
import { REGRAS } from '../config/regras-ec141';
import { MARCA_MODELO_PAUTA } from '../config/textos-juridicos';
import { avaliarInstrumento, eColetivo, ROTULO_AVALIACAO } from './clausulas';
import { destaque, espaco, item, paragrafo, subtitulo, titulo, type Bloco } from './documento';
import type { Prazos } from './etapas';
import { formatarData, formatarDuracao } from './tempo';
import { NOME_TIPO_INSTRUMENTO, type Empresa, type Instrumento } from './tipos';

export interface TopicosPauta {
  distribuicao42h: boolean;
  regimeCompensatorio: boolean;
  bancoHoras: boolean;
  domingos: boolean;
  clausulasIncompativeis: boolean;
}

export const TOPICOS_PADRAO: TopicosPauta = {
  distribuicao42h: true,
  regimeCompensatorio: true,
  bancoHoras: true,
  domingos: true,
  clausulasIncompativeis: true,
};

export interface OpcoesPauta {
  empresa: Empresa | null;
  instrumentos: Instrumento[];
  topicos: TopicosPauta;
  prazos: Prazos;
  domingoACadaSemanas: number;
  observacoes: string;
  dataDocumento: string;
}

export function gerarPauta(o: OpcoesPauta): Bloco[] {
  const e1 = REGRAS.etapa1;
  const e2 = REGRAS.etapa2;
  const nomeEmpresa = o.empresa?.razaoSocial || '[NOME DA EMPRESA]';
  const sindicato = o.empresa?.sindicato || '[NOME DO SINDICATO]';
  const coletivos = o.instrumentos.filter((i) => eColetivo(i.tipo));
  const b: Bloco[] = [
    destaque(MARCA_MODELO_PAUTA),
    espaco(),
    titulo('Pauta de negociação — adequação da jornada à EC 141/2026'),
    paragrafo(`Empresa: ${nomeEmpresa}${o.empresa?.cnpj ? ` (CNPJ ${o.empresa.cnpj})` : ''}`),
    paragrafo(`Sindicato: ${sindicato}`),
    paragrafo(`Instrumento(s) em vigor: ${coletivos.map((i) => i.nome).join('; ') || o.empresa?.convencaoAplicavel || '[informar]'}`),
    paragrafo(`Data: ${formatarData(o.dataDocumento)}`),
    espaco(),
    subtitulo('1. Contexto'),
    paragrafo(
      `A ${REGRAS.norma.nome}, promulgada em ${formatarData(REGRAS.norma.promulgacao)}, encerra a escala 6x1 como regra geral e estabelece a escala 5x2, com dois dias de repouso semanal remunerado (um preferencialmente aos domingos), sem redução salarial.`,
    ),
    item(`A partir de ${formatarData(o.prazos.inicioEtapa1)}: escala 5x2 e limite de ${formatarDuracao(e1.limiteSemanalMin)} semanais.`),
    item(
      `Até ${formatarData(e1.fim)}: convenção ou acordo coletivo pode ampliar a jornada diária acima de ${formatarDuracao(e1.limiteDiarioMin)} para viabilizar as ${formatarDuracao(e1.limiteSemanalMin)}, respeitados os 2 dias de repouso.`,
    ),
    item(`A partir de ${formatarData(o.prazos.inicioEtapa2)}: limite de ${formatarDuracao(e2.limiteDiarioMin)} diárias e ${formatarDuracao(e2.limiteSemanalMin)} semanais em 5 dias.`),
    item('Convenção ou acordo coletivo pode, excepcionalmente, prever regime compensatório diferente da 5x2, respeitando os novos limites.'),
    item('Cláusulas de convenções e acordos incompatíveis com os novos limites perdem eficácia.'),
    paragrafo('A empresa propõe negociar os tópicos abaixo para garantir uma transição segura para a equipe e para o funcionamento do negócio.'),
  ];

  let n = 2;
  if (o.topicos.distribuicao42h) {
    b.push(
      espaco(),
      subtitulo(`${n++}. Distribuição das ${formatarDuracao(e1.limiteSemanalMin)} semanais durante a etapa 1`),
      paragrafo('Proposta: autorizar, até o fim da etapa 1, a distribuição das horas semanais em 5 dias com jornada diária acima de 8 h, nas seguintes formas:'),
      item(`${formatarDuracao(Math.round(e1.limiteSemanalMin / 5))} de segunda a sexta (ou em outros 5 dias da escala), com 1 h de intervalo;`),
      item(`9 h em 4 dias e ${formatarDuracao(e1.limiteSemanalMin - 4 * 9 * 60)} no quinto dia;`),
      item('8 h por dia (40 h semanais), antecipando a etapa 2, como alternativa sem necessidade de ampliação.'),
      paragrafo(
        `Minuta sugerida: "Durante o período de ${formatarData(o.prazos.inicioEtapa1)} a ${formatarData(e1.fim)}, fica autorizada a prorrogação da jornada diária até ${formatarDuracao(e1.limiteDiarioComAcordoMin)}, exclusivamente para a distribuição das ${formatarDuracao(e1.limiteSemanalMin)} semanais em 5 (cinco) dias, assegurados 2 (dois) dias de repouso semanal remunerado, o intervalo intrajornada e a interjornada mínima de 11 horas, sem redução salarial."`,
      ),
    );
  }
  if (o.topicos.regimeCompensatorio) {
    b.push(
      espaco(),
      subtitulo(`${n++}. Regime compensatório excepcional (atividades contínuas)`),
      paragrafo(
        o.empresa?.atividadeContinua
          ? 'Como a empresa funciona de forma contínua, propõe-se discutir regime compensatório diferente da 5x2 apenas para setores em que a cobertura em 5x2 se mostre inviável, respeitando os limites de horas de cada etapa.'
          : 'Avaliar se algum setor precisa de regime compensatório diferente da 5x2. Se não houver necessidade, este tópico pode ser retirado.',
      ),
      item(`Limite semanal: ${formatarDuracao(e1.limiteSemanalMin)} (etapa 1) e ${formatarDuracao(e2.limiteSemanalMin)} (etapa 2), na média do período de compensação.`),
      item('Setores e funções abrangidos, duração do regime e forma de revisão.'),
      item('Situação da escala 12x36, se houver (média de 42 h semanais: compatível só na etapa 1).'),
    );
  }
  if (o.topicos.bancoHoras) {
    b.push(
      espaco(),
      subtitulo(`${n++}. Banco de horas`),
      item(`Prazo de compensação de até ${REGRAS.clt.bancoDeHoras.prazoMaxAcordoColetivoMeses} meses (acordo coletivo).`),
      item(`Jornada de referência atualizada para ${formatarDuracao(e1.limiteSemanalMin)} (etapa 1) e ${formatarDuracao(e2.limiteSemanalMin)} (etapa 2).`),
      item(`Novo divisor para cálculo de horas: ${REGRAS.divisores.porHorasSemanais[42]} (42 h) e ${REGRAS.divisores.porHorasSemanais[40]} (40 h).`),
      item('Limite diário de horas no banco e regras de pagamento do saldo na rescisão.'),
    );
  }
  if (o.topicos.domingos) {
    b.push(
      espaco(),
      subtitulo(`${n++}. Trabalho e folga aos domingos`),
      item(`Revezamento que garanta ao menos 1 domingo de folga a cada ${o.domingoACadaSemanas} semanas.`),
      item('Um dos dois repousos semanais preferencialmente aos domingos.'),
      item('Adicional ou folga compensatória para domingos e feriados trabalhados.'),
    );
  }
  if (o.topicos.clausulasIncompativeis) {
    const problemas = o.instrumentos.flatMap((inst) =>
      avaliarInstrumento(inst, o.domingoACadaSemanas)
        .filter((a) => a.final !== 'compativel')
        .map((a) => ({ inst, a })),
    );
    b.push(espaco(), subtitulo(`${n++}. Cláusulas atuais a revisar`));
    if (problemas.length === 0) {
      b.push(paragrafo('Nenhuma cláusula cadastrada foi apontada como incompatível ou a revisar.'));
    } else {
      for (const { inst, a } of problemas) {
        const motivo = a.etapa1.resultado !== 'compativel' ? a.etapa1.motivo : a.etapa2.motivo;
        b.push(
          item(
            `${NOME_TIPO_INSTRUMENTO[inst.tipo]} "${inst.nome}", cláusula ${a.clausula.numero || '?'} (${a.clausula.titulo}): ${ROTULO_AVALIACAO[a.final]}. ${motivo}`,
          ),
        );
      }
    }
  }
  if (o.observacoes.trim()) {
    b.push(espaco(), subtitulo(`${n++}. Observações da empresa`), paragrafo(o.observacoes.trim()));
  }
  b.push(
    espaco(),
    subtitulo(`${n}. Próximos passos sugeridos`),
    item(`Agendar reunião com o sindicato antes de ${formatarData(o.prazos.inicioEtapa1)}.`),
    item('Formalizar o resultado em termo aditivo à convenção ou acordo coletivo de trabalho.'),
    item('Registrar o instrumento no sistema Mediador do Ministério do Trabalho, quando aplicável.'),
    item('Comunicar a equipe e atualizar contratos, ponto eletrônico e eSocial.'),
    espaco(),
    destaque(MARCA_MODELO_PAUTA),
  );
  return b;
}
