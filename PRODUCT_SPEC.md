# Premiere Motion Panel

## Objetivo

Criar um painel para Adobe Premiere Pro com dois cenarios separados de animacao:

1. manipulacao de keyframes e curvas Bezier, em linha com a ideia de ferramentas como Motion/Flow no After Effects;
2. animacoes procedurais sem keyframes, com presets como spring, overshoot e bounce reagindo ao in/out do clip.

O painel nao deve exigir que o usuario arraste ou carregue o clip para dentro da interface. O fluxo principal deve ser contextual: o usuario seleciona um ou mais clips na timeline e usa o painel para ler o estado do clip, manipular keyframes existentes ou aplicar animacoes/presets.

## Cenario 1: Keyframe / Bezier

Este modo trabalha com keyframes reais.

Fluxo esperado:

1. O usuario seleciona um clip na timeline.
2. O painel detecta a selecao ativa.
3. O painel identifica propriedades animaveis do clip, como Position, Scale, Rotation e Opacity.
4. O painel le keyframes existentes quando a API permitir.
5. O usuario escolhe botoes ou curvas de easing.
6. O painel altera a interpolacao/curva dos keyframes.

Referencias de comportamento:

- aplicar curvas de easing em keyframes existentes;
- presets de Bezier;
- botoes de ease in, ease out, ease in/out, linear, hold e Bezier;
- editor visual de curva, se a API permitir manipular handles;
- funcionamento parecido com uma versao para Premiere de ferramentas de motion design usadas no After Effects.

Cuidados:

- nao sobrescrever keyframes do usuario sem confirmacao;
- diferenciar keyframes do Motion nativo, Transform effect e outros efeitos;
- validar se a API expõe handles Bezier completos ou apenas tipos de interpolacao;
- preservar undo/redo do Premiere sempre que possivel.

## Cenario 2: Animacao Procedural / Sem Keyframes

Este modo nao deve gerar keyframes no clip.

A ideia e aplicar animacoes que respondem ao tempo do clip usando in/out como parametros. O usuario seleciona o clip e escolhe um preset como spring, overshoot ou bounce. A animacao acontece a partir do inicio do clip, do fim do clip ou dos dois, sem criar keyframes manuais nem keyframes internos visiveis no clip.

Fluxo esperado:

1. O usuario seleciona um clip na timeline.
2. O painel detecta o clip selecionado.
3. O painel le in/out e duracao do clip.
4. O usuario escolhe se o preset reage ao inicio, ao fim ou a ambos.
5. O painel aplica uma animacao procedural a propriedades como Position, Scale, Rotation e Opacity.
6. A animacao reage ao tempo do clip sem criar keyframes.

Presets iniciais:

- Spring In;
- Spring Out;
- Overshoot In;
- Overshoot Out;
- Bounce In;
- Bounce Out;
- Pop Scale;
- Slide Spring;
- Rotate Overshoot;
- Fade with motion.

Parametros sugeridos:

- intensidade;
- duracao em frames ou porcentagem do clip;
- damping;
- frequencia;
- overshoot;
- eixo X/Y;
- aplicar no in, no out ou em ambos.

## Hipoteses tecnicas para animacao sem keyframes

Este e o ponto que precisa ser validado antes da implementacao principal.

Caminhos possiveis:

- aplicar um efeito/plugin que renderiza a animacao em tempo real;
- usar uma transicao/effect style semelhante a Motion Tween;
- usar MOGRT/Essential Graphics com controles internos;
- usar preset de efeito com comportamento procedural;
- usar UXP apenas como painel de controle para aplicar/configurar outro mecanismo.

O painel UXP sozinho pode nao ser suficiente para animacao procedural real se ele apenas manipular propriedades e keyframes. A validacao tecnica deve descobrir qual mecanismo permite animar sem keyframes no Premiere atual.

## Linguagem de produto

Para o modo Keyframe/Bezier:

> Controle rapido de curvas e easing para keyframes do Premiere.

Para o modo Procedural:

> Animacoes com spring e overshoot baseadas no in/out do clip, sem keyframes.

Nao misturar os dois modos na comunicacao. Eles resolvem problemas diferentes.

## Interface inicial

A interface deve ter dois modos ou abas:

- Keyframes;
- Presets sem keyframe.

Controles do modo Keyframes:

- Refresh Selection;
- propriedade alvo;
- botoes Linear, Hold, Ease In, Ease Out, Ease In/Out e Bezier;
- presets de curva;
- Apply to selected keyframes;
- Apply between nearest keyframes;
- Reset interpolation.

Controles do modo Presets sem keyframe:

- Refresh Selection;
- alvo: Position, Scale, Rotation, Opacity;
- trigger: In, Out ou In + Out;
- preset: Spring, Overshoot, Bounce, Pop, Slide;
- intensidade;
- duracao;
- damping/frequencia;
- Apply;
- Update preset;
- Remove preset.

## Primeira meta tecnica

Antes de construir a interface final, validar separadamente:

### Prototipo A: Keyframe/Bezier

1. Selecionar um clip com dois keyframes de Scale.
2. O painel detectar propriedade e keyframes.
3. Aplicar uma curva/easing.
4. Confirmar que os keyframes foram alterados.

### Prototipo B: Sem Keyframes

1. Selecionar um clip sem keyframes.
2. Aplicar um preset de spring ou overshoot baseado no in do clip.
3. Confirmar que a animacao acontece sem keyframes visiveis no clip.
4. Repetir com out do clip.
5. Confirmar que o preset pode ser atualizado ou removido.

Se o Prototipo B exigir um efeito/plugin separado alem do painel UXP, documentar essa dependencia antes de avancar.

## Riscos conhecidos

- Controle fino de Bezier pode depender de APIs ainda limitadas.
- Animacao procedural sem keyframes pode exigir efeito/plugin nativo, transicao, MOGRT ou outro mecanismo alem de UXP puro.
- Presets procedurais precisam ser removiveis/atualizaveis sem destruir ajustes do usuario.
- Propriedades nativas e efeitos aplicados podem ter comportamentos diferentes.
