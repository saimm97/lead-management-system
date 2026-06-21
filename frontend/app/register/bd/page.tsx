"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Input, FormField, Spinner } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

export default function BDRegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", full_name: "", employee_id: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/auth/register/bd", { method: "POST", body: JSON.stringify(form) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Registration Submitted</h2>
          <p className="mt-2 text-sm text-slate-500">Your account is pending admin approval. You will be notified once approved.</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-center bg-slate-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold">LP</div>
          <div>
            <h1 className="text-2xl font-bold">LeadPro</h1>
            <p className="text-sm text-slate-400">BD Executive Registration</p>
          </div>
        </div>
        <h2 className="mt-12 text-3xl font-bold leading-tight">Join the team.</h2>
        <p className="mt-4 max-w-md text-slate-400">Register as a Business Development executive. Your account will be reviewed by an administrator before activation.</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">LP</div>
              <span className="text-xl font-bold text-slate-900">LeadPro</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">BD Executive registration</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <FormField label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></FormField>
            <FormField label="Employee ID"><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required /></FormField>
            <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></FormField>
            <FormField label="Password"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></FormField>
            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Spinner className="h-4 w-4" /> Submitting...</> : "Register"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
