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
      {(compact ? sensors.filter(s => s.featured) : sensors).map((sensor) => {
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
            href={`#analytics/${sensor.id}/${nodeId || ""}`}
            className="sensor-card"
            key={sensor.id}
          >
            <div className="sensor-label">
              <Icon size={15} style={{ color: sensor.color }} />
              <span>{sensor.hardware === "DHT22" ? "DHT22 " : ""}{sensor.name}</span>
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
                  ? "Threshold crossed"
                  : sensor.id === "airQuality"
                    ? "Good"
                    : "Normal"}

            </div>
          </a>
        );
      })}
    </div>
  );
}
