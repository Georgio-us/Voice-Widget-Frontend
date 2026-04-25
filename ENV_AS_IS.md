# ENV AS-IS Snapshot (Frontend)

Last updated: 2026-04-25
Branch: `Split`

## Scope

This document captures current frontend configuration behavior "as is":
- env variable usage at runtime/server
- API URL resolution chain in widget
- hardcoded URLs and demo fallbacks

## .env Status

- No `.env*` files are present in this repository at snapshot time.
- No frontend `.gitignore` exists in this repo currently.
- Frontend runtime is mostly browser-config based, not `.env`-based.

## Environment Variables Used

| Variable | Where used | Current behavior / fallback | Required in prod |
|---|---|---|---|
| `PORT` | `server.js` | Fallback `3000` | Yes (Railway usually injects) |
| `WIDGET_API_URL` | `server.js` | Runtime config value for `window.__VW_API_URL__` | Yes |
| `WIDGET_ASSETS_BASE` | `server.js` | Runtime config value for `window.__VW_ASSETS_BASE__` | Optional |
| `WIDGET_DEFAULT_THEME` | `server.js` | Runtime config value for `window.__VW_DEFAULT_THEME__` (`0=light`,`1=dark`) | Optional |

## API URL Resolution (Widget Runtime)

Primary logic is in `voice-widget-v1.js`:

1. `?vwApi=...` query param
2. `window.__VW_API_URL__`
3. `localStorage['vw_api_url']`
4. local host fallback: `http://localhost:3001/api/audio/upload`
5. attribute fallback: `api-url="..."` or default hardcoded split backend URL

Current hardcoded default in component:
- `https://voice-widget-backend-split.up.railway.app/api/audio/upload`

## Hardcoded Values / Fallback Hotspots

1. Hardcoded backend URL:
   - `voice-widget-v1.js` default `api-url` fallback points to split backend.
   - `index.html` sets `api-url` to split backend.
   - `console-demo.js` sets same split backend URL.

2. Hardcoded external pages/assets:
   - `console-demo.js` points to `https://georgio-us.github.io/Voice-Widget-Frontend`
   - `voice-widget-v1.js` contains hardcoded Notion privacy policy URL.
   - `modules/markdown.js` imports from `https://esm.sh/...`.

3. Localhost behavior:
   - Widget auto-switches to `http://localhost:3001/api/audio/upload` on local hostnames.

## AS-IS Risk Notes (for Railway duplicate environments)

1. Backend drift risk:
   - If frontend env is duplicated but hardcoded fallback remains, widget can still talk to old split backend.

2. Hidden fallback risk:
   - URL can come from query/global/localStorage, which may mask wrong Railway config.

3. Multi-client isolation risk:
   - Without strict API URL control, client A frontend can accidentally call client B backend.

## Immediate Next Doc (planned)

- `ENV_TARGET_MATRIX.md` (cross-service contract):
  - definitive source of API URL per environment
  - static vs client-specific variables
  - deployment checklist before publishing client widget
