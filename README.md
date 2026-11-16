# VanDoot forest control room

VanDoot extends the existing Next.js / React / TypeScript dashboard, PostgreSQL and Drizzle APIs, and Three.js simulation. The control room starts with the node that needs attention, its camera, and the evidence behind its alert.

## Run locally

```powershell
npm ci
Copy-Item .env.example .env
# Set DATABASE_URL in .env to your own development PostgreSQL database.
npx drizzle-kit push
# Apply migrations/001_forest.sql with your PostgreSQL client.
npm run dev -- --port 3000
```

Open http://localhost:3000. Windows development and production builds use Webpack to avoid Turbopack junction restrictions. Build with `npm run build`, then `npm start -- --port 3000`. Node 22+ is recommended.

Demo telemetry, bundled video/images/audio and evidence exploration need no API keys. PostgreSQL is needed for persistent settings, alert actions, saved reports, and incident records. Without it, session preferences still work and the UI tells you they were not saved.

### Static Demo preview

```powershell
node scripts/build-preview.mjs
node scripts/serve-preview.mjs --port 4173
```

Open http://localhost:4173. This builds **the same source application**, with API routes removed only from the temporary export. It is not a separate mockup. Demo preferences and alert actions are session-only. Hardware settings explain how to launch the full app. Live never substitutes demo readings. The export includes no database credentials or provider tokens.

## Ranger workflows

- **Overview:** Demo/Live, open critical alerts, online/total nodes and real telemetry age. Desktop uses a 2:1 camera/priority layout. At 360px the urgent alert precedes the camera and readings. Select a map marker or node selector to watch that node.
- **Evidence:** open a priority alert or a detection event. Capture time includes the viewer's time zone and original timestamp. Readings retain their own timestamps; only samples within 30 seconds of capture are used. Matching image/audio and actually reported model/version/confidence are shown. Boxes require matching frame identities. “View live now” opens the current feed.
- **CCTV:** `#node-media/NODE-01` has optional independent MJPEG, latest image, thermal, audio and event sources. Configure and test once; per-node URLs retain the existing `vandoot-media-demo` / `vandoot-media-live` localStorage keys. Audio starts on demand. A failed camera does not stop thermal/events.
- **Review:** “Open incident review” carries the observation into `src/features/forest/`. Existing token access, acknowledge, resolve and false-positive actions remain. A threshold crossing requests review; it does not confirm fire. Browser Back restores alert filters, node selection and incident-state filters through hash URLs.
- **Charts:** touch the plot or use the labelled sample slider with arrow/Home/End keys. Units, timestamps, series toggles and missing-sample gaps are shared across screens.
- Existing node, network, gateway, analytics, logs, reports, device control and settings pages remain available. Three.js loads only when opening Simulation.

## Where to change things

| Change | Single source / entry point | What to edit |
| --- | --- | --- |
| Colors and fonts, both themes | `src/app/globals.css` | `:root` and `:root[data-theme="light"]` tokens; no duplicate token blocks in `polish.css` |
| Control room layout | `src/app/control-room.css` | Responsive grids, spacing, controls and media; `polish.css` retains older shared refinements |
| Add a sensor, units, aliases | `src/config/sensors.ts` | Typed registry; cards, chart filters, gateway normalization and logs read it |
| Sensor warning/critical defaults | `src/config/thresholds.ts` | Direction and limits; persisted overrides remain in Settings |
| Add a Demo node | `src/config/nodes.ts` | ID, name, parent, gateway and illustrative coordinates |
| Add a physical node | Gateway `/latest` | Report a unique hardware ID and its measured fields; live nodes are discovered, not hard-coded |
| Camera/thermal/audio/event URLs | Node media → Configure & test sources | URLs stored per node/mode in this browser; existing keys preserved |
| Gateway / optional WebSocket URL | Settings → Connectivity | Saved through `/api/settings`; public defaults in `src/config/api.ts` |
| Add a page / navigation entry | `src/config/dashboard.ts`, `src/components/Dashboard.tsx` | Add the typed navigation tuple + description, then route to a component in `src/features/` |
| Panel, badge, modal behaviour | `src/components/ui.tsx` | Shared primitives used throughout the app |
| Source parsing / media presentation | `src/features/media/` | `contracts.ts`, `useNodeMedia.ts`, `SourceSetup`, `CameraFeed`, `ThermalView`, `EventHistory`, `AlertEvidence` |
| Provider secrets | Server environment only | `FOREST_ADMIN_TOKEN`, `AI_SERVICE_URL/TOKEN`, `ALERT_WEBHOOK_URL/TOKEN`; never `NEXT_PUBLIC_*` |

