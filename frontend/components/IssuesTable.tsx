"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Textarea } from "./ui";
import { Issue } from "@/lib/types";
import Link from "next/link";
import { api } from "@/lib/api";
import { Modal } from "./ui";
import { SortableTable, TableColumn } from "./SortableTable";
import { COL_MIN } from "@/lib/tableUtils";

const priorityColors: Record<string, "default" | "green" | "blue" | "red" | "yellow" | "purple"> = {
  low: "default", medium: "blue", high: "yellow", critical: "red",
};
const statusColors: Record<string, "default" | "green" | "blue" | "red" | "yellow" | "purple"> = {
  open: "red", in_progress: "yellow", resolved: "green", closed: "default",
};

function issueColumns(onSelect: (issue: Issue) => void): TableColumn<Issue>[] {
  return [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (i) => i.id, className: "text-center font-medium tabular-nums text-slate-500", render: (i) => i.id },
    { id: "created_at", label: "Created", minWidth: COL_MIN.date, getSortValue: (i) => i.created_at, className: "text-slate-500", render: (i) => new Date(i.created_at).toLocaleDateString() },
    { id: "title", label: "Title", minWidth: COL_MIN.xl, getSortValue: (i) => i.title, className: "font-medium text-slate-900", render: (i) => i.title },
    { id: "category", label: "Category", minWidth: COL_MIN.sm, getSortValue: (i) => i.category, className: "capitalize text-slate-600", render: (i) => i.category.replace("_", " ") },
    { id: "priority", label: "Priority", minWidth: COL_MIN.sm, getSortValue: (i) => i.priority, render: (i) => <Badge variant={priorityColors[i.priority]}>{i.priority}</Badge> },
    { id: "status", label: "Status", minWidth: COL_MIN.sm, getSortValue: (i) => i.status, render: (i) => <Badge variant={statusColors[i.status]}>{i.status.replace("_", " ")}</Badge> },
    {
      id: "reported_by", label: "Reported By", minWidth: COL_MIN.md, getSortValue: (i) => i.reported_by_name || "",
      render: (i) => (
        <>
          <p className="font-medium">{i.reported_by_name}</p>
          <Badge variant="purple" className="mt-1">{i.reported_by_role}</Badge>
        </>
      ),
    },
    {
      id: "lead", label: "Lead", minWidth: COL_MIN.sm, getSortValue: (i) => i.related_lead_id || 0,
      render: (i) => i.related_lead_id ? <Link href={`/leads/${i.related_lead_id}`} className="text-brand-600 hover:underline">#{i.related_lead_id}</Link> : "—",
    },
    { id: "manager", label: "Manager", minWidth: COL_MIN.md, getSortValue: (i) => i.assigned_manager_name || "", className: "text-slate-600", render: (i) => i.assigned_manager_name || "—" },
    {
      id: "actions", label: "Actions", minWidth: COL_MIN.actions, sortable: false,
      render: (i) => <button onClick={() => onSelect(i)} className="text-sm font-medium text-brand-600 hover:text-brand-700">View</button>,
    },
  ];
}

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
  const columns = useMemo(() => issueColumns(onSelect), [onSelect]);

  return (
    <SortableTable
      storageKey="issues"
      columns={columns}
      data={issues}
      emptyMessage="No issues found."
      selectable={selectable}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      allSelected={allSelected}
      rowClassName={(i) => (selected?.has(i.id) ? "bg-brand-50/50" : undefined)}
    />
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
