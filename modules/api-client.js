// ========================================
// 📁 modules/api-client.js (DB + Cards API)
// ========================================
import { log as logTelemetry, EventTypes as TelemetryEventTypes } from './telemetryClient.js';

export class APIClient {
  constructor(widget) {
    this.widget = widget;
    this.apiUrl = widget.apiUrl;
    this.fieldName = widget.fieldName;   // оставлено для совместимости, но ключ файла — всегда 'audio'
    this.responseField = widget.responseField;

    // --- Cards state (infra for future "brain") ---
    this.lastProposedCards = [];     // последние предложенные карточки (объекты)
    this.lastShownCardId = null;     // последняя реально показанная карточка (id)
    this.lastSelectionSnapshot = null; // последняя актуальная подборка (для action system-event)
    this._lastHandledActionEventId = null;
    this._lastHandledSelectionVersion = null;
    this._lastInsightsHash = null;
  }

  t(key, params = null) {
    if (this.widget && typeof this.widget.t === 'function') {
      return this.widget.t(key, params);
    }
    return '';
  }

  get disableServerUI() {
    try {
      const v = localStorage.getItem('vw_disableServerUI');
      return v === '1' || v === 'true';
    } catch { return false; }
  }

  _getUiLang() {
    try {
      return String(this.widget?.getLangCode?.() || 'ru').toLowerCase();
    } catch {
      return 'ru';
    }
  }

  _prepareSystemSelectionEvent(data = {}) {
    try {
      const explicit = data?.ui?.systemEvent;
      if (explicit && typeof explicit === 'object') {
        return { explicit };
      }

      const matchedCount = data?.queryTraceV1 && Number.isFinite(data.queryTraceV1.matchedCount)
        ? data.queryTraceV1.matchedCount
        : null;
      if (matchedCount === null) return null;
      const postQuery = data?.queryTraceV1?.postValidationQuery || null;
      const queryTrace = data?.queryTraceV1 || null;
      const cards = Array.isArray(data?.cards) ? data.cards : [];
      const selectionVersion = this._buildSelectionVersion(postQuery, matchedCount);
      const eventId = `sel_${selectionVersion}`;
      this.lastSelectionSnapshot = {
        selectionVersion,
        eventId,
        matchedCount,
        postQuery,
        queryTrace,
        cards
      };

      const locationFallbackMessage = typeof data?.queryTraceV1?.relaxed?.locationFallbackMessage === 'string'
        ? data.queryTraceV1.relaxed.locationFallbackMessage.trim()
        : '';
      const prefaceInfo = locationFallbackMessage
        ? { type: 'info', text: locationFallbackMessage }
        : null;

      if (matchedCount > 0) {
        const txt = this.t('systemMatchesFound', { count: matchedCount }) || `Подборка обновлена · найдено ${matchedCount} объектов`;
        return {
          prefaceInfo,
          info: {
            type: 'info',
            text: txt
          },
          action: {
            type: 'action',
            text: this.t('systemOpenSelection') || 'Смотреть подборку',
            action: 'open_results',
            payload: {
              eventId,
              selectionVersion,
              count: matchedCount,
              autofocusFirst: true
            }
          }
        };
      }
      const txt = this.t('systemNoMatches') || 'Подборка обновлена · точных совпадений нет';
      return {
        prefaceInfo,
        info: {
          type: 'info',
          text: txt
        },
        action: null
      };
    } catch {
      return null;
    }
  }

  _emitSystemSelectionInfo(bundle) {
    try {
      if (!bundle) return;
      if (bundle.explicit) {
        this.widget.ui?.addSystemEventMessage?.(bundle.explicit);
        return;
      }
      if (bundle.prefaceInfo) this.widget.ui?.addSystemEventMessage?.(bundle.prefaceInfo);
      if (bundle.info) this.widget.ui?.addSystemEventMessage?.(bundle.info);
    } catch {}
  }

  _emitSystemSelectionAction(bundle) {
    try {
      if (!bundle || bundle.explicit) return;
      if (bundle.action) this.widget.ui?.addSystemEventMessage?.(bundle.action);
    } catch {}
  }

