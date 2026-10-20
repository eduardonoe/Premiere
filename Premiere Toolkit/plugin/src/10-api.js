/*
 * 10-api.js — camada fina sobre a API UXP do Premiere.
 *
 * Sem import/export: a UXP nao carrega ES modules no painel. Os arquivos de
 * src/ sao concatenados em main.js pelo instalador, na ordem do nome.
 */
var PT = PT || {};
PT.api = (function () {
  "use strict";

  var ppro = require("premierepro");

  function getProject() {
    return ppro.Project.getActiveProject().then(function (p) {
      if (!p) throw new Error("No project open.");
      return p;
    });
  }

  async function getSelectedItems(project) {
    try {
      var sel = await ppro.ProjectUtils.getSelection(project);
      return sel ? await sel.getItems() : [];
    } catch (e) {
      return [];
    }
  }

  function asFolder(item) {
    try { return ppro.FolderItem.cast(item); } catch (e) { return null; }
  }

  function asClip(item) {
    try { return ppro.ClipProjectItem.cast(item); } catch (e) { return null; }
  }

  /* id do bin raiz: getRootItem() devolve FolderItem, que nao tem getId() */
  var ROOT_ID = "__root__";

  /*
   * Percorre a arvore inteira do projeto.
   *
   * parentId e o id do ProjectItem do bin pai (ou ROOT_ID). Guardamos o id
   * aqui porque FolderItem NAO expoe getId() — so ProjectItem expoe — e sem
   * ele nao da para saber se um item ja esta no bin de destino.
   */
  async function walk(folder, out, parentItem, depth) {
    out = out || [];
    depth = depth || 0;
    var parentId = parentItem ? parentItem.getId() : ROOT_ID;
    var items = await folder.getItems();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var f = asFolder(it);
      var isDir = false;
      if (f) {
        try { await f.getItems(); isDir = true; } catch (e) { isDir = false; }
      }
      out.push({
        item: it, folder: folder, parentId: parentId,
        isDir: isDir, depth: depth,
      });
      if (isDir) await walk(f, out, it, depth + 1);
    }
    return out;
  }

  /*
   * Executa um lote de Actions num unico passo de undo.
   *
   * IMPORTANTE: as Actions precisam ser CRIADAS dentro do lockedAccess, e o
   * executeTransaction precisa rodar dentro do mesmo lock. Criar as Actions
   * fora e chamar executeTransaction solto nao aplica NADA — e nao levanta
   * erro nenhum. Foi assim que a v1 apagou timelines (chamada direta) mas nao
   * criou bin, nao moveu e nao removeu item algum.
   *
   * Por isso o parametro e um BUILDER sincrono, nao um array pronto: ele roda
   * dentro do lock. Nada de await aqui dentro.
   *
   * ATENCAO: a propria CRIACAO da Action exige o lock, nao so a execucao.
   * Montar o array antes e devolver ele pronto do builder levanta
   * "Requires locked access". O builder tem que CONSTRUIR as Actions, nao
   * apenas entregar uma lista feita fora.
   */
  function runActions(project, buildActions, undoLabel) {
    var applied = 0;
    var failure = null;
    project.lockedAccess(function () {
      var actions;
      try {
        actions = buildActions() || [];
      } catch (e) {
        failure = e;
        return;
      }
      if (!actions.length) return;
      project.executeTransaction(function (compound) {
        for (var i = 0; i < actions.length; i++) {
          if (!actions[i]) continue;
          compound.addAction(actions[i]);
          applied++;
        }
      }, undoLabel);
    });
    if (failure) throw failure;
    return applied;
  }

  return {
    ppro: ppro,
    C: ppro.Constants,
    getProject: getProject,
    getSelectedItems: getSelectedItems,
    asFolder: asFolder,
    asClip: asClip,
    walk: walk,
    runActions: runActions,
    ROOT_ID: ROOT_ID,
  };
})();
