import { NodeConfig } from "@/types";
export const nodeConfigs: NodeConfig[] = [
  {
    id: "NODE-01",
    name: "Environment sensor",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.4",
    location: {
      lat: 12.9719,
      lng: 77.5933,
      label: "Zone A · Production floor",
    },
  },
  {
    id: "NODE-02",
    name: "Environment sensor",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.4",
    location: { lat: 12.9728, lng: 77.5955, label: "Zone B · Warehouse" },
  },
  {
    id: "NODE-03",
    name: "Environment sensor",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.3",
    location: { lat: 12.9703, lng: 77.5962, label: "Zone C · Outdoor" },
  },
];
export const gatewayConfigs = [
  {
    id: "GW-001",
    name: "Primary Gateway",
    model: "Raspberry Pi 4",
    ip: "192.168.1.100",
    location: {
      lat: 12.9716,
      lng: 77.5946,
      label: "Control room · Main facility",
    },
  },
];
export const demoConfig = {
  historyDays: 30,
  historyIntervalMinutes: 30,
  eventEveryTicks: 24,
  startingPackets: 24892,
  batteryDrainPerTick: 0.0003,
};
