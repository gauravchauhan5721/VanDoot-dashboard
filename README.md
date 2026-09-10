# VANDOOT

## Intelligent Distributed Monitoring & Communication System

A from-scratch, dark-first industrial IoT dashboard with realistic telemetry simulation, a dynamic LoRaMesh topology, configurable sensors and thresholds, and a PostgreSQL-backed local API. No hardware is required to explore Demo Mode.

**Implementation stack:** React 19, TypeScript, Next.js App Router, PostgreSQL, Drizzle ORM, custom SVG charts/topology, Lucide icons, and Playwright tests. This environment uses **Next.js rather than Vite** so the frontend and persistence API run in one application. There is no Vite configuration, and the default port is **3000**, not 5173.

**Honest boundaries:** AI insights and hardware health are simulated in Demo Mode. Device commands are recorded simulations and do not affect physical hardware or demo device state. Live Mode requires a gateway backend that you implement; it never falls back to fake hardware. The map is an offline coordinate-based site map, not a satellite/street-tile service. Coverage rings are illustrative. Authentication is not implemented: run on a trusted local machine/network only.

## 1. System architecture

ESP32 sensor nodes → LoRa / multi-hop LoRaMesh → Raspberry Pi gateway → REST / WebSocket → Vandoot service layer → central React state → dashboard.

The local Next.js API stores workspace settings, demo alert actions, demo command history, and report snapshots in PostgreSQL. Gateway telemetry uses a separate service adapter. This separation prevents the local persistence API from being mistaken for a real hardware API.

Multiple nodes and gateways are represented as arrays. Each node has `gatewayId`, `parentId`, firmware, and WGS84 coordinates. Each link has source, target, RSSI, SNR, traffic, state, and quality. Set a node's parent to another node to represent a multi-hop route. Additional gateway entries automatically appear in topology, map, gateway monitoring, command targets, and health views. The Overview highlights the first gateway and aggregates network totals.

## 2. Complete application structure

- `src/app/page.tsx` — application entrypoint.
- `src/app/layout.tsx` — root HTML layout and metadata.
- `src/app/globals.css` — design tokens, complete dashboard styling, light theme, responsive breakpoints, reduced-motion support.
- `src/app/api/health/route.ts` — local API/database healthcheck.
- `src/app/api/settings/route.ts` — load/save validated workspace settings.
- `src/app/api/alerts/route.ts` — persist demo acknowledge/resolve actions.
- `src/app/api/commands/route.ts` — persist explicitly simulated device commands; rejects live commands.
- `src/app/api/reports/route.ts` — save/list report snapshots.
- `src/components/Dashboard.tsx` — feature router and provider composition.
- `src/components/ui.tsx` — Panel, KpiCard, StatusBadge, Meter, Modal, EmptyState, LoadingState, DetailGrid, PageLink.
- `src/components/Chart.tsx` — reusable interactive SVG time-series chart, hover tooltips, legend toggles.
- `src/components/NetworkTopology.tsx` — dynamically computed gateway/node layout, multi-hop links, zoom, inspection dialogs.
- `src/components/NodeTable.tsx` — shared node table and detail links.
- `src/components/SensorCards.tsx` — sensor-definition-driven reading cards.
- `src/layouts/DashboardLayout.tsx` — sidebar, topbar, global search, Demo/Live switch, export, profile/help dialogs.
- `src/features/Overview.tsx` — network KPIs, topology, sensor summary/trends, alerts, node table, gateway/activity statistics.
- `src/features/Nodes.tsx` — node list/card view, search/filter, node details and all sensor histories.
- `src/features/Monitoring.tsx` — Live Monitoring, Network, Gateway, Sensors, System Health screens.
- `src/features/Analytics.tsx` — node/sensor/time filters, current/average/min/max/trend, series export.
- `src/features/Alerts.tsx` — search/filter/details/acknowledge/resolve.
- `src/features/DataLogs.tsx` — telemetry filters, sorting, pagination, CSV export.
- `src/features/MapPage.tsx` — offline site map with coordinate projection and coverage toggles.
- `src/features/Intelligence.tsx` — clearly labeled DEMO rule-based insights; no ML claims.
- `src/features/Operations.tsx` — Device Control and saved Reports.
- `src/features/Settings.tsx` — general, connectivity, thresholds, device preferences.
- `src/hooks/useDashboard.tsx` — centralized snapshot, polling, WebSocket lifecycle, settings and persistent actions.
- `src/services/DemoDataService.ts` — smooth simulation, historical samples, packet generation, threshold evaluation, occasional events.
- `src/services/LiveApiService.ts` — gateway REST adapter and live command/alert actions.
- `src/services/WebSocketService.ts` — connection, message validation, reconnection, cleanup.
- `src/config/dashboard.ts` — default settings, navigation, page descriptions.
- `src/config/nodes.ts` — node/gateway inventory, parent links, locations, demo timing/packet configuration.
- `src/config/sensors.ts` — sensor registry: ID, name, unit, range, precision, color.
- `src/config/thresholds.ts` — centralized warning/critical rules and comparison direction.
- `src/config/api.ts` — public endpoint defaults and request timeout.
- `src/types/index.ts` — strongly typed domain contracts.
- `src/utils/format.ts` — values, time, unit conversion, CSV downloads with formula-injection protection.
- `src/db/index.ts` — pooled PostgreSQL connection, configured by DATABASE_URL.
- `src/db/schema.ts` — settings, alert_actions, command_history, reports tables.
- `drizzle.config.ts` — environment-based schema tooling.
- `playwright.config.ts` / `tests/dashboard.spec.ts` — browser workflow tests.
- `.env.example` — local database and optional public endpoint configuration template.
- `package.json` / `package-lock.json` — scripts and pinned dependency tree.
- `next.config.ts` / `tsconfig.json` / `postcss.config.mjs` / `eslint.config.mjs` — framework, type, CSS, lint tooling.
- `README.md` — this setup and expansion guide.

