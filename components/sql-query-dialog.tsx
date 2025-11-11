"use client";

import { useState, useEffect } from "react";
import { ChartConfig, ChartType } from "@/types/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColDef } from "ag-grid-community";
import { useConnections } from "@/hooks/use-connections";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  LineChart,
  PieChart,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Database,
  Play,
  SlidersHorizontal,
  Columns3,
  X as XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SQLQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ChartConfig;
  onSave: (config: Omit<ChartConfig, "id">) => void;
}

type ChartTypeOption = {
  value: ChartType;
  label: string;
  description: string;
  icon: LucideIcon;
};

const chartTypeOptions: ChartTypeOption[] = [
  {
    value: "table",
    label: "ตาราง",
    description: "ผลลัพธ์แบบรายการเต็ม เลือกคอลัมน์ได้",
    icon: TableIcon,
  },
  {
    value: "bar",
    label: "กราฟแท่ง",
    description: "เทียบค่าตามหมวดหมู่",
    icon: BarChart3,
  },
  {
    value: "line",
    label: "กราฟเส้น",
    description: "วิเคราะห์แนวโน้มตามเวลา",
    icon: LineChart,
  },
  {
    value: "pie",
    label: "กราฟวงกลม",
    description: "วิเคราะห์สัดส่วน",
    icon: PieChart,
  },
  {
    value: "matrix",
    label: "Metric Grid",
    description: "สรุปตัวเลขสำคัญหลายค่า",
    icon: LayoutGrid,
  },
];

const DROPDOWN_MENU_Z = "z-[500]";

