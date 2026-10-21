import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../dados/db';
import { calcularPrazos, etapaVigente, limitesDaEtapa, perfilDaEmpresa } from '../dominio/etapas';
import { hojeISO } from '../dominio/tempo';
import type { Empresa, Funcionario, Instrumento } from '../dominio/tipos';

const CARREGANDO = 'carregando' as const;

/** Empresa cadastrada; `null` se ainda não existe; `undefined` enquanto carrega. */
export function useEmpresa(): Empresa | null | undefined {
  const r = useLiveQuery(async () => (await db.empresa.get('principal')) ?? null, [], CARREGANDO);
  return r === CARREGANDO ? undefined : r;
}

export function useFuncionarios(): Funcionario[] | undefined {
  return useLiveQuery(() => db.funcionarios.orderBy('nome').toArray(), []);
}

export function useInstrumentos(): Instrumento[] | undefined {
  return useLiveQuery(() => db.instrumentos.toArray(), []);
}

/** Data de hoje (atualiza à meia-noite) e prazos/limites da empresa. */
export function useContexto() {
  const empresa = useEmpresa();
  const hoje = useHoje();
  return useMemo(() => {
    const prazos = calcularPrazos(perfilDaEmpresa(empresa));
    const etapaHoje = etapaVigente(hoje, prazos);
    return { empresa, hoje, prazos, etapaHoje, limitesHoje: limitesDaEtapa(etapaHoje) };
  }, [empresa, hoje]);
}

export function useAgora(intervaloMs = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

/** Data de hoje 'AAAA-MM-DD'; re-renderiza a cada minuto, mas o valor só muda na virada do dia. */
export function useHoje(): string {
  useAgora(60_000);
  return hojeISO();
}
