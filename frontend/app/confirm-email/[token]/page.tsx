"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, setTokens } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function ConfirmEmailPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const tokens = await api<{ access_token: string; refresh_token: string }>(`/auth/confirm-email/${token}`, { method: "POST" });
        setTokens(tokens.access_token, tokens.refresh_token);
        const user = await api("/auth/me");
        localStorage.setItem("user", JSON.stringify(user));
        setState("ok");
        setTimeout(() => router.push("/dashboard"), 1200);
      } catch {
        setState("error");
      }
    })();
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        {state === "working" && (
          <>
            <div className="flex justify-center py-4"><Spinner /></div>
            <p className="text-sm text-slate-500">Confirming your account…</p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-slate-900">Account confirmed</h2>
            <p className="mt-2 text-sm text-slate-500">You&apos;re signed in. Redirecting to your dashboard…</p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-slate-900">Confirmation failed</h2>
            <p className="mt-2 text-sm text-slate-500">This confirmation link is invalid or has expired.</p>
            <Link href="/register" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Register again</Link>
          </>
        )}
      </div>
    </div>
  );
}
