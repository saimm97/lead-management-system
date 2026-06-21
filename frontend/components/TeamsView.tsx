"use client";

import { useEffect, useState } from "react";
import { api, apiUpload, downloadTemplate } from "@/lib/api";
import { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { DataTable, Badge, Button, Input, Select, Spinner, RecordIdCell, RecordIdHeader } from "@/components/ui";
import { Download, Upload, Filter } from "lucide-react";

export function TeamsView({ team }: { team: "engineering" | "bd" }) {
  const [user, setUser] = useState<User | null>(null);
  const [engineering, setEngineering] = useState<User[]>([]);
  const [bdTeam, setBdTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });

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
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
          No members match your filters.
        </div>
      ) : (
        <DataTable>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <RecordIdHeader />
              {["Name", "Email", "Employee ID", "Devsinc ID", "Role", "Status"].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m) => (
              <tr key={m.id}>
                <RecordIdCell value={m.id} />
                <td className="font-medium text-slate-900">{m.full_name}</td>
                <td className="text-slate-600">{m.email}</td>
                <td>{m.employee_id}</td>
                <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{m.devsinc_id || "—"}</code></td>
                <td><Badge variant="indigo" className="capitalize">{m.role}</Badge></td>
                <td><Badge variant={m.is_active ? "green" : "red"}>{m.is_active ? "Active" : "Inactive"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
