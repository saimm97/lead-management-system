"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Input, FormField } from "@/components/ui";
import { Mail, Calendar, FileText, KeyRound } from "lucide-react";

export default function AdminSettingsPage() {
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    setPwError("");
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError("New passwords do not match");
      return;
    }
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      setPwMsg("Password updated successfully");
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  const sections = [
    {
      icon: Mail,
      title: "SMTP Configuration",
      description: "Configure via environment variables: SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL",
    },
    {
      icon: Calendar,
      title: "Report Schedule",
      items: ["Weekly reports: Every Monday at 8:00 AM UTC", "Monthly reports: 1st of each month at 8:00 AM UTC"],
    },
    {
      icon: FileText,
      title: "Audit Log",
      description: "View the full audit trail of system actions.",
      link: { href: "/admin/audit", label: "Open Audit Log" },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Settings" description="System configuration and account security" />

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Change Your Password</h3>
            <p className="text-sm text-slate-500">Update your admin account password</p>
          </div>
        </div>
        <form onSubmit={changePassword} className="grid max-w-md gap-4">
          <FormField label="Current Password"><Input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} required /></FormField>
          <FormField label="New Password"><Input type="password" value={pwForm.newPw} onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })} required minLength={6} /></FormField>
          <FormField label="Confirm New Password"><Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required minLength={6} /></FormField>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwMsg && <p className="text-sm text-emerald-600">{pwMsg}</p>}
          <Button type="submit" className="w-fit">Update Password</Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Card key={s.title}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">{s.title}</h3>
            {s.description && <p className="mt-2 text-sm text-slate-500">{s.description}</p>}
            {s.items && (
              <ul className="mt-2 space-y-1">
                {s.items.map((item) => <li key={item} className="text-sm text-slate-500">{item}</li>)}
              </ul>
            )}
            {s.link && (
              <Link href={s.link.href} className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
                {s.link.label} →
              </Link>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
