# VanDoot ranger workspace — stage 1

## Source inspection
Based on `feature/proposal-forest-workspace` at f5258e4, retaining its inference proxy, PostgreSQL forest records, thermal importer, live adapter and existing components. Main was efd15f9; `feature/3d-simulation` at 5228621 is already represented by the simulation components. Work branch: `feature/trustworthy-forest-preview`. No destructive reset or merge into main.

## Run
```
npm ci
npm run dev
npm run typecheck
npm run test:contracts
npm run build
```
Without DATABASE_URL, database requests fail explicitly; the synthetic UI remains usable. For persistent legacy forest records, configure PostgreSQL and apply the existing Drizzle schema and `migrations/001_forest.sql`; see FOREST_WORKSPACE_SETUP.md. Back up with pg_dump before migrations. No SQLite migration is implemented.

## Preview packaging
`node scripts/build-preview.mjs` builds the same React/Next application into `dist/` in a temporary build directory, excluding server API routes only from the static output. Source API routes remain intact. `NEXT_PUBLIC_STATIC_PREVIEW=1` disables initial API loading and hardware polling in this hosted build. The hosted preview cannot contact your laptop's backend; run the repository locally for integration work. No secrets or DATABASE_URL are compiled into the preview.

## Architecture
Existing DashboardProvider → existing application shell → OperationsWorkspace for primary ranger views. The original evidence components retain separate inference / thermal adapters. The primary workspace uses four explicitly synthetic fixture nodes; legacy analytics and 3D simulation still use their older separate demo dataset. They are not correlated to the new fixture IDs. Demo incident and registration state lives only in page-session memory and survives navigation, not reload. Live mode never renders demo incident records or registrations. Live nodes use the existing gateway adapter; unreported capabilities remain unknown.

## Status
| Capability | Implementation | Verification |
|---|---|---|
| Overview, node search/filter, tabs, coordinate view, network view | Implemented | Type checked; browser navigation checked |
| Demo replay, status review, notes, audit entries | Implemented in session memory | Synthetic browser scenario |
| Partial node registration | Demo only; never auto-online | Not hardware tested |
| Existing thermal JSON import | Preserved, 32×24 validation | Contract test only |
| Existing image/audio inference proxy | Preserved, service-dependent | Schema tests only; no model configured |
| PostgreSQL record APIs | Preserved | Not connected / end-to-end tested |
| Camera MJPEG, microphone capture, source tests | Pending | Not tested |
| Local incident correlation and persistent new workspace history | Pending | Replay is UI simulation, not an incident engine |
| Multi-user roles / device credentials | Pending | Existing token endpoints are not full RBAC |
| Secure evidence storage, retention, buffering, calibration | Pending | No production-readiness claim |
| LoRa mesh | Future adapter | Not implemented or tested |

## Hardware onboarding order
1. Run locally on the laptop and configure PostgreSQL only if persistent records are needed.
2. Configure gateway HTTP URL in Settings; use the existing `/latest` contract from FOREST_WORKSPACE_SETUP.md. Ensure CORS and network reachability. Fresh capture timestamps and `online: true` are required; saving configuration alone never proves connectivity.
3. Validate one node's sensor values and timestamps before enabling more nodes.
4. Supply the actual camera model and MJPEG endpoint, microphone model/encoding/sample rate, and thermal sensor model. These source adapters are pending; do not enter credentials into media URLs.
5. Configure a local model service using the existing `/predict` contract and validate supported classes against recorded data before connecting incidents.
6. Implement persistent incident ingestion, device credentials and backend roles before network deployment. Use an authenticated HTTPS reverse proxy for legacy routes; they are not hardened for exposure.
7. Add other nodes after node/source associations are validated. Select hardware and protocol before future LoRa firmware.

## Verification scope
TypeScript and existing contract tests passed. Static production export passed. Browser checks exercised demo replay, navigation into incident details, status updates and notes. Hardware, recorded-media inference, PostgreSQL persistence, mobile viewport and full regression tests have not been performed. The old Playwright suite assumes a database and older navigation, so is not claimed as passing.

## Remaining stages
Stage 2 requires the actual camera/audio/thermal sources and a validated local model service. Build versioned event envelopes, persistent incidents/evidence and correlation/cooldowns; do not use the demo UI as production storage. Stage 3 adds source-associated multi-node ingestion. Stage 4 adds access controls, evidence security, disconnect/recovery, retention and hardware verification.
