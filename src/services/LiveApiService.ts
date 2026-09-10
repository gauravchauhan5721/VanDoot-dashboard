import { CommandResult, DataService, DeviceCommand, Snapshot } from "@/types";
import { apiConfig } from "@/config/api";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === "string");
const numbers = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  );
const location = (value: unknown) =>
  object(value) &&
  numbers(value, ["lat", "lng"]) &&
  typeof value.label === "string";
const readings = (value: unknown) =>
  object(value) &&
  Object.values(value).every(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
export function isSnapshot(value: unknown): value is Snapshot {
  if (
    !object(value) ||
    !["nodes", "gateways", "links", "alerts", "logs", "history"].every((key) =>
      Array.isArray(value[key]),
    ) ||
    typeof value.timestamp !== "string"
  )
    return false;
  const items = (key: string, check: (v: Record<string, unknown>) => boolean) =>
    (value[key] as unknown[]).every((v) => object(v) && check(v));
  const device = (v: Record<string, unknown>) =>
    strings(v, ["id", "name", "status", "lastSeen"]) &&
    ["online", "weak", "offline"].includes(String(v.status)) &&
    location(v.location);
  return (
    items(
      "nodes",
      (v) =>
        device(v) &&
        strings(v, ["gatewayId", "parentId", "firmware"]) &&
        numbers(v, ["uptime", "packets", "received", "lost", "linkQuality"]) &&
        readings(v.readings) &&
        object(v.readings) &&
        numbers(v.readings, [
          "temperature",
          "humidity",
          "battery",
          "rssi",
          "snr",
        ]),
    ) &&
    items(
      "gateways",
      (v) =>
        device(v) &&
        strings(v, ["model", "ip"]) &&
        numbers(v, [
          "cpu",
          "ram",
          "storage",
          "temperature",
          "uptime",
          "received",
          "transmitted",
          "lost",
        ]),
    ) &&
    items(
      "links",
      (v) =>
        strings(v, ["id", "source", "target", "status"]) &&
        numbers(v, ["rssi", "snr", "quality", "traffic"]),
    ) &&
    items(
      "alerts",
      (v) =>
        strings(v, [
          "id",
          "nodeId",
          "title",
          "message",
          "severity",
          "timestamp",
          "state",
        ]) &&
        ["info", "warning", "critical"].includes(String(v.severity)) &&
        ["active", "acknowledged", "resolved"].includes(String(v.state)),
    ) &&
    items(
      "logs",
      (v) =>
        strings(v, [
          "id",
          "timestamp",
          "nodeId",
          "sensor",
          "unit",
          "status",
          "event",
        ]) && numbers(v, ["value", "rssi", "snr"]),
    ) &&
    items(
      "history",
      (v) => strings(v, ["timestamp", "nodeId"]) && readings(v.readings),
    )
  );
}
export class LiveApiService implements DataService {
  constructor(private endpoint: string) {}
  private async request(path: string, init?: RequestInit) {
    if (!this.endpoint)
      throw new Error(
        "No gateway API configured. Open Settings to connect your Raspberry Pi.",
      );
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(apiConfig.timeout),
    });
    if (!response.ok)
      throw new Error(`Gateway returned HTTP ${response.status}`);
    return response.json();
  }
  async getSnapshot(): Promise<Snapshot> {
    const [gateways, nodes, sensors, network, alerts, logs, analytics] =
      await Promise.all(
        [
          "/gateway",
          "/nodes",
          "/sensors",
          "/network",
          "/alerts",
          "/logs",
          "/analytics",
        ].map((path) => this.request(path)),
      );
    void sensors;
    const snapshot = {
      gateways: Array.isArray(gateways) ? gateways : [gateways],
      nodes,
      links: network.links,
      alerts,
      logs,
      history: analytics.history,
      timestamp: new Date().toISOString(),
    };
    if (!isSnapshot(snapshot))
      throw new Error(
        "Gateway payload does not match the Vandoot API contract. See README.",
      );
    return snapshot;
  }
  async sendCommand(command: DeviceCommand): Promise<CommandResult> {
    return this.request("/commands", {
      method: "POST",
      body: JSON.stringify(command),
    });
  }
  async updateAlert(id: string, state: string) {
    return this.request(`/alerts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ state }),
    });
  }
}
