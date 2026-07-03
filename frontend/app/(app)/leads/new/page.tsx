"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { LeadStatusEditor } from "@/components/LeadStatusEditor";
import { CreatableSelect } from "@/components/CreatableSelect";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button, Input, Select, Textarea, Card, FormField, EmptyState } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export default function NewLeadPage() {
  const [user, setUser] = useState<User | null>(null);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<{ id: number; full_name: string }[]>([]);
  const [jobSources, setJobSources] = useState<string[]>([]);
  const [form, setForm] = useState({
    company: "", job_title: "", job_source: "Jobright", primary_tech: "",
    technologies: "", assigned_engineer_id: "", profile_id: "", notes: "",
  });
  const [status, setStatus] = useState({
    phase: "Applied", type: "JD Sent", status: "JD Invite Pending",
    interview_number: "", interview_round: "", note: "",
  });
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    // /users/engineers is accessible to BD too (unlike /users), so the dropdown always populates.
    api<User[]>("/users/engineers").then(setEngineers).catch(() => setEngineers([]));
    api<{ label: string }[]>("/leads/dropdown-options?category=job_source")
      .then((opts) => setJobSources(opts.map((o) => o.label)))
      .catch(() => setJobSources(["Jobright", "Upwork", "sforcejobs", "LinkedIn", "Referral", "Cold Call"]));
  }, []);

  const createJobSource = async (label: string) => {
    await api("/leads/dropdown-options", { method: "POST", body: JSON.stringify({ category: "job_source", label }) });
    setJobSources((prev) => [...prev, label]);
  };

  useEffect(() => {
    if (user && ["admin", "manager"].includes(user.role)) {
      api<{ id: number; full_name: string }[]>("/profiles").then(setProfiles);
    }
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const technologies = form.technologies.split(",").map((t) => t.trim()).filter(Boolean);
    const lead = await api<{ id: number }>("/leads", {
      method: "POST",
      body: JSON.stringify({
        company: form.company,
        job_title: form.job_title,
        job_source: form.job_source,
        primary_tech: form.primary_tech || null,
        technologies,
        assigned_engineer_id: form.assigned_engineer_id ? Number(form.assigned_engineer_id) : null,
        profile_id: form.profile_id ? Number(form.profile_id) : null,
        notes: form.notes || null,
        phase: status.phase,
        type: status.type,
        status: status.status,
        interview_number: status.interview_number || null,
        interview_round: status.interview_round || null,
      }),
    });
    router.push(`/leads/${lead.id}`);
  };

  if (user && !["admin", "manager", "bd"].includes(user.role)) {
    return <EmptyState title="Access denied" description="You do not have permission to create leads." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Link>
      <PageHeader title="Create Lead" description="Add a new job opportunity to the pipeline" />
      <Card>
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required /></FormField>
            <FormField label="Job Title"><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} required /></FormField>
          </div>
          <FormField label="Job Source">
            <CreatableSelect
              value={form.job_source}
              onChange={(v) => setForm({ ...form, job_source: v })}
              options={jobSources}
              onCreate={createJobSource}
              placeholder="Select a source…"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Primary Tech"><Input placeholder="e.g. MERN" value={form.primary_tech} onChange={(e) => setForm({ ...form, primary_tech: e.target.value })} /></FormField>
            <FormField label="Technologies"><Input placeholder="Comma-separated" value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} /></FormField>
          </div>
          <FormField label="Assign Engineer">
            <SearchableSelect
              value={form.assigned_engineer_id}
              onChange={(v) => setForm({ ...form, assigned_engineer_id: v })}
              options={engineers.map((e) => ({ value: String(e.id), label: e.full_name, hint: e.devsinc_id || e.employee_id }))}
              placeholder="Optional — search engineers…"
              searchPlaceholder="Search engineer name…"
            />
          </FormField>
          {profiles.length > 0 && (
            <FormField label="Profile">
              <Select value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}>
                <option value="">Optional</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </FormField>
          )}
          <FormField label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Initial Status</h3>
            <LeadStatusEditor
              initial={status}
              onChange={setStatus}
              hideSubmit
              showNote={false}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit">Create Lead</Button>
            <Link href="/leads"><Button type="button" variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
