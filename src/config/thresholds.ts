import { Threshold } from "@/types";
export const thresholds: Record<string, Threshold> = {
  temperature: { warning: 35, critical: 40, direction: "above" },
  battery: { warning: 25, critical: 10, direction: "below" },
  rssi: { warning: -90, critical: -105, direction: "below" },
  airQuality: { warning: 100, critical: 150, direction: "above" },
};
