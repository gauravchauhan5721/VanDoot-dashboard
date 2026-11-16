import { NodeConfig } from "@/types";
export const nodeConfigs: NodeConfig[] = [
  {
    id: "NODE-01",
    name: "Forest watch node",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.4",
    location: {
      lat: 12.9719,
      lng: 77.5933,
      label: "Zone A · Pine ridge",
    },
  },
  {
    id: "NODE-02",
    name: "Forest watch node",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.4",
    location: { lat: 12.9728, lng: 77.5955, label: "Zone B · River trail" },
  },
  {
    id: "NODE-03",
    name: "Forest watch node",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.3",
    location: { lat: 12.9703, lng: 77.5962, label: "Zone C · South boundary" },
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
      label: "Control room · Ranger station",
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