Feature files are deliberately in `src/features`, not `src/pages`: Next.js reserves `pages` for framework routes. Page navigation uses browser hashes, such as `/#nodes/NODE-01`, with browser back/forward support. A database is not needed for the simulation math, but **is required for the complete application’s persistent settings, mode switching, actions, and reports**.

## 3. Beginner-friendly setup: ten steps

### STEP 1 — Open the project folder

Download/export the complete project, extract it into a folder named `vandoot-dashboard`, then open that folder in VS Code. Open Terminal → New Terminal.

If creating a destination before extracting, run `mkdir vandoot-dashboard`, then `cd vandoot-dashboard`. Do not create another empty folder inside an already extracted project. Your terminal directory must contain `package.json`.

### STEP 2 — Install Node.js and PostgreSQL

Install **Node.js 22 or 24 LTS** from https://nodejs.org. Next.js requires at least Node 20.9. Close and reopen your terminal, then run `node --version` and `npm --version`.

Install PostgreSQL 16+ from https://www.postgresql.org/download/, or use Docker Desktop. PostgreSQL must be running before database-backed features can work.

For an isolated Docker database, choose your own password and replace YOUR_LOCAL_PASSWORD in both this command and your .env:

`docker run --name vandoot-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=YOUR_LOCAL_PASSWORD -e POSTGRES_DB=app_db -p 5432:5432 -v vandoot-pgdata:/var/lib/postgresql/data -d postgres:16`

On subsequent runs use `docker start vandoot-postgres`. The named volume preserves your data. If using an existing PostgreSQL installation instead, create the database with `createdb -U postgres app_db`. URL-encode special characters in your database password.

### STEP 3 — Install dependencies and configure the database

From the folder containing package.json:

1. Run `npm install` (or `npm ci` for an exact lockfile install).
2. macOS/Linux: `cp .env.example .env`.
3. Windows PowerShell: `Copy-Item .env.example .env`.
4. Edit DATABASE_URL in .env to match your actual local PostgreSQL username/password/database. The example connection is development-only, not a production credential.
5. Run `npx drizzle-kit push` to create the four persistence tables. Review any destructive schema prompts in existing databases; use migrations for production deployments.

Drizzle reads the same DATABASE_URL as the application. Never commit your real .env. No gateway URLs or API tokens are required for Demo Mode.

### STEP 4 — Start Vandoot

Run `npm run dev`. Keep the terminal open. Stop the application with Ctrl+C.

### STEP 5 — Open Chrome

Open **http://localhost:3000**. Use the address shown by the terminal if a different port is selected. The dashboard is not a static HTML file: do not double-click source files or use VS Code Live Server.

### STEP 6 — Enable Demo Mode

