# Premiere Motion Panel UXP

Versao inicial do painel UXP para Premiere Pro.

## Estado atual

`0.1.1` e um MVP de interface e diagnostico tecnico.

Inclui:

- abas Motion, Keyframes e Audio Sync;
- visual cinza/roxo alinhado ao Premiere;
- Motion presets como cards;
- editor Bezier manipulavel;
- biblioteca inicial de curvas;
- botao compacto de Audio Sync;
- tooltips em acoes importantes;
- painel Debug com logs copiaveis;
- probe da API UXP do Premiere para validar projeto, sequencia, tracks e selecao da timeline.

Ainda precisa validar/conectar no Premiere:

- shape real dos itens retornados por `sequence.getSelection()`;
- leitura real de clips selecionados como descritores internos;
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
    premiereApiProbe.js
    motionEngineBridge.js
    audioSyncBridge.js
```

## Teste local esperado

1. Usar Premiere Pro 25.6 ou superior.
2. Ativar Developer Mode em `Settings > Plugins > Enable developer mode` e reiniciar o Premiere.
3. Carregar `uxp-panel/manifest.json` no UXP Developer Tool.
4. Abrir o painel no Premiere Pro.
5. Confirmar se a UI aparece.
6. Selecionar um ou mais clips na timeline.
7. Clicar `Refresh`.
8. Abrir `Debug` e copiar o log `selection.refresh.probe`.
9. Testar troca de abas.
10. Arrastar os handles amarelos do editor Bezier.
11. Clicar nas acoes e copiar logs de erro/diagnostico para orientar a proxima implementacao.

## Observacao importante

Algumas acoes ainda registram `api-missing` de proposito nesta fase. Isso nao significa que a UI falhou; significa que a funcao ainda precisa ser conectada a API real do Premiere ou ao motor nativo.

O `Refresh` agora tenta usar o caminho oficial do Premiere UXP:

```javascript
const ppro = require('premierepro');
const project = await ppro.Project.getActiveProject();
const sequence = await project.getActiveSequence();
const selection = await sequence.getSelection();
```

Esse log e a base para decidir a proxima implementacao sem chute.
