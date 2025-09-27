// ========================================
// 📁 modules/api-client.js (ФИНАЛ)
// ========================================

export class APIClient {
  constructor(widget) {
    this.widget = widget;
    this.apiUrl = widget.apiUrl;
    this.fieldName = widget.fieldName;   // оставлено для совместимости, но ключ файла — всегда 'audio'
    this.responseField = widget.responseField;
  }
  get disableServerUI() {
    try {
      const v = localStorage.getItem('vw_disableServerUI');
      return v === '1' || v === 'true';
    } catch { return false; }
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
        case 'form.contact': {
          // Open main lead panel
          this.widget.openLeadPanel?.();
          break;
        }
        case 'form.schedule_view':
        case 'form.call_time': {
          // Start inline flow at time selection (step A)
          if (!this.widget.inlineLeadState.step) this.widget.inlineLeadState.step = 'A';
          if (args && args.time_window) {
            this.widget.inlineLeadState.data = this.widget.inlineLeadState.data || {};
            this.widget.inlineLeadState.data.time_window = args.time_window;
          }
          this.widget.renderInlineLeadStep?.();
          break;
        }
        case 'cards.list':
        case 'cards.show':
        case 'cards.more_like_this':
        case 'cards.search_wider': {
          // TODO: hook into card rendering pipeline (skeleton)
          this.widget.ui?.showNotification?.('Команда карт получена (скоро будет реализовано)');
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.warn('Hidden command error:', e);
    }
  }

