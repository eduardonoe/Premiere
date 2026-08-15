# Parameter Contract

Este documento define como o painel UXP deve conversar com o motor procedural.

## Ideia central

O painel nao renderiza a animacao. O painel:

1. le o clip selecionado;
2. descobre timing e propriedades relevantes;
3. aplica ou localiza o efeito nativo `Premiere Motion Engine`;
4. escreve parametros no efeito;
5. o efeito calcula e renderiza a animacao em tempo real.

## Fluxo do painel

```text
Selecionar clip na timeline
  -> Refresh Selection
  -> Detectar clip, in, out e duracao
  -> Usuario escolhe preset e target
  -> Painel aplica/localiza efeito nativo
  -> Painel escreve parametros
  -> Engine renderiza sem keyframes
```

## Parametros principais

| UI | Parametro engine | Tipo | Observacao |
|---|---|---|---|
| Preset | `preset` | enum | Spring, Overshoot, Bounce, Pop, Slide |
| Trigger | `trigger` | enum | In, Out ou Both |
| Target | `target` | enum | Position, Scale, Rotation, Opacity, Transform |
| Axis | `axis` | enum | X, Y ou XY |
| Duration In | `durationFramesIn` | int | Duracao a partir do in do clip |
| Duration Out | `durationFramesOut` | int | Duracao antes do out do clip |
| Intensity | `amplitude` | float | Forca geral do movimento |
| Damping | `damping` | float | Amortecimento do spring/bounce |
| Frequency | `frequency` | float | Oscilacoes por intervalo |
| Overshoot | `overshoot` | float | Quanto passa do alvo |
| Position X | `positionX` | float | Offset ou alvo X conforme preset |
| Position Y | `positionY` | float | Offset ou alvo Y conforme preset |
| Scale | `scale` | float | Fator relativo, ex. 1.15 |
| Rotation | `rotationDegrees` | float | Graus relativos |
| Opacity | `opacity` | float | Valor relativo/absoluto conforme modo |
| Anchor X/Y | `anchorX`, `anchorY` | float | Origem da transformacao |

## Trigger In

Usa o inicio do clip como referencia.

```text
progress = clamp((frame - clipIn) / durationIn, 0, 1)
```

Exemplo: `Spring In` em Scale.

- no primeiro frame, scale parte do estado inicial do preset;
- durante `durationFramesIn`, spring converge para o estado normal;
- depois disso, valor fica estabilizado.

## Trigger Out

Usa o fim do clip como referencia.

```text
progress = clamp((clipOut - frame) / durationOut, 0, 1)
```

O motor deve inverter a leitura para que a animacao aconteca antes do fim do clip.

Exemplo: `Overshoot Out` em Position.

- antes da janela de saida, valor fica normal;
- durante `durationFramesOut`, o clip sai com overshoot;
- no ultimo frame, chega ao estado final do preset.

## Trigger Both

Executa duas janelas independentes:

- entrada baseada em `durationFramesIn`;
- saida baseada em `durationFramesOut`.

Se as janelas se sobrepuserem em clips curtos, o motor deve normalizar ou priorizar a janela mais proxima do frame atual.

## Metodo de acesso aos recursos

O painel UXP deve tratar o motor como um efeito aplicado ao clip.

Operacoes necessarias:

1. `findSelectedClips()`
   - retorna clips selecionados na sequencia ativa.

2. `findOrApplyMotionEngineEffect(clip)`
   - procura o efeito `Premiere Motion Engine` no clip;
   - se nao existir, aplica o efeito;
   - se existir, reaproveita.

3. `readMotionEngineParams(effect)`
   - le parametros atuais para popular a interface.

4. `writeMotionEngineParams(effect, params)`
   - escreve todos os parametros do preset selecionado.

5. `removeMotionEngineEffect(clip)`
   - remove apenas o efeito do motor, preservando outros efeitos.

6. `refreshClipTiming(clip)`
   - atualiza in/out/duracao usados pela UI e pelos parametros.

## Presets como dados

Presets nao devem ser hardcoded diretamente na UI.

Formato recomendado:

```json
{
  "id": "spring-scale-in",
  "label": "Spring Scale In",
  "preset": "Spring",
  "trigger": "In",
  "target": "Scale",
  "durationFramesIn": 14,
  "amplitude": 1.0,
  "damping": 0.55,
  "frequency": 3.0,
  "overshoot": 0.18,
  "scale": 1.12
}
```

O painel carrega presets, converte para `MotionParams` e escreve no efeito.

## Regras de seguranca

- Nunca criar keyframes para o modo procedural.
- Nunca alterar keyframes existentes neste modo.
- Nao remover efeitos do usuario.
- Permitir Update apenas no efeito identificado como `Premiere Motion Engine`.
- Se o efeito nao estiver instalado, exibir erro claro no painel.
- Se GPU nao estiver disponivel, avisar antes de usar fallback CPU.

## Validacao minima

O primeiro teste deve provar:

1. clip selecionado sem keyframes;
2. painel aplica efeito;
3. painel escreve parametros de `Spring Scale In`;
4. playback mostra animacao;
5. Effect Controls nao mostra keyframes criados;
6. Update muda damping/frequency sem reaplicar tudo;
7. Remove retira apenas o efeito do motor.
