# Technical Validation

## Objetivo desta etapa

Validar o caminho real para um painel UXP de Premiere que controla:

1. keyframes e curvas Bezier;
2. animacoes procedurais sem keyframes aparentes;
3. sincronizacao de audio em lote preservando a ordem sequencial dos videos.

Esta etapa nao deve priorizar visual. O objetivo e descobrir quais APIs existem no Premiere instalado e onde sera necessario motor nativo, fallback ou mudanca de arquitetura.

## Conclusao atual

O painel UXP deve ser tratado como interface e camada de controle. Ele nao deve ser o motor de playback/render.

Para o modo procedural sem keyframes, o caminho tecnicamente coerente e um efeito/transicao nativo baseado no Premiere Pro C++ SDK, com extensoes GPU da pipeline Mercury quando disponiveis.

## Matriz de viabilidade

| Area | UXP puro | Exige nativo/SDK C++ | Observacao |
|---|---:|---:|---|
| UI do painel | Sim | Nao | Abas, sliders, biblioteca de presets, editor Bezier e Debug. |
| Ler projeto ativo | Sim, Premiere UXP 25.6+ | Nao | Caminho esperado: `require('premierepro')`, `Project.getActiveProject()`. |
| Ler sequencia ativa | Sim, Premiere UXP 25.6+ | Nao | Caminho esperado: `project.getActiveSequence()`. |
| Ler selecao da timeline | Provavel, Premiere UXP 25.6+ | Nao para leitura | Caminho esperado: `sequence.getSelection()`. Precisa validar shape real do objeto retornado. |
| Ler in/out/duracao de clips | Provavel | Nao para leitura | Depende dos objetos retornados por `TrackItemSelection`. Validar nomes reais de propriedades/metodos. |
| Aplicar/localizar efeito no clip | Provavel | O efeito em si exige nativo | UXP deve procurar/aplicar o efeito `Premiere Motion Engine` e escrever parametros. |
| Animacao procedural sem keyframes | Nao | Sim | UXP nao renderiza frames nem participa da pipeline Mercury. |
| GPU/nativo | Nao | Sim | Deve usar efeito/transicao com caminho GPU e fallback CPU claro. |
| Keyframes basicos | Possivel | Nao necessariamente | A API precisa ser validada para leitura/escrita de keyframes reais. |
| Handles Bezier completos | Incerto | Talvez | Se a API expuser apenas tipos de interpolacao, o editor visual sera limitado ou precisara fallback. |
| Analise waveform/audio | Nao recomendado | Sim/worker externo | UXP pode acionar, mas nao deve fazer analise pesada. |
| Mover/cortar/duplicar clips para sync | Incerto | Nao para calculo; talvez fallback XML | Precisa validar APIs de mutacao de timeline e colisao de tracks. |

## APIs oficiais a validar primeiro

O probe `uxp-panel/src/premiereApiProbe.js` testa o caminho minimo:

```javascript
const ppro = require('premierepro');
const project = await ppro.Project.getActiveProject();
const sequence = await project.getActiveSequence();
const selection = await sequence.getSelection();
```

Tambem tenta registrar:

- disponibilidade de `require('premierepro')`;
- chaves/metodos expostos pelo modulo;
- projeto ativo;
- sequencia ativa;
- contagem de tracks de video/audio;
- shape inicial do objeto de selecao;
- metodos/propriedades aparentes para itens selecionados.

## Como testar no Premiere

1. Usar Premiere Pro 25.6 ou superior.
2. Ativar Developer Mode em `Settings > Plugins > Enable developer mode` e reiniciar o Premiere.
3. Carregar `uxp-panel/manifest.json` no UXP Developer Tool.
4. Abrir um projeto com uma sequencia ativa.
5. Selecionar clips na timeline.
6. Clicar `Refresh` no painel.
7. Abrir `Debug`, clicar `Copy` e salvar o JSON retornado.

## O que decidir a partir do log

### Se `require("premierepro")` falhar

O painel esta carregando em contexto errado, a versao do Premiere/UDT nao suporta essa API, ou o manifesto precisa de ajuste.

### Se projeto/sequencia falhar

Validar se ha projeto aberto e sequencia ativa. Se ainda falhar, comparar com os exemplos oficiais `AdobeDocs/uxp-premiere-pro-samples`, especialmente o sample `premiere-api`.

### Se `sequence.getSelection()` falhar

A leitura contextual da timeline fica bloqueada. Nesse caso, os modos Motion, Keyframes e Audio Sync precisam de fallback por selecao indireta, markers, XML/FCPXML ou fluxo alternativo.

### Se a selecao for lida

O proximo passo minimo e mapear `TrackItemSelection` para descritores internos:

```json
{
  "id": "...",
  "type": "video | audio | linked_av",
  "trackIndex": 0,
  "startTicks": "...",
  "endTicks": "...",
  "inTicks": "...",
  "outTicks": "...",
  "durationTicks": "...",
  "mediaPath": "...",
  "hasAudio": true
}
```

Com isso validado, o painel pode avancar para:

1. localizar/aplicar o efeito nativo `Premiere Motion Engine`;
2. escrever parametros sem criar keyframes;
3. ler keyframes reais para o modo Bezier;
4. montar dry-run de Audio Sync preservando ordem dos videos.

## Decisao de arquitetura para o modo Motion

O modo Motion deve seguir este desenho:

```text
UXP Panel
  -> le selecao e timing do clip
  -> aplica/localiza efeito nativo
  -> escreve MotionParams
  -> efeito nativo renderiza via Mercury/GPU
```

O painel nao deve tentar animar frame a frame, criar keyframes escondidos, duplicar clips ou usar workaround pesado para fingir animacao procedural.

## Proximo passo recomendado

Depois de receber um log real do `Refresh`, implementar `findSelectedClips()` e `findSelectedTimelineItems()` usando o shape confirmado por `TrackItemSelection`.

Sem esse log, qualquer implementacao mais ambiciosa corre risco de ser bonita por fora e falsa por dentro.
