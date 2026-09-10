import {
  Alert,
  CommandResult,
  DataService,
  DeviceCommand,
  HistoryPoint,
  Settings,
  Snapshot,
} from "@/types";
import { demoConfig, gatewayConfigs, nodeConfigs } from "@/config/nodes";
import { sensors } from "@/config/sensors";
const empty = (): Snapshot => ({
  nodes: [],
  gateways: [],
  links: [],
  alerts: [],
  logs: [],
  history: [],
  timestamp: new Date().toISOString(),
});
export class DemoDataService implements DataService {
  private tick = 0;
  private data: Snapshot = empty();
  private start = Date.now();
  constructor(private settings: Settings) {
    this.initialize();
  }
  updateSettings(settings: Settings) {
    this.settings = settings;
  }
  private readings(index: number, phase: number): Record<string, number> {
    return Object.fromEntries(
      sensors.map((sensor) => {
        const middle = (sensor.min + sensor.max) / 2;
        const wave =
          Math.sin(phase * 0.19 + index * 1.8) * 0.17 +
          Math.sin(phase * 0.047 + index) * 0.08;
        let value = middle + (sensor.max - sensor.min) * wave;
        if (sensor.id === "temperature")
          value = 28.4 + index * 1.3 + Math.sin(phase * 0.15 + index) * 1.8;
        if (sensor.id === "humidity")
          value = 62 + Math.sin(phase * 0.08 + index) * 8;
        if (sensor.id === "battery")
          value = 98 - index * 11 - this.tick * demoConfig.batteryDrainPerTick;
        if (sensor.id === "rssi")
          value = -63 - index * 12 + Math.sin(phase * 0.06 + index) * 3;
        return [sensor.id, Number(value.toFixed(sensor.precision))];
      }),
    );
  }
  private initialize() {
    const now = Date.now();
    this.data.history = nodeConfigs.flatMap((node, index) =>
      Array.from(
        {
          length:
            (demoConfig.historyDays * 24 * 60) /
              demoConfig.historyIntervalMinutes +
            1,
        },
        (_, p): HistoryPoint => ({
          nodeId: node.id,
          timestamp: new Date(
            now -
              (demoConfig.historyDays * 24 * 60 -
                p * demoConfig.historyIntervalMinutes) *
                60000,
          ).toISOString(),
          readings: this.readings(index, p * 0.75),
        }),
      ),
    );
    this.data.alerts = [
      {
        id: "demo-temperature",
        nodeId: nodeConfigs[1]?.id || nodeConfigs[0]?.id || "SYSTEM",
        title: "Temperature threshold exceeded",
        message:
          "Temperature briefly reached 35.8 °C in Zone B. Current readings have returned to the normal range. Review ventilation and acknowledge this event.",
        severity: "warning",
        timestamp: new Date(now - 120000).toISOString(),
        state: "active",
      },
      {
        id: "demo-signal",
        nodeId: nodeConfigs[2]?.id || nodeConfigs[0]?.id || "SYSTEM",
        title: "Weak signal detected",
        message:
          "LoRa signal briefly dropped to -94 dBm. Check the antenna position and nearby obstructions.",
        severity: "warning",
        timestamp: new Date(now - 480000).toISOString(),
        state: "active",
      },
      {
        id: "demo-connected",
        nodeId: gatewayConfigs[0]?.id || "SYSTEM",
        title: "All nodes connected",
        message:
          "The gateway successfully established communication with all configured sensor nodes.",
        severity: "info",
        timestamp: new Date(now - 900000).toISOString(),
        state: "active",
      },
    ];
  }
  async getSnapshot(): Promise<Snapshot> {
    this.tick++;
    const now = new Date().toISOString();
    const cycle = Math.floor(this.tick / demoConfig.eventEveryTicks) % 7;
    this.data.nodes = nodeConfigs.map((node, i) => {
      const readings = this.readings(i, this.tick / 4);
      const affected =
        i ===
        Math.floor(this.tick / (demoConfig.eventEveryTicks * 7)) %
          Math.max(1, nodeConfigs.length);
      if (affected && cycle === 2) readings.battery = 23.5;
      if (affected && cycle === 3)
        readings.temperature = 36.2 + Math.sin(this.tick * 0.1) * 0.4;
      if (affected && cycle === 4) readings.rssi = -97;
      const status =
        affected && cycle === 1
          ? "offline"
          : readings.rssi < -90
            ? "weak"
            : "online";
      const previous = this.data.nodes.find((n) => n.id === node.id);
      return {
        ...node,
        name: this.settings.nodeOverrides[node.id]?.name || node.name,
        readings,
        status,
        lastSeen: status === "offline" ? previous?.lastSeen || now : now,
        uptime: 345600 + (Date.now() - this.start) / 1000,
        packets: 8225 + i * 163 + this.tick * 3,
        received: 8180 + i * 161 + this.tick * 3,
        lost: (affected && cycle === 5 ? 96 : 12) + i * 3,
        linkQuality: status === "offline" ? 0 : status === "weak" ? 74 : 99 - i,
      };
    });
    this.data.gateways = gatewayConfigs.map((gateway, i) => ({
      ...gateway,
      name: i === 0 ? this.settings.gatewayName : gateway.name,
      status: cycle === 6 ? "weak" : "online",
      cpu: 24 + Math.sin(this.tick * 0.06) * 5,
      ram: 38 + Math.sin(this.tick * 0.02) * 2,
      storage: 24.6,
      temperature: 46.2 + Math.sin(this.tick * 0.05) * 2,
      uptime: 372360 + (Date.now() - this.start) / 1000,
      received: demoConfig.startingPackets + this.tick * 9,
      transmitted: 8264 + this.tick * 3,
      lost: 42 + (cycle === 5 ? 80 : 0),
      lastSeen: now,
    }));
    this.data.links = this.data.nodes.map((node) => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId,
      target: node.id,
      rssi: node.readings.rssi,
      snr: node.readings.snr,
      quality: node.linkQuality,
      status: node.status,
      traffic: node.packets,
    }));
    const events: Alert[] = [];
    this.data.nodes.forEach((node) => {
      if (node.status === "offline")
        events.push({
          id: `offline-${node.id}-${Math.floor(this.tick / demoConfig.eventEveryTicks)}`,
          nodeId: node.id,
          title: "Node offline",
          message:
            "Simulated communication outage. The node will automatically reconnect in the next demo cycle.",
          severity: "critical",
          timestamp: now,
          state: "active",
        });
      Object.entries(this.settings.thresholds).forEach(
        ([sensor, threshold]) => {
          const value = node.readings[sensor];
          if (value === undefined) return;
          const check = (n: number) =>
            threshold.direction === "above" ? value > n : value < n;
          if (check(threshold.warning))
            events.push({
              id: `${node.id}-${sensor}-${Math.floor(this.tick / demoConfig.eventEveryTicks)}`,
              nodeId: node.id,
              title: `${sensors.find((s) => s.id === sensor)?.name || sensor} threshold exceeded`,
              message: `${node.id} reported ${value} ${sensors.find((s) => s.id === sensor)?.unit || ""}. Configured warning threshold: ${threshold.warning}. This is a simulated event.`,
              severity: check(threshold.critical) ? "critical" : "warning",
              timestamp: now,
              state: "active",
            });
        },
      );
    });
    if (cycle === 5)
      events.push({
        id: `packet-loss-${Math.floor(this.tick / demoConfig.eventEveryTicks)}`,
        nodeId: gatewayConfigs[0]?.id || "SYSTEM",
        title: "High packet loss",
        message:
          "Demo packet loss increased. Inspect interference and link quality.",
        severity: "warning",
        timestamp: now,
        state: "active",
      });
    if (cycle === 6)
      events.push({
        id: `gateway-${Math.floor(this.tick / demoConfig.eventEveryTicks)}`,
        nodeId: gatewayConfigs[0]?.id || "SYSTEM",
        title: "Gateway degraded",
        message:
          "Simulated gateway resource warning. The gateway will recover automatically.",
        severity: "warning",
        timestamp: now,
        state: "active",
      });
    this.data.alerts = [
      ...events.filter(
        (event) => !this.data.alerts.some((a) => a.id === event.id),
      ),
      ...this.data.alerts,
    ].slice(0, 100);
    this.data.history = [
      ...this.data.history,
      ...this.data.nodes
        .filter((n) => n.status !== "offline")
        .map((n) => ({
          timestamp: now,
          nodeId: n.id,
          readings: { ...n.readings },
        })),
    ].slice(-Math.max(5000, nodeConfigs.length * 2000));
    const logs = this.data.nodes
      .filter((n) => n.status !== "offline")
      .flatMap((node) =>
        sensors.map((sensor) => ({
          id: `PKT-${this.tick}-${node.id}-${sensor.id}`,
          timestamp: now,
          nodeId: node.id,
          sensor: sensor.id,
          value: node.readings[sensor.id],
          unit: sensor.unit,
          rssi: node.readings.rssi,
          snr: node.readings.snr,
          status: "Received",
          event: "Sensor reading",
        })),
      );
    this.data.logs = [...logs, ...this.data.logs].slice(0, 2000);
    this.data.timestamp = now;
    return { ...this.data };
  }
  async sendCommand(command: DeviceCommand): Promise<CommandResult> {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return {
      ...command,
      id: crypto.randomUUID(),
      status: "simulated",
      message: `DEMO · ${command.command} simulated for ${command.target}. No hardware command was sent.`,
      createdAt: new Date().toISOString(),
    };
  }
}
export const emptySnapshot = empty;
