"use client";

import { useState } from "react";
import { apiUpload, downloadTemplate } from "@/lib/api";
import { ImportResult } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card } from "@/components/ui";
import { Download, Upload, FileSpreadsheet } from "lucide-react";

type Entity = "leads" | "profiles" | "users";

const ENTITIES: { id: Entity; label: string; description: string }[] = [
  { id: "leads", label: "Leads", description: "Import job opportunities with company, title, source, tech stack, and status." },
  { id: "profiles", label: "Profiles", description: "Import candidate profiles with LinkedIn, GitHub, and tech stack." },
  { id: "users", label: "Users", description: "Bulk-create user accounts with email, role, and optional Devsinc ID." },
];

export default function AdminImportPage() {
  const [selected, setSelected] = useState<Entity>("leads");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await apiUpload<ImportResult>(`/admin/import/${selected}`, file);
      setResult(res);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const entity = ENTITIES.find((e) => e.id === selected)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Import"
        description="Upload Excel files to bulk-populate leads, profiles, or users"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ENTITIES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => { setSelected(e.id); setResult(null); setError(""); }}
            className={`rounded-xl border p-4 text-left transition ${selected === e.id ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <FileSpreadsheet className={`mb-2 h-6 w-6 ${selected === e.id ? "text-brand-600" : "text-slate-400"}`} />
            <p className="font-semibold text-slate-900">{e.label}</p>
            <p className="mt-1 text-xs text-slate-500">{e.description}</p>
          </button>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold text-slate-900">Import {entity.label}</h3>
        <p className="mt-1 text-sm text-slate-500">{entity.description}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => downloadTemplate(selected)}>
            <Download className="h-4 w-4" /> Download Template
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose Excel file"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <Button size="sm" disabled={!file || loading} onClick={upload}>
            {loading ? "Importing…" : "Upload & Import"}
          </Button>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        {result && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="green">{result.created} created</Badge>
              {result.skipped > 0 && <Badge variant="yellow">{result.skipped} skipped</Badge>}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-900">Column Reference</h3>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {selected === "leads" && (
            <p>Columns: company, job_title, job_source, primary_tech, technologies (comma-separated), phase, type, status, notes, engineer_devsinc_id</p>
          )}
          {selected === "profiles" && (
            <p>Columns: full_name, linkedin_url, github_url, primary_tech_stack, engineer_devsinc_id</p>
          )}
          {selected === "users" && (
            <p>Columns: email, full_name, employee_id, role, devsinc_id, password (defaults to ChangeMe123! if empty)</p>
          )}
        </div>
      </Card>
    </div>
  );
}
