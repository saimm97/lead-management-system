"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase, Users, BarChart3, AlertCircle, CalendarDays, FileSearch,
  Shield, ArrowRight, CheckCircle2, Target, TrendingUp, Zap,
} from "lucide-react";

const FEATURES = [
  { icon: Briefcase, title: "Lead Pipeline", desc: "Track every opportunity through customizable phases, types and statuses — from applied to landed." },
  { icon: BarChart3, title: "BD & Engineer Reports", desc: "Daily per-BD activity, engineer conversion funnels, per-technology performance, and resource breakdowns." },
  { icon: Shield, title: "Role-Based Access", desc: "Admin, Manager, BD and Engineer roles — each sees exactly what they should, with approvals and audit logs." },
  { icon: AlertCircle, title: "Issue Tracking", desc: "Flag lead-quality problems, tie them to a lead or engineer, and route them to managers for triage." },
  { icon: CalendarDays, title: "Calendar Invites", desc: "Connect Google Calendar and send interview invites to engineers — emailed and auto-added to their calendar." },
  { icon: FileSearch, title: "CV Optimizer", desc: "Match a CV against a job description with AI to surface gaps and generate an ATS-optimized rewrite." },
];

const ROLES = [
  { title: "Business Development", points: ["Create & assign leads", "Track platforms & sources", "Log issues to managers", "Send calendar invites"] },
  { title: "Engineers", points: ["See assigned leads", "Follow interview rounds", "Report lead issues", "Optimize CVs with AI"] },
  { title: "Managers", points: ["Approve registrations", "Update lead status", "Full BD & Engineer reports", "Set monthly targets"] },
  { title: "Admins", points: ["Manage all users", "Import data from Excel", "Configure statuses", "Audit every action"] },
];

const STATS = [
  { value: "25,000+", label: "Leads tracked" },
  { value: "6", label: "Report views" },
  { value: "4", label: "Role types" },
  { value: "100%", label: "Self-hosted" },
];

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("access_token"));
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lg shadow-brand-600/30">LP</div>
            <span className="text-lg font-bold tracking-tight">LeadPro</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#roles" className="hover:text-slate-900">Roles</a>
            <a href="#reports" className="hover:text-slate-900">Reports</a>
          </nav>
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/dashboard" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700">Go to Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">Sign in</Link>
                <Link href="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(600px circle at 20% 10%, rgba(79,70,229,0.35), transparent 40%), radial-gradient(700px circle at 90% 30%, rgba(99,102,241,0.25), transparent 45%)" }} />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
              <Zap className="h-3.5 w-3.5" /> Business Development Platform
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Manage leads,<br />track pipeline,<br /><span className="text-brand-400">close deals.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-slate-400">
              End-to-end lead management for BD teams, engineers and managers — with targets, profiles, calendar invites, AI CV tooling and real-time reporting.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={loggedIn ? "/dashboard" : "/register"} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700">
                {loggedIn ? "Open Dashboard" : "Get started free"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
                Sign in
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
              {["Role-based access", "AI CV optimizer", "Google Calendar"].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-400" /> {f}</span>
              ))}
            </div>
          </div>

          {/* Mock dashboard */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Leads", value: "25,000", icon: Briefcase },
                  { label: "Conversion", value: "18%", icon: TrendingUp },
                  { label: "Interviews", value: "4,120", icon: Target },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl bg-slate-900/70 p-3">
                    <k.icon className="h-4 w-4 text-brand-400" />
                    <p className="mt-2 text-lg font-bold">{k.value}</p>
                    <p className="text-[11px] text-slate-400">{k.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-slate-900/70 p-4">
                <p className="mb-3 text-xs font-medium text-slate-400">Engineer funnel</p>
                {[["Leads Taken", 100], ["Interview", 72], ["Technical", 41], ["Offer", 22], ["Landed", 9]].map(([stage, pct]) => (
                  <div key={stage as string} className="mb-2">
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>{stage}</span><span>{pct}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-sm text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything your BD engine needs</h2>
          <p className="mt-4 text-lg text-slate-500">One platform to capture leads, move them through the pipeline, and measure every person's performance.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for every role</h2>
            <p className="mt-4 text-lg text-slate-500">Each person gets a focused workspace with the right permissions.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><Users className="h-4 w-4" /></div>
                <h3 className="mt-4 font-semibold">{r.title}</h3>
                <ul className="mt-3 space-y-2">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reports highlight */}
      <section id="reports" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"><BarChart3 className="h-3.5 w-3.5" /> Reporting</span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Measure performance, not guesswork</h2>
            <p className="mt-4 text-lg text-slate-500">Reports are split into BD and Engineer views so managers can evaluate the whole team at a glance.</p>
            <ul className="mt-6 space-y-3">
              {[
                "Daily per-BD report — leads applied, platforms used, and the engineer each lead went to",
                "Engineer funnel — % reaching screening, interview, technical, offer and landed",
                "Per-technology breakdown and conversion rates in a click-through detail view",
                "Export any report to CSV",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevated">
            <p className="text-sm font-semibold text-slate-900">Engineer Report · last 30 days</p>
            <div className="mt-4 space-y-3">
              {[["Ayesha K.", 92, 14], ["Bilal N.", 78, 9], ["Sara M.", 64, 6]].map(([name, conv, landed]) => (
                <div key={name as string} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{name}</span>
                    <span className="text-emerald-600">{landed} landed</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${conv}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-slate-950 px-8 py-16 text-center text-white shadow-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to run a tighter pipeline?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">Create an account and start tracking leads, targets and performance in minutes.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={loggedIn ? "/dashboard" : "/register"} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
              {loggedIn ? "Open Dashboard" : "Get started"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5">Sign in</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">LP</div>
            <span className="font-semibold">LeadPro</span>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} LeadPro. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="hover:text-slate-900">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
