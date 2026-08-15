# Agent Instructions

Estas instrucoes valem para qualquer agente trabalhando neste repositorio, incluindo Codex.

## Objetivo

Manter projetos Premiere Pro organizados, versionados e faceis de continuar em diferentes ferramentas.

## Antes de editar

1. Leia `README.md` e `VERSIONING.md`.
2. Identifique qual script, painel ou fluxo sera alterado.
3. Leia o arquivo principal do projeto e o manifesto, quando existir.
4. Preserve o estilo existente do projeto.

## Ao editar

- Mantenha o escopo pequeno e diretamente ligado ao pedido.
- Nao misture projetos diferentes no mesmo commit.
- Nao reformatar arquivos inteiros sem necessidade.
- Atualize a versao quando a mudanca afetar comportamento, estabilidade ou pacote final.
- Se a mudanca for relevante, acrescente changelog curto.

## Cuidados com Premiere Pro

- Evitar commitar midias, renders, previews, caches, autosaves e exports pesados.
- Evitar caminhos absolutos do Windows ou de maquinas especificas, salvo quando documentado como exemplo.
- Tratar arquivos `.prproj` como artefatos sensiveis: quando possivel, versionar scripts e documentacao em vez do projeto inteiro.
- Checar diferencas entre ExtendScript, CEP e APIs disponiveis no Premiere.
- Validar scripts com selecao ativa, timeline ativa e projeto aberto quando o comportamento depender do estado do Premiere.
- Registrar versao do Premiere usada no teste quando isso for relevante.

## Versionamento

Siga `VERSIONING.md`.

Exemplo: a primeira correcao pequena depois de `1.0.0` vira `1.0.1`.

## Commits

Use mensagens claras em portugues, com prefixo quando fizer sentido:

- `fix:` para correcao
- `feat:` para recurso novo
- `docs:` para documentacao
- `chore:` para organizacao
- `release:` para preparacao de versao

Antes de commitar, confirme o escopo com o usuario quando houver risco de alterar mais do que foi pedido.
