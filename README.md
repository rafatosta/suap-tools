# SUAP Tools

Extensão de navegador para auxiliar tarefas no SUAP.

## v0.2 — notas e aulas

A extensão usa a sessão já autenticada do SUAP no navegador.

### Notas

- detecta a tabela de notas do diário;
- extrai matrícula, nome, avaliações, médias e demais campos disponíveis;
- mostra diagnóstico e prévia;
- exporta os dados para CSV;
- não altera nem salva notas.

### Aulas

- detecta a aba **Registro de Aulas**;
- lista as aulas já registradas na unidade atual;
- extrai data, quantidade, professor e conteúdo;
- exporta as aulas para CSV;
- abre o diálogo nativo **Adicionar Aula**;
- permite informar quantidade, unidade, data, formato e conteúdo na extensão;
- preenche o formulário nativo já aberto no SUAP;
- **não envia o formulário**: o usuário deve revisar e clicar em **Salvar** manualmente;
- não exclui aulas.

## Segurança

A v0.2 não executa salvamento automático.

No módulo de aulas, a extensão pode preencher os seguintes campos do formulário nativo:

- quantidade;
- unidade;
- data;
- formato;
- conteúdo.

Professor e token CSRF permanecem sob controle do formulário original do SUAP. A extensão não manipula senha e não implementa exclusão.

## Tecnologias

- React
- Vite
- Chrome/Chromium Extension Manifest V3
- JavaScript

## Desenvolvimento

    npm install
    npm run build

O build será criado em `dist/`.

## Instalação / atualização no Chrome ou Chromium

1. Execute `npm run build`.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Para primeira instalação, clique em **Carregar sem compactação** e selecione `dist/`.
5. Se a extensão já estiver instalada, clique em **Recarregar** no card do SUAP Tools.
6. Recarregue também a página do SUAP.

## Teste do módulo de aulas

1. Abra um diário no SUAP.
2. Abra o SUAP Tools e selecione **Aulas**.
3. Confira o diagnóstico e a lista de aulas encontradas.
4. Teste **Exportar CSV**.
5. Clique em **Abrir Adicionar Aula**.
6. O SUAP abrirá o diálogo nativo.
7. Reabra o SUAP Tools e volte à aba **Aulas**.
8. Preencha os campos desejados na extensão.
9. Clique em **Preencher diálogo aberto**.
10. Confira os dados no formulário nativo do SUAP.
11. Se estiver tudo correto, clique manualmente em **Salvar** no próprio SUAP.

## Estrutura relevante

- `public/suap-grade-parser.js`: leitura de notas;
- `public/suap-class-parser.js`: leitura de aulas e preenchimento assistido do formulário;
- `public/content.js`: comunicação entre popup e página;
- `src/services/csvExporter.js`: exportação de notas;
- `src/services/classesCsvExporter.js`: exportação de aulas;
- `src/App.jsx`: interface da extensão.

## Próximos passos possíveis

- importação de CSV/XLSX;
- mapeamento de colunas;
- simulação de lançamento de notas;
- cadastro de aulas em lote com prévia;
- salvamento explícito somente após confirmação do usuário.
