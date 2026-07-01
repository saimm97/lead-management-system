"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, apiUpload, downloadTemplate, downloadApiFile } from "@/lib/api";
import { exportCsv } from "@/lib/csv";
import { Lead, Paginated, User } from "@/lib/types";
import { LeadsTable } from "@/components/LeadsTable";
import { PageHeader } from "@/components/PageHeader";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkUpdateModal, BulkField } from "@/components/BulkUpdateModal";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { Button, Select, Input, Modal, Tabs, Spinner } from "@/components/ui";
import { Plus, Filter, Upload, Download } from "lucide-react";
import { SortDirection } from "@/lib/tableUtils";

const LEAD_BULK_FIELDS: BulkField[] = [
  { key: "phase", label: "Phase", type: "select", options: ["Applied", "Screening", "Interview", "Offer", "Closed"].map((v) => ({ value: v, label: v })) },
  { key: "type", label: "Type", type: "text", placeholder: "e.g. JD Sent" },
  { key: "status", label: "Status", type: "text", placeholder: "e.g. JD Invite Pending" },
  { key: "interview_number", label: "Interview #", type: "text" },
  { key: "interview_round", label: "Interview Round", type: "text" },
  { key: "primary_tech", label: "Primary Tech", type: "text" },
  { key: "job_source", label: "Job Source", type: "text" },
];

interface HistoryEntry {
  id: number;
  changed_by_name: string | null;
  old_phase: string | null;
  old_type: string | null;
  old_status: string | null;
  new_phase: string;
  new_type: string;
  new_status: string;
  note: string | null;
  created_at: string;
}