  _emitSystemSelectionEvent(data = {}) {
    const bundle = this._prepareSystemSelectionEvent(data);
    this._emitSystemSelectionInfo(bundle);
    this._emitSystemSelectionAction(bundle);
  }

  _hashInsights(insights) {
    try {
      if (!insights || typeof insights !== 'object') return 'null';
      const ordered = {};
      Object.keys(insights).sort().forEach((k) => { ordered[k] = insights[k]; });
      return JSON.stringify(ordered);
    } catch {
      return String(Date.now());
    }
  }

  _didInsightsChange(data = {}) {
    try {
      const current = this._hashInsights(data?.insights || null);
      if (this._lastInsightsHash === null) {
        this._lastInsightsHash = current;
        return true;
      }
      const changed = this._lastInsightsHash !== current;
      this._lastInsightsHash = current;
      return changed;
    } catch {
      return true;
    }
  }

  _prepareManagerActionEvent(data = {}, { userText = '', insightsChanged = true, hasSelectionAction = false } = {}) {
    try {
      if (!data || typeof data !== 'object') return null;
      if (data?.ui?.systemEvent) return null;
      if (insightsChanged === true) return null;
      if (hasSelectionAction === true) return null;

      const text = String(userText || '').trim();
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      const hasManagerKeyword = this._hasManagerIntentKeyword(text);
      if (!hasManagerKeyword && (text.length < 10 || words < 2)) return null;

      const infoText = this.t('systemManagerHint') || 'Вопрос вне подбора · можно уточнить у менеджера';
      const actionText = this.t('systemContactManager') || 'Связаться с менеджером';
      const eventId = `mgr_${Date.now()}`;

      return {
        info: { type: 'info', text: infoText },
        action: {
          type: 'action',
          text: actionText,
          action: 'open_manager',
          payload: { eventId }
        }
      };
    } catch {
      return null;
    }
  }

  _hasManagerIntentKeyword(text = '') {
    try {
      const s = String(text || '').toLowerCase().trim();
      if (!s) return false;
      const patterns = [
        // RU
        /\bменедж\w*\b/i,
        /\bсвяза\w*\b/i,
        /\bзаявк\w*\b/i,
        /\bипотек\w*\b/i,
        /\bрассроч\w*\b/i,
        /\bкредит\w*\b/i,
        /\bпросмотр\w*\b/i,
        /\bпоказ\w*\b/i,
        /\bпозвон\w*\b/i,
        /\bперезвон\w*\b/i,
        /\bконтакт\w*\b/i,
        // EN
        /\bmanager\b/i,
        /\bcontact\b/i,
        /\bcallback\b/i,
        /\bmortgage\b/i,
        /\binstallment\b/i,
        /\bloan\b/i,
        /\bviewing\b/i,
        /\bappointment\b/i,
        // ES
        /\bgerente\b/i,
        /\bcontactar\b/i,
        /\bhipoteca\b/i,
        /\bcuotas?\b/i,
        /\bcredito\b/i,
        /\bvisita\b/i,
        /\bcita\b/i
      ];
      return patterns.some((re) => re.test(s));
    } catch {
      return false;
    }
  }

