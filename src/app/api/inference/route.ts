import { NextResponse } from "next/server";
import { validateInference } from "@/features/forest/contracts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (
    !process.env.FOREST_ADMIN_TOKEN ||
    request.headers.get("authorization") !==
      `Bearer ${process.env.FOREST_ADMIN_TOKEN}`
  )
    return NextResponse.json(
      { error: "Dashboard access token required" },
      { status: 401 },
    );
  if (!process.env.AI_SERVICE_URL)
    return NextResponse.json(
      {
        error:
          "No AI model service connected. Configure AI_SERVICE_URL after training.",
      },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length")) > 10500000)
    return NextResponse.json(
      { error: "Maximum upload is 10 MB" },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    const task = form.get("task");
    if (
      !(file instanceof File) ||
      file.size > 10000000 ||
      !["fire", "camera", "audio"].includes(String(task))
    )
      return NextResponse.json(
        { error: "Invalid upload or task" },
        { status: 400 },
      );
    const accepted =
      task === "audio"
        ? ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/ogg"]
        : ["image/jpeg", "image/png", "image/webp"];
    if (!accepted.includes(file.type))
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    const response = await fetch(
      `${process.env.AI_SERVICE_URL.replace(/\/$/, "")}/predict`,
      {
        method: "POST",
        body: form,
        headers: process.env.AI_SERVICE_TOKEN
          ? { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` }
          : {},
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) throw Error(`Model service returned ${response.status}`);
    const result = await response.json();
    if (!validateInference(result))
      throw Error("Model service returned an invalid prediction schema");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Inference failed" },
      { status: 502 },
    );
  }
}
