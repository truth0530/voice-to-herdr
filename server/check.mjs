// Self-test: talks to the running server the same way the Claude app does.
//   node check.mjs                      -> tests http://127.0.0.1:<port>   (server + herdr)
//   node check.mjs https://NAME.ts.net  -> tests through Tailscale Funnel (the connector path)
// Never prints the token.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const IS_WIN = process.platform === "win32";
const CONFIG_PATH =
  process.env.VOICE_TO_HERDR_CONFIG ||
  (IS_WIN
    ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "voice-to-herdr", "config.json")
    : join(homedir(), ".config", "voice-to-herdr", "config.json"));
let cfg;
try {
  cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, ""));
} catch (e) {
  console.error(`FAIL: cannot read config ${CONFIG_PATH} (${e.code || e.message}). See SKILL.md step 3.`);
  process.exit(1);
}
// Accept either the bare Funnel address or the whole connector URL (".../mcp/<token>").
const base = (process.argv[2] || `http://127.0.0.1:${cfg.port || 8765}`).replace(/\/mcp(\/.*)?$/, "").replace(/\/+$/, "");
const url = `${base}/mcp/${cfg.token}`;
const shown = `${base}/mcp/<token>`;

async function rpc(id, method, params = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${body.slice(0, 120)}`);
  // JSON response, or (some SDK modes) Server-Sent Events: take the last "data:" line.
  const sse = body.split(/\r?\n/).filter((l) => l.startsWith("data:"));
  const json = JSON.parse(sse.length ? sse[sse.length - 1].slice(5) : body);
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

try {
  console.log(`checking ${shown}`);
  const init = await rpc(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "check", version: "1" },
  });
  console.log(`1/3 initialize ok (server ${init.serverInfo?.name} ${init.serverInfo?.version})`);
  const tools = await rpc(2, "tools/list");
  console.log(`2/3 tools: ${tools.tools.map((t) => t.name).join(", ")}`);
  const st = await rpc(3, "tools/call", { name: "standup", arguments: {} });
  const first = st.content[0].text.split("\n")[0];
  console.log(`3/3 standup: ${first}`);
  if (/local: no answer/.test(first)) {
    console.error("FAIL: the server runs, but it cannot talk to herdr on this computer.");
    console.error("-> is herdr running (`herdr status`)? is herdrPath in config a real path (Windows: C:\\...\\herdr.exe, not /c/...)?");
    process.exit(1);
  }
  if (/no answer/.test(first)) console.log("WARN: an extra machine (remotes) did not answer; the local part is fine.");
  if (/^0 agents/.test(first)) console.log("WARN: 0 agents. Start Claude Code or Codex in a herdr pane, then check again.");
  console.log("OK");
} catch (e) {
  const msg = String(e.cause?.code || e.message || e);
  console.error(`FAIL: ${msg}`);
  if (/ECONNREFUSED/.test(msg)) console.error("-> server is not running on that port (see SKILL.md, step 'service').");
  if (/HTTP 404/.test(msg)) console.error("-> path or token mismatch, or Funnel points to a different port.");
  if (/HTTP 502/.test(msg)) console.error("-> Funnel is on but nothing answers on the local port.");
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) console.error("-> that ts.net name does not exist (device renamed? see troubleshooting).");
  process.exit(1);
}
