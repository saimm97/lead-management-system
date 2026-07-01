"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Input, Select, Textarea, FormField, Card, Spinner } from "@/components/ui";
import { CalendarDays, Link2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface Status { configured: boolean; connected: boolean; google_email: string | null }
interface Engineer { id: number; full_name: string; email: string; devsinc_id: string | null }
interface InviteResult { html_link: string | null; hangout_link: string | null; attendee_email: string; title: string }

export default function CalendarPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [form, setForm] = useState({
    engineer_id: "",
    title: "",
    description: "",
    start: "",
    end: "",
    location: "",
    add_meet_link: false,
  });

  const loadStatus = () => {
    setLoading(true);
    api<Status>("/calendar/status")
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false, google_email: null }))
      .finally(() => setLoading(false));
    api<Engineer[]>("/calendar/engineers").then(setEngineers).catch(() => setEngineers([]));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setBanner({ type: "ok", msg: "Google Calendar connected successfully." });
      window.history.replaceState(null, "", "/calendar");
    } else if (params.get("error")) {
      setBanner({ type: "err", msg: `Connection failed: ${params.get("error")}` });
      window.history.replaceState(null, "", "/calendar");
    }
    loadStatus();
  }, []);

  const connect = async () => {
    try {
      const { url } = await api<{ url: string }>("/calendar/auth-url");
      window.location.href = url;
    } catch (err) {
      setBanner({ type: "err", msg: err instanceof Error ? err.message : "Could not start Google authorization" });
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect your Google Calendar?")) return;
    await api("/calendar/disconnect", { method: "DELETE" });
    loadStatus();
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setBanner(null);
    setResult(null);
    try {
      const res = await api<InviteResult>("/calendar/invite", {
        method: "POST",
        body: JSON.stringify({
          engineer_id: form.engineer_id ? Number(form.engineer_id) : null,
          title: form.title,
          description: form.description || null,
          start: form.start,
          end: form.end,
          timezone: tz,
          location: form.location || null,
          add_meet_link: form.add_meet_link,
        }),
      });
      setResult(res);
      setBanner({ type: "ok", msg: `Invite sent to ${res.attendee_email}. It has been emailed and added to their Google Calendar.` });
      setForm({ ...form, title: "", description: "", start: "", end: "", location: "", add_meet_link: false });
    } catch (err) {
      setBanner({ type: "err", msg: err instanceof Error ? err.message : "Failed to send invite" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Connect Google Calendar and send interview invites to engineers" />

      {banner && (
        <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ${banner.type === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
          {banner.type === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{banner.msg}</span>
        </div>
      )}

      {status && !status.configured && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-slate-900">Google Calendar isn&apos;t configured on the server</p>
              <p className="mt-1 text-sm text-slate-500">An administrator needs to set <code className="rounded bg-slate-100 px-1">GOOGLE_CLIENT_ID</code> and <code className="rounded bg-slate-100 px-1">GOOGLE_CLIENT_SECRET</code> in the backend environment.</p>
            </div>
          </div>
        </Card>
      )}

      {status?.configured && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${status.connected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{status.connected ? "Connected" : "Not connected"}</p>
                <p className="text-sm text-slate-500">{status.connected ? status.google_email : "Connect your Google account to send invites"}</p>
              </div>
            </div>
            {status.connected ? (
              <Button variant="secondary" size="sm" onClick={disconnect}>Disconnect</Button>
            ) : (
              <Button size="sm" onClick={connect}><Link2 className="h-4 w-4" /> Connect Google Calendar</Button>
            )}
          </div>
        </Card>
      )}

      {status?.connected && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900">Send an invite</h3>
          <p className="mb-4 text-sm text-slate-500">Times use your timezone ({tz}). The engineer receives an email and the event is added to their calendar automatically.</p>
          <form onSubmit={sendInvite} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Engineer">
                <Select value={form.engineer_id} onChange={(e) => setForm({ ...form, engineer_id: e.target.value })} required>
                  <option value="">Select engineer…</option>
                  {engineers.map((eng) => <option key={eng.id} value={eng.id}>{eng.full_name}{eng.devsinc_id ? ` (${eng.devsinc_id})` : ""}</option>)}
                </Select>
              </FormField>
              <FormField label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Interview prep call" required />
              </FormField>
              <FormField label="Start">
                <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required />
              </FormField>
              <FormField label="End">
                <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required />
              </FormField>
              <FormField label="Location (optional)">
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Office / Zoom / —" />
              </FormField>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.add_meet_link} onChange={(e) => setForm({ ...form, add_meet_link: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                  Add Google Meet link
                </label>
              </div>
            </div>
            <FormField label="Description (optional)">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Agenda, notes, joining details…" />
            </FormField>
            <Button type="submit" disabled={sending}>{sending ? <><Spinner className="h-4 w-4" /> Sending…</> : "Send Invite"}</Button>
          </form>

          {result && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{result.title}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {result.html_link && <a href={result.html_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">View event <ExternalLink className="h-3 w-3" /></a>}
                {result.hangout_link && <a href={result.hangout_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">Google Meet <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
