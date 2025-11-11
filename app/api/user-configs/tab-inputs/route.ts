import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { TabInput } from "@/types/tab-input";

const COLLECTION_NAME = "tab_inputs";

// GET /api/user-configs/tab-inputs?tabId=...
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tabId = searchParams.get("tabId");

    if (!tabId) {
      return NextResponse.json(
        { error: "tabId is required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const doc = await collection.findOne<{ inputs?: TabInput[] }>({ tabId });
    if (!doc) {
      return NextResponse.json({ tabId, inputs: [] });
    }

    return NextResponse.json({
      tabId,
      inputs: doc.inputs || [],
    });
  } catch (error) {
    console.error("Error fetching tab inputs:", error);
    return NextResponse.json(
      { error: "Failed to fetch tab inputs" },
      { status: 500 },
    );
  }
}

// POST /api/user-configs/tab-inputs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabId, inputs } = body as { tabId?: string; inputs?: TabInput[] };

    if (!tabId) {
      return NextResponse.json(
        { error: "tabId is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(inputs)) {
      return NextResponse.json(
        { error: "inputs must be an array" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const now = new Date().toISOString();
    const sanitizedInputs = inputs.map((input, index) => ({
      ...input,
      tabId,
      order: index,
      updatedAt: now,
      createdAt: input.createdAt || now,
    }));

    await collection.updateOne(
      { tabId },
      {
        $set: {
          tabId,
          inputs: sanitizedInputs,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving tab inputs:", error);
    return NextResponse.json(
      { error: "Failed to save tab inputs" },
      { status: 500 },
    );
  }
}

