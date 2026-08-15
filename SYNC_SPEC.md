# Audio Sync Module

## Objetivo

Adicionar ao painel um modulo de sincronizacao de clips com audios externos, inspirado no fluxo do PluralEyes, mas com uma regra de organizacao mais rigida: a ordem sequencial dos clips de video existente antes do processo deve ser preservada.

Fluxo desejado:

1. O usuario seleciona com o mouse todos os clips de video e audios na timeline.
2. O usuario clica em `Sync Selected`.
3. O painel analisa os itens selecionados.
4. O motor calcula relacoes por waveform/audio.
5. O painel move clips e/ou audios conforme o plano de sync.
6. Os clips de video podem mudar de tempo na timeline, mas nao podem trocar de ordem entre si.

## Regra principal de organizacao

A sequencia relativa dos clips de video e a referencia editorial.

O modulo de sync pode deslocar videos no tempo quando isso for necessario para sincronizar, mas nao deve reordenar, embaralhar ou compactar videos de forma que a ordem original seja perdida.

Em outras palavras:

```text
Ordem original dos videos = estrutura principal
Tempo absoluto dos videos = pode ser ajustado pelo sync
Audio externo = material que se alinha a essa estrutura
```

Exemplo:

```text
Antes do sync:
video_001 -> video_002 -> video_003 -> video_004

Depois do sync permitido:
video_001 -> video_002 -> video_003 -> video_004
(com novos tempos/espacamentos)

Depois do sync proibido:
video_001 -> video_003 -> video_002 -> video_004
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

- manter `video_001`, `video_002`, `video_003`, `video_004` na mesma ordem relativa em que ja estavam;
- permitir deslocar o bloco ou os videos no tempo para sincronizar;
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
- reposicionamento controlado de clips e audios na timeline via API disponivel;
- fallback por XML/FCPXML se a API de mover/duplicar/cortar audio for insuficiente.

## Fluxo tecnico proposto

```text
Timeline selection
  -> UXP le clips selecionados
  -> Classifica videos, camera audio e audios externos
  -> Ordena videos por posicao atual na timeline
  -> Salva essa ordem como regra bloqueada
  -> Resolve media paths / audio sources
  -> Audio Sync Engine extrai fingerprints
  -> Engine compara waveform/fingerprints
  -> Engine associa audios aos videos
  -> Engine calcula novo plano de tempos preservando ordem
  -> UXP aplica deslocamentos/cortes conforme plano
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
- aplicar plano de deslocamento;
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
- associar muitos videos pequenos a um audio longo quando for o caso;
- calcular um plano que preserve a ordem relativa dos videos.

### Timeline Apply Layer

Responsavel por:

- preservar a ordem relativa dos videos;
- mover videos quando necessario, sem trocar sua sequencia;
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
| Reference Structure | ordem sequencial dos videos selecionados |
| Reference Audio | auto-detect ou audio escolhido pelo usuario |
| Min Confidence | score minimo para aplicar automaticamente |
| Move Mode | mover audios, mover videos preservando ordem ou mover ambos como plano |
| Long Audio Handling | manter inteiro, cortar por video ou duplicar referencia |
| Track Strategy | manter tracks, criar track de sync ou agrupar por origem |
| Preserve Video Order | sempre ativo por padrao |
| Add Markers | adicionar markers nos clips sincronizados |
| Dry Run | calcular sem mover nada |
| Apply | aplicar plano calculado |
| Revert Last Sync | desfazer ultimo sync quando possivel |

## Modos de sincronizacao

### Video Order Locked

Modo padrao.

- videos mantem a mesma ordem relativa;
- videos podem se deslocar no tempo;
- audios se movem/cortam para sincronizar;
- nenhuma operacao pode fazer um video ultrapassar outro na sequencia.

### Long Audio to Many Videos

Modo para um audio longo associado a muitos videos curtos.

- o audio longo e usado como referencia;
- cada video e comparado contra trechos do audio longo;
- o motor retorna pontos de entrada no audio;
- a timeline aplica deslocamentos, cortes, duplicatas ou segmentos conforme permissao;
- a ordem relativa dos videos continua preservada.

### External Audio as Reference

