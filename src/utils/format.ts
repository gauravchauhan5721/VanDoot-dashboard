import { SensorDefinition, Settings } from "@/types";
export const number = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
export const time = (date: string) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export const ago = (date: string) => {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 1000),
  );
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
};
export function sensorValue(
  value: number,
  sensor: SensorDefinition,
  units: Settings["units"],
) {
  return {
    value: (sensor.id === "temperature" && units === "imperial"
      ? (value * 9) / 5 + 32
      : value
    ).toFixed(sensor.precision),
    unit:
      sensor.id === "temperature" && units === "imperial" ? "°F" : sensor.unit,
  };
}
export function download(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((key) => {
          const text = String(row[key] ?? "");
          return (
            '"' +
            (/^[=+@\-]/.test(text) ? "'" : "") +
            text.replace(/"/g, '""') +
            '"'
          );
        })
        .join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
