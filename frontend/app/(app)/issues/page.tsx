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
import { Plus, Filter } from "lucide-react";

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
  const bulk = useBulkSelect(issues);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ scope });
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    api<Issue[]>(`/issues?${params}`).then(setIssues).finally(() => setLoading(false));
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => { load(); bulk.clear(); }, [scope, filters]);

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
            <Link href="/issues/new">
              <Button size="sm"><Plus className="h-4 w-4" /> Log Issue</Button>
            </Link>
          </>
        }
      />
      <Tabs tabs={tabs} active={scope} onChange={setScope} />
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
