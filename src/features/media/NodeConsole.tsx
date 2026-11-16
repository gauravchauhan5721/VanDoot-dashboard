"use client";
import { useState } from "react";
import { Camera, Radio, Settings2, Thermometer } from "lucide-react";
import { Panel, StatusBadge } from "@/components/ui";
import { useDashboard } from "@/hooks/useDashboard";
import { useNodeMedia } from "./useNodeMedia";
import { CameraFeed } from "./CameraFeed";
import { SourceSetup } from "./SourceSetup";
import { ThermalView } from "./ThermalView";
import { EventHistory } from "./EventHistory";
import { SnapshotImage } from "./SnapshotImage";
import { captureTime, isFresh } from "@/utils/telemetry";
import { sensors } from "@/config/sensors";
import { sensorValue } from "@/utils/format";
import { useClock } from "@/hooks/useClock";
export function NodeReadings({ nodeId }: { nodeId: string }) {
  const { data, settings } = useDashboard();
  const now = useClock();
  const node = data.nodes.find((n) => n.id === nodeId);
  const fresh =
    settings.mode === "demo" ||
    (!!node &&
      node.status !== "offline" &&
      isFresh(node.lastSeen, Math.max(now, Date.parse(data.timestamp) || 0)));
  return (
    <div className="node-readings">
      {sensors
        .filter((s) => s.featured)
        .map((sensor) => {
          const value = node?.readings[sensor.id] ?? NaN;
          const display = sensorValue(
            fresh ? value : NaN,
            sensor,
            settings.units,
          );
          const threshold = settings.thresholds[sensor.id];
          const warning =
            fresh &&
            threshold &&
            (threshold.direction === "above"
              ? value > threshold.warning
              : value < threshold.warning);
          return (
            <a
              key={sensor.id}
              href={`#analytics/${sensor.id}/${encodeURIComponent(nodeId)}`}
              className={warning ? "reading warning" : "reading"}
            >
              <span>
                {sensor.hardware === "DHT22" ? "DHT22 " : ""}
                {sensor.name}
              </span>
              <strong>
                {sensor.id === "PIR" && fresh && Number.isFinite(value)
                  ? value
                    ? "Motion"
                    : "Clear"
                  : display.value}
                <small>{sensor.id === "PIR" ? "" : display.unit}</small>
              </strong>
              <small>
                {warning
                  ? "⚠ Review threshold"
                  : !fresh
                    ? "Stale / unknown"
                    : Number.isFinite(value)
                      ? captureTime(node?.lastSeen || "")
                      : "Not reported"}
              </small>
            </a>
          );
        })}
    </div>
  );
}
export function NodeConsole({
  nodeId,
  compact = false,
}: {
  nodeId: string;
  compact?: boolean;
}) {
  const { data, settings, mediaEvents } = useDashboard();
  const media = useNodeMedia(nodeId);
  const [setup, setSetup] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const node = data.nodes.find((n) => n.id === nodeId);
  const events = [
    ...data.alerts.flatMap((a) => (a.evidence ? [a.evidence] : [])),
    ...mediaEvents,
  ].filter(
    (e, i, all) =>
      e.nodeId === nodeId &&
      all.findIndex((x) => x.id === e.id && x.nodeId === e.nodeId) === i,
  );
  const demoTimestamp = events[0]?.timestamp || node?.lastSeen || "";
  const demoFrame = {
    nodeId,
    width: 32,
    height: 24,
    timestamp: demoTimestamp,
    values: Array.from(
      { length: 768 },
      (_, i) =>
        23 +
        16 *
          Math.exp(
            -(((i % 32) - 21) ** 2 + (Math.floor(i / 32) - 12) ** 2) / 22,
          ),
    ),
  };
  return (
    <div className={`node-console ${compact ? "compact-console" : ""}`}>
      <Panel
        className="feed-panel"
        title={node?.location.label || nodeId}
        subtitle={`${nodeId} · ${node?.name || "Forest watch"}`}
        action={
          <div className="feed-actions">
            <StatusBadge status={node?.status || "offline"} />
            {!compact && (
              <button
                className="icon-button"
                aria-label="Configure node sources"
                onClick={() => setSetup(true)}
              >
                <Settings2 size={18} />
              </button>
            )}
          </div>
        }
      >
        <CameraFeed
          key={`${nodeId}-${settings.mode}`}
          nodeId={nodeId}
          url={media.source.camera}
          demo={media.demo}
          running={media.running}
        />
        <div className="feed-toolbar">
          <span>
            <Camera size={15} />
            {media.demo
              ? "Bundled demo · no API key"
              : "Media and telemetry are independent"}
          </span>
          {compact ? (
            <a
              className="text-link"
              href={`#node-media/${encodeURIComponent(nodeId)}`}
            >
              Open node media ↗
            </a>
          ) : (
            <button
              className="button"
              onClick={() => media.setRunning(!media.running)}
            >
              {media.running ? "Stop sources" : "Connect sources"}
            </button>
          )}
        </div>
        <NodeReadings nodeId={nodeId} />
      </Panel>
      {!compact && (
        <>
          <div className="media-secondary">
            {!media.demo && media.running && media.source.image && (
              <Panel title="Latest configured image">
                <SnapshotImage
                  key={media.source.image}
                  url={media.source.image}
                />
              </Panel>
            )}
            <Panel
              title="Thermal frame"
              subtitle="MLX90640 · native 32 × 24"
              action={<Thermometer size={18} />}
            >
              {media.demo || media.frame ? (
                <ThermalView
                  frame={media.demo ? demoFrame : media.frame!}
                  demo={media.demo}
                  disconnected={!!media.errors.thermal}
                  stopped={!media.running}
                />
              ) : (
                <div className="media-placeholder">
                  <Thermometer size={28} />
                  <p>
                    {media.source.thermal
                      ? "Waiting for measured thermal frame"
                      : "Thermal source not configured"}
                  </p>
                  <button className="button" onClick={() => setSetup(true)}>
                    Configure sources
                  </button>
                </div>
              )}
              {media.errors.thermal && (
                <p className="source-error">
                  {media.errors.thermal}{" "}
                  <button className="button" onClick={media.retry}>
                    Retry thermal
                  </button>
                </p>
              )}
            </Panel>
            <Panel
              title="Microphone audio"
              subtitle="Playback starts only when you press Play"
              action={<Radio size={18} />}
            >
              <div className="audio-body">
                <div className="audio-symbol">
                  <Radio size={32} />
                </div>
                <strong>
                  {media.demo
                    ? "Synthetic forest ambience"
                    : media.source.audio
                      ? "Microphone source configured"
                      : "Audio source not configured"}
                </strong>
                {media.running && (media.demo || media.source.audio) && (
                  <audio
                    key={`${nodeId}-${settings.mode}-${media.source.audio}`}
                    controls
                    preload="none"
                    src={media.demo ? "/demo/forest.wav" : media.source.audio}
                    onError={() => setAudioError(true)}
                    onLoadedMetadata={() => setAudioError(false)}
                    aria-label="Node microphone audio"
                  />
                )}
                {audioError && (
                  <p role="status">
                    Audio unavailable. Check the URL and supported format in
                    source setup.
                  </p>
                )}
                <p>
                  Sound intensity is a raw sensor reading. A sound label
                  requires a reported model result.
                </p>
              </div>
            </Panel>
          </div>
          <Panel
            title="Detection events"
            subtitle="Captured evidence, newest first"
          >
            <EventHistory
              alertIds={Object.fromEntries(
                data.alerts
                  .filter((a) => a.nodeId === nodeId && a.evidence)
                  .map((a) => [a.evidence!.id, a.id]),
              )}
              events={events}
              modelStatus={media.demo ? "unknown" : media.modelStatus}
              error={media.errors.events}
              running={media.running}
            />
          </Panel>
          <div className="section-toolbar">
            <button className="button" onClick={() => setSetup(true)}>
              <Settings2 size={16} />
              Configure & test sources
            </button>
            <button className="button" onClick={media.retry}>
              Retry sources
            </button>
            <a className="text-link" href="#forest/camera">
              Test a model · upload evidence
            </a>
            <a className="text-link" href="#forest/audio">
              Test audio model
            </a>
          </div>
        </>
      )}
      {media.errors.settings && <p role="status">{media.errors.settings}</p>}
      {setup && (
        <SourceSetup
          nodeId={nodeId}
          source={media.source}
          save={media.save}
          close={() => setSetup(false)}
        />
      )}
    </div>
  );
}
