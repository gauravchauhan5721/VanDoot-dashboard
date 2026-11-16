import { Snapshot } from "@/types";
import { normalizeLatest } from "./LiveApiService";

import { isFresh } from "@/utils/telemetry";
import { parseEvents } from "@/features/media/contracts";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown, keys: string[]) =>
  object(v) && keys.every((k) => typeof v[k] === "string");
const numbers = (v: unknown, keys: string[]) =>
  object(v) &&
  keys.every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));
export function normalizeSocketPayload(
  value: unknown,
  now = Date.now(),
): Snapshot {
  if (!object(value) || !("nodes" in value)) return normalizeLatest(value, now);
  if (
    !["nodes", "gateways", "links", "alerts", "logs", "history"].every((k) =>
      Array.isArray(value[k]),
    )
  )
    throw Error("Invalid snapshot");
  const snapshot = value as unknown as Snapshot;
  if (
    !snapshot.nodes.every(
      (n) => object(n) && typeof n.id === "string" && object(n.readings),
    )
  )
    throw Error("Invalid nodes");
  const normalized = normalizeLatest(
    Object.fromEntries(
      snapshot.nodes.map((n) => [
        n.id,
        {
          ...n,
          ...n.readings,
          received_at: n.lastSeen,
          online: n.status === "online" || n.status === "weak",
        },
      ]),
    ),
    now,
  );
  return {
    ...normalized,
    gateways: snapshot.gateways
      .filter(
        (g) =>
          strings(g, ["id", "name", "model", "ip", "lastSeen"]) &&
          object(g.location) &&
          strings(g.location, ["label"]) &&
          numbers(g.location, ["lat", "lng"]) &&
          numbers(g, [
            "cpu",
            "ram",
            "storage",
            "temperature",
            "uptime",
            "received",
            "transmitted",
            "lost",
          ]),
      )
      .map((g) => ({
        ...g,
        status:
          isFresh(g.lastSeen, now) && ["online", "weak"].includes(g.status)
            ? g.status
            : "offline",
      })),
    alerts: snapshot.alerts
      .filter(
        (a) =>
          strings(a, ["id", "nodeId", "title", "message", "timestamp"]) &&
          Number.isFinite(Date.parse(a.timestamp)) &&
          ["info", "warning", "critical"].includes(a.severity) &&
          ["active", "acknowledged", "resolved"].includes(a.state),
      )
      .map((a) => ({
        ...a,
        evidence: a.evidence
          ? parseEvents([a.evidence], a.nodeId).events[0]
          : undefined,
        readings: Array.isArray(a.readings)
          ? a.readings.filter(
              (r) =>
                strings(r, ["sensor", "timestamp"]) &&
                numbers(r, ["value"]) &&
                Math.abs(Date.parse(r.timestamp) - Date.parse(a.timestamp)) <=
                  30000,
            )
          : undefined,
      })),
    history: [
      ...snapshot.history
        .filter(
          (p) =>
            strings(p, ["nodeId", "timestamp"]) &&
            object(p.readings) &&
            Date.parse(p.timestamp) <= now &&
            normalized.nodes.some((n) => n.id === p.nodeId),
        )
        .map((p) => ({
          ...p,
          readings: Object.fromEntries(
            Object.entries(p.readings).map(([k, v]) => [
              k,
              typeof v === "number" && Number.isFinite(v) ? v : NaN,
            ]),
          ),
        })),
      ...normalized.history,
    ].slice(-5000),
  };
}
export class WebSocketService {
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  connect(
    endpoint: string,
    onData: (snapshot: Snapshot) => void,
    onStatus: (status: string) => void,
  ) {
    if (!endpoint) {
      onStatus("Not configured");
      return;
    }

    this.stopped = false;

    const open = () => {
      if (this.stopped) return;

      try {
        this.socket = new WebSocket(endpoint);
      } catch {
        onStatus("Invalid endpoint");
        return;
      }

      this.socket.onopen = () => {
        onStatus("Connected");
      };

      this.socket.onmessage = (event: MessageEvent) => {
        if (this.stopped) return;
        try {
          const value: unknown = JSON.parse(event.data);

          onData(normalizeSocketPayload(value));
        } catch {
          onStatus("Invalid payload");
        }
      };

      this.socket.onerror = () => {
        onStatus("Disconnected");
      };

      this.socket.onclose = () => {
        onStatus("Disconnected");

        if (!this.stopped) {
          this.retry = setTimeout(open, 5000);
        }
      };
    };

    open();
  }

  disconnect() {
    this.stopped = true;

    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
    }

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
    }
    this.socket = null;
  }
}
