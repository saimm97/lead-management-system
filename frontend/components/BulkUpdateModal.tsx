"use client";

import { useState } from "react";
import { Modal, FormField, Input, Select, Button } from "./ui";

export type BulkField = {
  key: string;
  label: string;
  type: "text" | "select" | "number";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export function BulkUpdateModal({
  open,
  title,
  count,
  fields,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  count: number;
  fields: BulkField[];
  onClose: () => void;
  onSubmit: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Record<string, unknown> = {};
    for (const field of fields) {
      if (!enabled[field.key] || values[field.key] === "" || values[field.key] === undefined) continue;
      updates[field.key] = field.type === "number" ? Number(values[field.key]) : values[field.key];
    }
    if (Object.keys(updates).length === 0) {
      setError("Enable at least one field to update");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(updates);
      setValues({});
      setEnabled({});
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <p className="mb-4 text-sm text-slate-500">Update {count} selected record{count !== 1 ? "s" : ""}. Check the fields you want to change.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-2.5 rounded border-slate-300"
              checked={!!enabled[field.key]}
              onChange={(e) => setEnabled({ ...enabled, [field.key]: e.target.checked })}
            />
            <div className="flex-1">
              <FormField label={field.label}>
                {field.type === "select" ? (
                  <Select
                    disabled={!enabled[field.key]}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : (
                  <Input
                    type={field.type === "number" ? "number" : "text"}
                    disabled={!enabled[field.key]}
                    placeholder={field.placeholder}
                    value={values[field.key] || ""}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                )}
              </FormField>
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? "Updating…" : "Apply to Selected"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
