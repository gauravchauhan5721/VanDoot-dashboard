import type { Alert, HistoryPoint, Settings, Snapshot } from "@/types";
import { sensors } from "@/config/sensors";
export const FRESHNESS_MS = 30_000;
export function isFresh(timestamp: string, now = Date.now()) {
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= FRESHNESS_MS;
}
export function captureTime(timestamp: string) {
  return Number.isFinite(Date.parse(timestamp))
    ? new Date(timestamp).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      })
    : "—";
}
export function nearbyReadings(
  history: HistoryPoint[],
  nodeId: string,
  timestamp: string,
) {
  const time = Date.parse(timestamp);
  const result: { sensor: string; value: number; timestamp: string }[] = [];
  for (const sensor of sensors) {
    const p = history
      .filter(
        (p) =>
          p.nodeId === nodeId &&
          Number.isFinite(p.readings[sensor.id]) &&
          Math.abs(Date.parse(p.timestamp) - time) <= FRESHNESS_MS,
      )
      .sort(
        (a, b) =>
          Math.abs(Date.parse(a.timestamp) - time) -
          Math.abs(Date.parse(b.timestamp) - time),
      )[0];
    if (p)
      result.push({
        sensor: sensor.id,
        value: p.readings[sensor.id],
        timestamp: p.timestamp,
      });
  }
  return result;
}
export function thresholdAlerts(
  snapshot: Snapshot,
  settings: Settings,
  previous: Map<string, string>,
  now = Date.now(),
): Alert[] {
  const alerts: Alert[] = [];
  for (const node of snapshot.nodes) {
    if (node.status === "offline" || !isFresh(node.lastSeen, now)) continue;
    for (const [id, threshold] of Object.entries(settings.thresholds)) {
      const value = node.readings[id];
      if (!Number.isFinite(value)) continue;
      const exceeds = (limit: number) =>
        threshold.direction === "above" ? value > limit : value < limit;
      const severity = exceeds(threshold.critical)
        ? "critical"
        : exceeds(threshold.warning)
          ? "warning"
          : "";
      const key = `${node.id}:${id}`;
      if (severity && severity !== previous.get(key)) {
        const sensor = sensors.find((s) => s.id === id);
        alerts.push({
          id: `threshold:${key}:${node.lastSeen}`,
          nodeId: node.id,
          title: `${sensor?.name || id} threshold crossed`,
          message: `${value} ${sensor?.unit || ""}; ${severity} threshold ${severity === "critical" ? threshold.critical : threshold.warning}. Flagged for human review; this does not confirm a fire.`,
          severity,
          timestamp: node.lastSeen,
          state: "active",
          readings: [{ sensor: id, value, timestamp: node.lastSeen }],
          reviewRequired: true,
        });
      }
      previous.set(key, severity);
    }
  }
  return alerts;
}
