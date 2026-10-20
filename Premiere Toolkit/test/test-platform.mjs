/*
 * Roda o main.js construido contra um DOM minimo, nas duas plataformas, e
 * confere o que sobra no painel. Nao precisa do Premiere.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* caminhos relativos ao teste, para rodar de qualquer cwd */
const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "plugin", "src");
const HTML = join(here, "..", "plugin", "index.html");

const bundle = readdirSync(SRC).filter((f) => f.endsWith(".js")).sort()
  .map((f) => readFileSync(SRC + "/" + f, "utf8")).join("\n");

const html = readFileSync(HTML, "utf8");

/*
 * O boot do painel chama refreshSelection() sem await. Uma excecao la dentro
 * vira "unhandled rejection", nao derruba o script — e foi assim que a
 * primeira versao deste teste deu falso positivo enquanto o painel do macOS
 * quebrava de verdade. Coletar as rejeicoes e a unica forma de ve-las.
 */
const rejections = [];
process.on("unhandledRejection", (e) => {
  rejections.push(e && e.message ? e.message : String(e));
});

/* ---- DOM de brinquedo: so o que o painel usa ---- */
function makeEl(tag, attrs) {
  const el = {
    tag, attrs: attrs || {}, children: [], parentNode: null,
    textContent: "", classes: new Set((attrs && attrs.class || "").split(/\s+/).filter(Boolean)),
    classList: null, style: {},
    getAttribute(n) { return this.attrs[n]; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    addEventListener() {},
    querySelector(sel) { return this.findAll(sel)[0] || null; },
    querySelectorAll(sel) { return this.findAll(sel); },
    findAll(sel) {
      const out = [];
      const want = sel.replace(/^\./, "");
      const walk = (n) => {
        for (const c of n.children) {
          if (sel.startsWith(".") && c.classes.has(want)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    },
  };
  el.classList = {
    add: (n) => el.classes.add(n),
    remove: (n) => el.classes.delete(n),
    contains: (n) => el.classes.has(n),
  };
  return el;
}

/* parser de brinquedo: so tags, class, id e texto de <span> */
function parse(src) {
  const root = makeEl("root", {});
  const stack = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) {
      const txt = m[5].trim();
      if (txt) stack[stack.length - 1].textContent += txt;
      continue;
    }
    const [, close, tag, attrsRaw, selfClose] = m;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    const ar = /([a-zA-Z-]+)="([^"]*)"/g;
    let a;
    while ((a = ar.exec(attrsRaw))) attrs[a[1]] = a[2];
    const el = makeEl(tag, attrs);
    stack[stack.length - 1].appendChild(el);
    if (!selfClose && !/^(meta|link|br|img|path|input)$/.test(tag)) stack.push(el);
  }
  return root;
}

