"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MultiChart } from "@/components/ChartsLazy";
import { ResourceLeadsReport } from "@/components/ResourceLeadsReport";
import { DailyReport } from "@/components/DailyReport";
import { EngineerReport } from "@/components/EngineerReport";
import { PageHeader } from "@/components/PageHeader";
import { Card, Tabs, Spinner, cn } from "@/components/ui";

type ReportGroup = "bd" | "engineers";
type BdTab = "daily" | "resource" | "weekly" | "monthly";

const toData = (obj: Record<string, number>) =>
  Object.entries(obj).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

export default function ReportsPage() {
  const [group, setGroup] = useState<ReportGroup>("bd");
  const [tab, setTab] = useState<BdTab>("daily");
  const [weekly, setWeekly] = useState<{ new_leads: number; overdue_followups: number; open_issues: Record<string, number>; target_progress: { engineer: string; devsinc_id?: string | null; target: number; tech: string }[] } | null>(null);
  const [monthly, setMonthly] = useState<{ outcomes: Record<string, number>; funnel: { stage: string; count: number }[]; source_performance: { source: string; count: number }[]; profile_health: Record<string, number>; issues_summary: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (group !== "bd" || tab === "resource" || tab === "daily") { setLoading(false); return; }
    setLoading(true);
    if (tab === "weekly") {
      api<NonNullable<typeof weekly>>("/reports/weekly").then(setWeekly).finally(() => setLoading(false));
    } else {
      api<NonNullable<typeof monthly>>("/reports/monthly").then(setMonthly).finally(() => setLoading(false));
    }
  }, [group, tab]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="BD and engineer performance analytics" />

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-card">
        {([{ id: "bd", label: "BD Reports" }, { id: "engineers", label: "Engineers Report" }] as const).map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition", group === g.id ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            {g.label}
          </button>
        ))}
      </div>

      {group === "engineers" ? (
        <EngineerReport />
      ) : (
        <>
          <Tabs
            tabs={[{ id: "daily", label: "Daily Report" }, { id: "resource", label: "Resource Leads" }, { id: "weekly", label: "Weekly Report" }, { id: "monthly", label: "Monthly Report" }]}
            active={tab}
            onChange={(id) => setTab(id as BdTab)}
          />

          {tab === "daily" ? (
            <DailyReport />
          ) : tab === "resource" ? (
            <ResourceLeadsReport />
          ) : loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tab === "weekly" && weekly ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card><p className="text-sm font-medium text-slate-500">New Leads</p><p className="mt-2 text-4xl font-bold text-slate-900">{weekly.new_leads}</p></Card>
            <Card><p className="text-sm font-medium text-slate-500">Overdue Follow-ups</p><p className="mt-2 text-4xl font-bold text-red-600">{weekly.overdue_followups}</p></Card>
            <Card><p className="text-sm font-medium text-slate-500">Open Issues</p><p className="mt-2 text-4xl font-bold text-slate-900">{Object.values(weekly.open_issues).reduce((a, b) => a + b, 0)}</p></Card>
          </div>
          {Object.keys(weekly.open_issues).length > 0 && (
            <MultiChart
              title="Open Issues by Category"
              description="This week's open issues"
              data={toData(weekly.open_issues)}
              types={["bar", "hbar", "donut", "pie", "radar"]}
              defaultType="bar"
              color="#f59e0b"
            />
          )}
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
          <MultiChart
            title="Monthly Outcomes"
            description="Lead results breakdown"
            data={toData(monthly.outcomes)}
            types={["bar", "hbar", "line", "area", "pie", "donut", "radar"]}
            defaultType="bar"
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <MultiChart
              title="Conversion Funnel"
              description="Stage progression"
              data={monthly.funnel.map((f) => ({ name: f.stage, value: f.count }))}
              types={["bar", "hbar", "line", "area"]}
              defaultType="bar"
              color="#10b981"
            />
            <MultiChart
              title="Source Performance"
              description="Leads by job source"
              data={monthly.source_performance.map((s) => ({ name: s.source, value: s.count }))}
              types={["donut", "pie", "bar", "hbar", "radar"]}
              defaultType="donut"
            />
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
        </>
      )}
    </div>
  );
}
