"use client";
import { useEffect, useRef, useState } from "react";
import type { ThermalFrame } from "./contracts";
import { captureTime, isFresh } from "@/utils/telemetry";
import { useClock } from "@/hooks/useClock";
export function ThermalView({
  frame,
  demo = false,
  disconnected = false,
  stopped = false,
}: {
  frame: ThermalFrame;
  demo?: boolean;
  disconnected?: boolean;
  stopped?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pixel, setPixel] = useState(0);
  const now = useClock();
  const min = Math.min(...frame.values),
    max = Math.max(...frame.values);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    frame.values.forEach((value, i) => {
      ctx.fillStyle = `hsl(${240 - (240 * (value - min)) / (max - min || 1)} 85% 55%)`;
      ctx.fillRect(i % 32, Math.floor(i / 32), 1, 1);
    });
  }, [frame, min, max]);
  return (
    <div className="thermal-view">
      <canvas
        ref={canvas}
        width={32}
        height={24}
        aria-label="MLX90640 32 by 24 thermal frame"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.max(
            0,
            Math.min(31, Math.floor(((e.clientX - r.left) / r.width) * 32)),
          );
          const y = Math.max(
            0,
            Math.min(23, Math.floor(((e.clientY - r.top) / r.height) * 24)),
          );
          setPixel(y * 32 + x);
        }}
      />
      <div className="thermal-scale">
        <span>{min.toFixed(1)} °C</span>
        <i />
        <span>{max.toFixed(1)} °C</span>
      </div>
      <label>
        Inspect pixel (arrows or touch)
        <input
          type="range"
          min={0}
          max={767}
          value={pixel}
          onChange={(e) => setPixel(Number(e.target.value))}
        />
      </label>
      <output>
        Column {(pixel % 32) + 1}, row {Math.floor(pixel / 32) + 1}:{" "}
        {frame.values[pixel].toFixed(1)} °C
      </output>
      <small>
        {demo
          ? "Synthetic 32 × 24 fixture · not measured"
          : stopped
            ? "Last frame · source stopped"
            : disconnected
              ? "Last frame · disconnected"
              : isFresh(frame.timestamp, now)
                ? "Recent measured frame"
                : "Stale frame · check gateway"}{" "}
        · {captureTime(frame.timestamp)}
      </small>
    </div>
  );
}
