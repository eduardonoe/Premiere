# Premiere Toolkit

Painel UXP para Adobe Premiere Pro 2026. Limpeza e organizacao de projeto,
remocao de tracks vazias.

## Estrutura da pasta

```
Premiere Toolkit 1.0.0 (Windows).zip   <- pronto para enviar
Premiere Toolkit 1.0.0 (Mac).zip       <- pronto para enviar
README.md
plugin/       fontes do painel (manifest, html, css, src/, helpers/)
install/      instaladores das duas plataformas
test/         suites que rodam sem o Premiere
tools/        pack.mjs, o empacotador dos zips
```

Os dois zips ficam na raiz e sao regerados a cada instalacao — o
`install.ps1` chama o `tools/pack.mjs` no fim. Quem instala, empacota: assim
os pacotes nunca ficam atrasados em relacao ao codigo.

Para regerar sozinho:

```bash
node tools/pack.mjs
```

**O zip nao tem a mesma forma da pasta.** No repositorio os fontes moram em
`plugin/` e os instaladores em `install/`; dentro do zip tudo fica lado a
lado, para quem recebe nao ter subpasta para navegar. Os instaladores procuram
o `manifest.json` nos dois lugares, entao o mesmo script serve aos dois
arranjos — nao ha duas versoes para manter em sincronia.

## Instalacao

### Windows

Duplo-clique em `install/Install_Premiere_Toolkit.bat` (ou no que vem no zip).
Nao precisa de UAC: instala no perfil do usuario. Reinicie o Premiere e abra o
painel em **Window > UXP Plugins > Premiere Toolkit**.

Nao e em `Window > Extensions` — esse submenu e dos plugins CEP, o modelo
antigo. Plugin UXP aparece no submenu `UXP Plugins`, logo abaixo.

Para remover: `Uninstall_Premiere_Toolkit.bat`.

### macOS

Duplo-clique em `Install_Premiere_Toolkit_Mac.command`.

Instala em `~/Library/Application Support/Adobe/UXP/Plugins/External/` e
registra em `PluginsInfo/v1/premierepro.json`. Nao pede senha. O registro e
feito com `osascript -l JavaScript`, que sempre existe no macOS — sem depender
de `jq` nem de `python3`.

O empacotador grava o bit de execucao dentro do zip (modo Unix nos *external
attributes*, que o Archive Utility preserva), entao o duplo-clique funciona
direto. Se o macOS barrar por o arquivo vir da internet: botao direito >
Abrir > Abrir.

Se ainda assim nao abrir, o caminho que sempre funciona:

```bash
bash "Install_Premiere_Toolkit_Mac.command"
```

## O que existe em cada plataforma

O codigo e o mesmo nas duas; `plugin/src/05-env.js` detecta a plataforma e o
painel se adapta sozinho no boot.

| Recurso | Windows | macOS |
|---|---|---|
| Clean & Organize | sim | sim |
| Consolidate duplicates | sim | nao |
| Delete Empty Tracks | sim | nao |
| Un-nest | sim | nao |
| Diagnostico (probe) | sim | nao |

Tudo que falta no macOS depende do helper externo (`plugin/helpers/ppro-uia.ps1`):
PowerShell, `WM_COMMAND` sobre o menu nativo do Win32, clique por coordenada e
leitura de mouse. Nada disso tem equivalente direto no macOS, e o instalador do
Mac nem copia a pasta `helpers/`.

No macOS a opcao do meio vira **"Remove unused"**: o Consolidate Duplicates e
comando de menu e nao ha como aciona-lo. Nao faz falta na pratica — o que nao
esta em uso e apagado de qualquer forma, entao os duplicados que sobram sao
todos duplicados em uso.

Os botoes indisponiveis sao **removidos** do painel, nao desabilitados: botao
que so sabe dar erro e pior que botao nenhum.

## Card Project — limpeza e organizacao

Tres operacoes independentes. Marque as que quiser e clique no botao; o label
do botao acompanha a combinacao.

| Opcao | O que faz |
|---|---|
| Keep only selected timelines | Resolve as dependencias das timelines selecionadas no Project panel (incluindo nests, recursivamente) e apaga todas as outras sequencias |
| Consolidate duplicates & remove unused | Apaga midias que nenhuma timeline sobrevivente usa e dispara `Edit > Consolidate Duplicates`. No macOS vira so **Remove unused** |
| Organize into model bins | Cria a estrutura do `_Modelo` (mesmo os bins que ficarao vazios) e distribui o que sobrou nela |

