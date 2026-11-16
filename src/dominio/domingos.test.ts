// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { REGRAS } from '../config/regras-ec141';
import { empresaExemplo, funcionariosExemplo } from '../dados/exemplo';
import { lerSexo } from '../dados/importacao';
import { dimensionarTurno, gerarRevezamento, limitesParaCobertura } from './cobertura';
import { contextoDiagnostico, diagnosticar } from './diagnostico';
import { cicloDomingos, domingoACadaSemanas, domingosDaEquipe, regraHomensPorRamo, textoRegraDomingo } from './domingos';
import { calcularPrazos } from './etapas';
import { proporcaoMulheres, sugerirEscala, validarLinha } from './escala';
import { FOLGA, type DiaSemana, type TurnoCobertura } from './tipos';

const dem = (semana: number, sab: number, dom: number): Record<DiaSemana, number> => ({ dom, seg: semana, ter: semana, qua: semana, qui: semana, sex: semana, sab });

describe('regra de folga aos domingos por sexo', () => {
  it('mulheres: a cada 2 semanas (CLT art. 386), mesmo que a regra da empresa seja mais longa', () => {
    expect(REGRAS.domingos.mulheres).toBe(2);
    expect(domingoACadaSemanas('F', 3)).toBe(2);
    expect(domingoACadaSemanas('F', 7)).toBe(2);
    // Regra da empresa mais favorável (todo domingo) vale também para elas.
    expect(domingoACadaSemanas('F', 1)).toBe(1);
  });

  it('homens e sexo não informado seguem a regra da empresa', () => {
    expect(domingoACadaSemanas('M', 3)).toBe(3);
    expect(domingoACadaSemanas(undefined, 7)).toBe(7);
  });

  it('sugere a regra dos homens pelo ramo: comércio 3, demais 7', () => {
    expect(regraHomensPorRamo('Comércio varejista — supermercado')).toBe(REGRAS.domingos.homensComercio);
    expect(regraHomensPorRamo('Loja de roupas')).toBe(3);
    expect(regraHomensPorRamo('Restaurante')).toBe(REGRAS.domingos.homensRegraGeral);
    expect(regraHomensPorRamo('')).toBe(7);
  });

  it('monta a equipe na proporção de mulheres e calcula o ciclo comum', () => {
    expect(domingosDaEquipe(5, 0.4, 3)).toEqual([2, 2, 3, 3, 3]);
    expect(domingosDaEquipe(4, 0, 7)).toEqual([7, 7, 7, 7]);
    expect(cicloDomingos([2, 3])).toBe(6);
    expect(cicloDomingos([2, 7])).toBe(14);
    expect(cicloDomingos([4])).toBe(4);
  });

  it('descreve a regra de uma pessoa ou de um grupo misto', () => {
    expect(textoRegraDomingo([3])).toBe('ao menos 1 domingo de folga a cada 3 semanas');
    expect(textoRegraDomingo([2, 2])).toMatch(/a cada 2 semanas \(domingo sim, domingo não\)/);
    const misto = textoRegraDomingo([3, 2, 3]);
    expect(misto).toMatch(/mulheres: a cada 2 semanas/);
    expect(misto).toMatch(/homens: a cada 3 semanas/);
  });
});

