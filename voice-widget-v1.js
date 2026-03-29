// ========================================
/* 📁 voice-widget-v1.js (standalone self-contained build) */
// ========================================

// Minimal markdown renderer (no external deps)
function __vwEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isInlineMessage(text) {
  if (!text) return true;
  const src = String(text).trim();
  if (!src) return true;
  if (src.includes('\n\n')) return false;
  const blockMarkers = [/^#{1,6}\s/m, /^>\s/m, /^\s*[-*+]\s/m, /^\s*\d+\.\s/m, /```/m];
  return !blockMarkers.some((re) => re.test(src));
}

function renderMarkdownInline(text) {
  const raw = __vwEscapeHtml(String(text ?? '').trim());
  return raw.replace(/\n/g, '<br>');
}

function renderMarkdownBlock(text) {
  const raw = __vwEscapeHtml(String(text ?? '').trim());
  return raw.replace(/\n/g, '<br>');
}

function renderMarkdown(text) {
  return isInlineMessage(text) ? renderMarkdownInline(text) : renderMarkdownBlock(text);
}

// modules/telemetryClient.js
/**
 * Клиент для отправки телеметрии на бэкенд
 * Отправляет события только если пользователь дал согласие на analytics
 */

// Типы событий (синхронизированы с бэкендом)
const EventTypes = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  WIDGET_OPEN: 'widget_open',
  WIDGET_CLOSE: 'widget_close',
  WIDGET_MINIMIZE: 'widget_minimize',
  WIDGET_RESTORE: 'widget_restore',
  USER_MESSAGE: 'user_message',
  ASSISTANT_REPLY: 'assistant_reply',
  CARD_SHOW: 'card_show',
  CARD_NEXT: 'card_next',
  CARD_LIKE: 'card_like',
  CARD_DISLIKE: 'card_dislike',
  LEAD_FORM_OPEN: 'lead_form_open',
  LEAD_FORM_SUBMIT: 'lead_form_submit',
  LEAD_FORM_ERROR: 'lead_form_error',
  CONSENT_UPDATE: 'consent_update',
  ERROR: 'error'
};

// Состояние телеметрии
let config = {
  baseUrl: null,
  sessionId: null,
  userId: null,
  analytics: false // по умолчанию отключено, пока пользователь не даст согласие
};

/**
 * Инициализация телеметрии
 * @param {Object} options - { baseUrl, sessionId, userId }
 */
function initTelemetry({ baseUrl, sessionId, userId = null }) {
  config.baseUrl = baseUrl;
  config.sessionId = sessionId;
  config.userId = userId;
}

/**
 * Установка согласия на аналитику
 * @param {Object} consent - { analytics: boolean }
 */
function setConsent({ analytics }) {
  config.analytics = analytics === true;
}

/**
 * Получить текущее состояние согласия
 * @returns {boolean}
 */
function getConsent() {
  return config.analytics;
}

/**
 * Утилита для построения payload: фильтрует undefined/null, но сохраняет 0 и false
 * @param {Object} base - базовый объект
 * @param {Object} extra - дополнительные поля
 * @returns {Object} - очищенный объект без undefined/null
 */
