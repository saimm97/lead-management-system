"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DashboardKPIs } from "@/lib/types";
import { KpiRow } from "@/components/KpiCard";
import { PipelineBar, SourceDonut, RepBarChart } from "@/components/ChartsLazy";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/ui";

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [pipeline, setPipeline] = useState<{ stage: string; count: number }[]>([]);
  const [sources, setSources] = useState<{ source: string; count: number }[]>([]);
  const [reps, setReps] = useState<{ name: string; devsinc_id: string | null; count: number }[]>([]);

  useEffect(() => {
    api<DashboardKPIs>("/reports/dashboard/kpis").then(setKpis);
    api<{ stage: string; count: number }[]>("/reports/dashboard/pipeline").then(setPipeline);
    api<{ source: string; count: number }[]>("/reports/dashboard/sources").then(setSources);
    api<{ name: string; devsinc_id: string | null; count: number }[]>("/reports/dashboard/rep-performance").then(setReps);
  }, []);

  if (!kpis) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lead Management Dashboard"
        description="Overview of leads, pipeline, tasks and team performance"
      />
      <KpiRow kpis={[
        { title: "Total Leads", value: kpis.total_leads, change: "+12% vs last month" },
        { title: "New Today", value: kpis.new_today, change: "-18% vs yesterday" },
        { title: "Qualified", value: kpis.qualified, change: "+9% this week" },
        { title: "Follow-ups Due", value: kpis.followups_due, change: `${kpis.followups_overdue} overdue`, variant: kpis.followups_overdue > 0 ? "danger" : "default" },
        { title: "Conversion Rate", value: `${kpis.conversion_rate}%`, change: "+4.3% improvement" },
        { title: "Revenue Pipeline", value: `$${(kpis.revenue_pipeline / 1000000).toFixed(2)}M`, change: "+15% projected" },
      ]} />
      <PipelineBar data={pipeline} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SourceDonut data={sources} />
        <RepBarChart data={reps} />
      </div>
    </div>
  );
}
