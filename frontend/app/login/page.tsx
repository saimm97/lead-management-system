"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setTokens } from "@/lib/api";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { Briefcase, Shield, BarChart3 } from "lucide-react";

const demos = [
  { role: "Admin", email: "admin@leadpro.com", pass: "admin123" },
  { role: "Manager", email: "manager@leadpro.com", pass: "manager123" },
  { role: "BD", email: "bd@leadpro.com", pass: "bd123456" },
  { role: "Engineer", email: "engineer@leadpro.com", pass: "engineer123" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setCheckingSession(true);
      router.replace("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await api("/auth/me");
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  if (checkingSession) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Spinner />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-slate-950 p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold shadow-lg shadow-brand-600/40">LP</div>
            <div>
              <h1 className="text-2xl font-bold">LeadPro</h1>
              <p className="text-sm text-slate-400">Business Development Platform</p>
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Manage leads,<br />track pipeline,<br />
            <span className="text-brand-400">close deals.</span>
          </h2>
          <p className="max-w-md text-lg text-slate-400">
            End-to-end lead management for BD teams, engineers, and managers — with targets, profiles, and real-time reporting.
          </p>
          <div className="flex gap-6">
            {[
              { icon: Briefcase, label: "Lead Tracking" },
              { icon: BarChart3, label: "Analytics" },
              { icon: Shield, label: "Role-Based Access" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className="h-5 w-5 text-brand-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-600">© 2026 LeadPro. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">LP</div>
              <span className="text-xl font-bold text-slate-900">LeadPro</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <Label>Email address</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">Forgot password?</Link>
              </div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Spinner className="h-4 w-4" /> Signing in...</> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">Create an account</Link>
          </p>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Demo accounts — click to fill</p>
            <div className="grid grid-cols-2 gap-2">
              {demos.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => quickLogin(d.email, d.pass)}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="font-semibold text-slate-700">{d.role}</span>
                  <span className="mt-0.5 block truncate text-slate-400">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
