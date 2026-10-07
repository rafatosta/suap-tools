# SUAP Tools

Extensão React/Vite Manifest V3 para tarefas no SUAP IFBA, usando a sessão
já autenticada no navegador. Não altera notas. Exclusão de aulas exige prévia, senha e confirmação explícita.

## Importar e cadastrar aulas — v0.5

1. Abra Registro de Aulas no diário e selecione a unidade desejada.
2. Abra SUAP Tools → Aulas → **Importar aulas nesta página**.
3. No painel que aparece na própria página do SUAP, selecione o CSV ou XLSX.
4. Confira a prévia e corrija eventuais erros.
5. Escolha o modo de cadastro:
   - Checkbox desmarcado (padrão): **Cadastrar próxima aula** confirma uma linha por vez no painel.
   - Checkbox marcado: **Cadastrar todas as aulas** envia e confirma cada registro em sequência.
6. Após concluir, feche o painel e atualize a lista de aulas no SUAP.

Não há nova aba, seleção de outra aba ou abertura/preenchimento de diálogo
nativo nesse fluxo. O painel continua aberto durante a seleção do arquivo,
evitando o fechamento do popup por perda de foco. O destino é sempre o diário
na página atual. A opção de envio automático fica desmarcada a cada importação.

**Parar após a aula atual** impede os próximos envios. Um cadastro em andamento
pode concluir; a interrupção não desfaz registros. Não feche ou recarregue a
página durante o envio. Os dados e o acompanhamento ficam apenas na memória
do painel e são descartados ao fechar ou recarregar.

## Modelo oficial

Use **Baixar modelo CSV**. Ele contém apenas os cabeçalhos, sem dados de exemplo.

| Coluna | Regra |
| --- | --- |
| Unidade | Obrigatória: 1, 2 ou 3 |
| Data | Obrigatória: data real em dd/mm/aaaa |
| Quantidade | Obrigatória: inteiro positivo |
| Conteúdo | Obrigatória: texto não vazio |
| Formato | Opcional: vazio, Síncrona ou Assíncrona |

Os cabeçalhos devem ser exatos, sem colunas extras ou duplicadas. A ordem pode
variar. CSV: UTF-8, separado por ponto e vírgula ou vírgula, com campos entre
aspas e conteúdo multilinha. XLSX: exatamente uma aba; **Data como texto**.
Limite de arquivo: 5 MB. O CSV exportado das aulas registradas tem outro formato.

Todas as aulas do lote devem pertencer à unidade atual do diário. Linhas
inválidas, repetidas ou já cadastradas impedem o envio correspondente. Erros
de estrutura bloqueiam o arquivo inteiro. A prévia inclui somente linhas válidas.

## Confirmação e sessão

O cadastro consulta os campos do SUAP sem mostrar o formulário, preserva o
professor e o token CSRF fornecidos pelo servidor, e envia pela sessão atual.
Antes do envio, consulta a lista persistida para evitar duplicação. Depois,
consulta novamente o diário: apenas um registro correspondente confirma o
cadastro. Erros de validação do SUAP são exibidos no painel.

Uma resposta incerta ou um envio sem confirmação interrompe o lote. Não há
reenvio automático. Confira o diário antes de importar novamente as linhas
pendentes. A extensão não cria uma API paralela, não armazena credenciais e
não altera o professor ou o token CSRF.

## Notas e exportação

A extensão lê notas, avaliações e médias, mostra diagnóstico e prévia e exporta
CSV. Também lista e exporta aulas registradas. Essas operações são de leitura.

## Desenvolvimento e instalação

    npm install
    npm test
    npm run build

O build fica em `dist/`. Em `chrome://extensions`, ative Modo do desenvolvedor
e use **Carregar sem compactação** para selecionar `dist/`. Em uma atualização,
recarregue a extensão e também a página do SUAP.

## Excluir todas as aulas de uma unidade — v0.6

1. No SUAP, selecione o diário e a unidade desejada.
2. Abra SUAP Tools → Aulas → **Excluir aulas da unidade...**.
3. No painel da própria página, clique em **Preparar exclusão**.
4. Confira o diário, a unidade, a lista e a quantidade de registros afetados.
5. Informe sua senha do SUAP e marque a confirmação de exclusão desta unidade.
6. Clique em **Excluir todas as aulas da Unidade N**.

O lote remove somente os registros listados na prévia confirmada, usando o
formulário `excluirregistro_form` e o campo `senha` do SUAP. O token CSRF é
obtido novamente para cada aula. A senha não é armazenada em arquivos, logs,
localStorage ou armazenamento da extensão; o campo é limpo ao iniciar e ao
terminar a execução. Ela é enviada somente ao endpoint de exclusão do SUAP.

Cada remoção é confirmada pela consulta do diário antes de avançar. Alteração
do registro, mudança de diário/unidade, senha recusada ou resposta incerta
interrompem o lote sem repetição automática. Cadastros e exclusões não podem
executar simultaneamente pelo painel.

**Parar após a exclusão atual** impede as próximas remoções; uma exclusão já
enviada pode concluir. A extensão não desfaz exclusões. Depois de concluir ou
interromper, confira o diário e prepare uma nova prévia para os registros
restantes. A prévia expira em dez minutos.

## Deslocamento de datas — v0.7

1. Selecione o diário e a unidade no SUAP.
2. Abra SUAP Tools → Aulas → **Deslocar datas das aulas...**.
3. Informe a **Data inicial** em dd/mm/aaaa e o **Deslocamento em dias**
   (padrão: 7; positivo adia, negativo antecipa).
4. Clique em **Mostrar prévia** e confira cada data atual e nova data.
5. Marque a confirmação e clique em **Aplicar deslocamento**.

A data inicial é inclusiva. Exemplo: Unidade 2, data inicial 01/10/2026,
deslocamento +7: 01/10 vira 08/10, 08/10 vira 15/10 e assim por diante.
As aulas anteriores a 01/10 permanecem sem alterações.

É edição dos registros existentes, preservando seus identificadores. Somente
o campo Data é alterado; quantidade, conteúdo, professor, formato e demais
campos do formulário original são preservados. Não cria nem exclui aulas.
A extensão consulta o diário para confirmar cada alteração.

Datas posteriores são processadas primeiro ao adiar; anteriores primeiro ao
antecipar. Um destino que coincide com uma aula fora do intervalo selecionado
bloqueia a prévia. Aulas modificadas depois da prévia, mudança de diário ou
unidade e erros do SUAP interrompem a execução sem repetir o envio. A prévia
expira em dez minutos.

**Parar após a edição atual** impede as próximas alterações. Em uma execução
parcial, confira as datas antes de preparar outra prévia para evitar deslocar
novamente aulas já alteradas.
