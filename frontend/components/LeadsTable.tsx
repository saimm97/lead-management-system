"use client";

import { useMemo } from "react";
import { Badge } from "./ui";
import { Lead } from "@/lib/types";
import Link from "next/link";
import { History, ExternalLink, AlertCircle } from "lucide-react";
import { ClientDate } from "@/lib/format";
import { SortableTable, TableColumn } from "./SortableTable";
import { SortDirection, COL_MIN } from "@/lib/tableUtils";

export function StatusBadge({ phase, type, status }: { phase: string; type: string; status: string }) {
  const variant = phase === "Closed" ? "red" : phase === "Offer" ? "green" : phase === "Interview" ? "blue" : "default";
  return (
    <div className="space-y-1.5">
      <Badge variant={variant as "default"}>{phase}</Badge>
      <p className="text-xs leading-tight text-slate-500">{type} · {status}</p>
    </div>
  );
}

function leadColumns(onHistory: (id: number) => void): TableColumn<Lead>[] {
  return [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (l) => l.id, className: "text-center font-medium tabular-nums text-slate-500", render: (l) => l.id },
    { id: "created_at", label: "Created", minWidth: COL_MIN.date, getSortValue: (l) => l.created_at, className: "whitespace-nowrap text-slate-500", render: (l) => <ClientDate iso={l.created_at} /> },
    { id: "company", label: "Company", minWidth: COL_MIN.md, getSortValue: (l) => l.company, className: "font-medium text-slate-900", render: (l) => l.company },
    {
      id: "job_title", label: "Job Title", minWidth: COL_MIN.lg, getSortValue: (l) => l.job_title, render: (l) => (
        <Link href={`/leads/${l.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline">
          {l.job_title}<ExternalLink className="h-3 w-3 opacity-50" />
        </Link>
      ),
    },
    { id: "job_source", label: "Source", minWidth: COL_MIN.sm, getSortValue: (l) => l.job_source, render: (l) => <Badge variant="indigo">{l.job_source}</Badge> },
    {
      id: "technologies", label: "Technologies", minWidth: COL_MIN.lg, getSortValue: (l) => l.primary_tech || l.technologies.join(", "),
      render: (l) => (
        <>
          {l.primary_tech && <Badge variant="green">{l.primary_tech}</Badge>}
          {l.technologies.length > 0 && <p className="mt-1 text-xs leading-relaxed text-slate-400">{l.technologies.join(", ")}</p>}
        </>
      ),
    },
    { id: "engineer", label: "Engineer", minWidth: COL_MIN.md, getSortValue: (l) => l.assigned_engineer_name || "", className: "font-medium", render: (l) => l.assigned_engineer_name || <span className="text-slate-400">Unassigned</span> },
    { id: "devsinc_id", label: "Devsinc ID", minWidth: COL_MIN.sm, getSortValue: (l) => l.assigned_engineer_devsinc_id || "", render: (l) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{l.assigned_engineer_devsinc_id || "—"}</code> },
    { id: "cluster_head", label: "Cluster Head", minWidth: COL_MIN.md, getSortValue: (l) => l.cluster_head_name || "", className: "text-sm text-slate-600", render: (l) => l.cluster_head_name || "—" },
    { id: "interview_number", label: "Interview", minWidth: COL_MIN.sm, getSortValue: (l) => l.interview_number || "", className: "text-sm text-slate-600", render: (l) => l.interview_number || "—" },
    { id: "interview_round", label: "Round", minWidth: COL_MIN.sm, getSortValue: (l) => l.interview_round || "", className: "text-sm text-slate-600", render: (l) => l.interview_round || "—" },
    { id: "profile", label: "Profile", minWidth: COL_MIN.md, getSortValue: (l) => l.profile_name || "", render: (l) => l.profile_name || "—" },
    { id: "status", label: "Status", minWidth: COL_MIN.lg, getSortValue: (l) => `${l.phase}/${l.type}/${l.status}`, render: (l) => <StatusBadge phase={l.phase} type={l.type} status={l.status} /> },
    { id: "bd", label: "BD", minWidth: COL_MIN.md, getSortValue: (l) => l.bd_name || "", className: "text-xs text-slate-600", render: (l) => l.bd_name || "—" },
    {
      id: "issues", label: "Issues", minWidth: COL_MIN.sm, getSortValue: (l) => l.issue_count,
      render: (l) => (
        l.issue_count > 0 ? (
          <Link
            href={`/issues?lead_id=${l.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
            title={`View ${l.issue_count} issue${l.issue_count > 1 ? "s" : ""} for this lead`}
          >
            <AlertCircle className="h-3 w-3" />
            {l.issue_count}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )
      ),
    },
    {
      id: "actions", label: "Actions", minWidth: COL_MIN.actions, sortable: false, render: (l) => (
        <button onClick={() => onHistory(l.id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600" title="View history">
          <History className="h-4 w-4" />
        </button>
      ),
    },
  ];
}

export function LeadsTable({
  leads,
  onHistory,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  selectable = false,
  sort,
  onSortChange,
}: {
  leads: Lead[];
  onHistory: (id: number) => void;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  selectable?: boolean;
  sort?: { columnId: string; direction: SortDirection };
  onSortChange?: (columnId: string, direction: SortDirection) => void;
}) {
  const columns = useMemo(() => leadColumns(onHistory), [onHistory]);

  return (
    <SortableTable
      storageKey="leads"
      columns={columns}
      data={leads}
      emptyMessage="No leads found. Adjust filters or create a new lead."
      selectable={selectable}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      allSelected={allSelected}
      rowClassName={(l) => (selected?.has(l.id) ? "bg-brand-50/50" : undefined)}
      serverSort
      sort={sort}
      onSortChange={onSortChange}
      defaultSort={{ columnId: "id", direction: "asc" }}
    />
  );
}
