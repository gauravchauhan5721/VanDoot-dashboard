"use client";
/* eslint-disable @next/next/no-img-element -- Evidence uses exact captured image URLs and dimensions, including LAN sources. */
import { useState } from "react";
import type { Alert } from "@/types";
import { useDashboard } from "@/hooks/useDashboard";
import { captureTime, nearbyReadings } from "@/utils/telemetry";
import { matchingBox, safeMediaURL } from "./contracts";
import { sensorById } from "@/config/sensors";
import { StatusBadge } from "@/components/ui";
export function AlertEvidence({ alert }: { alert: Alert }) {
  const { data, settings } = useDashboard();
  const [failed, setFailed] = useState(false);
  const event = alert.evidence;
  const readings =
    alert.readings ||
    nearbyReadings(data.history, alert.nodeId, alert.timestamp);
  let image = "",
    audio = "";
  try {
    image = safeMediaURL(
      event?.imageUrl || "",
      settings.mode === "demo" && event?.simulated === true,
    );
  } catch {}
  try {
    audio = safeMediaURL(
      event?.audioUrl || "",
      settings.mode === "demo" && event?.simulated === true,
    );
  } catch {}
  const box = event && matchingBox(event);
  return (
    <div className="evidence-content">
      <div className="evidence-heading">
        <StatusBadge status={alert.severity} />
        <span>
          {settings.mode === "demo"
            ? "DEMO · synthetic scenario"
            : "CAPTURED EVIDENCE"}
        </span>
      </div>
      <h3>{alert.title}</h3>
      <p>{alert.message}</p>
      <dl className="evidence-metadata">
        <div>
          <dt>Node</dt>
          <dd>
            <a href={`#nodes/${encodeURIComponent(alert.nodeId)}`}>
              {alert.nodeId}
            </a>
          </dd>
        </div>
        <div>
          <dt>Captured</dt>
          <dd>
            {captureTime(event?.timestamp || alert.timestamp)}
            <small>{event?.timestamp || alert.timestamp}</small>
          </dd>
        </div>
        <div>
          <dt>Model / version</dt>
          <dd>
            {event?.model || "Not reported"}
            {event?.version ? ` / ${event.version}` : ""}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            {event?.score !== undefined
              ? `${(event.score * 100).toFixed(1)}%`
              : "Not reported"}
          </dd>
        </div>
      </dl>
      {image && !failed ? (
        <figure className="evidence-figure">
          <div className="evidence-image">
            <img
              src={image}
              alt={`${alert.nodeId}: captured ${event?.label || alert.title}`}
              onError={() => setFailed(true)}
            />
            {box && (
              <span
                className="evidence-box"
                style={{
                  left: `${box[0] * 100}%`,
                  top: `${box[1] * 100}%`,
                  width: `${box[2] * 100}%`,
                  height: `${box[3] * 100}%`,
                }}
              >
                <b>{event?.label}</b>
              </span>
            )}
          </div>
          <figcaption>
            {event?.simulated
              ? "Bundled illustrative frame · scripted boxes, not inference"
              : "Captured image · not the current live feed"}
          </figcaption>
        </figure>
      ) : (
        <div className="evidence-unavailable">
          {failed
            ? "Captured image unavailable. The evidence URL may have expired."
            : "No matching image was reported for this alert."}
        </div>
      )}
      {audio && (
        <label className="evidence-audio">
          Captured audio
          <audio controls preload="none" src={audio} />
        </label>
      )}
      <h4>Sensor context near capture</h4>
      <p className="muted">
        Each reading keeps its own timestamp. Only samples within ±30 seconds
        are shown.
      </p>
      {readings.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Reading</th>
                <th>Measured at</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.sensor}>
                  <td>{sensorById[r.sensor]?.name || r.sensor}</td>
                  <td>
                    {Number.isFinite(r.value)
                      ? r.value.toFixed(sensorById[r.sensor]?.precision || 0)
                      : "—"}{" "}
                    {sensorById[r.sensor]?.unit}
                  </td>
                  <td>{captureTime(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No nearby samples available. Current readings are not substituted.
        </p>
      )}
      <div className="modal-actions">
        <a
          className="button primary"
          href={`#node-media/${encodeURIComponent(alert.nodeId)}`}
        >
          View live now
        </a>
        <a
          className="button"
          href={`#forest/incidents/${encodeURIComponent(alert.id)}`}
        >
          Open incident review
        </a>
      </div>
    </div>
  );
}
