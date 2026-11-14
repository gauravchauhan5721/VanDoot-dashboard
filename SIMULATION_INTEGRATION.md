# VanDoot 3D Simulation integration

The navigation now includes **3D Simulation**, rendering the original Three.js simulation in an isolated iframe at `/simulation/index.html`.

## Required asset upload

The simulation's compiled assets are provided separately as **VanDoot_simulation_for_dashboard.zip** in the ChatGPT conversation. Extract that ZIP into the **root of this repository**, preserving the folder structure:

```
public/
  simulation/
    index.html
    assets/
      index-CmaswMy2.js
      index-CxXBiKwC.css
      (font assets)
```

**Important:** The simulator does not render until these files are added. Do not commit `node_modules` or the full original uploaded 20 MB ZIP.

The simulation's HTML was adjusted from absolute `/assets/*` paths to relative `./assets/*`, so it can run beneath the existing Next.js website without interfering with its CSS and JS.

## Local verification

```bash
npm ci
npm run typecheck
npm run build
npm run dev
```

Open http://localhost:3000/#simulation and check interactive scene controls. Then test http://localhost:3000/simulation/index.html directly.

## Deployment

Vercel can deploy the Next.js repository once the branch is merged. Import this GitHub repository in Vercel, select the Next.js framework, and deploy. Because existing API routes use PostgreSQL, configure `DATABASE_URL` for persistent settings, alerts, and commands. Demo display may still work without the database, but persistent operations require it.

**Security:** Current dashboard has unauthenticated admin/API capabilities. Before exposing a production device or gateway, enforce authentication and authorization on admin routes and avoid publicly exposing gateway URLs, database credentials, or secret API keys. The simulation is illustrative; its visual state does not represent live hardware telemetry unless an explicit integration is implemented.
