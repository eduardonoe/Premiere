# Audio Sync Module

## Objetivo

Adicionar ao painel um modulo de sincronizacao de clips com audios externos, inspirado no fluxo do PluralEyes.

Fluxo desejado:

1. O usuario seleciona com o mouse todos os clips e audios na timeline.
2. O usuario clica em um botao do painel: `Sync Selected`.
3. O painel analisa os itens selecionados.
4. O motor calcula offsets por waveform/audio.
5. O painel reposiciona os clips na timeline.
6. O resultado e uma timeline sincronizada em lote, sem precisar sincronizar um par por vez.

## Escopo do modulo

Este modulo deve ser separado dos modos de Motion/Keyframe.

Abas sugeridas do painel:

- Motion Presets;
- Keyframes;
- Audio Sync.

## Problema que resolve

O Premiere possui sincronizacao por audio na interface, mas o fluxo de sincronizar muitos clips e muitos audios selecionados na timeline ainda e limitado e lento para edicoes com volume alto.

O objetivo e criar um botao de sincronizacao em lote direto na timeline.

## Direcao tecnica

Nao depender exclusivamente de chamar a funcao nativa `Clip > Synchronize`, porque a API publica pode nao expor essa acao de forma confiavel.

Caminho preferencial:

- UXP panel para UI e selecao;
- modulo nativo/worker para analise de audio;
- algoritmo proprio de waveform matching;
- reposicionamento dos clips na timeline via API disponivel;
- fallback por XML/FCPXML se a API de mover clips for insuficiente.

## Fluxo tecnico proposto

```text
Timeline selection
  -> UXP le clips selecionados
  -> Classifica video clips, camera audio e audios externos
  -> Resolve media paths / audio sources
  -> Audio Sync Engine extrai fingerprints
  -> Engine compara waveform/fingerprints
  -> Engine retorna offsets
  -> UXP aplica offsets na timeline
  -> Usuario revisa relatorio de confianca
```

## Componentes

### UXP Panel

Responsavel por:

- detectar clips selecionados;
- mostrar contagem de video/audio;
- iniciar sincronizacao;
- exibir progresso;
- exibir confianca por match;
- aplicar offsets;
- permitir desfazer/reverter quando possivel.

### Audio Sync Engine

Responsavel por:

- carregar audio dos arquivos ou proxies;
- reduzir audio para mono;
- normalizar sample rate;
- extrair envelope/transientes;
- calcular cross-correlation/fingerprint;
- encontrar melhor offset;
- retornar score de confianca.

### Timeline Apply Layer

Responsavel por:

- mover clips sincronizados;
- preservar tracks quando possivel;
- evitar sobrescrever material existente sem confirmacao;
- manter links entre video e audio quando existirem;
- aplicar label/color ou marker para indicar resultado.

## Parametros de UI

| Controle | Funcao |
|---|---|
| Sync Selected | sincroniza tudo que esta selecionado |
| Reference Mode | escolhe audio principal ou auto-detect |
| Min Confidence | score minimo para aplicar automaticamente |
| Move Mode | mover videos para audio, mover audios para videos ou preservar audio principal |
| Track Strategy | manter tracks, agrupar por camera ou compactar resultado |
| Add Markers | adicionar markers nos clips sincronizados |
| Dry Run | calcular sem mover nada |
| Apply | aplicar offsets calculados |
| Revert Last Sync | desfazer ultimo sync quando possivel |

## Modos de sincronizacao

### Auto

O motor tenta identificar o melhor audio de referencia e sincroniza os demais itens selecionados.

### External Audio as Reference

O usuario seleciona audios externos como referencia. Clips de camera se alinham a eles.

### Camera Audio as Reference

Um clip de camera serve como referencia principal. Audios externos se alinham a ele.

### Multicam Prep

Gera uma organizacao adequada para criar multicam depois, sem necessariamente criar multicam automaticamente na primeira versao.

## Algoritmo inicial

Primeira versao do motor:

1. extrair audio mono em baixa resolucao;
2. criar envelope RMS por janelas curtas;
3. detectar transientes/picos;
4. calcular cross-correlation entre referencia e candidato;
5. encontrar offset de maior score;
6. validar score com margem contra segundo melhor candidato;
7. retornar offset em frames/ticks.

Versoes futuras podem usar fingerprint mais robusto para material com ruido, camera distante ou microfone ruim.

## Resultado esperado do engine

```json
{
  "referenceClipId": "audio-001",
  "matches": [
    {
      "clipId": "video-003",
      "offsetFrames": -132,
      "confidence": 0.91,
      "status": "matched"
    },
    {
      "clipId": "video-004",
      "offsetFrames": 48,
      "confidence": 0.42,
      "status": "review"
    }
  ]
}
```

## Regras de seguranca

- Nunca mover clips automaticamente com baixa confianca sem revisao.
- Oferecer Dry Run antes de Apply.
- Preservar estrutura de tracks por padrao.
- Nao deletar audios de camera na primeira versao.
- Nao criar multicam automaticamente na primeira versao.
- Gerar relatorio com clips sincronizados, duvidosos e sem match.

## Validacao minima

### Prototipo A: leitura de selecao

1. Selecionar varios clips e audios na timeline.
2. Painel listar contagem e tipo dos itens.
3. Painel detectar duracao, track e media path quando possivel.

### Prototipo B: analise externa

1. Exportar/ler audio de dois arquivos conhecidos.
2. Calcular offset por waveform.
3. Confirmar offset com erro menor que 1 frame em material simples com clap.

### Prototipo C: aplicar na timeline

1. Calcular offset.
2. Mover um clip selecionado para alinhar ao audio de referencia.
3. Preservar track e link quando possivel.
4. Reverter a acao.

### Prototipo D: lote

1. Selecionar 5 videos e 1 audio externo.
2. Rodar Dry Run.
3. Revisar scores.
4. Aplicar apenas matches acima do limite.

## Riscos conhecidos

- A API UXP pode nao expor todas as operacoes de mover clips na timeline com seguranca.
- A API pode nao permitir chamar diretamente a funcao nativa Synchronize.
- Acesso a audio/waveform pode exigir ler arquivos de midia fora do Premiere.
- Materiais com audio ruim, musica alta, ruido ou cortes podem exigir algoritmo mais robusto.
- Timeline com clips sobrepostos pode exigir estrategia de track para evitar colisao.

## Caminhos de fallback

Se mover clips diretamente pela API nao for confiavel:

- gerar XML/FCPXML sincronizado e reimportar;
- criar uma nova sequencia sincronizada;
- exportar relatorio de offsets para aplicacao manual assistida;
- usar markers/labels para indicar offsets calculados.

## Prioridade

Este modulo e valioso, mas tem risco tecnico alto. Deve ser validado antes de integrar visualmente ao painel final.

Primeira meta real: provar selecao em lote + leitura de audio + offset correto + reposicionamento de um clip.
