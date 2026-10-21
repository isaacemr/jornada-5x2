import type { Diagnostico } from '../dominio/diagnostico';
import { formatarData, formatarDuracao } from '../dominio/tempo';
import { Alerta, SeloStatus, severidadeParaAlerta } from './ui/Basicos';

const EXPLICACAO = {
  adequado: 'Nada a ajustar na jornada.',
  ajustar_etapa1: 'Precisa ajustar até a etapa 1.',
  ajustar_etapa2: 'Pode continuar na etapa 1, mas precisa ajustar até a etapa 2.',
  depende_acordo: 'A jornada só pode continuar se houver convenção/acordo coletivo que permita.',
} as const;

export function DiagnosticoDetalhe({ diag }: { diag: Diagnostico }) {
  return (
    <div aria-live="polite">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SeloStatus status={diag.status} />
        <span className="text-sm text-slate-700">
          {EXPLICACAO[diag.status]}
          {diag.prazo && <> Prazo: <strong>{formatarData(diag.prazo)}</strong>.</>}
        </span>
      </div>
      <p className="mb-3 text-sm text-slate-700">
        Analisando a {diag.base === 'nova' ? 'nova grade definida' : 'jornada atual'}: {formatarDuracao(diag.semanalConsideradoMin)} por semana,
        maior dia com {formatarDuracao(diag.maxDiarioConsideradoMin)}, {diag.diasTrabalhados} dias de trabalho.
      </p>
      <ul className="space-y-2">
        {diag.motivos.map((m, i) => (
          <li key={`${m.codigo}-${i}`}>
            <Alerta tipo={diag.status === 'adequado' && m.codigo === 'OK' ? 'sucesso' : severidadeParaAlerta(m.severidade)}>{m.texto}</Alerta>
          </li>
        ))}
      </ul>
    </div>
  );
}
