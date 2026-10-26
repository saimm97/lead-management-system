"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

type Run = {
  id: number;
  trigger: string;
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at: string | null;
  triggered_by: string | null;
  stats: { inserted?: number; feed_inserted?: number; closed?: number; failed_boards?: number } | null;
  error: string | null;
};

type RefreshStatus = {
  can_refresh: boolean;
  running: Run | null;
  last_run: Run | null;
  cooldown_seconds: number;
};

// The API sends naive UTC timestamps.
function utc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

function summary(run: Run): string {
  const when = utc(run.finished_at ?? run.started_at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (run.status === "failed") return `Last refresh failed (${when})${run.error ? `: ${run.error}` : ""}`;
  const added = (run.stats?.inserted ?? 0) + (run.stats?.feed_inserted ?? 0);
  const closed = run.stats?.closed ?? 0;
  return `Last refreshed ${when}: ${added} new, ${closed} closed`;
}

export function RefreshPipelineButton({ onFinished }: { onFinished: () => void }) {
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [wait, setWait] = useState(0);
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await api<RefreshStatus>("/ai-pipeline/refresh/status");
      setStatus(next);
      setWait(next.cooldown_seconds);
      if (wasRunning.current && !next.running) onFinished();
      wasRunning.current = Boolean(next.running);
    } catch {
      /* the page still works without the status line */
    }
  }, [onFinished]);

  useEffect(() => {
    load();
  }, [load]);

  const running = Boolean(status?.running);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [running, load]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const refresh = async () => {
    setStarting(true);
    setError("");
    try {
      await api<Run>("/ai-pipeline/refresh", { method: "POST" });
      wasRunning.current = true;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a refresh");
      await load();
    } finally {
      setStarting(false);
    }
  };

  if (!status) return null;

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      {status.can_refresh && (
        <Button type="button" variant="secondary" onClick={refresh} disabled={starting || running || wait > 0}>
          <RefreshCw className={`mr-2 h-4 w-4 ${running || starting ? "animate-spin" : ""}`} />
          {running ? "Refreshing…" : wait > 0 ? `Refresh in ${wait}s` : "Refresh Pipeline"}
        </Button>
      )}
      {status.last_run && !running && <p className="max-w-xs text-xs text-slate-500">{summary(status.last_run)}</p>}
      {error && <p className="max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