Demo Mode is the default. The header's **Demo / Live** segmented switch controls the source; click **Demo**. Alternatively, Settings → General → Demo Mode → Save changes. The sidebar and page heading clearly identify the environment.

With the default configuration you will see one Raspberry Pi gateway, three ESP32 nodes, seven sensor definitions, changing packet counts, and smooth sensor updates every five seconds. Three seed events explain earlier demo conditions; an active warning can remain even after a reading returns to normal until acknowledged/resolved.

Every 24 update ticks, the simulation advances through a cycle: healthy → offline node → low battery → temperature anomaly → weak signal → packet-loss warning → degraded gateway → healthy. The affected node rotates over longer cycles. Battery normally decreases slowly. Abrupt demo fault injections are intentional, not physical sensor predictions.

Demo telemetry is browser memory, not an archival time-series database. Reloading restarts the simulation and regenerates history; settings and saved actions/reports/commands remain in PostgreSQL.

### STEP 7 — Test every major page

1. **Overview:** watch packet/readings updates; change the trend sensor/time range; use Export data.
2. **Live Monitoring:** pause and resume UI updates.
3. **Nodes:** search by ID/location; filter status; switch list/card views; click NODE-01.
4. **Node Details:** inspect firmware, routing, packets, seven sensor histories, alerts and events.
5. **LoRaMesh Network:** click gateway/node icons, zoom, reset, expand; inspect routing statistics.
6. **Gateway:** inspect CPU/RAM/storage/temperature/uptime and packet activity.
7. **Sensors:** filter by node; open a sensor's history.
8. **Analytics:** select node, sensor, and 1h/6h/24h/7d/30d; hover charts, toggle legend series, export.
9. **Alerts:** search and filter, view details, acknowledge/resolve; reload to verify persistence.
10. **Map & Locations:** click device markers or the location list; toggle coverage and zoom. Coordinates and coverage are simulated in Demo Mode.
11. **AI / Intelligence:** explore the labeled demo heuristics; links open the corresponding monitoring page. Live Mode shows no AI unless you build an integration.
12. **Device Control:** select a target and command; simulate a ping or reading request; supply an interval, sensor, or JSON configuration where needed; confirm restarts. Inspect the saved result stating no hardware command was sent.
13. **Data Logs:** search/filter, sort timestamp/node/value, paginate, export filtered records.
14. **Reports:** enter a title and period, generate a saved report, inspect statistics, export CSV.
15. **System Health:** distinguish the real local backend/database checks from demo hardware statuses. Status bars are a current-status visualization, not historical uptime.
16. **Settings:** save a light/dark theme, temperature units, refresh interval, thresholds, connection settings, or node names.

Header Ctrl/⌘+K opens global search. The bell opens alerts. The profile explains the local single-user security boundary. On mobile, open the sidebar with the menu button.

### STEP 8 — Modify the project

#### Add or remove a node

Edit the `nodeConfigs` array in `src/config/nodes.ts`. Add a new object with unique id NODE-04, a name, gatewayId matching a gateway, parentId pointing to that gateway (or another node for multi-hop), firmware, and a location containing lat/lng/label. Copy the shape of an existing node and change its ID/coordinates. Save the file; Next.js reloads in development.

No page changes are necessary: tables, sensor summaries, histories, topology, maps, filters, reports, and controls consume the array. Remove an entry to remove it from the demo. Ensure IDs stay unique, parent references exist, and routing has no cycles. “Add node” in the UI explains this configuration-driven workflow; it is not a runtime hardware provisioning form.

For multiple gateways, add an entry to `gatewayConfigs`, assign nodes to its ID, and set matching parents. Live nodes/gateways are discovered from API responses instead of this file.

#### Add a sensor

Edit `src/config/sensors.ts`. Add a definition with `id`, `name`, `unit`, `min`, `max`, `precision`, and `color`. Example values: id co2, name CO₂, unit ppm, min 400, max 1400, precision 0, color #74c2d5. The generic demo engine generates a smooth signal automatically. Sensor cards, registry, node histories, analytics selector, logs, command sensor selectors, and report statistics read the registry.

The Overview intentionally highlights the first four environmental sensors; change its slice/tabs if you want to highlight a new sensor there. Core node cards retain operational temperature/humidity/battery/RSSI fields. Add specialized physical simulation behavior in DemoDataService.readings only if necessary.

