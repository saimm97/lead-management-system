"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadTablePrefs, saveTablePrefs, sortRows, SortDirection, SortState } from "@/lib/tableUtils";

export type TableColumn<T> = {
  id: string;
  label: string;
  sortable?: boolean;
  getSortValue?: (row: T) => unknown;
  className?: string;
  headerClassName?: string;
  minWidth?: string;
  render: (row: T) => ReactNode;
};

export function useTableView<T>(
  storageKey: string,
  columns: TableColumn<T>[],
  defaultSort: SortState = { columnId: "id", direction: "asc" }
) {
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const [columnOrder, setColumnOrder] = useState<string[]>(columnIds);
  const [sort, setSortState] = useState<SortState>(defaultSort);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prefs = loadTablePrefs(storageKey);
    if (prefs?.columnOrder?.length) {
      const valid = prefs.columnOrder.filter((id) => columnIds.includes(id));
      const missing = columnIds.filter((id) => !valid.includes(id));
      setColumnOrder([...valid, ...missing]);
    } else {
      setColumnOrder(columnIds);
    }
    if (prefs?.sort && columnIds.includes(prefs.sort.columnId)) {
      setSortState(prefs.sort);
    }
    setReady(true);
  }, [storageKey, columnIds.join("|")]);

  useEffect(() => {
    if (!ready) return;
    saveTablePrefs(storageKey, { columnOrder, sort });
  }, [storageKey, columnOrder, sort, ready]);

  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.id, c]));
    return columnOrder.map((id) => map.get(id)).filter(Boolean) as TableColumn<T>[];
  }, [columns, columnOrder]);

  const setSort = useCallback((columnId: string, direction?: SortDirection) => {
    setSortState((prev) => {
      if (prev.columnId === columnId && !direction) {
        return { columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { columnId, direction: direction ?? "asc" };
    });
  }, []);

  const moveColumn = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setColumnOrder((order) => {
      const next = [...order];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return order;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setColumnOrder(columnIds);
    setSortState(defaultSort);
  }, [columnIds, defaultSort]);

  const sortData = useCallback(
    (rows: T[]) => {
      const col = columns.find((c) => c.id === sort.columnId);
      if (!col?.getSortValue) return rows;
      return sortRows(rows, col.getSortValue, sort.direction);
    },
    [columns, sort]
  );

  return { orderedColumns, sort, setSort, moveColumn, resetColumns, sortData, ready };
}
