"use client";

import { ReactNode, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, RotateCcw } from "lucide-react";
import { DataTable, Button, cn } from "./ui";
import { TableColumn, useTableView } from "@/hooks/useTableView";
import { SortDirection } from "@/lib/tableUtils";

export function SortableTable<T extends { id: number }>({
  storageKey,
  columns,
  data,
  emptyMessage = "No records found.",
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  rowClassName,
  serverSort = false,
  sort: controlledSort,
  onSortChange,
  defaultSort,
}: {
  storageKey: string;
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  rowClassName?: (row: T) => string | undefined;
  serverSort?: boolean;
  sort?: { columnId: string; direction: SortDirection };
  onSortChange?: (columnId: string, direction: SortDirection) => void;
  defaultSort?: { columnId: string; direction: SortDirection };
}) {
  const { orderedColumns, sort: localSort, setSort, moveColumn, resetColumns, sortData, ready } = useTableView(
    storageKey,
    columns,
    defaultSort ?? { columnId: "id", direction: "asc" }
  );

  const sort = serverSort && controlledSort ? controlledSort : localSort;
  const [dragCol, setDragCol] = useState<string | null>(null);

  const handleSort = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.sortable) return;
    const nextDir: SortDirection =
      sort.columnId === columnId ? (sort.direction === "asc" ? "desc" : "asc") : "asc";
    if (serverSort && onSortChange) {
      onSortChange(columnId, nextDir);
    } else {
      setSort(columnId, nextDir);
    }
  };

  const handleSortSelect = (value: string) => {
    const [columnId, direction] = value.split(":") as [string, SortDirection];
    if (serverSort && onSortChange) {
      onSortChange(columnId, direction);
    } else {
      setSort(columnId, direction);
    }
  };

  const displayData = serverSort ? data : sortData(data);
  const sortableColumns = columns.filter((c) => c.sortable !== false && c.getSortValue);

  if (!ready) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
        Loading table…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1 shadow-sm">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <select
            value={`${sort.columnId}:${sort.direction}`}
            onChange={(e) => handleSortSelect(e.target.value)}
            className="cursor-pointer border-0 bg-transparent py-0.5 pl-0 pr-6 text-xs font-medium text-slate-600 focus:outline-none focus:ring-0"
          >
            {sortableColumns.flatMap((col) => [
              <option key={`${col.id}-asc`} value={`${col.id}:asc`}>{col.label} ↑</option>,
              <option key={`${col.id}-desc`} value={`${col.id}:desc`}>{col.label} ↓</option>,
            ])}
          </select>
        </div>
        <Button variant="ghost" size="sm" onClick={resetColumns} className="h-7 px-2 text-xs text-slate-400 hover:text-slate-600" title="Reset column order & sort">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
        <span className="ml-auto hidden items-center text-xs text-slate-300 sm:inline-flex">Drag headers to reorder</span>
      </div>

      <DataTable>
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr>
            {selectable && (
              <th className="w-10">
                <input type="checkbox" checked={!!allSelected} onChange={onToggleAll} className="rounded border-slate-300" />
              </th>
            )}
            {orderedColumns.map((col) => (
              <th
                key={col.id}
                draggable
                onDragStart={() => setDragCol(col.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragCol) moveColumn(dragCol, col.id);
                  setDragCol(null);
                }}
                onDragEnd={() => setDragCol(null)}
                className={cn(
                  "select-none whitespace-nowrap",
                  col.minWidth,
                  col.headerClassName,
                  col.sortable !== false && "cursor-pointer hover:bg-slate-100/80",
                  dragCol === col.id && "opacity-50"
                )}
                onClick={() => col.sortable !== false && handleSort(col.id)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-400" />
                  {col.label}
                  {col.sortable !== false && (
                    sort.columnId === col.id ? (
                      sort.direction === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-brand-600" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-brand-600" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row) => (
            <tr key={row.id} className={rowClassName?.(row)}>
              {selectable && (
                <td>
                  <input
                    type="checkbox"
                    checked={!!selected?.has(row.id)}
                    onChange={() => onToggle?.(row.id)}
                    className="rounded border-slate-300"
                  />
                </td>
              )}
              {orderedColumns.map((col) => (
                <td key={col.id} className={cn(col.minWidth, col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export type { TableColumn };
