// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FAQ, RESUMO } from '../config/faq';
import { REGRAS } from '../config/regras-ec141';
import { empresaExemplo, funcionariosExemplo } from '../dados/exemplo';
import { gradeUniforme } from '../dados/padroes';
import { pdfPlano } from '../exportacao/plano';
import { calcularPrazos } from './etapas';
import { diaDoMesSeguinte, gerarTarefasAuto, mesclarTarefas, situacaoTarefa, type EntradaPlano } from './planoAcao';
import type { Tarefa } from './tipos';

const prazos = calcularPrazos({ porte: 'DEMAIS', prestaServicoPoderPublico: false });
const base: EntradaPlano = {
  empresa: empresaExemplo(),
  funcionarios: funcionariosExemplo(),
  escalas: [],
  prazos,
};

describe('plano de ação', () => {
  it('gera tarefas com prazos antes de cada etapa', () => {
    const t = gerarTarefasAuto(base);
    const ids = t.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['auto:empresa', 'auto:jornadas', 'auto:aditivos', 'auto:ponto', 'auto:esocial1', 'auto:planejar2']));
    const aditivos = t.find((x) => x.id === 'auto:aditivos')!;
    expect(aditivos.prazo < prazos.inicioEtapa1).toBe(true);
    expect(t.filter((x) => x.etapa === 'etapa2').every((x) => x.prazo >= '2027-09-01')).toBe(true);
  });

  it('só aponta para telas que existem no assistente', () => {
    const rotas = new Set(['/empresa', '/funcionarios', '/jornada', '/escala', '/escala/cobertura', '/entenda']);
    const p = calcularPrazos({ porte: 'EPP', prestaServicoPoderPublico: true });
    const t = gerarTarefasAuto({ ...base, prazos: p, empresa: { ...empresaExemplo(), porte: 'EPP', prestaServicoPoderPublico: true } });
    for (const x of t) if (x.rota) expect(rotas.has(x.rota)).toBe(true);
  });

  it('detecta tarefas já cumpridas pelo estado', () => {
    const t = gerarTarefasAuto(base);
    expect(t.find((x) => x.id === 'auto:empresa')!.cumpridaAuto).toBe(true);
    expect(t.find((x) => x.id === 'auto:funcionarios')!.cumpridaAuto).toBe(true);
    expect(t.find((x) => x.id === 'auto:jornadas')!.cumpridaAuto).toBe(false);
    expect(t.find((x) => x.id === 'auto:jornadas')!.titulo).toMatch(/15 funcionário/);
  });

  it('atividade contínua inclui cobertura; acordo indefinido inclui negociação com sindicato', () => {
    const ids = gerarTarefasAuto(base).map((x) => x.id);
    expect(ids).toContain('auto:cobertura');
    expect(ids).toContain('auto:sindicato');
  });

  it('nova jornada para todos marca a tarefa como cumprida', () => {
    const nova = gradeUniforme(['seg', 'ter', 'qua', 'qui', 'sex'], '08:00', '17:00', 60);
    const t = gerarTarefasAuto({ ...base, funcionarios: base.funcionarios.map((f) => ({ ...f, gradeNova: nova })) });
    expect(t.find((x) => x.id === 'auto:jornadas')!.cumpridaAuto).toBe(true);
    expect(t.find((x) => x.id === 'auto:planejar2')!.cumpridaAuto).toBe(true);
  });


  it('terceirizada pública e pequena empresa geram tarefas próprias', () => {
    const p = calcularPrazos({ porte: 'EPP', prestaServicoPoderPublico: true });
    const t = gerarTarefasAuto({ ...base, prazos: p, empresa: { ...empresaExemplo(), porte: 'EPP', prestaServicoPoderPublico: true } });
    expect(t.some((x) => x.etapa === 'terceirizada' && x.prazo === '2027-10-16')).toBe(true);
    expect(t.some((x) => x.id === 'auto:lei-complementar')).toBe(true);
  });

  it('eSocial: dia 15 do mês seguinte', () => {
    expect(diaDoMesSeguinte('2026-12-16', 15)).toBe('2027-01-15');
    expect(diaDoMesSeguinte('2027-12-16', 15)).toBe('2028-01-15');
  });

  it('mescla alterações do usuário e tarefas manuais, ordenando por prazo', () => {
    const auto = gerarTarefasAuto(base);
    const salvas: Tarefa[] = [
      { ...auto[0], responsavel: 'Maria', concluida: false, oculta: true },
      { id: 'm1', titulo: 'Reunião', descricao: '', responsavel: 'João', prazo: '2026-11-01', etapa: 'etapa1', origem: 'manual', concluida: false, concluidaEm: null, oculta: false },
    ];
    const r = mesclarTarefas(auto, salvas);
    const empresa = r.find((x) => x.id === auto[0].id)!;
    expect(empresa.responsavel).toBe('Maria');
    expect(empresa.oculta).toBe(true);
    expect(empresa.concluida).toBe(false);
    expect(r.some((x) => x.id === 'm1')).toBe(true);
    expect(r.map((x) => x.prazo)).toEqual([...r.map((x) => x.prazo)].sort());
  });

  it('situação: atrasada, próxima, futura, concluída', () => {
    const t = { prazo: '2026-11-01', concluida: false } as Tarefa;
    expect(situacaoTarefa(t, '2026-11-02')).toBe('atrasada');
    expect(situacaoTarefa(t, '2026-10-25')).toBe('proxima');
    expect(situacaoTarefa(t, '2026-10-01')).toBe('futura');
    expect(situacaoTarefa({ ...t, concluida: true }, '2026-12-01')).toBe('concluida');
  });

  it('exporta PDF', async () => {
    const b = await pdfPlano(gerarTarefasAuto(base), prazos, 'Empresa', '2026-10-21');
    expect(b.size).toBeGreaterThan(2000);
  });
});

describe('textos da página Entenda', () => {
  it('usam as datas e limites do arquivo de regras', () => {
    const tudo = [...RESUMO.map((r) => r.texto + r.titulo), ...FAQ.flatMap((f) => f.resposta)].join(' ');
    expect(tudo).toMatch(/16\/12\/2026/);
    expect(tudo).toMatch(/16\/12\/2027/);
    expect(tudo).toMatch(/16\/10\/2027/);
    expect(tudo).toMatch(new RegExp(`${REGRAS.divisores.porHorasSemanais[42]}`));
    expect(tudo).toMatch(/R\$\s?10,00/);
  });
});
