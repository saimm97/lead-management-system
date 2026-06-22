"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { Card } from "./ui";

export type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "radar" | "hbar";
export interface ChartDatum { name: string; value: number }

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const TYPE_LABELS: Record<ChartType, string> = {
  bar: "Bar",
  hbar: "Horizontal Bar",
  line: "Line",
  area: "Area",
  pie: "Pie",
  donut: "Donut",
  radar: "Radar",
};

const tooltipStyle = {
  contentStyle: { borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" },
  labelStyle: { fontWeight: 600, color: "#0f172a" },
};

export function MultiChart({
  title,
  description,
  data,
  types = ["bar", "line", "area", "pie", "donut", "radar"],
  defaultType = "bar",
  color = "#4f46e5",
  height = 280,
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  types?: ChartType[];
  defaultType?: ChartType;
  color?: string;
  height?: number;
}) {
  const [type, setType] = useState<ChartType>(types.includes(defaultType) ? defaultType : types[0]);

  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart data={data} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data} margin={{ bottom: 20 }}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${title.replace(/\s/g, "")})`} />
          </AreaChart>
        );
      case "hbar":
        return (
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={18} />
          </BarChart>
        );
      case "pie":
      case "donut":
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={type === "donut" ? 55 : 0}
              outerRadius={90}
              paddingAngle={type === "donut" ? 2 : 0}
              label={(e) => e.name}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        );
      case "radar":
        return (
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.4} />
            <Tooltip {...tooltipStyle} />
          </RadarChart>
        );
      default:
        return (
          <BarChart data={data} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        );
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                type === t ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No data to display</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      )}
    </Card>
  );
}
