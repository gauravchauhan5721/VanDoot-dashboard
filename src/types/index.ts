export type Mode = "demo" | "live";
export type Status = "online" | "weak" | "offline";
export interface SensorDefinition {
  id: string;
  name: string;
  unit: string;
  color: string;
  min: number;
  max: number;
  precision: number;
}
export interface Location {
  lat: number;
  lng: number;
  label: string;
}
export interface NodeConfig {
  id: string;
  name: string;
  gatewayId: string;
  parentId: string;
  location: Location;
  firmware: string;
}
export interface SensorNode extends NodeConfig {
  status: Status;
  readings: Record<string, number>;
  lastSeen: string;
  uptime: number;
  packets: number;
  received: number;
  lost: number;
  linkQuality: number;
}
export interface Gateway {
  id: string;
  name: string;
  model: string;
  status: Status;
  cpu: number;
  ram: number;
  storage: number;
  temperature: number;
  uptime: number;
  ip: string;
  received: number;
  transmitted: number;
  lost: number;
  lastSeen: string;
  location: Location;
}
export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  rssi: number;
  snr: number;
  quality: number;
  status: Status;
  traffic: number;
}
export interface Alert {
  id: string;
  nodeId: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  state: "active" | "acknowledged" | "resolved";
}
export interface Telemetry {
  id: string;
  timestamp: string;
  nodeId: string;
  sensor: string;
  value: number;
  unit: string;
  rssi: number;
  snr: number;
  status: string;
  event: string;
}
export interface HistoryPoint {
  timestamp: string;
  nodeId: string;
  readings: Record<string, number>;
}
export interface Snapshot {
  nodes: SensorNode[];
  gateways: Gateway[];
  links: NetworkLink[];
  alerts: Alert[];
  logs: Telemetry[];
  history: HistoryPoint[];
  timestamp: string;
}
export interface Threshold {
  warning: number;
  critical: number;
  direction: "above" | "below";
}
export interface Settings {
  mode: Mode;
  theme: "dark" | "light";
  refreshInterval: number;
  units: "metric" | "imperial";
  apiEndpoint: string;
  wsEndpoint: string;
  thresholds: Record<string, Threshold>;
  nodeOverrides: Record<
    string,
    { name?: string; samplingInterval?: number; transmissionInterval?: number }
  >;
  gatewayName: string;
}
export interface DeviceCommand {
  target: string;
  command: string;
  value?: string;
}
export interface CommandResult {
  id: string;
  target: string;
  command: string;
  status: string;
  message: string;
  createdAt: string;
}
export interface DataService {
  getSnapshot(): Promise<Snapshot>;
  sendCommand(command: DeviceCommand): Promise<CommandResult>;
}
