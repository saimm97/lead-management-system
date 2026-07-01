"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Input, FormField, Spinner } from "@/components/ui";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      setDone(true);
    } catch {
      // Always show the generic message to avoid leaking which emails exist.
      setMessage("If an account with that email exists, your reset request has been submitted for admin approval.");
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <MailCheck className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Request submitted</h2>
            <p className="mt-2 text-sm text-slate-500">{message}</p>
            <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Back to login</Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900">Forgot your password?</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your email. Your reset request will be sent to an administrator for approval, and you&apos;ll receive a secure link once it&apos;s approved.</p>
            <form onSubmit={submit} className="mt-6 space-y-5">
              <FormField label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
              </FormField>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <><Spinner className="h-4 w-4" /> Submitting…</> : "Request password reset"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
