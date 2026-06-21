"use client";

import { useCallback, useMemo, useState } from "react";

export function useBulkSelect<T extends { id: number }>(items: T[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map((i) => i.id));
    });
  }, [items]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const ids = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    ids,
    count: selected.size,
    toggle,
    toggleAll,
    clear,
    allSelected: items.length > 0 && selected.size === items.length,
  };
}
