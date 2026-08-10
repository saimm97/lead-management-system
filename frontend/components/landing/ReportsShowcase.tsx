import { BarChart3, CheckCircle2 } from "lucide-react";

const HIGHLIGHTS = [
  "Daily per-BD report — leads applied, platforms used, and the engineer each lead went to",
  "Engineer funnel — % reaching screening, interview, technical, offer and landed",
  "Per-technology breakdown and conversion rates in a click-through detail view",
  "Export any report to CSV",
];

const ENGINEERS: [string, number, number][] = [
  ["Ayesha K.", 92, 14],
  ["Bilal N.", 78, 9],
  ["Sara M.", 64, 6],
];

export function ReportsShowcase() {
  return (
    <section id="reports" className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <BarChart3 className="h-3.5 w-3.5" /> Reporting
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Measure performance, not guesswork</h2>
          <p className="mt-4 text-lg text-slate-500">Reports are split into BD and Engineer views so managers can evaluate the whole team at a glance.</p>
          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((t) => (
              <li key={t} className="flex items-start gap-3 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevated">
          <p className="text-sm font-semibold text-slate-900">Engineer Report · last 30 days</p>
          <div className="mt-4 space-y-3">
            {ENGINEERS.map(([name, conv, landed]) => (
              <div key={name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
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
  );
}
