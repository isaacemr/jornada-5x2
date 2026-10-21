import { Link } from 'react-router-dom';
import { avaliarInstrumento, resumoAvaliacoes, situacaoVigencia } from '../../dominio/clausulas';
import { formatarData } from '../../dominio/tempo';
import { NOME_TIPO_INSTRUMENTO } from '../../dominio/tipos';
import { useContexto, useInstrumentos } from '../../hooks/useDados';
import { BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao, Selo } from '../../componentes/ui/Basicos';

const VIGENCIA = {
  vigente: { texto: 'Vigente', cor: 'verde' },
  vencido: { texto: 'Vencido', cor: 'vermelho' },
  futuro: { texto: 'Ainda não vigente', cor: 'azul' },
  sem_data: { texto: 'Sem vigência informada', cor: 'cinza' },
} as const;

export default function ListaAcordos() {
  const instrumentos = useInstrumentos();
  const { empresa, hoje } = useContexto();
  const N = empresa?.config.domingoFolgaACadaSemanas ?? 4;
  if (!instrumentos) return <Carregando />;

  return (
    <>
      <CabecalhoPagina
        titulo="Acordos e convenções coletivas"
        descricao="Cadastre os instrumentos em vigor e veja quais cláusulas de jornada continuam válidas, perdem eficácia ou precisam ser revistas."
        acoes={
          <>
            <BotaoLink to="/acordos/novo">Novo instrumento</BotaoLink>
            <BotaoLink to="/acordos/pauta" variante="secundario">
              Gerar pauta para o sindicato
            </BotaoLink>
          </>
        }
      />
      <Alerta tipo="info" className="mb-4">
        Pela EC 141/2026, cláusulas incompatíveis com os novos limites <strong>perdem eficácia</strong>. A avaliação automática é um ponto de partida: a decisão
        final deve ser tomada com o sindicato e/ou advogado.
      </Alerta>
      {instrumentos.length === 0 ? (
        <Cartao>
          <p className="mb-3">Nenhum instrumento cadastrado.</p>
          <BotaoLink to="/acordos/novo">Cadastrar convenção ou acordo</BotaoLink>
        </Cartao>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {instrumentos.map((i) => {
            const r = resumoAvaliacoes(avaliarInstrumento(i, N));
            const v = VIGENCIA[situacaoVigencia(i, hoje)];
            return (
              <li key={i.id}>
                <Cartao
                  titulo={
                    <Link to={`/acordos/${i.id}`} className="text-marca-800 underline">
                      {i.nome || '(sem nome)'}
                    </Link>
                  }
                  descricao={`${NOME_TIPO_INSTRUMENTO[i.tipo]}${i.sindicato ? ` · ${i.sindicato}` : ''}`}
                >
                  <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <Selo cor={v.cor}>{v.texto}</Selo>
                    {i.vigenciaInicio && <span>de {formatarData(i.vigenciaInicio)}</span>}
                    {i.vigenciaFim && <span>até {formatarData(i.vigenciaFim)}</span>}
                  </p>
                  <p className="flex flex-wrap gap-2 text-sm">
                    <Selo cor="verde">{r.compativel} compatível(is)</Selo>
                    <Selo cor="vermelho">{r.incompativel} incompatível(is)</Selo>
                    <Selo cor="amarelo">{r.revisar} a revisar</Selo>
                  </p>
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
