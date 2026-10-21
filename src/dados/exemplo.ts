/**
 * Dados de demonstração — empresa e pessoas FICTÍCIAS.
 * Supermercado de bairro que funciona aos domingos, com a maioria da equipe em 6x1.
 */
import { REGRAS } from '../config/regras-ec141';
import {
  DIAS_SEMANA,
  type CoberturaSetor,
  type DiaSemana,
  type Empresa,
  type Funcionario,
  type GradeSemanal,
  type Instrumento,
} from '../dominio/tipos';
import { type BancoJornada, db as dbPadrao } from './db';
import { agoraISO, empresaPadrao, gradeVazia } from './padroes';
import { apagarTudo } from './backup';

const h = (horas: number, min = 0) => horas * 60 + min;

type Periodo = [entrada: string, saida: string, intervaloMin: number];

/** Monta grade: `semana` vale para seg–sáb (exceto folgas); `domingo` se trabalhar aos domingos. */
function grade(semana: Periodo, folgas: DiaSemana[], domingo?: Periodo): GradeSemanal {
  const g = gradeVazia();
  for (const d of DIAS_SEMANA) {
    if (folgas.includes(d)) continue;
    if (d === 'dom') {
      if (domingo) g.dom = { trabalha: true, entrada: domingo[0], saida: domingo[1], intervaloMin: domingo[2] };
      continue;
    }
    g[d] = { trabalha: true, entrada: semana[0], saida: semana[1], intervaloMin: semana[2] };
  }
  return g;
}

const MANHA: Periodo = ['07:00', '15:20', 60];
const TARDE: Periodo = ['12:40', '21:00', 60];
const REPOSICAO: Periodo = ['06:00', '14:20', 60];
const DOMINGO: Periodo = ['08:00', '14:00', 15];

interface Base {
  nome: string;
  cargo: string;
  setor: string;
  salario: number;
  escala: Funcionario['escalaAtual'];
  grade: GradeSemanal;
  semanalMin?: number;
  admissao: string;
}

const PESSOAS: Base[] = [
  // Caixa
  { nome: 'Ana Paula Ribeiro', cargo: 'Operadora de caixa', setor: 'Caixa', salario: 1850, escala: '6x1', grade: grade(MANHA, ['qua'], DOMINGO), admissao: '2021-03-08' },
  { nome: 'Bruno Henrique Costa', cargo: 'Operador de caixa', setor: 'Caixa', salario: 1850, escala: '6x1', grade: grade(TARDE, ['seg'], DOMINGO), admissao: '2022-07-01' },
  { nome: 'Carla Mendes', cargo: 'Operadora de caixa', setor: 'Caixa', salario: 1850, escala: '6x1', grade: grade(MANHA, ['dom']), admissao: '2019-11-18' },
  { nome: 'Diego Santos', cargo: 'Operador de caixa', setor: 'Caixa', salario: 1900, escala: '6x1', grade: grade(TARDE, ['sex'], DOMINGO), admissao: '2023-02-13' },
  { nome: 'Elaine Ferreira', cargo: 'Fiscal de caixa', setor: 'Caixa', salario: 2400, escala: '6x1', grade: grade(TARDE, ['dom']), admissao: '2018-05-02' },
  // Reposição
  { nome: 'Fábio Almeida', cargo: 'Repositor', setor: 'Reposição', salario: 1750, escala: '6x1', grade: grade(REPOSICAO, ['ter'], ['07:00', '13:00', 15]), admissao: '2022-01-10' },
  { nome: 'Gabriela Lima', cargo: 'Repositora', setor: 'Reposição', salario: 1750, escala: '6x1', grade: grade(REPOSICAO, ['dom']), admissao: '2020-09-21' },
  { nome: 'Henrique Oliveira', cargo: 'Repositor', setor: 'Reposição', salario: 1750, escala: '6x1', grade: grade(REPOSICAO, ['qui'], ['07:00', '13:00', 15]), admissao: '2024-04-01' },
  { nome: 'Isabela Rocha', cargo: 'Repositora', setor: 'Reposição', salario: 1800, escala: '6x1', grade: grade(REPOSICAO, ['dom']), admissao: '2021-08-16' },
  // Açougue
  { nome: 'João Batista Pereira', cargo: 'Açougueiro', setor: 'Açougue', salario: 2600, escala: '6x1', grade: grade(MANHA, ['seg'], ['07:00', '13:00', 15]), admissao: '2017-06-05' },
  { nome: 'Kátia Souza', cargo: 'Auxiliar de açougue', setor: 'Açougue', salario: 1900, escala: '6x1', grade: grade(MANHA, ['dom']), admissao: '2023-10-09' },
  // Padaria
  { nome: 'Luiz Carlos Nunes', cargo: 'Padeiro', setor: 'Padaria', salario: 2300, escala: '6x1', grade: grade(['04:00', '12:20', 60], ['qua'], ['04:00', '10:00', 15]), admissao: '2016-02-01' },
  { nome: 'Marina Teixeira', cargo: 'Confeiteira', setor: 'Padaria', salario: 2100, escala: '6x1', grade: grade(['05:00', '13:20', 60], ['dom']), admissao: '2022-11-07' },
  // Administrativo
  { nome: 'Natália Gomes', cargo: 'Auxiliar administrativa', setor: 'Administrativo', salario: 2500, escala: '5x2', grade: grade(['08:00', '17:48', 60], ['sab', 'dom']), admissao: '2021-01-04' },
  { nome: 'Paula Cristina Dias', cargo: 'Gerente administrativa', setor: 'Administrativo', salario: 5200, escala: '5x2', grade: grade(['08:00', '17:00', 60], ['sab', 'dom']), semanalMin: h(40), admissao: '2015-03-02' },
  // Segurança
  {
    nome: 'Otávio Martins', cargo: 'Vigia noturno', setor: 'Segurança', salario: 2200, escala: '12x36',
    grade: grade(['19:00', '07:00', 60], ['ter', 'qui', 'sab', 'dom']), semanalMin: REGRAS.clt.regime12x36.mediaSemanalMin, admissao: '2020-02-17',
  },
];