Combinacoes: tudo marcado = limpeza geral; so a do meio = enxugar sem mexer na
organizacao; so a ultima = reorganizar sem apagar nada. O label do botao
acompanha a combinacao.

"Keep only selected timelines" continua clicavel mesmo sem selecao no bin — ela
so avisa que nao tera efeito. (Travar o clique deixava a opcao marcada e
impossivel de desmarcar.)

**Nao ha backup nem confirmacao** — foi pedido assim. O Undo do Premiere cobre
as operacoes de mover e remover midia (cada lote e um passo unico de undo); a
remocao de sequencias usa `deleteSequence` e vai separada.

## Destinos

### Midias

| Origem | Vai para |
|---|---|
| Mixagem / master / jingle mixado | `Audios/_Master` |
| Locucao: `\bloc\b`, nome comecando por data (`260823_...`), `.aif` | `Audios/Loc` |
| Gravador de campo: `_Tr4`, `T020`, **`4CH001I`**, Tascam, Zoom, MixPre | `Audios/_Taskam` |
| Efeito e ambiencia: `sfx`, `efeito`, plateia, aplauso, assobio, foley | `Audios/SFX` |
| Musica: trilha, instrumental, jingle, tema, soundtrack | `Audios/Trilhas` |
| **Toda imagem parada**: JPG, PNG, PSD, TIFF, TGA, EXR | `CG/_Stills` |
| MOGRT, `.aep`, itens sinteticos, render de pasta de CG ou AE | `CG` |
| Prefixo `COLOR_`, `color in/out`, retorno de Resolve | `Color` |
| Nomenclatura de camera (`C####`, `V####_`, `DJI`, `GX###`, `AAAAMMDD_HHMMSS`) | `Imagens` |

Subpastas por operador (`PAULO DANTAS`, `RAFAEL BRITO`) sao achatadas na raiz de
`Imagens`. Bins que ficam vazios sao removidos, exceto os do proprio modelo.

**Regra de áudio vs video:** as cinco regras de audio sao marcadas `audioOnly` e
nunca capturam um arquivo de video. Sem isso, um `SOL TIME LAPSE.mp4` guardado
numa pasta `SFX` no disco ia parar no bin de audio.

### Timelines

Com selecao no bin, a selecionada manda. **Sem selecao, quem decide e a
estrutura** — o nome nao serve, porque a principal se chama
`PGM_RF_02_AINDA_MELHOR_FINALIZADO` e um nest se chama `vaqueiro`.

| Sinal | Vai para |
|---|---|
| `AAF` no nome | `Timelines/_Outras/AAF` |
| `color` ou `cor` no nome | `Timelines/_Outras/Color IN & OUT` |
| Selecionada no bin, ou nome de entrega (`4k`, `1920x1080`, `Entrega`, `Vertical`, `TV`) | `Timelines` |
| Embrulha outra timeline **e** tem corpo proprio (≥3 clipes) | `Timelines` |
| ≥8 clipes, ou ≥3 de video com ≥2 de audio | `Timelines` |
| Nome com `Nested`, ou usada dentro de outra | `Timelines/_Nest` |
| ≤4 clipes | `Timelines/_Nest` |
| Vazia | **apagada** (ver abaixo), ou `_Outras` se nao houver limpeza |
| Meio-termo (5 a 7 clipes, ninguem usa) | `Timelines/_Outras` |

A quarta linha e a saida para TV: uma 1080 com claquete, texto, preto e a
edicao 4k reescalada dentro. O container e principal tanto quanto a 4k que ele
carrega — por isso tamanho vence "estar aninhada".

Os limiares vivem em `SEQ_T`, no topo de `plugin/src/00-classify.js`.

### Sequencia vazia e apagada

Quando "remover nao utilizados" esta marcado. Quatro guardas, porque apagar
timeline nao volta pelo mesmo undo das outras operacoes:

- so com essa opcao marcada; "Organizar" sozinho nunca apaga nada
- nunca a sequencia aberta (pode ser uma recem-criada)
- nunca uma que outra timeline ainda referencia, mesmo vazia
- **so se a leitura das tracks tiver dado certo** — sem essa guarda, uma falha
  de API devolveria zero clipes e apagaria uma timeline cheia

**O classificador sempre decide** — nao ha tela de confirmacao. Um `.mov` sem
padrao de camera e sem pista de pasta cai num dos tres fallbacks do fim: video
solto vai para `Imagens`, audio solto para a raiz de `Audios`, o resto para
`CG`. Sao palpites assumidos, comentados como tal no codigo.

Duas regras de precedencia que custaram caro para descobrir:

