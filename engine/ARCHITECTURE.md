# GPU Engine Architecture

## Conclusao da pesquisa

Para animacao procedural leve no Premiere Pro, o caminho correto e um plugin nativo de efeito/transicao usando o Premiere Pro C++ SDK e as extensoes GPU da pipeline Mercury.

O painel UXP deve ser apenas a camada de controle. Ele nao deve renderizar frames nem recalcular animacao frame a frame.

## Por que nao apenas UXP

UXP e adequado para:

- UI;
- selecao de clips;
- leitura/escrita de parametros;
- aplicacao de efeitos/presets;
- comunicacao com APIs do Premiere.

UXP nao e adequado como motor procedural de playback porque:

- nao renderiza pixels na pipeline de video;
- nao deve atualizar valores a cada frame;
- nao garante aceleracao GPU;
- nao substitui efeito/transicao nativo.

## Modelo proposto

```text
Premiere timeline
  -> Clip selecionado
  -> Painel UXP aplica/configura efeito
  -> Efeito nativo recebe tempo atual
  -> Engine calcula motion procedural
  -> Backend CUDA/Metal renderiza frame
  -> Premiere exibe/exporta pela pipeline GPU
```

## Tipos de plugin a validar

### Efeito de video

Bom para aplicar a um clip inteiro e animar usando in/out internos.

Vantagens:

- fica no Effect Controls;
- pode ter parametros persistentes;
- pode afetar Position, Scale, Rotation e Opacity proceduralmente;
- bom para presets in/out no mesmo clip.

Riscos:

- precisa calcular transformacao sem depender do Motion nativo;
- pode exigir desenho proprio do frame transformado.

### Transicao

Boa para motion entre cortes ou estados A/B.

Vantagens:

- modelo natural para Motion Tween;
- tempo relativo da transicao ja existe;
- boa para efeitos entre segmentos.

Riscos:

- menos natural para animacao no in/out de um unico clip;
- pode exigir cortes no clip ou aplicacao em bordas.

## Decisao inicial

Comecar por efeito de video procedural aplicado ao clip selecionado.

Motivo:

- casa melhor com presets In, Out e Both;
- permite Update/Remove pelo painel;
- evita obrigar o usuario a cortar o clip para animar.

Depois validar uma variante de transicao para casos estilo Motion Tween.

## Pipeline de parametros

O painel UXP deve aplicar/configurar parametros do efeito:

- preset;
- trigger;
- target;
- durationFrames;
- amplitude;
- damping;
- frequency;
- overshoot;
- axis;
- transform origin;
- enabled flags.

O efeito nativo deve guardar esses parametros e renderizar em tempo real.

## GPU strategy

### CUDA

Backend principal para Windows com NVIDIA.

- usar CUDA Driver API quando viavel;
- evitar dependencia rigida de CUDA Runtime;
- mirar compatibilidade com GPUs modernas;
- validar conforme recomendacao do Premiere SDK.

### Metal

Backend principal para macOS.

- usar kernels Metal;
- validar Apple Silicon e Macs Intel suportados pela versao atual do Premiere.

### CPU reference

Apenas para:

- validar formulas;
- testar presets;
- comparar saida esperada;
- fallback temporario durante desenvolvimento.

Nao deve ser o caminho principal do produto.

## Primeiras funcoes do motor

- calcular progresso normalizado;
- aplicar trigger In, Out ou Both;
- avaliar curvas spring, overshoot e bounce;
- montar matriz 2D de transformacao;
- samplear input com bilinear filtering;
- compor opacity;
- manter alpha corretamente.

## Criterios de sucesso

- efeito aplicado ao clip sem keyframes visiveis;
- playback responsivo em 1080p e 4K;
- scrub sem travar;
- parametros atualizados pelo painel;
- export bate com preview;
- GPU ativa em renderer acelerado;
- fallback/erro claro quando GPU nao estiver disponivel.
