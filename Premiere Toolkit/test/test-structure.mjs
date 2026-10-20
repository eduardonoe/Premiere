import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* caminho relativo ao teste, para rodar de qualquer cwd */
const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "plugin", "src", "00-classify.js"), "utf8");
const cls = new Function("var PT={};" + code + ";return PT.classify;")();
const { makeCtx, classifySequence, classifyMedia, binLabel } = cls;

/* ---------- timelines, sem selecao no bin ---------- */
const F = (o) => Object.assign(
  { isNested: false, isSelected: false, anySelection: false,
    videoClips: 0, audioClips: 0, nestRefs: 0 }, o);

const SEQ = [
  /* a principal do projeto: edicao cheia */
  ["PGM_RF_02_AINDA_MELHOR_FINALIZADO",
   F({ videoClips: 40, audioClips: 12 }), "Timelines"],

  /* saida para TV: 1080 com claquete + texto + preto + a 4k reescalada */
  ["PGM 1080 TV",
   F({ videoClips: 3, audioClips: 1, nestRefs: 1 }), "Timelines"],

  /* a 4k que ela embrulha: continua principal */
  ["PGM 4k edicao",
   F({ isNested: true, videoClips: 35, audioClips: 10 }), "Timelines"],

  /* nest de verdade: usado dentro de outra, pequeno */
  ["fala 1",       F({ isNested: true, videoClips: 1 }), "Timelines / _Nest"],
  ["vaqueiro.",    F({ isNested: true, videoClips: 2, audioClips: 1 }), "Timelines / _Nest"],
  ["ceu",          F({ isNested: true, videoClips: 1 }), "Timelines / _Nest"],

  /* nest orfao, so o nome denuncia */
  ["Nested Sequence 03", F({ videoClips: 1 }), "Timelines / _Nest"],

  /* banco de takes: muitos clipes, vira principal (compromisso assumido) */
  ["BANCORENAN",   F({ videoClips: 120, audioClips: 30 }), "Timelines"],

  /* nest identificado so pelo nome, mesmo sem leitura das tracks */
  ["Nested Sequence 10", F({}), "Timelines / _Nest"],
  /* referenciada por outra, conteudo nao lido */
  ["Manchete 01", F({ isNested: true }), "Timelines / _Nest"],
  /* vazia e sem ninguem usando: sobra de verdade */
  ["timeline vazia", F({}), "Timelines / _Outras"],

  /* sobra pequena, ninguem usa */
  ["janela",       F({ videoClips: 1 }), "Timelines / _Nest"],
  ["Seleta",       F({ videoClips: 6 }),  "Timelines / _Outras"],

  /* nome ainda manda quando existe */
  ["Governo AL - ... - AAF",      F({ videoClips: 50 }), "Timelines / _Outras / AAF"],
  ["COR - Senado e lugar",        F({ videoClips: 50 }), "Timelines / _Outras / Color IN & OUT"],
  ["1920x1080 29,97p - Entrega",  F({}),                 "Timelines"],
  ["4k - Senado",                 F({ isNested: true }), "Timelines"],
];

/* ---------- midias ---------- */
const MED = [
  /* taskam por canal — o que faltava */
  ["4CH002I.wav", "", "Audios / _Taskam"],
  ["4CH018M.wav", "", "Audios / _Taskam"],
  ["RF_C0015_4CH001I.wav", "", "Audios / _Taskam"],
  ["RF_V0012_4CH009M.wav", "", "Audios / _Taskam"],
  ["RF_C0015_4CH049M.wav", "", "Audios / _Taskam"],
  ["REACT SERTAO-T020_Tr4.WAV", "", "Audios / _Taskam"],

  /* video numa pasta SFX: NAO pode ir para bin de audio */
  ["SOL TIME LAPSE.mp4", "Z:/proj/Audio/SFX/SOL TIME LAPSE.mp4", "Imagens"],
  /* audio na mesma pasta: pode */
  ["PLATEIA GRITOS APLAUSOS.mp3", "Z:/proj/Audio/SFX/x.mp3", "Audios / SFX"],

  /* JPG em subpasta propria */
  ["1V6A5757.JPG", "", "CG / _Stills"],
  ["V0541_DJI_20260528192356_0027_D_PENEDO.JPG", "", "CG / _Stills"],
  /* PNG continua na raiz de CG */
  ["Mascara Libras.png", "", "CG / _Stills"],

  /* nao regredir */
  ["audio_master_comercial_x_v3.wav", "Z:/proj/Audio/Loc/x.wav", "Audios / _Master"],
  ["Comercial - Pra fazer historia - Instrumental.wav", "", "Audios / Trilhas"],
  ["COLOR_RF_PGM_02.mov", "", "Color"],
  ["1V6A0158.MOV", "", "Imagens"],
];

let pass = 0, fail = 0;
const rows = [];

for (const [name, flags, want] of SEQ) {
  const r = classifySequence(makeCtx(name, ""), flags);
  const got = binLabel(r.dest);
  const ok = got === want;
  ok ? pass++ : fail++;
  rows.push([ok, name, got, r.rule, want]);
}
for (const [name, path, want] of MED) {
  const r = classifyMedia(makeCtx(name, path));
  const got = binLabel(r.dest);
  const ok = got === want;
  ok ? pass++ : fail++;
  rows.push([ok, name, got, r.rule, want]);
}

const w = Math.max(...rows.map((r) => r[1].length));
for (const [ok, name, got, rule, want] of rows) {
  console.log((ok ? "ok  " : "XX  ") + name.padEnd(w) + "  ->  " +
    got.padEnd(30) + "[" + rule + "]" + (ok ? "" : "   esperado: " + want));
}
console.log("\n" + pass + " pass, " + fail + " fail");
process.exit(fail ? 1 : 0);
