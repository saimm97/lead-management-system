"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Card } from "./ui";

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const chartTooltipStyle = {
  contentStyle: { borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" },
  labelStyle: { fontWeight: 600, color: "#0f172a" },
};

export function SourceDonut({ data }: { data: { source: string; count: number }[] }) {
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Source Performance</h3>
      <p className="mb-4 text-sm text-slate-500">Leads by job source</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip {...chartTooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {data.map((d, i) => (
          <div key={d.source} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {d.source} ({d.count})
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RepBarChart({ data }: { data: { name: string; devsinc_id?: string | null; count: number }[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.devsinc_id ? `${d.name.split(" ")[0]} (${d.devsinc_id})` : d.name.split(" ")[0],
  }));
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Rep Performance</h3>
      <p className="mb-4 text-sm text-slate-500">Leads assigned per engineer</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip {...chartTooltipStyle} />
          <Bar dataKey="count" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function PipelineBar({ data }: { data: { stage: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Sales Pipeline</h3>
      <p className="mb-5 text-sm text-slate-500">{total} total leads across stages</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.map((stage, i) => (
          <div key={stage.stage} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center transition hover:border-slate-200 hover:shadow-sm">
            <div className="mx-auto mb-2 h-1 w-12 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stage.stage}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stage.count}</p>
            <p className="mt-0.5 text-xs text-slate-400">{Math.round((stage.count / total) * 100)}%</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function OutcomeBarChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Monthly Outcomes</h3>
      <p className="mb-4 text-sm text-slate-500">Lead results breakdown</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" height={70} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip {...chartTooltipStyle} />
          <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function FunnelChartView({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Conversion Funnel</h3>
      <p className="mb-4 text-sm text-slate-500">Stage progression</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip {...chartTooltipStyle} />
          <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
