# Premiere Motion Keyframe Panel

## Objetivo

Criar um painel UXP para Adobe Premiere Pro que aplique e manipule animacoes de propriedades de clips selecionados na timeline, usando o in/out do proprio clip como referencia de tempo.

O painel nao deve exigir que o usuario arraste ou carregue o clip para dentro da interface. O fluxo principal deve ser contextual: o usuario seleciona um ou mais clips na timeline e usa o painel para ler, aplicar, atualizar ou remover animacoes.

## Principio de uso

1. O usuario seleciona um clip na timeline.
2. O painel detecta a selecao ativa.
3. O painel le propriedades animaveis do clip, como Motion e Opacity.
4. O painel identifica keyframes existentes quando a API permitir.
5. O usuario escolhe uma acao ou preset no painel.
6. O painel aplica keyframes automaticamente com base no in/out do clip.
7. O usuario nao precisa criar keyframes manualmente.

## Linguagem de produto

Evitar prometer "sem keyframes" em sentido tecnico absoluto.

Mensagem recomendada:

> Animacoes automaticas baseadas no in/out do clip, sem precisar criar keyframes manualmente.

Motivo: para animar propriedades nativas do Premiere, o painel provavelmente precisara criar ou editar keyframes internamente.

## Escopo inicial

O primeiro prototipo deve validar somente o essencial:

- detectar sequencia ativa;
- detectar clips selecionados;
- ler in/out do clip;
- localizar propriedades principais do componente Motion;
- localizar Opacity quando disponivel;
- criar keyframes no inicio e no fim do clip;
- alterar valores simples de Position, Scale e Opacity;
- aplicar interpolacao disponivel pela API;
- remover ou substituir keyframes criados pelo proprio painel quando possivel.

## Presets iniciais

Priorizar poucos presets bem testados:

- Fade In;
- Fade Out;
- Slide In;
- Slide Out;
- Scale Pop;
- Zoom In;
- Overshoot simples;
- Spring simulado por multiplos keyframes.

Spring e overshoot podem ser simulados com keyframes intermediarios quando a API nao oferecer curvas fisicas reais.

## Interface inicial

A interface deve ser uma ferramenta de aplicacao rapida, nao um editor pesado de timeline.

Controles sugeridos:

- status do clip selecionado;
- botao Refresh Selection;
- grupo de presets de entrada;
- grupo de presets de saida;
- sliders para intensidade, duracao relativa e suavidade;
- toggle para aplicar no inicio, no fim ou em ambos;
- botao Apply;
- botao Update Animation;
- botao Remove Panel Animation.

## Modelo de tempo

Usar o in/out do clip como base:

- inicio da animacao de entrada: clip in;
- fim da animacao de entrada: clip in + duracao escolhida;
- inicio da animacao de saida: clip out - duracao escolhida;
- fim da animacao de saida: clip out.

A duracao deve poder ser definida em frames ou porcentagem do comprimento do clip.

## Cuidados tecnicos

- Nao assumir que todos os clips possuem os mesmos componentes.
- Nao sobrescrever keyframes do usuario sem confirmacao ou modo explicito.
- Sempre que possivel, marcar ou reconhecer keyframes criados pelo painel para permitir atualizacao posterior.
- Considerar selecao multipla desde cedo, mas validar primeiro com um unico clip.
- Tratar clips de video, imagens, adjustment layers e graphic clips separadamente se houver diferencas de API.
- Evitar depender de nomes localizados da interface quando houver identificadores estaveis na API.

## Riscos conhecidos

- A API UXP do Premiere pode nao expor controle fino dos handles Bezier.
- Alguns modos de interpolacao podem existir sem acesso completo aos parametros da curva.
- Spring real pode precisar ser aproximado com multiplos keyframes.
- A leitura e edicao de keyframes existentes pode variar conforme propriedade e componente.

## Primeira meta tecnica

Antes de desenhar a versao final, criar um prototipo minimo que prove:

1. selecionar um clip na timeline;
2. clicar no painel;
3. aplicar dois keyframes de Scale usando in/out do clip;
4. reproduzir a timeline e ver a animacao;
5. repetir a acao sem duplicar keyframes descontroladamente.

Se essa meta passar, o projeto pode evoluir para presets, interface refinada e empacotamento CCX.
