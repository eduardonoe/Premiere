import { classify } from "./loader.mjs";
const { makeCtx, classifyMedia, classifySequence, binLabel } = classify;

/*
 * Os quatro casos marcados FALLBACK abaixo nao tem pista no nome. Com media
 * path real, "cg-path" costuma pegar os renders de AE; sem path, o fallback
 * de video manda para Imagens. E um palpite assumido, nao um acerto.
 */
/* Nomes reais do projeto "Governo AL - React - Arapiraca e Agreste" (imagens 2 e 3). */
const BASE = "E:/_Campanha2026/CG/_Projetos/Diversos/RF/2026_08_18_Mosca";

const MEDIA = [
  ["audio_master_vt_arapiraca_30_v2.aif",              "Audios / _Master"],
  ["LOC - Valendo - Arapiraca e Agreste - v02.aiff",   "Audios / Loc"],
  ["LOC - Valendo - Arapiraca, CRIA e Sertao.aiff",    "Audios / Loc"],
  ["REACT SERTAO-T020_Tr4.WAV",                        "Audios / _Taskam"],
  ["REACT SERTAO-T024_Tr4.WAV",                        "Audios / _Taskam"],
  ["Ref Intro.mp4",                                    "Imagens"],
  ["grota 01.png",                                     "CG / _Stills"],
  ["Grota 06.png",                                     "CG / _Stills"],
  ["Layer 2/manchete.psd",                             "CG / _Stills"],
  ["Base Claquete de Envio.jpg",                       "CG / _Stills"],
  ["Box Libras 4K.png",                                "CG / _Stills"],
  ["manchete.psd",                                     "CG / _Stills"],
  ["Mortalidade.png",                                  "CG / _Stills"],
  ["Template Instagram.png",                           "CG / _Stills"],
  ["RFX_CRT_Effect_4K",                                "CG"],
  ["Governo AL - React - Arapiraca e Agreste - Color OUT.mov",             "Color"],
  ["Governo AL - React - Arapiraca e Agreste - Personagem - Color OUT.mov","Color"],
  ["React - Arapiraca e Agreste (Resolve)",            "Color"],
  ["C1592.MP4",                                        "Imagens"],
  ["C1675.MP4",                                        "Imagens"],
  ["V0010_DJI_0027.MP4",                               "Imagens"],
  ["V0070_C2559.MP4",                                  "Imagens"],
  ["V0236_DJI_20240629080057_0038_D.mp4",              "Imagens"],
  ["V0266_DJI_0353.MOV",                               "Imagens"],
  ["V0483_GX011469.MP4",                               "Imagens"],
  ["V0520_DJI_20260504112630_0025_D_HOSP1ARA.MP4",     "Imagens"],
  ["20260530_165435.mp4",                              "Imagens"],
  ["Libras - Arapiraca.mp4",                           "Imagens"],
  ["Governo AL - Mosca Animada.mov",                   "Imagens"],
  ["Governo AL - React - Arapiraca e Agreste - Vertical.mov", "Imagens"],
];

const SEQ = [
  ["Governo AL - React - Arapiraca e Agreste - AAF",      {}, "Timelines / _Outras / AAF"],
  ["Governo AL - React - Arapiraca e Agreste - Color OUT",{}, "Timelines / _Outras / Color IN & OUT"],
  ["Manchete 01",              { isNested: true },            "Timelines / _Nest"],
  ["videos manchete",          { isNested: true },            "Timelines / _Nest"],
  ["COMP Cresce",              { isNested: true },            "Timelines / _Nest"],
  ["Governo AL - React - Arapiraca e Agreste - 4k", { isSelected: true, anySelection: true }, "Timelines"],
  ["Governo AL - React - Arapiraca e Agreste - Vertical", { isSelected: true, anySelection: true }, "Timelines"],
  ["berco",                    { anySelection: true },        "Timelines / _Outras"],

  /* As setas do projeto SENADO_E_LUGAR_DE_GENTE_EXPERIENTE. Cada uma foi um
     erro real de classificacao antes das regras de entrega / nest por nome. */
  ["4k - Senado e lugar de gente experiente",  { isNested: true },  "Timelines"],
  ["1920x1080 29,97p - Entrega",               {},                  "Timelines"],
  ["Nested Sequence 07",                       {},                  "Timelines / _Nest"],
  ["Nested Sequence 10",                       {},                  "Timelines / _Nest"],
  ["Seleta",                                   {},                  "Timelines / _Outras"],
  ["COR - Senado e lugar de gente experiente", {},                  "Timelines / _Outras / Color IN & OUT"],
];

