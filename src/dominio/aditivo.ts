/**
 * Termo aditivo ao contrato de trabalho (MODELO) e planilha de-para.
 */
import { REGRAS } from '../config/regras-ec141';
import { MARCA_MODELO_ADITIVO } from '../config/textos-juridicos';
import { assinatura, destaque, espaco, item, paragrafo, subtitulo, titulo, type Bloco } from './documento';
import { calcularPrazos, etapaVigente, limitesDaEtapa, perfilDaEmpresa } from './etapas';
import { resumirGrade } from './jornada';
import { divisorPara, quadroRemuneracao, type ConfigRemuneracao } from './remuneracao';
import { formatarData, formatarDataExtenso, formatarDuracao, formatarMoeda } from './tempo';
import { DIAS_SEMANA, NOME_DIA, type DiaSemana, type Empresa, type Funcionario, type GradeSemanal, type Instrumento } from './tipos';

const NOME_DIA_LONGO: Record<DiaSemana, string> = {
  dom: 'Domingo',
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
};

export interface OpcoesAditivo {
  cidade: string;
  dataAssinatura: string;
  /** Instrumento coletivo que autoriza jornada diária acima de 8 h (etapa 1), se houver. */
  instrumentoColetivo?: Instrumento | null;
  /** Folgas em revezamento (escala) em vez de dias fixos. */
  folgasEmRevezamento: boolean;
}

/** Linhas descritivas de cada dia da grade. */
export function descreverDias(g: GradeSemanal): string[] {
  return DIAS_SEMANA.map((d) => {
    const dia = g[d];
    if (!dia.trabalha) return `${NOME_DIA_LONGO[d]}: repouso semanal remunerado`;
    const intervalo = dia.intervaloMin ? `, com intervalo de ${formatarDuracao(dia.intervaloMin)} para repouso e alimentação` : '';
    return `${NOME_DIA_LONGO[d]}: das ${dia.entrada} às ${dia.saida}${intervalo}`;
  });
}

export function diasDeFolga(g: GradeSemanal): DiaSemana[] {
  return DIAS_SEMANA.filter((d) => !g[d].trabalha);
}

/** Lista quem pode receber aditivo: precisa de nova grade definida. */
export function podeGerarAditivo(f: Funcionario): boolean {
  return !!f.gradeNova && resumirGrade(f.gradeNova).diasTrabalhados > 0;
}