function buildPayload(base = {}, extra = {}) {
  const merged = { ...base, ...extra };
  const cleaned = {};
  for (const [key, value] of Object.entries(merged)) {
    // Пропускаем только undefined и null, но сохраняем 0, false, '', []
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Отправка события телеметрии
 * @param {string} eventType - тип события (из EventTypes)
 * @param {Object} payload - данные события
 * @returns {Promise<void>}
 */
async function log(eventType, payload = {}) {
  // Если аналитика отключена, не отправляем события (кроме consent_update)
  if (!config.analytics && eventType !== EventTypes.CONSENT_UPDATE) {
    return;
  }

  // Если не инициализирован baseUrl, не отправляем
  if (!config.baseUrl) {
    console.warn('⚠️ Telemetry not initialized: baseUrl missing');
    return;
  }

  try {
    const url = `${config.baseUrl}/api/telemetry/log`;
    const body = buildPayload(
      {
        eventType,
        sessionId: config.sessionId,
        userId: config.userId,
        source: 'widget',
        url: typeof window !== 'undefined' ? window.location.href : null
      },
      payload
    );

    // Отправляем асинхронно, не блокируем основной поток
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).catch(err => {
      // Ошибки сети не логируем в консоль, чтобы не засорять
      // В production можно добавить очередь для повторной отправки
      console.debug('Telemetry send failed (silent):', err);
    });
  } catch (err) {
    // Ошибки при формировании запроса тоже не логируем
    console.debug('Telemetry log error (silent):', err);
  }
}

const setTelemetryConsent = setConsent;
const logTelemetry = log;
const TelemetryEventTypes = EventTypes;

// ========================================
// 📁 modules/event-manager.js
// ========================================
// Система событий для коммуникации между модулями

class EventManager {
    constructor() {
        this.listeners = new Map();
    }

    // Подписаться на событие
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        console.log(`📡 Подписался на событие: ${event}`);
    }

    // Отправить событие
    emit(event, data) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            console.log(`📢 Отправляю событие: ${event}, слушателей: ${callbacks.length}`);
            
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Ошибка в обработчике события ${event}:`, error);
                }
            });
        } else {
            console.log(`📡 Событие ${event} отправлено, но нет слушателей`);
        }
    }

    // Отписаться от события
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
                console.log(`📡 Отписался от события: ${event}`);
            }
        }
    }

    // Получить список всех событий (для отладки)
    getEvents() {
        return Array.from(this.listeners.keys());
    }

    // Очистить все события
    clear() {
        this.listeners.clear();
        console.log('📡 Все события очищены');
    }
}
// ========================================
// 📁 modules/audio-recorder.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ========================================
// Запись и обработка аудио

class AudioRecorder {
    constructor(widget) {
        this.widget = widget;
        this.isRecording = false;
        this.recordingTime = 0;
        this.recordingTimer = null;
        this.maxRecordingTime = 60;
        this.minRecordingTime = 1;
        this.mediaRecorder = null; 
        this.stream = null;
        this.audioBlob = null;
        this.recordedChunks = [];
    }

    t(key) {
        if (this.widget && typeof this.widget.t === 'function') {
            return this.widget.t(key);
        }
        return '';
    }

    async startRecording() {
        try {
            this.isRecording = true;
            this.recordingTime = 0;
            this.recordedChunks = [];
            this.audioBlob = null;

            // 🔥 ГЕНЕРИРУЕМ СОБЫТИЕ ДЛЯ UI MANAGER
            this.widget.events.emit('recordingStarted');

            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            let mimeType = '';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            }

            this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                if (this.recordedChunks.length > 0) {
                    this.audioBlob = new Blob(this.recordedChunks, mimeType ? { type: mimeType } : {});
                    console.log('✅ Аудио готово к отправке');
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('Ошибка записи:', event.error);
                this.handleRecordingError(this.t('micErrorDuringRecord'));
            };

            this.mediaRecorder.start(100);

            // 🔥 ИСПОЛЬЗУЕМ ТОЛЬКО СИСТЕМУ СОБЫТИЙ (убираем прямую манипуляцию DOM)
            this.recordingTimer = setInterval(() => {
                this.recordingTime++;
                this.widget.events.emit('timerUpdated', this.recordingTime);

                if (this.recordingTime >= this.maxRecordingTime) {
                    this.finishAndSend();
                }
            }, 1000);

            console.log('🎤 Запись началась');

        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            this.handleRecordingError(this.getErrorMessage(err));
        }
    }

    cancelRecording() {
        if (!this.isRecording) return;

        console.log('🔴 Отменяем запись');

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.cleanupRecording();
        
        // 🔥 ГЕНЕРИРУЕМ СОБЫТИЕ ОТМЕНЫ
        this.widget.events.emit('recordingCancelled');
        this.widget.events.emit('notification', `❌ ${this.t('recordingCancelled')}`);
    }

    async finishAndSend() {
        if (!this.isRecording) return;

        console.log('🟢 Завершаем запись и отправляем');

        if (this.recordingTime < this.minRecordingTime) {
            this.widget.events.emit('notification', `⚠️ ${this.t('shortRecording')}`);
            return;
        }

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        await new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                if (this.recordedChunks.length > 0) {
                    this.audioBlob = new Blob(this.recordedChunks, { 
                        type: this.mediaRecorder.mimeType || 'audio/webm' 
                    });
                    console.log('✅ Blob создан, отправляем...');
                    resolve();
                }
            };

            this.mediaRecorder.stop();
        });

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // 🔥 ГЕНЕРИРУЕМ СОБЫТИЕ ОСТАНОВКИ ЗАПИСИ
        this.widget.events.emit('recordingStopped');

        // Отправляем через API
        this.widget.api.sendMessage();
    }

    handleRecordingError(message) {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        this.cleanupRecording();
        
        // 🔥 ГЕНЕРИРУЕМ СОБЫТИЯ ОШИБКИ
        this.widget.events.emit('recordingCancelled');
        this.widget.events.emit('notification', `❌ ${message}`);
        this.widget.events.emit('error', new Error(message));
    }

    cleanupRecording() {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;
    }

    cleanupAfterSend() {
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;
    }

    getErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return this.t('micAccessDenied');
        } else if (error.name === 'NotFoundError') {
            return this.t('micNotFound');
        } else if (error.name === 'NotReadableError') {
            return this.t('micBusy');
        } else if (error.name === 'OverconstrainedError') {
            return this.t('micUnsupported');
        } else {
            return this.t('micAccessError');
        }
    }
}
// ========================================
// 📁 modules/understanding-manager.js
// ========================================
// Управление пониманием запроса и анализом insights

class UnderstandingManager {
  constructor(widget) {
    this.widget = widget;

    // Расширенная структура понимания запроса (v2)
    this.understanding = {
      name: null,
      operation: null,
      budget: null,
      budgetMax: null,
      type: null,
      location: null,
      rooms: null,
      area: null,
      areaMin: null,
      areaMax: null,
      floor: null,
      features: null,
      details: null,
      preferences: null,
      progress: 0
    };
  }

  t(key) {
    if (this.widget && typeof this.widget.t === 'function') {
      return this.widget.t(key);
    }
    return '';
  }

  // Универсальная проверка заполненности значения
  isFilled(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    // числа/булевы/объекты/массивы считаем заполненными, если не null/undefined
    return true;
  }

  // Обновление понимания запроса
  update(insights) {
    if (!insights) return;

    console.log('🧠 Обновляю понимание:', insights);

    // Нормализуем входящие данные (поддержка старых/альтернативных ключей и вложенного params)
    const migrated = this.migrateInsights(insights);
    // Обновляем локальное состояние только каноническими ключами
    this.understanding = { ...this.understanding, ...migrated };

    // Пересчитываем прогресс
    this.understanding.progress = this.calculateProgress();

    // Обновляем UI
    this.updateUnderstandingDisplay();

    // Уведомляем другие модули
    this.widget.events.emit('understandingUpdated', this.understanding);
  }

  // Гибкая система расчёта прогресса
  calculateProgress() {
    const weights = {
      name: 7,
      operation: 7,
      budget: 7,
      budgetMax: 7,
      type: 7,
      location: 7,
      rooms: 7,
      area: 7,
      areaMin: 7,
      areaMax: 7,
      floor: 7,
      features: 7,
      details: 7,
      preferences: 7
    };

    let total = 0;
    for (const [field, w] of Object.entries(weights)) {
      if (this.isFilled(this.understanding[field])) total += w;
    }
    // максимум 99%, чтобы было место для финишного шага
    return Math.min(total, 99);
  }

  // Обновление отображения понимания
  updateUnderstandingDisplay() {
    const progressFill = this.widget.$byId('progressFill');
    const progressText = this.widget.$byId('progressText');

    const progress = this.understanding.progress;

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    if (progressText) {
      progressText.textContent = `${progress}% - ${this.getStageText(progress)}`;
    }

    // Синхронизируем шкалу в хедере
    if (typeof this.widget.updateHeaderUnderstanding === 'function') {
      this.widget.updateHeaderUnderstanding(progress);
    }

    // Обновляем все поля insights
    this.updateInsightItem('name', this.understanding.name);
    this.updateInsightItem('operation', this.understanding.operation);
    this.updateInsightItem('budget', this.understanding.budget);
    this.updateInsightItem('type', this.understanding.type);
    this.updateInsightItem('location', this.understanding.location);
    this.updateInsightItem('rooms', this.understanding.rooms);
    this.updateInsightItem('area', this.understanding.area);
    this.updateInsightItem('floor', this.understanding.floor);
    this.updateInsightItem('details', this.understanding.details);
    this.updateInsightItem('preferences', this.understanding.preferences);
  }

  // Обновление отдельного поля insights (индикатор опционален)
  updateInsightItem(field, value) {
    const indicator = this.widget.$byId(`${field}Indicator`); // может отсутствовать
    const valueElement = this.widget.$byId(`${field}Value`);

    if (!indicator && !valueElement) {
      // В текущей разметке индикаторов нет — просто выходим тихо
      return;
    }

    const filled = this.isFilled(value);

    if (valueElement) {
      valueElement.textContent = filled ? String(value) : this.getDefaultText(field);
    }
    if (indicator) {
      indicator.classList.toggle('filled', filled);
    }
  }

  // Текст по умолчанию для поля
  getDefaultText(field) {
    return this.t('insightDefault') || 'not specified';
  }

  // Текст стадии по проценту
  getStageText(progress) {
    if (progress === 0) return this.t('stageWaiting') || 'Waiting';
    if (progress <= 20) return this.t('stageIntro') || 'Discovery';
    if (progress <= 40) return this.t('stageCore') || 'Core parameters';
    if (progress <= 60) return this.t('stagePrimarySelection') || 'Ready for initial selection';
    if (progress <= 80) return this.t('stageDetails') || 'Refining details';
    return this.t('stagePreciseSelection') || 'Ready for precise selection';
  }

  // Миграция старого формата insights в новый
  migrateInsights(oldInsights = {}) {
    const src = oldInsights?.params ? oldInsights.params : oldInsights;
    const pick = (...keys) => {
      for (const k of keys) {
        if (src && src[k] !== undefined && src[k] !== null && String(src[k]).length) return src[k];
      }
      return null;
    };

    const normalized = {
      name: pick('name'),
      operation: pick('operation', 'operationType'),
      budget: pick('budget'),
      budgetMax: pick('budgetMax'),
      type: pick('type', 'propertyType'),
      location: pick('location', 'district'),
      rooms: pick('rooms'),
      area: pick('area'),
      areaMin: pick('areaMin'),
      areaMax: pick('areaMax'),
      floor: pick('floor'),
      features: pick('features'),
      details: pick('details', 'locationDetails'),
      preferences: pick('preferences', 'additional'),
      progress: oldInsights.progress ?? src?.progress ?? 0
    };

    return normalized;
  }

  // Сброс понимания запроса
  reset() {
    for (const key in this.understanding) {
      if (key !== 'progress') this.understanding[key] = null;
    }
    this.understanding.progress = 0;
    this.updateUnderstandingDisplay();

    console.log('🧠 Понимание запроса сброшено');
  }

  // Экспорт текущего состояния
  export() {
    return { ...this.understanding };
  }

  // Импорт состояния
  import(insights) {
    this.understanding = { ...this.understanding, ...insights };
    this.understanding.progress = this.calculateProgress();
    this.updateUnderstandingDisplay();

    console.log('🧠 Понимание запроса импортировано:', insights);
  }
}

// ========================================
// 📁 modules/ui-manager.js (ФИНАЛ, Reset/Restore)
// ========================================

class UIManager {
  constructor(widget) {
    this.widget = widget;
    this.root = widget.getRoot();

    this.inputState = 'idle';
    this.recordingTime = 0;
    this.recordingTimer = null;

    this.isInsightsExpanded = false;
    this.elements = {};
    this.bindToInternalEvents();
  }

  getRoot() {
    return this.widget?.getRoot?.() || this.root || document;
  }

  $(selector) {
    return this.getRoot()?.querySelector?.(selector) || null;
  }

  $byId(id) {
    return this.widget?.$byId?.(id) || this.$(`#${id}`);
  }

  getInputPlaceholder() {
    if (this.widget && typeof this.widget.t === 'function') {
      return this.widget.t('inputPlaceholder');
    }
    return 'Ask a question...';
  }

  t(key) {
    if (this.widget && typeof this.widget.t === 'function') {
      return this.widget.t(key);
    }
    return '';
  }

  // ---------- init ----------
  initializeUI() {
    this.cacheElements();
    this.setState('idle');
    this.isInsightsExpanded = this.widget.classList.contains('expanded');

    const { messagesContainer } = this.elements;
    if (messagesContainer) messagesContainer.style.overflowY = 'hidden';

    this.widget.dialogStarted = false;
    this.widget.understanding?.updateUnderstandingDisplay?.();
  }

  cacheElements() {
    this.elements = {
      textInput:         this.$byId('textInput'),
      sendButton:        this.$byId('sendButton'),

      // Chat screen elements
      toggleButton:      this.$byId('toggleButton'),

      messagesContainer: this.$byId('messagesContainer'),
      thread:            this.$byId('thread'),

      // Details screen elements
      progressFill:      this.$byId('progressFill'),
      progressText:      this.$byId('progressText'),
    };
  }

  // ---------- события / Reset-Restore ----------
  bindToInternalEvents() {
    this.widget.events.on('recordingStarted', () => {
      this.setState('recording');
      try { this.widget.showRecordingIndicator('chat'); } catch {}
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('recordingStopped', () => {
      this.setState('idle');
      try { this.widget.hideRecordingIndicator('chat'); } catch {}
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('recordingCancelled', () => {
      this.setState('idle');
      try { this.widget.hideRecordingIndicator('chat'); } catch {}
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
    const { sendButton, textInput, toggleButton } = this.elements;
    switch (state) {
      case 'recording':
        if (this.recordingTimer) { clearInterval(this.recordingTimer); this.recordingTimer = null; }
        if (textInput) { textInput.disabled = false; textInput.style.opacity = '1'; textInput.placeholder = this.getInputPlaceholder(); }
        sendButton?.classList.remove('active');
        toggleButton?.classList.remove('active');
        break;
      default: break;
    }
  }

  applyState(state, data) {
    switch (state) {
      case 'idle':      this.applyIdleState(); break;
      case 'typing':    this.applyTypingState(); break;
      case 'recording': this.applyRecordingState(); break;
      case 'recorded':  this.applyRecordedState(data); break;
    }
  }

  // IDLE
  applyIdleState() {
    const { textInput, sendButton, toggleButton } = this.elements;
    if (textInput) { textInput.disabled = false; textInput.style.opacity = '1'; textInput.placeholder = this.getInputPlaceholder(); }
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
    if (textInput) { textInput.disabled = true; textInput.style.opacity = '0.7'; }
    if (sendButton) { sendButton.classList.add('active'); sendButton.disabled = false; }
    if (toggleButton) { toggleButton.disabled = false; toggleButton.classList.add('active'); }
    this.recordingTime = 0;
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
    if (this.inputState === 'idle' || this.inputState === 'typing') this.widget.audioRecorder.startRecording();
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
      const { textInput } = this.elements;
      const text = textInput?.value?.trim();
      if (text) {
        this.handleSendText();
      } else {
        // Trigger shake animation for empty textfield
        this.triggerShakeAnimation();
      }
    }
  }
  isResetCommand(text) {
    return String(text || '').trim().toLowerCase() === '//reset';
  }
  isAdminCommand(text) {
    return String(text || '').trim().toLowerCase() === '//admin';
  }
  tryHandleResetCommand(text) {
    if (!this.isResetCommand(text)) return false;
    const { textInput } = this.elements;
    if (textInput) textInput.value = '';
    this.widget.updateSendButtonState('chat');
    this.widget.clearSession();
    return true;
  }
  tryHandleAdminCommand(text) {
    if (!this.isAdminCommand(text)) return false;
    const { textInput } = this.elements;
    if (textInput) textInput.value = '';
    this.widget.accessRole = 'owner';
    this.widget.accessFlags = {
      ...(this.widget.accessFlags || {}),
      isAdmin: true,
      isOwner: true,
      isSuperAdmin: this.widget.accessFlags?.isSuperAdmin === true
    };
    try { this.widget.updateAccessHeaderButton?.(); } catch {}
    this.widget.updateSendButtonState('chat');
    this.widget.openAccessOverlay?.();
    this.widget.ui?.showNotification?.('Admin access enabled (dev)');
    return true;
  }
  handleSendText() {
    const { textInput } = this.elements;
    const text = textInput?.value?.trim();
    if (!text) return;
    if (this.tryHandleResetCommand(text)) return;
    if (this.tryHandleAdminCommand(text)) return;
    this.widget.api.sendTextMessage();
  }

  handleToggleClick() {
    if (this.widget.audioRecorder.isRecording) {
      // Cancel recording and clear input
      this.widget.audioRecorder.cancelRecording();
      const textInput = this.elements.textInput;
      if (textInput) {
        textInput.value = '';
        this.widget.updateSendButtonState('chat');
      }
    } else {
      // Start recording
      this.handleMicClick();
    }
  }

  // ---------- запись/таймер ----------
  updateRecordingTimer(time) {
    if (this.inputState !== 'recording') return;
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = (time % 60).toString().padStart(2, '0');
    // Обновляем таймер текущего экрана
    const chatTimer = this.$byId('chatRecordTimer');
    if (chatTimer) chatTimer.textContent = `${m}:${s}`;
    // На плейсхолдер больше не полагаемся
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
    const { sendButton, textInput, toggleButton } = this.elements;
    this.bindTextInputEvents(textInput);
    sendButton?.addEventListener('click', () => this.handleSendClick());
    toggleButton?.addEventListener('click', () => this.handleToggleClick());
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
    this.$byId('emptyState')?.remove();
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
    // v2 bubble markup
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble ' + (message.type === 'assistant' ? 'widget-bubble' : 'user-bubble');
    if (message.type === 'assistant') {
      if (message.greeting === true) {
        bubble.textContent = '';
        wrapper.appendChild(bubble);
        thread.appendChild(wrapper);
        const content = message.content || '';
        let i = 0;
        const tid = setInterval(() => {
          if (i < content.length) {
            bubble.textContent += content[i];
            i++;
            this._scrollToBottom();
          } else {
            clearInterval(tid);
          }
        }, 20);
      } else {
        try {
          const html = renderMarkdown(message.content);
          bubble.classList.add('vw-md');
          bubble.innerHTML = html;
        } catch (e) {
          console.warn('Markdown render fallback:', e);
          bubble.textContent = message.content;
        }
        wrapper.appendChild(bubble);
        thread.appendChild(wrapper);
      }
    } else {
      bubble.textContent = message.content;
      wrapper.appendChild(bubble);
      thread.appendChild(wrapper);
    }
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
      if (!raw) { this.showNotification(`⛔ ${this.t('noSavedSession')}`); return false; }
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.messages)) { this.showNotification(`⛔ ${this.t('snapshotCorrupted')}`); return false; }

      this.widget.messages = snap.messages;
      this._setSessionIdAndDisplay(snap.sessionId);
      this._renderThreadFromMessages(this.widget.messages);
      this.activateDialogButtons();
      this.updateMessageCount();
      this.resetInsightsValues(false);
      return true;
    } catch (e) {
      console.warn('Не удалось восстановить снапшот:', e);
      this.showNotification(`⛔ ${this.t('restoreError')}`);
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
    this.showNotification(`🔄 ${this.t('sessionReset')}`); // 5) нотификация
  }

  resetInsightsValues(resetProgress = true) {
    const setTxt = (id, txt) => { const el = this.$byId(id); if (el) el.textContent = txt; };
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
  showLoading() { this.$byId('loadingIndicator')?.classList.add('active'); }
  hideLoading() { this.$byId('loadingIndicator')?.classList.remove('active'); }
  showThinkingIndicator() {
    this.hideThinkingIndicator();
    const { thread } = this.elements;
    if (!thread) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'message assistant thinking-message';
    wrapper.setAttribute('data-thinking', '1');

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble widget-bubble thinking-bubble';
    bubble.innerHTML = '<span class="thinking-dots" aria-label="Thinking"><span></span><span></span><span></span></span>';
    wrapper.appendChild(bubble);
    thread.appendChild(wrapper);
    this._scrollToBottom();
    return wrapper;
  }
  hideThinkingIndicator(node = null) {
    if (node?.parentNode) node.parentNode.removeChild(node);
    this.getRoot()
      ?.querySelectorAll?.('.thinking-message[data-thinking="1"]')
      ?.forEach((el) => el.remove());
  }
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
    this.setState('idle');
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

  triggerShakeAnimation() {
    const textInput = this.elements.textInput;
    if (textInput) {
      textInput.classList.add('shake');
      setTimeout(() => {
        textInput.classList.remove('shake');
      }, 500);
    }
  }
}

// ========================================
// 📁 modules/api-client.js (DB + Cards API)
// ========================================

class APIClient {
  constructor(widget) {
    this.widget = widget;
    this.apiUrl = widget.apiUrl;
    this.fieldName = widget.fieldName;   // оставлено для совместимости, но ключ файла — всегда 'audio'
    this.responseField = widget.responseField;

    // --- Cards state (infra for future "brain") ---
    this.lastProposedCards = [];     // последние предложенные карточки (объекты)
    this.lastShownCardId = null;     // последняя реально показанная карточка (id)
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
    const url = `${base}/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Card fetch failed: ${res.status}`);
    return await res.json().catch(() => null);
  }

  async createManualProperty(payload = {}, imageFiles = []) {
    const base = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/admin/properties');
    const formData = new FormData();
    const source = payload && typeof payload === 'object' ? payload : {};
    Object.entries(source).forEach(([key, value]) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item == null) return;
          formData.append(key, String(item));
        });
        return;
      }
      formData.append(key, String(value));
    });
    this.appendTelegramUserToFormData(formData);
    const tgIdentity = this.getTelegramUserIdentity();
    if (!tgIdentity?.id && this.widget?.accessFlags?.isAdmin) {
      formData.append('devAdmin', '1');
    }
    const files = Array.isArray(imageFiles) ? imageFiles : [];
    files.forEach((file) => {
      if (file instanceof File) formData.append('images', file, file.name || 'image.jpg');
    });
    const res = await fetch(base, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `ADMIN_CREATE_FAILED_${res.status}`));
    }
    return data;
  }

  async deleteManualProperty(externalId, options = {}) {
    const safeId = String(externalId || '').trim();
    if (!safeId) throw new Error('EXTERNAL_ID_REQUIRED');
    const base = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/admin/properties');
    const url = new URL(`${base}/${encodeURIComponent(safeId)}`);
    if (options.clientId) url.searchParams.set('clientId', String(options.clientId));
    const tgIdentity = this.getTelegramUserIdentity();
    if (tgIdentity?.id) url.searchParams.set('tgUserId', tgIdentity.id);
    else if (this.widget?.accessFlags?.isAdmin) url.searchParams.set('devAdmin', '1');
    const res = await fetch(url.toString(), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `ADMIN_DELETE_FAILED_${res.status}`));
    }
    return data;
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

  appendTelegramUserToFormData(fd) {
    try {
      if (!fd) return;
      const identity = this.getTelegramUserIdentity();
      if (!identity?.id) return;
      fd.append('tgUserId', String(identity.id));
      if (identity.username) fd.append('tgUsername', String(identity.username));
      if (identity.firstName) fd.append('tgFirstName', String(identity.firstName));
      if (identity.lastName) fd.append('tgLastName', String(identity.lastName));
    } catch {}
  }

  getTelegramUserIdentity() {
    try {
      const fromUnsafe = window?.Telegram?.WebApp?.initDataUnsafe?.user || null;
      const fromWidget = this.widget?.getCurrentTelegramUser?.() || null;
      const tgUser = fromUnsafe || (fromWidget?.id ? {
        id: fromWidget.id,
        username: fromWidget.username,
        first_name: fromWidget.firstName,
        last_name: fromWidget.lastName
      } : null);
      if (!tgUser || tgUser.id == null) return null;
      return {
        id: String(tgUser.id).trim(),
        username: tgUser.username ? String(tgUser.username).trim() : '',
        firstName: tgUser.first_name ? String(tgUser.first_name).trim() : '',
        lastName: tgUser.last_name ? String(tgUser.last_name).trim() : ''
      };
    } catch {
      return null;
    }
  }

  async resolveViewerAccessRole() {
    const tgIdentity = this.getTelegramUserIdentity();
    // Safety baseline for non-Telegram / local browser.
    if (!tgIdentity?.id) {
      this.widget.accessRole = 'user';
      this.widget.accessFlags = { isAdmin: false, isOwner: false, isSuperAdmin: false };
      try { this.widget.updateAccessHeaderButton?.(); } catch {}
      return { accessRole: 'user', isAdmin: false, isOwner: false, isSuperAdmin: false };
    }

    try {
      const base = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/audio/access');
      const url = new URL(base);
      url.searchParams.set('tgUserId', tgIdentity.id);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`access role fetch failed: ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const accessRole = String(data?.accessRole || 'user').trim().toLowerCase();
      this.widget.accessRole = ['super_admin', 'owner', 'user'].includes(accessRole) ? accessRole : 'user';
      this.widget.accessFlags = {
        isAdmin: data?.isAdmin === true || this.widget.accessRole !== 'user',
        isOwner: data?.isOwner === true,
        isSuperAdmin: data?.isSuperAdmin === true
      };
      try { this.widget.updateAccessHeaderButton?.(); } catch {}
      return {
        accessRole: this.widget.accessRole,
        ...this.widget.accessFlags
      };
    } catch (error) {
      console.warn('resolveViewerAccessRole failed:', error);
      this.widget.accessRole = 'user';
      this.widget.accessFlags = { isAdmin: false, isOwner: false, isSuperAdmin: false };
      try { this.widget.updateAccessHeaderButton?.(); } catch {}
      return { accessRole: 'user', isAdmin: false, isOwner: false, isSuperAdmin: false };
    }
  }

  storeLastApiPayload(data, source = 'unknown') {
    try {
      this.widget._lastApiPayload = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : null;
      this.widget._lastApiPayloadMeta = {
        source,
        at: new Date().toISOString()
      };
    } catch {
      this.widget._lastApiPayload = data || null;
      this.widget._lastApiPayloadMeta = { source, at: new Date().toISOString() };
    }
  }

  syncBackendDrivenState(data) {
    try {
      this.widget?.ingestBackendCatalogPayload?.(data);
    } catch (e) {
      console.warn('syncBackendDrivenState failed:', e);
    }
  }

  async fetchSessionCandidates(limit = 50) {
    if (!this.widget.sessionId) return { totalMatches: 0, cards: [] };
    const sessionUrl = this.apiUrl.replace('/upload', `/session/${this.widget.sessionId}`);
    const response = await fetch(sessionUrl);
    if (!response.ok) throw new Error(`Session fetch failed: ${response.status}`);
    const sessionData = await response.json().catch(() => ({}));
    const topCandidates = Array.isArray(sessionData.topCandidates)
      ? sessionData.topCandidates.slice(0, Math.max(1, Number(limit) || 50))
      : [];
    if (topCandidates.length) {
      return {
        totalMatches: Number.isFinite(Number(sessionData.totalMatches)) ? Math.max(0, Number(sessionData.totalMatches)) : topCandidates.length,
        strictMatches: Number.isFinite(Number(sessionData.strictMatches)) ? Math.max(0, Number(sessionData.strictMatches)) : null,
        relaxedMatches: Number.isFinite(Number(sessionData.relaxedMatches)) ? Math.max(0, Number(sessionData.relaxedMatches)) : null,
        cards: topCandidates
      };
    }
    const idsRaw = Array.isArray(sessionData.lastCandidates) ? sessionData.lastCandidates : [];
    const ids = idsRaw.map((id) => String(id || '').trim()).filter(Boolean).slice(0, Math.max(1, Number(limit) || 50));
    const cards = [];
    for (const id of ids) {
      try {
        const card = await this.fetchCardById(id);
        if (card && typeof card === 'object') cards.push(card);
      } catch {}
    }
    return {
      totalMatches: Number.isFinite(Number(sessionData.totalMatches))
        ? Math.max(0, Number(sessionData.totalMatches))
        : cards.length,
      strictMatches: Number.isFinite(Number(sessionData.strictMatches)) ? Math.max(0, Number(sessionData.strictMatches)) : null,
      relaxedMatches: Number.isFinite(Number(sessionData.relaxedMatches)) ? Math.max(0, Number(sessionData.relaxedMatches)) : null,
      cards
    };
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
        this.storeLastApiPayload(data, 'loadSessionInfo');
        this.syncBackendDrivenState(data);
        if (data.insights) {
          const migrated = this.widget.understanding.migrateInsights(data.insights);
          this.widget.understanding.update(migrated);
          console.log('📥 Загружены данные сессии:', data);
        }
        // 🆕 Sprint I: сохраняем role из server response (read-only)
        if (data?.role !== undefined) {
          this.widget.role = data.role;
        } else {
          console.warn('⚠️ [Sprint I] role отсутствует в server response (контрактная проблема)');
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
    const textInput = this.widget.$byId('textInput');
    const sendButton = this.widget.$byId('sendButton');
    const messageText = textInput?.value?.trim();
    if (!messageText) return;

    textInput.value = '';
    if (sendButton) { sendButton.disabled = true; sendButton.classList.remove('active'); }

    const userMessage = { type: 'user', content: messageText, timestamp: new Date() };
    this.widget.ui.addMessage(userMessage);
    const thinkingEl = this.widget.ui.showThinkingIndicator();

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
      this.appendTelegramUserToFormData(fd);

      console.log('📤 Текст →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));
      this.storeLastApiPayload(data, 'sendTextMessage');
      this.syncBackendDrivenState(data);

      // ✅ если сервер выдал sessionId — подхватываем и показываем
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      // 🆕 Sprint I: сохраняем role из server response (read-only)
      if (data?.role !== undefined) {
        this.widget.role = data.role;
      } else {
        console.warn('⚠️ [Sprint I] role отсутствует в server response (контрактная проблема)');
      }

      console.log('📥 Ответ на текст:', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui, role: data.role
      });

      this.widget.ui.hideThinkingIndicator(thinkingEl);
      this.widget.ui.updateMessageCount();

      if (data.insights) this.widget.understanding.update(data.insights);

      const assistantRaw = data[this.responseField] || this.t('responseMissing');
      const parsed = this.extractHiddenCommands(assistantRaw);
      const assistantMessage = { type: 'assistant', content: parsed.cleaned, timestamp: new Date() };
      if (assistantMessage.content) this.widget.ui.addMessage(assistantMessage);
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
        if (!this.disableServerUI && data?.ui?.suggestShowCard === true) {
          await this.widget.renderPropertiesFromCatalog();
        }
      } catch (e) { console.warn('Cards handling error:', e); }

    } catch (error) {
      this.widget.ui.hideThinkingIndicator(thinkingEl);
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
    const thinkingEl = this.widget.ui.showThinkingIndicator();

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
      this.appendTelegramUserToFormData(fd);

      if (this.fieldName && this.fieldName !== 'audio') {
        console.warn(`[VW] fieldName='${this.fieldName}' игнорируется — используем 'audio'`);
      }

      console.log('📤 Аудио →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json().catch(() => ({}));
      this.storeLastApiPayload(data, 'sendMessage');
      this.syncBackendDrivenState(data);

      // ✅ подхватываем новую sessionId с сервера
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      // 🆕 Sprint I: сохраняем role из server response (read-only)
      if (data?.role !== undefined) {
        this.widget.role = data.role;
      } else {
        console.warn('⚠️ [Sprint I] role отсутствует в server response (контрактная проблема)');
      }

      console.log('📥 Ответ на аудио:', {
        sessionId: data.sessionId, messageCount: data.messageCount,
        insights: data.insights, tokens: data.tokens, timing: data.timing, cards: data.cards, ui: data.ui, role: data.role
      });

      this.widget.ui.hideThinkingIndicator(thinkingEl);
      this.widget.ui.updateMessageCount();

      // обновляем транскрипцию в последнем пользовательском сообщении
      if (data.transcription) {
        const lastUserMessage = this.widget.messages[this.widget.messages.length - 1];
        if (lastUserMessage && lastUserMessage.type === 'user') {
          lastUserMessage.content = data.transcription;
          const userMsgs = this.widget.getRoot().querySelectorAll('.message.user');
          const el = userMsgs[userMsgs.length - 1];
          if (el) {
            const bubble = el.querySelector('.message-bubble');
            if (bubble) bubble.textContent = data.transcription;
          }
        }
      }

      if (data.insights) this.widget.understanding.update(data.insights);

      const assistantRaw = data[this.responseField] || this.t('responseMissing');
      const parsed = this.extractHiddenCommands(assistantRaw);

      const assistantMessage = {
        type: 'assistant',
        content: parsed.cleaned || this.t('responseMissing'),
        timestamp: new Date()
      };
      this.widget.ui.addMessage(assistantMessage);
      
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
        stage: data.stage || null,
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
        if (!this.disableServerUI && data?.ui?.suggestShowCard === true) {
          await this.widget.renderPropertiesFromCatalog();
        }
      } catch (e) { console.warn('Cards handling error (audio):', e); }

      this.widget.cleanupAfterSend();

    } catch (error) {
      this.widget.ui.hideThinkingIndicator(thinkingEl);
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
          sessionId: this.widget.sessionId
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
          sessionId: this.widget.sessionId
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
          sessionId: this.widget.sessionId
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
          sessionId: this.widget.sessionId
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
          sessionId: this.widget.sessionId || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.syncBackendDrivenState(data);
        console.log('📤 Card interaction sent:', { action, variantId, response: data });

        // 🆕 Sprint I: сохраняем role из server response (read-only)
        if (data?.role !== undefined) {
          this.widget.role = data.role;
        } else {
          console.warn('⚠️ [Sprint I] role отсутствует в server response (контрактная проблема)');
        }

        // Для первого показа карточки ('show') карточку уже отрисовали локально,
        // с бэка берём только текст-подпись. Для остальных действий — рендерим карточку.
        if (data && data.card) {
          this.widget.mergePropertiesToCatalog?.([data.card]);
        }
        if (action !== 'show') {
          if (data && data.card) {
            try { this.widget.showMockCardWithActions(data.card); } catch (e) { console.warn('show card error:', e); }
          }
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
// ========================================
/* 📁 voice-widget.js (ОБНОВЛЁННАЯ ВЕРСИЯ v2) */
// ========================================

// Базовый путь для ассетов
const ASSETS_BASE = (() => {
  try {
    const fromWindow = typeof window !== 'undefined' ? window.__VW_ASSETS_BASE__ : '';
    const base = fromWindow || 'assets/';
    return base.endsWith('/') ? base : base + '/';
  } catch {
    return 'assets/';
  }
})();

const VW_DEEP_LINK_PARAM = 'propId';
const VW_DEEP_LINK_PREFIX = 'prop_';
const VW_TELEGRAM_BOT_USERNAME = (() => {
  try {
    const fromWindow = typeof window !== 'undefined' ? window.__VW_TELEGRAM_BOT_USERNAME__ : '';
    return String(fromWindow || '').trim().replace(/^@/, '');
  } catch {
    return '';
  }
})();
const VW_SHARE_BASE_URL = (() => {
  try {
    const fromWindow = typeof window !== 'undefined' ? window.__VW_SHARE_BASE_URL__ : '';
    const normalized = String(fromWindow || '').trim().replace(/\/+$/, '');
    if (normalized) return normalized;
    if (typeof window !== 'undefined' && window.location?.origin) {
      return String(window.location.origin).replace(/\/+$/, '');
    }
  } catch {}
  return '';
})();


const LOCALES = {
  RU: {
    inputPlaceholder: 'Задайте вопрос...',
    recordingLabel: 'Идет запись',
    loadingText: 'Обрабатываю запрос',
    menuLanguage: 'Выбрать язык',
    menuThemeToLight: 'Светлая тема',
    menuThemeToDark: 'Тёмная тема',
    appHeaderContact: 'Связаться',
    appHeaderOnline: 'Online',
    appHeaderAdminAria: 'Открыть админ-панель',
    appHeaderWishlistAria: 'Открыть избранное',
    accessAdminIcon: '👑',
    accessUserIcon: '♡',
    accessAdminGreeting: 'Добро пожаловать, {name} (@{username})! Вы в админ-панели',
    accessUserGreeting: 'Добро пожаловать, {name} (@{username})! Это ваш список избранного',
    accessAdminStats: 'Статистика',
    accessAdminProperties: 'Мои объекты',
    accessAdminSubscription: 'Управление подпиской',
    accessAdminOlxConnect: 'Подключить OLX',
    accessAdminOlxConnected: 'OLX подключен (переподключить)',
    accessAdminOlxChecking: 'Проверяю OLX...',
    accessAdminOlxError: 'Не удалось проверить статус OLX',
    accessAdminOlxSuccessToast: 'OLX успешно подключен',
    accessAdminOlxFailedToast: 'Не удалось подключить OLX',
    accessUserEmpty: 'Здесь появятся объекты, которые вы добавите в избранное (Wishlist)',
    consentText: 'Я согласен(а) на обработку моих данных для обработки этого запроса и связи со мной по недвижимости.',
    privacyPolicy: 'Политика конфиденциальности',
    send: 'Отправить',
    cancel: 'Отмена',
    close: 'Закрыть',
    continue: 'Продолжить',
    understood: 'Понятно',
    thanksTitle: 'Спасибо!',
    thanksBody: 'Ваша заявка получена. Мы скоро с вами свяжемся.',
    leaveRequest: 'Оставить заявку',
    namePlaceholder: 'Имя',
    phonePlaceholder: 'Телефон',
    emailPlaceholder: 'E-mail',
    cardShow: 'Показать',
    cardCancel: 'Отменить',
    cardSelect: 'Выбрать',
    cardNext: 'Ещё одну',
    cardBackContact: 'Связаться',
    cardReadDescription: 'Описание',
    cardDescriptionTitle: 'Описание объекта',
    cardDescriptionOk: 'OK',
    cardDescriptionEmpty: 'Описание пока недоступно',
    handoffMessage: 'Вы выбрали объект. Дальше можно уточнить детали или отменить.',
    handoffDetails: 'Подробнее',
    pillCta: 'Смотреть подборку',
    pillNewInsight: 'Новый инсайт',
    pillFound: 'Найдено {count} объектов',
    sliderCheckpointTitle10: 'Вы просмотрели 10 лучших совпадений',
    sliderCheckpointTitle20: 'Точность совпадения снижается',
    sliderCheckpointText10: 'Дальше будут варианты с частичным соответствием. Хотите уточнить критерии или обсудить подбор с экспертом?',
    sliderCheckpointText20: 'Дальше идут варианты с более низкой релевантностью. Уточнить запрос или связаться с экспертом?',
    sliderCheckpointRefine: 'Уточнить',
    sliderCheckpointContact: 'Связаться',
    backSpecsOverflowTitle: 'Дополнительные детали',
    backSpecsOverflowText: 'К сожалению, не вся информация поместилась в данной карточке. Чтобы узнать дополнительные детали, вы можете связаться с менеджером.',
    backSpecsOverflowContact: 'Связаться',
    backSpecsExtraType: 'Тип: апартаменты',
    backSpecsExtraMarket: 'Рынок: первичный',
    backSpecsExtraHandover: 'Сдача: Q4 2027',
    backSpecsExtraFinish: 'Отделка: премиум',
    backSpecsExtraParking: 'Паркинг: 1 место',
    backSpecsExtraTerrace: 'Терраса: есть',
    contactManagerTitle: 'Выберите контакт',
    contactMethodTelegram: 'Telegram',
    contactMethodPhone: 'Телефон',
    contactMethodEmail: 'Email',
    contactManagerAria: 'Выбор контакта',
    contactManagerErrorTelegram: 'Введите Telegram username.',
    contactManagerPhoneMinDigits: 'Введите корректный номер (минимум 10 цифр)',
    inDialogLeadTitle: 'Оставьте контакты',
    inDialogLeadNameLabel: 'Имя',
    inDialogLeadPhoneLabel: 'Телефон',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: 'Обязателен телефон или email',
    inDialogLeadConsentError: 'Примите Политику конфиденциальности',
    invalidPhone: 'Некорректный номер телефона. Используйте 9-10 цифр после кода страны.',
    invalidEmail: 'Некорректный email. Пример: name@domain.com',
    submitFailed: 'Не удалось отправить заявку. Попробуйте снова позже.',
    networkError: 'Ошибка сети. Проверьте подключение и попробуйте снова.',
    parseError: 'Не удалось разобрать ответ сервера',
    responseMissing: 'Ответ от сервера не получен.',
    sendTextError: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
    shortRecording: 'Запись слишком короткая',
    voiceMessageLabel: 'Голосовое сообщение ({seconds}с)',
    processingCardsError: 'Ошибка при обработке команды карточек',
    noSavedSession: 'Нет сохраненной сессии для восстановления',
    snapshotCorrupted: 'Снимок состояния поврежден',
    restoreError: 'Ошибка восстановления',
    sessionReset: 'Сессия сброшена',
    micErrorDuringRecord: 'Произошла ошибка во время записи',
    recordingCancelled: 'Запись отменена',
    micAccessDenied: 'Доступ к микрофону запрещен',
    micNotFound: 'Микрофон не найден',
    micBusy: 'Микрофон уже используется',
    micUnsupported: 'Настройки микрофона не поддерживаются',
    micAccessError: 'Ошибка доступа к микрофону',
    speakTitle: 'Говорить',
    sendTitle: 'Отправить',
    closeWidgetTitle: 'Закрыть виджет',
    statsTitle: 'Открыть меню',
    cookieTitle: 'Cookies и телеметрия',
    cookieBody: 'Мы используем cookies и собираем данные использования, чтобы улучшать продукт. Никакой сторонней рекламы и ретаргетинга. Настройки можно изменить в любое время.',
    cookieStrict: 'Строго необходимые (всегда включены)',
    cookiePerf: 'Производительность (тайминги, ошибки)',
    cookieAnalytics: 'Аналитика (анонимное использование)',
    cookieMarketing: 'Маркетинг (выключено — не используется)',
    cookieAcceptAll: 'Принять все',
    cookieRejectAll: 'Отклонить все',
    cookieManage: 'Настроить',
    cookieSave: 'Сохранить',
    insightDefault: 'не указано',
    stageWaiting: 'Ожидание',
    stageIntro: 'Знакомство',
    stageCore: 'Основные параметры',
    stagePrimarySelection: 'Готов к первичному подбору',
    stageDetails: 'Уточнение деталей',
    stagePreciseSelection: 'Готов к точному подбору',
    assistantGreeting: 'Привет! Я подберу любые объекты под твой запрос. Чем подробнее расскажешь, что ищешь, тем точнее будет выбор. Готов начать? Поехали!'
  },
  UA: {
    inputPlaceholder: 'Поставте запитання...',
    recordingLabel: 'Йде запис',
    loadingText: 'Обробляю запит',
    menuLanguage: 'Обрати мову',
    menuThemeToLight: 'Світла тема',
    menuThemeToDark: 'Темна тема',
    appHeaderContact: "Зв'язатися",
    appHeaderOnline: 'Online',
    appHeaderAdminAria: 'Відкрити адмін-панель',
    appHeaderWishlistAria: 'Відкрити обране',
    accessAdminIcon: '👑',
    accessUserIcon: '♡',
    accessAdminGreeting: 'Вітаємо, {name} (@{username})! Ви в адмін-панелі',
    accessUserGreeting: 'Вітаємо, {name} (@{username})! Це ваш список обраного',
    accessAdminStats: 'Статистика',
    accessAdminProperties: "Мої об'єкти",
    accessAdminSubscription: 'Керування підпискою',
    accessAdminOlxConnect: 'Підключити OLX',
    accessAdminOlxConnected: 'OLX підключено (перепідключити)',
    accessAdminOlxChecking: 'Перевіряю OLX...',
    accessAdminOlxError: 'Не вдалося перевірити статус OLX',
    accessAdminOlxSuccessToast: 'OLX успішно підключено',
    accessAdminOlxFailedToast: 'Не вдалося підключити OLX',
    accessUserEmpty: "Тут з'являться об'єкти, які ви додасте до обраного (Wishlist)",
    consentText: "Я погоджуюся на обробку моїх даних для обробки цього запиту та зв'язку зі мною щодо нерухомості.",
    privacyPolicy: 'Політика конфіденційності',
    send: 'Надіслати',
    cancel: 'Скасувати',
    close: 'Закрити',
    continue: 'Продовжити',
    understood: 'Зрозуміло',
    thanksTitle: 'Дякуємо!',
    thanksBody: 'Вашу заявку отримано. Ми скоро з вами зв’яжемося.',
    leaveRequest: 'Залишити заявку',
    namePlaceholder: "Ім'я",
    phonePlaceholder: 'Телефон',
    emailPlaceholder: 'E-mail',
    cardShow: 'Показати',
    cardCancel: 'Скасувати',
    cardSelect: 'Обрати',
    cardNext: 'Ще одну',
    cardBackContact: "Зв'язатися",
    cardReadDescription: 'Опис',
    cardDescriptionTitle: "Опис об'єкта",
    cardDescriptionOk: 'OK',
    cardDescriptionEmpty: 'Опис поки недоступний',
    handoffMessage: 'Ви обрали об’єкт. Далі можна уточнити деталі або скасувати.',
    handoffDetails: 'Детальніше',
    pillCta: 'Дивитися добірку',
    pillNewInsight: 'Новий інсайт',
    pillFound: 'Знайдено {count} обʼєктів',
    sliderCheckpointTitle10: 'Ви переглянули 10 найкращих збігів',
    sliderCheckpointTitle20: 'Точність збігів знижується',
    sliderCheckpointText10: 'Далі будуть варіанти з частковою відповідністю. Хочете уточнити критерії або обговорити підбір з експертом?',
    sliderCheckpointText20: 'Далі йдуть варіанти з нижчою релевантністю. Уточнити запит чи зв’язатися з експертом?',
    sliderCheckpointRefine: 'Уточнити',
    sliderCheckpointContact: "Зв'язатися",
    backSpecsOverflowTitle: 'Додаткові деталі',
    backSpecsOverflowText: "На жаль, не вся інформація помістилася в цій картці. Щоб дізнатися додаткові деталі, ви можете зв’язатися з менеджером.",
    backSpecsOverflowContact: "Зв'язатися",
    backSpecsExtraType: 'Тип: апартаменти',
    backSpecsExtraMarket: 'Ринок: первинний',
    backSpecsExtraHandover: 'Здача: Q4 2027',
    backSpecsExtraFinish: 'Оздоблення: преміум',
    backSpecsExtraParking: 'Паркінг: 1 місце',
    backSpecsExtraTerrace: 'Тераса: є',
    contactManagerTitle: 'Оберіть контакт',
    contactMethodTelegram: 'Telegram',
    contactMethodPhone: 'Телефон',
    contactMethodEmail: 'Email',
    contactManagerAria: 'Вибір контакту',
    contactManagerErrorTelegram: 'Введіть Telegram username.',
    contactManagerPhoneMinDigits: 'Введіть коректний номер (мінімум 10 цифр)',
    inDialogLeadTitle: 'Залиште контакти',
    inDialogLeadNameLabel: "Ім'я",
    inDialogLeadPhoneLabel: 'Телефон',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: "Обов'язковий телефон або email",
    inDialogLeadConsentError: 'Прийміть Політику конфіденційності',
    invalidPhone: 'Некоректний номер телефону. Використайте 9-10 цифр після коду країни.',
    invalidEmail: 'Некоректний email. Приклад: name@domain.com',
    submitFailed: 'Не вдалося надіслати заявку. Спробуйте пізніше.',
    networkError: 'Помилка мережі. Перевірте підключення і спробуйте ще раз.',
    parseError: 'Не вдалося розібрати відповідь сервера',
    responseMissing: 'Відповідь від сервера не отримана.',
    sendTextError: 'Сталася помилка під час надсилання повідомлення. Спробуйте ще раз.',
    shortRecording: 'Запис занадто короткий',
    voiceMessageLabel: 'Голосове повідомлення ({seconds}с)',
    processingCardsError: 'Помилка під час обробки команди карток',
    noSavedSession: 'Немає збереженої сесії для відновлення',
    snapshotCorrupted: 'Знімок стану пошкоджений',
    restoreError: 'Помилка відновлення',
    sessionReset: 'Сесію скинуто',
    micErrorDuringRecord: 'Сталася помилка під час запису',
    recordingCancelled: 'Запис скасовано',
    micAccessDenied: 'Доступ до мікрофона заборонено',
    micNotFound: 'Мікрофон не знайдено',
    micBusy: 'Мікрофон уже використовується',
    micUnsupported: 'Налаштування мікрофона не підтримуються',
    micAccessError: 'Помилка доступу до мікрофона',
    speakTitle: 'Говорити',
    sendTitle: 'Надіслати',
    closeWidgetTitle: 'Закрити віджет',
    statsTitle: 'Відкрити меню',
    cookieTitle: 'Cookies і телеметрія',
    cookieBody: 'Ми використовуємо cookies та збираємо дані використання, щоб покращувати продукт. Жодної сторонньої реклами чи ретаргетингу. Налаштування можна змінити будь-коли.',
    cookieStrict: "Суворо необхідні (завжди ввімкнені)",
    cookiePerf: 'Продуктивність (таймінги, помилки)',
    cookieAnalytics: 'Аналітика (анонімне використання)',
    cookieMarketing: 'Маркетинг (вимкнено — не використовується)',
    cookieAcceptAll: 'Прийняти все',
    cookieRejectAll: 'Відхилити все',
    cookieManage: 'Налаштувати',
    cookieSave: 'Зберегти',
    insightDefault: 'не вказано',
    stageWaiting: 'Очікування',
    stageIntro: 'Знайомство',
    stageCore: 'Основні параметри',
    stagePrimarySelection: 'Готовий до первинного підбору',
    stageDetails: 'Уточнення деталей',
    stagePreciseSelection: 'Готовий до точного підбору',
    assistantGreeting: 'Привіт! Я підберу будь-які об’єкти під ваш запит. Чим детальніше розкажете, що шукаєте, тим точніший буде підбір. Готові почати? Поїхали!'
  }
};

class VoiceWidget extends HTMLElement {
  constructor() {
    super();
  }

  _initializeInstance() {
    if (this._initializedOnce) return;

    this.rootEl = this;
    this.classList.add('vw-app');
    this._theme = null;
    this._pendingThemeAttr = null;
    this.isTelegramWebApp = this.detectTelegramWebApp();
    this.classList.add('open');

    // базовые состояния
    this.isRecording = false;
    this.recordingTime = 0;
    this.maxRecordingTime = 60;
    this.minRecordingTime = 1;
    this.messages = [];
    this.mediaRecorder = null;
    this.stream = null;
    this.audioBlob = null;
    this.recordedChunks = [];
    this._deepLinkPropId = this.getDeepLinkPropIdFromUrl();
    this._activeDeepLinkPropId = null;
    this._isDeepLinkMode = false;
    this._sliderCheckpointShown = { 10: false, 20: false };
    /** @type {'slider'|'list'} */
    this._catalogDisplayMode = 'slider';
    this._catalogVisibleIds = [];
    this._catalogActiveId = null;
    this._catalogListWindowSize = 3;
    this._catalogListWindowStart = 0;
    this._catalogListScrollBound = false;
    this._pillState = 'default';
    this._pillBaseCount = 0;
    this._pillCtaTimer = null;
    this._lastPillInsightsSnapshot = null;
    this.accessRole = 'user';
    this.accessFlags = { isAdmin: false, isOwner: false, isSuperAdmin: false };
    this._accessOverlayOpen = false;
    this._filtersOverlayOpen = false;

    // ⚠️ больше НЕ создаём id на фронте — читаем если сохранён, иначе null
    this.sessionId = this.getInitialSessionId();
    
    // 🆕 Sprint I: server-side role (read-only, обновляется из server responses)
    this.role = null;
    this.supportedLanguages = ['UA', 'RU'];
    this.defaultLanguage = 'UA';
    this.currentLang = this.defaultLanguage;

    // параметры
    const attrApi = this.getAttribute('api-url') || '/api/audio/upload';
    const resolveApiUrl = (fallback) => {
      try {
        const fromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('vwApi') : null;
        const fromGlobal = typeof window !== 'undefined' ? window.__VW_API_URL__ : null;
        const fromStorage = (() => { try { return localStorage.getItem('vw_api_url'); } catch { return null; } })();
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocal = /^(localhost|127\.0\.0\.1|::1)$/i.test(host);
        if (fromQuery) return fromQuery;
        if (fromGlobal) return fromGlobal;
        if (fromStorage) return fromStorage;
        if (isLocal) return 'http://localhost:3001/api/audio/upload';
      } catch {}
      return fallback;
    };
    this.apiUrl = resolveApiUrl(attrApi);
    this.fieldName = this.getAttribute('field-name') || 'audio';
    this.responseField = this.getAttribute('response-field') || 'response';

    // модули
    this.events = new EventManager();
    this.audioRecorder = new AudioRecorder(this);
    this.understanding = new UnderstandingManager(this);
    this.ui = new UIManager(this);
    this.api = new APIClient(this);

    // Инициализация телеметрии
    const baseUrl = this.apiUrl.replace(/\/api\/audio\/upload\/?$/i, '');
    const sessionId = this.getInitialSessionId();
    initTelemetry({ baseUrl, sessionId });
    
    // Устанавливаем consent из localStorage при инициализации
    const consent = this.getConsent();
    if (consent && consent.selections) {
      setTelemetryConsent({ analytics: consent.selections.analytics === true });
    }

    this.render();
    this.bindEvents();
    this.checkBrowserSupport();
    this._uiInitializedOnce = false;
    this._initializedOnce = true;
  }

  normalizeDeepLinkPropId(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    const value = raw.replace(/\+/g, ' ').trim();
    const tokenMatch = value.match(/prop_([a-z0-9_-]+)/i);
    if (tokenMatch?.[1]) return String(tokenMatch[1]).trim().toUpperCase();
    const withoutPrefix = value.toLowerCase().startsWith(VW_DEEP_LINK_PREFIX)
      ? value.slice(VW_DEEP_LINK_PREFIX.length)
      : value;
    const idMatch = String(withoutPrefix || '').trim().match(/^([a-z0-9_-]+)$/i);
    return idMatch?.[1] ? idMatch[1].toUpperCase() : '';
  }

  readTelegramStartParam() {
    try {
      const fromUnsafe = window?.Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (fromUnsafe) return String(fromUnsafe).trim();
    } catch {}
    try {
      const initData = String(window?.Telegram?.WebApp?.initData || '').trim();
      if (initData) {
        const params = new URLSearchParams(initData);
        const startParam = params.get('start_param');
        if (startParam) return String(startParam).trim();
      }
    } catch {}
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQuery = qs.get('tgWebAppStartParam') || qs.get('start_param') || qs.get('startapp') || qs.get('start');
      if (fromQuery) return String(fromQuery).trim();
    } catch {}
    try {
      const hash = String(window.location.hash || '');
      const hashQuery = hash.includes('?') ? hash.split('?')[1] : hash.replace(/^#/, '');
      const params = new URLSearchParams(hashQuery);
      const fromHash = params.get('tgWebAppStartParam') || params.get('startapp');
      if (fromHash) return String(fromHash).trim();
    } catch {}
    return '';
  }

  getDeepLinkPropIdFromUrl() {
    const candidates = [];
    try {
      const params = new URLSearchParams(window.location.search);
      candidates.push(params.get(VW_DEEP_LINK_PARAM));
      candidates.push(params.get('startapp'));
      candidates.push(params.get('start'));
    } catch {}
    candidates.push(this.readTelegramStartParam());
    try {
      const href = String(window.location.href || '');
      const fromHref = href.match(/(?:startapp|start_param|tgWebAppStartParam)=([^&#]+)/i)?.[1] || '';
      if (fromHref) candidates.push(decodeURIComponent(fromHref));
      const propToken = href.match(/prop_[a-z0-9_-]+/i)?.[0] || '';
      if (propToken) candidates.push(propToken);
    } catch {}
    for (const value of candidates) {
      const normalized = this.normalizeDeepLinkPropId(value);
      if (normalized) return normalized;
    }
    return null;
  }

  clearDeepLinkParamInUrl() {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete(VW_DEEP_LINK_PARAM);
      currentUrl.searchParams.delete('startapp');
      currentUrl.searchParams.delete('start');
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    } catch {}
  }

  getCatalogPropertyById(propId) {
    if (!propId) return null;
    const target = String(propId).trim().toUpperCase();
    const list = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    return list.find((item) => String(item?.id || '').trim().toUpperCase() === target) || null;
  }

  async renderSinglePropertyById(propId) {
    let item = this.getCatalogPropertyById(propId);
    if (!item) {
      try {
        item = await this.api.fetchCardById(propId);
        if (item) this.mergePropertiesToCatalog([item]);
      } catch {}
    }
    if (!item) return false;
    this.clearPropertiesSlider();
    try {
      this.showChatScreen();
      this.showMockCardWithActions(this._toCardEngineShape(item), { suppressAutoscroll: false });
      this._isDeepLinkMode = true;
      this._activeDeepLinkPropId = String(propId).trim();
      return true;
    } catch {
      return false;
    }
  }

  async tryOpenDeepLinkedProperty() {
    const propId = this._deepLinkPropId || this.getDeepLinkPropIdFromUrl();
    this._deepLinkPropId = propId || null;
    if (!propId) return false;
    return await this.renderSinglePropertyById(propId);
  }

  exitDeepLinkMode({ clearUrl = true } = {}) {
    if (!this._isDeepLinkMode) return false;
    this._isDeepLinkMode = false;
    this._activeDeepLinkPropId = null;
    this._deepLinkPropId = null;
    if (clearUrl) this.clearDeepLinkParamInUrl();
    this.renderPropertiesFromCatalog().catch(() => {});
    return true;
  }

  buildTelegramPropertyLink(propId) {
    const safeId = this.normalizeDeepLinkPropId(propId);
    if (!safeId) return '';
    return `${VW_SHARE_BASE_URL}/share/prop/${encodeURIComponent(safeId)}`;
  }

  showShareNotice(message) {
    const text = String(message || '').trim();
    if (!text) return;
    try {
      const tg = window?.Telegram?.WebApp;
      if (tg && typeof tg.showAlert === 'function') {
        tg.showAlert(text);
        return;
      }
    } catch {}
    try { window.alert(text); } catch {}
  }

  async copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  async sharePropertyFromSlide(slide) {
    const card = slide?.querySelector('.cs');
    const propId = card?.getAttribute('data-variant-id') || '';
    if (!propId) return false;
    const source = this.getCatalogPropertyById(propId);
    const normalized = this.normalizeCardData(source || { id: propId });
    const titleLeft = [normalized.city, normalized.propertyType].filter(Boolean).join(', ') || 'Property';
    const title = normalized.priceLabel ? `${titleLeft} — ${normalized.priceLabel}` : titleLeft;
    const shareUrl = this.buildTelegramPropertyLink(propId);
    if (!shareUrl) return false;
    const payload = {
      title,
      text: 'Посмотри этот объект в моем боте:',
      url: shareUrl
    };
    try {
      if (navigator?.share) {
        await navigator.share(payload);
        this.showShareNotice('Успешно отправлено ✓');
        return true;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      console.warn('navigator.share failed, using clipboard fallback:', error);
    }
    const copied = await this.copyTextToClipboard(shareUrl);
    if (copied) {
      this.showShareNotice('Ссылка скопирована ✓');
      return true;
    }
    this.showShareNotice('Не удалось поделиться');
    return false;
  }

  sharePropertyToTelegram(slide) {
    const card = slide?.querySelector('.cs');
    const propId = card?.getAttribute('data-variant-id') || '';
    if (!propId) {
      console.warn('[TG Inline] missing property id for slide:', slide);
      return false;
    }
    const inlineTargetId = String(propId).trim();
    const inlineQuery = `share_prop_${inlineTargetId}`;
    console.log('[TG Inline] preparing inline query:', inlineQuery);
    const tg = window?.Telegram?.WebApp;
    const webAppVersion = String(tg?.version || 'unknown');
    const initDataPresent = Boolean(String(tg?.initData || '').trim());
    const chatType = tg?.initDataUnsafe?.chat_type || 'unknown';
    const queryId = tg?.initDataUnsafe?.query_id || '';
    console.log('[TG Inline] context:', { initDataPresent, chatType, hasQueryId: Boolean(queryId) });
    if (!tg || !initDataPresent) {
      this.showShareNotice('Inline share works only inside Telegram Mini App');
      return false;
    }
    try {
      console.log('WebApp Version:', webAppVersion);
      try { tg?.ready?.(); } catch {}
      // Prefer switchInlineQuery: in Mini App clients this path is generally the most stable.
      if (typeof tg?.switchInlineQuery === 'function') {
        try {
          tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
          console.log('[TG Inline] switchInlineQuery invoked successfully (with chooser filters)');
          return true;
        } catch (withFiltersError) {
          console.warn('[TG Inline] switchInlineQuery with filters failed:', withFiltersError);
          tg.switchInlineQuery(inlineQuery);
          console.log('[TG Inline] switchInlineQuery invoked successfully (fallback no filters)');
          return true;
        }
      }
      if (typeof tg?.switchInlineQueryChosenChat === 'function') {
        tg.switchInlineQueryChosenChat(inlineQuery, {
          allow_user_chats: true,
          allow_group_chats: true,
          allow_channel_chats: true
        });
        console.log('[TG Inline] switchInlineQueryChosenChat invoked successfully');
        return true;
      }
      if (typeof tg?.switchInlineQueryCurrentChat === 'function') {
        tg.switchInlineQueryCurrentChat(inlineQuery);
        console.log('[TG Inline] switchInlineQueryCurrentChat invoked successfully');
        return true;
      }
      const methodsState = {
        chosenChat: typeof tg?.switchInlineQueryChosenChat,
        switchInlineQuery: typeof tg?.switchInlineQuery,
        currentChat: typeof tg?.switchInlineQueryCurrentChat
      };
      console.warn('[TG Inline] no inline switch method available:', methodsState);
      this.showShareNotice(`Inline API unavailable (v${webAppVersion})`);
      return false;
    } catch (error) {
      const reason = error?.message || 'unknown error';
      console.warn('[TG Inline] inline switch call failed:', error);
      this.showShareNotice(`Inline share failed (v${webAppVersion}): ${reason}`);
      return false;
    }
  }

  detectTelegramWebApp() {
    try {
      return !!(window?.Telegram && window.Telegram.WebApp);
    } catch {
      return false;
    }
  }

  getRoot() {
    return this.rootEl || this;
  }

  $(selector) {
    return this.getRoot().querySelector(selector);
  }

  $all(selector) {
    return this.getRoot().querySelectorAll(selector);
  }

  $byId(id) {
    return this.getRoot().querySelector('#' + id);
  }

  $byIdFrom(root, id) {
    return root?.querySelector?.('#' + id) || null;
  }

  // берем id из localStorage (если ранее выдал сервер); иначе null
  getInitialSessionId() {
    try {
      return (
        localStorage.getItem('vw_sessionId') ||
        localStorage.getItem('voiceWidgetSessionId') ||
        null
      );
    } catch {
      return null;
    }
  }

  getInitialLanguage() {
    const normalize = (value) => {
      if (typeof value !== 'string') return null;
      const code = value.trim().slice(0, 2).toUpperCase();
      return this.supportedLanguages.includes(code) ? code : null;
    };

    try {
      const fromStorage = normalize(localStorage.getItem('vw_lang'));
      if (fromStorage) return fromStorage;
    } catch {}

    const fromDocument = normalize(document?.documentElement?.lang || '');
    if (fromDocument) return fromDocument;

    const fromNavigator = normalize(navigator?.language || '');
    if (fromNavigator) return fromNavigator;

    return this.defaultLanguage;
  }

  setLanguage(lang) {
    const normalized = typeof lang === 'string' ? lang.trim().slice(0, 2).toUpperCase() : '';
    const nextLang = this.supportedLanguages.includes(normalized) ? normalized : this.defaultLanguage;
    this.currentLang = nextLang;
    try {
      localStorage.setItem('vw_lang', nextLang);
    } catch {}
    console.log(`[VoiceWidget] Language changed to: ${nextLang}`);
    this.updateInterface();
  }

  switchLanguage() {
    const current = String(this.currentLang || this.defaultLanguage || 'RU').toUpperCase();
    const next = current === 'RU' ? 'UA' : 'RU';
    this.setLanguage(next);
  }

  getCurrentLocale() {
    return LOCALES[this.currentLang] || LOCALES[this.defaultLanguage] || LOCALES.UA;
  }

  t(key, params = null) {
    const locale = this.getCurrentLocale();
    let value = locale?.[key] ?? LOCALES[this.defaultLanguage]?.[key] ?? '';
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    return value;
  }

  updateInterface() {
    const root = this.getRoot();
    if (!root) return;
    const locale = this.getCurrentLocale();
    const setText = (selector, text) => {
      const el = root.querySelector(selector);
      if (el && typeof text === 'string') el.textContent = text;
    };
    const setTextAll = (selector, text) => {
      root.querySelectorAll(selector).forEach((el) => {
        if (typeof text === 'string') el.textContent = text;
      });
    };
    const setPlaceholder = (id, text) => {
      const el = this.$byIdFrom(root, id);
      if (el && typeof text === 'string') el.placeholder = text;
    };
    const setTitle = (id, text) => {
      const el = this.$byIdFrom(root, id);
      if (el && typeof text === 'string') el.setAttribute('title', text);
    };

    setPlaceholder('textInput', locale.inputPlaceholder);
    setPlaceholder('inDialogLeadName', locale.namePlaceholder);
    setPlaceholder('inDialogLeadPhone', locale.phonePlaceholder);
    setPlaceholder('inDialogLeadEmail', locale.emailPlaceholder);

    setText('#appContactButton', locale.appHeaderContact || 'Связаться');
    setText('#appOnlineText', locale.appHeaderOnline || 'Online');
    setText('#appLangButton', ['UA', 'RU'].includes(this.currentLang) ? this.currentLang : 'UA');
    this.updateAccessHeaderButton();
    setTextAll('.recording-label', locale.recordingLabel);
    setText('.loading-text', locale.loadingText);
    setTitle('toggleButton', locale.speakTitle);
    setTitle('sendButton', locale.sendTitle);
    root.querySelectorAll('.header-action.header-right').forEach((el) => el.setAttribute('title', locale.closeWidgetTitle));
    root.querySelectorAll('.header-action.header-left').forEach((el) => el.setAttribute('title', locale.statsTitle));

    const consentTextNodes = root.querySelectorAll('.in-dialog-lead__consent-text');
    consentTextNodes.forEach((node) => {
      const link = node.querySelector('a');
      if (link) link.textContent = locale.privacyPolicy;
      const textBeforeLink = `${locale.consentText} `;
      if (node.childNodes.length > 0) node.childNodes[0].textContent = textBeforeLink;
    });
    const cookieOverlay = this.$byIdFrom(root, 'cookieOverlay');
    if (cookieOverlay) {
      const title = cookieOverlay.querySelector('.data-title');
      const body = cookieOverlay.querySelector('.data-body');
      const strict = root.querySelector('#ccStrict + span');
      const perf = root.querySelector('#ccPerformance + span');
      const analytics = root.querySelector('#ccAnalytics + span');
      const marketing = root.querySelector('#ccMarketing + span');
      if (title) title.textContent = locale.cookieTitle;
      if (body && body.childNodes.length > 0) body.childNodes[0].textContent = `${locale.cookieBody} `;
      if (strict) strict.textContent = locale.cookieStrict;
      if (perf) perf.textContent = locale.cookiePerf;
      if (analytics) analytics.textContent = locale.cookieAnalytics;
      if (marketing) marketing.textContent = locale.cookieMarketing;
      setText('#cookieAcceptAllBtn', locale.cookieAcceptAll);
      setText('#cookieRejectAllBtn', locale.cookieRejectAll);
      setText('#cookieManageBtn', locale.cookieManage);
      setText('#cookieSaveBtn', locale.cookieSave);
    }

    // Keep pill label synchronized with current language even mid-conversation.
    this._refreshObjectsPillLocale({ animate: false });
    this.updateMenuUI();
  }

  getCurrentTelegramUser() {
    try {
      const tgUser = window?.Telegram?.WebApp?.initDataUnsafe?.user || null;
      if (!tgUser) return null;
      return {
        id: tgUser.id != null ? String(tgUser.id).trim() : null,
        username: tgUser.username ? String(tgUser.username).trim() : '',
        firstName: tgUser.first_name ? String(tgUser.first_name).trim() : '',
        lastName: tgUser.last_name ? String(tgUser.last_name).trim() : ''
      };
    } catch {
      return null;
    }
  }

  getBackendBaseUrl() {
    return String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '');
  }

  consumeOlxCallbackState() {
    try {
      const url = new URL(window.location.href);
      const olxState = String(url.searchParams.get('olx') || '').trim().toLowerCase();
      if (!olxState) return;
      if (olxState === 'connected') {
        this.ui?.showNotification?.(`✅ ${this.t('accessAdminOlxSuccessToast') || 'OLX successfully connected'}`);
      } else {
        this.ui?.showNotification?.(`⚠️ ${this.t('accessAdminOlxFailedToast') || 'OLX connection failed'}`);
      }
      url.searchParams.delete('olx');
      url.searchParams.delete('olx_reason');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  }

  buildOlxConnectUrl() {
    const backendBase = this.getBackendBaseUrl();
    if (!backendBase) return '';
    const tgUser = this.getCurrentTelegramUser();
    const url = new URL(`${backendBase}/api/olx/connect`);
    if (tgUser?.id) {
      url.searchParams.set('tgUserId', tgUser.id);
    }
    try {
      url.searchParams.set('returnTo', window.location.href);
    } catch {}
    return url.toString();
  }

  async refreshOlxStatusButton(button) {
    if (!button) return;
    const locale = this.getCurrentLocale();
    const tgUser = this.getCurrentTelegramUser();
    const backendBase = this.getBackendBaseUrl();

    if (!backendBase || !tgUser?.id) {
      button.textContent = locale.accessAdminOlxConnect || 'Connect OLX';
      button.disabled = false;
      return;
    }

    button.textContent = locale.accessAdminOlxChecking || 'Checking OLX...';
    button.disabled = true;
    try {
      const statusUrl = new URL(`${backendBase}/api/olx/status`);
      statusUrl.searchParams.set('tgUserId', tgUser.id);
      const response = await fetch(statusUrl.toString());
      const payload = await response.json().catch(() => ({}));
      const connected = Boolean(response.ok && payload?.ok && payload?.connected);
      button.textContent = connected
        ? (locale.accessAdminOlxConnected || 'OLX connected (reconnect)')
        : (locale.accessAdminOlxConnect || 'Connect OLX');
      button.disabled = false;
    } catch {
      button.textContent = locale.accessAdminOlxConnect || 'Connect OLX';
      button.disabled = false;
      this.ui?.showNotification?.(`⚠️ ${locale.accessAdminOlxError || 'Failed to check OLX status'}`);
    }
  }

  openOlxConnectFlow() {
    const url = this.buildOlxConnectUrl();
    if (!url) {
      this.ui?.showNotification?.('⚠️ OLX URL is not configured');
      return;
    }
    window.location.href = url;
  }

  updateAccessHeaderButton() {
    const btn = this.$byId('appThemeButton');
    if (!btn) return;
    const locale = this.getCurrentLocale();
    const isAdmin = this.accessRole === 'owner' || this.accessRole === 'super_admin' || this.accessFlags?.isAdmin === true;
    btn.disabled = false;
    btn.classList.remove('app-theme-btn--placeholder');
    btn.textContent = isAdmin ? (locale.accessAdminIcon || '👑') : (locale.accessUserIcon || '♡');
    btn.setAttribute('title', isAdmin ? (locale.appHeaderAdminAria || 'Открыть админ-панель') : (locale.appHeaderWishlistAria || 'Открыть избранное'));
    btn.setAttribute('aria-label', isAdmin ? (locale.appHeaderAdminAria || 'Открыть админ-панель') : (locale.appHeaderWishlistAria || 'Открыть избранное'));
  }

  setMobileViewportLock(enabled = false) {
    try {
      const meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;
      if (enabled) {
        if (this._viewportMetaOriginalContent == null) this._viewportMetaOriginalContent = meta.getAttribute('content') || '';
        meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      } else if (this._viewportMetaOriginalContent != null) {
        meta.setAttribute('content', this._viewportMetaOriginalContent || 'width=device-width, initial-scale=1');
      }
    } catch {}
  }

  closeAccessOverlay() {
    try {
      const overlay = this.getRoot().querySelector('#vwAccessOverlay');
      if (overlay?.parentElement) overlay.parentElement.removeChild(overlay);
      this._accessOverlayOpen = false;
    } catch {}
    try { this.closeAccessSubOverlay(); } catch {}
  }

  closeAccessSubOverlay() {
    try {
      const overlay = this.getRoot().querySelector('#vwAccessSubOverlay');
      try { overlay?._cleanupAddPropertyOverlay?.(); } catch {}
      if (overlay?.parentElement) overlay.parentElement.removeChild(overlay);
    } catch {}
    try { this.setMobileViewportLock(false); } catch {}
  }

  getAdminObjectsMockList() {
    const list = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    const usdRate = 41;
    const objects = list
      .map((item, idx) => {
        const id = String(item?.id || item?.variantId || item?._id || '').trim();
        if (!id) return null;
        const title = String(item?.title || item?.description || `Объект ${idx + 1}`).trim();
        const district = String(item?.district || item?.neighborhood || item?.city || '—').trim() || '—';
        const roomsRaw = Number(item?.rooms);
        const rooms = Number.isFinite(roomsRaw) && roomsRaw > 0 ? String(Math.round(roomsRaw)) : '—';
        const areaRaw = Number(item?.area_m2 || item?.area || item?.specs_area_m2);
        const area = Number.isFinite(areaRaw) && areaRaw > 0 ? `${Math.round(areaRaw)} м²` : '—';
        const priceUsdRaw = Number(item?.priceUSD || item?.price_usd || item?.priceUsd);
        const priceRaw = Number(item?.priceEUR || item?.price || item?.price_amount);
        const normalizedUsd = Number.isFinite(priceUsdRaw) && priceUsdRaw > 0
          ? Math.round(priceUsdRaw)
          : (Number.isFinite(priceRaw) && priceRaw > 0 ? Math.round(priceRaw / usdRate) : null);
        const price = Number.isFinite(normalizedUsd) && normalizedUsd > 0
          ? `$${normalizedUsd.toLocaleString('en-US')}`
          : '—';
        return { id, title, district, rooms, area, price };
      })
      .filter(Boolean);
    const uniq = new Map();
    objects.forEach((item) => {
      if (!uniq.has(item.id)) uniq.set(item.id, item);
    });
    const normalized = Array.from(uniq.values());
    return normalized.length
      ? normalized
      : [
          { id: 'OD050', title: 'Одеса, 2к квартира', district: 'Приморский', rooms: '2', area: '56 м²', price: '$79,000' },
          { id: 'OD049', title: 'Одеса, 1к квартира', district: 'Киевский', rooms: '1', area: '40 м²', price: '$51,000' },
          { id: 'OD048', title: 'Одеса, 3к квартира', district: 'Суворовский', rooms: '3', area: '84 м²', price: '$97,000' },
          { id: 'OD047', title: 'Одеса, пентхаус', district: 'Аркадия', rooms: '4', area: '130 м²', price: '$210,000' },
          { id: 'OD046', title: 'Одеса, смарт-квартира', district: 'Таирова', rooms: '1', area: '28 м²', price: '$33,000' }
        ];
  }

  updateAdminObjectsSelectionState(overlay) {
    if (!overlay) return;
    const rows = Array.from(overlay.querySelectorAll('.vw-access-obj-card'));
    const checks = rows.map((row) => row.querySelector('[data-role="row-check"]')).filter(Boolean);
    const selected = checks.filter((check) => check.checked).length;
    const shareBtn = overlay.querySelector('[data-role="share"]');
    const deleteBtn = overlay.querySelector('[data-role="delete-selected"]');
    if (shareBtn) {
      shareBtn.disabled = selected <= 0;
      shareBtn.textContent = selected > 0 ? `Поделиться (${selected})` : 'Поделиться';
    }
    if (deleteBtn) {
      deleteBtn.disabled = selected <= 0;
      deleteBtn.textContent = selected > 0 ? `Удалить (${selected})` : 'Удалить';
    }
  }

  openAccessSubOverlay(section = 'stats') {
    this.closeAccessSubOverlay();
    const list = this.getAdminObjectsMockList();
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
    const fmtDate = (d) => {
      try { return d.toLocaleDateString('ru-RU'); } catch { return ''; }
    };
    const safeSection = String(section || '').trim().toLowerCase();
    const isAddProperty = safeSection === 'add-property';
    const modalBody = (() => {
      if (isAddProperty) {
        return `
          <div class="vw-access-add-wizard" data-role="add-wizard" data-step="1">
            <input type="hidden" data-role="photo-input-target" value="">
            <input class="vw-access-add-file" data-role="photo-input" type="file" accept="image/*">
            <div class="vw-access-add-step" data-step-panel="1">
              <div class="vw-access-add-row2">
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="property-type" name="propertyType">
                    <option value="">* Тип недвижимости</option>
                    <option value="apartment">Квартира</option>
                    <option value="house">Дом</option>
                  </select>
                </label>
                <label class="vw-access-add-field">
                  <input class="vw-access-add-input vw-access-add-input--id" data-role="property-id" name="propertyId" value="A0001" readonly>
                </label>
              </div>
              <label class="vw-access-add-field">
                <input class="vw-access-add-input" type="text" name="title" data-role="title" placeholder="* Введите заголовок" autocomplete="off">
              </label>
              <div class="vw-access-add-hint">Можно добавить до 5 фотографий до 10мб каждая</div>
              <div class="vw-access-add-photo-layout">
                <button type="button" class="vw-access-add-photo-slot vw-access-add-photo-slot--main" data-role="photo-slot" data-slot="0" aria-label="Добавить фото 1"><span class="vw-access-add-photo-placeholder" aria-hidden="true">IMG</span></button>
                <div class="vw-access-add-photo-grid">
                  <button type="button" class="vw-access-add-photo-slot" data-role="photo-slot" data-slot="1" aria-label="Добавить фото 2"><span class="vw-access-add-photo-placeholder" aria-hidden="true">IMG</span></button>
                  <button type="button" class="vw-access-add-photo-slot" data-role="photo-slot" data-slot="2" aria-label="Добавить фото 3"><span class="vw-access-add-photo-placeholder" aria-hidden="true">IMG</span></button>
                  <button type="button" class="vw-access-add-photo-slot" data-role="photo-slot" data-slot="3" aria-label="Добавить фото 4"><span class="vw-access-add-photo-placeholder" aria-hidden="true">IMG</span></button>
                  <button type="button" class="vw-access-add-photo-slot" data-role="photo-slot" data-slot="4" aria-label="Добавить фото 5"><span class="vw-access-add-photo-placeholder" aria-hidden="true">IMG</span></button>
                </div>
              </div>
              <div class="vw-access-add-row2">
                <label class="vw-access-add-field">
                  <input class="vw-access-add-input" type="text" name="price" data-role="price" placeholder="* Укажите цену" autocomplete="off">
                </label>
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="rooms" name="rooms">
                    <option value="">* Количество комнат</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5+">5+</option>
                  </select>
                </label>
              </div>
              <div class="vw-access-add-row2">
                <label class="vw-access-add-field">
                  <input class="vw-access-add-input" type="text" name="area" data-role="area" placeholder="* Укажите площадь" autocomplete="off">
                </label>
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="district" name="district">
                    <option value="">* Укажите район</option>
                    <option value="Приморский">Приморский</option>
                    <option value="Суворовский">Суворовский</option>
                    <option value="Киевский">Киевский</option>
                    <option value="Малиновский">Малиновский</option>
                  </select>
                </label>
              </div>
              <div class="vw-access-add-actions">
                <button type="button" class="vw-access-sub-btn" data-role="add-draft">В черновик</button>
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="add-to-step-2">Продолжить</button>
              </div>
            </div>

            <div class="vw-access-add-step" data-step-panel="2">
              <div class="vw-access-add-row2">
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="floor" name="floor">
                    <option value="">Этаж</option>
                  </select>
                </label>
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="floors-total" name="floorsTotal">
                    <option value="">Этажность</option>
                  </select>
                </label>
              </div>
              <div class="vw-access-add-row2">
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="complex" name="complex">
                    <option value="">Название ЖК</option>
                    <option value="ЖК Альтаир">ЖК Альтаир</option>
                    <option value="ЖК Манхэттен">ЖК Манхэттен</option>
                    <option value="ЖК Омега">ЖК Омега</option>
                    <option value="ЖК Челси">ЖК Челси</option>
                    <option value="ЖК Ривьера">ЖК Ривьера</option>
                  </select>
                </label>
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="microdistrict" name="microdistrict">
                    <option value="">Микрорайон</option>
                    <option value="Черемушки">Черемушки</option>
                    <option value="Фонтан">Фонтан</option>
                    <option value="Таирова">Таирова</option>
                    <option value="Центр">Центр</option>
                    <option value="Аркадия">Аркадия</option>
                  </select>
                </label>
              </div>
              <div class="vw-access-add-check-grid">
                <label class="vw-access-add-check-item"><input type="checkbox" name="exclusive"><span>Эксклюзив</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="balcony"><span>Балкон</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="penthouse"><span>Пентхаус</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="loggia"><span>Лоджия</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="smartFlat"><span>Смарт-квартира</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="terrace"><span>Терраса</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="newbuilding"><span>Новострой</span></label>
                <label class="vw-access-add-check-item"><input type="checkbox" name="parking"><span>Паркоместо</span></label>
              </div>
              <label class="vw-access-add-field">
                <textarea class="vw-access-add-textarea" name="description" data-role="description" placeholder="Опишите квартиру"></textarea>
              </label>
              <div class="vw-access-add-actions">
                <button type="button" class="vw-access-sub-btn" data-role="add-draft">В черновик</button>
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="add-preview">Предпросмотр</button>
              </div>
            </div>

            <div class="vw-access-add-step" data-step-panel="3">
              <div class="vw-access-preview-card">
                <div class="vw-access-preview-media">
                  <img class="is-empty" data-role="preview-main-image" alt="preview">
                  <div class="vw-access-preview-id" data-role="preview-id">A0001</div>
                  <div class="vw-access-preview-thumbs">
                    <button type="button" class="vw-access-preview-thumb is-active" data-role="preview-thumb" data-thumb-index="0"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="1"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="2"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="3"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="4"></button>
                  </div>
                </div>
                <div class="vw-access-preview-body">
                  <div class="vw-access-preview-row">
                    <div class="vw-access-preview-title" data-role="preview-title">Одеса, apartment</div>
                    <div class="vw-access-preview-price" data-role="preview-price">0 UAH</div>
                  </div>
                  <div class="vw-access-preview-row">
                    <div class="vw-access-preview-district" data-role="preview-district">—</div>
                    <button type="button" class="vw-access-preview-desc-btn" data-role="preview-description-btn">Описание</button>
                  </div>
                  <div class="vw-access-preview-specs">
                    <span class="vw-access-preview-pill" data-role="preview-rooms">🛏️ 0 rooms</span>
                    <span class="vw-access-preview-pill" data-role="preview-area">📐 0 m²</span>
                    <span class="vw-access-preview-pill" data-role="preview-floor">🏢 0 floor</span>
                  </div>
                  <button type="button" class="vw-access-preview-more" disabled>Подробнее</button>
                </div>
              </div>
              <div class="vw-access-add-actions">
                <button type="button" class="vw-access-sub-btn" data-role="add-draft">В черновик</button>
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="add-publish-final">Опубликовать</button>
              </div>
            </div>

            <div class="vw-access-add-step" data-step-panel="4">
              <div class="vw-access-add-success">
                <div class="vw-access-add-success-title">Спасибо!</div>
                <div class="vw-access-add-success-text">Объявление добавлено на модерацию и появится после проверки.</div>
              </div>
              <div class="vw-access-add-actions">
                <button type="button" class="vw-access-sub-btn" data-role="add-more">Добавить ещё объект</button>
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="add-continue">Продолжить</button>
              </div>
            </div>
          </div>
        `;
      }
      if (safeSection === 'properties') {
        const rows = list.map((item) => `
          <article class="vw-access-obj-card" data-id="${item.id}" role="button" tabindex="0" aria-label="Выбрать ${item.id}">
            <label class="vw-access-obj-check" data-role="row-check-wrap"><input type="checkbox" data-role="row-check"></label>
            <div class="vw-access-obj-main">
              <div class="vw-access-obj-headline">
                <span class="vw-access-obj-id-badge">${item.id}</span>
                <h4 class="vw-access-obj-title">${item.title || '—'}</h4>
              </div>
              <div class="vw-access-obj-meta">${item.price} · ${item.area} · ${item.rooms} комн · ${item.district}</div>
            </div>
            <button type="button" class="vw-access-obj-edit" data-role="row-edit" aria-label="Редактировать объект">✎</button>
          </article>
        `).join('');
        return `
          <div class="vw-access-objects-layout">
            <div class="vw-access-objects-topbar">
              <div class="vw-access-objects-total">Всего объектов: <strong>${list.length}</strong></div>
              <button type="button" class="vw-access-sub-btn" data-role="sort-trigger">Сортировка</button>
            </div>
            <div class="vw-access-objects-scroll">
              <div class="vw-access-obj-list">${rows}</div>
            </div>
            <div class="vw-access-objects-bottombar">
              <button type="button" class="vw-access-sub-btn vw-access-add-dialog-btn is-danger" data-role="delete-selected" disabled>Удалить</button>
              <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="share" disabled>Поделиться</button>
            </div>
          </div>
        `;
      }
      if (safeSection === 'subscription') {
        return `
          <div class="vw-access-sub-list">
            <div class="vw-access-sub-item">Текущий план: <strong>PRO demo</strong></div>
            <div class="vw-access-sub-item">Дата подписки: <strong>${fmtDate(now)}</strong></div>
            <div class="vw-access-sub-item">Следующее списание: <strong>${fmtDate(nextMonth)}</strong></div>
            <div class="vw-access-sub-item">Статус: <strong>Активна</strong></div>
          </div>
        `;
      }
      return `
        <div class="vw-access-sub-list">
          <div class="vw-access-sub-item">Дата регистрации: <strong>${fmtDate(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 42))}</strong></div>
          <div class="vw-access-sub-item">Переходы в бота: <strong>173</strong></div>
          <div class="vw-access-sub-item">Объектов в подборке: <strong>${list.length}</strong></div>
          <div class="vw-access-sub-item">Активная подписка до: <strong>${fmtDate(nextMonth)}</strong></div>
        </div>
      `;
    })();

    const title = safeSection === 'properties'
      ? 'Мои объекты'
      : isAddProperty
        ? 'Новый объект'
      : safeSection === 'subscription'
        ? 'Управление подпиской'
        : 'Статистика';
    const modalHead = isAddProperty
      ? `
        <div class="vw-access-add-head">
          <button type="button" class="vw-access-sub-back" data-role="back">← Назад</button>
          <div class="vw-access-add-stage" data-role="add-stage">Основные параметры</div>
          <button type="button" class="vw-access-add-reset-head" data-role="add-reset-head" aria-label="Сбросить изменения">↺</button>
        </div>
      `
      : `
        <div class="vw-access-sub-head">
          <button type="button" class="vw-access-sub-back" data-role="back">← Назад</button>
          <div class="vw-access-sub-title">${title}</div>
          <span class="vw-access-sub-spacer" aria-hidden="true"></span>
        </div>
      `;

    const overlay = document.createElement('div');
    overlay.id = 'vwAccessSubOverlay';
    overlay.className = 'vw-access-sub-overlay';
    overlay.innerHTML = `
      <div class="vw-access-sub-modal ${isAddProperty ? 'vw-access-sub-modal--add' : ''} ${safeSection === 'properties' ? 'vw-access-sub-modal--properties' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        ${modalHead}
        ${modalBody}
      </div>
    `;
    this.getRoot().appendChild(overlay);
    if (isAddProperty) {
      try { this.setMobileViewportLock(true); } catch {}
    }
    overlay.querySelector('[data-role="back"]')?.addEventListener('click', () => {
      if (isAddProperty) {
        const wizard = overlay.querySelector('[data-role="add-wizard"]');
        const stageLabel = overlay.querySelector('[data-role="add-stage"]');
        const currentStep = Number(wizard?.getAttribute('data-step') || '1');
        if (wizard && currentStep > 1) {
          const prevStep = currentStep === 4 ? 3 : currentStep - 1;
          const labels = { 1: 'Основные параметры', 2: 'Дополнительно', 3: 'Предпросмотр', 4: 'Готово' };
          wizard.setAttribute('data-step', String(prevStep));
          if (stageLabel) stageLabel.textContent = labels[prevStep] || labels[1];
          return;
        }
        if (typeof overlay._showAddExitDialog === 'function') {
          overlay._showAddExitDialog();
          return;
        }
      }
      this.closeAccessSubOverlay();
    });
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      if (isAddProperty && typeof overlay._showAddExitDialog === 'function') {
        overlay._showAddExitDialog();
        return;
      }
      this.closeAccessSubOverlay();
    });

    if (safeSection === 'properties') {
      const getRows = () => Array.from(overlay.querySelectorAll('.vw-access-obj-card'));
      const getSelectedIds = () => getRows()
        .filter((row) => !!row.querySelector('[data-role="row-check"]')?.checked)
        .map((row) => String(row.getAttribute('data-id') || '').trim())
        .filter(Boolean);
      const showDeleteDialog = ({ count = 0, onConfirm = null } = {}) => {
        const layer = document.createElement('div');
        layer.className = 'vw-access-add-dialog-layer';
        layer.innerHTML = `
          <div class="vw-access-add-dialog">
            <div class="vw-access-add-dialog-title">Удалить выбранные объекты (${count})?</div>
            <div class="vw-access-add-dialog-actions">
              <button type="button" class="vw-access-add-dialog-btn is-danger" data-role="confirm-delete">Удалить</button>
              <button type="button" class="vw-access-add-dialog-btn is-primary" data-role="cancel-delete">Отмена</button>
            </div>
          </div>
        `;
        overlay.appendChild(layer);
        const close = () => { try { layer.remove(); } catch {} };
        layer.addEventListener('click', (event) => {
          if (event.target === layer) close();
        });
        layer.querySelector('[data-role="cancel-delete"]')?.addEventListener('click', close);
        layer.querySelector('[data-role="confirm-delete"]')?.addEventListener('click', async () => {
          close();
          try { await onConfirm?.(); } catch {}
        });
      };
      getRows().forEach((row) => {
        const check = row.querySelector('[data-role="row-check"]');
        const editBtn = row.querySelector('[data-role="row-edit"]');
        const checkWrap = row.querySelector('[data-role="row-check-wrap"]');
        const sync = () => {
          const selected = !!check?.checked;
          row.classList.toggle('is-selected', selected);
          this.updateAdminObjectsSelectionState(overlay);
        };
        check?.addEventListener('change', sync);
        checkWrap?.addEventListener('click', (event) => event.stopPropagation());
        editBtn?.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.ui?.showNotification?.('Редактирование объекта скоро будет доступно');
        });
        row.addEventListener('click', () => {
          if (!check) return;
          check.checked = !check.checked;
          sync();
        });
        row.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          if (!check) return;
          check.checked = !check.checked;
          sync();
        });
      });
      overlay.querySelector('[data-role="sort-trigger"]')?.addEventListener('click', () => {
        this.ui?.showNotification?.('Сортировка будет добавлена следующим шагом');
      });
      overlay.querySelector('[data-role="share"]')?.addEventListener('click', () => {
        this.ui?.showNotification?.('Список объектов подготовлен к шарингу (demo)');
      });
      overlay.querySelector('[data-role="delete-selected"]')?.addEventListener('click', () => {
        const selectedIds = getSelectedIds();
        if (!selectedIds.length) return;
        showDeleteDialog({
          count: selectedIds.length,
          onConfirm: async () => {
            const failed = [];
            const succeeded = [];
            for (let i = 0; i < selectedIds.length; i += 1) {
              const id = selectedIds[i];
              try {
                await this.api?.deleteManualProperty?.(id);
                succeeded.push(id);
              } catch (error) {
                failed.push({ id, code: String(error?.message || 'UNKNOWN') });
              }
            }
            const currentList = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
            window.appState.allProperties = currentList.filter((item) => {
              const id = String(item?.id || item?.variantId || item?._id || '').trim();
              return !succeeded.includes(id);
            });
            getRows().forEach((row) => {
              const id = String(row.getAttribute('data-id') || '').trim();
              if (succeeded.includes(id)) row.remove();
            });
            if (succeeded.length) {
              try {
                const all = await this.loadAllProperties();
                if (Array.isArray(all)) this.replacePropertiesCatalog(all);
              } catch {}
            }
            this.updateAdminObjectsSelectionState(overlay);
            if (!failed.length) {
              this.ui?.showNotification?.(`Удалено: ${succeeded.length}`);
              return;
            }
            if (!succeeded.length) {
              const hasForbidden = failed.some((x) => x.code.includes('FORBIDDEN_ADMIN_ONLY'));
              this.ui?.showNotification?.(hasForbidden ? 'Нет прав на удаление объектов' : 'Удаление не выполнено');
            } else {
              this.ui?.showNotification?.(`Удаление частично выполнено: ${succeeded.length}/${selectedIds.length}`);
            }
          }
        });
      });
      this.updateAdminObjectsSelectionState(overlay);
    }
    if (isAddProperty) {
      const modal = overlay.querySelector('.vw-access-sub-modal--add') || overlay.querySelector('.vw-access-sub-modal');
      const wizard = overlay.querySelector('[data-role="add-wizard"]');
      const stageLabel = overlay.querySelector('[data-role="add-stage"]');
      const formatThousands = (digits) => {
        const clean = String(digits || '').replace(/[^\d]/g, '');
        if (!clean) return '';
        return Number(clean).toLocaleString('en-US');
      };
      const steps = { 1: 'Основные параметры', 2: 'Дополнительно', 3: 'Предпросмотр', 4: 'Готово' };
      const draft = { photos: Array(5).fill(''), photoFiles: Array(5).fill(null) };
      const priceInput = overlay.querySelector('[data-role="price"]');
      const areaInput = overlay.querySelector('[data-role="area"]');
      const roomsInput = overlay.querySelector('[data-role="rooms"]');
      const districtInput = overlay.querySelector('[data-role="district"]');
      const titleInput = overlay.querySelector('[data-role="title"]');
      const typeInput = overlay.querySelector('[data-role="property-type"]');
      const idInput = overlay.querySelector('[data-role="property-id"]');
      const fileInput = overlay.querySelector('[data-role="photo-input"]');
      const targetInput = overlay.querySelector('[data-role="photo-input-target"]');
      const floorInput = overlay.querySelector('[data-role="floor"]');
      const floorsTotalInput = overlay.querySelector('[data-role="floors-total"]');
      const descriptionInput = overlay.querySelector('[data-role="description"]');
      const photoSlots = Array.from(overlay.querySelectorAll('[data-role="photo-slot"]'));
      const previewMainImage = overlay.querySelector('[data-role="preview-main-image"]');
      const previewThumbs = Array.from(overlay.querySelectorAll('[data-role="preview-thumb"]'));
      const textFields = Array.from(overlay.querySelectorAll('input[type="text"]:not([readonly]), textarea'));
      const focusableFields = Array.from(overlay.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([readonly]), textarea, select'));
      let activeField = null;
      const getKeyboardInset = () => {
        try {
          const vv = window.visualViewport;
          if (!vv) return 0;
          return Math.max(0, (window.innerHeight || 0) - (vv.height + vv.offsetTop));
        } catch {
          return 0;
        }
      };
      const updateKeyboardInset = () => {
        if (!modal) return;
        modal.style.setProperty('--vw-add-kb-inset', `${getKeyboardInset()}px`);
      };
      const keepFieldVisible = (field, smooth = true) => {
        if (!field || !modal) return;
        const rect = field.getBoundingClientRect();
        const vv = window.visualViewport;
        const top = vv ? vv.offsetTop : 0;
        const height = vv ? vv.height : window.innerHeight;
        const safeTop = top + 10;
        const safeBottom = top + height - 12;
        if (rect.top >= safeTop && rect.bottom <= safeBottom) return;
        const targetCenter = rect.top + (rect.height / 2);
        const viewportCenter = safeTop + ((safeBottom - safeTop) * 0.42);
        const delta = targetCenter - viewportCenter;
        const nextTop = Math.max(0, modal.scrollTop + delta);
        try { modal.scrollTo({ top: nextTop, behavior: smooth ? 'smooth' : 'auto' }); } catch { modal.scrollTop = nextTop; }
      };
      const onViewportChanged = () => {
        updateKeyboardInset();
        if (activeField) keepFieldVisible(activeField, false);
      };
      const vv = window.visualViewport;
      if (vv) {
        vv.addEventListener('resize', onViewportChanged);
        vv.addEventListener('scroll', onViewportChanged);
      }
      let lastTapAt = 0;
      const onModalTouchEnd = (event) => {
        const target = event.target;
        const isField = target?.closest?.('input, textarea, select, button, label');
        if (isField) {
          lastTapAt = Date.now();
          return;
        }
        const now = Date.now();
        if (now - lastTapAt < 300) event.preventDefault();
        lastTapAt = now;
      };
      modal?.addEventListener('touchend', onModalTouchEnd, { passive: false });
      const onFocusIn = (event) => {
        const target = event.target;
        if (!target || !focusableFields.includes(target)) return;
        activeField = target;
        updateKeyboardInset();
        requestAnimationFrame(() => keepFieldVisible(target, true));
        setTimeout(() => keepFieldVisible(target, true), 90);
        setTimeout(() => keepFieldVisible(target, false), 280);
      };
      const onFocusOut = (event) => {
        const target = event.target;
        if (target && activeField === target) activeField = null;
        setTimeout(() => updateKeyboardInset(), 60);
      };
      overlay.addEventListener('focusin', onFocusIn, true);
      overlay.addEventListener('focusout', onFocusOut, true);
      updateKeyboardInset();
      overlay._cleanupAddPropertyOverlay = () => {
        try { modal?.removeEventListener('touchend', onModalTouchEnd, { passive: false }); } catch {}
        try { overlay.removeEventListener('focusin', onFocusIn, true); } catch {}
        try { overlay.removeEventListener('focusout', onFocusOut, true); } catch {}
        try {
          const localVv = window.visualViewport;
          if (localVv) {
            localVv.removeEventListener('resize', onViewportChanged);
            localVv.removeEventListener('scroll', onViewportChanged);
          }
        } catch {}
      };
      const setStep = (step) => {
        const n = Number(step);
        const safeStep = n >= 1 && n <= 4 ? n : 1;
        wizard?.setAttribute('data-step', String(safeStep));
        if (stageLabel) stageLabel.textContent = steps[safeStep] || steps[1];
      };
      const getStep = () => Number(wizard?.getAttribute('data-step') || '1');
      const clearActiveDialogs = () => {
        overlay.querySelectorAll('.vw-access-add-dialog-layer').forEach((node) => node.remove());
      };
      const showActionDialog = ({ title = '', buttons = [] } = {}) => {
        clearActiveDialogs();
        const layer = document.createElement('div');
        layer.className = 'vw-access-add-dialog-layer';
        const buttonsHtml = buttons.map((btn, idx) => `
          <button type="button" class="vw-access-add-dialog-btn ${btn.variant ? `is-${btn.variant}` : ''}" data-action="${idx}">${btn.label}</button>
        `).join('');
        layer.innerHTML = `
          <div class="vw-access-add-dialog">
            <div class="vw-access-add-dialog-title">${title}</div>
            <div class="vw-access-add-dialog-actions">${buttonsHtml}</div>
          </div>
        `;
        overlay.appendChild(layer);
        layer.addEventListener('click', (event) => {
          if (event.target === layer) layer.remove();
        });
        buttons.forEach((btn, idx) => {
          layer.querySelector(`[data-action="${idx}"]`)?.addEventListener('click', () => {
            layer.remove();
            try { btn.onClick?.(); } catch {}
          });
        });
      };
      const appendFloorOptions = (selectEl, label) => {
        if (!selectEl) return;
        const opts = [`<option value="">${label}</option>`];
        for (let i = 1; i <= 30; i += 1) opts.push(`<option value="${i}">${i}</option>`);
        selectEl.innerHTML = opts.join('');
      };
      const typeMap = { apartment: 'apartment', house: 'house' };
      const resetForm = () => {
        overlay.querySelectorAll('input, textarea, select').forEach((el) => {
          if (el.matches('[readonly]') || el.getAttribute('data-role') === 'property-id') return;
          if (el.type === 'checkbox') el.checked = false;
          else if (el.tagName === 'SELECT') el.selectedIndex = 0;
          else el.value = '';
        });
        draft.photos = Array(5).fill('');
        draft.photoFiles = Array(5).fill(null);
        photoSlots.forEach((slot) => updateSlot(slot, '', ''));
        clearActiveDialogs();
        setStep(1);
      };
      const collectCurrentDraftState = () => {
        const values = {};
        overlay.querySelectorAll('input, textarea, select').forEach((el) => {
          const role = String(el.getAttribute('data-role') || '').trim();
          if (!role || role === 'photo-input' || role === 'photo-input-target') return;
          if (el.type === 'checkbox') values[role] = !!el.checked;
          else values[role] = String(el.value || '');
        });
        const checks = {};
        overlay.querySelectorAll('.vw-access-add-check-grid input[type="checkbox"][name]').forEach((el) => {
          const name = String(el.getAttribute('name') || '').trim();
          if (!name) return;
          checks[name] = !!el.checked;
        });
        return {
          values,
          checks,
          photos: [...draft.photos],
          photoFiles: [...draft.photoFiles],
          step: getStep()
        };
      };
      const applyDraftState = (saved) => {
        if (!saved || typeof saved !== 'object') return;
        const values = saved.values && typeof saved.values === 'object' ? saved.values : {};
        overlay.querySelectorAll('input, textarea, select').forEach((el) => {
          const role = String(el.getAttribute('data-role') || '').trim();
          if (!role || role === 'photo-input' || role === 'photo-input-target') return;
          if (!(role in values)) return;
          if (el.matches('[readonly]')) return;
          if (el.type === 'checkbox') el.checked = !!values[role];
          else el.value = String(values[role] || '');
        });
        if (Array.isArray(saved.photos)) {
          draft.photos = saved.photos.slice(0, 5);
          while (draft.photos.length < 5) draft.photos.push('');
          photoSlots.forEach((slot, idx) => {
            const src = draft.photos[idx] || '';
            updateSlot(slot, src ? `photo_${idx + 1}` : '', src);
          });
        }
        if (Array.isArray(saved.photoFiles)) {
          draft.photoFiles = saved.photoFiles.slice(0, 5);
          while (draft.photoFiles.length < 5) draft.photoFiles.push(null);
        }
        if (saved.checks && typeof saved.checks === 'object') {
          overlay.querySelectorAll('.vw-access-add-check-grid input[type="checkbox"][name]').forEach((el) => {
            const name = String(el.getAttribute('name') || '').trim();
            if (!name || !(name in saved.checks)) return;
            el.checked = !!saved.checks[name];
          });
        }
        const step = Number(saved.step || 1);
        setStep(step >= 1 && step <= 3 ? step : 1);
      };
      const hasUnsavedChanges = () => {
        if (draft.photos.some(Boolean)) return true;
        const inputs = Array.from(overlay.querySelectorAll('input, textarea, select'));
        return inputs.some((el) => {
          if (el.matches('[readonly]')) return false;
          if (el.type === 'hidden' || el.type === 'file') return false;
          if (el.type === 'checkbox') return !!el.checked;
          if (el.tagName === 'SELECT') return el.selectedIndex > 0 && String(el.value || '').trim().length > 0;
          return String(el.value || '').trim().length > 0;
        });
      };
      const saveDraftAndExit = () => {
        this._addPropertyDraft = collectCurrentDraftState();
        this.ui?.showNotification?.('Черновик сохранен');
        this.closeAccessSubOverlay();
      };
      const clearDraftAndExit = () => {
        this._addPropertyDraft = null;
        this.closeAccessSubOverlay();
      };
      overlay._showAddExitDialog = () => {
        if (!hasUnsavedChanges()) {
          this.closeAccessSubOverlay();
          return;
        }
        showActionDialog({
          title: 'Объявление не опубликовано. Что сделать?',
          buttons: [
            { label: 'Продолжить редактирование', variant: 'primary', onClick: () => {} },
            { label: 'Сохранить в черновик', variant: 'neutral', onClick: saveDraftAndExit },
            { label: 'Выйти без сохранения', variant: 'danger', onClick: clearDraftAndExit }
          ]
        });
      };
      const showResetDialog = () => {
        if (!hasUnsavedChanges()) return;
        showActionDialog({
          title: 'Сбросить все изменения?',
          buttons: [
            { label: 'Сбросить изменения', variant: 'danger', onClick: resetForm },
            { label: 'Продолжить редактирование', variant: 'primary', onClick: () => {} }
          ]
        });
      };
      const getDraftData = () => {
        const areaRaw = String(areaInput?.value || '').replace(/\s*м²$/i, '').trim();
        const pickCheck = (name) => !!overlay.querySelector(`.vw-access-add-check-grid input[name="${name}"]`)?.checked;
        return {
          id: String(idInput?.value || 'A0001').trim() || 'A0001',
          title: String(titleInput?.value || '').trim() || 'Одеса, apartment',
          district: String(districtInput?.value || '').trim() || '—',
          price: String(priceInput?.value || '').trim() || '0',
          rooms: String(roomsInput?.value || '').trim() || '0',
          area: areaRaw || '0',
          floor: String(floorInput?.value || '').trim() || '0',
          floorsTotal: String(floorsTotalInput?.value || '').trim() || '',
          complex: String(overlay.querySelector('[data-role="complex"]')?.value || '').trim() || '',
          microdistrict: String(overlay.querySelector('[data-role="microdistrict"]')?.value || '').trim() || '',
          description: String(descriptionInput?.value || '').trim() || 'Описание не добавлено.',
          type: typeMap[String(typeInput?.value || '')] || 'apartment',
          photos: draft.photos.filter(Boolean),
          photoFiles: draft.photoFiles.filter((f) => f instanceof File),
          checks: {
            exclusive: pickCheck('exclusive'),
            balcony: pickCheck('balcony'),
            penthouse: pickCheck('penthouse'),
            loggia: pickCheck('loggia'),
            smartFlat: pickCheck('smartFlat'),
            terrace: pickCheck('terrace'),
            newbuilding: pickCheck('newbuilding'),
            parking: pickCheck('parking')
          }
        };
      };
      const refreshMainImage = (src = '') => {
        if (!previewMainImage) return;
        if (src) {
          previewMainImage.src = src;
          previewMainImage.classList.remove('is-empty');
          return;
        }
        previewMainImage.removeAttribute('src');
        previewMainImage.classList.add('is-empty');
      };
      const renderPreview = () => {
        const data = getDraftData();
        const fmtPrice = `${String(data.price || '0').replace(/[^\d]/g, '') || '0'}`
          .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const imageList = data.photos.length ? data.photos : [''];
        overlay.querySelector('[data-role="preview-id"]') && (overlay.querySelector('[data-role="preview-id"]').textContent = data.id);
        overlay.querySelector('[data-role="preview-title"]') && (overlay.querySelector('[data-role="preview-title"]').textContent = `Одеса, ${data.type}`);
        overlay.querySelector('[data-role="preview-price"]') && (overlay.querySelector('[data-role="preview-price"]').textContent = `${fmtPrice} UAH`);
        overlay.querySelector('[data-role="preview-district"]') && (overlay.querySelector('[data-role="preview-district"]').textContent = data.district);
        overlay.querySelector('[data-role="preview-rooms"]') && (overlay.querySelector('[data-role="preview-rooms"]').textContent = `🛏️ ${data.rooms} rooms`);
        overlay.querySelector('[data-role="preview-area"]') && (overlay.querySelector('[data-role="preview-area"]').textContent = `📐 ${data.area} m²`);
        overlay.querySelector('[data-role="preview-floor"]') && (overlay.querySelector('[data-role="preview-floor"]').textContent = `🏢 ${data.floor} floor`);
        previewThumbs.forEach((thumb, idx) => {
          const src = imageList[idx] || '';
          thumb.classList.toggle('is-filled', !!src);
          thumb.classList.toggle('is-active', idx === 0);
          thumb.style.backgroundImage = src ? `url("${src}")` : 'none';
        });
        refreshMainImage(imageList[0] || '');
      };
      const setFieldError = (fieldEl, message) => {
        if (!fieldEl) return;
        const host = fieldEl.parentElement;
        if (!host) return;
        if (!fieldEl.dataset.defaultPlaceholder) {
          fieldEl.dataset.defaultPlaceholder = String(fieldEl.getAttribute('placeholder') || '');
        }
        host.classList.add('is-invalid');
        fieldEl.setAttribute('placeholder', message || 'Введите цифры');
      };
      const clearFieldError = (fieldEl) => {
        if (!fieldEl) return;
        const host = fieldEl.parentElement;
        if (!host) return;
        host.classList.remove('is-invalid');
        if (fieldEl.dataset.defaultPlaceholder != null) {
          fieldEl.setAttribute('placeholder', fieldEl.dataset.defaultPlaceholder);
        }
      };
      const attachInlineFieldActions = (fieldEl, options = {}) => {
        if (!fieldEl || fieldEl.dataset.inlineActionsAttached === '1') return;
        const host = fieldEl.parentElement;
        if (!host) return;
        host.classList.add('vw-access-add-field--with-actions');
        const isTextarea = fieldEl.tagName === 'TEXTAREA';
        if (isTextarea) host.classList.add('is-textarea');
        const actions = document.createElement('div');
        actions.className = 'vw-access-add-input-actions';
        actions.innerHTML = `
          <button type="button" class="vw-access-add-input-action" data-role="field-clear" aria-label="Сброс">×</button>
          <button type="button" class="vw-access-add-input-action" data-role="field-apply" aria-label="Подтвердить">✓</button>
        `;
        host.appendChild(actions);
        const clearBtn = actions.querySelector('[data-role="field-clear"]');
        const applyBtn = actions.querySelector('[data-role="field-apply"]');
        actions.addEventListener('mousedown', (event) => {
          event.preventDefault();
        });
        const sync = () => {
          const hasValue = String(fieldEl.value || '').trim().length > 0;
          const isFocused = document.activeElement === fieldEl;
          host.classList.toggle('show-actions', isFocused && hasValue);
        };
        clearBtn?.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          fieldEl.value = '';
          clearFieldError(fieldEl);
          try { options.onClear?.(fieldEl); } catch {}
          fieldEl.dispatchEvent(new Event('input', { bubbles: true }));
          fieldEl.dispatchEvent(new Event('change', { bubbles: true }));
          try { fieldEl.blur(); } catch {}
          sync();
        });
        applyBtn?.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          clearFieldError(fieldEl);
          let canApply = true;
          try { canApply = options.onApply ? options.onApply(fieldEl) !== false : true; } catch { canApply = false; }
          if (!canApply) {
            try { fieldEl.focus(); } catch {}
            sync();
            return;
          }
          fieldEl.dispatchEvent(new Event('change', { bubbles: true }));
          try { fieldEl.blur(); } catch {}
          host.classList.add('is-applied');
          setTimeout(() => host.classList.remove('is-applied'), 260);
          sync();
        });
        fieldEl.addEventListener('input', () => {
          clearFieldError(fieldEl);
          try { options.onInput?.(fieldEl); } catch {}
          sync();
        });
        fieldEl.addEventListener('focus', sync);
        fieldEl.addEventListener('blur', sync);
        sync();
        fieldEl.dataset.inlineActionsAttached = '1';
      };
      textFields.forEach((fieldEl) => {
        if (fieldEl === priceInput) {
          attachInlineFieldActions(fieldEl, {
            onApply: (el) => {
              const raw = String(el.value || '').trim();
              if (!raw) return true;
              if (/[^\d\s,.\u00A0]/.test(raw)) {
                setFieldError(el, 'Введите цифры');
                return false;
              }
              const digits = raw.replace(/[^\d]/g, '');
              if (!digits) {
                setFieldError(el, 'Введите цифры');
                return false;
              }
              el.value = formatThousands(digits);
              return true;
            }
          });
          return;
        }
        if (fieldEl === areaInput) {
          attachInlineFieldActions(fieldEl, {
            onInput: (el) => {
              el.value = String(el.value || '').replace(/\s*м²$/i, '');
            },
            onApply: (el) => {
              const raw = String(el.value || '').replace(/\s*м²$/i, '').trim();
              if (!raw) return true;
              if (/[^\d\s,.\u00A0]/.test(raw)) {
                setFieldError(el, 'Введите цифры');
                return false;
              }
              const digits = raw.replace(/[^\d]/g, '');
              if (!digits) {
                setFieldError(el, 'Введите цифры');
                return false;
              }
              el.value = `${formatThousands(digits)} м²`;
              return true;
            }
          });
          fieldEl.addEventListener('focus', () => {
            fieldEl.value = String(fieldEl.value || '').replace(/\s*м²$/i, '');
          });
          return;
        }
        attachInlineFieldActions(fieldEl);
      });
      appendFloorOptions(floorInput, 'Этаж');
      appendFloorOptions(floorsTotalInput, 'Этажность');
      try { applyDraftState(this._addPropertyDraft); } catch {}
      const updateSlot = (slot, fileName, imageData) => {
        if (!slot) return;
        if (!fileName) {
          slot.classList.remove('is-filled');
          slot.style.backgroundImage = 'none';
          slot.innerHTML = '<span class="vw-access-add-photo-placeholder" aria-hidden="true">IMG</span>';
          return;
        }
        slot.classList.add('is-filled');
        if (imageData) slot.style.backgroundImage = `url("${imageData}")`;
        slot.innerHTML = '';
      };
      photoSlots.forEach((slot) => {
        slot.addEventListener('click', () => {
          if (!fileInput || !targetInput) return;
          targetInput.value = String(slot.getAttribute('data-slot') || '');
          fileInput.click();
        });
      });
      fileInput?.addEventListener('change', () => {
        const index = Number(targetInput?.value || '-1');
        const file = fileInput?.files?.[0];
        if (!Number.isFinite(index) || index < 0 || !file) return;
        draft.photoFiles[index] = file;
        const reader = new FileReader();
        reader.onload = () => {
          const imageData = typeof reader.result === 'string' ? reader.result : '';
          draft.photos[index] = imageData;
          updateSlot(photoSlots[index], file.name, imageData);
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });
      previewThumbs.forEach((thumb) => {
        thumb.addEventListener('click', () => {
          const idx = Number(thumb.getAttribute('data-thumb-index') || '0');
          const src = draft.photos[idx] || '';
          previewThumbs.forEach((btn, i) => btn.classList.toggle('is-active', i === idx));
          refreshMainImage(src);
        });
      });
      overlay.querySelector('[data-role="add-to-step-2"]')?.addEventListener('click', () => {
        setStep(2);
      });
      overlay.querySelectorAll('[data-role="add-draft"]').forEach((btn) => {
        btn.addEventListener('click', () => saveDraftAndExit());
      });
      overlay.querySelector('[data-role="add-preview"]')?.addEventListener('click', () => {
        renderPreview();
        setStep(3);
      });
      overlay.querySelector('[data-role="add-reset-head"]')?.addEventListener('click', () => showResetDialog());
      overlay.querySelector('[data-role="preview-description-btn"]')?.addEventListener('click', () => {
        const text = getDraftData().description;
        this.ui?.showNotification?.(text.length > 90 ? `${text.slice(0, 90)}...` : text);
      });
      const publish = async () => {
        const publishBtn = overlay.querySelector('[data-role="add-publish-final"]');
        const originalLabel = publishBtn?.textContent || 'Опубликовать';
        try {
          if (publishBtn) {
            publishBtn.disabled = true;
            publishBtn.textContent = 'Публикуем...';
          }
          const data = getDraftData();
          const payload = {
            mode: 'publish',
            title: data.title,
            description: data.description,
            propertyType: data.type,
            district: data.district === '—' ? '' : data.district,
            microdistrict: data.microdistrict,
            complex: data.complex,
            price: String(data.price || '').replace(/[^\d]/g, ''),
            rooms: data.rooms,
            area: String(data.area || '').replace(/[^\d]/g, ''),
            floor: data.floor,
            floorsTotal: data.floorsTotal,
            ...data.checks
          };
          const response = await this.api?.createManualProperty?.(payload, data.photoFiles);
          const created = response?.property;
          if (created) {
            this.mergePropertiesToCatalog([created]);
            try {
              const all = await this.loadAllProperties();
              if (Array.isArray(all) && all.length) this.replacePropertiesCatalog(all);
            } catch {}
          }
          this._addPropertyDraft = null;
          clearActiveDialogs();
          setStep(4);
          this.ui?.showNotification?.('Объект опубликован');
        } catch (error) {
          const msg = String(error?.message || '');
          const hint = msg.includes('FORBIDDEN_ADMIN_ONLY')
            ? 'Нет прав администратора для публикации'
            : (msg.includes('IMAGE_TOO_LARGE_MAX_5MB')
              ? 'Фото > 5MB. Уменьшите размер'
              : 'Не удалось опубликовать объект');
          this.ui?.showNotification?.(hint);
        } finally {
          if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.textContent = originalLabel;
          }
        }
      };
      overlay.querySelector('[data-role="add-publish-final"]')?.addEventListener('click', publish);
      overlay.querySelector('[data-role="add-more"]')?.addEventListener('click', () => {
        this._addPropertyDraft = null;
        resetForm();
      });
      overlay.querySelector('[data-role="add-continue"]')?.addEventListener('click', () => {
        this._addPropertyDraft = null;
        this.closeAccessSubOverlay();
      });
      if (!this._addPropertyDraft) setStep(1);
    }
  }

  closeFiltersOverlay() {
    try {
      const overlay = this.getRoot().querySelector('#vwFiltersOverlay');
      if (overlay?.parentElement) overlay.parentElement.removeChild(overlay);
      this._filtersOverlayOpen = false;
      this.$byId('pillFiltersButton')?.setAttribute('aria-expanded', 'false');
    } catch {}
  }

  formatPickerNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('ru-RU');
  }

  buildFilterPickerOptions(type) {
    const opts = [];
    if (type === 'priceMin' || type === 'priceMax') {
      if (type === 'priceMin') opts.push({ value: '', label: 'Цена от' });
      if (type === 'priceMax') opts.push({ value: 'max', label: 'Макс' });
      for (let v = 0; v <= 1000000; v += 1000) {
        opts.push({ value: String(v), label: this.formatPickerNumber(v) });
      }
      return opts;
    }
    if (type === 'areaMin' || type === 'areaMax') {
      if (type === 'areaMin') opts.push({ value: '', label: 'Метраж от' });
      if (type === 'areaMax') opts.push({ value: 'max', label: 'Макс' });
      for (let v = 0; v <= 350; v += 1) {
        opts.push({ value: String(v), label: `${v} м²` });
      }
      return opts;
    }
    if (type === 'floorMin' || type === 'floorMax') {
      if (type === 'floorMin') opts.push({ value: '', label: 'Этаж от' });
      if (type === 'floorMax') opts.push({ value: 'max', label: 'Макс' });
      for (let v = 0; v <= 30; v += 1) {
        opts.push({ value: String(v), label: String(v) });
      }
      return opts;
    }
    return opts;
  }

  fillFilterPickerSelect(selectEl, type) {
    if (!selectEl) return;
    const options = this.buildFilterPickerOptions(type);
    selectEl.innerHTML = options.map((opt) => `<option value="${String(opt.value).replace(/"/g, '&quot;')}">${String(opt.label)}</option>`).join('');
  }

  normalizeFilterRangePair(overlay, base, changed = '') {
    const minSel = overlay.querySelector(`select[data-picker="${base}Min"]`);
    const maxSel = overlay.querySelector(`select[data-picker="${base}Max"]`);
    if (!minSel || !maxSel) return;
    const minVal = minSel.value;
    const maxVal = maxSel.value;
    if (!minVal || !maxVal || maxVal === 'max') return;
    const minNum = Number(minVal);
    const maxNum = Number(maxVal);
    if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return;
    if (minNum <= maxNum) return;
    if (String(changed).toLowerCase().endsWith('min')) maxSel.value = minVal;
    else minSel.value = maxVal;
  }

  syncFilterPickerLabels(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll('[data-display]').forEach((labelEl) => {
      const picker = String(labelEl.getAttribute('data-display') || '').trim();
      const selectEl = overlay.querySelector(`select[data-picker="${picker}"]`);
      if (!selectEl) return;
      const selected = selectEl.options[selectEl.selectedIndex];
      labelEl.textContent = selected ? selected.textContent : labelEl.textContent;
    });
  }

  collectFiltersOverlayPayload(overlay) {
    const read = (name) => String(overlay.querySelector(`select[data-picker="${name}"]`)?.value || '');
    return {
      priceFrom: read('priceMin'),
      priceTo: read('priceMax'),
      areaFrom: read('areaMin'),
      areaTo: read('areaMax'),
      floorFrom: read('floorMin'),
      floorTo: read('floorMax'),
      rooms: String(overlay.querySelector('[data-role="rooms"]')?.value || ''),
      smart: !!overlay.querySelector('[data-role="smart"]')?.checked,
      district: String(overlay.querySelector('[data-role="district"]')?.value || ''),
      arcadia: !!overlay.querySelector('[data-role="arcadia"]')?.checked,
      residentialComplexOnly: !!overlay.querySelector('[data-role="rcOnly"]')?.checked,
      residentialComplex: String(overlay.querySelector('[data-role="rcSearch"]')?.value || '')
    };
  }

  resetFiltersOverlayForm(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll('select[data-picker]').forEach((sel) => { sel.selectedIndex = 0; });
    const rooms = overlay.querySelector('[data-role="rooms"]');
    if (rooms) rooms.selectedIndex = 0;
    const district = overlay.querySelector('[data-role="district"]');
    if (district) district.selectedIndex = 0;
    const rcSearch = overlay.querySelector('[data-role="rcSearch"]');
    if (rcSearch) rcSearch.selectedIndex = 0;
    const smart = overlay.querySelector('[data-role="smart"]');
    const arcadia = overlay.querySelector('[data-role="arcadia"]');
    const rcOnly = overlay.querySelector('[data-role="rcOnly"]');
    if (smart) smart.checked = false;
    if (arcadia) arcadia.checked = false;
    if (rcOnly) rcOnly.checked = false;
    this.syncFilterPickerLabels(overlay);
  }

  bindFiltersOverlayEvents(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll('select[data-picker]').forEach((selectEl) => {
      selectEl.addEventListener('change', () => {
        const picker = String(selectEl.getAttribute('data-picker') || '');
        if (picker.startsWith('price')) this.normalizeFilterRangePair(overlay, 'price', picker);
        if (picker.startsWith('area')) this.normalizeFilterRangePair(overlay, 'area', picker);
        if (picker.startsWith('floor')) this.normalizeFilterRangePair(overlay, 'floor', picker);
        this.syncFilterPickerLabels(overlay);
      });
    });
    overlay.querySelector('[data-role="reset"]')?.addEventListener('click', () => {
      this.resetFiltersOverlayForm(overlay);
    });
    overlay.querySelector('[data-role="apply"]')?.addEventListener('click', () => {
      const payload = this.collectFiltersOverlayPayload(overlay);
      console.log('filters.apply', payload);
      this.ui?.showNotification?.('Фильтры применены (demo)');
      this.closeFiltersOverlay();
    });
  }

  ensureFiltersOverlayStyles() {
    if (document.getElementById('vw-filters-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'vw-filters-overlay-styles';
    style.textContent = `
      .vw-filters-overlay {
        position: fixed;
        inset: 0;
        z-index: 1300;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.56);
        padding: 16px;
      }
      .vw-filters-modal {
        width: min(420px, 100%);
        border-radius: 16px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 90%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: var(--text-primary, #fff);
        padding: 14px;
        display: grid;
        gap: 12px;
      }
      .vw-filters-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .vw-filters-title {
        font-size: .9rem;
        font-weight: 600;
        color: var(--text-secondary, rgba(255,255,255,0.75));
      }
      .vw-filters-close {
        width: 30px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        cursor: pointer;
      }
      .vw-filters-list {
        display: grid;
        gap: 16px;
        --vw-filters-right-col: clamp(132px, 34%, 176px);
      }
      .vw-filters-picker-row {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) var(--vw-filters-right-col);
        gap: 8px;
        align-items: center;
      }
      .vw-filters-picker-icon {
        width: 44px;
        height: 44px;
        border-radius: 999px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
      }
      .vw-filters-picker-field {
        position: relative;
        display: grid;
        align-items: center;
        min-height: 40px;
        padding: 0 12px;
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
      }
      .vw-filters-picker-label {
        font-size: .93rem;
        color: var(--text-secondary, rgba(255,255,255,0.72));
      }
      .vw-filters-picker-select {
        position: absolute;
        inset: 0;
        opacity: 0;
        width: 100%;
        height: 100%;
      }
      .vw-filters-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--vw-filters-right-col);
        gap: 8px;
        align-items: center;
      }
      .vw-filters-select {
        width: 100%;
        height: 100%;
        border-radius: 12px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 0 12px;
        font-size: .93rem;
      }
      .vw-filters-check {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 40px;
        box-sizing: border-box;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        border-radius: 12px;
        padding: 0 10px;
        font-size: .93rem;
        line-height: 1.3;
      }
      .vw-filters-check input {
        accent-color: var(--color-accent, #4ea0ff);
      }
      .vw-filters-divider {
        margin: 2px 0;
        border: 0;
        border-top: 1px solid color-mix(in srgb, var(--border-light, rgba(255,255,255,0.14)) 92%, transparent);
      }
      .vw-filters-actions {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 50px;
        margin-top: 4px;
      }
      .vw-filters-apply {
        min-width: 144px;
        min-height: 42px;
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        font-size: .95rem;
      }
      .vw-filters-reset {
        min-height: 40px;
        border: 0;
        background: transparent;
        color: #ec4f55;
        font-size: 1rem;
      }
      .vw-filters-hint {
        font-size: .82rem;
        line-height: 1.45;
        color: var(--text-secondary, rgba(255,255,255,0.74));
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  openFiltersOverlay() {
    this.closeFiltersOverlay();
    this.ensureFiltersOverlayStyles();
    const overlay = document.createElement('div');
    overlay.id = 'vwFiltersOverlay';
    overlay.className = 'vw-filters-overlay';
    overlay.innerHTML = `
      <div class="vw-filters-modal" role="dialog" aria-modal="true" aria-label="Фильтры">
        <div class="vw-filters-head">
          <div class="vw-filters-title">Фильтры подборки</div>
          <button type="button" class="vw-filters-close" data-role="close" aria-label="Закрыть">×</button>
        </div>
        <hr class="vw-filters-divider">
        <div class="vw-filters-list">
          <div class="vw-filters-picker-row">
            <div class="vw-filters-picker-icon" aria-hidden="true">💵</div>
            <label class="vw-filters-picker-field">
              <span class="vw-filters-picker-label" data-display="priceMin">Цена от</span>
              <select class="vw-filters-picker-select" data-picker="priceMin" aria-label="Цена от"></select>
            </label>
            <label class="vw-filters-picker-field">
              <span class="vw-filters-picker-label" data-display="priceMax">До</span>
              <select class="vw-filters-picker-select" data-picker="priceMax" aria-label="Цена до"></select>
            </label>
          </div>
          <div class="vw-filters-picker-row">
            <div class="vw-filters-picker-icon" aria-hidden="true">📏</div>
            <label class="vw-filters-picker-field">
              <span class="vw-filters-picker-label" data-display="areaMin">Метраж от</span>
              <select class="vw-filters-picker-select" data-picker="areaMin" aria-label="Метраж от"></select>
            </label>
            <label class="vw-filters-picker-field">
              <span class="vw-filters-picker-label" data-display="areaMax">До</span>
              <select class="vw-filters-picker-select" data-picker="areaMax" aria-label="Метраж до"></select>
            </label>
          </div>
          <div class="vw-filters-picker-row">
            <div class="vw-filters-picker-icon" aria-hidden="true">🏢</div>
            <label class="vw-filters-picker-field">
              <span class="vw-filters-picker-label" data-display="floorMin">Этаж от</span>
              <select class="vw-filters-picker-select" data-picker="floorMin" aria-label="Этаж от"></select>
            </label>
            <label class="vw-filters-picker-field">
              <span class="vw-filters-picker-label" data-display="floorMax">До</span>
              <select class="vw-filters-picker-select" data-picker="floorMax" aria-label="Этаж до"></select>
            </label>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-row">
            <select class="vw-filters-select" aria-label="Количество комнат" data-role="rooms">
              <option value="">Кол-во комнат</option>
              <option value="1">1 комната</option>
              <option value="2">2 комнаты</option>
              <option value="3">3 комнаты</option>
              <option value="4plus">4+ комнат</option>
            </select>
            <label class="vw-filters-check"><input type="checkbox" data-role="smart"> <span>Смарт</span></label>
          </div>
          <div class="vw-filters-row">
            <select class="vw-filters-select" aria-label="Район" data-role="district">
              <option value="">Район</option>
              <option value="primorsky">Приморский</option>
              <option value="kievsky">Киевский</option>
              <option value="malinovsky">Малиновский</option>
              <option value="suvorovsky">Суворовский</option>
            </select>
            <label class="vw-filters-check"><input type="checkbox" data-role="arcadia"> <span>Аркадия</span></label>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-row">
            <select class="vw-filters-select" aria-label="Поиск по ЖК" data-role="rcSearch">
              <option value="">Поиск по ЖК</option>
              <option value="altair">ЖК Альтаир</option>
              <option value="gagarin">ЖК Гагарин Плаза</option>
              <option value="omega">ЖК Омега</option>
            </select>
            <label class="vw-filters-check"><input type="checkbox" data-role="rcOnly"> <span>Только ЖК</span></label>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-actions">
            <button type="button" class="vw-filters-apply" data-role="apply">Применить</button>
            <button type="button" class="vw-filters-reset" data-role="reset">Сброс</button>
          </div>
          <hr class="vw-filters-divider">
        </div>
        <div class="vw-filters-hint">Нажмите "применить" чтоб обновить подборку</div>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    this._filtersOverlayOpen = true;
    this.$byId('pillFiltersButton')?.setAttribute('aria-expanded', 'true');
    overlay.querySelectorAll('select[data-picker]').forEach((sel) => {
      const pickerType = String(sel.getAttribute('data-picker') || '');
      this.fillFilterPickerSelect(sel, pickerType);
    });
    this.resetFiltersOverlayForm(overlay);
    this.bindFiltersOverlayEvents(overlay);
    overlay.querySelector('[data-role="close"]')?.addEventListener('click', () => this.closeFiltersOverlay());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeFiltersOverlay();
    });
  }

  ensureAccessOverlayStyles() {
    if (document.getElementById('vw-access-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'vw-access-overlay-styles';
    style.textContent = `
      .vw-access-overlay {
        position: fixed;
        inset: 0;
        z-index: 1300;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.56);
        padding: 16px;
      }
      .vw-access-modal {
        width: min(420px, 100%);
        border-radius: 16px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 90%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: var(--text-primary, #fff);
        padding: 14px;
        display: grid;
        gap: 12px;
      }
      .vw-access-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .vw-access-title {
        font-size: .9rem;
        font-weight: 600;
        color: var(--text-secondary, rgba(255,255,255,0.75));
      }
      .vw-access-close {
        width: 30px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        cursor: pointer;
      }
      .vw-access-greeting {
        font-size: .92rem;
        line-height: 1.45;
        color: var(--text-primary, #fff);
      }
      .vw-access-list {
        display: grid;
        gap: 8px;
      }
      .vw-access-item {
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        border-radius: 12px;
        padding: 10px 12px;
        text-align: left;
        font-size: .86rem;
        font-weight: 500;
      }
      .vw-access-item--primary {
        border-color: rgba(45, 143, 225, 0.65);
        background: linear-gradient(180deg, rgba(45,143,225,0.32), rgba(36,129,204,0.26));
      }
      .vw-access-hint {
        font-size: .84rem;
        line-height: 1.45;
        color: var(--text-secondary, rgba(255,255,255,0.74));
      }
      .vw-access-sub-overlay {
        position: fixed;
        inset: 0;
        z-index: 1310;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.56);
        padding: 16px;
      }
      .vw-access-sub-modal {
        width: min(420px, 100%);
        max-height: min(82vh, 640px);
        border-radius: 16px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 90%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: var(--text-primary, #fff);
        padding: 14px;
        display: grid;
        gap: 40px;
        overflow: auto;
      }
      .vw-access-sub-head {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
      }
      .vw-access-sub-title {
        text-align: center;
        font-size: .92rem;
        font-weight: 600;
        color: var(--text-secondary, rgba(255,255,255,0.78));
      }
      .vw-access-sub-back {
        min-height: 30px;
        border-radius: 10px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 0 16px;
        font-size: .875rem;
      }
      .vw-access-sub-spacer {
        width: 1px;
        height: 1px;
      }
      .vw-access-sub-list {
        display: grid;
        gap: 8px;
      }
      .vw-access-sub-item {
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        border-radius: 12px;
        padding: 10px 12px;
        font-size: .86rem;
      }
      .vw-access-sub-toolbar {
        display: flex;
        justify-content: flex-end;
      }
      .vw-access-sub-btn {
        min-height: 34px;
        border-radius: 10px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 0 12px;
      }
      .vw-access-sub-btn--primary {
        border-color: rgba(45, 143, 225, 0.65);
        background: linear-gradient(180deg, rgba(45,143,225,0.32), rgba(36,129,204,0.26));
      }
      .vw-access-sub-btn:disabled {
        opacity: .45;
      }
      .vw-access-sub-modal--add {
        width: min(720px, 100%);
        max-height: min(88vh, 760px);
        padding-bottom: calc(14px + var(--vw-add-kb-inset, 0px));
        overscroll-behavior: contain;
        touch-action: pan-y manipulation;
      }
      .vw-access-add-head {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 20px;
      }
      .vw-access-add-stage {
        justify-self: center;
        min-height: 30px;
        color: var(--text-secondary, rgba(255,255,255,0.7));
        display: inline-flex;
        align-items: center;
        padding: 0 10px;
        font-size: .83rem;
      }
      .vw-access-add-reset-head {
        min-height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(236, 96, 96, 0.78);
        background: rgba(236, 96, 96, 0.12);
        color: rgba(255,255,255,0.88);
        padding: 0 12px;
        font-size: .95rem;
      }
      .vw-access-add-form {
        display: grid;
        gap: 10px;
      }
      .vw-access-add-wizard {
        display: grid;
        gap: 10px;
      }
      .vw-access-add-step {
        display: none;
        gap: 20px;
      }
      .vw-access-add-wizard[data-step="1"] [data-step-panel="1"],
      .vw-access-add-wizard[data-step="2"] [data-step-panel="2"],
      .vw-access-add-wizard[data-step="3"] [data-step-panel="3"],
      .vw-access-add-wizard[data-step="4"] [data-step-panel="4"] {
        display: grid;
      }
      .vw-access-add-file {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .vw-access-add-row2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        min-height: 36px;
        height: 100%;
      }
      .vw-access-add-field {
        min-width: 0;
      }
      .vw-access-add-field--with-actions {
        position: relative;
      }
      .vw-access-add-input {
        width: 100%;
        min-height: 36px;
        height: 100%;
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.16));
        background: var(--bg-element, rgba(255,255,255,0.08));
        color: var(--text-primary, #fff);
        padding: 0 14px;
        font-size: .88rem;
      }
      .vw-access-add-field--with-actions.show-actions .vw-access-add-input {
        padding-right: 72px;
      }
      .vw-access-add-input::placeholder {
        color: var(--text-secondary, rgba(255,255,255,0.56));
      }
      .vw-access-add-input:focus {
        border-color: rgba(92, 150, 255, 0.75);
        box-shadow: 0 0 0 1px rgba(92, 150, 255, 0.35) inset;
      }
      .vw-access-add-input--id {
        border-color: rgba(92, 150, 255, 0.88);
        color: rgba(255,255,255,0.9);
      }
      .vw-access-add-hint {
        text-align: center;
        font-size: calc(.83rem - 2px);
        color: var(--text-secondary, rgba(255,255,255,0.58));
      }
      .vw-access-add-photo-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
      }
      .vw-access-add-photo-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .vw-access-add-photo-slot {
        min-height: 0;
        aspect-ratio: 1 / 1;
        border-radius: 16px;
        border: 2px dotted rgba(92, 150, 255, 0.8);
        background: var(--bg-element, rgba(255,255,255,0.08));
        color: rgba(255,255,255,0.65);
        display: grid;
        place-items: center;
        padding: 8px;
        font-size: 1.35rem;
      }
      .vw-access-add-photo-slot.is-filled {
        border-color: rgba(92, 150, 255, 0.95);
        color: var(--text-primary, #fff);
        font-size: .78rem;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        box-shadow: inset 0 -40px 40px rgba(0,0,0,0.35);
      }
      .vw-access-add-photo-slot--main {
        min-height: 0;
      }
      .vw-access-add-photo-placeholder {
        font-weight: 700;
        letter-spacing: .03em;
        opacity: .7;
      }
      .vw-access-add-actions {
        margin-top: 8px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .vw-access-add-actions .vw-access-sub-btn {
        min-height: 50px;
        font-size: .95rem;
      }
      .vw-access-add-check-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 20px;
        padding: 4px 4px 2px;
      }
      .vw-access-add-check-item {
        min-height: 28px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--text-secondary, rgba(255,255,255,0.75));
        font-size: .9rem;
      }
      .vw-access-add-check-item input {
        width: 18px;
        height: 18px;
        margin: 0;
        border-radius: 6px;
        accent-color: var(--color-accent, #4ea0ff);
      }
      .vw-access-add-textarea {
        width: 100%;
        min-height: 152px;
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.16));
        background: var(--bg-element, rgba(255,255,255,0.08));
        color: var(--text-primary, #fff);
        padding: 12px 14px;
        font-size: .88rem;
        resize: vertical;
      }
      .vw-access-add-field--with-actions.is-textarea.show-actions .vw-access-add-textarea {
        padding-right: 76px;
      }
      .vw-access-add-textarea::placeholder {
        color: var(--text-secondary, rgba(255,255,255,0.56));
      }
      .vw-access-add-input-actions {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        pointer-events: none;
        transition: opacity .16s ease;
      }
      .vw-access-add-field--with-actions.is-textarea .vw-access-add-input-actions {
        top: 10px;
        transform: none;
      }
      .vw-access-add-field--with-actions.show-actions .vw-access-add-input-actions {
        opacity: 1;
        pointer-events: auto;
      }
      .vw-access-add-input-action {
        min-width: 20px;
        min-height: 20px;
        border: 0;
        background: transparent;
        color: var(--text-secondary, rgba(255,255,255,0.78));
        font-size: 1rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        padding: 0;
      }
      .vw-access-add-input-action:active {
        transform: scale(.94);
      }
      .vw-access-add-field--with-actions.is-invalid .vw-access-add-input,
      .vw-access-add-field--with-actions.is-invalid .vw-access-add-textarea {
        border-color: rgba(236, 96, 96, 0.88);
      }
      .vw-access-add-field--with-actions.is-invalid .vw-access-add-input::placeholder,
      .vw-access-add-field--with-actions.is-invalid .vw-access-add-textarea::placeholder {
        color: rgba(236, 96, 96, 0.95);
      }
      .vw-access-add-field--with-actions.is-applied .vw-access-add-input {
        border-color: rgba(92, 150, 255, 0.8);
      }
      .vw-access-preview-card {
        border: 1px solid var(--border-light, rgba(255,255,255,0.16));
        border-radius: 18px;
        overflow: hidden;
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 88%, #0d1524);
      }
      .vw-access-preview-media {
        position: relative;
        min-height: 220px;
        background: linear-gradient(180deg, rgba(20,29,44,0.92), rgba(25,33,46,0.88));
      }
      .vw-access-preview-media img {
        width: 100%;
        height: 220px;
        object-fit: cover;
        display: block;
      }
      .vw-access-preview-media img.is-empty {
        opacity: 0;
      }
      .vw-access-preview-id {
        position: absolute;
        top: 12px;
        right: 12px;
        min-height: 30px;
        border-radius: 999px;
        background: rgba(10, 14, 24, 0.64);
        border: 1px solid rgba(255,255,255,0.2);
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        font-size: 1rem;
        font-weight: 700;
      }
      .vw-access-preview-thumbs {
        position: absolute;
        left: 10px;
        right: 10px;
        bottom: 10px;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
      }
      .vw-access-preview-thumb {
        min-height: 48px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(255,255,255,0.12);
        background-size: cover;
        background-position: center;
      }
      .vw-access-preview-thumb.is-active {
        border-color: rgba(92, 150, 255, 0.9);
      }
      .vw-access-preview-thumb.is-filled {
        background-color: rgba(255,255,255,0.2);
      }
      .vw-access-preview-body {
        padding: 12px;
        display: grid;
        gap: 10px;
      }
      .vw-access-preview-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
      }
      .vw-access-preview-title {
        font-size: 1.28rem;
        font-weight: 700;
      }
      .vw-access-preview-price {
        min-height: 38px;
        border-radius: 999px;
        border: 1px solid rgba(92, 150, 255, 0.6);
        background: linear-gradient(180deg, rgba(45,143,225,0.32), rgba(36,129,204,0.26));
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        font-size: 1.08rem;
        font-weight: 700;
      }
      .vw-access-preview-district {
        color: var(--text-secondary, rgba(255,255,255,0.78));
        font-size: 1.05rem;
        font-weight: 600;
      }
      .vw-access-preview-desc-btn {
        min-height: 36px;
        border-radius: 999px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.2));
        background: rgba(255,255,255,0.12);
        color: var(--text-primary, #fff);
        padding: 0 14px;
      }
      .vw-access-preview-specs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .vw-access-preview-pill {
        min-height: 34px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        font-size: .82rem;
      }
      .vw-access-preview-more {
        min-height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.22);
        background: rgba(255,255,255,0.12);
        color: var(--text-primary, #fff);
        font-size: 1rem;
        opacity: .9;
      }
      .vw-access-add-success {
        min-height: 220px;
        border-radius: 16px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.16));
        background: var(--bg-element, rgba(255,255,255,0.08));
        display: grid;
        align-content: center;
        gap: 10px;
        padding: 20px;
        text-align: center;
      }
      .vw-access-add-success-title {
        font-size: 1.2rem;
        font-weight: 700;
      }
      .vw-access-add-success-text {
        color: var(--text-secondary, rgba(255,255,255,0.78));
        line-height: 1.45;
      }
      .vw-access-add-dialog-layer {
        position: fixed;
        inset: 0;
        z-index: 1410;
        background: rgba(0, 0, 0, 0.56);
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .vw-access-add-dialog {
        width: min(360px, 100%);
        border-radius: 16px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 92%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: grid;
        gap: 12px;
        padding: 14px;
      }
      .vw-access-add-dialog-title {
        color: var(--text-secondary, rgba(255,255,255,0.78));
        font-size: .9rem;
        line-height: 1.4;
      }
      .vw-access-add-dialog-actions {
        display: grid;
        gap: 10px;
      }
      .vw-access-add-dialog-btn {
        min-height: 40px;
        border-radius: 12px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 0 12px;
        font-size: .9rem;
      }
      .vw-access-add-dialog-btn.is-primary {
        border-color: rgba(92, 150, 255, 0.72);
        background: rgba(92, 150, 255, 0.2);
      }
      .vw-access-add-dialog-btn.is-neutral {
        border-color: var(--border-light, rgba(255,255,255,0.22));
      }
      .vw-access-add-dialog-btn.is-danger {
        border-color: rgba(236, 96, 96, 0.82);
        background: rgba(236, 96, 96, 0.14);
      }
      .vw-access-sub-modal--properties {
        gap: 14px;
        max-height: min(82vh, 720px);
        overflow: hidden;
        grid-template-rows: auto minmax(0, 1fr);
      }
      .vw-access-objects-layout {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 10px;
        min-height: 0;
        flex: 1;
      }
      .vw-access-objects-topbar,
      .vw-access-objects-bottombar {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 10px;
      }
      .vw-access-objects-total {
        font-size: .83rem;
        color: var(--text-secondary, rgba(255,255,255,0.75));
      }
      .vw-access-objects-scroll {
        min-height: 0;
        overflow: auto;
        padding-right: 2px;
        overscroll-behavior: contain;
      }
      .vw-access-obj-list {
        display: grid;
        gap: 10px;
      }
      .vw-access-obj-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        border-radius: 12px;
        padding: 10px;
        min-height: 78px;
        cursor: pointer;
      }
      .vw-access-obj-card.is-selected {
        border-color: rgba(45, 143, 225, 0.75);
        box-shadow: 0 0 0 1px rgba(45, 143, 225, 0.35) inset;
      }
      .vw-access-obj-check input {
        accent-color: var(--color-accent, #4ea0ff);
      }
      .vw-access-obj-main {
        min-width: 0;
      }
      .vw-access-obj-headline {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .vw-access-obj-id-badge {
        font-size: .72rem;
        line-height: 1;
        color: var(--text-primary, #fff);
        border: 1px solid rgba(92, 150, 255, 0.7);
        background: rgba(92, 150, 255, 0.15);
        border-radius: 999px;
        padding: 4px 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        white-space: nowrap;
      }
      .vw-access-obj-title {
        margin: 0;
        font-size: .86rem;
        font-weight: 600;
        color: var(--text-primary, #fff);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vw-access-obj-meta {
        margin-top: 6px;
        font-size: .78rem;
        color: var(--text-secondary, rgba(255,255,255,0.76));
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vw-access-obj-edit {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.2));
        background: rgba(255,255,255,0.08);
        color: var(--text-primary, #fff);
        font-size: .9rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        z-index: 1;
      }
    `;
    document.head.appendChild(style);
  }

  openAccessOverlay() {
    this.closeAccessOverlay();
    this.ensureAccessOverlayStyles();
    const locale = this.getCurrentLocale();
    const tgUser = this.getCurrentTelegramUser();
    const isAdmin = this.accessRole === 'owner' || this.accessRole === 'super_admin' || this.accessFlags?.isAdmin === true;
    const name = String(tgUser?.firstName || tgUser?.username || 'User').trim();
    const username = String(tgUser?.username || 'guest').trim().replace(/^@/, '');

    const overlay = document.createElement('div');
    overlay.id = 'vwAccessOverlay';
    overlay.className = 'vw-access-overlay';

    const greeting = isAdmin
      ? this.t('accessAdminGreeting', { name, username })
      : this.t('accessUserGreeting', { name, username });

    overlay.innerHTML = isAdmin
      ? `
        <div class="vw-access-modal" role="dialog" aria-modal="true" aria-label="${locale.appHeaderAdminAria || 'Admin panel'}">
          <div class="vw-access-head">
            <div class="vw-access-title">${locale.appHeaderAdminAria || 'Адмін-панель'}</div>
            <button type="button" class="vw-access-close" data-role="close" aria-label="${locale.close || 'Закрыть'}">×</button>
          </div>
          <div class="vw-access-greeting">${greeting}</div>
          <div class="vw-access-list">
            <button type="button" class="vw-access-item vw-access-item--primary" data-role="admin-add-property">Добавить объект</button>
            <button type="button" class="vw-access-item" data-role="admin-stats">${locale.accessAdminStats || 'Статистика'}</button>
            <button type="button" class="vw-access-item" data-role="admin-properties">${locale.accessAdminProperties || "Мої об'єкти"}</button>
            <button type="button" class="vw-access-item" data-role="admin-subscription">${locale.accessAdminSubscription || 'Керування підпискою'}</button>
            <button type="button" class="vw-access-item" data-role="olx-connect">${locale.accessAdminOlxConnect || 'Подключить OLX'}</button>
          </div>
        </div>
      `
      : `
        <div class="vw-access-modal" role="dialog" aria-modal="true" aria-label="${locale.appHeaderWishlistAria || 'Wishlist'}">
          <div class="vw-access-head">
            <div class="vw-access-title">${locale.appHeaderWishlistAria || 'Обране'}</div>
            <button type="button" class="vw-access-close" data-role="close" aria-label="${locale.close || 'Закрыть'}">×</button>
          </div>
          <div class="vw-access-greeting">${greeting}</div>
          <div class="vw-access-hint">${locale.accessUserEmpty || "Тут з'являться об'єкти, які ви додасте до обраного (Wishlist)"}</div>
        </div>
      `;

    this.getRoot().appendChild(overlay);
    this._accessOverlayOpen = true;
    overlay.querySelector('[data-role="close"]')?.addEventListener('click', () => this.closeAccessOverlay());
    const olxConnectBtn = overlay.querySelector('[data-role="olx-connect"]');
    if (olxConnectBtn) {
      olxConnectBtn.addEventListener('click', () => this.openOlxConnectFlow());
      this.refreshOlxStatusButton(olxConnectBtn).catch(() => {});
    }
    overlay.querySelector('[data-role="admin-add-property"]')?.addEventListener('click', () => this.openAccessSubOverlay('add-property'));
    overlay.querySelector('[data-role="admin-stats"]')?.addEventListener('click', () => this.openAccessSubOverlay('stats'));
    overlay.querySelector('[data-role="admin-properties"]')?.addEventListener('click', () => this.openAccessSubOverlay('properties'));
    overlay.querySelector('[data-role="admin-subscription"]')?.addEventListener('click', () => this.openAccessSubOverlay('subscription'));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeAccessOverlay();
    });
  }

  getConsent() {
    try {
      const raw =
        localStorage.getItem('vw_cookie_consent') ||
        localStorage.getItem('vw_consent') ||
        null;

      if (!raw) return null;

      if (raw === 'accepted') {
        return { selections: { analytics: true } };
      }

      if (raw === 'rejected') {
        return { selections: { analytics: false } };
      }

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // ---------- UI init ----------
  initializeUI() {
    this.ui.initializeUI();

    // единый ввод
    this.ui.bindUnifiedInputEvents();
    this.ui.bindFunctionButtons();
    this.ui.bindAccordionEvents();
    // (scrim удалён как неиспользуемый)

    // 1) проверяем session на сервере 2) только потом грузим локальную историю (без "мигания")
    if (this.sessionId) {
      this.api.loadSessionInfo()
        .then((state) => {
          if (state?.expired) {
            try { this.ui.clearMessages(); } catch {}
            return;
          }
          try { this.ui.loadHistory(); } catch {}
        })
        .catch(() => {
          try { this.ui.loadHistory(); } catch {}
        });
    } else {
      this.ui.loadHistory();
    }

    // Initialize understanding bar with 0%
    this.updateHeaderUnderstanding(0);

    // Initialize send button state
    const sendButton = this.$byId('sendButton');
    if (sendButton) sendButton.setAttribute('aria-disabled', 'true');

    console.log('✅ Voice Widget инициализирован');

    // v2 menu overlay init (after DOM is ready)
    try { this.setupMenuOverlay(); } catch {}
    try { this.initializePropertiesCatalog(); } catch {}
    try { this.api.resolveViewerAccessRole(); } catch {}
    try { this.consumeOlxCallbackState(); } catch {}

    
  }

  connectedCallback() {
    this._initializeInstance();
    if (this.isTelegramWebApp) {
      this.setAttribute('data-telegram', '1');
    } else {
      this.removeAttribute('data-telegram');
    }
    this.currentLang = this.getInitialLanguage();
    this.updateInterface();
    if (!this._uiInitializedOnce) {
      this.initializeUI();
      this._uiInitializedOnce = true;
    }
    if (this._pendingThemeAttr) {
      try { this.setAttribute('data-theme', this._pendingThemeAttr); } catch {}
      this._pendingThemeAttr = null;
    }
    this.applyHostModeClasses();
    // Theme application uses this.setAttribute, so it must run after connect.
    if (this._themeInitializedOnce) return;
    this.initTheme();
    this._themeInitializedOnce = true;
  }

  init(config = {}) {
    const { apiUrl, fieldName, responseField } = config || {};
    if (typeof apiUrl === 'string' && apiUrl.trim()) {
      this.setApiUrl(apiUrl.trim());
    }
    if (typeof fieldName === 'string' && fieldName.trim()) {
      this.fieldName = fieldName.trim();
    }
    if (typeof responseField === 'string' && responseField.trim()) {
      this.responseField = responseField.trim();
    }
  }

  applyHostModeClasses() {
    if (!this.isConnected) return;
    try {
      this.classList.toggle('vw-mobile', !!this._vwIsMobileLike);
      this.classList.toggle('vw-desktop', !this._vwIsMobileLike);
    } catch {}
  }

  initTheme() {
    this.applyTheme('dark');
  }

  getTheme() {
    return 'dark';
  }

  getThemeToken(tokenName, fallback = '') {
    try {
      const raw = getComputedStyle(this).getPropertyValue(tokenName);
      const value = String(raw || '').trim();
      if (!value) return fallback;
      return value.replace(/^["']|["']$/g, '');
    } catch {
      return fallback;
    }
  }

  getMicIconByTheme() {
    return this.getThemeToken('--img-mic', 'mic-btn.svg');
  }

  getStopIconByTheme() {
    return this.getThemeToken('--img-stop', 'stop-btn.svg');
  }

  getSendIconByTheme() {
    return this.getThemeToken('--img-send', 'send-btn.svg');
  }

  getStatsIconByTheme() {
    return this.getThemeToken('--img-stats', 'menu_dark_theme.svg');
  }

  getCloseIconByTheme() {
    return this.getThemeToken('--img-close', 'main_close_btn.svg');
  }

  getContactIconByTheme() {
    return this.getThemeToken('--img-contact', 'Contactme.svg');
  }

  getInsightsIconByTheme() {
    return this.getThemeToken('--img-insights', 'Insights.svg');
  }

  getLogoByTheme() {
    return this.getThemeToken('--img-logo', 'LOGO.svg');
  }

  getReturnIconByTheme() {
    return this.getThemeToken('--img-return', 'return_btn.svg');
  }

  getInsightsProgressTrackStrokeByTheme() {
    return this.getThemeToken('--insights-track-stroke', this.getThemeToken('--border-light', ''));
  }

  updateSendButtonIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getSendIconByTheme()}`;
    const chatSendImg = this.getRoot().querySelector('#sendButton img');
    if (chatSendImg) chatSendImg.setAttribute('src', nextSrc);
  }

  updateStatsIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getStatsIconByTheme()}`;
    const statsIcons = this.getRoot().querySelectorAll('.header-action.header-left img');
    statsIcons.forEach((img) => img.setAttribute('src', nextSrc));
  }

  updateLogoIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getLogoByTheme()}`;
    const logos = this.getRoot().querySelectorAll('.header-logo');
    logos.forEach((img) => img.setAttribute('src', nextSrc));
  }

  updateCloseIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getCloseIconByTheme()}`;
    const closeIcons = this.getRoot().querySelectorAll('.header-action.header-right img');
    closeIcons.forEach((img) => img.setAttribute('src', nextSrc));
  }

  updateInsightsProgressTrackStroke() {}

  applyTheme(theme) {
    const next = 'dark';
    this._theme = next;
    if (this.isConnected) this.setAttribute('data-theme', 'dark');
    else this._pendingThemeAttr = 'dark';
    try { localStorage.removeItem('vw_theme'); } catch {}
    try {
      this.updateToggleButtonState('chat');
      this.updateSendButtonIcons();
      this.updateStatsIcons();
      this.updateLogoIcons();
      this.updateCloseIcons();
      this.updateInsightsProgressTrackStroke();
    } catch {}
  }

  toggleTheme() {
    // Theme switching disabled: widget is always dark.
    this.applyTheme('dark');
  }

  checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const statusIndicator = this.$byId('statusIndicator');
      if (statusIndicator) statusIndicator.innerHTML = '<div class="status-text">❌ Браузер не поддерживает запись аудио</div>';
      const toggleButton = this.$byId('toggleButton');
      if (toggleButton) {
        toggleButton.disabled = true;
        toggleButton.style.opacity = '0.5';
        toggleButton.style.cursor = 'not-allowed';
      }
    }
  }

 // ---------- RENDER ----------
