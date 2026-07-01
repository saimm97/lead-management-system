"use client";

import { useMemo } from "react";
import { Badge, Card } from "./ui";
import { Profile } from "@/lib/types";
import Link from "next/link";
import { ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { SortableTable, TableColumn } from "./SortableTable";
import { COL_MIN } from "@/lib/tableUtils";

export function ProfileKpiCards({ summary }: { summary: { total: number; active: number; in_use: number; linkedin_verified: number; linkedin_unverified: number; linkedin_missing: number; github_present: number; github_missing: number } }) {
  const cards = [
    { label: "Total Profiles", value: summary.total, sub: `${summary.active} active` },
    { label: "LinkedIn Verified", value: summary.linkedin_verified, color: "text-emerald-600" },
    { label: "LinkedIn Unverified", value: summary.linkedin_unverified, color: "text-amber-600" },
    { label: "GitHub Present", value: summary.github_present, color: "text-blue-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <p className="text-sm font-medium text-slate-500">{c.label}</p>
          <p className={`mt-1 text-3xl font-bold tracking-tight ${c.color || "text-slate-900"}`}>{c.value}</p>
          {c.sub && <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>}
        </Card>
      ))}
    </div>
  );
}

function profileColumns(onVerify: (id: number) => void): TableColumn<Profile>[] {
  return [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (p) => p.id, className: "text-center font-medium tabular-nums text-slate-500", render: (p) => p.id },
    {
      id: "name", label: "Name", minWidth: COL_MIN.md, getSortValue: (p) => p.full_name,
      render: (p) => <Link href={`/profiles/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.full_name}</Link>,
    },
    {
      id: "linkedin", label: "LinkedIn", minWidth: COL_MIN.lg, getSortValue: (p) => (p.linkedin_verified ? 1 : p.linkedin_url ? 0 : -1),
      render: (p) => p.linkedin_url ? (
        <div className="flex items-center gap-2">
          <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            Profile <ExternalLink className="h-3 w-3" />
          </a>
          {p.linkedin_verified ? <Badge variant="green"><CheckCircle2 className="mr-1 inline h-3 w-3" />Verified</Badge> : <Badge variant="yellow">Unverified</Badge>}
        </div>
      ) : <Badge variant="red"><XCircle className="mr-1 inline h-3 w-3" />Missing</Badge>,
    },
    {
      id: "github", label: "GitHub", minWidth: COL_MIN.sm, getSortValue: (p) => (p.github_present ? 1 : 0),
      render: (p) => p.github_present ? <a href={p.github_url!} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">GitHub</a> : <Badge variant="red">Missing</Badge>,
    },
    { id: "tech_stack", label: "Tech Stack", minWidth: COL_MIN.md, getSortValue: (p) => p.primary_tech_stack || "", render: (p) => p.primary_tech_stack ? <Badge variant="green">{p.primary_tech_stack}</Badge> : "—" },
    { id: "engineer", label: "Engineer", minWidth: COL_MIN.md, getSortValue: (p) => p.assigned_engineer_name || "", className: "font-medium", render: (p) => p.assigned_engineer_name || "—" },
    { id: "devsinc_id", label: "Devsinc ID", minWidth: COL_MIN.sm, getSortValue: (p) => p.assigned_engineer_devsinc_id || "", render: (p) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.assigned_engineer_devsinc_id || "—"}</code> },
    { id: "leads", label: "Leads", minWidth: COL_MIN.sm, getSortValue: (p) => p.linked_leads_count, render: (p) => <span className="font-semibold">{p.linked_leads_count}</span> },
    {
      id: "actions", label: "Actions", minWidth: COL_MIN.actions, sortable: false,
      render: (p) => <button onClick={() => onVerify(p.id)} className="text-sm font-medium text-brand-600 hover:text-brand-700">{p.linkedin_verified ? "Unverify" : "Verify"}</button>,
    },
  ];
}

export function ProfilesTable({
  profiles,
  onVerify,
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
}: {
  profiles: Profile[];
  onVerify: (id: number) => void;
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
}) {
  const columns = useMemo(() => profileColumns(onVerify), [onVerify]);

  return (
    <SortableTable
      storageKey="profiles"
      columns={columns}
      data={profiles}
      emptyMessage="No profiles match your filters."
      selectable={selectable}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      allSelected={allSelected}
      rowClassName={(p) => (selected?.has(p.id) ? "bg-brand-50/50" : undefined)}
    />
  );
}
