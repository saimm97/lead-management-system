export type SortDirection = "asc" | "desc";

/** Minimum column widths for readable, non-cramped tables */
export const COL_MIN = {
  id: "min-w-[4.5rem]",
  date: "min-w-[7.5rem]",
  sm: "min-w-[8rem]",
  md: "min-w-[10rem]",
  lg: "min-w-[12rem]",
  xl: "min-w-[14rem]",
  xxl: "min-w-[18rem]",
  actions: "min-w-[5.5rem]",
} as const;

export type SortState = {
  columnId: string;
  direction: SortDirection;
};

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortRows<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  direction: SortDirection
): T[] {
  const sorted = [...rows].sort((a, b) => compareValues(getValue(a), getValue(b)));
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function loadTablePrefs(storageKey: string): { columnOrder?: string[]; sort?: SortState } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`table-prefs:${storageKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTablePrefs(storageKey: string, prefs: { columnOrder: string[]; sort: SortState }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`table-prefs:${storageKey}`, JSON.stringify(prefs));
}
