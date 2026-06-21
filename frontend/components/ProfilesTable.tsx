"use client";

import { Badge, Card, DataTable, RecordIdCell, RecordIdHeader } from "./ui";
import { Profile } from "@/lib/types";
import Link from "next/link";
import { ExternalLink, CheckCircle2, XCircle } from "lucide-react";

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
  if (profiles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        No profiles match your filters.
      </div>
    );
  }

  return (
    <DataTable>
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          {selectable && <th className="w-10"><input type="checkbox" checked={allSelected} onChange={onToggleAll} className="rounded" /></th>}
          <RecordIdHeader />
          {["Name", "LinkedIn", "GitHub", "Tech Stack", "Engineer", "Devsinc ID", "Leads", "Actions"].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {profiles.map((p) => (
          <tr key={p.id} className={selected?.has(p.id) ? "bg-brand-50/50" : undefined}>
            {selectable && <td><input type="checkbox" checked={selected?.has(p.id)} onChange={() => onToggle?.(p.id)} className="rounded" /></td>}
            <RecordIdCell value={p.id} />
            <td>
              <Link href={`/profiles/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.full_name}</Link>
            </td>
            <td>
              {p.linkedin_url ? (
                <div className="flex items-center gap-2">
                  <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                    Profile <ExternalLink className="h-3 w-3" />
                  </a>
                  {p.linkedin_verified ? (
                    <Badge variant="green"><CheckCircle2 className="mr-1 inline h-3 w-3" />Verified</Badge>
                  ) : (
                    <Badge variant="yellow">Unverified</Badge>
                  )}
                </div>
              ) : (
                <Badge variant="red"><XCircle className="mr-1 inline h-3 w-3" />Missing</Badge>
              )}
            </td>
            <td>
              {p.github_present ? (
                <a href={p.github_url!} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">GitHub</a>
              ) : (
                <Badge variant="red">Missing</Badge>
              )}
            </td>
            <td>{p.primary_tech_stack ? <Badge variant="green">{p.primary_tech_stack}</Badge> : "—"}</td>
            <td className="font-medium">{p.assigned_engineer_name || "—"}</td>
            <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.assigned_engineer_devsinc_id || "—"}</code></td>
            <td><span className="font-semibold">{p.linked_leads_count}</span></td>
            <td>
              <button onClick={() => onVerify(p.id)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                {p.linkedin_verified ? "Unverify" : "Verify"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
