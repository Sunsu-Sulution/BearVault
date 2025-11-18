import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// GET /api/user-configs/export
export async function GET() {
  try {
    const db = await getDb();

    // Get all chart configs
    const chartConfigsCollection = db.collection("chart_configs");
    const chartConfigsDocs = await chartConfigsCollection.find({}).toArray();
    const chartConfigs: Record<string, unknown> = {};
    chartConfigsDocs.forEach((doc) => {
      const storageKey = `chart_configs_${doc.pagePath}`;
      chartConfigs[storageKey] = { charts: doc.charts || [] };
    });

    // Get dashboard tabs and groups
    const dashboardTabsCollection = db.collection("dashboard_tabs");
    const dashboardTabsDoc = await dashboardTabsCollection.findOne({
      id: "default",
    });
    const tabs = dashboardTabsDoc ? { 
      tabs: dashboardTabsDoc.tabs || [],
      groups: dashboardTabsDoc.groups || []
    } : null;

    // Get connections
    const connectionsCollection = db.collection("db_connections");
    const connectionsDoc = await connectionsCollection.findOne({
      id: "default",
    });
    const connections = connectionsDoc
      ? {
          connections: connectionsDoc.connections || [],
          activeId: connectionsDoc.activeId,
        }
      : null;

    const exportData = {
      tabs,
      connections,
      chartConfigs,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Error exporting configs:", error);
    return NextResponse.json(
      { error: "Failed to export configs" },
      { status: 500 }
    );
  }
}

