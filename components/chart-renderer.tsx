"use client";

import { ChartConfig, FilterRule, FilterOperator } from "@/types/chart";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  Edit,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Link2,
  Sparkles,
} from "lucide-react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChartRendererProps {
  config: ChartConfig;
  data: Record<string, unknown>[];
  isLoading?: boolean;
  onEdit?: (config: ChartConfig) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (config: ChartConfig) => void;
  onUpdate?: (
    id: string,
    updates: Partial<ChartConfig>,
    skipHistory?: boolean,
  ) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  dragIndex?: number;
  index?: number;
  previewWidth?: number;
  isResizing?: boolean;
  availableFields?: string[]; // All fields from table for filter dropdown
  onFilterChange?: (id: string, filters: FilterRule[]) => void; // Callback when filters change
  onFetchAllData?: () => Promise<Record<string, unknown>[]>; // Function to fetch all data for export (no limit)
}

const formatNumber = (value: unknown): string => {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("en-US");
};

export function ChartRenderer({
  config,
  data,
  isLoading = false,
  onEdit,
  onDelete,
  onDuplicate,
  onUpdate,
  onDragStart,
  onDragEnd,
  isDragging = false,
  previewWidth,
  isResizing: externalIsResizing,
  availableFields = [],
  onFilterChange,
  onFetchAllData,
}: ChartRendererProps) {
  const isMobile = useIsMobile();
  const [filters, setFilters] = React.useState<FilterRule[]>(
    config.filters || [],
  );
  React.useEffect(() => {
    setFilters(config.filters || []);
  }, [config.filters]);

  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [localHeight, setLocalHeight] = React.useState(config.height || 500);
  const [localWidth, setLocalWidth] = React.useState<number | undefined>(
    config.width,
  );
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeStart, setResizeStart] = React.useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [toastOpen, setToastOpen] = React.useState(false);
  const [rowDetailDialogOpen, setRowDetailDialogOpen] = React.useState(false);
  const [selectedRowData, setSelectedRowData] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<AgGridReact>(null);

  // Handle copy link
  const handleCopyLink = React.useCallback(() => {
    const origin = window.location.origin;
    const publicChartUrl = `${origin}/public/chart/${config.id}`;
    navigator.clipboard
      .writeText(publicChartUrl)
      .then(() => {
        setToastOpen(true);
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
      });
  }, [config.id]);

  React.useEffect(() => {
    setLocalHeight(config.height || 500);
  }, [config.height]);

  React.useEffect(() => {
    setLocalWidth(config.width);
  }, [config.width]);

  React.useEffect(() => {
    if (previewWidth !== undefined) {
      setLocalWidth(previewWidth);
    }
  }, [previewWidth]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) return; // ไม่ให้ resize ใน mobile
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const containerElement = cardRef.current?.parentElement?.parentElement;
    const containerWidth =
      containerElement?.clientWidth || window.innerWidth - 100;
    const currentWidthPercent =
      localWidth !== undefined
        ? localWidth
        : (rect.width / containerWidth) * 100;
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: currentWidthPercent,
      height: localHeight,
    });
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const containerElement = cardRef.current?.parentElement?.parentElement;
      const containerWidth =
        containerElement?.clientWidth || window.innerWidth - 100;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidthPercent = Math.max(
        20,
        Math.min(100, resizeStart.width + deltaPercent),
      );
      const newHeight = Math.max(
        200,
        Math.min(2000, resizeStart.height + deltaY),
      );
      setLocalWidth(newWidthPercent);
      setLocalHeight(newHeight);
      // Preview width immediately during resize (skip history recording)
      if (onUpdate) {
        // Pass a flag to skip history recording during resize
        onUpdate(
          config.id,
          { width: newWidthPercent, height: newHeight },
          true,
        );
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (onUpdate) {
        const finalWidth = localWidth !== undefined ? localWidth : 100;
        // Save final size with history recording
        onUpdate(config.id, { width: finalWidth, height: localHeight }, false);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resizeStart, localWidth, localHeight, onUpdate, config.id]);

  // Use availableFields from table if provided, otherwise fallback to chart fields
  const allFields = React.useMemo(() => {
    if (availableFields && availableFields.length > 0) {
      return availableFields;
    }
    // Fallback: use fields from chart config or data
    const set = new Set<string>();
    for (const c of config.columns || []) set.add(c);
    if (config.xAxisKey) set.add(config.xAxisKey);
    if (config.yAxisKey) set.add(config.yAxisKey);
    if (config.groupByKey) set.add(config.groupByKey);
    if (config.seriesKey) set.add(config.seriesKey);
    // For SQL query charts, also include fields from data
    if (config.sqlQuery && data && data.length > 0) {
      const firstRow = data[0] as Record<string, unknown>;
      Object.keys(firstRow).forEach((key) => set.add(key));
    }
    return Array.from(set);
  }, [
    availableFields,
    config.columns,
    config.xAxisKey,
    config.yAxisKey,
    config.groupByKey,
    config.seriesKey,
    config.sqlQuery,
    data,
  ]);

  const projected = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((row) => {
      const filtered: Record<string, unknown> = {};
      const rowKeys = Object.keys(row as Record<string, unknown>);
      // selected columns - try to match by exact name or case-insensitive
      for (const col of config.columns) {
        const exactMatch = rowKeys.find((k) => k === col);
        const caseMatch = rowKeys.find(
          (k) => k.toLowerCase() === col.toLowerCase(),
        );
        const matchedKey = exactMatch || caseMatch;
        if (matchedKey) {
          filtered[col] = (row as Record<string, unknown>)[matchedKey];
        } else {
          filtered[col] = undefined;
        }
      }
      // include chart axes
      if (config.xAxisKey) {
        const exactMatch = rowKeys.find((k) => k === config.xAxisKey);
        const caseMatch = rowKeys.find(
          (k) => k.toLowerCase() === config.xAxisKey!.toLowerCase(),
        );
        const matchedKey = exactMatch || caseMatch;
        filtered[config.xAxisKey] = matchedKey
          ? (row as Record<string, unknown>)[matchedKey]
          : undefined;
      }
      if (config.yAxisKey) {
        const exactMatch = rowKeys.find((k) => k === config.yAxisKey);
        const caseMatch = rowKeys.find(
          (k) => k.toLowerCase() === config.yAxisKey!.toLowerCase(),
        );
        const matchedKey = exactMatch || caseMatch;
        filtered[config.yAxisKey] = matchedKey
          ? (row as Record<string, unknown>)[matchedKey]
          : undefined;
      }
      // include grouping/splitting fields
      if (config.groupByKey) {
        const exactMatch = rowKeys.find((k) => k === config.groupByKey);
        const caseMatch = rowKeys.find(
          (k) => k.toLowerCase() === config.groupByKey!.toLowerCase(),
        );
        const matchedKey = exactMatch || caseMatch;
        filtered[config.groupByKey] = matchedKey
          ? (row as Record<string, unknown>)[matchedKey]
          : undefined;
      }
      if (config.seriesKey) {
        const exactMatch = rowKeys.find((k) => k === config.seriesKey);
        const caseMatch = rowKeys.find(
          (k) => k.toLowerCase() === config.seriesKey!.toLowerCase(),
        );
        const matchedKey = exactMatch || caseMatch;
        filtered[config.seriesKey] = matchedKey
          ? (row as Record<string, unknown>)[matchedKey]
          : undefined;
      }
      // include fields used by filters so filters (e.g., today) work after refresh
      if (config.filters) {
        for (const fr of config.filters) {
          if (fr.field && filtered[fr.field] === undefined) {
            const exactMatch = rowKeys.find((k) => k === fr.field);
            const caseMatch = rowKeys.find(
              (k) => k.toLowerCase() === fr.field!.toLowerCase(),
            );
            const matchedKey = exactMatch || caseMatch;
            filtered[fr.field] = matchedKey
              ? (row as Record<string, unknown>)[matchedKey]
              : undefined;
          }
        }
      }
      return filtered;
    });
  }, [
    data,
    config.columns,
    config.xAxisKey,
    config.yAxisKey,
    config.groupByKey,
    config.seriesKey,
    config.filters,
  ]);

  const filteredData = React.useMemo(() => {
    // For table-based charts, filters are applied at query level
    // For SQL query charts, apply client-side filtering
    if (!config.sqlQuery) {
      return projected;
    }

    // Apply client-side filters for SQL query charts
    if (!filters || filters.length === 0) {
      return projected;
    }

    return projected.filter((row) => {
      return filters.every((filter) => {
        if (!filter.field || !filter.op) return true;

        const value = row[filter.field];
        const filterValue = filter.value;
        const filterValue2 = filter.value2;

        switch (filter.op) {
          case "equals":
            if (filterValue === undefined || filterValue === "") return true;
            return String(value) === String(filterValue);
          case "not_equals":
            if (filterValue === undefined || filterValue === "") return true;
            return String(value) !== String(filterValue);
          case "contains":
            if (filterValue === undefined || filterValue === "") return true;
            return String(value)
              .toLowerCase()
              .includes(String(filterValue).toLowerCase());
          case "not_contains":
            if (filterValue === undefined || filterValue === "") return true;
            return !String(value)
              .toLowerCase()
              .includes(String(filterValue).toLowerCase());
          case "begins_with":
            if (filterValue === undefined || filterValue === "") return true;
            return String(value)
              .toLowerCase()
              .startsWith(String(filterValue).toLowerCase());
          case "ends_with":
            if (filterValue === undefined || filterValue === "") return true;
            return String(value)
              .toLowerCase()
              .endsWith(String(filterValue).toLowerCase());
          case "gt":
            if (filterValue === undefined || filterValue === "") return true;
            return Number(value) > Number(filterValue);
          case "lt":
            if (filterValue === undefined || filterValue === "") return true;
            return Number(value) < Number(filterValue);
          case "blank":
            return value == null || value === "" || String(value).trim() === "";
          case "not_blank":
            return value != null && value !== "" && String(value).trim() !== "";
          case "today": {
            if (!value) return false;
            const rowDate =
              value instanceof Date ? value : new Date(String(value));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return rowDate >= today && rowDate < tomorrow;
          }
          case "before":
            if (filterValue === undefined || filterValue === "") return true;
            if (!value) return false;
            const beforeDate =
              String(filterValue).toLowerCase() === "today"
                ? new Date()
                : new Date(String(filterValue));
            const rowDateBefore =
              value instanceof Date ? value : new Date(String(value));
            return rowDateBefore < beforeDate;
          case "after":
            if (filterValue === undefined || filterValue === "") return true;
            if (!value) return false;
            const afterDate =
              String(filterValue).toLowerCase() === "today"
                ? new Date()
                : new Date(String(filterValue));
            const rowDateAfter =
              value instanceof Date ? value : new Date(String(value));
            return rowDateAfter > afterDate;
          case "between":
            if (
              filterValue === undefined ||
              filterValue === "" ||
              filterValue2 === undefined ||
              filterValue2 === ""
            ) {
              return true;
            }
            if (!value) return false;
            const startDate = new Date(String(filterValue));
            const endDate = new Date(String(filterValue2));
            endDate.setHours(23, 59, 59, 999);
            const rowDateBetween =
              value instanceof Date ? value : new Date(String(value));
            return rowDateBetween >= startDate && rowDateBetween <= endDate;
          case "last_days":
            if (filterValue === undefined || filterValue === "") return true;
            if (!value) return false;
            const days = Number(filterValue);
            if (Number.isNaN(days) || days <= 0) return true;
            const endDate2 = new Date();
            endDate2.setHours(23, 59, 59, 999);
            const startDate2 = new Date(endDate2);
            startDate2.setDate(startDate2.getDate() - days);
            startDate2.setHours(0, 0, 0, 0);
            const rowDate2 =
              value instanceof Date ? value : new Date(String(value));
            return rowDate2 >= startDate2 && rowDate2 <= endDate2;
          case "last_months":
            if (filterValue === undefined || filterValue === "") return true;
            if (!value) return false;
            const months = Number(filterValue);
            if (Number.isNaN(months) || months <= 0) return true;
            const endDate3 = new Date();
            endDate3.setHours(23, 59, 59, 999);
            const startDate3 = new Date(endDate3);
            startDate3.setMonth(startDate3.getMonth() - months);
            startDate3.setHours(0, 0, 0, 0);
            const rowDate3 =
              value instanceof Date ? value : new Date(String(value));
            return rowDate3 >= startDate3 && rowDate3 <= endDate3;
          case "last_week": {
            // Last week: Monday of last week to Sunday of last week
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            // Calculate Monday of last week
            const mondayLastWeek = new Date(today);
            // Go back to last Monday
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days from Monday (if Sunday, go back 6 days)
            mondayLastWeek.setDate(today.getDate() - daysFromMonday - 7); // Go back 7 days to get last week's Monday
            mondayLastWeek.setHours(0, 0, 0, 0);
            // Calculate Sunday of last week
            const sundayLastWeek = new Date(mondayLastWeek);
            sundayLastWeek.setDate(mondayLastWeek.getDate() + 6); // Sunday is 6 days after Monday
            sundayLastWeek.setHours(23, 59, 59, 999);
            if (!value) return false;
            const rowDateLastWeek =
              value instanceof Date ? value : new Date(String(value));
            return (
              rowDateLastWeek >= mondayLastWeek &&
              rowDateLastWeek <= sundayLastWeek
            );
          }
          case "this_week": {
            // This week: Monday of this week to Sunday of this week
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            // Calculate Monday of this week
            const mondayThisWeek = new Date(today);
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days from Monday (if Sunday, go back 6 days)
            mondayThisWeek.setDate(today.getDate() - daysFromMonday);
            mondayThisWeek.setHours(0, 0, 0, 0);
            // Calculate Sunday of this week
            const sundayThisWeek = new Date(mondayThisWeek);
            sundayThisWeek.setDate(mondayThisWeek.getDate() + 6); // Sunday is 6 days after Monday
            sundayThisWeek.setHours(23, 59, 59, 999);
            if (!value) return false;
            const rowDateThisWeek =
              value instanceof Date ? value : new Date(String(value));
            return (
              rowDateThisWeek >= mondayThisWeek &&
              rowDateThisWeek <= sundayThisWeek
            );
          }
          default:
            return true;
        }
      });
    });
  }, [projected, filters, config.sqlQuery]);

  const fieldTypes = React.useMemo(() => {
    const types: Record<string, "number" | "date" | "string"> = {};
    const sample = data.slice(0, 50);
    const fieldsToCheck = Array.from(
      new Set([
        ...config.columns,
        ...(config.xAxisKey ? [config.xAxisKey] : []),
        ...(config.yAxisKey ? [config.yAxisKey] : []),
        ...(config.groupByKey ? [config.groupByKey] : []),
        ...(config.seriesKey ? [config.seriesKey] : []),
      ]),
    );
    const isLikelyDate = (val: unknown) => {
      if (val instanceof Date) return !Number.isNaN(val.getTime());
      const s = String(val ?? "").trim();
      if (!s) return false;
      // Only accept common date formats to avoid false positives on strings
      const isoLike = /^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/; // 2025-11-03 or with time
      const dmyLike = /^\d{2}\/(\d{2})\/\d{4}$/; // 31/12/2025
      if (!(isoLike.test(s) || dmyLike.test(s))) return false;
      const t = Date.parse(s);
      return !Number.isNaN(t);
    };
    for (const field of fieldsToCheck) {
      let kind: "number" | "date" | "string" = "string";
      let numberCount = 0;
      let dateCount = 0;
      for (const row of sample) {
        const v = row[field];
        if (v == null) continue;
        if (typeof v === "number") {
          numberCount += 1;
          continue;
        }
        const asNum = Number(v);
        if (!Number.isNaN(asNum) && String(v).trim() !== "") {
          numberCount += 1;
          continue;
        }
        if (isLikelyDate(v)) {
          dateCount += 1;
          continue;
        }
      }
      if (numberCount > 0 && dateCount === 0) kind = "number";
      else if (dateCount >= 3 && numberCount === 0)
        kind = "date"; // need at least 3 date-like samples
      else kind = "string";
      types[field] = kind;
    }
    return types;
  }, [
    data,
    config.columns,
    config.xAxisKey,
    config.yAxisKey,
    config.groupByKey,
    config.seriesKey,
  ]);

  // Normalize filter operators when field type changes
  const filterFieldsKey = React.useMemo(
    () => filters.map((f) => f.field).join(","),
    [filters],
  );
  const fieldTypesKey = React.useMemo(
    () => Object.keys(fieldTypes).join(","),
    [fieldTypes],
  );
  React.useEffect(() => {
    let changed = false;
    const next = filters.map((f) => {
      if (!f.field) return f;
      const fType = fieldTypes[f.field] || "string";
      const dateOps = [
        "today",
        "this_week",
        "last_week",
        "before",
        "after",
        "between",
        "last_days",
        "last_months",
        "equals",
        "blank",
        "not_blank",
      ] as FilterOperator[];
      const numberOps = [
        "equals",
        "gt",
        "lt",
        "blank",
        "not_blank",
      ] as FilterOperator[];
      const stringOps = [
        "contains",
        "not_contains",
        "equals",
        "not_equals",
        "begins_with",
        "ends_with",
        "blank",
        "not_blank",
      ] as FilterOperator[];
      const typeOps =
        fType === "date" ? dateOps : fType === "number" ? numberOps : stringOps;

      // ถ้า operator เดิมเป็นของวันที่ (today/before/after/between/last_days/last_months) อย่าบังคับเปลี่ยนตอนที่ยังตรวจชนิดไม่ได้
      if (!typeOps.includes(f.op as FilterOperator)) {
        if (
          [
            "today",
            "before",
            "after",
            "between",
            "last_days",
            "last_months",
          ].includes(f.op as string)
        ) {
          return f; // คงค่าเดิมไว้
        }
        changed = true;
        return { ...f, op: typeOps[0] };
      }
      return f;
    });
    if (changed) {
      setFilters(next);
      onUpdate?.(config.id, { filters: next });
      onFilterChange?.(config.id, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFieldsKey, fieldTypesKey]);

  const defaultColDef: ColDef = {
    flex: 1,
    minWidth: 120,
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: true,
    wrapText: false,
    autoHeaderHeight: false,
  };

  const computedColDefs: ColDef[] = React.useMemo(() => {
    let base: ColDef[] = [];
    if (config.columnDefs && config.columnDefs.length > 0) {
      base = config.columnDefs;
    } else if (config.columns && config.columns.length > 0) {
      base = config.columns.map((col) => ({ field: col, flex: 1 }));
    } else if (filteredData && filteredData.length > 0) {
      const keys = Object.keys(filteredData[0] as Record<string, unknown>);
      base = keys.map((k) => ({ field: k, flex: 1 }));
    }
    return base.map((d) => {
      const field = (d.field as string) || "";
      const ft = fieldTypes[field];
      const baseDef: ColDef = {
        ...d,
        valueGetter: (params) => {
          if (!params.data) return undefined;
          const data = params.data as Record<string, unknown>;
          return data[field] ?? undefined;
        },
      };
      if (ft === "number") {
        return {
          ...baseDef,
          filter: "agNumberColumnFilter",
          valueGetter: (params) => {
            if (!params.data) return undefined;
            const data = params.data as Record<string, unknown>;
            const value = data[field];
            if (value == null || value === "") return null;
            // Convert to number for proper sorting
            const num = typeof value === "number" ? value : Number(value);
            return Number.isNaN(num) ? null : num;
          },
          valueFormatter: (p: { value: unknown }) => formatNumber(p.value),
          comparator: (valueA: unknown, valueB: unknown) => {
            // Handle null/undefined values
            if (valueA == null && valueB == null) return 0;
            if (valueA == null) return 1;
            if (valueB == null) return -1;
            // Convert to numbers for comparison
            const numA = typeof valueA === "number" ? valueA : Number(valueA);
            const numB = typeof valueB === "number" ? valueB : Number(valueB);
            if (Number.isNaN(numA) && Number.isNaN(numB)) return 0;
            if (Number.isNaN(numA)) return 1;
            if (Number.isNaN(numB)) return -1;
            return numA - numB;
          },
          minWidth: baseDef.minWidth || 150,
        } as ColDef;
      }
      if (ft === "date") {
        return {
          ...baseDef,
          filter: "agTextColumnFilter",
          valueFormatter: (p: { value: unknown }) => {
            if (p.value == null || p.value === "") return "";
            const time = Date.parse(String(p.value));
            if (Number.isNaN(time)) return String(p.value ?? "");
            const dt = new Date(time);
            const day = String(dt.getDate()).padStart(2, "0");
            const month = String(dt.getMonth() + 1).padStart(2, "0");
            const year = dt.getFullYear();
            return `${year}-${month}-${day}`;
          },
          minWidth: baseDef.minWidth || 180,
        } as ColDef;
      }
      return {
        ...baseDef,
        filter: "agTextColumnFilter",
        minWidth: baseDef.minWidth || 120,
      } as ColDef;
    });
  }, [config.columnDefs, config.columns, fieldTypes, filteredData]);

  // เตรียมข้อมูลสำหรับกราฟ (bar, line, pie) โดยใช้ข้อมูลหลังกรองแล้ว
  const getChartData = () => {
    if (!config.xAxisKey || !config.yAxisKey) return [];
    const isDateField = fieldTypes[config.xAxisKey!] === "date";

    // project and (if date) bucket by YYYY-MM-DD
    let chartData = filteredData.map((row) => {
      const xVal = (row as Record<string, unknown>)[config.xAxisKey!];
      let nameStr = String(xVal ?? "");
      if (isDateField && xVal) {
        const dateTime = Date.parse(String(xVal));
        if (!Number.isNaN(dateTime)) {
          const dt = new Date(dateTime);
          nameStr = dt.toISOString().slice(0, 10); // group by day
        }
      }
      return {
        name: nameStr,
        value: Number((row as Record<string, unknown>)[config.yAxisKey!]) || 0,
        _originalRow: row,
      };
    });

    const isAggregated = isDateField;
    if (isDateField) {
      // aggregate values by day to avoid duplicate x labels
      const byDay = new Map<string, number>();
      for (const d of chartData) {
        const cur = byDay.get(d.name) ?? 0;
        byDay.set(d.name, cur + d.value);
      }
      chartData = Array.from(byDay.entries()).map(([name, value]) => ({
        name,
        value,
        _originalRow: {} as Record<string, unknown>,
        _sortKey: name, // store the date string for sorting
      }));
    }

    // Sort ตาม config.sortBy และ sortOrder
    if (config.sortBy) {
      const order = config.sortOrder || "asc";
      const toTime = (val: unknown) => {
        if (val instanceof Date) return val.getTime();
        const parsed = Date.parse(String(val ?? ""));
        if (!Number.isNaN(parsed)) return parsed;
        if (typeof val === "number" && Number.isFinite(val)) return val;
        return NaN;
      };
      chartData.sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        // If aggregated and sorting by xAxisKey (date), use the name field
        if (
          isAggregated &&
          config.sortBy === config.xAxisKey &&
          fieldTypes[config.sortBy!] === "date"
        ) {
          aVal = a.name;
          bVal = b.name;
        } else if (isAggregated && config.sortBy === config.yAxisKey) {
          // If sorting by yAxisKey after aggregation, use value
          aVal = a.value;
          bVal = b.value;
        } else {
          // Otherwise try to get from _originalRow
          aVal = (a._originalRow as Record<string, unknown>)?.[config.sortBy!];
          bVal = (b._originalRow as Record<string, unknown>)?.[config.sortBy!];

          // Fallback: if _originalRow is empty and we have _sortKey, use it
          if (
            (aVal === undefined || aVal === null) &&
            (a as { _sortKey?: string })._sortKey
          ) {
            aVal = (a as { _sortKey?: string })._sortKey;
          }
          if (
            (bVal === undefined || bVal === null) &&
            (b as { _sortKey?: string })._sortKey
          ) {
            bVal = (b as { _sortKey?: string })._sortKey;
          }
        }

        const fieldType = fieldTypes[config.sortBy!];

        let cmp = 0;
        if (fieldType === "number" || config.sortBy === config.yAxisKey) {
          cmp = Number(aVal ?? 0) - Number(bVal ?? 0);
        } else if (
          fieldType === "date" ||
          (isAggregated && config.sortBy === config.xAxisKey)
        ) {
          const aTime = toTime(aVal);
          const bTime = toTime(bVal);
          cmp = Number.isNaN(aTime) || Number.isNaN(bTime) ? 0 : aTime - bTime;
        } else {
          cmp = String(aVal || "").localeCompare(String(bVal || ""));
        }
        return order === "desc" ? -cmp : cmp;
      });
    } else if (isDateField) {
      // default sort by date ascending if no custom sort specified
      chartData.sort((a, b) => Date.parse(a.name) - Date.parse(b.name));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return chartData.map(({ _originalRow, ...rest }) => rest);
  };

  // แปลงข้อมูลแบบกลุ่ม และหลายซีรีส์สำหรับ bar/line เมื่อมี seriesKey
  const getGroupedSeriesData = () => {
    if (!config.yAxisKey)
      return { data: [] as Record<string, unknown>[], series: [] as string[] };
    const groupKey = config.groupByKey || config.xAxisKey;
    const seriesKey = config.seriesKey;
    if (!groupKey || !seriesKey)
      return { data: getChartData(), series: ["value"] };

    const isGroupDate = fieldTypes[groupKey] === "date";

    // group -> series -> aggregate value
    const acc = new Map<string, Map<string, { sum: number; count: number }>>();
    for (const row of filteredData) {
      let g = String((row as Record<string, unknown>)[groupKey] ?? "");
      // normalize date group keys to YYYY-MM-DD
      if (isGroupDate) {
        const d = Date.parse(g);
        if (!Number.isNaN(d)) {
          const dt = new Date(d);
          g = dt.toISOString().slice(0, 10);
        }
      }
      const s = String((row as Record<string, unknown>)[seriesKey] ?? "");
      const vNum =
        Number((row as Record<string, unknown>)[config.yAxisKey!]) || 0;
      if (!acc.has(g)) acc.set(g, new Map());
      const inner = acc.get(g)!;
      const cur = inner.get(s) || { sum: 0, count: 0 };
      cur.sum += vNum;
      cur.count += 1;
      inner.set(s, cur);
    }

    const seriesNames = Array.from(
      new Set(Array.from(acc.values()).flatMap((m) => Array.from(m.keys()))),
    );
    const aggregate = config.aggregate || "sum";
    const data = Array.from(acc.entries()).map(([name, inner]) => {
      const rec: Record<string, unknown> = { name };
      for (const s of seriesNames) {
        const st = inner.get(s) || { sum: 0, count: 0 };
        rec[s] =
          aggregate === "count"
            ? st.count
            : aggregate === "avg"
            ? st.count
              ? st.sum / st.count
              : 0
            : st.sum;
      }
      return rec;
    });

    // Sort ตาม config.sortBy และ sortOrder สำหรับ grouped data
    if (config.sortBy) {
      const order = config.sortOrder || "asc";
      const toTime = (val: unknown) => {
        if (val instanceof Date) return val.getTime();
        const parsed = Date.parse(String(val ?? ""));
        if (!Number.isNaN(parsed)) return parsed;
        if (typeof val === "number" && Number.isFinite(val)) return val;
        return NaN;
      };
      data.sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        // If sorting by groupByKey (xAxisKey), use name field
        if (config.sortBy === groupKey && isGroupDate) {
          aVal = a.name;
          bVal = b.name;
        } else if (config.sortBy === config.yAxisKey) {
          // If sorting by yAxisKey, need to aggregate all series values
          const aTotal = seriesNames.reduce(
            (sum, s) => sum + Number(a[s] ?? 0),
            0,
          );
          const bTotal = seriesNames.reduce(
            (sum, s) => sum + Number(b[s] ?? 0),
            0,
          );
          aVal = aTotal;
          bVal = bTotal;
        } else {
          // Try to get from record
          aVal = a[config.sortBy!];
          bVal = b[config.sortBy!];
        }

        const fieldType = fieldTypes[config.sortBy!];
        let cmp = 0;
        if (fieldType === "number" || config.sortBy === config.yAxisKey) {
          cmp = Number(aVal ?? 0) - Number(bVal ?? 0);
        } else if (
          fieldType === "date" ||
          (isGroupDate && config.sortBy === groupKey)
        ) {
          const aTime = toTime(aVal);
          const bTime = toTime(bVal);
          cmp = Number.isNaN(aTime) || Number.isNaN(bTime) ? 0 : aTime - bTime;
        } else {
          cmp = String(aVal || "").localeCompare(String(bVal || ""));
        }
        return order === "desc" ? -cmp : cmp;
      });
    } else if (isGroupDate) {
      // default sort by date ascending if no custom sort specified
      data.sort(
        (a, b) => Date.parse(String(a.name)) - Date.parse(String(b.name)),
      );
    }

    return { data, series: seriesNames };
  };

  // สีสำหรับกราฟ
  const COLORS = [
    config.color || "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  // Export functions
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");

      // If onFetchAllData is provided, fetch all data without limit
      let allData: Record<string, unknown>[];
      if (onFetchAllData) {
        allData = await onFetchAllData();
      } else {
        allData = filteredData;
      }

      if (!allData || allData.length === 0) return;

      // Prepare data for Excel
      const headers = computedColDefs
        .map((col) => col.field as string)
        .filter(Boolean);
      const rows = allData.map((row) => {
        const rowData: Record<string, unknown> = {};
        headers.forEach((header) => {
          const value = (row as Record<string, unknown>)[header];
          // Format numbers properly
          const fieldType = fieldTypes[header];
          if (fieldType === "number" && value != null) {
            const num = Number(value);
            rowData[header] = Number.isNaN(num) ? value : num;
          } else {
            rowData[header] = value;
          }
        });
        return rowData;
      });

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-size columns
      const maxWidth = 50;
      const colWidths = headers.map((header) => {
        const maxLength = Math.max(
          header.length,
          ...rows.map((row) => {
            const val = row[header];
            return val != null ? String(val).length : 0;
          }),
        );
        return { wch: Math.min(maxLength + 2, maxWidth) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      // Download file
      const fileName = `${config.title || "export"}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("เกิดข้อผิดพลาดในการ export Excel");
    }
  };

  const handleExportPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      // If onFetchAllData is provided, fetch all data without limit
      let allData: Record<string, unknown>[];
      if (onFetchAllData) {
        allData = await onFetchAllData();
      } else {
        allData = filteredData;
      }

      if (!allData || allData.length === 0) return;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      // Prepare data for PDF - ensure Unicode is preserved
      const headers = computedColDefs
        .map((col) => col.field as string)
        .filter(Boolean);
      const rows = allData.map((row) => {
        return headers.map((header) => {
          const value = (row as Record<string, unknown>)[header];
          if (value == null) return "";
          // Format numbers
          const fieldType = fieldTypes[header];
          if (fieldType === "number") {
            return formatNumber(value);
          }
          // Ensure Unicode characters (Thai) are preserved
          return String(value);
        });
      });

      // Add title
      doc.setFontSize(16);
      doc.text(config.title || "Table Export", 14, 10);

      // Add table with auto pagination
      // Note: jsPDF's default fonts don't support Thai characters well
      // For proper Thai rendering, you may need to add a custom font
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 20,
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          overflow: "linebreak",
          cellWidth: "wrap",
          font: "helvetica",
          fontStyle: "normal",
          halign: "left",
          valign: "middle",
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: 255,
          fontStyle: "bold",
          font: "helvetica",
          halign: "left",
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { top: 20 },
        tableWidth: "auto",
        // Process cells to ensure Unicode is preserved
        didParseCell: function (data) {
          // Ensure Thai characters are preserved
          if (data.cell.text) {
            if (Array.isArray(data.cell.text)) {
              data.cell.text = data.cell.text.map((text) => {
                return typeof text === "string" ? text : String(text);
              });
            } else if (typeof data.cell.text !== "string") {
              // Convert to array if needed
              data.cell.text = [String(data.cell.text)];
            }
          }
        },
      });

      // Download file
      const fileName = `${config.title || "export"}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("เกิดข้อผิดพลาดในการ export PDF");
    }
  };

  const renderChart = () => {
    switch (config.type) {
      case "table":
        return (
          <div
            className="w-full ag-theme-quartz"
            style={{
              height: localHeight,
              width: "100%",
              overflowX: "auto",
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          >
            <AgGridReact
              ref={gridRef}
              rowData={filteredData}
              columnDefs={computedColDefs}
              defaultColDef={defaultColDef}
              animateRows
              pagination
              paginationPageSize={20}
              rowHeight={40}
              headerHeight={44}
              suppressCellFocus
              enableCellTextSelection
              domLayout="normal"
              onRowClicked={(event) => {
                if (event.data) {
                  setSelectedRowData(event.data as Record<string, unknown>);
                  setRowDetailDialogOpen(true);
                }
              }}
              rowStyle={{ cursor: "pointer" }}
            />
          </div>
        );

      case "bar":
        if (!config.xAxisKey || !config.yAxisKey) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                กรุณาเลือกแกน X และ Y สำหรับกราฟแท่ง
              </p>
            </div>
          );
        }

        const multi = getGroupedSeriesData();
        const barData = multi.data.length ? multi.data : getChartData();
        const hasMultipleSeries = multi.series.length > 1;

        if (!barData || barData.length === 0) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                ไม่มีข้อมูลแสดง กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล
              </p>
            </div>
          );
        }

        return (
          <div className="w-full" style={{ height: localHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--foreground)" }}
                  label={
                    config.xAxisTitle
                      ? {
                          value: config.xAxisTitle,
                          position: "insideBottom",
                          offset: -5,
                        }
                      : undefined
                  }
                />
                <YAxis
                  tickFormatter={(value) => formatNumber(value)}
                  label={
                    config.yAxisTitle
                      ? {
                          value: config.yAxisTitle,
                          angle: -90,
                          position: "insideLeft",
                        }
                      : undefined
                  }
                />
                <Tooltip formatter={(value: unknown) => formatNumber(value)} />
                <Legend />
                {hasMultipleSeries ? (
                  multi.series.map((s, idx) => (
                    <Bar
                      key={s}
                      name={s}
                      dataKey={s}
                      fill={COLORS[idx % COLORS.length]}
                      stackId="stack"
                      radius={
                        idx === multi.series.length - 1
                          ? [10, 10, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))
                ) : (
                  <Bar
                    dataKey="value"
                    fill={config.color || "var(--chart-1)"}
                    radius={[10, 10, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "line":
        if (!config.xAxisKey || !config.yAxisKey) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                กรุณาเลือกแกน X และ Y สำหรับกราฟเส้น
              </p>
            </div>
          );
        }

        const lmulti = getGroupedSeriesData();
        const lineData = lmulti.data.length ? lmulti.data : getChartData();

        if (!lineData || lineData.length === 0) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                ไม่มีข้อมูลแสดง กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล
              </p>
            </div>
          );
        }

        return (
          <div className="w-full" style={{ height: localHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--foreground)" }}
                  label={
                    config.xAxisTitle
                      ? {
                          value: config.xAxisTitle,
                          position: "insideBottom",
                          offset: -5,
                        }
                      : undefined
                  }
                />
                <YAxis
                  tickFormatter={(value) => formatNumber(value)}
                  label={
                    config.yAxisTitle
                      ? {
                          value: config.yAxisTitle,
                          angle: -90,
                          position: "insideLeft",
                        }
                      : undefined
                  }
                />
                <Tooltip formatter={(value: unknown) => formatNumber(value)} />
                <Legend />
                {lmulti.series.length ? (
                  lmulti.series.map((s, idx) => (
                    <Line
                      key={s}
                      name={s}
                      type="monotone"
                      dataKey={s}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={3}
                      strokeLinecap="round"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))
                ) : (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={config.color || "var(--chart-1)"}
                    strokeWidth={3}
                    strokeLinecap="round"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case "pie":
        if (!config.xAxisKey || !config.yAxisKey) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                กรุณาเลือกแกน X และ Y สำหรับกราฟวงกลม
              </p>
            </div>
          );
        }

        // สำหรับ pie chart:
        // - Group By = ชื่อของ slice (name) - ใช้ groupByKey หรือ xAxisKey
        // - Series By = ไม่ควรใช้ (pie chart แสดงได้แค่ 1 dimension) - ถ้ามีจะ ignore
        // - แต่ละ slice = aggregated value จาก yAxisKey
        const groupKey = config.groupByKey || config.xAxisKey;
        const aggregate = config.aggregate || "sum";

        let pieData: { name: string; value: number }[] = [];

        if (groupKey) {
          // Group by groupKey และ aggregate yAxisKey (ignore seriesKey)
          const isGroupDate = fieldTypes[groupKey] === "date";
          const acc = new Map<string, { sum: number; count: number }>();

          for (const row of filteredData) {
            let g = String((row as Record<string, unknown>)[groupKey] ?? "");
            if (!g || g.trim() === "") continue;

            if (isGroupDate) {
              const d = Date.parse(g);
              if (!Number.isNaN(d)) {
                const dt = new Date(d);
                g = dt.toISOString().slice(0, 10);
              }
            }
            const vNum =
              Number((row as Record<string, unknown>)[config.yAxisKey!]) || 0;
            const cur = acc.get(g) || { sum: 0, count: 0 };
            cur.sum += vNum;
            cur.count += 1;
            acc.set(g, cur);
          }

          pieData = Array.from(acc.entries())
            .filter(([name]) => name && name.trim() !== "")
            .map(([name, { sum, count }]) => ({
              name,
              value:
                aggregate === "count"
                  ? count
                  : aggregate === "avg"
                  ? count
                    ? sum / count
                    : 0
                  : sum,
            }));
        } else {
          // ไม่มี Group By -> ใช้ getChartData()
          const chartData = getChartData();
          pieData = chartData
            .filter((d) => d.name && String(d.name).trim() !== "")
            .map((d) => ({
              name: String(d.name || ""),
              value: Number(d.value || 0),
            }));
        }

        // Sort ตาม config.sortBy และ sortOrder
        if (config.sortBy) {
          const order = config.sortOrder || "asc";
          const toTime = (val: unknown) => {
            if (val instanceof Date) return val.getTime();
            const parsed = Date.parse(String(val ?? ""));
            if (!Number.isNaN(parsed)) return parsed;
            if (typeof val === "number" && Number.isFinite(val)) return val;
            return NaN;
          };
          pieData.sort((a, b) => {
            let cmp = 0;
            if (
              config.sortBy === config.yAxisKey ||
              fieldTypes[config.sortBy!] === "number"
            ) {
              cmp = a.value - b.value;
            } else if (
              fieldTypes[config.sortBy!] === "date" ||
              config.sortBy === groupKey
            ) {
              const aTime = toTime(a.name);
              const bTime = toTime(b.name);
              cmp =
                Number.isNaN(aTime) || Number.isNaN(bTime) ? 0 : aTime - bTime;
            } else {
              cmp = a.name.localeCompare(b.name);
            }
            return order === "desc" ? -cmp : cmp;
          });
        }

        if (!pieData || pieData.length === 0) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                ไม่มีข้อมูลแสดง กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล
              </p>
            </div>
          );
        }

        return (
          <div className="w-full" style={{ height: localHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props: {
                    name?: string;
                    percent?: number;
                    value?: unknown;
                  }) => {
                    const value = props.value ?? 0;
                    const formattedValue = formatNumber(value);
                    const percent = ((props.percent ?? 0) * 100).toFixed(0);
                    return `${
                      props.name || ""
                    }: ${formattedValue} (${percent}%)`;
                  }}
                  innerRadius={40}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  cornerRadius={6}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => formatNumber(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case "matrix": {
        if (!filteredData || filteredData.length === 0) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                ไม่มีข้อมูลแสดง กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล
              </p>
            </div>
          );
        }

        const firstRow = filteredData[0] as Record<string, unknown>;
        const availableKeys = Object.keys(firstRow);
        const selectedColumns =
          config.columns && config.columns.length > 0
            ? config.columns
            : availableKeys;

        const metrics = selectedColumns
          .map((column) => {
            const matchedKey =
              availableKeys.find((key) => key === column) ||
              availableKeys.find(
                (key) => key.toLowerCase() === column.toLowerCase(),
              );
            const resolvedKey = matchedKey ?? column;
            const value =
              matchedKey !== undefined
                ? firstRow[matchedKey]
                : firstRow[column as keyof typeof firstRow];
            return {
              key: resolvedKey,
              label: column,
              value,
            };
          })
          .filter(
            (metric) =>
              metric.value !== undefined && metric.value !== null && metric.key,
          );

        if (!metrics.length) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <p className="text-muted-foreground">
                ไม่พบคอลัมน์ที่เลือกในข้อมูล กรุณาตรวจสอบการตั้งค่า Matrix
              </p>
            </div>
          );
        }

        if (metrics.length === 1) {
          const metric = metrics[0];
          const rawValue = metric.value;
          const formatted = formatNumber(rawValue);
          const isNumeric =
            typeof rawValue === "number" && Number.isFinite(rawValue);
          return (
            <div
              className="w-full flex items-center justify-center"
              style={{ height: localHeight }}
            >
              <div className="text-center space-y-2">
                <div
                  className={`${
                    isNumeric ? "text-6xl" : "text-4xl"
                  } font-bold wrap-break-word`}
                  style={{ color: config.color || "var(--chart-1)" }}
                >
                  {isNumeric ? formatted : formatted || String(rawValue ?? "")}
                </div>
                <div className="text-lg text-muted-foreground">
                  {metric.label}
                </div>
                {!isNumeric && formatted !== String(rawValue ?? "") && (
                  <div className="text-xs text-muted-foreground break-all">
                    {String(rawValue ?? "")}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="w-full space-y-3" style={{ minHeight: localHeight }}>
            {filteredData.length > 1 && (
              <div className="flex justify-end text-xs text-muted-foreground">
                แสดงเฉพาะแถวแรกจาก {filteredData.length.toLocaleString()} แถว
              </div>
            )}
            <div className="rounded-2xl border bg-background/80 divide-y">
              {metrics.map((metric, index) => {
                const rawValue = metric.value;
                const formatted = formatNumber(rawValue);
                const isNumeric =
                  typeof rawValue === "number" && Number.isFinite(rawValue);
                return (
                  <div
                    key={`${metric.key}-${index}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {metric.label}
                      </div>
                    </div>
                    <div
                      className={`text-right ${
                        isNumeric
                          ? "text-2xl sm:text-3xl font-bold tracking-tight"
                          : "text-base font-semibold wrap-break-word max-w-[50%]"
                      }`}
                      style={{ color: config.color || "var(--chart-1)" }}
                    >
                      {isNumeric
                        ? formatted
                        : formatted || String(rawValue ?? "")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case "markdown":
        if (!config.markdownContent) {
          return (
            <div
              className="w-full flex items-center justify-center border rounded-lg bg-muted/50"
              style={{ minHeight: 100 }}
            >
              <p className="text-muted-foreground">ไม่มีเนื้อหา Markdown</p>
            </div>
          );
        }

        return (
          <div className="w-full prose prose-sm max-w-none dark:prose-invert prose-headings:mt-0 prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-li:my-0 prose-pre:my-0 prose-blockquote:my-0 prose-hr:my-0 prose-first:mt-0 prose-last:mb-0 prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-3 prose-h3:text-xl prose-h3:font-bold prose-h3:mb-2 prose-h4:text-lg prose-h4:font-bold prose-h4:mb-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {config.markdownContent}
            </ReactMarkdown>
          </div>
        );

      default:
        return null;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(config.id);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", config.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    if (onDragEnd) {
      onDragEnd();
    }
  };

  return (
    <>
      <Card
        ref={cardRef}
        id={`chart-${config.id}`}
        className={`w-full group ${isDragging ? "opacity-50" : ""} ${
          isResizing || externalIsResizing
            ? "select-none shadow-lg ring-2 ring-primary/20"
            : ""
        } transition-all relative ${config.type === "markdown" ? "py-0" : ""}`}
        style={{
          width: "100%",
        }}
        draggable={!!onDragStart && !isResizing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <CardHeader
          className={`flex flex-row items-center justify-between space-y-0 ${
            config.type === "markdown" ? "p-0" : "pb-2"
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {config.type !== "markdown" && (
              <>
                {config.aiGenerated && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0"
                    title="สร้างโดย AI"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI
                  </span>
                )}
                <CardTitle className="truncate">{config.title}</CardTitle>
              </>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {config.type === "table" && filteredData.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Export">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {config.type !== "matrix" && config.type !== "markdown" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFilterOpen((v) => !v)}
                title="Filter"
              >
                {/* simple funnel icon replacement */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                >
                  <path fill="currentColor" d="M3 5h18l-7 8v6l-4 2v-8z" />
                </svg>
              </Button>
            )}
            {/* Copy link button - always visible */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              title="คัดลอกลิงก์กราฟ"
              data-chart-copy={config.id}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            {(onEdit || onDelete || onDuplicate || onUpdate) && (
              <>
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(config)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDuplicate(config)}
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(config.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        {onUpdate && !isMobile && config.type !== "markdown" && (
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize bg-background/80 hover:bg-background border border-border rounded-tl-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex z-10"
            onMouseDown={handleResizeStart}
            title="ลากเพื่อปรับขนาด"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="currentColor"
              className="text-muted-foreground"
            >
              <path d="M22 22H20V20H22V22Z" />
              <path d="M22 18H20V16H22V18Z" />
              <path d="M18 22H16V20H18V22Z" />
              <path d="M18 18H16V16H18V18Z" />
            </svg>
          </div>
        )}
        <CardContent
          className={
            config.type === "markdown"
              ? "w-full px-6 pb-6"
              : "w-full overflow-x-auto"
          }
        >
          {isFilterOpen &&
            config.type !== "matrix" &&
            config.type !== "markdown" && (
              <div className="mb-3 p-3 border rounded-md flex flex-col gap-2">
                {filters.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col md:flex-row gap-2 items-stretch md:items-center"
                  >
                    <select
                      className="border rounded px-2 py-1 text-sm w-full md:w-auto md:min-w-[120px]"
                      value={f.field}
                      onChange={(e) => {
                        const next = [...filters];
                        next[idx] = { ...next[idx], field: e.target.value };
                        setFilters(next);
                        onUpdate?.(config.id, { filters: next });
                        onFilterChange?.(config.id, next);
                      }}
                    >
                      <option value="">Field</option>
                      {allFields.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const fType = fieldTypes[f.field] || "string";
                      const baseOps =
                        fType === "date"
                          ? ([
                              "today",
                              "this_week",
                              "last_week",
                              "before",
                              "after",
                              "between",
                              "last_days",
                              "last_months",
                              "equals",
                              "blank",
                              "not_blank",
                            ] as FilterOperator[])
                          : fType === "number"
                          ? ([
                              "equals",
                              "gt",
                              "lt",
                              "blank",
                              "not_blank",
                            ] as FilterOperator[])
                          : ([
                              "contains",
                              "not_contains",
                              "equals",
                              "not_equals",
                              "begins_with",
                              "ends_with",
                              "blank",
                              "not_blank",
                            ] as FilterOperator[]);
                      // ให้ dropdown แสดงค่า op ปัจจุบันแม้จะยังไม่อยู่ในชุด baseOps (กรณีเพิ่งรีเฟรชและยังเดาชนิดคอลัมน์ไม่ได้)
                      const ops = Array.from(
                        new Set<FilterOperator>([
                          ...(baseOps as FilterOperator[]),
                          f.op as FilterOperator,
                        ]),
                      );
                      const currentOp = f.op as FilterOperator;
                      return (
                        <select
                          className="border rounded px-2 py-1 text-sm w-full md:w-auto md:min-w-[150px]"
                          value={currentOp}
                          onChange={(e) => {
                            const next = [...filters];
                            const newOp = e.target.value as FilterOperator;
                            next[idx] = {
                              ...next[idx],
                              op: newOp,
                              // Clear value2 if not between operator
                              value2:
                                newOp === "between"
                                  ? next[idx].value2
                                  : undefined,
                              // Clear value for special operators
                              value:
                                newOp === "today" ||
                                newOp === "this_week" ||
                                newOp === "last_week"
                                  ? undefined
                                  : next[idx].value || "",
                            };
                            setFilters(next);
                            onUpdate?.(config.id, { filters: next });
                            onFilterChange?.(config.id, next);
                          }}
                        >
                          {ops.map((o) => (
                            <option key={o} value={o}>
                              {o === "between"
                                ? "ระหว่าง (between)"
                                : o === "last_days"
                                ? "ย้อนหลัง (last X days)"
                                : o === "last_months"
                                ? "ย้อนหลัง (last X months)"
                                : o === "today"
                                ? "วันนี้ (today)"
                                : o === "this_week"
                                ? "สัปดาห์นี้ (this week)"
                                : o === "last_week"
                                ? "สัปดาห์ที่แล้ว (last week)"
                                : o === "before"
                                ? "ก่อน (before)"
                                : o === "after"
                                ? "หลัง (after)"
                                : o === "equals"
                                ? "เท่ากับ (equals)"
                                : o === "not_equals"
                                ? "ไม่เท่ากับ (not equals)"
                                : o === "contains"
                                ? "ประกอบด้วย (contains)"
                                : o === "not_contains"
                                ? "ไม่ประกอบด้วย (not contains)"
                                : o === "begins_with"
                                ? "ขึ้นต้นด้วย (begins with)"
                                : o === "ends_with"
                                ? "ลงท้ายด้วย (ends with)"
                                : o === "gt"
                                ? "มากกว่า (greater than)"
                                : o === "lt"
                                ? "น้อยกว่า (less than)"
                                : o === "blank"
                                ? "ว่าง (blank)"
                                : o === "not_blank"
                                ? "ไม่ว่าง (not blank)"
                                : o}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                    {f.op === "between" && fieldTypes[f.field] === "date" && (
                      <div className="flex flex-col md:flex-row gap-2 flex-1">
                        <input
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
                          type="date"
                          placeholder="Start date"
                          value={f.value ?? ""}
                          onChange={(e) => {
                            const next = [...filters];
                            next[idx] = { ...next[idx], value: e.target.value };
                            setFilters(next);
                            onUpdate?.(config.id, { filters: next });
                            onFilterChange?.(config.id, next);
                          }}
                        />
                        <span className="text-sm self-center text-center md:text-left">
                          ถึง
                        </span>
                        <input
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
                          type="date"
                          placeholder="End date"
                          value={f.value2 ?? ""}
                          onChange={(e) => {
                            const next = [...filters];
                            next[idx] = {
                              ...next[idx],
                              value2: e.target.value,
                            };
                            setFilters(next);
                            onUpdate?.(config.id, { filters: next });
                            onFilterChange?.(config.id, next);
                          }}
                        />
                      </div>
                    )}
                    {(f.op === "last_days" || f.op === "last_months") &&
                      fieldTypes[f.field] === "date" && (
                        <input
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
                          type="number"
                          min="1"
                          placeholder={
                            f.op === "last_days" ? "จำนวนวัน" : "จำนวนเดือน"
                          }
                          value={f.value ?? ""}
                          onChange={(e) => {
                            const next = [...filters];
                            next[idx] = { ...next[idx], value: e.target.value };
                            setFilters(next);
                            onUpdate?.(config.id, { filters: next });
                            onFilterChange?.(config.id, next);
                          }}
                        />
                      )}
                    {f.op !== "today" &&
                      f.op !== "this_week" &&
                      f.op !== "last_week" &&
                      f.op !== "between" &&
                      f.op !== "last_days" &&
                      f.op !== "last_months" &&
                      f.op !== "blank" &&
                      f.op !== "not_blank" && (
                        <input
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
                          type={
                            fieldTypes[f.field] === "date" ||
                            f.op === "before" ||
                            f.op === "after"
                              ? "date"
                              : "text"
                          }
                          placeholder={
                            fieldTypes[f.field] === "date" ||
                            f.op === "before" ||
                            f.op === "after"
                              ? "YYYY-MM-DD"
                              : "value"
                          }
                          value={f.value ?? ""}
                          onChange={(e) => {
                            const next = [...filters];
                            next[idx] = { ...next[idx], value: e.target.value };
                            setFilters(next);
                            onUpdate?.(config.id, { filters: next });
                            onFilterChange?.(config.id, next);
                          }}
                        />
                      )}
                    <div className="flex gap-2 shrink-0">
                      {fieldTypes[f.field] === "date" && (
                        <Button
                          variant={
                            f.op === "today" ||
                            f.op === "this_week" ||
                            f.op === "last_week"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => {
                            const next = [...filters];
                            next[idx] = {
                              ...next[idx],
                              op:
                                f.op === "today"
                                  ? "this_week"
                                  : f.op === "this_week"
                                  ? "last_week"
                                  : f.op === "last_week"
                                  ? "today"
                                  : "today",
                              value: undefined,
                              value2: undefined,
                            };
                            setFilters(next);
                            onUpdate?.(config.id, { filters: next });
                            onFilterChange?.(config.id, next);
                          }}
                        >
                          {f.op === "today"
                            ? "วันนี้"
                            : f.op === "this_week"
                            ? "สัปดาห์นี้"
                            : f.op === "last_week"
                            ? "สัปดาห์ที่แล้ว"
                            : "วันนี้"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = filters.filter((_, i) => i !== idx);
                          setFilters(next);
                          onUpdate?.(config.id, { filters: next });
                          onFilterChange?.(config.id, next);
                        }}
                      >
                        ลบ
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const next: FilterRule[] = [
                        ...filters,
                        {
                          field: allFields[0] || "",
                          op: "equals" as FilterOperator,
                          value: "",
                        },
                      ];
                      setFilters(next);
                      onUpdate?.(config.id, { filters: next });
                      onFilterChange?.(config.id, next);
                    }}
                  >
                    เพิ่มเงื่อนไข
                  </Button>
                  {filters.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setFilters([]);
                        onUpdate?.(config.id, { filters: [] });
                        onFilterChange?.(config.id, []);
                      }}
                    >
                      ล้าง
                    </Button>
                  )}
                </div>
              </div>
            )}
          {isLoading ? (
            <div
              className="w-full flex flex-col items-center justify-center border rounded-lg bg-muted/50"
              style={{ height: localHeight }}
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p className="text-muted-foreground text-sm">
                กำลังโหลดข้อมูล...
              </p>
            </div>
          ) : (
            renderChart()
          )}
        </CardContent>
      </Card>
      <Toast
        message="คัดลอกลิงก์แล้ว"
        open={toastOpen}
        onClose={() => setToastOpen(false)}
      />
      <Dialog open={rowDetailDialogOpen} onOpenChange={setRowDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดข้อมูล</DialogTitle>
          </DialogHeader>
          {selectedRowData && (
            <div className="space-y-2">
              {Object.entries(selectedRowData).map(([key, value]) => {
                const fieldType = fieldTypes[key];
                let displayValue: string;

                if (value == null || value === "") {
                  displayValue = "";
                } else if (fieldType === "number") {
                  displayValue = formatNumber(value);
                } else if (fieldType === "date") {
                  const time = Date.parse(String(value));
                  if (!Number.isNaN(time)) {
                    const dt = new Date(time);
                    const day = String(dt.getDate()).padStart(2, "0");
                    const month = String(dt.getMonth() + 1).padStart(2, "0");
                    const year = dt.getFullYear();
                    displayValue = `${year}-${month}-${day}`;
                  } else {
                    displayValue = String(value);
                  }
                } else {
                  displayValue = String(value);
                }

                return (
                  <div key={key} className="border-b pb-2 last:border-b-0">
                    <div className="font-semibold text-sm text-muted-foreground mb-1">
                      {key}
                    </div>
                    <div className="text-base wrap-break-word">
                      {displayValue || (
                        <span className="text-muted-foreground">(ว่าง)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
