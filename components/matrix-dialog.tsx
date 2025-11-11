"use client";

import { useState, useEffect } from "react";
import { ChartConfig } from "@/types/chart";
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
import { useConnections } from "@/hooks/use-connections";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Database,
  Play,
  Columns3,
  GaugeCircle,
  Palette,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
} from "lucide-react";

interface MatrixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ChartConfig;
  onSave: (config: Omit<ChartConfig, "id">) => void;
}

export function MatrixDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: MatrixDialogProps) {
  const { connections } = useConnections();
  const [title, setTitle] = useState(config?.title ?? "");
  const [height, setHeight] = useState(config?.height ?? 500);
  const [connectionId, setConnectionId] = useState(config?.connectionId ?? "");
  const [database, setDatabase] = useState(config?.database ?? "");
  const [sqlQuery, setSqlQuery] = useState(config?.sqlQuery ?? "");
  const [databases, setDatabases] = useState<string[]>([]);
  const [queryResultData, setQueryResultData] = useState<
    Record<string, unknown>[]
  >([]);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [seriesColor, setSeriesColor] = useState<string>(
    config?.color ?? "#f97316",
  );

  const DROPDOWN_MENU_Z = "z-[500]";
  const colorPresets = ["#f97316", "#2563eb", "#16a34a", "#a855f7", "#ef4444"];

  // Load databases for selected connection
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

  useEffect(() => {
    if (connectionId && open) {
      fetchDatabases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, open]);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open && config) {
      setTitle(config.title ?? "");
      setHeight(config.height ?? 500);
      setConnectionId(config.connectionId ?? "");
      setDatabase(config.database ?? "");
      setSqlQuery(config.sqlQuery ?? "");
      setSeriesColor(config.color ?? "#f97316");
      // Get first column from config.columns if exists
      setSelectedColumns(config.columns ?? []);
    } else if (!open) {
      setQueryResultData([]);
      setQueryError(null);
      setSelectedColumns([]);
    }
  }, [open, config]);

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
          limit: 1, // Matrix requires only 1 row
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการรัน Query");
      }

      const rows = (data.rows || []) as Record<string, unknown>[];

      if (rows.length === 0) {
        setQueryError("Query ไม่มีผลลัพธ์");
        setQueryResultData([]);
        return;
      }

      if (rows.length > 1) {
        setQueryError("Matrix ต้องมีผลลัพธ์เพียง 1 แถว กรุณาแก้ไข SQL Query");
        setQueryResultData([]);
        return;
      }

      setQueryResultData(rows);

      // Auto-select first column if not selected
      const firstRow = rows[0] as Record<string, unknown>;
      const cols = Object.keys(firstRow);
      if (cols.length > 0 && selectedColumns.length === 0) {
        setSelectedColumns(cols);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setQueryError(message);
      setQueryResultData([]);
    } finally {
      setIsRunningQuery(false);
    }
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

    if (queryResultData.length === 0) {
      setQueryError("กรุณารัน Query ก่อนบันทึก");
      return;
    }

    if (selectedColumns.length === 0) {
      setQueryError("กรุณาเลือกคอลัมน์ที่จะแสดงอย่างน้อย 1 คอลัมน์");
      return;
    }

    onSave({
      title: title.trim(),
      type: "matrix",
      height,
      connectionId,
      database,
      sqlQuery: sqlQuery.trim(),
    columns: selectedColumns,
      color: seriesColor,
    });

    onOpenChange(false);
  };

  const availableColumns =
    queryResultData.length > 0
      ? Object.keys(queryResultData[0] as Record<string, unknown>)
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="px-6 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              {config ? "แก้ไขการตั้งค่า Matrix" : "เพิ่ม Matrix"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              กรอก SQL ที่ส่งคืน 1 แถว แล้วเลือกคอลัมน์ที่ต้องการแสดงบนการ์ด
              Matrix
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 pb-6 pt-4">
          <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">ตั้งชื่อ Matrix</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              ตั้งชื่อให้สื่อความหมายชัดเจน เช่น &quot;ยอดขายวันนี้&quot;
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="กรอกชื่อ Matrix"
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
                      disabled={!connectionId}
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
                Matrix จะใช้ค่าจากแถวเดียวของผลลัพธ์เพื่อสร้างการ์ดสรุป
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  SQL Query (ผลลัพธ์ 1 แถว)
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  เขียนคำสั่ง SQL (รองรับ SELECT / WITH) ที่ส่งคืนผลลัพธ์เพียง 1
                  แถว
                </p>
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT COUNT(*) AS total_orders, SUM(amount) AS total_amount FROM orders WHERE status = 'completed' LIMIT 1"
              className="mt-4 w-full min-h-[140px] rounded-xl border bg-background p-4 font-mono text-sm"
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
              {availableColumns.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  คอลัมน์ที่พบ: {availableColumns.length.toLocaleString()}
                </span>
              )}
            </div>
            {queryError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {queryError}
              </div>
            )}

            {queryResultData.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  ✓ พบข้อมูล 1 แถว, {availableColumns.length} คอลัมน์
                </div>
                <div className="overflow-x-auto rounded-xl border bg-background/70">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {availableColumns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-medium text-muted-foreground"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {availableColumns.map((col) => (
                          <td key={col} className="px-3 py-2">
                            {String(queryResultData[0][col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {availableColumns.length > 0 && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Columns3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">เลือกคอลัมน์ที่จะแสดง</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                เลือกคอลัมน์ตัวเลขสำคัญเพื่อใช้เป็นค่าที่โชว์ใน Matrix
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableColumns.map((col) => {
                  const active = selectedColumns.includes(col);
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setSelectedColumns((prev) =>
                          prev.includes(col)
                            ? prev.filter((c) => c !== col)
                            : [...prev, col],
                        );
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary shadow-[0_8px_24px_-12px_rgba(37,99,235,0.45)]"
                          : "border-border/60 bg-background hover:border-primary/40",
                      )}
                    >
                      <span className="font-medium">{col}</span>
                      {queryResultData.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {String(queryResultData[0][col] ?? "")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedColumns.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                    ใช้คอลัมน์{" "}
                    <span className="font-semibold">
                      {selectedColumns.join(", ")}
                    </span>{" "}
                    เป็นค่าใน Matrix
                  </div>
                  <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                    {selectedColumns.map((col, index) => (
                      <div
                        key={col}
                        className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 shadow-sm"
                      >
                        <span className="text-sm font-medium">{col}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setSelectedColumns((prev) => {
                                if (index === 0) return prev;
                                const next = [...prev];
                                [next[index - 1], next[index]] = [
                                  next[index],
                                  next[index - 1],
                                ];
                                return next;
                              })
                            }
                            disabled={index === 0}
                            title="ย้ายขึ้น"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setSelectedColumns((prev) => {
                                if (index === prev.length - 1) return prev;
                                const next = [...prev];
                                [next[index + 1], next[index]] = [
                                  next[index],
                                  next[index + 1],
                                ];
                                return next;
                              })
                            }
                            disabled={index === selectedColumns.length - 1}
                            title="ย้ายลง"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setSelectedColumns((prev) =>
                                prev.filter((c) => c !== col),
                              )
                            }
                            title="นำออก"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setSelectedColumns([])}
                      >
                        <RotateCcw className="h-4 w-4" />
                        เคลียร์คอลัมน์
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Columns3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">ความสูง (px)</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                ปรับความสูงให้สอดคล้องกับเลย์เอาต์ของ Dashboard
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

            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Palette className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">สีของตัวเลข</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                เลือกสีหลักสำหรับค่า Metric ในการ์ด
              </p>
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="color"
                  value={seriesColor}
                  onChange={(e) => setSeriesColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border bg-background"
                  aria-label="เลือกสีตัวเลข"
                />
                <div className="flex gap-2">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSeriesColor(c)}
                      className={cn(
                        "h-7 w-7 rounded-full border border-border transition hover:scale-105",
                        seriesColor === c &&
                          "ring-2 ring-offset-2 ring-primary",
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`preset ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2 border-t pt-4">
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
