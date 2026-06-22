"use client";

import { useMemo } from "react";
import { Badge, Button } from "@/components/ui";
import { User } from "@/lib/types";
import { SortableTable, TableColumn } from "@/components/SortableTable";
import { COL_MIN } from "@/lib/tableUtils";
import { Pencil, KeyRound, UserX } from "lucide-react";

export function AdminUsersTable({
  users,
  onEdit,
  onReset,
  onDeactivate,
}: {
  users: User[];
  onEdit: (u: User) => void;
  onReset: (u: User) => void;
  onDeactivate: (u: User) => void;
}) {
  const columns = useMemo<TableColumn<User>[]>(() => [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (u) => u.id, className: "text-center font-medium tabular-nums text-slate-500", render: (u) => u.id },
    { id: "name", label: "Name", minWidth: COL_MIN.md, getSortValue: (u) => u.full_name, className: "font-medium text-slate-900", render: (u) => u.full_name },
    { id: "email", label: "Email", minWidth: COL_MIN.xl, getSortValue: (u) => u.email, className: "text-slate-600", render: (u) => u.email },
    { id: "role", label: "Role", minWidth: COL_MIN.sm, getSortValue: (u) => u.role, render: (u) => <Badge variant="indigo" className="capitalize">{u.role}</Badge> },
    { id: "employee_id", label: "Employee ID", minWidth: COL_MIN.sm, getSortValue: (u) => u.employee_id, className: "text-slate-600", render: (u) => u.employee_id },
    { id: "devsinc_id", label: "Devsinc ID", minWidth: COL_MIN.sm, getSortValue: (u) => u.devsinc_id || "", render: (u) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{u.role === "engineer" ? (u.devsinc_id || "—") : "—"}</code> },
    {
      id: "status", label: "Status", minWidth: COL_MIN.md, getSortValue: (u) => (u.is_active ? 1 : 0),
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Inactive"}</Badge>
          {u.must_reset_password && <Badge variant="yellow">Reset required</Badge>}
        </div>
      ),
    },
    {
      id: "actions", label: "Actions", minWidth: COL_MIN.actions, sortable: false,
      render: (u) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(u)} title="Edit"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => onReset(u)} title="Reset password"><KeyRound className="h-4 w-4" /></Button>
          {u.is_active && <Button variant="ghost" size="sm" onClick={() => onDeactivate(u)} title="Deactivate"><UserX className="h-4 w-4 text-red-500" /></Button>}
        </div>
      ),
    },
  ], [onEdit, onReset, onDeactivate]);

  return <SortableTable storageKey="admin-users" columns={columns} data={users} emptyMessage="No users found." />;
}

type Invitation = { id: number; email: string; role: string; token: string; expires_at: string };

export function AdminInvitationsTable({ invitations, onRevoke }: { invitations: Invitation[]; onRevoke: (id: number) => void }) {
  const columns = useMemo<TableColumn<Invitation>[]>(() => [
    { id: "id", label: "ID", minWidth: COL_MIN.id, getSortValue: (i) => i.id, className: "text-center font-medium tabular-nums text-slate-500", render: (i) => i.id },
    { id: "email", label: "Email", minWidth: COL_MIN.xl, getSortValue: (i) => i.email, className: "font-medium", render: (i) => i.email },
    { id: "role", label: "Role", minWidth: COL_MIN.sm, getSortValue: (i) => i.role, className: "capitalize", render: (i) => i.role },
    { id: "expires", label: "Expires", minWidth: COL_MIN.date, getSortValue: (i) => i.expires_at, className: "text-slate-500", render: (i) => new Date(i.expires_at).toLocaleDateString() },
    {
      id: "link", label: "Link", minWidth: COL_MIN.sm, sortable: false,
      render: (i) => (
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${i.token}`); alert("Invite link copied!"); }}>
          Copy link
        </button>
      ),
    },
    {
      id: "actions", label: "Actions", minWidth: COL_MIN.actions, sortable: false,
      render: (i) => <Button variant="danger" size="sm" onClick={() => onRevoke(i.id)}>Revoke</Button>,
    },
  ], [onRevoke]);

  return <SortableTable storageKey="admin-invitations" columns={columns} data={invitations} emptyMessage="No pending invitations." />;
}
