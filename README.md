# Testes
Ambuente para testes técnicos e educacionais.

----------------

Este ambiente é usado para testes do sistema de versionamento com Git e GitHub, tanto para fins técnicos como educacionais

---------------

Instruções para agentes de IA.

Este será uma aplicação PWA para calculo de material/custo por metro quadrado, atravez da inserção de medidas de peças e suas quantidades.

Deve opermitir cadastrar os tipos de materias e seus preços para que seja possivel o calculo final total.

Esta aplicação deve rodar localmente e usar o armazenamento do navegador para a persistencia de dados, por isso deve rodar com javascript e jquery, na parte de lógica e html com css na parte de interface. 

É necessário que seja responsivo para Web ou Desktop apenas.

Este arquivo deve ser incrementado pelo agende de IA quando fizer ajustes no sistema e sempre deve ser analisado antes de novas alterações.

--------------

## Sistema implementado

Foi criada uma aplicacao PWA local em HTML, CSS, JavaScript e jQuery com persistencia em `localStorage`.

### Recursos atuais

- Cadastro de materiais com nome e preco por metro quadrado.
- Cadastro de pecas com descricao, largura, altura, quantidade e material associado.
- Calculo automatico de area total em m² e custo total por item e consolidado.
- Resumo por material com total de itens, area acumulada e custo.
- Persistencia local dos dados no navegador.
- Manifest e service worker para uso como PWA local.
- Aviso visual de modo de execucao para diferenciar uso em arquivo local e ambiente PWA.
- Estados visuais consistentes para campos e botoes desabilitados.

### Estrutura criada

- `index.html`: interface principal.
- `styles.css`: estilos responsivos para web e desktop.
- `app.js`: logica da calculadora e persistencia.
- `jquery-3.7.1.min.js`: dependencia local da interface.
- `manifest.json`: configuracao PWA.
- `sw.js`: cache basico para funcionamento offline.
- `icon.svg`: icone do aplicativo.

### Como executar

1. Abra o arquivo `index.html` em um navegador moderno.
2. Para melhor comportamento de PWA e service worker, sirva a pasta com um servidor local simples.
3. Os dados ficam salvos no navegador usado para abrir a aplicacao.

### Observacoes

- As medidas das pecas sao informadas em centimetros.
- O calculo da area usa a formula `(largura_cm x altura_cm / 10000) x quantidade`.
- O custo final considera o preco cadastrado por m² do material selecionado.
- Ao abrir por `file:///`, a persistencia continua funcionando, mas instalacao PWA e cache offline exigem servidor local por restricao do navegador.