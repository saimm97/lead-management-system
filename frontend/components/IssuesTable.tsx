"use client";

import { useState } from "react";
import { Badge, Button, DataTable, Textarea, RecordIdCell, RecordIdHeader } from "./ui";
import { Issue } from "@/lib/types";
import Link from "next/link";
import { api } from "@/lib/api";
import { Modal } from "./ui";

const priorityColors: Record<string, "default" | "green" | "blue" | "red" | "yellow" | "purple"> = {
  low: "default", medium: "blue", high: "yellow", critical: "red",
};
const statusColors: Record<string, "default" | "green" | "blue" | "red" | "yellow" | "purple"> = {
  open: "red", in_progress: "yellow", resolved: "green", closed: "default",
};

export function IssuesTable({
  issues,
  onSelect,
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
}: {
  issues: Issue[];
  onSelect: (issue: Issue) => void;
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        No issues found.
      </div>
    );
  }

  return (
    <DataTable>
      <thead className="border-b border-slate-200 bg-slate-50/80">
        <tr>
          {selectable && <th className="w-10"><input type="checkbox" checked={allSelected} onChange={onToggleAll} className="rounded" /></th>}
          <RecordIdHeader />
          {["Created", "Title", "Category", "Priority", "Status", "Reported By", "Lead", "Manager", ""].map((h) => (
            <th key={h || "a"}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <tr key={issue.id} className={selected?.has(issue.id) ? "bg-brand-50/50" : undefined}>
            {selectable && <td><input type="checkbox" checked={selected?.has(issue.id)} onChange={() => onToggle?.(issue.id)} className="rounded" /></td>}
            <RecordIdCell value={issue.id} />
            <td className="text-slate-500">{new Date(issue.created_at).toLocaleDateString()}</td>
            <td className="font-medium text-slate-900">{issue.title}</td>
            <td className="capitalize text-slate-600">{issue.category.replace("_", " ")}</td>
            <td><Badge variant={priorityColors[issue.priority]}>{issue.priority}</Badge></td>
            <td><Badge variant={statusColors[issue.status]}>{issue.status.replace("_", " ")}</Badge></td>
            <td>
              <p className="font-medium">{issue.reported_by_name}</p>
              <Badge variant="purple" className="mt-1">{issue.reported_by_role}</Badge>
            </td>
            <td>
              {issue.related_lead_id ? <Link href={`/leads/${issue.related_lead_id}`} className="text-brand-600 hover:underline">#{issue.related_lead_id}</Link> : "—"}
            </td>
            <td className="text-slate-600">{issue.assigned_manager_name || "—"}</td>
            <td>
              <button onClick={() => onSelect(issue)} className="text-sm font-medium text-brand-600 hover:text-brand-700">View</button>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function IssueDetailPanel({
  issue,
  onClose,
  onUpdate,
  onRefresh,
}: {
  issue: Issue;
  onClose: () => void;
  onUpdate: (status: string, note?: string) => void;
  onRefresh: () => void;
}) {
  const [comment, setComment] = useState("");

  const addComment = async () => {
    if (!comment.trim()) return;
    await api(`/issues/${issue.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) });
    setComment("");
    onRefresh();
  };

  return (
    <Modal open={true} title={issue.title} onClose={onClose} size="lg">
      <p className="text-sm leading-relaxed text-slate-600">{issue.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={priorityColors[issue.priority]}>{issue.priority}</Badge>
        <Badge variant={statusColors[issue.status]}>{issue.status.replace("_", " ")}</Badge>
        <Badge variant="purple">{issue.category.replace("_", " ")}</Badge>
      </div>
      {issue.resolution_note && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <strong>Resolution:</strong> {issue.resolution_note}
        </div>
      )}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Comments ({issue.comments.length})</h3>
        <div className="mt-3 space-y-3">
          {issue.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{c.author_name}</p>
                <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Textarea placeholder="Add a comment..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          <Button size="sm" onClick={addComment}>Post Comment</Button>
        </div>
      </div>
      <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" size="sm" onClick={() => onUpdate("in_progress")}>Mark In Progress</Button>
        <Button size="sm" onClick={() => onUpdate("resolved", "Resolved")}>Resolve Issue</Button>
      </div>
    </Modal>
  );
}
