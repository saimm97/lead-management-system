import { Users, CheckCircle2 } from "lucide-react";

const ROLES = [
  { title: "Business Development", points: ["Create & assign leads", "Track platforms & sources", "Log issues to managers", "Send calendar invites"] },
  { title: "Engineers", points: ["See assigned leads", "Follow interview rounds", "Report lead issues", "Optimize CVs with AI"] },
  { title: "Managers", points: ["Approve registrations", "Update lead status", "Full BD & Engineer reports", "Set monthly targets"] },
  { title: "Admins", points: ["Manage all users", "Import data from Excel", "Configure statuses", "Audit every action"] },
];

export function Roles() {
  return (
    <section id="roles" className="mx-auto max-w-6xl px-6 py-24">
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
    </section>
  );
}