  _buildSelectionVersion(postQuery, matchedCount) {
    try {
      const src = JSON.stringify({ postQuery: postQuery || null, matchedCount: Number(matchedCount) || 0 });
      let h = 2166136261;
      for (let i = 0; i < src.length; i++) {
        h ^= src.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return `v_${(h >>> 0).toString(16)}`;
    } catch {
      return `v_${Date.now()}`;
    }
  }

  async handleSystemEventAction({ action, payload } = {}) {
    if (action === 'open_manager') {
      try {
        this.widget?.showScreen?.('request');
        return true;
      } catch {
        return false;
      }
    }
    if (action !== 'open_results') return false;
    const eventId = payload?.eventId || null;
    const selectionVersion = payload?.selectionVersion || null;
    if (eventId && this._lastHandledActionEventId === eventId) return true;
    if (!eventId && selectionVersion && this._lastHandledSelectionVersion === selectionVersion) return true;
    const ok = await this.openLatestResults({ autofocusFirst: payload?.autofocusFirst !== false });
    if (ok) {
      this._lastHandledActionEventId = eventId || this._lastHandledActionEventId;
      this._lastHandledSelectionVersion = selectionVersion || this._lastHandledSelectionVersion;
    }
    return ok;
  }

  async openLatestResults({ autofocusFirst = true } = {}) {
    try {
      const snapshot = this.lastSelectionSnapshot || null;
      const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : this.lastProposedCards;
      if (Array.isArray(cards) && cards.length) {
        const first = cards[0];
        if (!first) return false;
        this.widget._lastSuggestedCard = first;
        try { this.widget.resetCardsSliderHost?.(); } catch {}
        this.widget.showMockCardWithActions(first);
        this.widget.scrollCardHostIntoView?.();
        if (autofocusFirst && first?.id) {
          try { await this.sendCardInteraction('show', String(first.id)); } catch {}
        }
        return true;
      }

      // Если локальных карточек нет — запросим первый вариант у сервера.
      const interactionUrl = this.apiUrl.replace('/upload', '/interaction');
      const response = await fetch(interactionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'show',
          sessionId: this.widget.sessionId || '',
          lang: this._getUiLang()
        })
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      try { this.widget.storeLastApiPayload?.(data, { source: 'api/audio/interaction', requestType: 'interaction_show' }); } catch {}
      if (data && data.card) {
        try { this.widget.resetCardsSliderHost?.(); } catch {}
        this.widget.showMockCardWithActions(data.card);
        this.widget.scrollCardHostIntoView?.();
        this._rememberShown(data.card.id || null);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('openLatestResults failed:', e);
      return false;
    }
  }

  // ---------- Cards API helpers ----------
  _deriveCardsBaseUrl() {
    // this.apiUrl обычно: https://.../api/audio/upload
    // cards base:          https://.../api/cards
    try {
      const u = new URL(String(this.apiUrl));
      u.pathname = u.pathname.replace(/\/api\/audio\/upload\/?$/i, '/api/cards');
      return u.toString().replace(/\/$/, '');
    } catch {
      return String(this.apiUrl)
        .replace(/\/api\/audio\/upload\/?$/i, '/api/cards')
        .replace(/\/$/, '');
    }
  }

  async fetchCardsSearch(params = {}) {
    const base = this._deriveCardsBaseUrl();
    const url = new URL(base + '/search');
    url.searchParams.set('lang', this._getUiLang());

    const allowed = ['city', 'district', 'rooms', 'type', 'minPrice', 'maxPrice', 'limit'];
    for (const k of allowed) {
      const v = params[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Cards search failed: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.cards) ? data.cards : [];
  }

  async fetchCardById(id) {
    const base = this._deriveCardsBaseUrl();
    const url = new URL(`${base}/${encodeURIComponent(id)}`);
    url.searchParams.set('lang', this._getUiLang());
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Card fetch failed: ${res.status}`);
    return await res.json().catch(() => null);
  }

  _rememberProposed(cards) {
    if (Array.isArray(cards)) this.lastProposedCards = cards;
  }

  _rememberShown(cardId) {
    if (!cardId) return;
    this.lastShownCardId = String(cardId);
  }

  _notifyShownToServer(cardId) {
    // show = факт видимости. Отправляем чуть позже, чтобы UI успел отрисовать.
    if (!cardId) return;
    try {
      setTimeout(() => {
        try { this.sendCardInteraction('show', cardId); } catch {}
      }, 0);
    } catch {}
  }

  // ---------- Hidden commands parsing ----------
  extractHiddenCommands(rawText = '') {
    if (!rawText) return { cleaned: '', commands: [] };
    let cleaned = String(rawText);
    const commands = [];

    // triple-backtick JSON blocks
    const codeBlockRe = /```json\s*([\s\S]*?)```/gi;
    cleaned = cleaned.replace(codeBlockRe, (m, body) => {
      try {
        const obj = JSON.parse(body.trim());
        if (obj && obj.vw_cmd) commands.push(obj);
      } catch {}
      return '';
    });

    // <CMD> ... </CMD> blocks with JSON
    const tagRe = /<CMD>([\s\S]*?)<\/CMD>/gi;
    cleaned = cleaned.replace(tagRe, (m, body) => {
      try {
        const obj = JSON.parse(body.trim());
        if (obj && obj.vw_cmd) commands.push(obj);
      } catch {}
      return '';
    });

    // Trim extra whitespace left by removals
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return { cleaned, commands };
  }

  async dispatchHiddenCommand(cmd) {
    if (!cmd || !cmd.vw_cmd) return;
    const name = String(cmd.vw_cmd);
    const args = cmd.args || {};

    try {
      switch (name) {
        case 'cards.list':
        case 'cards.search_wider': {
          // 🆕 Sprint I: client-driven путь изолирован — карточки не показываются
          // Оставляем только сохранение для совместимости, но без визуального показа
          // Показ карточек возможен только через server response.cards[]
          const cards = await this.fetchCardsSearch(args);
          this._rememberProposed(cards);

          if (!cards.length) {
            this.widget.ui?.showNotification?.('Карточки не найдены');
            return;
          }

          // ⚠️ Изолировано: визуальный показ карточек удалён из client-driven пути
          // Карточки могут быть показаны только через server response.cards[]
          break;
        }

        case 'cards.show':
        case 'cards.more_like_this': {
          // 🆕 Sprint I: client-driven путь изолирован — карточки не показываются
          // Оставляем только сохранение для совместимости, но без визуального показа
          // Показ карточек возможен только через server response.cards[]
          const id = args.id || args.external_id || args.property_id || null;

          let card = null;

          if (id) {
            card = await this.fetchCardById(id);
          } else if (this.lastProposedCards.length) {
            // если ID не передали — берём первую из предложенных
            card = this.lastProposedCards[0];
          }

          if (!card) {
            this.widget.ui?.showNotification?.('Карточка не найдена');
            return;
          }

          const cardId = card.id || card.external_id || null;

          // ⚠️ Изолировано: визуальный показ карточек удалён из client-driven пути
          // Карточки могут быть показаны только через server response.cards[]
          // Сохраняем для совместимости, но не показываем визуально
          this._rememberShown(cardId);
          // Уведомление сервера о показе также изолировано (не вызывается без server-driven показа)

          break;
        }

        default:
          // неизвестные команды игнорируем
          break;
      }
    } catch (e) {
      console.warn('Hidden command error:', e);
      this.widget.ui?.showNotification?.(this.t('processingCardsError'));
    }
  }

  // Загрузка информации о сессии (только если sessionId есть)
  async loadSessionInfo() {
    if (!this.widget.sessionId) return { exists: null, expired: false };
    try {
      const sid = this.widget.sessionId;
      const sessionUrl = this.apiUrl.replace('/upload', `/session/${this.widget.sessionId}`);
      const response = await fetch(sessionUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.insights) {
          const migrated = this.widget.understanding.migrateInsights(data.insights);
          this.widget.understanding.update(migrated);
          console.log('📥 Загружены данные сессии:', data);
        }
        return { exists: true, expired: false };
      }
      // Сессия удалена на сервере (TTL/manual clear): очищаем локальный thread и sid
      if (response.status === 404) {
        try { localStorage.removeItem(`vw_thread_${sid}`); } catch {}
        try { this.widget.ui?._setSessionIdAndDisplay?.(null); } catch {}
        return { exists: false, expired: true };
      }
    } catch {
      console.log('ℹ️ Сессии на сервере нет или CORS — игнорируем');
    }
    return { exists: null, expired: false };
  }

  // ---------- Текст ----------
  async sendTextMessage() {
    const textInput = this.widget.shadowRoot.getElementById('textInput');
    const sendButton = this.widget.shadowRoot.getElementById('sendButton');
    const messageText = textInput?.value?.trim();
    if (!messageText) return;

    textInput.value = '';
    if (sendButton) { sendButton.disabled = true; sendButton.classList.remove('active'); }

    const userMessage = { type: 'user', content: messageText, timestamp: new Date() };
    this.widget.ui.addMessage(userMessage);
    this.widget.ui.showLoading();

    // Логируем user_message перед отправкой
    logTelemetry(TelemetryEventTypes.USER_MESSAGE, {
      inputType: 'text',
      text: messageText,
      textLength: messageText.length
    });

    try {
      const fd = new FormData();
      fd.append('text', messageText);
      fd.append('sessionId', this.widget.sessionId || '');

      const replyLang = this.widget.getLangCode();
      fd.append('lang', replyLang);
      const speechLang = localStorage.getItem('vw_speechLang');
      if (speechLang && speechLang !== 'auto') fd.append('speechLang', speechLang);

      console.log('📤 Текст →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));
      try { this.widget.storeLastApiPayload?.(data, { source: 'api/audio/upload', requestType: 'text' }); } catch {}
      const selectionEvent = this._prepareSystemSelectionEvent(data);
      const insightsChanged = this._didInsightsChange(data);
      const managerEvent = this._prepareManagerActionEvent(data, {
        userText: messageText,
        insightsChanged,
        hasSelectionAction: !!selectionEvent?.action
      });

      // ✅ если сервер выдал sessionId — подхватываем и показываем
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      console.log('📥 Ответ на текст:', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui, role: data.role
      });

      this.widget.ui.hideLoading();
      this.widget.ui.updateMessageCount();

      if (data.insights) this.widget.understanding.update(data.insights);
      this._emitSystemSelectionInfo(selectionEvent);
      this._emitSystemSelectionInfo(managerEvent);

      const assistantRaw = data[this.responseField] || this.t('responseMissing');
      const parsed = this.extractHiddenCommands(assistantRaw);
      const assistantMessage = {
        type: 'assistant',
        content: parsed.cleaned || this.t('responseMissing'),
        timestamp: new Date()
      };
      this.widget.ui.addMessage(assistantMessage);
      this._emitSystemSelectionAction(selectionEvent);
      this._emitSystemSelectionAction(managerEvent);
      // Dispatch hidden commands (after showing text)
      for (const c of parsed.commands) await this.dispatchHiddenCommand(c);

      // RMv3 / Sprint 4 / Task 4.4: demo-only словесный выбор объекта
      // Сервер отдаёт ui.autoSelectCardId; фронт запускает тот же путь, что и кнопка "Выбрать"
      // (sendCardInteraction('select', id) → /interaction select → handoff UX).
      try {
        const autoId = data?.ui?.autoSelectCardId || null;
        if (autoId) {
          await this.sendCardInteraction('select', String(autoId));
        }
      } catch {}

      // 🃏 карточки по предложению (после текста агента) — legacy flow
      try {
        if (!this.disableServerUI && Array.isArray(data.cards) && data.cards.length) {
          this._rememberProposed(data.cards);
          this.widget.suggestCardOption(data.cards[0]);
        }
      } catch (e) { console.warn('Cards handling error:', e); }

    } catch (error) {
      this.widget.ui.hideLoading();
      console.error('Ошибка при отправке текста:', error);
      this.widget.ui.addMessage({
        type: 'assistant',
        content: this.t('sendTextError'),
        timestamp: new Date()
      });
    } finally {
      if (sendButton) sendButton.disabled = false;
    }

    this.widget.events.emit('textMessageSent', { text: messageText });
  }

  // Send text message from main screen (reuses existing flow)
  async sendTextMessageFromText(messageText) {
    if (!messageText) return;

    this.widget.ui.showLoading();

    // Логируем user_message перед отправкой
    logTelemetry(TelemetryEventTypes.USER_MESSAGE, {
      inputType: 'text',
      text: messageText,
      textLength: messageText.length
    });

    try {
      const fd = new FormData();
      fd.append('text', messageText);
      fd.append('sessionId', this.widget.sessionId || '');

      const replyLang = this.widget.getLangCode();
      fd.append('lang', replyLang);
      const speechLang = localStorage.getItem('vw_speechLang');
      if (speechLang && speechLang !== 'auto') fd.append('speechLang', speechLang);

      console.log('📤 Текст (main) →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));
      try { this.widget.storeLastApiPayload?.(data, { source: 'api/audio/upload', requestType: 'text_main' }); } catch {}
      const selectionEvent = this._prepareSystemSelectionEvent(data);
      const insightsChanged = this._didInsightsChange(data);
      const managerEvent = this._prepareManagerActionEvent(data, {
        userText: messageText,
        insightsChanged,
        hasSelectionAction: !!selectionEvent?.action
      });

      // ✅ если сервер выдал sessionId — подхватываем и показываем
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      console.log('📥 Ответ на текст (main):', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui, role: data.role
      });

      this.widget.ui.hideLoading();
      this.widget.ui.updateMessageCount();

      if (data.insights) this.widget.understanding.update(data.insights);
      this._emitSystemSelectionInfo(selectionEvent);
      this._emitSystemSelectionInfo(managerEvent);

      const assistantRaw = data[this.responseField] || this.t('responseMissing');
      const parsed = this.extractHiddenCommands(assistantRaw);
      const assistantMessage = {
        type: 'assistant',
        content: parsed.cleaned || this.t('responseMissing'),
        timestamp: new Date()
      };
      this.widget.ui.addMessage(assistantMessage);
      this._emitSystemSelectionAction(selectionEvent);
      this._emitSystemSelectionAction(managerEvent);
      
      // Логируем assistant_reply после получения ответа (main screen)
      const cardsForLog = Array.isArray(data.cards) && data.cards.length > 0
        ? data.cards.map(card => ({
            id: card.id,
            city: card.city || null,
            district: card.district || null,
            priceEUR: card.priceEUR || null,
            rooms: card.rooms || null
          }))
        : [];
      
      logTelemetry(TelemetryEventTypes.ASSISTANT_REPLY, {
        messageText: parsed.cleaned ? parsed.cleaned.substring(0, 200) : null,
        hasCards: data.cards && data.cards.length > 0,
        cards: cardsForLog,
        insights: data.insights || null
      });
      
      for (const c of parsed.commands) await this.dispatchHiddenCommand(c);

      // RMv3 / Sprint 4 / Task 4.4: demo-only словесный выбор объекта (main)
      try {
        const autoId = data?.ui?.autoSelectCardId || null;
        if (autoId) {
          await this.sendCardInteraction('select', String(autoId));
        }
      } catch {}

      // 🃏 карточки по предложению (main) — после текста агента (legacy flow)
      try {
        if (!this.disableServerUI && Array.isArray(data.cards) && data.cards.length) {
          this._rememberProposed(data.cards);
          this.widget.suggestCardOption(data.cards[0]);
        }
      } catch (e) { console.warn('Cards handling error (main):', e); }

    } catch (error) {
      this.widget.ui.hideLoading();
      console.error('Ошибка при отправке текста (main):', error);
      this.widget.ui.addMessage({
        type: 'assistant',
        content: this.t('sendTextError'),
        timestamp: new Date()
      });
    }

    this.widget.events.emit('textMessageSent', { text: messageText });
  }

  // ---------- Аудио ----------
  async sendMessage() {
    if (!this.widget.audioRecorder.audioBlob) {
      console.error('Нет аудио для отправки');
      return;
    }

    if (this.widget.audioRecorder.recordingTime < this.widget.audioRecorder.minRecordingTime) {
      this.widget.ui.showNotification(this.t('shortRecording'));
      return;
    }

    const userMessage = {
      type: 'user',
      content: this.t('voiceMessageLabel', { seconds: this.widget.audioRecorder.recordingTime }),
      timestamp: new Date()
    };
    this.widget.ui.addMessage(userMessage);
    this.widget.ui.showLoading();

    // Логируем user_message перед отправкой аудио
    logTelemetry(TelemetryEventTypes.USER_MESSAGE, {
      inputType: 'audio',
      audioDurationMs: this.widget.audioRecorder.recordingTime * 1000
    });

    try {
      const fd = new FormData();

      // ✅ ключ строго 'audio' (совместимость с бэком)
      const blob = this.widget.audioRecorder.audioBlob;
      const fname = (blob?.type || '').includes('wav') ? 'voice-message.wav' : 'voice-message.webm';
      fd.append('audio', blob, fname);

      fd.append('sessionId', this.widget.sessionId || '');

      const replyLang = this.widget.getLangCode();
      fd.append('lang', replyLang);
      const speechLang = localStorage.getItem('vw_speechLang');
      if (speechLang && speechLang !== 'auto') fd.append('speechLang', speechLang);

      if (this.fieldName && this.fieldName !== 'audio') {
        console.warn(`[VW] fieldName='${this.fieldName}' игнорируется — используем 'audio'`);
      }

      console.log('📤 Аудио →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json().catch(() => ({}));
      try { this.widget.storeLastApiPayload?.(data, { source: 'api/audio/upload', requestType: 'audio' }); } catch {}
      const selectionEvent = this._prepareSystemSelectionEvent(data);
      const insightsChanged = this._didInsightsChange(data);
      const managerEvent = this._prepareManagerActionEvent(data, {
        userText: data?.transcription || '',
        insightsChanged,
        hasSelectionAction: !!selectionEvent?.action
      });

      // ✅ подхватываем новую sessionId с сервера
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      console.log('📥 Ответ на аудио:', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui, role: data.role
      });

      this.widget.ui.hideLoading();
      this.widget.ui.updateMessageCount();

      // обновляем транскрипцию в последнем пользовательском сообщении
      if (data.transcription) {
        const lastUserMessage = this.widget.messages[this.widget.messages.length - 1];
        if (lastUserMessage && lastUserMessage.type === 'user') {
          lastUserMessage.content = data.transcription;
          const userMsgs = this.widget.shadowRoot.querySelectorAll('.message.user');
          const el = userMsgs[userMsgs.length - 1];
          if (el) {
            const bubble = el.querySelector('.message-bubble');
            if (bubble) bubble.textContent = data.transcription;
          }
        }
      }

      if (data.insights) this.widget.understanding.update(data.insights);
      this._emitSystemSelectionInfo(selectionEvent);
      this._emitSystemSelectionInfo(managerEvent);

      const assistantRaw = data[this.responseField] || this.t('responseMissing');
      const parsed = this.extractHiddenCommands(assistantRaw);

      const assistantMessage = {
        type: 'assistant',
        content: parsed.cleaned || this.t('responseMissing'),
        timestamp: new Date()
      };
      this.widget.ui.addMessage(assistantMessage);
      this._emitSystemSelectionAction(selectionEvent);
      this._emitSystemSelectionAction(managerEvent);
      
      // Логируем assistant_reply после получения ответа (аудио)
      const cardsForLog = Array.isArray(data.cards) && data.cards.length > 0
        ? data.cards.map(card => ({
            id: card.id,
            city: card.city || null,
            district: card.district || null,
            priceEUR: card.priceEUR || null,
            rooms: card.rooms || null
          }))
        : [];
      
      logTelemetry(TelemetryEventTypes.ASSISTANT_REPLY, {
        messageText: parsed.cleaned ? parsed.cleaned.substring(0, 200) : null,
        hasCards: data.cards && data.cards.length > 0,
        cards: cardsForLog,
        insights: data.insights || null
      });

      // Dispatch hidden commands after showing text
      for (const c of parsed.commands) await this.dispatchHiddenCommand(c);

      // RMv3 / Sprint 4 / Task 4.4: demo-only словесный выбор объекта (audio)
      try {
        const autoId = data?.ui?.autoSelectCardId || null;
        if (autoId) {
          await this.sendCardInteraction('select', String(autoId));
        }
      } catch {}

      // 🃏 карточки по предложению (audio) — legacy flow
      try {
        if (Array.isArray(data.cards) && data.cards.length) {
          this._rememberProposed(data.cards);
          this.widget.suggestCardOption(data.cards[0]);
        }
      } catch (e) { console.warn('Cards handling error (audio):', e); }

      this.widget.cleanupAfterSend();

    } catch (error) {
      this.widget.ui.hideLoading();
      console.error('Ошибка при отправке аудио:', error);
      this.widget.ui.addMessage({
        type: 'assistant',
        content: this.t('sendTextError'),
        timestamp: new Date()
      });
    }

    this.widget.events.emit('messageSent', { duration: this.widget.audioRecorder.recordingTime });
  }

  // 🆕 Sprint I: подтверждение факта рендера карточки в UI
  async sendCardRendered(cardId) {
    if (!cardId || !this.widget.sessionId) return;
    
    try {
      const interactionUrl = this.apiUrl.replace('/upload', '/interaction');
      const response = await fetch(interactionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ui_card_rendered',
          variantId: cardId,
          sessionId: this.widget.sessionId,
          lang: this._getUiLang()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Card rendered confirmation sent:', { cardId, response: data });
      } else {
        console.warn('Failed to send card rendered confirmation:', response.status);
      }
    } catch (error) {
      console.warn('Error sending card rendered confirmation:', error);
    }
  }

  // 🆕 Sprint IV: отправка события ui_slider_started
  async sendSliderStarted() {
    if (!this.widget.sessionId) return;
    
    try {
      const interactionUrl = this.apiUrl.replace('/upload', '/interaction');
      const response = await fetch(interactionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ui_slider_started',
          sessionId: this.widget.sessionId,
          lang: this._getUiLang()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Slider started confirmation sent:', { response: data });
      } else {
        console.warn('Failed to send slider started confirmation:', response.status);
      }
    } catch (error) {
      console.warn('Error sending slider started confirmation:', error);
    }
  }

  // 🆕 Sprint IV: отправка события ui_slider_ended
  async sendSliderEnded() {
    if (!this.widget.sessionId) return;
    
    try {
      const interactionUrl = this.apiUrl.replace('/upload', '/interaction');
      const response = await fetch(interactionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ui_slider_ended',
          sessionId: this.widget.sessionId,
          lang: this._getUiLang()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Slider ended confirmation sent:', { response: data });
      } else {
        console.warn('Failed to send slider ended confirmation:', response.status);
      }
    } catch (error) {
      console.warn('Error sending slider ended confirmation:', error);
    }
  }

  // 🆕 Sprint IV: отправка события ui_focus_changed
  async sendFocusChanged(cardId) {
    if (!this.widget.sessionId || !cardId) return;
    
    try {
      const interactionUrl = this.apiUrl.replace('/upload', '/interaction');
      const response = await fetch(interactionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ui_focus_changed',
          cardId: cardId,
          sessionId: this.widget.sessionId,
          lang: this._getUiLang()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Focus changed confirmation sent:', { cardId, response: data });
      } else {
        console.warn('Failed to send focus changed confirmation:', response.status);
      }
    } catch (error) {
      console.warn('Error sending focus changed confirmation:', error);
    }
  }

  // ---------- Card Interactions ----------
  async sendCardInteraction(action, variantId) {
    // Для 'show' допустимо отсутствие variantId — сервер выберет кандидат по сессии
    if (!variantId && action !== 'show') {
      console.warn('No variant ID provided for card interaction');
      return;
    }

    try {
      const interactionUrl = this.apiUrl.replace('/upload', '/interaction');
      const response = await fetch(interactionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action, // 'like' or 'next' or 'show'
          variantId: variantId,
          sessionId: this.widget.sessionId || '',
          lang: this._getUiLang()
        })
      });

      if (response.ok) {
        const data = await response.json();
        try { this.widget.storeLastApiPayload?.(data, { source: 'api/audio/interaction', requestType: `interaction_${action}` }); } catch {}
        this._emitSystemSelectionEvent(data);
        console.log('📤 Card interaction sent:', { action, variantId, response: data });

        // Для первого показа карточки ('show') карточку уже отрисовали локально,
        // с бэка берём только текст-подпись. Для остальных действий — рендерим карточку.
        if (action !== 'show') {
          if (data && data.card) {
            try { this.widget.showMockCardWithActions(data.card); } catch (e) { console.warn('show card error:', e); }
          }
        }

        // Emit event for successful interaction
        this.widget.events.emit('cardInteractionSent', { action, variantId, data });
      } else {
        console.error('Failed to send card interaction:', response.status);
        this.widget.events.emit('cardInteractionSent', { action, variantId, error: true, status: response.status });
      }
    } catch (error) {
      console.error('Error sending card interaction:', error);
      this.widget.events.emit('cardInteractionSent', { action, variantId, error: true, exception: true });
    }
  }
}
