"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState, FormField, Input, Select, Spinner } from "@/components/ui";

type PipelineJob = {
  id: number;
  company: string;
  title: string;
  source: string;
  url: string;
  posted_at: string;
  expires_at: string | null;
  technologies: string[];
  excerpt: string;
  status: string;
  lead_id: number | null;
  score: number | null;
};

type JobPage = {
  items: PipelineJob[];
  total: number;
  page: number;
  page_size: number;
};

type AcceptResult = {
  job_id: number;
  lead_id: number;
  created: boolean;
};

type Filters = {
  q: string;
  source: string;
  tech: string;
  country: string;
  postedWithin: string;
  includeExpired: boolean;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  source: "",
  tech: "",
  country: "",
  postedWithin: "30",
  includeExpired: false,
};

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const text = `${parsed.host}${path}${parsed.search}`;
    return text.length > 36 ? `${text.slice(0, 33)}…` : text;
  } catch {
    return url.length > 36 ? `${url.slice(0, 33)}…` : url;
  }
}

function showDate(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function statusVariant(status: string): "blue" | "green" | "default" {
  if (status === "accepted") return "green";
  if (status === "new") return "blue";
  return "default";
}

function queryString(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.source.trim()) params.set("source", filters.source.trim());
  if (filters.tech.trim()) params.set("tech", filters.tech.trim());
  if (filters.country) params.set("country", filters.country);
  if (filters.postedWithin) params.set("posted_within_days", filters.postedWithin);
  if (filters.includeExpired) params.set("include_expired", "true");
  params.set("page", String(page));
  params.set("page_size", "20");
  return `/ai-pipeline/jobs?${params.toString()}`;
}

export default function AiPipelinePage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<JobPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [expandedUrlId, setExpandedUrlId] = useState<number | null>(null);
  const [countries, setCountries] = useState<string[]>(["Worldwide"]);

  const load = useCallback((filters: Filters, nextPage: number) => {
    setLoading(true);
    setError("");
    api<JobPage>(queryString(filters, nextPage))
      .then((data) => {
        setResult(data);
        setApplied(filters);
        setPage(nextPage);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load jobs");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(EMPTY_FILTERS, 1);
    api<{ countries: string[] }>("/ai-pipeline/countries")
      .then((data) => setCountries(data.countries))
      .catch(() => setCountries(["Worldwide"]));
  }, [load]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    load(draft, 1);
  };

  const accept = async (job: PipelineJob) => {
    setAcceptingId(job.id);
    setError("");
    try {
      const accepted = await api<AcceptResult>(`/ai-pipeline/jobs/${job.id}/accept`, { method: "POST" });
      setResult((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === job.id ? { ...item, status: "accepted", lead_id: accepted.lead_id } : item
              ),
            }
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this job");
    } finally {
      setAcceptingId(null);
    }
  };

  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Pipeline"
        description="Jobs are loaded on a daily schedule. Filter the store, then accept a match into Leads. With an embedding model configured, the search box ranks by meaning; otherwise the list stays newest first."
      />

      <Card>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7 xl:items-end">
          <FormField label="Search" className="xl:col-span-2">
            <Input
              value={draft.q}
              onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              placeholder="Python backend, Django, MERN"
            />
          </FormField>
          <FormField label="Source">
            <Input
              value={draft.source}
              onChange={(event) => setDraft({ ...draft, source: event.target.value })}
              placeholder="LinkedIn"
            />
          </FormField>
          <FormField label="Tech">
            <Input
              value={draft.tech}
              onChange={(event) => setDraft({ ...draft, tech: event.target.value })}
              placeholder="Django"
            />
          </FormField>
          <FormField label="Country">
            <Select value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })}>
              <option value="">All locations</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Posted within">
            <Select
              value={draft.postedWithin}
              onChange={(event) => setDraft({ ...draft, postedWithin: event.target.value })}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="">Any time</option>
            </Select>
          </FormField>
          <div className="flex items-center gap-3 xl:justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner className="h-4 w-4" /> : "Apply filters"}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2 xl:col-span-7">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={draft.includeExpired}
              onChange={(event) => setDraft({ ...draft, includeExpired: event.target.checked })}
            />
            Include expired jobs
          </label>
        </form>
      </Card>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

      {loading && !result ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !result ? null : result.items.length === 0 ? (
        <EmptyState title="No jobs match these filters" description="Widen the dates or clear a filter, then apply again." />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[34%] px-4 py-3 font-medium">Job</th>
                  <th className="w-[24%] px-4 py-3 font-medium">Source URL</th>
                  <th className="w-28 px-4 py-3 font-medium">Source</th>
                  <th className="w-[7.5rem] px-4 py-3 font-medium">Posted</th>
                  <th className="w-[7.5rem] px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Tech</th>
                  <th className="w-16 px-4 py-3 font-medium">Match</th>
                  <th className="w-20 px-4 py-3 font-medium">Status</th>
                  <th className="w-24 px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {result?.items.map((job) => {
                  const urlOpen = expandedUrlId === job.id;
                  return (
                  <tr key={job.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/ai-pipeline/${job.id}`} title={job.title} className="block truncate whitespace-nowrap font-medium text-slate-900 hover:text-brand-700">
                        {job.title}
                      </Link>
                      <div className="truncate text-xs text-slate-500">{job.company}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          title={job.url}
                          className={urlOpen ? "min-w-0 flex-1 break-all text-brand-700 hover:text-brand-800" : "min-w-0 flex-1 truncate whitespace-nowrap text-brand-700 hover:text-brand-800"}
                        >
                          {urlOpen ? job.url : shortUrl(job.url)}
                        </a>
                        <button
                          type="button"
                          aria-expanded={urlOpen}
                          aria-label={urlOpen ? "Hide full source URL" : "Show full source URL"}
                          className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => setExpandedUrlId(urlOpen ? null : job.id)}
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition ${urlOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{job.source}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{showDate(job.posted_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{showDate(job.expires_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {job.technologies.slice(0, 3).map((tech) => (
                          <Badge key={tech}>{tech}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{job.score === null ? "—" : job.score.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={job.status !== "new" || acceptingId === job.id}
                        onClick={() => accept(job)}
                      >
                        {job.status === "accepted" ? "Accepted" : acceptingId === job.id ? "Saving…" : "Accept"}
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              {total} job{total === 1 ? "" : "s"}
              {applied.q.trim() ? " · ranked for the search phrase" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(applied, page - 1)}>
                Previous
              </Button>
              <span>
                {page} / {pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= pageCount || loading}
                onClick={() => load(applied, page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
