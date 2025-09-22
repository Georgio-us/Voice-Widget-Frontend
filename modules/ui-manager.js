// ========================================
// 📁 modules/ui-manager.js (ФИНАЛ, Reset/Restore)
// ========================================
export class UIManager {
  constructor(widget) {
    this.widget = widget;
    this.shadowRoot = widget.shadowRoot;

    this.inputState = 'idle';
    this.recordingTime = 0;
    this.recordingTimer = null;

    this.isInsightsExpanded = false;
    this.elements = {};
    this.bindToInternalEvents();
  }

  // ---------- init ----------
  initializeUI() {
    this.cacheElements();
    this.setState('main');
    this.isInsightsExpanded = this.widget.classList.contains('expanded');

    const { messagesContainer } = this.elements;
    if (messagesContainer) messagesContainer.style.overflowY = 'hidden';

    this.widget.dialogStarted = false;
    this.widget.understanding?.updateUnderstandingDisplay?.();
    this.loadHistory();
  }

  cacheElements() {
    this.elements = {
      textInput:         this.shadowRoot.getElementById('textInput'),
      sendButton:        this.shadowRoot.getElementById('sendButton'),
      mainButton:        this.shadowRoot.getElementById('mainButton'),

      // Main screen elements
      mainTextInput:     this.shadowRoot.getElementById('mainTextInput'),
      mainToggleButton:  this.shadowRoot.getElementById('mainToggleButton'),
      mainSendButton:    this.shadowRoot.getElementById('mainSendButton'),

      // Chat screen elements
      toggleButton:      this.shadowRoot.getElementById('toggleButton'),

      messagesContainer: this.shadowRoot.getElementById('messagesContainer'),
      thread:            this.shadowRoot.getElementById('thread'),

      // Details screen elements
      progressFill:      this.shadowRoot.getElementById('progressFill'),
      progressText:      this.shadowRoot.getElementById('progressText'),
    };
  }

