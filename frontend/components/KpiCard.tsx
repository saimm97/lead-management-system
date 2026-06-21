"use client";

import { TrendingUp, TrendingDown, Users, Target, Clock, DollarSign, CheckCircle } from "lucide-react";
import { Card, cn } from "./ui";

const icons = [Users, Target, CheckCircle, Clock, TrendingUp, DollarSign];

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  variant?: "default" | "danger" | "success";
  index?: number;
}

export function KpiCard({ title, value, change, variant = "default", index = 0 }: KpiCardProps) {
  const Icon = icons[index % icons.length];
  const isPositive = change?.startsWith("+");
  const isDanger = variant === "danger" || change?.includes("overdue");

  return (
    <Card className="relative overflow-hidden" padding>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {change && (
            <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", isDanger ? "text-red-600" : isPositive ? "text-emerald-600" : "text-slate-500")}>
              {isPositive && !isDanger && <TrendingUp className="h-3.5 w-3.5" />}
              {change.startsWith("-") && <TrendingDown className="h-3.5 w-3.5" />}
              {change}
            </p>
          )}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: KpiCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.title} {...kpi} index={i} />
      ))}
    </div>
  );
}