Audios externos servem como fonte principal de waveform, mas a organizacao final respeita a ordem dos videos.

### Camera Audio as Reference

Audio de camera dos videos serve como base para alinhar audio externo.

### Multicam Prep

Gera uma organizacao adequada para criar multicam depois, mas sem criar multicam automaticamente na primeira versao.

## Algoritmo inicial

Primeira versao do motor:

1. ordenar os videos selecionados por `timelineStart` e guardar `videoOrderIndex`;
2. extrair audio mono de camera de cada video quando disponivel;
3. extrair audio mono dos audios externos;
4. criar envelope RMS por janelas curtas;
5. detectar transientes/picos;
6. para cada video, procurar o melhor trecho correspondente no audio externo;
7. calcular offset de sync de cada video/audio;
8. gerar um plano de novos tempos preservando `videoOrderIndex`;
9. detectar conflitos onde um video ultrapassaria outro;
10. validar score com margem contra segundo melhor candidato;
11. retornar plano de sync sem alterar timeline.

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
      "videoOrderIndex": 0,
      "audioClipId": "audio-long-001",
      "audioSourceInFrames": 1830,
      "newVideoStartFrames": 120,
      "confidence": 0.94,
      "status": "matched"
    },
    {
      "videoClipId": "video-002",
      "videoOrderIndex": 1,
      "audioClipId": "audio-long-001",
      "audioSourceInFrames": 4210,
      "newVideoStartFrames": 520,
      "confidence": 0.89,
      "status": "matched"
    },
    {
      "videoClipId": "video-003",
      "videoOrderIndex": 2,
      "audioClipId": "audio-long-001",
      "confidence": 0.41,
      "status": "review"
    }
  ]
}
```

## Regras de seguranca

- Nunca reordenar videos automaticamente.
- Nunca permitir que um video ultrapasse outro na ordem original.
- Videos podem mudar de tempo, desde que mantenham a ordem relativa.
- Nunca mover clips automaticamente com baixa confianca sem revisao.
- Oferecer Dry Run antes de Apply.
- Preservar estrutura de tracks por padrao.
- Nao deletar audios de camera na primeira versao.
- Nao criar multicam automaticamente na primeira versao.
- Gerar relatorio com clips sincronizados, duvidosos e sem match.
- Se houver colisao em tracks, criar plano de tracks antes de aplicar.

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
3. Confirmar que o plano preserva a ordem original dos videos.
4. Confirmar que o engine associa trechos do audio longo a cada video.

### Prototipo D: aplicar na timeline

1. Calcular plano de sync.
2. Mover videos e/ou audios conforme necessario.
3. Preservar tracks e ordem relativa dos videos.
4. Reverter a acao.

### Prototipo E: lote

1. Selecionar muitos videos e audios.
2. Rodar Dry Run.
3. Revisar scores.
4. Aplicar apenas matches acima do limite.
5. Confirmar que nenhum video mudou de ordem relativa.

## Riscos conhecidos

- A API UXP pode nao expor todas as operacoes de mover, cortar ou duplicar audios/clips na timeline com seguranca.
- A API pode nao permitir chamar diretamente a funcao nativa Synchronize.
- Acesso a audio/waveform pode exigir ler arquivos de midia fora do Premiere.
- Materiais com audio ruim, musica alta, ruido ou cortes podem exigir algoritmo mais robusto.
- Timeline com audios sobrepostos pode exigir estrategia de track para evitar colisao.
- Audio longo associado a muitos videos exige cuidado para nao criar uma timeline visualmente poluida.

## Caminhos de fallback

Se mover/cortar audio diretamente pela API nao for confiavel:

- gerar XML/FCPXML sincronizado e reimportar;
- criar uma nova sequencia sincronizada preservando ordem relativa de videos;
- exportar relatorio de offsets para aplicacao manual assistida;
- usar markers/labels para indicar offsets calculados.

## Prioridade

Este modulo e valioso, mas tem risco tecnico alto. Deve ser validado antes de integrar visualmente ao painel final.

Primeira meta real: provar selecao em lote + leitura de audio + offset correto + reposicionamento sem inverter a ordem dos videos.
