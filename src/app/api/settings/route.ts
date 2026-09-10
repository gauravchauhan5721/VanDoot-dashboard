import { db } from "@/db";
import { dashboardSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(dashboardSettings)
      .where(eq(dashboardSettings.id, "default"));
    return NextResponse.json(row?.value || null);
  } catch {
    return NextResponse.json(
      { error: "Settings database unavailable" },
      { status: 503 },
    );
  }
}
export async function PUT(request: Request) {
  try {
    const value = await request.json();
    if (
      !["demo", "live"].includes(value.mode) ||
      !["dark", "light"].includes(value.theme) ||
      !["metric", "imperial"].includes(value.units) ||
      !Number.isFinite(value.refreshInterval) ||
      value.refreshInterval < 2 ||
      value.refreshInterval > 300 ||
      !value.thresholds ||
      !value.nodeOverrides ||
      typeof value.gatewayName !== "string"
    )
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    for (const [key, protocols] of [
      ["apiEndpoint", ["http:", "https:"]],
      ["wsEndpoint", ["ws:", "wss:"]],
    ] as const) {
      if (typeof value[key] !== "string")
        return NextResponse.json(
          { error: "Invalid endpoint" },
          { status: 400 },
        );
      if (value[key]) {
        const url = new URL(value[key]);
        if (
          !protocols.some((p) => p === url.protocol) ||
          url.username ||
          url.password
        )
          return NextResponse.json(
            { error: "Endpoint must not contain credentials" },
            { status: 400 },
          );
      }
    }
    for (const threshold of Object.values(value.thresholds) as {
      warning: number;
      critical: number;
      direction: string;
    }[]) {
      if (
        !Number.isFinite(threshold.warning) ||
        !Number.isFinite(threshold.critical) ||
        !["above", "below"].includes(threshold.direction) ||
        (threshold.direction === "above"
          ? threshold.critical <= threshold.warning
          : threshold.critical >= threshold.warning)
      )
        return NextResponse.json(
          { error: "Invalid alert threshold order" },
          { status: 400 },
        );
    }
    await db
      .insert(dashboardSettings)
      .values({ id: "default", value })
      .onConflictDoUpdate({
        target: dashboardSettings.id,
        set: { value, updatedAt: new Date() },
      });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to save settings. Check endpoint format and database connection.",
      },
      { status: 400 },
    );
  }
}
