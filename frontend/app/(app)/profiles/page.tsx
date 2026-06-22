"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Profile } from "@/lib/types";
import { ProfileKpiCards, ProfilesTable } from "@/components/ProfilesTable";
import { PageHeader } from "@/components/PageHeader";
import { BulkActionBar } from "@/components/BulkActionBar";
import { BulkUpdateModal, BulkField } from "@/components/BulkUpdateModal";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { Button, Input, Select, Modal, FormField, Tabs, Spinner } from "@/components/ui";
import { exportCsv } from "@/lib/csv";
import { Plus, Filter, Download } from "lucide-react";

const PROFILE_BULK: BulkField[] = [
  { key: "primary_tech_stack", label: "Tech Stack", type: "text" },
  { key: "linkedin_verified", label: "LinkedIn Verified", type: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
  { key: "is_active", label: "Active", type: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] },
];

type Tab = "all" | "linkedin_verified" | "linkedin_unverified" | "github_present" | "github_missing";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, in_use: 0, linkedin_verified: 0, linkedin_unverified: 0, linkedin_missing: 0, github_present: 0, github_missing: 0 });
  const [tab, setTab] = useState<Tab>("all");
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", linkedin_url: "", github_url: "", primary_tech_stack: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", tech_stack: "", engineer_id: "" });
  const [engineers, setEngineers] = useState<{ id: number; full_name: string }[]>([]);
  const bulk = useBulkSelect(profiles);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab === "linkedin_verified") params.set("linkedin_verified", "true");
    else if (tab === "linkedin_unverified") params.set("linkedin_verified", "false");
    else if (tab === "github_present") params.set("github_present", "true");
    else if (tab === "github_missing") params.set("github_present", "false");
    if (filters.search) params.set("search", filters.search);
    if (filters.tech_stack) params.set("tech_stack", filters.tech_stack);
    if (filters.engineer_id) params.set("engineer_id", filters.engineer_id);
    const query = params.toString() ? `?${params}` : "";
    Promise.all([api<Profile[]>(`/profiles${query}`), api<typeof summary>("/profiles/summary")])
      .then(([p, s]) => { setProfiles(p); setSummary(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api<{ id: number; full_name: string; role: string }[]>("/users").then((users) =>
      setEngineers(users.filter((u) => u.role === "engineer").map((u) => ({ id: u.id, full_name: u.full_name })))
    );
  }, []);

  useEffect(() => { load(); bulk.clear(); }, [tab, filters]);

  const bulkUpdate = async (updates: Record<string, unknown>) => {
    const parsed = { ...updates };
    if (parsed.linkedin_verified !== undefined) parsed.linkedin_verified = parsed.linkedin_verified === "true";
    if (parsed.is_active !== undefined) parsed.is_active = parsed.is_active === "true";
    await api("/profiles/bulk-update", { method: "POST", body: JSON.stringify({ ids: bulk.ids, updates: parsed }) });
    bulk.clear();
    load();
  };

  const verify = async (id: number) => { await api(`/profiles/${id}/verify-linkedin`, { method: "PATCH" }); load(); };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("/profiles", { method: "POST", body: JSON.stringify(form) });
    setShowForm(false);
    load();
  };

  const tabs = [
    { id: "all", label: "All Profiles", count: summary.total },
    { id: "linkedin_verified", label: "LinkedIn Verified", count: summary.linkedin_verified },
    { id: "linkedin_unverified", label: "Unverified", count: summary.linkedin_unverified },
    { id: "github_present", label: "GitHub Present", count: summary.github_present },
    { id: "github_missing", label: "GitHub Missing", count: summary.github_missing },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Candidate profile registry with LinkedIn and GitHub tracking"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" /> Filters</Button>
            <Button variant="secondary" size="sm" onClick={() => exportCsv("profiles", [
              { header: "ID", value: (p: Profile) => p.id },
              { header: "Full Name", value: (p: Profile) => p.full_name },
              { header: "Primary Tech Stack", value: (p: Profile) => p.primary_tech_stack },
              { header: "LinkedIn URL", value: (p: Profile) => p.linkedin_url },
              { header: "LinkedIn Verified", value: (p: Profile) => (p.linkedin_verified ? "Yes" : "No") },
              { header: "GitHub URL", value: (p: Profile) => p.github_url },
              { header: "GitHub Present", value: (p: Profile) => (p.github_present ? "Yes" : "No") },
              { header: "Assigned Engineer", value: (p: Profile) => p.assigned_engineer_name },
              { header: "Linked Leads", value: (p: Profile) => p.linked_leads_count },
              { header: "Active", value: (p: Profile) => (p.is_active ? "Yes" : "No") },
            ], profiles)}><Download className="h-4 w-4" /> CSV</Button>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Profile</Button>
          </>
        }
      />
      <ProfileKpiCards summary={summary} />
      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />
      {showFilters && (
        <FilterPanel columns={3}>
          <FilterField label="Search Name">
            <Input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Profile name" />
          </FilterField>
          <FilterField label="Tech Stack">
            <Input value={filters.tech_stack} onChange={(e) => setFilters({ ...filters, tech_stack: e.target.value })} placeholder="e.g. MERN" />
          </FilterField>
          <FilterField label="Engineer">
            <Select value={filters.engineer_id} onChange={(e) => setFilters({ ...filters, engineer_id: e.target.value })}>
              <option value="">All</option>
              {engineers.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </Select>
          </FilterField>
        </FilterPanel>
      )}
      <BulkActionBar count={bulk.count} onUpdate={() => setShowBulk(true)} onClear={bulk.clear} />
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <ProfilesTable profiles={profiles} onVerify={verify} selectable selected={bulk.selected} onToggle={bulk.toggle} onToggleAll={bulk.toggleAll} allSelected={bulk.allSelected} />
      )}

      <Modal open={showForm} title="New Profile" onClose={() => setShowForm(false)}>
        <form onSubmit={create} className="space-y-4">
          <FormField label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></FormField>
          <FormField label="LinkedIn URL"><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." /></FormField>
          <FormField label="GitHub URL"><Input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/..." /></FormField>
          <FormField label="Tech Stack"><Input value={form.primary_tech_stack} onChange={(e) => setForm({ ...form, primary_tech_stack: e.target.value })} placeholder="MERN, Python, etc." /></FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit">Create Profile</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
      <BulkUpdateModal open={showBulk} title="Bulk Update Profiles" count={bulk.count} fields={PROFILE_BULK} onClose={() => setShowBulk(false)} onSubmit={bulkUpdate} />
    </div>
  );
}
