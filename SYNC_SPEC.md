# Audio Sync Module

## Objetivo

Adicionar ao painel um modulo de sincronizacao de clips com audios externos, inspirado no fluxo do PluralEyes, mas com uma regra de organizacao mais rigida: a ordem dos clips de video na timeline deve ser preservada.

Fluxo desejado:

1. O usuario seleciona com o mouse todos os clips de video e audios na timeline.
2. O usuario clica em `Sync Selected`.
3. O painel analisa os itens selecionados.
4. O motor calcula relacoes por waveform/audio.
5. O painel move ou organiza os audios para corresponderem aos videos.
6. Os clips de video permanecem na mesma ordem sequencial da timeline.

## Regra principal de organizacao

A sequencia dos clips de video e a referencia editorial.

O modulo de sync nao deve reordenar, embaralhar, compactar ou deslocar os clips de video por padrao. Os audios devem se alinhar aos videos, nao o contrario.

Em outras palavras:

```text
Video timeline = estrutura principal
Audio externo = material que se adapta a essa estrutura
```

Esta regra existe para evitar o problema comum de ferramentas de sync em lote que ate sincronizam parte do material, mas baguncam a organizacao geral da timeline.

## Cenario comum importante

Um unico audio longo pode estar associado a muitos pequenos clips de video.

Exemplo:

```text
AUDIO_LONGO_001.wav
  -> video_001.mp4
  -> video_002.mp4
  -> video_003.mp4
  -> video_004.mp4
```

Nesse caso, o resultado esperado nao e duplicar caos nem reorganizar os videos. O motor deve reconhecer que varios videos pertencem a diferentes trechos do mesmo audio longo.

A aplicacao deve:

- manter `video_001`, `video_002`, `video_003`, `video_004` na ordem em que ja estao;
- posicionar o audio longo de forma coerente com essa sequencia;
- quando necessario, criar cortes/segmentos/referencias do audio para acompanhar cada video;
- preservar uma organizacao visual clara por tracks.

## Escopo do modulo

Este modulo deve ser separado dos modos de Motion/Keyframe.

Abas sugeridas do painel:

- Motion Presets;
- Keyframes;
- Audio Sync.

## Problema que resolve

O Premiere possui sincronizacao por audio na interface, mas o fluxo de sincronizar muitos clips e muitos audios selecionados na timeline ainda e limitado e lento para edicoes com volume alto.

O objetivo e criar um botao de sincronizacao em lote direto na timeline, preservando a ordem editorial dos videos.

## Direcao tecnica

Nao depender exclusivamente de chamar a funcao nativa `Clip > Synchronize`, porque a API publica pode nao expor essa acao de forma confiavel.

Caminho preferencial:

- UXP panel para UI e selecao;
- modulo nativo/worker para analise de audio;
- algoritmo proprio de waveform matching;
- reposicionamento prioritario dos audios na timeline via API disponivel;
- fallback por XML/FCPXML se a API de mover/duplicar/cortar audio for insuficiente.

## Fluxo tecnico proposto

```text
Timeline selection
  -> UXP le clips selecionados
  -> Classifica videos, camera audio e audios externos
  -> Ordena videos por posicao atual na timeline
  -> Trata essa ordem como bloqueada
  -> Resolve media paths / audio sources
  -> Audio Sync Engine extrai fingerprints
  -> Engine compara waveform/fingerprints
  -> Engine associa audios aos videos
  -> UXP aplica offsets/cortes nos audios
  -> Usuario revisa relatorio de confianca
```

## Componentes

### UXP Panel

Responsavel por:

- detectar clips selecionados;
- mostrar contagem de video/audio;
- mostrar a ordem dos videos detectados;
- iniciar sincronizacao;
- exibir progresso;
- exibir confianca por match;
- aplicar offsets nos audios;
- permitir desfazer/reverter quando possivel.

### Audio Sync Engine

Responsavel por:

- carregar audio dos arquivos ou proxies;
- reduzir audio para mono;
- normalizar sample rate;
- extrair envelope/transientes;
- calcular cross-correlation/fingerprint;
- encontrar offset entre audio de camera e audio externo;
- retornar score de confianca;
- associar muitos videos pequenos a um audio longo quando for o caso.

### Timeline Apply Layer

Responsavel por:

- preservar a ordem e a posicao relativa dos videos;
- mover audios para alinhar com os videos;
- cortar/segmentar audio longo quando necessario e permitido;
- preservar tracks quando possivel;
- evitar sobrescrever material existente sem confirmacao;
- manter links entre video e audio quando existirem;
- aplicar label/color ou marker para indicar resultado.

## Parametros de UI

| Controle | Funcao |
|---|---|
| Sync Selected | sincroniza tudo que esta selecionado |
| Reference Structure | videos selecionados como estrutura principal |
| Reference Audio | auto-detect ou audio escolhido pelo usuario |
| Min Confidence | score minimo para aplicar automaticamente |
| Move Mode | por padrao, mover audio para videos |
| Long Audio Handling | manter inteiro, cortar por video ou duplicar referencia |
| Track Strategy | manter tracks, criar track de sync ou agrupar por origem |
| Preserve Video Order | sempre ativo por padrao |
| Add Markers | adicionar markers nos clips sincronizados |
| Dry Run | calcular sem mover nada |
| Apply | aplicar offsets calculados |
| Revert Last Sync | desfazer ultimo sync quando possivel |

