# Forest protection dashboard

## What is implemented
Nine forest workspaces extend the existing dashboard: Fire & Smoke, Camera Detections, Audio Analysis, Thermal Monitoring, Threat Verification, Incident Review, Ranger Registry, Model Registry, Hardware Integration.

Image/audio uploads call an actual configured inference service; disconnected services produce explicit errors. Results include model/version, labels/confidence and optional normalized image boxes. Thermal JSON imports render a 32×24 heatmap with measured min/max/mean. Incidents retain model output, sensor values and their timestamps, evidence URL/name, source mode and review history. Ranger records can be enabled/disabled. Model records store version and evaluation notes. A notification action posts a saved incident to a configured webhook and distinguishes provider acceptance from recipient delivery.

These features do not train models, authenticate physical chips, establish a real camera stream, provide automatic fusion, or certify detection performance. No model weights are included. Existing AI/Intelligence and 3D scenario risk remain explicitly simulated. Future drones/eFOREST integration from the proposal are not implemented.

## Setup
1. Install Node dependencies: `npm ci`.
2. Configure the existing PostgreSQL database using `DATABASE_URL` and the existing Drizzle schema. Apply `migrations/001_forest.sql` using your PostgreSQL client. The migration is additive and idempotent.
3. Set `FOREST_ADMIN_TOKEN` to a strong private value on the server. Enter it in the forest workspace access field. It is retained only in page memory, not localStorage. All new record, inference and notification endpoints require it. The older settings/alerts/reports endpoints retain the existing project's access model: use a trusted deployment or an authenticated reverse proxy for the entire app; this is not a complete multi-user authentication system.
4. Optional AI connection: `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` (server only; never NEXT_PUBLIC). Set the URL to your model server, without `/predict`.
5. Optional notifications: `ALERT_WEBHOOK_URL` and `ALERT_WEBHOOK_TOKEN` (server only). Button clicks send an HTTP JSON event `vandoot.incident`. No messages are sent during setup. Adapter to SMS/email/Telegram belongs at the configured provider. A 2xx response means accepted, not independently delivered. No automatic escalation/retry queue is implemented.
6. Run `npm run dev`; open Forest Protection in the sidebar. Load records after entering the token.

## Model contract
POST `/predict`, multipart fields `task` (`fire`, `camera`, `audio`) and `file` (max 10 MB). Supported inputs: JPEG, PNG, WebP; WAV, MP3, OGG. Response:

```json
{"model":"your-model","version":"v1","detections":[{"label":"smoke","confidence":0.82,"box":[0.1,0.2,0.4,0.3]}]}
```

Confidence is 0–1. Optional boxes are normalized x, y, width, height; audio predictions omit boxes. Validate media contents in the model service as well as the UI MIME checks. Prediction requests time out at 60 seconds. Uploaded media are forwarded to the configured service, not retained by this dashboard. Persist evidence in your own HTTPS storage and attach its URL; a local preview is temporary. Model registration is metadata, not deployment.

## Hardware contract
Configure gateway URL under Settings. Polling uses GET `/latest`, a dictionary keyed by hardware ID:

```json
{"NODE-01":{"online":true,"received_at":"2026-11-14T12:00:00Z","temperature":28.5,"humidity":62,"MQ2":180,"PIR":0,"pm25":12,"thermalMax":30.2,"soundLevel":20,"battery":85,"rssi":-75,"snr":8,"received":250,"lost":2,"linkQuality":92,"location":{"lat":31.7,"lng":76.5,"label":"Replace with surveyed coordinates"}}}
```

Use a CURRENT UTC timestamp. `last_seen` in Unix seconds is also supported. Readings older than 30 seconds, future timestamps, missing timestamps, or nodes without `online: true` are offline. Sample more frequently than 30 seconds for this initial contract, or adjust freshness policy to match your battery/sampling design. Missing values are unknown, never 100% battery or invented RSSI. Supported aliases are defined in `SENSOR_ALIASES`; MQ2 stays raw, not ppm/AQI. A temperature/PM threshold is not a confirmed fire detector.

GET `/latest` does not report gateway health: the adapter deliberately leaves `gateways` empty rather than inventing CPU/RAM/radio statistics. A WebSocket may supply a complete `Snapshot` including real gateway diagnostics and alerts. Polling and socket alerts are merged by ID; clearing requires an explicit resolved state. Live history/logs are deduplicated and retained within the current session (5,000 points / 2,000 logs), not durable telemetry storage. Durable historical queries remain a gateway-backend responsibility.

The 3D live map explicitly maps `n1/n2/n3` to `NODE-01/02/03`. Edit `src/features/simulation/liveAdapter.ts` to match actual hardware IDs. Demo locations are illustrative; live maps only plot gateway-reported valid coordinates. Commands remain disabled until the gateway implements them.

## Verification
`node scripts/test-contracts.mjs` validates freshness, missing values, aliases, malformed payloads, thermal shapes and inference schemas. `npm run typecheck` and `DATABASE_URL=... npm run build` check compilation. Existing Playwright suite requires a populated PostgreSQL test database; do not point it at production (its setup writes settings). Use `npm run test:contracts` for isolated contract checks.

Hardware, model inference, database CRUD and notification-provider delivery require their actual configured services for end-to-end verification. Keep recordings and real hardware evidence labelled separately from demo sensor context.