export function gerarAditivo(f: Funcionario, empresa: Empresa | null, op: OpcoesAditivo, cfg: ConfigRemuneracao): Bloco[] {
  if (!f.gradeNova) throw new Error(`${f.nome} não tem nova jornada definida.`);
  const g = f.gradeNova;
  const r = resumirGrade(g);
  const prazos = calcularPrazos(perfilDaEmpresa(empresa));
  const vigencia = f.vigenciaNovaGrade ?? prazos.inicioEtapa1;
  const etapa = etapaVigente(vigencia, prazos);
  const L = limitesDaEtapa(etapa === 0 ? 1 : etapa);
  const quadro = quadroRemuneracao(f.salario, r.totalSemanalMin, cfg);
  const divisorAntes = divisorPara(f.jornadaSemanalContratualMin, cfg.divisores);
  const folgas = diasDeFolga(g);
  const empregador = empresa?.razaoSocial || '[RAZÃO SOCIAL DO EMPREGADOR]';
  const cnpj = empresa?.cnpj || '[CNPJ]';

  const b: Bloco[] = [
    destaque(MARCA_MODELO_ADITIVO),
    espaco(),
    titulo('TERMO ADITIVO AO CONTRATO INDIVIDUAL DE TRABALHO'),
    paragrafo(`EMPREGADOR: ${empregador}, inscrito no CNPJ sob o nº ${cnpj}.`),
    paragrafo(
      `EMPREGADO(A): ${f.nome}${f.cpf ? `, CPF ${f.cpf}` : ', CPF [informar]'}${f.matricula ? `, matrícula ${f.matricula}` : ''}, ocupante do cargo de ${f.cargo || '[cargo]'}${f.admissao ? `, admitido(a) em ${formatarData(f.admissao)}` : ''}.`,
    ),
    paragrafo(
      `As partes acima qualificadas, considerando a ${REGRAS.norma.nome}, que estabelece a escala de trabalho 5x2 com dois dias de repouso semanal remunerado e novos limites de jornada, sem redução salarial, resolvem aditar o contrato de trabalho nos seguintes termos:`,
    ),
    subtitulo('CLÁUSULA PRIMEIRA — DA JORNADA DE TRABALHO'),
    paragrafo(
      `A partir de ${formatarData(vigencia)}, a jornada de trabalho do(a) EMPREGADO(A) passa a ser de ${formatarDuracao(r.totalSemanalMin)} semanais, distribuídas em ${r.diasTrabalhados} dias, observado o limite de ${formatarDuracao(L.limiteSemanalMin)} semanais, conforme o seguinte quadro:`,
    ),
    ...descreverDias(g).map(item),
    subtitulo('CLÁUSULA SEGUNDA — DO REPOUSO SEMANAL REMUNERADO'),
    paragrafo(
      op.folgasEmRevezamento
        ? `O(A) EMPREGADO(A) terá ${folgas.length} dias de repouso semanal remunerado, em regime de revezamento definido em escala divulgada com antecedência, assegurado que um dos repousos coincida com o domingo ao menos uma vez a cada ${empresa?.config.domingoFolgaACadaSemanas ?? REGRAS.domingos.folgaACadaSemanasPadrao} semanas.`
        : `O(A) EMPREGADO(A) terá ${folgas.length} dias de repouso semanal remunerado: ${folgas.map((d) => NOME_DIA[d].toLowerCase()).join(' e ')}${folgas.includes('dom') ? '' : ', devendo um dos repousos coincidir preferencialmente com o domingo, conforme escala'}.`,
    ),
    subtitulo('CLÁUSULA TERCEIRA — DA REMUNERAÇÃO'),
    paragrafo(
      `Fica mantido o salário mensal de ${formatarMoeda(f.salario)}, sem qualquer redução em razão da alteração da jornada. O valor do salário-hora passa a ser calculado pelo divisor ${quadro.divisor} (antes ${divisorAntes}), correspondendo a ${formatarMoeda(quadro.valorHora)}.`,
    ),
  ];

  let n = 4;
  const ordinal = ['QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA'];
  if (r.maxDiarioMin > REGRAS.etapa2.limiteDiarioMin) {
    const inst = op.instrumentoColetivo;
    b.push(
      subtitulo(`CLÁUSULA ${ordinal[n - 4]} — DA JORNADA DIÁRIA NA TRANSIÇÃO`),
      paragrafo(
        `A jornada diária superior a ${formatarDuracao(REGRAS.etapa2.limiteDiarioMin)} decorre de autorização prevista em ${inst ? `${inst.nome}${inst.sindicato ? `, firmada com ${inst.sindicato}` : ''}` : '[convenção/acordo coletivo de trabalho — informar]'}, e vigora somente até ${formatarData(REGRAS.etapa1.fim)}. A partir de ${formatarData(REGRAS.etapa2.inicio)}, a jornada observará o limite de ${formatarDuracao(REGRAS.etapa2.limiteDiarioMin)} diárias e ${formatarDuracao(REGRAS.etapa2.limiteSemanalMin)} semanais.`,
      ),
    );
    n++;
  }
  b.push(
    subtitulo(`CLÁUSULA ${ordinal[n - 4]} — DAS HORAS EXTRAS`),
    paragrafo(
      `As horas trabalhadas além da jornada estabelecida neste termo serão remuneradas como extraordinárias, com adicional mínimo de ${Math.round(cfg.adicionalHoraExtra * 100)}%, ou compensadas por meio de banco de horas, nos termos da lei e do instrumento coletivo aplicável.`,
    ),
  );
  n++;
  b.push(
    subtitulo(`CLÁUSULA ${ordinal[n - 4]} — DAS DEMAIS CONDIÇÕES`),
    paragrafo('Permanecem inalteradas as demais cláusulas e condições do contrato de trabalho que não conflitem com o presente termo.'),
    paragrafo('E, por estarem de acordo, as partes assinam o presente termo em 2 (duas) vias de igual teor.'),
    espaco(),
    paragrafo(`${op.cidade || '[Cidade]'}, ${formatarDataExtenso(op.dataAssinatura)}.`),
    assinatura(`${empregador} — EMPREGADOR`),
    assinatura(`${f.nome} — EMPREGADO(A)`),
    assinatura('Testemunha 1 — nome e CPF'),
    assinatura('Testemunha 2 — nome e CPF'),
    espaco(),
    destaque(MARCA_MODELO_ADITIVO),
  );
  return b;
}

