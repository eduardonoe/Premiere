# Debugging Workflow

Este projeto deve manter diagnostico visivel desde as primeiras versoes instalaveis.

Objetivo: quando uma acao falhar no Premiere, o painel deve informar qual acao tentou executar, qual API/recurso tentou acessar, qual erro recebeu e qual contexto estava ativo.

## Principio

Toda funcao importante do painel deve registrar eventos de debug.

Exemplos:

- `selection.refresh.started`
- `selection.refresh.failed`
- `motion.apply.started`
- `motion.apply.failed`
- `keyframes.applyCurve.failed`
- `audioSync.syncSelected.failed`
- `api-missing`

## Onde ver

O painel possui uma secao `Debug` temporaria com:

- log em JSON;
- botao Copy;
- botao Clear.

Durante testes locais, copiar o log completo sempre que algo falhar.

## O que um log util deve conter

- versao do painel;
- ambiente detectado;
- acao executada;
- aba ativa;
- parametros usados;
- API chamada ou ausente;
- mensagem de erro;
- stack trace quando disponivel.

## Como usar nos testes

1. Instalar/carregar o painel no Premiere.
2. Abrir o painel.
3. Clicar `Refresh`.
4. Testar uma acao por vez.
5. Se falhar, abrir `Debug`.
6. Copiar o log.
7. Colar o log na conversa junto com o que estava selecionado na timeline.

## Logs esperados nesta fase

Na versao `0.1.0`, algumas acoes ainda devem registrar `api-missing`.

Isso e esperado para:

- leitura real da selecao da timeline;
- aplicacao real de preset procedural;
- escrita real de handles Bezier;
- sincronizacao real por waveform.

A utilidade da versao inicial e validar:

- se o painel carrega;
- se a UI funciona;
- se os eventos disparam;
- se o ambiente UXP dispoe dos objetos/API esperados;
- quais chamadas precisam ser conectadas a API real do Premiere.

## Regra para releases de teste

Antes de criar um pacote instalavel para teste:

- atualizar versao;
- manter a secao Debug ativa;
- registrar alteracoes em commit;
- nao remover logs enquanto as APIs criticas nao estiverem validadas.

## Quando remover ou esconder debug

Somente em uma versao mais madura.

Mesmo depois, deve existir algum modo discreto de diagnostico, por exemplo:

- toggle oculto;
- atalho;
- botao `Copy Diagnostic Info` em settings;
- arquivo temporario de log quando permitido pelo ambiente.
