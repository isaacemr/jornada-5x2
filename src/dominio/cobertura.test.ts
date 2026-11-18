import { describe, expect, it } from 'vitest';
import { funcionariosExemplo } from '../dados/exemplo';
import {
  alocarPessoas,
  calcularCobertura,
  dimensionarTurno,
  duracaoTrabalhadaTurno,
  gerarRevezamento,
  limitesParaCobertura,
} from './cobertura';
import { agruparPorTurno, aplicarTurnoNaLinha, contarCobertura, domingoDaSemana, rotulosColunas, sugerirEscala, turnosPorSetor, validarLinha } from './escala';
import { FOLGA, type DiaSemana, type TurnoCobertura } from './tipos';

const dem = (semana: number, sab: number, dom: number): Record<DiaSemana, number> => ({ dom, seg: semana, ter: semana, qua: semana, qui: semana, sex: semana, sab });
const turno = (d: Record<DiaSemana, number>, inicio = '07:00', fim = '16:24'): TurnoCobertura => ({ id: 't1', nome: 'Manhã', inicio, fim, intervaloMin: 60, demanda: d });
const L1 = limitesParaCobertura(1, false);
const L2 = limitesParaCobertura(2, false);

describe('revezamento de folgas', () => {
  it('cada pessoa tem 2 folgas por semana e a demanda é coberta', () => {
    const r = gerarRevezamento({ pessoas: 6, demanda: dem(4, 4, 2), semanas: 4, domingoFolgaACadaSemanas: 4 });
    for (const sem of r.trabalha) for (const pessoa of sem) expect(pessoa.filter((x) => !x).length).toBe(2);
    expect(r.totalDescoberto).toBe(0);
  });

  it('todos folgam ao menos 1 domingo a cada N semanas', () => {
    const r = gerarRevezamento({ pessoas: 6, demanda: dem(4, 4, 3), semanas: 4, domingoFolgaACadaSemanas: 4 });
    expect(r.domingoOk).toBe(true);
    for (const espera of r.maiorEsperaDomingo) expect(espera).toBeLessThanOrEqual(3);
  });

  it('acusa descoberto quando faltam pessoas', () => {
    const r = gerarRevezamento({ pessoas: 3, demanda: dem(3, 3, 3), semanas: 1, domingoFolgaACadaSemanas: 4 });
    expect(r.totalDescoberto).toBeGreaterThan(0);
  });

  it('dia sem operação conta como folga para todos', () => {
    const r = gerarRevezamento({ pessoas: 3, demanda: dem(2, 2, 0), semanas: 2, domingoFolgaACadaSemanas: 4 });
    for (const sem of r.trabalha) for (const p of sem) {
      expect(p[0]).toBe(false);
      expect(p.filter((x) => !x).length).toBe(2);
    }
    expect(r.domingoOk).toBe(true);
  });

  it('sem folga possível no domingo quando todos são necessários', () => {
    const r = gerarRevezamento({ pessoas: 2, demanda: dem(1, 1, 2), semanas: 4, domingoFolgaACadaSemanas: 4 });
    expect(r.domingoOk).toBe(false);
  });
});

describe('dimensionamento', () => {
  it('turno de 8h24 seg–sáb com 2 pessoas e domingo com 2: precisa de pessoas para domingos e folgas', () => {
    const t = turno(dem(2, 2, 2));
    expect(duracaoTrabalhadaTurno(t)).toBe(504);
    const d = dimensionarTurno(t, { ...L1, limiteDiarioMin: 600 }, 4);
    expect(d.vagasSemana).toBe(14);
    expect(d.minimoPorCarga).toBe(3);
    expect(d.minimoPorDomingo).toBe(3);
    expect(d.pessoasNecessarias).toBeGreaterThanOrEqual(3);
    const r = gerarRevezamento({ pessoas: d.pessoasNecessarias, demanda: t.demanda, semanas: 4, domingoFolgaACadaSemanas: 4 });
    expect(r.totalDescoberto).toBe(0);
    expect(r.domingoOk).toBe(true);
  });

  it('alerta turno acima do limite diário', () => {
    const d = dimensionarTurno(turno(dem(1, 1, 0), '07:00', '17:00'), L2, 4);
    expect(d.alertas.join(' ')).toMatch(/limite diário/);
  });

  it('turno longo reduz os dias por pessoa para respeitar o limite semanal', () => {
    const d = dimensionarTurno(turno(dem(1, 1, 1), '07:00', '17:00'), { ...L2, limiteDiarioMin: 600 }, 4);
    expect(d.diasPorPessoa).toBe(4); // 9h x 4 = 36h ≤ 40h; 9h x 5 = 45h
  });

  it('N = 1 (todo domingo de folga) gera alerta', () => {
    const d = dimensionarTurno(turno(dem(1, 1, 1)), L1, 1);
    expect(d.alertas.join(' ')).toMatch(/todos os domingos/);
  });
});

