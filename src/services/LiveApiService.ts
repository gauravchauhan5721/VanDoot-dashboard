
import {
  CommandResult,
  DataService,
  DeviceCommand,
  HistoryPoint,
  Snapshot,
  SensorNode,
  Gateway,
  Telemetry,
  NetworkLink,
  Alert,
} from "@/types";

import { nodeConfigs, gatewayConfigs } from "@/config/nodes";
import { apiConfig } from "@/config/api";

type GatewayReading = {
  node?: string;
  online?: boolean;
  last_seen?: number;
  received_at?: string;
  received?: number;
  temperature?: number;
  humidity?: number;
  PIR?: number;
  MQ2?: number;
  battery?: number;
  rssi?: number;
  snr?: number;
  [key: string]: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const getTimestamp = (value: GatewayReading): string => {
  if (typeof value.received_at === "string") {
    const parsed = new Date(value.received_at);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value.last_seen === "number") {
    return new Date(value.last_seen * 1000).toISOString();
  }

  return new Date().toISOString();
};

export class LiveApiService implements DataService {
  constructor(private endpoint: string) {}

  private async request(
    path: string,
    init?: RequestInit
  ): Promise<any> {
    if (!this.endpoint) {
      throw new Error(
        "Gateway API URL is missing. Configure it in Dashboard Settings."
      );
    }

    const response = await fetch(
      `${this.endpoint.replace(/\/$/, "")}${path}`,
      {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init?.headers,
        },
        signal: AbortSignal.timeout(apiConfig.timeout),
      }
    );

    if (!response.ok) {
      throw new Error(`Gateway API error: HTTP ${response.status}`);
    }

    return response.json();
  }

  async getSnapshot(): Promise<Snapshot> {
    // Fetch real sensor data from the Raspberry Pi.
    const latest = await this.request("/latest");

    if (!isObject(latest)) {
      throw new Error(
        "Invalid response received from Raspberry Pi."
      );
    }

    const now = new Date().toISOString();

    const nodes: SensorNode[] = [];
    const links: NetworkLink[] = [];
    const logs: Telemetry[] = [];
    const history: HistoryPoint[] = [];

    // Convert Raspberry Pi data into dashboard node format.
    for (const [nodeId, rawData] of Object.entries(latest)) {
      if (!isObject(rawData)) continue;

      const data = rawData as GatewayReading;
      const timestamp = getTimestamp(data);

      const online = data.online !== false;

      const temperature = getNumber(data.temperature);
      const humidity = getNumber(data.humidity);
      const battery = getNumber(data.battery, 100);
      const rssi = getNumber(data.rssi, -70);
      const snr = getNumber(data.snr);

      const readings: Record<string, number> = {
        temperature,
        humidity,
        battery,
        rssi,
        snr,
        PIR: getNumber(data.PIR),
        MQ2: getNumber(data.MQ2),
      };

      const config = nodeConfigs.find(
        (node) => node.id === nodeId
      );

      const node: SensorNode = {
        id: nodeId,
        name: config?.name || nodeId,
        gatewayId:
          config?.gatewayId ||
          gatewayConfigs[0]?.id ||
          "GW-001",
        parentId:
          config?.parentId ||
          gatewayConfigs[0]?.id ||
          "GW-001",
        location: config?.location || {
          lat: 31.0,
          lng: 77.0,
          label: "Himachal Pradesh",
        },
        firmware: config?.firmware || "ESP32",
        status: online ? "online" : "offline",
        readings,
        lastSeen: timestamp,
        uptime: 0,
        packets: getNumber(data.received),
        received: getNumber(data.received),
        lost: 0,
        linkQuality: online ? 90 : 0,
      };

      nodes.push(node);

      // Create a network link for this node.
      links.push({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        rssi,
        snr,
        quality: node.linkQuality,
        status: node.status,
        traffic: node.packets,
      });

      // Add sensor values to dashboard logs.
      for (const [sensor, value] of Object.entries(data)) {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          ["last_seen", "received"].includes(sensor)
        ) {
          continue;
        }

        logs.push({
          id: `${nodeId}-${sensor}-${timestamp}`,
          timestamp,
          nodeId,
          sensor,
          value,
          unit:
            sensor === "temperature"
              ? "°C"
              : sensor === "humidity"
                ? "%"
                : sensor === "rssi"
                  ? "dBm"
                  : "",
          rssi,
          snr,
          status: "Received",
          event: "Live sensor reading",
        });
      }

      // Add history point for charts.
      history.push({
        timestamp,
        nodeId,
        readings,
      });
    }

    // Build gateway information.
    const gateways: Gateway[] = gatewayConfigs.map(
      (gateway) => ({
        id: gateway.id,
        name: gateway.name,
        model: gateway.model || "Raspberry Pi 4",
        status: nodes.some(
          (node) => node.status === "online"
        )
          ? "online"
          : "offline",
        cpu: 0,
        ram: 0,
        storage: 0,
        temperature: 0,
        uptime: 0,
        ip: this.endpoint,
        received: nodes.reduce(
          (sum, node) => sum + node.received,
          0
        ),
        transmitted: 0,
        lost: 0,
        lastSeen: now,
        location: gateway.location,
      })
    );

    return {
      nodes,
      gateways,
      links,
      alerts: [],
      logs,
      history,
      timestamp: now,
    };
  }

  // Update alert state in Live Mode.
  async updateAlert(
    id: string,
    state: Alert["state"]
  ): Promise<void> {
    await this.request(
      `/alerts/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ state }),
      }
    );
  }

  // Device commands are not implemented in the current Flask gateway.
  async sendCommand(
    command: DeviceCommand
  ): Promise<CommandResult> {
    throw new Error(
      `Device commands are not available yet. ${command.command} was not sent.`
    );
  }
}
