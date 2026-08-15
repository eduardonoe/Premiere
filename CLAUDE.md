# Claude Code Instructions

Estas instrucoes alinham o trabalho do Claude Code com o fluxo usado tambem pelo Codex neste repositorio.

## Leitura obrigatoria

Antes de alterar qualquer projeto Premiere, leia:

1. `README.md`
2. `VERSIONING.md`
3. Este arquivo

## Contexto do repositorio

Este repositorio deve ser usado para projetos Adobe Premiere Pro.

Nao misturar scripts de After Effects ou Photoshop aqui. Scripts de After Effects pertencem ao repositorio `Scripts-AE`; projetos Photoshop pertencem ao repositorio `Photoshop`.

## Regra de versionamento

O repositorio usa versionamento semantico simples:

```text
MAJOR.MINOR.PATCH
```

A primeira versao funcional deve ser:

```text
1.0.0
```

A primeira correcao pequena deve atualizar a versao para:

```text
1.0.1
```

## Fluxo de trabalho

1. Identificar o script, painel ou fluxo afetado.
2. Ler o arquivo principal e o manifesto, quando existir.
3. Fazer a menor alteracao necessaria.
4. Atualizar a versao quando a mudanca afetar comportamento, estabilidade ou empacotamento.
5. Adicionar changelog curto quando a mudanca for relevante.
6. Fazer commit com mensagem clara em portugues.
7. Subir para o GitHub.

## Cuidados com Premiere

- Evitar commitar midias, caches, previews, autosaves e exports pesados.
- Nao depender de caminhos absolutos sem documentar.
- Tratar `.prproj` com cuidado, pois pode ser grande e pouco amigavel para versionamento.
- Verificar diferencas entre ExtendScript, CEP e APIs disponiveis no Premiere.
- Registrar versao do Premiere usada em testes quando relevante.

## Cuidados gerais

- Nao misturar projetos diferentes no mesmo commit sem necessidade.
- Nao reformatar arquivo inteiro sem pedido explicito.
- Nao remover historico de changelog existente.
- Preservar compatibilidade com Premiere Pro sempre que possivel.
