/**
 * bot-logic-patch.js
 *
 * External patch for Telegram deep linking:
 *  - Parse /start payload: prop_<ID>
 *  - Build Mini App URL: https://voice-widget-frontend-tgdubai-split.up.railway.app/?propId=<ID>
 *
 * You can copy the needed block into your bot service.
 */

const MINI_APP_URL = 'https://voice-widget-frontend-tgdubai-split.up.railway.app/';
const START_PREFIX = 'prop_';

function normalizePropId(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();
}

function parseStartPayload(startPayload) {
  const payload = String(startPayload || '').trim();
  if (!payload || !payload.startsWith(START_PREFIX)) return null;
  const id = normalizePropId(payload.slice(START_PREFIX.length));
  return id || null;
}

function buildMiniAppUrl(propId) {
  const base = MINI_APP_URL.replace(/\/+$/, '');
  const id = normalizePropId(propId);
  if (!id) return `${base}/`;
  return `${base}/?propId=${encodeURIComponent(id)}`;
}

/* ------------------------------------------------------------------
 * Telegraf patch example
 * ------------------------------------------------------------------
 * import { Telegraf, Markup } from 'telegraf';
 *
 * bot.start(async (ctx) => {
 *   const startPayload = ctx.startPayload || '';
 *   const propId = parseStartPayload(startPayload);
 *   const appUrl = buildMiniAppUrl(propId);
 *
 *   await ctx.reply(
 *     propId
 *       ? `Открываю объект ${propId}`
 *       : 'Открываю каталог объектов',
 *     Markup.inlineKeyboard([
 *       [Markup.button.webApp('Открыть каталог', appUrl)]
 *     ])
 *   );
 * });
 */

/* ------------------------------------------------------------------
 * node-telegram-bot-api patch example
 * ------------------------------------------------------------------
 * const TelegramBot = require('node-telegram-bot-api');
 *
 * bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
 *   const chatId = msg.chat.id;
 *   const payload = match && match[1] ? match[1] : '';
 *   const propId = parseStartPayload(payload);
 *   const appUrl = buildMiniAppUrl(propId);
 *
 *   await bot.sendMessage(
 *     chatId,
 *     propId
 *       ? `Открываю объект ${propId}`
 *       : 'Открываю каталог объектов',
 *     {
 *       reply_markup: {
 *         inline_keyboard: [[{ text: 'Открыть каталог', web_app: { url: appUrl } }]]
 *       }
 *     }
 *   );
 * });
 */

module.exports = {
  START_PREFIX,
  parseStartPayload,
  buildMiniAppUrl,
  normalizePropId
};
