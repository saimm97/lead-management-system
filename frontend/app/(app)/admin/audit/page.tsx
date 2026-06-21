"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, Spinner, RecordIdCell, RecordIdHeader } from "@/components/ui";

interface AuditEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AuditEntry[]>("/admin/audit-log").then(setLogs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Track all system actions and changes" />
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <DataTable>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <RecordIdHeader />
              {["Time", "User", "Action", "Entity", "Details"].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <RecordIdCell value={l.id} />
                <td className="whitespace-nowrap text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.user_id || "—"}</td>
                <td className="font-medium text-slate-900">{l.action}</td>
                <td className="text-slate-600">{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ""}</td>
                <td className="max-w-xs truncate text-slate-500">{l.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