// ---------------------------------------------------------------- planilha de-para

export interface LinhaDePara {
  matricula: string;
  nome: string;
  cargo: string;
  setor: string;
  salario: number;
  escalaAntiga: string;
  horasSemanaisAntes: string;
  horasSemanaisDepois: string;
  diasFolgaAntes: string;
  diasFolgaDepois: string;
  dias: Record<DiaSemana, { antes: string; depois: string }>;
  divisorAntes: number;
  divisorDepois: number;
  valorHoraAntes: number;
  valorHoraDepois: number;
  vigencia: string;
  situacao: string;
}

function textoDia(g: GradeSemanal, d: DiaSemana): string {
  const x = g[d];
  return x.trabalha ? `${x.entrada}-${x.saida} (int. ${x.intervaloMin} min)` : 'Folga';
}

export function linhasDePara(funcionarios: Funcionario[], cfg: ConfigRemuneracao): LinhaDePara[] {
  return funcionarios.map((f) => {
    const antes = resumirGrade(f.gradeAtual);
    const nova = f.gradeNova ?? null;
    const depois = nova ? resumirGrade(nova) : null;
    const qAntes = quadroRemuneracao(f.salario, f.jornadaSemanalContratualMin || antes.totalSemanalMin, cfg);
    const qDepois = depois ? quadroRemuneracao(f.salario, depois.totalSemanalMin, cfg) : qAntes;
    const folgas = (g: GradeSemanal) => diasDeFolga(g).map((d) => NOME_DIA[d].slice(0, 3)).join(', ') || '—';
    return {
      matricula: f.matricula ?? '',
      nome: f.nome,
      cargo: f.cargo,
      setor: f.setor,
      salario: f.salario,
      escalaAntiga: f.escalaAtual,
      horasSemanaisAntes: formatarDuracao(f.jornadaSemanalContratualMin || antes.totalSemanalMin),
      horasSemanaisDepois: depois ? formatarDuracao(depois.totalSemanalMin) : '(não definida)',
      diasFolgaAntes: folgas(f.gradeAtual),
      diasFolgaDepois: nova ? folgas(nova) : '—',
      dias: Object.fromEntries(DIAS_SEMANA.map((d) => [d, { antes: textoDia(f.gradeAtual, d), depois: nova ? textoDia(nova, d) : '' }])) as LinhaDePara['dias'],
      divisorAntes: qAntes.divisor,
      divisorDepois: qDepois.divisor,
      valorHoraAntes: qAntes.valorHora,
      valorHoraDepois: qDepois.valorHora,
      vigencia: f.vigenciaNovaGrade ? formatarData(f.vigenciaNovaGrade) : '',
      situacao: nova ? 'Nova jornada definida' : 'Pendente: definir nova jornada',
    };
  });
}