  // Загрузка информации о сессии (только если sessionId есть)
  async loadSessionInfo() {
    if (!this.widget.sessionId) return;
    try {
      const sessionUrl = this.apiUrl.replace('/upload', `/session/${this.widget.sessionId}`);
      const response = await fetch(sessionUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.insights) {
          const migrated = this.widget.understanding.migrateInsights(data.insights);
          this.widget.understanding.update(migrated);
          console.log('📥 Загружены данные сессии:', data);
        }
      }
    } catch {
      console.log('ℹ️ Сессии на сервере нет или CORS — игнорируем');
    }
  }

  // ---------- Текст ----------
  async sendTextMessage() {
    const textInput = this.widget.shadowRoot.getElementById('textInput');
    const sendButton = this.widget.shadowRoot.getElementById('sendButton');
    const messageText = textInput?.value?.trim();
    if (!messageText) return;

    textInput.value = '';
    if (sendButton) { sendButton.disabled = true; sendButton.classList.remove('active'); }
    this.widget.ui.showLoading();

    const userMessage = { type: 'user', content: messageText, timestamp: new Date() };
    this.widget.ui.addMessage(userMessage);

    try {
      const fd = new FormData();
      fd.append('text', messageText);
      fd.append('sessionId', this.widget.sessionId || '');

      const replyLang = localStorage.getItem('vw_lang') || 'ru';
      fd.append('lang', replyLang);
      const speechLang = localStorage.getItem('vw_speechLang');
      if (speechLang && speechLang !== 'auto') fd.append('speechLang', speechLang);

      console.log('📤 Текст →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));

      // ✅ если сервер выдал sessionId — подхватываем и показываем
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      console.log('📥 Ответ на текст:', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui
      });

      this.widget.ui.hideLoading();
      this.widget.ui.updateMessageCount();

      if (data.insights) this.widget.understanding.update(data.insights);

      const assistantRaw = data[this.responseField] || 'Ответ не получен от сервера.';
      const parsed = this.extractHiddenCommands(assistantRaw);
      const assistantMessage = { type: 'assistant', content: parsed.cleaned, timestamp: new Date() };
      if (assistantMessage.content) this.widget.ui.addMessage(assistantMessage);
      // Dispatch hidden commands (after showing text)
      for (const c of parsed.commands) await this.dispatchHiddenCommand(c);

      // 🃏 карточки по предложению (после текста агента)
      try {
        if (!this.disableServerUI && Array.isArray(data.cards) && data.cards.length) {
          this.widget.suggestCardOption(data.cards[0]);
        }
        // Inline lead-flow: build target step once and render once (avoid duplicates)
        if (!this.disableServerUI && data.ui && data.ui.inlineLead) {
          const il = data.ui.inlineLead;
          try {
            if (!this.widget.inlineLeadState.step && (il.startFlow || il.timeFound || il.contactFound)) {
              this.widget.inlineLeadState.step = 'A';
            }
            if (il.timeFound && il.time_window) {
              this.widget.inlineLeadState.data.time_window = il.time_window;
              if (!this.widget.inlineLeadState.step || this.widget.inlineLeadState.step === 'A') this.widget.inlineLeadState.step = 'B';
            }
            if (il.contactFound && il.contact) {
              this.widget.inlineLeadState.data.contact = il.contact;
              this.widget.inlineLeadState.step = 'D';
            }
            if (this.widget.inlineLeadState.step) {
              this.widget.renderInlineLeadStep();
            }
          } catch (e) { console.warn('Inline flow fast-forward error:', e); }
        }
      } catch (e) { console.warn('Cards handling error:', e); }

    } catch (error) {
      this.widget.ui.hideLoading();
      console.error('Ошибка при отправке текста:', error);
      this.widget.ui.addMessage({
        type: 'assistant',
        content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
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

    try {
      const fd = new FormData();
      fd.append('text', messageText);
      fd.append('sessionId', this.widget.sessionId || '');

      const replyLang = localStorage.getItem('vw_lang') || 'ru';
      fd.append('lang', replyLang);
      const speechLang = localStorage.getItem('vw_speechLang');
      if (speechLang && speechLang !== 'auto') fd.append('speechLang', speechLang);

      console.log('📤 Текст (main) →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));

      // ✅ если сервер выдал sessionId — подхватываем и показываем
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      console.log('📥 Ответ на текст (main):', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui
      });

      this.widget.ui.hideLoading();
      this.widget.ui.updateMessageCount();

      if (data.insights) this.widget.understanding.update(data.insights);

      const assistantRaw = data[this.responseField] || 'Ответ не получен от сервера.';
      const parsed = this.extractHiddenCommands(assistantRaw);
      const assistantMessage = { type: 'assistant', content: parsed.cleaned, timestamp: new Date() };
      if (assistantMessage.content) this.widget.ui.addMessage(assistantMessage);
      for (const c of parsed.commands) await this.dispatchHiddenCommand(c);

      // 🃏 карточки по предложению (main) — после текста агента
      try {
        if (!this.disableServerUI && Array.isArray(data.cards) && data.cards.length) {
          this.widget.suggestCardOption(data.cards[0]);
        }
        // Inline lead-flow fast-forward for main screen send (single render)
        if (!this.disableServerUI && data.ui && data.ui.inlineLead) {
          const il = data.ui.inlineLead;
          try {
            if (!this.widget.inlineLeadState.step && (il.startFlow || il.timeFound || il.contactFound)) {
              this.widget.inlineLeadState.step = 'A';
            }
            if (il.timeFound && il.time_window) {
              this.widget.inlineLeadState.data.time_window = il.time_window;
              if (!this.widget.inlineLeadState.step || this.widget.inlineLeadState.step === 'A') this.widget.inlineLeadState.step = 'B';
            }
            if (il.contactFound && il.contact) {
              this.widget.inlineLeadState.data.contact = il.contact;
              this.widget.inlineLeadState.step = 'D';
            }
            if (this.widget.inlineLeadState.step) {
              this.widget.renderInlineLeadStep();
            }
          } catch (e) { console.warn('Inline flow fast-forward (main) error:', e); }
        }
      } catch (e) { console.warn('Cards handling error (main):', e); }

    } catch (error) {
      this.widget.ui.hideLoading();
      console.error('Ошибка при отправке текста (main):', error);
      this.widget.ui.addMessage({
        type: 'assistant',
        content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
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
      this.widget.ui.showNotification('⚠️ Запись слишком короткая');
      return;
    }

    this.widget.ui.showLoading();

    const userMessage = {
      type: 'user',
      content: `Голосовое сообщение (${this.widget.audioRecorder.recordingTime}с)`,
      timestamp: new Date()
    };
    this.widget.ui.addMessage(userMessage);

    try {
      const fd = new FormData();

      // ✅ ключ строго 'audio' (совместимость с бэком)
      const blob = this.widget.audioRecorder.audioBlob;
      const fname = (blob?.type || '').includes('wav') ? 'voice-message.wav' : 'voice-message.webm';
      fd.append('audio', blob, fname);

      fd.append('sessionId', this.widget.sessionId || '');

      const replyLang = localStorage.getItem('vw_lang') || 'ru';
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

      // ✅ подхватываем новую sessionId с сервера
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      console.log('📥 Ответ на аудио:', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui
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
            const bubble = el.querySelector('.bubble'); // ✅ правильный класс
            if (bubble) bubble.textContent = data.transcription;
          }
        }
      }

      if (data.insights) this.widget.understanding.update(data.insights);

      this.widget.ui.addMessage({
        type: 'assistant',
        content: data[this.responseField] || 'Ответ не получен от сервера.',
        timestamp: new Date()
      });

      // 🃏 карточки по предложению (audio) — после текста агента
      try {
        if (Array.isArray(data.cards) && data.cards.length) {
          this.widget.suggestCardOption(data.cards[0]);
        }
      } catch (e) { console.warn('Cards handling error (audio):', e); }

      this.widget.cleanupAfterSend();

    } catch (error) {
      this.widget.ui.hideLoading();
      console.error('Ошибка при отправке аудио:', error);
      this.widget.ui.addMessage({
        type: 'assistant',
        content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
        timestamp: new Date()
      });
    }

    this.widget.events.emit('messageSent', { duration: this.widget.audioRecorder.recordingTime });
  }

  // ---------- Card Interactions ----------
  async sendCardInteraction(action, variantId) {
    if (!variantId) {
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
          action: action, // 'like' or 'next'
          variantId: variantId,
          sessionId: this.widget.sessionId || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📤 Card interaction sent:', { action, variantId, response: data });
        
        // Сначала сообщение ассистента (краткое превью), затем карточка
        if (data && data.assistantMessage) {
          try { this.widget.ui.addMessage({ type:'assistant', content:data.assistantMessage, timestamp: new Date() }); } catch {}
        }
        if (data && data.card) {
          try { this.widget.showMockCardWithActions(data.card); } catch (e) { console.warn('show card error:', e); }
        }
        // Emit event for successful interaction
        this.widget.events.emit('cardInteractionSent', { action, variantId, data });
      } else {
        console.error('Failed to send card interaction:', response.status);
      }
    } catch (error) {
      console.error('Error sending card interaction:', error);
    }
  }
}
