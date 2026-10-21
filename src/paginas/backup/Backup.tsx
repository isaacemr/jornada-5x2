import { useRef, useState } from 'react';
import { apagarTudo, gerarBackup, nomeArquivoBackup, restaurarBackup, validarBackup } from '../../dados/backup';
import type { Backup as TBackup } from '../../dados/esquemas';
import { carregarExemplo } from '../../dados/exemplo';
import { baixarTexto } from '../../exportacao/baixar';
import { useEmpresa, useFuncionarios } from '../../hooks/useDados';
import { AVISO_PRIVACIDADE } from '../../config/textos-juridicos';
import { Botao } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Cartao, Modal } from '../../componentes/ui/Basicos';

type Confirmacao = { tipo: 'restaurar'; backup: TBackup } | { tipo: 'exemplo' } | { tipo: 'apagar' } | null;

export default function Backup() {
  const empresa = useEmpresa();
  const funcionarios = useFuncionarios();
  const arquivo = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string; lista?: string[] } | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmacao>(null);
  const temDados = !!empresa || (funcionarios?.length ?? 0) > 0;

  async function exportar() {
    const b = await gerarBackup();
    baixarTexto(JSON.stringify(b, null, 2), nomeArquivoBackup(), 'application/json');
    setMsg({ tipo: 'sucesso', texto: `Backup gerado com ${b.dados.funcionarios.length} funcionário(s).` });
  }

  async function lerArquivo(f: File) {
    const r = validarBackup(await f.text());
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: 'Não foi possível ler o backup.', lista: r.erros });
      return;
    }
    setConfirmar({ tipo: 'restaurar', backup: r.backup });
  }

  async function executar() {
    if (!confirmar) return;
    try {
      if (confirmar.tipo === 'restaurar') {
        await restaurarBackup(confirmar.backup);
        setMsg({ tipo: 'sucesso', texto: `Backup restaurado: ${confirmar.backup.dados.funcionarios.length} funcionário(s).` });
      } else if (confirmar.tipo === 'exemplo') {
        await carregarExemplo();
        setMsg({ tipo: 'sucesso', texto: 'Dados de exemplo carregados (empresa fictícia).' });
      } else {
        await apagarTudo();
        setMsg({ tipo: 'sucesso', texto: 'Todos os dados deste navegador foram apagados.' });
      }
    } catch (e) {
      setMsg({ tipo: 'erro', texto: `Erro: ${(e as Error).message}` });
    }
    setConfirmar(null);
  }

  return (
    <>
      <CabecalhoPagina titulo="Backup e dados de exemplo" descricao={AVISO_PRIVACIDADE} />
      {msg && (
        <Alerta tipo={msg.tipo} vivo className="mb-4" titulo={msg.texto}>
          {msg.lista && <ul className="list-disc pl-5">{msg.lista.map((x) => <li key={x}>{x}</li>)}</ul>}
        </Alerta>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Cartao titulo="Salvar uma cópia (backup)" descricao="Gera um arquivo .json com todos os dados. Guarde em local seguro: ele contém dados pessoais dos funcionários.">
          <Botao onClick={exportar}>Baixar backup</Botao>
        </Cartao>
        <Cartao titulo="Restaurar backup" descricao="Substitui todos os dados atuais pelos do arquivo.">
          <input
            ref={arquivo}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Escolher arquivo de backup"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void lerArquivo(f);
              e.target.value = '';
            }}
          />
          <Botao variante="secundario" onClick={() => arquivo.current?.click()}>
            Escolher arquivo…
          </Botao>
        </Cartao>
        <Cartao titulo="Dados de exemplo" descricao="Carrega um supermercado fictício com 16 funcionários, a maioria em 6x1, que abre aos domingos.">
          <Botao variante="secundario" onClick={() => (temDados ? setConfirmar({ tipo: 'exemplo' }) : void carregarExemplo().then(() => setMsg({ tipo: 'sucesso', texto: 'Dados de exemplo carregados.' })))}>
            Carregar exemplo
          </Botao>
        </Cartao>
        <Cartao titulo="Apagar tudo" descricao="Remove todos os dados deste navegador. Não dá para desfazer — faça um backup antes.">
          <Botao variante="perigo" onClick={() => setConfirmar({ tipo: 'apagar' })} disabled={!temDados}>
            Apagar todos os dados
          </Botao>
        </Cartao>
      </div>

      <Modal aberto={!!confirmar} aoFechar={() => setConfirmar(null)} titulo="Confirmar">
        <p className="mb-4">
          {confirmar?.tipo === 'restaurar' &&
            `Restaurar o backup de ${new Date(confirmar.backup.exportadoEm).toLocaleString('pt-BR')} (${confirmar.backup.dados.funcionarios.length} funcionários)? Os dados atuais serão substituídos.`}
          {confirmar?.tipo === 'exemplo' && 'Carregar o exemplo apaga os dados atuais deste navegador. Deseja continuar?'}
          {confirmar?.tipo === 'apagar' && 'Apagar definitivamente todos os dados deste navegador?'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmar(null)}>
            Cancelar
          </Botao>
          <Botao variante={confirmar?.tipo === 'restaurar' ? 'primario' : 'perigo'} onClick={executar}>
            {confirmar?.tipo === 'restaurar' ? 'Restaurar' : confirmar?.tipo === 'exemplo' ? 'Apagar e carregar exemplo' : 'Apagar tudo'}
          </Botao>
        </div>
      </Modal>
    </>
  );
}
