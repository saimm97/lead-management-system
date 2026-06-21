"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Input, DataTable, FormField, Badge, RecordIdCell, RecordIdHeader } from "@/components/ui";

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
      <DataTable>
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr>
            <RecordIdHeader />
            {["Phase", "Type", "Status", "Terminal", "Report Bucket", "Order"].map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {configs.map((c) => (
            <tr key={c.id}>
              <RecordIdCell value={c.id} />
              <td><Badge variant="blue">{c.phase}</Badge></td>
              <td className="text-slate-600">{c.type}</td>
              <td className="font-medium text-slate-900">{c.status}</td>
              <td><Badge variant={c.is_terminal ? "red" : "default"}>{c.is_terminal ? "Yes" : "No"}</Badge></td>
              <td className="text-slate-500">{c.report_bucket || "—"}</td>
              <td className="text-slate-500">{c.sort_order}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
