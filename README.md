# Premiere

Repositorio de scripts, paineis e extensoes para Adobe Premiere Pro.

## Objetivo

Concentrar desenvolvimentos relacionados ao Premiere Pro, como scripts, paineis CEP/UXP quando aplicavel, automacoes de timeline, organizacao de projeto, interpretacao de footage e fluxos de exportacao.

## Estrutura recomendada

```text
Nome do Projeto/
  README.md
  src/
  panel/
  scripts/
  assets/
  dist/
```

Para extensoes CEP, uma estrutura comum pode ser:

```text
Nome do Painel CEP/
  CSXS/
    manifest.xml
  index.html
  main.js
  jsx/
  assets/
  dist/
```

## Regra principal

Antes de alterar qualquer script, painel ou arquivo de empacotamento, leia:

1. `VERSIONING.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Esses arquivos definem o padrao compartilhado entre Codex, Claude Code e qualquer outro agente que trabalhe neste repositorio.

## Fluxo recomendado

1. Entender qual script, painel ou fluxo sera alterado.
2. Conferir a versao atual no arquivo principal, `manifest.xml`, `package.json` ou documentacao do projeto.
3. Implementar a mudanca no menor escopo possivel.
4. Atualizar a versao quando a mudanca alterar comportamento, empacotamento ou estabilidade.
5. Fazer commit com mensagem clara em portugues.
6. Subir para o GitHub.

## Cuidados especificos de Premiere

- Nao commitar arquivos grandes de midia, renders, caches ou exports finais sem decisao explicita.
- Evitar depender de caminhos absolutos de maquina local.
- Tratar `.prproj` com cuidado: arquivos de projeto podem ser grandes e dificeis de versionar.
- Separar codigo-fonte de pacotes finais em `dist/`.
- Registrar claramente versao do Premiere usada em testes quando houver diferenca de comportamento.
- Evitar misturar scripts de After Effects ou Photoshop neste repositorio.
