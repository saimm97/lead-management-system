"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Input, FormField, Badge } from "@/components/ui";
import { KeyRound, UserCircle } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    api<User>("/auth/me")
      .then((u) => {
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
      })
      .catch(() => { /* keep cached */ });
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    setPwError("");
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      setPwMsg("Password updated successfully");
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My Profile" description="Manage your account and security settings" />

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <UserCircle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{user?.full_name || "—"}</h3>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Role</dt>
            <dd className="mt-1"><Badge variant="indigo" className="capitalize">{user?.role?.replace("_", " ")}</Badge></dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Employee ID</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{user?.employee_id || "—"}</dd>
          </div>
          {user?.role === "engineer" && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Devsinc ID</dt>
              <dd className="mt-1"><code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{user?.devsinc_id || "—"}</code></dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Change Password</h3>
            <p className="text-sm text-slate-500">Update your account password</p>
          </div>
        </div>
        <form onSubmit={changePassword} className="grid max-w-md gap-4">
          <FormField label="Current Password"><Input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} required /></FormField>
          <FormField label="New Password"><Input type="password" value={pwForm.newPw} onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })} required minLength={6} /></FormField>
          <FormField label="Confirm New Password"><Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required minLength={6} /></FormField>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwMsg && <p className="text-sm text-emerald-600">{pwMsg}</p>}
          <Button type="submit" className="w-fit" disabled={saving}>{saving ? "Updating…" : "Update Password"}</Button>
        </form>
      </Card>
    </div>
  );
}
