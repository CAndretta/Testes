# Testes
Ambiente para testes técnicos e educacionais.

----------------

Este ambiente é usado para testes do sistema de versionamento com Git e GitHub, tanto para fins técnicos quanto educacionais.

---------------

Esta é uma aplicação PWA para cálculo de material e custo por metro quadrado, por meio da inserção das medidas das peças e de suas quantidades.

Ela deve permitir o cadastro dos tipos de materiais e de seus preços, para que seja possível realizar o cálculo final.

Esta aplicação deve rodar localmente e usar o armazenamento do navegador para a persistência de dados. Por isso, utiliza JavaScript e jQuery na lógica, e HTML com CSS na interface.

É necessário que seja responsiva para web e desktop.

Este arquivo deve ser incrementado quando houver ajustes no sistema e sempre deve ser analisado antes de novas alterações.

--------------

## Sistema implementado

Foi criada uma aplicação PWA local em HTML, CSS, JavaScript e jQuery, com persistência em `localStorage`.

### Recursos atuais

- Cadastro de materiais com nome e preço por metro quadrado.
- Cadastro de peças com descrição, largura, altura, quantidade e material associado.
- Cálculo automático de área total em m² e custo total por item e consolidado.
- Resumo por material com total de itens, área acumulada e custo.
- Persistência local dos dados no navegador.
- Manifest e service worker para uso como PWA local.
- Aviso visual de modo de execução para diferenciar o uso em arquivo local e em ambiente PWA.
- Estados visuais consistentes para campos e botões desabilitados.
- A composição e o consolidado ficam ocultos até existir um projeto selecionado.
- A troca ou a criação de outro projeto acontece em um painel separado para evitar interrupção acidental do preenchimento atual.
- A exclusão do projeto fica dentro da área de composição, junto da confirmação, para reduzir o risco de remoção acidental durante a troca de contexto.
- Fluxo guiado em quatro etapas: projeto, materiais, peças e resumo.
- Hero com ações diretas para iniciar o projeto ou abrir a base de custos.
- Base de custos com comportamento de painel lateral no desktop e bottom sheet no mobile.
- Feedback visual por toast e mensagens inline no lugar de alertas nativos.
- Confirmações destrutivas feitas na própria interface, sem `window.confirm`.
- Prévia dinâmica de área e custo durante o preenchimento da peça.
- Listagem em cards no mobile para materiais e peças, mantendo tabela no desktop.
- Tabs compactas e fixadas no mobile para facilitar a alternância entre composição e consolidado.

### Estrutura criada

- `index.html`: interface principal.
- `styles.css`: estilos responsivos para web e desktop.
- `app.js`: lógica da calculadora e persistência.
- `jquery-3.7.1.min.js`: dependência local da interface.
- `manifest.json`: configuração PWA.
- `sw.js`: cache básico para funcionamento offline.
- `icon.svg`: ícone do aplicativo.

### Como executar

1. Abra o arquivo `index.html` em um navegador moderno.
2. Para melhor comportamento de PWA e service worker, sirva a pasta com um servidor local simples.
3. Os dados ficam salvos no navegador usado para abrir a aplicação.

### Observações

- As medidas das peças são informadas em centímetros.
- O cálculo da área usa a fórmula `(largura_cm x altura_cm / 10000) x quantidade`.
- O custo final considera o preço cadastrado por m² do material selecionado.
- Ao abrir por `file:///`, a persistência continua funcionando, mas a instalação PWA e o cache offline exigem um servidor local por restrição do navegador.
- O sistema agora prioriza o uso em telas pequenas sem perder a leitura em desktop, com foco em fluxo guiado, feedback contextual e ações maiores para toque.