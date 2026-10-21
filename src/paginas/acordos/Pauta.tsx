import { useMemo, useState } from 'react';
import { MARCA_MODELO_PAUTA } from '../../config/textos-juridicos';
import { gerarPauta, TOPICOS_PADRAO, type TopicosPauta } from '../../dominio/pauta';
import { baixarBlob } from '../../exportacao/baixar';
import { useContexto, useInstrumentos } from '../../hooks/useDados';
import { VisualizarDocumento } from '../../componentes/VisualizarDocumento';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao } from '../../componentes/ui/Basicos';
import { CampoArea, CampoCheckbox } from '../../componentes/ui/Campos';

const ROTULOS: Record<keyof TopicosPauta, string> = {
  distribuicao42h: 'Distribuição das 42 h na transição (jornada diária acima de 8 h)',
  regimeCompensatorio: 'Regime compensatório excepcional (diferente da 5x2)',
  bancoHoras: 'Banco de horas',
  domingos: 'Trabalho e folga aos domingos',
  clausulasIncompativeis: 'Cláusulas atuais incompatíveis ou a revisar',
};

export default function Pauta() {
  const { empresa, prazos, hoje } = useContexto();
  const instrumentos = useInstrumentos();
  const [topicos, setTopicos] = useState<TopicosPauta>(TOPICOS_PADRAO);
  const [obs, setObs] = useState('');
  const [gerando, setGerando] = useState(false);

  const blocos = useMemo(
    () =>
      gerarPauta({
        empresa: empresa ?? null,
        instrumentos: instrumentos ?? [],
        topicos,
        prazos,
        domingoACadaSemanas: empresa?.config.domingoFolgaACadaSemanas ?? 4,
        observacoes: obs,
        dataDocumento: hoje,
      }),
    [empresa, instrumentos, topicos, prazos, obs, hoje],
  );

  if (!instrumentos || empresa === undefined) return <Carregando />;

  async function baixar(tipo: 'docx' | 'pdf') {
    setGerando(true);
    try {
      const { blocosParaDocx, blocosParaPdf } = await import('../../exportacao/docx');
      const blob = tipo === 'docx' ? await blocosParaDocx([blocos], { marca: 'MODELO PARA REVISÃO', titulo: 'Pauta de negociação' }) : await blocosParaPdf([blocos], 'MODELO');
      baixarBlob(blob, `pauta-sindicato-ec141-MODELO.${tipo}`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Pauta para negociação com o sindicato"
        descricao="Gera um roteiro de negociação com propostas de redação. É um MODELO: revise com seu advogado ou contador antes de enviar."
        acoes={<BotaoLink to="/acordos" variante="secundario">Voltar</BotaoLink>}
      />
      <Alerta tipo="aviso" className="mb-4" titulo="Documento modelo">
        {MARCA_MODELO_PAUTA}
      </Alerta>
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-5">
          <Cartao titulo="Tópicos">
            <div className="space-y-3">
              {(Object.keys(ROTULOS) as (keyof TopicosPauta)[]).map((k) => (
                <CampoCheckbox key={k} rotulo={ROTULOS[k]} checked={topicos[k]} onChange={(e) => setTopicos({ ...topicos, [k]: e.target.checked })} />
              ))}
            </div>
          </Cartao>
          <Cartao titulo="Observações da empresa">
            <CampoArea rotulo="Texto livre (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} dica="Ex.: setores com maior dificuldade, propostas de contrapartida." />
          </Cartao>
          <Cartao titulo="Baixar">
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => void baixar('docx')} disabled={gerando}>
                Word (DOCX)
              </Botao>
              <Botao variante="secundario" onClick={() => void baixar('pdf')} disabled={gerando}>
                PDF
              </Botao>
            </div>
          </Cartao>
        </div>
        <section aria-label="Pré-visualização da pauta">
          <VisualizarDocumento blocos={blocos} marca="MODELO" />
        </section>
      </div>
    </>
  );
}