render() {
  this.getRoot().innerHTML = `
<!-- COMPAT: v1 chat/details minimal support (do not remove until full v2 wiring) -->
  <!-- Image lightbox overlay -->
  <div class="img-lightbox" id="imgLightbox" aria-hidden="true">
    <img id="imgLightboxImg" alt="">
    <div class="lightbox-close-hint"><span class="tap-icon"></span>Click to close</div>
  </div>

  

  <div class="widget" role="dialog" aria-modal="true" aria-label="Voice Assistant">
    <!-- Header removed for v2 UI -->

    <!-- Content -->
    <div class="content">
      <header class="app-header">
          <button class="app-header-btn header-action-btn" id="appContactButton" type="button">Зв'язатися</button>
        <div class="app-header-status">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="appOnlineText">Online</span>
        </div>
        <div class="app-header-actions">
          <button class="app-header-btn app-lang-btn" id="appLangButton" type="button">RU</button>
          <button class="app-header-btn app-theme-btn" id="appThemeButton" type="button" aria-label="Open panel">♡</button>
        </div>
      </header>
      <div class="app-body">
      <!-- Dialogue Screen (v2) — основной экран при открытии виджета -->
      <div class="dialog-screen" id="dialogScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header">
            <button class="header-action header-left" type="button" title="Открыть меню">
              <img src="${ASSETS_BASE}${this.getStatsIconByTheme()}" alt="Stats">
            </button>
            <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
          </div>
          <div class="pill-overlay-lane" aria-hidden="false">
            <div class="pill-overlay-row">
              <button class="pill-action-btn" id="pillFiltersButton" type="button" aria-label="Фильтры">
                <span class="pill-action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d="M4 6h16l-6.5 7.2v4.8l-3 1.8v-6.6L4 6z"></path>
                  </svg>
                </span>
              </button>
              <div class="objects-counter-pill" id="objectsCounterPill" role="button" tabindex="0">Знайдено 2,345 обʼєктів</div>
              <button class="pill-action-btn pill-action-btn--view" id="pillViewButton" type="button" aria-label="Вид выдачи" aria-pressed="false">
                <span class="pill-action-icon" aria-hidden="true">
                  <svg class="icon-list" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d="M4 6h2.5M9 6h11M4 12h2.5M9 12h11M4 18h2.5M9 18h11"></path>
                  </svg>
                  <svg class="icon-slider" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <rect x="3.5" y="6" width="7" height="12" rx="1.8"></rect>
                    <rect x="13.5" y="6" width="7" height="12" rx="1.8"></rect>
                    <path d="M11.8 12h0.4"></path>
                  </svg>
                </span>
              </button>
            </div>
          </div>
          <div class="dialogue-container" id="messagesContainer">
              <div class="thread" id="thread"></div>
        </div>
          <div class="loading dialog-overlay" id="loadingIndicator"><span class="loading-text">Обрабатываю запрос <span class="dots"><span class="d1">•</span><span class="d2">•</span><span class="d3">•</span></span></span></div>
          <div class="app-footer-dock">
            <div class="input-area">
              <div class="input-container">
                <div class="text-input-wrapper">
                    <textarea id="textInput" class="input-field" rows="1" placeholder="Write your request..."></textarea>
                  <div class="recording-indicator" id="recordingIndicator" style="display: none;">
                      <div class="recording-label">Идёт запись</div>
                    <div class="record-timer" id="chatRecordTimer">00:00</div>
                  </div>
                </div>
                  <div class="input-buttons">
                    <button class="input-btn" id="toggleButton" type="button" title="Говорить"><img src="${ASSETS_BASE}${this.getMicIconByTheme()}" alt="Microphone"></button>
                    <button class="input-btn" id="sendButton" type="button" title="Отправить"><img src="${ASSETS_BASE}${this.getSendIconByTheme()}" alt="Send"></button>
              </div>
              </div>
            </div>
            <div class="app-footer-brand">Powered by <a href="#" target="_blank">VIA.AI</a> • Want your own?</div>
            </div>
        </div>
          </div>

      <!-- Cookie/Telemetry Consent Banner -->
      <div class="data-overlay" id="cookieOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Cookies & telemetry</div>
          <div class="data-body">
            We use cookies and collect usage data to improve the product. No third‑party ads or retargeting. You can change settings anytime.
            <div class="cookie-manage" id="cookieManagePanel" style="margin-top:10px; display:none;">
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccStrict" checked disabled>
                <span>Strictly necessary (always enabled)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccPerformance" checked>
                <span>Performance (timings, errors)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccAnalytics" checked>
                <span>Analytics (anonymous usage)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccMarketing">
                <span>Marketing (off — not used)</span>
              </label>
            </div>
          </div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:8px; flex-wrap:wrap;">
            <button class="data-btn" id="cookieAcceptAllBtn">Accept all</button>
            <button class="data-btn" id="cookieRejectAllBtn">Reject all</button>
            <button class="data-btn" id="cookieManageBtn">Manage</button>
            <button class="data-btn" id="cookieSaveBtn" style="display:none;">Save</button>
          </div>
        </div>
      </div>

          </div>

        </div>
      </div>
    </div>

  </div>
  `;


  /* ...ВЕСЬ КОД ПРОСМОТРЕННЫЙ ДО ЭТОЙ ЧАСТИ ЯВЛЯЕТСЯ НУЖНЫМ И АКТУАЛИЗИРОВАННЫМ... */



  const $ = s => this.getRoot().querySelector(s);
  
  // Mobile-like detection (used to avoid auto-keyboard focus on touch devices)
  this._vwIsMobileLike = (() => {
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
      const ua = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      return Boolean(coarse || touch || ua);
    } catch { return false; }
  })();
  this.applyHostModeClasses();
  
  // Screen management (fresh query each time to avoid stale refs)
  const screenIds = ['dialogScreen'];
  const showScreen = (screenName) => {
    screenIds.forEach(id => this.$byId(id)?.classList.add('hidden'));
    const targetId = screenName === 'dialog' ? 'dialogScreen' : `${screenName}Screen`;
    const targetEl = this.$byId(targetId) || this.$byId('dialogScreen');
    targetEl?.classList.remove('hidden');
    // ensure menu overlay is attached to the active screen header
    try { this.setupMenuOverlay(); } catch {}
  };
  // New top header actions
  this.$byId('appLangButton')?.addEventListener('click', () => {
    try { this.switchLanguage(); } catch {}
  });
  this.$byId('appThemeButton')?.addEventListener('click', () => {
    try { this.openAccessOverlay(); } catch {}
  });
  // Reserved button slot (no action yet).
  this.$byId('appContactButton')?.addEventListener('click', () => {
    try { this.openContactManagerPopup({ source: 'tg_header_main' }); } catch {}
  });
  this.getRoot().querySelector('.app-header-status')?.addEventListener('click', () => {
    try { this.openDebugInsightsPopup(); } catch (error) { console.error('Debug insights popup failed:', error); }
  });
  const objectsPill = this.$byId('objectsCounterPill');
  const openPropertiesSlider = async () => {
    try {
      console.log('objectsCounterPill clicked');
      await this.renderPropertiesFromCatalog();
    } catch (error) {
      console.error('objectsCounterPill click handler failed:', error);
    }
  };
  objectsPill?.addEventListener('click', openPropertiesSlider);
  objectsPill?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openPropertiesSlider();
    }
  });
  const pillFiltersButton = this.$byId('pillFiltersButton');
  pillFiltersButton?.setAttribute('aria-expanded', 'false');
  pillFiltersButton?.addEventListener('click', () => {
    try { this.openFiltersOverlay(); } catch {}
  });
  const pillViewButton = this.$byId('pillViewButton');
  pillViewButton?.addEventListener('click', () => {
    const isListMode = pillViewButton.classList.toggle('is-slider-mode');
    try {
      this.setCatalogDisplayMode(isListMode ? 'list' : 'slider');
    } catch {}
    pillViewButton.setAttribute('aria-pressed', isListMode ? 'true' : 'false');
  });
  try {
    this.bindCatalogListScrollOnMessages();
  } catch {}

  // Outside tap-to-close (no overlay, no page blocking)
  // Important: we do NOT preventDefault / stopPropagation, so the host page remains fully interactive.
  if (!this._onOutsidePointerDown) {
    this._onOutsidePointerDown = (ev) => {
      try {
        if (!this.classList.contains('open')) return;
        const path = (ev && typeof ev.composedPath === 'function') ? ev.composedPath() : [];
        // In Shadow DOM, composedPath includes the host element (`this`) for internal clicks.
        const isInside = Array.isArray(path) ? path.includes(this) : false;
        if (isInside) return;
        if (typeof this.closeWidget === 'function') this.closeWidget();
      } catch {}
    };
  }
  this._enableOutsideClose = () => {
    try {
      if (this._outsideCloseEnabled) return;
      this._outsideCloseEnabled = true;
      // pointerdown is preferred; touchstart/mousedown are fallbacks
      document.addEventListener('pointerdown', this._onOutsidePointerDown, true);
      document.addEventListener('touchstart', this._onOutsidePointerDown, true);
      document.addEventListener('mousedown', this._onOutsidePointerDown, true);
    } catch {}
  };
  this._disableOutsideClose = () => {
    try {
      if (!this._outsideCloseEnabled) return;
      this._outsideCloseEnabled = false;
      document.removeEventListener('pointerdown', this._onOutsidePointerDown, true);
      document.removeEventListener('touchstart', this._onOutsidePointerDown, true);
      document.removeEventListener('mousedown', this._onOutsidePointerDown, true);
    } catch {}
  };

  let _sessionStarted = false;
  this.classList.add("open");
  showScreen('dialog');
  try {
    const isTelegramMiniApp = !!(window?.Telegram?.WebApp);
    const greetingAlreadyInMessages = Array.isArray(this.messages)
      ? this.messages.some((m) => m && m.greeting === true)
      : false;
    if (isTelegramMiniApp && !greetingAlreadyInMessages) {
      this.showGreetingMessage();
      sessionStorage.setItem('vw_greeting_shown', '1');
    } else if (!sessionStorage.getItem('vw_greeting_shown')) {
      this.showGreetingMessage();
      sessionStorage.setItem('vw_greeting_shown', '1');
    }
  } catch {}
  if (!_sessionStarted) {
    _sessionStarted = true;
    const consent = this.getConsent();
    logTelemetry(TelemetryEventTypes.SESSION_START, {
      url: window.location.href,
      referrer: document.referrer || null,
      lang: navigator.language || null,
      widgetVersion: '1.0',
      consent: consent ? {
        analytics: consent.selections?.analytics === true,
        performance: consent.selections?.performance === true,
        marketing: consent.selections?.marketing === true
      } : null
    });
  }
  logTelemetry(TelemetryEventTypes.WIDGET_OPEN);
  try {
    if (!this._vwIsMobileLike) {
      this.$byId("textInput")?.focus();
    }
  } catch {}

  // --------- Cookie consent logic ---------
  this._CONSENT_VERSION = 1;
  this.getConsent = () => {
    try {
      const raw = localStorage.getItem('vw_cookie_consent');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.v !== this._CONSENT_VERSION) return null;
      return obj;
    } catch { return null; }
  };
  this.setConsent = (selections) => {
    const obj = { v: this._CONSENT_VERSION, ts: Date.now(), selections: { ...selections, strictlyNecessary: true } };
    try { localStorage.setItem('vw_cookie_consent', JSON.stringify(obj)); } catch {}
    try { document.cookie = `vw_consent=v${this._CONSENT_VERSION}; path=/; SameSite=Lax`; } catch {}
    
    // Связываем с телеметрией
    const analytics = selections.analytics === true;
    setTelemetryConsent({ analytics });
    
    // Логируем изменение согласия
    logTelemetry(TelemetryEventTypes.CONSENT_UPDATE, {
      analytics,
      performance: selections.performance === true,
      marketing: selections.marketing === true,
      timestampLocal: new Date().toISOString()
    });
    
    return obj;
  };
  this.maybeShowCookieBanner = () => {
    const consent = this.getConsent();
    const overlay = this.$byId('cookieOverlay');
    if (!consent && overlay) overlay.style.display = 'flex';
  };
  // Initialize consent UI handlers
  this.setupCookieBanner = () => {
    const overlay = this.$byId('cookieOverlay');
    const manage = this.$byId('cookieManagePanel');
    const btnAccept = this.$byId('cookieAcceptAllBtn');
    const btnReject = this.$byId('cookieRejectAllBtn');
    const btnManage = this.$byId('cookieManageBtn');
    const btnSave = this.$byId('cookieSaveBtn');
    const ccPerf = this.$byId('ccPerformance');
    const ccAnal = this.$byId('ccAnalytics');
    const ccMkt = this.$byId('ccMarketing');
    btnAccept?.addEventListener('click', () => {
      this.setConsent({ performance: true, analytics: true, marketing: false });
      if (overlay) overlay.style.display = 'none';
    });
    btnReject?.addEventListener('click', () => {
      this.setConsent({ performance: false, analytics: false, marketing: false });
      if (overlay) overlay.style.display = 'none';
    });
    btnManage?.addEventListener('click', () => {
      if (manage && btnSave) { manage.style.display = 'block'; btnSave.style.display = 'inline-block'; }
    });
    btnSave?.addEventListener('click', () => {
      const selections = {
        performance: !!ccPerf?.checked,
        analytics: !!ccAnal?.checked,
        marketing: !!ccMkt?.checked
      };
      this.setConsent(selections);
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupCookieBanner(); } catch {}
  try { this.maybeShowCookieBanner(); } catch {}

  // Helper: close widget and restore page scroll
  this.closeWidget = () => {
    this.classList.add("open");
  };

  // (legacy header/details and overlay lead panel handlers removed)

  // Утилита для защиты от спама лид-форм
  this.leadSpamProtection = {
    // Получить ключи для sessionStorage
    getKeys: (formType) => ({
      count: `vw_lead_submit_count_${formType}`,
      warningShown: `vw_lead_warning_shown_${formType}`,
      blockedUntil: `vw_lead_blocked_until_${formType}`
    }),
    
    // Получить количество отправок
    getSubmitCount: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return 0;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const count = sessionStorage.getItem(keys.count);
        return count ? parseInt(count, 10) : 0;
      } catch {
        return 0;
      }
    },
    
    // Увеличить счетчик отправок
    incrementSubmitCount: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const current = this.leadSpamProtection.getSubmitCount(formType);
        sessionStorage.setItem(keys.count, String(current + 1));
      } catch {}
    },
    
    // Проверить, был ли показан поп-ап предупреждения
    isWarningShown: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return false;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        return sessionStorage.getItem(keys.warningShown) === 'true';
      } catch {
        return false;
      }
    },
    
    // Отметить, что поп-ап предупреждения был показан
    setWarningShown: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        sessionStorage.setItem(keys.warningShown, 'true');
      } catch {}
    },
    
    // Проверить, заблокирован ли пользователь
    isBlocked: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return false;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const blockedUntil = sessionStorage.getItem(keys.blockedUntil);
        if (!blockedUntil) return false;
        const timestamp = parseInt(blockedUntil, 10);
        return Date.now() < timestamp;
      } catch {
        return false;
      }
    },
    
    // Получить оставшееся время блокировки в секундах
    getBlockedTimeLeft: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return 0;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const blockedUntil = sessionStorage.getItem(keys.blockedUntil);
        if (!blockedUntil) return 0;
        const timestamp = parseInt(blockedUntil, 10);
        const left = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
        return left;
      } catch {
        return 0;
      }
    },
    
    // Установить блокировку на 60 секунд
    setBlocked: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const blockedUntil = Date.now() + 60000; // 60 секунд
        sessionStorage.setItem(keys.blockedUntil, String(blockedUntil));
      } catch {}
    },
    
    // Сбросить защиту (после успешной отправки после предупреждения)
    reset: (formType) => {
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        sessionStorage.removeItem(keys.count);
        sessionStorage.removeItem(keys.warningShown);
        sessionStorage.removeItem(keys.blockedUntil);
      } catch {}
    }
  };

  // Request Screen (v2) — без логики на данном этапе
  // Add basic validation and submit behavior

  // Expose helpers
  this.showScreen = showScreen;
  this.showChatScreen = () => showScreen('dialog');
  this.showGreetingMessage = () => {
    try { this.ui?.addMessage?.({ type: 'assistant', content: this.t('assistantGreeting') || '', timestamp: new Date(), greeting: true }); } catch {}
  };
  // (legacy) this.showDetailsScreen was used for v1 Details screen — removed
  
  // Image Lightbox — open/close helpers
  this.openImageOverlay = (url) => {
    try {
      if (!url) return;
      const box = this.$byId('imgLightbox');
      const img = this.$byId('imgLightboxImg');
      if (!box || !img) return;
      img.src = url;
      box.classList.add('open');
      this._imageOverlayOpen = true;
    } catch {}
  };
  this.closeImageOverlay = () => {
    try {
      const box = this.$byId('imgLightbox');
      const img = this.$byId('imgLightboxImg');
      if (img) img.src = '';
      if (box) box.classList.remove('open');
      this._imageOverlayOpen = false;
    } catch {}
  };
  // Lightbox interactions: click outside image closes
  try {
    const box = this.$byId('imgLightbox');
    const img = this.$byId('imgLightboxImg');
    if (box) {
      box.addEventListener('click', (e) => {
        if (img && !img.contains(e.target)) {
          e.stopPropagation();
          this.closeImageOverlay();
        }
      });
      // Swipe-to-close on mobile corners
      let sx = 0, sy = 0, st = 0, eligible = false;
      const cornerPad = 24, distThresh = 32, timeThresh = 400;
      box.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0]; if (!t) return;
        const rect = box.getBoundingClientRect();
        sx = t.clientX; sy = t.clientY; st = Date.now();
        const inLeft = sx >= rect.left && sx <= rect.left + cornerPad && sy >= rect.top && sy <= rect.top + cornerPad;
        const inRight = sx <= rect.right && sx >= rect.right - cornerPad && sy >= rect.top && sy <= rect.top + cornerPad;
        const inBL = sx >= rect.left && sx <= rect.left + cornerPad && sy <= rect.bottom && sy >= rect.bottom - cornerPad;
        const inBR = sx <= rect.right && sx >= rect.right - cornerPad && sy <= rect.bottom && sy >= rect.bottom - cornerPad;
        eligible = inLeft || inRight || inBL || inBR;
      }, { passive: true });
      box.addEventListener('touchend', (e) => {
        if (!eligible) return;
        const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]); if (!t) return;
        const dx = Math.abs(t.clientX - sx);
        const dy = Math.abs(t.clientY - sy);
        const dt = Date.now() - st;
        if (dt <= timeThresh && (dx > distThresh || dy > distThresh)) {
          this.closeImageOverlay();
        }
        eligible = false;
      }, { passive: true });
    }
    if (img) {
      img.addEventListener('click', (e) => e.stopPropagation()); // prevent closing by clicking on image
    }
  } catch {}
  // Global ESC: close image overlay first, then (if none) close widget
  this._onGlobalKeydown = (e) => {
    if (e.key !== 'Escape') return;
    if (!this.classList.contains('open')) return;
    e.preventDefault();
    e.stopPropagation();
    if (this._imageOverlayOpen) { this.closeImageOverlay(); return; }
    this.closeWidget();
  };
  try { document.addEventListener('keydown', this._onGlobalKeydown, true); } catch {}
  
  // Delegate clicks on images to open overlay
  this._extractBgUrl = (el) => {
    try {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage || '';
      const m = bg.match(/url\\([\"\\']?(.*?)[\"\\']?\\)/i);
      return (m && m[1]) ? m[1] : '';
    } catch { return ''; }
  };
  this._onImageClick = (e) => {
    // 0) back-side asset thumbnails (delegate)
    const assetEl = e.target.closest('.card-back-asset');
    if (assetEl) {
      const assetUrl = assetEl.getAttribute('data-full-image') || this._extractBgUrl(assetEl);
      if (assetUrl) { this.openImageOverlay(assetUrl); return; }
    }
    // ignore clicks on navigation/dots/buttons and keep click ownership local
    if (e.target.closest('.cards-dots-row, .cards-dot')) {
      try { e.stopPropagation(); } catch {}
      return;
    }
    if (e.target.closest('button')) return;
    // 1) direct <img> inside card screen
    const imgEl = e.target.closest('.card-screen .cs-image-click-area img');
    if (imgEl && imgEl.src) { this.openImageOverlay(imgEl.src); return; }
    // 2) property card background or card mock image areas
    const bgEl = e.target.closest('.card-image, .card-mock .cm-image, .card-screen .cs-image-click-area');
    if (bgEl) {
      const url = this._extractBgUrl(bgEl);
      if (url) { this.openImageOverlay(url); return; }
      // fallback: if it contains an img, use it
      const innerImg = bgEl.querySelector('img');
      if (innerImg && innerImg.src) { this.openImageOverlay(innerImg.src); return; }
    }
  };
  try { this.getRoot().addEventListener('click', this._onImageClick); } catch {}
  // Mobile swipe-to-close from widget corners
  this._setupMobileGestures = () => {
    try {
      const containers = this.getRoot().querySelectorAll('.voice-widget-container');
      containers.forEach((container) => {
        if (!container || container._swipeBound) return;
        let startX = 0, startY = 0, startT = 0, eligible = false;
        const cornerPad = 24; // px
        const distThresh = 32; // px (чуть мягче)
        const timeThresh = 400; // ms (чуть мягче)
        const onStart = (e) => {
          // проверка «мобильности»
          try {
            const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
            const ua = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
            const isMobileLike = Boolean(coarse || touch || ua);
            if (!isMobileLike) return;
          } catch {}
          const t = e.touches && e.touches[0]; if (!t) return;
          const rect = container.getBoundingClientRect();
          startX = t.clientX; startY = t.clientY; startT = Date.now();
          const inLeft = startX >= rect.left && startX <= rect.left + cornerPad && startY >= rect.top && startY <= rect.top + cornerPad;
          const inRight = startX <= rect.right && startX >= rect.right - cornerPad && startY >= rect.top && startY <= rect.top + cornerPad;
          const inBL = startX >= rect.left && startX <= rect.left + cornerPad && startY <= rect.bottom && startY >= rect.bottom - cornerPad;
          const inBR = startX <= rect.right && startX >= rect.right - cornerPad && startY <= rect.bottom && startY >= rect.bottom - cornerPad;
          eligible = inLeft || inRight || inBL || inBR;
        };
        const onEnd = (e) => {
          if (!eligible) return;
          const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]); if (!t) return;
          const dx = Math.abs(t.clientX - startX);
          const dy = Math.abs(t.clientY - startY);
          const dt = Date.now() - startT;
          if (dt <= timeThresh && (dx > distThresh || dy > distThresh)) {
            this.closeWidget();
          }
          eligible = false;
        };
        container.addEventListener('touchstart', onStart, { passive: true });
        container.addEventListener('touchend', onEnd, { passive: true });
        container._swipeBound = true;
      });
    } catch {}
  };
  try { this._setupMobileGestures(); } catch {}
  
  // Legacy reset hook kept as no-op for menu close flow compatibility.
  this.resetLegacyMenuState = () => {};

  // Helper: reset Request screen state

  // Thread auto-scroll helper
  this._isThreadNearBottom = true;
  this.scrollThreadToBottom = (force = false) => {
    const thread = this.$byId('thread');
    if (!thread) return;
    const doScroll = () => { thread.scrollTop = thread.scrollHeight; };
    if (force || this._isThreadNearBottom) {
      requestAnimationFrame(doScroll);
    }
  };
  // (scroll-to-bottom функционал удалён как неиспользуемый)

  // Property card (как было)
  this.renderPropertyCard = (property) => {
    return `
      <div class="property-card" data-variant-id="\${property.id || ''}">
        <div class="card-image" style="background-image: url('\${property.image || ''}')"></div>
        <div class="card-content">
          <div class="card-title">\${property.title || 'Название не указано'}</div>
          <div class="card-location">\${property.location || 'Локация не указана'}</div>
          <div class="card-price">\${property.price || 'Цена не указана'}</div>
          <div class="card-actions">
            <button class="card-btn like" data-action="like" data-variant-id="\${property.id || ''}">Мне нравится!</button>
            <button class="card-btn next" data-action="next" data-variant-id="\${property.id || ''}">Ещё вариант</button>
          </div>
        </div>
      </div>
    `;
  };


  // Card events
  this.getRoot().addEventListener('click', async (e) => {
    if (e.target.matches('.card-btn[data-action="like"]')) {
      // UI toggle (фиксируем состояние сердечка). При отключении — без side-effects.
      try {
        e.target.classList.toggle('is-liked');
        if (!e.target.classList.contains('is-liked')) return;
      } catch {}
      const variantId = e.target.getAttribute('data-variant-id');
      
      // Логируем card_like
      const track = this.getRoot().querySelector('.cards-slider .cards-track');
      const slides = track ? track.querySelectorAll('.card-slide') : [];
      const currentIndex = Array.from(slides).findIndex(slide => 
        slide.querySelector(`[data-variant-id="${variantId}"]`)
      );
      
      logTelemetry(TelemetryEventTypes.CARD_LIKE, {
        propertyId: variantId,
        index: currentIndex >= 0 ? currentIndex : null,
        totalInSlider: slides.length
      });
      
      this.events.emit('like', { variantId });
    } else if (e.target.matches('.card-btn[data-action="next"]')) {
      const variantId = e.target.getAttribute('data-variant-id');
      
      // Логируем card_next
      const track = this.getRoot().querySelector('.cards-slider .cards-track');
      const slides = track ? track.querySelectorAll('.card-slide') : [];
      const currentIndex = Array.from(slides).findIndex(slide => 
        slide.querySelector(`[data-variant-id="${variantId}"]`)
      );
      
      logTelemetry(TelemetryEventTypes.CARD_NEXT, {
        propertyId: variantId,
        index: currentIndex >= 0 ? currentIndex : null,
        totalInSlider: slides.length,
        source: 'recommendation'
      });
      
      this.events.emit('next_option', { variantId });
    } else if (e.target.closest('[data-action="catalog-list-prev"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      this.handleCatalogListPrev();
    } else if (e.target.closest('[data-action="catalog-list-next"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      this.handleCatalogListNext();
    } else if (e.target.closest('[data-action="read-description"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      const slide = e.target.closest('.card-slide');
      const overlay = slide?.querySelector('.cs-description-overlay');
      if (overlay) {
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
      }
    } else if (e.target.closest('[data-action="close-description"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      const slide = e.target.closest('.card-slide');
      const overlay = slide?.querySelector('.cs-description-overlay');
      if (overlay) {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
      }
    } else if (e.target.matches('.cs-description-overlay')) {
      const overlay = e.target;
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    } else if (e.target.closest('[data-action="show-hidden-specs"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      const slide = e.target.closest('.card-slide');
      const hiddenCount = Number(e.target.closest('[data-action="show-hidden-specs"]')?.getAttribute('data-hidden-count')) || 0;
      this.showBackSpecsOverflowPopup({ slide, hiddenCount });
    } else if (e.target.closest('.card-btn[data-action="select"]')) {
      // Flip: визуальный тест — показываем back сторону карточки
      const selectBtn = e.target.closest('.card-btn[data-action="select"]');
      const slide = selectBtn?.closest('.card-slide') || e.target.closest('.card-slide');
      const sliderHost = slide?.closest?.('.cards-slider-host');
      if (sliderHost) {
        sliderHost.querySelectorAll('.card-slide.flipped').forEach((s) => {
          if (s !== slide) s.classList.remove('flipped', 'card-slide--form-open');
        });
      }
      if (slide) slide.classList.add('flipped');
      if (slide) {
        requestAnimationFrame(() => {
          try { this.fitBackSpecsInSlide(slide); } catch {}
        });
      }
      // RMv3 / Sprint 1 / Task 1: фиксируем факт выбора карточки на сервере (server-first)
      const variantId = selectBtn?.getAttribute('data-variant-id') || '';
      try {
        if (this.api && variantId) {
          this.api.sendCardInteraction('select', variantId);
        }
      } catch {}
    } else if (e.target.closest('.card-back-header__close')) {
      // В deep-link режиме возвращаемся в общий каталог, иначе обычный flip-back.
      if (this._isDeepLinkMode) {
        this.exitDeepLinkMode({ clearUrl: true });
      } else {
        const slide = e.target.closest('.card-slide');
        if (slide) slide.classList.remove('flipped');
      }
    } else if (e.target.closest('.card-back-icon-btn[data-action="share-property"]')) {
      const slide = e.target.closest('.card-slide');
      try { await this.sharePropertyFromSlide(slide); } catch {}
    } else if (e.target.closest('.card-back-icon-btn[data-action="tg-share-property"]')) {
      const slide = e.target.closest('.card-slide');
      try { this.sharePropertyToTelegram(slide); } catch {}
    } else if (
      e.target.closest('[data-action="contact-manager"]') ||
      e.target.matches('.btn-open-form') ||
      e.target.closest('.btn-open-form')
    ) {
      const slide = e.target.closest('.card-slide');
      const cardId = String(
        slide?.id ||
        slide?.querySelector('.cs')?.getAttribute('data-variant-id') ||
        ''
      ).trim() || null;
      try { this.openContactManagerPopup({ source: 'tg_property_card', propertyId: cardId, slide }); } catch {}
    } else if (e.target.closest('.card-form-header__back')) {
      // Форма -> назад к описанию
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.remove('card-slide--form-open');
    } else if (e.target.matches('.in-dialog-lead__send')) {
      const formRoot = e.target.closest('.in-dialog-lead');
      try { this.submitInDialogLeadForm?.(formRoot); } catch {}
    } else if (e.target.matches('.in-dialog-lead__cancel')) {
      const slide = e.target.closest('.card-slide');
      if (slide) {
        slide.classList.remove('flipped');
      } else {
        try { this.cancelHandoffFlowUI(); } catch {}
        try { this.sendHandoffCancelToServer?.(); } catch {}
      }
    } else if (e.target.matches('.in-dialog-lead__privacy-link')) {
      // UI-only: keep link inert for demo stage (no navigation)
      try { e.preventDefault(); } catch {}
    } else if (e.target.matches('#inDialogThanksCloseBtn')) {
      try {
        const t = this.$byId('inDialogLeadThanksBlock');
        if (t && t.parentElement) t.parentElement.removeChild(t);
      } catch {}
    } else if (e.target.closest('.header-action.header-right')) {
      // Close widget from header right action
      try { this.closeWidget?.(); } catch {}
    } else if (e.target.matches('.cards-dot')) {
      try { e.stopPropagation(); } catch {}
      // Навигация по слайдеру через точки
      const dot = e.target;
      const row = dot.closest('.cards-dots-row');
      const slider = this.getRoot().querySelector('.cards-slider');
      if (!row || !slider) return;
      const dots = Array.from(row.querySelectorAll('.cards-dot'));
      const idx = dots.indexOf(dot);
      const slides = slider.querySelectorAll('.card-slide');
      if (idx >= 0 && slides[idx]) {
        this.scrollToSlideIndex(idx);
      }
    }
  });
}

  // ---------- ПРЯМО ТУТ ЗАКАНЧИВВАЕТСЯ ФУНКЦИЯ РЕНДЕР (В НЕЙ ЛЕЖАТ СТИЛИ v2/ ----------
                  // верстка и стили всех экранов в разметке и стилях/ 
                  // логика и верстка старой лид формы (удалено)/
                  // логика и верстка инлайн лид формы (удалено)/
                  // логика карточек квартир) 




  // ---------- EVENTS / COORDINATION ----------
  bindEvents() {
    // события рекордера → UI
    this.events.on('recordingStarted', () => {
      this.showChatScreen();
      this.showRecordingIndicator('chat');
      this.updateToggleButtonState('chat');
    });
    this.events.on('recordingStopped', () => {
      this.hideRecordingIndicator('chat');
      this.updateToggleButtonState('chat');
    });
    this.events.on('recordingCancelled', () => {
      this.hideRecordingIndicator('chat');
      this.updateToggleButtonState('chat');
    });

    // Text message sent - ensure chat screen visible
    this.events.on('textMessageSent', (d) => { 
      console.log('📤 Text message sent:', d?.text?.slice(0,50));
      this.showChatScreen();
    });

    // understanding
    this.events.on('understandingUpdated', (u) => { 
      console.log('🧠 Understanding updated:', u);
      this.updateDetailsScreen(u);
    });

    // UI
    this.events.on('uiStateChanged', (data) => {
      console.log(`🎯 UI State: ${data.from} → ${data.to}`);
      if (data.to === 'recording') this.isRecording = true;
      else if (data.from === 'recording') this.isRecording = false;
    });

    // API
    this.events.on('messageReceived', (d) => { 
      console.log('📥 Message received:', d?.type);
      if (d?.type === 'property_card') {
        this.showPropertyCard(d.data);
      }
    });
    
    
    // Card interactions
    this.events.on('like', (data) => {
      console.log('❤️ Like clicked:', data.variantId);
      // Send variant ID back to backend
      this.api.sendCardInteraction('like', data.variantId);
    });
    this.events.on('next_option', (data) => {
      console.log('⏭️ Next option clicked:', data.variantId);
      // Send variant ID back to backend
      this.api.sendCardInteraction('next', data.variantId);
    });

    // ошибки/нотификации/лоадеры
    this.events.on('error', (e) => { console.error('🚨 Widget error:', e); this.ui.showNotification(`❌ Ошибка: ${e.message}`); });
    this.events.on('notification', (m) => this.ui.showNotification(m));
    this.events.on('loadingStart', () => this.ui.showLoading());
    this.events.on('loadingEnd', () => this.ui.hideLoading());

    console.log('🔗 Event coordination established');
  }

  // ---------- ПУБЛИЧНЫЕ МЕТОДЫ ----------
  
  // Helper function to update understanding percentage
  // Update header understanding bar only
  updateHeaderUnderstanding(percent) {
    // Understanding bar removed — no-op
  }

  // Recording indicator management
  showRecordingIndicator(screen = 'chat') {
    const indicator = this.$byId('recordingIndicator');
    const textInput = this.getRoot().querySelector('#textInput');
    const wrapper = textInput ? textInput.closest('.text-input-wrapper') : null;
    const inputContainer = textInput ? textInput.closest('.input-container') : null;
    
    if (indicator) {
      indicator.style.display = 'flex';
      if (wrapper) wrapper.classList.add('recording');
      if (inputContainer) inputContainer.classList.add('is-recording-wave');
    }
  }

  hideRecordingIndicator(screen = 'chat') {
    const indicator = this.$byId('recordingIndicator');
    const textInput = this.getRoot().querySelector('#textInput');
    const wrapper = textInput ? textInput.closest('.text-input-wrapper') : null;
    const inputContainer = textInput ? textInput.closest('.input-container') : null;
    
    if (indicator) {
      indicator.style.display = 'none';
      if (wrapper) wrapper.classList.remove('recording');
      if (inputContainer) inputContainer.classList.remove('is-recording-wave');
    }
  }




  
  startRecording() {
    if (this.ui.getCurrentState() === 'idle' || this.ui.getCurrentState() === 'typing') {
      return this.audioRecorder.startRecording();
    }
    console.warn('⚠️ Cannot start recording in state:', this.ui.getCurrentState());
    return false;
  }
  sendTextMessage() {
    if (this.ui.getCurrentState() === 'typing') return this.api.sendTextMessage();
    console.warn('⚠️ Cannot send text in state:', this.ui.getCurrentState());
    return false;
  }
  cancelRecording() {
    if (this.ui.getCurrentState() === 'recording') return this.audioRecorder.cancelRecording();
    console.warn('⚠️ No recording to cancel in state:', this.ui.getCurrentState());
    return false;
  }

  // Update details screen with understanding data (канонические ключи)
  updateDetailsScreen(understanding) {
    const params = understanding.params || understanding;
    
    // Update progress
    const progressFill = this.$byId('progressFill');
    const progressText = this.$byId('progressText');
    const progress = (typeof understanding.progress === 'number') ? understanding.progress : 0;
    if (progressFill && progressText) {
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}% — ${progress === 0 ? 'ожидание' : 'обработка'}`;
    }

    // Update parameter values and dots
    const updateParam = (id, value, dotId) => {
      const valueEl = this.$byId(id);
      const dotEl = this.$byId(dotId);
      if (valueEl) {
        const text = value || 'не определено';
        valueEl.textContent = text;
        valueEl.setAttribute('title', text);
        valueEl.setAttribute('data-tooltip', text);
      }
      if (dotEl) dotEl.classList.toggle('on', !!value);
    };

    updateParam('nameValue', params.name, 'nameDot');
    updateParam('operationValue', params.operation ?? params.operationType, 'operationDot');
    updateParam('budgetValue', params.budget, 'budgetDot');
    updateParam('typeValue', params.type ?? params.propertyType, 'typeDot');
    updateParam('locationValue', params.location ?? params.district, 'locationDot');
    updateParam('roomsValue', params.rooms, 'roomsDot');
    updateParam('areaValue', params.area, 'areaDot');
    updateParam('detailsValue', params.details ?? params.locationDetails, 'detailsDot');
    updateParam('preferencesValue', params.preferences ?? params.additional, 'preferencesDot');
  }

  _buildPillDefaultLabel() {
    const locale = this.getCurrentLocale();
    const value = Number(this._pillBaseCount);
    if (!Number.isFinite(value) || value <= 0) return locale.pillCta || 'Смотреть подборку';
    const formatted = new Intl.NumberFormat('en-US').format(Math.max(0, value));
    return this.t('pillFound', { count: formatted }) || `Найдено ${formatted} объектов`;
  }

  _refreshObjectsPillLocale({ animate = false } = {}) {
    const state = String(this._pillState || 'default');
    const locale = this.getCurrentLocale();
    if (state === 'insight') {
      this._setObjectsPillText(locale.pillNewInsight || 'Новый инсайт', 'insight', { animate, pulse: true });
      return;
    }
    if (state === 'cta') {
      this._setObjectsPillText(locale.pillCta || 'Смотреть подборку', 'cta', { animate, pulse: false });
      return;
    }
    this._setObjectsPillText(this._buildPillDefaultLabel(), 'default', { animate, pulse: false });
  }

  _setObjectsPillText(text, state = 'default', { animate = true, pulse = false } = {}) {
    const pill = this.$byId('objectsCounterPill');
    if (!pill) return;
    this._pillState = state;
    pill.dataset.state = state;
    pill.textContent = String(text || '');
    pill.classList.toggle('is-state-default', state === 'default');
    pill.classList.toggle('is-state-insight', state === 'insight');
    pill.classList.toggle('is-state-cta', state === 'cta');
    if (animate) {
      pill.classList.remove('is-text-animating');
      // force reflow to restart animation
      void pill.offsetWidth;
      pill.classList.add('is-text-animating');
    }
    if (pulse) {
      pill.classList.remove('is-insight-pulse');
      void pill.offsetWidth;
      pill.classList.add('is-insight-pulse');
    } else {
      pill.classList.remove('is-insight-pulse');
    }
  }

  _snapshotInsights(insights = null) {
    if (!insights || typeof insights !== 'object') return null;
    const keys = ['name', 'operation', 'budget', 'type', 'location', 'rooms', 'area', 'details', 'preferences'];
    const out = {};
    for (const key of keys) {
      const raw = insights[key];
      if (raw === null || raw === undefined) { out[key] = null; continue; }
      if (typeof raw === 'number' && Number.isFinite(raw)) { out[key] = raw; continue; }
      if (Array.isArray(raw)) {
        const joined = raw.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).join('|');
        out[key] = joined || null;
        continue;
      }
      const str = String(raw).trim().toLowerCase();
      out[key] = str || null;
    }
    return out;
  }

  _hasAnyInsight(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    return Object.values(snapshot).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
  }

  _detectNewInsight(insights = null) {
    const next = this._snapshotInsights(insights);
    if (!next) return false;
    if (!this._lastPillInsightsSnapshot) {
      const hasAny = this._hasAnyInsight(next);
      this._lastPillInsightsSnapshot = next;
      return hasAny;
    }
    const prev = this._lastPillInsightsSnapshot;
    this._lastPillInsightsSnapshot = next;
    return Object.keys(next).some((key) => next[key] !== null && next[key] !== prev[key]);
  }

  _runInsightPillSequence() {
    if (this._pillCtaTimer) {
      clearTimeout(this._pillCtaTimer);
      this._pillCtaTimer = null;
    }
    this._setObjectsPillText((this.getCurrentLocale().pillNewInsight || 'Новый инсайт'), 'insight', { animate: true, pulse: true });
    try {
      const tg = window?.Telegram?.WebApp;
      if (tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred('success');
      } else if (navigator?.vibrate) {
        navigator.vibrate([18, 26, 18]);
      }
    } catch {}
    this._pillCtaTimer = setTimeout(() => {
      this._setObjectsPillText((this.getCurrentLocale().pillCta || 'Смотреть подборку'), 'cta', { animate: true, pulse: false });
      this._pillCtaTimer = null;
    }, 2000);
  }

  updateObjectCount(count, { forceLabel = false } = {}) {
    const numeric = Number(count);
    this._pillBaseCount = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
    if (forceLabel || this._pillState === 'default') {
      this._setObjectsPillText(this._buildPillDefaultLabel(), 'default', { animate: false, pulse: false });
    }
  }

  ingestBackendCatalogPayload(data = {}) {
    if (!data || typeof data !== 'object') return;
    if (!window.appState) window.appState = {};
    const hasNewInsight = this._detectNewInsight(data.insights);

    const totalMatches = Number(data.totalMatches);
    if (Number.isFinite(totalMatches)) {
      window.appState.lastTotalMatches = Math.max(0, totalMatches);
      this.updateObjectCount(window.appState.lastTotalMatches);
    }
    const strictMatches = Number(data.strictMatches);
    if (Number.isFinite(strictMatches)) {
      window.appState.lastStrictMatches = Math.max(0, strictMatches);
    }
    const relaxedMatches = Number(data.relaxedMatches);
    if (Number.isFinite(relaxedMatches)) {
      window.appState.lastRelaxedMatches = Math.max(0, relaxedMatches);
    }

    const cards = [];
    if (Array.isArray(data.topCandidates)) cards.push(...data.topCandidates);
    if (Array.isArray(data.cards)) cards.push(...data.cards);
    if (data.card && typeof data.card === 'object') cards.push(data.card);

    if (cards.length) {
      this.mergePropertiesToCatalog(cards);
      window.appState.lastBackendCandidatesAt = Date.now();
    }
    if (hasNewInsight) this._runInsightPillSequence();
  }

  _getPropertiesEndpointCandidates() {
    const defaults = [];
    try {
      const fromWindow = typeof window !== 'undefined' ? window.__VW_CARDS_SEARCH_URL__ : '';
      const cardsUrl = String(fromWindow || '').trim();
      if (cardsUrl) defaults.push(cardsUrl);
    } catch {}
    try {
      const u = new URL(String(this.apiUrl || ''));
      const base = `${u.protocol}//${u.host}`;
      return [`${base}/api/cards/search?limit=2000`, ...defaults];
    } catch {
      return defaults;
    }
  }

  _extractPropertiesList(data) {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.properties)
        ? data.properties
        : Array.isArray(data.cards)
          ? data.cards
          : Array.isArray(data.items)
            ? data.items
            : [];
    return Array.isArray(list) ? list.filter((item) => item?.active !== false && item?.isActive !== false) : [];
  }

  _toCardEngineShape(raw = {}) {
    const firstImage = Array.isArray(raw.images) && raw.images.length
      ? raw.images.find((src) => typeof src === 'string' && src.trim())
      : (typeof raw.images === 'string' ? raw.images : '');
    const image = raw.image || raw.imageUrl || firstImage || '';
    const priceEUR = raw.priceEUR ?? raw.price_amount ?? raw.priceAmount ?? null;
    const price = raw.price ?? priceEUR ?? null;
    const areaM2 = raw.area_m2 ?? raw.specs_area_m2 ?? raw.specs?.area_m2 ?? null;
    const numericArea = Number(areaM2);
    const numericPrice = Number(price);
    const computedPricePerM2 = Number.isFinite(numericPrice) && numericPrice > 0 && Number.isFinite(numericArea) && numericArea > 0
      ? Math.round(numericPrice / numericArea)
      : null;
    const parsedScore = Number(raw.score ?? raw._score);
    const parsedStrictScore = Number(raw.strictScore ?? raw._strictScore);
    return {
      ...raw,
      id: raw.id || raw.external_id || raw.externalId || raw.propertyId || raw.uid || '',
      image,
      images: Array.isArray(raw.images)
        ? raw.images
        : (typeof raw.images === 'string' && raw.images.trim() ? [raw.images.trim()] : (image ? [image] : [])),
      price,
      priceEUR,
      city: raw.city || raw.location_city || raw.location?.city || '',
      district: raw.district || raw.location_district || raw.location?.district || '',
      neighborhood: raw.neighborhood || raw.location_neighborhood || raw.location?.neighborhood || '',
      description: raw.description || raw.title || '',
      property_type: raw.property_type || raw.propertyType || raw.type || '',
      furnished: raw.furnished ?? raw.isFurnished ?? null,
      rooms: raw.rooms ?? raw.specs_rooms ?? raw.specs?.rooms ?? null,
      floor: raw.floor ?? raw.specs_floor ?? raw.specs?.floor ?? null,
      bathrooms: raw.bathrooms ?? raw.specs_bathrooms ?? raw.specs?.bathrooms ?? null,
      area_m2: areaM2,
      price_per_m2: raw.price_per_m2 ?? computedPricePerM2 ?? null,
      score: Number.isFinite(parsedScore) ? parsedScore : 0,
      strictScore: Number.isFinite(parsedStrictScore) ? parsedStrictScore : 0,
      matchTier: raw.matchTier || raw._tier || 'low'
    };
  }

  _getPropertyCatalogKey(item, index = 0) {
    const candidate = item?.id ?? item?.external_id ?? item?.externalId ?? item?.propertyId ?? item?.uid ?? null;
    if (candidate != null && String(candidate).trim()) return String(candidate).trim().toUpperCase();
    return `__idx_${index}_${(item?.title || '').toString().slice(0, 32)}`;
  }

  mergePropertiesToCatalog(properties = []) {
    const incoming = this._extractPropertiesList(properties);
    if (!window.appState) window.appState = {};
    const current = Array.isArray(window.appState.allProperties) ? window.appState.allProperties : [];
    const merged = new Map();
    current.forEach((item, idx) => {
      const normalized = this._toCardEngineShape(item);
      merged.set(this._getPropertyCatalogKey(normalized, idx), normalized);
    });
    incoming.forEach((item, idx) => {
      const normalized = this._toCardEngineShape(item);
      merged.set(this._getPropertyCatalogKey(normalized, idx), normalized);
    });
    window.appState.allProperties = Array.from(merged.values());
  }

  replacePropertiesCatalog(properties = []) {
    const incoming = this._extractPropertiesList(properties);
    if (!window.appState) window.appState = {};
    window.appState.allProperties = incoming.map((item) => this._toCardEngineShape(item));
  }

  async loadAllProperties() {
    const candidates = this._getPropertiesEndpointCandidates();
    for (const endpoint of candidates) {
      try {
        console.log('Fetching properties from:', endpoint);
        const response = await fetch(endpoint);
        if (!response.ok) {
          console.error('Properties fetch failed:', endpoint, response.status, response.statusText);
          continue;
        }
        const data = await response.json().catch(() => ({}));
        const list = this._extractPropertiesList(data);
        if (Array.isArray(list) && list.length) {
          console.log('Properties loaded from:', endpoint, 'count:', list.length);
          return list;
        }
        console.log('Properties endpoint returned empty list:', endpoint);
      } catch (error) {
        console.error('Properties fetch error from:', endpoint, error);
      }
    }
    return [];
  }

  async initializePropertiesCatalog() {
    try {
      if (!window.appState) window.appState = {};
      if (!Array.isArray(window.appState.allProperties)) {
        window.appState.allProperties = [];
      }
      if (!Number.isFinite(Number(window.appState.lastTotalMatches))) {
        window.appState.lastTotalMatches = 0;
      }
      // Always-available catalog baseline: if session has no counts/candidates yet,
      // preload global catalog so the pill stays actionable from first open.
      if (!window.appState.allProperties.length) {
        const all = await this.loadAllProperties();
        if (Array.isArray(all) && all.length) {
          this.replacePropertiesCatalog(all);
          if ((Number(window.appState.lastTotalMatches) || 0) <= 0) {
            window.appState.lastTotalMatches = all.length;
          }
        }
      }
      this.updateObjectCount(window.appState.lastTotalMatches, { forceLabel: true });
      await this.tryOpenDeepLinkedProperty();
    } catch {}
  }

  clearPropertiesSlider() {
    try {
      const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
      if (host?.parentElement) host.parentElement.removeChild(host);
    } catch {}
    this._catalogOverflowQueue = [];
    this._catalogOverflowLoading = false;
    this._catalogVisibleIds = [];
    this._sliderCheckpointShown = { 10: false, 20: false };
    try { this.closeSliderCheckpointPopup(); } catch {}
    this._catalogActiveId = null;
    this._catalogListWindowStart = 0;
  }

  findCatalogPropertyById(id) {
    const sid = String(id ?? '').trim();
    if (!sid) return null;
    const list = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i];
      if (!p || typeof p !== 'object') continue;
      const pid = String(p.id ?? p.variantId ?? p._id ?? '').trim();
      if (pid === sid) return p;
    }
    return null;
  }

  getCatalogLoadedIdsFromStateOrDom() {
    const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
    const stateIds = Array.isArray(this._catalogVisibleIds) ? this._catalogVisibleIds.map(String).filter(Boolean) : [];
    if (stateIds.length) return Array.from(new Set(stateIds));
    if (!host) return [];
    const domIds = [];
    host.querySelectorAll('.cards-track .card-slide').forEach((s) => {
      const vid =
        String(s.id || '').trim() ||
        String(s.querySelector('.cs')?.getAttribute('data-variant-id') || '').trim();
      if (vid) domIds.push(vid);
    });
    return Array.from(new Set(domIds));
  }

  renderCatalogListWindow(loadedIds = [], activeId = null) {
    const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
    if (!host) return;
    const listBody = host.querySelector('.cards-list-body');
    if (!listBody) return;
    listBody.innerHTML = '';
    if (!Array.isArray(loadedIds) || !loadedIds.length) {
      this.updateCatalogListNavState();
      return;
    }
    const windowSize = Math.max(1, Number(this._catalogListWindowSize) || 3);
    const maxStart = Math.max(0, loadedIds.length - windowSize);
    let start;
    if ((Number(this._catalogListWindowStart) || 0) < 0) {
      let anchorIdx = loadedIds.length - 1;
      if (activeId) {
        const idx = loadedIds.indexOf(String(activeId));
        if (idx >= 0) anchorIdx = idx;
      }
      start = Math.max(0, Math.min(maxStart, anchorIdx - (windowSize - 1)));
    } else {
      start = Math.max(0, Math.min(maxStart, Number(this._catalogListWindowStart) || 0));
    }
    const end = Math.min(loadedIds.length, start + windowSize);
    this._catalogListWindowStart = start;
    const windowIds = loadedIds.slice(start, end);
    windowIds.forEach((vid) => {
      const property = this.findCatalogPropertyById(vid);
      if (!property) return;
      try {
        this.showMockCardWithActions(this._toCardEngineShape(property), { suppressAutoscroll: true });
      } catch {}
    });
    // Keep active id aligned with currently visible tail card in list mode.
    this._catalogActiveId = windowIds.length ? windowIds[windowIds.length - 1] : null;
    try { this.maybeTriggerSliderCheckpoint(Math.max(0, end - 1)); } catch {}
    this.updateCatalogListNavState();
  }

  updateCatalogListNavState() {
    const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
    if (!host) return;
    const prevBtn = host.querySelector('[data-action="catalog-list-prev"]');
    const nextBtn = host.querySelector('[data-action="catalog-list-next"]');
    if (!prevBtn || !nextBtn) return;
    const loadedIds = this.getCatalogLoadedIdsFromStateOrDom();
    const windowSize = Math.max(1, Number(this._catalogListWindowSize) || 3);
    const maxStart = Math.max(0, loadedIds.length - windowSize);
    const start = Math.max(0, Math.min(maxStart, Number(this._catalogListWindowStart) || 0));
    const queue = Array.isArray(this._catalogOverflowQueue) ? this._catalogOverflowQueue : [];
    const canPrev = start > 0;
    const canNext = start < maxStart || queue.length > 0;
    prevBtn.disabled = !canPrev;
    nextBtn.disabled = !canNext;
  }

  handleCatalogListPrev() {
    if (this._catalogDisplayMode !== 'list') return;
    const loadedIds = this.getCatalogLoadedIdsFromStateOrDom();
    if (!loadedIds.length) return;
    const windowSize = Math.max(1, Number(this._catalogListWindowSize) || 3);
    const maxStart = Math.max(0, loadedIds.length - windowSize);
    const start = Math.max(0, Math.min(maxStart, Number(this._catalogListWindowStart) || 0));
    if (start <= 0) {
      this.updateCatalogListNavState();
      return;
    }
    this._catalogListWindowStart = start - 1;
    this.rebuildCatalogLayoutFromVisibleIds();
  }

  handleCatalogListNext() {
    if (this._catalogDisplayMode !== 'list') return;
    const loadedIds = this.getCatalogLoadedIdsFromStateOrDom();
    if (!loadedIds.length) return;
    const windowSize = Math.max(1, Number(this._catalogListWindowSize) || 3);
    const maxStart = Math.max(0, loadedIds.length - windowSize);
    const start = Math.max(0, Math.min(maxStart, Number(this._catalogListWindowStart) || 0));
    if (start < maxStart) {
      this._catalogListWindowStart = start + 1;
      this.rebuildCatalogLayoutFromVisibleIds();
      return;
    }
    const queue = Array.isArray(this._catalogOverflowQueue) ? this._catalogOverflowQueue : [];
    if (!queue.length) {
      this.updateCatalogListNavState();
      return;
    }
    const [nextProperty] = queue.splice(0, 1);
    if (nextProperty) {
      const normalized = this._toCardEngineShape(nextProperty);
      const nextId = String(normalized?.id || '').trim();
      if (nextId && !loadedIds.includes(nextId)) {
        this._catalogVisibleIds = [...loadedIds, nextId];
        const nextMaxStart = Math.max(0, this._catalogVisibleIds.length - windowSize);
        this._catalogListWindowStart = nextMaxStart;
      }
    }
    this.rebuildCatalogLayoutFromVisibleIds();
  }

  rebuildCatalogLayoutFromVisibleIds() {
    const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
    if (!host) return;
    const loadedIds = this.getCatalogLoadedIdsFromStateOrDom();
    this._catalogVisibleIds = [...loadedIds];
    const activeId = this._catalogActiveId && loadedIds.includes(String(this._catalogActiveId))
      ? String(this._catalogActiveId)
      : (loadedIds.length ? loadedIds[loadedIds.length - 1] : null);
    this._catalogActiveId = activeId;
    const queue = Array.isArray(this._catalogOverflowQueue) ? [...this._catalogOverflowQueue] : [];
    const track = host.querySelector('.cards-track');
    const listBody = host.querySelector('.cards-list-body');
    if (track) track.innerHTML = '';
    if (listBody) listBody.innerHTML = '';
    this._catalogOverflowQueue = queue;
    this._catalogOverflowLoading = false;
    if (this._catalogDisplayMode === 'list') {
      this.renderCatalogListWindow(loadedIds, activeId);
    } else {
      loadedIds.forEach((vid) => {
        const property = this.findCatalogPropertyById(vid);
        if (property) {
          try {
            this.showMockCardWithActions(this._toCardEngineShape(property), { suppressAutoscroll: true });
          } catch {}
        }
      });
    }
    requestAnimationFrame(() => {
      try {
        if (this._catalogDisplayMode !== 'list') {
          this.renderSliderDots();
          if (activeId) {
            const activeIdx = loadedIds.indexOf(activeId);
            if (activeIdx >= 0) this.scrollToSlideIndex(activeIdx);
          } else {
            this.updateActiveCardSlide();
          }
        } else {
          this.updateCatalogListNavState();
        }
        this.scrollCardHostIntoView();
      } catch {}
    });
  }

  setCatalogDisplayMode(mode) {
    const next = mode === 'list' ? 'list' : 'slider';
    const prev = this._catalogDisplayMode;
    this._catalogDisplayMode = next;
    const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
    if (host) {
      host.classList.toggle('catalog-layout-list', next === 'list');
      if (prev !== next && next === 'list') {
        // Re-anchor list window around current active card from slider.
        this._catalogListWindowStart = -1;
      }
      if (prev !== next) this.rebuildCatalogLayoutFromVisibleIds();
    }
  }

  bindCatalogListScrollOnMessages() {
    if (this._catalogListScrollBound) return;
    const messages = this.$byId('messagesContainer');
    if (!messages) return;
    this._catalogListScrollBound = true;
    messages.addEventListener(
      'scroll',
      () => {
        try {
          this.onCatalogListMessagesScroll();
        } catch {}
      },
      { passive: true }
    );
  }

  onCatalogListMessagesScroll() {
    // Intentionally no-op in list mode: navigation is button-driven
    // to avoid auto-loading the full queue on programmatic/container scroll.
  }

  maybeAppendCatalogListOne() {
    try {
      if (this._catalogDisplayMode !== 'list') return;
      const queue = Array.isArray(this._catalogOverflowQueue) ? this._catalogOverflowQueue : [];
      if (!queue.length) return;
      if (this._catalogOverflowLoading) return;
      this._catalogOverflowLoading = true;
      const nextChunk = queue.splice(0, 1);
      nextChunk.forEach((property) => {
        try {
          this.showMockCardWithActions(this._toCardEngineShape(property), { suppressAutoscroll: true });
        } catch {}
      });
      this._catalogOverflowLoading = false;
    } catch {
      this._catalogOverflowLoading = false;
    }
  }

  maybeAppendCatalogOverflow(activeIdx = 0, totalSlides = 0) {
    try {
      if (this._catalogDisplayMode === 'list') return;
      const queue = Array.isArray(this._catalogOverflowQueue) ? this._catalogOverflowQueue : [];
      if (!queue.length) return;
      if (this._catalogOverflowLoading) return;
      if (activeIdx < Math.max(0, totalSlides - 1)) return;
      this._catalogOverflowLoading = true;
      const nextChunk = queue.splice(0, 1);
      nextChunk.forEach((property) => {
        try { this.showMockCardWithActions(this._toCardEngineShape(property), { suppressAutoscroll: true }); } catch {}
      });
      this._catalogOverflowLoading = false;
    } catch {
      this._catalogOverflowLoading = false;
    }
  }

  async hydrateCatalogFromBackend(limit = 50) {
    try {
      const payload = await this.api.fetchSessionCandidates(limit);
      const cards = Array.isArray(payload?.cards) ? payload.cards : [];
      this.replacePropertiesCatalog(cards);
      this.ingestBackendCatalogPayload(payload);
      return payload;
    } catch (error) {
      console.warn('hydrateCatalogFromBackend failed:', error);
      return { totalMatches: 0, cards: [] };
    }
  }

  async renderPropertiesFromCatalog() {
    await this.hydrateCatalogFromBackend(60);
    this._sliderCheckpointShown = { 10: false, 20: false };
    let list = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    if (!list.length) {
      const all = await this.loadAllProperties();
      if (Array.isArray(all) && all.length) {
        this.replacePropertiesCatalog(all);
        list = window.appState.allProperties || [];
        if ((Number(window?.appState?.lastTotalMatches) || 0) <= 0) {
          window.appState.lastTotalMatches = list.length;
          this.updateObjectCount(window.appState.lastTotalMatches, { forceLabel: true });
        }
      }
    }
    if (!list.length) {
      this.updateObjectCount(Number(window?.appState?.lastTotalMatches) || 0);
      return;
    }
    this.clearPropertiesSlider();
    const initialBatch = list.slice(0, 3);
    this._catalogOverflowQueue = list.slice(3);
    this._catalogVisibleIds = initialBatch.map((p) => String(this._toCardEngineShape(p)?.id || '').trim()).filter(Boolean);
    this._catalogActiveId = this._catalogVisibleIds.length ? this._catalogVisibleIds[this._catalogVisibleIds.length - 1] : null;
    this._catalogListWindowStart = 0;
    initialBatch.forEach((property, index) => {
      try { this.showMockCardWithActions(this._toCardEngineShape(property), { suppressAutoscroll: index > 0 }); } catch {}
    });
    requestAnimationFrame(() => {
      try {
        const messages = this.$byId('messagesContainer');
        const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
        if (!messages || !host) return;
        const targetTop = Math.max(0, host.offsetTop - 8);
        messages.scrollTo({ top: targetTop, behavior: 'smooth' });
      } catch {}
    });
  }

  // Update toggle button state
  updateToggleButtonState(screen) {
    const isRecording = this.audioRecorder.isRecording;
    const toggleButton = this.$byId('toggleButton');

    if (toggleButton) {
      if (isRecording) {
        // Show stop icon
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}${this.getStopIconByTheme()}" alt="Stop" />`;
        toggleButton.setAttribute('title', 'Сбросить');
      } else {
        // Show mic icon
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}${this.getMicIconByTheme()}" alt="Microphone" />`;
        toggleButton.setAttribute('title', 'Говорить');
      }
    }
  }

  // Update send button state
  updateSendButtonState(screen) {
    const textInput = this.$byId('textInput');
    const sendButton = this.$byId('sendButton');

    if (textInput && sendButton) {
      const text = textInput.value.trim();
      const hasText = !!text;
      
      // Always keep send button visible and enabled
      sendButton.disabled = false;
      sendButton.setAttribute('aria-disabled', 'false');
      sendButton.style.opacity = '1';
      sendButton.style.visibility = 'visible';
      sendButton.style.display = 'flex';
      
      // Add shaking animation when empty (but keep button visible)
      if (!hasText) {
        textInput.classList.add('shake');
        // Remove shake class after animation completes
        setTimeout(() => {
          textInput.classList.remove('shake');
        }, 500);
      } else {
        textInput.classList.remove('shake');
      }
    }
  }

  ensureCatalogListRow(listBody) {
    if (!listBody) return null;
    let row = listBody.querySelector('.cards-list-row:last-child');
    // Mobile-only: list mode is strictly one card per row.
    if (!row || row.querySelectorAll('.card-slide').length >= 1) {
      row = document.createElement('div');
      row.className = 'cards-list-row';
      listBody.appendChild(row);
    }
    return row;
  }

  // Catalog host: horizontal slider + list grid (same data; layout toggled via catalog-layout-list).
  ensureCatalogHost() {
    const thread = this.$byId('thread');
    const messages = this.$byId('messagesContainer');
    if (!thread || !messages) return null;
    let host = this.getRoot().querySelector('.card-screen.cards-slider-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'card-screen cards-slider-host';
      host.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="cards-slider">
            <div class="cards-track"></div>
          </div>
          <div class="cards-list">
            <div class="cards-list-body"></div>
            <div class="cards-list-nav" aria-label="Навигация списка">
              <button type="button" class="cards-list-nav-btn" data-action="catalog-list-prev" aria-label="Предыдущий объект">↑</button>
              <button type="button" class="cards-list-nav-btn" data-action="catalog-list-next" aria-label="Следующий объект">↓</button>
            </div>
          </div>
        </div>`;
      thread.appendChild(host);

      if (this.api) {
        requestAnimationFrame(() => {
          try {
            this.api.sendSliderStarted();
          } catch (e) {
            console.warn('Error sending slider started confirmation:', e);
          }
        });
      }

      const slider = host.querySelector('.cards-slider');
      const update = () => {
        try { this.updateActiveCardSlide(); } catch {}
        try { this.fitBackSpecsForAllSlides(); } catch {}
      };
      if (slider) {
        slider.addEventListener('scroll', update, { passive: true });
        try { window.addEventListener('resize', update); } catch {}
        requestAnimationFrame(update);
      }
    } else {
      const cs = host.querySelector('.cs');
      if (cs && !cs.querySelector('.cards-list')) {
        const list = document.createElement('div');
        list.className = 'cards-list';
        list.innerHTML = `
          <div class="cards-list-body"></div>
          <div class="cards-list-nav" aria-label="Навигация списка">
            <button type="button" class="cards-list-nav-btn" data-action="catalog-list-prev" aria-label="Предыдущий объект">↑</button>
            <button type="button" class="cards-list-nav-btn" data-action="catalog-list-next" aria-label="Следующий объект">↓</button>
          </div>`;
        cs.appendChild(list);
      }
    }
    host.classList.toggle('catalog-layout-list', this._catalogDisplayMode === 'list');
    return host;
  }

  // Add single card as slide into slider
  addCardSlide(normalized, options = {}) {
    const { suppressAutoscroll = false } = options || {};
    const host = this.ensureCatalogHost();
    if (!host) return;
    const isList = this._catalogDisplayMode === 'list';
    const track = host.querySelector('.cards-track');
    const listBody = host.querySelector('.cards-list-body');
    if (isList && !listBody) return;
    if (!isList && !track) return;
    const locale = this.getCurrentLocale();
    const slide = document.createElement('div');
    slide.className = 'card-slide';
    if (normalized?.id) slide.id = String(normalized.id).trim();
    const fallbackAssetOpenUrl = this.getCardAssetFallbackDataUrl();
    const assetSlots = Array.isArray(normalized.assetImages) ? normalized.assetImages.slice(0, 4) : [];
    while (assetSlots.length < 4) assetSlots.push('');
    const headerLeft = [normalized.city, normalized.propertyType].filter(Boolean).join(', ') || normalized.city || normalized.propertyType || '';
    const districtLine = normalized.district || normalized.neighborhood || '';
    const scoreValue = (() => {
      const raw = Number(normalized.score);
      if (!Number.isFinite(raw)) return 0;
      return Math.max(0, Math.min(100, Math.round(raw)));
    })();
    const scoreTier = String(normalized.matchTier || '').toLowerCase();
    const scoreTierClass = ['high', 'mid', 'low'].includes(scoreTier) ? ` card-back-header__score--${scoreTier}` : '';
    const scoreLabel = `Score: ${scoreValue}%`;
    const safeDescription = String(normalized.description || locale.cardDescriptionEmpty || 'Description unavailable')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const specsPills = [
      `🛏️ ${normalized.rooms ? `${normalized.rooms} rooms` : '— rooms'}`,
      `📐 ${normalized.area_m2 != null && normalized.area_m2 !== '' ? `${normalized.area_m2} m²` : '— m²'}`,
      `🏢 ${normalized.floor ? `${normalized.floor} floor` : '— floor'}`
    ];
    const backSpecsItemsBase = [
      { icon: '🛏️', text: normalized.rooms ? `${normalized.rooms} rooms` : '— rooms' },
      { icon: '📐', text: normalized.area_m2 != null && normalized.area_m2 !== '' ? `${normalized.area_m2} m²` : '— m²' },
      { icon: '💰', text: normalized.pricePerM2Label ? `${normalized.pricePerM2Label} UAH/m²` : '— UAH/m²' },
      { icon: '🏢', text: normalized.floor ? `${normalized.floor} floor` : '— floor' },
      { icon: '🛁', text: normalized.bathrooms ? `${normalized.bathrooms} bathrooms` : '— bathrooms' }
    ];
    const dynamicExtras = Array.isArray(normalized.backFeatureItems) ? normalized.backFeatureItems : [];
    const backSpecsItemsFallback = [
      { icon: '🏠', text: locale.backSpecsExtraType || 'Тип: апартаменты' },
      { icon: '📈', text: locale.backSpecsExtraMarket || 'Рынок: первичный' },
      { icon: '🗓️', text: locale.backSpecsExtraHandover || 'Сдача: Q4 2027' },
      { icon: '✨', text: locale.backSpecsExtraFinish || 'Отделка: премиум' },
      { icon: '🚗', text: locale.backSpecsExtraParking || 'Паркинг: 1 место' },
      { icon: '🌿', text: locale.backSpecsExtraTerrace || 'Терраса: есть' }
    ];
    const backSpecsItems = [...backSpecsItemsBase, ...(dynamicExtras.length ? dynamicExtras : backSpecsItemsFallback)];
    const backSpecsHtml = backSpecsItems
      .map((item) => `<span class="card-back-specs__item"><span class="card-back-specs__icon">${item.icon}</span><span class="card-back-specs__text">${String(item.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></span>`)
      .join('');
    const assetTilesHtml = assetSlots.map((assetUrl, idx) => {
      const safeUrl = String(assetUrl || '').trim();
      const isThumb = !!safeUrl;
      const openUrl = safeUrl || fallbackAssetOpenUrl;
      const cls = `card-back-asset${isThumb ? ' is-thumb' : ' is-fallback'}`;
      const thumbData = isThumb ? ` data-thumb-image="${safeUrl.replace(/"/g, '&quot;')}"` : '';
      return `<button type="button" class="${cls}" data-asset-index="${idx}" data-full-image="${openUrl.replace(/"/g, '&quot;')}" aria-label="Open image"${thumbData}><span class="card-back-asset__label">img</span></button>`;
    }).join('');
    slide.innerHTML = `
      <div class="card-slide-front">
        <div class="cs" data-variant-id="${normalized.id}" data-city="${normalized.city}" data-district="${normalized.district}" data-rooms="${normalized.rooms}" data-price-eur="${normalized.priceEUR}" data-image="${normalized.image}">
          <div class="cs-image">
            <div class="cs-image-overlay">
              <div class="cs-price-tag">${normalized.id || ''}</div>
              <!-- Кнопка «Нравится» временно снята в виду чистки интерфейса (логика не удалена)
              <button class="card-btn like" data-action="like" data-variant-id="${normalized.id}" aria-label="Нравится">
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              -->
            </div>
            <div class="cs-image-click-area">
              <div class="cs-image-media">${normalized.image ? `<img src="${normalized.image}" alt="${normalized.city} ${normalized.district}">` : 'Put image here'}</div>
            </div>
            <div class="card-front-assets">${assetTilesHtml}</div>
          </div>
          <div class="cs-body">
            <div class="cs-row cs-row--top">
              <div class="cs-title">${headerLeft}</div>
              <div class="cs-price-badges">
                <div class="cs-inline-price cs-inline-price--total">${normalized.priceLabel || ''}</div>
              </div>
            </div>
            <div class="cs-row cs-row--district">
              <div class="cs-district">${districtLine}</div>
              <button type="button" class="cs-description-btn" data-action="read-description" aria-label="${locale.cardReadDescription || 'Описание'}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h8l4 4v12H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 4v4h4M9 13h6M9 16h6M9 10h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                <span>${locale.cardReadDescription || 'Описание'}</span>
              </button>
            </div>
            <div class="cs-row cs-row--specs">
              <div class="cs-features cs-features--main-specs">${specsPills.map((item) => `<span class="cs-feature-item cs-feature-item--pill">${item}</span>`).join('')}</div>
            </div>
            <div class="card-slide-paginator cards-dots-row"></div>
            <div class="card-actions-wrap">
              <button class="card-btn select card-more-btn" data-action="select" data-variant-id="${normalized.id}">
                <span>${locale.handoffDetails || 'Подробнее'}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
          <div class="cs-description-overlay" data-role="description-overlay" aria-hidden="true">
            <div class="cs-description-panel">
              <div class="cs-description-title">${locale.cardDescriptionTitle || 'Описание объекта'}</div>
              <div class="cs-description-text">${safeDescription}</div>
              <button type="button" class="cs-description-ok" data-action="close-description">${locale.cardDescriptionOk || 'OK'}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card-slide-back">
        <div class="card-slide-back__bg${normalized.image ? '' : ' card-slide-back__bg--fallback'}" aria-hidden="true"></div>
        <div class="card-back-header">
          <button type="button" class="card-back-header__close" aria-label="Back">Назад</button>
          <span class="card-back-header__score${scoreTierClass}" aria-hidden="true">${scoreLabel}</span>
        </div>
        <div class="card-back-scroll">
          <div class="card-back-specs">${backSpecsHtml}</div>
        </div>
        <div class="card-back-actions">
          <button type="button" class="btn-open-form card-back-primary-action" data-action="contact-manager">${locale.cardBackContact || locale.appHeaderContact || 'Связаться'}</button>
          <button type="button" class="card-back-icon-btn" data-action="share-property" aria-label="Поделиться ссылкой" title="Поделиться ссылкой"><img src="${ASSETS_BASE}link-share-btn.svg" alt="Share link"></button>
          <button type="button" class="card-back-icon-btn" data-action="tg-share-property" aria-label="Поделиться в Telegram" title="Поделиться в Telegram"><img src="${ASSETS_BASE}tg-share-btn.svg" alt="Share in Telegram"></button>
        </div>
      </div>
      <div class="card-slide-form">
        <div class="card-form-header">
          <button type="button" class="card-form-header__back" aria-label="Back">
            <img src="${ASSETS_BASE}${this.getReturnIconByTheme()}" alt="Back">
          </button>
          <span class="card-form-header__title">${locale.leaveRequest}</span>
          <span class="card-form-header__spacer" aria-hidden="true"></span>
        </div><div class="card-back-separator"></div>
        ${this.getInDialogLeadFormHTML(this.getCurrentLocale(), '_' + normalized.id)}
      </div>`;
    if (isList) {
      const row = this.ensureCatalogListRow(listBody);
      if (row) row.appendChild(slide);
    } else if (track) {
      track.appendChild(slide);
    }
    if (normalized?.id) {
      const vid = String(normalized.id).trim();
      if (vid) {
        if (!Array.isArray(this._catalogVisibleIds)) this._catalogVisibleIds = [];
        if (!this._catalogVisibleIds.includes(vid)) this._catalogVisibleIds.push(vid);
        this._catalogActiveId = vid;
      }
    }
    try {
      slide.querySelectorAll('.card-back-asset.is-thumb').forEach((assetBtn) => {
        const thumbUrl = assetBtn.getAttribute('data-thumb-image');
        if (thumbUrl) assetBtn.style.backgroundImage = `url("${thumbUrl}")`;
      });
    } catch {}
    try {
      const backBg = slide.querySelector('.card-slide-back__bg');
      if (backBg && normalized.image) {
        backBg.style.backgroundImage = `url("${normalized.image}")`;
      }
    } catch {}
    try { this.bindInDialogLeadForm(slide.querySelector('.card-slide-form .in-dialog-lead'), '_' + normalized.id); } catch {}
    try { this.fitBackSpecsInSlide(slide); } catch {}
    
    // 🆕 Sprint I: отправляем подтверждение факта рендера карточки после визуального показа
    const cardId = normalized.id;
    if (cardId && this.api) {
      // Используем requestAnimationFrame для гарантии, что DOM обновлен и карточка видима
      requestAnimationFrame(() => {
        try {
          this.api.sendCardRendered(cardId);
        } catch (e) {
          console.warn('Failed to send card rendered confirmation:', e);
        }
      });
    }
    
    requestAnimationFrame(() => {
      if (!isList) {
        const tr = host.querySelector('.cards-track');
        const targetLeft = slide.offsetLeft;
        if (!suppressAutoscroll && tr) {
          try {
            const slider = host.querySelector('.cards-slider');
            if (slider) slider.scrollTo({ left: targetLeft, behavior: 'smooth' });
            else tr.scrollTo({ left: targetLeft, behavior: 'smooth' });
          } catch {
            try { tr.scrollTo({ left: targetLeft, behavior: 'smooth' }); } catch {}
          }
        }
        if (!suppressAutoscroll) {
          try {
            const slider = host.querySelector('.cards-slider');
            const allSlides = slider ? slider.querySelectorAll('.card-slide') : [];
            allSlides.forEach((s) => s.classList.remove('active'));
            slide.classList.add('active');
            const rows = slider ? slider.querySelectorAll('.cards-dots-row') : [];
            const activeIdx = allSlides.length ? allSlides.length - 1 : 0;
            rows.forEach((row) => {
              const dots = row.querySelectorAll('.cards-dot');
              dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
            });
          } catch {}
        }
        try { this.renderSliderDots(); } catch {}
      }
      try { this.scrollCardHostIntoView(); } catch {}
    });
  }

  // Show property card in slider
  showPropertyCard(property, options = {}) {
    const normalized = this.normalizeCardData(property);
    this.addCardSlide(normalized, options);
  }

  // Show mock card in slider (with actions)
  showMockCardWithActions(mock = {}, options = {}) {
    const normalized = this.normalizeCardData(mock);
    this.addCardSlide(normalized, options);
  }

  // Прокрутка контейнера сообщений так, чтобы карточка была полностью видна
  scrollCardHostIntoView() {
    try {
      const messages = this.$byId('messagesContainer');
      const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
      if (!messages || !host) return;
      const bottom = host.offsetTop + host.offsetHeight;
      const viewBottom = messages.scrollTop + messages.clientHeight;
      // если нижняя часть карточки не видна — прокрутим до низа карточки
      if (bottom > viewBottom - 8) {
        const target = Math.max(0, bottom - messages.clientHeight + 8);
        messages.scrollTo({ top: target, behavior: 'smooth' });
      }
    } catch {}
  }

  // Highlight active slide (nearest to center)
  updateActiveCardSlide() {
    const slider = this.getRoot().querySelector('.cards-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.card-slide');
    if (!slides.length) return;
    const center = slider.scrollLeft + slider.clientWidth / 2;
    let closest = null; let best = Infinity;
    slides.forEach((s) => {
      const mid = s.offsetLeft + s.clientWidth / 2;
      const d = Math.abs(mid - center);
      if (d < best) { best = d; closest = s; }
    });
    
    // 🆕 Sprint IV: определяем предыдущую активную карточку для сравнения
    const previousActive = slider.querySelector('.card-slide.active');
    const previousCardId = previousActive ? previousActive.querySelector('[data-variant-id]')?.getAttribute('data-variant-id') : null;
    
    slides.forEach(s => s.classList.remove('active'));
    if (closest) closest.classList.add('active');
    const activeId = closest?.querySelector('[data-variant-id]')?.getAttribute('data-variant-id');
    if (activeId) this._catalogActiveId = String(activeId);
    slides.forEach((s) => {
      if (s !== closest) {
        s.classList.remove('flipped', 'card-slide--form-open');
      }
    });

    // 🆕 Sprint IV: отправляем ui_focus_changed только если фокус реально изменился
    if (closest) {
      const currentCardId = closest.querySelector('[data-variant-id]')?.getAttribute('data-variant-id');
      if (currentCardId && currentCardId !== previousCardId && this.api) {
        requestAnimationFrame(() => {
          try {
            this.api.sendFocusChanged(currentCardId);
          } catch (e) {
            console.warn('Error sending focus changed confirmation:', e);
          }
        });
      }
    }
    
    const activeIdx = Array.from(slides).indexOf(closest);
    try { this.maybeTriggerSliderCheckpoint(activeIdx); } catch {}
    try { this.maybeAppendCatalogOverflow(activeIdx, slides.length); } catch {}
    // update each slide dots row
    const rows = slider.querySelectorAll('.cards-dots-row');
    rows.forEach(row => {
      const dots = row.querySelectorAll('.cards-dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    });
  }

  // Build dots per slide count
  renderSliderDots() {
    const slider = this.getRoot().querySelector('.cards-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.card-slide');
    const count = slides.length;
    const rows = slider.querySelectorAll('.cards-dots-row');
    rows.forEach((wrap) => {
      const existing = wrap.querySelectorAll('.cards-dot').length;
      if (existing !== count) {
        wrap.innerHTML = new Array(count).fill(0).map((_,i)=>`<span class="cards-dot${i===count-1?' active':''}"></span>`).join('');
      }
    });
    try { this.updateActiveCardSlide(); } catch {}
  }

  fitBackSpecsInSlide(slide) {
    const target = slide?.querySelector?.('.card-back-specs');
    if (!target) return;

    const existingMore = target.querySelector('.card-back-specs__more');
    if (existingMore && existingMore.parentElement) existingMore.parentElement.removeChild(existingMore);

    const items = Array.from(target.querySelectorAll('.card-back-specs__item'));
    if (!items.length) return;
    items.forEach((item) => item.classList.remove('is-hidden', 'is-last-single', 'is-wide'));

    const visibleLimit = 11; // 11 data chips + 1 blue +N chip = ровная сетка 6x2
    let hiddenCount = Math.max(0, items.length - visibleLimit);
    if (hiddenCount > 0) {
      for (let i = visibleLimit; i < items.length; i += 1) {
        items[i].classList.add('is-hidden');
      }
    }

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'card-back-specs__more';
    moreBtn.setAttribute('data-action', 'show-hidden-specs');
    moreBtn.textContent = `+${Math.max(1, hiddenCount)}`;
    moreBtn.setAttribute('data-hidden-count', String(Math.max(1, hiddenCount)));
    let morePopupOpened = false;
    const openMorePopup = (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
      } catch {}
      if (morePopupOpened) return;
      morePopupOpened = true;
      setTimeout(() => { morePopupOpened = false; }, 250);
      const payloadHiddenCount = Number(moreBtn.getAttribute('data-hidden-count')) || 1;
      this.showBackSpecsOverflowPopup({ slide, hiddenCount: payloadHiddenCount });
    };
    moreBtn.addEventListener('click', openMorePopup);
    moreBtn.addEventListener('pointerup', openMorePopup);
    moreBtn.addEventListener('touchend', openMorePopup, { passive: false });
    target.appendChild(moreBtn);
  }

  fitBackSpecsForAllSlides() {
    try {
      const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
      const slides = host
        ? host.querySelectorAll('.card-slide')
        : this.getRoot().querySelectorAll('.cards-slider .card-slide');
      slides.forEach((slide) => {
        try { this.fitBackSpecsInSlide(slide); } catch {}
      });
    } catch {}
  }

  closeBackSpecsOverflowPopup() {
    try {
      const popup = this.getRoot().querySelector('#vwBackSpecsOverflowOverlay');
      if (popup && popup.parentElement) popup.parentElement.removeChild(popup);
    } catch {}
  }

  showBackSpecsOverflowPopup({ slide = null, hiddenCount = 0 } = {}) {
    this.closeBackSpecsOverflowPopup();
    // Reuse checkpoint modal styles; ensure they are mounted even if checkpoint popup never appeared.
    this.ensureSliderCheckpointStyles();
    const locale = this.getCurrentLocale();
    const overlay = document.createElement('div');
    overlay.id = 'vwBackSpecsOverflowOverlay';
    overlay.className = 'vw-slider-checkpoint-overlay';
    const cardId = String(
      slide?.id ||
      slide?.querySelector('.cs')?.getAttribute('data-variant-id') ||
      ''
    ).trim() || null;
    overlay.innerHTML = `
      <div class="vw-slider-checkpoint-modal" role="dialog" aria-modal="true" aria-label="${locale.backSpecsOverflowTitle || 'Дополнительные детали'}">
        <div class="vw-slider-checkpoint-title">${locale.backSpecsOverflowTitle || 'Дополнительные детали'}</div>
        <div class="vw-slider-checkpoint-text">${locale.backSpecsOverflowText || 'К сожалению, не вся информация поместилась в данной карточке. Чтобы узнать дополнительные детали, вы можете связаться с менеджером.'}${hiddenCount > 0 ? ` (+${hiddenCount})` : ''}</div>
        <div class="vw-slider-checkpoint-actions">
          <button type="button" class="vw-slider-checkpoint-btn vw-slider-checkpoint-btn--primary" data-role="contact">${locale.backSpecsOverflowContact || locale.appHeaderContact || 'Связаться'}</button>
          <button type="button" class="vw-slider-checkpoint-btn" data-role="close">${locale.cancel || 'Отмена'}</button>
        </div>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    overlay.querySelector('[data-role="close"]')?.addEventListener('click', () => this.closeBackSpecsOverflowPopup());
    overlay.querySelector('[data-role="contact"]')?.addEventListener('click', () => {
      this.closeBackSpecsOverflowPopup();
      try { this.openContactManagerPopup({ source: 'tg_specs_overflow', propertyId: cardId, slide }); } catch {}
    });
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) this.closeBackSpecsOverflowPopup();
    });
  }

  scrollToSlideIndex(index = 0) {
    try {
      if (this._catalogDisplayMode === 'list') return;
      const slider = this.getRoot().querySelector('.cards-slider');
      if (!slider) return;
      const slides = Array.from(slider.querySelectorAll('.card-slide'));
      if (!slides.length) return;
      const safeIndex = Math.max(0, Math.min(slides.length - 1, index));
      const target = slides[safeIndex];
      if (!target) return;
      const centerOffset = Math.max(0, (slider.clientWidth - target.clientWidth) / 2);
      const rawLeft = target.offsetLeft - centerOffset;
      const maxLeft = Math.max(0, slider.scrollWidth - slider.clientWidth);
      const left = Math.max(0, Math.min(maxLeft, rawLeft));
      slider.scrollTo({ left, behavior: 'smooth' });
      requestAnimationFrame(() => { try { this.updateActiveCardSlide(); } catch {} });
    } catch {}
  }

  ensureSliderCheckpointStyles() {
    if (document.getElementById('vw-slider-checkpoint-styles')) return;
    const style = document.createElement('style');
    style.id = 'vw-slider-checkpoint-styles';
    style.textContent = `
      .vw-slider-checkpoint-overlay {
        position: fixed;
        inset: 0;
        z-index: 10070;
        background: rgba(0, 0, 0, 0.58);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .vw-slider-checkpoint-modal {
        width: min(420px, 100%);
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 86%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: var(--text-primary, #fff);
        padding: 16px;
        display: grid;
        gap: 12px;
        position: relative;
      }
      .vw-slider-checkpoint-title { font-size: 0.95rem; font-weight: 700; }
      .vw-slider-checkpoint-text { font-size: 0.82rem; color: var(--text-secondary, rgba(255,255,255,0.75)); line-height: 1.42; }
      .vw-slider-checkpoint-actions { display: flex; gap: 10px; }
      .vw-slider-checkpoint-btn {
        flex: 1;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 0.82rem;
        font-weight: 600;
      }
      .vw-slider-checkpoint-btn--primary {
        background: var(--color-accent, #4178CF);
        color: var(--text-on-accent, #fff);
        border-color: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  closeSliderCheckpointPopup() {
    try {
      const popup = this.getRoot().querySelector('#vwSliderCheckpointOverlay');
      if (popup && popup.parentElement) popup.parentElement.removeChild(popup);
    } catch {}
  }

  showSliderCheckpointPopup(level = 10) {
    this.closeSliderCheckpointPopup();
    this.ensureSliderCheckpointStyles();
    const locale = this.getCurrentLocale();
    const isSecond = Number(level) >= 20;
    const title = isSecond
      ? (locale.sliderCheckpointTitle20 || 'Точность совпадения снижается')
      : (locale.sliderCheckpointTitle10 || 'Вы просмотрели 10 лучших совпадений');
    const text = isSecond
      ? (locale.sliderCheckpointText20 || 'Дальше идут варианты с более низкой релевантностью. Уточнить запрос или связаться с экспертом?')
      : (locale.sliderCheckpointText10 || 'Дальше будут варианты с частичным соответствием. Хотите уточнить критерии или обсудить подбор с экспертом?');
    const overlay = document.createElement('div');
    overlay.id = 'vwSliderCheckpointOverlay';
    overlay.className = 'vw-slider-checkpoint-overlay';
    overlay.innerHTML = `
      <div class="vw-slider-checkpoint-modal" role="dialog" aria-modal="true" aria-label="Slider checkpoint">
        <div class="vw-slider-checkpoint-title">${title}</div>
        <div class="vw-slider-checkpoint-text">${text}</div>
        <div class="vw-slider-checkpoint-actions">
          <button type="button" class="vw-slider-checkpoint-btn" data-role="refine">${locale.sliderCheckpointRefine || 'Уточнить'}</button>
          <button type="button" class="vw-slider-checkpoint-btn vw-slider-checkpoint-btn--primary" data-role="contact">${locale.sliderCheckpointContact || 'Связаться'}</button>
        </div>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    overlay.querySelector('[data-role="refine"]')?.addEventListener('click', () => {
      this.closeSliderCheckpointPopup();
      try { this.$byId('textInput')?.focus(); } catch {}
    });
    overlay.querySelector('[data-role="contact"]')?.addEventListener('click', () => {
      this.closeSliderCheckpointPopup();
      try {
        const source = isSecond ? 'tg_slider_popup_20' : 'tg_slider_popup_10';
        this.openContactManagerPopup({ source });
      } catch {}
    });
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) this.closeSliderCheckpointPopup();
    });
  }

  maybeTriggerSliderCheckpoint(activeIdx = 0) {
    const viewed = Number(activeIdx) + 1;
    if (!Number.isFinite(viewed) || viewed <= 0) return;
    if (!this._sliderCheckpointShown || typeof this._sliderCheckpointShown !== 'object') {
      this._sliderCheckpointShown = { 10: false, 20: false };
    }
    if (viewed >= 20 && this._sliderCheckpointShown[20] !== true) {
      this._sliderCheckpointShown[20] = true;
      this.showSliderCheckpointPopup(20);
      return;
    }
    if (viewed >= 10 && this._sliderCheckpointShown[10] !== true) {
      this._sliderCheckpointShown[10] = true;
      this.showSliderCheckpointPopup(10);
    }
  }

  // ---------- RMv3 / Sprint 2 / Task 2.2: Post-handoff block (UI-only) ----------
  // ВАЖНО:
  // - не LLM-сообщение
  // - не отправляет API запросы
  // - клики по кнопкам не делают ничего, кроме стандартного :hover/:active
  renderPostHandoffBlock({ cardId } = {}) {
    try {
      const locale = this.getCurrentLocale();
      const thread = this.$byId('thread');
      const messages = this.$byId('messagesContainer');
      if (!thread || !messages) return;

      // Ensure single block (replace previous if any)
      try {
        const existing = this.getRoot().querySelector('.handoff-block');
        if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
      } catch {}

      const panel = document.createElement('div');
      panel.className = 'card-screen handoff-block';
      panel.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="card-actions-wrap">
            <div class="cs-sub handoff-message">${locale.handoffMessage}</div>
            <div class="card-actions-panel handoff-actions">
              <button class="card-btn select handoff-btn" type="button" data-handoff-action="details">${locale.handoffDetails}</button>
              <button class="card-btn next handoff-btn" type="button" data-handoff-action="cancel">${locale.cancel}</button>
            </div>
          </div>
        </div>`;
      thread.appendChild(panel);

      // keep scroll behavior consistent with other chat inserts
      requestAnimationFrame(() => {
        const H = messages.clientHeight;
        messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
      });
    } catch {}
  }

  // ---------- RMv3: In-dialog lead block (UI-only) ----------
  // ВАЖНО:
  // - новая сущность: in-dialog lead block
  // - только UI: нет submit handler, нет fetch, нет валидации/ошибок
  // - demo-only trigger: кликом по “Подробнее” в post-handoff блоке
  cancelHandoffFlowUI() {
    // UI-only: полная отмена handoff в чате
    // - убрать in-dialog lead block (если открыт)
    // - убрать handoff-блок целиком ("Вы выбрали объект…")
    try {
      // cleanup: in-dialog dial outside-click handler (if attached)
      if (this._inDialogLeadDialOutsideHandler) {
        try { document.removeEventListener('click', this._inDialogLeadDialOutsideHandler, true); } catch {}
        this._inDialogLeadDialOutsideHandler = null;
      }
      const lead = this.$byId('inDialogLeadBlock');
      if (lead && lead.parentElement) lead.parentElement.removeChild(lead);
    } catch {}
    try {
      const handoff = this.getRoot().querySelector('.handoff-block');
      if (handoff && handoff.parentElement) handoff.parentElement.removeChild(handoff);
    } catch {}
  }

  sendHandoffCancelToServer() {
    // Server-first: фиксируем cancel на сервере (cardId не тащим)
    try {
      const sessionId = this.sessionId || '';
      if (!sessionId) return;
      const interactionUrl = String(this.apiUrl || '').replace(/\/upload\/?$/i, '/interaction');
      fetch(interactionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'handoff_cancel', sessionId })
      }).catch(() => {});
    } catch {}
  }

  async submitLead(payload = {}) {
    const ensureSessionId = () => {
      const current = String(payload?.sessionId || this.sessionId || '').trim();
      if (current) return current;
      const generated = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      try {
        localStorage.setItem('vw_sessionId', generated);
        localStorage.setItem('voiceWidgetSessionId', generated);
      } catch {}
      this.sessionId = generated;
      return generated;
    };
    const finalPayload = {
      ...payload,
      sessionId: ensureSessionId()
    };
    const leadsApiUrl = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
    const response = await fetch(leadsApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload)
    });
    const result = await response.json().catch(() => ({ ok: false, error: 'Failed to parse server response' }));
    if (result?.ok !== true) {
      throw new Error(result?.error || 'Failed to submit lead');
    }
    return result;
  }

  getDebugInsightsSnapshot() {
    const empty = {
      name: null,
      operation: null,
      budget: null,
      budgetMax: null,
      type: null,
      location: null,
      rooms: null,
      area: null,
      areaMin: null,
      areaMax: null,
      floor: null,
      features: null,
      details: null,
      preferences: null
    };
    const fromUnderstanding = (typeof this.getUnderstanding === 'function')
      ? (this.getUnderstanding() || {})
      : (this.understanding?.export?.() || {});
    const fromSession = (this?.session && this.session.insights && typeof this.session.insights === 'object')
      ? this.session.insights
      : null;
    const source = fromUnderstanding || fromSession || {};
    return Object.keys(empty).reduce((acc, key) => {
      const raw = source?.[key];
      acc[key] = (raw === undefined || raw === null || String(raw).trim() === '') ? null : raw;
      return acc;
    }, { ...empty });
  }

  ensureDebugInsightsPopupStyles() {
    if (document.getElementById('vw-debug-insights-styles')) return;
    const style = document.createElement('style');
    style.id = 'vw-debug-insights-styles';
    style.textContent = `
      .vw-debug-insights-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.64);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 10060;
      }
      .vw-debug-insights-modal {
        width: min(420px, 100%);
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-card, #1e1d20);
        color: var(--text-primary, #fff);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        padding: 14px 16px 16px;
      }
      .vw-debug-insights-title {
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: 10px;
      }
      .vw-debug-insights-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 6px;
      }
      .vw-debug-insights-list li {
        color: var(--text-secondary, rgba(255,255,255,0.7));
        font-size: 0.84rem;
        line-height: 1.35;
      }
      .vw-debug-insights-list strong {
        color: var(--text-primary, #fff);
        font-weight: 600;
      }
      .vw-debug-insights-raw-title {
        margin-top: 10px;
        margin-bottom: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-primary, #fff);
      }
      .vw-debug-insights-raw {
        margin: 0;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--bg-element, rgba(255,255,255,0.12));
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        color: var(--text-secondary, rgba(255,255,255,0.7));
        font-size: 0.72rem;
        line-height: 1.35;
        max-height: 160px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .vw-debug-insights-close {
        width: 100%;
        margin-top: 14px;
        border: 0;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        background: var(--color-accent, #4178CF);
        color: var(--text-on-accent, #fff);
      }
    `;
    document.head.appendChild(style);
  }

  closeDebugInsightsPopup() {
    try {
      const popup = this.getRoot().querySelector('#vwDebugInsightsOverlay');
      if (popup && popup.parentElement) popup.parentElement.removeChild(popup);
    } catch {}
  }

  openDebugInsightsPopup() {
    this.closeDebugInsightsPopup();
    this.ensureDebugInsightsPopupStyles();
    const insights = this.getDebugInsightsSnapshot();
    const labels = {
      name: 'Name',
      operation: 'Operation',
      budget: 'Budget',
      budgetMax: 'Budget Max',
      type: 'Type',
      location: 'Location',
      rooms: 'Rooms',
      area: 'Area',
      areaMin: 'Area Min',
      areaMax: 'Area Max',
      floor: 'Floor',
      features: 'Features',
      details: 'Details',
      preferences: 'Preferences'
    };
    const pretty = (value) => {
      if (value === null || value === undefined || value === '') return 'null';
      if (typeof value === 'object') {
        try { return JSON.stringify(value); } catch { return '[object]'; }
      }
      return String(value);
    };
    const listHtml = Object.keys(labels)
      .map((key) => `<li><strong>${labels[key]}:</strong> ${pretty(insights[key])}</li>`)
      .join('');
    const rawSourceInsights = (() => {
      const src = (typeof this.getUnderstanding === 'function')
        ? (this.getUnderstanding() || {})
        : (this.understanding?.export?.() || {});
      try { return JSON.stringify(src || {}, null, 2); } catch { return String(src || '{}'); }
    })();
    const rawApiPayload = (() => {
      try {
        const payload = this._lastApiPayload || {};
        const meta = this._lastApiPayloadMeta || {};
        return JSON.stringify({ meta, payload }, null, 2);
      } catch { return '{}'; }
    })();
    const overlay = document.createElement('div');
    overlay.id = 'vwDebugInsightsOverlay';
    overlay.className = 'vw-debug-insights-overlay';
    overlay.innerHTML = `
      <div class="vw-debug-insights-modal" role="dialog" aria-modal="true" aria-label="Debug insights">
        <div class="vw-debug-insights-title">Debug Insights</div>
        <ul class="vw-debug-insights-list">${listHtml}</ul>
        <div class="vw-debug-insights-raw-title">Raw Source Insights JSON</div>
        <pre class="vw-debug-insights-raw">${rawSourceInsights}</pre>
        <div class="vw-debug-insights-raw-title">Raw API JSON</div>
        <pre class="vw-debug-insights-raw">${rawApiPayload}</pre>
        <button type="button" class="vw-debug-insights-close" data-role="close">OK</button>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    overlay.querySelector('[data-role="close"]')?.addEventListener('click', () => this.closeDebugInsightsPopup());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeDebugInsightsPopup();
    });
  }

  ensureContactManagerStyles() {
    if (document.getElementById('vw-contact-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'vw-contact-manager-styles';
    style.textContent = `
      .vw-contact-manager-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.64);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 10050;
      }
      .vw-contact-manager-modal {
        width: min(420px, 100%);
        border-radius: 14px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-card, #1e1d20);
        color: var(--text-primary, #fff);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }
      .vw-contact-manager-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 10px;
      }
      .vw-contact-manager-title {
        font-size: 0.95rem;
        font-weight: 600;
      }
      .vw-contact-manager-close {
        width: 32px;
        height: 32px;
        border: 0;
        background: transparent;
        color: var(--text-secondary, rgba(255,255,255,0.7));
        font-size: 20px;
        cursor: pointer;
      }
      .vw-contact-manager-body {
        padding: 0 16px 16px;
      }
      .vw-contact-manager-switch {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }
      .vw-contact-method-btn {
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-secondary, rgba(255,255,255,0.7));
        border-radius: 12px;
        padding: 10px 8px;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
      }
      .vw-contact-method-btn.is-active {
        color: var(--text-on-accent, #fff);
        background: var(--color-accent, #4178CF);
        border-color: transparent;
      }
      .vw-contact-input {
        width: 100%;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        border-radius: 12px;
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 12px 14px;
        font-size: 0.875rem;
        outline: none;
      }
      .vw-contact-input:focus {
        border-color: var(--color-accent, #4178CF);
      }
      .vw-contact-input-group {
        display: none;
      }
      .vw-contact-input-group.is-active {
        display: block;
      }
      .vw-contact-error {
        min-height: 18px;
        margin-top: 8px;
        font-size: 0.75rem;
        color: #ff7f7f;
      }
      .vw-contact-submit {
        width: 100%;
        margin-top: 8px;
        border: 0;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        background: var(--color-accent, #4178CF);
        color: var(--text-on-accent, #fff);
      }
    `;
    document.head.appendChild(style);
  }

  closeContactManagerPopup() {
    try {
      const popup = this.getRoot().querySelector('#vwContactManagerOverlay');
      if (popup && popup.parentElement) popup.parentElement.removeChild(popup);
    } catch {}
  }

  openContactManagerPopup(context = {}) {
    const { slide = null, source: triggerSource = null, propertyId: contextPropertyId = null } = context || {};
    this.closeContactManagerPopup();
    this.ensureContactManagerStyles();

    const locale = this.getCurrentLocale();
    const tgUser = window?.Telegram?.WebApp?.initDataUnsafe?.user || null;
    const username = tgUser?.username ? `@${String(tgUser.username).trim()}` : '';
    const displayName = String(tgUser?.first_name || tgUser?.username || 'Mini App User').trim();
    const propertyId =
      String(
        contextPropertyId ||
        slide?.id ||
        slide?.querySelector('.cs')?.getAttribute('data-variant-id') ||
        ''
      ).trim() || null;
    const normalizedSource = String(triggerSource || '').trim() || (propertyId ? 'tg_property_card' : 'tg_header_main');

    const overlay = document.createElement('div');
    overlay.id = 'vwContactManagerOverlay';
    overlay.className = 'vw-contact-manager-overlay';
    overlay.innerHTML = `
      <div class="vw-contact-manager-modal" role="dialog" aria-modal="true" aria-label="${locale.contactManagerAria || 'Contact selector'}">
        <div class="vw-contact-manager-head">
          <div class="vw-contact-manager-title">${locale.contactManagerTitle || 'Выберите контакт'}</div>
          <button type="button" class="vw-contact-manager-close" aria-label="Close">×</button>
        </div>
        <div class="vw-contact-manager-body">
          <div class="vw-contact-manager-switch">
            <button type="button" class="vw-contact-method-btn is-active" data-method="telegram">${locale.contactMethodTelegram || 'Telegram'}</button>
            <button type="button" class="vw-contact-method-btn" data-method="phone">${locale.contactMethodPhone || 'Phone'}</button>
            <button type="button" class="vw-contact-method-btn" data-method="email">${locale.contactMethodEmail || 'Email'}</button>
          </div>
          <div class="vw-contact-input-group is-active" data-input-method="telegram">
            <input type="text" class="vw-contact-input" data-role="telegram-input" value="${username.replace(/"/g, '&quot;')}" placeholder="@username">
          </div>
          <div class="vw-contact-input-group" data-input-method="phone">
            <input type="tel" class="vw-contact-input" data-role="phone-input" placeholder="+00 000 000 00 00" inputmode="tel">
          </div>
          <div class="vw-contact-input-group" data-input-method="email">
            <input type="email" class="vw-contact-input" data-role="email-input" placeholder="name@example.com" autocomplete="email">
          </div>
          <div class="vw-contact-error" data-role="error"></div>
          <button type="button" class="vw-contact-submit" data-role="submit-btn">${locale.send || 'Отправить'}</button>
        </div>
      </div>
    `;

    this.getRoot().appendChild(overlay);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const tgRe = /^@?[a-zA-Z0-9_]{5,}$/;
    const toDigits = (v) => String(v || '').replace(/\D+/g, '');
    const formatPhoneMask = (value) => {
      const raw = String(value || '');
      const digits = toDigits(raw).slice(0, 15);
      if (!digits) return '';
      const chunks = digits.match(/.{1,3}/g) || [];
      return `+${chunks.join(' ')}`;
    };

    const methodButtons = Array.from(overlay.querySelectorAll('.vw-contact-method-btn'));
    const inputGroups = Array.from(overlay.querySelectorAll('.vw-contact-input-group'));
    const telegramInput = overlay.querySelector('[data-role="telegram-input"]');
    const phoneInput = overlay.querySelector('[data-role="phone-input"]');
    const emailInput = overlay.querySelector('[data-role="email-input"]');
    const errorEl = overlay.querySelector('[data-role="error"]');
    const submitBtn = overlay.querySelector('[data-role="submit-btn"]');
    if (!username && telegramInput) {
      try { telegramInput.focus(); } catch {}
    }

    let selectedMethod = 'telegram';
    const setError = (message = '') => { if (errorEl) errorEl.textContent = String(message || ''); };
    const renderPopupThanks = () => {
      const modal = overlay.querySelector('.vw-contact-manager-modal');
      if (!modal) return;
      modal.innerHTML = `
        <div class="vw-contact-manager-head" style="justify-content: center; padding-bottom: 6px;">
          <div class="vw-contact-manager-title">${locale.thanksTitle || 'Спасибо!'}</div>
        </div>
        <div class="vw-contact-manager-body" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
          <div style="color: var(--text-secondary, rgba(255,255,255,0.7)); font-size: 0.875rem; line-height: 1.45; margin-bottom: 12px; max-width: 300px;">
            ${locale.thanksBody || 'Ваша заявка получена. Мы свяжемся с вами в ближайшее время.'}
          </div>
          <button type="button" class="vw-contact-submit" style="max-width: 220px;" data-role="thanks-close-btn">${locale.close || 'Закрыть'}</button>
        </div>
      `;
      modal.querySelector('[data-role="thanks-close-btn"]')?.addEventListener('click', () => this.closeContactManagerPopup());
    };
    const switchMethod = (method) => {
      selectedMethod = method;
      methodButtons.forEach((btn) => btn.classList.toggle('is-active', btn.getAttribute('data-method') === method));
      inputGroups.forEach((group) => group.classList.toggle('is-active', group.getAttribute('data-input-method') === method));
      setError('');
    };

    methodButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchMethod(btn.getAttribute('data-method') || 'telegram'));
    });

    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        const caretAtEnd = phoneInput.selectionStart === phoneInput.value.length;
        phoneInput.value = formatPhoneMask(phoneInput.value);
        if (caretAtEnd) {
          const len = phoneInput.value.length;
          phoneInput.setSelectionRange(len, len);
        }
      });
    }

    overlay.querySelector('.vw-contact-manager-close')?.addEventListener('click', () => this.closeContactManagerPopup());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeContactManagerPopup();
    });

    submitBtn?.addEventListener('click', async () => {
      setError('');
      let phoneCountryCode = null;
      let phoneNumber = null;
      let email = null;

      const telegramRaw = String(telegramInput?.value || '').trim();
      const telegramNormalized = telegramRaw && !telegramRaw.startsWith('@') ? `@${telegramRaw}` : telegramRaw;
      const telegramValid = tgRe.test(telegramNormalized);

      const phoneDigits = toDigits(phoneInput?.value || '');
      const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 15;
      if (phoneValid) {
        phoneNumber = phoneDigits;
      }

      const emailRaw = String(emailInput?.value || '').trim();
      const emailValid = emailRe.test(emailRaw);
      if (emailValid) {
        email = emailRaw;
      }

      const hasAnyValidContact = telegramValid || phoneValid || emailValid;
      if (!hasAnyValidContact) {
        if (selectedMethod === 'phone') {
          setError(locale.contactManagerPhoneMinDigits || 'Введите корректный номер (минимум 10 цифр)');
        } else if (selectedMethod === 'email') {
          setError(locale.invalidEmail || 'Invalid email');
        } else {
          setError(locale.contactManagerErrorTelegram || 'Введите Telegram username.');
        }
        return;
      }

      if (selectedMethod === 'phone' && phoneDigits.length > 0 && !phoneValid && !telegramValid && !emailValid) {
        setError(locale.contactManagerPhoneMinDigits || 'Введите корректный номер (минимум 10 цифр)');
        return;
      }

      const preferredContactMethod = phoneValid
        ? (selectedMethod === 'phone' ? 'phone' : (selectedMethod === 'email' && emailValid ? 'email' : (selectedMethod === 'telegram' && telegramValid ? 'telegram' : 'phone')))
        : (emailValid
          ? (selectedMethod === 'email' ? 'email' : (selectedMethod === 'telegram' && telegramValid ? 'telegram' : 'email'))
          : 'telegram');

      const emailFallback = !email && telegramValid
        ? `${telegramNormalized.replace(/^@/, '').toLowerCase()}@telegram.local`
        : null;

      const payload = {
        sessionId: this.sessionId || null,
        source: normalizedSource,
        name: displayName || 'Mini App User',
        phoneCountryCode,
        phoneNumber,
        email: email || emailFallback,
        preferredContactMethod,
        telegramUsername: telegramValid ? telegramNormalized : null,
        comment: telegramValid ? `telegram:${telegramNormalized}` : null,
        language: (this.currentLang || this.defaultLanguage || 'ua').toLowerCase(),
        propertyId: normalizedSource === 'tg_property_card' ? propertyId : null,
        consent: true
      };

      try {
        submitBtn.disabled = true;
        await this.submitLead(payload);
        renderPopupThanks();
      } catch (err) {
        setError(err?.message || 'Failed to submit request');
      } finally {
        if (submitBtn && submitBtn.isConnected) submitBtn.disabled = false;
      }
    });
  }

  renderInDialogLeadThanksBlock() {
    // UI-only: отдельная thanks-форма для in-dialog lead form (не ctx/request overlays)
    try {
      const locale = this.getCurrentLocale();
      const thread = this.$byId('thread');
      const messages = this.$byId('messagesContainer');
      if (!thread || !messages) return;
      // deterministic: single
      const existing = this.$byId('inDialogLeadThanksBlock');
      if (existing) return;
      const panel = document.createElement('div');
      panel.className = 'card-screen';
      panel.id = 'inDialogLeadThanksBlock';
      panel.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="card-actions-wrap">
            <div class="in-dialog-thanks__title">${locale.thanksTitle}</div>
            <div class="in-dialog-thanks__text">${locale.thanksBody}</div>
            <div class="in-dialog-thanks__actions">
              <button class="in-dialog-thanks__close" id="inDialogThanksCloseBtn" type="button">${locale.close}</button>
            </div>
          </div>
        </div>
      `;
      thread.appendChild(panel);
      requestAnimationFrame(() => {
        const H = messages.clientHeight;
        messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
      });
    } catch {}
  }

  submitInDialogLeadForm(formRoot) {
    // formRoot = .in-dialog-lead (from slide back or legacy block); if absent, use getElementById
    try {
      const locale = this.getCurrentLocale();
      const root = this.getRoot();
      const el = (baseId) => formRoot ? (formRoot.querySelector(`[id^="${baseId}"]`) || formRoot.querySelector(`#${baseId}`)) : this.$byIdFrom(root, baseId);
      const nameEl = el('inDialogLeadName') || (formRoot && formRoot.querySelector('input[type="text"]'));
      const phoneEl = el('inDialogLeadPhone') || (formRoot && formRoot.querySelector('input[type="tel"]'));
      const emailEl = el('inDialogLeadEmail') || (formRoot && formRoot.querySelector('input[type="email"]'));
      const consentEl = el('inDialogLeadGdpr') || (formRoot && formRoot.querySelector('.in-dialog-lead__checkbox'));
      const errs = formRoot ? formRoot.querySelectorAll('.in-dialog-lead__error') : [];
      const consentErr = el('inDialogLeadConsentError') || (errs[0] || null);
      const contactErr = el('inDialogLeadContactError') || (errs[1] || null);

      const markError = (el, on) => { if (!el) return; el.classList.toggle('error', !!on); };
      const showErr = (el, on, msg) => {
        if (!el) return;
        if (typeof msg === 'string' && msg.length) el.textContent = msg;
        el.classList.toggle('visible', !!on);
      };
      const shake = (el) => { if (!el) return; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); };

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const toDigits = (v) => String(v || '').replace(/\D+/g, '');
      const isEmail = (v) => emailRe.test(String(v || '').trim());
      // Phone format (demo): country code + 9–10 national digits (operator 3 digits + 6–7 digits).
      // No guessing: only format checks.
      const isPhone = (cc, v) => {
        const ccDigits = toDigits(cc);
        const phDigits = toDigits(v);
        if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 3) return false;
        if (!phDigits) return false;
        if (phDigits.length < 9 || phDigits.length > 10) return false;
        if (ccDigits.length + phDigits.length > 15) return false; // E.164 sanity
        return true;
      };

      const name = nameEl?.value?.trim() || ''; // name optional by spec
      const phone = phoneEl?.value?.trim() || '';
      const email = emailEl?.value?.trim() || '';
      const consent = !!consentEl?.checked;
      const codeEl = el('inDialogLeadCode') || (formRoot && formRoot.querySelector('input[type="hidden"]'));
      const phoneCountryCode = codeEl?.value?.trim() || '+971';

      // Reset previous errors
      markError(phoneEl, false);
      markError(emailEl, false);
      if (consentEl) consentEl.classList.remove('error');
      showErr(contactErr, false);
      showErr(consentErr, false);

      const phoneOk = isPhone(phoneCountryCode, phone);
      const emailOk = isEmail(email);
      const phoneHas = phone.length > 0;
      const emailHas = email.length > 0;
      const contactOk = phoneOk || emailOk;

      // Contact required: phone or email
      if (!phoneHas && !emailHas) {
        markError(phoneEl, true);
        markError(emailEl, true);
        shake(phoneEl); shake(emailEl);
        showErr(contactErr, true, locale.inDialogLeadContactError);
        if (!consent) {
          showErr(consentErr, true, locale.inDialogLeadConsentError);
          if (consentEl) consentEl.classList.add('error');
        }
        return;
      }

      if (!contactOk) {
        markError(phoneEl, phoneHas && !phoneOk);
        markError(emailEl, emailHas && !emailOk);
        const msg = phoneHas && !phoneOk
          ? locale.invalidPhone
          : locale.invalidEmail;
        showErr(contactErr, true, msg);
        if (!phoneOk && phoneHas) shake(phoneEl);
        if (!emailOk && emailHas) shake(emailEl);
        return;
      }

      if (!consent) {
        showErr(consentErr, true, locale.inDialogLeadConsentError);
        if (consentEl) consentEl.classList.add('error');
        shake(consentEl);
        return;
      }

      // Submit to backend (/api/leads), isolated from other forms
      const leadsApiUrl = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
      const language = (this.currentLang || this.defaultLanguage).toLowerCase();
      const payload = {
        sessionId: this.sessionId || null,
        source: 'widget_in_dialog',
        name: name,
        phoneCountryCode: phoneCountryCode,
        phoneNumber: phone || null,
        email: email || null,
        preferredContactMethod: 'phone',
        comment: null,
        language: language,
        propertyId: null,
        consent: true
      };

      fetch(leadsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(r => r.json().catch(() => ({ ok: false, error: locale.parseError })))
        .then((result) => {
          if (result?.ok === true) {
            const slide = formRoot?.closest('.card-slide');
            if (slide) slide.classList.remove('flipped');
            try { this.cancelHandoffFlowUI(); } catch {}
            try { this.renderInDialogLeadThanksBlock(); } catch {}
          } else {
            const msg = result?.error || locale.submitFailed;
            showErr(contactErr, true, msg);
          }
        })
        .catch(() => {
          showErr(contactErr, true, locale.networkError);
        });
    } catch {}
  }

  // HTML формы in-dialog lead (для слайдера back и legacy handoff)
  getInDialogLeadFormHTML(locale, idSuffix = '') {
    const s = idSuffix;
    return `
        <div class="in-dialog-lead" role="group" aria-label="In-dialog lead block">
          <div class="in-dialog-lead__body">
            <div class="in-dialog-lead__field">
              <label class="in-dialog-lead__label" for="inDialogLeadName${s}">${locale.inDialogLeadNameLabel}</label>
              <input class="in-dialog-lead__input" id="inDialogLeadName${s}" type="text" autocomplete="name" placeholder="${locale.namePlaceholder}">
            </div>
            <div class="in-dialog-lead__field">
              <label class="in-dialog-lead__label" for="inDialogLeadPhone${s}">${locale.inDialogLeadPhoneLabel}</label>
              <div class="in-dialog-lead__phone-row">
                <div class="dial-select">
                  <button class="dial-btn" type="button" id="inDialogLeadDialBtn${s}"><span class="dial-flag">🇦🇪</span><span class="dial-code">+971</span></button>
                  <div class="dial-list" id="inDialogLeadDialList${s}">
                    <div class="dial-item" data-cc="AE" data-code="+971"><span class="dial-flag">🇦🇪</span><span class="dial-code">+971 AE</span></div>
                    <div class="dial-item" data-cc="FR" data-code="+33"><span class="dial-flag">🇫🇷</span><span class="dial-code">+33 FR</span></div>
                    <div class="dial-item" data-cc="DE" data-code="+49"><span class="dial-flag">🇩🇪</span><span class="dial-code">+49 DE</span></div>
                    <div class="dial-item" data-cc="UA" data-code="+380"><span class="dial-flag">🇺🇦</span><span class="dial-code">+380 UA</span></div>
                    <div class="dial-item" data-cc="RU" data-code="+7"><span class="dial-flag">🇷🇺</span><span class="dial-code">+7 RU</span></div>
                    <div class="dial-item" data-cc="PL" data-code="+48"><span class="dial-flag">🇵🇱</span><span class="dial-code">+48 PL</span></div>
                    <div class="dial-item" data-cc="UK" data-code="+44"><span class="dial-flag">🇬🇧</span><span class="dial-code">+44 UK</span></div>
                  </div>
                </div>
                <input class="in-dialog-lead__input" id="inDialogLeadPhone${s}" type="tel" inputmode="tel" autocomplete="tel" placeholder="${locale.phonePlaceholder}">
                <input id="inDialogLeadCode${s}" type="hidden" value="+971" />
              </div>
            </div>
            <div class="in-dialog-lead__field">
              <label class="in-dialog-lead__label" for="inDialogLeadEmail${s}">${locale.inDialogLeadEmailLabel}</label>
              <input class="in-dialog-lead__input" id="inDialogLeadEmail${s}" type="email" autocomplete="email" placeholder="${locale.emailPlaceholder}">
            </div>
            <label class="in-dialog-lead__consent">
              <input class="in-dialog-lead__checkbox" id="inDialogLeadGdpr${s}" type="checkbox">
              <span class="in-dialog-lead__consent-text">
                ${locale.consentText}
                <a class="in-dialog-lead__privacy-link" href="#" aria-label="${locale.privacyPolicy}">${locale.privacyPolicy}</a>
              </span>
            </label>
            <div class="in-dialog-lead__error" id="inDialogLeadConsentError${s}">${locale.inDialogLeadConsentError}</div>
            <div class="in-dialog-lead__error" id="inDialogLeadContactError${s}">${locale.inDialogLeadContactError}</div>
            <div class="in-dialog-lead__actions">
              <button class="in-dialog-lead__send" id="inDialogLeadSendBtn${s}" type="button">${locale.send}</button>
            </div>
          </div>
        </div>`;
  }

  bindInDialogLeadForm(formRoot, idSuffix = '') {
    if (!formRoot) return;
    const s = idSuffix;
    const get = (baseId) => formRoot.querySelector(`#${baseId}${s}`) || formRoot.querySelector(`#${baseId}`);
    const dialBtn = get('inDialogLeadDialBtn');
    const dialList = get('inDialogLeadDialList');
    const codeInput = get('inDialogLeadCode');
    const phoneEl = get('inDialogLeadPhone');
    const emailEl = get('inDialogLeadEmail');
    const consentEl = get('inDialogLeadGdpr');
    const contactErr = get('inDialogLeadContactError');
    const consentErr = get('inDialogLeadConsentError');
    const toggleDial = (show) => { if (dialList) dialList.style.display = show ? 'block' : 'none'; };
    dialBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const visible = dialList && dialList.style.display === 'block';
      toggleDial(!visible);
    });
    dialList?.querySelectorAll('.dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code') || '+971';
        const flag = item.querySelector('.dial-flag')?.textContent || '🇦🇪';
        if (dialBtn) {
          const codeEl = dialBtn.querySelector('.dial-code');
          const flagEl = dialBtn.querySelector('.dial-flag');
          if (codeEl) codeEl.textContent = code;
          if (flagEl) flagEl.textContent = flag;
        }
        if (codeInput) codeInput.value = code;
        toggleDial(false);
      });
    });
    const clearContactErr = () => {
      try { if (contactErr) contactErr.classList.remove('visible'); } catch {}
      try { if (phoneEl) phoneEl.classList.remove('error'); } catch {}
      try { if (emailEl) emailEl.classList.remove('error'); } catch {}
    };
    const clearConsentErr = () => {
      try { if (consentErr) consentErr.classList.remove('visible'); } catch {}
      try { if (consentEl) consentEl.classList.remove('error'); } catch {}
    };
    phoneEl?.addEventListener('input', () => { clearContactErr(); });
    emailEl?.addEventListener('input', () => { clearContactErr(); });
    consentEl?.addEventListener('change', () => { clearConsentErr(); });
  }

  renderInDialogLeadBlock() {
    // Legacy: форма после handoff-блока — больше не используется (flow: слайдер → Выбрать → back с формой)
    try {
      const locale = this.getCurrentLocale();
      const thread = this.$byId('thread');
      const messages = this.$byId('messagesContainer');
      if (!thread || !messages) return;
      const existing = this.$byId('inDialogLeadBlock');
      if (existing) return;
      const panel = document.createElement('div');
      panel.className = 'in-dialog-lead-block';
      panel.id = 'inDialogLeadBlock';
      panel.innerHTML = this.getInDialogLeadFormHTML(locale, '');
      const handoffBlock = this.getRoot().querySelector('.handoff-block');
      if (handoffBlock?.parentElement) handoffBlock.insertAdjacentElement('afterend', panel);
      else return;
      this.bindInDialogLeadForm(panel.querySelector('.in-dialog-lead'), '');
      requestAnimationFrame(() => {
        const H = messages.clientHeight;
        messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
      });
    } catch {}
  }

  // ---------- НОРМАЛИЗАЦИЯ ДАННЫХ КАРТОЧКИ ----------
  normalizeCardData(raw = {}) {
    const toInt = (v) => {
      if (v == null) return null;
      const n = String(v).replace(/[^0-9]/g, '');
      return n ? parseInt(n, 10) : null;
    };
    const formatNumberUS = (v) => {
      const n = toInt(v);
      return n != null ? n.toLocaleString('en-US') : null;
    };
    const parseObject = (v) => {
      if (!v) return null;
      if (typeof v === 'object' && !Array.isArray(v)) return v;
      if (typeof v !== 'string') return null;
      try {
        const parsed = JSON.parse(v);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };
    const truthyLabel = (v) => {
      if (v === true || v === 'true' || v === 1 || v === '1') return 'yes';
      if (v === false || v === 'false' || v === 0 || v === '0') return 'no';
      return null;
    };
    const pushExtra = (arr, icon, label, value) => {
      if (value == null) return;
      const text = String(value).trim();
      if (!text) return;
      arr.push({ icon, text: `${label}: ${text}` });
    };
    const priceNum = toInt(raw.price ?? raw.priceEUR ?? raw.price_amount ?? raw.priceAmount);
    const roomsNum = toInt(raw.rooms);
    const floorNum = toInt(raw.floor);
    const areaNum = toInt(raw.area_m2);
    const pricePerM2Num = toInt(raw.price_per_m2);
    const bathroomsNum = toInt(raw.bathrooms);
    const city = raw.city || raw.location || '';
    const district = raw.district || raw.area || '';
    const neighborhood = raw.neighborhood || raw.neiborhood || raw.neiborhood || '';
    const propertyType = raw.property_type || raw.propertyType || raw.type || '';
    const rawFeatures = parseObject(raw.features) || {};
    const furnishedRaw = raw.furnished;
    const furnishedBool = furnishedRaw === true || furnishedRaw === 'true' || furnishedRaw === 1 || furnishedRaw === '1';
    const furnishedKnown = furnishedRaw !== null && furnishedRaw !== undefined && furnishedRaw !== '';
    const imageFromArray = Array.isArray(raw.images)
      ? raw.images.find((src) => typeof src === 'string' && src.trim())
      : null;
    const image = raw.image || raw.imageUrl || imageFromArray || '';
    const readList = (src) => {
      if (Array.isArray(src)) return src;
      if (typeof src === 'string') {
        const trimmed = src.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [];
          } catch {}
        }
        return trimmed.split(',').map(v => v.trim()).filter(Boolean);
      }
      return [];
    };
    const assetPool = [
      ...readList(raw.images),
      ...readList(raw.assets),
      ...readList(raw.gallery),
      ...readList(raw.photos)
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);
    if (image && !assetPool.includes(image)) assetPool.unshift(image);
    const assetImages = assetPool.slice(0, 4);

    const priceLabel = priceNum != null ? `${priceNum.toLocaleString('en-US')} UAH` : (raw.price || raw.priceLabel || '');
    const roomsLabel = roomsNum != null ? `${roomsNum} rooms` : (raw.rooms || '');
    const floorLabel = floorNum != null ? `${floorNum} floor` : (raw.floor || '');
    const pricePerM2Label = formatNumberUS(pricePerM2Num != null ? pricePerM2Num : raw.price_per_m2);
    const parsedScore = Number(raw.score ?? raw._score);
    const parsedStrictScore = Number(raw.strictScore ?? raw._strictScore);
    const normalizedTier = String(raw.matchTier ?? raw._tier ?? '').trim().toLowerCase();
    const matchTier = ['high', 'mid', 'low'].includes(normalizedTier) ? normalizedTier : 'low';

    const dynamicBackFeatureItems = [];
    pushExtra(dynamicBackFeatureItems, '🏠', 'Тип', propertyType || rawFeatures.type || rawFeatures.propertyType || rawFeatures.buildingType);
    pushExtra(dynamicBackFeatureItems, '🧱', 'Стіни', rawFeatures.wallMaterial || rawFeatures.materialWalls);
    pushExtra(dynamicBackFeatureItems, '🛗', 'Ліфт', rawFeatures.elevator ?? truthyLabel(rawFeatures.elevator));
    pushExtra(dynamicBackFeatureItems, '🌤️', 'Балкон', rawFeatures.balconyType || rawFeatures.balcony || truthyLabel(rawFeatures.balcony));
    pushExtra(dynamicBackFeatureItems, '🛠️', 'Стан', rawFeatures.condition || rawFeatures.objectCondition || rawFeatures.renovation || rawFeatures.finish);
    pushExtra(dynamicBackFeatureItems, '🚗', 'Паркінг', rawFeatures.parking || rawFeatures.parkingSpaces);
    pushExtra(dynamicBackFeatureItems, '🌿', 'Тераса', rawFeatures.terrace ?? truthyLabel(rawFeatures.terrace));
    pushExtra(dynamicBackFeatureItems, '🪑', 'Меблі', rawFeatures.furnished ?? truthyLabel(rawFeatures.furnished));
    pushExtra(dynamicBackFeatureItems, '🏗️', 'Поверхів', rawFeatures.buildingFloors);
    pushExtra(dynamicBackFeatureItems, '🏛️', 'Рік', rawFeatures.buildingYear);
    if (Array.isArray(rawFeatures.buildingInfrastructure) && rawFeatures.buildingInfrastructure.length) {
      pushExtra(dynamicBackFeatureItems, '📌', 'Інфраструктура', rawFeatures.buildingInfrastructure.join(', '));
    }

    return {
      id: raw.id || raw.external_id || raw.externalId || raw.propertyId || raw.uid || '',
      image,
      assetImages,
      city,
      district,
      neighborhood,
      description: raw.description || '',
      rooms: roomsNum != null ? String(roomsNum) : (raw.rooms || ''),
      roomsLabel,
      floor: floorNum != null ? String(floorNum) : (raw.floor || ''),
      floorLabel,
      area_m2: areaNum != null ? areaNum : (raw.area_m2 ?? null),
      price_per_m2: pricePerM2Num != null ? pricePerM2Num : (raw.price_per_m2 ?? null),
      pricePerM2Label,
      bathrooms: bathroomsNum != null ? String(bathroomsNum) : (raw.bathrooms ?? null),
      propertyType,
      furnished: furnishedKnown ? furnishedBool : null,
      furnishedLabel: furnishedKnown ? (furnishedBool ? 'Furnished' : 'Unfurnished') : '',
      priceEUR: priceNum != null ? priceNum : null,
      priceLabel,
      features: rawFeatures,
      backFeatureItems: dynamicBackFeatureItems,
      score: Number.isFinite(parsedScore) ? parsedScore : 0,
      strictScore: Number.isFinite(parsedStrictScore) ? parsedStrictScore : 0,
      matchTier
    };
  }

  getCardAssetFallbackDataUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="48" fill="#e9e9e9"/><rect x="24" width="24" height="48" fill="#f5f5f5"/></pattern></defs><rect width="1200" height="900" fill="url(#p)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="72" font-weight="700">IMG NOT FOUND</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // ---------- УТИЛИТЫ ----------
  getLangCode() {
    const code = String(this.currentLang || this.defaultLanguage || 'UA').trim().toLowerCase().slice(0, 2);
    return ['ua', 'ru'].includes(code) ? code : 'ua';
  }

 
  getCurrentState() {
    return {
      ui: this.ui.getCurrentState(),
      recording: this.audioRecorder.isRecording,
      messages: this.messages.length,
      understanding: this.understanding.export()
    };
  }
  isCurrentlyRecording() { return this.ui.isRecording() && this.audioRecorder.isRecording; }
  isIdle() { return this.ui.isIdle() && !this.audioRecorder.isRecording; }

  // очистка сессии (совместимость со старыми вызовами)
  clearSession() {
    try {
      localStorage.removeItem('vw_sessionId');
      localStorage.removeItem('voiceWidgetSessionId');
    } catch {}
    this.sessionId = null;

    this.understanding.reset();
    this.ui.clearMessages();
    this.ui.setState('idle');

    if (this.audioRecorder.isRecording) {
      this.audioRecorder.cancelRecording();
    }

    this.showChatScreen();
    this.showGreetingMessage();

    console.log('🗑️ Сессия очищена, sessionId сброшен (ожидаем новый от сервера)');
  }

  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      uiState: this.ui.getCurrentState(),
      isRecording: this.audioRecorder.isRecording,
      messagesCount: this.messages.length,
      understanding: this.understanding.export(),
      dialogStarted: this.dialogStarted
    };
  }

  onStateChange(cb) {
    this.events.on('uiStateChanged', cb);
    this.events.on('understandingUpdated', cb);
    this.events.on('messageReceived', cb);
  }

  disconnectedCallback() {
    // Clean up recording timers
    this.stopRecordingTimer('chat');
    
    this.audioRecorder?.cleanupRecording?.();
    this.ui?.clearRecordingState?.();
    this.events?.clear?.();
    try { this.closeFiltersOverlay(); } catch {}
    try { document.removeEventListener('keydown', this._onGlobalKeydown, true); } catch {}
    try { this._disableOutsideClose?.(); } catch {}
    // Safety: if an older build locked the page and didn't restore, try to restore only if we know we locked it.
    try {
      if (this._scrollLockedMobile) {
        const de = document.documentElement;
        const b = document.body;
        de.style.overflow = this._prevPageOverflowDoc || '';
        b.style.overflow = this._prevPageOverflowBody || '';
        b.style.touchAction = this._prevPageTouchAction || '';
        this._scrollLockedMobile = false;
      }
    } catch {}
    console.log('👋 Voice Widget disconnected and cleaned up');
  }

  // ===== v2 Menu Overlay integration (UI only) =====
  setupMenuOverlay() {
    // Привязываем overlay к header активного экрана
    const container = this.getRoot().querySelector(
      '.dialog-screen:not(.hidden) .screen-header'
    );
    let overlay = this.getRoot().querySelector('.menu-overlay');
    if (!container) {
      // Нет подходящего header — удаляем overlay, чтобы не мешал низу виджета
      if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'menu-overlay';
      const content = document.createElement('div');
      content.className = 'menu-overlay-content';
      overlay.appendChild(content);
      container.appendChild(overlay);
    } else if (overlay.parentElement !== container) {
      container.appendChild(overlay);
    }
    this.updateMenuUI();
    // Открытие/закрытие overlay через левую кнопку (stats) активного header.
      const statsBtn = container.querySelector('.header-action.header-left');
    if (statsBtn) {
      statsBtn.onclick = () => {
        if (this._menuState === 'closed' || !this._menuState) this._menuState = 'open';
        else if (this._menuState === 'open') this._menuState = 'closed';
        this.updateMenuUI();
      };
    }
  }

  updateMenuUI() {
    const overlay = this.getRoot().querySelector('.menu-overlay');
    if (!overlay) return;
    if (this._menuState === 'closed' || !this._menuState) overlay.classList.remove('open'); else overlay.classList.add('open');

    // Toggle side header actions and logo on active screen
    try {
      const activeHeader = this.getRoot().querySelector(
        '.dialog-screen:not(.hidden) .screen-header'
      );
      if (activeHeader) activeHeader.classList.toggle('menu-opened', !!(this._menuState && this._menuState !== 'closed'));
    } catch {}

    let content = overlay.querySelector('.menu-overlay-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'menu-overlay-content';
      overlay.appendChild(content);
    }

    if (this._menuState === 'open') {
      content.innerHTML = `
        <div class="menu-grid">
          <div class="menu-col"></div>
          <div class="menu-col menu-col--middle" style="width:80px; align-items:center; justify-content:center;">
            <button class="menu-close-btn" aria-label="Close menu"><img src="${ASSETS_BASE}menu_close_btn.svg" alt="Close"></button>
          </div>
          <div class="menu-col">
            <button class="menu-btn menu-btn--reset menu-btn--placeholder" type="button" disabled><img class="menu-btn__icon" src="${ASSETS_BASE}menu_dark_theme.svg" alt="">Soon</button>
          </div>
        </div>`;
      const closeBtn = content.querySelector('.menu-close-btn');
      if (closeBtn) closeBtn.onclick = () => { try { this.resetLegacyMenuState(); } catch {} this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
    } else {
      content.innerHTML = '';
    }
  }

  // совместимость
  cleanupAfterSend() { this.audioRecorder.cleanupAfterSend(); }
  updateUnderstanding(i) { this.understanding.update(i); }
  getUnderstanding() { return this.understanding.export(); }
  resetUnderstanding() { this.understanding.reset(); }
  setApiUrl(url) { this.apiUrl = url; if (this.api) this.api.apiUrl = url; try { localStorage.setItem('vw_api_url', url); } catch {} }
  getMessages() { return [...this.messages]; }
  getCurrentSessionId() { return this.sessionId; }
  setUnderstanding(insights) { this.understanding.update(insights); }
}

if (!customElements.get('voice-widget')) {
  customElements.define('voice-widget', VoiceWidget);
}

const autoMount = () => {
  let target = document.getElementById('root') || document.body;
  if (!target) return;

  const backendUrl = (() => {
    try {
      const fromWindow = typeof window !== 'undefined' ? window.__VW_API_URL__ : '';
      const normalized = String(fromWindow || '').trim();
      if (normalized) return normalized;
    } catch {}
    return '/api/audio/upload';
  })();
  let el = target.querySelector('voice-widget');
  if (!el) {
    el = document.createElement('voice-widget');
    target.appendChild(el);
  }
  // Configure only after the element is connected.
  try {
    if (typeof el.init === 'function') {
      el.init({
        apiUrl: backendUrl,
        fieldName: 'audio',
        responseField: 'response'
      });
    } else {
      el.apiUrl = backendUrl;
      el.fieldName = 'audio';
      el.responseField = 'response';
    }
  } catch {}

  const tg = window.Telegram?.WebApp;
  if (tg) {
    try { tg.ready(); } catch {}
    try { tg.expand(); } catch {}
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMount, { once: true });
} else {
  autoMount();
}
