"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Input, FormField, Spinner } from "@/components/ui";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ valid: boolean; email: string | null }>(`/auth/reset-password/${token}`)
      .then((r) => { setValid(r.valid); setEmail(r.email); })
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      await api(`/auth/reset-password/${token}`, { method: "POST", body: JSON.stringify({ new_password: password }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {checking ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : done ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
            <p className="mt-2 text-sm text-slate-500">You can now sign in with your new password.</p>
            <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Go to login</Link>
          </div>
        ) : !valid ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-slate-900">Link expired or invalid</h2>
            <p className="mt-2 text-sm text-slate-500">This reset link is no longer valid. Please request a new one.</p>
            <Link href="/forgot-password" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Request a new link</Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900">Set a new password</h2>
            {email && <p className="mt-1 text-sm text-slate-500">for {email}</p>}
            <form onSubmit={submit} className="mt-6 space-y-5">
              <FormField label="New Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></FormField>
              <FormField label="Confirm Password"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} /></FormField>
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <><Spinner className="h-4 w-4" /> Updating…</> : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
