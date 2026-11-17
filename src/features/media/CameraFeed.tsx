"use client";
/* eslint-disable @next/next/no-img-element -- MJPEG needs a native image stream without an optimization proxy. */
import { useEffect, useRef, useState } from "react";
import { Camera, Maximize, RefreshCw } from "lucide-react";

function SnapshotPreview({ url, nodeId }: { url: string; nodeId: string }) {
  const [frame, setFrame] = useState("");
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let current = "";
    let previous = "";

    async function refresh() {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "omit",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(4000),
          ]),
        });
        if (
          !response.ok ||
          !response.headers.get("Content-Type")?.startsWith("image/jpeg")
        ) {
          throw Error("Camera frame unavailable");
        }
        const jpeg = await response.blob();
        if (controller.signal.aborted) return;
        URL.revokeObjectURL(previous);
        previous = current;
        current = URL.createObjectURL(jpeg);
        setFrame(current);
        setWaiting(false);
      } catch {
        if (!controller.signal.aborted) setWaiting(true);
      } finally {
        if (!controller.signal.aborted)
          timer = setTimeout(() => void refresh(), 150);
      }
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
      URL.revokeObjectURL(current);
      URL.revokeObjectURL(previous);
    };
  }, [url]);

  if (!frame || waiting)
    return (
      <span className="camera-wait" role="status">
        {waiting
          ? "Waiting for camera to reconnect…"
          : "Waiting for camera response…"}
      </span>
    );
  return <img src={frame} alt={`${nodeId} live camera`} />;
}

export function CameraFeed({
  nodeId,
  url,
  demo,
  running = true,
}: {
  nodeId: string;
  url: string;
  demo: boolean;
  running?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("connecting");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const jpeg = !demo && /\.jpe?g$/i.test(url.split(/[?#]/, 1)[0]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- begin a new external camera connection.
    setStatus("connecting");
    if (demo || !url || !running || jpeg) return;
    const timer = setTimeout(
      () => setStatus((s) => (s === "connecting" ? "blocked" : s)),
      10000,
    );
    return () => clearTimeout(timer);
  }, [nodeId, url, demo, running, attempt, jpeg]);
  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded]);
  async function fullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (ref.current?.requestFullscreen) {
      try {
        await ref.current.requestFullscreen();
      } catch {
        setExpanded(true);
      }
    } else setExpanded(true);
  }
  return (
    <div className={`camera-shell ${expanded ? "expanded" : ""}`} ref={ref}>
      <div className="camera-topline">
        <span>
          <i />
          {demo
            ? "DEMO RECORDING"
            : jpeg
              ? "ESP32-CAM · LIVE"
              : "ESP32-CAM · MJPEG"}
        </span>
        <span>{nodeId}</span>
      </div>
      <div className="camera-stage">
        {demo && running ? (
          <video
            key={nodeId}
            controls
            playsInline
            preload="metadata"
            poster="/demo/camera-poster.jpg"
            aria-label={`${nodeId} demo camera`}
            onError={() => setStatus("blocked")}
          >
            <source src="/demo/camera.mp4" type="video/mp4" />
          </video>
        ) : running && url && jpeg ? (
          <SnapshotPreview key={`${nodeId}-${url}`} url={url} nodeId={nodeId} />
        ) : running && url ? (
          <img
            key={`${nodeId}-${url}-${attempt}`}
            src={url}
            alt={`${nodeId} camera stream`}
            onLoad={() => setStatus("received")}
            onError={() => setStatus("blocked")}
          />
        ) : (
          <div className="camera-placeholder">
            <Camera size={32} />
            <strong>
              {running ? "Camera not configured" : "Camera stopped"}
            </strong>
            <span>Other sensors continue independently.</span>
          </div>
        )}
        {!demo && !jpeg && url && running && status === "connecting" && (
          <span className="camera-wait" role="status">
            Waiting for camera response…
          </span>
        )}
      </div>
      <div className="camera-caption">
        <span>
          {demo
            ? "Synthetic forest scene · scripted detections"
            : jpeg
              ? "Live camera · refreshed JPEG frames"
              : "Frame capture age unavailable in MJPEG"}
        </span>
        <button
          className="icon-button"
          aria-label={expanded ? "Exit fullscreen" : "Fullscreen camera"}
          onClick={() => (expanded ? setExpanded(false) : void fullscreen())}
        >
          <Maximize size={18} />
        </button>
      </div>
      {!jpeg && status === "blocked" && (
        <div className="source-error" role="status">
          <strong>Camera unavailable or blocked</strong>
          <span>
            Check the camera URL and power. For HTTP/LAN feeds, open the full
            app locally.
          </span>
          <button className="button" onClick={() => setAttempt((v) => v + 1)}>
            <RefreshCw size={15} />
            Retry camera
          </button>
          <a className="text-link" href="#settings">
            Connection settings
          </a>
        </div>
      )}
    </div>
  );
}
