# Design References

## Direcao visual

O painel deve seguir uma linguagem minimalista, escura, compacta e alinhada ao ambiente do Premiere Pro atual.

Objetivo visual:

- parecer uma ferramenta profissional nativa do fluxo de edicao;
- evitar excesso de cor, bordas pesadas e cards decorativos;
- priorizar leitura rapida, precisao e acesso imediato aos controles;
- manter harmonia com a UI Spectrum/dark do Premiere.

## Referencias observadas

### OpenCurve

Referencia para o modo Keyframe/Bezier.

Pontos relevantes:

- editor de curva como area principal;
- foco em aplicar easing a propriedades selecionadas;
- interface voltada a acao rapida, sem carregar o clip para dentro da UI;
- presets de curva;
- suporte a temas e grid.

Licao para o projeto:

- o modo Bezier deve ter grafico limpo e controles ao redor, nao uma tela cheia de botoes.

### Smoothify

Referencia para curva/easing minimalista.

Pontos relevantes:

- fundo escuro;
- curva colorida com pontos de controle bem visiveis;
- controles pequenos de preview, undo/redo e reset;
- preset selecionado em area compacta.

Licao para o projeto:

- usar uma cor de destaque por contexto, especialmente para curvas e estados ativos.

### Motion Studio

Referencia para painel de motion design mais completo.

Pontos relevantes:

- estrutura por bibliotecas/ferramentas;
- presets visualmente organizados;
- miniaturas que comunicam comportamento de animacao;
- layout mais denso, mas ainda organizado.

Licao para o projeto:

- se houver muitos presets, usar biblioteca filtravel, nao uma grade infinita de botoes.

### Motion State

Referencia para animacao procedural sem keyframes.

Pontos relevantes:

- comunicacao centrada em start/end frame;
- promessa de animacao em tempo real;
- sem keyframes, sem nests, sem sair do Premiere;
- foco em presets de motion como spring, overshoot e bounce.

Licao para o projeto:

- o modo procedural deve ser apresentado como estado/behavior aplicado ao clip, nao como curva de keyframe.

### Film Impact Motion Tween

Referencia para animacao sem keyframing manual e controles de curva/overshoot.

Pontos relevantes:

- curva visual para ajustar motion;
- parametros como frequency/amplitude em contexto de overshoot;
- abordagem baseada em efeito/transicao;
- performance e preview em tempo real como parte do valor.

Licao para o projeto:

- o modo procedural deve ter controles fisicos simples: amplitude, frequency, damping, duration.

## Estrutura recomendada do painel

Usar duas abas principais:

- Keyframes;
- Motion Presets.

### Aba Keyframes

Layout recomendado:

- header compacto com status da selecao;
- grafico de curva como elemento principal;
- presets de curva em linha inferior;
- botoes pequenos para Linear, Ease In, Ease Out, Ease In/Out e Bezier;
- seletor de propriedade alvo;
- area de apply/update/reset.

### Aba Motion Presets

Layout recomendado:

- header compacto com clip selecionado e duracao;
- seletor In / Out / Both;
- grade curta de presets;
- controles numericos/sliders para intensidade, duration, damping, frequency e overshoot;
- alvo de propriedade: Position, Scale, Rotation, Opacity;
- botoes Apply, Update e Remove.

## Iconografia

Estilo recomendado:

- icones lineares, minimalistas, 1.5px a 2px de stroke;
- cantos arredondados discretos;
- sem preenchimentos pesados;
- evitar icones ilustrativos demais;
- usar labels ou tooltips em acoes ambiguas.

Familias de icones adequadas:

- Spectrum Icons, quando disponiveis no ambiente Adobe;
- Lucide como referencia visual para prototipagem;
- icones proprios apenas para curvas, spring, overshoot e bounce.

Icones conceituais:

- Keyframes: diamante pequeno;
- Bezier: curva com dois handles;
- Spring: onda amortecida;
- Overshoot: curva ultrapassando o alvo e retornando;
- Bounce: curva com impactos decrescentes;
- In: seta entrando;
- Out: seta saindo;
- Both: duas setas opostas;
- Apply: check ou raio discreto;
- Update: seta circular;
- Remove: x ou lixeira.

## Cores

Base:

- fundo principal escuro neutro;
- paineis em cinza levemente elevado;
- bordas sutis;
- texto primario claro;
- texto secundario cinza.

Acentos:

- azul/ciano para selecao e curva ativa;
- verde discreto para Apply/sucesso;
- amarelo/laranja apenas para avisos;
- vermelho apenas para remover/destrutivo.

Evitar:

- paletas muito saturadas;
- gradientes decorativos;
- roxo dominante;
- botoes grandes demais;
- cards flutuantes desnecessarios.

## Pesos e espacamento

- densidade compacta, adequada a paineis laterais;
- altura de botoes entre 28 e 34 px;
- labels pequenos, mas legiveis;
- radius entre 4 e 8 px;
- grid de presets com miniaturas simples;
- evitar nested cards.

## Principio de produto

A interface deve parecer uma ferramenta de edicao profissional:

- rapida;
- precisa;
- discreta;
- visualmente clara;
- com feedback imediato sobre o clip selecionado;
- sem parecer landing page ou app separado do Premiere.
