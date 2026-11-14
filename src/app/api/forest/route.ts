import { NextResponse } from "next/server";
import { pool } from "@/db";
import { validateInference } from "@/features/forest/contracts";
export const runtime = "nodejs";
function authorized(request: Request) {
  return (
    !!process.env.FOREST_ADMIN_TOKEN &&
    request.headers.get("authorization") ===
      `Bearer ${process.env.FOREST_ADMIN_TOKEN}`
  );
}
export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json(
      { error: "Enter the dashboard access token configured on the server." },
      { status: 401 },
    );
  try {
    const rows = await pool.query(
      'SELECT id, kind, payload, updated_at AS "updatedAt" FROM forest_records ORDER BY updated_at DESC LIMIT 500',
    );
    return NextResponse.json(rows.rows);
  } catch {
    return NextResponse.json(
      {
        error:
          "Forest storage unavailable. Run the database migration and check DATABASE_URL.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 1500000)
    return NextResponse.json({ error: "Record too large" }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 1500000)
      return NextResponse.json({ error: "Record too large" }, { status: 413 });
    const body = JSON.parse(raw);
    const { kind, payload } = body;
    if (
      !["incident", "ranger", "model", "thermal"].includes(kind) ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    )
      return NextResponse.json({ error: "Invalid record" }, { status: 400 });
    if (
      typeof payload.title !== "string" ||
      !payload.title.trim() ||
      payload.title.length > 200
    )
      return NextResponse.json(
        { error: "A title of 1–200 characters is required" },
        { status: 400 },
      );
    if (
      kind === "incident" &&
      !["active", "acknowledged", "resolved", "false-positive"].includes(
        payload.state,
      )
    )
      return NextResponse.json(
        { error: "Invalid incident state" },
        { status: 400 },
      );
    if (payload.inference && !validateInference(payload.inference))
      return NextResponse.json(
        { error: "Invalid inference result" },
        { status: 400 },
      );
    if (payload.evidenceUrl) {
      const url = new URL(payload.evidenceUrl);
      if (url.protocol !== "https:")
        return NextResponse.json(
          { error: "Evidence URLs must use HTTPS" },
          { status: 400 },
        );
    }
    const id = body.id === undefined ? crypto.randomUUID() : body.id;
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const rows = await pool.query(
      'INSERT INTO forest_records(id,kind,payload) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET payload=$3,updated_at=NOW() WHERE forest_records.kind=$2 RETURNING id,kind,payload,updated_at AS "updatedAt"',
      [id, kind, JSON.stringify(payload)],
    );
    return NextResponse.json(rows.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Unable to save. Check input and database migration." },
      { status: 400 },
    );
  }
}