export function funcionariosExemplo(): Funcionario[] {
  const agora = agoraISO();
  return PESSOAS.map((p, i) => ({
    id: `ex-${String(i + 1).padStart(2, '0')}`,
    nome: p.nome,
    matricula: String(1001 + i),
    cargo: p.cargo,
    setor: p.setor,
    salario: p.salario,
    jornadaSemanalContratualMin: p.semanalMin ?? h(44),
    escalaAtual: p.escala,
    trabalhaDomingo: p.grade.dom.trabalha,
    gradeAtual: p.grade,
    admissao: p.admissao,
    criadoEm: agora,
    atualizadoEm: agora,
  }));
}

export function empresaExemplo(): Empresa {
  const e = empresaPadrao();
  const func = Object.fromEntries(
    DIAS_SEMANA.map((d) => [d, d === 'dom' ? { aberto: true, abre: '08:00', fecha: '14:00' } : { aberto: true, abre: '07:00', fecha: '21:00' }]),
  ) as Empresa['funcionamento'];
  return {
    ...e,
    razaoSocial: 'Supermercado Vila Esperança Ltda. (FICTÍCIA)',
    cnpj: '00.000.000/0001-00',
    porte: 'DEMAIS',
    ramo: 'Comércio varejista — supermercado de bairro',
    atividadeContinua: true,
    prestaServicoPoderPublico: false,
    sindicato: 'Sindicato dos Empregados no Comércio de Vila Esperança (fictício)',
    convencaoAplicavel: 'CCT Comerciários 2026/2027',
    responsavelDP: 'Paula Cristina Dias',
    funcionamento: func,
    config: { ...e.config, acordoAmpliaJornadaEtapa1: 'nao_sei', acordoRegimeCompensatorio: 'nao_sei' },
  };
}