### Worked sensor example: measured CO₂

1. Add this object to `sensors` in `src/config/sensors.ts`:

```ts
{
  id: "co2", name: "CO₂", hardware: "Your calibrated CO₂ sensor",
  unit: "ppm", precision: 0, min: 350, max: 2000,
  color: "#74c2d5", aliases: ["co2", "co2_ppm"], featured: false,
}
```

2. If wanted, add `co2: { warning: 1000, critical: 1500, direction: "above" }` to `thresholds`. These are illustrative review limits; choose limits for your actual sensor/site. Set `featured: true` to include it in the Overview readings/trend selector.
3. Report `co2_ppm: 610` with `online: true` and a current `received_at` in that node's `/latest` record. The alias maps to `co2`; sensor cards, analytics, logs and threshold review use the same unit/metadata automatically. An absent reading displays `—`.
4. Add the alias/boundary case to `scripts/test-contracts.mjs`. Existing saved settings are merged with new default thresholds.

## Connections and trust

See [MEDIA_SETUP.md](MEDIA_SETUP.md) for exact media payloads and [FOREST_WORKSPACE_SETUP.md](FOREST_WORKSPACE_SETUP.md) for model APIs, server configuration and database migration.

Gateway telemetry older than 30 seconds, future/missing timestamps or a node without `online: true` is offline. Unknown current readings display `—`. Last received history/evidence remains labelled with capture time. Polling and optional WebSocket subscriptions are cleaned up when the transport changes; media requests are aborted when switching nodes. Session history is bounded (5,000 samples, 2,000 log rows, 200 media events). Save important observations to incident records for persistence.

DHT22 temperature/humidity, PM2.5 in µg/m³, raw MQ-2 ADC, PIR motion and raw sound intensity are different measurements. Raw sound intensity is not sound classification. Model connection status is displayed only when reported; no events and a disconnected model are distinct states.

The existing forest endpoints require a server access token; older settings/alerts/reports APIs retain their existing access model. Use a trusted deployment or authenticated reverse proxy. No arbitrary server-side camera proxy has been added. LAN media needs browser reachability, appropriate CORS for JSON, and compatible HTTP/HTTPS origins. No physical hardware, trained model or cloud notification delivery is implied by Demo mode.

## Verification

Use a **disposable test database**, because the suite writes settings, demo actions, reports and incidents. Set `DATABASE_URL` and apply both the Drizzle schema and `migrations/001_forest.sql`. Start the full app with a test-only `FOREST_ADMIN_TOKEN`, then set the same token in the test runner.

```powershell
npm run lint
npm run typecheck
npm run test:contracts
npm run build
# Start the test app in another terminal, with the test database and token.
npm run test:e2e
node scripts/build-preview.mjs
```

Install Playwright Chromium if needed: `npx playwright install chromium`. To use an existing browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute executable path. `PLAYWRIGHT_BASE_URL` defaults to http://localhost:3000. Browser tests cover existing routes/exports/persistence plus 360/768/1440px, dark/light, keyboard chart/search, alert → evidence → Back, and fixture disconnect/reconnect. The review test explicitly skips authorized writes if the test token is absent.

Fixtures verify UI and adapter behaviour. Physical ESP32 MJPEG latency/fullscreen on target phones, MLX90640 readings, microphone formats, mesh reliability, model accuracy and notification delivery still require real devices/services. See `VERIFICATION.md` for the actual checks performed in this workspace.
