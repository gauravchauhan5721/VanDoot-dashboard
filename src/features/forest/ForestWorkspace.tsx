"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded evidence previews are local blob URLs with matched detection coordinates. */
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { useDashboard } from "@/hooks/useDashboard";
import {
  ForestModule,
  ForestRecord,
  Inference,
  thermalFrame,
  titles,
} from "./contracts";
import "./forest.css";
let workspaceToken = "";
import { AlertEvidence } from "@/features/media/AlertEvidence";
import { nearbyReadings } from "@/utils/telemetry";
export function ForestWorkspace({
  module,
  alertId,
  queryString = "",
}: {
  module: ForestModule;
  alertId?: string;
  queryString?: string;
}) {
  const { data, settings } = useDashboard();
  const observation = data.alerts.find((a) => a.id === alertId);
  const [token, setToken] = useState(workspaceToken);
  const [records, setRecords] = useState<ForestRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<Inference | null>(null);
  const [frame, setFrame] = useState<number[]>([]);
  const [title, setTitle] = useState(observation?.title || "");
  const [node, setNode] = useState(observation?.nodeId || "");
  const [note, setNote] = useState(observation?.message || "");
  const [evidence, setEvidence] = useState(
    observation?.evidence?.imageUrl?.startsWith("https:")
      ? observation.evidence.imageUrl
      : "",
  );
  const [identity, setIdentity] = useState("");
  const [lookup, setLookup] = useState("");
  const [review, setReview] = useState("");
  const filter = new URLSearchParams(queryString).get("state") || "all";
  const headers = { Authorization: `Bearer ${token}` };
  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- release the external file preview when removed.
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/forest", { headers });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setRecords(v);
      setMessage("Records loaded from PostgreSQL.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(
    kind: string,
    payload: Record<string, unknown>,
    id?: string,
  ) {
    setBusy(true);
    try {
      const r = await fetch("/api/forest", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ kind, payload, id }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setRecords((old) => [v, ...old.filter((x) => x.id !== v.id)]);
      setMessage("Saved to PostgreSQL.");
      return true;
    } catch (e) {
      setMessage(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function notifyIncident(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/forest/notify", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setMessage(v.message);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function predict() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("task", module);
      const r = await fetch("/api/inference", {
        method: "POST",
        headers,
        body: form,
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setResult(v);
      setMessage(
        "Inference complete on uploaded evidence. Hardware connection is not implied.",
      );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  const sensorNode = data.nodes.find((n) => n.id === node);
  const selectedRecords = records.filter((r) =>
    module === "rangers"
      ? r.kind === "ranger"
      : module === "models"
        ? r.kind === "model"
        : r.kind === "incident",
  );
  const ranger = records.find(
    (r) =>
      r.kind === "ranger" &&
      r.payload.chipId === lookup &&
      r.payload.enabled === true,
  );
  const values = frame.length
    ? {
        min: Math.min(...frame),
        max: Math.max(...frame),
        mean: frame.reduce((a, b) => a + b, 0) / frame.length,
      }
    : null;
  return (
    <div className="forest-workspace">
      <div className="forest-hero">
        <div>
          <span className="forest-kicker">VANDOOT / FOREST PROTECTION</span>
          <h2>{titles[module]}</h2>
          <p>Evidence, sensor context and human review in one workspace.</p>
        </div>
        <span className="forest-chip">
          {settings.mode === "demo"
            ? "DEMO SENSOR CONTEXT"
            : "LIVE SENSOR CONTEXT"}
        </span>
      </div>
      {observation && (
        <Panel title="Observation flagged for review">
          <AlertEvidence alert={observation} />
        </Panel>
      )}
      <div className="forest-access">
        <label>
          Workspace access token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => {
              workspaceToken = e.target.value;
              setToken(e.target.value);
            }}
            placeholder="Server-configured token"
          />
        </label>
        <button disabled={busy || !token} onClick={load}>
          Load saved records
        </button>
        <small>
          Token stays in memory. Records require PostgreSQL; predictions require
          a connected model service.
        </small>
      </div>
      {message && (
        <p className="forest-message" role="status">
          {message}
        </p>
      )}
      {["fire", "camera", "audio"].includes(module) && (
        <div className="forest-columns">
          <Panel
            title={
              module === "audio"
                ? "Analyse an audio recording"
                : "Analyse an image"
            }
          >
            <div className="forest-form">
              <p>
                {module === "audio"
                  ? "Upload WAV, MP3 or OGG."
                  : "Upload JPEG, PNG or WebP."}{" "}
                Maximum 10 MB. No predictions are fabricated when the model is
                disconnected.
              </p>
              <label>
                Evidence file
                <input
                  type="file"
                  accept={
                    module === "audio"
                      ? ".wav,.mp3,.ogg"
                      : ".jpg,.jpeg,.png,.webp"
                  }
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setResult(null);
                  }}
                />
              </label>
              {preview &&
                (module === "audio" ? (
                  <audio controls src={preview} />
                ) : (
                  <div className="forest-image">
                    <img src={preview} alt="Uploaded evidence" />
                    {result?.detections
                      .filter((d) => d.box)
                      .map((d, i) => (
                        <div
                          key={i}
                          className="forest-box"
                          style={{
                            left: `${d.box![0] * 100}%`,
                            top: `${d.box![1] * 100}%`,
                            width: `${d.box![2] * 100}%`,
                            height: `${d.box![3] * 100}%`,
                          }}
                        >
                          <span>
                            {d.label} {(d.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
              <button disabled={!file || !token || busy} onClick={predict}>
                {busy ? "Processing…" : "Run connected model"}
              </button>
            </div>
          </Panel>
          <Panel title="Model results">
            <div className="forest-form">
              {result ? (
                <>
                  <p>
                    {result.model} · {result.version}
                  </p>
                  {result.detections.length ? (
                    result.detections.map((d, i) => (
                      <div className="forest-result" key={i}>
                        <strong>{d.label}</strong>
                        <span>{(d.confidence * 100).toFixed(1)}%</span>
                        <progress max={1} value={d.confidence} />
                      </div>
                    ))
                  ) : (
                    <p>No detections reported by the model.</p>
                  )}
                </>
              ) : (
                <p>
                  No inference result. Connect a trained service, then analyse a
                  file.
                </p>
              )}
              <p>
                Results describe this uploaded file. A detected person is not
                automatically an intruder.
              </p>
            </div>
          </Panel>
        </div>
      )}
      {module === "thermal" && (
        <Panel title="32 × 24 thermal frame">
          <div className="forest-form">
            <p>
              Import a JSON array of 768 temperatures in °C from MLX90640
              recordings. This view reports temperatures; it does not classify
              people or confirm fire.
            </p>
            <input
              aria-label="Thermal JSON file"
              type="file"
              accept=".json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 50000) throw Error("Thermal file too large");
                  setFrame(thermalFrame(JSON.parse(await f.text())));
                  setMessage("Recorded thermal frame loaded.");
                } catch (err) {
                  setFrame([]);
                  setMessage(String(err));
                }
              }}
            />
            {values && (
              <>
                <div className="thermal-grid" aria-label="Thermal heatmap">
                  {frame.map((v, i) => (
                    <span
                      key={i}
                      title={`${i % 32},${Math.floor(i / 32)}: ${v} °C`}
                      style={{
                        background: `hsl(${240 - (240 * (v - values.min)) / Math.max(1, values.max - values.min)} 85% 55%)`,
                      }}
                    />
                  ))}
                </div>
                <p>
                  Minimum {values.min.toFixed(1)} °C · Maximum{" "}
                  {values.max.toFixed(1)} °C · Mean {values.mean.toFixed(1)} °C.
                  Colour scale is relative to this frame.
                </p>
              </>
            )}
          </div>
        </Panel>
      )}
      {module === "fusion" && (
        <Panel title="Verification workbench">
          <div className="forest-form">
            <p>
              Review camera/audio evidence alongside sensor readings. Automated
              Random Forest fusion is not connected yet. A human reviewer can
              record a decision in the incident form below.
            </p>
            <div className="forest-steps">
              <span>Sensor observation</span>
              <span>Model evidence</span>
              <span>Human verification</span>
              <span>Incident action</span>
            </div>
          </div>
        </Panel>
      )}
      {["fire", "camera", "audio", "thermal", "fusion", "incidents"].includes(
        module,
      ) && (
        <Panel title="Create an incident for review">
          <div className="forest-form">
            <div className="forest-fields">
              <label>
                Incident title
                <input
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Describe the observation"
                />
              </label>
              <label>
                Sensor node
                <select value={node} onChange={(e) => setNode(e.target.value)}>
                  <option value="">No associated node</option>
                  {data.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.id})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Persistent evidence URL (optional)
                <input
                  type="url"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label>
                Observation / verification notes
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
            {sensorNode && (
              <p>
                {sensorNode.id}: {sensorNode.status} · last seen{" "}
                {sensorNode.lastSeen}
                <br />
                Temperature:{" "}
                {Number.isFinite(sensorNode.readings.temperature)
                  ? sensorNode.readings.temperature
                  : "Unknown"}{" "}
                °C · MQ2:{" "}
                {Number.isFinite(sensorNode.readings.MQ2)
                  ? sensorNode.readings.MQ2
                  : "Unknown"}{" "}
                raw
              </p>
            )}
            <small>
              Local file previews are temporary. To retain the original
              evidence, supply a durable HTTPS URL. Inference results and sensor
              context are saved with the incident.
            </small>
            <button
              disabled={!title.trim() || !token || busy}
              onClick={() =>
                save("incident", {
                  title: title.trim(),
                  module,
                  state: "active",
                  note,
                  evidenceUrl: evidence,
                  nodeId: node,
                  source: result ? "recorded-inference" : "manual-review",
                  sensorSource: settings.mode,
                  observedAt:
                    observation?.timestamp || new Date().toISOString(),
                  alertId: observation?.id,
                  capturedEvidence: observation?.evidence,
                  nearbyReadings: observation
                    ? observation.readings ||
                      nearbyReadings(
                        data.history,
                        observation.nodeId,
                        observation.timestamp,
                      )
                    : undefined,
                  sensorTimestamp: observation
                    ? undefined
                    : sensorNode?.lastSeen,
                  readings: observation ? undefined : sensorNode?.readings,
                  inference: result || undefined,
                  thermal: values || undefined,
                  evidenceName: file?.name,
                })
              }
            >
              Save incident
            </button>
          </div>
        </Panel>
      )}
      {module === "rangers" && (
        <div className="forest-columns">
          <Panel title="Register a ranger">
            <div className="forest-form">
              <label>
                Ranger name
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Chip / badge ID
                <input
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !token || !title.trim() || !identity.trim()}
                onClick={() => {
                  if (
                    records.some(
                      (r) =>
                        r.kind === "ranger" &&
                        r.payload.chipId === identity.trim(),
                    )
                  ) {
                    setMessage(
                      "This chip ID is already registered in the loaded records.",
                    );
                    return;
                  }
                  void save("ranger", {
                    title: title.trim(),
                    chipId: identity.trim(),
                    enabled: true,
                  });
                }}
              >
                Register
              </button>
            </div>
          </Panel>
          <Panel title="Check an identity">
            <div className="forest-form">
              <label>
                Observed chip ID
                <input
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                />
              </label>
              <p>
                {lookup
                  ? ranger
                    ? `Registered: ${ranger.payload.title}`
                    : "Identity unverified in loaded records. Human review required."
                  : "Enter an observed ID. Load the registry first."}
              </p>
              <small>
                This is a registry lookup, not physical chip authentication.
                Reader integration comes later.
              </small>
            </div>
          </Panel>
        </div>
      )}
      {module === "models" && (
        <Panel title="Register a trained model">
          <div className="forest-form">
            <p>
              Register your own evaluated model here. Registration does not
              deploy or train it.
            </p>
            <div className="forest-fields">
              <label>
                Model name
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Version
                <input
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                />
              </label>
              <label>
                Task, dataset and evaluation notes
                <textarea
                  placeholder="Dataset split, precision, recall, false alarms, limitations…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
            <button
              disabled={!token || busy || !title.trim() || !identity.trim()}
              onClick={() =>
                save("model", {
                  title: title.trim(),
                  version: identity.trim(),
                  evaluation: note,
                  status: "registered-not-deployed",
                })
              }
            >
              Save model record
            </button>
          </div>
        </Panel>
      )}
      {module === "integration" && (
        <Panel title="Connection readiness">
          <div className="forest-form">
            <p>
              Connect a gateway in Settings. Existing Raspberry Pi GET /latest
              responses remain supported. Each node must provide its true
              timestamp and explicit online state.
            </p>
            <div className="forest-result">
              <strong>Gateway endpoint</strong>
              <span>{settings.apiEndpoint || "Not configured"}</span>
            </div>
            <div className="forest-result">
              <strong>WebSocket endpoint</strong>
              <span>{settings.wsEndpoint || "Not configured"}</span>
            </div>
            <a className="button" href="#settings">
              Open connection settings
            </a>
            <h3>Canonical sensor keys</h3>
            <p>
              temperature (°C), humidity (%), MQ2 (raw), PIR (0/1), pm25
              (µg/m³), thermalMax (°C), soundLevel (raw), battery (%), rssi
              (dBm), snr (dB).
            </p>
            <h3>Gateway response example</h3>
            <pre>
              {JSON.stringify(
                {
                  "NODE-01": {
                    online: true,
                    received_at: "REPLACE_WITH_CURRENT_ISO_TIMESTAMP",
                    temperature: 28.5,
                    humidity: 62,
                    MQ2: 180,
                    PIR: 0,
                    pm25: 12,
                    thermalMax: 30.2,
                    location: {
                      lat: 31.7,
                      lng: 76.5,
                      label: "Replace with surveyed location",
                    },
                  },
                },
                null,
                2,
              )}
            </pre>
            <p>
              Unknown sensors remain unknown. Live history is retained for this
              browser session; long-term history belongs in the gateway backend.
              Device commands remain disabled until a gateway command
              implementation exists.
            </p>
            <h3>Model connection</h3>
            <p>
              Server environment: AI_SERVICE_URL and optional AI_SERVICE_TOKEN.
              The service accepts POST /predict multipart fields file and task.
              Configure FOREST_ADMIN_TOKEN and run migrations/001_forest.sql for
              protected evidence records.
            </p>
          </div>
        </Panel>
      )}
      {module !== "integration" && (
        <Panel
          title={
            module === "rangers"
              ? "Registered rangers"
              : module === "models"
                ? "Registered models"
                : "Saved incidents"
          }
        >
          <div className="forest-form">
            {!["rangers", "models"].includes(module) && (
              <label>
                Incident state
                <select
                  value={filter}
                  onChange={(e) => {
                    const params = new URLSearchParams(queryString);
                    params.set("state", e.target.value);
                    window.location.hash =
                      window.location.hash.split("?")[0] +
                      "?" +
                      params.toString();
                  }}
                >
                  {[
                    "all",
                    "active",
                    "acknowledged",
                    "resolved",
                    "false-positive",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            {!selectedRecords.length && (
              <p>
                No records loaded. Connect storage and load records using the
                access token above.
              </p>
            )}
            {selectedRecords
              .filter(
                (r) =>
                  filter === "all" ||
                  r.kind !== "incident" ||
                  r.payload.state === filter,
              )
              .map((r) => (
                <article className="forest-record" key={r.id}>
                  <div>
                    <strong>{String(r.payload.title)}</strong>
                    <span className="forest-chip">
                      {String(
                        r.payload.state ||
                          r.payload.status ||
                          (r.payload.enabled ? "enabled" : "disabled"),
                      )}
                    </span>
                  </div>
                  <p>
                    {String(
                      r.payload.note ||
                        r.payload.evaluation ||
                        r.payload.chipId ||
                        "",
                    )}
                  </p>
                  <small>
                    {r.updatedAt} · {String(r.payload.source || r.kind)}{" "}
                    {r.payload.sensorSource
                      ? `· ${r.payload.sensorSource} sensor context`
                      : ""}
                  </small>
                  {typeof r.payload.evidenceUrl === "string" &&
                    r.payload.evidenceUrl.startsWith("https://") && (
                      <p>
                        <a
                          href={r.payload.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open evidence
                        </a>
                      </p>
                    )}
                  <details>
                    <summary>Stored evidence and metadata</summary>
                    <pre>{JSON.stringify(r.payload, null, 2)}</pre>
                  </details>
                  {r.kind === "incident" && (
                    <>
                      <button
                        disabled={busy || !token}
                        onClick={() => notifyIncident(r.id)}
                      >
                        Send to configured notification channel
                      </button>
                      <label>
                        Review note
                        <input
                          value={review}
                          onChange={(e) => setReview(e.target.value)}
                        />
                      </label>
                      <div className="forest-actions">
                        {["acknowledged", "resolved", "false-positive"].map(
                          (state) => (
                            <button
                              disabled={busy || !token || !review.trim()}
                              key={state}
                              onClick={() =>
                                save(
                                  "incident",
                                  {
                                    ...r.payload,
                                    state,
                                    reviews: [
                                      ...(Array.isArray(r.payload.reviews)
                                        ? r.payload.reviews
                                        : []),
                                      {
                                        state,
                                        note: review,
                                        at: new Date().toISOString(),
                                      },
                                    ],
                                  },
                                  r.id,
                                )
                              }
                            >
                              {state}
                            </button>
                          ),
                        )}
                      </div>
                    </>
                  )}
                  {r.kind === "ranger" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        save(
                          "ranger",
                          { ...r.payload, enabled: !r.payload.enabled },
                          r.id,
                        )
                      }
                    >
                      {r.payload.enabled ? "Disable badge" : "Enable badge"}
                    </button>
                  )}
                </article>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
