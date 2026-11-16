import {
  Alert,
  CommandResult,
  DataService,
  DeviceCommand,
  Snapshot,
  SensorNode,
  Telemetry,
} from "@/types";
import { apiConfig } from "@/config/api";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const numeric = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : NaN;
import { SENSOR_ALIASES, sensorById } from "@/config/sensors";
export { SENSOR_ALIASES } from "@/config/sensors";
export function normalizeLatest(latest: unknown, now = Date.now()): Snapshot {
  if (!object(latest)) throw Error("Invalid gateway response");
  const nodes: SensorNode[] = [];
  const logs: Telemetry[] = [];
  for (const [id, raw] of Object.entries(latest)) {
    if (!object(raw)) continue;
    const timestamp =
      typeof raw.received_at === "string"
        ? Date.parse(raw.received_at)
        : typeof raw.last_seen === "number"
          ? raw.last_seen * 1000
          : NaN;
    const fresh =
      Number.isFinite(timestamp) &&
      now - timestamp >= 0 &&
      now - timestamp <= 30000;
    const readings: Record<string, number> = Object.fromEntries(
      Object.keys(SENSOR_ALIASES).map((k) => [k, NaN]),
    );
    for (const [key, aliases] of Object.entries(SENSOR_ALIASES)) {
      const value = aliases
        .map((a) => raw[a])
        .find((v) => typeof v === "number" && Number.isFinite(v));
      if (value !== undefined) readings[key] = value as number;
    }
    const location = object(raw.location) ? raw.location : {};
    const lat = numeric(location.lat),
      lng = numeric(location.lng);
    const located =
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      Number.isFinite(lng) &&
      Math.abs(lng) <= 180;
    const lastSeen = Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString()
      : "";
    const node: SensorNode = {
      id,
      name: typeof raw.name === "string" ? raw.name : id,
      gatewayId: typeof raw.gatewayId === "string" ? raw.gatewayId : "GW-001",
      parentId: typeof raw.parentId === "string" ? raw.parentId : "GW-001",
      firmware: typeof raw.firmware === "string" ? raw.firmware : "Unknown",
      location: {
        lat: located ? lat : NaN,
        lng: located ? lng : NaN,
        label: located
          ? String(location.label || "Surveyed node location")
          : "Location unknown",
      },
      status: fresh && raw.online === true ? "online" : "offline",
      readings,
      lastSeen,
      uptime: numeric(raw.uptime),
      packets: numeric(raw.received),
      received: numeric(raw.received),
      lost: numeric(raw.lost),
      linkQuality: numeric(raw.linkQuality),
    };
    nodes.push(node);
    for (const [sensor, value] of Object.entries(readings).filter(([, v]) =>
      Number.isFinite(v),
    ))
      logs.push({
        id: `${id}-${sensor}-${lastSeen}`,
        timestamp: lastSeen,
        nodeId: id,
        sensor,
        value,
        unit: sensorById[sensor]?.unit || "raw",
        rssi: readings.rssi,
        snr: readings.snr,
        status: fresh ? "Received" : "Stale",
        event: "Live sensor reading",
      });
  }
  return {
    nodes,
    gateways: [],
    links: nodes.map((n) => ({
      id: `${n.parentId}-${n.id}`,
      source: n.parentId,
      target: n.id,
      rssi: n.readings.rssi,
      snr: n.readings.snr,
      quality: n.linkQuality,
      status: n.status,
      traffic: n.packets,
    })),
    alerts: [],
    logs,
    history: nodes
      .filter((n) => n.status !== "offline")
      .map((n) => ({
        nodeId: n.id,
        timestamp: n.lastSeen,
        readings: n.readings,
      })),
    timestamp: new Date(now).toISOString(),
  };
}
export class LiveApiService implements DataService {
  constructor(private endpoint: string, private signal?: AbortSignal) {}
  private async request(path: string, init?: RequestInit): Promise<unknown> {
    if (!this.endpoint) throw Error("Configure the gateway URL in Settings.");
    const r = await fetch(`${this.endpoint.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(apiConfig.timeout)]) : AbortSignal.timeout(apiConfig.timeout),
      cache: "no-store",
      credentials: "omit",
    });
    if (!r.ok) throw Error(`Gateway API error: HTTP ${r.status}`);
    return r.json();
  }
  async getSnapshot() {
    return normalizeLatest(await this.request("/latest"));
  }
  async updateAlert(id: string, state: Alert["state"]) {
    await this.request(`/alerts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ state }),
    });
  }
  async sendCommand(command: DeviceCommand): Promise<CommandResult> {
    throw Error(
      `Gateway command implementation not connected. ${command.command} was not sent.`,
    );
  }
}