function run(platformName) {
  const root = parse(html);
  const byId = {};
  (function index(n) {
    if (n.attrs && n.attrs.id) byId[n.attrs.id] = n;
    n.children.forEach(index);
  })(root);

  /* Um elemento removido da arvore precisa devolver null, como no DOM real.
     Sem isso o harness dava falso positivo: o painel do macOS remove o card
     Sequence e o codigo continuava "achando" o #activeSeq. */
  const attached = (el) => {
    let n = el;
    while (n && n.parentNode) n = n.parentNode;
    return n === root;
  };

  const document = {
    getElementById: (id) => (byId[id] && attached(byId[id]) ? byId[id] : null),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    body: makeEl("body", {}),
    createElement: (t) => makeEl(t, {}),
    addEventListener() {},
  };

  const sandbox = {
    document,
    navigator: { platform: platformName === "darwin" ? "MacIntel" : "Win32" },
    localStorage: { getItem: () => null, setItem: () => {} },
    setInterval: () => 0,
    setTimeout: (f) => { return 0; },
    require: (n) => {
      if (n === "os") return { platform: () => platformName };
      if (n === "premierepro") {
        /* projeto de mentira com o minimo para refreshSelection percorrer o
           caminho feliz: sem isso ele morre logo no getProject e o trecho
           que toca no #activeSeq nunca roda */
        const seq = {
          getProjectItem: async () => ({ name: "seq de teste", getId: () => "s1" }),
        };
        const project = {
          getActiveSequence: async () => seq,
          getRootItem: async () => ({ getItems: async () => [] }),
        };
        return {
          Constants: { TrackItemType: { CLIP: 1 }, MediaType: { ANY: 0 } },
          Project: { getActiveProject: async () => project },
          ProjectUtils: { getSelection: async () => ({ getItems: async () => [] }) },
          FolderItem: { cast: () => null },
          ClipProjectItem: { cast: () => null },
        };
      }
      if (n === "uxp") return { storage: { localFileSystem: {} }, shell: {} };
      throw new Error("modulo desconhecido: " + n);
    },
  };

  const fn = new Function(
    "document", "navigator", "localStorage", "setInterval", "setTimeout", "require",
    bundle
  );
  fn(sandbox.document, sandbox.navigator, sandbox.localStorage,
     sandbox.setInterval, sandbox.setTimeout, sandbox.require);

  const alive = (id) => {
    const el = byId[id];
    if (!el) return false;
    let n = el;
    while (n.parentNode) n = n.parentNode;
    return n === root;
  };

  const cleanLbl = root.querySelectorAll(".opt")
    .find((r) => r.getAttribute("data-opt") === "cleanUnused");

  const runBtn = byId["btnRun"];
  const runLabel = byId["runLabel"];

  return {
    /* o rotulo so e escrito se o boot chegou ao fim sem estourar — foi
       exatamente isso que quebrou no macOS: o painel subiu com o botao vazio */
    runLabel: runLabel ? runLabel.textContent : "",
    /* o sintoma visivel do bug no macOS: a linha de selecao exibindo a
       mensagem de erro em vez do estado */
    selText: byId["selText"] ? byId["selText"].textContent : "",
    emptyTracks: alive("btnEmptyTracks"),
    unnest: alive("btnUnnest"),
    probe: alive("btnProbe"),
    run: alive("btnRun"),
    cleanLabel: cleanLbl ? (cleanLbl.querySelector(".lbl") || {}).textContent : "(?)",
  };
}

const EXPECT = {
  win32:  { emptyTracks: true,  unnest: true,  probe: true },
  darwin: { emptyTracks: false, unnest: false, probe: false },
};

let fail = 0;
for (const plat of ["win32", "darwin"]) {
  rejections.length = 0;
  let r;
  try {
    r = run(plat);
    /* deixa as promises do boot terminarem antes de julgar */
    await new Promise((res) => setTimeout(res, 0));
    await new Promise((res) => setImmediate(res));
  } catch (e) {
    console.log("XX  " + plat + ": LANCOU -> " + e.message);
    fail++;
    continue;
  }

  const want = EXPECT[plat];
  const checks = [
    ["botao principal presente", r.run, true],
    /* O rotulo so e escrito se o boot chegou ao fim sem estourar. Foi
       exatamente isso que quebrou no macOS: o painel subia com o botao
       vazio porque o refreshSelection morria no #activeSeq ausente. */
    ["rotulo do botao escrito", r.runLabel, "Clean & Organize"],
    ["Delete Empty Tracks", r.emptyTracks, want.emptyTracks],
    ["Un-nest", r.unnest, want.unnest],
    ["diagnostico", r.probe, want.probe],
    ["sem excecao no boot", rejections.length, 0],
    ["linha de selecao sem erro", r.selText, "no timeline selected"],
  ];

  console.log("\n--- " + plat + " ---");
  for (const [name, got, exp] of checks) {
    const ok = got === exp;
    if (!ok) fail++;
    console.log((ok ? "  ok  " : "  XX  ") + name.padEnd(26) +
      String(got) + (ok ? "" : "   esperado: " + String(exp)));
  }
  console.log("  --  opcao do meio          " + r.cleanLabel);
  for (const msg of rejections) console.log("      ! " + msg);
}

console.log(fail ? "\n" + fail + " FALHAS" : "\nadaptacao de plataforma OK");
process.exit(fail ? 1 : 0);
