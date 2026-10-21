import { useEffect, useState } from 'react';
import { REGRAS } from '../../config/regras-ec141';
import { db } from '../../dados/db';
import { empresaSchema, mensagensDeErro } from '../../dados/esquemas';
import { agoraISO, empresaPadrao } from '../../dados/padroes';
import { PORTES_PEQUENOS } from '../../dominio/etapas';
import { formatarData } from '../../dominio/tempo';
import { DIAS_SEMANA, NOME_DIA, type Empresa as TEmpresa, type SimNaoNaoSei } from '../../dominio/tipos';
import { useEmpresa } from '../../hooks/useDados';
import { Botao } from '../../componentes/ui/Botao';
import { Alerta, CabecalhoPagina, Carregando, Cartao } from '../../componentes/ui/Basicos';
import { CampoCheckbox, CampoSelect, CampoTexto, GrupoRadio } from '../../componentes/ui/Campos';

const SIM_NAO_SEI: { valor: SimNaoNaoSei; texto: string }[] = [
  { valor: 'sim', texto: 'Sim' },
  { valor: 'nao', texto: 'Não' },
  { valor: 'nao_sei', texto: 'Não sei / em negociação' },
];

/** Converte '50' → 0.5; vazio → null. */
function lerPercentual(v: string): number | null {
  const t = v.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n / 100 : null;
}
const mostrarPercentual = (v: number | null) => (v === null ? '' : String(Math.round(v * 10000) / 100));