export function instrumentosExemplo(): Instrumento[] {
  const agora = agoraISO();
  return [
    {
      id: 'ex-cct',
      tipo: 'CCT',
      nome: 'CCT Comerciários 2026/2027 (fictícia)',
      sindicato: 'Sindicato dos Empregados no Comércio de Vila Esperança (fictício)',
      vigenciaInicio: '2026-05-01',
      vigenciaFim: '2027-04-30',
      observacoes: 'Exemplo para demonstração.',
      criadoEm: agora,
      atualizadoEm: agora,
      clausulas: [
        { id: 'c20', numero: '20', titulo: 'Duração do trabalho', texto: 'A jornada normal será de 44 horas semanais.', tipo: 'jornada_semanal', parametros: { jornadaSemanalMin: h(44) }, avaliacaoManual: null, observacao: '' },
        { id: 'c21', numero: '21', titulo: 'Compensação do sábado', texto: 'Fica autorizada a prorrogação da jornada diária até 8h48 para compensar o sábado não trabalhado.', tipo: 'jornada_diaria', parametros: { jornadaDiariaMin: h(8, 48) }, avaliacaoManual: null, observacao: '' },
        { id: 'c22', numero: '22', titulo: 'Escala de revezamento', texto: 'Os empregados poderão trabalhar em escala 6x1, com folga dominical ao menos a cada 3 semanas.', tipo: 'escala', parametros: { diasTrabalhoSemana: 6, domingoFolgaACadaSemanas: 3, regimeCompensatorioExcepcional: false }, avaliacaoManual: null, observacao: '' },
        { id: 'c23', numero: '23', titulo: 'Banco de horas', texto: 'As horas excedentes poderão ser compensadas no prazo de até 12 meses.', tipo: 'banco_horas', parametros: { prazoBancoMeses: 12 }, avaliacaoManual: null, observacao: '' },
        { id: 'c24', numero: '24', titulo: 'Jornada 12x36', texto: 'Para vigias e seguranças é permitida a jornada de 12 horas seguidas por 36 de descanso.', tipo: 'regime_12x36', parametros: {}, avaliacaoManual: null, observacao: '' },
        { id: 'c25', numero: '25', titulo: 'Trabalho aos domingos', texto: 'O repouso semanal deverá coincidir com o domingo ao menos uma vez a cada 3 semanas.', tipo: 'domingos', parametros: { domingoFolgaACadaSemanas: 3 }, avaliacaoManual: null, observacao: '' },
      ],
    },
    {
      id: 'ex-acordo-ind',
      tipo: 'acordo_individual_compensacao',
      nome: 'Acordo de compensação do sábado — Administrativo',
      sindicato: '',
      vigenciaInicio: '2021-01-04',
      vigenciaFim: '',
      observacoes: 'Natália Gomes trabalha 8h48 de segunda a sexta para não trabalhar aos sábados.',
      criadoEm: agora,
      atualizadoEm: agora,
      clausulas: [
        { id: 'i1', numero: '1', titulo: 'Compensação semanal', texto: 'Jornada de 8h48 de segunda a sexta-feira, sem trabalho aos sábados.', tipo: 'jornada_diaria', parametros: { jornadaDiariaMin: h(8, 48) }, avaliacaoManual: null, observacao: '' },
      ],
    },
  ];
}

function demanda(semana: number, sabado: number, domingo: number) {
  return { dom: domingo, seg: semana, ter: semana, qua: semana, qui: semana, sex: semana, sab: sabado };
}

export function coberturasExemplo(): CoberturaSetor[] {
  const agora = agoraISO();
  return [
    {
      id: 'Caixa',
      setor: 'Caixa',
      salarioReferencia: 1850,
      atualizadoEm: agora,
      turnos: [
        { id: 'cx-m', nome: 'Manhã', inicio: '07:00', fim: '16:00', intervaloMin: 60, demanda: demanda(2, 2, 2) },
        { id: 'cx-t', nome: 'Tarde', inicio: '12:00', fim: '21:00', intervaloMin: 60, demanda: demanda(2, 2, 0) },
      ],
    },
    {
      id: 'Reposição',
      setor: 'Reposição',
      salarioReferencia: 1750,
      atualizadoEm: agora,
      turnos: [{ id: 'rp-m', nome: 'Manhã', inicio: '06:00', fim: '15:00', intervaloMin: 60, demanda: demanda(3, 3, 1) }],
    },
  ];
}

/** Apaga tudo e carrega a empresa de exemplo. */
export async function carregarExemplo(banco: BancoJornada = dbPadrao): Promise<void> {
  await apagarTudo(banco);
  await banco.transaction('rw', [banco.empresa, banco.funcionarios, banco.instrumentos, banco.coberturas], async () => {
    await banco.empresa.put(empresaExemplo());
    await banco.funcionarios.bulkPut(funcionariosExemplo());
    await banco.instrumentos.bulkPut(instrumentosExemplo());
    await banco.coberturas.bulkPut(coberturasExemplo());
  });
}
