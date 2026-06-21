"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User, UserRole } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { Badge, Button, DataTable, Input, Select, Modal, FormField, Tabs, EmptyState, RecordIdCell, RecordIdHeader } from "@/components/ui";
import { UserPlus, Mail, Pencil, KeyRound, UserX, Filter } from "lucide-react";

type Tab = "active" | "pending" | "invitations";

const ROLES: UserRole[] = ["admin", "manager", "bd", "engineer"];

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<{ id: number; email: string; role: string; token: string; expires_at: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", role: "" });
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "", employee_id: "", devsinc_id: "", role: "engineer" as UserRole });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "engineer" as UserRole });
  const [editForm, setEditForm] = useState({ full_name: "", email: "", employee_id: "", role: "engineer" as UserRole, devsinc_id: "", is_active: true, manager_id: "" });
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.role) params.set("role", filters.role);
    const q = params.toString() ? `?${params}` : "";
    api<User[]>(`/users${q}`).then(setUsers);
    api<User[]>("/users/pending-approvals").then(setPending);
    api<typeof invitations>("/users/invitations").then(setInvitations);
  };

  useEffect(() => { load(); }, [filters]);

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({
      full_name: u.full_name,
      email: u.email,
      employee_id: u.employee_id,
      role: u.role,
      devsinc_id: u.devsinc_id || "",
      is_active: u.is_active,
      manager_id: u.manager_id ? String(u.manager_id) : "",
    });
    setError("");
  };

  const approve = async (id: number) => { await api(`/users/${id}/approve`, { method: "POST" }); load(); };
  const reject = async (id: number) => { await api(`/users/${id}/reject`, { method: "POST" }); load(); };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/users", { method: "POST", body: JSON.stringify({ ...createForm, devsinc_id: createForm.role === "engineer" ? createForm.devsinc_id || null : null }) });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api<{ invite_url: string; token: string }>("/users/invite", { method: "POST", body: JSON.stringify(inviteForm) });
    alert(`Invite created! URL: /invite/${res.token}`);
    setShowInvite(false);
    load();
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setError("");
    try {
      await api(`/users/${editUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editForm.full_name,
          email: editForm.email,
          employee_id: editForm.employee_id,
          role: editForm.role,
          is_active: editForm.is_active,
          devsinc_id: editForm.role === "engineer" ? editForm.devsinc_id || null : null,
          manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
        }),
      });
      setEditUser(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    setError("");
    try {
      await api(`/users/${resetUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: resetPassword, must_reset_password: true }),
      });
      setResetUser(null);
      setResetPassword("");
      alert(`Password reset for ${resetUser.full_name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  const deactivate = async (u: User) => {
    if (!confirm(`Deactivate ${u.full_name}? They will no longer be able to sign in.`)) return;
    await api(`/users/${u.id}`, { method: "DELETE" });
    load();
  };

  const revokeInvite = async (id: number) => {
    await api(`/users/invitations/${id}`, { method: "DELETE" });
    load();
  };

  const managers = users.filter((u) => u.role === "manager" || u.role === "admin");

  const tabs = [
    { id: "active", label: "Active Users", count: users.length },
    { id: "pending", label: "Pending Approvals", count: pending.length },
    { id: "invitations", label: "Invitations", count: invitations.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Full control over users — edit roles, reset passwords, activate or deactivate accounts"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="h-4 w-4" /> Filters</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}><Mail className="h-4 w-4" /> Send Invite</Button>
            <Button size="sm" onClick={() => setShowCreate(true)}><UserPlus className="h-4 w-4" /> Create User</Button>
          </>
        }
      />

      {showFilters && tab === "active" && (
        <FilterPanel columns={2}>
          <FilterField label="Search">
            <Input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, email, employee ID…" />
          </FilterField>
          <FilterField label="Role">
            <Select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </FilterField>
        </FilterPanel>
      )}

      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

      {tab === "active" && (
        <DataTable>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <RecordIdHeader />
              {["Name", "Email", "Role", "Employee ID", "Devsinc ID", "Status", "Actions"].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <RecordIdCell value={u.id} />
                <td className="font-medium text-slate-900">{u.full_name}</td>
                <td className="text-slate-600">{u.email}</td>
                <td><Badge variant="indigo" className="capitalize">{u.role}</Badge></td>
                <td className="text-slate-600">{u.employee_id}</td>
                <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{u.role === "engineer" ? (u.devsinc_id || "—") : "—"}</code></td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                    {u.must_reset_password && <Badge variant="yellow">Reset required</Badge>}
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setResetUser(u); setResetPassword(""); setError(""); }} title="Reset password"><KeyRound className="h-4 w-4" /></Button>
                    {u.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => deactivate(u)} title="Deactivate"><UserX className="h-4 w-4 text-red-500" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {tab === "pending" && (
        pending.length === 0 ? (
          <EmptyState title="No pending approvals" description="BD registration requests will appear here." />
        ) : (
          <div className="space-y-3">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <div>
                  <p className="font-medium text-slate-900">{u.full_name}</p>
                  <p className="text-sm text-slate-500">{u.email} · BD Registration</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(u.id)}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => reject(u.id)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "invitations" && (
        <DataTable>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <RecordIdHeader />
              {["Email", "Role", "Expires", "Link", "Actions"].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id}>
                <RecordIdCell value={inv.id} />
                <td className="font-medium">{inv.email}</td>
                <td className="capitalize">{inv.role}</td>
                <td className="text-slate-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                <td>
                  <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`); alert("Invite link copied!"); }}>
                    Copy link
                  </button>
                </td>
                <td><Button variant="danger" size="sm" onClick={() => revokeInvite(inv.id)}>Revoke</Button></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <Modal open={showCreate} title="Create User" onClose={() => setShowCreate(false)}>
        <form onSubmit={createUser} className="space-y-4">
          <FormField label="Full Name"><Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} required /></FormField>
          <FormField label="Employee ID"><Input value={createForm.employee_id} onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })} required /></FormField>
          <FormField label="Email"><Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required /></FormField>
          <FormField label="Password"><Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required /></FormField>
          <FormField label="Role">
            <Select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}>
              {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </Select>
          </FormField>
          {createForm.role === "engineer" && (
            <FormField label="Devsinc ID"><Input value={createForm.devsinc_id} onChange={(e) => setCreateForm({ ...createForm, devsinc_id: e.target.value })} required /></FormField>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit">Create</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editUser} title={`Edit User — ${editUser?.full_name}`} onClose={() => setEditUser(null)} size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name"><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required /></FormField>
            <FormField label="Employee ID"><Input value={editForm.employee_id} onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })} required /></FormField>
            <FormField label="Email"><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></FormField>
            <FormField label="Role">
              <Select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}>
                {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
              </Select>
            </FormField>
            {editForm.role === "engineer" && (
              <FormField label="Devsinc ID"><Input value={editForm.devsinc_id} onChange={(e) => setEditForm({ ...editForm, devsinc_id: e.target.value })} /></FormField>
            )}
            <FormField label="Manager">
              <Select value={editForm.manager_id} onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}>
                <option value="">None</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Account Status">
              <Select value={editForm.is_active ? "active" : "inactive"} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "active" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit">Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetUser} title={`Reset Password — ${resetUser?.full_name}`} onClose={() => setResetUser(null)}>
        <form onSubmit={submitResetPassword} className="space-y-4">
          <p className="text-sm text-slate-500">Set a new password for this user. They will be required to change it on next login.</p>
          <FormField label="New Password"><Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={6} /></FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit">Reset Password</Button>
            <Button type="button" variant="secondary" onClick={() => setResetUser(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showInvite} title="Send Invite" onClose={() => setShowInvite(false)}>
        <form onSubmit={inviteUser} className="space-y-4">
          <FormField label="Email"><Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required /></FormField>
          <FormField label="Role">
            <Select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}>
              {["manager", "bd", "engineer"].map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </Select>
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit">Send Invite</Button>
            <Button type="button" variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
