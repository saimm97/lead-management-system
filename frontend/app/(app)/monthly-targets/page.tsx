"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MonthlyTarget, User } from "@/lib/types";
import { MonthlyTargetsTable, TargetSummaryCards } from "@/components/MonthlyTargetsTable";
import { PageHeader } from "@/components/PageHeader";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { Button, Input, Select, Modal, Textarea, FormField, Spinner } from "@/components/ui";
import { SearchableSelect } from "@/components/SearchableSelect";
import { exportCsv } from "@/lib/csv";
import { Plus, Filter, Download } from "lucide-react";

export default function MonthlyTargetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [summary, setSummary] = useState({ total_targets: 0, avg_completion_pct: 0, engineers_below_quota: 0 });
  const [engineers, setEngineers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ target_start_date: "", engineer_id: "", lead_target: "", tech_stack_focus: "", notes: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ engineer_id: "", tech_stack: "" });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const canEdit = user && ["admin", "manager"].includes(user.role);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (user?.role !== "engineer") params.set("month", month);
    if (filters.engineer_id) params.set("engineer_id", filters.engineer_id);
    if (filters.tech_stack) params.set("tech_stack", filters.tech_stack);
    const path = user?.role === "engineer" ? "/monthly-targets/me" : `/monthly-targets?${params}`;
    api<MonthlyTarget[]>(path).then(setTargets).finally(() => setLoading(false));
    if (canEdit) {
      api<typeof summary>(`/monthly-targets/summary?month=${month}`).then(setSummary);
      api<User[]>("/users").then((users) => setEngineers(users.filter((u) => u.role === "engineer")));
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => { if (user) load(); }, [user, month, filters]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("/monthly-targets", {
      method: "POST",
      body: JSON.stringify({
        target_start_date: form.target_start_date,
        engineer_id: Number(form.engineer_id),
        lead_target: Number(form.lead_target),
        tech_stack_focus: form.tech_stack_focus,
        notes: form.notes || null,
      }),
    });
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this target?")) return;
    await api(`/monthly-targets/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Targets"
        description="Set engineer lead quotas by tech stack focus"
        actions={
          <>
            {canEdit && <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" /> Filters</Button>}
            <Button variant="secondary" size="sm" onClick={() => exportCsv("monthly_targets", [
              { header: "ID", value: (t: MonthlyTarget) => t.id },
              { header: "Engineer", value: (t: MonthlyTarget) => t.engineer_name },
              { header: "Devsinc ID", value: (t: MonthlyTarget) => t.engineer_devsinc_id },
              { header: "Start Date", value: (t: MonthlyTarget) => t.target_start_date },
              { header: "End Date", value: (t: MonthlyTarget) => t.target_end_date },
              { header: "Lead Target", value: (t: MonthlyTarget) => t.lead_target },
              { header: "Assigned", value: (t: MonthlyTarget) => t.leads_assigned_count },
              { header: "Progress %", value: (t: MonthlyTarget) => t.progress_pct },
              { header: "Tech Focus", value: (t: MonthlyTarget) => t.tech_stack_focus },
            ], targets)}><Download className="h-4 w-4" /> CSV</Button>
            {canEdit && <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}
            {canEdit && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Target</Button>}
          </>
        }
      />
      {canEdit && showFilters && (
        <FilterPanel columns={2}>
          <FilterField label="Engineer">
            <SearchableSelect
              value={filters.engineer_id}
              onChange={(v) => setFilters({ ...filters, engineer_id: v })}
              options={engineers.map((e) => ({ value: String(e.id), label: e.full_name, hint: e.devsinc_id || e.employee_id }))}
              placeholder="All engineers"
              searchPlaceholder="Search engineer name…"
            />
          </FilterField>
          <FilterField label="Tech Stack">
            <Input value={filters.tech_stack} onChange={(e) => setFilters({ ...filters, tech_stack: e.target.value })} placeholder="e.g. Python" />
          </FilterField>
        </FilterPanel>
      )}
      {canEdit && <TargetSummaryCards summary={summary} />}
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : <MonthlyTargetsTable targets={targets} canEdit={!!canEdit} onDelete={remove} />}

      <Modal open={showForm} title="New Monthly Target" onClose={() => setShowForm(false)}>
        <form onSubmit={create} className="space-y-4">
          <FormField label="Target Start Date">
            <Input type="date" value={form.target_start_date} onChange={(e) => setForm({ ...form, target_start_date: e.target.value })} required />
          </FormField>
          <FormField label="Engineer">
            <SearchableSelect
              value={form.engineer_id}
              onChange={(v) => setForm({ ...form, engineer_id: v })}
              options={engineers.map((e) => ({ value: String(e.id), label: e.full_name, hint: e.devsinc_id || e.employee_id }))}
              placeholder="Select engineer…"
              searchPlaceholder="Search engineer name…"
            />
          </FormField>
          <FormField label="Lead Target">
            <Input type="number" min={1} value={form.lead_target} onChange={(e) => setForm({ ...form, lead_target: e.target.value })} required />
          </FormField>
          <FormField label="Tech Stack Focus">
            <Input placeholder="e.g. MERN, Python/Django" value={form.tech_stack_focus} onChange={(e) => setForm({ ...form, tech_stack_focus: e.target.value })} required />
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit">Create Target</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
