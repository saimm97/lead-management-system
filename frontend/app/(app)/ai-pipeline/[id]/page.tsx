"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Calendar, ChevronDown, ExternalLink, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { EngineerSuggestion, JobTechMatch, TechShare } from "@/components/JobTechMatch";
import { Badge, Button, Card, Spinner } from "@/components/ui";

type JobDetail = {
  id: number;
  company: string;
  title: string;
  source: string;
  url: string;
  posted_at: string;
  expires_at: string | null;
  location: string;
  countries: string[];
  status: string;
  lead_id: number | null;
  tech_stack: TechShare[];
  suggested_engineers: EngineerSuggestion[];
};

function showDate(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const text = `${parsed.host}${path}${parsed.search}`;
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  } catch {
    return url.length > 72 ? `${url.slice(0, 69)}…` : url;
  }
}

function statusVariant(status: string): "blue" | "green" | "default" {
  if (status === "accepted") return "green";
  if (status === "new") return "blue";
  return "default";
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-card">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={value}>{value}</p>
    </div>
  );
}

export default function AiPipelineJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<JobDetail>(`/ai-pipeline/jobs/${id}`)
      .then(setJob)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load this job"))
      .finally(() => setLoading(false));
  }, [id]);

  const accept = async () => {
    if (!job) return;
    setAccepting(true);
    setError("");
    try {
      const accepted = await api<{ lead_id: number }>(`/ai-pipeline/jobs/${job.id}/accept`, { method: "POST" });
      router.push(`/leads/${accepted.lead_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this job");
      setAccepting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
  if (!job) return <p className="text-red-600">{error || "Job not found."}</p>;

  const places = job.countries.length > 0 ? job.countries.join(", ") : job.location || "Not listed";

  return (
    <div className="space-y-6">
      <Link href="/ai-pipeline" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to AI Pipeline
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            <Badge>{job.source}</Badge>
            {job.countries.map((country) => (
              <Badge key={country} variant="indigo">{country}</Badge>
            ))}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{job.company}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}
          >
            Open posting <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {job.lead_id ? (
            <Button size="sm" onClick={() => router.push(`/leads/${job.lead_id}`)}>Open lead</Button>
          ) : (
            <Button size="sm" disabled={job.status !== "new" || accepting} onClick={accept}>
              {accepting ? "Saving…" : "Accept into Leads"}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={job.company} />
        <Fact icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={places} />
        <Fact icon={<Calendar className="h-3.5 w-3.5" />} label="Posted" value={showDate(job.posted_at)} />
        <Fact icon={<Calendar className="h-3.5 w-3.5" />} label="Expires" value={showDate(job.expires_at)} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Source URL</p>
          <button
            type="button"
            aria-expanded={urlOpen}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            onClick={() => setUrlOpen((open) => !open)}
          >
            {urlOpen ? "Hide" : "Show full URL"}
            <ChevronDown className={`h-3.5 w-3.5 transition ${urlOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          title={job.url}
          className={urlOpen ? "mt-2 block break-all text-sm font-medium text-brand-700 hover:text-brand-800" : "mt-2 block truncate text-sm font-medium text-brand-700 hover:text-brand-800"}
        >
          {urlOpen ? job.url : shortUrl(job.url)}
        </a>
      </Card>

      <JobTechMatch techStack={job.tech_stack} engineers={job.suggested_engineers} />
    </div>
  );
}
