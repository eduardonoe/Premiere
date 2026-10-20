#!/usr/bin/env node
// PR MCP server: stdio MCP <-> PR MCP Bridge CEP panel (http://127.0.0.1:47300/run).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const URL_RUN = "http://127.0.0.1:47300/run";
const WIN = process.platform === "win32";
const DIR = WIN ? path.join(process.env.APPDATA, "prmcp") : path.join(os.homedir(), "Library", "Application Support", "prmcp");
const TOKEN_FILE = path.join(DIR, "token");

async function run(code, timeoutS = 120) {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error("Token nao encontrado: abra o Premiere com o painel PR MCP Bridge (Window > Extensions).");
  const token = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
  let res;
  try {
    res = await fetch(URL_RUN, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-prmcp-token": token },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(timeoutS * 1000),
    });
  } catch (e) {
    throw new Error(`Painel nao respondeu (${e.message}). O Premiere esta aberto e o painel PR MCP Bridge carregado?`);
  }
  const r = await res.json();
  if (!r.success) throw new Error(r.error || `HTTP ${res.status}`);
  return r.data;
}

const text = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 1) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: String(e.message || e) }] });

const server = new McpServer({ name: "premiere-bridge", version: "1.0.0" });

server.registerTool(
  "premiere_run",
  {
    description: `Run ExtendScript (ES3) inside Premiere Pro with full DOM + QE access. No restrictions.
Code is a function body: use \`return <value>\` (JSON-serializable) to get data back. QE is already enabled (global \`qe\`).
Helpers in scope: TICKS, sec(time), mkTime(seconds), seq(), qeSeq(), clip("v"|"a", trackIdx, clipIdx),
comp(item, matchOrDisplayName), prop(component, displayName), keysOf(prop) -> [[seconds, value], ...].
ES3 only: var, no arrow functions/let/const/template strings; \`in\` is reserved as a key name.
Keyframe times are in media (source) time, not sequence time.`,
    inputSchema: {
      code: z.string().describe("ExtendScript function body"),
      timeout_s: z.number().optional().describe("Seconds to wait (default 120)"),
    },
  },
  async ({ code, timeout_s }) => {
    try { return text(await run(code, timeout_s)); } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "premiere_status",
  { description: "Premiere version, open project, active sequence, playhead and track counts.", inputSchema: {} },
  async () => {
    try {
      return text(await run(`
        var s = app.project.activeSequence;
        return { bridge: PRMCP_VERSION, version: app.version, project: app.project.path,
          sequence: s ? { name: s.name, playhead: s.getPlayerPosition().seconds, end: s.end ? s.end / TICKS : null,
            video: s.videoTracks.numTracks, audio: s.audioTracks.numTracks,
            width: s.frameSizeHorizontal, height: s.frameSizeVertical } : null };`, 15));
    } catch (e) { return fail(e); }
  },
);

server.registerTool(
  "premiere_frame",
  {
    description: "Capture the active sequence frame at the playhead (or at `seconds`) as PNG and return the image, to visually check results without rendering.",
    inputSchema: { seconds: z.number().optional().describe("Sequence time; moves the playhead there first") },
  },
  async ({ seconds }) => {
    try {
      fs.mkdirSync(path.join(DIR, "frames"), { recursive: true });
      const base = path.join(DIR, "frames", `frame_${Date.now()}`);
      for (const f of [base, base + ".png"]) if (fs.existsSync(f)) fs.unlinkSync(f);
      await run(`
        var s = app.project.activeSequence;
        if (!s) throw new Error("Sem sequencia ativa");
        ${seconds !== undefined ? `s.setPlayerPosition(String(Math.round(${seconds} * TICKS)));` : ""}
        var q = qeSeq();
        q.exportFramePNG(q.CTI.timecode, ${JSON.stringify(base)}); // Windows: backslashes required (forward slashes throw); Premiere appends .png
        return true;`, 30);
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        for (const f of [base + ".png", base]) {
          if (fs.existsSync(f) && fs.statSync(f).size > 0) {
            await new Promise((r) => setTimeout(r, 300)); // let Premiere finish writing
            // 4K PNG ~18MB base64 kills the MCP connection: downscale to JPEG <=1920px (sips on Mac, System.Drawing on Windows)
            const jpg = base + "_s.jpg";
            if (!WIN) execFileSync("sips", ["-Z", "1920", "-s", "format", "jpeg", f, "--out", jpg]);
            else execFileSync("powershell", ["-NoProfile", "-Command", `Add-Type -A System.Drawing; $i=[Drawing.Image]::FromFile('${f}'); $k=[Math]::Min(1.0,1920/$i.Width); $b=New-Object Drawing.Bitmap $i,(New-Object Drawing.Size ([int]($i.Width*$k)),([int]($i.Height*$k))); $i.Dispose(); $b.Save('${jpg}',[Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose()`]);
            const data = fs.readFileSync(jpg).toString("base64");
            fs.unlinkSync(f); fs.unlinkSync(jpg);
            return { content: [{ type: "image", data, mimeType: "image/jpeg" }] };
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error("Premiere nao gerou o PNG em 15s");
    } catch (e) { return fail(e); }
  },
);

await server.connect(new StdioServerTransport());
