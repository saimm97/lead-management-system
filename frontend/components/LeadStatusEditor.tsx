"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CreatableSelect } from "./CreatableSelect";
import { Button, FormField, Textarea } from "./ui";

export interface StatusConfigRow {
  id: number;
  phase: string;
  type: string;
  status: string;
  sort_order: number;
}

export interface LeadStatusFormData {
  phase: string;
  type: string;
  status: string;
  interview_number: string;
  interview_round: string;
  note: string;
}

export function LeadStatusEditor({
  initial,
  onSubmit,
  onChange,
  submitLabel = "Update Status",
  showNote = true,
  hideSubmit = false,
}: {
  initial: Partial<LeadStatusFormData>;
  onSubmit?: (data: LeadStatusFormData) => Promise<void>;
  onChange?: (data: LeadStatusFormData) => void;
  submitLabel?: string;
  showNote?: boolean;
  hideSubmit?: boolean;
}) {
  const [form, setForm] = useState<LeadStatusFormData>({
    phase: initial.phase || "Applied",
    type: initial.type || "JD Sent",
    status: initial.status || "JD Invite Pending",
    interview_number: initial.interview_number || "",
    interview_round: initial.interview_round || "",
    note: initial.note || "",
  });
  const [config, setConfig] = useState<StatusConfigRow[]>([]);
  const [interviewNumbers, setInterviewNumbers] = useState<string[]>([]);
  const [interviewRounds, setInterviewRounds] = useState<string[]>([]);
  const [phaseOptions, setPhaseOptions] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    const [cfg, nums, rounds, phs, tps] = await Promise.all([
      api<StatusConfigRow[]>("/leads/status-config"),
      api<{ label: string }[]>("/leads/dropdown-options?category=interview_number"),
      api<{ label: string }[]>("/leads/dropdown-options?category=interview_round"),
      api<{ label: string }[]>("/leads/dropdown-options?category=lead_phase").catch(() => []),
      api<{ label: string }[]>("/leads/dropdown-options?category=lead_type").catch(() => []),
    ]);
    setConfig(cfg);
    setInterviewNumbers(nums.map((n) => n.label));
    setInterviewRounds(rounds.map((r) => r.label));
    setPhaseOptions(phs.map((p) => p.label));
    setTypeOptions(tps.map((t) => t.label));
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const phases = useMemo(
    () => [...new Set([...config.map((c) => c.phase), ...phaseOptions])],
    [config, phaseOptions]
  );
  const types = useMemo(
    () => [...new Set([...config.filter((c) => c.phase === form.phase).map((c) => c.type), ...typeOptions])],
    [config, form.phase, typeOptions]
  );
  const statuses = useMemo(
    () => config.filter((c) => c.phase === form.phase && c.type === form.type).map((c) => c.status),
    [config, form.phase, form.type]
  );

  const updateForm = (next: LeadStatusFormData) => {
    setForm(next);
    onChange?.(next);
  };

  const setPhase = (phase: string) => {
    const nextTypes = [...new Set(config.filter((c) => c.phase === phase).map((c) => c.type))];
    const nextType = nextTypes[0] || "";
    const nextStatuses = config.filter((c) => c.phase === phase && c.type === nextType).map((c) => c.status);
    updateForm({ ...form, phase, type: nextType, status: nextStatuses[0] || "" });
  };

  const setType = (type: string) => {
    const nextStatuses = config.filter((c) => c.phase === form.phase && c.type === type).map((c) => c.status);
    updateForm({ ...form, type, status: nextStatuses[0] || "" });
  };

  const createStatus = async (status: string) => {
    await api("/leads/status-config", {
      method: "POST",
      body: JSON.stringify({ phase: form.phase, type: form.type, status, sort_order: config.length + 1 }),
    });
    await loadOptions();
  };

  const createPhase = async (label: string) => {
    await api("/leads/dropdown-options", { method: "POST", body: JSON.stringify({ category: "lead_phase", label }) });
    setPhaseOptions((prev) => [...prev, label]);
    setPhase(label);
  };

  const createType = async (label: string) => {
    await api("/leads/dropdown-options", { method: "POST", body: JSON.stringify({ category: "lead_type", label }) });
    setTypeOptions((prev) => [...prev, label]);
    setType(label);
  };

  const createInterviewNumber = async (label: string) => {
    await api("/leads/dropdown-options", { method: "POST", body: JSON.stringify({ category: "interview_number", label }) });
    setInterviewNumbers((prev) => [...prev, label]);
  };

  const createInterviewRound = async (label: string) => {
    await api("/leads/dropdown-options", { method: "POST", body: JSON.stringify({ category: "interview_round", label }) });
    setInterviewRounds((prev) => [...prev, label]);
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Phase">
          <CreatableSelect
            value={form.phase}
            onChange={setPhase}
            options={phases}
            onCreate={createPhase}
            placeholder="Select phase…"
          />
        </FormField>
        <FormField label="Type">
          <CreatableSelect
            value={form.type}
            onChange={setType}
            options={types}
            onCreate={createType}
            placeholder="Select type…"
          />
        </FormField>
        <FormField label="Status">
          <CreatableSelect
            value={form.status}
            onChange={(status) => updateForm({ ...form, status })}
            options={statuses}
            onCreate={createStatus}
            placeholder="Select status…"
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Interview Number">
          <CreatableSelect
            value={form.interview_number}
            onChange={(interview_number) => updateForm({ ...form, interview_number })}
            options={interviewNumbers}
            onCreate={createInterviewNumber}
            placeholder="e.g. 1st, 2nd, 3rd…"
          />
        </FormField>
        <FormField label="Interview Round">
          <CreatableSelect
            value={form.interview_round}
            onChange={(interview_round) => updateForm({ ...form, interview_round })}
            options={interviewRounds}
            onCreate={createInterviewRound}
            placeholder="e.g. HR Round, Technical Round…"
          />
        </FormField>
      </div>
      {showNote && (
        <FormField label="Note (optional)">
          <Textarea
            placeholder="Add context for this status change…"
            value={form.note}
            onChange={(e) => updateForm({ ...form, note: e.target.value })}
          />
        </FormField>
      )}
      {!hideSubmit && onSubmit && (
        <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : submitLabel}</Button>
      )}
    </div>
  );
}
