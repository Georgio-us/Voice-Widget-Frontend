const DEFAULT_API_UPLOAD_URL =
  'https://voice-widget-backend-dubai.up.railway.app/api/audio/upload';

const resolveApiUploadUrl = () => {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('vwApi');
    const fromGlobal = window.__VW_API_URL__;
    const fromStorage = localStorage.getItem('vw_api_url');
    if (fromQuery) return fromQuery;
    if (fromGlobal) return fromGlobal;
    if (fromStorage) return fromStorage;
  } catch {}
  return DEFAULT_API_UPLOAD_URL;
};

const deriveCardsBaseUrl = (apiUploadUrl) => {
  try {
    const url = new URL(String(apiUploadUrl));
    url.pathname = url.pathname.replace(/\/api\/audio\/upload\/?$/i, '/api/cards');
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(apiUploadUrl)
      .replace(/\/api\/audio\/upload\/?$/i, '/api/cards')
      .replace(/\/$/, '');
  }
};

const htmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function mountTelegramMiniApp(root) {
  if (!root) return;

  const apiUploadUrl = resolveApiUploadUrl();
  const cardsBaseUrl = deriveCardsBaseUrl(apiUploadUrl);

  const state = {
    sessionId: null,
    cards: [],
    messages: [
      {
        role: 'assistant',
        text: 'Welcome to Dubai Real Estate Mini App. Ask me anything and browse catalog cards on the left.'
      }
    ],
    sending: false
  };

  const render = () => {
    root.innerHTML = `
      <div class="tg-app">
        <section class="tg-panel tg-catalog">
          <header class="tg-header">
            <span>Catalog</span>
            <span class="tg-subtle">${state.cards.length} items</span>
          </header>
          <div class="tg-cards" id="tgCards"></div>
        </section>
        <section class="tg-panel tg-chat">
          <header class="tg-header">
            <span>AI Chat</span>
            <span class="tg-subtle">${state.sessionId ? `Session ${state.sessionId.slice(-8)}` : 'No session yet'}</span>
          </header>
          <div class="tg-messages" id="tgMessages"></div>
          <form class="tg-input-row" id="tgForm">
            <input id="tgInput" class="tg-input" type="text" placeholder="Type your request..." autocomplete="off" />
            <button class="tg-send" id="tgSend" type="submit" ${state.sending ? 'disabled' : ''}>Send</button>
          </form>
        </section>
      </div>
    `;

    const cardsEl = root.querySelector('#tgCards');
    const messagesEl = root.querySelector('#tgMessages');
    const formEl = root.querySelector('#tgForm');
    const inputEl = root.querySelector('#tgInput');

    cardsEl.innerHTML = state.cards.length
      ? state.cards
          .map((card) => {
            const id = htmlEscape(card.id || '-');
            const city = htmlEscape(card.city || '');
            const district = htmlEscape(card.district || '');
            const price = card.priceEUR ? `${Number(card.priceEUR).toLocaleString('en-US')} EUR` : '-';
            const rooms = card.rooms ?? '-';
            const image = htmlEscape(card.images?.[0] || '');
            return `
              <article class="tg-card" data-card-id="${id}">
                ${image ? `<img src="${image}" alt="${id}" />` : '<img alt="" />'}
                <div>
                  <p class="tg-card-title">${id}</p>
                  <p class="tg-card-meta">${city}${city && district ? ', ' : ''}${district}</p>
                  <p class="tg-card-meta">Rooms: ${rooms} · Price: ${htmlEscape(price)}</p>
                </div>
              </article>
            `;
          })
          .join('')
      : '<p class="tg-subtle">Loading catalog...</p>';

    messagesEl.innerHTML = state.messages
      .map(
        (message) => `
          <div class="tg-msg ${message.role === 'user' ? 'user' : 'assistant'}">${htmlEscape(message.text)}</div>
        `
      )
      .join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    cardsEl.querySelectorAll('.tg-card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const cardId = cardEl.getAttribute('data-card-id');
        if (!cardId) return;
        const prompt = `Show details for property ${cardId}`;
        inputEl.value = prompt;
        inputEl.focus();
      });
    });

    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.sending) return;

      const text = String(inputEl.value || '').trim();
      if (!text) return;
      inputEl.value = '';

      state.messages.push({ role: 'user', text });
      state.sending = true;
      render();

      try {
        const formData = new FormData();
        formData.append('text', text);
        formData.append('sessionId', state.sessionId || '');

        const response = await fetch(apiUploadUrl, { method: 'POST', body: formData });
        const data = await response.json().catch(() => ({}));

        const assistantText =
          String(data?.response || data?.message || 'The assistant returned an empty response.');
        state.messages.push({ role: 'assistant', text: assistantText });

        if (data?.sessionId) state.sessionId = String(data.sessionId);
        if (Array.isArray(data?.cards) && data.cards.length) state.cards = data.cards;
      } catch (error) {
        state.messages.push({
          role: 'assistant',
          text: `Network error: ${error?.message || 'Request failed'}`
        });
      } finally {
        state.sending = false;
        render();
      }
    });
  };

  const loadInitialCards = async () => {
    try {
      const url = new URL(`${cardsBaseUrl}/search`);
      url.searchParams.set('limit', '20');
      const response = await fetch(url.toString());
      const data = await response.json().catch(() => ({}));
      if (Array.isArray(data?.cards)) {
        state.cards = data.cards;
      }
    } catch {}
  };

  loadInitialCards().finally(render);
}
