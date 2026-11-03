import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

// Preserve the managed Sites installer; clean exported checkouts use native pnpm.
if (readExecutionProfile() === "managed-linux") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./install-pnpm.sh", import.meta.url)),
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

function pnpm(operation, capture = false) {
  // On Windows pnpm is a .cmd shim. These command strings are fixed: no user
  // input, path, credential or other interpolated argument enters cmd.exe.
  const commands = {
    version: "pnpm --version",
    install: "pnpm install --frozen-lockfile --prod=false --ignore-scripts=false",
  };
  const invocation = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", commands[operation]]]
    : ["pnpm", operation === "version"
      ? ["--version"]
      : ["install", "--frozen-lockfile", "--prod=false", "--ignore-scripts=false"]];
  return spawnSync(invocation[0], invocation[1], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: capture ? "utf8" : undefined,
  });
}

const version = pnpm("version", true);
if (version.error || version.status !== 0 || version.stdout.trim() !== "11.25.0") {
  console.error("Install the pinned package manager first: npm install --global pnpm@11.25.0");
  process.exit(69);
}
const installed = pnpm("install");
if (installed.error) throw installed.error;
process.exit(installed.status ?? 1);
