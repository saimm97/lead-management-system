"use client";

import { useState } from "react";
import { Button, Input, Select } from "./ui";

export function CreatableSelect({
  value,
  onChange,
  options,
  onCreate,
  placeholder = "Select…",
  allowCreate = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onCreate?: (label: string) => Promise<void>;
  placeholder?: string;
  allowCreate?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "__create__") {
      setAdding(true);
      return;
    }
    onChange(e.target.value);
  };

  const submitNew = async () => {
    const label = newVal.trim();
    if (!label) return;
    if (onCreate) await onCreate(label);
    onChange(label);
    setNewVal("");
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="Enter new value…" autoFocus />
        <Button size="sm" type="button" onClick={submitNew}>Add</Button>
        <Button size="sm" type="button" variant="secondary" onClick={() => { setAdding(false); setNewVal(""); }}>Cancel</Button>
      </div>
    );
  }

  const allOptions = [...new Set([...options, ...(value ? [value] : [])])];

  return (
    <Select value={value} onChange={handleSelect}>
      <option value="">{placeholder}</option>
      {allOptions.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      {allowCreate && <option value="__create__">+ Add new…</option>}
    </Select>
  );
}
