import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// POST /api/user-configs/import
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabs, connections, chartConfigs } = body as {
      tabs?: { tabs: unknown[]; groups?: unknown[] };
      connections?: { connections: unknown[]; activeId?: string };
      chartConfigs?: Record<string, unknown>;
    };

    const db = await getDb();

    // Import chart configs
    if (chartConfigs) {
      const chartConfigsCollection = db.collection("chart_configs");
      for (const [key, value] of Object.entries(chartConfigs)) {
        const pagePath = key.replace("chart_configs_", "");
        const data = value as { charts?: unknown[] };
        await chartConfigsCollection.updateOne(
          { pagePath },
          {
            $set: {
              pagePath,
              charts: data.charts || [],
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }

    // Import dashboard tabs and groups
    if (tabs) {
      const dashboardTabsCollection = db.collection("dashboard_tabs");
      await dashboardTabsCollection.updateOne(
        { id: "default" },
        {
          $set: {
            id: "default",
            tabs: tabs.tabs || [],
            groups: tabs.groups || [],
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // Import connections
    if (connections) {
      const connectionsCollection = db.collection("db_connections");
      await connectionsCollection.updateOne(
        { id: "default" },
        {
          $set: {
            id: "default",
            connections: connections.connections || [],
            activeId: connections.activeId,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error importing configs:", error);
    return NextResponse.json(
      { error: "Failed to import configs" },
      { status: 500 }
    );
  }
}

