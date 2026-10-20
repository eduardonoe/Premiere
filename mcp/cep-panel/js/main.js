// PR MCP Bridge - panel side. Serves POST /run on 127.0.0.1 and forwards the
// ExtendScript to Premiere, but only when the x-prmcp-token header matches the
// token in %APPDATA%\prmcp\token (created here on first run, user-only folder).
(function () {
  var http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");

  var PORT = 47300;
  var DIR = process.platform === "win32" ? path.join(process.env.APPDATA, "prmcp")
    : path.join(require("os").homedir(), "Library", "Application Support", "prmcp");
  var TOKEN_FILE = path.join(DIR, "token");

  var stateEl = document.getElementById("state"), logEl = document.getElementById("log");
  function log(msg, cls) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = new Date().toLocaleTimeString() + "  " + msg;
    logEl.insertBefore(d, logEl.firstChild);
    while (logEl.childNodes.length > 60) logEl.removeChild(logEl.lastChild);
  }
  function setState(t, c) { stateEl.textContent = t; stateEl.className = c || ""; }

  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(TOKEN_FILE)) fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(32).toString("hex"), "utf-8");
  var token = Buffer.from(fs.readFileSync(TOKEN_FILE, "utf-8").trim());

  function tokenOk(header) {
    var got = Buffer.from(String(header || ""));
    return got.length === token.length && crypto.timingSafeEqual(got, token);
  }

  // evalScript calls are serialized so long scripts never interleave.
  var chain = Promise.resolve();
  function runInPremiere(code) {
    var job = chain.then(function () {
      return new Promise(function (resolve) {
        window.__adobe_cep__.evalScript("prmcp_run(" + JSON.stringify(code) + ")", function (res) {
          try { resolve(JSON.parse(res)); }
          catch (e) { resolve({ success: false, data: null, error: "Resposta invalida do Premiere: " + res }); }
        });
      });
    });
    chain = job.catch(function () {});
    return job;
  }

  var n = 0;
  var server = http.createServer(function (req, res) {
    function send(status, obj) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    }
    if (req.method !== "POST" || req.url !== "/run") return send(404, { success: false, error: "not found" });
    if (!tokenOk(req.headers["x-prmcp-token"])) {
      log("pedido recusado: token invalido", "err");
      return send(403, { success: false, error: "token invalido" });
    }
    var body = "";
    req.on("data", function (c) { body += c; });
    req.on("end", function () {
      var code;
      try { code = JSON.parse(body).code; } catch (e) { return send(400, { success: false, error: "JSON invalido" }); }
      var id = ++n;
      setState("executando #" + id, "busy");
      runInPremiere(code).then(function (r) {
        setState("aguardando", "ok");
        log("#" + id + (r.success ? " ok" : " erro: " + r.error), r.success ? "ok" : "err");
        send(200, r);
      });
    });
  });

  window.__adobe_cep__.evalScript("PRMCP_VERSION", function (v) { document.getElementById("ver").textContent = "v" + v; });

  server.on("error", function (e) { setState("erro: " + e.message, "err"); });
  server.listen(PORT, "127.0.0.1", function () {
    setState("aguardando", "ok");
    log("ouvindo 127.0.0.1:" + PORT);
  });
})();
