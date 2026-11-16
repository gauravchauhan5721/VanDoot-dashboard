# Node media setup

Open `#node-media`, choose a hardware node, then **Configure & test sources**. Each source is optional and independent. URLs are stored in this browser under the existing per-mode keys `vandoot-media-demo` and `vandoot-media-live`; a node change cancels old polls. Saving a URL does not mark a node online. Demo always uses bundled synthetic media, without paid keys. Switch to Live in the full local app for physical sources.

| Source | Contract | Behaviour |
| --- | --- | --- |
| ESP32-CAM | HTTP(S) MJPEG stream | Native image stream, fullscreen button, retry; frame capture age is unavailable |
| Latest image | HTTP(S) JPEG/PNG/WebP URL | Manual reload; capture time is unknown, so never used as an alert's matching frame |
| MLX90640 | JSON below | Independent 3-second poll, exactly 32×24 temperatures, stale/disconnected labels, touch/keyboard pixel inspector |
| Microphone | Browser-playable WAV/MP3/OGG/compatible stream | Manual playback only; raw PCM/UDP needs a gateway adapter |
| Detection events | Array, or status envelope below | Independent 3-second poll; at most 200 events; only selected node accepted |

Use unique immutable capture URLs in events. Browser-loaded URLs cannot include credentials or secret query parameters. Keep provider credentials on the server. JSON sources must allow the dashboard origin through CORS. An HTTPS page may block HTTP cameras; run the full app locally on the sensor network and use suitable origins. No arbitrary URL proxy is provided.

## Thermal frame

A complete valid fixture can be generated in JavaScript:

```js
const frame = {
  nodeId: "NODE-01", width: 32, height: 24,
  timestamp: new Date().toISOString(),
  values: Array(32 * 24).fill(25.5), // replace with row-major measured °C
};
```

The node ID must match. All 768 values must be finite numbers. Wrong dimensions, missing timestamps and incomplete frames are rejected. Newer frames replace older ones. The relative heat palette shows min/max; a warm pixel does not establish identity or confirm a fire.

## Detection envelope

```json
{
  "modelStatus": "connected",
  "events": [{
    "nodeId": "NODE-01",
    "id": "detection-123",
    "timestamp": "2026-11-16T12:00:00Z",
    "type": "camera",
    "label": "Possible smoke",
    "severity": "warning",
    "model": "your-validated-model",
    "version": "v1",
    "score": 0.82,
    "imageUrl": "http://gateway.local/evidence/frame-123.jpg",
    "frameId": "frame-123",
    "evidenceFrameId": "frame-123",
    "box": [0.1, 0.2, 0.4, 0.3]
  }]
}
```

This example is a contract, not a real detection. Replace its timestamp with the actual capture time. `type` is `camera`, `thermal`, `audio`, or `sound-level`. `audioUrl` attaches captured audio. `score` is optional, 0–1; model/version are optional strings. Sound-level events may report `value` and `unit: "ADC raw"`; they do not constitute classification.

Boxes use normalized x/y/width/height within the image and are drawn **only** when `frameId` equals `evidenceFrameId`. No boxes appear on the current MJPEG feed. Prefer immutable capture images. A configured latest-image URL is never substituted for missing alert evidence.

`modelStatus` may be `connected` or `disconnected`. Missing status displays “Model status not reported”; an empty array displays “No detections received”. Endpoint failure means unreachable, not an inferred model failure. Camera, thermal and audio continue independently.

## Evidence and review

An event opens the alert view with node, capture time/time zone, image/audio and only reported model metadata. Nearby telemetry must be within ±30 seconds, with its own timestamps. “View live now” opens the current feed; “Open incident review” retains the observation for the existing authorized workflow. Alerts and readings held in memory do not survive a reload unless saved as an incident.

## Bundled demo and hardware limits

`public/demo` contains original synthetic video/posters/audio, reused across nodes. Labels and boxes are scripted, not inference. Playback is manual. The thermal view is a deterministic 32×24 fixture, not a measured frame. Reproduce video/audio assets with `python scripts/generate-demo-media.py` (Pillow, NumPy, FFmpeg).

Use Settings for the gateway `/latest` and optional WebSocket URL. See `FOREST_WORKSPACE_SETUP.md` for credentials, migrations and model upload APIs. Uploads remain under the secondary **Test a model** actions. No model weights are bundled; real ESP32 connectivity, thermal calibration, audio encoding, model accuracy and LAN/browser restrictions need hardware verification.
