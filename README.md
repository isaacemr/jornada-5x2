# Jornada 5x2 — Assistente de Adequação à EC 141/2026

Site para empresários e departamentos pessoais de pequenas e médias empresas adequarem a jornada dos funcionários à **Emenda Constitucional nº 141/2026** (escala 5x2, 42 h semanais na etapa 1 e 40 h na etapa 2, sem redução salarial).

> **Ferramenta de apoio; não substitui orientação jurídica/contábil. Confira o texto oficial da EC 141/2026 e sua convenção coletiva.**

- **100% no navegador:** nenhum dado de funcionário sai do computador. Os dados ficam no IndexedDB do navegador, com backup e restauração em JSON.
- **Funciona no celular**, com foco em acessibilidade (contraste AA, navegação por teclado, leitores de tela).
- **Todas as datas e limites legais** ficam em um único arquivo: [`src/config/regras-ec141.ts`](src/config/regras-ec141.ts).

## O que o assistente faz

| Módulo | Tela | Recursos |
|---|---|---|
| 0 | Painel | Contagem regressiva (16/12/2026, 16/12/2027 e, se for o caso, 16/10/2027); dados da empresa; % da equipe adequada às etapas 1 e 2 |
| 1 | Funcionários | Cadastro manual; importação CSV/XLSX com modelo para baixar; diagnóstico automático com o motivo de cada situação |
| 2 | Redistribuir jornada | Opções de grade para 42 h e 40 h; validação em tempo real (intervalo, interjornada, repousos); comparativo de valor-hora e hora extra com divisor configurável |
| 3 | Escala e cobertura | Calculadora de pessoas por turno com revezamento de folgas e domingos; lacuna em horas e custo das alternativas; montador visual com arrastar e soltar; exportação em PDF e XLSX |
| 4 | Acordos coletivos | Cadastro de instrumentos e cláusulas; checklist compatível / perde eficácia / revisar; pauta de negociação (DOCX/PDF) marcada como MODELO |
| 5 | Contratos e ponto | Termo aditivo por funcionário ou em lote (DOCX/PDF, marcado "MODELO — revisar antes de assinar"); checklist do ponto e do eSocial (S-2206); planilha de-para |
| 6 | Plano de ação | Tarefas automáticas com responsáveis e prazos, linha do tempo e PDF; página "Entenda a EC 141/2026" com perguntas frequentes |

Para conhecer o sistema, use **Backup e dados de exemplo → Carregar exemplo**. Ele carrega um supermercado **fictício** com 16 funcionários, a maioria em 6x1, que abre aos domingos.

## Uso no dia a dia (Windows)

Dê **dois cliques em `Abrir Jornada 5x2.bat`**. O arquivo prepara o site e abre o navegador em http://localhost:5173. O site fica disponível enquanto a janela preta estiver aberta; para encerrar, feche a janela.

Os dados ficam salvos no navegador **para aquele endereço**. Use sempre o mesmo navegador e o mesmo endereço (`http://localhost:5173`) e faça backups pela tela **Backup**.

Equivalente pelo terminal:

```bash
npm run site
```

## Como rodar (desenvolvimento)

