import { NodeConfig } from "@/types";
export const nodeConfigs: NodeConfig[] = [
  {
    id: "NODE-01",
    name: "Environment sensor",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.4",
    location: {
      lat: 31.7019,
      lng: 76.5233,
      label: "Zone A · Forest sector A",
    },
  },
  {
    id: "NODE-02",
    name: "Environment sensor",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.4",
    location: { lat: 31.7028, lng: 76.5255, label: "Zone B · Forest sector B" },
  },
  {
    id: "NODE-03",
    name: "Environment sensor",
    gatewayId: "GW-001",
    parentId: "GW-001",
    firmware: "v1.2.3",
    location: { lat: 31.7003, lng: 76.5262, label: "Zone C · Forest sector C" },
  },
];
export const gatewayConfigs = [
  {
    id: "GW-001",
    name: "Primary Gateway",
    model: "Raspberry Pi 4",
    ip: "192.168.1.100",
    location: {
      lat: 31.7016,
      lng: 76.5246,
      label: "Control room · Forest base",
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
