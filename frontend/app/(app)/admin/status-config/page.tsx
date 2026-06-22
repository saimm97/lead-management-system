"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Input, FormField, Badge } from "@/components/ui";
import { SortableTable, TableColumn } from "@/components/SortableTable";
import { COL_MIN } from "@/lib/tableUtils";

interface StatusConfig {
  id: number;
  phase: string;
  type: string;
  status: string;
  is_terminal: boolean;
  report_bucket: string | null;
  sort_order: number;
}

export default function StatusConfigPage() {
  const [configs, setConfigs] = useState<StatusConfig[]>([]);
  const [form, setForm] = useState({ phase: "", type: "", status: "", is_terminal: false, report_bucket: "", sort_order: 0 });

  const columns = useMemo<TableColumn<StatusConfig>[]>(() => [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (c) => c.id, className: "text-center font-medium tabular-nums text-slate-500", render: (c) => c.id },
    { id: "phase", label: "Phase", minWidth: COL_MIN.sm, getSortValue: (c) => c.phase, render: (c) => <Badge variant="blue">{c.phase}</Badge> },
    { id: "type", label: "Type", minWidth: COL_MIN.md, getSortValue: (c) => c.type, className: "text-slate-600", render: (c) => c.type },
    { id: "status", label: "Status", minWidth: COL_MIN.lg, getSortValue: (c) => c.status, className: "font-medium text-slate-900", render: (c) => c.status },
    { id: "terminal", label: "Terminal", minWidth: COL_MIN.sm, getSortValue: (c) => (c.is_terminal ? 1 : 0), render: (c) => <Badge variant={c.is_terminal ? "red" : "default"}>{c.is_terminal ? "Yes" : "No"}</Badge> },
    { id: "report_bucket", label: "Report Bucket", minWidth: COL_MIN.md, getSortValue: (c) => c.report_bucket || "", className: "text-slate-500", render: (c) => c.report_bucket || "—" },
    { id: "sort_order", label: "Order", minWidth: COL_MIN.sm, getSortValue: (c) => c.sort_order, className: "text-slate-500", render: (c) => c.sort_order },
  ], []);

  const load = () => api<StatusConfig[]>("/admin/status-config").then(setConfigs);
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("/admin/status-config", { method: "POST", body: JSON.stringify({ ...form, report_bucket: form.report_bucket || null }) });
    setForm({ phase: "", type: "", status: "", is_terminal: false, report_bucket: "", sort_order: 0 });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Status Configuration" description="Define lead pipeline phases, types, and statuses" />
      <Card>
        <h3 className="mb-4 font-semibold text-slate-900">Add Status</h3>
        <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Phase"><Input value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} required /></FormField>
          <FormField label="Type"><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required /></FormField>
          <FormField label="Status"><Input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required /></FormField>
          <FormField label="Report Bucket"><Input value={form.report_bucket} onChange={(e) => setForm({ ...form, report_bucket: e.target.value })} /></FormField>
          <FormField label="Sort Order"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></FormField>
          <FormField label="Options">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={form.is_terminal} onChange={(e) => setForm({ ...form, is_terminal: e.target.checked })} />
              Terminal status
            </label>
          </FormField>
          <div className="flex items-end"><Button type="submit">Add Status</Button></div>
        </form>
      </Card>
      <SortableTable storageKey="admin-status-config" columns={columns} data={configs} emptyMessage="No status configurations yet." />
    </div>
  );
}
