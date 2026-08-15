# Motion Engine

Motor procedural para animacoes sem keyframes no Premiere Pro.

## Papel no produto

O painel UXP deve controlar selecao, presets e parametros. Este motor deve renderizar a animacao durante playback/export usando a pipeline acelerada do Premiere sempre que possivel.

Separacao desejada:

- `uxp-panel/`: interface, selecao do clip, presets e aplicacao de parametros;
- `engine/`: matematica procedural, contrato de parametros e backends GPU;
- `engine/cuda/`: backend Windows/NVIDIA;
- `engine/metal/`: backend macOS/Apple Silicon/AMD via Metal;
- `engine/include/`: structs e funcoes comuns.

## Decisao tecnica atual

O modo sem keyframes nao deve ser implementado como script que cria varios keyframes. O caminho correto e um efeito/transicao/plugin nativo que avalia o tempo relativo do clip em cada frame e transforma Position, Scale, Rotation e Opacity proceduralmente.

UXP sozinho nao deve ser considerado motor de render.

## Backends alvo

- CUDA para Windows/NVIDIA;
- Metal para macOS;
- CPU reference apenas para validacao matematica e fallback de desenvolvimento.

OpenCL nao deve ser usado como base moderna do projeto.

## Primeira meta

Criar um efeito minimo chamado `Premiere Motion Engine` que:

1. recebe o frame atual do Premiere;
2. recebe parametros do preset;
3. calcula progresso relativo baseado em in/out/duration;
4. aplica transformacao 2D procedural;
5. renderiza com GPU;
6. aparece no playback sem keyframes visiveis no clip.

## Presets iniciais

- Spring In;
- Spring Out;
- Overshoot In;
- Overshoot Out;
- Bounce In;
- Bounce Out;
- Pop Scale;
- Slide Spring;
- Rotate Overshoot.

## Observacao

Esta pasta define a arquitetura e o nucleo matematico. A integracao final precisa partir dos samples GPU do Premiere Pro SDK, especialmente exemplos de efeito/transicao com CUDA/Metal.