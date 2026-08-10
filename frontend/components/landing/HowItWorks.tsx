import { UserPlus, Workflow, LineChart } from "lucide-react";

const STEPS = [
  {
    icon: UserPlus,
    title: "Capture leads",
    desc: "Add leads manually, bulk-import from Excel, or route them straight from your BD team's daily activity — every lead is tagged with source, platform and owner.",
  },
  {
    icon: Workflow,
    title: "Move through the pipeline",
    desc: "Advance leads through interview rounds, assign them to engineers, log issues, and send calendar invites — all from one record.",
  },
  {
    icon: LineChart,
    title: "Report & improve",
    desc: "Daily, weekly and monthly reports surface conversion rates, bottlenecks and per-engineer performance so managers can act on real numbers.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-slate-500">From first contact to landed hire, in three steps.</p>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                <s.icon className="h-5 w-5" />
              </div>
              <span className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
