"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Profile } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Input, DataTable, FormField, Spinner, RecordIdCell, RecordIdHeader } from "@/components/ui";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<{ id: number; company: string; job_title: string; status: string }[]>([]);
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

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
  if (!profile) return <p className="text-red-600">Profile not found.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">No leads linked to this profile.</div>
        ) : (
          <DataTable>
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <RecordIdHeader />
                {["Job Title", "Company", "Status"].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <RecordIdCell value={l.id} />
                  <td><Link href={`/leads/${l.id}`} className="font-medium text-brand-600 hover:text-brand-700">{l.job_title}</Link></td>
                  <td className="text-slate-600">{l.company}</td>
                  <td><Badge variant="blue">{l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
