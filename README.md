# SUAP Tools

Extensão de navegador para auxiliar tarefas no SUAP.

## v0.4 — notas e aulas

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
- no preenchimento avulso, o usuário revisa e clica em **Salvar** manualmente;
- na importação, permite optar pelo envio automático de todas as aulas com um checkbox, desmarcado por padrão;
- não exclui aulas.

## Segurança

O envio automático ocorre somente ao marcar **Enviar e salvar automaticamente todas as aulas deste lote** e iniciar o lote. A opção é desmarcada por padrão e não é persistida entre importações.

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

## Importação padronizada de aulas

Na aba **Aulas**, clique em **Baixar modelo CSV**, preencha os registros e use
**Abrir importação em uma aba**. Na nova aba, selecione o arquivo em
**Importar CSV/XLSX**. A seleção ocorre fora do popup para que a perda de foco
não feche a interface nem descarte a prévia. A seleção do arquivo apenas valida e simula localmente. O preenchimento só
começa ao iniciar o lote; o envio automático depende da opção marcada pelo usuário.

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
4. Escolha o modo de salvamento no checkbox:
   - **Desmarcado** (padrão): clique em **Iniciar preenchimento automático**, revise cada aula no SUAP e clique manualmente em **Salvar**.
   - **Marcado**: clique em **Iniciar envio automático**. A extensão preenche e aciona o botão Salvar original para cada aula.
5. A extensão confirma cada novo registro no diário antes de avançar para a próxima aula.
6. Aguarde o contador confirmar todo o lote. A opção e o diário não podem ser alterados durante a execução.

Mantenha a aba de importação aberta durante o lote. O destino fica vinculado à
aba escolhida, independentemente de qual aba estiver ativa. Formulários com
conteúdo de outra aula, aulas já registradas, duplicações no arquivo, mudança de diário ou
unidade e incompatibilidade dos campos interrompem o preenchimento. O lote
deve conter aulas de uma única unidade, correspondente à unidade do diário.
O avanço exige um novo registro identificável na tabela, com os mesmos dados
importados, e o formulário fechado; fechar ou cancelar o formulário não
confirma salvamento.

**Interromper lote** cancela os próximos passos. Um envio já iniciado pode
terminar no SUAP; interromper não desfaz nem exclui aulas. Confira o formulário e o diário antes de continuar. A
contagem de aulas salvas permanece enquanto a aba estiver aberta; fechar ou
recarregar descarta o acompanhamento. Não importe novamente aulas já salvas.

### Correção do diálogo na v0.3.1

O lote ignora formulários ocultos e reaproveita um diálogo visível vazio ou já
preenchido com a aula atual. A identificação do diário desconsidera parâmetros
de URL, e a unidade é lida fora do diálogo. No lote, os valores são aplicados
sem disparar os eventos de alteração que podem reinicializar o formulário do
SUAP. Após a abertura e o preenchimento, a extensão aguarda e confere os campos
antes de indicar que a aula está pronta para revisão e salvamento manual.

### Confirmação de salvamento na v0.3.2

Se o usuário salvar antes da conferência dos campos, o lote procura o novo
registro no diário e confirma o salvamento, inclusive na última aula. A
conferência tolera um breve atraso de atualização da tabela e não preenche
novamente uma aula que acabou de ser salva. Apenas fechar o diálogo sem um
novo registro correspondente continua sem contar como salvamento.

## Envio automático opcional na v0.4

Antes de enviar, a extensão verifica que o formulário corresponde à linha
importada, pertence ao diário escolhido e passa pela validação nativa. Usa o
botão Salvar existente, mantendo o professor e o token CSRF originais.

O clique em Salvar é uma tentativa de envio, não uma confirmação: somente o
novo registro no diário incrementa o contador. Erros retornados pelo SUAP
interrompem o lote. Se a página navegar e a resposta do envio se perder, a
extensão procura o registro sem reenviar a aula. Após 60 segundos sem
confirmação, o lote para e pede a conferência do diário. Não há repetição
automática do envio.
