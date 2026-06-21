"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { OutcomeBarChart, FunnelChartView, SourceDonut } from "@/components/ChartsLazy";
import { PageHeader } from "@/components/PageHeader";
import { Card, Tabs, Spinner } from "@/components/ui";

export default function ReportsPage() {
  const [tab, setTab] = useState<"weekly" | "monthly">("monthly");
  const [weekly, setWeekly] = useState<{ new_leads: number; overdue_followups: number; open_issues: Record<string, number>; target_progress: { engineer: string; devsinc_id?: string | null; target: number; tech: string }[] } | null>(null);
  const [monthly, setMonthly] = useState<{ outcomes: Record<string, number>; funnel: { stage: string; count: number }[]; source_performance: { source: string; count: number }[]; profile_health: Record<string, number>; issues_summary: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "weekly") {
      api<NonNullable<typeof weekly>>("/reports/weekly").then(setWeekly).finally(() => setLoading(false));
    } else {
      api<NonNullable<typeof monthly>>("/reports/monthly").then(setMonthly).finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Weekly and monthly performance analytics" />
      <Tabs tabs={[{ id: "weekly", label: "Weekly Report" }, { id: "monthly", label: "Monthly Report" }]} active={tab} onChange={(id) => setTab(id as "weekly" | "monthly")} />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tab === "weekly" && weekly ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card><p className="text-sm font-medium text-slate-500">New Leads</p><p className="mt-2 text-4xl font-bold text-slate-900">{weekly.new_leads}</p></Card>
            <Card><p className="text-sm font-medium text-slate-500">Overdue Follow-ups</p><p className="mt-2 text-4xl font-bold text-red-600">{weekly.overdue_followups}</p></Card>
            <Card><p className="text-sm font-medium text-slate-500">Open Issues</p><p className="mt-2 text-4xl font-bold text-slate-900">{Object.values(weekly.open_issues).reduce((a, b) => a + b, 0)}</p></Card>
          </div>
          {weekly.target_progress.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-900">Target Progress</h3>
              <div className="mt-4 space-y-3">
                {weekly.target_progress.map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{t.engineer}</p>
                      {t.devsinc_id && <p className="text-xs text-slate-400">Devsinc ID: {t.devsinc_id}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{t.target} leads</p>
                      <p className="text-xs text-slate-500">{t.tech}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : tab === "monthly" && monthly ? (
        <div className="space-y-6">
          <OutcomeBarChart data={monthly.outcomes} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <FunnelChartView data={monthly.funnel} />
            <SourceDonut data={monthly.source_performance} />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Total Profiles", value: monthly.profile_health.total },
              { label: "LinkedIn Verified", value: monthly.profile_health.linkedin_verified, color: "text-emerald-600" },
              { label: "Open Issues", value: monthly.issues_summary.open, color: "text-red-600" },
              { label: "Resolved Issues", value: monthly.issues_summary.resolved, color: "text-emerald-600" },
            ].map((c) => (
              <Card key={c.label}>
                <p className="text-sm font-medium text-slate-500">{c.label}</p>
                <p className={`mt-1 text-3xl font-bold ${c.color || "text-slate-900"}`}>{c.value}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
