import { novoId } from '../dados/padroes';
import { duracaoTrabalhadaTurno } from '../dominio/cobertura';
import { formatarDuracao, horarioValido } from '../dominio/tempo';
import { DIAS_SEMANA, NOME_DIA_CURTO, type DiaSemana, type TurnoBase, type TurnoCobertura } from '../dominio/tipos';
import { Botao } from './ui/Botao';

export const CORES_TURNO = [
  'bg-sky-100 text-sky-950 border-sky-700',
  'bg-amber-100 text-amber-950 border-amber-700',
  'bg-violet-100 text-violet-950 border-violet-700',
  'bg-teal-100 text-teal-950 border-teal-700',
  'bg-rose-100 text-rose-950 border-rose-700',
];
export const CORES_TURNO_ARGB = ['FFE0F2FE', 'FFFEF3C7', 'FFEDE9FE', 'FFCCFBF1', 'FFFFE4E6'];
export const corTurno = (i: number) => CORES_TURNO[i % CORES_TURNO.length];

export function novoTurno(comDemanda: true): TurnoCobertura;
export function novoTurno(comDemanda: false): TurnoBase;
export function novoTurno(comDemanda: boolean): TurnoBase | TurnoCobertura {
  const base: TurnoBase = { id: novoId(), nome: 'Novo turno', inicio: '08:00', fim: '17:00', intervaloMin: 60 };
  if (!comDemanda) return base;
  return { ...base, demanda: Object.fromEntries(DIAS_SEMANA.map((d) => [d, d === 'dom' ? 0 : 1])) as Record<DiaSemana, number> };
}

interface Props<T extends TurnoBase> {
  turnos: T[];
  onChange: (t: T[]) => void;
  comDemanda: boolean;
  /** Cria um turno do tipo certo. */
  criar: () => T;
}

/** Edita a lista de turnos (e, opcionalmente, quantas pessoas são necessárias em cada dia). */
export function EditorTurnos<T extends TurnoBase>({ turnos, onChange, comDemanda, criar }: Props<T>) {
  const set = (i: number, v: Partial<T>) => onChange(turnos.map((t, j) => (j === i ? { ...t, ...v } : t)));
  return (
    <div className="space-y-3">
      {turnos.map((t, i) => {
        const valido = horarioValido(t.inicio) && horarioValido(t.fim);
        const dur = valido ? duracaoTrabalhadaTurno(t) : 0;
        return (
          <fieldset key={t.id} className={`rounded-md border-l-4 border border-slate-200 p-3 ${corTurno(i).split(' ').find((c) => c.startsWith('border-'))}`}>
            <legend className="sr-only">Turno {t.nome}</legend>
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_7rem_auto] sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Nome do turno</span>
                <input className="campo-input" value={t.nome} onChange={(e) => set(i, { nome: e.target.value } as Partial<T>)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Início</span>
                <input type="time" className="campo-input" value={t.inicio} onChange={(e) => set(i, { inicio: e.target.value } as Partial<T>)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Fim</span>
                <input type="time" className="campo-input" value={t.fim} onChange={(e) => set(i, { fim: e.target.value } as Partial<T>)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Intervalo (min)</span>
                <input
                  type="number"
                  min={0}
                  className="campo-input"
                  value={t.intervaloMin}
                  onChange={(e) => set(i, { intervaloMin: Math.max(0, Number(e.target.value) || 0) } as Partial<T>)}
                />
              </label>
              <Botao variante="fantasma" tamanho="pequeno" onClick={() => onChange(turnos.filter((_, j) => j !== i))} aria-label={`Remover turno ${t.nome}`}>
                Remover
              </Botao>
            </div>
            <p className="mt-1 text-sm text-slate-700">Trabalho efetivo: {valido ? formatarDuracao(dur) : '—'} por dia</p>
            {comDemanda && 'demanda' in t && (
              <div className="mt-2">
                <p className="mb-1 text-sm font-medium">Pessoas necessárias ao mesmo tempo neste turno</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DIAS_SEMANA.map((d) => (
                    <label key={d} className="text-center text-sm">
                      <span className="block">{NOME_DIA_CURTO[d]}</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        className="campo-input text-center"
                        value={(t as unknown as TurnoCobertura).demanda[d]}
                        onChange={(e) =>
                          set(i, {
                            demanda: { ...(t as unknown as TurnoCobertura).demanda, [d]: Math.max(0, Math.round(Number(e.target.value) || 0)) },
                          } as unknown as Partial<T>)
                        }
                        aria-label={`${t.nome} — pessoas na ${NOME_DIA_CURTO[d]}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        );
      })}
      <Botao variante="secundario" tamanho="pequeno" onClick={() => onChange([...turnos, criar()])}>
        + Adicionar turno
      </Botao>
    </div>
  );
}
