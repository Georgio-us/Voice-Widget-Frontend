const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const FRONTEND_APP_URL = process.env.FRONTEND_APP_URL || '';
const CARDS_API_BASE = process.env.CARDS_API_BASE || '';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '';
const TELEGRAM_MINIAPP_PATH = process.env.TELEGRAM_MINIAPP_PATH || 'app';
const VW_API_URL = process.env.VW_API_URL || '';
const VW_CARDS_SEARCH_URL = process.env.VW_CARDS_SEARCH_URL || '';
const VW_SHARE_BASE_URL = process.env.VW_SHARE_BASE_URL || FRONTEND_APP_URL || '';
const SHARE_PREFIX = 'prop_';
const INDEX_HTML_PATH = path.join(__dirname, 'index.html');

const trim = (v) => String(v || '').trim();
const stripSlash = (v) => trim(v).replace(/\/+$/, '');
const EFFECTIVE_CARDS_API_BASE = stripSlash(CARDS_API_BASE);
const EFFECTIVE_VW_API_URL = trim(VW_API_URL) || (
  EFFECTIVE_CARDS_API_BASE
    ? EFFECTIVE_CARDS_API_BASE.replace(/\/api\/cards$/i, '/api/audio/upload')
    : ''
);
const EFFECTIVE_VW_CARDS_SEARCH_URL = trim(VW_CARDS_SEARCH_URL) || (
  EFFECTIVE_CARDS_API_BASE
    ? `${EFFECTIVE_CARDS_API_BASE}/search?limit=2000`
    : ''
);

app.use(cors());
app.use(express.static(__dirname, { index: false }));

