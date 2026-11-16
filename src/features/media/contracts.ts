import type { Alert } from "@/types";

export type SourceKind = "camera" | "image" | "thermal" | "audio" | "events";
export type MediaSource = Record<SourceKind, string>;
export const blankSource: MediaSource = {
  camera: "",
  image: "",
  thermal: "",
  audio: "",
  events: "",
};
export interface ThermalFrame {
  nodeId: string;
  width: number;
  height: number;
  timestamp: string;
  values: number[];
}
export interface DetectionEvent {
  nodeId: string;
  id: string;
  timestamp: string;
  type: "camera" | "thermal" | "audio" | "sound-level";
  label: string;
  score?: number;
  model?: string;
  version?: string;
  imageUrl?: string;
  audioUrl?: string;
  frameId?: string;
  evidenceFrameId?: string;
  box?: [number, number, number, number];
  value?: number;
  unit?: string;
  severity?: Alert["severity"];
  simulated?: boolean;
}
export type ModelStatus = "connected" | "disconnected" | "unknown";
export function safeMediaURL(value: string, bundled = false) {
  if (!value) return "";
  if (bundled && /^\/demo\/[a-zA-Z0-9._-]+$/.test(value)) return value;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    [...url.searchParams.keys()].some((k) =>
      /token|secret|password|api.?key/i.test(k),
    )
  )
    throw Error(
      "Use an HTTP(S) URL without credentials or secret query parameters.",
    );
  return url.href;
}
export function parseThermal(body: unknown, nodeId: string): ThermalFrame {
  const f = body as ThermalFrame;
  if (
    !f ||
    f.nodeId !== nodeId ||
    f.width !== 32 ||
    f.height !== 24 ||
    !Number.isFinite(Date.parse(f.timestamp)) ||
    !Array.isArray(f.values) ||
    f.values.length !== 768 ||
    !f.values.every((v) => typeof v === "number" && Number.isFinite(v))
  )
    throw Error(
      "Expected this node’s MLX90640 frame: 32 × 24 finite temperatures in °C.",
    );
  return f;
}
export function parseEvents(
  body: unknown,
  nodeId: string,
): { events: DetectionEvent[]; modelStatus: ModelStatus } {
  const envelope = body as { events?: unknown; modelStatus?: unknown };
  const list = Array.isArray(body) ? body : envelope?.events;
  if (!Array.isArray(list) || list.length > 200)
    throw Error("Expected up to 200 events.");
  const events = list
    .filter(
      (e): e is DetectionEvent =>
        !!e &&
        e.nodeId === nodeId &&
        typeof e.id === "string" &&
        typeof e.label === "string" &&
        ["camera", "thermal", "audio", "sound-level"].includes(e.type) &&
        Number.isFinite(Date.parse(e.timestamp)) &&
        (e.score === undefined ||
          (typeof e.score === "number" && e.score >= 0 && e.score <= 1)),
    )
    .map((e) => {
      const result = { ...e };
      for (const key of ["model", "version", "frameId", "evidenceFrameId"] as const) {
        if (typeof result[key] !== "string") delete result[key];
      }
      if (!["info", "warning", "critical"].includes(result.severity || "")) delete result.severity;
      if (typeof result.simulated !== "boolean") delete result.simulated;
      for (const key of ["imageUrl", "audioUrl"] as const) {
        try {
          if (result[key]) result[key] = safeMediaURL(result[key]!);
        } catch {
          delete result[key];
        }
      }
      if (
        !Array.isArray(result.box) ||
        result.box.length !== 4 ||
        !result.box.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
        result.box[2] === 0 || result.box[3] === 0 ||
        result.box[0] + result.box[2] > 1 ||
        result.box[1] + result.box[3] > 1
      )
        delete result.box;
      return result;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return {
    events,
    modelStatus:
      envelope?.modelStatus === "connected" ||
      envelope?.modelStatus === "disconnected"
        ? envelope.modelStatus
        : "unknown",
  };
}
export function matchingBox(event: DetectionEvent) {
  return event.imageUrl &&
    event.frameId &&
    event.frameId === event.evidenceFrameId
    ? event.box
    : undefined;
}
export function eventAlert(event: DetectionEvent): Alert {
  return {
    id: `media:${event.nodeId}:${event.id}`,
    nodeId: event.nodeId,
    title: event.label,
    message:
      event.type === "sound-level"
        ? "Sound intensity observation. Classification not reported."
        : "Detection received. Review the captured evidence before taking action.",
    severity: event.severity || "warning",
    timestamp: event.timestamp,
    state: "active",
    evidence: event,
  };
}
