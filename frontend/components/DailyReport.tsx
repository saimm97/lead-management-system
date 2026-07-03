"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Input, Spinner } from "./ui";
import { exportCsv } from "@/lib/csv";
import { Download, Briefcase } from "lucide-react";

interface DailyLead {
  id: number;
  company: string;
  job_title: string;
  job_source: string;
  status: string;
  engineer_name: string | null;
}
interface BdEntry {
  bd_id: number;
  bd_name: string;
  bd_employee_id: string | null;
  total_leads: number;
  platforms: { source: string; count: number }[];
  leads: DailyLead[];
}
interface DailyData {
  date: string;
  total_leads: number;
  active_bds: number;
  bds: BdEntry[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function DailyReport() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<DailyData>(`/reports/daily?date=${date}`).then(setData).finally(() => setLoading(false));
  }, [date]);

  const exportAll = () => {
    if (!data) return;
    const rows = data.bds.flatMap((bd) =>
      bd.leads.map((l) => ({ bd: bd.bd_name, ...l }))
    );
    exportCsv(`daily_report_${date}`, [
      { header: "BD", value: (r: { bd: string }) => r.bd },
      { header: "Lead ID", value: (r: DailyLead) => r.id },
      { header: "Company", value: (r: DailyLead) => r.company },
      { header: "Job Title", value: (r: DailyLead) => r.job_title },
      { header: "Platform", value: (r: DailyLead) => r.job_source },
      { header: "Engineer", value: (r: DailyLead) => r.engineer_name },
      { header: "Status", value: (r: DailyLead) => r.status },
    ], rows as (DailyLead & { bd: string })[]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-44" />
          {data && (
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-900">{data.total_leads}</span> leads applied by{" "}
              <span className="font-medium text-slate-900">{data.active_bds}</span> BD{data.active_bds === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {data && data.bds.length > 0 && (
          <Button variant="secondary" size="sm" onClick={exportAll}><Download className="h-4 w-4" /> CSV</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !data || data.bds.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No leads were applied on {date}.</p></Card>
      ) : (
        <div className="space-y-4">
          {data.bds.map((bd) => (
            <Card key={bd.bd_id}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{bd.bd_name}</p>
                    {bd.bd_employee_id && <p className="text-xs text-slate-400">ID: {bd.bd_employee_id}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{bd.total_leads}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Leads applied</p>
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-500">Platforms</p>
                <div className="flex flex-wrap gap-1.5">
                  {bd.platforms.map((p) => (
                    <Badge key={p.source} variant="indigo">{p.source} · {p.count}</Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Lead</th>
                      <th className="px-3 py-2">Platform</th>
                      <th className="px-3 py-2">Assigned Engineer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bd.leads.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-800">{l.job_title}</p>
                          <p className="text-xs text-slate-400">{l.company}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{l.job_source}</td>
                        <td className="px-3 py-2">{l.engineer_name || <span className="text-slate-400">Unassigned</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
