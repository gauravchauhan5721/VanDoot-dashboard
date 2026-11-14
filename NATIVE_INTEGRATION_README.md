# VanDoot Native 3D integration (no iframe)

This patch replaces the earlier iframe implementation with a client-side React feature that directly mounts the **original Three.js forest renderer** and runs the **original simulation engine**. It uses the existing dashboard layout, navigation, and page styles. The simulation is isolated from real telemetry, clearly marked as a demo.

## Install
1. Switch to the GitHub branch `feature/3d-simulation`.
2. Copy this ZIP's `src` directory into the root of your cloned `VanDoot-dashboard` repository, merging and replacing `src/features/Simulation.tsx`.
3. Run `npm install three@^0.170.0` and `npm install -D @types/three`.
4. Run `npm run typecheck` and `npm run build`.
5. Open `http://localhost:3000/#simulation` and verify camera, node selection, scenario controls and reset.
6. Commit and push all changes to the feature branch.

## Notes
- The earlier `public/simulation` ZIP is **not required** for this native integration.
- No iframe or second application is loaded.
- The demo is not synchronized with actual gateway readings. That would require a separate data mapping.
- Secure API routes and admin functions before deploying a publicly accessible live dashboard.
