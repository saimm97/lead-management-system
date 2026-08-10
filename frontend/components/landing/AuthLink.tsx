"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Variant = "nav" | "hero" | "cta";

const STYLES: Record<Variant, { primary: string; secondary: string }> = {
  nav: {
    primary: "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700",
    secondary: "rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100",
  },
  hero: {
    primary: "inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700",
    secondary: "inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5",
  },
  cta: {
    primary: "inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700",
    secondary: "inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5",
  },
};

/**
 * Renders auth-aware CTA buttons (Sign in / Get started vs. Go to Dashboard).
 * Isolated as its own client component so the rest of the landing page can stay
 * server-rendered — only this tiny island needs `localStorage` + client JS.
 */
export function AuthLink({ variant, withArrow = true }: { variant: Variant; withArrow?: boolean }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("access_token"));
  }, []);

  const styles = STYLES[variant];

  // Avoid a flash of the wrong CTA before we know auth state.
  if (loggedIn === null) {
    return <span className={`${styles.primary} invisible`} aria-hidden="true">Get started</span>;
  }

  if (loggedIn) {
    return (
      <Link href="/dashboard" className={styles.primary}>
        Open Dashboard {withArrow && <ArrowRight className="h-4 w-4" />}
      </Link>
    );
  }

  return (
    <>
      <Link href="/register" className={styles.primary}>
        Get started free {withArrow && <ArrowRight className="h-4 w-4" />}
      </Link>
      {variant !== "nav" && (
        <Link href="/login" className={styles.secondary}>Sign in</Link>
      )}
    </>
  );
}

export function NavSignInLink() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("access_token"));
  }, []);
  if (loggedIn) return null;
  return (
    <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
      Sign in
    </Link>
  );
}
