import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ownRoot = fileURLToPath(new URL("../", import.meta.url));

export function initializeLocalEnvironment(projectRoot = ownRoot) {
  const filename = path.join(projectRoot, ".dev.vars");
  if (existsSync(filename)) return { created: false };
  writeFileSync(filename,
    "# Local only. Never commit or upload this file.\n" +
    `IDENTITY_HMAC_SECRET=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 });
  return { created: true };
}

export function migrateLocalDatabase(projectRoot = ownRoot, persistTo) {
  const configPath = path.join(projectRoot, "wrangler.local.jsonc");
  const wrangler = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(wrangler)) throw new Error("Dependencies are missing. Run npm run install:ci first.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.d1_databases?.[0]?.binding !== "DB" ||
      config.d1_databases?.[0]?.database_id !== "00000000-0000-4000-8000-000000000000") {
    throw new Error("Expected the delivered local-only D1 configuration.");
  }
  const result = spawnSync(process.execPath, [
    "--import", path.join(projectRoot, "scripts", "sites-env.mjs"), wrangler,
    "d1", "migrations", "apply", "DB", "--local", "--config", configPath,
    "--persist-to", persistTo ?? path.join(projectRoot, ".wrangler", "state"),
  ], {
    cwd: projectRoot,
    stdio: "inherit",
    // Local migrations are an explicit setup operation; never pass --remote.
    env: { ...process.env, CI: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Local migration failed. Existing files and database were preserved.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(value => !["--env-only", "--migrate-only"].includes(value)) || args.length > 1) {
    throw new Error("Usage: node scripts/local-setup.mjs [--env-only|--migrate-only]");
  }
  if (!args.includes("--migrate-only")) {
    const result = initializeLocalEnvironment();
    console.log(result.created ? "Local environment created with a fresh secret." : "Existing local environment preserved.");
  }
  if (!args.includes("--env-only")) migrateLocalDatabase();
  console.log("Local setup ready. Start with pnpm dev and open http://localhost:5173.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
