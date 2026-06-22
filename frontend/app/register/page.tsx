"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { UserRole, RegisterResult } from "@/lib/types";
import { Button, Input, FormField, Select, Spinner } from "@/components/ui";
import { CheckCircle2, Mail } from "lucide-react";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "bd", label: "Business Development" },
  { value: "engineer", label: "Engineer" },
  { value: "manager", label: "Manager" },
];

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", full_name: "", employee_id: "", devsinc_id: "", role: "bd" as UserRole, method: "email" as "email" | "approval" });
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<RegisterResult>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          employee_id: form.employee_id,
          role: form.role,
          devsinc_id: form.role === "engineer" ? form.devsinc_id || null : null,
          method: form.method,
        }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const emailMethod = result.status === "pending_confirmation";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${emailMethod ? "bg-brand-50 text-brand-600" : "bg-emerald-50 text-emerald-600"}`}>
            {emailMethod ? <Mail className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{emailMethod ? "Confirm your email" : "Registration Submitted"}</h2>
          <p className="mt-2 text-sm text-slate-500">{result.message}</p>
          {result.confirmation_url && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
              <p className="font-medium">Email isn&apos;t configured on the server — use this confirmation link:</p>
              <Link href={result.confirmation_url.replace(/^https?:\/\/[^/]+/, "")} className="mt-1 block break-all font-medium text-brand-600 hover:underline">{result.confirmation_url}</Link>
            </div>
          )}
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
            <p className="text-sm text-slate-400">Account Registration</p>
          </div>
        </div>
        <h2 className="mt-12 text-3xl font-bold leading-tight">Join the team.</h2>
        <p className="mt-4 max-w-md text-slate-400">Register for an account. Your request will be reviewed by an administrator before your account is activated.</p>
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
          <p className="mt-1 text-sm text-slate-500">Choose how you&apos;d like to activate your account</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <FormField label="Activation method">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  { value: "email", title: "Email confirmation", desc: "Get a link to instantly activate" },
                  { value: "approval", title: "Admin approval", desc: "An admin reviews your request" },
                ] as const).map((m) => (
                  <button
                    type="button"
                    key={m.value}
                    onClick={() => setForm({ ...form, method: m.value })}
                    className={`rounded-lg border p-3 text-left transition ${form.method === m.value ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <p className="text-sm font-medium text-slate-900">{m.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></FormField>
            <FormField label="Employee ID"><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required /></FormField>
            {form.role === "engineer" && (
              <FormField label="Devsinc ID"><Input value={form.devsinc_id} onChange={(e) => setForm({ ...form, devsinc_id: e.target.value })} /></FormField>
            )}
            <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></FormField>
            <FormField label="Password"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></FormField>
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