describe('alocação proporcional', () => {
  it('divide pelos maiores restos', () => {
    expect(alocarPessoas(5, [3, 3])).toEqual([3, 2]);
    expect(alocarPessoas(6, [3, 3])).toEqual([3, 3]);
    expect(alocarPessoas(8, [3, 3])).toEqual([4, 4]);
    expect(alocarPessoas(0, [3, 3])).toEqual([0, 0]);
    expect(alocarPessoas(4, [0, 0])).toEqual([0, 0]);
  });
});

describe('cálculo completo e custos', () => {
  const base = {
    turnos: [turno(dem(2, 3, 2)), { ...turno(dem(2, 3, 0), '12:36', '21:00'), id: 't2', nome: 'Tarde' }],
    limites: { ...L1, limiteDiarioMin: 600 },
    domingoFolgaACadaSemanas: 4,
    custo: { salarioReferencia: 2100, encargosPercentual: null, divisor: 210, adicionalHoraExtra: 0.5, adicionalDomingo: 1 },
  };

  it('com equipe insuficiente mostra lacuna e custos', () => {
    const r = calcularCobertura({ ...base, pessoasAtuais: 4 });
    expect(r.faltam).toBeGreaterThan(0);
    expect(r.horasDescobertasSemana).toBeGreaterThan(0);
    const contratar = r.alternativas.find((a) => a.id === 'contratar')!;
    expect(contratar.custoMensal).toBe(r.faltam * 2100);
    expect(contratar.observacoes[0]).toMatch(/Encargos não informados/);
    const he = r.alternativas.find((a) => a.id === 'hora_extra')!;
    expect(he.custoMensal).toBeGreaterThan(0);
    expect(r.alternativas.find((a) => a.id === 'banco_horas')!.viavel).toBe(false);
  });

  it('inclui encargos quando informados', () => {
    const r = calcularCobertura({ ...base, pessoasAtuais: 4, custo: { ...base.custo, encargosPercentual: 0.7 } });
    expect(r.alternativas[0].custoMensal).toBeCloseTo(r.faltam * 2100 * 1.7, 2);
  });

  it('com equipe suficiente não há lacuna', () => {
    const necessario = calcularCobertura({ ...base, pessoasAtuais: 0 }).pessoasNecessarias;
    const r = calcularCobertura({ ...base, pessoasAtuais: necessario });
    expect(r.faltam).toBe(0);
    expect(r.horasDescobertasSemana).toBe(0);
    expect(r.alternativas.find((a) => a.id === 'hora_extra')!.custoMensal).toBe(0);
  });
});