export function SQLQueryDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: SQLQueryDialogProps) {
  const { connections } = useConnections();
  const [title, setTitle] = useState(config?.title ?? "");
  const [type, setType] = useState<ChartType>(config?.type ?? "table");
  const [height, setHeight] = useState(config?.height ?? 500);
  const [connectionId, setConnectionId] = useState(config?.connectionId ?? "");
  const [database, setDatabase] = useState(config?.database ?? "");
  const [sqlQuery, setSqlQuery] = useState(config?.sqlQuery ?? "");
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    config?.columns ?? [],
  );
  const [queryResultColumns, setQueryResultColumns] = useState<string[]>([]);
  const [queryResultData, setQueryResultData] = useState<
    Record<string, unknown>[]
  >([]);
  const [queryResultTotal, setQueryResultTotal] = useState<number | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [xAxisKey, setXAxisKey] = useState(config?.xAxisKey ?? "");
  const [yAxisKey, setYAxisKey] = useState(config?.yAxisKey ?? "");
  const [sortBy, setSortBy] = useState(config?.sortBy ?? "");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    config?.sortOrder ?? "asc",
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [seriesColor, setSeriesColor] = useState<string>(
    config?.color ?? "#f97316",
  );
  const [groupByKey, setGroupByKey] = useState(config?.groupByKey ?? "");
  const [seriesKey, setSeriesKey] = useState(config?.seriesKey ?? "");
  const [aggregate, setAggregate] = useState<"sum" | "count" | "avg">(
    config?.aggregate ?? "sum",
  );
  const [xAxisTitle, setXAxisTitle] = useState(config?.xAxisTitle ?? "");
  const [yAxisTitle, setYAxisTitle] = useState(config?.yAxisTitle ?? "");

  const sortCandidates = queryResultColumns
    .concat([xAxisKey, yAxisKey].filter(Boolean) as string[])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const isAxisChart = type === "bar" || type === "line" || type === "pie";
  const isMatrix = type === "matrix";
  const canPickColumns = type === "table" || isMatrix;

  useEffect(() => {
    if (connectionId && open) {
      void fetchDatabases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, open]);

  useEffect(() => {
    if (open && config) {
      setTitle(config.title ?? "");
      setType(config.type ?? "table");
      setHeight(config.height ?? 500);
      setConnectionId(config.connectionId ?? "");
      setDatabase(config.database ?? "");
      setSqlQuery(config.sqlQuery ?? "");
      setSelectedColumns(config.columns ?? []);
      setXAxisKey(config.xAxisKey ?? "");
      setYAxisKey(config.yAxisKey ?? "");
      setSortBy(config.sortBy ?? "");
      setSortOrder(config.sortOrder ?? "asc");
      setSeriesColor(config.color ?? "#f97316");
      setGroupByKey(config.groupByKey ?? "");
      setSeriesKey(config.seriesKey ?? "");
      setAggregate(config.aggregate ?? "sum");
      setXAxisTitle(config.xAxisTitle ?? "");
      setYAxisTitle(config.yAxisTitle ?? "");
    } else if (!open) {
      setQueryResultColumns([]);
      setQueryResultData([]);
      setQueryResultTotal(null);
      setQueryError(null);
      setSelectedColumns([]);
      setXAxisKey("");
      setYAxisKey("");
    }
  }, [open, config]);

  const fetchDatabases = async () => {
    if (!connectionId) return;
    const c = connections.find((x) => x.id === connectionId);
    if (!c) return;
    const res = await fetch("/api/db/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: c.type,
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
      }),
    });
    const data = await res.json();
    setDatabases(data.databases ?? []);
  };

  const handleRunQuery = async () => {
    if (!connectionId || !database || !sqlQuery.trim()) {
      setQueryError("กรุณาเลือก Connection, Database และกรอก SQL Query");
      return;
    }

    const c = connections.find((x) => x.id === connectionId);
    if (!c) {
      setQueryError("ไม่พบ Connection ที่เลือก");
      return;
    }

    setIsRunningQuery(true);
    setQueryError(null);

    try {
      const res = await fetch("/api/db/query-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: c.type,
          host: c.host,
          port: c.port,
          user: c.user,
          password: c.password,
          database,
          sql: sqlQuery.trim(),
          limit: 50000,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการรัน Query");
      }

      const rows = (data.rows || []) as Record<string, unknown>[];
      const total = (data as { total?: number }).total;
      const columnsFromMetadata = (data as { columns?: string[] }).columns;

      if (rows.length === 0) {
        if (columnsFromMetadata && columnsFromMetadata.length > 0) {
          setQueryResultColumns(columnsFromMetadata);
          if (isMatrix && selectedColumns.length === 0) {
            setSelectedColumns(columnsFromMetadata.slice(0, 6));
          }
        } else {
          setQueryResultColumns([]);
        }
        setQueryResultData([]);
        setQueryResultTotal(total ?? 0);
        setQueryError(null);
      } else {
        const cols = Object.keys(rows[0]);
        setQueryResultColumns(cols);
        setQueryResultData(rows);
        setQueryResultTotal(total ?? null);
        setQueryError(null);

        if (type === "table" && selectedColumns.length === 0) {
          setSelectedColumns(cols);
        } else if (isMatrix && selectedColumns.length === 0) {
          setSelectedColumns(cols.slice(0, 6));
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setQueryError(message);
      setQueryResultColumns([]);
      setQueryResultData([]);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const handleSelectAllColumns = () => {
    if (!queryResultColumns.length) return;
    setSelectedColumns([...queryResultColumns]);
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleToggleColumn = (field: string) => {
    if (selectedColumns.includes(field)) {
      setSelectedColumns(selectedColumns.filter((col) => col !== field));
      return;
    }
    if (isMatrix && selectedColumns.length >= 6) {
      return;
    }
    setSelectedColumns([...selectedColumns, field]);
  };

  const handleSave = () => {
    if (!title.trim()) {
      setQueryError("กรุณากรอกชื่อกราฟ");
      return;
    }

    if (!connectionId || !database || !sqlQuery.trim()) {
      setQueryError("กรุณาเลือก Connection, Database และกรอก SQL Query");
      return;
    }

    if (type === "table" && selectedColumns.length === 0) {
      setQueryError("กรุณาเลือกคอลัมน์อย่างน้อย 1 คอลัมน์สำหรับตาราง");
      return;
    }

    if (isMatrix && selectedColumns.length === 0) {
      setQueryError("Matrix ต้องเลือกคอลัมน์ตัวเลขอย่างน้อย 1 คอลัมน์");
      return;
    }

    if (isAxisChart && (!xAxisKey || !yAxisKey)) {
      setQueryError("กรุณาเลือกแกน X และ Y สำหรับกราฟ");
      return;
    }

    if (
      queryResultData.length === 0 &&
      type === "table" &&
      selectedColumns.length === 0
    ) {
      setQueryError(
        "กรุณารัน Query เพื่อเลือกคอลัมน์ หรือเลือกคอลัมน์ที่ต้องการแสดง",
      );
      return;
    }

    const columnDefs: ColDef[] = selectedColumns.map((col) => ({
      field: col,
      flex: 1,
    }));

    onSave({
      title: title.trim(),
      type,
      height,
      connectionId,
      database,
      sqlQuery: sqlQuery.trim(),
      columns: selectedColumns,
      columnDefs,
      xAxisKey: isAxisChart ? xAxisKey : undefined,
      yAxisKey: isAxisChart ? yAxisKey : undefined,
      groupByKey: isAxisChart ? groupByKey || xAxisKey || undefined : undefined,
      seriesKey: isAxisChart ? seriesKey || undefined : undefined,
      aggregate: isAxisChart ? aggregate : undefined,
      sortBy: isAxisChart && sortBy ? sortBy : undefined,
      sortOrder: isAxisChart && sortBy ? sortOrder : undefined,
      color: isAxisChart ? seriesColor : undefined,
      xAxisTitle: isAxisChart ? xAxisTitle || undefined : undefined,
      yAxisTitle: isAxisChart ? yAxisTitle || undefined : undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="px-6 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              {config ? "แก้ไขการตั้งค่ากราฟ SQL" : "เพิ่มกราฟ Dynamic SQL"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              เขียน SQL เพื่อสร้างกราฟแบบกำหนดเอง รองรับคอลัมน์ที่ปรับแต่งได้
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {chartTypeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === type;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setType(option.value)}
                  className={cn(
                    "flex h-full flex-col items-start rounded-2xl border bg-background/80 p-4 text-left transition-all",
                    "hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive ? "border-primary/70" : "border-border/70",
                  )}
                >
                  <div
                    className={cn(
                      "inline-flex h-10 w-10 items-center justify-center rounded-xl border text-primary",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-foreground">
                    {option.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 px-6 pb-6 pt-4">
          <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">ตั้งชื่อกราฟ</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ใช้ชื่อที่อธิบายภาพรวม เช่น &quot;ปริมาณคำสั่งซื้อรายวัน&quot;
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="กรอกชื่อกราฟ"
              className="mt-4"
            />
          </div>

          <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  เชื่อมต่อฐานข้อมูล
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  เลือก Connection และ Database ที่ต้องการใช้สำหรับรัน Query
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Connection
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      type="button"
                    >
                      {connectionId
                        ? connections.find((c) => c.id === connectionId)
                            ?.name ?? connectionId
                        : "เลือก Connection"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                  >
                    {connections.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() => {
                          setConnectionId(c.id);
                          setDatabase("");
                        }}
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Database
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      type="button"
                    >
                      {database || "เลือก Database"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                  >
                    {databases.map((db) => (
                      <DropdownMenuItem
                        key={db}
                        onSelect={() => setDatabase(db)}
                      >
                        {db}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-muted-foreground/30 bg-background/60 p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Database className="h-4 w-4 text-primary" />
                เลือกฐานข้อมูลแล้วกรอก SQL Query ด้านล่าง
              </div>
              <p className="mt-1">
                ระบบจะดึงข้อมูลสูงสุด 50,000 แถวเพื่อใช้พรีวิวและออกแบบกราฟ
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  SQL Query
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  เขียนคำสั่ง SQL (รองรับ SELECT / WITH)
                  เพื่อดึงข้อมูลที่ต้องการ
                </p>
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT date, SUM(total_amount) AS total_sales FROM orders GROUP BY date ORDER BY date DESC"
              className="mt-4 w-full min-h-[160px] rounded-xl border bg-background p-4 font-mono text-sm"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={handleRunQuery}
                disabled={isRunningQuery || !connectionId || !database}
                className="inline-flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {isRunningQuery ? "กำลังรัน Query..." : "รัน Query"}
              </Button>
              {queryResultColumns.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  คอลัมน์ที่พบ: {queryResultColumns.length.toLocaleString()}
                </span>
              )}
            </div>
            {queryError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {queryError}
              </div>
            )}

            {queryResultData.length > 0 && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                ✓ พบข้อมูล{" "}
                {queryResultTotal !== null
                  ? `${queryResultTotal.toLocaleString()} รายการทั้งหมด (แสดง ${queryResultData.length.toLocaleString()} รายการ)`
                  : `${queryResultData.length.toLocaleString()} แถว`}
                , {queryResultColumns.length} คอลัมน์
              </div>
            )}
            {queryResultData.length === 0 &&
              queryResultTotal !== null &&
              queryResultTotal === 0 &&
              !queryError && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  ✓ Query สำเร็จ แต่ไม่มีผลลัพธ์
                  สามารถบันทึกได้หากเลือกแกนหรือคอลัมน์ไว้แล้ว
                </div>
              )}
          </div>

          {canPickColumns && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Columns3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {type === "table"
                    ? "เลือกคอลัมน์ที่แสดง"
                    : "เลือก Metric สำหรับ Matrix"}
                </h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {type === "table"
                  ? "เลือกคอลัมน์จากผลลัพธ์เพื่อนำมาแสดง สามารถจัดลำดับและลบได้"
                  : "เลือกคอลัมน์ตัวเลข (สูงสุด 6) เพื่อสร้างการ์ดสรุป"}
              </p>

              {queryResultColumns.length > 0 ? (
                <>
                  <div className="mt-4 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-xl border bg-background/80 p-3 sm:grid-cols-2">
                    {queryResultColumns.map((field) => {
                      const active = selectedColumns.includes(field);
                      return (
                        <button
                          type="button"
                          key={field}
                          onClick={() => handleToggleColumn(field)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 bg-background hover:border-primary/40",
                          )}
                        >
                          <span className="truncate">{field}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      เลือกแล้ว {selectedColumns.length} คอลัมน์
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllColumns}
                      >
                        เลือกทั้งหมด
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAllColumns}
                      >
                        เคลียร์
                      </Button>
                    </div>
                  </div>
                  {selectedColumns.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedColumns.map((col, idx) => (
                        <div
                          key={col}
                          className="group flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground shadow-sm"
                          draggable
                          onDragStart={() => setDragIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIndex === null || dragIndex === idx) return;
                            const next = [...selectedColumns];
                            const [moved] = next.splice(dragIndex, 1);
                            next.splice(idx, 0, moved);
                            setSelectedColumns(next);
                            setDragIndex(null);
                          }}
                        >
                          <span>{col}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleColumn(col)}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-input text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                            aria-label={`ลบคอลัมน์ ${col}`}
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {isMatrix && selectedColumns.length >= 6 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Matrix แนะนำไม่เกิน 6 Metrics เพื่อให้การ์ดอ่านง่าย
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-muted-foreground/30 bg-background/60 p-4 text-sm text-muted-foreground">
                  รัน Query เพื่อดูคอลัมน์ที่สามารถเลือกได้ หรือจะใช้คอลัมน์จาก
                  config เดิมก็ได้
                </div>
              )}
            </div>
          )}

          {!isMatrix && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">ความสูงของกราฟ (px)</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                ปรับความสูงให้ตอบโจทย์ข้อมูล (ค่าแนะนำ 480 - 520px)
              </p>
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min={200}
                max={1000}
                className="mt-4 w-40"
              />
            </div>
          )}

          {isAxisChart && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    ตั้งค่ารายละเอียดกราฟ
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    เลือกแกนและการจัดกลุ่มเพื่อให้กราฟเล่าเรื่องได้ครบถ้วน
                  </p>
                </div>
              </div>

              {queryResultColumns.length > 0 ? (
                <>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        แกน X (ชื่อ/หมวดหมู่)
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {xAxisKey || "เลือกแกน X"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                        >
                          {queryResultColumns.map((field) => (
                            <DropdownMenuItem
                              key={field}
                              onClick={() => setXAxisKey(field)}
                            >
                              {field}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        แกน Y (ค่า/ตัวเลข)
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {yAxisKey || "เลือกแกน Y"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                        >
                          {queryResultColumns
                            .filter((field) => field !== xAxisKey)
                            .map((field) => (
                              <DropdownMenuItem
                                key={field}
                                onClick={() => setYAxisKey(field)}
                              >
                                {field}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Group By
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {groupByKey || xAxisKey || "เลือกฟิลด์"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                        >
                          {queryResultColumns.map((field) => (
                            <DropdownMenuItem
                              key={field}
                              onClick={() => setGroupByKey(field)}
                            >
                              {field}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Series By (Optional)
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {seriesKey || "(ไม่แยก)"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                        >
                          <DropdownMenuItem onClick={() => setSeriesKey("")}>
                            ไม่แยก
                          </DropdownMenuItem>
                          {queryResultColumns.map((field) => (
                            <DropdownMenuItem
                              key={field}
                              onClick={() => setSeriesKey(field)}
                            >
                              {field}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Aggregate
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {aggregate === "sum"
                              ? "Sum (รวม)"
                              : aggregate === "avg"
                              ? "Average (เฉลี่ย)"
                              : "Count (นับ)"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={cn("w-[200px]", DROPDOWN_MENU_Z)}
                        >
                          <DropdownMenuItem onClick={() => setAggregate("sum")}>
                            Sum (รวม)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAggregate("avg")}>
                            Average (เฉลี่ย)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setAggregate("count")}
                          >
                            Count (นับ)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          ชื่อแกน X
                        </label>
                        <Input
                          value={xAxisTitle}
                          onChange={(e) => setXAxisTitle(e.target.value)}
                          placeholder="เช่น เดือน"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          ชื่อแกน Y
                        </label>
                        <Input
                          value={yAxisTitle}
                          onChange={(e) => setYAxisTitle(e.target.value)}
                          placeholder="เช่น ยอดขาย"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        สีของกราฟ
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={seriesColor}
                          onChange={(e) => setSeriesColor(e.target.value)}
                          className="h-10 w-14 cursor-pointer rounded-md border bg-background"
                          aria-label="เลือกสีกราฟ"
                        />
                        <div className="flex gap-2">
                          {[
                            "#f97316",
                            "#0ea5e9",
                            "#22c55e",
                            "#a855f7",
                            "#ef4444",
                          ].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setSeriesColor(c)}
                              className="h-7 w-7 rounded-full border border-border transition hover:scale-105"
                              style={{ backgroundColor: c }}
                              aria-label={`preset ${c}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      การเรียงลำดับ (Sort)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between md:w-auto"
                          >
                            {sortBy || "เลือก field ที่จะ sort"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                        >
                          <DropdownMenuItem onClick={() => setSortBy("")}>
                            ไม่ sort
                          </DropdownMenuItem>
                          {sortCandidates.map((field) => (
                            <DropdownMenuItem
                              key={field}
                              onClick={() => setSortBy(field)}
                            >
                              {field}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {sortBy && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between md:w-auto"
                            >
                              {sortOrder === "asc"
                                ? "↑ น้อย → มาก"
                                : "↓ มาก → น้อย"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className={cn("w-[200px]", DROPDOWN_MENU_Z)}
                          >
                            <DropdownMenuItem
                              onClick={() => setSortOrder("asc")}
                            >
                              ↑ น้อย → มาก (Ascending)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setSortOrder("desc")}
                            >
                              ↓ มาก → น้อย (Descending)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-muted-foreground/30 bg-background/60 p-4 text-sm text-muted-foreground">
                  รัน Query เพื่อเลือกคอลัมน์สำหรับแกน X / Y
                  หรือใช้ค่าเดิมจากกราฟที่บันทึกไว้
                </div>
              )}

              {queryResultColumns.length === 0 && (xAxisKey || yAxisKey) && (
                <div className="mt-4 space-y-3 rounded-xl border border-dashed border-muted-foreground/40 bg-background/60 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      ค่าเดิมจากกราฟ
                    </span>
                  </div>
                  {xAxisKey && (
                    <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                      แกน X: {xAxisKey}
                      <button
                        type="button"
                        onClick={() => setXAxisKey("")}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-input text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                        aria-label="ลบค่าแกน X"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {yAxisKey && (
                    <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                      แกน Y: {yAxisKey}
                      <button
                        type="button"
                        onClick={() => setYAxisKey("")}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-input text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                        aria-label="ลบค่าแกน Y"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-10 flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>บันทึก</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
