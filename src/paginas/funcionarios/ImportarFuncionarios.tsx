import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../dados/db';
import { bufferXLSXModelo, converterLinhas, csvModelo, lerCSV, lerXLSX, type ResultadoImportacao } from '../../dados/importacao';
import { baixarBlob, baixarTexto } from '../../exportacao/baixar';
import { descreverGrade, resumirGrade } from '../../dominio/jornada';
import { formatarDuracao, formatarMoeda } from '../../dominio/tempo';
import { Botao, BotaoLink } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Cartao } from '../../componentes/ui/Basicos';
import { GrupoRadio } from '../../componentes/ui/Campos';

type Modo = 'mesclar' | 'substituir';

export default function ImportarFuncionarios() {
  const navegar = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [erroLeitura, setErroLeitura] = useState('');
  const [modo, setModo] = useState<Modo>('mesclar');
  const [processando, setProcessando] = useState(false);

  async function ler(arq: File) {
    setErroLeitura('');
    setResultado(null);
    setNomeArquivo(arq.name);
    setProcessando(true);
    try {
      const nome = arq.name.toLowerCase();
      const linhas = nome.endsWith('.xlsx') ? await lerXLSX(await arq.arrayBuffer()) : lerCSV(await arq.text());
      setResultado(converterLinhas(linhas));
    } catch (e) {
      setErroLeitura(`Não foi possível ler o arquivo: ${(e as Error).message}. Use o modelo em CSV ou XLSX.`);
    }
    setProcessando(false);
  }

  async function importar() {
    if (!resultado) return;
    const novos = resultado.funcionarios;
    await db.transaction('rw', db.funcionarios, async () => {
      if (modo === 'substituir') {
        await db.funcionarios.clear();
        await db.funcionarios.bulkPut(novos);
        return;
      }
      const existentes = await db.funcionarios.toArray();
      const chave = (m?: string, n?: string) => (m ? `m:${m}` : `n:${(n ?? '').trim().toLowerCase()}`);
      const mapa = new Map(existentes.map((e) => [chave(e.matricula, e.nome), e]));
      await db.funcionarios.bulkPut(
        novos.map((n) => {
          const atual = mapa.get(chave(n.matricula, n.nome));
          return atual ? { ...n, id: atual.id, criadoEm: atual.criadoEm, gradeNova: atual.gradeNova, vigenciaNovaGrade: atual.vigenciaNovaGrade } : n;
        }),
      );
    });
    navegar('/funcionarios');
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Importar funcionários"
        descricao="Envie uma planilha CSV ou XLSX. O arquivo é lido aqui mesmo no navegador — nada é enviado para a internet."
        acoes={<BotaoLink to="/funcionarios" variante="secundario">Voltar</BotaoLink>}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <Cartao titulo="1. Baixe o modelo" descricao="Preencha uma linha por funcionário. A aba “Instrucoes” (XLSX) explica cada coluna.">
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={async () => baixarBlob(new Blob([await bufferXLSXModelo()]), 'modelo-funcionarios-jornada5x2.xlsx')}>
              Modelo XLSX
            </Botao>
            <Botao variante="secundario" onClick={() => baixarTexto(csvModelo(), 'modelo-funcionarios-jornada5x2.csv', 'text/csv;charset=utf-8')}>
              Modelo CSV
            </Botao>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Horários no formato <code>08:00-17:00</code>; para outro intervalo naquele dia, <code>08:00-14:00/15</code>. Deixe em branco ou escreva
            “folga” nos dias de descanso.
          </p>
        </Cartao>
        <Cartao titulo="2. Envie o arquivo preenchido">
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Escolher planilha"
            onChange={(e) => {
              const a = e.target.files?.[0];
              if (a) void ler(a);
              e.target.value = '';
            }}
          />
          <Botao onClick={() => input.current?.click()} disabled={processando}>
            {processando ? 'Lendo…' : 'Escolher planilha…'}
          </Botao>
          {nomeArquivo && <p className="mt-2 text-sm text-slate-700">Arquivo: {nomeArquivo}</p>}
        </Cartao>
      </div>

      {erroLeitura && (
        <Alerta tipo="erro" vivo className="mt-5">
          {erroLeitura}
        </Alerta>
      )}

      {resultado && (
        <Cartao className="mt-5" titulo="3. Confira e importe">
          <p className="mb-3" aria-live="polite">
            <strong>{resultado.funcionarios.length}</strong> funcionário(s) prontos para importar
            {resultado.erros.length > 0 && <>, <strong className="text-red-700">{resultado.erros.length}</strong> linha(s) com erro (serão ignoradas)</>}.
          </p>

          {resultado.erros.length > 0 && (
            <Alerta tipo="erro" titulo="Linhas com erro" className="mb-3">
              <ul className="list-disc space-y-1 pl-5">
                {resultado.erros.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha} ({e.nome}): {e.erros.join(' ')}
                  </li>
                ))}
              </ul>
            </Alerta>
          )}
          {resultado.avisos.length > 0 && (
            <Alerta tipo="aviso" titulo="Avisos" className="mb-3">
              <ul className="list-disc space-y-1 pl-5">
                {resultado.avisos.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha} ({e.nome}): {e.erros.join(' ')}
                  </li>
                ))}
              </ul>
            </Alerta>
          )}

          {resultado.funcionarios.length > 0 && (
            <>
              <div className="mb-4 overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">Nome</th>
                      <th scope="col">Setor</th>
                      <th scope="col">Salário</th>
                      <th scope="col">Escala</th>
                      <th scope="col">Horários</th>
                      <th scope="col" className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.funcionarios.map((f) => (
                      <tr key={f.id}>
                        <td>{f.nome}</td>
                        <td>{f.setor}</td>
                        <td>{formatarMoeda(f.salario)}</td>
                        <td>{f.escalaAtual}</td>
                        <td className="text-sm">{descreverGrade(f.gradeAtual)}</td>
                        <td className="text-right tabular-nums">{formatarDuracao(resumirGrade(f.gradeAtual).totalSemanalMin || f.jornadaSemanalContratualMin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <GrupoRadio
                legenda="Como importar?"
                nome="modo"
                valor={modo}
                onChange={setModo}
                opcoes={[
                  { valor: 'mesclar', texto: 'Adicionar e atualizar (mesma matrícula ou nome)' },
                  { valor: 'substituir', texto: 'Substituir todos os funcionários atuais' },
                ]}
              />
              <Botao className="mt-4" onClick={importar}>
                Importar {resultado.funcionarios.length} funcionário(s)
              </Botao>
            </>
          )}
        </Cartao>
      )}
    </>
  );
}
