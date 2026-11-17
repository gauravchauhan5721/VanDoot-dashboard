"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import {
  MediaSource,
  SourceKind,
  safeMediaURL,
  parseEvents,
  parseThermal,
} from "./contracts";
const labels: Record<SourceKind, string> = {
  camera: "ESP32-CAM live feed URL (MJPEG or JPEG)",
  image: "Latest detection image URL",
  thermal: "MLX90640 thermal JSON URL",
  audio: "Microphone audio URL",
  events: "Detection events JSON URL",
};
export function SourceSetup({
  nodeId,
  source,
  save,
  close,
}: {
  nodeId: string;
  source: MediaSource;
  save: (value: MediaSource) => void;
  close: () => void;
}) {
  const [form, setForm] = useState(source);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);
  async function test(kind: SourceKind) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setStatus((old) => ({ ...old, [kind]: "Testing…" }));
    try {
      const url = safeMediaURL(form[kind]);
      if (!url) throw Error("Enter a URL first.");
      if (kind === "camera" || kind === "image") {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          const end = (e?: string) => {
            clearTimeout(timer);
            img.onload = null;
            img.onerror = null;
            img.src = "";
            controller.signal.removeEventListener("abort", abort);
            if (e) reject(Error(e));
            else resolve();
          };
          const abort = () => end("Test cancelled");
          const timer = setTimeout(
            () =>
              end(
                "No frame within 8 seconds. Check device, URL, HTTP/HTTPS and network permission.",
              ),
            8000,
          );
          controller.signal.addEventListener("abort", abort, { once: true });
          img.onload = () => end();
          img.onerror = () =>
            end(
              "Image blocked or unavailable. Open the URL on this network to diagnose.",
            );
          img.src = url;
        });
      } else if (kind === "audio") {
        // Test decoder metadata without playing microphone audio.
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio();
          const end = (e?: string) => {
            clearTimeout(timer);
            audio.onloadedmetadata = null;
            audio.onerror = null;
            audio.removeAttribute("src");
            audio.load();
            controller.signal.removeEventListener("abort", abort);
            if (e) reject(Error(e));
            else resolve();
          };
          const abort = () => end("Test cancelled");
          const timer = setTimeout(
            () =>
              end("Audio metadata timed out. Use a browser-playable stream."),
            8000,
          );
          controller.signal.addEventListener("abort", abort, { once: true });
          audio.onloadedmetadata = () => end();
          audio.onerror = () => end("Audio unavailable or format unsupported.");
          audio.preload = "metadata";
          audio.src = url;
        });
      } else {
        const response = await fetch(url, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
          credentials: "omit",
          cache: "no-store",
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (kind === "thermal") parseThermal(body, nodeId);
        else parseEvents(body, nodeId);
      }
      if (!controller.signal.aborted)
        setStatus((old) => ({
          ...old,
          [kind]:
            "Source responded. Device online status comes from telemetry.",
        }));
    } catch (e) {
      if (!controller.signal.aborted)
        setStatus((old) => ({
          ...old,
          [kind]: e instanceof Error ? e.message : "Test failed",
        }));
    }
  }
  return (
    <Modal title={`${nodeId} · source setup`} onClose={close}>
      <form
        className="modal-body source-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const next = { ...form };
            for (const kind of Object.keys(labels) as SourceKind[])
              next[kind] = safeMediaURL(next[kind]);
            save(next);
            close();
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <p>
          Attach only the sensors you have. Saved URLs stay in this browser,
          separately for Demo and Live.
        </p>
        {(Object.keys(labels) as SourceKind[]).map((kind) => (
          <div key={kind}>
            <label>
              {labels[kind]}
              <input
                type="url"
                value={form[kind]}
                placeholder="http://192.168.1.20/…"
                onChange={(e) =>
                  setForm((old) => ({ ...old, [kind]: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={!form[kind] || status[kind] === "Testing…"}
              onClick={() => void test(kind)}
            >
              Test {kind}
            </button>
            <small role="status">
              {status[kind] || "Optional · not configured until saved"}
            </small>
          </div>
        ))}
        <p className="muted">
          For LAN cameras, run the full app on this network. HTTPS pages may
          block HTTP feeds. JSON endpoints need CORS. Keep provider tokens on
          the server.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" type="submit">
          Save sources
        </button>
      </form>
    </Modal>
  );
}