#### Change thresholds

Use Settings → Alert thresholds for persistent workspace overrides. Or edit `src/config/thresholds.ts` for code defaults. Each rule has warning, critical, and direction: above/below. Temperature thresholds are Celsius, even when displaying Fahrenheit. Critical must be beyond warning in the selected direction.

Saved database settings override code defaults. Use Restore defaults → Save changes after changing defaults if you want to replace existing overrides. Initial demo seed warnings describe historical events and are independent of current sensor values.

#### Change demo values and cadence

- `src/config/sensors.ts`: generic ranges and precision.
- `src/config/nodes.ts`: inventory, locations, historical duration/interval, event frequency, packet count, battery drain.
- `src/services/DemoDataService.ts`: specialized temperature/humidity/battery/RSSI curves and fault scenarios.
- `src/config/dashboard.ts`: default polling interval.

The demo keeps up to 2,000 recent log records and a bounded history buffer. It starts with 30 days of 30-minute history plus new live samples. The chart downsamples display points while statistics use all available samples.

#### Change theme

Use Settings → General → Appearance → Save changes. Edit CSS variables at the start of `src/app/globals.css` to change Vandoot colors, borders, text, surfaces, and map styling. All UI styling is centralized. Google Fonts is optional; system sans-serif fallbacks work when offline.

#### Change endpoints

Use Settings → Connectivity, or set NEXT_PUBLIC_GATEWAY_API_URL / NEXT_PUBLIC_GATEWAY_WS_URL in .env as defaults. Restart development after .env edits; public environment variables are embedded at build time in production, so rebuild there. Saved settings take precedence. Click Restore defaults then Save to use updated environment defaults. Never put tokens in NEXT_PUBLIC variables, URLs, or settings fields.

#### Change node/gateway display and intervals

Settings → Device configuration changes demo node/gateway names and saves desired sampling/transmission preferences. Interval preferences do **not** send commands or alter demo generation; the global refresh interval drives the simulation. Use Device Control to explicitly send an interval configuration to a future live gateway. Demo commands remain simulations.

#### Add a page or reusable component

Create a named React component in `src/features`, add its route case/import in `src/components/Dashboard.tsx`, and add a navigation item/description in `src/config/dashboard.ts`. Use `#your-page` links. Put shared components in `src/components` and use `useDashboard()` rather than importing demo configuration into presentation components. Do not create feature files under Next.js's reserved `src/pages` folder.

### STEP 9 — Build and run production locally

1. `npx next typegen`
2. `npm exec tsc -- --noEmit --pretty false`
3. `npm run build`
4. `npm start`
5. Open **http://localhost:3000**.

The database must remain available. This app has server routes and is not compatible with a static-only file host. Run it as a Node.js application or container. Do not expose the unauthenticated local administration API to the public Internet.

### STEP 10 — Connect the Raspberry Pi 4 next

Build a gateway service on the Pi (for example FastAPI, Express, or another service you maintain). Its responsibilities are LoRa serial/SPI ingestion, packet validation and deduplication, time synchronization, node/route registry, sensor normalization, durable telemetry storage, alert evaluation, command dispatch/acknowledgement, and REST/WebSocket delivery.

Start with one ESP32 reporting timestamp, node ID, sequence number, temperature, humidity, battery, RSSI and SNR. Validate units and packet counters end-to-end, then scale to three and more nodes. Do not mark a command successful merely because it was queued: report accepted/queued/acknowledged/failed distinctly and include a command ID.

## 4. Gateway REST integration contract

Set the API base URL to something such as `http://192.168.1.100:8000/api` (your real gateway address). The adapter appends the following paths:

| Endpoint              | Response shape                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/gateway      | Gateway object or Gateway array                                                                                                   |
| GET /api/nodes        | SensorNode array                                                                                                                  |
| GET /api/nodes/:id    | Optional convenience endpoint for external clients; this dashboard selects details from the centralized nodes snapshot            |
| GET /api/sensors      | Sensor definition array; queried as a capability contract, while the local sensor registry currently controls dashboard rendering |
| GET /api/network      | Object with `links: NetworkLink[]`                                                                                                |
| GET /api/alerts       | Alert array                                                                                                                       |
| GET /api/logs         | Telemetry array                                                                                                                   |
| GET /api/analytics    | Object with `history: HistoryPoint[]`                                                                                             |
| POST /api/commands    | Accepts target, command, optional value; returns CommandResult                                                                    |
| PATCH /api/alerts/:id | Accepts state acknowledged/resolved; persist and return the result                                                                |

