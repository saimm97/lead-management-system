"use client";

import { useEffect, useState } from "react";
import { api, apiForm } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, Spinner, Badge, Textarea, FormField } from "@/components/ui";
import { FileText, Upload, AlertCircle, Copy, Check, Sparkles } from "lucide-react";

interface CvResult {
  ats_score: number | null;
  summary: string;
  matched_keywords: string[];
  missing_keywords: string[];
  issues: string[];
  strengths: string[];
  recommendations: string[];
  optimized_cv: string;
}

function FileDrop({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
      <Upload className="mb-2 h-6 w-6 text-slate-400" />
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 text-xs text-slate-400">{file ? file.name : "PDF, DOCX or TXT · click to upload"}</span>
      <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
    </label>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center">
      <div className={`text-5xl font-bold ${color}`}>{score}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400">ATS Score</div>
    </div>
  );
}

export default function CvPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CvResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ configured: boolean; model: string }>("/cv/status")
      .then((s) => { setConfigured(s.configured); setModel(s.model); })
      .catch(() => setConfigured(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || !cv) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("jd_text", jd);
      form.append("cv_file", cv);
      setResult(await apiForm<CvResult>("/cv/analyze", form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const copyCv = () => {
    if (!result?.optimized_cv) return;
    navigator.clipboard.writeText(result.optimized_cv);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="CV Optimizer" description="Match a CV against a job description and get an ATS-optimized rewrite" />

      {configured === false && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-slate-900">CV analysis isn&apos;t configured</p>
              <p className="mt-1 text-sm text-slate-500">An administrator needs to set <code className="rounded bg-slate-100 px-1">LLM_API_KEY</code> (GLM) in the backend environment.</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FormField label="Job Description">
              <Textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={10} placeholder="Paste the job description here…" />
            </FormField>
            <FormField label="Candidate CV">
              <FileDrop label="Candidate CV" file={cv} onPick={setCv} />
            </FormField>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!jd.trim() || !cv || loading || configured === false}>
              {loading ? <><Spinner className="h-4 w-4" /> Analyzing…</> : <><Sparkles className="h-4 w-4" /> Analyze &amp; Optimize</>}
            </Button>
            {model && <span className="text-xs text-slate-400">Model: {model}</span>}
          </div>
        </form>
      </Card>

      {result && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {typeof result.ats_score === "number" && <div className="sm:w-32"><ScoreRing score={result.ats_score} /></div>}
              <p className="flex-1 text-sm text-slate-600">{result.summary}</p>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {result.missing_keywords?.length > 0 && (
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Missing Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.missing_keywords.map((k, i) => <Badge key={i} variant="red">{k}</Badge>)}
                </div>
              </Card>
            )}
            {result.matched_keywords?.length > 0 && (
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Matched Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.matched_keywords.map((k, i) => <Badge key={i} variant="green">{k}</Badge>)}
                </div>
              </Card>
            )}
            {result.issues?.length > 0 && (
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Issues to Fix</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">{result.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </Card>
            )}
            {result.strengths?.length > 0 && (
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Strengths</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">{result.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </Card>
            )}
          </div>

          {result.recommendations?.length > 0 && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Recommendations</h3>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">{result.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </Card>
          )}

          {result.optimized_cv && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4" /> ATS-Optimized CV</h3>
                <Button variant="secondary" size="sm" onClick={copyCv}>{copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}</Button>
              </div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-800">{result.optimized_cv}</pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
