# ENV Target Matrix (Frontend)

Last updated: 2026-04-21
Branch: `Split`

## Goal

Define frontend-side target configuration for client-isolated Railway deployment.

## Current Reality

Frontend currently uses:
- `PORT` in `server.js`
- runtime API resolution chain in `voice-widget-v1.js` (`query -> global -> localStorage -> localhost fallback -> attr/default`)

This means client isolation depends on correct API URL wiring at publish/runtime.

## Target Variables

| Variable | Class | Required | Example | Notes |
|---|---|---|---|---|
| `PORT` | STATIC | Auto | Railway managed | Service port only. |
| `WIDGET_API_URL` | CLIENT | Yes | `https://client-backend.up.railway.app/api/audio/upload` | Injected by `/runtime-config.js` into `window.__VW_API_URL__`. |
| `WIDGET_ASSETS_BASE` | CLIENT | Optional | `https://client-frontend.up.railway.app/assets/` | Injected by `/runtime-config.js` into `window.__VW_ASSETS_BASE__`. |

## Target Behavior (To implement/maintain)

1. Client frontend must resolve API endpoint only to paired client backend.
2. Hardcoded split/demo backend defaults should not decide production routing.
3. Query/localStorage overrides should be controlled for production embeds.

## Deployment Checklist

1. Frontend URL is client-specific.
2. Widget `api-url` points to client backend URL.
3. Smoke test from client frontend:
   - widget opens
   - request reaches client backend (`/api/audio/upload`)
   - cards/leads flow uses client backend endpoints only.

## Reference

- Backend-wide cross-service matrix and full onboarding:
  - `Voice-Widget-Backend/docs/ENV_TARGET_MATRIX.md`
  - `Voice-Widget-Backend/docs/CLIENT_ONBOARDING.md`
