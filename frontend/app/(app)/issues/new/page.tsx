"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Input, Select, Textarea, Card, FormField } from "@/components/ui";
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
  const [form, setForm] = useState({ title: "", description: "", category: "other", priority: "medium", related_lead_id: "", related_profile_id: "" });
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("/issues", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        related_lead_id: form.related_lead_id ? Number(form.related_lead_id) : null,
        related_profile_id: form.related_profile_id ? Number(form.related_profile_id) : null,
      }),
    });
    router.push("/issues");
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
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Related Lead ID"><Input type="number" placeholder="Optional" value={form.related_lead_id} onChange={(e) => setForm({ ...form, related_lead_id: e.target.value })} /></FormField>
            <FormField label="Related Profile ID"><Input type="number" placeholder="Optional" value={form.related_profile_id} onChange={(e) => setForm({ ...form, related_profile_id: e.target.value })} /></FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit">Submit Issue</Button>
            <Link href="/issues"><Button type="button" variant="secondary">Cancel</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
