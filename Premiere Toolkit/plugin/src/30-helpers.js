/*
 * 30-helpers.js — ponte para o automatizador de UI (PowerShell).
 *
 * Delete Tracks e Consolidate Duplicates nao tem API UXP. Saem por
 * shell.openPath() sobre um .bat gerado na pasta temporaria, que chama o
 * ppro-uia.ps1 (o .ps1 direto abriria o Notepad, porque no Windows a
 * associacao padrao de .ps1 e "editar", nao "executar").
 */
var PT = PT || {};
PT.helpers = (function () {
  "use strict";

  var uxp = require("uxp");
  var lfs = uxp.storage.localFileSystem;

  var RESULT = "pt-result.json";
  var RUNNER = "pt-run.bat";

  function quote(s) {
    return '"' + String(s).replace(/"/g, "") + '"';
  }

  async function removeIfExists(folder, name) {
    try {
      var e = await folder.getEntry(name);
      if (e) await e.delete();
    } catch (err) { /* nao existia */ }
  }

  async function runHelper(task, args, timeoutMs) {
    args = args || {};
    timeoutMs = timeoutMs || 45000;

    var plugin = await lfs.getPluginFolder();
    var tmp = await lfs.getTemporaryFolder();

    var script = plugin.nativePath + "\\helpers\\ppro-uia.ps1";
    var resultPath = tmp.nativePath + "\\" + RESULT;

    await removeIfExists(tmp, RESULT);

    var argStr = "-Task " + quote(task);
    for (var k in args) {
      if (args[k] === undefined || args[k] === null || args[k] === "") continue;
      argStr += " -" + k + " " + quote(args[k]);
    }

    var bat =
      "@echo off\r\n" +
      "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File " +
      quote(script) + " " + argStr + " > " + quote(resultPath) + " 2>&1\r\n";

    var batFile = await tmp.createFile(RUNNER, { overwrite: true });
    await batFile.write(bat);

    await uxp.shell.openPath(batFile.nativePath);

    var started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await new Promise(function (r) { setTimeout(r, 350); });
      var raw = null;
      try {
        var e = await tmp.getEntry(RESULT);
        if (e) raw = await e.read();
      } catch (err) { continue; }
      if (!raw || !raw.trim()) continue;

      /* o .ps1 imprime uma linha JSON; erro nao tratado vem como texto solto */
      var lines = raw.trim().split(/\r?\n/);
      var jsonLine = null;
      for (var i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().charAt(0) === "{") { jsonLine = lines[i]; break; }
      }
      if (!jsonLine) {
        return { ok: false, data: null, error: raw.trim().slice(0, 400) };
      }
      try {
        return JSON.parse(jsonLine);
      } catch (err) {
        return { ok: false, data: null, error: "Unreadable helper output: " + raw.slice(0, 300) };
      }
    }
    return {
      ok: false, data: null,
      error: "Helper did not respond in " + Math.round(timeoutMs / 1000) + "s. " +
             "If Windows asked permission to launch an external process, accept it and retry.",
    };
  }

  async function saveProbe(dump) {
    var tmp = await lfs.getTemporaryFolder();
    var f = await tmp.createFile("pt-probe.json", { overwrite: true });
    await f.write(JSON.stringify(dump, null, 2));
    return f.nativePath;
  }

  return { runHelper: runHelper, saveProbe: saveProbe };
})();
