"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, setTokens } from "@/lib/api";
import { Button, Input, FormField, Spinner } from "@/components/ui";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState({ full_name: "", employee_id: "", devsinc_id: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await api<{ access_token: string; refresh_token: string }>(`/auth/accept-invite/${token}`, {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name,
          employee_id: form.employee_id,
          devsinc_id: form.devsinc_id || null,
          password: form.password,
        }),
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await api("/auth/me");
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-center bg-slate-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold">LP</div>
          <div>
            <h1 className="text-2xl font-bold">LeadPro</h1>
            <p className="text-sm text-slate-400">Invitation</p>
          </div>
        </div>
        <h2 className="mt-12 text-3xl font-bold leading-tight">Complete your setup.</h2>
        <p className="mt-4 max-w-md text-slate-400">You&apos;ve been invited to join LeadPro. Fill in your details below to activate your account.</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">LP</div>
              <span className="text-xl font-bold text-slate-900">LeadPro</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Complete registration</h2>
          <p className="mt-1 text-sm text-slate-500">Set up your account credentials</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <FormField label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></FormField>
            <FormField label="Employee ID"><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required /></FormField>
            <FormField label="Devsinc ID"><Input placeholder="Engineers only" value={form.devsinc_id} onChange={(e) => setForm({ ...form, devsinc_id: e.target.value })} /></FormField>
            <FormField label="Password"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></FormField>
            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Spinner className="h-4 w-4" /> Creating account...</> : "Create Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
