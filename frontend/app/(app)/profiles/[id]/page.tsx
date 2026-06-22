"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Profile } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Input, FormField, Spinner } from "@/components/ui";
import { SortableTable, TableColumn } from "@/components/SortableTable";
import { COL_MIN } from "@/lib/tableUtils";
import { ArrowLeft, ExternalLink } from "lucide-react";

type LinkedLead = { id: number; company: string; job_title: string; status: string };

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<LinkedLead[]>([]);
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", linkedin_url: "", github_url: "", primary_tech_stack: "" });

  const load = () => {
    setLoading(true);
    Promise.all([
      api<Profile>(`/profiles/${id}`),
      api<typeof leads>(`/profiles/${id}/leads`),
    ]).then(([p, l]) => {
      setProfile(p);
      setLeads(l);
      setForm({ full_name: p.full_name, linkedin_url: p.linkedin_url || "", github_url: p.github_url || "", primary_tech_stack: p.primary_tech_stack || "" });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const save = async () => { await api(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify(form) }); setEdit(false); load(); };
  const verify = async () => { await api(`/profiles/${id}/verify-linkedin`, { method: "PATCH" }); load(); };

  const leadColumns = useMemo<TableColumn<LinkedLead>[]>(() => [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (l) => l.id, className: "text-center font-medium tabular-nums text-slate-500", render: (l) => l.id },
    { id: "job_title", label: "Job Title", minWidth: COL_MIN.lg, getSortValue: (l) => l.job_title, render: (l) => <Link href={`/leads/${l.id}`} className="font-medium text-brand-600 hover:text-brand-700">{l.job_title}</Link> },
    { id: "company", label: "Company", minWidth: COL_MIN.md, getSortValue: (l) => l.company, className: "text-slate-600", render: (l) => l.company },
    { id: "status", label: "Status", minWidth: COL_MIN.sm, getSortValue: (l) => l.status, render: (l) => <Badge variant="blue">{l.status}</Badge> },
  ], []);

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
  if (!profile) return <p className="text-red-600">Profile not found.</p>;

  return (
    <div className="w-full space-y-6">
      <Link href="/profiles" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Profiles
      </Link>

      <PageHeader
        title={profile.full_name}
        description={profile.primary_tech_stack || "No tech stack specified"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEdit(!edit)}>{edit ? "Cancel" : "Edit"}</Button>
            <Button size="sm" onClick={verify}>{profile.linkedin_verified ? "Unverify" : "Verify"} LinkedIn</Button>
          </div>
        }
      />

      <Card>
        {edit ? (
          <div className="space-y-4">
            <FormField label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></FormField>
            <FormField label="LinkedIn URL"><Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></FormField>
            <FormField label="GitHub URL"><Input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} /></FormField>
            <FormField label="Tech Stack"><Input value={form.primary_tech_stack} onChange={(e) => setForm({ ...form, primary_tech_stack: e.target.value })} /></FormField>
            <Button onClick={save}>Save Changes</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">LinkedIn</p>
              <div className="mt-1 flex items-center gap-2">
                {profile.linkedin_url ? (
                  <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                    View Profile <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : <span className="text-sm text-slate-500">Missing</span>}
                <Badge variant={profile.linkedin_verified ? "green" : "yellow"}>{profile.linkedin_verified ? "Verified" : "Unverified"}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">GitHub</p>
              <div className="mt-1">
                {profile.github_present ? (
                  <a href={profile.github_url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                    View Profile <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : <span className="text-sm text-slate-500">Missing</span>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Assigned Engineer</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{profile.assigned_engineer_name || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Devsinc ID</p>
              <p className="mt-1">{profile.assigned_engineer_devsinc_id ? <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{profile.assigned_engineer_devsinc_id}</code> : "—"}</p>
            </div>
          </div>
        )}
      </Card>

      <div>
        <h3 className="mb-3 font-semibold text-slate-900">Linked Leads ({leads.length})</h3>
        <SortableTable storageKey="profile-linked-leads" columns={leadColumns} data={leads} emptyMessage="No leads linked to this profile." />
      </div>
    </div>
  );
}