describe('montador de escala', () => {
  const t1 = { id: 'm', nome: 'Manhã', inicio: '07:00', fim: '16:00', intervaloMin: 60 };
  const t2 = { id: 'n', nome: 'Noite', inicio: '22:00', fim: '06:00', intervaloMin: 60 };
  const M = 'm';

  it('linha 5x2 válida não tem erros', () => {
    const celulas = [FOLGA, M, M, M, M, M, FOLGA];
    expect(validarLinha(celulas, [t1], L1, 4, '2026-12-13').filter((p) => p.severidade === 'erro')).toHaveLength(0);
  });

  it('acusa só 1 folga e excesso semanal', () => {
    const celulas = [FOLGA, M, M, M, M, M, M];
    const cod = validarLinha(celulas, [t1], L1, 4, '2026-12-13').map((p) => p.codigo);
    expect(cod).toEqual(expect.arrayContaining(['FOLGAS', 'SEMANAL']));
  });

  it('acusa interjornada curta (noite → manhã)', () => {
    const celulas = [FOLGA, 'n', M, FOLGA, M, M, M];
    expect(validarLinha(celulas, [t1, t2], L1, 4, '2026-12-13').map((p) => p.codigo)).toContain('INTERJORNADA');
  });

  it('avisa domingos seguidos de trabalho', () => {
    const semana = [M, M, M, M, M, FOLGA, FOLGA];
    const celulas = [...semana, ...semana, ...semana, ...semana];
    expect(validarLinha(celulas, [t1], L1, 4, '2026-12-13').map((p) => p.codigo)).toContain('DOMINGO');
  });

  it('conta cobertura e gera rótulos de colunas', () => {
    expect(contarCobertura([{ celulas: [M, FOLGA] }, { celulas: [M, M] }], M, 2)).toEqual([2, 1]);
    expect(rotulosColunas('2026-12-13', 1)[0]).toBe('Dom 13/12');
    expect(domingoDaSemana('2026-12-16')).toBe('2026-12-13');
  });

  it('troca o turno dos dias trabalhados e mantém as folgas', () => {
    expect(aplicarTurnoNaLinha([FOLGA, 'm', 'm', 't', FOLGA], 't')).toEqual([FOLGA, 't', 't', 't', FOLGA]);
  });

  it('lista os turnos de cada setor: escala montada tem prioridade sobre a calculadora', () => {
    const manha = { id: 'm', nome: 'Manhã', inicio: '07:00', fim: '15:00', intervaloMin: 60 };
    const tarde = { id: 't', nome: 'Tarde', inicio: '13:00', fim: '21:00', intervaloMin: 60 };
    const m = turnosPorSetor([{ setor: 'Caixa', turnos: [tarde] }], [
      { setor: 'Caixa', turnos: [{ ...manha, demanda: dem(1, 1, 1) }] },
      { setor: 'Padaria', turnos: [{ ...manha, demanda: dem(1, 1, 1) }] },
    ]);
    expect(m.get('Caixa')).toEqual([tarde]);
    expect(m.get('Padaria')).toEqual([manha]);
    expect(m.has('Açougue')).toBe(false);
  });

  it('a escala sugerida respeita o turno escolhido no cadastro', () => {
    const caixa = funcionariosExemplo().filter((f) => f.setor === 'Caixa');
    const turnos: TurnoCobertura[] = [
      { ...t1, demanda: dem(2, 2, 1) },
      { id: 'tt', nome: 'Tarde', inicio: '12:36', fim: '21:00', intervaloMin: 60, demanda: dem(1, 2, 0) },
    ];
    const L = { ...L1, limiteDiarioMin: 600 };
    // Ana entra mais cedo e iria para a manhã; no cadastro ela foi posta na tarde.
    const equipe = caixa.map((f, i) => (i === 0 ? { ...f, turnoId: 'tt' } : f));
    const linhas = sugerirEscala(equipe, turnos, 4, 3, L);
    expect(linhas).toHaveLength(caixa.length);
    const ana = linhas.find((l) => l.funcionarioId === caixa[0].id)!;
    const trabalhados = ana.celulas.filter((c) => c !== FOLGA);
    expect(trabalhados.length).toBeGreaterThan(0);
    expect(trabalhados.every((c) => c === 'tt')).toBe(true);
    // Turno que não existe no setor: volta ao automático.
    const outro = sugerirEscala(caixa.map((f, i) => (i === 0 ? { ...f, turnoId: 'nao-existe' } : f)), turnos, 4, 3, L);
    expect(outro.find((l) => l.funcionarioId === caixa[0].id)!.celulas.filter((c) => c !== FOLGA).every((c) => c === 'm')).toBe(true);
  });

  it('agrupa as pessoas pelo turno em que mais trabalham na semana', () => {
    const manha = { id: 'm', nome: 'Manhã', inicio: '07:00', fim: '15:00', intervaloMin: 60 };
    const tarde = { id: 't', nome: 'Tarde', inicio: '13:00', fim: '21:00', intervaloMin: 60 };
    const F = FOLGA;
    const linhas = [
      { celulas: [F, 't', 't', 't', 'm', 'm', F, /* semana 2 */ 'm', 'm', 'm', 'm', 'm', F, F] },
      { celulas: [F, 'm', 'm', 'm', 'm', 'm', F, /* semana 2 */ F, F, F, F, F, F, F] },
      { celulas: [F, 'm', 'm', 't', 't', F, F, /* semana 2 */ 't', 't', 't', 't', 't', F, F] },
    ];
    const s1 = agruparPorTurno(linhas, [manha, tarde], 0);
    expect(s1.map((g) => [g.turno?.nome, g.itens.map((i) => i.li)])).toEqual([
      ['Manhã', [1, 2]], // empate 2×2 vai para o turno que vem primeiro
      ['Tarde', [0]],
    ]);
    const s2 = agruparPorTurno(linhas, [manha, tarde], 1);
    expect(s2.map((g) => [g.turno?.nome ?? 'folga', g.itens.map((i) => i.li)])).toEqual([
      ['Manhã', [0]],
      ['Tarde', [2]],
      ['folga', [1]],
    ]);
  });

  it('sugere escala para o setor Caixa do exemplo sem erros de folga', () => {
    const caixa = funcionariosExemplo().filter((f) => f.setor === 'Caixa');
    const turnos: TurnoCobertura[] = [
      { ...t1, demanda: dem(2, 2, 1) },
      { id: 'tt', nome: 'Tarde', inicio: '12:36', fim: '21:00', intervaloMin: 60, demanda: dem(1, 2, 0) },
    ];
    const L = { ...L1, limiteDiarioMin: 600 };
    const linhas = sugerirEscala(caixa, turnos, 4, 4, L);
    expect(linhas).toHaveLength(caixa.length);
    for (const l of linhas) {
      expect(l.celulas).toHaveLength(28);
      const erros = validarLinha(l.celulas, turnos, L, 4, '2026-12-13').filter((p) => p.codigo === 'FOLGAS');
      expect(erros).toHaveLength(0);
    }
    // Quem entra mais cedo fica no turno da manhã.
    const ana = linhas.find((l) => l.funcionarioId === caixa[0].id)!;
    expect(ana.celulas.filter((c) => c !== FOLGA).every((c) => c === 'm')).toBe(true);
  });
});