Exact interfaces are in `src/types/index.ts`. Use arrays directly, not undocumented `{data: ...}` wrappers, unless you adapt LiveApiService. Gateway arrays support multiple gateways. Sensor readings are a dictionary keyed by sensor ID. Standard numeric fields must be finite numbers; missing/unreadable sensors should be represented deliberately, not stringified numeric values. Timestamps are ISO 8601 UTC strings. Node status is online, weak, or offline. Alert severity is info/warning/critical and state is active/acknowledged/resolved. LoRa readings use dBm/dB. Battery is 0–100 percent. Gateway resource values are percentages. Temperature is Celsius, pressure hPa, and air quality AQI.

The adapter has an eight-second request timeout and polls at the configured interval. A failed request shows a visible connection error and no demo fallback. Previously received live snapshots may remain visible during an outage; use the connection banner and last-seen timestamp to identify stale data. Request batching/time-window filtering/server pagination can be added inside the adapter without rewriting the UI.

**CORS and secure contexts:** allow the dashboard origin (locally http://localhost:3000) on your gateway for GET, POST, PATCH, OPTIONS and Content-Type. HTTPS dashboards require HTTPS gateway APIs and WSS sockets; browsers block HTTPS→HTTP mixed content. A remotely hosted dashboard cannot necessarily access private LAN addresses. For credentials, implement a server-only proxy that reads an environment secret; do not expose tokens to the browser. These URLs are user-configured browser destinations, not an unrestricted server-side forwarding proxy.

## 5. WebSocket integration

Configure `ws://YOUR_PI:8000/api/live` locally, or WSS through TLS. Send a complete JSON Snapshot message: nodes, gateways, links, alerts, logs, history, and timestamp. This implementation consumes snapshots, **not delta patches**. If you want deltas, add a normalized merge layer in WebSocketService/useDashboard.

The service validates message shape, reports status, reconnects every five seconds after closure, and cleans up when changing mode or unmounting. REST polling remains available. Avoid two independent authoritative backends that overwrite each other's state; both transports should publish snapshots from the same gateway store. Sequence/version guards and exponential reconnect backoff are recommended for larger deployments.

## 6. Database and exports

Drizzle tables:

- dashboard_settings: one local workspace configuration document.
- alert_actions: durable demo alert acknowledgement/resolution.
- command_history: simulated commands with timestamps and an explicit simulated status.
- reports: immutable report snapshots including node, sensor, gateway, alert and network summaries.

Raw demo telemetry and generated historical samples are in memory, not PostgreSQL. Report values are computed from the currently available historical window, not from a future archival backend. CSV exports label their source. Raw logs/reports use canonical sensor units. Commands and reports are capped at 100 records in list responses; use server-side pagination for an expanded deployment. `src/utils/format.ts` is the export utility; replace/extend it for JSON, XLSX, PDF or a backend report worker.

## 7. Tests

Start the dashboard and database in a separate terminal, then:

1. `npx playwright install chromium`
2. `npx playwright test`

Set PLAYWRIGHT_BASE_URL for a non-default server address. Tests reset workspace settings to defaults and create demo alert actions, commands, and reports; run them against a development database, not your production workspace. Tests cover navigation, all seven node charts, topology inspection, persisted alert actions, simulated commands, reports/downloads, analytics/log filters, disconnected Live Mode, and mobile overflow. Screenshots are written to test-results.

Build checks: `npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, `npm run build`. Format source after editing with `npx prettier --write src tests`. The browser suite also verifies theme/unit persistence and changing packet counters. Use `npm audit` to review dependency advisories before deployment; no project is declared production-secure merely because it builds.

## 8. Troubleshooting

| Problem                               | Exact action                                                                                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm` or `node` not recognized        | Install Node LTS from nodejs.org, fully reopen Terminal/VS Code, run `node --version` and `npm --version`. On Windows verify Node was added to PATH.                                                                   |
| npm install fails                     | Confirm `node --version` is 22/24 LTS, run `npm cache verify`, then `npm ci`. Check network/proxy and registry access. Do not delete the lockfile as a first fix.                                                      |
| PowerShell blocks npm.ps1             | Use `npm.cmd install` / `npm.cmd run dev`, or use Command Prompt; do not disable system security globally.                                                                                                             |
| Port 3000 already used                | Run `npm run dev -- --port 3001` and open http://localhost:3001. For production use `npm start -- --port 3001`. Stop duplicate processes rather than starting many servers.                                            |
| PostgreSQL port 5432 already used     | Reuse the existing database, or map Docker to `-p 5433:5432` and use port 5433 in DATABASE_URL.                                                                                                                        |
| Database connection refused           | Run `docker start vandoot-postgres` if using the provided container. Verify host/port/password in .env, then run `npx drizzle-kit push`. In another container, 127.0.0.1 refers to that container, not your host.      |
| Relation/table does not exist         | Run `npx drizzle-kit push` from the project root against the correct DATABASE_URL.                                                                                                                                     |
| Settings/alerts/commands/reports fail | Check /api/health in Chrome, the server terminal, DATABASE_URL and schema. Demo telemetry may still work even when persistence is unavailable.                                                                         |
| Blank page / dashboard not loading    | Open the actual Next.js URL, not a source file. Inspect Chrome F12 Console and Network; verify `npm run dev` is still running. Hard refresh with Ctrl+Shift+R.                                                         |
| Stale generated route/build errors    | Stop the server; macOS/Linux `rm -rf .next`; PowerShell `Remove-Item -Recurse -Force .next`; run `npx next typegen`, then `npm run dev`. Never delete your .env or source files.                                       |
| TypeScript/build errors               | Run `npx next typegen`, then `npm exec tsc -- --noEmit --pretty false`. Fix the first reported source error, then `npm run build`. Node/gateway IDs and numeric sensor values must follow src/types/index.ts.          |
| Fonts unavailable offline             | The interface uses system fallback fonts automatically; network connectivity is not required for simulation.                                                                                                           |
| Live API failure                      | Return to Demo, or verify the Pi service is running. Try `curl http://YOUR_PI:8000/api/gateway` on the dashboard computer. Check Settings URL, CORS, firewall, subnet, HTTPS mixed content, and the response contract. |
| WebSocket not connected               | Verify /api/live uses a real WebSocket server and WS/WSS protocol, inspect browser Network → WS, check proxy Upgrade headers and certificate validity. REST polling still operates independently.                      |
| New default not appearing             | Saved PostgreSQL settings take precedence; Settings → Restore defaults → Save changes. Restart/rebuild after .env changes.                                                                                             |
| Browser test cannot find Chromium     | Run `npx playwright install chromium`; on Linux run `npx playwright install --with-deps chromium` if system libraries are missing.                                                                                     |

## 9. Recommended hardware roadmap

1. Agree on a versioned packet schema: node/gateway IDs, sequence number, UTC timestamp, sensor ID/value/unit, battery, RSSI, SNR, parent/next hop, firmware.
2. Bring up one ESP32 + the actual LoRa module; choose a legally permitted frequency and duty cycle for your region. The demo's 868 MHz label is not a hardware recommendation.
3. Implement Pi packet ingestion with CRC checks, deduplication, monotonic sequence handling, retries/backpressure, and node last-seen timeouts.
4. Normalize readings and store telemetry server-side. Consider time-series partitions/retention as volume increases.
5. Implement the REST contract, then connect Live Mode and verify that disconnects are visible.
6. Add command authorization, idempotency, acknowledgement timeouts, safe restart/OTA procedures, and an audit trail before enabling real remote control.
7. Implement WebSocket snapshots/deltas, MQTT ingestion if appropriate, TLS and authenticated gateway identity.
8. Add mesh routing and failover testing with three nodes; expand to 10, then load-test 50 and 100+ nodes.
9. Add multi-location management, authentication/RBAC, server pagination, node-list virtualization, topology clustering, and back-end time-window queries for large networks.
10. Collect labeled real telemetry before building anomaly detection or battery/failure prediction models. Show confidence, model version, and provenance once real inference exists.

The data model is not fixed to three nodes. However, an unclustered SVG graph and in-browser history generation are not intended to display hundreds of devices simultaneously at production scale. Move history/aggregation to the backend and add grouped/virtualized views as your deployment grows. These are extension points, not claims that MQTT, GPS hardware, cloud sync, RBAC, OTA, or real ML are already implemented.
