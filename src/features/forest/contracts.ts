export const modules = [
  "fire",
  "camera",
  "audio",
  "thermal",
  "fusion",
  "rangers",
  "incidents",
  "models",
  "integration",
] as const;
export type ForestModule = (typeof modules)[number];
export const titles: Record<ForestModule, string> = {
  fire: "Fire & smoke",
  camera: "Camera detections",
  audio: "Audio analysis",
  thermal: "Thermal monitoring",
  fusion: "Threat verification",
  rangers: "Ranger registry",
  incidents: "Incident review",
  models: "Model registry",
  integration: "Hardware integration",
};
export interface Detection {
  label: string;
  confidence: number;
  box?: number[];
}
export interface Inference {
  model: string;
  version: string;
  detections: Detection[];
}
export interface ForestRecord {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}
export function validateInference(value: unknown): value is Inference {
  if (!value || typeof value !== "object") return false;
  const v = value as Inference;
  return (
    typeof v.model === "string" &&
    !!v.model &&
    typeof v.version === "string" &&
    Array.isArray(v.detections) &&
    v.detections.every(
      (d) =>
        typeof d.label === "string" &&
        Number.isFinite(d.confidence) &&
        d.confidence >= 0 &&
        d.confidence <= 1 &&
        (!d.box ||
          (Array.isArray(d.box) &&
            d.box.length === 4 &&
            d.box.every((x) => Number.isFinite(x) && x >= 0 && x <= 1))),
    )
  );
}
export function thermalFrame(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== 768 ||
    !value.every((x) => typeof x === "number" && Number.isFinite(x))
  )
    throw Error("Provide exactly 768 finite temperatures (32 × 24), in °C.");
  return value;
}
