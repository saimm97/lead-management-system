"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import { CreatableSelect } from "./CreatableSelect";
import { Badge, Button, Card, FormField, Textarea } from "./ui";
import { AlertTriangle } from "lucide-react";

const priorityVariant: Record<string, "default" | "blue" | "yellow" | "red"> = {
  low: "default", medium: "blue", high: "yellow", critical: "red",
};
const statusVariant: Record<string, "default" | "green" | "yellow" | "red"> = {
  open: "red", in_progress: "yellow", resolved: "green", closed: "default",
};

export function LeadIssueReporter({ leadId }: { leadId: number | string }) {
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadTypes = () =>
    api<{ label: string }[]>("/leads/dropdown-options?category=lead_issue_type")
      .then((opts) => setIssueTypes(opts.map((o) => o.label)))
      .catch(() => setIssueTypes([]));

  const loadIssues = () =>
    api<Issue[]>(`/issues?related_lead_id=${leadId}`)
      .then(setIssues)
      .catch(() => setIssues([]));

  useEffect(() => {
    loadTypes();
    loadIssues();
  }, [leadId]);

  const createIssueType = async (label: string) => {
    await api("/leads/dropdown-options", {
      method: "POST",
      body: JSON.stringify({ category: "lead_issue_type", label }),
    });
    setIssueTypes((prev) => [...prev, label]);
  };

  const submit = async () => {
    if (!selectedType) {
      setMsg("Please select an issue type.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await api("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: selectedType,
          description: note.trim() || selectedType,
          category: "lead_quality",
          priority,
          related_lead_id: Number(leadId),
        }),
      });
      setSelectedType("");
      setNote("");
      setPriority("medium");
      setMsg("Issue reported successfully.");
      loadIssues();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to report issue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Report an Issue</h3>
          <p className="text-sm text-slate-500">Flag a problem with this lead (no show, fake company, etc.)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Issue Type">
          <CreatableSelect
            value={selectedType}
            onChange={setSelectedType}
            options={issueTypes}
            onCreate={createIssueType}
            placeholder="Select an issue…"
          />
        </FormField>
        <FormField label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm capitalize text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
      </div>
      <div className="mt-4">
        <FormField label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add any extra context…" />
        </FormField>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} disabled={saving}>{saving ? "Reporting…" : "Report Issue"}</Button>
        {msg && <p className="text-sm text-slate-500">{msg}</p>}
      </div>

      {issues.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Reported Issues ({issues.length})</h4>
          <div className="space-y-2">
            {issues.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{i.title}</span>
                  {i.reported_by_name && <span className="text-xs text-slate-400">by {i.reported_by_name}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={priorityVariant[i.priority] || "default"}>{i.priority}</Badge>
                  <Badge variant={statusVariant[i.status] || "default"}>{i.status.replace("_", " ")}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
