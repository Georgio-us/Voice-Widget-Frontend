const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const FRONTEND_APP_URL = process.env.FRONTEND_APP_URL || 'https://voice-widget-frontend-tgdubai-split.up.railway.app/';
const CARDS_API_BASE = process.env.CARDS_API_BASE || 'https://voice-widget-backend-tgdubai-split.up.railway.app/api/cards';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'viaproperties_bot';
const TELEGRAM_MINIAPP_PATH = process.env.TELEGRAM_MINIAPP_PATH || 'app';
const SHARE_PREFIX = 'prop_';
const INDEX_HTML_PATH = path.join(__dirname, 'index.html');

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

function buildShareUrl(propId) {
  const normalized = normalizePropId(propId);
  if (!normalized) return FRONTEND_APP_URL;
  const base = FRONTEND_APP_URL.replace(/\/+$/, '');
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
  const base = FRONTEND_APP_URL.replace(/\/+$/, '');
  const path = source.startsWith('/') ? source : `/${source}`;
  return `${base}${path}`;
}

function extractPrice(card) {
  const raw = card?.price ?? card?.priceEUR ?? card?.price_amount ?? card?.priceAmount ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return String(raw || '').trim();
  return `${Math.round(num).toLocaleString('en-US')} AED`;
}

function extractArea(card) {
  const raw = card?.area_m2 ?? card?.specs_area_m2 ?? card?.specs?.area_m2 ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return String(raw || '').trim();
  return `${Math.round(num)} m²`;
}

function extractType(card) {
  return String(card?.property_type || card?.propertyType || card?.type || 'Property').trim();
}

function extractDistrict(card) {
  return String(card?.district || card?.neighborhood || card?.city || 'Dubai').trim();
}

function buildShareOgMeta({ propId, card }) {
  const image = extractImage(card);
  const price = extractPrice(card) || '—';
  const area = extractArea(card) || '—';
  const title = `🏙 ${extractType(card)} in ${extractDistrict(card)}`;
  const description = `Цена: ${price} | Площадь: ${area}. Посмотреть детали в приложении.`;
  const shareUrl = buildShareUrl(propId);

  const tags = [
    `<title>${esc(title)}</title>`,
    '<meta property="og:type" content="website">',
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

function renderShareLandingHtml({ propId, card }) {
  const directLink = buildDirectMiniAppLink(propId);
  const og = buildShareOgMeta({ propId, card: card || {} });
  const openButton = directLink
    ? `<a class="open-btn" href="${esc(directLink)}">Открыть объект в приложении</a>`
    : `<a class="open-btn" href="${esc(FRONTEND_APP_URL)}">Открыть каталог</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${og.tags}
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#000000; color:#ffffff; font-family:Arial, sans-serif; }
    .wrap { max-width:420px; padding:24px; text-align:center; }
    .title { font-size:20px; line-height:1.3; margin:0 0 10px; }
    .open-btn { display:inline-block; padding:15px 30px; border-radius:10px; font-weight:bold; background:#2481cc; color:#ffffff; text-decoration:none; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1 class="title">${esc(og.title)}</h1>
    ${openButton}
  </main>
</body>
</html>`;
}

function renderIndexWithOg({ propId, card, injectBaseHref = false }) {
  let html = INDEX_TEMPLATE;
  if (injectBaseHref && !/<base\s/i.test(html)) {
    html = html.replace('<head>', '<head>\n  <base href="/">');
  }
  if (!propId || !card) return html;

  const og = buildShareOgMeta({ propId, card });
  return html.replace('</head>', `  ${og.tags}\n</head>`);
}

async function renderShareRoute(req, res) {
  const propId = getPropIdFromShareRequest(req);
  const card = propId ? await fetchPropertyById(propId) : null;
  const html = renderShareLandingHtml({ propId, card });
  res.type('html').send(html);
}

async function renderApp(req, res) {
  const propId = getPropIdFromAppRequest(req);
  const needsBaseHref = req.path !== '/';
  if (!propId) {
    const html = renderIndexWithOg({ propId: '', card: null, injectBaseHref: needsBaseHref });
    res.type('html').send(html);
    return;
  }
  const card = await fetchPropertyById(propId);
  const html = renderIndexWithOg({ propId, card, injectBaseHref: needsBaseHref });
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
