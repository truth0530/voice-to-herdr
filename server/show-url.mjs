// Prints the full connector URL once, for pasting into the Claude app.
//   node show-url.mjs https://<기기 이름>.<tailnet>.ts.net
// Treat the output like a password.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const IS_WIN = process.platform === "win32";
const CONFIG_PATH =
  process.env.VOICE_TO_HERDR_CONFIG ||
  (IS_WIN
    ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "voice-to-herdr", "config.json")
    : join(homedir(), ".config", "voice-to-herdr", "config.json"));
const base = String(process.argv[2] || "").replace(/\/mcp(\/.*)?$/, "").replace(/\/+$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("usage: node show-url.mjs https://<기기 이름>.<tailnet>.ts.net   (from `tailscale funnel status`)");
  process.exit(1);
}
const { token } = JSON.parse(readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, ""));
console.log(`${base}/mcp/${token}`);
