"use client";
import {
  Activity,
  Battery,
  Droplets,
  Gauge,
  Radio,
  Thermometer,
  Wind,
} from "lucide-react";
import { sensors } from "@/config/sensors";
import { useDashboard } from "@/hooks/useDashboard";
import { sensorValue } from "@/utils/format";
const icons: Record<string, typeof Activity> = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  airQuality: Wind,
  battery: Battery,
  rssi: Radio,
};
export function SensorCards({
  compact = false,
  nodeId,
}: {
  compact?: boolean;
  nodeId?: string;
}) {
  const { data, settings } = useDashboard();
  const nodes = data.nodes.filter(
    (n) => (!nodeId || n.id === nodeId) && n.status !== "offline",
  );
  return (
    <div className={`sensor-grid ${compact ? "compact" : ""}`}>
      {(compact ? sensors.slice(0, 4) : sensors).map((sensor) => {
        const Icon = icons[sensor.id] || Activity;
        const values = nodes
          .map((n) => n.readings[sensor.id])
          .filter(Number.isFinite);
        const mean = values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
        const display = sensorValue(mean, sensor, settings.units);
        const threshold = settings.thresholds[sensor.id];
        const warning =
          threshold &&
          (threshold.direction === "above"
            ? mean > threshold.warning
            : mean < threshold.warning);
        return (
          <a
            href={`#analytics/${sensor.id}`}
            className="sensor-card"
            key={sensor.id}
          >
            <div className="sensor-label">
              <Icon size={15} style={{ color: sensor.color }} />
              <span>{sensor.name}</span>
            </div>
            <div className="sensor-value">
              {values.length ? display.value : "—"}
              <small>{display.unit}</small>
            </div>
            <div className={`sensor-state ${warning ? "amber" : ""}`}>
              <i />
              {!values.length
                ? "No readings"
                : warning
                  ? "Above threshold"
                  : sensor.id === "airQuality"
                    ? "Good"
                    : "Normal"}
              <svg viewBox="0 0 65 20">
                <polyline
                  points="0,14 7,14 12,9 18,11 23,7 28,10 34,8 40,9 47,5 53,7 59,5 65,5"
                  fill="none"
                  stroke={sensor.color}
                  strokeWidth="1.3"
                />
              </svg>
            </div>
          </a>
        );
      })}
    </div>
  );
}
