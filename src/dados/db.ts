/**
 * Banco local (IndexedDB via Dexie). Nenhum dado sai do navegador.
 * Ao mudar o esquema, crie uma nova `this.version(n)` com migração — nunca altere uma versão já publicada.
 */
import Dexie, { type Table } from 'dexie';
import type {
  CoberturaSetor,
  Empresa,
  EscalaSetor,
  EstadoChecklist,
  Funcionario,
  Instrumento,
  Tarefa,
} from '../dominio/tipos';

export class BancoJornada extends Dexie {
  empresa!: Table<Empresa, string>;
  funcionarios!: Table<Funcionario, string>;
  instrumentos!: Table<Instrumento, string>;
  coberturas!: Table<CoberturaSetor, string>;
  escalas!: Table<EscalaSetor, string>;
  checklist!: Table<EstadoChecklist, string>;
  tarefas!: Table<Tarefa, string>;

  constructor(nome = 'jornada5x2') {
    super(nome);
    this.version(1).stores({
      empresa: 'id',
      funcionarios: 'id, nome, setor, escalaAtual',
      instrumentos: 'id, tipo',
      coberturas: 'id',
      escalas: 'id, setor',
      checklist: 'id',
      tarefas: 'id, prazo, origem',
    });
  }
}

export const db = new BancoJornada();

export const TABELAS = [
  'empresa',
  'funcionarios',
  'instrumentos',
  'coberturas',
  'escalas',
  'checklist',
  'tarefas',
] as const;
export type NomeTabela = (typeof TABELAS)[number];
