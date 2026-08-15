# Versioning

Este repositorio usa um padrao simples baseado em SemVer:

```text
MAJOR.MINOR.PATCH
```

Exemplo:

```text
1.0.1
```

## Como incrementar

- `PATCH` (`1.0.0` -> `1.0.1`): correcao de bug, ajuste pequeno, compatibilidade, texto, comentario, empacotamento ou melhoria interna.
- `MINOR` (`1.0.0` -> `1.1.0`): novo recurso compativel com o fluxo anterior.
- `MAJOR` (`1.0.0` -> `2.0.0`): mudanca grande, incompatibilidade ou alteracao importante no fluxo de uso.

## Onde atualizar

A versao deve ser mantida no ponto principal do projeto, conforme o tipo:

- Script `.jsx`: cabecalho do arquivo.
- Painel CEP: `CSXS/manifest.xml` e, se existir, `package.json` ou README do painel.
- Ferramenta auxiliar: arquivo principal e README do projeto.

Exemplo em script:

```javascript
// Version: 1.0.1
```

Exemplo em manifest CEP:

```xml
<ExtensionBundleVersion>1.0.1</ExtensionBundleVersion>
```

## Estado inicial

A primeira versao funcional deve ser marcada como:

```text
1.0.0
```

A primeira correcao pequena depois disso deve virar:

```text
1.0.1
```

## Changelog

Quando a mudanca for relevante, registre um changelog curto no README do projeto ou no cabecalho do arquivo principal:

```text
v1.0.1 changelog:
- Corrige interpretacao de footage em timeline 29.97.
- Ajusta leitura de selecao ativa no Premiere.
```

## Commits

Use mensagens objetivas em portugues, preferencialmente neste estilo:

```text
fix: corrige interpretacao de framerate
feat: adiciona automacao de timeline
chore: organiza arquivos de empacotamento CEP
release: prepara painel Premiere v1.0.1
```

Quando a mudanca representar uma versao pronta para teste ou uso, incluir a versao na mensagem do commit.
