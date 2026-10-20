---
name: premiere-bridge
description: Controlar o Adobe Premiere Pro pelo MCP "premiere-bridge" (premiere_run, premiere_status, premiere_frame). Use sempre que a tarefa envolver ler ou alterar projeto, sequencia, clipes, efeitos ou keyframes no Premiere.
---

# Premiere Bridge

MCP proprio: painel CEP "PR MCP Bridge" dentro do Premiere serve HTTP em
127.0.0.1:47300 com token (`%APPDATA%\prmcp\token`); o servidor MCP roda via stdio.
Sem daemon: o painel so existe com o Premiere aberto.

## Ferramentas

- `premiere_status` — comece por aqui: versao, projeto, sequencia ativa, playhead.
- `premiere_run` — ExtendScript livre (DOM + QE). O codigo e corpo de funcao: use `return valor`.
- `premiere_frame` — JPEG do frame no playhead (ou em `seconds`) para conferir visualmente sem renderizar.

Helpers ja em escopo: `TICKS`, `sec(time)`, `mkTime(s)`, `seq()`, `qeSeq()`,
`clip("v"|"a", track, idx)`, `comp(item, nome)`, `prop(component, nome)`, `keysOf(prop)`.

## Armadilhas

- ExtendScript e ES3: `var`, sem arrow/let/const/template string. `in` e reservada como chave.
- Tempo de keyframe e tempo de midia (source), nao da sequencia.
- `qe exportFramePNG`: caminho com barras invertidas e SEM extensao (o Premiere adiciona .png).
- Erro "Painel nao respondeu": Premiere fechado ou painel nao carregado (Window > Extensions > PR MCP Bridge).
- Faca uma alteracao por vez e confira com `premiere_frame`/leitura antes de seguir.
