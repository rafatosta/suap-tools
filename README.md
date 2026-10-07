# SUAP Tools

Extensão de navegador para auxiliar tarefas no SUAP.

## v0.1 — prova de conceito somente leitura

A primeira versão valida a arquitetura da extensão sem alterar qualquer dado no SUAP.

### Funcionalidades

- detecta páginas do SUAP IFBA;
- identifica a tabela de notas do diário (`#table_notas`);
- extrai matrícula e nome dos estudantes;
- extrai os campos visíveis de Unidade 1/2/3, recuperações, médias e demais colunas presentes;
- exibe diagnóstico e prévia na extensão;
- exporta os dados extraídos em CSV;
- não preenche campos;
- não dispara AJAX de alteração;
- não clica em **Salvar Notas**;
- não realiza POST de escrita.

## Tecnologias

- React
- Vite
- Chrome/Chromium Extension Manifest V3
- JavaScript

Nesta versão não há necessidade de SheetJS porque o fluxo implementado é SUAP → CSV. SheetJS poderá ser adicionado quando houver importação de XLSX/CSV para preenchimento.

## Desenvolvimento

    npm install
    npm run build

O build será criado em `dist/`.

## Instalação no Chrome/Chromium

1. Execute `npm run build`.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `dist/`.
6. Abra o SUAP em `https://suap.ifba.edu.br/`.
7. Entre normalmente com sua conta.
8. Abra um diário na aba **Registro de Notas/Conceitos**.
9. Abra a extensão **SUAP Tools**.

Se a extensão tiver sido carregada enquanto a página do SUAP já estava aberta, recarregue a página antes do primeiro teste.

## Como testar a v0.1

A extensão deve mostrar:

- domínio do SUAP detectado;
- tabela de notas encontrada;
- quantidade de alunos identificados;
- confirmação de que nenhuma ação de escrita foi executada.

Clique em **Exportar CSV** para baixar os dados extraídos do diário atual.

## Segurança da v0.1

O código desta versão é deliberadamente somente leitura. O content script apenas inspeciona o DOM já carregado na aba do SUAP.

Não há código para:

- alterar `input.value`;
- executar `validar_nota`;
- enviar formulários;
- clicar em botões de salvamento;
- realizar requisições de escrita.

## Próximos passos possíveis

- validar o parser em diferentes diários e modalidades;
- melhorar os metadados do diário;
- adicionar exportação XLSX;
- importar planilhas e mapear colunas;
- implementar modo de pré-visualização para lançamento de notas;
- somente depois, implementar escrita com confirmação explícita.
