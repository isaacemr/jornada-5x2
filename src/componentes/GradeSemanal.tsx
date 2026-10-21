import { useId } from 'react';
import { resumirDia, resumirGrade, type ResultadoValidacao } from '../dominio/jornada';
import { formatarDuracao } from '../dominio/tempo';
import { DIAS_SEMANA, NOME_DIA, type DiaJornada, type DiaSemana, type GradeSemanal } from '../dominio/tipos';
import { Alerta, severidadeParaAlerta } from './ui/Basicos';
import { Botao } from './ui/Botao';

interface Props {
  grade: GradeSemanal;
  onChange: (g: GradeSemanal) => void;
  /** Resultado de validarGrade para mostrar alertas em tempo real. */
  validacao?: ResultadoValidacao;
  legenda?: string;
  somenteLeitura?: boolean;
  mensagemValida?: string;
}

const DIAS_UTEIS: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex'];

export function EditorGradeSemanal({
  grade,
  onChange,
  validacao,
  legenda = 'Horários da semana',
  somenteLeitura,
  mensagemValida = 'Grade válida para a etapa escolhida.',
}: Props) {
  const id = useId();
  const resumo = validacao?.resumo ?? resumirGrade(grade);
  const setDia = (d: DiaSemana, v: Partial<DiaJornada>) => onChange({ ...grade, [d]: { ...grade[d], ...v } });

  const copiarSegunda = () => {
    const base = grade.seg;
    const g = { ...grade };
    for (const d of DIAS_UTEIS) g[d] = { ...base };
    onChange(g);
  };

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-base font-semibold">{legenda}</legend>
      <div className="overflow-x-auto">
        <table className="tabela min-w-[36rem]">
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Trabalha?</th>
              <th scope="col">Entrada</th>
              <th scope="col">Saída</th>
              <th scope="col">Intervalo (min)</th>
              <th scope="col" className="text-right">Trabalhado</th>
            </tr>
          </thead>
          <tbody>
            {DIAS_SEMANA.map((d) => {
              const dia = grade[d];
              const r = resumirDia(d, grade);
              const desab = somenteLeitura || !dia.trabalha;
              return (
                <tr key={d} className={dia.trabalha ? '' : 'bg-slate-50 text-slate-600'}>
                  <th scope="row" className="!bg-transparent !border-b !border-slate-200 font-medium">
                    {NOME_DIA[d]}
                  </th>
                  <td>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-marca-700"
                      checked={dia.trabalha}
                      disabled={somenteLeitura}
                      aria-label={`${NOME_DIA[d]}: trabalha`}
                      onChange={(e) => setDia(d, { trabalha: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="campo-input !py-1"
                      value={dia.entrada}
                      disabled={desab}
                      aria-label={`${NOME_DIA[d]}: entrada`}
                      onChange={(e) => setDia(d, { entrada: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="campo-input !py-1"
                      value={dia.saida}
                      disabled={desab}
                      aria-label={`${NOME_DIA[d]}: saída`}
                      onChange={(e) => setDia(d, { saida: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      inputMode="numeric"
                      className="campo-input w-24 !py-1"
                      value={dia.intervaloMin}
                      disabled={desab}
                      aria-label={`${NOME_DIA[d]}: intervalo em minutos`}
                      onChange={(e) => setDia(d, { intervaloMin: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    />
                  </td>
                  <td className="text-right font-medium tabular-nums">
                    {dia.trabalha ? (r.valido ? formatarDuracao(r.trabalhadoMin) : <span className="text-red-700">inválido</span>) : 'Folga'}
                    {r.viraMeiaNoite && dia.trabalha && <span className="block text-xs text-slate-600">vira a noite</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={5} className="!bg-white text-right">
                Total semanal · {resumo.diasTrabalhados} dias de trabalho, {resumo.diasFolga} de folga
              </th>
              <td className="text-right text-base font-bold tabular-nums">{formatarDuracao(resumo.totalSemanalMin)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!somenteLeitura && (
        <div className="mt-2">
          <Botao variante="fantasma" tamanho="pequeno" onClick={copiarSegunda}>
            Copiar horário de segunda para segunda a sexta
          </Botao>
        </div>
      )}
      {validacao && (
        <div id={`${id}-alertas`} aria-live="polite" className="mt-3 space-y-2">
          {validacao.problemas.length === 0 ? (
            <Alerta tipo="sucesso">{mensagemValida}</Alerta>
          ) : (
            validacao.problemas.map((p, i) => (
              <Alerta key={`${p.codigo}-${i}`} tipo={severidadeParaAlerta(p.severidade)}>
                {p.texto}
              </Alerta>
            ))
          )}
        </div>
      )}
    </fieldset>
  );
}
