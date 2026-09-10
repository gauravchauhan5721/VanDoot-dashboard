import { db } from "@/db";
import { alertActions } from "@/db/schema";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    return NextResponse.json(await db.select().from(alertActions));
  } catch {
    return NextResponse.json(
      { error: "Alert storage unavailable" },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const { id, state } = await request.json();
    if (
      typeof id !== "string" ||
      id.length > 200 ||
      !["acknowledged", "resolved"].includes(state)
    )
      return NextResponse.json(
        { error: "Invalid alert action" },
        { status: 400 },
      );
    await db
      .insert(alertActions)
      .values({ id, state })
      .onConflictDoUpdate({
        target: alertActions.id,
        set: { state, updatedAt: new Date() },
      });
    return NextResponse.json({ id, state });
  } catch {
    return NextResponse.json(
      { error: "Unable to update alert" },
      { status: 503 },
    );
  }
}
