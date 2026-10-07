# SUAP Tools

Extensão React/Vite Manifest V3 para tarefas no SUAP IFBA, usando a sessão
já autenticada no navegador. Não altera notas nem exclui aulas.

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