## Modos de sincronizacao

### Video Order Locked

Modo padrao.

- videos ficam em sua ordem atual;
- audios se movem para sincronizar;
- nenhum video e reposicionado automaticamente.

### Long Audio to Many Videos

Modo para um audio longo associado a muitos videos curtos.

- o audio longo e usado como referencia;
- cada video e comparado contra trechos do audio longo;
- o motor retorna pontos de entrada no audio;
- a timeline aplica cortes, duplicatas ou segmentos conforme permissao.

### External Audio as Reference

Audios externos servem como fonte principal de waveform, mas ainda se adaptam a ordem dos videos.

### Camera Audio as Reference

Audio de camera dos videos serve como base para alinhar audio externo.

### Multicam Prep

Gera uma organizacao adequada para criar multicam depois, mas sem criar multicam automaticamente na primeira versao.

## Algoritmo inicial

Primeira versao do motor:

1. ordenar os videos selecionados por `timelineStart`;
2. extrair audio mono de camera de cada video quando disponivel;
3. extrair audio mono dos audios externos;
4. criar envelope RMS por janelas curtas;
5. detectar transientes/picos;
6. para cada video, procurar o melhor trecho correspondente no audio externo;
7. calcular offset do audio em relacao a posicao atual do video;
8. validar score com margem contra segundo melhor candidato;
9. retornar plano de sync sem alterar timeline.

Versoes futuras podem usar fingerprint mais robusto para material com ruido, camera distante ou microfone ruim.

## Resultado esperado do engine

```json
{
  "mode": "video_order_locked",
  "videoOrderPreserved": true,
  "referenceAudioId": "audio-long-001",
  "matches": [
    {
      "videoClipId": "video-001",
      "audioClipId": "audio-long-001",
      "audioSourceInFrames": 1830,
      "timelineTargetStartFrames": 120,
      "confidence": 0.94,
      "status": "matched"
    },
    {
      "videoClipId": "video-002",
      "audioClipId": "audio-long-001",
      "audioSourceInFrames": 4210,
      "timelineTargetStartFrames": 520,
      "confidence": 0.89,
      "status": "matched"
    },
    {
      "videoClipId": "video-003",
      "audioClipId": "audio-long-001",
      "confidence": 0.41,
      "status": "review"
    }
  ]
}
```

## Regras de seguranca

- Nunca reordenar videos automaticamente.
- Nunca mover clips de video no modo padrao.
- Nunca mover clips automaticamente com baixa confianca sem revisao.
- Oferecer Dry Run antes de Apply.
- Preservar estrutura de tracks por padrao.
- Nao deletar audios de camera na primeira versao.
- Nao criar multicam automaticamente na primeira versao.
- Gerar relatorio com clips sincronizados, duvidosos e sem match.
- Se houver colisao de audio em tracks, criar plano de tracks antes de aplicar.

## Validacao minima

### Prototipo A: leitura de selecao

1. Selecionar varios clips e audios na timeline.
2. Painel listar contagem e tipo dos itens.
3. Painel detectar duracao, track e media path quando possivel.
4. Painel exibir videos em ordem sequencial de timeline.

### Prototipo B: analise externa

1. Ler audio de um video e um audio externo conhecidos.
2. Calcular offset por waveform.
3. Confirmar offset com erro menor que 1 frame em material simples com clap.

### Prototipo C: audio longo para muitos videos

1. Selecionar 5 videos curtos e 1 audio longo.
2. Rodar Dry Run.
3. Confirmar que os videos permanecem na ordem original.
4. Confirmar que o engine associa trechos do audio longo a cada video.

### Prototipo D: aplicar na timeline

1. Calcular plano de sync.
2. Mover/cortar apenas audio para alinhar aos videos.
3. Preservar tracks e ordem de video.
4. Reverter a acao.

### Prototipo E: lote

1. Selecionar muitos videos e audios.
2. Rodar Dry Run.
3. Revisar scores.
4. Aplicar apenas matches acima do limite.
5. Confirmar que nenhum video mudou de ordem.

## Riscos conhecidos

- A API UXP pode nao expor todas as operacoes de mover, cortar ou duplicar audios na timeline com seguranca.
- A API pode nao permitir chamar diretamente a funcao nativa Synchronize.
- Acesso a audio/waveform pode exigir ler arquivos de midia fora do Premiere.
- Materiais com audio ruim, musica alta, ruido ou cortes podem exigir algoritmo mais robusto.
- Timeline com audios sobrepostos pode exigir estrategia de track para evitar colisao.
- Audio longo associado a muitos videos exige cuidado para nao criar uma timeline visualmente poluida.

## Caminhos de fallback

Se mover/cortar audio diretamente pela API nao for confiavel:

- gerar XML/FCPXML sincronizado e reimportar;
- criar uma nova sequencia sincronizada preservando ordem de videos;
- exportar relatorio de offsets para aplicacao manual assistida;
- usar markers/labels para indicar offsets calculados.

## Prioridade

Este modulo e valioso, mas tem risco tecnico alto. Deve ser validado antes de integrar visualmente ao painel final.

Primeira meta real: provar selecao em lote + leitura de audio + offset correto + reposicionamento de audio sem mover videos.
