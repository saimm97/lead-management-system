"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Issue, User } from "@/lib/types";
import { IssuesTable, IssueDetailPanel } from "@/components/IssuesTable";
import { PageHeader } from "@/components/PageHeader";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkUpdateModal, BulkField } from "@/components/BulkUpdateModal";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { Button, Select, Tabs, Spinner } from "@/components/ui";
import { exportCsv } from "@/lib/csv";
import { Plus, Filter, X, Download } from "lucide-react";

const ISSUE_BULK: BulkField[] = [
  { key: "status", label: "Status", type: "select", options: ["open", "in_progress", "resolved", "closed"].map((v) => ({ value: v, label: v.replace("_", " ") })) },
  { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v })) },
];

export default function IssuesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [scope, setScope] = useState("my");
  const [selected, setSelected] = useState<Issue | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ status: "", priority: "", category: "" });
  const [leadFilter, setLeadFilter] = useState<number | null>(null);
  const bulk = useBulkSelect(issues);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ scope });
    if (leadFilter !== null) params.set("related_lead_id", String(leadFilter));
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    api<Issue[]>(`/issues?${params}`).then(setIssues).finally(() => setLoading(false));
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    const leadId = new URLSearchParams(window.location.search).get("lead_id");
    if (leadId) setLeadFilter(Number(leadId));
  }, []);

  useEffect(() => { load(); bulk.clear(); }, [scope, filters, leadFilter]);

  const clearLeadFilter = () => {
    setLeadFilter(null);
    window.history.replaceState(null, "", "/issues");
  };

  const bulkUpdate = async (updates: Record<string, unknown>) => {
    await api("/issues/bulk-update", { method: "POST", body: JSON.stringify({ ids: bulk.ids, updates }) });
    bulk.clear();
    load();
  };

  const openIssue = async (issue: Issue) => {
    const full = await api<Issue>(`/issues/${issue.id}`);
    setSelected(full);
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const full = await api<Issue>(`/issues/${selected.id}`);
    setSelected(full);
    load();
  };

  const updateIssue = async (status: string, note?: string) => {
    if (!selected) return;
    await api(`/issues/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status, resolution_note: note }) });
    setSelected(null);
    load();
  };

  const canTriage = user && ["admin", "manager"].includes(user.role);

  const tabs = [
    { id: "my", label: "My Issues" },
    ...(canTriage ? [{ id: "team", label: "Team Issues" }] : []),
    ...(user?.role === "admin" ? [{ id: "all", label: "All Issues" }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issues"
        description="Log and track operational issues across your team"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" /> Filters</Button>
            <Button variant="secondary" size="sm" onClick={() => exportCsv("issues", [
              { header: "ID", value: (i: Issue) => i.id },
              { header: "Title", value: (i: Issue) => i.title },
              { header: "Category", value: (i: Issue) => i.category },
              { header: "Priority", value: (i: Issue) => i.priority },
              { header: "Status", value: (i: Issue) => i.status },
              { header: "Reported By", value: (i: Issue) => i.reported_by_name },
              { header: "Assigned Manager", value: (i: Issue) => i.assigned_manager_name },
              { header: "Related Lead", value: (i: Issue) => i.related_lead_id },
              { header: "Created", value: (i: Issue) => i.created_at },
            ], issues)}><Download className="h-4 w-4" /> CSV</Button>
            <Link href="/issues/new">
              <Button size="sm"><Plus className="h-4 w-4" /> Log Issue</Button>
            </Link>
          </>
        }
      />
      {leadFilter !== null && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>Showing issues for <span className="font-semibold">Lead #{leadFilter}</span> only.</span>
          <button onClick={clearLeadFilter} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-amber-700 transition hover:bg-amber-100">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}
      {leadFilter === null && <Tabs tabs={tabs} active={scope} onChange={setScope} />}
      {showFilters && (
        <FilterPanel columns={3}>
          <FilterField label="Status">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Priority">
            <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">All</option>
              {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Category">
            <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All</option>
              {["technical", "process", "communication", "billing", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FilterField>
        </FilterPanel>
      )}
      {canTriage && <BulkActionBar count={bulk.count} onUpdate={() => setShowBulk(true)} onClear={bulk.clear} />}
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <IssuesTable issues={issues} onSelect={openIssue} selectable={!!canTriage} selected={bulk.selected} onToggle={bulk.toggle} onToggleAll={bulk.toggleAll} allSelected={bulk.allSelected} />
      )}
      {selected && <IssueDetailPanel issue={selected} onClose={() => setSelected(null)} onUpdate={updateIssue} onRefresh={refreshSelected} />}
      {canTriage && <BulkUpdateModal open={showBulk} title="Bulk Update Issues" count={bulk.count} fields={ISSUE_BULK} onClose={() => setShowBulk(false)} onSubmit={bulkUpdate} />}
    </div>
  );
}
