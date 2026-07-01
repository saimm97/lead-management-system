"use client";

import { useMemo } from "react";
import { Card } from "./ui";
import { SortableTable, TableColumn } from "./SortableTable";
import { COL_MIN } from "@/lib/tableUtils";
import { MonthlyTarget } from "@/lib/types";

function targetColumns(canEdit: boolean, onDelete?: (id: number) => void): TableColumn<MonthlyTarget>[] {
  const cols: TableColumn<MonthlyTarget>[] = [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (t) => t.id, className: "text-center font-medium tabular-nums text-slate-500", render: (t) => t.id },
    { id: "target_start_date", label: "Target Start", minWidth: COL_MIN.date, getSortValue: (t) => t.target_start_date, className: "font-medium", render: (t) => t.target_start_date },
    { id: "engineer", label: "Engineer", minWidth: COL_MIN.md, getSortValue: (t) => t.engineer_name, className: "font-medium text-slate-900", render: (t) => t.engineer_name },
    { id: "devsinc_id", label: "Devsinc ID", minWidth: COL_MIN.sm, getSortValue: (t) => t.engineer_devsinc_id || "", render: (t) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.engineer_devsinc_id || "—"}</code> },
    { id: "lead_target", label: "Lead Target", minWidth: COL_MIN.sm, getSortValue: (t) => t.lead_target, render: (t) => <span className="font-semibold text-slate-900">{t.lead_target}</span> },
    { id: "tech_stack", label: "Tech Stack", minWidth: COL_MIN.md, getSortValue: (t) => t.tech_stack_focus, render: (t) => <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">{t.tech_stack_focus}</span> },
    {
      id: "progress", label: "Progress", minWidth: "min-w-[10rem]", getSortValue: (t) => t.progress_pct,
      render: (t) => (
        <>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(t.progress_pct, 100)}%` }} />
            </div>
            <span className="whitespace-nowrap text-xs text-slate-500">{t.leads_assigned_count}/{t.lead_target}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.progress_pct}% complete</p>
        </>
      ),
    },
    { id: "notes", label: "Notes", minWidth: COL_MIN.xl, getSortValue: (t) => t.notes || "", className: "whitespace-normal text-slate-500", render: (t) => t.notes || "—" },
  ];
  if (canEdit) {
    cols.push({
      id: "actions", label: "Actions", minWidth: COL_MIN.actions, sortable: false,
      render: (t) => <button onClick={() => onDelete?.(t.id)} className="text-sm font-medium text-red-600 hover:text-red-700">Delete</button>,
    });
  }
  return cols;
}

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
  const columns = useMemo(() => targetColumns(!!canEdit, onDelete), [canEdit, onDelete]);

  return (
    <SortableTable
      storageKey="monthly-targets"
      columns={columns}
      data={targets}
      emptyMessage="No monthly targets set for this period."
    />
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