Pré-requisito: [Node.js](https://nodejs.org) 20 ou mais recente (testado com o 24 LTS).

```bash
npm install
```

```bash
npm run dev
```

Depois, abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Roda todos os testes unitários (Vitest) |
| `npm run test:watch` | Testes em modo contínuo |
| `npm run typecheck` | Verifica os tipos TypeScript |
| `npm run build` | Gera o site final na pasta `dist/` |
| `npm run preview` | Serve a pasta `dist/` localmente para conferência |

## Publicar como site estático

O `npm run build` gera a pasta `dist/` com HTML, CSS e JS estáticos. Não há servidor nem banco de dados. O app usa rotas com `#` (ex.: `/#/funcionarios`) e caminhos relativos (`base: './'`), então funciona em **qualquer hospedagem estática**, inclusive em subpastas, sem configuração de redirecionamento.

- **Netlify / Cloudflare Pages / Vercel:** comando de build `npm run build`, pasta de publicação `dist`.
- **GitHub Pages:** publique o conteúdo de `dist/`, por exemplo com a action `actions/deploy-pages`, ou copiando-o para o branch `gh-pages`.
- **Hospedagem comum (cPanel, FTP, S3):** envie o conteúdo de `dist/` para a pasta pública.

Use HTTPS: o IndexedDB e o download de arquivos funcionam melhor em contexto seguro.

## Como atualizar as regras quando sair a regulamentação

Todas as datas, limites e parâmetros legais estão em **[`src/config/regras-ec141.ts`](src/config/regras-ec141.ts)**. Nenhuma tela tem números fixos: painel, diagnóstico, simulador, avaliação de cláusulas, pauta, aditivos, plano de ação e FAQ leem esse arquivo.

1. **Confira o texto oficial** (Diário Oficial da União / Planalto) e a regulamentação publicada.
2. **Edite o valor correspondente**. Exemplos:
   - nova data de início de etapa: `etapa1.inicio`, `etapa2.inicio`;
   - teto de jornada diária com acordo na etapa 1: `etapa1.limiteDiarioComAcordoMin` (em minutos; hoje 10 h, adotado por analogia ao art. 59 da CLT);
   - lei complementar de MEI/ME/EPP: troque `excecoes.meiMeEpp.status` para `'regulamentado'` e, se houver datas próprias, a empresa pode informá-las em **Dados da empresa** (ou você pode incorporar a regra em `calcularPrazos`, em `src/dominio/etapas.ts`);
   - prazo de terceirizadas da administração pública: `excecoes.terceirizadaAdministracaoPublica.prazoEtapa1`;
   - divisores padrão: `divisores.porHorasSemanais`.
3. **Atualize a fonte** do item (`fonte`) e mude `confirmarNoTextoOficial` para `false` quando o valor tiver sido conferido. A página **Entenda** lista automaticamente os itens ainda marcados como `true`.
4. **Atualize `versaoRegras`** com a data da revisão (aparece no rodapé).
5. **Rode `npm test`.** Os testes leem os valores do arquivo; se algum teste fixar uma data que mudou (por exemplo, `etapas.test.ts`), atualize a expectativa e confira se o comportamento novo está correto.
6. Gere o build e publique de novo.

Unidades: tempos em **minutos**; datas em **`AAAA-MM-DD`**.

## Estrutura do código

```
src/
├─ config/            regras-ec141.ts (fonte única das regras), textos jurídicos, FAQ, checklist do ponto
├─ dominio/           funções puras de cálculo e validação (com testes *.test.ts)
│  ├─ tempo.ts          horários, durações, datas, moeda
│  ├─ etapas.ts         prazos por perfil de empresa, etapa vigente, limites, contagem regressiva
│  ├─ jornada.ts        resumo e validação de grade (intervalo, interjornada, repousos, limites)
│  ├─ diagnostico.ts    status por funcionário e indicadores
│  ├─ redistribuicao.ts opções de grade para 42 h / 40 h
│  ├─ remuneracao.ts    divisor, valor-hora, hora extra
│  ├─ cobertura.ts      revezamento de folgas, dimensionamento por turno, custos
│  ├─ escala.ts         validação do montador e escala sugerida
│  ├─ clausulas.ts      checklist de cláusulas coletivas
│  ├─ pauta.ts          pauta/minuta para o sindicato
│  ├─ aditivo.ts        termo aditivo e planilha de-para
│  └─ planoAcao.ts      tarefas automáticas e prazos
├─ dados/             IndexedDB (Dexie), esquemas zod, backup, importação CSV/XLSX, dados de exemplo
├─ exportacao/        PDF (jsPDF), DOCX (docx), XLSX (exceljs), carregados sob demanda
├─ componentes/       layout, componentes de interface, editor de grade e de turnos
├─ hooks/             acesso reativo aos dados
└─ paginas/           uma pasta por módulo
```

## Privacidade e backups

Os dados ficam só no navegador e no dispositivo em que foram cadastrados. Limpar os dados do navegador apaga tudo. Faça backups periódicos em **Backup e dados de exemplo → Baixar backup** e guarde o arquivo em local seguro, porque ele contém dados pessoais dos funcionários (LGPD).
