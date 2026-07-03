"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { Badge, Button, Card, Input, Modal, Spinner } from "./ui";
import { SearchableSelect } from "./SearchableSelect";
import { exportCsv } from "@/lib/csv";
import { Download } from "lucide-react";

interface FunnelStage { stage: string; count: number; pct: number }
interface EngineerEntry {
  engineer_id: number;
  engineer_name: string;
  devsinc_id: string | null;
  total_leads: number;
  funnel: FunnelStage[];
  conversion_rate: number;
  interview_rate: number;
  active: number;
  rejected: number;
}
interface EngineerData {
  start: string;
  end: string;
  total_leads: number;
  engineers: EngineerEntry[];
}
interface TechRow { tech: string; total: number; interview: number; offer: number; landed: number; conversion_pct: number }
interface EngineerDetail {
  engineer: { id: number; name: string; devsinc_id: string | null; email: string };
  start: string;
  end: string;
  total_leads: number;
  funnel: FunnelStage[];
  conversion_rate: number;
  interview_rate: number;
  active: number;
  rejected: number;
  by_technology: TechRow[];
  by_platform: { source: string; count: number }[];
  by_phase: { phase: string; count: number }[];
  by_status: { status: string; count: number }[];
}

const STAGE_COLORS = ["#4f46e5", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#10b981", "#059669"];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

function FunnelBars({ funnel }: { funnel: FunnelStage[] }) {
  return (
    <div className="space-y-2">
      {funnel.map((s, i) => (
        <div key={s.stage}>
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="text-slate-600">{s.stage}</span>
            <span className="tabular-nums text-slate-500">{s.count} · {s.pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(s.pct, 1.5)}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EngineerReport() {
  const [start, setStart] = useState(daysAgo(30));
  const [end, setEnd] = useState(today());
  const [engineerId, setEngineerId] = useState("");
  const [engineers, setEngineers] = useState<User[]>([]);
  const [data, setData] = useState<EngineerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EngineerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api<User[]>("/users/engineers").then(setEngineers).catch(() => setEngineers([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    api<EngineerData>(`/reports/engineers?start=${start}&end=${end}`).then(setData).finally(() => setLoading(false));
  }, [start, end]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await api<EngineerDetail>(`/reports/engineers/${id}?start=${start}&end=${end}`));
    } finally {
      setDetailLoading(false);
    }
  };

  const shown = data?.engineers.filter((e) => !engineerId || String(e.engineer_id) === engineerId) || [];

  const exportAll = () => {
    if (!data) return;
    exportCsv(`engineer_report_${start}_to_${end}`, [
      { header: "Engineer", value: (e: EngineerEntry) => e.engineer_name },
      { header: "Devsinc ID", value: (e: EngineerEntry) => e.devsinc_id },
      { header: "Leads Taken", value: (e: EngineerEntry) => e.total_leads },
      { header: "Screening", value: (e: EngineerEntry) => e.funnel[1]?.count },
      { header: "Interview", value: (e: EngineerEntry) => e.funnel[2]?.count },
      { header: "Technical", value: (e: EngineerEntry) => e.funnel[3]?.count },
      { header: "2nd Round+", value: (e: EngineerEntry) => e.funnel[4]?.count },
      { header: "Offer", value: (e: EngineerEntry) => e.funnel[5]?.count },
      { header: "Landed", value: (e: EngineerEntry) => e.funnel[6]?.count },
      { header: "Conversion %", value: (e: EngineerEntry) => e.conversion_rate },
      { header: "Interview %", value: (e: EngineerEntry) => e.interview_rate },
      { header: "Active", value: (e: EngineerEntry) => e.active },
      { header: "Rejected", value: (e: EngineerEntry) => e.rejected },
    ], data.engineers);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-500">From
            <Input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="mt-1 w-40" />
          </label>
          <label className="text-xs font-medium text-slate-500">To
            <Input type="date" value={end} max={today()} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-40" />
          </label>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Engineer</p>
            <div className="w-60">
              <SearchableSelect
                value={engineerId}
                onChange={setEngineerId}
                options={engineers.map((e) => ({ value: String(e.id), label: e.full_name, hint: e.devsinc_id || e.employee_id }))}
                placeholder="All engineers"
                searchPlaceholder="Search engineer name…"
              />
            </div>
          </div>
        </div>
        {data && data.engineers.length > 0 && (
          <Button variant="secondary" size="sm" onClick={exportAll}><Download className="h-4 w-4" /> CSV</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : shown.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No leads were assigned to engineers in this range.</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {shown.map((e) => (
            <Card key={e.engineer_id} className="cursor-pointer transition hover:border-brand-300 hover:shadow-md" onClick={() => openDetail(e.engineer_id)}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <p className="font-semibold text-slate-900">{e.engineer_name}</p>
                  {e.devsinc_id && <p className="text-xs text-slate-400">Devsinc ID: {e.devsinc_id}</p>}
                </div>
                <div className="flex gap-4 text-right">
                  <div><p className="text-xl font-bold text-slate-900">{e.total_leads}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">Taken</p></div>
                  <div><p className="text-xl font-bold text-emerald-600">{e.conversion_rate}%</p><p className="text-[10px] uppercase tracking-wide text-slate-400">Conversion</p></div>
                </div>
              </div>
              <div className="mt-4"><FunnelBars funnel={e.funnel} /></div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
                <Badge variant="blue">Interview {e.interview_rate}%</Badge>
                <Badge variant="default">Active {e.active}</Badge>
                <Badge variant="red">Rejected {e.rejected}</Badge>
                <span className="ml-auto text-brand-600">View details →</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={detailLoading || !!detail} title={detail ? detail.engineer.name : "Loading…"} onClose={() => setDetail(null)} size="lg">
        {detailLoading || !detail ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Leads Taken", value: detail.total_leads, color: "text-slate-900" },
                { label: "Conversion", value: `${detail.conversion_rate}%`, color: "text-emerald-600" },
                { label: "Interview Rate", value: `${detail.interview_rate}%`, color: "text-blue-600" },
                { label: "Rejected", value: detail.rejected, color: "text-red-600" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{m.label}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Funnel</h4>
              <FunnelBars funnel={detail.funnel} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Performance by Technology</h4>
              {detail.by_technology.length === 0 ? (
                <p className="text-sm text-slate-400">No data.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Technology</th>
                        <th className="px-3 py-2 text-right">Leads</th>
                        <th className="px-3 py-2 text-right">Interview</th>
                        <th className="px-3 py-2 text-right">Offer</th>
                        <th className="px-3 py-2 text-right">Landed</th>
                        <th className="px-3 py-2 text-right">Conv.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.by_technology.map((t) => (
                        <tr key={t.tech}>
                          <td className="px-3 py-2 font-medium text-slate-800">{t.tech}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{t.total}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.interview}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.offer}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.landed}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600">{t.conversion_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">By Platform</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.by_platform.map((p) => <Badge key={p.source} variant="indigo">{p.source} · {p.count}</Badge>)}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Current Phase</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.by_phase.map((p) => <Badge key={p.phase} variant="default">{p.phase} · {p.count}</Badge>)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Status Breakdown</h4>
              <div className="flex flex-wrap gap-1.5">
                {detail.by_status.map((s) => <Badge key={s.status} variant="default">{s.status} · {s.count}</Badge>)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
