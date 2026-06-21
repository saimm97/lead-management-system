"use client";

import { Card, DataTable, RecordIdCell, RecordIdHeader } from "./ui";
import { MonthlyTarget } from "@/lib/types";

export function MonthlyTargetsTable({
  targets,
  canEdit,
  onDelete,
}: {
  targets: MonthlyTarget[];
  canEdit?: boolean;
  onEdit?: (t: MonthlyTarget) => void;
  onDelete?: (id: number) => void;
}) {
  if (targets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        No monthly targets set for this period.
      </div>
    );
  }

  return (
    <DataTable>
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          <RecordIdHeader />
          {["Target Start", "Engineer", "Devsinc ID", "Lead Target", "Tech Stack", "Progress", "Notes", ...(canEdit ? ["Actions"] : [])].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {targets.map((t) => (
          <tr key={t.id}>
            <RecordIdCell value={t.id} />
            <td className="font-medium">{t.target_start_date}</td>
            <td className="font-medium text-slate-900">{t.engineer_name}</td>
            <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.engineer_devsinc_id || "—"}</code></td>
            <td><span className="font-semibold text-slate-900">{t.lead_target}</span></td>
            <td><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">{t.tech_stack_focus}</span></td>
            <td className="min-w-[140px]">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(t.progress_pct, 100)}%` }} />
                </div>
                <span className="whitespace-nowrap text-xs text-slate-500">{t.leads_assigned_count}/{t.lead_target}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{t.progress_pct}% complete</p>
            </td>
            <td className="max-w-[200px] truncate text-slate-500">{t.notes || "—"}</td>
            {canEdit && (
              <td>
                <button onClick={() => onDelete?.(t.id)} className="text-sm font-medium text-red-600 hover:text-red-700">Delete</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function TargetSummaryCards({ summary }: { summary: { total_targets: number; avg_completion_pct: number; engineers_below_quota: number } }) {
  const cards = [
    { label: "Total Targets", value: summary.total_targets, color: "text-slate-900" },
    { label: "Avg Completion", value: `${summary.avg_completion_pct}%`, color: "text-emerald-600" },
    { label: "Below Quota", value: summary.engineers_below_quota, color: "text-red-600" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <p className="text-sm font-medium text-slate-500">{c.label}</p>
          <p className={`mt-1 text-3xl font-bold tracking-tight ${c.color}`}>{c.value}</p>
        </Card>
      ))}
    </div>
  );
}