describe('revezamento e dimensionamento com mulheres', () => {
  it('cada mulher folga um domingo sim, outro não', () => {
    // 4 mulheres, 2 trabalham no domingo: as outras 2 folgam e trocam na semana seguinte.
    const r = gerarRevezamento({ pessoas: 4, demanda: dem(2, 2, 2), semanas: 4, domingoFolgaACadaSemanas: 3, domingoPorPessoa: [2, 2, 2, 2] });
    expect(r.totalDescoberto).toBe(0);
    expect(r.domingoOk).toBe(true);
    expect(r.maiorEsperaDomingo.every((x) => x <= 1)).toBe(true);
  });

  it('acusa quando não há gente para o revezamento quinzenal', () => {
    // 3 mulheres e 2 vagas no domingo: só 1 folga por domingo, mas elas precisam de 1,5.
    const r = gerarRevezamento({ pessoas: 3, demanda: dem(2, 2, 2), semanas: 4, domingoFolgaACadaSemanas: 3, domingoPorPessoa: [2, 2, 2] });
    expect(r.domingoOk).toBe(false);
    // A mesma equipe, só de homens no comércio (3 semanas), consegue.
    const h = gerarRevezamento({ pessoas: 3, demanda: dem(2, 2, 2), semanas: 3, domingoFolgaACadaSemanas: 3 });
    expect(h.domingoOk).toBe(true);
  });

  it('prioriza a folga de domingo de quem tem a regra mais curta', () => {
    // Só 1 folga por domingo: a mulher (2) não espera mais que 1 semana; os homens (7) esperam a vez.
    const apertado = gerarRevezamento({ pessoas: 4, demanda: dem(3, 3, 3), semanas: 14, domingoFolgaACadaSemanas: 7, domingoPorPessoa: [7, 7, 2, 7] });
    expect(apertado.maiorEsperaDomingo[2]).toBeLessThanOrEqual(1);
    // Com 2 folgas por domingo, todos ficam dentro da própria regra.
    const r = gerarRevezamento({ pessoas: 5, demanda: dem(3, 3, 3), semanas: 14, domingoFolgaACadaSemanas: 7, domingoPorPessoa: [7, 7, 2, 7, 7] });
    expect(r.maiorEsperaDomingo[2]).toBeLessThanOrEqual(1);
    expect(r.domingoOk).toBe(true);
  });

  it('equipe com mulheres precisa de mais gente para cobrir o domingo', () => {
    const t: TurnoCobertura = { id: 't', nome: 'Caixa', inicio: '08:00', fim: '14:00', intervaloMin: 15, demanda: { ...dem(0, 0, 3) } };
    const L = limitesParaCobertura(1, false);
    // Só homens no comércio: 3 / (1 − 1/3) = 4,5 → 5.
    expect(dimensionarTurno(t, L, 3, 0).minimoPorDomingo).toBe(5);
    // Só mulheres: 3 / (1 − 1/2) = 6.
    expect(dimensionarTurno(t, L, 3, 1).minimoPorDomingo).toBe(6);
    const misto = dimensionarTurno(t, L, 3, 0.5);
    expect(misto.minimoPorDomingo).toBeGreaterThanOrEqual(5);
    expect(misto.minimoPorDomingo).toBeLessThanOrEqual(6);
  });

  it('escala sugerida do Caixa (exemplo) respeita a regra de cada pessoa', () => {
    const caixa = funcionariosExemplo().filter((f) => f.setor === 'Caixa');
    expect(proporcaoMulheres(caixa)).toBeGreaterThan(0);
    const turnos: TurnoCobertura[] = [
      { id: 'm', nome: 'Manhã', inicio: '07:00', fim: '16:00', intervaloMin: 60, demanda: dem(2, 2, 1) },
      { id: 'tt', nome: 'Tarde', inicio: '12:00', fim: '21:00', intervaloMin: 60, demanda: dem(1, 2, 0) },
    ];
    const L = limitesParaCobertura(1, false);
    const linhas = sugerirEscala(caixa, turnos, 6, 3, L);
    for (const l of linhas) {
      const f = caixa.find((x) => x.id === l.funcionarioId)!;
      const n = domingoACadaSemanas(f.sexo, 3);
      const avisos = validarLinha(l.celulas, turnos, L, n, '2026-12-13').filter((p) => p.codigo === 'DOMINGO' && p.severidade !== 'info');
      expect(avisos, `${f.nome} (${f.sexo})`).toHaveLength(0);
    }
  });

  it('a validação da escala avisa a mulher que trabalha 2 domingos seguidos', () => {
    const t = { id: 'm', nome: 'Manhã', inicio: '08:00', fim: '14:00', intervaloMin: 15 };
    const semana = ['m', 'm', 'm', 'm', 'm', 'F', 'F'];
    const celulas = [...semana, ...semana].map((c) => (c === 'F' ? FOLGA : c));
    const L = limitesParaCobertura(1, false);
    expect(validarLinha(celulas, [t], L, 2, '2026-12-13').some((p) => p.codigo === 'DOMINGO' && p.severidade === 'aviso')).toBe(true);
    expect(validarLinha(celulas, [t], L, 3, '2026-12-13').some((p) => p.codigo === 'DOMINGO' && p.severidade === 'aviso')).toBe(false);
    // Para mulheres o montador trata como erro: a regra não admite exceção.
    expect(validarLinha(celulas, [t], L, 2, '2026-12-13', 'erro').some((p) => p.codigo === 'DOMINGO' && p.severidade === 'erro')).toBe(true);
  });
});

describe('diagnóstico e importação', () => {
  const ctx = contextoDiagnostico(calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: false }), empresaExemplo().config);

  it('o exemplo é comércio: homens a cada 3 semanas', () => {
    expect(empresaExemplo().config.domingoFolgaACadaSemanas).toBe(3);
  });

  it('mulher que trabalha aos domingos: revezamento quinzenal (CLT art. 386)', () => {
    const ana = funcionariosExemplo().find((f) => f.nome.startsWith('Ana Paula'))!;
    expect(ana.sexo).toBe('F');
    const d = diagnosticar(ana, ctx);
    expect(d.motivos.find((m) => m.codigo === 'DOMINGO')?.texto).toMatch(/quinzenal.*a cada 2 semanas.*CLT art\. 386/);
  });

  it('homem: regra da empresa; sem sexo informado, pede para completar o cadastro', () => {
    const bruno = funcionariosExemplo().find((f) => f.nome.startsWith('Bruno'))!;
    expect(diagnosticar(bruno, ctx).motivos.find((m) => m.codigo === 'DOMINGO')?.texto).toMatch(/a cada 3 semanas/);
    const semSexo = diagnosticar({ ...bruno, sexo: undefined }, ctx);
    expect(semSexo.motivos.some((m) => m.codigo === 'SEXO_NAO_INFORMADO')).toBe(true);
  });

  it('lê o sexo da planilha', () => {
    expect(lerSexo('F')).toBe('F');
    expect(lerSexo('Feminino')).toBe('F');
    expect(lerSexo(' masculino ')).toBe('M');
    expect(lerSexo('')).toBeUndefined();
    expect(lerSexo('x')).toBe('invalido');
  });
});
