var PT = PT || {};
PT.classify = (function () {
"use strict";

/*
 * classify.js — regras de destino do Premiere Toolkit.
 *
 * Cada regra devolve um caminho de bin (array de nomes). A primeira que
 * casar vence, e as tres ultimas sao fallbacks que casam com qualquer
 * coisa — entao todo item sempre tem destino, sem tela de confirmação.
 */

/* ---------- estrutura do _Modelo ---------- */
const MODEL = {
  AUDIO:        ["Audios"],
  AUDIO_MASTER: ["Audios", "_Master"],
  AUDIO_TASKAM: ["Audios", "_Taskam"],
  AUDIO_LOC:    ["Audios", "Loc"],
  AUDIO_SFX:    ["Audios", "SFX"],
  AUDIO_TRILHA: ["Audios", "Trilhas"],
  CG:           ["CG"],
  CG_STILLS:    ["CG", "_Stills"],
  COLOR:        ["Color"],
  IMAGENS:      ["Imagens"],
  TL:           ["Timelines"],
  TL_NEST:      ["Timelines", "_Nest"],
  TL_OUTRAS:    ["Timelines", "_Outras"],
  TL_AAF:       ["Timelines", "_Outras", "AAF"],
  TL_COLOR:     ["Timelines", "_Outras", "Color IN & OUT"],
};

const binLabel = (p) => p.join(" / ");

/* ---------- extensões ---------- */
const EXT_AUDIO = ["wav", "aif", "aiff", "mp3", "m4a", "flac", "aac", "wma", "ogg"];
const EXT_STILL = ["psd", "psb", "ai", "eps", "png", "jpg", "jpeg", "tif", "tiff",
                   "tga", "bmp", "exr", "svg", "gif", "webp"];
const EXT_MOGRT = ["mogrt", "aep", "prproj"];
const EXT_VIDEO = ["mp4", "mov", "mxf", "avi", "mts", "m2ts", "m4v", "mpg", "mpeg",
                   "braw", "r3d", "ari", "arri", "wmv", "webm", "mkv"];

/* ---------- padrões ---------- */
/* Nomes de arquivo típicos de câmera / drone / action cam. */
const CAM_PATTERNS = [
  /^C\d{3,5}\b/i,            // C1592.MP4  (Canon/Sony)
  /^V\d{3,4}[_-]/i,          // V0070_C2559.MP4
  /\bDJI[_-]?\d/i,           // DJI_0353 / V0266_DJI_0353
  /^DJI\b/i,
  /^GX\d{4,6}\b/i,           // GoPro
  /^GO?PR\d{3,6}\b/i,
  /^MVI[_-]\d/i,
  /^A\d{3}C\d{3}/i,          // Arri
  /^\d{8}[_-]\d{6}\b/,       // 20260530_165435.mp4
  /^IMG[_-]\d{3,5}\b/i,
  /^\d{3}[_-]\d{4}\b/,
  /_HOSP\d?[A-Z]*\b/i,       // V0520_..._D_HOSP1ARA.MP4
];

/*
 * Trechos de caminho que denunciam a categoria.
 *
 * Comparados contra c.pathTail — os ULTIMOS diretorios, nao o caminho todo.
 * Ver a nota em makeCtx: a raiz de campanha do usuario se chama "CG", e casar
 * "/cg/" no caminho inteiro mandaria o projeto inteiro para o bin CG.
 *
 * Sempre com "/" nas pontas quando for nome de pasta: sem isso "efeito" casa
 * em "Prefeitura" e "master" casa em "remaster".
 */
const PATH_CG    = ["/cg/", "after effects", "aftereffects", "/ae/",
                    "render", "grafismo", "motion", "/arte/", "mogrt"];
const PATH_COLOR = ["/color/", "resolve", "davinci", "/cor/",
                    "grading", "/color in", "/color out"];
const PATH_CAM   = ["/brutos/", "/cartao", "/card", "/dcim/", "/clip/",
                    "/private/", "/footage/", "/captacao", "/midias_finais",
                    "/prores/"];
const PATH_TASKAM= ["tascam", "taskam", "zoom h", "/audio bruto", "dual system"];
const PATH_LOC   = ["/loc/", "locucao", "locu\u00e7\u00e3o", "narracao", "voice"];
/* "/efeito" e nao "efeito": uma pasta "Prefeitura" nao e pasta de SFX. */
const PATH_SFX   = ["/sfx/", "/efeito", "sound effect"];
const PATH_TRILHA= ["trilha", "/music", "soundtrack", "/bgm"];
const PATH_MASTER= ["/_master", "/master", "/_mix", "/mix/", "mixagem"];

const hasAny = (hay, list) => list.some((n) => hay.includes(n));

/* ---------- contexto ---------- */

/* Ultimos TAIL_DEPTH diretorios do caminho, com "/" nas pontas para os
   padroes "/cg/" e afins casarem tambem no primeiro e no ultimo segmento. */
const TAIL_DEPTH = 3;
function tailOf(pathLow) {
  if (!pathLow) return "";
  const parts = pathLow.split("/").filter(Boolean);
  parts.pop();                                   // fora o nome do arquivo
  return "/" + parts.slice(-TAIL_DEPTH).join("/") + "/";
}

function makeCtx(name, mediaPath) {
  const path = mediaPath || "";
  const pathLow = path.toLowerCase().replace(/\\/g, "/");
  const dot = name.lastIndexOf(".");
  return {
    name,
    low: name.toLowerCase(),
    /* "_" e caractere de palavra, entao /\bmaster\b/ NAO casa em
       "audio_master_vt". Normalizando os separadores, casa. */
    norm: name.replace(/[_]+/g, " "),
    path,
    /* "\" vira "/" para os padroes de PATH_* casarem sem escape. */
    pathLow: pathLow,
    /*
     * So os ultimos diretorios, nao o caminho inteiro. A raiz de campanha do
     * usuario se chama "CG" (E:/_Campanha2026/CG/_Projetos/...), entao casar
     * "/cg/" em qualquer ponto jogaria o projeto INTEIRO em CG. O que importa
     * e a pasta onde o arquivo esta, nao a arvore acima dela.
     */
    pathTail: tailOf(pathLow),
    ext: dot > 0 ? name.slice(dot + 1).toLowerCase() : "",
    synthetic: !path,          // barras, color matte, black video, titulo...
  };
}

/* ============================================================
 *  MÍDIAS
 * ============================================================ */
/*
 * Cada regra separa `name` (nome do arquivo / extensao) de `path` (pasta em
 * disco). O classificador roda TODAS as regras de nome primeiro e so depois
 * as de pasta.
 *
 * Por que: "audio_master_comercial_..._v3.wav" mora numa pasta chamada Loc, e
 * com um teste unico por regra a pasta ganhava do nome — o master ia parar em
 * Audios/Loc. Um arquivo que se declara master no nome e master onde quer que
 * esteja guardado.
 */
const MEDIA_RULES = [
  {
    id: "color",
    why: "color",
    dest: MODEL.COLOR,
    /* "^color" pega COLOR_RF_PGM_02.mov e COLOR_RF_COMERCIAL_...mov — e assim
       que o retorno de color chega da finalizacao. Prefixo, e nao "\bcolor\b"
       solto, para nao capturar "Color Matte", que e item sintetico do Premiere
       e pertence a CG. */
    name: (c) =>
      /^color\b/i.test(c.norm) ||
      /\bcolor\s*(in|out)\b/i.test(c.norm) ||
      /\(resolve\)/i.test(c.norm) ||
      /\bgrade[dr]?\b/i.test(c.norm),
    path: (c) => hasAny(c.pathTail, PATH_COLOR),
  },
  {
    id: "taskam",
    why: "áudio de gravador externo",
    dest: MODEL.AUDIO_TASKAM,
    audioOnly: true,
    /* Em c.norm, nao em c.name: "..._024_Tr1_2.WAV" nao tem fronteira \b
       depois de "Tr1" porque "_" e caractere de palavra. */
    /*
     * Gravadores de campo numeram por CANAL: "4CH001I.wav",
     * "RF_C0015_4CH018M.wav", "2CH003.wav". O sufixo I/M separa a trilha
     * isolada da mixada. Sem isso, um projeto inteiro de captacao dual-system
     * ficava fora de _Taskam.
     */
    name: (c) =>
      /\btr\d+\b/i.test(c.norm) ||
      /\bt\d{3}\b/i.test(c.norm) ||
      /\b\d?ch\d{2,4}[a-z]?\b/i.test(c.norm) ||
      /^zoom\d/i.test(c.norm) ||
      /\bmixpre\b|\btascam\b|\bzoom\s?h\d/i.test(c.norm),
    path: (c) => hasAny(c.pathTail, PATH_TASKAM),
  },
  {
    /* master antes de loc: "audio master ... comercial" nao pode perder para
       a pasta Loc onde o arquivo por acaso foi salvo. */
    id: "master",
    why: "mixagem / master",
    dest: MODEL.AUDIO_MASTER,
    audioOnly: true,
    name: (c) => /\bmaster\b|\bmix\b|mixagem/i.test(c.norm),
    path: (c) => hasAny(c.pathTail, PATH_MASTER),
  },
  {
    id: "loc",
    why: "locução",
    dest: MODEL.AUDIO_LOC,
    audioOnly: true,
    /*
     * Dois padroes que so aparecem na locucao deste fluxo:
     *
     * - nome comecando por data: "260823_ALAGOAS_SALTO_PRO_FUTURO.aif",
     *   "260814_ALAGOAS_ABERTURA_PGMS.aif". E como o estudio entrega.
     * - extensao .aif/.aiff. Vem depois de master e taskam na ordem das
     *   regras, entao um master em .aif continua indo para _Master.
     */
    name: (c) =>
      /\bloc\b|\bloc\d|locu[cç][aã]o|narra[cç][aã]o|\bvo\b|\boff\b/i.test(c.norm) ||
      /^\d{6}(\d{2})?\s/.test(c.norm) ||
      c.ext === "aif" || c.ext === "aiff",
    path: (c) => hasAny(c.pathTail, PATH_LOC),
  },
  {
    id: "sfx",
    why: "efeito sonoro",
    dest: MODEL.AUDIO_SFX,
    audioOnly: true,
    /*
     * \b antes de "efeito": sem isso, "entrevista prefeito.mp4" virava SFX, e
     * o mesmo valeria para "prefeitura", comum em material institucional.
     *
     * O vocabulario de ambiencia veio do material real: som baixado de
     * YouTube chega como "Som-de-plateia-gritos-aplausos-assobio", que sem
     * essas palavras caia na raiz de Audios.
     */
    name: (c) => /\bsfx\b|\bfx\b|\befeito|whoosh|impact|riser|swoosh|plate[ia]a?|aplauso|assobio|\bvaia\b|ambi[eê]ncia|\bfoley\b|\bcrowd\b|applause|\bruido\b|\bsom de\b/i.test(c.norm),
    path: (c) => hasAny(c.pathTail, PATH_SFX),
  },
  {
    id: "trilha",
    why: "música",
    dest: MODEL.AUDIO_TRILHA,
    audioOnly: true,
    /* "Instrumental", "Jingle" e "Tema" sao como a musica de campanha chega
       nomeada na pratica — sem isso ela caia no fallback, na raiz de Audios. */
    name: (c) => /trilha|\bmusic\w*\b|soundtrack|\bbgm\b|\bbeat\b|instrumental|\bplayback\b|\btema\b|\bcan[cç][aã]o\b|\bjingle\b/i.test(c.norm),
    path: (c) => hasAny(c.pathTail, PATH_TRILHA),
  },
  {
    /*
     * Toda imagem parada vai para CG/_Stills: JPG de drone, PNG de arte, PSD,
     * TIFF. Em projeto de campanha sao dezenas, e misturadas com os renders de
     * AE e os MOGRT elas sujam o bin CG.
     *
     * O que SOBRA na raiz de CG e o que se comporta como video: render de After,
     * MOGRT, e os itens sinteticos do Premiere.
     */
    id: "cg-stills",
    why: "imagem parada",
    dest: MODEL.CG_STILLS,
    name: (c) => EXT_STILL.includes(c.ext),
  },
  {
    id: "cg-mogrt",
    why: "MOGRT / projeto",
    dest: MODEL.CG,
    name: (c) => EXT_MOGRT.includes(c.ext),
  },
  {
    /* Antes dos fallbacks de CG: clipe OFFLINE nao tem media path, e sem
       esta regra vir primeiro ele cairia em "cg-synth". Os projetos reais
       tem dezenas de clipes Pending. */
    id: "cam-name",
    why: "nomenclatura de câmera",
    dest: MODEL.IMAGENS,
    name: (c) => CAM_PATTERNS.some((re) => re.test(c.name)),
  },
  {
    /* Sintetico de verdade (barras, color matte, black video, MOGRT) nao
       tem extensao de arquivo. Offline tem — e nao entra aqui. */
    id: "cg-synth",
    why: "item sintético do Premiere",
    dest: MODEL.CG,
    name: (c) => c.synthetic && !c.ext,
  },
  {
    id: "cg-path",
    why: "veio de pasta de CG / AE",
    dest: MODEL.CG,
    path: (c) => hasAny(c.pathTail, PATH_CG),
  },
  {
    id: "cam-path",
    why: "veio de pasta de captação",
    dest: MODEL.IMAGENS,
    path: (c) => EXT_VIDEO.includes(c.ext) && hasAny(c.pathTail, PATH_CAM),
  },

];

/*
 * Fallbacks: rodam depois das regras de nome E das de pasta. Existiam para
 * mandar o duvidoso a uma tela de revisao manual; a revisao foi removida a
 * pedido, entao o classificador tem que decidir sempre. Sao palpites
 * assumidos: video solto quase sempre e footage, audio solto vai para a raiz
 * de Audios para ser triado a mao, e o resto cai em CG.
 */
const FALLBACKS = [
  { id: "fallback-video", why: "vídeo sem outra pista", dest: MODEL.IMAGENS,
    test: (c) => EXT_VIDEO.includes(c.ext) },
  { id: "fallback-audio", why: "áudio sem outra pista", dest: MODEL.AUDIO,
    test: (c) => EXT_AUDIO.includes(c.ext) },
  { id: "fallback-other", why: "sem pista nenhuma", dest: MODEL.CG,
    test: () => true },
];

/*
 * Duas passadas: primeiro tudo que se decide pelo NOME, depois tudo que se
 * decide pela PASTA, e por fim os fallbacks. Assim o nome do arquivo sempre
 * ganha da pasta onde ele foi salvo.
 */
/*
 * Uma regra marcada audioOnly nunca pode capturar um arquivo de video.
 * "SOL TIME LAPSE.mp4" estava guardado numa pasta SFX no disco e ia parar em
 * Audios/SFX — um .mp4 no bin de audio. Item sem extensao (sintetico) passa,
 * porque a regra seguinte e quem decide.
 */
function audioAllowed(rule, ctx) {
  if (!rule.audioOnly) return true;
  return !ctx.ext || isAudioExt(ctx.ext);
}

function classifyMedia(ctx) {
  var i, r;
  for (i = 0; i < MEDIA_RULES.length; i++) {
    r = MEDIA_RULES[i];
    if (!audioAllowed(r, ctx)) continue;
    if (r.name && r.name(ctx)) return { dest: r.dest, why: r.why, rule: r.id };
  }
  for (i = 0; i < MEDIA_RULES.length; i++) {
    r = MEDIA_RULES[i];
    if (!audioAllowed(r, ctx)) continue;
    if (r.path && r.path(ctx)) return { dest: r.dest, why: r.why, rule: r.id + "/path" };
  }
  for (i = 0; i < FALLBACKS.length; i++) {
    r = FALLBACKS[i];
    if (r.test(ctx)) return { dest: r.dest, why: r.why, rule: r.id };
  }
  return { dest: MODEL.CG, why: "sem pista nenhuma", rule: "fallback-other" };
}

/* ============================================================
 *  SEQUÊNCIAS
 * ============================================================
 *  flags: { isNested, isSelected, anySelection }
 */
/*
 * Nome de timeline de entrega: carrega formato/resolucao ou a palavra
 * "entrega". Ex.: "4k - Senado...", "1920x1080 29,97p - Entrega",
 * "1080 x 1920 29,97p - Vertical", "... - TV".
 */
const DELIVERABLE = /\b\d{3,4}\s*x\s*\d{3,4}\b|\b\d+\s*k\b|\bentrega\b|\bvertical\b|\btv\b|\bfeed\b|\bstor(y|ies)\b|\breels?\b/i;

/* "Nested Sequence 07" e nest mesmo quando nada a referencia mais. */
const NEST_NAME = /\bnested?\b|\bnest\b/i;

/*
 * Limiares da heuristica estrutural. Nomeados de proposito: sao chutes
 * calibraveis, nao verdades — e e aqui que se mexe para afinar.
 */
const SEQ_T = {
  /* ate isso, uma timeline usada dentro de outra e nest de verdade */
  NEST_MAX_CLIPS: 4,
  /* daqui para cima, ha corpo de edicao suficiente para ser principal */
  EDIT_MIN_CLIPS: 8,
  /* video + varias trilhas de audio = edicao, nao pedaco */
  EDIT_MIN_AUDIO: 2,
  EDIT_MIN_VIDEO: 3,
  /* container que embrulha outra timeline (o caso da saida para TV) */
  WRAPPER_MIN_CLIPS: 3,
};

/*
 * flags: { isNested, isSelected, anySelection, videoClips, audioClips, nestRefs }
 *
 * Sem selecao no bin, o nome nao basta: os projetos reais tem timeline
 * principal chamada "PGM_RF_02_AINDA_MELHOR_FINALIZADO" e nest chamado
 * "vaqueiro". Quem separa e a ESTRUTURA.
 */
function classifySequence(ctx, flags) {
  flags = flags || {};
  var videoClips = flags.videoClips || 0;
  var audioClips = flags.audioClips || 0;
  var nestRefs = flags.nestRefs || 0;
  var clips = videoClips + audioClips;

  if (/\baaf\b/i.test(ctx.norm)) {
    return { dest: MODEL.TL_AAF, why: "AAF no nome", rule: "seq-aaf" };
  }
  /* "COR - Senado..." tambem e color; \bcolor\b sozinho nao pegava. */
  if (/\bcolor\b|\bcor\b/i.test(ctx.norm)) {
    return { dest: MODEL.TL_COLOR, why: "color no nome", rule: "seq-color" };
  }
  /*
   * Selecao explicita e nome de entrega vem antes de tudo: a master pode estar
   * aninhada dentro de uma seleta e ainda ser a timeline principal.
   */
  if (flags.isSelected) {
    return { dest: MODEL.TL, why: "selecionada", rule: "seq-selected" };
  }
  if (DELIVERABLE.test(ctx.norm)) {
    return { dest: MODEL.TL, why: "nome de entrega", rule: "seq-deliverable" };
  }

  /*
   * Estrutura de timeline principal, em ordem de forca:
   *
   * 1. Embrulha outra timeline e tem corpo proprio. E a saida para TV: uma
   *    1080 com claquete, texto, preto e a edicao 4k reescalada dentro. O
   *    container e principal tanto quanto a 4k que ele carrega.
   * 2. Muitos clipes — edicao de verdade.
   * 3. Conjuga video com varias trilhas de audio: takes + trilha + locucao.
   */
  if (nestRefs >= 1 && clips >= SEQ_T.WRAPPER_MIN_CLIPS) {
    return { dest: MODEL.TL, why: "embrulha outra timeline", rule: "seq-wrapper" };
  }
  if (clips >= SEQ_T.EDIT_MIN_CLIPS) {
    return { dest: MODEL.TL, why: clips + " clipes", rule: "seq-edit" };
  }
  if (audioClips >= SEQ_T.EDIT_MIN_AUDIO && videoClips >= SEQ_T.EDIT_MIN_VIDEO) {
    return { dest: MODEL.TL, why: "video + trilhas de audio", rule: "seq-edit" };
  }

  /*
   * Nest: timeline pequena.
   *
   * O tamanho decide, e NAO se alguem ainda a referencia. "ceu", "janela",
   * "maria bonita", "vaqueiro" tinham um clipe cada e estavam em _Outras
   * so porque a timeline que as usava tinha sido apagada na limpeza — mas
   * continuam sendo nest, nao "timeline nao identificada".
   *
   * O contrario ja foi tratado la em cima: timeline grande usada dentro de
   * outra e edicao embrulhada, e vai para a raiz.
   */
  /* O nome, quando diz "Nested", vale mesmo com contagem zero — a leitura
     das tracks pode ter falhado, e o nome nao mente. */
  if (NEST_NAME.test(ctx.norm)) {
    return { dest: MODEL.TL_NEST, why: "nome de nest", rule: "seq-nest" };
  }
  /* Alguem a usa dentro de si: e nest, ainda que eu nao tenha lido o conteudo.
     (A grande usada dentro de outra ja foi para a raiz, la em cima.) */
  if (flags.isNested) {
    return { dest: MODEL.TL_NEST, why: "usada dentro de outra", rule: "seq-nest" };
  }
  /* Vazia e sem ninguem usando: sobra. E tambem onde caem as sequencias cuja
     leitura de tracks falhou — _Outras e o balde honesto para "nao sei". */
  if (clips === 0) {
    return { dest: MODEL.TL_OUTRAS, why: "vazia", rule: "seq-empty" };
  }
  if (clips <= SEQ_T.NEST_MAX_CLIPS) {
    return {
      dest: MODEL.TL_NEST,
      why: clips + (clips === 1 ? " clipe" : " clipes"),
      rule: "seq-nest",
    };
  }
  /* meio-termo: nem pequena o bastante para nest, nem cheia o bastante
     para edicao — e o unico caso que sobra para _Outras */
  return { dest: MODEL.TL_OUTRAS, why: clips + " clipes, indefinida", rule: "seq-outras" };
}

const isAudioExt = (ext) => EXT_AUDIO.includes(ext);

  return {
    MODEL: MODEL,
    MEDIA_RULES: MEDIA_RULES,
    binLabel: binLabel,
    makeCtx: makeCtx,
    classifyMedia: classifyMedia,
    classifySequence: classifySequence,
  };
})();
