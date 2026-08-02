import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await getDatabase().execute(sql`select 1`);
    return NextResponse.json({ database: "connected", status: "ok" });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      { database: "unavailable", status: "error" },
      { status: 503 },
    );
  }
}