export default function Empresa() {
  const salva = useEmpresa();
  const [form, setForm] = useState<TEmpresa | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (salva !== undefined && form === null) setForm(salva ?? empresaPadrao());
  }, [salva, form]);

  if (!form) return <Carregando />;

  const set = <K extends keyof TEmpresa>(k: K, v: TEmpresa[K]) => {
    setForm({ ...form, [k]: v });
    setSalvo(false);
  };
  const setConfig = <K extends keyof TEmpresa['config']>(k: K, v: TEmpresa['config'][K]) => {
    setForm({ ...form, config: { ...form.config, [k]: v } });
    setSalvo(false);
  };
  const pequena = PORTES_PEQUENOS.includes(form.porte);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados = { ...form!, atualizadoEm: agoraISO() };
    const r = empresaSchema.safeParse(dados);
    if (!r.success) {
      setErros(mensagensDeErro(r.error));
      return;
    }
    setErros([]);
    await db.empresa.put(dados);
    setForm(dados);
    setSalvo(true);
  }

  return (
    <form onSubmit={salvar} noValidate>
      <CabecalhoPagina
        titulo="Dados da empresa"
        descricao="Essas informações definem seus prazos e quais exceções da EC 141/2026 se aplicam."
        acoes={<Botao type="submit">Salvar</Botao>}
      />
      {erros.length > 0 && (
        <Alerta tipo="erro" titulo="Corrija os campos abaixo" vivo className="mb-4">
          <ul className="list-disc pl-5">{erros.map((x) => <li key={x}>{x}</li>)}</ul>
        </Alerta>
      )}
      {salvo && (
        <Alerta tipo="sucesso" vivo className="mb-4">
          Dados salvos.
        </Alerta>
      )}

      <div className="space-y-5">
        <Cartao titulo="Identificação">
          <div className="grid gap-4 md:grid-cols-2">
            <CampoTexto rotulo="Razão social ou nome" value={form.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} />
            <CampoTexto rotulo="CNPJ (opcional)" value={form.cnpj} inputMode="numeric" onChange={(e) => set('cnpj', e.target.value)} />
            <CampoSelect
              rotulo="Porte"
              value={form.porte}
              onChange={(e) => set('porte', e.target.value as TEmpresa['porte'])}
              opcoes={[
                { valor: 'MEI', texto: 'MEI — Microempreendedor individual' },
                { valor: 'ME', texto: 'ME — Microempresa' },
                { valor: 'EPP', texto: 'EPP — Empresa de pequeno porte' },
                { valor: 'DEMAIS', texto: 'Demais (média ou grande)' },
              ]}
            />
            <CampoTexto rotulo="Ramo de atividade" placeholder="Ex.: comércio varejista, restaurante, clínica" value={form.ramo} onChange={(e) => set('ramo', e.target.value)} />
            <CampoTexto rotulo="Responsável pelo departamento pessoal" value={form.responsavelDP} onChange={(e) => set('responsavelDP', e.target.value)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <GrupoRadio
              legenda="A atividade é contínua (funciona todos os dias ou em horários estendidos)?"
              dica="Ex.: comércio, restaurantes, saúde, segurança, indústria em turnos."
              nome="continua"
              valor={form.atividadeContinua ? 'sim' : 'nao'}
              opcoes={[{ valor: 'sim', texto: 'Sim' }, { valor: 'nao', texto: 'Não' }]}
              onChange={(v) => set('atividadeContinua', v === 'sim')}
            />
            <GrupoRadio
              legenda="Presta serviço terceirizado à administração pública?"
              dica={`Se sim, há prazo especial até ${formatarData(REGRAS.excecoes.terceirizadaAdministracaoPublica.prazoEtapa1)} para esses contratos.`}
              nome="publico"
              valor={form.prestaServicoPoderPublico ? 'sim' : 'nao'}
              opcoes={[{ valor: 'sim', texto: 'Sim' }, { valor: 'nao', texto: 'Não' }]}
              onChange={(v) => set('prestaServicoPoderPublico', v === 'sim')}
            />
          </div>
          {pequena && (
            <Alerta tipo="aviso" className="mt-4" titulo="MEI, ME e EPP: regulamentação pendente">
              <p>
                A EC 141/2026 prevê que lei complementar pode criar uma transição própria para pequenas empresas. Enquanto ela não sai,
                usamos as datas gerais. Se a lei sair, informe aqui as novas datas.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CampoTexto
                  rotulo="Início da etapa 1 para minha empresa"
                  type="date"
                  value={form.config.transicaoPequenas.inicioEtapa1 ?? ''}
                  onChange={(e) => setConfig('transicaoPequenas', { ...form.config.transicaoPequenas, inicioEtapa1: e.target.value || null })}
                  dica={`Vazio = data geral (${formatarData(REGRAS.etapa1.inicio)})`}
                />
                <CampoTexto
                  rotulo="Início da etapa 2 para minha empresa"
                  type="date"
                  value={form.config.transicaoPequenas.inicioEtapa2 ?? ''}
                  onChange={(e) => setConfig('transicaoPequenas', { ...form.config.transicaoPequenas, inicioEtapa2: e.target.value || null })}
                  dica={`Vazio = data geral (${formatarData(REGRAS.etapa2.inicio)})`}
                />
              </div>
            </Alerta>
          )}
        </Cartao>

        <Cartao titulo="Sindicato e convenção coletiva" descricao="A convenção ou o acordo coletivo pode abrir exceções importantes na transição.">
          <div className="grid gap-4 md:grid-cols-2">
            <CampoTexto rotulo="Sindicato dos empregados" value={form.sindicato} onChange={(e) => set('sindicato', e.target.value)} />
            <CampoTexto rotulo="Convenção/acordo coletivo aplicável" placeholder="Ex.: CCT Comerciários 2026/2027" value={form.convencaoAplicavel} onChange={(e) => set('convencaoAplicavel', e.target.value)} />
          </div>
          <div className="mt-4 space-y-4">
            <GrupoRadio
              legenda="A convenção/acordo coletivo permite jornada diária acima de 8 h durante a etapa 1 (ex.: 8h24 por dia)?"
              nome="amplia"
              valor={form.config.acordoAmpliaJornadaEtapa1}
              opcoes={SIM_NAO_SEI}
              onChange={(v) => setConfig('acordoAmpliaJornadaEtapa1', v)}
            />
            <GrupoRadio
              legenda="A convenção/acordo coletivo prevê regime compensatório diferente da 5x2 (ex.: manter 6x1 respeitando os novos limites)?"
              nome="compensatorio"
              valor={form.config.acordoRegimeCompensatorio}
              opcoes={SIM_NAO_SEI}
              onChange={(v) => setConfig('acordoRegimeCompensatorio', v)}
            />
          </div>
        </Cartao>

        <Cartao titulo="Dias e horário de funcionamento">
          <div className="space-y-2">
            {DIAS_SEMANA.map((d) => {
              const f = form.funcionamento[d];
              const setDia = (v: Partial<typeof f>) => set('funcionamento', { ...form.funcionamento, [d]: { ...f, ...v } });
              return (
                <div key={d} className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[8rem_8rem_1fr_1fr]">
                  <span className="font-medium">{NOME_DIA[d]}</span>
                  <CampoCheckbox rotulo="Aberto" checked={f.aberto} onChange={(e) => setDia({ aberto: e.target.checked })} />
                  <CampoTexto
                    className="col-span-1"
                    rotulo={<span className="sr-only sm:not-sr-only">Abre às</span>}
                    aria-label={`${NOME_DIA[d]} — abre às`}
                    type="time"
                    disabled={!f.aberto}
                    value={f.abre}
                    onChange={(e) => setDia({ abre: e.target.value })}
                  />
                  <CampoTexto
                    rotulo={<span className="sr-only sm:not-sr-only">Fecha às</span>}
                    aria-label={`${NOME_DIA[d]} — fecha às`}
                    type="time"
                    disabled={!f.aberto}
                    value={f.fecha}
                    onChange={(e) => setDia({ fecha: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        </Cartao>

        <Cartao titulo="Parâmetros de cálculo" descricao="Valores padrão conforme a CLT. Ajuste se a sua convenção prevê outros.">
          <div className="grid gap-4 sm:grid-cols-3">
            {([44, 42, 40] as const).map((hs) => (
              <CampoTexto
                key={hs}
                rotulo={`Divisor mensal para ${hs} h semanais`}
                type="number"
                min={1}
                inputMode="decimal"
                value={form.config.divisores[hs]}
                onChange={(e) => setConfig('divisores', { ...form.config.divisores, [hs]: Number(e.target.value) })}
                dica={`Padrão: ${REGRAS.divisores.porHorasSemanais[hs]}`}
              />
            ))}
            <CampoTexto
              rotulo="Adicional de hora extra (%)"
              type="number"
              min={0}
              inputMode="decimal"
              value={mostrarPercentual(form.config.adicionalHoraExtra)}
              onChange={(e) => setConfig('adicionalHoraExtra', lerPercentual(e.target.value) ?? 0)}
              dica="Mínimo constitucional: 50%"
            />
            <CampoTexto
              rotulo="Adicional em domingos e feriados (%)"
              type="number"
              min={0}
              inputMode="decimal"
              value={mostrarPercentual(form.config.adicionalDomingoFeriado)}
              onChange={(e) => setConfig('adicionalDomingoFeriado', lerPercentual(e.target.value) ?? 0)}
              dica="Usual: 100%"
            />
            <CampoTexto
              rotulo="Encargos sobre salário (%)"
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Preencha com seu contador"
              value={mostrarPercentual(form.config.encargosPercentual)}
              onChange={(e) => setConfig('encargosPercentual', lerPercentual(e.target.value))}
              dica="Usado para estimar o custo de contratar. Varia com o regime tributário."
            />
            <CampoTexto
              rotulo="Folga aos domingos: ao menos 1 a cada quantas semanas?"
              type="number"
              min={1}
              max={52}
              value={form.config.domingoFolgaACadaSemanas}
              onChange={(e) => setConfig('domingoFolgaACadaSemanas', Math.max(1, Math.round(Number(e.target.value) || 1)))}
              dica={`Padrão da ferramenta: ${REGRAS.domingos.folgaACadaSemanasPadrao}. No comércio, a Lei 10.101/2000 prevê ${REGRAS.domingos.referenciaComercio}.`}
            />
          </div>
        </Cartao>

        <div className="flex justify-end">
          <Botao type="submit">Salvar dados da empresa</Botao>
        </div>
      </div>
    </form>
  );
}
