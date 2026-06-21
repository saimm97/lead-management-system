"use client";

import { ReactNode } from "react";
import { Button } from "./ui";
import { Pencil, X } from "lucide-react";

export function BulkActionBar({
  count,
  onUpdate,
  onClear,
  children,
}: {
  count: number;
  onUpdate: () => void;
  onClear: () => void;
  children?: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
      <p className="text-sm font-medium text-brand-800">
        {count} record{count !== 1 ? "s" : ""} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button size="sm" onClick={onUpdate}><Pencil className="h-4 w-4" /> Bulk Update</Button>
        <Button size="sm" variant="ghost" onClick={onClear}><X className="h-4 w-4" /> Clear</Button>
      </div>
    </div>
  );
}
