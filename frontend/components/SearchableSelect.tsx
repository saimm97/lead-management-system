"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "./ui";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string | null;
}

/**
 * Accessible combobox: shows a button with the selected label; opening reveals a
 * search box that filters options as you type. Good for long lists (e.g. engineers).
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  clearable = true,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Match every whitespace-separated token against label+hint for accurate filtering.
    const tokens = q.split(/\s+/);
    return options.filter((o) => {
      const hay = `${o.label} ${o.hint || ""}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [options, query]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span className={cn("truncate", selected ? "text-slate-900" : "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && selected && (
            <X
              className="h-4 w-4 shrink-0 text-slate-300 hover:text-slate-500"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
            />
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No matches</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50",
                    o.value === value && "bg-brand-50"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-slate-400">{o.hint}</span>}
                  </span>
                  {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
