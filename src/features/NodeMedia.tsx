"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Radio,
  Thermometer,
  Settings2,
  Play,
  Square,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { Panel, Modal } from "@/components/ui";
import "./NodeMedia.css";
type Source = {
  camera: string;
  image: string;
  thermal: string;
  audio: string;
  events: string;
};
const blank: Source = {
  camera: "",
  image: "",
  thermal: "",
  audio: "",
  events: "",
};
type Event = {
  nodeId: string;
  id: string;
  timestamp: string;
  type: "camera" | "thermal" | "audio" | "sound-level";
  label: string;
  score?: number;
  model?: string;
  imageUrl?: string;
  value?: number;
  unit?: string;
};
type Frame = {
  nodeId: string;
  width: number;
  height: number;
  timestamp: string;
  values: number[];
};
function safeURL(value: string) {
  if (!value) return "";
  const u = new URL(value);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw Error("Use an HTTP(S) URL without embedded credentials.");
  return u.href;
}
function DetectionImage({ event }: { event?: Event }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [event?.imageUrl]);
  if (!event?.imageUrl) return null;
  let url = "";
  try {
    url = safeURL(event.imageUrl);
  } catch {
    return <p className="nm-error">Invalid detection image URL.</p>;
  }
  return (
    <div className="nm-evidence">
      {failed ? (
        <p className="nm-error">Detection image unavailable.</p>
      ) : (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={`${event.nodeId}: ${event.label}`}
            onError={() => setFailed(true)}
          />
        </a>
      )}
      <small>
        {event.label} · saved detection image ·{" "}
        {new Date(event.timestamp).toLocaleString()}
      </small>
    </div>
  );
}
function Heatmap({ frame }: { frame: Frame }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [point, setPoint] = useState<number | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const lo = Math.min(...frame.values),
      hi = Math.max(...frame.values);
    frame.values.forEach((v, i) => {
      ctx.fillStyle = `hsl(${240 - (240 * (v - lo)) / (hi - lo || 1)} 90% 52%)`;
      ctx.fillRect(i % frame.width, Math.floor(i / frame.width), 1, 1);
    });
  }, [frame]);
  return (
    <>
      <canvas
        aria-label="Thermal sensor heatmap"
        ref={ref}
        width={frame.width}
        height={frame.height}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.min(
            frame.width - 1,
            Math.floor(((e.clientX - r.left) / r.width) * frame.width),
          );
          const y = Math.min(
            frame.height - 1,
            Math.floor(((e.clientY - r.top) / r.height) * frame.height),
          );
          setPoint(frame.values[y * frame.width + x]);
        }}
      />
      <div className="nm-legend">
        <span>{Math.min(...frame.values).toFixed(1)} °C</span>
        <i />
        <span>{Math.max(...frame.values).toFixed(1)} °C</span>
      </div>
      <small>
        {frame.width} × {frame.height} · native resolution · click a pixel
        {point !== null && ` · ${point.toFixed(1)} °C`}
      </small>
      <small>Captured {new Date(frame.timestamp).toLocaleString()}</small>
    </>
  );
}
function Feed({
  nodeId,
  name,
  source,
}: {
  nodeId: string;
  name: string;
  source: Source;
}) {
  const [running, setRunning] = useState(false);
  const [cameraView, setCameraView] = useState("stream");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setRunning(false);
    setFrame(null);
    setEvents([]);
    setErrors({});
    setLoaded(false);
  }, [source]);
  useEffect(() => {
    if (!running) return;
    let active = true;
    let busy = false;
    const controller = new AbortController();
    async function poll() {
      if (busy) return;
      busy = true;
      for (const kind of ["thermal", "events"] as const) {
        if (!source[kind]) continue;
        try {
          const response = await fetch(source[kind], {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(8000),
            ]),
            cache: "no-store",
            credentials: "omit",
          });
          if (!response.ok) throw Error(`HTTP ${response.status}`);
          const body = await response.json();
          if (kind === "thermal") {
            const f = body as Frame;
            if (
              f.nodeId !== nodeId ||
              !Number.isInteger(f.width) ||
              !Number.isInteger(f.height) ||
              f.width < 1 ||
              f.height < 1 ||
              f.width * f.height > 4096 ||
              !Array.isArray(f.values) ||
              f.values.length !== f.width * f.height ||
              !f.values.every(Number.isFinite) ||
              !Number.isFinite(Date.parse(f.timestamp))
            )
              throw Error("Invalid thermal frame or wrong node ID");
            if (active)
              setFrame((old) =>
                !old || Date.parse(f.timestamp) >= Date.parse(old.timestamp)
                  ? f
                  : old,
              );
          } else {
            if (!Array.isArray(body) || body.length > 200)
              throw Error("Expected up to 200 detection events");
            const valid = body.filter(
              (v: Event) =>
                v &&
                v.nodeId === nodeId &&
                typeof v.id === "string" &&
                typeof v.label === "string" &&
                ["camera", "thermal", "audio", "sound-level"].includes(
                  v.type,
                ) &&
                Number.isFinite(Date.parse(v.timestamp)) &&
                (v.score === undefined ||
                  (Number.isFinite(v.score) && v.score >= 0 && v.score <= 1)),
            );
            if (active)
              setEvents(
                valid.sort(
                  (a: Event, b: Event) =>
                    Date.parse(b.timestamp) - Date.parse(a.timestamp),
                ),
              );
          }
          if (active) setErrors((old) => ({ ...old, [kind]: "" }));
        } catch (e) {
          if (active)
            setErrors((old) => ({
              ...old,
              [kind]: e instanceof Error ? e.message : "Connection failed",
            }));
        }
      }
      busy = false;
      if (active) setTick((t) => t + 1);
    }
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [running, source, nodeId]);
  const cameraEvents = events.filter((e) => e.type === "camera");
  const audioEvents = events.filter(
    (e) => e.type === "audio" || e.type === "sound-level",
  );
  const detected = cameraEvents.find((e) => e.imageUrl);
  let detectedImage = "";
  try {
    detectedImage = safeURL(detected?.imageUrl || source.image);
  } catch {}
  const showEvents = (items: Event[]) =>
    items.length ? (
      <div className="nm-events">
        {items.slice(0, 6).map((e) => (
          <div key={e.id}>
            <strong>{e.label}</strong>
            <span>
              {e.type === "sound-level"
                ? `${e.value ?? "—"} ${e.unit || "raw"}`
                : e.score !== undefined
                  ? `${(e.score * 100).toFixed(1)}% score`
                  : "Score not reported"}
            </span>
            <small>
              {new Date(e.timestamp).toLocaleString()} ·{" "}
              {e.model || "Model not reported"}
            </small>
          </div>
        ))}
      </div>
    ) : (
      <p className="nm-note">
        No detections received. AI requires a connected inference service.
      </p>
    );
  return (
    <Panel
      title={`${nodeId} · ${name}`}
      subtitle="Camera, thermal and sound — associated with this node only"
      action={
        <button
          className="button"
          disabled={!Object.values(source).some(Boolean)}
          onClick={() => {
            setRunning((v) => !v);
            setLoaded(false);
          }}
        >
          {running ? <Square size={13} /> : <Play size={13} />}{" "}
          {running ? "Stop sources" : "Connect sources"}
        </button>
      }
    >
      <div className="nm-columns">
        <section>
          <h3>
            <Camera size={16} /> AI camera · ESP32-CAM
          </h3>
          <div className="nm-toggle">
            <button
              className={cameraView === "stream" ? "active" : ""}
              onClick={() => {
                setCameraView("stream");
                setLoaded(false);
              }}
            >
              Live stream
            </button>
            <button
              className={cameraView === "image" ? "active" : ""}
              onClick={() => {
                setCameraView("image");
                setLoaded(false);
              }}
            >
              Detected image
            </button>
          </div>
          <div className="nm-media">
            {running &&
            (cameraView === "stream" ? source.camera : detectedImage) ? (
              <>
                <img
                  key={`${cameraView}-${cameraView === "image" ? tick : 0}`}
                  src={cameraView === "stream" ? source.camera : detectedImage}
                  alt={`${nodeId} ${cameraView === "stream" ? "camera stream" : "detected evidence"}`}
                  onLoad={() => {
                    setLoaded(true);
                    setErrors((old) => ({ ...old, camera: "" }));
                  }}
                  onError={() => {
                    setLoaded(false);
                    setErrors((old) => ({
                      ...old,
                      camera:
                        "Media unavailable. Check URL, device and browser network permissions.",
                    }));
                  }}
                />
                {!loaded && !errors.camera && <span>Waiting for image…</span>}
              </>
            ) : (
              <>
                <Camera size={30} />
                <span>
                  {!source.camera && !detectedImage
                    ? "Source not configured"
                    : "Source stopped"}
                </span>
              </>
            )}
          </div>
          {errors.camera && <p className="nm-error">{errors.camera}</p>}
          <p className="nm-note">
            {cameraView === "stream"
              ? "MJPEG stream · frame freshness not measurable in this viewer"
              : "Saved detection image · not a live feed"}
          </p>
          <p className="nm-note">
            Person / forest-fire detection · requires a validated camera model.
          </p>
          {showEvents(cameraEvents)}
        </section>
        <section>
          <h3>
            <Thermometer size={16} /> AI thermal camera
          </h3>
          <div className="nm-media nm-thermal">
            {frame ? (
              <Heatmap frame={frame} />
            ) : (
              <>
                <Thermometer size={30} />
                <span>
                  {source.thermal
                    ? running
                      ? "Waiting for thermal frame…"
                      : "Source stopped"
                    : "Thermal source not configured"}
                </span>
              </>
            )}
          </div>
          {frame && (
            <p className="nm-note">
              {!running
                ? "Saved last frame · source stopped"
                : errors.thermal
                  ? "Saved last frame · source disconnected"
                  : Date.now() - Date.parse(frame.timestamp) > 15000
                    ? "Stale frame (>15 seconds)"
                    : Date.parse(frame.timestamp) > Date.now() + 5000
                      ? "Device clock is ahead"
                      : "Recent frame"}
            </p>
          )}
          {errors.thermal && <p className="nm-error">{errors.thermal}</p>}
          <p className="nm-note">
            Person / forest-fire detection · requires a suitable thermal model.
            A hot pixel alone does not confirm a person or fire.
          </p>
          <DetectionImage
            event={events.find((e) => e.type === "thermal" && e.imageUrl)}
          />
          {showEvents(events.filter((e) => e.type === "thermal"))}
        </section>
        <section>
          <h3>
            <Radio size={16} /> Live sound detection
          </h3>
          <div className="nm-sound">
            <Radio size={30} />
            <strong>
              {running ? "Listening for detection events" : "Source stopped"}
            </strong>
            <span>Sound classification / sensor level</span>
          </div>
          {running && source.audio && (
            <audio controls src={source.audio} preload="none" />
          )}
          {showEvents(audioEvents)}
          <p className="nm-note">
            A sound-level sensor reports intensity only. Sound recognition needs
            microphone audio and an AI model. Playback never starts
            automatically.
          </p>
        </section>
      </div>
      {errors.events && (
        <p className="nm-error">Detection source: {errors.events}</p>
      )}
      {!running && events.length > 0 && (
        <p className="nm-note">
          Showing last received detections; sources are stopped.
        </p>
      )}
    </Panel>
  );
}
function DemoMedia({ nodeId, name }: { nodeId: string; name: string }) {
  const [sound, setSound] = useState("forest");
  const [cameraTime, setCameraTime] = useState(0);
  const [thermalTime, setThermalTime] = useState(0);
  const [cameraImage, setCameraImage] = useState(false);
  const [thermalImage, setThermalImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  return (
    <Panel
      title={`${nodeId} · ${name}`}
      subtitle="DEMO MEDIA · shared illustrative samples, not recordings from this node"
    >
      <div className="nm-columns">
        {(["camera", "thermal"] as const).map((kind) => {
          const still = kind === "camera" ? cameraImage : thermalImage;
          const time = kind === "camera" ? cameraTime : thermalTime;
          return (
            <section key={kind}>
              <h3>
                {kind === "camera" ? (
                  <Camera size={16} />
                ) : (
                  <Thermometer size={16} />
                )}{" "}
                {kind === "camera" ? "ESP32-CAM demo" : "Thermal camera demo"}
              </h3>
              <div className="nm-toggle">
                <button
                  className={!still ? "active" : ""}
                  onClick={() =>
                    kind === "camera"
                      ? setCameraImage(false)
                      : setThermalImage(false)
                  }
                >
                  Demo video
                </button>
                <button
                  className={still ? "active" : ""}
                  onClick={() =>
                    kind === "camera"
                      ? setCameraImage(true)
                      : setThermalImage(true)
                  }
                >
                  Detection image
                </button>
              </div>
              {still ? (
                <img
                  className="nm-demo-image"
                  src={`/demo/${kind}-poster.jpg`}
                  alt={`${nodeId} illustrative person and fire detection - not actual AI output`}
                />
              ) : (
                <video
                  className="nm-demo-video"
                  controls
                  playsInline
                  preload="metadata"
                  poster={`/demo/${kind}-poster.jpg`}
                  onError={() => setErrors((old) => ({ ...old, [kind]: true }))}
                  onTimeUpdate={(e) =>
                    kind === "camera"
                      ? setCameraTime(e.currentTarget.currentTime)
                      : setThermalTime(e.currentTarget.currentTime)
                  }
                >
                  <source src={`/demo/${kind}.mp4`} type="video/mp4" />
                  Your browser does not support this demo video.
                </video>
              )}
              {errors[kind] && (
                <p className="nm-error">
                  Demo video could not load. Reload the page to retry.
                </p>
              )}
              <div className="nm-demo-result">
                <strong>
                  SIMULATED · Person present
                  {(still || time >= 4) && " + fire visible"}
                </strong>
                <small>
                  {still
                    ? "Saved illustrative frame at 6 seconds"
                    : "Scenario: person at 0s; fire appears at 4s"}
                </small>
              </div>
              <p className="nm-note">
                10-second animation. Boxes are illustrative, not model
                predictions.
                {kind === "thermal" &&
                  " Colors are synthetic, not measured temperatures."}
              </p>
            </section>
          );
        })}
        <section>
          <h3>
            <Radio size={16} /> Sound demo
          </h3>
          <label className="nm-demo-sound-label">
            Sample sound
            <select
              aria-label={`Demo sound for ${nodeId}`}
              value={sound}
              onChange={(e) => setSound(e.target.value)}
            >
              <option value="forest">Forest-like ambience / chirps</option>
              <option value="motor">Motor / chainsaw-like buzz</option>
              <option value="chopping">Chopping-like impacts</option>
            </select>
          </label>
          <div className="nm-sound">
            <Radio size={30} />
            <strong>Synthesized audio sample</strong>
            <span>8 seconds · mono · 22.05 kHz</span>
          </div>
          <audio
            key={sound}
            controls
            preload="metadata"
            src={`/demo/${sound}.wav`}
          />
          <p className="nm-note">
            Press Play to listen. These are synthesized effects for testing
            playback, not field recordings or AI classification results.
          </p>
          <div className="nm-demo-result">
            <strong>
              Demo label:{" "}
              {sound === "forest"
                ? "ambience"
                : sound === "motor"
                  ? "motor-like sound"
                  : "impact sound"}
            </strong>
            <small>Manually assigned sample label · no confidence score</small>
          </div>
        </section>
      </div>
    </Panel>
  );
}
export function NodeMedia() {
  const { data, settings } = useDashboard();
  const [showDemo, setShowDemo] = useState(true);
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [selected, setSelected] = useState("all");
  const [edit, setEdit] = useState("");
  const [form, setForm] = useState<Source>(blank);
  const [message, setMessage] = useState("");
  const mode = settings.mode;
  useEffect(() => {
    setSources({});
    setEdit("");
    setSelected("all");
    try {
      const saved = JSON.parse(
        localStorage.getItem(`vandoot-media-${mode}`) || "{}",
      );
      const valid: Record<string, Source> = {};
      for (const [id, value] of Object.entries(saved)) {
        const source = { ...blank, ...(value as Source) };
        for (const key of Object.keys(blank) as (keyof Source)[])
          source[key] = safeURL(source[key]);
        valid[id] = source;
      }
      setSources(valid);
    } catch {
      setMessage("Saved source settings could not be loaded.");
    }
  }, [mode]);
  const nodes = data.nodes.filter(
    (n) => selected === "all" || n.id === selected,
  );
  return (
    <div className="node-media">
      <div className="section-toolbar">
        <label>
          Node{" "}
          <select
            aria-label="Media node"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">All nodes</option>
            {data.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.name}
              </option>
            ))}
          </select>
        </label>
        <span className="nm-note">
          {mode === "demo"
            ? "Demo nodes · illustrative videos & synthesized sound"
            : "Live node list"}
        </span>
      </div>
      <p className="nm-note">
        Connect each node’s camera, thermal and sound sources below.
        Configuration stays in this browser, separately for Demo and Live modes.
        Private LAN streams should be opened from the locally running dashboard.
      </p>
      {mode === "demo" && (
        <div className="nm-demo-choice">
          <button className="button" onClick={() => setShowDemo((v) => !v)}>
            {showDemo ? "Use configured sources" : "Show demo videos & sounds"}
          </button>
          <span className="nm-note">
            {showDemo
              ? "Demo playback only. Nothing is sent to Live mode."
              : "Using your configured source URLs."}
          </span>
        </div>
      )}
      {message && (
        <p role="status" className="nm-note">
          {message}
        </p>
      )}
      {nodes.map((n) => (
        <div className="nm-node" key={`${mode}-${n.id}`}>
          <div className="nm-config">
            <button
              className="button"
              onClick={() => {
                setEdit(n.id);
                setForm(sources[n.id] || blank);
                setMessage("");
              }}
            >
              <Settings2 size={14} /> Configure {n.id} sources
            </button>
          </div>
          {mode === "demo" && showDemo ? (
            <DemoMedia nodeId={n.id} name={n.name} />
          ) : (
            <Feed nodeId={n.id} name={n.name} source={sources[n.id] || blank} />
          )}
        </div>
      ))}
      {!nodes.length && (
        <Panel title="No nodes available">
          <p>
            Connect your gateway in Settings to load its nodes, or select Demo
            to inspect the section.
          </p>
        </Panel>
      )}
      {edit && (
        <Modal title={`${edit} · media sources`} onClose={() => setEdit("")}>
          <form
            className="modal-body nm-form"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const next = { ...form };
                for (const key of Object.keys(next) as (keyof Source)[])
                  next[key] = safeURL(next[key]);
                const all = { ...sources, [edit]: next };
                localStorage.setItem(
                  `vandoot-media-${mode}`,
                  JSON.stringify(all),
                );
                setSources(all);
                setEdit("");
                setMessage(
                  "Source settings saved. Select Connect sources to check availability; saving does not mark the device online.",
                );
              } catch (e) {
                setMessage(String(e));
              }
            }}
          >
            {(
              [
                ["camera", "ESP32-CAM MJPEG stream URL"],
                ["image", "Latest detected image URL (optional)"],
                ["thermal", "Thermal frame JSON URL"],
                ["audio", "Audio playback URL (optional)"],
                ["events", "Detection events JSON URL"],
              ] as [keyof Source, string][]
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="url"
                  value={form[key]}
                  onChange={(e) =>
                    setForm((old) => ({ ...old, [key]: e.target.value }))
                  }
                  placeholder="http://device-or-gateway/..."
                />
              </label>
            ))}
            <p className="nm-note">
              Use URLs without passwords or tokens. JSON endpoints need CORS
              permission for the dashboard. HTTPS pages can block HTTP/LAN
              feeds; run locally for ESP32 testing. Thermal JSON and detection
              formats are documented in MEDIA_SETUP.md.
            </p>
            {message && (
              <p role="alert" className="nm-error">
                {message}
              </p>
            )}
            <button className="button primary" type="submit">
              Save sources
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
