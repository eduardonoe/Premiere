/*
 * 25-unnest.js — desfaz nests pelo CLIPBOARD do proprio Premiere.
 *
 * Para cada nest selecionado:
 *   1. abre a sequencia de dentro
 *   2. Select All + Copy (comandos de menu nativos)
 *   3. volta para a de fora e poe a playhead no inicio do nest
 *   4. apaga o clipe do nest (API)
 *   5. Paste
 *
 * Por que assim e nao reconstruindo pela API: quem copia e o Premiere, entao
 * efeitos, keyframes, transicoes e mudanca de velocidade vem junto. A primeira
 * versao reconstruia clipe a clipe com createOverwriteItemAction e perdia
 * tudo isso — um clipe a 50% voltava a 100%, com metade da duracao, porque
 * NAO EXISTE setter de velocidade na API (so getSpeed()). E o caminho que o
 * Grave Robber e o QuickNest Pro usam.
 *
 * O ponto fragil e o FOCO: o Select All precisa acontecer na timeline, nao no
 * Project panel. openSequence() da foco a timeline, e por isso ele vem antes.
 */
var PT = PT || {};
PT.unnest = (function () {
  "use strict";

  var api = PT.api;
  var ppro = api.ppro;
  var C = api.C;

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function trackItemsOf(track) {
    try { return (await track.getTrackItems(C.TrackItemType.CLIP, false)) || []; }
    catch (e) { return []; }
  }

  /* Todos os track items da sequencia, com track, tipo e se estao selecionados. */
  async function readItems(sequence) {
    var out = [];
    var vc = 0, ac = 0;
    try { vc = await sequence.getVideoTrackCount(); } catch (e) { vc = 0; }
    try { ac = await sequence.getAudioTrackCount(); } catch (e) { ac = 0; }

    for (var v = 0; v < vc; v++) {
      var items = await trackItemsOf(await sequence.getVideoTrack(v));
      for (var i = 0; i < items.length; i++) out.push(await describe(items[i], v, "v"));
    }
    for (var a = 0; a < ac; a++) {
      var aitems = await trackItemsOf(await sequence.getAudioTrack(a));
      for (var j = 0; j < aitems.length; j++) out.push(await describe(aitems[j], a, "a"));
    }
    return out;
  }

  async function describe(item, trackIndex, kind) {
    var d = { item: item, trackIndex: trackIndex, kind: kind, projectItem: null };
    try { d.projectItem = await item.getProjectItem(); } catch (e) { /* sem master */ }
    d.start = await item.getStartTime();
    d.end = await item.getEndTime();
    d.inPoint = await item.getInPoint();
    d.outPoint = await item.getOutPoint();
    try { d.selected = await item.getIsSelected(); } catch (e) { d.selected = false; }
    d.id = d.projectItem ? d.projectItem.getId() : null;
    return d;
  }

  /*
   * Agrupa video + audio do mesmo clipe: um nest em V1 com audio ligado em A1
   * sao dois track items apontando para o mesmo project item.
   */
  function groupLinked(list) {
    var byKey = {}, order = [];
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (!d.id) continue;
      var key = d.id + "@" + d.start.ticks;
      if (!byKey[key]) {
        byKey[key] = {
          id: d.id, projectItem: d.projectItem, start: d.start,
          inPoint: d.inPoint, outPoint: d.outPoint,
          items: [], selected: false, baseV: null,
        };
        order.push(key);
      }
      var g = byKey[key];
      if (d.kind === "v" && g.baseV === null) g.baseV = d.trackIndex;
      if (d.selected) g.selected = true;
      g.items.push(d);
    }
    return order.map(function (k) { return byKey[k]; });
  }

  /* Os nests selecionados na sequencia ativa. */
  async function selectedNests(sequence) {
    var groups = groupLinked(await readItems(sequence));
    var nests = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g.selected) continue;
      var clip = api.asClip(g.projectItem);
      if (!clip) continue;
      var isSeq = false;
      try { isSeq = await clip.isSequence(); } catch (e) { isSeq = false; }
      if (!isSeq) continue;
      try { g.inner = await clip.getSequence(); } catch (e) { continue; }
      if (!g.inner) continue;
      g.name = g.projectItem.name;
      nests.push(g);
    }
    /* de tras para frente: apagar e colar um nest nao desloca a posicao dos
       que ainda faltam, porque a remocao e sem ripple — mas manter a ordem
       reversa evita surpresa se algum comando rippler entrar no caminho */
    nests.sort(function (a, b) { return b.start.ticksNumber - a.start.ticksNumber; });
    return nests;
  }

  /* Acha um ProjectItem pelo id, varrendo a arvore do projeto. */
  async function findProjectItem(project, id) {
    var root = await project.getRootItem();
    var nodes = await api.walk(root);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].item.getId() === id) return nodes[i].item;
    }
    return null;
  }

  /* Resolve a Sequence a partir do id do ProjectItem dela. */
  async function sequenceById(project, id) {
    var item = await findProjectItem(project, id);
    if (!item) return null;
    var clip = api.asClip(item);
    if (!clip) return null;
    try { return await clip.getSequence(); } catch (e) { return null; }
  }

  /*
   * Guarda apenas IDENTIFICADORES, nunca objetos.
   *
   * openSequence() troca a sequencia ativa, e o host invalida os objetos que
   * pertenciam a sequencia anterior: qualquer uso depois disso levanta
   * "The script object is no longer valid". Por isso o plano carrega id do
   * project item e a posicao em ticks, e cada etapa re-resolve o que precisa.
   */
  async function plan() {
    /* mesmo motivo do apply: se algo morrer aqui, quero saber o que */
    var step = "getProject";
    try {
      var project = await api.getProject();

      step = "getActiveSequence";
      var sequence = await project.getActiveSequence();
      if (!sequence) throw new Error("No active sequence.");

      step = "getProjectItem of active sequence";
      var outerItem = await sequence.getProjectItem();

      step = "read selected nests";
      var nests = await selectedNests(sequence);
      if (!nests.length) {
        throw new Error("Select one or more nested sequences in the timeline first.");
      }

      var refs = nests.map(function (n) {
        return {
          id: n.id, name: n.name,
          startTicks: n.start.ticks,
          /* o trim do nest vive no CLIPE de fora, nao dentro da sequencia:
             sem esses dois, a copia traz o conteudo inteiro */
          inTicks: n.inPoint.ticks,
          outTicks: n.outPoint.ticks,
        };
      });

      return {
        project: project,
        outerId: outerItem ? outerItem.getId() : null,
        nests: refs,
      };
    } catch (e) {
      throw new Error("plan @" + step + ": " + e.message);
    }
  }

  /*
   * Remove os track items do nest.
   *
   * A TrackItemSelection vem por CALLBACK — createEmptySelection(cb) — e esse
   * padrao significa que o objeto so vale dentro do callback. Guardar a
   * selecao e usar depois levantava "The script object is no longer valid"
   * exatamente na transacao de remocao. Por isso a selecao e montada E
   * consumida aqui dentro, sem escapar do escopo.
   *
   * Os track items sao lidos ANTES (leitura assincrona nao pode entrar no
   * lock), e so as referencias vivas entram no callback.
   */
  async function removeNestClip(project, outer, id, startTicks) {
    var all = await readItems(outer);
    var targets = [];
    for (var i = 0; i < all.length; i++) {
      var d = all[i];
      if (d.id === id && d.start.ticks === startTicks) targets.push(d.item);
    }
    if (!targets.length) return 0;

    var editor = ppro.SequenceEditor.getEditor(outer);
    var removed = 0;

    ppro.TrackItemSelection.createEmptySelection(function (sel) {
      var added = 0;
      for (var k = 0; k < targets.length; k++) {
        try { sel.addItem(targets[k], true); added++; } catch (e) { /* ignora */ }
      }
      if (!added) return;

      project.lockedAccess(function () {
        project.executeTransaction(function (compound) {
          compound.addAction(
            editor.createRemoveItemsAction(sel, false, C.MediaType.ANY));
        }, "Toolkit: un-nest (remove nest)");
      });
      removed = added;
    });

    return removed;
  }

  var tn = function (t) { return t.ticksNumber; };

  /* Ids de todas as sequencias do projeto, para achar o clone recem-criado. */
  async function sequenceItemIds(project) {
    var ids = {};
    var seqs = await project.getSequences();
    for (var i = 0; i < seqs.length; i++) {
      try {
        var it = await seqs[i].getProjectItem();
        if (it) ids[it.getId()] = true;
      } catch (e) { /* ignora */ }
    }
    return ids;
  }

  /*
   * Duplica a sequencia e devolve o id do project item do clone.
   * createCloneAction nao devolve o clone, entao comparamos a lista de
   * sequencias antes e depois.
   */
  async function cloneSequence(project, inner) {
    var before = await sequenceItemIds(project);
    api.runActions(project, function () {
      return [inner.createCloneAction()];
    }, "Toolkit: un-nest (clone)");
    await sleep(400);

    var seqs = await project.getSequences();
    for (var i = 0; i < seqs.length; i++) {
      try {
        var it = await seqs[i].getProjectItem();
        if (it && !before[it.getId()]) return it.getId();
      } catch (e) { /* ignora */ }
    }
    return null;
  }

  /*
   * Apara a sequencia (o clone) para a faixa [inTime, outTime], que e o
   * trecho que o nest realmente mostrava. Trabalha em tempo de TIMELINE:
   * createSetStartAction / createSetEndAction deixam o Premiere refazer a
   * conta da fonte, o que importa para clipes com velocidade alterada — um
   * clipe a 50% consome metade de midia por segundo de timeline, e fazer
   * essa conversao a mao foi justamente onde a versao por API errou.
   *
   * Devolve o inicio do primeiro clipe que sobrou, para corrigir o
   * alinhamento na hora de colar (o Paste alinha pelo primeiro clipe, nao
   * pelo tempo absoluto, entao um intervalo vazio no inicio deslocaria tudo).
   */
  async function trimTo(project, seq, inTime, outTime) {
    var all = await readItems(seq);
    var doomed = [], kept = 0, firstStart = null;

    for (var i = 0; i < all.length; i++) {
      var d = all[i];
      if (tn(d.end) <= tn(inTime) || tn(d.start) >= tn(outTime)) {
        doomed.push(d.item);
        continue;
      }
      kept++;
      var s0 = tn(d.start) < tn(inTime) ? inTime : d.start;
      if (firstStart === null || tn(s0) < tn(firstStart)) firstStart = s0;
    }

    /* fora o que esta inteiramente fora da faixa */
    if (doomed.length) {
      var editor = ppro.SequenceEditor.getEditor(seq);
      ppro.TrackItemSelection.createEmptySelection(function (sel) {
        var added = 0;
        for (var k = 0; k < doomed.length; k++) {
          try { sel.addItem(doomed[k], true); added++; } catch (e) { /* ignora */ }
        }
        if (!added) return;
        project.lockedAccess(function () {
          project.executeTransaction(function (compound) {
            compound.addAction(
              editor.createRemoveItemsAction(sel, false, C.MediaType.ANY));
          }, "Toolkit: un-nest (trim: drop outside)");
        });
      });
      await sleep(250);
    }

    /* apara quem cruza as bordas — re-lido, porque a remocao mexeu na lista */
    var live = await readItems(seq);

    /*
     * Primeiro decidir (dados), depois criar as Actions DENTRO do builder.
     * Criar a Action ja exige o lock: montar o array antes e so devolve-lo
     * levanta "Requires locked access". E o erro que o builder do runActions
     * existe para evitar — e que eu repeti aqui.
     */
    var toTrim = [];
    for (var j = 0; j < live.length; j++) {
      var e = live[j];
      if (tn(e.end) <= tn(inTime) || tn(e.start) >= tn(outTime)) continue;
      var cutHead = tn(e.start) < tn(inTime);
      var cutTail = tn(e.end) > tn(outTime);
      if (cutHead || cutTail) {
        toTrim.push({ item: e.item, head: cutHead, tail: cutTail });
      }
    }

    if (toTrim.length) {
      api.runActions(project, function () {
        var acts = [];
        for (var t = 0; t < toTrim.length; t++) {
          var x = toTrim[t];
          if (x.head) acts.push(x.item.createSetStartAction(inTime));
          if (x.tail) acts.push(x.item.createSetEndAction(outTime));
        }
        return acts;
      }, "Toolkit: un-nest (trim: edges)");
      await sleep(250);
    }

    return { kept: kept, firstStart: firstStart };
  }

  /* Apaga o clone descartavel. */
  async function dropClone(project, cloneId, log) {
    try {
      var seq = await sequenceById(project, cloneId);
      if (seq) await project.deleteSequence(seq);
    } catch (e) {
      log("could not delete the temporary copy: " + e.message);
    }
  }

  async function apply(p, log) {
    var helpers = PT.helpers;
    var done = 0;
    var failures = [];
    var step = "start";

    for (var n = 0; n < p.nests.length; n++) {
      var ref = p.nests[n];
      var cloneId = null;
      log("un-nesting " + (n + 1) + "/" + p.nests.length + ": " + ref.name + "...");

      try {
        step = "getProject";
        var project = await api.getProject();

        step = "resolve inner sequence";
        var inner = await sequenceById(project, ref.id);
        if (!inner) throw new Error("inner sequence not found");

        /*
         * A copia existe por um motivo so: o trim do nest vive no CLIPE de
         * fora, e Select All + Copy na sequencia original traria o conteudo
         * inteiro — foi o que passou por cima dos clipes vizinhos. Aparamos
         * uma duplicata descartavel e copiamos dela.
         */
        step = "clone inner sequence";
        cloneId = await cloneSequence(project, inner);
        if (!cloneId) throw new Error("could not duplicate the nested sequence");

        step = "open clone";
        var clone = await sequenceById(project, cloneId);
        if (!clone) throw new Error("clone not found after creating it");
        await project.openSequence(clone);
        await project.setActiveSequence(clone);
        await sleep(700);

        step = "trim clone to the nest range";
        var inT = ppro.TickTime.createWithTicks(ref.inTicks);
        var outT = ppro.TickTime.createWithTicks(ref.outTicks);
        var trimmed = await trimTo(project, clone, inT, outT);
        if (!trimmed.kept) throw new Error("nothing inside the nest visible range");

        step = "copy (Select All + Copy)";
        var cp = await helpers.runHelper("copyall", {}, 25000);
        if (!cp.ok) throw new Error(cp.error);

        step = "getProject (back)";
        project = await api.getProject();

        step = "resolve outer sequence";
        var outer = await sequenceById(project, p.outerId);
        if (!outer) throw new Error("outer sequence not found");

        step = "openSequence(outer)";
        await project.openSequence(outer);
        await project.setActiveSequence(outer);
        await sleep(700);

        step = "remove nest clip";
        var removed = await removeNestClip(project, outer, ref.id, ref.startTicks);
        if (!removed) throw new Error("nest clip not found after switching back");
        await sleep(350);

        /*
         * O Paste alinha o PRIMEIRO clipe copiado na playhead, nao o tempo
         * absoluto. Se a faixa visivel do nest comeca com um intervalo vazio,
         * colar em nestStart puxaria tudo para a esquerda — por isso a
         * playhead compensa essa folga.
         */
        step = "set playhead";
        var startT = ppro.TickTime.createWithTicks(ref.startTicks);
        var target = startT;
        if (trimmed.firstStart) {
          target = startT.add(trimmed.firstStart.subtract(inT));
        }
        try { await outer.setPlayerPosition(target); } catch (e) { /* segue */ }
        await sleep(250);

        step = "paste";
        var ps = await helpers.runHelper("paste", {}, 25000);
        if (!ps.ok) throw new Error(ps.error);
        await sleep(500);

        done++;
      } catch (err) {
        failures.push(ref.name + " @" + step + ": " + err.message);
      }

      /* a duplicata e descartavel: sai mesmo se algo falhou no meio */
      if (cloneId) {
        try {
          var pr = await api.getProject();
          await dropClone(pr, cloneId, log);
        } catch (e) { /* nao mascarar a falha original */ }
      }
    }

    return { done: done, total: p.nests.length, failures: failures };
  }

  /*
   * Apaga as sequencias que ficaram sem uso. So remove se NENHUMA outra
   * timeline do projeto ainda referenciar aquela sequencia.
   */
  async function dropOrphans(project, nests, log) {
    var removed = 0;
    var sequences = await project.getSequences();

    for (var n = 0; n < nests.length; n++) {
      var ref = nests[n];
      var stillUsed = false;

      for (var s = 0; s < sequences.length && !stillUsed; s++) {
        var items = await readItems(sequences[s]);
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === ref.id) { stillUsed = true; break; }
        }
      }
      if (stillUsed) continue;

      /* re-resolve: qualquer Sequence guardada de antes ja pode estar morta */
      var inner = await sequenceById(project, ref.id);
      if (!inner) continue;
      try { await project.deleteSequence(inner); removed++; }
      catch (e) { log('could not delete "' + ref.name + '": ' + e.message); }
    }
    if (removed) log(removed + " orphan sequence(s) removed");
    return removed;
  }

  return { plan: plan, apply: apply, dropOrphans: dropOrphans };
})();
