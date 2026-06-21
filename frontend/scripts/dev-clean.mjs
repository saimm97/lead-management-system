#!/usr/bin/env node
/**
 * Ensures a healthy Next.js dev environment.
 * Corrupted .next cache is the #1 cause of recurring 500 errors in dev.
 */
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || "3000";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function killPort() {
  try {
    const pids = execSync(`lsof -ti :${PORT} 2>/dev/null || true`, { encoding: "utf8" }).trim();
    if (pids) {
      console.log(`[dev-clean] Stopping stale process(es) on port ${PORT}...`);
      for (const pid of pids.split("\n").filter(Boolean)) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }
  } catch {
    /* lsof unavailable */
  }
}

function removeNextCache() {
  const nextDir = join(root, ".next");
  if (existsSync(nextDir)) {
    console.log("[dev-clean] Removing stale .next cache...");
    rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
}

function verifyDeps() {
  const checks = [
    join(root, "node_modules/next/dist/bin/next"),
    join(root, "node_modules/react/package.json"),
    join(root, "node_modules/d3-shape/src/curve/basis.js"),
  ];
  const missing = checks.filter((p) => !existsSync(p));
  if (missing.length > 0) {
    console.log("[dev-clean] node_modules incomplete — running yarn install...");
    execSync("yarn install --frozen-lockfile", { cwd: root, stdio: "inherit" });
  }
}

killPort();
removeNextCache();
verifyDeps();
console.log("[dev-clean] Ready.");
