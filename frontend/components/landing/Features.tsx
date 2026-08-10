import {
  Briefcase, BarChart3, AlertCircle, CalendarDays, FileSearch, Shield,
} from "lucide-react";

const FEATURES = [
  { icon: Briefcase, title: "Lead Pipeline", desc: "Track every opportunity through customizable phases, types and statuses — from applied to landed." },
  { icon: BarChart3, title: "BD & Engineer Reports", desc: "Daily per-BD activity, engineer conversion funnels, per-technology performance, and resource breakdowns." },
  { icon: Shield, title: "Role-Based Access", desc: "Admin, Manager, BD and Engineer roles — each sees exactly what they should, with approvals and audit logs." },
  { icon: AlertCircle, title: "Issue Tracking", desc: "Flag lead-quality problems, tie them to a lead or engineer, and route them to managers for triage." },
  { icon: CalendarDays, title: "Calendar Invites", desc: "Connect Google Calendar and send interview invites to engineers — emailed and auto-added to their calendar." },
  { icon: FileSearch, title: "CV Optimizer", desc: "Match a CV against a job description with AI to surface gaps and generate an ATS-optimized rewrite." },
];

export function Features() {
  return (
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
  );
}
