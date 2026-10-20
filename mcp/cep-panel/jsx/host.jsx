// PR MCP Bridge - host ExtendScript.
// prmcp_run() is only called by js/main.js after the request token was verified.
// Helpers below are in scope for every script sent by the MCP server.

var PRMCP_VERSION = "1.0.0";
var TICKS = 254016000000;

function sec(t) { return t.seconds; }
function mkTime(seconds) { var t = new Time(); t.seconds = seconds; return t; }
function seq() { return app.project.activeSequence; }
function qeSeq() { app.enableQE(); return qe.project.getActiveSequence(); }

// Track item by track type/index/clip index: clip("v", 6, 0)
function clip(type, track, idx) {
  var s = seq();
  return (type == "a" ? s.audioTracks : s.videoTracks)[track].clips[idx];
}

// Component by matchName or displayName ("AE.ADBE Geometry2" / "Transform")
function comp(item, name) {
  for (var i = 0; i < item.components.numItems; i++) {
    var c = item.components[i];
    if (c.matchName == name || c.displayName == name) return c;
  }
  return null;
}

// Property by displayName inside a component
function prop(component, name) {
  for (var i = 0; i < component.properties.numItems; i++) {
    if (component.properties[i].displayName == name) return component.properties[i];
  }
  return null;
}

// Keys of a property as [[seconds, value], ...]
function keysOf(p) {
  if (!p.isTimeVarying()) return [];
  var ks = p.getKeys(), out = [];
  if (!ks) return out;
  for (var i = 0; i < ks.length; i++) out.push([ks[i].seconds, p.getValueAtKey(ks[i])]);
  return out;
}

function prmcp_run(code) {
  var data = null, error = null;
  try {
    app.enableQE();
    data = eval("(function() {\n" + code + "\n})()");
  } catch (err) {
    error = err.toString() + (err.line ? " (linha " + err.line + ")" : "");
  }
  try {
    return JSON.stringify({ success: error === null, data: data === undefined ? null : data, error: error });
  } catch (e) {
    return JSON.stringify({ success: false, data: null, error: "Resultado nao serializavel: " + e.toString() });
  }
}
