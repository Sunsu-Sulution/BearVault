"use client";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useChartConfigs } from "@/hooks/use-chart-configs";
import { ChartRenderer } from "@/components/chart-renderer";
import { ChartConfigDialog } from "@/components/chart-config-dialog";
import { SQLQueryDialog } from "@/components/sql-query-dialog";
import { MatrixDialog } from "@/components/matrix-dialog";
import { AiChartDialog } from "@/components/ai-chart-dialog";
import { TabInputsPanel } from "@/components/tab-inputs-panel";
import { Button } from "@/components/ui/button";
import { Plus, Database, Sparkles } from "lucide-react";
import { ChartConfig, FilterRule } from "@/types/chart";
import { useConnections } from "@/hooks/use-connections";
import { useDashboardTabs } from "@/hooks/use-dashboard-tabs";
import { useNotes } from "@/hooks/use-notes";
import { useTabInputs } from "@/hooks/use-tab-inputs";
import { NoteComponent } from "@/components/note-component";
import { useHelperContext } from "@/components/providers/helper-provider";
import { useIsMobile } from "@/hooks/use-mobile";

type ColumnsResponse = {
  columns: { name: string; type: string; nullable: boolean }[];
};
// Tables are handled inside dialog; keep only ColumnsResponse here

// Hash function to create unique key from SQL query
const hashSQLQuery = (sql: string): string => {
  let hash = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

export default function Page() {
  const params = useParams<{ tab: string }>();
  const tabId = params.tab;
  const pagePath = `/dashboard/${tabId}`;
  const { tabs } = useDashboardTabs();
  const tab = tabs.find((t) => t.id === tabId);
  const tabName = tab?.name || tabId;
  const isMobile = useIsMobile();
  const { isLocked, userInfo, notesVisible } = useHelperContext()();
  const {
    configs,
    addChart,
    insertChart,
    updateChart,
    removeChart,
    reorderCharts,
  } = useChartConfigs(pagePath, {
    tabId,
    userId: userInfo?.user_id || userInfo?.email || "",
    userName: userInfo?.name || userInfo?.en_name || "",
    userEmail: userInfo?.email || "",
  });

  const {
    notes,
    isLoaded: notesLoaded,
    updateNote,
    removeNote,
  } = useNotes({ tabId });

  const {
    inputs: tabInputs,
    isLoaded: tabInputsLoaded,
    addInput: addTabInput,
    updateInput: updateTabInput,
    removeInput: removeTabInput,
    setInputValue: setTabInputValue,
  } = useTabInputs({ tabId });

  const tabInputValueMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    tabInputs.forEach((input) => {
      const rawKey = (input.key || "").trim();
      if (!rawKey) return;
      const normalizedKey = rawKey.toLowerCase();
      const value = input.value ?? input.defaultValue ?? "";
      map[rawKey] = value;
      map[normalizedKey] = value;
    });
    return map;
  }, [tabInputs]);

  const resolveTemplateString = React.useCallback(
    (template?: string | null): string | undefined => {
      if (template === undefined || template === null) {
        return undefined;
      }
      if (!template.includes("{{")) {
        return template;
      }
      return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
          return "";
        }
        const lowered = normalizedKey.toLowerCase();
        const replacement =
          tabInputValueMap[normalizedKey] ?? tabInputValueMap[lowered];
        return replacement ?? "";
      });
    },
    [tabInputValueMap],
  );

  const resolveFiltersWithInputs = React.useCallback(
    (filters?: FilterRule[]) => {
      if (!filters || filters.length === 0) return undefined;
      return filters.map((filter) => ({
        ...filter,
        value: resolveTemplateString(filter.value),
        value2: resolveTemplateString(filter.value2),
      }));
    },
    [resolveTemplateString],
  );

  const serializeFiltersForKey = React.useCallback((filters?: FilterRule[]) => {
    if (!filters || filters.length === 0) {
      return "";
    }
    const normalized = filters
      .map((filter) => ({
        field: filter.field || "",
        op: filter.op,
        value: filter.value ?? "",
        value2: filter.value2 ?? "",
      }))
      .sort((a, b) => {
        if (a.field < b.field) return -1;
        if (a.field > b.field) return 1;
        if (a.op < b.op) return -1;
        if (a.op > b.op) return 1;
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        if (a.value2 < b.value2) return -1;
        if (a.value2 > b.value2) return 1;
        return 0;
      });
    return JSON.stringify(normalized);
  }, []);

  const getTableDataKey = React.useCallback(
    (
      connectionId: string,
      database: string,
      tableName: string,
      filters?: FilterRule[],
    ) => {
      const serialized = serializeFiltersForKey(filters);
      const filtersKey = serialized
        ? `.filters.${hashSQLQuery(serialized)}`
        : "";
      return `${connectionId}:${database}.${tableName}${filtersKey}`;
    },
    [serializeFiltersForKey],
  );

  const getSqlDataKey = React.useCallback(
    (connectionId: string, database: string, sql: string) => {
      const hash = hashSQLQuery(sql.trim());
      return `${connectionId}:${database}.sql.${hash}`;
    },
    [],
  );

  const configUsesTabInputs = React.useCallback((config: ChartConfig) => {
    if (config.sqlQuery && config.sqlQuery.includes("{{")) {
      return true;
    }
    if (
      config.filters &&
      config.filters.some(
        (filter) =>
          (filter.value && filter.value.includes("{{")) ||
          (filter.value2 && filter.value2.includes("{{")),
      )
    ) {
      return true;
    }
    return false;
  }, []);

  const tabInputSignature = React.useMemo(() => {
    if (!tabInputs.length) return "[]";
    const entries = tabInputs
      .map((input) => ({
        key: (input.key || "").trim().toLowerCase(),
        value: input.value ?? "",
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    return JSON.stringify(entries);
  }, [tabInputs]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSQLDialogOpen, setIsSQLDialogOpen] = useState(false);
  const [isMatrixDialogOpen, setIsMatrixDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChartConfig | undefined>();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewWidths, setPreviewWidths] = useState<Record<string, number>>(
    {},
  );
  const [isResizing, setIsResizing] = useState<string | null>(null);

  const totalWidth = React.useMemo(() => {
    let total = 0;
    let hasAnyWidth = false;

    configs.forEach((c) => {
      const w = previewWidths[c.id] ?? c.width;
      if (w !== undefined) {
        total += w;
        hasAnyWidth = true;
      }
    });

    if (!hasAnyWidth) {
      return 0;
    }

    // คำนวณ gap โดยประมาณ: gap-4 = 16px
    // ถ้ามี n กราฟ จะมี gap n-1 ช่อง
    // สมมติหน้าจอกว้าง 1280px: gap 1 ช่อง ≈ 1.25%
    // แต่เราใช้วิธีง่ายๆ: ถ้า total > 90% ให้ wrap (เหลือ 10% สำหรับ gap และ padding)
    return total;
  }, [configs, previewWidths]);

  const shouldUseNowrap = totalWidth === 0 || totalWidth <= 90;

  // Access saved connections for per-chart queries
  const { connections } = useConnections();

  // no local fetching spinner at page level
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [rowsByTable, setRowsByTable] = useState<Record<string, unknown[]>>({});
  const [loadingTables, setLoadingTables] = useState<Set<string>>(new Set());

  // Tables are fetched inside dialog per selected database

  const fetchColumns = async (
    connectionId: string,
    database: string,
    table: string,
  ) => {
    const key = `${connectionId}:${database}.${table}`;
    if (columns[key]) return;
    const conn = connections.find((c) => c.id === connectionId);
    if (!conn) return;
    const res = await fetch("/api/db/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: conn.type,
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database,
        table,
      }),
    });
    const data: ColumnsResponse = await res.json();
    setColumns((prev) => ({ ...prev, [key]: data.columns.map((c) => c.name) }));
  };

  const fetchRows = React.useCallback(
    async (
      connectionId: string,
      database: string,
      table: string,
      cols?: string[],
      filters?: FilterRule[],
      useLimit: boolean = true,
    ) => {
      const key = getTableDataKey(connectionId, database, table, filters);
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) return;

      setLoadingTables((prev) => new Set(prev).add(key));
      try {
        const body: Record<string, unknown> = {
          type: conn.type,
          host: conn.host,
          port: conn.port,
          user: conn.user,
          password: conn.password,
          database,
          table,
          columns: cols,
          filters,
        };

        // Only add limit if useLimit is true
        if (useLimit) {
          body.limit = 1000000;
        }

        const res = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { rows?: unknown[] };
        const newRows = data.rows ?? [];

        // Merge with existing data to preserve all columns
        setRowsByTable((prev) => {
          const existing = prev[key] as Record<string, unknown>[] | undefined;
          if (!existing || existing.length === 0) {
            return { ...prev, [key]: newRows };
          }

          // If new rows is empty or different length, prefer new data if it has more columns
          if (newRows.length === 0) {
            return prev; // Keep existing if new is empty
          }

          const existingKeys = existing[0]
            ? Object.keys(existing[0] as Record<string, unknown>)
            : [];
          const newKeys = newRows[0]
            ? Object.keys(newRows[0] as Record<string, unknown>)
            : [];

          // If new data has all existing keys, use it (it might have more columns)
          const hasAllExisting =
            existingKeys.length === 0 ||
            existingKeys.every((k) => {
              const exactMatch = newKeys.find((nk) => nk === k);
              const caseMatch = newKeys.find(
                (nk) => nk.toLowerCase() === k.toLowerCase(),
              );
              return exactMatch || caseMatch;
            });

          if (hasAllExisting) {
            // New data has all existing columns, use it directly
            return { ...prev, [key]: newRows };
          }

          // Merge: keep existing columns and add new ones
          const allKeys = Array.from(new Set([...existingKeys, ...newKeys]));
          const minLength = Math.min(existing.length, newRows.length);
          const merged: Record<string, unknown>[] = [];

          for (let idx = 0; idx < minLength; idx++) {
            const existingRow = existing[idx] as Record<string, unknown>;
            const newRow = newRows[idx] as Record<string, unknown>;
            const mergedRow: Record<string, unknown> = {};

            for (const k of allKeys) {
              // Prefer new value if exists, otherwise keep existing
              const newKey = newKeys.find(
                (nk) => nk === k || nk.toLowerCase() === k.toLowerCase(),
              );
              const existingKey = existingKeys.find(
                (ek) => ek === k || ek.toLowerCase() === k.toLowerCase(),
              );

              if (
                newKey &&
                newRow[newKey] !== undefined &&
                newRow[newKey] !== null
              ) {
                mergedRow[k] = newRow[newKey];
              } else if (
                existingKey &&
                existingRow[existingKey] !== undefined
              ) {
                mergedRow[k] = existingRow[existingKey];
              }
            }

            merged.push(mergedRow);
          }

          // Add remaining rows from whichever is longer
          if (existing.length > minLength) {
            merged.push(...existing.slice(minLength));
          } else if (newRows.length > minLength) {
            merged.push(
              ...(newRows.slice(minLength) as Record<string, unknown>[]),
            );
          }

          return { ...prev, [key]: merged.length > 0 ? merged : newRows };
        });

        return newRows as Record<string, unknown>[];
      } catch (e) {
        console.error("Error fetching rows:", e);
        return [];
      } finally {
        setLoadingTables((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [connections, getTableDataKey],
  );

  // if needed we can compute available fields per current dialog table

  const handleAddChart = () => {
    setEditingConfig(undefined);
    setIsDialogOpen(true);
  };

  const handleAddSQLChart = () => {
    setEditingConfig(undefined);
    setIsSQLDialogOpen(true);
  };

  const handleOpenAiDialog = () => {
    setIsAiDialogOpen(true);
  };

  const fetchSQLRows = React.useCallback(
    async (
      connectionId: string,
      database: string,
      sqlQuery: string,
      useLimit: boolean = true,
    ) => {
      const resolvedSql = (resolveTemplateString(sqlQuery) ?? "").trim();
      const key = getSqlDataKey(connectionId, database, resolvedSql || "");
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) return;

      setLoadingTables((prev) => new Set(prev).add(key));
      try {
        if (!resolvedSql) {
          setRowsByTable((prev) => ({ ...prev, [key]: [] }));
          return [];
        }

        const body: Record<string, unknown> = {
          type: conn.type,
          host: conn.host,
          port: conn.port,
          user: conn.user,
          password: conn.password,
          database,
          sql: resolvedSql,
        };

        // Only add limit if useLimit is true
        if (useLimit) {
          body.limit = 1000000;
        }

        const res = await fetch("/api/db/query-sql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { rows?: unknown[] };
        const newRows = data.rows ?? [];
        setRowsByTable((prev) => ({ ...prev, [key]: newRows }));
        return newRows as Record<string, unknown>[];
      } catch (e) {
        console.error("Error fetching SQL rows:", e);
        return [];
      } finally {
        setLoadingTables((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [connections, getSqlDataKey, resolveTemplateString],
  );

  const handleDuplicateChart = (config: ChartConfig) => {
    const currentIndex = configs.findIndex((c) => c.id === config.id);
    const nextIndex = currentIndex !== -1 ? currentIndex + 1 : configs.length;
    const duplicatedConfig: Omit<ChartConfig, "id"> = {
      ...config,
      title: `${config.title} (สำเนา)`,
    };
    insertChart(duplicatedConfig, nextIndex);
    // Fetch data for the duplicated chart
    if (config.sqlQuery && config.connectionId && config.database) {
      fetchSQLRows(config.connectionId, config.database, config.sqlQuery);
    } else if (config.connectionId && config.database && config.tableName) {
      const resolvedFilters = resolveFiltersWithInputs(config.filters);
      const neededCols = Array.from(
        new Set(
          [
            ...(config.columns || []),
            config.xAxisKey || "",
            config.yAxisKey || "",
            config.groupByKey || "",
            config.seriesKey || "",
          ].filter(Boolean) as string[],
        ),
      );
      fetchRows(
        config.connectionId,
        config.database,
        config.tableName,
        neededCols.length ? neededCols : undefined,
        resolvedFilters,
      );
    }
  };
  const handleSaveChart = (config: Omit<ChartConfig, "id">) => {
    if (editingConfig) updateChart(editingConfig.id, config);
    else addChart(config);
    setIsDialogOpen(false);
    setEditingConfig(undefined);
    // load rows for this chart's table if possible
    const cfg = config as Partial<ChartConfig> & { tableName?: string };
    if (cfg.connectionId && cfg.database && cfg.tableName) {
      const resolvedFilters = resolveFiltersWithInputs(config.filters);
      const neededCols = Array.from(
        new Set(
          [
            ...(config.columns || []),
            cfg.xAxisKey || "",
            cfg.yAxisKey || "",
          ].filter(Boolean) as string[],
        ),
      );
      fetchRows(
        cfg.connectionId,
        cfg.database,
        cfg.tableName,
        neededCols.length ? neededCols : undefined,
        resolvedFilters,
      );
    }
  };

  const handleSaveSQLChart = (config: Omit<ChartConfig, "id">) => {
    if (editingConfig) updateChart(editingConfig.id, config);
    else addChart(config);
    setIsSQLDialogOpen(false);
    setEditingConfig(undefined);
    // load rows for SQL query
    if (config.connectionId && config.database && config.sqlQuery) {
      fetchSQLRows(config.connectionId, config.database, config.sqlQuery);
    }
  };

  const handleSaveMatrixChart = (config: Omit<ChartConfig, "id">) => {
    if (editingConfig) updateChart(editingConfig.id, config);
    else addChart(config);
    setIsMatrixDialogOpen(false);
    setEditingConfig(undefined);
    // load rows for SQL query
    if (config.connectionId && config.database && config.sqlQuery) {
      fetchSQLRows(config.connectionId, config.database, config.sqlQuery);
    }
  };

  // Scroll to chart when hash is present
  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#chart-")) {
      const chartId = hash.replace("#chart-", "");
      setTimeout(() => {
        const element = document.getElementById(`chart-${chartId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          // Add highlight effect
          element.classList.add("ring-2", "ring-primary/50");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary/50");
          }, 2000);
        }
      }, 500); // Wait for charts to render
    }
  }, [configs]);

  useEffect(() => {
    if (!configs?.length || !connections?.length) return;
    const pending: Array<Promise<void>> = [];
    for (const c of configs) {
      // Fetch columns for table-based charts to populate availableFields
      if (c.connectionId && c.database && c.tableName) {
        fetchColumns(c.connectionId, c.database, c.tableName);
      }
      // Handle SQL query charts (including matrix)
      if (c.connectionId && c.database && c.sqlQuery) {
        const resolvedSql = (resolveTemplateString(c.sqlQuery) ?? "").trim();
        const key = getSqlDataKey(
          c.connectionId,
          c.database,
          resolvedSql || "",
        );
        const existingData = rowsByTable[key] as
          | Record<string, unknown>[]
          | undefined;
        if (!existingData || existingData.length === 0) {
          pending.push(
            fetchSQLRows(c.connectionId, c.database, c.sqlQuery).then(
              () => undefined,
            ),
          );
        }
        continue;
      }
      // Handle table-based charts
      if (c.connectionId && c.database && c.tableName) {
        const resolvedFilters = resolveFiltersWithInputs(c.filters);
        const key = getTableDataKey(
          c.connectionId,
          c.database,
          c.tableName,
          resolvedFilters,
        );
        const neededCols = Array.from(
          new Set(
            [
              ...(c.columns || []),
              c.xAxisKey || "",
              c.yAxisKey || "",
              c.groupByKey || "",
              c.seriesKey || "",
            ].filter(Boolean) as string[],
          ),
        );

        // Check if we already have complete data
        const existingData = rowsByTable[key] as
          | Record<string, unknown>[]
          | undefined;
        if (existingData && existingData.length > 0) {
          const firstRow = existingData[0] as Record<string, unknown>;
          const existingKeys = Object.keys(firstRow);
          const hasAllNeeded =
            neededCols.length === 0 ||
            neededCols.every((col) => {
              const exactMatch = existingKeys.find((k) => k === col);
              const caseMatch = existingKeys.find(
                (k) => k.toLowerCase() === col.toLowerCase(),
              );
              return exactMatch || caseMatch;
            });
          if (hasAllNeeded) {
            continue; // Skip fetching if we already have all needed columns
          }
        }

        pending.push(
          fetchRows(
            c.connectionId,
            c.database,
            c.tableName,
            neededCols.length ? neededCols : undefined,
            resolvedFilters,
          ).then(() => undefined),
        );
      }
    }
    if (pending.length) {
      void Promise.allSettled(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, connections.length]);

  useEffect(() => {
    if (!configs?.length || !connections?.length) return;
    if (!tabInputsLoaded) return;
    const pending: Array<Promise<void>> = [];
    for (const config of configs) {
      if (!configUsesTabInputs(config)) continue;
      if (config.sqlQuery && config.connectionId && config.database) {
        pending.push(
          fetchSQLRows(
            config.connectionId,
            config.database,
            config.sqlQuery,
          ).then(() => undefined),
        );
        continue;
      }
      if (config.connectionId && config.database && config.tableName) {
        const resolvedFilters = resolveFiltersWithInputs(config.filters);
        const neededCols = Array.from(
          new Set(
            [
              ...(config.columns || []),
              config.xAxisKey || "",
              config.yAxisKey || "",
              config.groupByKey || "",
              config.seriesKey || "",
            ].filter(Boolean) as string[],
          ),
        );
        pending.push(
          fetchRows(
            config.connectionId,
            config.database,
            config.tableName,
            neededCols.length ? neededCols : undefined,
            resolvedFilters,
          ).then(() => undefined),
        );
      }
    }
    if (pending.length) {
      void Promise.allSettled(pending);
    }
  }, [
    configs,
    connections.length,
    tabInputSignature,
    tabInputsLoaded,
    configUsesTabInputs,
    resolveFiltersWithInputs,
    fetchRows,
    fetchSQLRows,
  ]);

  return (
    <div className="p-5 space-y-4 relative" data-content-container>
      {/* Notes overlay - positioned relative to content container */}
      {notesLoaded && notesVisible && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {notes.map((note) => (
            <div key={note.id} className="pointer-events-auto">
              <NoteComponent
                note={note}
                onUpdate={updateNote}
                onDelete={removeNote}
                isLocked={isLocked}
                currentUserId={userInfo?.user_id || userInfo?.email || ""}
                currentUserName={userInfo?.name || userInfo?.en_name || ""}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold break-all">{tabName}</div>
        {!isLocked && (
          <div className="flex gap-2">
            <Button onClick={handleAddChart}>
              <Plus className="h-4 w-4 mr-2" /> เพิ่มกราฟ
            </Button>
            <Button onClick={handleAddSQLChart} variant="outline">
              <Database className="h-4 w-4 mr-2" /> เพิ่ม SQL กราฟ
            </Button>
            <Button
              onClick={handleOpenAiDialog}
              className="bg-linear-to-r from-purple-500 via-pink-500 to-orange-500 text-white shadow-md hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 hover:shadow-lg transition-all duration-300 border-0"
            >
              <Sparkles className="h-4 w-4 mr-2" /> ใช้ AI ช่วยสร้าง
            </Button>
          </div>
        )}
      </div>

      {(tabInputs.length > 0 || (!isLocked && tabInputsLoaded)) && (
        <TabInputsPanel
          inputs={tabInputs}
          isLocked={isLocked}
          isLoaded={tabInputsLoaded}
          allowValueEditingWhenLocked
          onAddInput={() => {
            addTabInput();
          }}
          onUpdateInput={updateTabInput}
          onRemoveInput={removeTabInput}
          onSetValue={setTabInputValue}
        />
      )}

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">ยังไม่มีกราฟในหน้านี้</p>
          {!isLocked && (
            <Button onClick={handleAddChart} variant="outline">
              <Plus className="h-4 w-4 mr-2" /> เพิ่มกราฟแรก
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`flex flex-col md:flex-row items-start ${
            shouldUseNowrap ? "md:flex-nowrap md:gap-2" : "md:flex-wrap gap-4"
          }`}
        >
          {configs.map((config, index) => {
            const hasSqlSource =
              !!config.sqlQuery && !!config.connectionId && !!config.database;
            const hasTableSource =
              !!config.tableName && !!config.connectionId && !!config.database;

            const resolvedSqlForConfig = hasSqlSource
              ? (resolveTemplateString(config.sqlQuery) ?? "").trim()
              : "";

            const resolvedFiltersForConfig = hasTableSource
              ? resolveFiltersWithInputs(config.filters)
              : undefined;

            let dataKey: string | null = null;
            if (hasSqlSource) {
              dataKey = getSqlDataKey(
                config.connectionId!,
                config.database!,
                resolvedSqlForConfig || "",
              );
            } else if (hasTableSource) {
              dataKey = getTableDataKey(
                config.connectionId!,
                config.database!,
                config.tableName!,
                resolvedFiltersForConfig,
              );
            }
            const isLoading = dataKey ? loadingTables.has(dataKey) : false;
            const hasWidth =
              previewWidths[config.id] !== undefined ||
              config.width !== undefined;

            return (
              <div
                key={config.id}
                className={`w-full ${
                  isMobile
                    ? ""
                    : hasWidth
                    ? "md:w-auto md:shrink"
                    : shouldUseNowrap
                    ? "md:flex-1 md:min-w-0"
                    : "md:flex-1 md:max-w-[calc(50%-8px)] md:min-w-[300px]"
                }`}
                style={{
                  ...(isMobile
                    ? { width: "100%" }
                    : previewWidths[config.id] !== undefined
                    ? { width: `${previewWidths[config.id]}%` }
                    : config.width !== undefined
                    ? { width: `${config.width}%` }
                    : {}),
                  maxWidth: "100%",
                  flexShrink: 1,
                }}
                onDragOver={(e) => {
                  if (isLocked) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  if (isLocked) return;
                  e.preventDefault();
                  const draggedChartId = e.dataTransfer.getData("text/plain");
                  if (draggedChartId && draggedChartId !== config.id) {
                    const draggedIndex = configs.findIndex(
                      (c) => c.id === draggedChartId,
                    );
                    if (draggedIndex !== -1 && draggedIndex !== index) {
                      reorderCharts(draggedIndex, index);
                    }
                  }
                  setDraggedId(null);
                }}
              >
                <ChartRenderer
                  config={config}
                  data={
                    dataKey
                      ? (rowsByTable[dataKey] as Record<string, unknown>[]) ??
                        []
                      : []
                  }
                  isLoading={isLoading}
                  onFetchAllData={
                    config.sqlQuery && config.connectionId && config.database
                      ? async () => {
                          return (
                            (await fetchSQLRows(
                              config.connectionId!,
                              config.database!,
                              config.sqlQuery!,
                              false, // Don't use limit - fetch all data
                            )) ?? []
                          );
                        }
                      : config.tableName &&
                        config.connectionId &&
                        config.database
                      ? async () => {
                          const latestFilters = resolveFiltersWithInputs(
                            config.filters,
                          );
                          return (
                            (await fetchRows(
                              config.connectionId!,
                              config.database!,
                              config.tableName!,
                              config.columns,
                              latestFilters,
                              false, // Don't use limit - fetch all data
                            )) ?? []
                          );
                        }
                      : undefined
                  }
                  onUpdate={
                    isLocked
                      ? undefined
                      : (id, updates, skipHistory) => {
                          if (updates.width !== undefined) {
                            setPreviewWidths((prev) => ({
                              ...prev,
                              [id]: updates.width as number,
                            }));
                            setIsResizing(id);
                          } else {
                            setIsResizing(null);
                          }
                          // Pass skipHistory flag to updateChart
                          updateChart(id, updates, skipHistory);
                        }
                  }
                  previewWidth={previewWidths[config.id]}
                  isResizing={isResizing === config.id}
                  onEdit={
                    isLocked
                      ? undefined
                      : (c) => {
                          setEditingConfig(c);
                          if (c.type === "matrix") {
                            setIsMatrixDialogOpen(true);
                          } else if (c.sqlQuery) {
                            setIsSQLDialogOpen(true);
                          } else if (c.type === "markdown") {
                            setIsDialogOpen(true);
                          } else if (
                            c.connectionId &&
                            c.database &&
                            c.tableName
                          ) {
                            fetchColumns(
                              c.connectionId,
                              c.database,
                              c.tableName,
                            );
                            const resolvedFiltersForEdit =
                              resolveFiltersWithInputs(c.filters);
                            fetchRows(
                              c.connectionId,
                              c.database,
                              c.tableName,
                              c.columns,
                              resolvedFiltersForEdit,
                            );
                            setIsDialogOpen(true);
                          }
                        }
                  }
                  onDuplicate={isLocked ? undefined : handleDuplicateChart}
                  onDelete={isLocked ? undefined : removeChart}
                  onDragStart={isLocked ? undefined : (id) => setDraggedId(id)}
                  onDragEnd={isLocked ? undefined : () => setDraggedId(null)}
                  isDragging={draggedId === config.id}
                  dragIndex={
                    draggedId
                      ? configs.findIndex((c) => c.id === draggedId)
                      : undefined
                  }
                  index={index}
                  availableFields={
                    config.sqlQuery && config.connectionId && config.database
                      ? // For SQL charts, get fields from the data itself
                        dataKey &&
                        rowsByTable[dataKey] &&
                        rowsByTable[dataKey].length > 0
                        ? Object.keys(
                            rowsByTable[dataKey][0] as Record<string, unknown>,
                          )
                        : []
                      : config.tableName &&
                        config.connectionId &&
                        config.database
                      ? columns[
                          `${config.connectionId}:${config.database}.${config.tableName}`
                        ] || []
                      : []
                  }
                  onFilterChange={(id, filters) => {
                    const cfg = configs.find((c) => c.id === id);
                    if (!cfg) return;
                    // Only update config if not locked (save filters to config)
                    if (!isLocked) {
                      updateChart(id, { filters });
                    }
                    const resolvedFilters = resolveFiltersWithInputs(filters);
                    // Refetch data with filters (works in both locked and unlocked mode)
                    if (cfg.sqlQuery && cfg.connectionId && cfg.database) {
                      fetchSQLRows(
                        cfg.connectionId,
                        cfg.database,
                        cfg.sqlQuery,
                      );
                    } else if (
                      cfg.connectionId &&
                      cfg.database &&
                      cfg.tableName
                    ) {
                      const neededCols = Array.from(
                        new Set(
                          [
                            ...(cfg.columns || []),
                            cfg.xAxisKey || "",
                            cfg.yAxisKey || "",
                            cfg.groupByKey || "",
                            cfg.seriesKey || "",
                          ].filter(Boolean) as string[],
                        ),
                      );
                      fetchRows(
                        cfg.connectionId,
                        cfg.database,
                        cfg.tableName,
                        neededCols.length ? neededCols : undefined,
                        resolvedFilters,
                      );
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <ChartConfigDialog
        key={(editingConfig?.id || "new") + String(isDialogOpen)}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        config={editingConfig}
        onSave={(c) => handleSaveChart(c)}
        onTableChange={() => {}}
      />

      <SQLQueryDialog
        key={(editingConfig?.id || "new") + String(isSQLDialogOpen)}
        open={isSQLDialogOpen}
        onOpenChange={setIsSQLDialogOpen}
        config={editingConfig}
        onSave={(c) => handleSaveSQLChart(c)}
      />

      <MatrixDialog
        key={(editingConfig?.id || "new") + String(isMatrixDialogOpen)}
        open={isMatrixDialogOpen}
        onOpenChange={setIsMatrixDialogOpen}
        config={editingConfig}
        onSave={(c) => handleSaveMatrixChart(c)}
      />

      <AiChartDialog
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        tabId={tabId}
        pagePath={pagePath}
        onFetchSQLRows={fetchSQLRows}
      />
    </div>
  );
}
