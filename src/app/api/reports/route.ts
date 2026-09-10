import { db } from "@/db";
import { reports } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    return NextResponse.json(
      await db
        .select()
        .from(reports)
        .orderBy(desc(reports.createdAt))
        .limit(100),
    );
  } catch {
    return NextResponse.json(
      { error: "Report storage unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      typeof body.title !== "string" ||
      body.title.length > 160 ||
      !["demo", "live"].includes(body.mode) ||
      !body.summary ||
      JSON.stringify(body.summary).length > 200000
    )
      return NextResponse.json({ error: "Invalid report" }, { status: 400 });
    const [row] = await db
      .insert(reports)
      .values({
        id: crypto.randomUUID(),
        title: body.title,
        mode: body.mode,
        summary: body.summary,
      })
      .returning();
    return NextResponse.json(row);
  } catch {
    return NextResponse.json(
      { error: "Unable to generate report" },
      { status: 503 },
    );
  }
}
