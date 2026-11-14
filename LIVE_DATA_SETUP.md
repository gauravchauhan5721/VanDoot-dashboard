# VanDoot native 3D — live-ready integration

This package builds on the native React/Three.js integration. The existing dashboard's `useDashboard()` provider already supports Demo/Live data modes, polling and WebSocket snapshots. This patch consumes that same data, rather than introducing a separate connection.

## Setup
1. Copy `src/` into the repository on `feature/3d-simulation` (overwrite the previous Simulation.tsx).
2. Install `three` and `@types/three` as documented in `NATIVE_INTEGRATION_README.md`.
3. Configure `src/features/simulation/liveAdapter.ts` -> `liveNodeMap` with your actual hardware IDs, e.g. `n1: "esp32-forest-01"`. Do not guess IDs.
4. Ensure the gateway's snapshot matches `src/types/index.ts` (`Snapshot.nodes`, each `SensorNode.readings`, `status`, `lastSeen`).
5. Check actual sensor keys; the adapter currently recognizes `temperature`/`temp`, `humidity`, and `gas`/`mq2`/`smoke`. Add keys as needed. Gas is raw unless the backend supplies calibrated units.
6. Configure the gateway URLs in Dashboard Settings, switch to Live mode, and test.
7. Run `npm run typecheck` and `npm run build`; verify in browser.

## Safety and behavior
- Unmapped nodes and readings older than 30 seconds are marked offline and display dashes, not invented readings.
- 3D geometry, risk score, packet counts and scenario engine are still simulated; they are NOT real gateway events.
- Do not use the simulated risk indicator as a real fire warning.
- Secure the live API, WebSocket, device controls and credentials before public deployment.
- This integration has not been end-to-end build or hardware tested.
