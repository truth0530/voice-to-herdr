// Creates (or updates) the config file and fills in a fresh random token without ever printing it.
//   node setup-config.mjs --port 8765 --herdr "<herdr 경로>"
//   node setup-config.mjs --new-token          (replace the token only, e.g. after a leak)
// Prints the config path and the non-secret settings.
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const IS_WIN = process.platform === "win32";
const CONFIG_PATH =
  process.env.VOICE_TO_HERDR_CONFIG ||
  (IS_WIN
    ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "voice-to-herdr", "config.json")
    : join(homedir(), ".config", "voice-to-herdr", "config.json"));

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

let cfg = { port: 8765, allowPrompt: false, herdrPath: "herdr", remotes: [] };
if (existsSync(CONFIG_PATH)) cfg = { ...cfg, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "")) };
const fail = (m) => { console.error(`error: ${m}`); process.exit(1); };
if (opt("--port") !== undefined) {
  const p = Number(opt("--port"));
  if (!Number.isInteger(p) || p < 1024 || p > 65535) fail("--port must be a whole number from 1024 to 65535");
  cfg.port = p;
}
if (opt("--herdr") !== undefined) {
  const h = opt("--herdr");
  if (IS_WIN && /^\/[a-z]\//i.test(h)) fail("on Windows use the C:\\...\\herdr.exe form from `where.exe herdr`, not a Git Bash /c/... path");
  if (h !== "herdr" && !existsSync(h)) fail(`herdr not found at ${h}`);
  cfg.herdrPath = h;
}
if (opt("--allow-prompt") !== undefined) {
  const v = opt("--allow-prompt");
  if (v !== "true" && v !== "false") fail("--allow-prompt must be true or false");
  cfg.allowPrompt = v === "true";
}
if (!/^[A-Za-z0-9_-]{32,}$/.test(String(cfg.token || "")) || args.includes("--new-token")) cfg.token = randomBytes(32).toString("hex");

mkdirSync(dirname(CONFIG_PATH), { recursive: true });
writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
if (!IS_WIN) chmodSync(CONFIG_PATH, 0o600);
let winRestricted = false;
if (IS_WIN) {
  // The mode above does nothing on Windows: the file keeps the folder's inherited ACL, which can include other
  // accounts and sandbox users. Remove the inheritance and leave read/write for the current account only.
  const user = process.env.USERNAME;
  const who = user && process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\${user}` : user;
  const r = who ? spawnSync("icacls", [CONFIG_PATH, "/inheritance:r", "/grant:r", `${who}:(R,W)`], { stdio: "ignore", windowsHide: true }) : { status: 1 };
  winRestricted = r.status === 0;
  if (!winRestricted) console.error(`WARNING: could not restrict permissions on ${CONFIG_PATH}. It holds the token: run  icacls "${CONFIG_PATH}" /inheritance:r /grant:r "%USERNAME%:(R,W)"`);
}
console.log(`config: ${CONFIG_PATH}`);
console.log(`port=${cfg.port} herdrPath=${cfg.herdrPath} allowPrompt=${cfg.allowPrompt} remotes=${(cfg.remotes || []).length} token=(set, hidden)`);
if (winRestricted) console.log("permissions: config file restricted to your Windows account");
if (cfg.allowPrompt && opt("--allow-prompt") === undefined) {
  console.log("NOTE: allowPrompt=true was kept from the existing config. Ask the user; to turn it off: --allow-prompt false");
}