const INDEX_TEMPLATE = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeId(raw) {
  return String(raw || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
}

function normalizePropId(raw) {
  const clean = normalizeId(raw);
  if (!clean) return '';
  const loweredPrefix = SHARE_PREFIX.toUpperCase();
  return clean.startsWith(loweredPrefix) ? clean.slice(loweredPrefix.length) : clean;
}

function buildPropToken(propId) {
  const normalized = normalizePropId(propId);
  return normalized ? `${SHARE_PREFIX}${normalized}` : '';
}

function getPublicBaseUrl(req) {
  const configured = String(FRONTEND_APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  try {
    const host = String(req?.get?.('host') || '').trim();
    if (host) return `${req.protocol || 'https'}://${host}`;
  } catch {}
  return '';
}

function buildShareUrl(propId, req) {
  const normalized = normalizePropId(propId);
  const base = getPublicBaseUrl(req);
  if (!normalized) return base || '/';
  if (!base) return `/share/prop/${encodeURIComponent(normalized)}`;
  return `${base}/share/prop/${encodeURIComponent(normalized)}`;
}

function buildDirectMiniAppLink(propId) {
  const token = buildPropToken(propId);
  const bot = String(TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
  if (!token || !bot) return '';
  return `https://t.me/${bot}/${TELEGRAM_MINIAPP_PATH}?startapp=${encodeURIComponent(token)}`;
}

function getPropIdFromShareRequest(req) {
  const fromSlug = normalizePropId(req.params?.slug);
  if (fromSlug) return fromSlug;
  const fromSegment = normalizePropId(req.params?.id);
  if (fromSegment) return fromSegment;
  return '';
}

function getPropIdFromAppRequest(req) {
  const fromQuery = normalizePropId(req.query?.propId || req.query?.startapp || req.query?.start);
  if (fromQuery) return fromQuery;
  const fromRoute = normalizePropId(req.params?.id);
  if (fromRoute) return fromRoute;
  return '';
}

async function fetchPropertyById(propId) {
  if (!propId) return null;
  if (!String(CARDS_API_BASE || '').trim()) return null;
  try {
    const directRes = await fetch(`${CARDS_API_BASE}/${encodeURIComponent(propId)}`);
    if (directRes.ok) {
      const data = await directRes.json().catch(() => null);
      if (data && typeof data === 'object') return data;
    }
  } catch {}

  try {
    const listRes = await fetch(`${CARDS_API_BASE}/search?limit=2000`);
    if (!listRes.ok) return null;
    const data = await listRes.json().catch(() => ({}));
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.cards)
        ? data.cards
        : Array.isArray(data.properties)
          ? data.properties
          : Array.isArray(data.items)
            ? data.items
            : [];
    const target = normalizePropId(propId);
    return list.find((item) => normalizePropId(item?.id || item?.external_id || item?.uid || item?.propertyId) === target) || null;
  } catch {
    return null;
  }
}

function extractImage(card) {
  const images = Array.isArray(card?.images) ? card.images : [];
  const raw = (
    card?.mainImage ||
    card?.main_image ||
    card?.image ||
    card?.imageUrl ||
    images.find((src) => typeof src === 'string' && src.trim()) ||
    ''
  );
  const source = String(raw || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  const base = String(FRONTEND_APP_URL || '').trim().replace(/\/+$/, '');
  if (!base) return source;
  const path = source.startsWith('/') ? source : `/${source}`;
  return `${base}${path}`;
}

function extractPrice(card) {
  const raw = card?.price ?? card?.priceEUR ?? card?.price_amount ?? card?.priceAmount ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return String(raw || '').trim();
  return `${Math.round(num).toLocaleString('en-US')} USD`;
}

function extractArea(card) {
  const raw = card?.area_m2 ?? card?.specs_area_m2 ?? card?.specs?.area_m2 ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return String(raw || '').trim();
  return `${Math.round(num)} m²`;
}

function extractRooms(card) {
  const raw = card?.rooms ?? card?.specs_rooms ?? card?.specs?.rooms ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(num) && num > 0) return `${Math.round(num)} rooms`;
  return String(raw || '').trim();
}

function extractFloor(card) {
  const raw = card?.floor ?? card?.specs_floor ?? card?.specs?.floor ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(num) && num > 0) return `${Math.round(num)} floor`;
  return String(raw || '').trim();
}

function extractCity(card) {
  return String(card?.city || card?.location_city || card?.location?.city || 'Odesa').trim();
}

function extractType(card) {
  return String(card?.property_type || card?.propertyType || card?.type || 'Property').trim();
}

function extractDistrict(card) {
  return String(card?.district || card?.neighborhood || card?.city || 'Odesa').trim();
}

function buildShareOgMeta({ propId, card, req }) {
  const image = extractImage(card);
  const price = extractPrice(card) || '—';
  const area = extractArea(card) || '—';
  const rooms = extractRooms(card) || '— rooms';
  const floor = extractFloor(card) || '— floor';
  const district = extractDistrict(card);
  const city = extractCity(card);
  const propertyType = extractType(card);
  const title = `🏙 ${propertyType} in ${district}`;
  const description = `Цена: ${price} | Комнаты: ${rooms} | Площадь: ${area} | Этаж: ${floor} | Район: ${district}, ${city}. Посмотреть детали в приложении.`;
  const shareUrl = buildShareUrl(propId, req);

  const tags = [
    `<title>${esc(title)}</title>`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="VIA Properties">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(shareUrl)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`
  ];

  if (image) {
    tags.push(`<meta property="og:image" content="${esc(image)}">`);
    tags.push(`<meta name="twitter:image" content="${esc(image)}">`);
  }

  return { title, description, image, shareUrl, tags: tags.join('\n  ') };
}

function renderShareLandingHtml({ propId, card, req }) {
  const directLink = buildDirectMiniAppLink(propId);
  const og = buildShareOgMeta({ propId, card: card || {}, req });
  const price = extractPrice(card) || '—';
  const area = extractArea(card) || '—';
  const rooms = extractRooms(card) || '— rooms';
  const floor = extractFloor(card) || '— floor';
  const district = extractDistrict(card) || '—';
  const city = extractCity(card) || 'Odesa';
  const type = extractType(card) || 'Property';
  const openButton = directLink
    ? `<a class="open-btn" href="${esc(directLink)}">Открыть объект в приложении</a>`
    : `<a class="open-btn" href="${esc(getPublicBaseUrl(req) || '/')}">Открыть каталог</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${og.tags}
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#000; color:#fff; font-family:"SF Pro Display","Segoe UI",Arial,sans-serif; padding:18px; box-sizing:border-box; }
    .wrap { width:min(100%, 420px); padding:16px 14px; text-align:center; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:linear-gradient(155deg, rgba(42,55,80,.38), rgba(17,18,22,.62)); box-shadow:0 14px 40px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08); backdrop-filter:blur(18px) saturate(130%); -webkit-backdrop-filter:blur(18px) saturate(130%); }
    .title { font-size:18px; line-height:1.22; margin:0 0 4px; font-weight:700; letter-spacing:.1px; }
    .subtitle { margin:0 0 12px; color:rgba(255,255,255,.72); font-size:13px; font-weight:500; }
    .meta { margin:0 auto 12px; display:flex; flex-wrap:wrap; justify-content:center; gap:6px; max-width:100%; }
    .chip { padding:6px 10px; border-radius:999px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); color:#fff; font-size:12px; line-height:1.2; font-weight:500; white-space:nowrap; }
    .open-btn { display:inline-block; padding:11px 16px; min-height:18px; border-radius:9px; font-size:14px; font-weight:700; background:linear-gradient(180deg, #2d8fe1, #2481cc); color:#fff; text-decoration:none; border:1px solid rgba(255,255,255,.14); box-shadow:0 6px 18px rgba(36,129,204,.38); }
    .open-btn:active { transform:translateY(1px); }
  </style>
</head>
<body>
  <main class="wrap">
    <h1 class="title">${esc(og.title)}</h1>
    <p class="subtitle">${esc(`${city}, ${type}`)}</p>
    <div class="meta">
      <div class="chip">${esc(`Цена: ${price}`)}</div>
      <div class="chip">${esc(`Район: ${district}`)}</div>
      <div class="chip">${esc(`Комнаты: ${rooms}`)}</div>
      <div class="chip">${esc(`Площадь: ${area}`)}</div>
      <div class="chip">${esc(`Этаж: ${floor}`)}</div>
    </div>
    ${openButton}
  </main>
</body>
</html>`;
}

function renderIndexWithOg({ propId, card, injectBaseHref = false, req = null }) {
  let html = INDEX_TEMPLATE;
  if (injectBaseHref && !/<base\s/i.test(html)) {
    html = html.replace('<head>', '<head>\n  <base href="/">');
  }
  const ogMeta = (!propId || !card)
    ? ''
    : `\n  ${buildShareOgMeta({ propId, card, req }).tags}\n`;
  const shareBaseForClient = String(VW_SHARE_BASE_URL || getPublicBaseUrl(req) || '')
    .trim()
    .replace(/\/+$/, '');
  const runtimeConfigScript = `
  <script>
    window.__VW_API_URL__ = ${JSON.stringify(EFFECTIVE_VW_API_URL)};
    window.__VW_CARDS_SEARCH_URL__ = ${JSON.stringify(EFFECTIVE_VW_CARDS_SEARCH_URL)};
    window.__VW_TELEGRAM_BOT_USERNAME__ = ${JSON.stringify(String(TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, ''))};
    window.__VW_SHARE_BASE_URL__ = ${JSON.stringify(shareBaseForClient)};
  </script>`;
  return html.replace('</head>', `${ogMeta}${runtimeConfigScript}\n</head>`);
}

async function renderShareRoute(req, res) {
  const propId = getPropIdFromShareRequest(req);
  const card = propId ? await fetchPropertyById(propId) : null;
  const html = renderShareLandingHtml({ propId, card, req });
  res.type('html').send(html);
}

async function renderApp(req, res) {
  const propId = getPropIdFromAppRequest(req);
  const needsBaseHref = req.path !== '/';
  if (!propId) {
    const html = renderIndexWithOg({ propId: '', card: null, injectBaseHref: needsBaseHref, req });
    res.type('html').send(html);
    return;
  }
  const card = await fetchPropertyById(propId);
  const html = renderIndexWithOg({ propId, card, injectBaseHref: needsBaseHref, req });
  res.type('html').send(html);
}

app.get('/share/:slug', renderShareRoute);
app.get('/share/prop/:id', renderShareRoute);
app.get('/', renderApp);
app.get('/property/:id', renderApp);
app.get('*', renderApp);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server is running on port ${PORT}`);
});
