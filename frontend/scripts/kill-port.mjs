#!/usr/bin/env node
import { execSync } from "node:child_process";

const PORT = process.env.PORT || "3000";

try {
  const pids = execSync(`lsof -ti :${PORT} 2>/dev/null || true`, { encoding: "utf8" }).trim();
  if (pids) {
    console.log(`[kill-port] Stopping process(es) on port ${PORT} before build...`);
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
