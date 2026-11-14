# Per-node camera, thermal and sound section

The original `origin/main` overview, navigation, node pages, charts, map, simulation and styles are restored. The only new visible navigation item is **AI Camera & Sound** (`#node-media`). Existing pages have not been redesigned.

Select all nodes or one node; configure each node independently and click Connect sources. Saving settings does not mark a node online. URLs are stored in this browser's localStorage, separately by Demo/Live mode. No credentials should be included in URLs. The hosted static preview has no laptop gateway; use `npm ci` then `npm run dev` locally for LAN devices. Existing backend behavior is retained.

## Sources
- Camera: ESP32-CAM MJPEG URL, commonly the stream endpoint exposed by your firmware. The viewer loads it as an image; it does not claim frame-level freshness or draw unsynchronized boxes.
- Detected image: static/latest image URL or imageUrl from a camera detection event. Prefer a unique image URL per detection. This is visibly distinguished from the live stream.
- Thermal: GET JSON every 3 seconds, at most 4096 pixels. MLX90640 uses width 32, height 24 and 768 finite temperatures in °C. The nodeId must match the selected registered node. Newer frames replace older frames; stale, stopped and disconnected states are shown. No spatial overlay on the camera image.
- Audio: optional browser-playable audio URL with manual playback. A generic raw PCM/UDP stream is not browser-playable without an adapter.
- Events: GET a JSON array of up to 200 events every 3 seconds. Nonmatching node IDs are discarded. Model labels/scores are displayed from the source, not fabricated by the UI. AI inference must run on your configured gateway/server.

Thermal example (2×2 test; replace with the actual sensor dimensions):
```json
{"nodeId":"NODE-01","width":2,"height":2,"timestamp":"2026-11-15T00:00:00Z","values":[24,25,26,27]}
```
Detection examples:
```json
[
 {"nodeId":"NODE-01","id":"frame-123-person","timestamp":"2026-11-15T00:00:00Z","type":"camera","label":"Person detected","score":0.82,"model":"your-validated-model/version","imageUrl":"http://localhost:8000/evidence/frame-123.jpg"},
 {"nodeId":"NODE-01","id":"audio-123","timestamp":"2026-11-15T00:00:00Z","type":"audio","label":"Chainsaw-like sound","score":0.74,"model":"your-validated-audio-model/version"},
 {"nodeId":"NODE-01","id":"level-123","timestamp":"2026-11-15T00:00:00Z","type":"sound-level","label":"Sound intensity","value":410,"unit":"ADC raw"},
 {"nodeId":"NODE-01","id":"thermal-123","timestamp":"2026-11-15T00:00:00Z","type":"thermal","label":"Hotspot detected","model":"your-threshold-rule/version"}
]
```
Examples describe the adapter format only; they are not actual detections. Replace timestamps with current capture times. A basic sound sensor reports intensity, not sound identity; classification requires microphone audio and a validated model.

JSON endpoints must allow the dashboard origin via CORS. HTTPS hosting may block HTTP/private-LAN feeds; use the local dashboard for ESP32 testing. No server-side arbitrary URL proxy has been added. Thermal or event endpoint errors leave previous evidence labelled as last received data.

## Checks and limits
TypeScript and production static build are checked. No physical ESP32, thermal sensor, microphone, AI service or recordings were supplied, so actual connectivity and inference accuracy remain unverified. This change adds media views and adapter inputs; it does not train or install AI models, change incident storage, or implement LoRa media transport.

Camera and thermal event labels can include person and forest-fire detections, with source model/version, score, timestamp and imageUrl. Thermal detection images open separately from the heatmap. This UI does not supply or validate a person/fire model; low-resolution thermal arrays and hot pixels alone cannot establish identity or confirm fire.
