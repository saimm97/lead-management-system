import { CalendarDays, FileSpreadsheet, Sparkles } from "lucide-react";

const INTEGRATIONS = [
  {
    icon: CalendarDays,
    title: "Google Calendar",
    desc: "Connect once per user. Interview invites are created on the organizer's calendar and emailed to attendees automatically.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Import & Export",
    desc: "Bulk-import leads, profiles and users from a spreadsheet, and export any report or table back to CSV in one click.",
  },
  {
    icon: Sparkles,
    title: "AI CV Optimizer",
    desc: "Bring your own LLM key (OpenAI-compatible — Gemini, OpenRouter, GLM) to match CVs against job descriptions and rewrite them for ATS.",
  },
];

export function Integrations() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Connects to what you already use</h2>
          <p className="mt-4 text-lg text-slate-500">No lock-in — LeadPro plugs into your existing calendar, spreadsheets and AI provider of choice.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {INTEGRATIONS.map((i) => (
            <div key={i.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <i.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{i.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{i.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
