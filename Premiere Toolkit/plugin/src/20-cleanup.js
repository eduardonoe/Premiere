/*
 * 20-cleanup.js — limpeza e organizacao do projeto.
 *
 *   keepSelected  — mantem so as timelines selecionadas (e o que elas usam)
 *   removeUnused  — remove midias que nenhuma timeline sobrevivente usa
 *   organize      — distribui o que sobrou nas pastas do _Modelo
 */
var PT = PT || {};
PT.cleanup = (function () {
  "use strict";

  var api = PT.api;
  var cls = PT.classify;

  /* ---------------- inventario ---------------- */

  async function inventory(project, log) {
    var root = await project.getRootItem();
    var nodes = await api.walk(root);
    var entries = [];

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.isDir) {
        entries.push({
          item: n.item, parentId: n.parentId, isDir: true,
          kind: "bin", id: n.item.getId(), name: n.item.name,
        });
        continue;
      }
      var clip = api.asClip(n.item);
      var isSeq = false, sequence = null, mediaPath = "";
      if (clip) {
        try { isSeq = await clip.isSequence(); } catch (e) { isSeq = false; }
        if (isSeq) {
          try { sequence = await clip.getSequence(); } catch (e) { sequence = null; }
        } else {
          try { mediaPath = await clip.getMediaFilePath(); } catch (e) { mediaPath = ""; }
        }
      }
      entries.push({
        item: n.item, parentId: n.parentId, isDir: false,
        kind: isSeq ? "seq" : "media",
        id: n.item.getId(), name: n.item.name,
        clip: clip, sequence: sequence, mediaPath: mediaPath,
      });
    }

    var seqs = 0, meds = 0;
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].kind === "seq") seqs++;
      else if (entries[j].kind === "media") meds++;
    }
    log(seqs + " timelines, " + meds + " media items");
    return { root: root, entries: entries };
  }

  /*
   * IDs referenciados por uma sequencia, MAIS a contagem de clipes por tipo.
   *
   * A contagem alimenta a heuristica que separa timeline principal de nest
   * quando nao ha selecao no bin: uma 1080 de saida para TV tem poucos clipes
   * mas embrulha outra timeline; um nest tem poucos clipes e nada dentro.
   */
  async function seqScan(sequence) {
    /*
     * readOk separa "li e esta vazia" de "nao consegui ler".
     *
     * Sem essa distincao, uma falha de leitura devolveria zero clipes e a
     * timeline seria apagada por "estar vazia" — apagando trabalho por causa
     * de um erro de API. Zero clipes so vale como vazio se a leitura deu certo.
     */
    var out = { ids: {}, videoClips: 0, audioClips: 0, readOk: false };
    var readVideo = false, readAudio = false;

    async function grab(track, kind) {
      var items = [];
      try { items = await track.getTrackItems(api.C.TrackItemType.CLIP, false); }
      catch (e) { return; }
      for (var i = 0; i < (items || []).length; i++) {
        if (kind === "v") out.videoClips++; else out.audioClips++;
        try {
          var pi = await items[i].getProjectItem();
          if (pi) out.ids[pi.getId()] = true;
        } catch (e) { /* track item sem project item */ }
      }
    }
    try {
      var vc = await sequence.getVideoTrackCount();
      for (var v = 0; v < vc; v++) await grab(await sequence.getVideoTrack(v), "v");
      readVideo = true;
    } catch (e) { /* leitura de video falhou */ }
    try {
      var ac = await sequence.getAudioTrackCount();
      for (var a = 0; a < ac; a++) await grab(await sequence.getAudioTrack(a), "a");
      readAudio = true;
    } catch (e) { /* leitura de audio falhou */ }

    out.readOk = readVideo && readAudio;
    return out;
  }

  async function buildGraph(entries) {
    var graph = {}, stats = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.kind !== "seq" || !e.sequence) continue;
      var scan = await seqScan(e.sequence);
      graph[e.id] = scan.ids;
      stats[e.id] = {
        videoClips: scan.videoClips, audioClips: scan.audioClips,
        readOk: scan.readOk,
      };
    }
    return { graph: graph, stats: stats };
  }

  /* Fecho transitivo: sequencias semente + tudo que elas aninham. */
  function closure(seedIds, graph) {
    var keep = {}, stack = seedIds.slice();
    while (stack.length) {
      var id = stack.pop();
      if (keep[id]) continue;
      keep[id] = true;
      var refs = graph[id];
      if (!refs) continue;
      for (var r in refs) {
        if (graph[r] && !keep[r]) stack.push(r);
      }
    }
    return keep;
  }

  /* ---------------- bins ---------------- */

  /*
   * Devolve { folder, item } — os dois. FolderItem serve para criar/mover, mas
   * NAO tem getId(); so o ProjectItem tem. Sem o id nao da para proteger o bin
   * da poda nem saber se um item ja esta no destino.
   */
  async function findChildBin(folder, name) {
    var items = await folder.getItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].name !== name) continue;
      var f = api.asFolder(items[i]);
      if (!f) continue;
      try {
        await f.getItems();
        return { folder: f, item: items[i] };
      } catch (e) { /* nao e bin */ }
    }
    return null;
  }

  /* quantos bins esta execucao criou (zerado no inicio de apply) */
  var binsCreated = 0;

  /* Garante o caminho de bins, criando so o que faltar. */
  async function ensureBin(project, root, path) {
    var cur = root;
    var found = null;
    for (var i = 0; i < path.length; i++) {
      var name = path[i];
      found = await findChildBin(cur, name);
      if (!found) {
        var folder = cur;   /* capturado: o builder roda dentro do lock */
        api.runActions(project, function () {
          return [folder.createBinAction(name, false)];
        }, "Toolkit: create bin " + name);
        found = await findChildBin(cur, name);
        if (!found) throw new Error('Could not create bin "' + name + '".');
        binsCreated++;
      }
      cur = found.folder;
    }
    return found;   /* { folder, item } */
  }

  /* ---------------- plano ---------------- */

  async function plan(opts, log) {
    var project = await api.getProject();
    var inv = await inventory(project, log);
    var root = inv.root, entries = inv.entries;

    var built = await buildGraph(entries);
    var graph = built.graph, seqStats = built.stats;

    /*
     * Quantas das referencias de cada timeline sao outras TIMELINES.
     * E o sinal que separa a 1080 de saida para TV (poucos clipes, mas
     * embrulha a edicao 4k) de um nest simples (poucos clipes e nada dentro).
     */
    for (var gid in graph) {
      var nrefs = 0;
      for (var r2 in graph[gid]) if (graph[r2]) nrefs++;
      if (seqStats[gid]) seqStats[gid].nestRefs = nrefs;
    }

    var selItems = await api.getSelectedItems(project);
    var selSeqIds = [];
    for (var s = 0; s < selItems.length; s++) {
      var sid = selItems[s].getId();
      if (graph[sid]) selSeqIds.push(sid);
    }
    var anySelection = selSeqIds.length > 0;

    /* a sequencia aberta nunca e apagada por estar vazia: pode ser uma que
       o usuario acabou de criar e ainda esta montando */
    var activeSeqId = null;
    try {
      var act = await project.getActiveSequence();
      var actItem = act ? await act.getProjectItem() : null;
      if (actItem) activeSeqId = actItem.getId();
    } catch (e) { /* sem sequencia aberta */ }

    var allSeqIds = Object.keys(graph);
    var keepSeqIds;
    if (opts.keepSelected && anySelection) {
      keepSeqIds = closure(selSeqIds, graph);
    } else {
      keepSeqIds = {};
      for (var k = 0; k < allSeqIds.length; k++) keepSeqIds[allSeqIds[k]] = true;
    }

    /* midias usadas e nests, a partir das sequencias sobreviventes */
    var usedMedia = {}, nested = {};
    for (var kid in keepSeqIds) {
      var refs = graph[kid];
      if (!refs) continue;
      for (var r in refs) {
        if (graph[r]) nested[r] = true;
        else usedMedia[r] = true;
      }
    }

    var toDeleteSeq = [], toDeleteMedia = [], moves = [];
    /* quantas das apagadas foram por estarem vazias */
    var emptySeq = 0;
    var keepCount = Object.keys(keepSeqIds).length;

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.kind === "bin") continue;

      if (e.kind === "seq") {
        if (opts.keepSelected && anySelection && !keepSeqIds[e.id]) {
          toDeleteSeq.push(e);
          continue;
        }

        /*
         * Sequencia vazia e apagada, nao arquivada em _Outras.
         *
         * Tres guardas, porque apagar timeline nao tem volta pelo mesmo undo
         * das outras operacoes:
         *   - so quando "remover nao utilizados" esta marcado; "Organizar"
         *     sozinho nunca apaga nada
         *   - nunca a que esta aberta (pode ser uma recem-criada)
         *   - nunca uma que outra timeline ainda referencia, mesmo vazia:
         *     seria um buraco na timeline de quem a usa
         */
        var stat = seqStats[e.id] || {};
        var clipCount = (stat.videoClips || 0) + (stat.audioClips || 0);
        if (opts.removeUnused && stat.readOk && clipCount === 0 &&
            e.id !== activeSeqId && !nested[e.id]) {
          toDeleteSeq.push(e);
          emptySeq++;
          continue;
        }

        if (opts.organize) {
          var st = seqStats[e.id] || {};
          var rs = cls.classifySequence(cls.makeCtx(e.name, ""), {
            isNested: !!nested[e.id],
            isSelected: selSeqIds.indexOf(e.id) !== -1,
            anySelection: anySelection,
            videoClips: st.videoClips || 0,
            audioClips: st.audioClips || 0,
            nestRefs: st.nestRefs || 0,
          });
          moves.push({ entry: e, dest: rs.dest, why: rs.why });
        }
        continue;
      }

      if (opts.removeUnused && !usedMedia[e.id]) {
        toDeleteMedia.push(e);
        continue;
      }
      if (opts.organize) {
        var ctx = cls.makeCtx(e.name, e.mediaPath);
        var rm = cls.classifyMedia(ctx);
        moves.push({ entry: e, dest: rm.dest, why: rm.why });
      }
    }

    return {
      project: project, root: root, entries: entries,
      toDeleteSeq: toDeleteSeq, toDeleteMedia: toDeleteMedia,
      moves: moves,
      emptySeq: emptySeq,
      stats: {
        seqTotal: allSeqIds.length,
        seqKeep: keepCount,
        selected: selSeqIds.length,
        anySelection: anySelection,
      },
    };
  }

  /* ---------------- execucao ---------------- */

  async function apply(p, opts, log) {
    var project = p.project, root = p.root;
    var deletedSeq = 0, deletedMedia = 0, moved = 0, binsRemoved = 0;
    /* itens que o organize nao conseguiu mover: antes sumiam no catch */
    var skipped = 0;
    binsCreated = 0;
    var i, e;

    /* 1. sequencias — deleteSequence e assincrono, fora de transacao */
    if (p.toDeleteSeq.length) {
      log("deleting " + p.toDeleteSeq.length + " timelines...");
      for (i = 0; i < p.toDeleteSeq.length; i++) {
        e = p.toDeleteSeq[i];
        try {
          if (e.sequence) { await project.deleteSequence(e.sequence); deletedSeq++; }
        } catch (err) {
          log('could not delete "' + e.name + '": ' + err.message);
        }
      }
    }

    /* 2. midias nao usadas — em lote, um unico undo */
    if (p.toDeleteMedia.length) {
      log("removing " + p.toDeleteMedia.length + " unused media...");
      var victims = p.toDeleteMedia;
      deletedMedia = api.runActions(project, function () {
        var acts = [];
        for (var k = 0; k < victims.length; k++) {
          try {
            var pb = victims[k].item.getParentBin();
            if (pb) acts.push(pb.createRemoveItemAction(victims[k].item));
          } catch (err) { /* item ja saiu junto com a sequencia */ }
        }
        return acts;
      }, "Toolkit: remove unused");
    }

    /* 3. organizar */
    var modelIds = {};   /* ids dos bins do modelo, para nao serem podados */
    if (opts.organize) {
      /* estrutura completa do modelo, mesmo os bins que ficarao vazios */
      log("creating model structure...");
      var M = cls.MODEL, paths = [], seen = {};
      for (var mk in M) {
        var key2 = M[mk].join("/");
        if (seen[key2]) continue;
        seen[key2] = true;
        paths.push(M[mk]);
      }
      /* pais antes dos filhos */
      paths.sort(function (a, b) { return a.length - b.length; });
      for (var pi2 = 0; pi2 < paths.length; pi2++) {
        try {
          var mb = await ensureBin(project, root, paths[pi2]);
          if (mb && mb.item) modelIds[mb.item.getId()] = true;
        } catch (err) {
          log('bin "' + paths[pi2].join("/") + '": ' + err.message);
        }
      }
    }

    if (opts.organize && p.moves.length) {
      log("organizing " + p.moves.length + " items...");
      var groups = {};
      for (i = 0; i < p.moves.length; i++) {
        var m = p.moves[i];
        var key = m.dest.join("/");
        if (!groups[key]) groups[key] = { dest: m.dest, items: [] };
        groups[key].items.push(m.entry);
      }

      for (var gk in groups) {
        var g = groups[gk], target;
        try {
          target = await ensureBin(project, root, g.dest);
        } catch (err) {
          log('bin "' + gk + '": ' + err.message);
          continue;
        }

        /*
         * Re-resolve os itens AGORA, por id.
         *
         * Cada grupo roda sua propria transacao, e mexer no projeto invalida
         * as referencias capturadas no plano. Usando as antigas, o
         * getParentBin() de um item ja morto levantava excecao — que o catch
         * abaixo engolia em silencio. Resultado no projeto real: o primeiro
         * grupo movia e os seguintes ficavam parados, sem erro nenhum.
         */
        var live = await api.walk(root);
        var byId = {};
        for (var L = 0; L < live.length; L++) byId[live[L].item.getId()] = live[L];

        var wanted = [];
        for (var w = 0; w < g.items.length; w++) wanted.push(g.items[w].id);

        var dstFolder = target.folder;
        var dstId = target.item.getId();
        var groupSkipped = 0;

        moved += api.runActions(project, function () {
          var acts = [];
          for (var k = 0; k < wanted.length; k++) {
            var node = byId[wanted[k]];
            if (!node) { groupSkipped++; continue; }      /* sumiu do projeto */
            if (node.parentId === dstId) continue;         /* ja esta no destino */
            try {
              var parent = node.item.getParentBin();
              if (!parent) { groupSkipped++; continue; }
              acts.push(parent.createMoveItemAction(node.item, dstFolder));
            } catch (err) {
              groupSkipped++;
            }
          }
          return acts;
        }, "Toolkit: organize");

        skipped += groupSkipped;
      }


    }

    /* 4. bins que ficaram vazios (exceto os do modelo) */
    if (opts.organize || opts.removeUnused) {
      binsRemoved = await pruneEmptyBins(project, root, modelIds, log);
    }

    return {
      deletedSeq: deletedSeq, deletedMedia: deletedMedia,
      moved: moved, binsRemoved: binsRemoved, binsCreated: binsCreated,
      skipped: skipped,
    };
  }

  /*
   * Os bins do modelo nao sao podados, mesmo vazios — mas identificados por
   * ID (modelIds), nao por nome. Proteger por nome manteria vivo para sempre
   * um "Imagens" aninhado dentro de outro bin, e projetos reais tem
   * exatamente isso: Imagens > 02_IMAGENS > Imagens.
   */
  async function pruneEmptyBins(project, root, modelIds, log) {
    var removed = 0;
    /*
     * Cada passada remove UM nivel: so a pasta mais funda esta vazia, e o pai
     * dela so fica vazio depois que ela sai. Uma corrente de N pastas vazias
     * aninhadas precisa de N passadas.
     *
     * O limite era 6, e um projeto real trouxe "Imagens > Imagens > ..." com
     * NOVE niveis, que sobreviveram inteiros. O laco ja para sozinho quando
     * uma passada nao remove nada, entao o teto so precisa ser folgado.
     */
    for (var pass = 0; pass < 40; pass++) {
      /* leitura async primeiro: getItems nao pode rodar dentro do lock */
      var nodes = await api.walk(root);
      var empties = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.isDir) continue;
        if (modelIds && modelIds[n.item.getId()]) continue;
        var f = api.asFolder(n.item);
        if (!f) continue;
        var kids = [];
        try { kids = await f.getItems(); } catch (e) { continue; }
        if (!kids.length) empties.push(n.item);
      }
      if (!empties.length) break;

      var batch = empties;
      var n2 = api.runActions(project, function () {
        var acts = [];
        for (var k = 0; k < batch.length; k++) {
          try {
            var pb = batch[k].getParentBin();
            if (pb) acts.push(pb.createRemoveItemAction(batch[k]));
          } catch (e) { /* ignore */ }
        }
        return acts;
      }, "Toolkit: remove empty bins");
      if (!n2) break;      /* nada aplicou: nao insistir em loop */
      removed += n2;
    }
    if (removed) log(removed + " empty bins removed");
    return removed;
  }

  return { plan: plan, apply: apply, closure: closure };
})();
