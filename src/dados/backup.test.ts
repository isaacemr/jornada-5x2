import { afterEach, describe, expect, it } from 'vitest';
import { apagarTudo, gerarBackup, restaurarBackup, validarBackup } from './backup';
import { BancoJornada } from './db';
import { carregarExemplo, funcionariosExemplo } from './exemplo';

let banco: BancoJornada;
const novoBanco = () => (banco = new BancoJornada(`teste-${Math.random()}`));

afterEach(async () => {
  await banco?.delete();
});

describe('backup', () => {
  it('exporta e restaura todos os dados (ida e volta)', async () => {
    novoBanco();
    await carregarExemplo(banco);
    const b = await gerarBackup(banco);
    expect(b.dados.funcionarios).toHaveLength(funcionariosExemplo().length);
    expect(b.dados.empresa).toHaveLength(1);

    const json = JSON.stringify(b);
    await apagarTudo(banco);
    expect(await banco.funcionarios.count()).toBe(0);

    const v = validarBackup(json);
    expect(v.ok).toBe(true);
    if (v.ok) await restaurarBackup(v.backup, banco);
    expect(await banco.funcionarios.count()).toBe(b.dados.funcionarios.length);
    expect(await banco.instrumentos.count()).toBe(b.dados.instrumentos.length);
    expect((await banco.empresa.get('principal'))?.razaoSocial).toMatch(/FICTÍCIA/);
  });

  it('rejeita JSON inválido', () => {
    const v = validarBackup('{ não é json');
    expect(v.ok).toBe(false);
  });

  it('rejeita arquivo de outro aplicativo', () => {
    const v = validarBackup({ app: 'outro', versao: 1, dados: {} });
    expect(v.ok).toBe(false);
  });

  it('rejeita funcionário com dados inválidos e explica o campo', () => {
    const f = { ...funcionariosExemplo()[0], salario: -1 };
    const v = validarBackup({
      app: 'jornada-5x2',
      versao: 1,
      exportadoEm: new Date().toISOString(),
      dados: { empresa: [], funcionarios: [f] },
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.erros.join(' ')).toMatch(/salario/);
  });

  it('rejeita backup de versão futura', () => {
    const v = validarBackup({ app: 'jornada-5x2', versao: 999, exportadoEm: '', dados: { empresa: [], funcionarios: [] } });
    expect(v.ok).toBe(false);
  });
});