  // ---------- события / Reset-Restore ----------
  bindToInternalEvents() {
    this.widget.events.on('recordingStarted', () => {
      this.setState('recording');
      // Update send button states after recording starts
      this.widget.updateSendButtonState('main');
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('recordingStopped', () => {
      this.setState('idle');
      // Update send button states after recording stops
      this.widget.updateSendButtonState('main');
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('recordingCancelled', () => {
      this.setState('idle');
      // Update send button states after recording cancels
      this.widget.updateSendButtonState('main');
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('timerUpdated', (t) => this.updateRecordingTimer(t));

    this.widget.events.on('showNotification', (m) => this.showNotification(m));
    this.widget.events.on('textMessageSent', () => {
      const { textInput } = this.elements;
      if (textInput) textInput.value = '';
      this.setState('idle');
    });

    this.widget.events.on('request-reset',   () => this.resetSessionHard());
    this.widget.events.on('request-restore', () => this.restoreSnapshotAndApply());
  }

  // ---------- state machine ----------
  setState(next, data = {}) {
    const prev = this.inputState;
    if (prev === next) return;
    this.inputState = next;
    this.clearState(prev);
    this.applyState(next, data);

    this.widget.events.emit('uiStateChanged', { from: prev, to: next, data, insightsExpanded: this.isInsightsExpanded });
  }

  clearState(state) {
    const { sendButton, textInput, mainToggleButton, mainSendButton, mainTextInput, toggleButton } = this.elements;
    switch (state) {
      case 'recording':
        if (this.recordingTimer) { clearInterval(this.recordingTimer); this.recordingTimer = null; }
        if (textInput) { textInput.disabled = false; textInput.style.opacity = '1'; textInput.placeholder = 'Введите ваш вопрос…'; }
        sendButton?.classList.remove('active');
        toggleButton?.classList.remove('active');
        break;
      case 'main':
        if (mainTextInput) { mainTextInput.disabled = false; mainTextInput.style.opacity = '1'; mainTextInput.placeholder = 'Введите ваш вопрос…'; }
        if (mainToggleButton) { mainToggleButton.disabled = false; mainToggleButton.classList.remove('active'); }
        // Removed mainSendButton disabled state - always keep it enabled
        break;
      default: break;
    }
  }

  applyState(state, data) {
    switch (state) {
      case 'idle':      this.applyIdleState(); break;
      case 'typing':    this.applyTypingState(); break;
      case 'recording': this.applyRecordingState(); break;
      case 'main':      this.applyMainState(); break;
      case 'recorded':  this.applyRecordedState(data); break;
    }
  }

  // IDLE
  applyIdleState() {
    const { textInput, sendButton, toggleButton } = this.elements;
    if (textInput) { textInput.disabled = false; textInput.style.opacity = '1'; textInput.placeholder = 'Введите ваш вопрос…'; }
    if (sendButton) {
      // Always enable send button - let updateSendButtonState handle the logic
      sendButton.disabled = false;
      sendButton.classList.remove('active');
    }
    if (toggleButton) {
      toggleButton.disabled = false;
      toggleButton.classList.remove('active');
    }
  }

  // MAIN
  applyMainState() {
    const { mainTextInput, mainToggleButton, mainSendButton } = this.elements;
    if (mainTextInput) { 
      mainTextInput.disabled = false; 
      mainTextInput.style.opacity = '1'; 
      mainTextInput.placeholder = 'Введите ваш вопрос…'; 
    }
    if (mainToggleButton) { 
      mainToggleButton.disabled = false; 
      mainToggleButton.classList.remove('active'); 
    }
    if (mainSendButton) { 
      // Always enable send button - let updateSendButtonState handle the logic
      mainSendButton.disabled = false; 
      mainSendButton.classList.remove('active'); 
    }
  }

  // TYPING
  applyTypingState() {
    const { textInput, sendButton, toggleButton } = this.elements;
    if (sendButton) { 
      // Always enable send button - let updateSendButtonState handle the logic
      sendButton.disabled = false;
      sendButton.classList.remove('active');
    }
    if (toggleButton) {
      toggleButton.disabled = false;
      toggleButton.classList.remove('active');
    }
  }

  // RECORDING
  applyRecordingState() {
    const { textInput, sendButton, toggleButton } = this.elements;
    if (textInput) { textInput.disabled = true; textInput.style.opacity = '0.7'; textInput.placeholder = 'Идет запись… 0:00'; }
    if (sendButton) { sendButton.classList.add('active'); sendButton.disabled = false; }
    if (toggleButton) { toggleButton.disabled = false; toggleButton.classList.add('active'); }
    this.recordingTime = 0;
    this.startRecordingTimer();
  }

  // RECORDED
  applyRecordedState() { this.applyIdleState(); }

  // ---------- ввод ----------
  handleTextInput() {
    const { textInput } = this.elements;
    const hasText = !!textInput?.value?.trim();
    if (hasText && this.inputState === 'idle') this.setState('typing');
    else if (!hasText && this.inputState === 'typing') this.setState('idle');
    else if (this.inputState === 'typing') this.applyTypingState();
    
    // Update send button state
    this.widget.updateSendButtonState('chat');
  }
  handleTextKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !this.isMobile()) {
      e.preventDefault();
      const { textInput } = this.elements;
      if (this.inputState === 'typing' && textInput?.value?.trim()) this.handleSendText();
    }
  }

  // кнопки
  handleMicClick() {
    if (this.inputState === 'idle' || this.inputState === 'typing' || this.inputState === 'main') this.widget.audioRecorder.startRecording();
  }
  handleCancelClick() { if (this.inputState === 'recording') this.widget.audioRecorder.cancelRecording(); }
  handleSendClick() {
    console.log('🔘 Send button clicked. Current state:', this.inputState, 'Recording:', this.widget.audioRecorder?.isRecording);
    
    if (this.inputState === 'typing') {
      const { textInput } = this.elements;
      const text = textInput?.value?.trim();
      if (text) {
        this.handleSendText();
      } else {
        // Trigger shake animation for empty textfield
        this.triggerShakeAnimation('chat');
      }
    } else if (this.inputState === 'recording') {
      console.log('🎤 Sending recording...');
      this.widget.audioRecorder.finishAndSend();
    } else if (this.inputState === 'recorded') {
      this.widget.api.sendMessage();
    } else {
      // For other states, check if there's text to send
      const { textInput, mainTextInput } = this.elements;
      const currentTextInput = textInput || mainTextInput;
      const text = currentTextInput?.value?.trim();
      if (!text) {
        // Trigger shake animation for empty textfield
        this.triggerShakeAnimation(textInput ? 'chat' : 'main');
      }
    }
  }
  handleSendText() {
    const { textInput } = this.elements;
    const text = textInput?.value?.trim();
    if (text) this.widget.api.sendTextMessage();
  }

  handleToggleClick(screen) {
    if (this.widget.audioRecorder.isRecording) {
      // Cancel recording and clear input
      this.widget.audioRecorder.cancelRecording();
      if (screen === 'main') {
        const mainTextInput = this.elements.mainTextInput;
        if (mainTextInput) {
          mainTextInput.value = '';
          this.widget.updateSendButtonState('main');
        }
      } else if (screen === 'chat') {
        const textInput = this.elements.textInput;
        if (textInput) {
          textInput.value = '';
          this.widget.updateSendButtonState('chat');
        }
      }
    } else {
      // Start recording
      this.handleMicClick();
    }
  }

  // ---------- запись/таймер ----------
  startRecordingTimer() {
    this.recordingTime = 0;
    this.recordingTimer = setInterval(() => {
      this.recordingTime++;
      this.updateRecordingTimer(this.recordingTime);
    }, 1000);
  }
  updateRecordingTimer(time) {
    const { textInput } = this.elements;
    if (!textInput || this.inputState !== 'recording') return;
    const m = Math.floor(time / 60);
    const s = (time % 60).toString().padStart(2, '0');
    textInput.placeholder = `Идет запись… ${m}:${s}`;
  }
  clearRecordingState() {
    if (this.recordingTimer) { clearInterval(this.recordingTimer); this.recordingTimer = null; }
    this.recordingTime = 0;
  }

  // ---------- DOM события ----------
  bindTextInputEvents(textInput) {
    if (!textInput) return;
    textInput.addEventListener('input', () => this.handleTextInput());
    textInput.addEventListener('keydown', (e) => this.handleTextKeyDown(e));
  }
  bindUnifiedInputEvents() {
    const { sendButton, mainButton, textInput, toggleButton, mainToggleButton, mainSendButton, mainTextInput } = this.elements;
    this.bindTextInputEvents(textInput);
    sendButton?.addEventListener('click', () => this.handleSendClick());
    toggleButton?.addEventListener('click', () => this.handleToggleClick('chat'));
    mainButton?.addEventListener('click', () => {
      if (this.widget.audioRecorder?.isRecording) {
        // If already recording, finish and send the recording
        this.widget.audioRecorder.finishAndSend();
      } else if (!mainButton.disabled) {
        // If not recording, start recording
        this.handleMicClick();
      }
    });
    mainToggleButton?.addEventListener('click', () => this.handleToggleClick('main'));
    
    // Main screen send button
    mainSendButton?.addEventListener('click', () => {
      const text = mainTextInput?.value?.trim();
      if (text) {
        this.widget.sendTextFromMainScreen(text);
      } else {
        // Trigger shake animation for empty textfield
        this.triggerShakeAnimation('main');
      }
    });
    
    // Main screen text input events
    mainTextInput?.addEventListener('input', () => this.widget.updateSendButtonState('main'));
    mainTextInput?.addEventListener('keydown', (e) => {
      if (e.key === "Enter") {
        const text = mainTextInput.value.trim();
        if (text) {
          this.widget.sendTextFromMainScreen(text);
        }
      }
    });
  }

  // ---------- чат/история ----------
  _storageKey() { return `vw_thread_${this.widget.sessionId || 'default'}`; }
  _snapshotKey() { return `vw_last_snapshot`; }

  loadHistory() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length) {
        this.widget.messages = list;
        this._renderThreadFromMessages(list);
        this.activateDialogButtons();
        this.updateMessageCount();
      }
    } catch (e) { console.warn('Не удалось загрузить историю:', e); }
  }

  _renderThreadFromMessages(list) {
    const { messagesContainer, thread } = this.elements;
    if (!messagesContainer || !thread) return;
    this.shadowRoot.getElementById('emptyState')?.remove();
    messagesContainer.style.overflowY = 'auto';
    thread.innerHTML = '';
    list.forEach(msg => this._appendBubble(msg));
    this._scrollToBottom();
  }

  _saveHistory() {
    try { localStorage.setItem(this._storageKey(), JSON.stringify(this.widget.messages.slice(-500))); }
    catch (e) { console.warn('Не удалось сохранить историю:', e); }
  }

  addMessage(message) {
    this.widget.messages.push({ ...message, timestamp: message.timestamp || new Date() });
    this._saveHistory();

    const { messagesContainer, emptyState } = this.elements;
    if (this.widget.messages.length === 1) {
      emptyState?.remove();
      if (messagesContainer) messagesContainer.style.overflowY = 'auto';
      this.activateDialogButtons();
    }
    this._appendBubble(message);
    this._scrollToBottom();
    this.updateMessageCount();
  }

  _appendBubble(message) {
    const { thread } = this.elements;
    if (!thread) return;
    const wrapper = document.createElement('div');
    wrapper.className = `message ${message.type}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.type === 'assistant') {
      if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        bubble.innerHTML = marked.parse(message.content);
      } else { bubble.textContent = message.content; }
    } else { bubble.textContent = message.content; }
    wrapper.appendChild(bubble);
    thread.appendChild(wrapper);
  }

  _scrollToBottom() {
    const { messagesContainer } = this.elements;
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ---------- Reset / Restore ----------
  saveSnapshot() {
    try {
      const snapshot = { ts: Date.now(), sessionId: this.widget.sessionId, messages: this.widget.messages.slice(-500) };
      localStorage.setItem(this._snapshotKey(), JSON.stringify(snapshot));
      return true;
    } catch (e) { console.warn('Не удалось сохранить снапшот:', e); return false; }
  }

  restoreSnapshotAndApply() {
    try {
      const raw = localStorage.getItem(this._snapshotKey());
      if (!raw) { this.showNotification('⛔ Нет сохранённой сессии для восстановления'); return false; }
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.messages)) { this.showNotification('⛔ Снапшот повреждён'); return false; }

      this.widget.messages = snap.messages;
      this._setSessionIdAndDisplay(snap.sessionId);
      this._renderThreadFromMessages(this.widget.messages);
      this.activateDialogButtons();
      this.updateMessageCount();
      this.resetInsightsValues(false);
      return true;
    } catch (e) {
      console.warn('Не удалось восстановить снапшот:', e);
      this.showNotification('⛔ Ошибка восстановления');
      return false;
    }
  }

  resetSessionHard() {
    this.saveSnapshot();         // 1) сохраняем снимок
    this.clearMessages();        // 2) чистим чат

    // 3) ⚠️ НЕ генерим локальную sessionId — пусть сервер создаст новую
    this._setSessionIdAndDisplay(null);
    try {
      localStorage.removeItem('vw_sessionId');
      localStorage.removeItem('voiceWidgetSessionId');
    } catch {}

    this.resetInsightsValues(true);  // 4) чистим правую панель
    this.showNotification('🔄 Сессия сброшена'); // 5) нотификация
  }

  resetInsightsValues(resetProgress = true) {
    const setTxt = (id, txt) => { const el = this.shadowRoot.getElementById(id); if (el) el.textContent = txt; };
    setTxt('nameValue', 'не определено');
    setTxt('operationValue', 'не определена');
    setTxt('budgetValue', 'не определен');
    setTxt('typeValue', 'не определен');
    setTxt('locationValue', 'не определен');
    setTxt('roomsValue', 'не определено');
    setTxt('areaValue', 'не определена');
    setTxt('detailsValue', 'не определены');
    setTxt('preferencesValue', 'не определены');

    if (resetProgress) {
      const { progressFill, progressText } = this.elements;
      if (progressFill) progressFill.style.width = '0%';
      if (progressText) progressText.textContent = '0% — ожидание';
    }
  }

  _setSessionIdAndDisplay(sessionId) {
    this.widget.sessionId = sessionId;

    // синхронизируем localStorage — и для других модулей, и для консольных тестов
    try {
      localStorage.setItem('vw_sessionId', sessionId || '');
      localStorage.setItem('voiceWidgetSessionId', sessionId || '');
    } catch {}
  }

  _generateSessionId() { return 'ro' + Math.random().toString(16).slice(2, 10); } // оставил на всякий, но не используется

  // ---------- утилиты ----------
  activateDialogButtons() {
    const { micButton } = this.elements;
    if (micButton) { micButton.disabled = false; micButton.classList.add('active'); this.widget.dialogStarted = true; }
  }
  updateMessageCount() {
    // Message count display removed in new layout
  }
  showLoading() { this.shadowRoot.getElementById('loadingIndicator')?.classList.add('active'); }
  hideLoading() { this.shadowRoot.getElementById('loadingIndicator')?.classList.remove('active'); }
  showNotification(m) { console.log('📢', m); }
  showWarning(m) { console.log('⚠️', m); }

  isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 'ontouchstart' in window; }
  bindFunctionButtons() {}
  bindAccordionEvents() {}

  // очистка
  clearMessages() {
    this.widget.messages = [];
    this._saveHistory();

    const { thread } = this.elements;
    if (thread) {
      thread.innerHTML = '';
    }

    this.widget.dialogStarted = false;
    this.setState('main');
  }

  // геттеры состояния
  getCurrentState() { return this.inputState; }
  isRecording() { return this.inputState === 'recording'; }
  isTyping() { return this.inputState === 'typing'; }
  isIdle() { return this.inputState === 'idle'; }

  getInsightsPanelState() { return { expanded: this.widget.classList.contains('expanded'), canExpand: !this.isMobile() }; }
  getFullUIState() {
    return {
      inputState: this.inputState,
      insightsPanel: this.getInsightsPanelState(),
      dialogStarted: this.widget.dialogStarted,
      messagesCount: this.widget.messages.length
    };
  }

  triggerShakeAnimation(screen) {
    const textInput = screen === 'main' ? this.elements.mainTextInput : this.elements.textInput;
    if (textInput) {
      textInput.classList.add('shake');
      setTimeout(() => {
        textInput.classList.remove('shake');
      }, 500);
    }
  }
}
