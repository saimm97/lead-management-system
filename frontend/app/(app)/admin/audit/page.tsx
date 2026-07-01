"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Spinner } from "@/components/ui";
import { SortableTable, TableColumn } from "@/components/SortableTable";
import { COL_MIN } from "@/lib/tableUtils";
import { exportCsv } from "@/lib/csv";
import { Download } from "lucide-react";

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

  const columns = useMemo<TableColumn<AuditEntry>[]>(() => [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (l) => l.id, className: "text-center font-medium tabular-nums text-slate-500", render: (l) => l.id },
    { id: "created_at", label: "Time", minWidth: COL_MIN.lg, getSortValue: (l) => l.created_at, className: "whitespace-nowrap text-slate-500", render: (l) => new Date(l.created_at).toLocaleString() },
    { id: "user_id", label: "User", minWidth: COL_MIN.sm, getSortValue: (l) => l.user_id || 0, render: (l) => l.user_id || "—" },
    { id: "action", label: "Action", minWidth: COL_MIN.md, getSortValue: (l) => l.action, className: "font-medium text-slate-900", render: (l) => l.action },
    { id: "entity", label: "Entity", minWidth: COL_MIN.md, getSortValue: (l) => `${l.entity_type}-${l.entity_id}`, className: "text-slate-600", render: (l) => `${l.entity_type}${l.entity_id ? ` #${l.entity_id}` : ""}` },
    { id: "details", label: "Details", minWidth: COL_MIN.xxl, getSortValue: (l) => l.details || "", className: "whitespace-normal text-slate-500", render: (l) => l.details || "—" },
  ], []);

  useEffect(() => {
    api<AuditEntry[]>("/admin/audit-log").then(setLogs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all system actions and changes"
        actions={
          <Button variant="secondary" size="sm" onClick={() => exportCsv("audit_log", [
            { header: "ID", value: (l: AuditEntry) => l.id },
            { header: "Time", value: (l: AuditEntry) => l.created_at },
            { header: "User ID", value: (l: AuditEntry) => l.user_id },
            { header: "Action", value: (l: AuditEntry) => l.action },
            { header: "Entity Type", value: (l: AuditEntry) => l.entity_type },
            { header: "Entity ID", value: (l: AuditEntry) => l.entity_id },
            { header: "Details", value: (l: AuditEntry) => l.details },
          ], logs)}><Download className="h-4 w-4" /> CSV</Button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <SortableTable storageKey="admin-audit" columns={columns} data={logs} emptyMessage="No audit entries yet." />
      )}
    </div>
  );
}
