# Premiere Motion Panel UXP

Versao inicial do painel UXP para Premiere Pro.

## Estado atual

`0.1.0` e um MVP de interface e diagnostico.

Inclui:

- abas Motion, Keyframes e Audio Sync;
- visual cinza/roxo alinhado ao Premiere;
- Motion presets como cards;
- editor Bezier manipulavel;
- biblioteca inicial de curvas;
- botao compacto de Audio Sync;
- tooltips em acoes importantes;
- painel Debug com logs copiaveis.

Ainda precisa validar/conectar no Premiere:

- leitura real dos clips selecionados na timeline;
- escrita real de keyframes/handles Bezier;
- aplicacao real do efeito nativo `Premiere Motion Engine`;
- sincronizacao real por waveform;
- reposicionamento seguro de clips/audios na timeline.

## Arquivos

```text
uxp-panel/
  manifest.json
  index.html
  styles.css
  src/
    app.js
    debug.js
    motionEngineBridge.js
    audioSyncBridge.js
```

## Teste local esperado

1. Carregar `uxp-panel/manifest.json` no UXP Developer Tool.
2. Abrir o painel no Premiere Pro.
3. Confirmar se a UI aparece.
4. Testar troca de abas.
5. Arrastar os handles amarelos do editor Bezier.
6. Clicar nas acoes e abrir `Debug`.
7. Copiar logs de erro/diagnostico para orientar a proxima implementacao.

## Observacao importante

Algumas acoes registram `api-missing` de proposito nesta fase. Isso nao significa que a UI falhou; significa que a funcao ainda precisa ser conectada a API real do Premiere ou ao motor nativo.