- **Nome vence pasta.** O classificador roda TODAS as regras de nome antes das
  de pasta. `audio_master_....wav` salvo dentro de uma pasta `Loc` e master.
- **Pasta e so o final do caminho** (3 ultimos diretorios). A raiz de campanha do
  usuario se chama `CG`, e casar `/cg/` no caminho inteiro jogaria o projeto
  todo no bin CG.

As regras vivem em `plugin/src/00-classify.js`, em listas nomeadas no topo do arquivo
(`CAM_PATTERNS`, `PATH_CG`, `PATH_COLOR`, ...). Editar la e suficiente.

## Card Sequence

- **Delete Empty Tracks** — remove as tracks vazias de video, audio e caption
  da **sequencia ativa** (a que voce esta editando). O nome dela aparece no
  cabecalho do card, para voce conferir o alvo antes de clicar.

O Delete Tracks e o Consolidate Duplicates nao tem API UXP. Eles saem por
`plugin/helpers/ppro-uia.ps1`, que posta `WM_COMMAND` com o ID do item de menu
direto na janela do Premiere — sem mouse, sem coordenada.

**O que foi medido** (nao suposto) no Premiere Pro 2026 desta maquina:

- O UIAutomation nao enxerga menu nenhum: MenuBar 0, Menu 0, MenuItem 0. A UI
  e toda `DroverLord`, custom da Adobe.
- Mas existe um menu nativo Win32, e o `WM_COMMAND` funciona. IDs usados:
  `11432` Consolidate Duplicates, `11431` Remove Unused, `11630` Delete Tracks.
- O Premiere so aceita o `WM_COMMAND` quando e a janela ativa. Isso vale na
  pratica, porque o clique vem de um painel dentro do proprio Premiere.
- Os dialogos sao `#32770`, mas o conteudo deles nao e exposto. O de Delete
  Tracks tem UM filho: um `OS_ViewContainer` opaco. **Nao da para marcar
  checkbox de dialogo por API.**

Por isso o Delete Tracks usa **calibracao**: o icone de alvo ao lado do botao
abre o dialogo e grava a SUA sequencia de cliques, guardando cada posicao como
FRACAO do tamanho do dialogo. Sobrevive a mover a janela, trocar de monitor e
mudar de resolucao; se a proporcao do dialogo divergir mais de 2%, o painel
recusa e pede recalibracao em vez de clicar as cegas.

A calibracao fica em `localStorage`, que persiste em disco — fechar o Premiere
nao perde. Atualizar para uma versao maior do Premiere perde, porque o
armazenamento e por versao (`PluginsStorage/PPRO/26/...`).

### Diagnostico

Se algo falhar, o botao de engrenagem no rodape roda o `probe`: lista os itens
de topo do menu nativo e os dialogos abertos, salva num JSON e mostra o caminho
no status.

Manualmente:

```bash
powershell -ExecutionPolicy Bypass -File "plugin/helpers/ppro-uia.ps1" -Task probe
```

## Testes

Duas suites, 91 casos, nenhuma precisa do Premiere:

```bash
node test/test-classify.mjs     # 59 casos: nome e caminho em disco
node test/test-structure.mjs    # 32 casos: estrutura de timeline e regras novas
```

Cada caso ali foi um erro real de classificacao em projeto de producao.

## Fora de escopo

O botao de **Fix Mercury Transmit** foi removido. A medicao mostrou que a
tabela de Transmit em Preferences > Playback nao existe para o UIAutomation, e
a unica saida seria clique por coordenada calibrada — fragil demais para o
ganho. O usuario resolve esse bug por outro caminho.

## Estado

**Verificado no Premiere:** Clean & Organize (criacao dos bins, movimentacao,
remocao de nao utilizados e de bins vazios) e Delete Empty Tracks com
calibracao. Uma execucao real: 207 midias removidas, 2474 itens organizados,
13 bins criados, 1375 bins vazios removidos.

**Testado fora do Premiere:** 91 casos em duas suites, deteccao de plataforma e
adaptacao do painel, round-trip dos dois zips.

**Ainda em ajuste:** o Un-nest. A versao atual duplica a sequencia aninhada,
apara a copia pelo in/out do nest, copia dela e cola no lugar — para respeitar
o trim sem sobrescrever vizinhos. Ver a nota no topo de `plugin/src/25-unnest.js`.

**Compromisso conhecido:** bancos de take grandes (`BANCORENAN`, 9 horas) tem
muitos clipes e por isso vao para a raiz de `Timelines`, junto das entregas.
Pela regra estrutural eles se qualificam; se incomodar, o corte seria por
duracao ou por nome.
