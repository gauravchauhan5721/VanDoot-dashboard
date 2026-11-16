# Control room verification

Verified 17 November 2026 (Asia/Kolkata). Started from `main` at `98c9ae7ae948555c4cb3fa1bfce9b8078501ecc8`.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no lint warnings |
| `npm run typecheck` | Passed |
| `npm run test:contracts` | Passed: freshness boundary, future/missing timestamps, aliases/units, missing values, malformed telemetry, thermal dimensions, event metadata, matching frame identity, nearby readings, thresholds/rearming, and both WebSocket payload forms |
| `npm run build` | Passed: full Next.js production build, including all existing API routes |
| `npm run test:e2e` | **18 passed**, 0 skipped; 51.3 seconds against the production server and disposable test database |
| `node scripts/build-preview.mjs` | Passed: source-generated static Demo in `dist/` |
| Exported Demo browser checks | All six width/theme combinations passed: 360, 768, 1440 pixels; dark and light |
| `git diff --cached --check -- . ':(exclude)dist'` | Passed for source; generated Next.js vendor chunks retain upstream whitespace |

## Test environment

Windows, installed Google Chrome through Playwright, Next.js 16.4.5 with Webpack. The production server used a test-only `FOREST_ADMIN_TOKEN` and an isolated database at localhost:55432. No production database was accessed.

Native PostgreSQL/Docker was unavailable. The test database was **PGlite 0.3.15, PostgreSQL 17.5 compiled to WASM**, exposed to the existing `pg`/Drizzle client by a local PostgreSQL wire-protocol bridge. Both the Drizzle tables and `migrations/001_forest.sql` were initialized. Settings, alert actions, simulated commands, reports and protected incident review writes used this database, not HTTP persistence mocks. Native PostgreSQL deployment/concurrency remains to be checked in the deployment environment.

The test runner used `PLAYWRIGHT_CHROMIUM_EXECUTABLE` pointing to the installed Chrome executable and the same test-only forest token as the server. The token is not included in the preview or source.

## Interactions verified

- Overview map selection updates the watched node and feed; no horizontal page overflow at the three requested widths. At 360px the urgent alert precedes the camera.
- Dark/light themes, keyboard chart slider, keyboard search, node details, topology inspection, analytics/log filters, CSV/report downloads, settings reload and existing workspace navigation.
- Alert to captured evidence, live-now, Escape/browser Back and restored alert filters/node selection. Evidence includes time zone and original capture time; a mismatched frame ID suppresses boxes.
- Fixture `/latest` measurements, camera failure alongside functioning thermal/events, missing readings, 30-second expiry, gateway disconnect/reconnect, node isolation, empty events versus reported model disconnection, source testing and saved URL preservation after reload.
- Unauthorized forest API access returns 401. Authorized review saved captured context and completed acknowledge, resolve and false-positive actions, with all three review records persisted.
- The exported Demo independently played its bundled video and audio, entered/exited camera fullscreen, inspected thermal pixel 768 by keyboard, stopped/reconnected sources, and completed evidence/live-now/Back in every width/theme combination. Audio was paused before explicit play. Reduced-motion preference was enabled for this check. No browser exceptions occurred.
- Screenshots captured Overview and node media at every width/theme combination. Desktop dark Overview and mobile light node media were visually reviewed, plus the mobile light Overview.

## Still requires hardware or deployment

- Real ESP32-CAM MJPEG framing, latency, reconnect and target-phone fullscreen behavior; Safari/iOS was not available here.
- Physical MLX90640 orientation/calibration, DHT22/PM2.5/MQ-2/PIR readings, microphone codec/stream format and mesh/network reliability.
- A real gateway's `/latest` and WebSocket delivery, clock synchronization, browser LAN access, CORS and HTTPS behavior. WebSocket payload validation and subscription cleanup were checked in source/contracts; the browser disconnect/reconnect fixture used REST polling.
- Actual model/version/confidence output, model accuracy, notification providers and production PostgreSQL operation. Demo imagery, thermal data and detections are explicitly synthetic.

## Preview and launch

The preview is built from this source and runs locally at http://localhost:4173. From the repository directory:

```powershell
node scripts/build-preview.mjs
node scripts/serve-preview.mjs --port 4173
```

For the full app, configure `.env` and apply the database schema as described in README, then run:

```powershell
npm run dev -- --port 3000
```

The existing Sites project configured by `.openai/hosting.json` returned `NOT_FOUND`; no new hosting project or public deployment was substituted. The local preview was verified in Chrome. A public preview URL was therefore unavailable during this run.
