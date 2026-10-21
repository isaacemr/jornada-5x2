import { useLiveQuery } from 'dexie-react-hooks';
import { ITENS_CHECKLIST_PONTO, type ItemChecklistDef } from '../../config/checklist-ponto';
import { db } from '../../dados/db';
import { agoraISO } from '../../dados/padroes';
import { BotaoLink } from '../../componentes/ui/Botao';
import { BarraProgresso, CabecalhoPagina, Carregando, Cartao } from '../../componentes/ui/Basicos';

export default function ChecklistPonto() {
  const estados = useLiveQuery(() => db.checklist.toArray(), []);
  if (!estados) return <Carregando />;
  const porId = new Map(estados.map((e) => [e.id, e]));
  const feitos = ITENS_CHECKLIST_PONTO.filter((i) => porId.get(i.id)?.feito).length;
  const grupos = [...new Set(ITENS_CHECKLIST_PONTO.map((i) => i.grupo))];

  const alternar = (item: ItemChecklistDef, feito: boolean) =>
    db.checklist.put({ id: item.id, feito, feitoEm: feito ? agoraISO() : null, observacao: porId.get(item.id)?.observacao ?? '' });
  const anotar = (item: ItemChecklistDef, observacao: string) =>
    db.checklist.put({ id: item.id, feito: porId.get(item.id)?.feito ?? false, feitoEm: porId.get(item.id)?.feitoEm ?? null, observacao });

  return (
    <>
      <CabecalhoPagina
        titulo="Checklist do ponto, eSocial e folha"
        descricao="Marque cada item quando concluído. O progresso fica salvo neste navegador."
        acoes={<BotaoLink to="/contratos" variante="secundario">Voltar a contratos</BotaoLink>}
      />
      <Cartao className="mb-5">
        <BarraProgresso valor={(feitos / ITENS_CHECKLIST_PONTO.length) * 100} rotulo={`${feitos} de ${ITENS_CHECKLIST_PONTO.length} itens concluídos`} />
      </Cartao>
      <div className="space-y-5">
        {grupos.map((g) => (
          <Cartao key={g} titulo={g}>
            <ul className="divide-y divide-slate-200">
              {ITENS_CHECKLIST_PONTO.filter((i) => i.grupo === g).map((i) => {
                const e = porId.get(i.id);
                return (
                  <li key={i.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <input
                        id={`chk-${i.id}`}
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0 accent-marca-700"
                        checked={!!e?.feito}
                        onChange={(ev) => void alternar(i, ev.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`chk-${i.id}`} className={`font-medium ${e?.feito ? 'text-slate-600 line-through' : ''}`}>
                          {i.texto}
                        </label>
                        {i.detalhe && <p className="text-sm text-slate-700">{i.detalhe}</p>}
                        {e?.feito && e.feitoEm && <p className="text-xs text-marca-800">Feito em {new Date(e.feitoEm).toLocaleDateString('pt-BR')}</p>}
                        <label className="mt-1 block text-sm">
                          <span className="sr-only">Anotação para: {i.texto}</span>
                          <input
                            className="campo-input !py-1 text-sm"
                            placeholder="Anotação (opcional)"
                            defaultValue={e?.observacao ?? ''}
                            onBlur={(ev) => ev.target.value !== (e?.observacao ?? '') && void anotar(i, ev.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        ))}
      </div>
    </>
  );
}
