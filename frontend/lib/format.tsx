"use client";

import { useEffect, useState } from "react";

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Renders dates client-side only to avoid React hydration mismatch (#418). */
export function ClientDate({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(formatDateTime(iso));
  }, [iso]);

  return (
    <span className={className} suppressHydrationWarning>
      {text ?? "…"}
    </span>
  );
}
