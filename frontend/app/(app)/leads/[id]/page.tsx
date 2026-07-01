"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Lead, User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { LeadStatusEditor } from "@/components/LeadStatusEditor";
import { LeadIssueReporter } from "@/components/LeadIssueReporter";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api<Lead>(`/leads/${id}`)
      .then(setLead)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    load();
  }, [id]);

  const toggleJdInvite = async () => {
    await api(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ jd_invite_sent: !lead?.jd_invite_sent }) });
    load();
  };

  const updateStatus = async (data: {
    phase: string;
    type: string;
    status: string;
    interview_number: string;
    interview_round: string;
    note: string;
  }) => {
    await api(`/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        phase: data.phase,
        type: data.type,
        status: data.status,
        interview_number: data.interview_number || null,
        interview_round: data.interview_round || null,
        note: data.note || null,
      }),
    });
    load();
  };

  // Lead status can only be changed by admins and managers (engineering / BD managers).
  const canUpdateStatus = user && (user.role === "admin" || user.role === "manager");
  // JD invite toggle remains available to anyone who can edit the lead.
  const canEditLead = user && ["admin", "manager", "bd", "engineer"].includes(user.role);

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
  if (!lead) return <p className="text-red-600">Lead not found.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Link>

      <PageHeader
        title={lead.job_title}
        description={`${lead.company} · ${lead.job_source}`}
        actions={
          lead.jd_invite_sent !== undefined && (
            <div className="flex items-center gap-2">
              <Badge variant={lead.jd_invite_sent ? "green" : "yellow"}>{lead.jd_invite_sent ? "JD Invite Sent" : "JD Invite Pending"}</Badge>
              {canEditLead && <Button variant="secondary" size="sm" onClick={toggleJdInvite}>Toggle JD Invite</Button>}
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Assignment</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Engineer</dt><dd className="font-medium text-slate-900">{lead.assigned_engineer_name || "Unassigned"}</dd></div>
            {lead.assigned_engineer_devsinc_id && (
              <div className="flex justify-between"><dt className="text-slate-500">Devsinc ID</dt><dd><code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{lead.assigned_engineer_devsinc_id}</code></dd></div>
            )}
            <div className="flex justify-between"><dt className="text-slate-500">BD</dt><dd className="font-medium">{lead.bd_name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Profile</dt><dd className="font-medium">{lead.profile_name || "—"}</dd></div>
            {lead.primary_tech && (
              <div className="flex justify-between"><dt className="text-slate-500">Tech Stack</dt><dd><Badge variant="green">{lead.primary_tech}</Badge></dd></div>
            )}
          </dl>
        </Card>
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Current Status</h3>
          <div className="space-y-2">
            <Badge variant="blue">{lead.phase}</Badge>
            <p className="text-sm text-slate-600">{lead.type} · {lead.status}</p>
            {(lead.interview_number || lead.interview_round) && (
              <p className="text-sm text-slate-500">
                {lead.interview_number && <span>{lead.interview_number} interview</span>}
                {lead.interview_number && lead.interview_round && " · "}
                {lead.interview_round && <span>{lead.interview_round}</span>}
              </p>
            )}
          </div>
        </Card>
      </div>

      {canUpdateStatus && (
        <Card>
          <h3 className="mb-4 font-semibold text-slate-900">Update Status</h3>
          <LeadStatusEditor
            key={`${lead.phase}-${lead.type}-${lead.status}-${lead.interview_number}-${lead.interview_round}`}
            initial={{
              phase: lead.phase,
              type: lead.type,
              status: lead.status,
              interview_number: lead.interview_number || "",
              interview_round: lead.interview_round || "",
            }}
            onSubmit={updateStatus}
          />
        </Card>
      )}

      <LeadIssueReporter leadId={lead.id} />
    </div>
  );
}
