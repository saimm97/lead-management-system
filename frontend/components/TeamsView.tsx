"use client";

import { useEffect, useMemo, useState } from "react";
import { api, apiUpload, downloadTemplate } from "@/lib/api";
import { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { Badge, Button, Input, Select, Spinner } from "@/components/ui";
import { SortableTable, TableColumn } from "@/components/SortableTable";
import { COL_MIN } from "@/lib/tableUtils";
import { exportCsv } from "@/lib/csv";
import { Download, Upload, Filter } from "lucide-react";

function teamColumns(): TableColumn<User>[] {
  return [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (m) => m.id, className: "text-center font-medium tabular-nums text-slate-500", render: (m) => m.id },
    { id: "name", label: "Name", minWidth: COL_MIN.md, getSortValue: (m) => m.full_name, className: "font-medium text-slate-900", render: (m) => m.full_name },
    { id: "email", label: "Email", minWidth: COL_MIN.xl, getSortValue: (m) => m.email, className: "text-slate-600", render: (m) => m.email },
    { id: "employee_id", label: "Employee ID", minWidth: COL_MIN.sm, getSortValue: (m) => m.employee_id, render: (m) => m.employee_id },
    { id: "devsinc_id", label: "Devsinc ID", minWidth: COL_MIN.sm, getSortValue: (m) => m.devsinc_id || "", render: (m) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{m.devsinc_id || "—"}</code> },
    { id: "role", label: "Role", minWidth: COL_MIN.sm, getSortValue: (m) => m.role, render: (m) => <Badge variant="indigo" className="capitalize">{m.role}</Badge> },
    { id: "status", label: "Status", minWidth: COL_MIN.sm, getSortValue: (m) => (m.is_active ? 1 : 0), render: (m) => <Badge variant={m.is_active ? "green" : "red"}>{m.is_active ? "Active" : "Inactive"}</Badge> },
  ];
}

export function TeamsView({ team }: { team: "engineering" | "bd" }) {
  const [user, setUser] = useState<User | null>(null);
  const [engineering, setEngineering] = useState<User[]>([]);
  const [bdTeam, setBdTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const columns = useMemo(() => teamColumns(), []);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored) as User);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      api<User[]>("/teams/engineering").catch(() => []),
      api<User[]>("/teams/bd").catch(() => []),
    ])
      .then(([eng, bd]) => {
        setEngineering(eng);
        setBdTeam(bd);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const uploadTeam = async () => {
    if (!importFile) return;
    await apiUpload("/teams/import/users", importFile);
    setImportFile(null);
    load();
  };

  const members = team === "engineering" ? engineering : bdTeam;
  const filteredMembers = members.filter((m) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!m.full_name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q) && !m.employee_id.toLowerCase().includes(q) && !(m.devsinc_id || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filters.role && m.role !== filters.role) return false;
    if (filters.status === "active" && !m.is_active) return false;
    if (filters.status === "inactive" && m.is_active) return false;
    return true;
  });

  const canImport = user && (user.role === "admin" || user.role === "manager");
  const title = team === "engineering" ? "Engineering Team" : "BD Team";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Devsinc tenant — view and manage team members"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" /> Filters</Button>
            <Button variant="secondary" size="sm" onClick={() => exportCsv(`${team}_team`, [
              { header: "ID", value: (m: User) => m.id },
              { header: "Name", value: (m: User) => m.full_name },
              { header: "Email", value: (m: User) => m.email },
              { header: "Employee ID", value: (m: User) => m.employee_id },
              { header: "Devsinc ID", value: (m: User) => m.devsinc_id },
              { header: "Role", value: (m: User) => m.role },
              { header: "Status", value: (m: User) => (m.is_active ? "Active" : "Inactive") },
            ], filteredMembers)}><Download className="h-4 w-4" /> CSV</Button>
            {canImport && (
              <>
                <Button variant="secondary" size="sm" onClick={() => downloadTemplate("users")}>
                  <Download className="h-4 w-4" /> Template
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-slate-50">
                  <Upload className="h-4 w-4" /> {importFile ? importFile.name : "Upload Team Excel"}
                  <input type="file" accept=".xlsx" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                </label>
                {importFile && <Button size="sm" onClick={uploadTeam}>Import</Button>}
              </>
            )}
          </>
        }
      />

      {showFilters && (
        <FilterPanel columns={3}>
          <FilterField label="Search">
            <Input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, email, ID…" />
          </FilterField>
          <FilterField label="Role">
            <Select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
              <option value="">All</option>
              <option value="engineer">Engineer</option>
              <option value="bd">BD</option>
              <option value="manager">Manager</option>
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FilterField>
        </FilterPanel>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <SortableTable
          storageKey={`teams-${team}`}
          columns={columns}
          data={filteredMembers}
          emptyMessage="No members match your filters."
        />
      )}
    </div>
  );
}
