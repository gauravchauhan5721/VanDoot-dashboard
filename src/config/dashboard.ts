import { Settings } from "@/types";
import { thresholds } from "./thresholds";
import { apiConfig } from "./api";
export const defaultSettings: Settings = {
  mode: "demo",
  theme: "dark",
  refreshInterval: 5,
  units: "metric",
  apiEndpoint: apiConfig.endpoint,
  wsEndpoint: apiConfig.websocket,
  thresholds,
  nodeOverrides: {},
  gatewayName: "Primary Gateway",
};
export const navigation = [
  {
    section: "OPERATIONS",
    items: [
      ["overview", "Overview", "LayoutDashboard"],
      ["nodes", "Nodes", "Cpu"],
      ["live-monitoring", "Monitoring", "Radio"],
      ["incidents", "Incidents", "Bell"],
      ["map", "Forest Map", "MapPin"],
      ["network", "Network", "Network"],
      ["reports", "History & Reports", "FileChartColumn"],
      ["settings", "Settings", "Settings"],
    ],
  },
  {
    section: "EVIDENCE & INTEGRATION",
    items: [
      ["camera", "Camera evidence", "Boxes"],
      ["audio", "Audio analysis", "Radio"],
      ["thermal", "Thermal frames", "Activity"],
      ["integration", "Hardware setup", "SlidersHorizontal"],
      ["models", "Model registry", "Sparkles"],
    ],
  },
  {
    section: "EXISTING TOOLS",
    items: [
      ["analytics", "Sensor analytics", "ChartNoAxesCombined"],
      ["data-logs", "Telemetry logs", "Logs"],
      ["simulation", "3D simulation", "Boxes"],
      ["system-health", "System health", "HeartPulse"],
    ],
  },
];
export const pageDescriptions: Record<string, string> = {
  fire: "Review smoke and fire evidence with sensor context.",
  camera: "Inspect camera evidence and connected model results.",
  audio: "Classify recorded sounds with your connected model.",
  thermal: "Explore recorded thermal frames and temperature extremes.",
  fusion: "Cross-check evidence before confirming an incident.",
  incidents: "Review, acknowledge and resolve forest observations.",
  rangers: "Manage registered badges and unverified identities.",
  models: "Record trained model versions and evaluation results.",
  integration: "Prepare gateway and AI service connections.",
  overview: "Your entire network. One clear picture.",
  "live-monitoring": "A real-time pulse of your distributed sensor network.",
  nodes: "Monitor, manage, and explore your connected devices.",
  network: "Reported connectivity for the Wi-Fi / local-network prototype.",
  simulation: "Explore the forest surveillance network in interactive 3D.",
  gateway: "The bridge between your devices and your intelligence.",
  sensors: "Environmental intelligence from every corner of your network.",
  analytics: "Turn historical telemetry into actionable understanding.",
  alerts: "Stay ahead of the events that need your attention.",
  map: "Your network, placed in context.",
  intelligence: "A smarter perspective on your network’s performance.",
  "device-control": "Configure and communicate with your distributed devices.",
  "data-logs": "A detailed record of every reading and network event.",
  reports: "From network activity to presentation-ready insights.",
  "system-health": "End-to-end visibility into your monitoring infrastructure.",
  settings: "Make Vandoot work the way you do.",
};
