import { db } from "@/db";
import { commandHistory } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
const allowed = [
  "Ping Node",
  "Restart Node",
  "Request sensor reading",
  "Change sampling interval",
  "Change transmission interval",
  "Restart Gateway",
  "Send configuration",
  "Enable sensor",
  "Disable sensor",
];
export async function GET() {
  try {
    return NextResponse.json(
      await db
        .select()
        .from(commandHistory)
        .orderBy(desc(commandHistory.createdAt))
        .limit(100),
    );
  } catch {
    return NextResponse.json(
      { error: "Command storage unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.mode !== "demo")
      return NextResponse.json(
        {
          error:
            "Live commands must use the configured gateway API. No command sent.",
        },
        { status: 400 },
      );
    if (
      typeof body.target !== "string" ||
      body.target.length > 100 ||
      !allowed.includes(body.command)
    )
      return NextResponse.json({ error: "Invalid command" }, { status: 400 });
    const row = {
      id: crypto.randomUUID(),
      target: body.target,
      command:
        body.command +
        (body.value ? ` (${String(body.value).slice(0, 200)})` : ""),
      status: "simulated",
      message: `DEMO · ${body.command} simulated for ${body.target}. No hardware command was sent.`,
    };
    const [saved] = await db.insert(commandHistory).values(row).returning();
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json(
      { error: "Unable to record simulated command" },
      { status: 503 },
    );
  }
}
