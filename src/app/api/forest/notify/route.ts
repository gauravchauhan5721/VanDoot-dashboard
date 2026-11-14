import { NextResponse } from "next/server";
import { pool } from "@/db";
export async function POST(request: Request) {
  if (
    !process.env.FOREST_ADMIN_TOKEN ||
    request.headers.get("authorization") !==
      `Bearer ${process.env.FOREST_ADMIN_TOKEN}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ALERT_WEBHOOK_URL)
    return NextResponse.json(
      {
        error:
          "Notification channel is not configured. Set ALERT_WEBHOOK_URL on the server.",
      },
      { status: 503 },
    );
  try {
    const { id } = await request.json();
    if (typeof id !== "string" || id.length > 100)
      return NextResponse.json(
        { error: "Invalid incident ID" },
        { status: 400 },
      );
    const { rows } = await pool.query(
      "SELECT id,payload FROM forest_records WHERE id=$1 AND kind='incident'",
      [id],
    );
    if (!rows.length)
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ALERT_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ event: "vandoot.incident", incident: rows[0] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Notification provider rejected request");
    await pool.query(
      "UPDATE forest_records SET payload=payload || $2::jsonb,updated_at=NOW() WHERE id=$1",
      [
        id,
        JSON.stringify({
          notification: {
            state: "accepted-by-provider",
            at: new Date().toISOString(),
          },
        }),
      ],
    );
    return NextResponse.json({
      message:
        "Provider accepted notification. Recipient delivery is not independently verified.",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Notification could not be confirmed. Check provider logs before retrying.",
      },
      { status: 502 },
    );
  }
}
