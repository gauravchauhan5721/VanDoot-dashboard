"use client";
import { ArrowUpRight, Radio, TriangleAlert } from "lucide-react";
import type { DetectionEvent, ModelStatus } from "./contracts";
import { eventAlert } from "./contracts";
import { captureTime } from "@/utils/telemetry";
export function EventHistory({
  events,
  modelStatus,
  error,
  running = true,
  alertIds = {},
}: {
  events: DetectionEvent[];
  modelStatus: ModelStatus;
  error?: string;
  running?: boolean;
  alertIds?: Record<string, string>;
}) {
  return (
    <div className="event-history">
      <div className="event-status" role="status">
        <Radio size={16} />
        {!running
          ? "Sources stopped · last received events"
          : error
            ? "Detection endpoint unreachable"
            : modelStatus === "disconnected"
              ? "Model disconnected"
              : modelStatus === "connected"
                ? "Model connected"
                : "Model status not reported"}
      </div>
      {error && (
        <p className="source-error">
          {error}. Check the event URL and CORS, then retry sources.
        </p>
      )}
      {events.length ? (
        events.slice(0, 20).map((event) => (
          <a
            className="event-row"
            key={event.id}
            href={`#alerts/${encodeURIComponent(alertIds[event.id] || eventAlert(event).id)}`}
          >
            <TriangleAlert size={18} />
            <span>
              <strong>{event.label}</strong>
              <small>{captureTime(event.timestamp)}</small>
              <small>
                {event.type === "sound-level"
                  ? `${event.value ?? "—"} ${event.unit || "raw"}`
                  : `${event.model || "Model not reported"}${event.version ? ` / ${event.version}` : ""}${event.score !== undefined ? ` · ${(event.score * 100).toFixed(1)}%` : ""}`}
              </small>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ))
      ) : (
        <p className="empty-events">
          No detections received
          {modelStatus === "disconnected"
            ? " · reconnect the reported model service."
            : "."}
        </p>
      )}
    </div>
  );
}
