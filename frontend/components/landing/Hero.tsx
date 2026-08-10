import { Briefcase, Target, TrendingUp, Zap, CheckCircle2 } from "lucide-react";
import { AuthLink } from "./AuthLink";

const STATS = [
  { value: "25,000+", label: "Leads tracked" },
  { value: "6", label: "Report views" },
  { value: "4", label: "Role types" },
  { value: "100%", label: "Self-hosted" },
];

const FUNNEL: [string, number][] = [
  ["Leads Taken", 100],
  ["Interview", 72],
  ["Technical", 41],
  ["Offer", 22],
  ["Landed", 9],
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(600px circle at 20% 10%, rgba(79,70,229,0.35), transparent 40%), radial-gradient(700px circle at 90% 30%, rgba(99,102,241,0.25), transparent 45%)",
        }}
      />
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
            <AuthLink variant="hero" />
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            {["Role-based access", "AI CV optimizer", "Google Calendar"].map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-400" /> {f}
              </span>
            ))}
          </div>
        </div>

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
              {FUNNEL.map(([stage, pct]) => (
                <div key={stage} className="mb-2">
                  <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                    <span>{stage}</span><span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
  );
}