/* Casos com caminho em disco real. Cobrem duas armadilhas encontradas na
   pratica: a raiz de campanha do usuario se chama "CG" (casar "/cg/" no
   caminho inteiro jogaria o projeto todo em CG), e "prefeito"/"prefeitura"
   contem "efeito" (mandava entrevista para SFX). */
const PATHS = [
  ["Mosca Animada.mov",       BASE + "/AE/Render/Mosca Animada.mov",             "CG"],
  ["Manchete 01.mov",         BASE + "/CG/Manchete 01.mov",                      "CG"],
  ["abertura.mov",            BASE + "/After Effects/abertura.mov",              "CG"],
  ["entrevista prefeito.mp4", BASE + "/Premiere/Brutos/entrevista prefeito.mp4", "Imagens"],
  ["Prefeitura ato.mp4",      BASE + "/Premiere/Prefeitura/Prefeitura ato.mp4",  "Imagens"],
  ["som ambiente.wav",        BASE + "/Premiere/Audio/som ambiente.wav",         "Audios"],
  ["Teste Valendo.MP4",       BASE + "/Premiere/Teste Valendo.MP4",              "Imagens"],
  ["algo - Color OUT.mov",    BASE + "/Color/algo - Color OUT.mov",              "Color"],
  ["trilha epica.wav",        BASE + "/Premiere/Trilhas/trilha epica.wav",       "Audios / Trilhas"],
  ["LOC final.aiff",          BASE + "/Premiere/Loc/LOC final.aiff",             "Audios / Loc"],
];

/* Pasta Loc real do projeto SENADO. Prova que o NOME vence a PASTA: o master
   estava salvo dentro de Loc e ia parar em Audios/Loc. */
const AUD = "C:/Users/enn_g/Desktop/2026_08_16_SENADO/Audio";
const PATHS2 = [
  ["audio_master_comercial_senado_e_lugar_de_gente_experiente_30_v3.wav",
   AUD + "/Loc/audio_master.wav", "Audios / _Master"],
  ["Loc-Diego-SR-Comercial-LUGAR-GENTE-EXPERIENTE.wav",
   AUD + "/Loc/loc.wav", "Audios / Loc"],
  ["CAMPANHA RF 2026_024_Tr1_2.WAV",
   AUD + "/Loc/tascam.wav", "Audios / _Taskam"],
  /* nome neutro: aqui sim a pasta decide */
  ["take 03.wav", AUD + "/Loc/take 03.wav",     "Audios / Loc"],
  ["take 04.wav", AUD + "/Trilhas/take 04.wav", "Audios / Trilhas"],
];

let pass = 0, fail = 0;
const rows = [];

for (const [name, want] of MEDIA) {
  const r = classifyMedia(makeCtx(name, ""));
  const got = r ? binLabel(r.dest) : null;
  const ok = got === want;
  ok ? pass++ : fail++;
  rows.push([ok ? "ok " : "XX ", name, got === null ? "(revisao)" : got, r ? r.rule : "-"]);
}

for (const [name, path, want] of PATHS) {
  const r = classifyMedia(makeCtx(name, path));
  const got = binLabel(r.dest);
  const ok = got === want;
  ok ? pass++ : fail++;
  rows.push([ok ? "ok " : "XX ", name, got, r.rule]);
}

for (const [name, path, want] of PATHS2) {
  const r = classifyMedia(makeCtx(name, path));
  const got = binLabel(r.dest);
  const ok = got === want;
  ok ? pass++ : fail++;
  rows.push([ok ? "ok " : "XX ", name, got, r.rule]);
}

for (const [name, flags, want] of SEQ) {
  const r = classifySequence(makeCtx(name, ""), Object.assign({ isNested: false, isSelected: false, anySelection: false }, flags));
  const got = binLabel(r.dest);
  const ok = got === want;
  ok ? pass++ : fail++;
  rows.push([ok ? "ok " : "XX ", name, got, r.rule]);
}

const w = Math.max(...rows.map((r) => r[1].length));
for (const r of rows) console.log(r[0] + r[1].padEnd(w) + "  ->  " + String(r[2]).padEnd(28) + "  [" + r[3] + "]");
console.log("\n" + pass + " pass, " + fail + " fail");
process.exit(fail ? 1 : 0);
