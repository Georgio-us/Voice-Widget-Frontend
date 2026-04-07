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
      residentialComplex: null,
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
      residentialComplex: pick('residentialComplex'),
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
  isGuestCommand(text) {
    return String(text || '').trim().toLowerCase() === '//guest';
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
  tryHandleGuestCommand(text) {
    if (!this.isGuestCommand(text)) return false;
    const { textInput } = this.elements;
    if (textInput) textInput.value = '';
    this.widget.accessRole = 'user';
    this.widget.accessFlags = { isAdmin: false, isOwner: false, isSuperAdmin: false };
    try { this.widget.updateAccessHeaderButton?.(); } catch {}
    this.widget.updateSendButtonState('chat');
    this.widget.openAccessOverlay?.();
    this.widget.ui?.showNotification?.('Guest access enabled (dev)');
    return true;
  }
  handleSendText() {
    const { textInput } = this.elements;
    const text = textInput?.value?.trim();
    if (!text) return;
    if (this.tryHandleResetCommand(text)) return;
    if (this.tryHandleAdminCommand(text)) return;
    if (this.tryHandleGuestCommand(text)) return;
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

    const allowed = [
      'city', 'district', 'rooms', 'type', 'operation',
      'minPrice', 'maxPrice',
      'minArea', 'maxArea',
      'minFloor', 'maxFloor',
      'smart', 'arcadia', 'rcOnly', 'residentialComplex',
      'exclusive', 'center', 'parking', 'balconyLoggia',
      'limit'
    ];
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

  async updateManualProperty(externalId, payload = {}, imageFiles = []) {
    const safeId = String(externalId || '').trim();
    if (!safeId) throw new Error('EXTERNAL_ID_REQUIRED');
    const base = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, `/api/admin/properties/${encodeURIComponent(safeId)}`);
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
    const res = await fetch(base, { method: 'PUT', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `ADMIN_UPDATE_FAILED_${res.status}`));
    }
    return data;
  }

  async deleteManualProperty(externalId, options = {}) {
    const safeId = String(externalId || '').trim();
    if (!safeId) throw new Error('EXTERNAL_ID_REQUIRED');
    const url = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/admin/properties/delete');
    const tgIdentity = this.getTelegramUserIdentity();
    const payload = {
      externalId: safeId
    };
    if (tgIdentity?.id) payload.tgUserId = tgIdentity.id;
    if (!tgIdentity?.id && this.widget?.accessFlags?.isAdmin) payload.devAdmin = '1';
    if (options.clientId) payload.clientId = String(options.clientId);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `ADMIN_DELETE_FAILED_${res.status}`));
    }
    return data;
  }

  async fetchManualPropertyById(externalId) {
    const safeId = String(externalId || '').trim();
    if (!safeId) throw new Error('EXTERNAL_ID_REQUIRED');
    const base = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, `/api/admin/properties/${encodeURIComponent(safeId)}`);
    const url = new URL(base, window.location.origin);
    const tgIdentity = this.getTelegramUserIdentity();
    if (tgIdentity?.id) url.searchParams.set('tgUserId', String(tgIdentity.id));
    if (!tgIdentity?.id && this.widget?.accessFlags?.isAdmin) url.searchParams.set('devAdmin', '1');
    const res = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `ADMIN_GET_FAILED_${res.status}`));
    }
    return data;
  }

  _deriveAdminApiBase() {
    try {
      const u = new URL(String(this.apiUrl));
      u.pathname = u.pathname.replace(/\/api\/audio\/upload\/?$/i, '/api/admin');
      return u.toString().replace(/\/$/, '');
    } catch {
      return String(this.apiUrl)
        .replace(/\/api\/audio\/upload\/?$/i, '/api/admin')
        .replace(/\/$/, '');
    }
  }

  _appendAdminAuthToUrl(url) {
    const u = url instanceof URL ? url : new URL(String(url), window.location.origin);
    const tgIdentity = this.getTelegramUserIdentity();
    if (tgIdentity?.id) u.searchParams.set('tgUserId', String(tgIdentity.id));
    if (!tgIdentity?.id && this.widget?.accessFlags?.isAdmin) u.searchParams.set('devAdmin', '1');
    return u;
  }

  async fetchResidentialComplexes(params = {}) {
    const base = this._deriveAdminApiBase();
    const u = new URL(`${base}/residential-complexes`);
    const q = String(params.q || '').trim();
    if (q) u.searchParams.set('q', q);
    if (params.limit != null) u.searchParams.set('limit', String(params.limit));
    this._appendAdminAuthToUrl(u);
    const res = await fetch(u.toString());
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `RC_LIST_${res.status}`));
    }
    return Array.isArray(data.items) ? data.items : [];
  }

  async createResidentialComplex(name) {
    const base = this._deriveAdminApiBase();
    const u = this._appendAdminAuthToUrl(new URL(`${base}/residential-complexes`));
    const tgIdentity = this.getTelegramUserIdentity();
    const payload = { name: String(name || '').trim() };
    if (tgIdentity?.id) payload.tgUserId = tgIdentity.id;
    if (!tgIdentity?.id && this.widget?.accessFlags?.isAdmin) payload.devAdmin = '1';
    const res = await fetch(u.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `RC_CREATE_${res.status}`));
    }
    return data;
  }

  async deleteResidentialComplex(id) {
    const safeId = String(id ?? '').trim();
    if (!safeId) throw new Error('RC_ID_REQUIRED');
    const base = this._deriveAdminApiBase();
    const u = this._appendAdminAuthToUrl(
      new URL(`${base}/residential-complexes/${encodeURIComponent(safeId)}`)
    );
    const res = await fetch(u.toString(), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `RC_DELETE_${res.status}`));
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
const VW_DEEP_LINK_SELECTION_PREFIX = 'sel_';
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
    accessAdminShowLiked: 'Лайкнутые',
    accessAdminShowAll: 'Все',
    accessAdminSort: 'Сортировка',
    accessAdminSortPriceAsc: 'Цена ↑',
    accessAdminSortPriceDesc: 'Цена ↓',
    accessAdminSortAreaAsc: 'Площадь ↑',
    accessAdminSortAreaDesc: 'Площадь ↓',
    accessAdminSortDealAll: 'Сделка: все',
    accessAdminSortDealSale: 'Сделка: продажа',
    accessAdminSortDealRent: 'Сделка: аренда',
    accessAdminSortReset: 'Сброс',
    accessAdminSortApply: 'Применить',
    accessAdminSubscription: 'Управление подпиской',
    accessAdminOlxConnect: 'Подключить OLX',
    accessAdminOlxConnectOpening: 'Открываю OLX...',
    accessAdminOlxConnected: 'OLX подключен (переподключить)',
    accessAdminOlxChecking: 'Проверяю OLX...',
    accessAdminOlxError: 'Не удалось проверить статус OLX',
    accessAdminOlxSuccessToast: 'OLX успешно подключен',
    accessAdminOlxFailedToast: 'Не удалось подключить OLX',
    accessAdminOlxSync: 'Импортировать объекты OLX',
    accessAdminOlxSyncing: 'Импорт из OLX...',
    accessAdminOlxSyncDone: 'OLX импорт: {count} объектов',
    accessAdminOlxSyncFailed: 'Не удалось импортировать объекты OLX',
    accessAdminOlxSyncLocked: 'Сначала подключите OLX',
    accessUserEmpty: 'Здесь появятся объекты, которые вы добавите в избранное (Wishlist)',
    accessUserWishlist: 'Моя подборка',
    accessUserConsult: 'Консультация',
    accessUserRemove: 'Убрать',
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
    cardReadDescription: 'Читать описание',
    cardDescriptionTitle: 'Описание объекта',
    cardDescriptionOk: 'OK',
    cardDescriptionEmpty: 'Описание пока недоступно',
    cardTitleFullAria: 'Показать полный заголовок',
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
    strictEndTitle: 'Точные объекты закончились',
    strictEndText: 'По вашему запросу вы просмотрели все точные совпадения. Хотите уточнить фильтры или показать похожие объекты?',
    strictEndRefine: 'Уточнить',
    strictEndSimilar: 'Показать похожие',
    strictEndNoSimilar: 'Похожие объекты пока не найдены',
    similarEndTitle: 'Похожие объекты закончились',
    similarEndText: 'Мы показали все похожие объекты по вашему запросу. Вы можете продолжить самостоятельный поиск или связаться для консультации.',
    similarEndContinue: 'Продолжить поиск',
    similarEndContact: 'Связаться',
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
    accessAdminShowLiked: 'Лайкнуті',
    accessAdminShowAll: 'Усі',
    accessAdminSort: 'Сортування',
    accessAdminSortPriceAsc: 'Ціна ↑',
    accessAdminSortPriceDesc: 'Ціна ↓',
    accessAdminSortAreaAsc: 'Площа ↑',
    accessAdminSortAreaDesc: 'Площа ↓',
    accessAdminSortDealAll: 'Угода: усі',
    accessAdminSortDealSale: 'Угода: продаж',
    accessAdminSortDealRent: 'Угода: оренда',
    accessAdminSortReset: 'Скинути',
    accessAdminSortApply: 'Застосувати',
    accessAdminSubscription: 'Керування підпискою',
    accessAdminOlxConnect: 'Підключити OLX',
    accessAdminOlxConnectOpening: 'Відкриваю OLX...',
    accessAdminOlxConnected: 'OLX підключено (перепідключити)',
    accessAdminOlxChecking: 'Перевіряю OLX...',
    accessAdminOlxError: 'Не вдалося перевірити статус OLX',
    accessAdminOlxSuccessToast: 'OLX успішно підключено',
    accessAdminOlxFailedToast: 'Не вдалося підключити OLX',
    accessAdminOlxSync: 'Імпортувати обʼєкти OLX',
    accessAdminOlxSyncing: 'Імпорт з OLX...',
    accessAdminOlxSyncDone: 'OLX імпорт: {count} обʼєктів',
    accessAdminOlxSyncFailed: 'Не вдалося імпортувати обʼєкти OLX',
    accessAdminOlxSyncLocked: 'Спочатку підключіть OLX',
    accessUserEmpty: "Тут з'являться об'єкти, які ви додасте до обраного (Wishlist)",
    accessUserWishlist: 'Моя добірка',
    accessUserConsult: 'Консультація',
    accessUserRemove: 'Прибрати',
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
    cardReadDescription: 'Читати опис',
    cardDescriptionTitle: "Опис об'єкта",
    cardDescriptionOk: 'OK',
    cardDescriptionEmpty: 'Опис поки недоступний',
    cardTitleFullAria: 'Показати повний заголовок',
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
    strictEndTitle: 'Точні об’єкти закінчилися',
    strictEndText: 'За вашим запитом ви переглянули всі точні збіги. Хочете уточнити фільтри чи показати схожі об’єкти?',
    strictEndRefine: 'Уточнити',
    strictEndSimilar: 'Показати схожі',
    strictEndNoSimilar: 'Схожих об’єктів поки не знайдено',
    similarEndTitle: 'Схожі об’єкти закінчилися',
    similarEndText: 'Ми показали всі схожі об’єкти за вашим запитом. Ви можете продовжити самостійний пошук або зв’язатися для консультації.',
    similarEndContinue: 'Продовжити пошук',
    similarEndContact: "Зв'язатися",
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
    this._deepLinkSelectionIds = this.getDeepLinkSelectionIdsFromUrl();
    this._activeDeepLinkPropId = null;
    this._isDeepLinkMode = false;
    this._deepLinkModeType = null;
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
    this._catalogManualFilterOverrides = null;
    this._catalogIgnoreAssistantBaseFilters = false;
    this._catalogStrictFlowActive = false;
    this._catalogStrictQuery = null;
    this._catalogLastRefineMode = 'filters';
    this._catalogStrictSeedIds = [];
    this._catalogRelaxedUnlocked = false;
    this._catalogRelaxLevel = 0;
    this._catalogRelaxPool = null;
    this._catalogRelaxShownIds = new Set();
    this._catalogStrictEndPromptShown = false;
    this._catalogSimilarEndPromptShown = false;
    this._catalogSimilarLoading = false;
    this.accessRole = 'user';
    this.accessFlags = { isAdmin: false, isOwner: false, isSuperAdmin: false };
    this._accessOverlayOpen = false;
    this._filtersOverlayOpen = false;
    this._wishlistIds = this.loadWishlistIds();

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
    if (value.toLowerCase().startsWith(VW_DEEP_LINK_SELECTION_PREFIX)) return '';
    const tokenMatch = value.match(/prop_([a-z0-9_-]+)/i);
    if (tokenMatch?.[1]) return String(tokenMatch[1]).trim().toUpperCase();
    const withoutPrefix = value.toLowerCase().startsWith(VW_DEEP_LINK_PREFIX)
      ? value.slice(VW_DEEP_LINK_PREFIX.length)
      : value;
    const idMatch = String(withoutPrefix || '').trim().match(/^([a-z0-9_-]+)$/i);
    return idMatch?.[1] ? idMatch[1].toUpperCase() : '';
  }

  normalizeDeepLinkSelectionToken(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    const value = raw.replace(/\+/g, ' ').trim();
    const tokenMatch = value.match(/sel_([a-z0-9_-]+)/i);
    if (tokenMatch?.[1]) return String(tokenMatch[1]).trim();
    const withoutPrefix = value.toLowerCase().startsWith(VW_DEEP_LINK_SELECTION_PREFIX)
      ? value.slice(VW_DEEP_LINK_SELECTION_PREFIX.length)
      : value;
    const keyMatch = String(withoutPrefix || '').trim().match(/^([a-z0-9_-]+)$/i);
    return keyMatch?.[1] ? keyMatch[1] : '';
  }

  encodeDeepLinkSelectionIds(ids = []) {
    const normalized = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((id) => this.normalizeDeepLinkPropId(id))
          .filter(Boolean)
      )
    );
    if (!normalized.length) return '';
    const payload = normalized.join(',');
    try {
      return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch {
      return '';
    }
  }

  decodeDeepLinkSelectionIds(encodedToken) {
    const token = String(encodedToken || '').trim();
    if (!token) return [];
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const fixed = padded + '='.repeat((4 - (padded.length % 4 || 4)) % 4);
    try {
      const decoded = atob(fixed);
      return Array.from(
        new Set(
          String(decoded || '')
            .split(',')
            .map((id) => this.normalizeDeepLinkPropId(id))
            .filter(Boolean)
        )
      );
    } catch {
      return [];
    }
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
      const fromPath = href.match(/\/share\/prop\/([^/?#]+)/i)?.[1] || '';
      if (fromPath) candidates.push(fromPath);
      const propToken = href.match(/prop_[a-z0-9_-]+/i)?.[0] || '';
      if (propToken) candidates.push(propToken);
    } catch {}
    for (const value of candidates) {
      const normalized = this.normalizeDeepLinkPropId(value);
      if (normalized) return normalized;
    }
    return null;
  }

  getDeepLinkSelectionIdsFromUrl() {
    const candidates = [];
    try {
      const params = new URLSearchParams(window.location.search);
      candidates.push(params.get('selection'));
      candidates.push(params.get('selectionId'));
      candidates.push(params.get('selectionToken'));
      candidates.push(params.get('startapp'));
      candidates.push(params.get('start'));
    } catch {}
    candidates.push(this.readTelegramStartParam());
    try {
      const href = String(window.location.href || '');
      const fromHref = href.match(/(?:startapp|start_param|tgWebAppStartParam|selection|selectionId|selectionToken)=([^&#]+)/i)?.[1] || '';
      if (fromHref) candidates.push(decodeURIComponent(fromHref));
      const fromPath = href.match(/\/share\/sel\/([^/?#]+)/i)?.[1] || '';
      if (fromPath) candidates.push(fromPath);
      const token = href.match(/sel_[a-z0-9_-]+/i)?.[0] || '';
      if (token) candidates.push(token);
    } catch {}
    for (const value of candidates) {
      const token = this.normalizeDeepLinkSelectionToken(value);
      if (!token) continue;
      const ids = this.decodeDeepLinkSelectionIds(token);
      if (ids.length) return ids;
    }
    return [];
  }

  clearDeepLinkParamInUrl() {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete(VW_DEEP_LINK_PARAM);
      currentUrl.searchParams.delete('selection');
      currentUrl.searchParams.delete('selectionId');
      currentUrl.searchParams.delete('selectionToken');
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
      this._deepLinkModeType = 'property';
      this._activeDeepLinkPropId = String(propId).trim();
      this._deepLinkSelectionIds = [];
      return true;
    } catch {
      return false;
    }
  }

  async renderSelectionByIds(ids = []) {
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((id) => this.normalizeDeepLinkPropId(id))
          .filter(Boolean)
      )
    );
    if (!normalizedIds.length) return false;
    const selected = [];
    for (let i = 0; i < normalizedIds.length; i += 1) {
      const id = normalizedIds[i];
      let item = this.getCatalogPropertyById(id);
      if (!item) {
        try {
          item = await this.api.fetchCardById(id);
          if (item) this.mergePropertiesToCatalog([item]);
        } catch {}
      }
      if (item) selected.push(item);
    }
    if (!selected.length) return false;
    this.clearPropertiesSlider();
    try {
      this.showChatScreen();
      selected.forEach((item) => {
        this.showMockCardWithActions(this._toCardEngineShape(item), { suppressAutoscroll: true });
      });
      this._isDeepLinkMode = true;
      this._deepLinkModeType = 'selection';
      this._activeDeepLinkPropId = null;
      this._deepLinkSelectionIds = normalizedIds;
      return true;
    } catch {
      return false;
    }
  }

  async tryOpenDeepLinkedProperty() {
    const propId = this._deepLinkPropId || this.getDeepLinkPropIdFromUrl();
    this._deepLinkPropId = propId || null;
    if (propId) {
      return await this.renderSinglePropertyById(propId);
    }
    const selectionIds = Array.isArray(this._deepLinkSelectionIds) && this._deepLinkSelectionIds.length
      ? this._deepLinkSelectionIds
      : this.getDeepLinkSelectionIdsFromUrl();
    this._deepLinkSelectionIds = Array.isArray(selectionIds) ? selectionIds : [];
    if (!this._deepLinkSelectionIds.length) return false;
    return await this.renderSelectionByIds(this._deepLinkSelectionIds);
  }

  exitDeepLinkMode({ clearUrl = true } = {}) {
    if (!this._isDeepLinkMode) return false;
    this._isDeepLinkMode = false;
    this._deepLinkModeType = null;
    this._activeDeepLinkPropId = null;
    this._deepLinkPropId = null;
    this._deepLinkSelectionIds = [];
    if (clearUrl) this.clearDeepLinkParamInUrl();
    this.renderPropertiesFromCatalog().catch(() => {});
    return true;
  }

  buildTelegramPropertyLink(propId) {
    const safeId = this.normalizeDeepLinkPropId(propId);
    if (!safeId) return '';
    return `${VW_SHARE_BASE_URL}/share/prop/${encodeURIComponent(safeId)}`;
  }

  buildTelegramSelectionLink(ids = []) {
    const token = this.encodeDeepLinkSelectionIds(ids);
    if (!token) return '';
    return `${VW_SHARE_BASE_URL}/share/sel/${encodeURIComponent(token)}`;
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

  buildSinglePropertyShareText(rawProperty = {}) {
    const normalized = this.normalizeCardData(rawProperty || {});
    const typeLabel = String(normalized.propertyTypeBadgeLabel || normalized.propertyType || 'Объект').trim() || 'Объект';
    const roomsRaw = Number(normalized.rooms);
    const roomsLabel = Number.isFinite(roomsRaw) && roomsRaw > 0
      ? `${roomsRaw} ${roomsRaw === 1 ? 'комната' : (roomsRaw >= 2 && roomsRaw <= 4 ? 'комнаты' : 'комнат')}`
      : '';
    const typeWithRooms = roomsLabel ? `${typeLabel}, ${roomsLabel}` : typeLabel;
    const priceLabel = String(normalized.priceLabel || '—').trim() || '—';
    const areaNum = Number(normalized.area_m2);
    const areaLabel = Number.isFinite(areaNum) && areaNum > 0
      ? `${String(areaNum).replace(/\.0+$/, '').replace('.', ',')} м²`
      : '—';
    const districtLabel = String(normalized.district || normalized.neighborhood || normalized.city || '—').trim() || '—';
    return [
      'Подобрал объект, который может вам подойти.',
      `Тип: ${typeWithRooms}`,
      `Цена: ${priceLabel}`,
      `Площадь: ${areaLabel}`,
      `Район: ${districtLabel}`
    ].join('\n');
  }

  async sharePropertyFromSlide(slide) {
    const card = slide?.querySelector('.cs');
    const propId = card?.getAttribute('data-variant-id') || '';
    if (!propId) return false;
    const source = this.getCatalogPropertyById(propId);
    const normalized = this.normalizeCardData(source || { id: propId });
    const titleLeft = this._cardFrontHeadline(normalized) || propId || 'Property';
    const title = normalized.priceLabel ? `${titleLeft} — ${normalized.priceLabel}` : titleLeft;
    const shareUrl = this.buildTelegramPropertyLink(propId);
    if (!shareUrl) return false;
    const payload = {
      title,
      text: this.buildSinglePropertyShareText(source || { id: propId }),
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

  async sharePropertiesSelectionByIds(ids = [], options = {}) {
    const normalized = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((id) => this.normalizeDeepLinkPropId(id))
          .filter(Boolean)
      )
    );
    if (!normalized.length) return false;
    const safeOptions = options && typeof options === 'object' ? options : {};
    const preferNative = safeOptions.preferNative === true;
    const tg = window?.Telegram?.WebApp;
    const initDataPresent = Boolean(String(tg?.initData || '').trim());
    if (!preferNative && tg && initDataPresent) {
      try {
        if (normalized.length === 1) {
          const inlineQuery = `share_prop_${normalized[0]}`;
          if (typeof tg?.switchInlineQuery === 'function') {
            try {
              tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
              return true;
            } catch {
              tg.switchInlineQuery(inlineQuery);
              return true;
            }
          }
          if (typeof tg?.switchInlineQueryChosenChat === 'function') {
            tg.switchInlineQueryChosenChat(inlineQuery, {
              allow_user_chats: true,
              allow_group_chats: true,
              allow_channel_chats: true
            });
            return true;
          }
        } else {
          const token = this.encodeDeepLinkSelectionIds(normalized);
          if (token) {
            const inlineQuery = `share_sel_${token}`;
            if (typeof tg?.switchInlineQuery === 'function') {
              try {
                tg.switchInlineQuery(inlineQuery, ['users', 'groups', 'channels']);
                return true;
              } catch {
                tg.switchInlineQuery(inlineQuery);
                return true;
              }
            }
            if (typeof tg?.switchInlineQueryChosenChat === 'function') {
              tg.switchInlineQueryChosenChat(inlineQuery, {
                allow_user_chats: true,
                allow_group_chats: true,
                allow_channel_chats: true
              });
              return true;
            }
          }
        }
      } catch (error) {
        console.warn('[TG Inline] selection share failed, fallback to native share:', error);
      }
    }
    const shareUrl = normalized.length === 1
      ? this.buildTelegramPropertyLink(normalized[0])
      : this.buildTelegramSelectionLink(normalized);
    if (!shareUrl) return false;
    const payload = {
      title: normalized.length === 1 ? 'Объект недвижимости' : `Подборка объектов (${normalized.length})`,
      text: normalized.length === 1
        ? this.buildSinglePropertyShareText(this.getCatalogPropertyById(normalized[0]) || { id: normalized[0] })
        : `Подобрал для вас подборку из ${normalized.length} объектов.\nОткройте карточки — внутри все детали и фото.`,
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

  getWishlistStorageKey() {
    const tgUser = this.getCurrentTelegramUser();
    const userId = String(tgUser?.id || 'anon').trim() || 'anon';
    return `vw_wishlist_ids_${userId}`;
  }

  loadWishlistIds() {
    try {
      const raw = localStorage.getItem(this.getWishlistStorageKey());
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      const ids = parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean);
      return new Set(ids);
    } catch {
      return new Set();
    }
  }

  persistWishlistIds() {
    try {
      if (!(this._wishlistIds instanceof Set)) this._wishlistIds = new Set();
      localStorage.setItem(this.getWishlistStorageKey(), JSON.stringify(Array.from(this._wishlistIds)));
    } catch {}
  }

  isWishlistSelected(id) {
    const sid = String(id || '').trim();
    if (!sid) return false;
    if (!(this._wishlistIds instanceof Set)) this._wishlistIds = this.loadWishlistIds();
    return this._wishlistIds.has(sid);
  }

  toggleWishlistSelection(id, selected = null) {
    const sid = String(id || '').trim();
    if (!sid) return false;
    if (!(this._wishlistIds instanceof Set)) this._wishlistIds = this.loadWishlistIds();
    const targetState = selected == null ? !this._wishlistIds.has(sid) : !!selected;
    if (targetState) this._wishlistIds.add(sid);
    else this._wishlistIds.delete(sid);
    this.persistWishlistIds();
    try { this.updateAccessHeaderButton({ pulse: targetState }); } catch {}
    try {
      const accessOverlay = this.getRoot().querySelector('#vwAccessOverlay');
      if (accessOverlay) this.updateAdminWishlistMenuBadge(accessOverlay);
    } catch {}
    return targetState;
  }

  getWishlistObjectsList() {
    if (!(this._wishlistIds instanceof Set)) this._wishlistIds = this.loadWishlistIds();
    const selectedIds = this._wishlistIds;
    if (!selectedIds.size) return [];
    const all = this.getAdminObjectsMockList({ preferFull: true });
    return all.filter((item) => selectedIds.has(String(item?.id || '').trim()));
  }

  getWishlistCount() {
    if (!(this._wishlistIds instanceof Set)) this._wishlistIds = this.loadWishlistIds();
    return this._wishlistIds.size;
  }

  syncWishlistButtonsInDom() {
    try {
      this.getRoot().querySelectorAll('.card-btn.like[data-action="like"][data-variant-id]').forEach((btn) => {
        const id = String(btn.getAttribute('data-variant-id') || '').trim();
        const selected = this.isWishlistSelected(id);
        btn.classList.toggle('is-liked', selected);
      });
    } catch {}
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
        // UX: сразу возвращаем пользователя в админ-оверлей после callback.
        setTimeout(() => {
          try { this.openAccessOverlay(); } catch {}
        }, 200);
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

  setAccessButtonLabel(button, text) {
    if (!button) return;
    const labelEl = button.querySelector('.vw-access-item__label');
    if (labelEl) labelEl.textContent = String(text || '');
    else button.textContent = String(text || '');
  }

  setAccessButtonBusy(button, busy = false) {
    if (!button) return;
    button.classList.toggle('is-busy', !!busy);
  }

  async refreshOlxStatusButton(button, syncButton = null) {
    if (!button) return false;
    const locale = this.getCurrentLocale();
    const tgUser = this.getCurrentTelegramUser();
    const backendBase = this.getBackendBaseUrl();

    if (!backendBase || !tgUser?.id) {
      this.setAccessButtonLabel(button, locale.accessAdminOlxConnect || 'Connect OLX');
      button.disabled = false;
      if (syncButton) {
        syncButton.disabled = false;
        this.setAccessButtonLabel(syncButton, locale.accessAdminOlxSync || 'Import OLX adverts');
      }
      return false;
    }

    this.setAccessButtonLabel(button, locale.accessAdminOlxChecking || 'Checking OLX...');
    button.disabled = true;
    try {
      const statusUrl = new URL(`${backendBase}/api/olx/status`);
      statusUrl.searchParams.set('tgUserId', tgUser.id);
      const response = await fetch(statusUrl.toString());
      const payload = await response.json().catch(() => ({}));
      const connected = Boolean(response.ok && payload?.ok && payload?.connected);
      this.setAccessButtonLabel(button, connected
        ? (locale.accessAdminOlxConnected || 'OLX connected (reconnect)')
        : (locale.accessAdminOlxConnect || 'Connect OLX'));
      button.disabled = false;
      if (syncButton) {
        syncButton.disabled = false;
        this.setAccessButtonLabel(syncButton, locale.accessAdminOlxSync || 'Import OLX adverts');
      }
      return connected;
    } catch {
      this.setAccessButtonLabel(button, locale.accessAdminOlxConnect || 'Connect OLX');
      button.disabled = false;
      if (syncButton) {
        syncButton.disabled = false;
        this.setAccessButtonLabel(syncButton, locale.accessAdminOlxSync || 'Import OLX adverts');
      }
      this.ui?.showNotification?.(`⚠️ ${locale.accessAdminOlxError || 'Failed to check OLX status'}`);
      return false;
    }
  }

  openOlxConnectFlow(button = null) {
    const url = this.buildOlxConnectUrl();
    if (!url) {
      this.ui?.showNotification?.('⚠️ OLX URL is not configured');
      return;
    }
    this.setAccessButtonBusy(button, true);
    this.setAccessButtonLabel(button, this.t('accessAdminOlxConnectOpening') || 'Opening OLX...');
    window.location.href = url;
  }

  async syncOlxAdverts(button = null) {
    const locale = this.getCurrentLocale();
    const tgUser = this.getCurrentTelegramUser();
    const backendBase = this.getBackendBaseUrl();
    if (!backendBase || !tgUser?.id) {
      this.ui?.showNotification?.(`⚠️ ${locale.accessAdminOlxSyncFailed || 'Failed to sync OLX adverts'}`);
      return;
    }

    this.setAccessButtonBusy(button, true);
    this.setAccessButtonLabel(button, locale.accessAdminOlxSyncing || 'Syncing OLX adverts...');
    this.ui?.showNotification?.(`⏳ ${locale.accessAdminOlxSyncing || 'Syncing OLX adverts...'}`);
    try {
      const url = new URL(`${backendBase}/api/olx/sync`);
      url.searchParams.set('tgUserId', tgUser.id);
      const response = await fetch(url.toString(), { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || `HTTP_${response.status}`);
      }

      const imported = Number(payload?.imported || 0);
      const label = this.t('accessAdminOlxSyncDone', { count: imported }) || `OLX import: ${imported} adverts`;
      this.ui?.showNotification?.(`✅ ${label}`);
      try {
        await this.initializePropertiesCatalog?.();
      } catch {}
    } catch (error) {
      console.warn('syncOlxAdverts failed:', error);
      const message = String(error?.message || '');
      if (message.includes('OLX_NOT_CONNECTED')) {
        this.ui?.showNotification?.(`⚠️ ${locale.accessAdminOlxSyncLocked || 'Connect OLX first'}`);
        return;
      }
      this.ui?.showNotification?.(`⚠️ ${locale.accessAdminOlxSyncFailed || 'Failed to sync OLX adverts'}`);
    } finally {
      this.setAccessButtonBusy(button, false);
      this.setAccessButtonLabel(button, locale.accessAdminOlxSync || 'Import OLX adverts');
    }
  }

  updateAccessHeaderButton({ pulse = false } = {}) {
    const btn = this.$byId('appThemeButton');
    if (!btn) return;
    const locale = this.getCurrentLocale();
    const isAdmin = this.accessRole === 'owner' || this.accessRole === 'super_admin' || this.accessFlags?.isAdmin === true;
    const wishlistCount = this.getWishlistCount();
    btn.disabled = false;
    btn.classList.remove('app-theme-btn--placeholder');
    btn.classList.toggle('app-theme-btn--has-wishlist', wishlistCount > 0);
    if (wishlistCount > 0) {
      btn.dataset.count = String(wishlistCount);
      btn.textContent = isAdmin ? (locale.accessAdminIcon || '👑') : '♥';
    } else {
      delete btn.dataset.count;
      btn.textContent = isAdmin ? (locale.accessAdminIcon || '👑') : (locale.accessUserIcon || '♡');
    }
    if (pulse && wishlistCount > 0) {
      btn.classList.remove('is-insight-pulse');
      void btn.offsetWidth;
      btn.classList.add('is-insight-pulse');
      setTimeout(() => {
        try { btn.classList.remove('is-insight-pulse'); } catch {}
      }, 1200);
    } else if (!pulse) {
      btn.classList.remove('is-insight-pulse');
    }
    btn.setAttribute('title', isAdmin ? (locale.appHeaderAdminAria || 'Открыть админ-панель') : (locale.appHeaderWishlistAria || 'Открыть избранное'));
    btn.setAttribute('aria-label', isAdmin ? (locale.appHeaderAdminAria || 'Открыть админ-панель') : (locale.appHeaderWishlistAria || 'Открыть избранное'));
  }

  updateAdminWishlistMenuBadge(overlay) {
    if (!overlay) return;
    const item = overlay.querySelector('[data-role="admin-wishlist"]');
    if (!item) return;
    const count = this.getWishlistCount();
    item.classList.toggle('vw-access-item--has-count', count > 0);
    if (count > 0) item.dataset.count = String(count);
    else delete item.dataset.count;
  }

  updateUserWishlistMenuCount(overlay) {
    if (!overlay) return;
    const countEl = overlay.querySelector('[data-role="user-wishlist-count"]');
    if (!countEl) return;
    const count = this.getWishlistCount();
    countEl.textContent = String(count);
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

  _getFullCatalogProperties() {
    const full = Array.isArray(window?.appState?.fullCatalogProperties) ? window.appState.fullCatalogProperties : [];
    return full;
  }

  _setFullCatalogProperties(properties = []) {
    if (!window.appState) window.appState = {};
    const incoming = this._extractPropertiesList(properties).map((item) => this._toCardEngineShape(item));
    window.appState.fullCatalogProperties = incoming;
  }

  _mergeIntoFullCatalogProperties(properties = []) {
    if (!window.appState) window.appState = {};
    const current = this._getFullCatalogProperties();
    const incoming = this._extractPropertiesList(properties);
    const merged = new Map();
    current.forEach((item, idx) => {
      const normalized = this._toCardEngineShape(item);
      merged.set(this._getPropertyCatalogKey(normalized, idx), normalized);
    });
    incoming.forEach((item, idx) => {
      const normalized = this._toCardEngineShape(item);
      merged.set(this._getPropertyCatalogKey(normalized, idx), normalized);
    });
    window.appState.fullCatalogProperties = Array.from(merged.values());
  }

  async ensureAdminFullCatalogLoaded() {
    const existing = this._getFullCatalogProperties();
    if (existing.length) return existing;
    try {
      const all = await this.loadAllProperties();
      if (Array.isArray(all) && all.length) {
        this._setFullCatalogProperties(all);
        return this._getFullCatalogProperties();
      }
    } catch {}
    return [];
  }

  getAdminObjectsMockList(options = {}) {
    const safeOptions = options && typeof options === 'object' ? options : {};
    const preferFull = safeOptions.preferFull === true;
    const onlyLiked = safeOptions.onlyLiked === true;
    const sourceList = preferFull
      ? (this._getFullCatalogProperties().length ? this._getFullCatalogProperties() : (Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : []))
      : (Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : []);
    const list = onlyLiked
      ? sourceList.filter((item) => this.isWishlistSelected(item?.id || item?.external_id || item?.externalId || item?.propertyId || item?.uid))
      : sourceList;
    const objects = list
      .map((item, idx) => {
        const id = String(item?.external_id || item?.externalId || item?.id || item?.variantId || item?._id || '').trim();
        if (!id) return null;
        const title = String(item?.title || item?.description || `Объект ${idx + 1}`).trim();
        const district = String(item?.district || item?.neighborhood || item?.city || '—').trim() || '—';
        const roomsRaw = Number(item?.rooms);
        const rooms = Number.isFinite(roomsRaw) && roomsRaw > 0 ? String(Math.round(roomsRaw)) : '—';
        const areaRaw = Number(item?.area_m2 || item?.area || item?.specs_area_m2);
        const area = Number.isFinite(areaRaw) && areaRaw > 0 ? `${Math.round(areaRaw)} м²` : '—';
        const priceUsdRaw = Number(item?.priceUSD || item?.price_usd || item?.priceUsd);
        const priceRaw = Number(item?.price || item?.price_amount || item?.priceEUR);
        const normalizedUsd = Number.isFinite(priceUsdRaw) && priceUsdRaw > 0
          ? Math.round(priceUsdRaw)
          : (Number.isFinite(priceRaw) && priceRaw > 0 ? Math.round(priceRaw) : null);
        const price = Number.isFinite(normalizedUsd) && normalizedUsd > 0
          ? `$${normalizedUsd.toLocaleString('en-US')}`
          : '—';
        const operation = String(item?.operation || item?.listingOperation || '').trim().toLowerCase();
        const propertyType = String(item?.property_type || item?.propertyType || item?.type || '').trim().toLowerCase();
        return {
          id,
          title,
          district,
          rooms,
          area,
          price,
          priceValue: Number.isFinite(normalizedUsd) && normalizedUsd > 0 ? normalizedUsd : null,
          areaValue: Number.isFinite(areaRaw) && areaRaw > 0 ? areaRaw : null,
          operation: ['sale', 'rent'].includes(operation) ? operation : '',
          propertyType
        };
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
          { id: 'OD050', title: 'Одеса, 2к квартира', district: 'Приморский', rooms: '2', area: '56 м²', price: '$79,000', priceValue: 79000, areaValue: 56, operation: 'sale', propertyType: 'apartment' },
          { id: 'OD049', title: 'Одеса, 1к квартира', district: 'Киевский', rooms: '1', area: '40 м²', price: '$51,000', priceValue: 51000, areaValue: 40, operation: 'sale', propertyType: 'apartment' },
          { id: 'OD048', title: 'Одеса, 3к квартира', district: 'Суворовский', rooms: '3', area: '84 м²', price: '$97,000', priceValue: 97000, areaValue: 84, operation: 'sale', propertyType: 'apartment' },
          { id: 'OD047', title: 'Одеса, пентхаус', district: 'Аркадия', rooms: '4', area: '130 м²', price: '$210,000', priceValue: 210000, areaValue: 130, operation: 'sale', propertyType: 'apartment' },
          { id: 'OD046', title: 'Одеса, смарт-квартира', district: 'Таирова', rooms: '1', area: '28 м²', price: '$33,000', priceValue: 33000, areaValue: 28, operation: 'rent', propertyType: 'apartment' }
        ];
  }

  applyAdminPropertiesView(items = [], options = {}) {
    const list = Array.isArray(items) ? [...items] : [];
    const safeOptions = options && typeof options === 'object' ? options : {};
    const onlyLiked = safeOptions.onlyLiked === true;
    const operationFilter = String(safeOptions.operationFilter || 'all').toLowerCase();
    const sortBy = String(safeOptions.sortBy || '').toLowerCase();
    const sortDir = String(safeOptions.sortDir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

    let filtered = list;
    if (onlyLiked) {
      filtered = filtered.filter((item) => this.isWishlistSelected(item?.id));
    }
    if (operationFilter === 'sale' || operationFilter === 'rent') {
      filtered = filtered.filter((item) => String(item?.operation || '').toLowerCase() === operationFilter);
    }
    if (sortBy === 'price' || sortBy === 'area') {
      const dirFactor = sortDir === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const av = sortBy === 'price' ? Number(a?.priceValue) : Number(a?.areaValue);
        const bv = sortBy === 'price' ? Number(b?.priceValue) : Number(b?.areaValue);
        const aOk = Number.isFinite(av);
        const bOk = Number.isFinite(bv);
        if (!aOk && !bOk) return 0;
        if (!aOk) return 1;
        if (!bOk) return -1;
        if (av === bv) return 0;
        return av > bv ? dirFactor : -dirFactor;
      });
    }
    return filtered;
  }

  getAdminObjectOperationLabel(item) {
    const operation = String(item?.operation || '').trim().toLowerCase();
    if (operation === 'sale') return 'Продажа';
    if (operation === 'rent') return 'Аренда';
    return '—';
  }

  getAdminObjectTypeLabel(item) {
    const type = String(item?.propertyType || item?.property_type || '').trim().toLowerCase();
    if (type === 'apartment') return 'Квартира';
    if (type === 'house') return 'Дом';
    if (type === 'commercial') return 'Коммерция';
    if (type === 'land') return 'Земля';
    if (type === 'parking') return 'Паркинг';
    return type ? (type[0].toUpperCase() + type.slice(1)) : '—';
  }

  updateAdminObjectsSelectionState(overlay) {
    if (!overlay) return;
    const rows = Array.from(overlay.querySelectorAll('.vw-access-obj-card'));
    const checks = rows.map((row) => row.querySelector('[data-role="row-check"]')).filter(Boolean);
    const selected = checks.filter((check) => check.checked).length;
    const total = checks.length;
    const shareBtn = overlay.querySelector('[data-role="share"]');
    const cancelBtn = overlay.querySelector('[data-role="cancel-selected"]');
    const removeBtn = overlay.querySelector('[data-role="remove-selected"]');
    const selectAllBtn = overlay.querySelector('[data-role="select-all"]');
    const totalValue = overlay.querySelector('[data-role="list-total"]');
    if (shareBtn) {
      shareBtn.disabled = selected <= 0;
    }
    if (cancelBtn) {
      cancelBtn.disabled = selected <= 0;
    }
    if (removeBtn) {
      removeBtn.disabled = selected <= 0;
    }
    if (selectAllBtn) {
      const allSelected = total > 0 && selected === total;
      selectAllBtn.classList.toggle('is-active', allSelected);
      selectAllBtn.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
    }
    if (totalValue) {
      totalValue.textContent = String(total);
    }
  }

  openAccessSubOverlay(section = 'stats', options = {}) {
    this.closeAccessSubOverlay();
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
    const fmtDate = (d) => {
      try { return d.toLocaleDateString('ru-RU'); } catch { return ''; }
    };
    const locale = this.getCurrentLocale();
    const safeSection = String(section || '').trim().toLowerCase();
    const safeOptions = options && typeof options === 'object' ? options : {};
    const adminViewOptions = {
      onlyLiked: safeOptions.onlyLiked === true || String(safeOptions.onlyLiked || '').toLowerCase() === 'true',
      sortBy: String(safeOptions.sortBy || '').toLowerCase(),
      sortDir: String(safeOptions.sortDir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
      operationFilter: String(safeOptions.operationFilter || 'all').toLowerCase()
    };
    const adminRawList = this.getAdminObjectsMockList({ preferFull: safeSection === 'properties' });
    const list = safeSection === 'wishlist'
      ? this.getWishlistObjectsList()
      : (safeSection === 'properties' ? this.applyAdminPropertiesView(adminRawList, adminViewOptions) : adminRawList);
    const isAddProperty = safeSection === 'add-property';
    const editPropertyId = isAddProperty ? String(safeOptions.propertyId || '').trim() : '';
    const isEditProperty = isAddProperty && String(safeOptions.mode || '').trim().toLowerCase() === 'edit' && !!editPropertyId;
    const editSourceProperty = isEditProperty ? this.findCatalogPropertyById(editPropertyId) : null;
    const modalBody = (() => {
      if (isAddProperty) {
        return `
          <div class="vw-access-add-wizard" data-role="add-wizard" data-step="1">
            <input type="hidden" data-role="reserved-external-id" value="">
            <input type="hidden" data-role="photo-input-target" value="">
            <input class="vw-access-add-file" data-role="photo-input" type="file" accept="image/*">
            <div class="vw-access-add-step" data-step-panel="1">
              <div class="vw-access-add-row2">
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input" data-role="property-type" name="propertyType">
                    <option value="">* Тип недвижимости</option>
                    <option value="apartment">Квартира</option>
                    <option value="house">Дом</option>
                    <option value="commercial">Коммерция</option>
                    <option value="land">Участок</option>
                  </select>
                </label>
                <label class="vw-access-add-field">
                  <select class="vw-access-add-input vw-access-add-input--id" data-role="listing-operation" name="listingOperation">
                    <option value="">Продажа/Аренда</option>
                    <option value="sale">Продаж</option>
                    <option value="rent">Аренда</option>
                  </select>
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
                <button type="button" class="vw-access-sub-btn" data-role="add-exit" style="display:none;">Выйти</button>
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
                  <input type="hidden" data-role="complex" name="complex" value="">
                  <button type="button" class="vw-access-add-input vw-access-add-complex-trigger" data-role="complex-trigger" aria-haspopup="listbox" aria-expanded="false">
                    <span class="vw-access-add-complex-trigger__label" data-role="complex-trigger-label">Название ЖК</span>
                  </button>
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
                <label class="vw-access-add-check-item"><input type="checkbox" name="parking"><span>Есть паркинг</span></label>
              </div>
              <label class="vw-access-add-field">
                <textarea class="vw-access-add-textarea" name="description" data-role="description" placeholder="Опишите квартиру"></textarea>
              </label>
              <div class="vw-access-add-actions">
                <button type="button" class="vw-access-sub-btn" data-role="add-draft">В черновик</button>
                <button type="button" class="vw-access-sub-btn" data-role="add-exit" style="display:none;">Выйти</button>
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="add-preview">Предпросмотр</button>
              </div>
            </div>

            <div class="vw-access-add-step" data-step-panel="3">
              <div class="vw-access-preview-card" data-role="preview-card">
                <div class="vw-access-preview-media">
                  <img class="is-empty" data-role="preview-main-image" alt="preview">
                  <div class="vw-access-preview-overlay-badges">
                    <span class="vw-access-preview-pill" data-role="preview-id">ID</span>
                    <span class="vw-access-preview-pill" data-role="preview-op">Продажа</span>
                    <span class="vw-access-preview-pill" data-role="preview-type">Квартира</span>
                  </div>
                  <div class="vw-access-preview-thumbs">
                    <button type="button" class="vw-access-preview-thumb is-active" data-role="preview-thumb" data-thumb-index="0"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="1"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="2"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="3"></button>
                    <button type="button" class="vw-access-preview-thumb" data-role="preview-thumb" data-thumb-index="4"></button>
                  </div>
                </div>
                <div class="vw-access-preview-body" data-role="preview-front">
                  <div class="vw-access-preview-row">
                    <div class="vw-access-preview-title" data-role="preview-title">—</div>
                  </div>
                  <div class="vw-access-preview-row">
                    <div class="vw-access-preview-district" data-role="preview-district">—</div>
                    <div class="vw-access-preview-price" data-role="preview-price">0 USD</div>
                  </div>
                  <div class="vw-access-preview-specs">
                    <span class="vw-access-preview-pill" data-role="preview-rooms">🛏️ 0 rooms</span>
                    <span class="vw-access-preview-pill" data-role="preview-area">📐 0 m²</span>
                    <span class="vw-access-preview-pill" data-role="preview-floor">🏢 0 floor</span>
                  </div>
                </div>
              </div>
              <div class="vw-access-add-actions">
                <button type="button" class="vw-access-sub-btn" data-role="add-draft">В черновик</button>
                <button type="button" class="vw-access-sub-btn" data-role="add-exit" style="display:none;">Выйти</button>
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="add-publish-final">${isEditProperty ? 'Опубликовать изменения' : 'Опубликовать'}</button>
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
          <article class="vw-access-obj-card vw-access-obj-card--admin" data-id="${item.id}" role="button" tabindex="0" aria-label="Выбрать ${item.id}">
            <div class="vw-access-obj-side">
              <button
                type="button"
                class="vw-access-obj-edit"
                data-role="row-edit"
                aria-label="Редактировать объект ${item.id}"
                title="Редактировать"
              >✎</button>
              <label class="vw-access-obj-check" data-role="row-check-wrap"><input type="checkbox" data-role="row-check"></label>
              <button
                type="button"
                class="vw-access-obj-delete"
                data-role="row-delete"
                aria-label="Удалить объект ${item.id}"
                title="Удалить"
              >🗑</button>
            </div>
            <div class="vw-access-obj-main">
              <div class="vw-access-obj-badges">
                <span class="vw-access-obj-id-badge">${item.id}</span>
                <span class="vw-access-obj-pill">${this.getAdminObjectOperationLabel(item)}</span>
                <span class="vw-access-obj-pill">${this.getAdminObjectTypeLabel(item)}</span>
              </div>
              <h4 class="vw-access-obj-title">${item.title || '—'}</h4>
              <div class="vw-access-obj-meta">${item.price} · ${item.area} · ${item.rooms} комн · ${item.district}</div>
            </div>
          </article>
        `).join('');
        return `
          <div class="vw-access-objects-layout">
            <div class="vw-access-objects-topbar">
              <div class="vw-access-objects-total">Всего: <strong data-role="list-total">${list.length}</strong></div>
              <button type="button" class="vw-access-sub-btn vw-access-sub-btn--ghost vw-access-sub-btn--text-action" data-role="select-all">Выбрать всё</button>
              <div class="vw-access-objects-topbar-actions vw-access-objects-topbar-actions--right">
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--ghost vw-access-sub-btn--text-action" data-role="sort-trigger">
                  <span>Сортировать по</span>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 4h12M4 8h8M6 12h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="vw-access-objects-scroll">
              <div class="vw-access-obj-list">${rows}</div>
            </div>
            <div class="vw-access-objects-bottombar">
              <button type="button" class="vw-access-sub-btn vw-access-sub-btn--danger" data-role="cancel-selected" disabled>Отменить</button>
              <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="share" disabled>Поделиться</button>
            </div>
          </div>
        `;
      }
      if (safeSection === 'wishlist') {
        const rows = list.map((item) => `
          <article class="vw-access-obj-card" data-id="${item.id}" role="button" tabindex="0" aria-label="Выбрать ${item.id}">
            <label class="vw-access-obj-check" data-role="row-check-wrap"><input type="checkbox" data-role="row-check"></label>
            <div class="vw-access-obj-main">
              <div class="vw-access-obj-badges">
                <span class="vw-access-obj-id-badge">${item.id}</span>
                <span class="vw-access-obj-pill">${this.getAdminObjectOperationLabel(item)}</span>
                <span class="vw-access-obj-pill">${this.getAdminObjectTypeLabel(item)}</span>
              </div>
              <h4 class="vw-access-obj-title">${item.title || '—'}</h4>
              <div class="vw-access-obj-meta">${item.price} · ${item.area} · ${item.rooms} комн · ${item.district}</div>
            </div>
          </article>
        `).join('');
        const isEmptyWishlist = !rows;
        return `
          <div class="vw-access-objects-layout">
            <div class="vw-access-objects-topbar">
              <div class="vw-access-objects-total">Всего: <strong data-role="list-total">${list.length}</strong></div>
              <button type="button" class="vw-access-sub-btn vw-access-sub-btn--ghost vw-access-sub-btn--text-action" data-role="select-all">Выбрать всё</button>
              <div class="vw-access-objects-topbar-actions vw-access-objects-topbar-actions--right">
                <button type="button" class="vw-access-sub-btn vw-access-sub-btn--ghost vw-access-sub-btn--text-action" data-role="reset-wishlist">
                  <span>Сбросить</span>
                  <span class="vw-access-reset-glyph" aria-hidden="true">↻</span>
                </button>
              </div>
            </div>
            <div class="vw-access-objects-scroll">
              <div class="vw-access-obj-list${isEmptyWishlist ? ' vw-access-obj-list--empty' : ''}">
                ${rows || `<div class="vw-access-sub-item">${locale.accessUserEmpty || "Здесь появятся объекты, которые вы добавите в избранное (Wishlist)"}</div>`}
              </div>
            </div>
            <div class="vw-access-objects-bottombar vw-access-objects-bottombar--wishlist">
              <button type="button" class="vw-access-sub-btn" data-role="remove-selected" disabled>${locale.accessUserRemove || 'Убрать'}</button>
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
      : safeSection === 'wishlist'
        ? (locale.accessUserWishlist || 'Моя подборка')
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
          <button type="button" class="vw-access-add-reset-head" data-role="add-reset-head" aria-label="Сбросить изменения">↻</button>
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
      <div class="vw-access-sub-modal ${isAddProperty ? 'vw-access-sub-modal--add' : ''} ${(safeSection === 'properties' || safeSection === 'wishlist') ? 'vw-access-sub-modal--properties' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
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
      const getChecks = () => getRows().map((row) => row.querySelector('[data-role="row-check"]')).filter(Boolean);
      const getSelectedIds = () => getRows()
        .filter((row) => !!row.querySelector('[data-role="row-check"]')?.checked)
        .map((row) => String(row.getAttribute('data-id') || '').trim())
        .filter(Boolean);
      const setAllSelected = (selected) => {
        getChecks().forEach((check) => { check.checked = !!selected; });
        getRows().forEach((row) => row.classList.toggle('is-selected', !!selected));
        this.updateAdminObjectsSelectionState(overlay);
      };
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
        const cancelBtn = layer.querySelector('[data-role="cancel-delete"]');
        const confirmBtn = layer.querySelector('[data-role="confirm-delete"]');
        cancelBtn?.addEventListener('click', close);
        confirmBtn?.addEventListener('click', async () => {
          if (!confirmBtn) return;
          const original = confirmBtn.textContent || 'Удалить';
          confirmBtn.disabled = true;
          if (cancelBtn) cancelBtn.disabled = true;
          confirmBtn.textContent = 'Удаляем...';
          try {
            await onConfirm?.();
          } catch (error) {
            this.ui?.showNotification?.('Не удалось выполнить удаление');
          } finally {
            close();
            confirmBtn.textContent = original;
          }
        });
      };
      const deleteSelectedIds = async (selectedIds = []) => {
        if (!Array.isArray(selectedIds) || !selectedIds.length) return;
        const deleteApi = this.api?.deleteManualProperty;
        if (typeof deleteApi !== 'function') {
          throw new Error('DELETE_API_UNAVAILABLE');
        }
        const failed = [];
        const succeeded = [];
        for (let i = 0; i < selectedIds.length; i += 1) {
          const id = selectedIds[i];
          try {
            await deleteApi.call(this.api, id);
            succeeded.push(id);
          } catch (error) {
            failed.push({ id, code: String(error?.message || 'UNKNOWN') });
          }
        }
        const currentList = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
        window.appState.allProperties = currentList.filter((item) => {
          const id = String(item?.external_id || item?.externalId || item?.id || item?.variantId || item?._id || '').trim();
          return !succeeded.includes(id);
        });
        const fullList = this._getFullCatalogProperties();
        if (fullList.length) {
          const nextFull = fullList.filter((item) => {
            const id = String(item?.external_id || item?.externalId || item?.id || item?.variantId || item?._id || '').trim();
            return !succeeded.includes(id);
          });
          this._setFullCatalogProperties(nextFull);
        }
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
          if (hasForbidden) {
            this.ui?.showNotification?.('Нет прав на удаление объектов');
          } else {
            const code = String(failed?.[0]?.code || 'UNKNOWN');
            this.ui?.showNotification?.(`Удаление не выполнено (${code})`);
          }
        } else {
          this.ui?.showNotification?.(`Удаление частично выполнено: ${succeeded.length}/${selectedIds.length}`);
        }
      };
      getRows().forEach((row) => {
        const check = row.querySelector('[data-role="row-check"]');
        const checkWrap = row.querySelector('[data-role="row-check-wrap"]');
        const editBtn = row.querySelector('[data-role="row-edit"]');
        const deleteBtn = row.querySelector('[data-role="row-delete"]');
        const sync = () => {
          const selected = !!check?.checked;
          row.classList.toggle('is-selected', selected);
          this.updateAdminObjectsSelectionState(overlay);
        };
        check?.addEventListener('change', sync);
        checkWrap?.addEventListener('click', (event) => event.stopPropagation());
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
        editBtn?.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const id = String(row.getAttribute('data-id') || '').trim();
          if (!id) return;
          this.openAccessSubOverlay('add-property', { mode: 'edit', propertyId: id });
        });
        deleteBtn?.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const id = String(row.getAttribute('data-id') || '').trim();
          if (!id) return;
          showDeleteDialog({
            count: 1,
            onConfirm: async () => {
              await deleteSelectedIds([id]);
            }
          });
        });
      });
      overlay.querySelector('[data-role="select-all"]')?.addEventListener('click', () => {
        const checks = getChecks();
        if (!checks.length) return;
        const selectedCount = checks.filter((check) => check.checked).length;
        setAllSelected(selectedCount !== checks.length);
      });
      overlay.querySelector('[data-role="sort-trigger"]')?.addEventListener('click', () => {
        const cycleDeal = (current) => {
          if (current === 'all') return 'sale';
          if (current === 'sale') return 'rent';
          return 'all';
        };
        const reopenWith = (patch = {}) => {
          this.openAccessSubOverlay('properties', { ...adminViewOptions, ...patch });
        };
        const draft = {
          onlyLiked: !!adminViewOptions.onlyLiked,
          sortBy: String(adminViewOptions.sortBy || ''),
          sortDir: adminViewOptions.sortDir === 'desc' ? 'desc' : 'asc',
          operationFilter: ['all', 'sale', 'rent'].includes(adminViewOptions.operationFilter) ? adminViewOptions.operationFilter : 'all'
        };
        const layer = document.createElement('div');
        layer.className = 'vw-access-add-dialog-layer';
        layer.innerHTML = `
          <div class="vw-access-add-dialog">
            <div class="vw-access-add-dialog-head">
              <div class="vw-access-add-dialog-title">${locale.accessAdminSort || 'Сортировка'}</div>
              <button type="button" class="vw-access-add-dialog-close" data-role="sort-close" aria-label="${locale.close || 'Закрыть'}">×</button>
            </div>
            <div class="vw-access-add-dialog-actions">
              <button type="button" class="vw-access-add-dialog-btn is-neutral" data-role="sort-liked"></button>
              <button type="button" class="vw-access-add-dialog-btn is-neutral" data-role="sort-price"></button>
              <button type="button" class="vw-access-add-dialog-btn is-neutral" data-role="sort-area"></button>
              <button type="button" class="vw-access-add-dialog-btn is-neutral" data-role="sort-deal"></button>
            </div>
            <div class="vw-access-add-dialog-actions">
              <button type="button" class="vw-access-add-dialog-btn is-neutral" data-role="sort-reset">${locale.accessAdminSortReset || 'Сброс'}</button>
              <button type="button" class="vw-access-add-dialog-btn is-primary" data-role="sort-apply">${locale.accessAdminSortApply || 'Применить'}</button>
            </div>
          </div>
        `;
        overlay.appendChild(layer);
        const close = () => { try { layer.remove(); } catch {} };
        const getLabelPrice = () => (
          draft.sortBy === 'price'
            ? (draft.sortDir === 'desc' ? (locale.accessAdminSortPriceDesc || 'Цена ↓') : (locale.accessAdminSortPriceAsc || 'Цена ↑'))
            : (locale.accessAdminSortPriceAsc || 'Цена ↑')
        );
        const getLabelArea = () => (
          draft.sortBy === 'area'
            ? (draft.sortDir === 'desc' ? (locale.accessAdminSortAreaDesc || 'Площадь ↓') : (locale.accessAdminSortAreaAsc || 'Площадь ↑'))
            : (locale.accessAdminSortAreaAsc || 'Площадь ↑')
        );
        const getLabelDeal = () => (
          draft.operationFilter === 'sale'
            ? (locale.accessAdminSortDealSale || 'Сделка: продажа')
            : draft.operationFilter === 'rent'
              ? (locale.accessAdminSortDealRent || 'Сделка: аренда')
              : (locale.accessAdminSortDealAll || 'Сделка: все')
        );
        const syncState = () => {
          const likedBtn = layer.querySelector('[data-role="sort-liked"]');
          const priceBtn = layer.querySelector('[data-role="sort-price"]');
          const areaBtn = layer.querySelector('[data-role="sort-area"]');
          const dealBtn = layer.querySelector('[data-role="sort-deal"]');
          if (likedBtn) {
            likedBtn.textContent = draft.onlyLiked ? (locale.accessAdminShowAll || 'Все') : (locale.accessAdminShowLiked || 'Лайкнутые');
            likedBtn.classList.toggle('is-active', draft.onlyLiked);
          }
          if (priceBtn) {
            priceBtn.textContent = getLabelPrice();
            priceBtn.classList.toggle('is-active', draft.sortBy === 'price');
          }
          if (areaBtn) {
            areaBtn.textContent = getLabelArea();
            areaBtn.classList.toggle('is-active', draft.sortBy === 'area');
          }
          if (dealBtn) {
            dealBtn.textContent = getLabelDeal();
            dealBtn.classList.toggle('is-active', draft.operationFilter !== 'all');
          }
        };
        syncState();
        layer.addEventListener('click', (event) => {
          if (event.target === layer) close();
        });
        layer.querySelector('[data-role="sort-close"]')?.addEventListener('click', close);
        layer.querySelector('[data-role="sort-liked"]')?.addEventListener('click', () => {
          draft.onlyLiked = !draft.onlyLiked;
          syncState();
        });
        layer.querySelector('[data-role="sort-price"]')?.addEventListener('click', () => {
          draft.sortDir = draft.sortBy === 'price' && draft.sortDir === 'asc' ? 'desc' : 'asc';
          draft.sortBy = 'price';
          syncState();
        });
        layer.querySelector('[data-role="sort-area"]')?.addEventListener('click', () => {
          draft.sortDir = draft.sortBy === 'area' && draft.sortDir === 'asc' ? 'desc' : 'asc';
          draft.sortBy = 'area';
          syncState();
        });
        layer.querySelector('[data-role="sort-deal"]')?.addEventListener('click', () => {
          draft.operationFilter = cycleDeal(draft.operationFilter);
          syncState();
        });
        layer.querySelector('[data-role="sort-reset"]')?.addEventListener('click', () => {
          draft.onlyLiked = false;
          draft.sortBy = '';
          draft.sortDir = 'asc';
          draft.operationFilter = 'all';
          syncState();
        });
        layer.querySelector('[data-role="sort-apply"]')?.addEventListener('click', () => {
          close();
          reopenWith({
            onlyLiked: draft.onlyLiked,
            sortBy: draft.sortBy,
            sortDir: draft.sortDir,
            operationFilter: draft.operationFilter
          });
        });
      });
      overlay.querySelector('[data-role="share"]')?.addEventListener('click', () => {
        const selectedIds = getSelectedIds();
        if (!selectedIds.length) return;
        this.sharePropertiesSelectionByIds(selectedIds, { preferNative: true }).catch(() => {
          this.ui?.showNotification?.('Не удалось поделиться подборкой');
        });
      });
      overlay.querySelector('[data-role="cancel-selected"]')?.addEventListener('click', () => {
        setAllSelected(false);
      });
      this.updateAdminObjectsSelectionState(overlay);
    }
    if (safeSection === 'wishlist') {
      const getRows = () => Array.from(overlay.querySelectorAll('.vw-access-obj-card'));
      const getChecks = () => getRows().map((row) => row.querySelector('[data-role="row-check"]')).filter(Boolean);
      const getSelectedIds = () => getRows()
        .filter((row) => !!row.querySelector('[data-role="row-check"]')?.checked)
        .map((row) => String(row.getAttribute('data-id') || '').trim())
        .filter(Boolean);
      const setAllSelected = (selected) => {
        getChecks().forEach((check) => { check.checked = !!selected; });
        getRows().forEach((row) => row.classList.toggle('is-selected', !!selected));
        this.updateAdminObjectsSelectionState(overlay);
      };
      getRows().forEach((row) => {
        const check = row.querySelector('[data-role="row-check"]');
        const checkWrap = row.querySelector('[data-role="row-check-wrap"]');
        const sync = () => {
          const selected = !!check?.checked;
          row.classList.toggle('is-selected', selected);
          this.updateAdminObjectsSelectionState(overlay);
        };
        check?.addEventListener('change', sync);
        checkWrap?.addEventListener('click', (event) => event.stopPropagation());
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
      overlay.querySelector('[data-role="select-all"]')?.addEventListener('click', () => {
        const checks = getChecks();
        if (!checks.length) return;
        const selectedCount = checks.filter((check) => check.checked).length;
        setAllSelected(selectedCount !== checks.length);
      });
      overlay.querySelector('[data-role="reset-wishlist"]')?.addEventListener('click', () => {
        const ids = this.getWishlistObjectsList().map((item) => String(item?.id || '').trim()).filter(Boolean);
        ids.forEach((id) => this.toggleWishlistSelection(id, false));
        this.syncWishlistButtonsInDom();
        this.updateAccessHeaderButton({ pulse: false });
        this.openAccessSubOverlay('wishlist');
      });
      overlay.querySelector('[data-role="remove-selected"]')?.addEventListener('click', () => {
        const selectedIds = getSelectedIds();
        if (!selectedIds.length) return;
        selectedIds.forEach((id) => this.toggleWishlistSelection(id, false));
        getRows().forEach((row) => {
          const id = String(row.getAttribute('data-id') || '').trim();
          if (selectedIds.includes(id)) row.remove();
        });
        this.syncWishlistButtonsInDom();
        this.updateAccessHeaderButton({ pulse: false });
        this.updateAdminObjectsSelectionState(overlay);
        const remain = getRows().length;
        const totalEl = overlay.querySelector('[data-role="list-total"]');
        if (totalEl) totalEl.textContent = String(remain);
        if (!remain) this.openAccessSubOverlay('wishlist');
      });
      overlay.querySelector('[data-role="share"]')?.addEventListener('click', () => {
        const selectedIds = getSelectedIds();
        if (!selectedIds.length) return;
        this.sharePropertiesSelectionByIds(selectedIds).catch(() => {
          this.ui?.showNotification?.('Не удалось поделиться подборкой');
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
      const normalizeDecimalString = (value, fractionDigits = 2) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        let cleaned = raw.replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
        const firstDot = cleaned.indexOf('.');
        if (firstDot >= 0) {
          cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
        }
        let [intPart = '', fracPart = ''] = cleaned.split('.');
        intPart = intPart.replace(/^0+(?=\d)/, '');
        if (!intPart) intPart = '0';
        fracPart = String(fracPart || '').replace(/[^\d]/g, '').slice(0, Math.max(0, Number(fractionDigits) || 0));
        return fracPart ? `${intPart}.${fracPart}` : intPart;
      };
      const formatAreaLabel = (value) => {
        const normalized = normalizeDecimalString(value, 2);
        if (!normalized) return '';
        const [intPart = '0', fracPart = ''] = normalized.split('.');
        const groupedInt = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const cleanFrac = String(fracPart || '').replace(/0+$/g, '');
        return cleanFrac ? `${groupedInt},${cleanFrac} м²` : `${groupedInt} м²`;
      };
      const steps = { 1: 'Основные параметры', 2: 'Дополнительно', 3: 'Предпросмотр', 4: 'Готово' };
      const draft = { photos: Array(5).fill(''), photoFiles: Array(5).fill(null) };
      const priceInput = overlay.querySelector('[data-role="price"]');
      const areaInput = overlay.querySelector('[data-role="area"]');
      const roomsInput = overlay.querySelector('[data-role="rooms"]');
      const districtInput = overlay.querySelector('[data-role="district"]');
      const titleInput = overlay.querySelector('[data-role="title"]');
      const typeInput = overlay.querySelector('[data-role="property-type"]');
      const reservedIdInput = overlay.querySelector('[data-role="reserved-external-id"]');
      const fileInput = overlay.querySelector('[data-role="photo-input"]');
      const targetInput = overlay.querySelector('[data-role="photo-input-target"]');
      const floorInput = overlay.querySelector('[data-role="floor"]');
      const floorsTotalInput = overlay.querySelector('[data-role="floors-total"]');
      const descriptionInput = overlay.querySelector('[data-role="description"]');
      const photoSlots = Array.from(overlay.querySelectorAll('[data-role="photo-slot"]'));
      const previewCard = overlay.querySelector('[data-role="preview-card"]');
      const previewMainImage = overlay.querySelector('[data-role="preview-main-image"]');
      const previewThumbs = Array.from(overlay.querySelectorAll('[data-role="preview-thumb"]'));
      const previewOp = overlay.querySelector('[data-role="preview-op"]');
      const previewType = overlay.querySelector('[data-role="preview-type"]');
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
      const typeMap = { apartment: 'apartment', house: 'house', commercial: 'commercial', land: 'land' };
      const resetForm = () => {
        overlay.querySelectorAll('input, textarea, select').forEach((el) => {
          if (el.matches('[readonly]')) return;
          if (el.type === 'checkbox') el.checked = false;
          else if (el.tagName === 'SELECT') el.selectedIndex = 0;
          else el.value = '';
        });
        draft.photos = Array(5).fill('');
        draft.photoFiles = Array(5).fill(null);
        photoSlots.forEach((slot) => updateSlot(slot, '', ''));
        clearActiveDialogs();
        setStep(1);
        if (!isEditProperty) {
          (async () => {
            try {
              const nextId = await this.resolveNextManualExternalId();
              if (reservedIdInput) reservedIdInput.value = nextId;
            } catch {}
          })();
        }
        try { updateComplexLabel(); } catch {}
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
        try { updateComplexLabel(); } catch {}
      };
      const hasUnsavedChanges = () => {
        if (draft.photos.some(Boolean)) return true;
        const inputs = Array.from(overlay.querySelectorAll('input, textarea, select'));
        return inputs.some((el) => {
          if (el.matches('[readonly]')) return false;
          if (el.type === 'file') return false;
          if (el.type === 'hidden') {
            const role = String(el.getAttribute('data-role') || '').trim();
            if (role === 'complex') return String(el.value || '').trim().length > 0;
            return false;
          }
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
      let publishAction = null;
      overlay._showAddExitDialog = () => {
        if (!hasUnsavedChanges()) {
          this.closeAccessSubOverlay();
          return;
        }
        if (isEditProperty) {
          showActionDialog({
            title: 'Изменения не опубликованы. Что сделать?',
            buttons: [
              {
                label: 'Опубликовать изменения',
                variant: 'primary',
                onClick: () => {
                  if (typeof publishAction === 'function') publishAction();
                }
              },
              { label: 'Выйти без сохранения', variant: 'danger', onClick: clearDraftAndExit }
            ]
          });
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
        const priceRaw = String(priceInput?.value || '').replace(/\s*USD\s*$/i, '').trim();
        const pickCheck = (name) => !!overlay.querySelector(`.vw-access-add-check-grid input[name="${name}"]`)?.checked;
        const opRaw = String(overlay.querySelector('[data-role="listing-operation"]')?.value || '').trim().toLowerCase();
        return {
          id: String(reservedIdInput?.value || (isEditProperty ? editPropertyId : '') || '').trim() || '—',
          operation: opRaw === 'rent' ? 'rent' : 'sale',
          title: String(titleInput?.value || '').trim(),
          district: String(districtInput?.value || '').trim() || '—',
          price: priceRaw || '0',
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
      const buildEditDraftFromProperty = (property) => {
        if (!property || typeof property !== 'object') return null;
        const parseMaybeJson = (value) => {
          if (value && typeof value === 'object') return value;
          const raw = String(value || '').trim();
          if (!raw) return {};
          try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
          } catch {
            return {};
          }
        };
        const parsePrice = () => {
          const fromPrice = Number(property.price);
          const fromUsd = Number(property.priceUSD ?? property.price_usd ?? property.priceUsd);
          const fromAmount = Number(property.price_amount);
          const fromLegacy = Number(property.priceEUR);
          const value = [fromPrice, fromUsd, fromAmount, fromLegacy].find((n) => Number.isFinite(n) && n > 0);
          return Number.isFinite(value) ? String(Math.round(value)) : '';
        };
          const parseArea = () => {
          const n = Number(property.area_m2 ?? property.area ?? property.specs_area_m2);
          if (!Number.isFinite(n) || n <= 0) return '';
          const rounded = Math.round(n * 100) / 100;
          return String(rounded).replace(/\.0+$/g, '').replace(/(\.\d*[1-9])0+$/g, '$1');
        };
        const parseRooms = () => {
          const n = Number(property.rooms ?? property.specs_rooms);
          if (!Number.isFinite(n) || n <= 0) return '';
          if (n >= 5) return '5+';
          return String(Math.round(n));
        };
        const parseFloor = () => {
          const n = Number(property.floor ?? property.specs_floor);
          return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
        };
        const parseFloorsTotal = () => {
          const n = Number(property.building_floors);
          return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
        };
        const features = parseMaybeJson(property.features);
        const op = String(property.operation || '').trim().toLowerCase();
        return {
          step: 1,
          values: {
            'property-type': String(property.property_type || property.propertyType || '').trim() || 'apartment',
            'listing-operation': op === 'rent' ? 'rent' : (op === 'sale' ? 'sale' : ''),
            'reserved-external-id': String(property.external_id || property.externalId || property.id || editPropertyId || '').trim(),
            title: String(property.title || property.description || '').trim(),
            price: parsePrice(),
            rooms: parseRooms(),
            area: parseArea(),
            district: String(property.district || property.location_district || '').trim(),
            floor: parseFloor(),
            'floors-total': parseFloorsTotal(),
            complex: String(features.complex || '').trim(),
            microdistrict: String(property.neighborhood || property.location_neighborhood || '').trim(),
            description: String(property.description || '').trim()
          },
          checks: {
            exclusive: !!features.exclusive,
            balcony: !!(features.balcony ?? property.balcony),
            penthouse: !!features.penthouse,
            loggia: !!features.loggia,
            smartFlat: !!features.smartFlat,
            terrace: !!(features.terrace ?? property.terrace),
            newbuilding: !!features.newbuilding,
            parking: !!features.parking
          },
          photos: Array.isArray(property.images) ? property.images.slice(0, 5) : [],
          photoFiles: []
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
        const opLabelMap = { sale: 'Продажа', rent: 'Аренда' };
        const typeLabelMap = {
          apartment: 'Квартира',
          house: 'Дом',
          commercial: 'Коммерция',
          land: 'Участок'
        };
        const fmtPrice = `${String(data.price || '0').replace(/[^\d]/g, '') || '0'}`
          .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const imageList = data.photos.length ? data.photos : [''];
        if (previewOp) previewOp.textContent = opLabelMap[data.operation] || 'Продажа';
        if (previewType) previewType.textContent = typeLabelMap[data.type] || 'Квартира';
        const previewHeadline = String(titleInput?.value || '').trim() || '—';
        overlay.querySelector('[data-role="preview-title"]') && (overlay.querySelector('[data-role="preview-title"]').textContent = previewHeadline);
        overlay.querySelector('[data-role="preview-price"]') && (overlay.querySelector('[data-role="preview-price"]').textContent = `${fmtPrice} USD`);
        const districtMeta = [String(data.district || '').trim(), String(data.microdistrict || '').trim()].filter(Boolean);
        overlay.querySelector('[data-role="preview-district"]') && (overlay.querySelector('[data-role="preview-district"]').textContent = districtMeta.length ? districtMeta.join(' · ') : '—');
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
        if (previewCard) previewCard.setAttribute('data-side', 'front');
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
          const stripPriceSuffix = (el) => {
            el.value = String(el.value || '').replace(/\s*USD\s*$/i, '').trim();
          };
          const applyPriceFormatting = (el) => {
            const raw = String(el.value || '').replace(/\s*USD\s*$/i, '').trim();
            if (!raw) {
              el.value = '';
              return true;
            }
            if (/[^\d\s,.\u00A0]/.test(raw)) {
              setFieldError(el, 'Введите цифры');
              return false;
            }
            const digits = raw.replace(/[^\d]/g, '');
            if (!digits) {
              setFieldError(el, 'Введите цифры');
              return false;
            }
            el.value = `${formatThousands(digits)} USD`;
            return true;
          };
          attachInlineFieldActions(fieldEl, {
            onInput: (el) => {
              el.value = String(el.value || '').replace(/\s*USD\s*$/i, '');
            },
            onApply: (el) => applyPriceFormatting(el)
          });
          fieldEl.addEventListener('focus', () => {
            stripPriceSuffix(fieldEl);
          });
          fieldEl.addEventListener('blur', () => {
            const raw = String(fieldEl.value || '').replace(/\s*USD\s*$/i, '').trim();
            if (!raw) return;
            applyPriceFormatting(fieldEl);
          });
          return;
        }
        if (fieldEl === areaInput) {
          attachInlineFieldActions(fieldEl, {
            onInput: (el) => {
              el.value = String(el.value || '')
                .replace(/\s*м²$/i, '')
                .replace(/[^\d\s,.\u00A0]/g, '');
            },
            onApply: (el) => {
              const raw = String(el.value || '').replace(/\s*м²$/i, '').trim();
              if (!raw) return true;
              if (/[^\d\s,.\u00A0]/.test(raw)) {
                setFieldError(el, 'Введите цифры');
                return false;
              }
              const normalized = normalizeDecimalString(raw, 2);
              if (!normalized || Number(normalized) <= 0) {
                setFieldError(el, 'Введите цифры');
                return false;
              }
              el.value = formatAreaLabel(normalized);
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
      const complexHidden = overlay.querySelector('[data-role="complex"]');
      const complexTrigger = overlay.querySelector('[data-role="complex-trigger"]');
      const complexLabelEl = overlay.querySelector('[data-role="complex-trigger-label"]');
      const updateComplexLabel = () => {
        if (!complexLabelEl || !complexHidden) return;
        const v = String(complexHidden.value || '').trim();
        complexLabelEl.textContent = v || 'Название ЖК';
        complexLabelEl.style.opacity = v ? '1' : '';
      };
      const ensureRcPickerStyles = () => {
        try { this.ensureResidentialComplexPickerStyles(); } catch {}
      };
      let rcSearchTimer = null;
      const closeRcLayer = (layer) => {
        if (!layer) return;
        layer.querySelector('.vw-access-rc-panel')?.classList.remove('is-rc-add-open');
        layer.classList.remove('is-open');
        if (complexTrigger) complexTrigger.setAttribute('aria-expanded', 'false');
      };
      const openRcPicker = () => {
        ensureRcPickerStyles();
        const syncRcLayerKbInsetFor = (lyr) => {
          try {
            const vv = window.visualViewport;
            const inset = !vv ? 0 : Math.max(0, (window.innerHeight || 0) - (vv.height + vv.offsetTop));
            lyr.style.setProperty('--vw-rc-kb-inset', `${inset}px`);
          } catch {
            try { lyr.style.removeProperty('--vw-rc-kb-inset'); } catch {}
          }
        };
        let layer = overlay.querySelector('[data-role="rc-layer"]');
        if (!layer) {
          layer = document.createElement('div');
          layer.className = 'vw-access-rc-layer';
          layer.setAttribute('data-role', 'rc-layer');
          layer.innerHTML = `
            <div class="vw-access-rc-panel" role="dialog" aria-modal="true" aria-label="Выбор ЖК">
              <div class="vw-access-rc-head">
                <div class="vw-access-rc-title">Жилой комплекс</div>
                <button type="button" class="vw-access-rc-close" data-role="rc-close" aria-label="Закрыть">×</button>
              </div>
              <div class="vw-access-rc-search-wrap">
                <input type="search" class="vw-access-add-input" data-role="rc-search" placeholder="Поиск по ЖК" enterkeyhint="search" autocomplete="off">
                <span class="vw-access-rc-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
                </span>
              </div>
              <div class="vw-access-rc-list" data-role="rc-list" role="listbox"></div>
              <div class="vw-access-rc-add-wrap" data-role="rc-add-wrap">
                <div class="vw-access-rc-footer" data-role="rc-footer-list">
                  <span class="vw-access-rc-footer-hint">Нет в списке?</span>
                  <button type="button" class="vw-access-rc-add-btn" data-role="rc-add-open">
                    <span class="vw-access-rc-add-btn__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 7v10M7 12h10"></path></svg>
                    </span>
                    Добавить
                  </button>
                </div>
                <div class="vw-access-rc-add-panel" data-role="rc-add-panel" hidden>
                  <div class="vw-access-rc-add-inline" data-role="rc-add-inline">
                    <input type="text" class="vw-access-add-input" data-role="rc-add-input" placeholder="Введите название ЖК" maxlength="200" autocomplete="off">
                    <button type="button" class="vw-access-rc-add-confirm" data-role="rc-add-confirm" aria-label="Подтвердить">✓</button>
                  </div>
                  <div class="vw-access-rc-add-actions">
                    <button type="button" class="vw-access-sub-btn" data-role="rc-add-cancel">Отмена</button>
                    <button type="button" class="vw-access-sub-btn vw-access-sub-btn--primary" data-role="rc-add-save">Сохранить</button>
                  </div>
                </div>
              </div>
            </div>`;
          overlay.appendChild(layer);
          const onRcVvChange = () => syncRcLayerKbInsetFor(layer);
          const vvRc = window.visualViewport;
          if (vvRc) {
            vvRc.addEventListener('resize', onRcVvChange);
            vvRc.addEventListener('scroll', onRcVvChange);
            layer._vwRcVvCleanup = () => {
              try {
                vvRc.removeEventListener('resize', onRcVvChange);
                vvRc.removeEventListener('scroll', onRcVvChange);
              } catch {}
              try { layer.style.removeProperty('--vw-rc-kb-inset'); } catch {}
            };
          }
          const stop = (e) => e.stopPropagation();
          layer.querySelector('.vw-access-rc-panel')?.addEventListener('click', stop);
          layer.addEventListener('click', () => closeRcLayer(layer));
          layer.querySelector('[data-role="rc-close"]')?.addEventListener('click', () => closeRcLayer(layer));
          const listEl = layer.querySelector('[data-role="rc-list"]');
          const searchEl = layer.querySelector('[data-role="rc-search"]');
          const footerList = layer.querySelector('[data-role="rc-footer-list"]');
          const addPanel = layer.querySelector('[data-role="rc-add-panel"]');
          const addInput = layer.querySelector('[data-role="rc-add-input"]');
          const addInline = layer.querySelector('[data-role="rc-add-inline"]');
          const bindRow = (name) => {
            if (!complexHidden) return;
            complexHidden.value = String(name || '').trim();
            updateComplexLabel();
            closeRcLayer(layer);
            try { complexTrigger?.focus?.(); } catch {}
          };
          const renderList = (items) => {
            if (!listEl) return;
            const arr = Array.isArray(items) ? items : [];
            if (!arr.length) {
              listEl.innerHTML = '<div class="vw-access-rc-empty" data-role="rc-empty">Список пуст</div>';
              return;
            }
            listEl.innerHTML = arr.map((row) => {
              const id = String(row?.id ?? '').trim();
              const nameRaw = String(row?.name || '');
              const nameHtml = nameRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
              return (
                '<div class="vw-access-rc-row-wrap" role="presentation">' +
                `<button type="button" class="vw-access-rc-row--main" data-rc-id="${id.replace(/"/g, '&quot;')}">${nameHtml}</button>` +
                `<button type="button" class="vw-access-rc-row-delete" data-rc-id="${id.replace(/"/g, '&quot;')}" aria-label="Удалить из справочника">удалить</button>` +
                '</div>'
              );
            }).join('');
            listEl.querySelectorAll('.vw-access-rc-row--main').forEach((btn) => {
              btn.addEventListener('click', () => bindRow(btn.textContent));
            });
            listEl.querySelectorAll('.vw-access-rc-row-delete').forEach((delBtn) => {
              delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rid = String(delBtn.getAttribute('data-rc-id') || '').trim();
                const row = arr.find((r) => String(r?.id ?? '') === rid);
                const nm = String(row?.name || delBtn.closest('.vw-access-rc-row-wrap')?.querySelector('.vw-access-rc-row--main')?.textContent || '').trim();
                if (!rid) return;
                if (!window.confirm(`Удалить «${nm || 'этот ЖК'}» из справочника?`)) return;
                try {
                  await this.api?.deleteResidentialComplex?.(rid);
                  const cur = String(complexHidden?.value || '').trim();
                  if (cur && nm && cur === nm) {
                    if (complexHidden) complexHidden.value = '';
                    updateComplexLabel();
                  }
                  this.ui?.showNotification?.('ЖК удалён из списка');
                  await loadList(String(searchEl?.value || '').trim());
                } catch (err) {
                  console.warn('rc.delete', err);
                  this.ui?.showNotification?.('Не удалось удалить ЖК');
                }
              });
            });
          };
          const loadList = async (q = '') => {
            try {
              const list = await this.api?.fetchResidentialComplexes?.({ q, limit: 80 });
              renderList(list);
            } catch (err) {
              console.warn('rc.list', err);
              if (listEl) {
                listEl.innerHTML = '<div class="vw-access-rc-empty">Не удалось загрузить список</div>';
              }
            }
          };
          const resetAddForm = () => {
            layer._vwConfirmedRcName = '';
            if (addInline) addInline.classList.remove('is-confirmed');
            if (addInput) addInput.value = '';
          };
          const exitAddMode = () => {
            layer.querySelector('.vw-access-rc-panel')?.classList.remove('is-rc-add-open');
            if (addPanel) addPanel.hidden = true;
            if (footerList) footerList.hidden = false;
            resetAddForm();
          };
          searchEl?.addEventListener('input', () => {
            clearTimeout(rcSearchTimer);
            rcSearchTimer = setTimeout(() => {
              loadList(String(searchEl.value || '').trim());
            }, 280);
          });
          addInput?.addEventListener('input', () => {
            layer._vwConfirmedRcName = '';
            if (addInline) addInline.classList.remove('is-confirmed');
          });
          layer.querySelector('[data-role="rc-add-open"]')?.addEventListener('click', () => {
            layer.querySelector('.vw-access-rc-panel')?.classList.add('is-rc-add-open');
            if (addPanel) addPanel.hidden = false;
            if (footerList) footerList.hidden = true;
            resetAddForm();
            if (addInput) {
              addInput.value = String(searchEl?.value || '').trim();
              try { addInput.focus(); } catch {}
            }
          });
          layer.querySelector('[data-role="rc-add-confirm"]')?.addEventListener('click', () => {
            const raw = String(addInput?.value || '').trim();
            if (!raw) {
              this.ui?.showNotification?.('Введите название ЖК');
              return;
            }
            layer._vwConfirmedRcName = raw;
            if (addInline) addInline.classList.add('is-confirmed');
            try { addInput?.blur(); } catch {}
          });
          layer.querySelector('[data-role="rc-add-cancel"]')?.addEventListener('click', () => {
            exitAddMode();
          });
          layer.querySelector('[data-role="rc-add-save"]')?.addEventListener('click', async () => {
            const raw = String(layer._vwConfirmedRcName || '').trim();
            if (!raw) {
              const draft = String(addInput?.value || '').trim();
              if (!draft) this.ui?.showNotification?.('Введите название ЖК');
              else this.ui?.showNotification?.('Подтвердите название галочкой');
              return;
            }
            try {
              const data = await this.api?.createResidentialComplex?.(raw);
              const item = data?.item;
              if (item?.name) bindRow(item.name);
              else {
                await loadList(String(searchEl?.value || '').trim());
                bindRow(raw);
              }
              exitAddMode();
              this.ui?.showNotification?.('ЖК добавлен');
            } catch (err) {
              console.warn('rc.create', err);
              this.ui?.showNotification?.('Не удалось добавить ЖК');
            }
          });
          overlay._rcLoadList = loadList;
        }
        const layerRef = overlay.querySelector('[data-role="rc-layer"]');
        if (layerRef) {
          layerRef._vwConfirmedRcName = '';
          const ap = layerRef.querySelector('[data-role="rc-add-panel"]');
          const fl = layerRef.querySelector('[data-role="rc-footer-list"]');
          const il = layerRef.querySelector('[data-role="rc-add-inline"]');
          const inp = layerRef.querySelector('[data-role="rc-add-input"]');
          layerRef.querySelector('.vw-access-rc-panel')?.classList.remove('is-rc-add-open');
          if (ap) ap.hidden = true;
          if (fl) fl.hidden = false;
          if (il) il.classList.remove('is-confirmed');
          if (inp) inp.value = '';
          layerRef.classList.add('is-open');
          syncRcLayerKbInsetFor(layerRef);
          if (complexTrigger) complexTrigger.setAttribute('aria-expanded', 'true');
          const se = layerRef.querySelector('[data-role="rc-search"]');
          if (se) se.value = '';
          overlay._rcLoadList?.('');
          setTimeout(() => {
            try { se?.focus?.(); } catch {}
          }, 50);
        }
      };
      complexTrigger?.addEventListener('click', () => openRcPicker());
      updateComplexLabel();
      const _prevAddPropertyCleanup = overlay._cleanupAddPropertyOverlay;
      overlay._cleanupAddPropertyOverlay = () => {
        try { clearTimeout(rcSearchTimer); rcSearchTimer = null; } catch {}
        try {
          const rcL = overlay.querySelector('[data-role="rc-layer"]');
          rcL?._vwRcVvCleanup?.();
        } catch {}
        try { overlay.querySelector('[data-role="rc-layer"]')?.remove(); } catch {}
        try { delete overlay._rcLoadList; } catch {}
        try { _prevAddPropertyCleanup?.(); } catch {}
      };
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
      const applyAutoNextId = async () => {
        if (isEditProperty) return;
        try {
          const nextId = await this.resolveNextManualExternalId();
          if (reservedIdInput) reservedIdInput.value = nextId;
        } catch {}
      };
      let editTouched = false;
      const markEditTouched = () => { editTouched = true; };
      overlay.addEventListener('input', markEditTouched, true);
      overlay.addEventListener('change', markEditTouched, true);
      if (isEditProperty) {
        overlay.querySelectorAll('[data-role="add-draft"]').forEach((btn) => {
          btn.style.display = 'none';
        });
        overlay.querySelectorAll('[data-role="add-exit"]').forEach((btn) => {
          btn.style.display = '';
        });
        try {
          const fallbackDraft = buildEditDraftFromProperty(editSourceProperty);
          if (fallbackDraft) applyDraftState(fallbackDraft);
        } catch {}
        (async () => {
          try {
            const response = await this.api?.fetchManualPropertyById?.(editPropertyId);
            const fullProperty = response?.property && typeof response.property === 'object'
              ? response.property
              : null;
            if (!fullProperty || editTouched) return;
            const fullDraft = buildEditDraftFromProperty(fullProperty);
            if (fullDraft) applyDraftState(fullDraft);
          } catch {}
        })();
      } else {
        try { applyDraftState(this._addPropertyDraft); } catch {}
        if (!this._addPropertyDraft) {
          applyAutoNextId();
        }
      }
      const promotePhotoToPrimary = (index) => {
        if (!Number.isFinite(index) || index < 0 || index >= draft.photos.length) return false;
        if (!draft.photos[index]) return false;
        if (index === 0) {
          renderPreview();
          return true;
        }
        const selectedPhoto = draft.photos[index];
        const selectedFile = draft.photoFiles[index];
        draft.photos.splice(index, 1);
        draft.photos.unshift(selectedPhoto);
        draft.photos = draft.photos.slice(0, 5);
        while (draft.photos.length < 5) draft.photos.push('');
        draft.photoFiles.splice(index, 1);
        draft.photoFiles.unshift(selectedFile || null);
        draft.photoFiles = draft.photoFiles.slice(0, 5);
        while (draft.photoFiles.length < 5) draft.photoFiles.push(null);
        photoSlots.forEach((node, idx) => {
          const src = draft.photos[idx] || '';
          updateSlot(node, src ? `photo_${idx + 1}` : '', src);
        });
        renderPreview();
        return true;
      };
      photoSlots.forEach((slot) => {
        slot.addEventListener('click', () => {
          if (!fileInput || !targetInput) return;
          const index = Number(slot.getAttribute('data-slot') || '-1');
          if (!Number.isFinite(index) || index < 0) return;
          if (draft.photos[index]) return void promotePhotoToPrimary(index);
          targetInput.value = String(index);
          fileInput.click();
        });
      });
      fileInput?.addEventListener('change', () => {
        const index = Number(targetInput?.value || '-1');
        const file = fileInput?.files?.[0];
        if (!Number.isFinite(index) || index < 0 || !file) return;
        const fileSizeMb = Number(file.size || 0) / (1024 * 1024);
        const warnLimitMb = 5;
        if (fileSizeMb > warnLimitMb) {
          const readableSize = fileSizeMb.toFixed(2);
          const proceed = window.confirm(
            `Фото "${file.name}" весит ${readableSize} MB.\nЭто больше рекомендуемых ${warnLimitMb} MB.\n\nПродолжить и добавить фото?`
          );
          if (!proceed) {
            fileInput.value = '';
            return;
          }
          this.ui?.showNotification?.(`⚠️ Добавлено большое фото: ${readableSize}MB`);
        }
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
          promotePhotoToPrimary(idx);
        });
      });
      overlay.querySelector('[data-role="add-to-step-2"]')?.addEventListener('click', () => {
        setStep(2);
      });
      overlay.querySelectorAll('[data-role="add-draft"]').forEach((btn) => {
        btn.addEventListener('click', () => saveDraftAndExit());
      });
      overlay.querySelectorAll('[data-role="add-exit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (typeof overlay._showAddExitDialog === 'function') {
            overlay._showAddExitDialog();
            return;
          }
          this.closeAccessSubOverlay();
        });
      });
      overlay.querySelector('[data-role="add-preview"]')?.addEventListener('click', () => {
        renderPreview();
        setStep(3);
      });
      overlay.querySelector('[data-role="add-reset-head"]')?.addEventListener('click', () => showResetDialog());
      const publish = async () => {
        const publishBtn = overlay.querySelector('[data-role="add-publish-final"]');
        const originalLabel = publishBtn?.textContent || (isEditProperty ? 'Опубликовать изменения' : 'Опубликовать');
        try {
          if (publishBtn) {
            publishBtn.disabled = true;
            publishBtn.textContent = isEditProperty ? 'Сохраняем...' : 'Публикуем...';
          }
          const data = getDraftData();
          const existingImages = (Array.isArray(data.photos) ? data.photos : [])
            .filter((src) => /^https?:\/\//i.test(String(src || '')));
          const payload = {
            mode: 'publish',
            operation: data.operation,
            title: data.title,
            description: data.description,
            propertyType: data.type,
            district: data.district === '—' ? '' : data.district,
            microdistrict: data.microdistrict,
            complex: data.complex,
            price: String(data.price || '').replace(/[^\d]/g, ''),
            rooms: data.rooms,
            area: normalizeDecimalString(String(data.area || '').replace(/\s*м²$/i, ''), 2),
            floor: data.floor,
            floorsTotal: data.floorsTotal,
            existingImages,
            ...data.checks
          };
          const response = isEditProperty
            ? await this.api?.updateManualProperty?.(String(editPropertyId || data.id || '').trim(), payload, data.photoFiles)
            : await this.api?.createManualProperty?.(payload, data.photoFiles);
          const saved = response?.property;
          if (saved) {
            this.mergePropertiesToCatalog([saved]);
            try {
              const all = await this.loadAllProperties();
              if (Array.isArray(all) && all.length) this.replacePropertiesCatalog(all);
            } catch {}
          }
          this._addPropertyDraft = null;
          clearActiveDialogs();
          setStep(4);
          this.ui?.showNotification?.(isEditProperty ? 'Изменения опубликованы' : 'Объект опубликован');
        } catch (error) {
          const msg = String(error?.message || '');
          const imageTooLargeMatch = msg.match(/IMAGE_TOO_LARGE_MAX_(\d+)MB/i);
          const maxImageMb = imageTooLargeMatch?.[1] ? Number(imageTooLargeMatch[1]) : null;
          const hint = msg.includes('FORBIDDEN_ADMIN_ONLY')
            ? 'Нет прав администратора для публикации'
            : (imageTooLargeMatch
              ? `Фото > ${Number.isFinite(maxImageMb) ? maxImageMb : 5}MB. Уменьшите размер`
              : (msg.includes('_413')
                ? 'Слишком большой общий размер загрузки. Уменьшите количество/размер фото'
                : 'Не удалось опубликовать объект'
              )
            );
          this.ui?.showNotification?.(hint);
        } finally {
          if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.textContent = originalLabel;
          }
        }
      };
      publishAction = publish;
      overlay.querySelector('[data-role="add-publish-final"]')?.addEventListener('click', () => {
        if (typeof publishAction === 'function') publishAction();
      });
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

  ensureResidentialComplexPickerStyles() {
    let st = document.getElementById('vw-rc-picker-styles');
    if (!st) {
      st = document.createElement('style');
      st.id = 'vw-rc-picker-styles';
      document.head.appendChild(st);
    }
    st.textContent = `
          .vw-access-add-complex-trigger {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            margin: 0;
            cursor: pointer;
            text-align: left;
            font: inherit;
            color: var(--text-primary, #fff);
            -webkit-tap-highlight-color: transparent;
          }
          .vw-access-add-complex-trigger__label {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .vw-access-rc-layer {
            position: fixed;
            inset: 0;
            z-index: 1420;
            background: rgba(0,0,0,0.56);
            display: none;
            place-items: end center;
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom, 0);
          }
          .vw-access-rc-layer.is-open {
            display: grid;
          }
          .vw-access-rc-panel {
            width: min(100%, 440px);
            max-height: min(85vh, 520px);
            max-height: min(85dvh, 520px);
            border-radius: 16px 16px 0 0;
            border: 1px solid var(--border-light, rgba(255,255,255,0.14));
            border-bottom: none;
            background: color-mix(in srgb, var(--bg-card, #1e1d20) 94%, transparent);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: grid;
            grid-template-rows: auto auto minmax(0, 1fr) auto;
            gap: 12px;
            padding: 14px 14px calc(20px + var(--vw-rc-kb-inset, 0px));
            box-sizing: border-box;
            overflow: hidden;
            min-height: 0;
          }
          .vw-access-rc-panel.is-rc-add-open {
            max-height: min(92vh, 720px);
            max-height: min(92dvh, 720px);
          }
          .vw-access-rc-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
          }
          .vw-access-rc-title {
            font-size: .9rem;
            font-weight: 600;
            color: var(--text-secondary, rgba(255,255,255,0.78));
          }
          .vw-access-rc-close {
            min-width: 36px;
            min-height: 36px;
            border-radius: 10px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.14));
            background: var(--bg-element, rgba(255,255,255,0.12));
            color: var(--text-primary, #fff);
            font-size: 1.1rem;
            line-height: 1;
            cursor: pointer;
          }
          .vw-access-rc-list {
            min-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            border-radius: 12px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.12));
            background: var(--bg-element, rgba(255,255,255,0.06));
          }
          .vw-access-rc-row-wrap {
            display: flex;
            align-items: stretch;
            gap: 8px;
            border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.08));
          }
          .vw-access-rc-row-wrap:last-child {
            border-bottom: none;
          }
          .vw-access-rc-row--main {
            flex: 1;
            min-width: 0;
            text-align: left;
            padding: 12px 4px 12px 14px;
            border: 0;
            background: transparent;
            color: var(--text-primary, #fff);
            font: inherit;
            font-size: .95rem;
            cursor: pointer;
          }
          .vw-access-rc-row--main:active {
            background: rgba(92, 150, 255, 0.12);
          }
          .vw-access-rc-row-delete {
            flex: 0 0 auto;
            align-self: center;
            margin-right: 10px;
            padding: 6px 10px;
            border-radius: 8px;
            border: 1px solid rgba(220, 100, 100, 0.45);
            background: rgba(180, 45, 45, 0.35);
            color: #ffb4b4;
            font: inherit;
            font-size: .78rem;
            font-weight: 600;
            letter-spacing: .02em;
            cursor: pointer;
            white-space: nowrap;
          }
          .vw-access-rc-row-delete:active {
            background: rgba(200, 55, 55, 0.5);
          }
          .vw-access-rc-empty {
            padding: 14px;
            font-size: .88rem;
            color: var(--text-secondary, rgba(255,255,255,0.65));
            text-align: center;
          }
          .vw-access-rc-add-block {
            display: grid;
            gap: 10px;
          }
          .vw-access-rc-add-wrap {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .vw-access-rc-add-panel {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .vw-access-rc-panel [data-role="rc-add-panel"][hidden] {
            display: none;
          }
          .vw-access-rc-panel .vw-access-rc-footer[data-role="rc-footer-list"][hidden] {
            display: none;
          }
          .vw-access-rc-add-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .vw-access-rc-panel .vw-access-add-input {
            width: 100%;
            min-height: 36px;
            box-sizing: border-box;
            border-radius: 6px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.16));
            background: var(--bg-element, rgba(255,255,255,0.08));
            color: var(--text-primary, #fff);
            padding: 0 12px;
            font-size: .75rem;
          }
          .vw-access-rc-panel .vw-access-add-input::placeholder {
            color: var(--text-secondary, rgba(255,255,255,0.56));
          }
          .vw-access-rc-panel .vw-access-sub-btn {
            min-height: 34px;
            border-radius: 6px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.14));
            background: var(--bg-element, rgba(255,255,255,0.12));
            color: var(--text-primary, #fff);
            padding: 0 12px;
            font-size: .75rem;
            cursor: pointer;
          }
          .vw-access-rc-panel .vw-access-sub-btn--primary {
            border-color: rgba(45, 143, 225, 0.65);
            background: linear-gradient(180deg, rgba(45,143,225,0.32), rgba(36,129,204,0.26));
          }
          .vw-access-rc-search-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            box-sizing: border-box;
            min-height: 36px;
            padding: 0 10px 0 12px;
            border-radius: 10px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.16));
            background: var(--bg-element, rgba(255,255,255,0.08));
          }
          .vw-access-rc-search-wrap .vw-access-add-input {
            flex: 1;
            min-width: 0;
            border: 0;
            background: transparent;
            padding: 0;
            min-height: 32px;
            box-shadow: none;
          }
          .vw-access-rc-search-wrap .vw-access-add-input:focus {
            outline: none;
          }
          .vw-access-rc-search-wrap:focus-within {
            border-color: rgba(92, 150, 255, 0.55);
          }
          .vw-access-rc-search-icon {
            flex-shrink: 0;
            width: 18px;
            height: 18px;
            opacity: 0.55;
            color: var(--text-secondary, rgba(255,255,255,0.65));
          }
          .vw-access-rc-search-icon svg {
            display: block;
            width: 100%;
            height: 100%;
          }
          .vw-access-rc-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding-top: 4px;
          }
          .vw-access-rc-footer-hint {
            font-size: .8rem;
            color: var(--text-secondary, rgba(255,255,255,0.72));
          }
          .vw-access-rc-add-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 34px;
            padding: 0 14px;
            border-radius: 10px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.14));
            background: var(--bg-element, rgba(255,255,255,0.12));
            color: var(--text-primary, #fff);
            font: inherit;
            font-size: .8rem;
            font-weight: 600;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .vw-access-rc-add-btn__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.35);
          }
          .vw-access-rc-add-btn__icon svg {
            width: 12px;
            height: 12px;
            display: block;
          }
          .vw-access-rc-add-inline {
            display: flex;
            align-items: stretch;
            gap: 10px;
          }
          .vw-access-rc-add-inline .vw-access-add-input {
            flex: 1;
            min-width: 0;
          }
          .vw-access-rc-add-confirm {
            flex: 0 0 40px;
            min-height: 36px;
            border-radius: 10px;
            border: 1px solid var(--border-light, rgba(255,255,255,0.14));
            background: var(--bg-element, rgba(255,255,255,0.12));
            color: var(--color-accent, #7eb8ff);
            font-size: 1.1rem;
            line-height: 1;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
          .vw-access-rc-add-inline.is-confirmed .vw-access-add-input {
            border-color: rgba(92, 150, 255, 0.55);
          }
          .vw-access-rc-panel .vw-access-rc-add-actions {
            justify-content: center;
            align-items: center;
            flex-wrap: nowrap;
            gap: 16px;
          }
        `;
  }

  closeFiltersOverlay() {
    try {
      const overlay = this.getRoot().querySelector('#vwFiltersOverlay');
      try { overlay?._filtersRcCleanup?.(); } catch {}
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
      if (type === 'priceMin') opts.push({ value: '', label: 'От min' });
      if (type === 'priceMax') opts.push({ value: 'max', label: 'До max' });
      for (let v = 0; v <= 1000000; v += 1000) {
        opts.push({ value: String(v), label: this.formatPickerNumber(v) });
      }
      return opts;
    }
    if (type === 'areaMin' || type === 'areaMax') {
      if (type === 'areaMin') opts.push({ value: '', label: 'От min' });
      if (type === 'areaMax') opts.push({ value: 'max', label: 'До max' });
      for (let v = 0; v <= 350; v += 1) {
        opts.push({ value: String(v), label: `${v} м²` });
      }
      return opts;
    }
    if (type === 'floorMin' || type === 'floorMax') {
      if (type === 'floorMin') {
        opts.push({ value: '', label: 'От max' });
        opts.push({ value: 'not_first', label: 'Не первый' });
      }
      if (type === 'floorMax') {
        opts.push({ value: 'max', label: 'До max' });
        opts.push({ value: 'not_last', label: 'Не последний' });
      }
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

  syncFiltersSelectAllLabels(overlay) {
    if (!overlay) return;
    ['propertyType', 'district', 'rooms'].forEach((role) => {
      const selectEl = overlay.querySelector(`[data-role="${role}"]`);
      if (!selectEl) return;
      const allOption = Array.from(selectEl.options || []).find((opt) => String(opt.value || '').trim() === 'all');
      if (!allOption) return;
      allOption.textContent = String(selectEl.value || '').trim() === 'all' ? 'Выбрано всё' : 'Выбрать всё';
    });
  }

  normalizeFilterRangePair(overlay, base, changed = '') {
    const minSel = overlay.querySelector(`select[data-picker="${base}Min"]`);
    const maxSel = overlay.querySelector(`select[data-picker="${base}Max"]`);
    if (!minSel || !maxSel) return;
    const minVal = minSel.value;
    const maxVal = maxSel.value;
    if (base === 'floor' && (minVal === 'not_first' || maxVal === 'not_last')) return;
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
    const listingMode = String(overlay.querySelector('[data-role="listingMode"].is-active')?.getAttribute('data-value') || '')
      .toLowerCase();
    const normalizeSelectVal = (role) => {
      const val = String(overlay.querySelector(`[data-role="${role}"]`)?.value || '').trim();
      return val === 'all' ? '' : val;
    };
    const roomsVal = normalizeSelectVal('rooms');
    const smartRoom = roomsVal === 'smart';
    const floorFromRaw = read('floorMin');
    const floorToRaw = read('floorMax');
    const floorNotFirst = floorFromRaw === 'not_first';
    const floorNotLast = floorToRaw === 'not_last';
    return {
      listingMode: (listingMode === 'sale' || listingMode === 'rent') ? listingMode : '',
      propertyType: normalizeSelectVal('propertyType'),
      priceFrom: read('priceMin'),
      priceTo: read('priceMax'),
      areaFrom: read('areaMin'),
      areaTo: read('areaMax'),
      floorFrom: floorNotFirst ? '' : floorFromRaw,
      floorTo: floorNotLast ? 'max' : floorToRaw,
      floorNotFirst,
      floorNotLast,
      rooms: smartRoom ? '' : roomsVal,
      smart: smartRoom,
      district: normalizeSelectVal('district'),
      arcadia: !!overlay.querySelector('[data-role="arcadia"]')?.checked,
      exclusive: !!overlay.querySelector('[data-role="exclusive"]')?.checked,
      center: !!overlay.querySelector('[data-role="center"]')?.checked,
      parking: !!overlay.querySelector('[data-role="parking"]')?.checked,
      balconyLoggia: !!overlay.querySelector('[data-role="balconyLoggia"]')?.checked,
      residentialComplexOnly: !!overlay.querySelector('[data-role="rcOnly"]')?.checked,
      residentialComplex: String(overlay.querySelector('[data-role="filters-rc-hidden"]')?.value || '').trim()
    };
  }

  applyFiltersOverlayPayload(overlay, payload = {}) {
    if (!overlay || !payload || typeof payload !== 'object') return;
    const setPicker = (picker, value) => {
      const selectEl = overlay.querySelector(`select[data-picker="${picker}"]`);
      if (!selectEl) return;
      const safe = String(value || '').trim();
      if (!safe) return;
      const hasOption = Array.from(selectEl.options || []).some((opt) => String(opt.value) === safe);
      if (!hasOption) {
        const opt = document.createElement('option');
        opt.value = safe;
        opt.textContent = safe;
        selectEl.appendChild(opt);
      }
      selectEl.value = safe;
    };
    const setSelect = (role, value) => {
      const selectEl = overlay.querySelector(`[data-role="${role}"]`);
      if (!selectEl) return;
      const safe = String(value || '').trim();
      if (!safe) {
        selectEl.selectedIndex = 0;
        return;
      }
      const enumOnlyRoles = new Set(['district', 'propertyType', 'rooms']);
      const hasOption = Array.from(selectEl.options || []).some((opt) => String(opt.value) === safe);
      if (!hasOption) {
        if (enumOnlyRoles.has(role)) {
          selectEl.selectedIndex = 0;
          return;
        }
        const opt = document.createElement('option');
        opt.value = safe;
        opt.textContent = safe;
        selectEl.appendChild(opt);
      }
      selectEl.value = safe;
    };
    const setCheck = (role, checked) => {
      const el = overlay.querySelector(`[data-role="${role}"]`);
      if (el) el.checked = !!checked;
    };
    const rawMode = String(payload.listingMode || payload.operation || '').toLowerCase();
    const mode = rawMode === 'sale' || rawMode === 'rent' ? rawMode : '';
    overlay.querySelectorAll('[data-role="listingMode"]').forEach((btn) => {
      const v = String(btn.getAttribute('data-value') || '');
      btn.classList.toggle('is-active', !!mode && v === mode);
    });
    setPicker('priceMin', payload.priceFrom);
    setPicker('priceMax', payload.priceTo);
    setPicker('areaMin', payload.areaFrom);
    setPicker('areaMax', payload.areaTo);
    setPicker('floorMin', payload.floorNotFirst === true ? 'not_first' : payload.floorFrom);
    setPicker('floorMax', payload.floorNotLast === true ? 'not_last' : payload.floorTo);
    if (payload.smart === true) {
      setSelect('rooms', 'smart');
    } else {
      setSelect('rooms', payload.rooms);
    }
    setSelect('district', payload.district);
    setSelect('propertyType', payload.propertyType || payload.type);
    setCheck('arcadia', payload.arcadia);
    setCheck('exclusive', payload.exclusive);
    setCheck('center', payload.center);
    setCheck('parking', payload.parking);
    setCheck('balconyLoggia', payload.balconyLoggia);
    setCheck('rcOnly', payload.residentialComplexOnly);
    const rcHid = overlay.querySelector('[data-role="filters-rc-hidden"]');
    if (rcHid) rcHid.value = String(payload.residentialComplex || '').trim();
    try { overlay._syncFiltersRcLabel?.(); } catch {}
    this.syncFiltersSelectAllLabels(overlay);
    this.syncFilterPickerLabels(overlay);
  }

  normalizeCatalogFilterOverrides(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const parseNum = (value) => {
      const text = String(value ?? '').trim();
      if (!text || text.toLowerCase() === 'max') return null;
      const digits = text.replace(/[^\d-]/g, '');
      if (!digits) return null;
      const n = Number(digits);
      return Number.isFinite(n) ? Math.round(n) : null;
    };
    const out = {};
    const minPrice = parseNum(source.priceFrom);
    const maxPrice = parseNum(source.priceTo);
    const minArea = parseNum(source.areaFrom);
    const maxArea = parseNum(source.areaTo);
    const minFloor = parseNum(source.floorFrom);
    const maxFloor = parseNum(source.floorTo);
    if (Object.prototype.hasOwnProperty.call(source, 'floorNotFirst')) out.floorNotFirst = source.floorNotFirst === true;
    if (Object.prototype.hasOwnProperty.call(source, 'floorNotLast')) out.floorNotLast = source.floorNotLast === true;
    if (minPrice != null) out.minPrice = minPrice;
    if (maxPrice != null) out.maxPrice = maxPrice;
    if (minArea != null) out.minArea = minArea;
    if (maxArea != null) out.maxArea = maxArea;
    if (minFloor != null) out.minFloor = minFloor;
    if (maxFloor != null) out.maxFloor = maxFloor;
    const roomsRaw = String(source.rooms || '').trim();
    if (roomsRaw === 'smart' || source.smart === true) {
      out.smart = true;
    } else if (roomsRaw) {
      out.rooms = roomsRaw;
    }
    const district = String(source.district || '').trim();
    if (district) out.district = district;
    if (Object.prototype.hasOwnProperty.call(source, 'residentialComplex')) {
      out.residentialComplex = String(source.residentialComplex || '').trim();
    }
    const op = String(source.listingMode || source.operation || '').trim().toLowerCase();
    if (op === 'sale' || op === 'rent') out.operation = op;
    const ptype = String(source.propertyType || source.type || '').trim();
    if (ptype) out.type = ptype;
    if (Object.prototype.hasOwnProperty.call(source, 'arcadia')) out.arcadia = source.arcadia === true;
    if (Object.prototype.hasOwnProperty.call(source, 'residentialComplexOnly')) out.rcOnly = source.residentialComplexOnly === true;
    if (Object.prototype.hasOwnProperty.call(source, 'exclusive')) out.exclusive = source.exclusive === true;
    if (Object.prototype.hasOwnProperty.call(source, 'center')) out.center = source.center === true;
    if (Object.prototype.hasOwnProperty.call(source, 'parking')) out.parking = source.parking === true;
    if (Object.prototype.hasOwnProperty.call(source, 'balconyLoggia')) out.balconyLoggia = source.balconyLoggia === true;
    return out;
  }

  getCatalogEffectiveSearchParams(insightsSource = null) {
    const parseNum = (value) => {
      if (value == null) return null;
      if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
      const text = String(value).trim();
      if (!text) return null;
      const digits = text.replace(/[^\d-]/g, '');
      if (!digits) return null;
      const n = Number(digits);
      return Number.isFinite(n) ? Math.round(n) : null;
    };
    const normalizeDistrictSlug = (value) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (/примор|промор|primor|promor/.test(raw)) return 'primorsky';
      if (/киев|kiev|kyiv|таир|tairo/.test(raw)) return 'kievsky';
      if (/сувор|suvor/.test(raw)) return 'suvorovsky';
      if (/малин|malin/.test(raw)) return 'malinovsky';
      if (/лиман|liman/.test(raw)) return 'kievsky';
      if (/крыжан|крижан|kryzhan|kryjan/.test(raw)) return 'suvorovsky';
      if (/аванг|avang/.test(raw)) return 'malinovsky';
      return '';
    };
    const isDistrictLikeLocation = (text) => {
      const t = String(text || '').trim().toLowerCase();
      if (!t) return false;
      if (/\bрайон\b/.test(t)) return true;
      return /(примор|промор|primor|promor|киев|kiev|kyiv|сувор|suvor|малин|malin|таир|tairo|хаджиб|hadzhib|пересып|peresyp)/i.test(t);
    };
    const normalizeOperationToSearch = (value) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (/(buy|sale|sell|purchase|покуп|купит|продаж)/i.test(raw)) return 'sale';
      if (/(rent|lease|аренд|снять)/i.test(raw)) return 'rent';
      return '';
    };
    const normalizeTypeToSearch = (value) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (/(apartment|flat|квартир|апартамент|апарты)/i.test(raw)) return 'apartment';
      if (/(house|villa|home|дом|таунхаус|таун)/i.test(raw)) return 'house';
      if (/(land|plot|участок|земл)/i.test(raw)) return 'land';
      if (/(commercial|office|retail|склад|коммер|офис|нежил)/i.test(raw)) return 'commercial';
      return '';
    };
    const parseFeaturesTokens = (insights) => {
      const raw = [];
      if (Array.isArray(insights?.features)) raw.push(...insights.features);
      if (typeof insights?.features === 'string') raw.push(insights.features);
      if (insights?.details != null) raw.push(insights.details);
      if (insights?.preferences != null) raw.push(insights.preferences);
      if (insights?.location != null) raw.push(insights.location);
      const text = raw.map((v) => String(v || '').toLowerCase()).join(' ');
      return {
        smart: /(смарт|smart)/i.test(text),
        arcadia: /(аркад|arcad)/i.test(text),
        center: /(центр|center|central)/i.test(text),
        exclusive: /(эксклюзив|exclusive)/i.test(text),
        parking: /(паркинг|парковк|parking|garage)/i.test(text),
        balconyLoggia: /(балкон|лоджи|balcony|loggia)/i.test(text),
        rcOnly: /(?:^|\s)(?:[жз]к|[жз]\/к)(?:\s|$)|только\s*[жз]к|лишь\s*[жз]к|исключительно\s*[жз]к|в\s*[жз]к|жил(?:ой|ого|ом|ые|ых)?\s+комплекс(?:ы|а|е|ах)?|в\s+жил(?:ом|ых)\s+комплекс(?:е|ах)?|residential\s+complex(?:es)?/i.test(text)
      };
    };
    const stripRcPrefixes = (text) => {
      let s = String(text || '').trim();
      if (!s) return '';
      return s.replace(/^(?:жк|зк|жилой\s+комплекс|жилкомплекс)\s*[«"']?/i, '').replace(/[»"']$/g, '').trim() || s;
    };
    const isGenericCityLocation = (text) => {
      const t = String(text || '').trim().toLowerCase();
      if (!t) return true;
      return /^(одесса|одеса|odesa|odessa|украина|україна|ukraine)\b/.test(t);
    };
    const insights = insightsSource && typeof insightsSource === 'object'
      ? insightsSource
      : (this._catalogIgnoreAssistantBaseFilters === true ? {} : (this.understanding?.export?.() || {}));
    const base = {};
    const operation = normalizeOperationToSearch(insights.operation);
    if (operation) base.operation = operation;
    const type = normalizeTypeToSearch(insights.type);
    if (type) base.type = type;
    const roomsNum = parseNum(insights.rooms);
    if (roomsNum != null) base.rooms = roomsNum >= 4 ? '4plus' : String(roomsNum);
    const budgetMax = parseNum(insights.budgetMax ?? insights.budget);
    if (budgetMax != null) base.maxPrice = budgetMax;
    const areaMin = parseNum(insights.areaMin ?? insights.area);
    const areaMax = parseNum(insights.areaMax);
    if (areaMin != null) base.minArea = areaMin;
    if (areaMax != null) base.maxArea = areaMax;
    const floor = parseNum(insights.floor);
    if (floor != null) {
      base.minFloor = floor;
      base.maxFloor = floor;
    }
    const locRaw = String(insights.location || '').trim();
    const districtSlug = normalizeDistrictSlug(locRaw);
    if (districtSlug) base.district = districtSlug;
    const rcInsight = String(insights.residentialComplex || '').trim();
    if (rcInsight && !normalizeDistrictSlug(rcInsight) && !isDistrictLikeLocation(rcInsight)) {
      base.residentialComplex = rcInsight;
    } else if (locRaw && !districtSlug && !isGenericCityLocation(locRaw) && !isDistrictLikeLocation(locRaw)) {
      base.residentialComplex = stripRcPrefixes(locRaw);
    }
    if (insights?.rcOnly === true || insights?.residentialComplexOnly === true) {
      base.rcOnly = true;
    }
    const featureFlags = parseFeaturesTokens(insights);
    if (featureFlags.smart) base.smart = true;
    if (featureFlags.arcadia) base.arcadia = true;
    if (featureFlags.center) base.center = true;
    if (featureFlags.exclusive) base.exclusive = true;
    if (featureFlags.parking) base.parking = true;
    if (featureFlags.balconyLoggia) base.balconyLoggia = true;
    if (featureFlags.rcOnly) base.rcOnly = true;
    const manual = this._catalogManualFilterOverrides && typeof this._catalogManualFilterOverrides === 'object'
      ? this._catalogManualFilterOverrides
      : {};
    const merged = { ...base, ...manual };
    if (merged.minPrice != null && merged.maxPrice != null && Number(merged.minPrice) > Number(merged.maxPrice)) {
      merged.maxPrice = merged.minPrice;
    }
    if (merged.minArea != null && merged.maxArea != null && Number(merged.minArea) > Number(merged.maxArea)) {
      merged.maxArea = merged.minArea;
    }
    if (merged.minFloor != null && merged.maxFloor != null && Number(merged.minFloor) > Number(merged.maxFloor)) {
      merged.maxFloor = merged.minFloor;
    }
    return merged;
  }

  buildFiltersOverlayPayloadFromEffectiveQuery() {
    const query = this.getCatalogEffectiveSearchParams();
    const opRaw = String(query.operation || '').toLowerCase();
    const op = opRaw === 'sale' || opRaw === 'rent' ? opRaw : '';
    return {
      listingMode: op,
      propertyType: query.type != null ? String(query.type) : '',
      priceFrom: query.minPrice != null ? String(query.minPrice) : '',
      priceTo: query.maxPrice != null ? String(query.maxPrice) : '',
      areaFrom: query.minArea != null ? String(query.minArea) : '',
      areaTo: query.maxArea != null ? String(query.maxArea) : '',
      floorFrom: query.minFloor != null ? String(query.minFloor) : '',
      floorTo: query.maxFloor != null ? String(query.maxFloor) : '',
      floorNotFirst: query.floorNotFirst === true,
      floorNotLast: query.floorNotLast === true,
      rooms: query.smart === true ? '' : (query.rooms != null ? String(query.rooms) : ''),
      smart: query.smart === true,
      district: query.district != null ? String(query.district) : '',
      arcadia: query.arcadia === true,
      exclusive: query.exclusive === true,
      center: query.center === true,
      parking: query.parking === true,
      balconyLoggia: query.balconyLoggia === true,
      residentialComplexOnly: query.rcOnly === true,
      residentialComplex: query.residentialComplex != null ? String(query.residentialComplex) : ''
    };
  }

  async refreshCatalogByEffectiveQuery(insightsSource = null) {
    const query = { ...this.getCatalogEffectiveSearchParams(insightsSource), limit: 2000 };
    const toNum = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const isAiMode = this._catalogLastRefineMode === 'ai';
    const aiBudgetAnchor = isAiMode ? toNum(query.maxPrice) : null;
    if (isAiMode && aiBudgetAnchor != null && aiBudgetAnchor > 0 && query.minPrice == null) {
      // AI "до X" трактуем как "около X": strict окно ±25%
      query.minPrice = Math.max(0, Math.round(aiBudgetAnchor * 0.75));
      query.maxPrice = Math.round(aiBudgetAnchor * 1.25);
      query.__budgetAnchor = aiBudgetAnchor;
    } else if (aiBudgetAnchor != null && aiBudgetAnchor > 0) {
      query.__budgetAnchor = aiBudgetAnchor;
    }

    const qMinPrice = toNum(query.minPrice);
    const qMaxPrice = toNum(query.maxPrice);
    if (qMinPrice != null && qMaxPrice != null) query.__priceAnchor = Math.round((qMinPrice + qMaxPrice) / 2);
    else query.__priceAnchor = qMaxPrice ?? qMinPrice ?? null;

    const qMinArea = toNum(query.minArea);
    const qMaxArea = toNum(query.maxArea);
    if (qMinArea != null && qMaxArea != null) query.__areaAnchor = Math.round((qMinArea + qMaxArea) / 2);
    else query.__areaAnchor = qMinArea ?? qMaxArea ?? null;

    const qRoomsRaw = String(query.rooms || '').trim();
    if (qRoomsRaw === '4plus') query.__roomsAnchor = 4;
    else {
      const qRooms = toNum(qRoomsRaw);
      query.__roomsAnchor = qRooms != null ? qRooms : null;
    }

    const requestQuery = { ...query };
    delete requestQuery.__budgetAnchor;
    delete requestQuery.__priceAnchor;
    delete requestQuery.__areaAnchor;
    delete requestQuery.__roomsAnchor;
    const cards = await this.api?.fetchCardsSearch?.(requestQuery);
    const listRaw = Array.isArray(cards) ? cards : [];
    const list = (query.floorNotFirst === true || query.floorNotLast === true)
      ? listRaw.filter((item) => {
        const floor = toNum(item?.floor ?? item?.specs_floor ?? item?.specs?.floor);
        if (floor == null) return false;
        if (query.floorNotFirst === true && floor <= 1) return false;
        if (query.floorNotLast === true) {
          const totalFloors = toNum(
            item?.building_floors
            ?? item?.floors_total
            ?? item?.floorsTotal
            ?? item?.total_floors
            ?? item?.display_specs?.total_floors
            ?? item?.features?.display_specs?.total_floors
          );
          if (totalFloors != null && totalFloors > 1 && floor >= totalFloors) return false;
        }
        return true;
      })
      : listRaw;
    this._catalogStrictFlowActive = this._isStrictFlowQuery(query);
    this._catalogStrictQuery = { ...query };
    this._catalogRelaxedUnlocked = false;
    this._catalogRelaxLevel = 0;
    this._catalogRelaxPool = null;
    this._catalogRelaxShownIds = new Set();
    this._catalogStrictEndPromptShown = false;
    this._catalogSimilarEndPromptShown = false;
    this._catalogStrictSeedIds = list
      .map((item) => String(this._toCardEngineShape(item)?.id || '').trim())
      .filter(Boolean);
    this.replacePropertiesCatalog(list);
    if (!window.appState) window.appState = {};
    window.appState.lastTotalMatches = list.length;
    this.updateObjectCount(list.length, { forceLabel: true });
    return list;
  }

  async applyCatalogFilters(payload = {}) {
    const normalized = this.normalizeCatalogFilterOverrides(payload);
    this._catalogManualFilterOverrides = Object.keys(normalized).length ? normalized : null;
    this._catalogLastRefineMode = 'filters';
    try {
      const list = await this.refreshCatalogByEffectiveQuery();
      this.ui?.showNotification?.(`Фильтры применены: ${list.length}`);
    } catch (error) {
      console.error('filters.apply failed:', error);
      this.ui?.showNotification?.('Не удалось применить фильтры');
    }
  }

  async resetCatalogFiltersToAll(overlay = null) {
    this._catalogManualFilterOverrides = null;
    this._catalogIgnoreAssistantBaseFilters = true;
    this._catalogLastRefineMode = 'filters';
    if (overlay) this.resetFiltersOverlayForm(overlay);
    try {
      const list = await this.refreshCatalogByEffectiveQuery({});
      this.ui?.showNotification?.(`Фильтры сброшены: ${list.length}`);
    } catch (error) {
      console.error('filters.reset failed:', error);
      this.ui?.showNotification?.('Не удалось сбросить фильтры');
    }
  }

  resetFiltersOverlayForm(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll('[data-role="listingMode"]').forEach((btn) => {
      btn.classList.remove('is-active');
    });
    overlay.querySelectorAll('select[data-picker]').forEach((sel) => { sel.selectedIndex = 0; });
    const rooms = overlay.querySelector('[data-role="rooms"]');
    if (rooms) rooms.selectedIndex = 0;
    const district = overlay.querySelector('[data-role="district"]');
    if (district) district.selectedIndex = 0;
    const propertyType = overlay.querySelector('[data-role="propertyType"]');
    if (propertyType) propertyType.selectedIndex = 0;
    ['rcOnly', 'arcadia', 'exclusive', 'center', 'parking', 'balconyLoggia'].forEach((role) => {
      const el = overlay.querySelector(`[data-role="${role}"]`);
      if (el) el.checked = false;
    });
    const rcHid = overlay.querySelector('[data-role="filters-rc-hidden"]');
    if (rcHid) rcHid.value = '';
    try { overlay._syncFiltersRcLabel?.(); } catch {}
    this.syncFiltersSelectAllLabels(overlay);
    this.syncFilterPickerLabels(overlay);
  }

  bindFiltersOverlayEvents(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll('[data-role="listingMode"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = String(btn.getAttribute('data-value') || '');
        const isAlreadyActive = btn.classList.contains('is-active');
        if (isAlreadyActive) {
          overlay.querySelectorAll('[data-role="listingMode"]').forEach((b) => b.classList.remove('is-active'));
          return;
        }
        overlay.querySelectorAll('[data-role="listingMode"]').forEach((b) => {
          b.classList.toggle('is-active', String(b.getAttribute('data-value') || '') === v);
        });
      });
    });
    overlay.querySelectorAll('select[data-picker]').forEach((selectEl) => {
      selectEl.addEventListener('change', () => {
        const picker = String(selectEl.getAttribute('data-picker') || '');
        if (picker.startsWith('price')) this.normalizeFilterRangePair(overlay, 'price', picker);
        if (picker.startsWith('area')) this.normalizeFilterRangePair(overlay, 'area', picker);
        if (picker.startsWith('floor')) this.normalizeFilterRangePair(overlay, 'floor', picker);
        this.syncFilterPickerLabels(overlay);
      });
    });
    ['propertyType', 'district', 'rooms'].forEach((role) => {
      const selectEl = overlay.querySelector(`[data-role="${role}"]`);
      if (!selectEl) return;
      selectEl.addEventListener('change', () => {
        this.syncFiltersSelectAllLabels(overlay);
      });
    });
    overlay.querySelector('[data-role="reset"]')?.addEventListener('click', () => {
      this.resetCatalogFiltersToAll(overlay);
    });
    overlay.querySelector('[data-role="apply"]')?.addEventListener('click', async () => {
      const payload = this.collectFiltersOverlayPayload(overlay);
      console.log('filters.apply', payload);
      await this.applyCatalogFilters(payload);
      this.closeFiltersOverlay();
    });
  }

  bindFiltersResidentialComplexPicker(overlay) {
    if (!overlay) return;
    try { this.ensureResidentialComplexPickerStyles(); } catch {}
    const rcHidden = overlay.querySelector('[data-role="filters-rc-hidden"]');
    const rcTrigger = overlay.querySelector('[data-role="filters-rc-trigger"]');
    const rcLabel = overlay.querySelector('[data-role="filters-rc-label"]');
    const syncLabel = () => {
      if (!rcLabel) return;
      const v = String(rcHidden?.value || '').trim();
      rcLabel.textContent = v || 'Поиск по ЖК';
      rcLabel.style.opacity = v ? '1' : '0.62';
    };
    overlay._syncFiltersRcLabel = syncLabel;
    syncLabel();
    let rcSearchTimer = null;
    const closeRcLayer = (layer) => {
      if (!layer) return;
      layer.classList.remove('is-open');
      if (rcTrigger) rcTrigger.setAttribute('aria-expanded', 'false');
    };
    const openRcPicker = () => {
      const syncFiltersRcKbInsetFor = (lyr) => {
        try {
          const vv = window.visualViewport;
          const inset = !vv ? 0 : Math.max(0, (window.innerHeight || 0) - (vv.height + vv.offsetTop));
          lyr.style.setProperty('--vw-rc-kb-inset', `${inset}px`);
        } catch {
          try { lyr.style.removeProperty('--vw-rc-kb-inset'); } catch {}
        }
      };
      let layer = overlay.querySelector('[data-role="filters-rc-layer"]');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'vw-access-rc-layer';
        layer.setAttribute('data-role', 'filters-rc-layer');
        layer.innerHTML = `
            <div class="vw-access-rc-panel vw-filters-rc-panel" role="dialog" aria-modal="true" aria-label="Выбор ЖК">
              <div class="vw-access-rc-head">
                <div class="vw-access-rc-title">Жилой комплекс</div>
                <button type="button" class="vw-access-rc-close" data-role="rc-close" aria-label="Закрыть">×</button>
              </div>
              <div class="vw-access-rc-search-wrap">
                <input type="search" class="vw-access-add-input" data-role="rc-search" placeholder="Поиск по ЖК" enterkeyhint="search" autocomplete="off">
                <span class="vw-access-rc-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
                </span>
              </div>
              <div class="vw-access-rc-list" data-role="rc-list" role="listbox"></div>
            </div>`;
        overlay.appendChild(layer);
        const onFiltersRcVvChange = () => syncFiltersRcKbInsetFor(layer);
        const vvFr = window.visualViewport;
        if (vvFr) {
          vvFr.addEventListener('resize', onFiltersRcVvChange);
          vvFr.addEventListener('scroll', onFiltersRcVvChange);
          layer._vwFiltersRcVvCleanup = () => {
            try {
              vvFr.removeEventListener('resize', onFiltersRcVvChange);
              vvFr.removeEventListener('scroll', onFiltersRcVvChange);
            } catch {}
            try { layer.style.removeProperty('--vw-rc-kb-inset'); } catch {}
          };
        }
        const stop = (e) => e.stopPropagation();
        layer.querySelector('.vw-access-rc-panel')?.addEventListener('click', stop);
        layer.addEventListener('click', () => closeRcLayer(layer));
        layer.querySelector('[data-role="rc-close"]')?.addEventListener('click', () => closeRcLayer(layer));
        const listEl = layer.querySelector('[data-role="rc-list"]');
        const searchEl = layer.querySelector('[data-role="rc-search"]');
        const bindRow = (name) => {
          if (!rcHidden) return;
          rcHidden.value = String(name || '').trim();
          syncLabel();
          closeRcLayer(layer);
          try { rcTrigger?.focus?.(); } catch {}
        };
        const renderList = (items) => {
          if (!listEl) return;
          const arr = Array.isArray(items) ? items : [];
          if (!arr.length) {
            listEl.innerHTML = '<div class="vw-access-rc-empty" data-role="rc-empty">Ничего не найдено</div>';
            return;
          }
          listEl.innerHTML = arr.map((row) => {
            const id = String(row?.id ?? '').trim();
            const nameRaw = String(row?.name || '');
            const nameHtml = nameRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            return (
              '<div class="vw-access-rc-row-wrap vw-filters-rc-row" role="presentation">' +
              `<button type="button" class="vw-access-rc-row--main" data-rc-id="${id.replace(/"/g, '&quot;')}">${nameHtml}</button>` +
              '</div>'
            );
          }).join('');
          listEl.querySelectorAll('.vw-access-rc-row--main').forEach((btn) => {
            btn.addEventListener('click', () => bindRow(btn.textContent));
          });
        };
        const loadList = async (q = '') => {
          try {
            const list = await this.api?.fetchResidentialComplexes?.({ q, limit: 80 });
            renderList(list);
          } catch (err) {
            console.warn('rc.list', err);
            if (listEl) {
              listEl.innerHTML = '<div class="vw-access-rc-empty">Не удалось загрузить список</div>';
            }
          }
        };
        searchEl?.addEventListener('input', () => {
          clearTimeout(rcSearchTimer);
          rcSearchTimer = setTimeout(() => {
            loadList(String(searchEl.value || '').trim());
          }, 280);
        });
        overlay._filtersRcLoadList = loadList;
      }
      const layerRef = overlay.querySelector('[data-role="filters-rc-layer"]');
      if (layerRef) {
        layerRef.classList.add('is-open');
        syncFiltersRcKbInsetFor(layerRef);
        if (rcTrigger) rcTrigger.setAttribute('aria-expanded', 'true');
        const se = layerRef.querySelector('[data-role="rc-search"]');
        if (se) se.value = '';
        overlay._filtersRcLoadList?.('');
        setTimeout(() => {
          try { se?.focus?.(); } catch {}
        }, 50);
      }
    };
    rcTrigger?.addEventListener('click', () => openRcPicker());
    overlay._filtersRcCleanup = () => {
      try { clearTimeout(rcSearchTimer); rcSearchTimer = null; } catch {}
      try {
        const fl = overlay.querySelector('[data-role="filters-rc-layer"]');
        fl?._vwFiltersRcVvCleanup?.();
      } catch {}
      try { overlay.querySelector('[data-role="filters-rc-layer"]')?.remove(); } catch {}
      try { delete overlay._filtersRcLoadList; } catch {}
      try { delete overlay._syncFiltersRcLabel; } catch {}
      try { delete overlay._filtersRcCleanup; } catch {}
    };
  }

  ensureFiltersOverlayStyles() {
    let style = document.getElementById('vw-filters-overlay-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'vw-filters-overlay-styles';
      document.head.appendChild(style);
    }
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
        border-radius: 12px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: color-mix(in srgb, var(--bg-card, #1e1d20) 90%, transparent);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: var(--text-primary, #fff);
        padding: 14px;
        display: grid;
        gap: 10px;
      }
      .vw-filters-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .vw-filters-title {
        font-size: .8125rem;
        font-weight: 600;
        color: var(--text-secondary, rgba(255,255,255,0.78));
      }
      .vw-filters-close {
        width: 30px;
        height: 30px;
        border-radius: 6px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
      }
      .vw-filters-list {
        display: grid;
        gap: 12px;
      }
      .vw-filters-block-top {
        display: grid;
        gap: 8px;
      }
      .vw-filters-top-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        align-items: stretch;
      }
      .vw-filters-segmented {
        display: flex;
        border-radius: 6px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: rgba(0,0,0,0.18);
        padding: 2px;
        gap: 2px;
        box-sizing: border-box;
        min-height: 36px;
      }
      .vw-filters-segment {
        flex: 1;
        border: 0;
        border-radius: 4px;
        margin: 0;
        padding: 6px 8px;
        font-size: .75rem;
        font-weight: 600;
        line-height: 1.2;
        color: var(--text-secondary, rgba(255,255,255,0.72));
        background: transparent;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .vw-filters-segment.is-active {
        background: var(--bg-element, rgba(255,255,255,0.14));
        color: var(--text-primary, #fff);
      }
      .vw-filters-select {
        width: 100%;
        height: 36px;
        box-sizing: border-box;
        border-radius: 6px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 0 10px;
        font-size: .75rem;
      }
      .vw-filters-range-block {
        display: grid;
        grid-template-columns: minmax(72px, 32%) minmax(0, 1fr);
        gap: 10px;
        align-items: center;
      }
      .vw-filters-range-name {
        font-size: .75rem;
        font-weight: 500;
        color: var(--text-secondary, rgba(255,255,255,0.78));
      }
      .vw-filters-range-dual {
        display: flex;
        align-items: stretch;
        min-height: 36px;
        border-radius: 6px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.08));
        overflow: hidden;
        box-sizing: border-box;
      }
      .vw-filters-picker-field--in-dual {
        position: relative;
        flex: 1;
        min-width: 0;
        display: grid;
        align-items: center;
        padding: 0 10px;
        min-height: 36px;
        border: 0;
        border-radius: 0;
        background: transparent;
        margin: 0;
      }
      .vw-filters-range-dual-divider {
        flex: 0 0 1px;
        background: color-mix(in srgb, var(--border-light, rgba(255,255,255,0.14)) 88%, transparent);
        align-self: stretch;
      }
      .vw-filters-picker-label {
        font-size: .75rem;
        color: var(--text-secondary, rgba(255,255,255,0.72));
        pointer-events: none;
      }
      .vw-filters-picker-select {
        position: absolute;
        inset: 0;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
      }
      .vw-filters-check-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 12px;
      }
      .vw-filters-check-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: .75rem;
        line-height: 1.25;
        color: var(--text-primary, #fff);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .vw-filters-check-item input {
        flex-shrink: 0;
        accent-color: var(--color-accent, #4ea0ff);
      }
      .vw-filters-rc-wrap {
        display: grid;
        gap: 6px;
      }
      .vw-filters-rc-trigger {
        width: 100%;
        min-height: 36px;
        box-sizing: border-box;
        border-radius: 6px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        color: var(--text-primary, #fff);
        padding: 0 10px;
        text-align: left;
        font-size: .75rem;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .vw-filters-rc-trigger__label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vw-access-rc-panel.vw-filters-rc-panel {
        grid-template-rows: auto auto minmax(0, 1fr);
        padding-bottom: calc(40px + var(--vw-rc-kb-inset, 0px));
      }
      .vw-filters-rc-panel .vw-filters-rc-row .vw-access-rc-row--main {
        padding: 12px 14px;
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
        gap: 12px;
        margin-top: 2px;
      }
      .vw-filters-apply {
        min-width: 120px;
        min-height: 36px;
        border-radius: 6px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.14));
        color: var(--text-primary, #fff);
        font-size: .8125rem;
        font-weight: 600;
        cursor: pointer;
      }
      .vw-filters-reset {
        min-height: 36px;
        border: 0;
        background: transparent;
        color: #ec4f55;
        font-size: .8125rem;
        font-weight: 600;
        cursor: pointer;
      }
    `;
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
          <div class="vw-filters-block-top">
            <div class="vw-filters-top-grid">
              <div class="vw-filters-segmented" role="group" aria-label="Сделка">
                <button type="button" class="vw-filters-segment" data-role="listingMode" data-value="sale">Продажа</button>
                <button type="button" class="vw-filters-segment" data-role="listingMode" data-value="rent">Аренда</button>
              </div>
              <select class="vw-filters-select" data-role="propertyType" aria-label="Тип недвижимости">
                <option value="" selected disabled>Тип недвижимости</option>
                <option value="all">Выбрать всё</option>
                <option value="apartment">Квартира</option>
                <option value="house">Дом</option>
                <option value="commercial">Коммерческая</option>
                <option value="land">Участок</option>
              </select>
            </div>
            <div class="vw-filters-top-grid">
              <select class="vw-filters-select" aria-label="Район" data-role="district">
                <option value="" selected disabled>Район</option>
                <option value="all">Выбрать всё</option>
                <option value="primorsky">Приморский</option>
                <option value="kievsky">Киевский</option>
                <option value="malinovsky">Малиновский</option>
                <option value="suvorovsky">Суворовский</option>
              </select>
              <select class="vw-filters-select" aria-label="Количество комнат" data-role="rooms">
                <option value="" selected disabled>Количество комнат</option>
                <option value="all">Выбрать всё</option>
                <option value="smart">Смарт-квартира</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5plus">5+</option>
              </select>
            </div>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-range-block">
            <span class="vw-filters-range-name">Стоимость</span>
            <div class="vw-filters-range-dual">
              <label class="vw-filters-picker-field--in-dual">
                <span class="vw-filters-picker-label" data-display="priceMin">От min</span>
                <select class="vw-filters-picker-select" data-picker="priceMin" aria-label="Цена от"></select>
              </label>
              <div class="vw-filters-range-dual-divider" aria-hidden="true"></div>
              <label class="vw-filters-picker-field--in-dual">
                <span class="vw-filters-picker-label" data-display="priceMax">До max</span>
                <select class="vw-filters-picker-select" data-picker="priceMax" aria-label="Цена до"></select>
              </label>
            </div>
          </div>
          <div class="vw-filters-range-block">
            <span class="vw-filters-range-name">Площадь</span>
            <div class="vw-filters-range-dual">
              <label class="vw-filters-picker-field--in-dual">
                <span class="vw-filters-picker-label" data-display="areaMin">От min</span>
                <select class="vw-filters-picker-select" data-picker="areaMin" aria-label="Площадь от"></select>
              </label>
              <div class="vw-filters-range-dual-divider" aria-hidden="true"></div>
              <label class="vw-filters-picker-field--in-dual">
                <span class="vw-filters-picker-label" data-display="areaMax">До max</span>
                <select class="vw-filters-picker-select" data-picker="areaMax" aria-label="Площадь до"></select>
              </label>
            </div>
          </div>
          <div class="vw-filters-range-block">
            <span class="vw-filters-range-name">Этаж</span>
            <div class="vw-filters-range-dual">
              <label class="vw-filters-picker-field--in-dual">
                <span class="vw-filters-picker-label" data-display="floorMin">От max</span>
                <select class="vw-filters-picker-select" data-picker="floorMin" aria-label="Этаж от"></select>
              </label>
              <div class="vw-filters-range-dual-divider" aria-hidden="true"></div>
              <label class="vw-filters-picker-field--in-dual">
                <span class="vw-filters-picker-label" data-display="floorMax">До max</span>
                <select class="vw-filters-picker-select" data-picker="floorMax" aria-label="Этаж до"></select>
              </label>
            </div>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-check-grid">
            <label class="vw-filters-check-item"><input type="checkbox" data-role="rcOnly"> Только ЖК</label>
            <label class="vw-filters-check-item"><input type="checkbox" data-role="exclusive"> Эксклюзивы</label>
            <label class="vw-filters-check-item"><input type="checkbox" data-role="parking"> Есть паркинг</label>
            <label class="vw-filters-check-item"><input type="checkbox" data-role="arcadia"> Аркадия</label>
            <label class="vw-filters-check-item"><input type="checkbox" data-role="balconyLoggia"> Балкон/лоджия</label>
            <label class="vw-filters-check-item"><input type="checkbox" data-role="center"> Центр</label>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-rc-wrap">
            <input type="hidden" value="" data-role="filters-rc-hidden" autocomplete="off">
            <button type="button" class="vw-filters-rc-trigger" data-role="filters-rc-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="vw-filters-rc-trigger__label" data-role="filters-rc-label">Поиск по ЖК</span>
            </button>
          </div>
          <hr class="vw-filters-divider">
          <div class="vw-filters-actions">
            <button type="button" class="vw-filters-apply" data-role="apply">Применить</button>
            <button type="button" class="vw-filters-reset" data-role="reset">Сбросить</button>
          </div>
        </div>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    this._filtersOverlayOpen = true;
    this.$byId('pillFiltersButton')?.setAttribute('aria-expanded', 'true');
    overlay.querySelectorAll('select[data-picker]').forEach((sel) => {
      const pickerType = String(sel.getAttribute('data-picker') || '');
      this.fillFilterPickerSelect(sel, pickerType);
    });
    this.applyFiltersOverlayPayload(overlay, this.buildFiltersOverlayPayloadFromEffectiveQuery());
    this.bindFiltersOverlayEvents(overlay);
    this.bindFiltersResidentialComplexPicker(overlay);
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
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: .86rem;
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform .08s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease, opacity .18s ease;
      }
      .vw-access-item:hover {
        border-color: rgba(255,255,255,0.28);
        box-shadow: 0 6px 18px rgba(0,0,0,0.24);
      }
      .vw-access-item:active {
        transform: translateY(1px) scale(0.995);
      }
      .vw-access-item:focus-visible {
        outline: none;
        border-color: rgba(92, 150, 255, 0.88);
        box-shadow: 0 0 0 2px rgba(92, 150, 255, 0.28);
      }
      .vw-access-item.is-busy {
        opacity: .72;
        pointer-events: none;
      }
      .vw-access-item__icon {
        width: 1.2em;
        min-width: 1.2em;
        display: inline-flex;
        justify-content: center;
        align-items: center;
      }
      .vw-access-item__label {
        flex: 1;
      }
      .vw-access-item__count {
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        border: 1px solid rgba(92, 150, 255, 0.7);
        background: rgba(92, 150, 255, 0.16);
        color: var(--text-primary, #fff);
        font-size: .72rem;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
      }
      .vw-access-item--primary {
        border-color: rgba(45, 143, 225, 0.65);
        background: linear-gradient(180deg, rgba(45,143,225,0.32), rgba(36,129,204,0.26));
      }
      .vw-access-item--has-count {
        position: relative;
        border-color: rgba(45, 143, 225, 0.72);
        box-shadow: 0 0 0 1px rgba(92, 150, 255, 0.24) inset;
      }
      .vw-access-item--has-count::after {
        content: attr(data-count);
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: rgba(45, 143, 225, 0.95);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.5);
        font-size: .66rem;
        font-weight: 700;
        line-height: 16px;
        text-align: center;
        box-shadow: 0 6px 12px rgba(0,0,0,0.28);
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
      .vw-access-sub-btn--ghost {
        border-color: transparent;
        background: transparent;
        color: var(--text-primary, #fff);
        font-weight: 600;
        opacity: .96;
      }
      .vw-access-sub-btn--ghost.is-active {
        color: rgba(92, 150, 255, 0.98);
      }
      .vw-access-sub-btn--text-action {
        min-height: 34px;
        padding: 0 6px;
        gap: 6px;
        font-size: .83em;
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        width: auto;
        max-width: 100%;
        white-space: nowrap;
        line-height: 1;
      }
      .vw-access-sub-btn--text-action svg {
        width: 14px;
        height: 14px;
        display: block;
        flex: 0 0 14px;
        opacity: .9;
      }
      .vw-access-sub-btn--text-action span {
        display: inline-block;
        min-width: 0;
      }
      .vw-access-reset-glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: .95rem;
        line-height: 1;
      }
      .vw-access-sub-btn--danger {
        border-color: rgba(236, 96, 96, 0.82);
        background: rgba(236, 96, 96, 0.16);
      }
      .vw-access-sub-btn--danger-ghost {
        border-color: rgba(236, 96, 96, 0.82);
        background: transparent;
        color: #f28b8b;
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
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
      .vw-access-preview-overlay-badges {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
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
      .vw-access-preview-badges {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
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
        background: rgba(10, 14, 24, 0.64);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        font-size: .82rem;
      }
      .card-actions-wrap--preview {
        margin-top: 2px;
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
      .vw-access-add-dialog-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .vw-access-add-dialog-title {
        color: var(--text-secondary, rgba(255,255,255,0.78));
        font-size: .9rem;
        line-height: 1.4;
      }
      .vw-access-add-dialog-close {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.2));
        background: rgba(255,255,255,0.08);
        color: var(--text-primary, #fff);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        line-height: 1;
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
      .vw-access-add-dialog-btn.is-active {
        border-color: rgba(92, 150, 255, 0.9);
        box-shadow: 0 0 0 1px rgba(92, 150, 255, 0.45) inset;
        background: rgba(45, 143, 225, 0.18);
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
        grid-template-columns: auto auto minmax(0, 1fr);
        align-items: center;
        gap: 10px;
      }
      .vw-access-objects-topbar-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        justify-self: end;
        min-width: 0;
      }
      .vw-access-objects-topbar-actions--right .vw-access-sub-btn {
        min-height: 34px;
        border-radius: 10px;
        padding: 0 6px;
      }
      .vw-access-objects-bottombar--wishlist {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .vw-access-objects-bottombar--wishlist .vw-access-sub-btn {
        min-height: 42px;
        padding: 0 14px;
        font-size: .92rem;
      }
      .vw-access-objects-bottombar,
      .vw-access-objects-bottombar--wishlist {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-top: 10px;
        padding: 0 6px 4px;
      }
      .vw-access-objects-bottombar .vw-access-sub-btn,
      .vw-access-objects-bottombar--wishlist .vw-access-sub-btn {
        min-height: 44px;
        font-size: .95rem;
        border-radius: 12px;
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
      .vw-access-obj-list--empty {
        min-height: 200px;
        align-content: start;
      }
      .vw-access-obj-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
        gap: 20px;
        border: 1px solid var(--border-light, rgba(255,255,255,0.14));
        background: var(--bg-element, rgba(255,255,255,0.12));
        border-radius: 12px;
        padding: 12px 10px;
        min-height: 104px;
        cursor: pointer;
      }
      .vw-access-obj-card.is-selected {
        border-color: rgba(45, 143, 225, 0.75);
        box-shadow: 0 0 0 1px rgba(45, 143, 225, 0.35) inset;
      }
      .vw-access-obj-check {
        padding-top: 30px;
      }
      .vw-access-obj-card--admin .vw-access-obj-side {
        display: grid;
        gap: 10px;
        justify-items: center;
        align-content: start;
      }
      .vw-access-obj-card--admin .vw-access-obj-check {
        padding-top: 0;
      }
      .vw-access-obj-check input {
        width: 18px;
        height: 18px;
        accent-color: var(--color-accent, #4ea0ff);
      }
      .vw-access-obj-main {
        min-width: 0;
      }
      .vw-access-obj-headline {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }
      .vw-access-obj-badges {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-wrap: wrap;
      }
      .vw-access-obj-edit {
        flex: 0 0 auto;
        min-width: 24px;
        min-height: 24px;
        border-radius: 8px;
        border: 1px solid rgba(92, 150, 255, 0.55);
        background: rgba(92, 150, 255, 0.12);
        color: var(--text-primary, #fff);
        font-size: .95rem;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .vw-access-obj-edit:active {
        transform: translateY(1px);
      }
      .vw-access-obj-delete {
        flex: 0 0 auto;
        min-width: 24px;
        min-height: 24px;
        border-radius: 8px;
        border: 1px solid rgba(236, 96, 96, 0.72);
        background: rgba(236, 96, 96, 0.12);
        color: var(--text-primary, #fff);
        font-size: .50rem;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .vw-access-obj-delete:active {
        transform: translateY(1px);
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
      .vw-access-obj-pill {
        font-size: .72rem;
        line-height: 1;
        color: var(--text-primary, #fff);
        border: 1px solid rgba(92, 150, 255, 0.7);
        background: rgba(92, 150, 255, 0.12);
        border-radius: 999px;
        padding: 4px 10px;
        white-space: nowrap;
      }
      .vw-access-obj-title {
        margin: 10px 0 0;
        font-size: .86rem;
        font-weight: 600;
        color: var(--text-primary, #fff);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vw-access-obj-meta {
        margin-top: 10px;
        font-size: .78rem;
        color: var(--text-secondary, rgba(255,255,255,0.76));
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
            <button type="button" class="vw-access-item vw-access-item--primary" data-role="admin-add-property"><span class="vw-access-item__icon" aria-hidden="true">➕</span><span class="vw-access-item__label">Добавить объект</span></button>
            <button type="button" class="vw-access-item" data-role="admin-properties"><span class="vw-access-item__icon" aria-hidden="true">🏠</span><span class="vw-access-item__label">${locale.accessAdminProperties || "Мої об'єкти"}</span></button>
            <button type="button" class="vw-access-item" data-role="admin-wishlist"><span class="vw-access-item__icon" aria-hidden="true">♡</span><span class="vw-access-item__label">${locale.accessUserWishlist || 'Моя подборка'}</span></button>
            <button type="button" class="vw-access-item" data-role="admin-stats"><span class="vw-access-item__icon" aria-hidden="true">📊</span><span class="vw-access-item__label">${locale.accessAdminStats || 'Статистика'}</span></button>
            <button type="button" class="vw-access-item" data-role="admin-subscription"><span class="vw-access-item__icon" aria-hidden="true">💳</span><span class="vw-access-item__label">${locale.accessAdminSubscription || 'Керування підпискою'}</span></button>
            <button type="button" class="vw-access-item" data-role="olx-connect"><span class="vw-access-item__icon" aria-hidden="true">🔗</span><span class="vw-access-item__label">${locale.accessAdminOlxConnect || 'Подключить OLX'}</span></button>
            <button type="button" class="vw-access-item" data-role="olx-sync"><span class="vw-access-item__icon" aria-hidden="true">⬇️</span><span class="vw-access-item__label">${locale.accessAdminOlxSync || 'Импортировать объекты OLX'}</span></button>
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
          <div class="vw-access-list">
            <button type="button" class="vw-access-item vw-access-item--primary" data-role="user-wishlist">
              <span class="vw-access-item__icon" aria-hidden="true">♡</span>
              <span class="vw-access-item__label">${locale.accessUserWishlist || 'Моя подборка'}</span>
              <span class="vw-access-item__count" data-role="user-wishlist-count">0</span>
            </button>
          </div>
          <div class="vw-access-hint">${locale.accessUserEmpty || "Тут з'являться об'єкти, які ви додасте до обраного (Wishlist)"}</div>
        </div>
      `;

    this.getRoot().appendChild(overlay);
    this._accessOverlayOpen = true;
    if (isAdmin) this.updateAdminWishlistMenuBadge(overlay);
    else this.updateUserWishlistMenuCount(overlay);
    overlay.querySelector('[data-role="close"]')?.addEventListener('click', () => this.closeAccessOverlay());
    const olxConnectBtn = overlay.querySelector('[data-role="olx-connect"]');
    const olxSyncBtn = overlay.querySelector('[data-role="olx-sync"]');
    if (olxConnectBtn) {
      olxConnectBtn.addEventListener('click', () => this.openOlxConnectFlow(olxConnectBtn));
      this.refreshOlxStatusButton(olxConnectBtn, olxSyncBtn || null).catch(() => {});
    }
    if (olxSyncBtn) {
      olxSyncBtn.disabled = false;
      this.setAccessButtonLabel(olxSyncBtn, locale.accessAdminOlxSync || 'Import OLX adverts');
      olxSyncBtn.addEventListener('click', () => this.syncOlxAdverts(olxSyncBtn));
    }
    overlay.querySelector('[data-role="admin-add-property"]')?.addEventListener('click', () => this.openAccessSubOverlay('add-property'));
    overlay.querySelector('[data-role="admin-stats"]')?.addEventListener('click', () => this.openAccessSubOverlay('stats'));
    overlay.querySelector('[data-role="admin-properties"]')?.addEventListener('click', async () => {
      try { await this.ensureAdminFullCatalogLoaded(); } catch {}
      this.openAccessSubOverlay('properties');
    });
    overlay.querySelector('[data-role="admin-wishlist"]')?.addEventListener('click', () => this.openAccessSubOverlay('wishlist'));
    overlay.querySelector('[data-role="admin-subscription"]')?.addEventListener('click', () => this.openAccessSubOverlay('subscription'));
    overlay.querySelector('[data-role="user-wishlist"]')?.addEventListener('click', () => this.openAccessSubOverlay('wishlist'));
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
    <button type="button" class="img-lightbox-nav img-lightbox-nav--prev" id="imgLightboxPrev" aria-label="Previous image">‹</button>
    <img id="imgLightboxImg" alt="">
    <button type="button" class="img-lightbox-nav img-lightbox-nav--next" id="imgLightboxNext" aria-label="Next image">›</button>
    <div class="lightbox-counter" id="imgLightboxCounter">1 / 1</div>
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
  this.getEntryGreetingMessage = () => {
    const selectionIdsFromUrl = this.getDeepLinkSelectionIdsFromUrl();
    const deepLinkSelectionActive = this._isDeepLinkMode === true && this._deepLinkModeType === 'selection';
    const count = selectionIdsFromUrl.length > 0
      ? selectionIdsFromUrl.length
      : (deepLinkSelectionActive && Array.isArray(this._deepLinkSelectionIds) ? this._deepLinkSelectionIds.length : 0);
    if (count > 0 && (selectionIdsFromUrl.length > 0 || deepLinkSelectionActive)) {
      return `Здравствуйте! Для вас подготовлена подборка из ${count} объектов. Листайте карточки, а если захотите увидеть больше объектов - я здесь что бы помочь!`;
    }
    return this.t('assistantGreeting') || '';
  };
  this.showGreetingMessage = () => {
    try { this.ui?.addMessage?.({ type: 'assistant', content: this.getEntryGreetingMessage(), timestamp: new Date(), greeting: true }); } catch {}
  };
  // (legacy) this.showDetailsScreen was used for v1 Details screen — removed
  
  // Image Lightbox — open/close helpers
  this._lightboxGallery = [];
  this._lightboxIndex = 0;
  this._getLightboxCounterLabel = () => {
    const total = Array.isArray(this._lightboxGallery) ? this._lightboxGallery.length : 0;
    const current = total ? (this._lightboxIndex + 1) : 0;
    return `${current} / ${total || 0}`;
  };
  this._renderLightboxState = () => {
    try {
      const box = this.$byId('imgLightbox');
      const img = this.$byId('imgLightboxImg');
      const prevBtn = this.$byId('imgLightboxPrev');
      const nextBtn = this.$byId('imgLightboxNext');
      const counter = this.$byId('imgLightboxCounter');
      if (!box || !img) return;
      const list = Array.isArray(this._lightboxGallery) ? this._lightboxGallery : [];
      const total = list.length;
      if (!total) return;
      const safeIndex = ((Number(this._lightboxIndex) || 0) % total + total) % total;
      this._lightboxIndex = safeIndex;
      img.src = list[safeIndex] || '';
      if (counter) counter.textContent = this._getLightboxCounterLabel();
      const showNav = total > 1;
      if (prevBtn) prevBtn.style.display = showNav ? 'inline-flex' : 'none';
      if (nextBtn) nextBtn.style.display = showNav ? 'inline-flex' : 'none';
    } catch {}
  };
  this.stepImageOverlay = (dir = 1) => {
    try {
      const list = Array.isArray(this._lightboxGallery) ? this._lightboxGallery : [];
      if (!list.length) return;
      this._lightboxIndex = this._lightboxIndex + (dir >= 0 ? 1 : -1);
      this._renderLightboxState();
    } catch {}
  };
  this.openImageOverlay = (input, opts = {}) => {
    try {
      const incomingList = Array.isArray(opts.images) ? opts.images : (Array.isArray(input) ? input : []);
      const normalizedList = incomingList
        .map((v) => String(v || '').trim())
        .filter((v) => v && !/^data:image\/svg\+xml/i.test(v));
      const uniqueList = [...new Set(normalizedList)];
      const fallbackUrl = Array.isArray(input) ? '' : String(input || '').trim();
      if (!uniqueList.length && !fallbackUrl) return;
      const box = this.$byId('imgLightbox');
      if (!box) return;
      const list = uniqueList.length ? uniqueList : [fallbackUrl];
      const requestedIndex = Number(opts.index);
      let startIndex = Number.isFinite(requestedIndex) ? requestedIndex : 0;
      if (fallbackUrl) {
        const byUrl = list.indexOf(fallbackUrl);
        if (byUrl >= 0) startIndex = byUrl;
      }
      this._lightboxGallery = list;
      this._lightboxIndex = startIndex;
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      this._imageOverlayOpen = true;
      this._renderLightboxState();
    } catch {}
  };
  this.closeImageOverlay = () => {
    try {
      const box = this.$byId('imgLightbox');
      const img = this.$byId('imgLightboxImg');
      const counter = this.$byId('imgLightboxCounter');
      if (img) img.src = '';
      if (counter) counter.textContent = '0 / 0';
      if (box) {
        box.classList.remove('open');
        box.setAttribute('aria-hidden', 'true');
      }
      this._lightboxGallery = [];
      this._lightboxIndex = 0;
      this._imageOverlayOpen = false;
    } catch {}
  };
  this._collectSlideGalleryImages = (slide) => {
    try {
      if (!slide) return [];
      const urls = [];
      const push = (value) => {
        const v = String(value || '').trim();
        if (!v || /^data:image\/svg\+xml/i.test(v)) return;
        if (!urls.includes(v)) urls.push(v);
      };
      const mainImg = slide.querySelector('.cs-image-click-area img');
      if (mainImg?.src) push(mainImg.src);
      slide.querySelectorAll('.card-front-assets .card-back-asset, .card-back-asset').forEach((asset) => {
        push(asset.getAttribute('data-full-image'));
        push(asset.getAttribute('data-thumb-image'));
      });
      return urls;
    } catch {
      return [];
    }
  };
  // Lightbox interactions: click outside image closes
  try {
    const box = this.$byId('imgLightbox');
    const img = this.$byId('imgLightboxImg');
    const prevBtn = this.$byId('imgLightboxPrev');
    const nextBtn = this.$byId('imgLightboxNext');
    if (box) {
      if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stepImageOverlay(-1);
      });
      if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stepImageOverlay(1);
      });
      box.addEventListener('click', (e) => {
        if (e.target?.closest?.('.img-lightbox-nav')) return;
        if (img && !img.contains(e.target)) {
          e.stopPropagation();
          this.closeImageOverlay();
        }
      });
      // Swipe left/right to navigate on touch devices
      let sx = 0, sy = 0, st = 0;
      const distThresh = 30, timeThresh = 500;
      box.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        sx = t.clientX; sy = t.clientY; st = Date.now();
      }, { passive: true });
      box.addEventListener('touchend', (e) => {
        const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
        if (!t) return;
        const dx = t.clientX - sx;
        const dy = t.clientY - sy;
        const dt = Date.now() - st;
        if (dt <= timeThresh && Math.abs(dx) > distThresh && Math.abs(dx) > Math.abs(dy) * 1.2) {
          this.stepImageOverlay(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
    }
    if (img) {
      img.addEventListener('click', (e) => e.stopPropagation()); // prevent closing by clicking on image
    }
  } catch {}
  // Global ESC: close image overlay first, then (if none) close widget
  this._onGlobalKeydown = (e) => {
    if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    if (!this.classList.contains('open')) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && this._imageOverlayOpen) {
      e.preventDefault();
      e.stopPropagation();
      this.stepImageOverlay(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (e.key !== 'Escape') return;
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
      if (assetUrl) {
        const slide = assetEl.closest('.card-slide');
        const gallery = this._collectSlideGalleryImages(slide);
        const index = gallery.indexOf(assetUrl);
        this.openImageOverlay(assetUrl, { images: gallery, index: index >= 0 ? index : 0 });
        return;
      }
    }
    // ignore clicks on navigation/dots/buttons and keep click ownership local
    if (e.target.closest('.cards-dots-row, .cards-dot')) {
      try { e.stopPropagation(); } catch {}
      return;
    }
    if (e.target.closest('button')) return;
    // 1) direct <img> inside card screen
    const imgEl = e.target.closest('.card-screen .cs-image-click-area img');
    if (imgEl && imgEl.src) {
      const slide = imgEl.closest('.card-slide');
      const gallery = this._collectSlideGalleryImages(slide);
      const index = gallery.indexOf(imgEl.src);
      this.openImageOverlay(imgEl.src, { images: gallery, index: index >= 0 ? index : 0 });
      return;
    }
    // 2) property card background or card mock image areas
    const bgEl = e.target.closest('.card-image, .card-mock .cm-image, .card-screen .cs-image-click-area');
    if (bgEl) {
      const url = this._extractBgUrl(bgEl);
      if (url) {
        const slide = bgEl.closest('.card-slide');
        const gallery = this._collectSlideGalleryImages(slide);
        const index = gallery.indexOf(url);
        this.openImageOverlay(url, { images: gallery, index: index >= 0 ? index : 0 });
        return;
      }
      // fallback: if it contains an img, use it
      const innerImg = bgEl.querySelector('img');
      if (innerImg && innerImg.src) {
        const slide = bgEl.closest('.card-slide');
        const gallery = this._collectSlideGalleryImages(slide);
        const index = gallery.indexOf(innerImg.src);
        this.openImageOverlay(innerImg.src, { images: gallery, index: index >= 0 ? index : 0 });
        return;
      }
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
    const closeAllTitlePopovers = () => {
      this.getRoot().querySelectorAll('.cs-title-popover.open').forEach((node) => {
        node.classList.remove('open');
        node.setAttribute('aria-hidden', 'true');
      });
    };
    const titleTrigger = e.target.closest('[data-action="toggle-title"]');
    if (!titleTrigger && !e.target.closest('[data-role="title-popover"]')) {
      closeAllTitlePopovers();
    }
    if (titleTrigger) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      const slide = titleTrigger.closest('.card-slide');
      const popover = slide?.querySelector('[data-role="title-popover"]');
      if (popover) {
        const willOpen = !popover.classList.contains('open');
        closeAllTitlePopovers();
        if (willOpen) {
          popover.classList.add('open');
          popover.setAttribute('aria-hidden', 'false');
        }
      }
      return;
    }
    const likeBtn = e.target.closest('.card-btn[data-action="like"]');
    if (likeBtn) {
      // UI toggle (фиксируем состояние сердечка). При отключении — без side-effects.
      let isLiked = false;
      try {
        likeBtn.classList.toggle('is-liked');
        isLiked = likeBtn.classList.contains('is-liked');
      } catch {}
      const variantId = likeBtn.getAttribute('data-variant-id');
      this.toggleWishlistSelection(variantId, isLiked);
      this.syncWishlistButtonsInDom();
      if (!isLiked) return;
      
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
    } else if (e.target.closest('.list-card__assets .card-back-asset')) {
      return;
    } else if (e.target.closest('[data-action="list-open-full"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      const variantId = String(e.target.closest('[data-action="list-open-full"]')?.getAttribute('data-variant-id') || '').trim();
      if (variantId) this.openCatalogCardInSlider(variantId);
      return;
    } else if (e.target.closest('[data-action="list-expand"]')) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      const slide = e.target.closest('.card-slide');
      this.toggleCatalogListExpand(slide);
      return;
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
      if (this._isDeepLinkMode && this._deepLinkModeType === 'property') {
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
      try {
        const ok = this.sharePropertyToTelegram(slide);
        if (!ok) await this.sharePropertyFromSlide(slide);
      } catch {
        try { await this.sharePropertyFromSlide(slide); } catch {}
      }
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
    if (cards.length) window.appState.lastBackendCandidatesAt = Date.now();
    if (data.insights && typeof data.insights === 'object') {
      const migratedInsights = this.understanding?.migrateInsights?.(data.insights) || data.insights;
      this._catalogManualFilterOverrides = null;
      this._catalogIgnoreAssistantBaseFilters = false;
      this._catalogLastRefineMode = 'ai';
      this.refreshCatalogByEffectiveQuery(migratedInsights).catch((error) => {
        console.warn('refreshCatalogByEffectiveQuery failed:', error);
      });
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
    const priceUSD = raw.priceUSD ?? raw.price_usd ?? raw.priceUsd ?? raw.price_amount ?? raw.priceAmount ?? raw.priceEUR ?? null;
    const price = raw.price ?? priceUSD ?? null;
    const areaM2 = raw.area_m2 ?? raw.specs_area_m2 ?? raw.specs?.area_m2 ?? null;
    const numericArea = Number(areaM2);
    const numericPrice = Number(price);
    const computedPricePerM2 = Number.isFinite(numericPrice) && numericPrice > 0 && Number.isFinite(numericArea) && numericArea > 0
      ? Math.round(numericPrice / numericArea)
      : null;
    const parsedScore = Number(raw.score ?? raw._score);
    const parsedStrictScore = Number(raw.strictScore ?? raw._strictScore);
    const fallbackTitle = (() => {
      const direct = String(raw.title || raw.headline || '').trim();
      if (direct) return direct;
      const fromDescription = String(raw.description || '').trim();
      if (!fromDescription) return '';
      return fromDescription.length > 120 ? `${fromDescription.slice(0, 117)}...` : fromDescription;
    })();
    return {
      ...raw,
      id: raw.id || raw.external_id || raw.externalId || raw.propertyId || raw.uid || '',
      title: fallbackTitle,
      image,
      images: Array.isArray(raw.images)
        ? raw.images
        : (typeof raw.images === 'string' && raw.images.trim() ? [raw.images.trim()] : (image ? [image] : [])),
      price,
      priceUSD,
      priceEUR: priceUSD,
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
    this._mergeIntoFullCatalogProperties(incoming);
  }

  replacePropertiesCatalog(properties = []) {
    const incoming = this._extractPropertiesList(properties);
    if (!window.appState) window.appState = {};
    window.appState.allProperties = incoming.map((item) => this._toCardEngineShape(item));
  }

  _computeNextManualExternalId(properties = []) {
    const list = Array.isArray(properties) ? properties : [];
    const max = list.reduce((acc, item) => {
      const id = String(item?.external_id || item?.externalId || item?.id || '').trim().toUpperCase();
      const m = id.match(/^A(\d+)$/);
      if (!m) return acc;
      const n = Number(m[1]);
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `A${String(max + 1).padStart(3, '0')}`;
  }

  async resolveNextManualExternalId() {
    const cached = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    if (cached.length) return this._computeNextManualExternalId(cached);
    try {
      const all = await this.loadAllProperties();
      if (Array.isArray(all) && all.length) return this._computeNextManualExternalId(all);
    } catch {}
    return 'A001';
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
          this._setFullCatalogProperties(all);
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
    this._catalogActiveId = null;
    this._catalogListWindowStart = 0;
    this._catalogStrictEndPromptShown = false;
    this._catalogSimilarEndPromptShown = false;
    this._catalogSimilarLoading = false;
    try { this.closeSliderCheckpointPopup(); } catch {}
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

  _isStrictFlowQuery(query = {}) {
    if (!query || typeof query !== 'object') return false;
    return Object.keys(query).some((key) => {
      if (key === 'limit') return false;
      const value = query[key];
      if (value == null) return false;
      if (typeof value === 'boolean') return value === true;
      const text = String(value).trim();
      if (!text) return false;
      if (text === 'false') return false;
      return true;
    });
  }

  _normalizeDistrictForRelax(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (/примор|промор|primor|promor/.test(raw)) return 'primorsky';
    if (/киев|kiev|kyiv|таир|tairo/.test(raw)) return 'kievsky';
    if (/сувор|suvor/.test(raw)) return 'suvorovsky';
    if (/малин|malin/.test(raw)) return 'malinovsky';
    if (/хаджиб|hadzhib|hadji/.test(raw)) return 'hadzhibeyskyi';
    if (/лиман|liman/.test(raw)) return 'kievsky';
    if (/крыжан|крижан|kryzhan|kryjan/.test(raw)) return 'suvorovsky';
    if (/аванг|avang/.test(raw)) return 'malinovsky';
    return raw;
  }

  _computeRelaxStepForCandidate(item = {}, query = {}) {
    const toNum = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const text = (v) => String(v || '').trim().toLowerCase();
    const canonicalOperation = (v) => {
      const t = text(v);
      if (!t) return '';
      if (/(buy|sale|sell|purchase|покуп|купит|продаж)/i.test(t)) return 'sale';
      if (/(rent|lease|аренд|снять)/i.test(t)) return 'rent';
      return t;
    };
    const canonicalType = (v) => {
      const t = text(v);
      if (!t) return '';
      if (/(apartment|flat|квартир|апартамент|апарты)/i.test(t)) return 'apartment';
      if (/(house|villa|home|дом|таунхаус|таун)/i.test(t)) return 'house';
      if (/(land|plot|участок|земл)/i.test(t)) return 'land';
      if (/(commercial|office|retail|склад|коммер|офис|нежил)/i.test(t)) return 'commercial';
      return t;
    };
    const boolish = (v) => {
      if (v === true || v === false) return v;
      const t = text(v);
      if (!t) return null;
      if (['1', 'true', 'yes', 'y', 'да', 'так', 'є'].includes(t)) return true;
      if (['0', 'false', 'no', 'n', 'нет', 'ні'].includes(t)) return false;
      return null;
    };
    const canonicalDistrict = (value) => {
      const d = this._normalizeDistrictForRelax(value || '');
      if (d === 'hadzhibeyskyi') return 'malinovsky';
      if (d === 'peresypskyi') return 'suvorovsky';
      return d;
    };
    const districtRank = (fromDistrict, candidateDistrict) => {
      const from = canonicalDistrict(fromDistrict);
      const to = canonicalDistrict(candidateDistrict);
      if (!from || !to) return null;
      if (from === to) return 0;
      const orderMap = {
        primorsky: ['kievsky', 'malinovsky', 'suvorovsky'],
        kievsky: ['primorsky', 'malinovsky', 'suvorovsky'],
        malinovsky: ['kievsky', 'primorsky', 'suvorovsky'],
        suvorovsky: ['primorsky', 'kievsky', 'malinovsky']
      };
      const order = orderMap[from];
      if (!Array.isArray(order)) return null;
      const idx = order.indexOf(to);
      return idx >= 0 ? (idx + 1) : null;
    };

    const qOp = canonicalOperation(query.operation);
    const iOp = canonicalOperation(item.operation);
    if (qOp && iOp && qOp !== iOp) return null;

    const qType = canonicalType(query.type);
    const iType = canonicalType(item.property_type || item.type);
    if (qType && iType && qType !== iType) return null;

    const qDistrict = canonicalDistrict(query.district || '');
    const iDistrict = canonicalDistrict(item.district || item.neighborhood || item.city || '');

    const qRc = text(query.residentialComplex);
    const iRc = text(item?.features?.complex || item?.features?.display_specs?.complex);
    if (query.rcOnly === true && !iRc) return null;

    const price = toNum(item.priceUSD ?? item.priceEUR ?? item.price_amount);
    const priceAnchor = toNum(query.__priceAnchor ?? query.__budgetAnchor);
    let penalty = 0;
    if (priceAnchor != null && priceAnchor > 0 && price != null) {
      const rel = Math.abs(price - priceAnchor) / priceAnchor;
      if (rel > 0.5) return null; // hard cap ±50%
      if (rel > 0.35) penalty += 4;
      else if (rel > 0.25) penalty += 2;
      else if (rel > 0.15) penalty += 1;
    }

    if (qRc) {
      if (!iRc) {
        if (query.rcOnly !== true) penalty += 4;
      } else if (!iRc.includes(qRc)) {
        // Similar mode: when exact ЖК is exhausted, allow other ЖК with penalty.
        penalty += query.rcOnly === true ? 3 : 4;
      }
    }

    if (qDistrict) {
      const rank = districtRank(qDistrict, iDistrict);
      if (rank === 0) {
        // same district, no penalty
      } else if (rank === 1) {
        penalty += 1;
      } else if (rank === 2) {
        penalty += 2;
      } else if (rank === 3) {
        penalty += 3;
      } else if (!iDistrict) {
        penalty += 3;
      } else {
        return null;
      }
    }

    const area = toNum(item.area_m2);
    const areaAnchor = toNum(query.__areaAnchor);
    if (areaAnchor != null && areaAnchor > 0 && area != null) {
      const rel = Math.abs(area - areaAnchor) / areaAnchor;
      if (rel > 0.5) return null; // hard cap ±50%
      if (rel > 0.35) penalty += 3;
      else if (rel > 0.25) penalty += 2;
      else if (rel > 0.15) penalty += 1;
    }

    // Similar mode: floors are intentionally ignored.

    const roomsRaw = String(query.rooms || '').trim();
    const roomsWanted = toNum(query.__roomsAnchor ?? (roomsRaw === '4plus' ? 4 : (roomsRaw ? Number(roomsRaw) : null)));
    const roomsActual = toNum(item.rooms);
    if (roomsWanted != null && Number.isFinite(roomsWanted) && roomsActual != null) {
      if (Math.abs(roomsActual - roomsWanted) > 1) return null; // hard cap ±1 room
      if (roomsActual !== roomsWanted) penalty += 3;
    }

    // Amenity requests are softer than price/area/rooms
    if (query.parking === true) {
      const hasParking = boolish(item?.features?.parking) === true || boolish(item?.features?.has_parking) === true;
      if (!hasParking) penalty += 1;
    }
    if (query.balconyLoggia === true) {
      const hasBalcony = boolish(item?.balcony) === true
        || boolish(item?.features?.balcony) === true
        || boolish(item?.features?.has_balcony) === true
        || boolish(item?.features?.loggia) === true;
      if (!hasBalcony) penalty += 1;
    }

    // 10/10 -> 7/10 -> 5/10 -> 3/10 style ladder
    if (penalty <= 0) return 1;
    if (penalty <= 2) return 2;
    if (penalty <= 4) return 3;
    if (penalty <= 6) return 4;
    return 5;
  }

  _getCurrentCatalogActiveIndex() {
    try {
      const slider = this.getRoot().querySelector('.cards-slider');
      if (!slider) return -1;
      const slides = Array.from(slider.querySelectorAll('.card-slide'));
      if (!slides.length) return -1;
      const active = slider.querySelector('.card-slide.active');
      if (!active) return slides.length - 1;
      return Math.max(0, slides.indexOf(active));
    } catch {
      return -1;
    }
  }

  showStrictEndPopup() {
    if (this._catalogStrictEndPromptShown) return;
    this._catalogStrictEndPromptShown = true;
    this.closeSliderCheckpointPopup();
    this.ensureSliderCheckpointStyles();
    const locale = this.getCurrentLocale();
    const overlay = document.createElement('div');
    overlay.id = 'vwSliderCheckpointOverlay';
    overlay.className = 'vw-slider-checkpoint-overlay';
    overlay.innerHTML = `
      <div class="vw-slider-checkpoint-modal" role="dialog" aria-modal="true" aria-label="Strict matches ended">
        <div class="vw-slider-checkpoint-title">${locale.strictEndTitle || 'Точные объекты закончились'}</div>
        <div class="vw-slider-checkpoint-text">${locale.strictEndText || 'По вашему запросу вы просмотрели все точные совпадения. Хотите уточнить фильтры или показать похожие объекты?'}</div>
        <div class="vw-slider-checkpoint-actions">
          <button type="button" class="vw-slider-checkpoint-btn" data-role="refine">${locale.strictEndRefine || 'Уточнить'}</button>
          <button type="button" class="vw-slider-checkpoint-btn vw-slider-checkpoint-btn--primary" data-role="similar">${locale.strictEndSimilar || 'Показать похожие'}</button>
        </div>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    overlay.querySelector('[data-role="refine"]')?.addEventListener('click', () => {
      this.closeSliderCheckpointPopup();
      try {
        if (this._catalogLastRefineMode === 'ai') {
          this.$byId('textInput')?.focus();
        } else {
          this.openFiltersOverlay();
        }
      } catch {}
    });
    overlay.querySelector('[data-role="similar"]')?.addEventListener('click', async () => {
      try {
        await this.unlockCatalogSimilarMode();
      } finally {
        this.closeSliderCheckpointPopup();
      }
    });
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) this.closeSliderCheckpointPopup();
    });
  }

  showSimilarEndPopup() {
    if (this._catalogSimilarEndPromptShown) return;
    this._catalogSimilarEndPromptShown = true;
    this.closeSliderCheckpointPopup();
    this.ensureSliderCheckpointStyles();
    const locale = this.getCurrentLocale();
    const overlay = document.createElement('div');
    overlay.id = 'vwSliderCheckpointOverlay';
    overlay.className = 'vw-slider-checkpoint-overlay';
    overlay.innerHTML = `
      <div class="vw-slider-checkpoint-modal" role="dialog" aria-modal="true" aria-label="Similar matches ended">
        <div class="vw-slider-checkpoint-title">${locale.similarEndTitle || 'Похожие объекты закончились'}</div>
        <div class="vw-slider-checkpoint-text">${locale.similarEndText || 'Мы показали все похожие объекты по вашему запросу. Вы можете продолжить самостоятельный поиск или связаться для консультации.'}</div>
        <div class="vw-slider-checkpoint-actions">
          <button type="button" class="vw-slider-checkpoint-btn" data-role="continue">${locale.similarEndContinue || 'Продолжить поиск'}</button>
          <button type="button" class="vw-slider-checkpoint-btn vw-slider-checkpoint-btn--primary" data-role="contact">${locale.similarEndContact || 'Связаться'}</button>
        </div>
      </div>
    `;
    this.getRoot().appendChild(overlay);
    overlay.querySelector('[data-role="continue"]')?.addEventListener('click', () => {
      this.closeSliderCheckpointPopup();
    });
    overlay.querySelector('[data-role="contact"]')?.addEventListener('click', () => {
      this.closeSliderCheckpointPopup();
      try { this.openContactManagerPopup({ source: 'tg_similar_end_popup' }); } catch {}
    });
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        this.closeSliderCheckpointPopup();
      }
    });
  }

  async unlockCatalogSimilarMode() {
    if (this._catalogSimilarLoading) return;
    this._catalogSimilarLoading = true;
    try {
      if (!Array.isArray(this._catalogRelaxPool)) {
        const source = [];
        const appendSource = (list) => {
          if (!Array.isArray(list) || !list.length) return;
          source.push(...list);
        };
        const ensureFullCatalogSource = async () => {
          appendSource(this._getFullCatalogProperties());
          if (this._getFullCatalogProperties().length) return;
          try {
            const all = await this.loadAllProperties();
            if (Array.isArray(all) && all.length) {
              this._setFullCatalogProperties(all);
              appendSource(all);
            }
          } catch {}
        };
        if (this._catalogLastRefineMode === 'filters') {
          appendSource(this._getFullCatalogProperties());
          appendSource(Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : []);
          await ensureFullCatalogSource();
          if (!source.length) {
            const payload = await this.api?.fetchSessionCandidates?.(2000);
            appendSource(Array.isArray(payload?.cards) ? payload.cards : []);
          }
        } else {
          const payload = await this.api?.fetchSessionCandidates?.(2000);
          appendSource(Array.isArray(payload?.cards) ? payload.cards : []);
          await ensureFullCatalogSource();
        }
        const byId = new Map();
        source
          .map((item) => this._toCardEngineShape(item))
          .forEach((item) => {
            const id = String(item?.id || '').trim();
            if (!id) return;
            if (!byId.has(id)) byId.set(id, item);
          });
        this._catalogRelaxPool = Array.from(byId.values());
      }
      const normalized = Array.isArray(this._catalogRelaxPool) ? this._catalogRelaxPool : [];
      if (!normalized.length) return this.showSimilarEndPopup();

      const current = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
      const seen = new Set(current.map((item) => String(this._toCardEngineShape(item)?.id || '').trim()).filter(Boolean));
      const strictSeed = new Set((Array.isArray(this._catalogStrictSeedIds) ? this._catalogStrictSeedIds : []).map((id) => String(id || '').trim()).filter(Boolean));
      const shown = this._catalogRelaxShownIds instanceof Set ? this._catalogRelaxShownIds : new Set();
      const query = this._catalogStrictQuery && typeof this._catalogStrictQuery === 'object' ? this._catalogStrictQuery : {};

      let level = Math.max(0, Number(this._catalogRelaxLevel) || 0);
      let extras = [];
      while (level < 5 && !extras.length) {
        level += 1;
        extras = normalized.filter((item) => {
          const id = String(item?.id || '').trim();
          if (!id || seen.has(id) || strictSeed.has(id) || shown.has(id)) return false;
          const step = this._computeRelaxStepForCandidate(item, query);
          return step != null && step <= level;
        });
      }
      if (!extras.length) return this.showSimilarEndPopup();

      window.appState.allProperties = [...current, ...extras];
      this._mergeIntoFullCatalogProperties(extras);
      extras.forEach((item) => {
        const id = String(item?.id || '').trim();
        if (id) shown.add(id);
      });
      this._catalogRelaxShownIds = shown;
      this._catalogRelaxLevel = level;

      const loadedIds = this.getCatalogLoadedIdsFromStateOrDom();
      const first = extras[0];
      const firstId = String(first?.id || '').trim();
      const queueTail = extras.slice(1);
      this._catalogOverflowQueue = [...(Array.isArray(this._catalogOverflowQueue) ? this._catalogOverflowQueue : []), ...queueTail];
      if (firstId && !loadedIds.includes(firstId)) {
        this._catalogVisibleIds = [...loadedIds, firstId];
        this._catalogActiveId = firstId;
        this.rebuildCatalogLayoutFromVisibleIds();
        if (this._catalogDisplayMode !== 'list') {
          const idx = this._catalogVisibleIds.indexOf(firstId);
          if (idx >= 0) this.scrollToSlideIndex(idx);
        }
      } else {
        this.updateCatalogListNavState();
      }
      this._catalogRelaxedUnlocked = true;
      this._catalogStrictEndPromptShown = false;
      this._catalogSimilarEndPromptShown = false;
    } catch (error) {
      console.warn('unlockCatalogSimilarMode failed:', error);
      this.showSimilarEndPopup();
    } finally {
      this._catalogSimilarLoading = false;
    }
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
    if (this._catalogExpandedCardId) {
      const expandedId = String(this._catalogExpandedCardId).trim();
      const safeSelector = typeof CSS !== 'undefined' && CSS.escape ? `#${CSS.escape(expandedId)}` : `[id="${expandedId.replace(/"/g, '\\"')}"]`;
      const expandedSlide = listBody.querySelector(`.card-slide.list-card-slide${safeSelector}`);
      if (expandedSlide) expandedSlide.classList.add('is-expanded');
      else this._catalogExpandedCardId = null;
    }
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
    this._catalogExpandedCardId = null;
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
    this._catalogExpandedCardId = null;
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
      if (this._catalogStrictFlowActive === true && this._catalogRelaxedUnlocked !== true) {
        this.showStrictEndPopup();
      } else if (this._catalogRelaxedUnlocked === true) {
        this.showSimilarEndPopup();
      }
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
        this._catalogExpandedCardId = null;
      }
      if (prev !== next) this.rebuildCatalogLayoutFromVisibleIds();
    }
  }

  openCatalogCardInSlider(variantId = '') {
    const targetId = String(variantId || '').trim();
    if (!targetId) return;
    try {
      this.setCatalogDisplayMode('slider');
      requestAnimationFrame(() => {
        try {
          const loadedIds = this.getCatalogLoadedIdsFromStateOrDom();
          const idx = loadedIds.indexOf(targetId);
          if (idx >= 0) this.scrollToSlideIndex(idx);
          requestAnimationFrame(() => {
            const sliderHost = this.getRoot().querySelector('.card-screen.cards-slider-host');
            const safeSelector = typeof CSS !== 'undefined' && CSS.escape
              ? `#${CSS.escape(targetId)}`
              : `[id="${targetId.replace(/"/g, '\\"')}"]`;
            const slide = sliderHost?.querySelector(`.cards-slider .card-slide${safeSelector}`);
            if (!slide) return;
            sliderHost.querySelectorAll('.card-slide.flipped').forEach((s) => {
              if (s !== slide) s.classList.remove('flipped', 'card-slide--form-open');
            });
            slide.classList.add('flipped');
            try { this.fitBackSpecsInSlide(slide); } catch {}
          });
        } catch {}
      });
    } catch {}
  }

  toggleCatalogListExpand(slide = null) {
    try {
      if (this._catalogDisplayMode !== 'list') return;
      const targetSlide = slide?.closest?.('.card-slide.list-card-slide');
      if (!targetSlide) return;
      const variantId = String(
        targetSlide.id ||
        targetSlide.querySelector('[data-variant-id]')?.getAttribute('data-variant-id') ||
        ''
      ).trim();
      const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
      if (!host || !variantId) return;
      const willOpen = this._catalogExpandedCardId !== variantId;
      this._catalogExpandedCardId = willOpen ? variantId : null;
      host.querySelectorAll('.card-slide.list-card-slide.is-expanded').forEach((node) => {
        node.classList.remove('is-expanded');
      });
      if (willOpen) targetSlide.classList.add('is-expanded');
    } catch {}
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
      if (!queue.length) {
        if (
          this._catalogStrictFlowActive === true
          && this._catalogRelaxedUnlocked !== true
          && Number(activeIdx) >= Math.max(0, Number(totalSlides) - 1)
        ) {
          this.showStrictEndPopup();
        } else if (
          this._catalogRelaxedUnlocked === true
          && Number(activeIdx) >= Math.max(0, Number(totalSlides) - 1)
        ) {
          this.showSimilarEndPopup();
        }
        return;
      }
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

  renderCatalogFromCurrentState() {
    let list = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    this._sliderCheckpointShown = { 10: false, 20: false };
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

  async renderPropertiesFromCatalog() {
    this._sliderCheckpointShown = { 10: false, 20: false };
    this.renderCatalogFromCurrentState();
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

  _cardFrontHeadline(normalized = {}) {
    return String(normalized.title ?? '').trim();
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
    const escCardText = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escCardAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const headlineTitle = this._cardFrontHeadline(normalized);
    const districtLine = (() => {
      const district = String(normalized.district || '').trim();
      const neighborhood = String(normalized.neighborhood || '').trim();
      if (district && neighborhood && district.toLowerCase() !== neighborhood.toLowerCase()) {
        return `${district} · ${neighborhood}`;
      }
      return district || neighborhood || '';
    })();
    if (isList) {
      slide.classList.add('list-card-slide');
      const fallbackAssetOpenUrl = this.getCardAssetFallbackDataUrl();
      const assetSlots = Array.isArray(normalized.assetImages) ? normalized.assetImages.slice(0, 4) : [];
      while (assetSlots.length < 4) assetSlots.push('');
      const listAssetTilesHtml = assetSlots.map((assetUrl, idx) => {
        const safeUrl = String(assetUrl || '').trim();
        const isThumb = !!safeUrl;
        const openUrl = safeUrl || fallbackAssetOpenUrl;
        const cls = `card-back-asset${isThumb ? ' is-thumb' : ' is-fallback'}`;
        const thumbData = isThumb ? ` data-thumb-image="${safeUrl.replace(/"/g, '&quot;')}"` : '';
        const bgStyle = isThumb ? ` style="background-image:url('${safeUrl.replace(/'/g, "\\'")}')"` : '';
        return `<button type="button" class="${cls}" data-asset-index="${idx}" data-full-image="${openUrl.replace(/"/g, '&quot;')}" aria-label="Open image"${thumbData}${bgStyle}><span class="card-back-asset__label">img</span></button>`;
      }).join('');
      const listMetaParts = [];
      if (normalized.priceLabel) listMetaParts.push(escCardText(normalized.priceLabel));
      if (normalized.rooms) listMetaParts.push(`${escCardText(normalized.rooms)} ${escCardText(this.getLangCode() === 'ua' ? 'кімн.' : 'к')}`);
      if (normalized.area_m2 != null && normalized.area_m2 !== '') listMetaParts.push(`${escCardText(normalized.area_m2)}м2`);
      if (districtLine) listMetaParts.push(escCardText(districtLine));
      const listMetaText = listMetaParts.join('  ·  ') || '—';
      slide.innerHTML = `
        <div class="list-card" data-variant-id="${normalized.id}" data-action="list-expand">
          <div class="list-card__media">
            ${normalized.image
              ? `<img class="list-card__image" src="${normalized.image}" alt="${escCardAttr(headlineTitle || String(normalized.id || '').trim() || 'Photo')}">`
              : '<div class="list-card__image list-card__image--placeholder">No image</div>'}
            <div class="list-card__badges">
              ${normalized.operationBadgeLabel ? `<span class="list-card__badge">${escCardText(normalized.operationBadgeLabel)}</span>` : ''}
              ${normalized.propertyTypeBadgeLabel ? `<span class="list-card__badge">${escCardText(normalized.propertyTypeBadgeLabel)}</span>` : ''}
            </div>
            <span class="list-card__id-media">${escCardText(normalized.id || 'ID')}</span>
            <div class="list-card__assets">${listAssetTilesHtml}</div>
            <button class="list-card__like-media card-btn like${this.isWishlistSelected(normalized.id) ? ' is-liked' : ''}" data-action="like" data-variant-id="${normalized.id}" aria-label="Добавить в подборку">
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
          <div class="list-card__body">
            <div class="list-card__top">
              <div class="list-card__title" title="${escCardAttr(headlineTitle || '—')}">${escCardText(headlineTitle || '—')}</div>
              <button type="button" class="list-card__expand" data-action="list-expand" data-variant-id="${normalized.id}" aria-label="${escCardAttr(locale.handoffDetails || 'Подробнее')}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
            <div class="list-card__meta">${listMetaText}</div>
            <div class="list-card__more-wrap">
              <button type="button" class="list-card__more card-btn select card-more-btn" data-action="list-open-full" data-variant-id="${normalized.id}">
                <span>${locale.handoffDetails || 'Подробнее'}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>`;
      const row = this.ensureCatalogListRow(listBody);
      if (row) row.appendChild(slide);
      if (normalized?.id) {
        const vid = String(normalized.id).trim();
        if (vid) {
          if (!Array.isArray(this._catalogVisibleIds)) this._catalogVisibleIds = [];
          if (!this._catalogVisibleIds.includes(vid)) this._catalogVisibleIds.push(vid);
          this._catalogActiveId = vid;
        }
      }
      const cardId = normalized.id;
      if (cardId && this.api) {
        requestAnimationFrame(() => {
          try {
            this.api.sendCardRendered(cardId);
          } catch (e) {
            console.warn('Failed to send card rendered confirmation:', e);
          }
        });
      }
      requestAnimationFrame(() => {
        try { this.scrollCardHostIntoView(); } catch {}
      });
      return;
    }
    const fallbackAssetOpenUrl = this.getCardAssetFallbackDataUrl();
    const assetSlots = Array.isArray(normalized.assetImages) ? normalized.assetImages.slice(0, 4) : [];
    while (assetSlots.length < 4) assetSlots.push('');
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
    const isUa = this.getLangCode() === 'ua';
    const specsPills = [];
    if (normalized.rooms) specsPills.push(`🛏️ ${normalized.rooms} ${isUa ? 'кімн.' : 'комн.'}`);
    if (normalized.area_m2 != null && normalized.area_m2 !== '') specsPills.push(`📐 ${normalized.area_m2} м²`);
    if (normalized.floor) specsPills.push(`🏢 ${normalized.floor} ${isUa ? 'пов.' : 'этаж'}`);
    const backSpecsItemsBase = [];
    if (normalized.rooms) backSpecsItemsBase.push({ icon: '🛏️', text: `${isUa ? 'Кімнат' : 'Комнат'}: ${normalized.rooms}` });
    if (normalized.area_m2 != null && normalized.area_m2 !== '') backSpecsItemsBase.push({ icon: '📐', text: `${isUa ? 'Площа' : 'Площадь'}: ${normalized.area_m2} м²` });
    if (normalized.pricePerM2Label) backSpecsItemsBase.push({ icon: '💰', text: `${isUa ? 'Ціна за м²' : 'Цена за м²'}: ${normalized.pricePerM2Label} $` });
    if (normalized.floor) backSpecsItemsBase.push({ icon: '🏢', text: `${isUa ? 'Поверх' : 'Этаж'}: ${normalized.floor}` });
    if (normalized.bathrooms) backSpecsItemsBase.push({ icon: '🛁', text: `${isUa ? 'Санвузлів' : 'Санузлов'}: ${normalized.bathrooms}` });
    const dynamicExtras = Array.isArray(normalized.backFeatureItems) ? normalized.backFeatureItems : [];
    const backSpecsItems = [...backSpecsItemsBase, ...dynamicExtras].filter((item) => {
      const text = String(item?.text || '').trim();
      if (!text) return false;
      const lower = text.toLowerCase();
      return !lower.endsWith(': no') && !lower.endsWith(': ні') && !lower.endsWith(': нет');
    });
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
        <div class="cs" data-variant-id="${normalized.id}" data-city="${normalized.city}" data-district="${normalized.district}" data-rooms="${normalized.rooms}" data-price-usd="${normalized.priceUSD}" data-price-eur="${normalized.priceEUR}" data-image="${normalized.image}">
          <div class="cs-image">
            <div class="cs-image-overlay">
              <div class="cs-badge-stack">
                <div class="cs-price-tag">${normalized.id || ''}</div>
                ${normalized.operationBadgeLabel ? `<div class="cs-meta-badge cs-meta-badge--operation">${escCardText(normalized.operationBadgeLabel)}</div>` : ''}
                ${normalized.propertyTypeBadgeLabel ? `<div class="cs-meta-badge cs-meta-badge--type">${escCardText(normalized.propertyTypeBadgeLabel)}</div>` : ''}
              </div>
              <button class="cs-like-btn card-btn like${this.isWishlistSelected(normalized.id) ? ' is-liked' : ''}" data-action="like" data-variant-id="${normalized.id}" aria-label="Добавить в подборку">
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
            <div class="cs-image-click-area">
              <div class="cs-image-media">${normalized.image ? `<img src="${normalized.image}" alt="${escCardAttr(headlineTitle || String(normalized.id || '').trim() || 'Photo')}">` : 'Put image here'}</div>
            </div>
            <div class="card-front-assets">${assetTilesHtml}</div>
          </div>
          <div class="cs-body">
            <div class="cs-row cs-row--top">
              <button
                type="button"
                class="cs-title cs-title-btn"
                data-action="toggle-title"
                aria-label="${locale.cardTitleFullAria || 'Показать полный заголовок'}"
                title="${escCardAttr(headlineTitle || '—')}"
              >${escCardText(headlineTitle || '—')}</button>
            </div>
            <div class="cs-title-popover" data-role="title-popover" aria-hidden="true">${escCardText(headlineTitle || '—')}</div>
            <div class="cs-row cs-row--district">
              <div class="cs-district">${districtLine}</div>
              <div class="cs-price-badges">
                <div class="cs-inline-price cs-inline-price--total">${normalized.priceLabel || ''}</div>
              </div>
            </div>
            <div class="cs-row cs-row--specs">
              <div class="cs-features cs-features--main-specs">${(specsPills.length ? specsPills : ['📐 —']).map((item) => `<span class="cs-feature-item cs-feature-item--pill">${item}</span>`).join('')}</div>
            </div>
            <div class="card-slide-paginator cards-dots-row"></div>
            <div class="card-actions-wrap">
              <button class="card-btn select card-more-btn" data-action="select" data-variant-id="${normalized.id}">
                <span>${locale.handoffDetails || 'Подробнее'}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
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
          <button type="button" class="card-back-description-btn" data-action="read-description" aria-label="${locale.cardReadDescription || 'Читать описание'}">${locale.cardReadDescription || 'Читать описание'}</button>
          <div class="card-back-actions__row">
            <button type="button" class="btn-open-form card-back-primary-action" data-action="contact-manager">${locale.cardBackContact || locale.appHeaderContact || 'Связаться'}</button>
            <button type="button" class="card-back-icon-btn" data-action="share-property" aria-label="Поделиться ссылкой" title="Поделиться ссылкой"><img src="${ASSETS_BASE}link-share-btn.svg" alt="Share link"></button>
            <button type="button" class="card-back-icon-btn" data-action="tg-share-property" aria-label="Поделиться в Telegram" title="Поделиться в Telegram"><img src="${ASSETS_BASE}tg-share-btn.svg" alt="Share in Telegram"></button>
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
    // checkpoint popups 10/20 disabled by product decision
    return;
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
    const toDecimal = (v) => {
      if (v == null) return null;
      const cleaned = String(v)
        .trim()
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/[^0-9.-]/g, '');
      if (!cleaned) return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
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
      if (v === true || v === 'true' || v === 1 || v === '1') return true;
      if (v === false || v === 'false' || v === 0 || v === '0') return false;
      return null;
    };
    const pushExtra = (arr, icon, label, value) => {
      if (value == null) return;
      const text = String(value).trim();
      if (!text) return;
      arr.push({ icon, text: `${label}: ${text}` });
    };
    const priceNum = toInt(raw.price ?? raw.priceUSD ?? raw.price_usd ?? raw.priceUsd ?? raw.price_amount ?? raw.priceAmount ?? raw.priceEUR);
    const roomsNum = toInt(raw.rooms);
    const floorNum = toInt(raw.floor);
    const areaNum = toDecimal(raw.area_m2);
    const pricePerM2Num = toInt(raw.price_per_m2);
    const bathroomsNum = toInt(raw.bathrooms);
    const city = raw.city || raw.location || '';
    const district = raw.district || raw.area || '';
    const neighborhood = raw.neighborhood || raw.neiborhood || raw.neiborhood || '';
    const propertyType = raw.property_type || raw.propertyType || raw.type || '';
    const operationRaw = String(raw.operation || raw.listingMode || '').trim().toLowerCase();
    const isUaLang = this.getLangCode() === 'ua';
    const operationBadgeLabel = operationRaw === 'rent'
      ? 'Аренда'
      : (operationRaw === 'sale' ? 'Продажа' : '');
    const propertyTypeRaw = String(propertyType || '').trim().toLowerCase();
    const propertyTypeBadgeLabel = (() => {
      if (!propertyTypeRaw) return '';
      if (['apartment', 'flat'].includes(propertyTypeRaw)) return 'Квартира';
      if (propertyTypeRaw === 'house') return 'Дом';
      if (propertyTypeRaw === 'commercial') return 'Коммерция';
      if (propertyTypeRaw === 'land') return 'Земля';
      if (propertyTypeRaw === 'parking') return 'Паркинг';
      return propertyType;
    })();
    const mapPropertyTypeLabel = (v) => {
      const rawType = String(v || '').trim().toLowerCase();
      if (!rawType) return '';
      if (['apartment', 'flat'].includes(rawType)) return isUaLang ? 'Квартира' : 'Квартира';
      if (rawType === 'house') return isUaLang ? 'Будинок' : 'Дом';
      if (rawType === 'commercial') return isUaLang ? 'Комерція' : 'Коммерция';
      if (rawType === 'land') return isUaLang ? 'Земля' : 'Земля';
      if (rawType === 'parking') return isUaLang ? 'Паркінг' : 'Паркинг';
      return String(v || '').trim();
    };
    const boolYesLabel = (flag) => (flag === true ? (isUaLang ? 'є' : 'есть') : null);
    const mapOlxHeatingLabel = (v) => {
      const rawValue = String(v || '').trim();
      if (!rawValue) return null;
      const key = rawValue.toLowerCase();
      const dict = {
        own_boiler_house: isUaLang ? 'власна котельня' : 'своя котельная',
        'own_boiler-house': isUaLang ? 'власна котельня' : 'своя котельная',
        individual_gas: isUaLang ? 'індивідуальне газове' : 'индивидуальное газовое',
        centralized: isUaLang ? 'централізоване' : 'централизованное',
        central: isUaLang ? 'централізоване' : 'централизованное',
        electric: isUaLang ? 'електричне' : 'электрическое',
        no_heating: isUaLang ? 'без опалення' : 'без отопления'
      };
      return dict[key] || rawValue;
    };
    const mapOlxRepairLabel = (v) => {
      const rawValue = String(v || '').trim();
      if (!rawValue) return null;
      const key = rawValue.toLowerCase();
      const dict = {
        '1': isUaLang ? 'авторський проєкт' : 'авторский проект',
        '2': isUaLang ? 'євроремонт' : 'евроремонт',
        '4': isUaLang ? 'житловий стан' : 'жилое состояние',
        repaired: isUaLang ? 'з ремонтом' : 'с ремонтом',
        needs_repair: isUaLang ? 'потребує ремонту' : 'требует ремонта'
      };
      if (key === '6') return isUaLang ? 'код OLX 6' : 'код OLX 6';
      return dict[key] || rawValue;
    };
    const title = String(raw.title ?? '').trim();
    const rawFeatures = parseObject(raw.features) || {};
    const displaySpecs = parseObject(raw.display_specs) || parseObject(rawFeatures.display_specs) || null;
    const canonicalComplex = String(rawFeatures.complex || displaySpecs?.complex || '').trim();
    const canonicalExclusive = truthyLabel(rawFeatures.exclusive) === true;
    const canonicalParking = truthyLabel(rawFeatures.parking) === true;
    const canonicalBalconyOrLoggia = truthyLabel(rawFeatures.balcony) === true || truthyLabel(rawFeatures.loggia) === true;
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
    const normalizeAssetKey = (v) => String(v || '').trim();
    const mainImageKey = normalizeAssetKey(image);
    const assetPool = [
      ...readList(raw.images),
      ...readList(raw.assets),
      ...readList(raw.gallery),
      ...readList(raw.photos)
    ]
      .map((v) => normalizeAssetKey(v))
      .filter(Boolean);
    const uniqueAssetPool = [...new Set(assetPool)];
    const assetImages = uniqueAssetPool
      .filter((url) => normalizeAssetKey(url) !== mainImageKey)
      .slice(0, 4);

    const priceLabel = priceNum != null ? `${priceNum.toLocaleString('en-US')} USD` : (raw.price || raw.priceLabel || '');
    const roomsLabel = roomsNum != null ? `${roomsNum} rooms` : (raw.rooms || '');
    const floorLabel = floorNum != null ? `${floorNum} floor` : (raw.floor || '');
    const pricePerM2Label = formatNumberUS(pricePerM2Num != null ? pricePerM2Num : raw.price_per_m2);
    const parsedScore = Number(raw.score ?? raw._score);
    const parsedStrictScore = Number(raw.strictScore ?? raw._strictScore);
    const normalizedTier = String(raw.matchTier ?? raw._tier ?? '').trim().toLowerCase();
    const matchTier = ['high', 'mid', 'low'].includes(normalizedTier) ? normalizedTier : 'low';

    const dynamicBackFeatureItems = [];
    pushExtra(dynamicBackFeatureItems, '🏠', isUaLang ? 'Тип' : 'Тип', mapPropertyTypeLabel(propertyType || rawFeatures.type || rawFeatures.propertyType || rawFeatures.buildingType));
    pushExtra(dynamicBackFeatureItems, '📍', isUaLang ? 'Мікрорайон' : 'Микрорайон', neighborhood);
    pushExtra(dynamicBackFeatureItems, '🏘️', 'ЖК', canonicalComplex);
    if (canonicalExclusive) pushExtra(dynamicBackFeatureItems, '⭐', isUaLang ? 'Ексклюзив' : 'Эксклюзив', isUaLang ? 'так' : 'да');
    const penthouseFlag = truthyLabel(rawFeatures.penthouse);
    if (penthouseFlag === true) pushExtra(dynamicBackFeatureItems, '🏙️', isUaLang ? 'Пентхаус' : 'Пентхаус', boolYesLabel(penthouseFlag));
    const smartFlatFlag = truthyLabel(rawFeatures.smartFlat);
    if (smartFlatFlag === true) pushExtra(dynamicBackFeatureItems, '🧠', isUaLang ? 'Смарт-квартира' : 'Смарт-квартира', boolYesLabel(smartFlatFlag));
    const newbuildingFlag = truthyLabel(rawFeatures.newbuilding);
    if (newbuildingFlag === true) pushExtra(dynamicBackFeatureItems, '🆕', isUaLang ? 'Новобудова' : 'Новострой', boolYesLabel(newbuildingFlag));
    pushExtra(dynamicBackFeatureItems, '🧱', 'Стіни', rawFeatures.wallMaterial || rawFeatures.materialWalls);
    const elevatorFlag = truthyLabel(rawFeatures.elevator);
    if (elevatorFlag === true) pushExtra(dynamicBackFeatureItems, '🛗', isUaLang ? 'Ліфт' : 'Лифт', boolYesLabel(elevatorFlag));
    pushExtra(dynamicBackFeatureItems, '🌤️', isUaLang ? 'Балкон' : 'Балкон', rawFeatures.balconyType || null);
    const balconyFlag = truthyLabel(rawFeatures.balcony);
    const loggiaFlag = truthyLabel(rawFeatures.loggia);
    if (balconyFlag === true) pushExtra(dynamicBackFeatureItems, '🌤️', isUaLang ? 'Балкон' : 'Балкон', boolYesLabel(balconyFlag));
    if (loggiaFlag === true) pushExtra(dynamicBackFeatureItems, '🪟', isUaLang ? 'Лоджія' : 'Лоджия', boolYesLabel(loggiaFlag));
    if (balconyFlag !== true && canonicalBalconyOrLoggia) {
      pushExtra(dynamicBackFeatureItems, '🌤️', isUaLang ? 'Балкон/лоджія' : 'Балкон/лоджия', isUaLang ? 'є' : 'есть');
    }
    pushExtra(dynamicBackFeatureItems, '🛠️', 'Стан', rawFeatures.condition || rawFeatures.objectCondition || rawFeatures.renovation || rawFeatures.finish);
    const parkingFlag = truthyLabel(rawFeatures.parking);
    if (parkingFlag === true) pushExtra(dynamicBackFeatureItems, '🚗', isUaLang ? 'Паркінг' : 'Паркинг', boolYesLabel(parkingFlag));
    if (parkingFlag !== true && canonicalParking) {
      pushExtra(dynamicBackFeatureItems, '🚗', isUaLang ? 'Паркінг' : 'Паркинг', isUaLang ? 'є' : 'есть');
    }
    const terraceFlag = truthyLabel(rawFeatures.terrace);
    if (terraceFlag === true) pushExtra(dynamicBackFeatureItems, '🌿', isUaLang ? 'Тераса' : 'Терраса', boolYesLabel(terraceFlag));
    const furnishedFlag = truthyLabel(rawFeatures.furnished);
    if (furnishedFlag === true) pushExtra(dynamicBackFeatureItems, '🪑', isUaLang ? 'Меблі' : 'Мебель', boolYesLabel(furnishedFlag));
    pushExtra(dynamicBackFeatureItems, '🏗️', 'Поверхів', rawFeatures.buildingFloors);
    pushExtra(dynamicBackFeatureItems, '🏛️', 'Рік', rawFeatures.buildingYear);
    if (Array.isArray(rawFeatures.buildingInfrastructure) && rawFeatures.buildingInfrastructure.length) {
      pushExtra(dynamicBackFeatureItems, '📌', 'Інфраструктура', rawFeatures.buildingInfrastructure.join(', '));
    }
    // Phase-2 prep: consume normalized Group-2 payload from backend (features.display_specs).
    // Old/manual cards may not have this object; in that case the existing fallback logic is used.
    if (displaySpecs) {
      pushExtra(dynamicBackFeatureItems, '📍', 'Улица', displaySpecs.street);
      pushExtra(dynamicBackFeatureItems, '🍳', 'Кухня', displaySpecs.kitchen_area != null ? `${displaySpecs.kitchen_area} м²` : null);
      pushExtra(dynamicBackFeatureItems, '🏗️', 'Этажность', displaySpecs.total_floors);
      pushExtra(dynamicBackFeatureItems, '🔥', isUaLang ? 'Опалення' : 'Отопление', mapOlxHeatingLabel(displaySpecs.heating));
      pushExtra(dynamicBackFeatureItems, '🛠️', 'Ремонт', mapOlxRepairLabel(displaySpecs.repair));
      pushExtra(dynamicBackFeatureItems, '🏙️', 'Инфраструктура', displaySpecs.infrastructure);
      pushExtra(dynamicBackFeatureItems, '🌳', 'Ландшафт', displaySpecs.landscape);
    }

    return {
      id: raw.id || raw.external_id || raw.externalId || raw.propertyId || raw.uid || '',
      image,
      assetImages,
      city,
      district,
      neighborhood,
      title,
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
      operation: operationRaw || '',
      operationBadgeLabel,
      propertyTypeBadgeLabel,
      furnished: furnishedKnown ? furnishedBool : null,
      furnishedLabel: furnishedKnown ? (furnishedBool ? 'Furnished' : 'Unfurnished') : '',
      priceUSD: priceNum != null ? priceNum : null,
      priceEUR: priceNum != null ? priceNum : null,
      priceLabel,
      features: rawFeatures,
      display_specs: displaySpecs,
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
    this._catalogManualFilterOverrides = null;
    this._catalogIgnoreAssistantBaseFilters = false;
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
