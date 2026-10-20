/*
 * 05-env.js — deteccao de plataforma.
 *
 * O painel e um codigo so nas duas plataformas. O que muda e o que depende de
 * processo externo: no Windows um .bat chama o ppro-uia.ps1, que aciona menus
 * por WM_COMMAND e clica por coordenada. Nada disso existe no macOS, entao la
 * o painel expoe apenas o que e API UXP pura.
 *
 * Carrega antes de todos os outros modulos (prefixo 05).
 */
var PT = PT || {};
PT.env = (function () {
  "use strict";

  function detect() {
    /* require("os") e o caminho direto quando o host expoe o modulo */
    try {
      var os = require("os");
      if (os && typeof os.platform === "function") {
        var p = os.platform();
        if (p) return String(p);
      }
    } catch (e) { /* host sem modulo os */ }

    /* navigator.platform: "MacIntel" no macOS, "Win32" no Windows */
    try {
      if (typeof navigator !== "undefined" && navigator.platform) {
        return /mac/i.test(navigator.platform) ? "darwin" : "win32";
      }
    } catch (e) { /* sem navigator */ }

    return "win32";
  }

  var platform = detect();
  var isMac = /darwin|mac/i.test(platform);

  return {
    platform: platform,
    isMac: isMac,
    isWin: !isMac,
    /* Recursos que dependem do helper externo. Um lugar so para consultar,
       em vez de espalhar "if (isMac)" pela UI. */
    canRunHelper: !isMac,
  };
})();
