"use client";

import { Badge, DataTable, RecordIdCell, RecordIdHeader } from "./ui";
import { Lead } from "@/lib/types";
import Link from "next/link";
import { History, ExternalLink } from "lucide-react";
import { ClientDate } from "@/lib/format";

export function StatusBadge({ phase, type, status }: { phase: string; type: string; status: string }) {
  const variant = phase === "Closed" ? "red" : phase === "Offer" ? "green" : phase === "Interview" ? "blue" : "default";
  return (
    <div className="space-y-1.5">
      <Badge variant={variant as "default"}>{phase}</Badge>
      <p className="text-xs leading-tight text-slate-500">{type} · {status}</p>
    </div>
  );
}

export function LeadsTable({
  leads,
  onHistory,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  selectable = false,
}: {
  leads: Lead[];
  onHistory: (id: number) => void;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  selectable?: boolean;
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        No leads found. Adjust filters or create a new lead.
      </div>
    );
  }

  const headers = ["Created", "Company", "Job Title", "Source", "Technologies", "Engineer", "Devsinc ID", "Cluster Head", "Interview", "Round", "Profile", "Status", "BD", "Actions"];

  return (
    <DataTable>
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          {selectable && (
            <th className="w-10">
              <input type="checkbox" checked={!!allSelected} onChange={onToggleAll} className="rounded border-slate-300" />
            </th>
          )}
          <RecordIdHeader />
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead.id} className={selected?.has(lead.id) ? "bg-brand-50/50" : undefined}>
            {selectable && (
              <td>
                <input type="checkbox" checked={!!selected?.has(lead.id)} onChange={() => onToggle?.(lead.id)} className="rounded border-slate-300" />
              </td>
            )}
            <RecordIdCell value={lead.id} />
            <td className="whitespace-nowrap text-slate-500">
              <ClientDate iso={lead.created_at} />
            </td>
            <td className="font-medium text-slate-900">{lead.company}</td>
            <td>
              <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline">
                {lead.job_title}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </Link>
            </td>
            <td><Badge variant="indigo">{lead.job_source}</Badge></td>
            <td>
              {lead.primary_tech && <Badge variant="green">{lead.primary_tech}</Badge>}
              {lead.technologies.length > 0 && <p className="mt-1 text-xs text-slate-400">{lead.technologies.join(", ")}</p>}
            </td>
            <td className="font-medium">{lead.assigned_engineer_name || <span className="text-slate-400">Unassigned</span>}</td>
            <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{lead.assigned_engineer_devsinc_id || "—"}</code></td>
            <td className="text-sm text-slate-600">{lead.cluster_head_name || "—"}</td>
            <td className="text-sm text-slate-600">{lead.interview_number || "—"}</td>
            <td className="text-sm text-slate-600">{lead.interview_round || "—"}</td>
            <td>{lead.profile_name || "—"}</td>
            <td><StatusBadge phase={lead.phase} type={lead.type} status={lead.status} /></td>
            <td className="text-xs text-slate-600">{lead.bd_name || "—"}</td>
            <td>
              <button onClick={() => onHistory(lead.id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600" title="View history">
                <History className="h-4 w-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
