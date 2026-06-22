"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Input, Select, Spinner, Card } from "./ui";
import { FilterPanel, FilterField } from "./FilterPanel";
import { exportCsv } from "@/lib/csv";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

interface ResourceRow {
  id: number;
  full_name: string;
  email: string;
  role: string;
  devsinc_id: string | null;
  team_lead_name: string | null;
  lead_count: number;
}
interface LeadName { id: number; company: string; job_title: string; phase: string; status: string }
interface Detail { total: number; leads: LeadName[] }

export function ResourceLeadsReport() {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Detail>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ role });
    if (search) params.set("search", search);
    api<ResourceRow[]>(`/reports/resource-leads?${params}`).then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, search]);

  const toggle = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!details[id]) {
      setDetailLoading(id);
      try {
        const d = await api<Detail>(`/reports/resource-leads/${id}`);
        setDetails((prev) => ({ ...prev, [id]: d }));
      } finally {
        setDetailLoading(null);
      }
    }
  };

  const totalLeads = rows.reduce((a, r) => a + r.lead_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm text-slate-500">
          <span className="font-medium text-slate-900">{rows.length}</span> resources ·{" "}
          <span className="font-medium text-slate-900">{totalLeads.toLocaleString()}</span> assigned leads
        </div>
        <Button variant="secondary" size="sm" onClick={() => exportCsv("resource_leads", [
          { header: "Name", value: (r: ResourceRow) => r.full_name },
          { header: "Role", value: (r: ResourceRow) => r.role },
          { header: "Team Lead", value: (r: ResourceRow) => r.team_lead_name },
          { header: "Email", value: (r: ResourceRow) => r.email },
          { header: "Devsinc ID", value: (r: ResourceRow) => r.devsinc_id },
          { header: "Lead Count", value: (r: ResourceRow) => r.lead_count },
        ], rows)}><Download className="h-4 w-4" /> CSV</Button>
      </div>

      <FilterPanel columns={2}>
        <FilterField label="Resource type">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All resources</option>
            <option value="engineer">Engineers</option>
            <option value="bd">BD</option>
          </Select>
        </FilterField>
        <FilterField label="Search">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email…" />
        </FilterField>
      </FilterPanel>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No resources found.</p></Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => toggle(r.id)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.full_name}</p>
                      <p className="text-xs text-slate-400">{r.email}</p>
                    </td>
                    <td className="px-4 py-3"><Badge variant={r.role === "engineer" ? "indigo" : "blue"} className="capitalize">{r.role}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{r.team_lead_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{r.lead_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400">{expanded === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  </tr>
                  {expanded === r.id && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={5} className="px-4 py-3">
                        {detailLoading === r.id ? (
                          <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
                        ) : details[r.id] ? (
                          details[r.id].leads.length === 0 ? (
                            <p className="text-sm text-slate-400">No leads assigned.</p>
                          ) : (
                            <div>
                              <p className="mb-2 text-xs font-medium text-slate-500">
                                Lead names ({details[r.id].leads.length}{details[r.id].total > details[r.id].leads.length ? ` of ${details[r.id].total}` : ""})
                              </p>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                {details[r.id].leads.map((l) => (
                                  <div key={l.id} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                                    <p className="truncate text-xs font-medium text-slate-800">{l.job_title}</p>
                                    <p className="truncate text-[11px] text-slate-400">{l.company} · {l.status}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
