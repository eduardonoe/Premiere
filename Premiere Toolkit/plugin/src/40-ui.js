/*
 * 40-ui.js — UI do painel.
 *
 * Notas de UXP aprendidas na pratica:
 *   - ES modules NAO carregam no painel: por isso tudo vira um main.js flat.
 *   - <button> nao faz layout dos filhos (SVG some, flex-column vira linha):
 *     por isso todo elemento interativo aqui e <div>.
 *   - querySelectorAll() nao devolve algo com .forEach -> qsa()
 *   - element.dataset nao existe -> getAttribute()
 */
(function () {
  "use strict";

  var api = PT.api;
  var cleanup = PT.cleanup;
  var helpers = PT.helpers;

  function $(id) { return document.getElementById(id); }

  function qsa(sel, root) {
    var out = [];
    var found = (root || document).querySelectorAll(sel);
    if (!found) return out;
    for (var i = 0; i < found.length; i++) out.push(found[i]);
    return out;
  }

  /*
   * Escreve texto num elemento que PODE nao existir.
   *
   * O painel muda de forma conforme a plataforma: no macOS o card Sequence
   * inteiro e removido no boot, e com ele o #activeSeq. Um "$(id).textContent"
   * solto entao estoura com "Cannot set properties of null" — e, pior, isso
   * acontecia dentro do proprio catch do refreshSelection, derrubando o
   * syncOpts() que vinha depois e deixando o botao principal sem rotulo.
   *
   * Elemento ausente e situacao normal aqui, nao excecao.
   */
  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }

  function setClass(el, name, on) {
    if (!el) return;
    if (on) el.classList.add(name);
    else el.classList.remove(name);
  }

  function on(el, fn) {
    if (el) el.addEventListener("click", fn);
  }

  /* ---------------- state ---------------- */

  var DEFAULT_OPTS = { keepSelected: true, cleanUnused: true, organize: true };

  var store = {
    read: function (key, fallback) {
      try {
        var v = localStorage.getItem("premiereToolkit." + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    write: function (key, val) {
      try { localStorage.setItem("premiereToolkit." + key, JSON.stringify(val)); }
      catch (e) { /* ok */ }
    },
  };

  var opts = Object.assign({}, DEFAULT_OPTS, store.read("opts", {}));
  var selCount = 0;
  var busy = false;

  /* ---------------- status ---------------- */

  function status(msg, kind) {
    var el = $("status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  function setBusy(v) {
    busy = v;
    setClass(document.body, "busy", v);
    syncRun();
  }

  /* ---------------- options ---------------- */

  /* guarda o hint original de cada linha pra poder trocar e restaurar */
  var baseHint = {};
  qsa(".opt").forEach(function (row) {
    var h = row.querySelector(".hint");
    baseHint[row.getAttribute("data-opt")] = h ? h.textContent : "";
  });

  function syncOpts() {
    qsa(".opt").forEach(function (row) {
      var key = row.getAttribute("data-opt");
      setClass(row, "on", !!opts[key]);

      /* "keep only selected" sem selecao no bin: avisa, mas NUNCA trava o
         clique — travar deixava a linha marcada e impossivel de desmarcar. */
      var idle = key === "keepSelected" && opts[key] && selCount === 0;
      setClass(row, "warn", idle);
      var h = row.querySelector(".hint");
      if (h) {
        h.textContent = idle
          ? "select timelines in the Project panel first"
          : baseHint[key];
      }
    });
    syncRun();
  }

  function effective() {
    return {
      keepSelected: opts.keepSelected && selCount > 0,
      removeUnused: opts.cleanUnused,
      /* Consolidate Duplicates e comando de menu, e so o helper do Windows
         alcanca menu. No macOS a opcao vira apenas "remove unused" — o que o
         usuario aceitou, ja que o nao-utilizado e apagado de qualquer forma. */
      consolidate: opts.cleanUnused && PT.env.canRunHelper,
      organize: opts.organize,
    };
  }

  function syncRun() {
    var o = effective();
    var cleans = o.keepSelected || o.removeUnused;
    var label = "Nothing selected";
    if (cleans && o.organize) label = "Clean & Organize";
    else if (cleans) label = "Clean";
    else if (o.organize) label = "Organize";
    setText("runLabel", label);
    setClass($("btnRun"), "off", busy || (!cleans && !o.organize));
  }

  qsa(".opt").forEach(function (row) {
    on(row, function () {
      if (busy) return;
      var key = row.getAttribute("data-opt");
      opts[key] = !opts[key];
      store.write("opts", opts);
      syncOpts();
    });
  });

  /* ---------------- selection + active sequence ---------------- */

  async function refreshSelection() {
    try {
      var project = await api.getProject();

      var items = await api.getSelectedItems(project);
      var names = [];
      for (var i = 0; i < items.length; i++) {
        var clip = api.asClip(items[i]);
        if (!clip) continue;
        try { if (await clip.isSequence()) names.push(items[i].name); }
        catch (e) { /* skip */ }
      }
      selCount = names.length;
      setText("selCount", String(selCount));
      setClass($("selLine"), "has", selCount > 0);
      setText("selText", selCount === 0 ? "no timeline selected" : names.join(", "));

      /* sequencia ativa — e nela que o Delete Empty Tracks age */
      try {
        var act = await project.getActiveSequence();
        var pi = act ? await act.getProjectItem() : null;
        setText("activeSeq", pi ? pi.name : "no active sequence");
      } catch (e) {
        setText("activeSeq", "no active sequence");
      }
    } catch (e) {
      selCount = 0;
      setText("selCount", "0");
      setClass($("selLine"), "has", false);
      setText("selText", e.message);
      setText("activeSeq", "—");
    }
    syncOpts();
  }

  on($("btnRefreshSel"), function () { if (!busy) refreshSelection(); });

  /* ---------------- run ---------------- */

  on($("btnRun"), async function () {
    if (busy) return;
    if ($("btnRun").classList.contains("off")) return;
    setBusy(true);
    var o = effective();
    try {
      status("reading project...", "busy");
      var p = await cleanup.plan(o, function (m) { status(m, "busy"); });

      if (o.keepSelected) {
        status("keeping " + p.stats.seqKeep + " of " + p.stats.seqTotal + " timelines...", "busy");
      }


      var r = await cleanup.apply(p, o, function (m) { status(m, "busy"); });

      /* consolidate por ultimo: age sobre o bin ja organizado */
      var consol = "";
      if (o.consolidate) {
        status("consolidating duplicates...", "busy");
        var h = await helpers.runHelper("consolidate", {}, 30000);
        consol = h.ok ? " · duplicates consolidated"
                      : " · consolidate failed (" + h.error + ")";
      }

      var parts = [];
      if (r.deletedSeq) {
        /* separar as vazias: apagar timeline chama atencao, e o usuario tem
           que saber quantas sairam so por estarem vazias */
        var empties = p.emptySeq || 0;
        parts.push(empties
          ? r.deletedSeq + " timelines deleted (" + empties + " empty)"
          : r.deletedSeq + " timelines deleted");
      }
      if (r.deletedMedia) parts.push(r.deletedMedia + " media removed");
      if (r.moved) parts.push(r.moved + " items organized");
      if (r.binsCreated) parts.push(r.binsCreated + " bins created");
      if (r.binsRemoved) parts.push(r.binsRemoved + " empty bins removed");

      /* Uma operacao planejada que aplica zero e falha silenciosa, nao
         sucesso. Foi assim que a v1 reportou "7 timelines deleted" enquanto
         nao criava bin nem movia nada. */
      /* itens que o organize nao conseguiu mover. Antes sumiam num catch
         silencioso, e o painel reportava sucesso com metade do projeto
         parado no lugar. */
      if (r.skipped) parts.push(r.skipped + " items could not be moved");

      var stuck = [];
      if (o.organize && p.moves.length && !r.moved) stuck.push("move");
      if (o.removeUnused && p.toDeleteMedia.length && !r.deletedMedia) stuck.push("remove");
      if (stuck.length) {
        status("planned but applied nothing: " + stuck.join(", ") +
               " (" + p.moves.length + " moves, " + p.toDeleteMedia.length + " removals)", "err");
        setBusy(false);
        return;
      }

      status((parts.length ? parts.join(" · ") : "nothing to do") + consol,
             consol.indexOf("failed") !== -1 ? "err" : "ok");
      await refreshSelection();
    } catch (e) {
      status(e.message, "err");
    }
    setBusy(false);
  });

  /* ---------------- delete empty tracks ---------------- */

  /*
   * O conteudo do dialogo Delete Tracks nao e exposto ao UIAutomation — foi
   * medido: um unico filho, um OS_ViewContainer opaco de 320x516. Nao da para
   * marcar checkbox por API, entao gravamos a SUA sequencia de cliques uma vez
   * e reproduzimos. As posicoes sao fracao do tamanho do dialogo, nao pixels,
   * e sao aplicadas sobre o rect lido a cada execucao — por isso sobrevivem a
   * mover a janela, trocar de monitor e mudar a resolucao.
   */
  function tracksCal() { return store.read("tracksCal", null); }

  function renderTracksCal() {
    var c = tracksCal();
    var h = $("tracksHint");
    if (!h) return;
    h.textContent = c
      ? c.count + " clicks recorded · active sequence"
      : "not calibrated — click the target icon";
  }

  on($("btnCalTracks"), async function (ev) {
    if (ev) ev.stopPropagation();          /* nao disparar a linha inteira */
    if (busy) return;
    setBusy(true);
    status("opening Delete Tracks — tick the boxes you want, then click OK", "busy");
    var r = await helpers.runHelper("calibrate-tracks", {}, 120000);
    if (r.ok) {
      store.write("tracksCal", r.data);
      renderTracksCal();
      status("calibrated: " + r.data.count + " clicks recorded", "ok");
    } else {
      status(r.error, "err");
    }
    setBusy(false);
  });

  /* ---------------- un-nest ---------------- */

  on($("btnUnnest"), async function () {
    if (busy) return;
    setBusy(true);
    try {
      status("reading nests...", "busy");
      var p = await PT.unnest.plan();
      var r = await PT.unnest.apply(p, function (m) { status(m, "busy"); });

      var dropped = 0;
      var dropErr = null;
      try {
        dropped = await PT.unnest.dropOrphans(p.project, p.nests,
          function (m) { status(m, "busy"); });
      } catch (e) {
        /* nao invalida o un-nest ja aplicado, mas nao pode sumir em silencio */
        dropErr = e.message;
      }

      var parts = [r.done + "/" + r.total + " nest(s) un-nested"];
      if (dropped) parts.push(dropped + " orphan sequence(s) removed");
      if (dropErr) parts.push("orphan cleanup failed: " + dropErr);
      if (r.failures && r.failures.length) {
        status(parts.join(" · ") + " · failed: " + r.failures.join(" | "), "err");
      } else {
        status(parts.join(" · "), "ok");
      }
      await refreshSelection();
    } catch (e) {
      status(e.message, "err");
    }
    setBusy(false);
  });

  on($("btnEmptyTracks"), async function () {
    if (busy) return;
    var c = tracksCal();
    if (!c) {
      status("not calibrated yet — click the target icon on the right first", "err");
      return;
    }
    setBusy(true);
    status("removing empty tracks...", "busy");
    var r = await helpers.runHelper("tracks", {
      Clicks: c.clicks, CalW: c.w, CalH: c.h,
    }, 45000);
    status(r.ok ? r.data : r.error, r.ok ? "ok" : "err");
    setBusy(false);
  });

  /* ---------------- diagnostics ---------------- */

  async function runProbe() {
    if (busy) return;
    setBusy(true);
    status("probing menus and dialogs...", "busy");
    var r = await helpers.runHelper("probe", {}, 30000);
    if (r.ok) {
      var path = await helpers.saveProbe(r.data);
      status("probe saved to " + path, "ok");
    } else {
      status(r.error, "err");
    }
    setBusy(false);
  }

  on($("btnProbe"), runProbe);

  /* fecha dropdowns ao clicar fora */
  document.addEventListener("click", function (ev) {
    qsa(".dd.open").forEach(function (d) {
      var n = ev.target, inside = false;
      while (n) { if (n === d) { inside = true; break; } n = n.parentNode; }
      if (!inside) d.classList.remove("open");
    });
  }, true);

  /* ---------------- adaptacao de plataforma ---------------- */

  /*
   * No macOS nao ha ponte para processo externo: nada de WM_COMMAND, de
   * clique por coordenada nem de leitura de mouse. Some tudo que depende
   * disso, em vez de deixar botao que so sabe dar erro.
   */
  function applyPlatform() {
    if (PT.env.canRunHelper) return;

    /* o card Sequence inteiro depende do helper */
    var seqCard = null;
    var tracks = $("btnEmptyTracks");
    if (tracks) {
      var node = tracks;
      while (node && node.classList && !node.classList.contains("card")) {
        node = node.parentNode;
      }
      seqCard = node;
    }
    if (seqCard && seqCard.parentNode) seqCard.parentNode.removeChild(seqCard);

    /* o rodape de diagnostico tambem chama o helper */
    var probe = $("btnProbe");
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);

    /* a opcao perde a metade que dependia de menu */
    qsa(".opt").forEach(function (row) {
      if (row.getAttribute("data-opt") !== "cleanUnused") return;
      var lbl = row.querySelector(".lbl");
      var hint = row.querySelector(".hint");
      if (lbl) lbl.textContent = "Remove unused";
      if (hint) hint.textContent = "media no surviving timeline references";
      baseHint.cleanUnused = "media no surviving timeline references";
    });
  }

  /* ---------------- boot ---------------- */

  try {
    applyPlatform();
    renderTracksCal();
    syncOpts();
    refreshSelection();
    setInterval(function () {
      if (!busy) refreshSelection();
    }, 1500);
    status("ready", null);
  } catch (e) {
    status("boot error: " + e.message, "err");
  }
})();
