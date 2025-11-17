import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ChartConfig, ChartType } from "@/types/chart";

type DashboardTab = {
    id: string;
    name: string;
    createdAt: string;
    isPublic: boolean;
};

type TabGroup = {
    id: string;
    name: string;
    tabIds: string[];
};

const TABS_COLLECTION = "dashboard_tabs";
const CHARTS_COLLECTION = "chart_configs";

const slugify = (name: string) => {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
    return base || `tab-${Date.now()}`;
};

const ensureUniqueSlug = (slug: string, existing: Set<string>) => {
    if (!existing.has(slug)) return slug;
    let counter = 1;
    let next = `${slug}-${counter}`;
    while (existing.has(next)) {
        counter += 1;
        next = `${slug}-${counter}`;
    }
    return next;
};

const sanitizeToEnglish = (value: string, fallback: string): string => {
    const ascii = value
        .normalize("NFKD")
        .replace(/[^ -]/g, "")
        .replace(/[^a-zA-Z0-9\s-_]/g, "")
        .trim()
        .replace(/\s+/g, " ");
    return ascii || fallback;
};

const enforceHalfWidth = (chart: ChartConfig): ChartConfig => ({
    ...chart,
    width: chart.type === "table" ? 100 : 49,
});

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as {
            currentTabId?: string;
            mode?: "append" | "new-tab";
            targetTabName?: string;
            tabName?: string;
            sql?: string;
            columns?: string[];
            connectionId?: string;
            database?: string;
            question?: string;
            chartSuggestions?: Array<{
                type: ChartType;
                title?: string;
                xAxisKey?: string;
                yAxisKey?: string;
                seriesKey?: string;
                groupByKey?: string;
                aggregate?: "sum" | "count" | "avg";
                columns?: string[];
            }>;
        };

        const {
            currentTabId,
            mode,
            targetTabName,
            tabName,
            sql,
            columns,
            connectionId,
            database,
            question,
            chartSuggestions,
        } = body;

        if (!sql || !connectionId || !database) {
            return NextResponse.json(
                { error: "sql, connectionId, and database are required" },
                { status: 400 },
            );
        }

        const normalizedMode = mode === "new-tab" ? "new-tab" : "append";
        if (normalizedMode === "append" && !currentTabId) {
            return NextResponse.json(
                { error: "currentTabId is required when appending to an existing tab" },
                { status: 400 },
            );
        }

        const db = await getDb();

        const tabsCollection = db.collection<{
            id: string;
            tabs: DashboardTab[];
            groups: TabGroup[];
        }>(TABS_COLLECTION);

        const importsCollection = db.collection<{
            id: string;
            tabs: DashboardTab[];
            groups: TabGroup[];
        }>("dashboard_tabs_import");

        const chartsCollection = db.collection<{
            pagePath: string;
            charts: ChartConfig[];
        }>(CHARTS_COLLECTION);

        const savedDoc = await tabsCollection.findOne({ id: "default" });
        const importedDoc = await importsCollection.findOne({ id: "default" });

        const tabsDoc = savedDoc || importedDoc || {
            id: "default",
            tabs: [],
            groups: [],
        };

        const existingIds = new Set(tabsDoc.tabs.map((t) => t.id));
        const safeDisplayName = tabName
            ? sanitizeToEnglish(tabName, "AI Dashboard")
            : undefined;

        let targetSlug: string;
        let createdTabName: string | undefined;

        if (normalizedMode === "new-tab") {
            const requestedName = sanitizeToEnglish(
                targetTabName || safeDisplayName || "AI Dashboard",
                "AI Dashboard",
            );
            const baseId = slugify(requestedName);
            const slug = ensureUniqueSlug(baseId.slice(0, 60), existingIds);
            const newTab: DashboardTab = {
                id: slug,
                name: requestedName,
                createdAt: new Date().toISOString(),
                isPublic: false,
            };

            const nextTabs = [...tabsDoc.tabs.filter((tab) => tab.id !== slug), newTab];

            await tabsCollection.updateOne(
                { id: "default" },
                {
                    $set: {
                        id: "default",
                        tabs: nextTabs,
                        groups: tabsDoc.groups || [],
                        updatedAt: new Date(),
                    },
                },
                { upsert: true },
            );

            await importsCollection.updateOne(
                { id: "default" },
                {
                    $set: {
                        id: "default",
                        tabs: nextTabs,
                        groups: tabsDoc.groups || [],
                        updatedAt: new Date(),
                    },
                },
                { upsert: true },
            );

            targetSlug = slug;
            createdTabName = requestedName;
        } else {
            targetSlug = currentTabId as string;
        }

        const pagePath = `/dashboard/${targetSlug}`;
        const safeTabNameForCharts = safeDisplayName ?? createdTabName;

        const normalizedColumns = Array.isArray(columns) && columns.length > 0
            ? columns
                .map((col) => (typeof col === "string" ? col : String(col)))
                .filter((col) => col.trim().length > 0)
            : [];

        const normalizedSuggestions = Array.isArray(chartSuggestions)
            ? chartSuggestions.filter((chart) => {
                if (!chart) return false;
                if (chart.type === "table") {
                    return true;
                }
                if (chart.type === "matrix") {
                    return Array.isArray(chart.columns) && chart.columns.length > 0;
                }
                return (
                    typeof chart.xAxisKey === "string" &&
                    typeof chart.yAxisKey === "string"
                );
            })
            : [];

        const existingChartDoc = await chartsCollection.findOne({ pagePath });
        const existingCharts = existingChartDoc?.charts ?? [];

        const charts: ChartConfig[] = [];

        const buildChartId = () =>
            `chart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        for (const chart of normalizedSuggestions) {
            if (chart.type === "table") {
                const tableColumns = normalizedColumns.length
                    ? normalizedColumns
                    : chartSuggestions && chartSuggestions.length
                        ? Array.from(
                            new Set(
                                chartSuggestions
                                    .map((suggestion) => [
                                        suggestion?.xAxisKey,
                                        suggestion?.yAxisKey,
                                        suggestion?.seriesKey,
                                        suggestion?.groupByKey,
                                    ])
                                    .flat()
                                    .filter(Boolean) as string[],
                            ),
                        )
                        : [];

                charts.push(
                    enforceHalfWidth({
                        id: buildChartId(),
                        title: sanitizeToEnglish(chart.title || "AI Table", "AI Table"),
                        type: "table",
                        height: 520,
                        connectionId,
                        database,
                        sqlQuery: sql,
                        columns: tableColumns,
                        aiGenerated: true,
                    }),
                );
                continue;
            }

            if (chart.type === "matrix") {
                const matrixColumns =
                    (Array.isArray(chart.columns) && chart.columns.length > 0
                        ? chart.columns
                        : normalizedColumns).filter(Boolean);

                if (!matrixColumns.length) {
                    continue;
                }

                charts.push(
                    enforceHalfWidth({
                        id: buildChartId(),
                        title: sanitizeToEnglish(chart.title || "AI Metric", "AI Metric"),
                        type: "matrix",
                        height: 320,
                        connectionId,
                        database,
                        sqlQuery: sql,
                        columns: matrixColumns,
                        aiGenerated: true,
                    }),
                );
                continue;
            }

            const chartColumns = normalizedColumns.length
                ? normalizedColumns
                : Array.from(
                    new Set(
                        [
                            chart.xAxisKey,
                            chart.yAxisKey,
                            chart.seriesKey,
                            chart.groupByKey,
                        ].filter(Boolean) as string[],
                    ),
                );

            charts.push(
                enforceHalfWidth({
                    id: buildChartId(),
                    title: sanitizeToEnglish(chart.title || "AI Chart", "AI Chart"),
                    type: chart.type,
                    height: 480,
                    connectionId,
                    database,
                    sqlQuery: sql,
                    columns: chartColumns,
                    xAxisKey: chart.xAxisKey,
                    yAxisKey: chart.yAxisKey,
                    seriesKey: chart.seriesKey,
                    groupByKey: chart.groupByKey,
                    aggregate: chart.aggregate || "sum",
                    sortBy: chart.yAxisKey,
                    sortOrder: "desc",
                    aiGenerated: true,
                }),
            );
        }

        const tableColumns = normalizedColumns.length > 0
            ? normalizedColumns
            : Array.from(
                new Set(
                    normalizedSuggestions.length > 0
                        ? [
                            normalizedSuggestions[0].xAxisKey,
                            normalizedSuggestions[0].yAxisKey,
                            normalizedSuggestions[0].seriesKey,
                            normalizedSuggestions[0].groupByKey,
                        ].filter(Boolean) as string[]
                        : [],
                ),
            );

        if (!charts.some((chart) => chart.type === "table")) {
            charts.push(
                enforceHalfWidth({
                    id: buildChartId(),
                    title:
                        normalizedSuggestions.length && normalizedSuggestions[0]?.title
                            ? `${sanitizeToEnglish(normalizedSuggestions[0].title || "AI Table", "AI Table")} (Table)`
                            : `${sanitizeToEnglish(safeTabNameForCharts ?? targetSlug, "AI Table")} (Table)`,
                    type: "table",
                    height: 520,
                    connectionId,
                    database,
                    sqlQuery: sql,
                    columns: tableColumns,
                    aiGenerated: true,
                }),
            );
        }

        const finalCharts = [...existingCharts, ...charts];

        await chartsCollection.updateOne(
            { pagePath },
            {
                $set: {
                    pagePath,
                    charts: finalCharts,
                    question: question || "",
                    updatedAt: new Date(),
                },
            },
            { upsert: true },
        );

        return NextResponse.json({ success: true, tabId: targetSlug });
    } catch (error) {
        console.error("Error generating dashboard:", error);
        return NextResponse.json(
            { error: "Failed to generate dashboard" },
            { status: 500 },
        );
    }
}

