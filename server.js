const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const FRONTEND_APP_URL = process.env.FRONTEND_APP_URL || 'https://voice-widget-frontend-tgdubai-split.up.railway.app/';
const CARDS_API_BASE = process.env.CARDS_API_BASE || 'https://voice-widget-backend-tgdubai-split.up.railway.app/api/cards';
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

function getPropIdFromRequest(req) {
  const queryId = normalizeId(req.query?.propId);
  if (queryId) return queryId;
  const routeId = normalizeId(req.params?.id);
  if (routeId) return routeId;
  const match = req.path.match(/^\/(?:share|property)\/([a-zA-Z0-9_-]+)$/);
  return match ? normalizeId(match[1]) : '';
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
    const target = normalizeId(propId);
    return list.find((item) => normalizeId(item?.id || item?.external_id || item?.uid || item?.propertyId) === target) || null;
  } catch {
    return null;
  }
}

function extractImage(card) {
  const images = Array.isArray(card?.images) ? card.images : [];
  return (
    card?.image ||
    card?.imageUrl ||
    images.find((src) => typeof src === 'string' && src.trim()) ||
    ''
  );
}

function extractPrice(card) {
  const raw = card?.price ?? card?.priceEUR ?? card?.price_amount ?? card?.priceAmount ?? '';
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return String(raw || '').trim();
  return `${Math.round(num).toLocaleString('en-US')} AED`;
}

function buildOgMeta({ appUrl, propId, card }) {
  const titleLeft = [card?.city, card?.property_type || card?.propertyType || card?.type].filter(Boolean).join(', ') || `Property ${propId}`;
  const priceLabel = extractPrice(card);
  const title = priceLabel ? `${titleLeft} — ${priceLabel}` : titleLeft;
  const description = card?.description || 'Посмотри этот объект в моем боте';
  const image = extractImage(card);
  const url = `${appUrl}?propId=${encodeURIComponent(propId)}`;
  const tags = [
    `<title>${esc(title)}</title>`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${esc(image)}">`);
    tags.push(`<meta name="twitter:image" content="${esc(image)}">`);
  }
  return tags.join('\n  ');
}

function renderIndexWithOg({ propId, card, injectBaseHref = false }) {
  let html = INDEX_TEMPLATE;
  if (injectBaseHref && !/<base\s/i.test(html)) {
    html = html.replace('<head>', '<head>\n  <base href="/">');
  }
  if (!propId || !card) return html;
  const appUrl = FRONTEND_APP_URL.replace(/\/+$/, '');
  const ogMeta = buildOgMeta({ appUrl, propId, card });
  return html.replace('</head>', `  ${ogMeta}\n</head>`);
}

async function renderApp(req, res) {
  const propId = getPropIdFromRequest(req);
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

app.get('/', renderApp);
app.get('/share/:id', renderApp);
app.get('/property/:id', renderApp);
app.get('*', renderApp);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server is running on port ${PORT}`);
});