export default function LeadsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [scope, setScope] = useState<"my" | "subordinate">("my");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [clusterHeads, setClusterHeads] = useState<User[]>([]);
  const [bds, setBds] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [historyLeadId, setHistoryLeadId] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filters, setFilters] = useState({
    job_source: "", phase: "", type: "", status: "", primary_tech: "",
    interview_number: "", interview_round: "", company: "",
    assigned_engineer_id: "", bd_id: "",
  });
  const [statusConfig, setStatusConfig] = useState<{ phase: string; type: string; status: string }[]>([]);
  const [interviewNumbers, setInterviewNumbers] = useState<string[]>([]);
  const [interviewRounds, setInterviewRounds] = useState<string[]>([]);
  const [sort, setSort] = useState<{ columnId: string; direction: SortDirection }>({ columnId: "id", direction: "asc" });

  const bulk = useBulkSelect(leads);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ scope, page: String(page), page_size: String(pageSize) });
    if (filters.job_source) params.set("job_source", filters.job_source);
    if (filters.phase) params.set("phase", filters.phase);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
    if (filters.primary_tech) params.set("primary_tech", filters.primary_tech);
    if (filters.interview_number) params.set("interview_number", filters.interview_number);
    if (filters.interview_round) params.set("interview_round", filters.interview_round);
    if (filters.company) params.set("company", filters.company);
    if (filters.assigned_engineer_id) params.set("assigned_engineer_id", filters.assigned_engineer_id);
    if (filters.bd_id) params.set("bd_id", filters.bd_id);
    params.set("sort_by", sort.columnId);
    params.set("sort_dir", sort.direction);
    api<Paginated<Lead>>(`/leads?${params}`)
      .then((data) => { setLeads(data.items); setTotal(data.total); })
      .finally(() => setLoading(false));
  };

  const filterParams = () => {
    const params = new URLSearchParams({ scope });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set("sort_by", sort.columnId);
    params.set("sort_dir", sort.direction);
    return params;
  };

  const exportPage = () => {
    exportCsv("leads_page", [
      { header: "ID", value: (l: Lead) => l.id },
      { header: "Created", value: (l: Lead) => l.created_at },
      { header: "Company", value: (l: Lead) => l.company },
      { header: "Job Title", value: (l: Lead) => l.job_title },
      { header: "Source", value: (l: Lead) => l.job_source },
      { header: "Primary Tech", value: (l: Lead) => l.primary_tech },
      { header: "Technologies", value: (l: Lead) => l.technologies.join("; ") },
      { header: "Engineer", value: (l: Lead) => l.assigned_engineer_name },
      { header: "Devsinc ID", value: (l: Lead) => l.assigned_engineer_devsinc_id },
      { header: "Cluster Head", value: (l: Lead) => l.cluster_head_name },
      { header: "Interview #", value: (l: Lead) => l.interview_number },
      { header: "Round", value: (l: Lead) => l.interview_round },
      { header: "Profile", value: (l: Lead) => l.profile_name },
      { header: "Phase", value: (l: Lead) => l.phase },
      { header: "Type", value: (l: Lead) => l.type },
      { header: "Status", value: (l: Lead) => l.status },
      { header: "BD", value: (l: Lead) => l.bd_name },
      { header: "Issues", value: (l: Lead) => l.issue_count },
    ], leads);
  };

  const exportAll = () => {
    downloadApiFile(`/leads/export?${filterParams()}`, "leads.csv").catch(() => alert("Export failed"));
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    api<User[]>("/users")
      .then((users) => {
        setEngineers(users.filter((u) => u.role === "engineer"));
        setClusterHeads(users.filter((u) => u.role === "manager" && u.manager_type === "engineering_manager"));
        setBds(users.filter((u) => u.role === "bd"));
      })
      .catch(() => { /* engineers/BD cannot list users */ });

    api<{ phase: string; type: string; status: string }[]>("/leads/status-config")
      .then(setStatusConfig)
      .catch(() => setStatusConfig([]));
    api<{ label: string }[]>("/leads/dropdown-options?category=interview_number")
      .then((opts) => setInterviewNumbers(opts.map((o) => o.label)))
      .catch(() => setInterviewNumbers([]));
    api<{ label: string }[]>("/leads/dropdown-options?category=interview_round")
      .then((opts) => setInterviewRounds(opts.map((o) => o.label)))
      .catch(() => setInterviewRounds([]));
  }, []);

  useEffect(() => {
    load();
  }, [scope, page, pageSize, filters, sort]);

  useEffect(() => {
    bulk.clear();
  }, [scope, page, pageSize, filters, sort]);

  const showHistory = async (id: number) => {
    setHistoryLeadId(id);
    setHistory(await api<HistoryEntry[]>(`/leads/${id}/history`));
  };

  const bulkFields: BulkField[] = [
    ...LEAD_BULK_FIELDS,
    { key: "assigned_engineer_id", label: "Assigned Engineer", type: "select", options: engineers.map((e) => ({ value: String(e.id), label: `${e.full_name} (${e.devsinc_id || e.employee_id})` })) },
    { key: "cluster_head_id", label: "Cluster Head", type: "select", options: clusterHeads.map((e) => ({ value: String(e.id), label: e.full_name })) },
  ];

  const bulkUpdate = async (updates: Record<string, unknown>) => {
    await api("/leads/bulk-update", { method: "POST", body: JSON.stringify({ ids: bulk.ids, updates }) });
    bulk.clear();
    load();
  };

  const importExcel = async () => {
    if (!importFile) return;
    const res = await apiUpload<{ created: number; skipped: number; errors: string[] }>("/admin/import/leads", importFile);
    setImportMsg(`Imported ${res.created} leads${res.skipped ? `, ${res.skipped} skipped` : ""}`);
    setImportFile(null);
    setShowImport(false);
    load();
  };

  const canCreate = user && ["admin", "manager", "bd"].includes(user.role);
  const canBulk = user && ["admin", "manager", "bd"].includes(user.role);
  const canImport = user && ["admin", "manager"].includes(user.role);
  const isManager = user && ["admin", "manager"].includes(user.role);
  const canSeeSubordinates = isManager || !!user?.has_subordinates;

  const typeOptions = useMemo(() => {
    const rows = filters.phase ? statusConfig.filter((c) => c.phase === filters.phase) : statusConfig;
    return [...new Set(rows.map((c) => c.type))].filter(Boolean).sort();
  }, [statusConfig, filters.phase]);

  const statusOptions = useMemo(() => {
    const rows = statusConfig.filter(
      (c) => (!filters.phase || c.phase === filters.phase) && (!filters.type || c.type === filters.type)
    );
    return [...new Set(rows.map((c) => c.status))].filter(Boolean).sort();
  }, [statusConfig, filters.phase, filters.type]);

  const phaseOptions = useMemo(() => [...new Set(statusConfig.map((c) => c.phase))].filter(Boolean), [statusConfig]);

  const tabs = [
    { id: "my", label: "My Leads", count: scope === "my" ? total : undefined },
    ...(canSeeSubordinates ? [{ id: "subordinate", label: "Subordinate Leads", count: scope === "subordinate" ? total : undefined }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track job opportunities — select rows for bulk updates or import from Excel"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" /> Filters</Button>
            <Button variant="secondary" size="sm" onClick={exportPage} title="Export the current page"><Download className="h-4 w-4" /> CSV (page)</Button>
            <Button variant="secondary" size="sm" onClick={exportAll} title="Export all leads matching the current filters"><Download className="h-4 w-4" /> CSV (all)</Button>
            {canImport && (
              <>
                <Button variant="secondary" size="sm" onClick={() => downloadTemplate("leads")}><Download className="h-4 w-4" /> Template</Button>
                <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Import Excel</Button>
              </>
            )}
            {canCreate && (
              <Link href="/leads/new"><Button size="sm"><Plus className="h-4 w-4" /> Create Lead</Button></Link>
            )}
          </>
        }
      />

      <Tabs tabs={tabs} active={scope} onChange={(id) => { setScope(id as "my" | "subordinate"); setPage(1); }} />

      {canBulk && (
        <BulkActionBar count={bulk.count} onUpdate={() => setShowBulk(true)} onClear={bulk.clear} />
      )}

      {showFilters && (
        <FilterPanel columns={5}>
          <FilterField label="Company / Title">
            <Input value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} placeholder="Search company or title" />
          </FilterField>
          <FilterField label="Source">
            <Select value={filters.job_source} onChange={(e) => setFilters({ ...filters, job_source: e.target.value })}>
              <option value="">All</option>
              {["Jobright", "Upwork", "sforcejobs", "LinkedIn", "Referral", "Cold Call"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Phase">
            <Select value={filters.phase} onChange={(e) => setFilters({ ...filters, phase: e.target.value, type: "", status: "" })}>
              <option value="">All</option>
              {(phaseOptions.length ? phaseOptions : ["Applied", "Screening", "Interview", "Offer", "Closed"]).map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Type">
            <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value, status: "" })}>
              <option value="">All</option>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Primary Tech">
            <Input value={filters.primary_tech} onChange={(e) => setFilters({ ...filters, primary_tech: e.target.value })} />
          </FilterField>
          <FilterField label="Interview #">
            <Select value={filters.interview_number} onChange={(e) => setFilters({ ...filters, interview_number: e.target.value })}>
              <option value="">All</option>
              {(interviewNumbers.length ? interviewNumbers : ["1st", "2nd", "3rd", "4th", "5th", "Final"]).map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Interview Round">
            <Select value={filters.interview_round} onChange={(e) => setFilters({ ...filters, interview_round: e.target.value })}>
              <option value="">All</option>
              {interviewRounds.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </FilterField>
          {engineers.length > 0 && (
            <FilterField label="Engineer">
              <Select value={filters.assigned_engineer_id} onChange={(e) => setFilters({ ...filters, assigned_engineer_id: e.target.value })}>
                <option value="">All</option>
                {engineers.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </Select>
            </FilterField>
          )}
          {isManager && (
            <FilterField label="BD">
              <Select value={filters.bd_id} onChange={(e) => setFilters({ ...filters, bd_id: e.target.value })}>
                <option value="">All</option>
                {bds.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </Select>
            </FilterField>
          )}
        </FilterPanel>
      )}

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <LeadsTable
          leads={leads}
          onHistory={showHistory}
          selectable={!!canBulk}
          selected={bulk.selected}
          onToggle={bulk.toggle}
          onToggleAll={bulk.toggleAll}
          allSelected={bulk.allSelected}
          sort={sort}
          onSortChange={(columnId, direction) => { setSort({ columnId, direction }); setPage(1); }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">Showing <span className="font-medium">{leads.length}</span> of <span className="font-medium">{total}</span></p>
          <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="w-28">
            <option value="10">10 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="px-2 text-sm">Page {page}</span>
          <Button variant="secondary" size="sm" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>

      <BulkUpdateModal open={showBulk} title="Bulk Update Leads" count={bulk.count} fields={bulkFields} onClose={() => setShowBulk(false)} onSubmit={bulkUpdate} />

      <Modal open={showImport} title="Import Leads from Excel" onClose={() => setShowImport(false)}>
        <p className="mb-4 text-sm text-slate-500">Upload .xlsx file. Cluster head defaults to Mahroz Khan.</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm">
          <Upload className="h-4 w-4" /> {importFile ? importFile.name : "Choose file"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
        </label>
        {importMsg && <p className="mt-3 text-sm text-emerald-600">{importMsg}</p>}
        <div className="mt-4 flex gap-3">
          <Button disabled={!importFile} onClick={importExcel}>Import</Button>
          <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
        </div>
      </Modal>

      <Modal open={!!historyLeadId} title="Status History" onClose={() => setHistoryLeadId(null)} size="lg">
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border bg-slate-50 p-4">
              <div className="flex justify-between"><p className="font-semibold">{h.changed_by_name}</p><p className="text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</p></div>
              <p className="mt-2 text-sm">{h.old_phase}/{h.old_type}/{h.old_status} → <strong>{h.new_phase}/{h.new_type}/{h.new_status}</strong></p>
              {h.note && <p className="mt-1 text-sm italic text-slate-500">{h.note}</p>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
