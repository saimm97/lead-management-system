"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button, Input, Select, Textarea, Card, FormField, Spinner } from "@/components/ui";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ArrowLeft } from "lucide-react";

const categories = [
  { value: "lead_quality", label: "Lead Quality" },
  { value: "assignment", label: "Assignment" },
  { value: "profile", label: "Profile" },
  { value: "client", label: "Client" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

export default function NewIssuePage() {
  const [form, setForm] = useState({ title: "", description: "", category: "other", priority: "medium", related_engineer_id: "", related_lead_id: "" });
  const [engineers, setEngineers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api<User[]>("/users/engineers").then(setEngineers).catch(() => setEngineers([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          priority: form.priority,
          related_engineer_id: form.related_engineer_id ? Number(form.related_engineer_id) : null,
          related_lead_id: form.related_lead_id ? Number(form.related_lead_id) : null,
        }),
      });
      router.push("/issues");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit issue");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/issues" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Issues
      </Link>
      <PageHeader title="Log New Issue" description="Report a problem for your manager to review" />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></FormField>
          <FormField label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></FormField>
          <FormField label="Regarding Engineer">
            <SearchableSelect
              value={form.related_engineer_id}
              onChange={(v) => setForm({ ...form, related_engineer_id: v })}
              options={engineers.map((eng) => ({ value: String(eng.id), label: eng.full_name, hint: eng.devsinc_id || eng.employee_id }))}
              placeholder="Optional — search engineers…"
              searchPlaceholder="Search engineer name…"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Related Lead ID (optional)">
            <Input type="number" placeholder="e.g. 1024" value={form.related_lead_id} onChange={(e) => setForm({ ...form, related_lead_id: e.target.value })} />
          </FormField>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? <><Spinner className="h-4 w-4" /> Submitting…</> : "Submit Issue"}</Button>
            <Link href="/issues"><Button type="button" variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
