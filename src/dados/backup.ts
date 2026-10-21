/** Exportar/importar todos os dados em JSON. */
import { REGRAS } from '../config/regras-ec141';
import { type BancoJornada, db as dbPadrao, TABELAS } from './db';
import { type Backup, backupSchema, mensagensDeErro } from './esquemas';

export const VERSAO_BACKUP = 1;

export async function gerarBackup(banco: BancoJornada = dbPadrao): Promise<Backup> {
  const [empresa, funcionarios, instrumentos, coberturas, escalas, checklist, tarefas] = await Promise.all([
    banco.empresa.toArray(),
    banco.funcionarios.toArray(),
    banco.instrumentos.toArray(),
    banco.coberturas.toArray(),
    banco.escalas.toArray(),
    banco.checklist.toArray(),
    banco.tarefas.toArray(),
  ]);
  return {
    app: 'jornada-5x2',
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    versaoRegras: REGRAS.versaoRegras,
    dados: { empresa, funcionarios, instrumentos, coberturas, escalas, checklist, tarefas },
  };
}

export type ResultadoValidacao = { ok: true; backup: Backup } | { ok: false; erros: string[] };

export function validarBackup(conteudo: unknown): ResultadoValidacao {
  let dados = conteudo;
  if (typeof conteudo === 'string') {
    try {
      dados = JSON.parse(conteudo);
    } catch {
      return { ok: false, erros: ['O arquivo não é um JSON válido.'] };
    }
  }
  const r = backupSchema.safeParse(dados);
  if (!r.success) return { ok: false, erros: mensagensDeErro(r.error) };
  if (r.data.versao > VERSAO_BACKUP) {
    return { ok: false, erros: ['Este backup foi gerado por uma versão mais nova do assistente. Atualize o site.'] };
  }
  return { ok: true, backup: r.data };
}

/** Substitui TODOS os dados atuais pelos do backup (em uma única transação). */
export async function restaurarBackup(backup: Backup, banco: BancoJornada = dbPadrao): Promise<void> {
  await banco.transaction('rw', TABELAS.map((t) => banco.table(t)), async () => {
    for (const t of TABELAS) await banco.table(t).clear();
    const d = backup.dados;
    await banco.empresa.bulkPut(d.empresa);
    await banco.funcionarios.bulkPut(d.funcionarios);
    await banco.instrumentos.bulkPut(d.instrumentos);
    await banco.coberturas.bulkPut(d.coberturas);
    await banco.escalas.bulkPut(d.escalas);
    await banco.checklist.bulkPut(d.checklist);
    await banco.tarefas.bulkPut(d.tarefas);
  });
}

export async function apagarTudo(banco: BancoJornada = dbPadrao): Promise<void> {
  await banco.transaction('rw', TABELAS.map((t) => banco.table(t)), async () => {
    for (const t of TABELAS) await banco.table(t).clear();
  });
}

export function nomeArquivoBackup(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `jornada5x2-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
