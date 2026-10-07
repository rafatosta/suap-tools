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

- simulação de lançamento de notas;
- cadastro de aulas em lote com prévia;
- salvamento explícito somente após confirmação do usuário.

## Importação padronizada de aulas

Na aba **Aulas**, clique em **Baixar modelo CSV**, preencha os registros e use
**Abrir importação em uma aba**. Na nova aba, selecione o arquivo em
**Importar CSV/XLSX**. A seleção ocorre fora do popup para que a perda de foco
não feche a interface nem descarte a prévia. A seleção do arquivo apenas valida e simula localmente. O preenchimento só
começa ao iniciar o lote; a extensão nunca salva aulas automaticamente.

| Coluna | Regra |
| --- | --- |
| Unidade | Obrigatória: 1, 2 ou 3 |
| Data | Obrigatória: data real em dd/mm/aaaa |
| Quantidade | Obrigatória: inteiro positivo |
| Conteúdo | Obrigatória: texto não vazio |
| Formato | Coluna opcional: vazio, Síncrona ou Assíncrona |

Os cabeçalhos devem ser escritos exatamente como acima, sem colunas adicionais
ou duplicadas. A ordem pode variar. CSV: UTF-8, separado por `;` ou `,`, com
suporte a campos entre aspas e conteúdo multilinha. XLSX: exatamente uma aba;
configure **Data como texto** para preservar dd/mm/aaaa. Limite: 5 MB.
O modelo baixado contém apenas os cabeçalhos, sem exemplos para lançamento.
O CSV de exportação das aulas registradas inclui Professor e não é um modelo
de importação.

Erros de estrutura bloqueiam todo o arquivo. Erros de dados indicam a linha e
os campos que precisam de correção. Linhas vazias são ignoradas; somente linhas
válidas aparecem na prévia e nos totais de aulas por unidade. Corrija o arquivo
e importe novamente. Os dados importados permanecem apenas na memória da aba de importação
e são descartados ao recarregar ou fechá-la.

Validação automatizada: `npm test`. Build da extensão: `npm run build`.

## Preenchimento automático das aulas importadas

1. Abra Registro de Aulas no diário e selecione a unidade do arquivo.
2. Na aba de importação, carregue o arquivo e corrija todos os erros.
3. Clique em **Buscar abas do SUAP** e selecione o diário de destino.
4. Clique em **Iniciar preenchimento automático**.
5. No SUAP, revise a aula preenchida e clique manualmente em **Salvar**.
6. A extensão confirma o novo registro no diário e preenche a próxima aula
   automaticamente. Repita a revisão e o salvamento até concluir o lote.

Mantenha a aba de importação aberta durante o lote. O destino fica vinculado à
aba escolhida, independentemente de qual aba estiver ativa. Formulários com
conteúdo de outra aula, aulas já registradas, duplicações no arquivo, mudança de diário ou
unidade e incompatibilidade dos campos interrompem o preenchimento. O lote
deve conter aulas de uma única unidade, correspondente à unidade do diário.
O avanço exige um novo registro identificável na tabela, com os mesmos dados
importados, e o formulário fechado; fechar ou cancelar o formulário não
confirma salvamento.

**Interromper lote** cancela apenas os próximos passos. Não fecha, salva ou
exclui a aula atual. Confira o formulário e o diário antes de continuar. A
contagem de aulas salvas permanece enquanto a aba estiver aberta; fechar ou
recarregar descarta o acompanhamento. Não importe novamente aulas já salvas.

### Correção do diálogo na v0.3.1

O lote ignora formulários ocultos e reaproveita um diálogo visível vazio ou já
preenchido com a aula atual. A identificação do diário desconsidera parâmetros
de URL, e a unidade é lida fora do diálogo. No lote, os valores são aplicados
sem disparar os eventos de alteração que podem reinicializar o formulário do
SUAP. Após a abertura e o preenchimento, a extensão aguarda e confere os campos
antes de indicar que a aula está pronta para revisão e salvamento manual.
