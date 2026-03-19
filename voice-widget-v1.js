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
        this.maxRecordingTime = 30;
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

    // Расширенная структура понимания запроса (9 параметров)
    this.understanding = {
      // Блок 1: Основная информация (33.3%)
      name: null,        // 11%
      operation: null,   // 11%
      budget: null,      // 11%

      // Блок 2: Параметры недвижимости (33.3%)
      type: null,        // 11%
      location: null,    // 11%
      rooms: null,       // 11%

      // Блок 3: Детали и предпочтения (33.3%)
      area: null,        // 11%
      details: null,     // 11% (детали локации)
      preferences: null, // 11%

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
      // Блок 1
      name: 11,
      operation: 11,
      budget: 11,
      // Блок 2
      type: 11,
      location: 11,
      rooms: 11,
      // Блок 3
      area: 11,
      details: 11,
      preferences: 11
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

    // v2 Context screen sync: update circular progress and text if present
    try {
      const ctx = this.widget.$byId('contextScreen');
      if (ctx) {
        const ctxText = ctx.querySelector('.progress-text');
        if (ctxText) ctxText.textContent = `${progress}%`;
        const activeArc = ctx.querySelector('.progress-ring svg circle:nth-of-type(2)');
        if (activeArc) {
          const CIRCUMFERENCE = 276.46; // as in v2
          const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
          const offset = Math.max(0, (1 - clamped / 100) * CIRCUMFERENCE);
          activeArc.setAttribute('stroke-dashoffset', String(offset));
        }
      }
    } catch {}

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
      // Основная информация
      name: pick('name'),
      operation: pick('operation', 'operationType'),
      budget: pick('budget'),

      // Параметры недвижимости
      type: pick('type', 'propertyType'),
      location: pick('location', 'district'),
      rooms: pick('rooms'),

      // Детали и предпочтения
      area: pick('area'),
      details: pick('details', 'locationDetails'),
      preferences: pick('preferences', 'additional'),

      // Прогресс
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
    this.setState('main');
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
      mainButton:        this.$byId('mainButton'),

      // Main screen elements
      mainTextInput:     this.$byId('mainTextInput'),
      mainToggleButton:  this.$byId('mainToggleButton'),
      mainSendButton:    this.$byId('mainSendButton'),

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
      // show recording overlays (both screens are safe)
      try { this.widget.showRecordingIndicator('main'); } catch {}
      try { this.widget.showRecordingIndicator('chat'); } catch {}
      this.widget.updateSendButtonState('main');
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('recordingStopped', () => {
      this.setState('idle');
      try { this.widget.hideRecordingIndicator('main'); } catch {}
      try { this.widget.hideRecordingIndicator('chat'); } catch {}
      this.widget.updateSendButtonState('main');
      this.widget.updateSendButtonState('chat');
    });
    this.widget.events.on('recordingCancelled', () => {
      this.setState('idle');
      try { this.widget.hideRecordingIndicator('main'); } catch {}
      try { this.widget.hideRecordingIndicator('chat'); } catch {}
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
        if (textInput) { textInput.disabled = false; textInput.style.opacity = '1'; textInput.placeholder = this.getInputPlaceholder(); }
        sendButton?.classList.remove('active');
        toggleButton?.classList.remove('active');
        break;
      case 'main':
        if (mainTextInput) { mainTextInput.disabled = false; mainTextInput.style.opacity = '1'; mainTextInput.placeholder = this.getInputPlaceholder(); }
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

  // MAIN
  applyMainState() {
    const { mainTextInput, mainToggleButton, mainSendButton } = this.elements;
    if (mainTextInput) { 
      mainTextInput.disabled = false; 
      mainTextInput.style.opacity = '1'; 
      mainTextInput.placeholder = this.getInputPlaceholder(); 
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
    if (hasText && (this.inputState === 'idle' || this.inputState === 'main')) this.setState('typing');
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
      if (text) {
        if (currentTextInput === mainTextInput) {
          this.widget.sendTextFromMainScreen(text);
        } else {
          this.handleSendText();
        }
      } else {
        // Trigger shake animation for empty textfield
        this.triggerShakeAnimation(textInput ? 'chat' : 'main');
      }
    }
  }
  isResetCommand(text) {
    return String(text || '').trim().toLowerCase() === '//reset';
  }
  tryHandleResetCommand(text, screen = 'chat') {
    if (!this.isResetCommand(text)) return false;
    const { textInput, mainTextInput } = this.elements;
    if (screen === 'main') {
      if (mainTextInput) mainTextInput.value = '';
      this.widget.updateSendButtonState('main');
    } else {
      if (textInput) textInput.value = '';
      this.widget.updateSendButtonState('chat');
    }
    this.widget.clearSession();
    return true;
  }
  handleSendText() {
    const { textInput } = this.elements;
    const text = textInput?.value?.trim();
    if (!text) return;
    if (this.tryHandleResetCommand(text, 'chat')) return;
    this.widget.api.sendTextMessage();
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
  updateRecordingTimer(time) {
    if (this.inputState !== 'recording') return;
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = (time % 60).toString().padStart(2, '0');
    // Обновляем таймеры в обоих экранах
    const chatTimer = this.$byId('chatRecordTimer');
    const mainTimer = this.$byId('mainRecordTimer');
    if (chatTimer) chatTimer.textContent = `${m}:${s}`;
    if (mainTimer) mainTimer.textContent = `${m}:${s}`;
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
        if (this.tryHandleResetCommand(text, 'main')) return;
        this.widget.sendTextFromMainScreen(text);
      } else {
        // Trigger shake animation for empty textfield
        this.triggerShakeAnimation('main');
      }
    });
    
    // Main screen text input events
    mainTextInput?.addEventListener('input', () => this.widget.updateSendButtonState('main'));
    mainTextInput?.addEventListener('keydown', (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = mainTextInput.value.trim();
        if (text) {
          if (this.tryHandleResetCommand(text, 'main')) return;
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

      console.log('📤 Текст →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));

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
        if (!this.disableServerUI && Array.isArray(data.cards) && data.cards.length) {
          this._rememberProposed(data.cards);
          this.widget.suggestCardOption(data.cards[0]);
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

  // Send text message from main screen (reuses existing flow)
  async sendTextMessageFromText(messageText) {
    if (!messageText) return;

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

      console.log('📤 Текст (main) →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));

      // ✅ если сервер выдал sessionId — подхватываем и показываем
      if (data?.sessionId) this.widget.ui?._setSessionIdAndDisplay(data.sessionId);

      // 🆕 Sprint I: сохраняем role из server response (read-only)
      if (data?.role !== undefined) {
        this.widget.role = data.role;
      } else {
        console.warn('⚠️ [Sprint I] role отсутствует в server response (контрактная проблема)');
      }

      console.log('📥 Ответ на текст (main):', {
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
        stage: data.stage || null,
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
      this.widget.ui.hideThinkingIndicator(thinkingEl);
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

      if (this.fieldName && this.fieldName !== 'audio') {
        console.warn(`[VW] fieldName='${this.fieldName}' игнорируется — используем 'audio'`);
      }

      console.log('📤 Аудио →', this.apiUrl, 'sid:', this.widget.sessionId, 'lang:', replyLang);

      const response = await fetch(this.apiUrl, { method: 'POST', body: fd });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json().catch(() => ({}));

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
        if (Array.isArray(data.cards) && data.cards.length) {
          this._rememberProposed(data.cards);
          this.widget.suggestCardOption(data.cards[0]);
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
        console.log('📤 Card interaction sent:', { action, variantId, response: data });

        // 🆕 Sprint I: сохраняем role из server response (read-only)
        if (data?.role !== undefined) {
          this.widget.role = data.role;
        } else {
          console.warn('⚠️ [Sprint I] role отсутствует в server response (контрактная проблема)');
        }

        // Для первого показа карточки ('show') карточку уже отрисовали локально,
        // с бэка берём только текст-подпись. Для остальных действий — рендерим карточку.
        if (action !== 'show') {
          if (data && data.card) {
            try { this.widget.showMockCardWithActions(data.card); } catch (e) { console.warn('show card error:', e); }
          }
        }

        if (data && data.assistantMessage) {
          try { this.widget.renderCardCommentBubble(data.assistantMessage); } catch {}
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


const LOCALES = {
  RU: {
    inputPlaceholder: 'Задайте вопрос...',
    chatGreeting: 'Спроси меня!',
    chatSubGreeting: 'Помогу найти лучший вариант',
    recordingLabel: 'Идет запись',
    loadingText: 'Обрабатываю запрос',
    menuRequest: 'Оставить заявку',
    menuLanguage: 'Выбрать язык',
    menuInsights: 'Дополнительно',
    menuBackToDialog: 'Назад к диалогу',
    menuSelectedRequest: 'Оставить заявку',
    menuSelectedContext: 'Дополнительно',
    menuThemeToLight: 'Светлая тема',
    menuThemeToDark: 'Тёмная тема',
    appHeaderContact: 'Связаться',
    appHeaderOnline: 'Online',
    requestTitle: 'Оставить заявку',
    requestNameLabel: 'Имя',
    requestContactLabel: 'Контакт (телефон / WhatsApp / e-mail)',
    requestPreferredMethodLabel: 'Предпочитаемый способ связи',
    requestCommentLabel: 'Комментарий (необязательно)',
    requestNamePlaceholder: 'Ваше имя',
    requestPhonePlaceholder: '1234567',
    requestEmailPlaceholder: 'yourmail@gmail.com',
    requestCommentPlaceholder: 'Короткая заметка',
    requestContactError: 'Укажите телефон или email',
    requestConsentError: 'Примите Политику конфиденциальности',
    consentText: 'Я согласен(а) на обработку моих данных для обработки этого запроса и связи со мной по недвижимости.',
    privacyPolicy: 'Политика конфиденциальности',
    send: 'Отправить',
    cancel: 'Отмена',
    close: 'Закрыть',
    continue: 'Продолжить',
    understood: 'Понятно',
    thanksTitle: 'Спасибо!',
    thanksBody: 'Ваша заявка получена. Мы скоро с вами свяжемся.',
    statusFulfilled: 'Статус: заполнено',
    ctxDataStorage: 'Хранение и шифрование данных',
    ctxStageMessage: 'Отлично! Вы заполнили систему данными, и теперь подбор будет точнее.',
    ctxHint: 'Вы можете оставить заявку, чтобы менеджер сразу начал работу по вашему кейсу',
    leaveRequest: 'Оставить заявку',
    namePlaceholder: 'Имя',
    phonePlaceholder: 'Телефон',
    emailPlaceholder: 'E-mail',
    contactError: 'Укажите телефон или email',
    consentError: 'Примите Политику конфиденциальности',
    privacyLeavingTitle: 'Переход на другой сайт',
    privacyLeavingBody: 'Вы покидаете этот сайт и открываете Политику конфиденциальности в новой вкладке. Продолжить?',
    spamRepeatTitle: 'Повторная отправка',
    spamRepeatBody: 'Вы уже отправили заявку, желаете сделать это повторно?',
    spamBlockBody: 'Вы уже отправили заявку, и сможете отправить ее повторно через <span class="timer"></span> секунд.',
    whatDataTitle: 'Какие данные мы знаем?',
    dataStorageTitle: 'Хранение и шифрование данных',
    dataStorageBody: 'Мы храним данные на защищенных серверах в ЕС. Передача защищена современными TLS и HSTS; данные в хранилище зашифрованы (AES-256). Доступ строго ограничен и аудитируется. Мы не продаем ваши персональные данные. Вы можете запросить удаление в любой момент через поддержку.',
    footerWhatData: 'Какие данные мы знаем?',
    methodWhatsApp: 'WhatsApp',
    methodTelegram: 'Telegram',
    methodPhoneCall: 'Звонок',
    methodEmail: 'Email',
    cardShow: 'Показать',
    cardCancel: 'Отменить',
    cardSelect: 'Выбрать',
    cardNext: 'Ещё одну',
    handoffMessage: 'Вы выбрали объект. Дальше можно уточнить детали или отменить.',
    handoffDetails: 'Подробнее',
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
    sessionReset: 'Сессия сброшена'
    ,micErrorDuringRecord: 'Произошла ошибка во время записи'
    ,recordingCancelled: 'Запись отменена'
    ,micAccessDenied: 'Доступ к микрофону запрещен'
    ,micNotFound: 'Микрофон не найден'
    ,micBusy: 'Микрофон уже используется'
    ,micUnsupported: 'Настройки микрофона не поддерживаются'
    ,micAccessError: 'Ошибка доступа к микрофону'
    ,speakTitle: 'Говорить'
    ,sendTitle: 'Отправить'
    ,closeWidgetTitle: 'Закрыть виджет'
    ,statsTitle: 'Открыть меню'
    ,cookieTitle: 'Cookies и телеметрия'
    ,cookieBody: 'Мы используем cookies и собираем данные использования, чтобы улучшать продукт. Никакой сторонней рекламы и ретаргетинга. Настройки можно изменить в любое время.'
    ,cookieStrict: 'Строго необходимые (всегда включены)'
    ,cookiePerf: 'Производительность (тайминги, ошибки)'
    ,cookieAnalytics: 'Аналитика (анонимное использование)'
    ,cookieMarketing: 'Маркетинг (выключено — не используется)'
    ,cookieAcceptAll: 'Принять все'
    ,cookieRejectAll: 'Отклонить все'
    ,cookieManage: 'Настроить'
    ,cookieSave: 'Сохранить'
    ,insightDefault: 'не указано'
    ,stageWaiting: 'Ожидание'
    ,stageIntro: 'Знакомство'
    ,stageCore: 'Основные параметры'
    ,stagePrimarySelection: 'Готов к первичному подбору'
    ,stageDetails: 'Уточнение деталей'
    ,stagePreciseSelection: 'Готов к точному подбору'
    ,assistantGreeting: 'Здравствуйте! Я ваш помощник по подбору недвижимости в Estyle Properties.\n\nЯ помогу вам найти лучший вариант на нашем сайте. Опишите, пожалуйста, что бы вы хотели?'
  },
  EN: {
    inputPlaceholder: 'Ask a question...',
    chatGreeting: 'Ask me!',
    chatSubGreeting: 'I can help you find the best option',
    recordingLabel: 'Recording',
    loadingText: 'Processing request',
    menuRequest: 'Contact me',
    menuLanguage: 'Language',
    menuInsights: 'Insights',
    menuBackToDialog: 'Back to dialogue',
    menuSelectedRequest: 'Leave request',
    menuSelectedContext: 'Insights',
    menuThemeToLight: 'Light mode',
    menuThemeToDark: 'Dark mode',
    appHeaderContact: 'Contact',
    appHeaderOnline: 'Online',
    requestTitle: 'Leave a request',
    requestNameLabel: 'Name',
    requestContactLabel: 'Contact (phone / WhatsApp / e-mail)',
    requestPreferredMethodLabel: 'Preferred contact method',
    requestCommentLabel: 'Comment (optional)',
    requestNamePlaceholder: 'Your name',
    requestPhonePlaceholder: '1234567',
    requestEmailPlaceholder: 'yourmail@gmail.com',
    requestCommentPlaceholder: 'Short note',
    requestContactError: 'Please provide phone or email',
    requestConsentError: 'Please accept the Privacy Policy',
    consentText: 'I consent to the processing of my data for managing this request and contacting me about properties.',
    privacyPolicy: 'Privacy Policy',
    send: 'Send',
    cancel: 'Cancel',
    close: 'Close',
    continue: 'Continue',
    understood: 'Understood',
    thanksTitle: 'Thank you!',
    thanksBody: "Your request has been received. We'll contact you soon.",
    statusFulfilled: 'Status: fulfilled',
    ctxDataStorage: 'Data storage & encrypting',
    ctxStageMessage: "Well done! You've fulfilled the system with the data that will make search much closer to your goal!",
    ctxHint: 'You can leave the request to make manager start working by your case immediately',
    leaveRequest: 'Leave request',
    namePlaceholder: 'Name',
    phonePlaceholder: 'Phone',
    emailPlaceholder: 'E-mail',
    contactError: 'Please provide phone or email',
    consentError: 'Please accept the Privacy Policy',
    privacyLeavingTitle: 'Leaving this site',
    privacyLeavingBody: "You're about to leave this site and open our Privacy Policy in a new tab. Do you want to continue?",
    spamRepeatTitle: 'Repeated submission',
    spamRepeatBody: 'You already sent a request. Do you want to submit it again?',
    spamBlockBody: 'You already sent a request and can submit again in <span class="timer"></span> seconds.',
    whatDataTitle: 'What data do we know?',
    dataStorageTitle: 'Data storage & encrypting',
    dataStorageBody: 'We store your data on secure EU-based servers. Data in transit is protected with modern TLS and HSTS; data at rest is encrypted (AES-256). Access is strictly limited and audited. We never sell your personal information. You can request deletion at any time via Support.',
    footerWhatData: 'What data do we know?',
    methodWhatsApp: 'WhatsApp',
    methodTelegram: 'Telegram',
    methodPhoneCall: 'Phone Call',
    methodEmail: 'Email',
    cardShow: 'Show',
    cardCancel: 'Cancel',
    cardSelect: 'Select',
    cardNext: 'Another one',
    handoffMessage: 'You selected a property. You can ask for details or cancel.',
    handoffDetails: 'More details',
    inDialogLeadTitle: 'Leave your contact details',
    inDialogLeadNameLabel: 'Name',
    inDialogLeadPhoneLabel: 'Phone',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: 'Required: phone or email',
    inDialogLeadConsentError: 'Please accept the Privacy Policy',
    invalidPhone: 'Invalid phone number. Use 9-10 digits after country code.',
    invalidEmail: 'Invalid email address. Example: name@domain.com',
    submitFailed: 'Failed to submit request. Please try again later.',
    networkError: 'Network error. Please check your connection and try again.',
    parseError: 'Failed to parse server response',
    responseMissing: 'No response was received from the server.',
    sendTextError: 'An error occurred while sending the message. Please try again.',
    shortRecording: 'Recording is too short',
    voiceMessageLabel: 'Voice message ({seconds}s)',
    processingCardsError: 'Error while processing card command',
    noSavedSession: 'No saved session to restore',
    snapshotCorrupted: 'Snapshot is corrupted',
    restoreError: 'Restore failed',
    sessionReset: 'Session has been reset'
    ,micErrorDuringRecord: 'An error occurred while recording'
    ,recordingCancelled: 'Recording canceled'
    ,micAccessDenied: 'Microphone access denied'
    ,micNotFound: 'Microphone not found'
    ,micBusy: 'Microphone is already in use'
    ,micUnsupported: 'Microphone settings are not supported'
    ,micAccessError: 'Microphone access error'
    ,speakTitle: 'Speak'
    ,sendTitle: 'Send'
    ,closeWidgetTitle: 'Close widget'
    ,statsTitle: 'Open menu'
    ,cookieTitle: 'Cookies & telemetry'
    ,cookieBody: 'We use cookies and collect usage data to improve the product. No third-party ads or retargeting. You can change settings anytime.'
    ,cookieStrict: 'Strictly necessary (always enabled)'
    ,cookiePerf: 'Performance (timings, errors)'
    ,cookieAnalytics: 'Analytics (anonymous usage)'
    ,cookieMarketing: 'Marketing (off - not used)'
    ,cookieAcceptAll: 'Accept all'
    ,cookieRejectAll: 'Reject all'
    ,cookieManage: 'Manage'
    ,cookieSave: 'Save'
    ,insightDefault: 'not specified'
    ,stageWaiting: 'Waiting'
    ,stageIntro: 'Discovery'
    ,stageCore: 'Core parameters'
    ,stagePrimarySelection: 'Ready for initial selection'
    ,stageDetails: 'Refining details'
    ,stagePreciseSelection: 'Ready for precise selection'
    ,assistantGreeting: "Hello! I'm your real estate assistant at Estyle Properties.\n\nI'll help you find the best option on our site. Please describe what you're looking for?"
  },
  ES: {
    inputPlaceholder: 'Haz una pregunta...',
    chatGreeting: 'Preguntame!',
    chatSubGreeting: 'Te ayudo a encontrar la mejor opcion',
    recordingLabel: 'Grabando',
    loadingText: 'Procesando solicitud',
    menuRequest: 'Contactame',
    menuLanguage: 'Idioma',
    menuInsights: 'Insights',
    menuBackToDialog: 'Volver al dialogo',
    menuSelectedRequest: 'Dejar solicitud',
    menuSelectedContext: 'Insights',
    menuThemeToLight: 'Modo claro',
    menuThemeToDark: 'Modo oscuro',
    appHeaderContact: 'Contactar',
    appHeaderOnline: 'Online',
    requestTitle: 'Dejar una solicitud',
    requestNameLabel: 'Nombre',
    requestContactLabel: 'Contacto (telefono / WhatsApp / e-mail)',
    requestPreferredMethodLabel: 'Metodo de contacto preferido',
    requestCommentLabel: 'Comentario (opcional)',
    requestNamePlaceholder: 'Tu nombre',
    requestPhonePlaceholder: '1234567',
    requestEmailPlaceholder: 'correo@gmail.com',
    requestCommentPlaceholder: 'Nota breve',
    requestContactError: 'Indica telefono o email',
    requestConsentError: 'Acepta la Politica de Privacidad',
    consentText: 'Acepto el tratamiento de mis datos para gestionar esta solicitud y contactarme sobre propiedades.',
    privacyPolicy: 'Politica de Privacidad',
    send: 'Enviar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    continue: 'Continuar',
    understood: 'Entendido',
    thanksTitle: 'Gracias!',
    thanksBody: 'Hemos recibido tu solicitud. Te contactaremos pronto.',
    statusFulfilled: 'Estado: completado',
    ctxDataStorage: 'Almacenamiento y cifrado de datos',
    ctxStageMessage: 'Muy bien! Has completado el sistema con datos que haran la busqueda mas precisa.',
    ctxHint: 'Puedes dejar una solicitud para que el gestor empiece a trabajar de inmediato',
    leaveRequest: 'Dejar solicitud',
    namePlaceholder: 'Nombre',
    phonePlaceholder: 'Telefono',
    emailPlaceholder: 'E-mail',
    contactError: 'Indica telefono o email',
    consentError: 'Acepta la Politica de Privacidad',
    privacyLeavingTitle: 'Saliendo de este sitio',
    privacyLeavingBody: 'Estas a punto de salir de este sitio y abrir nuestra Politica de Privacidad en una nueva pestana. Quieres continuar?',
    spamRepeatTitle: 'Envio repetido',
    spamRepeatBody: 'Ya enviaste una solicitud. Quieres enviarla de nuevo?',
    spamBlockBody: 'Ya enviaste una solicitud y podras enviarla de nuevo en <span class="timer"></span> segundos.',
    whatDataTitle: 'Que datos conocemos?',
    dataStorageTitle: 'Almacenamiento y cifrado de datos',
    dataStorageBody: 'Guardamos tus datos en servidores seguros de la UE. Los datos en transito estan protegidos con TLS y HSTS modernos; los datos en reposo estan cifrados (AES-256). El acceso es estrictamente limitado y auditado. Nunca vendemos tu informacion personal. Puedes solicitar la eliminacion en cualquier momento a traves de Soporte.',
    footerWhatData: 'Que datos conocemos?',
    methodWhatsApp: 'WhatsApp',
    methodTelegram: 'Telegram',
    methodPhoneCall: 'Llamada',
    methodEmail: 'Email',
    cardShow: 'Mostrar',
    cardCancel: 'Cancelar',
    cardSelect: 'Seleccionar',
    cardNext: 'Otra más',
    handoffMessage: 'Has elegido una propiedad. Puedes pedir mas detalles o cancelar.',
    handoffDetails: 'Mas detalles',
    inDialogLeadTitle: 'Deja tus datos de contacto',
    inDialogLeadNameLabel: 'Nombre',
    inDialogLeadPhoneLabel: 'Telefono',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: 'Obligatorio: telefono o email',
    inDialogLeadConsentError: 'Acepta la Politica de Privacidad',
    invalidPhone: 'Numero de telefono invalido. Usa 9-10 digitos despues del codigo de pais.',
    invalidEmail: 'Email invalido. Ejemplo: name@domain.com',
    submitFailed: 'No se pudo enviar la solicitud. Intentalo mas tarde.',
    networkError: 'Error de red. Revisa tu conexion e intentalo de nuevo.',
    parseError: 'No se pudo procesar la respuesta del servidor',
    responseMissing: 'No se recibio respuesta del servidor.',
    sendTextError: 'Ocurrio un error al enviar el mensaje. Intentalo de nuevo.',
    shortRecording: 'La grabacion es demasiado corta',
    voiceMessageLabel: 'Mensaje de voz ({seconds}s)',
    processingCardsError: 'Error al procesar el comando de tarjetas',
    noSavedSession: 'No hay una sesion guardada para restaurar',
    snapshotCorrupted: 'La instantanea esta danada',
    restoreError: 'Error al restaurar',
    sessionReset: 'La sesion fue reiniciada'
    ,micErrorDuringRecord: 'Se produjo un error durante la grabacion'
    ,recordingCancelled: 'Grabacion cancelada'
    ,micAccessDenied: 'Acceso al microfono denegado'
    ,micNotFound: 'Microfono no encontrado'
    ,micBusy: 'El microfono ya esta en uso'
    ,micUnsupported: 'La configuracion del microfono no es compatible'
    ,micAccessError: 'Error de acceso al microfono'
    ,speakTitle: 'Hablar'
    ,sendTitle: 'Enviar'
    ,closeWidgetTitle: 'Cerrar widget'
    ,statsTitle: 'Abrir menu'
    ,cookieTitle: 'Cookies y telemetria'
    ,cookieBody: 'Usamos cookies y recopilamos datos de uso para mejorar el producto. Sin anuncios de terceros ni retargeting. Puedes cambiar la configuracion en cualquier momento.'
    ,cookieStrict: 'Estrictamente necesarias (siempre activadas)'
    ,cookiePerf: 'Rendimiento (tiempos, errores)'
    ,cookieAnalytics: 'Analitica (uso anonimo)'
    ,cookieMarketing: 'Marketing (desactivado - no se usa)'
    ,cookieAcceptAll: 'Aceptar todo'
    ,cookieRejectAll: 'Rechazar todo'
    ,cookieManage: 'Configurar'
    ,cookieSave: 'Guardar'
    ,insightDefault: 'no especificado'
    ,stageWaiting: 'Esperando'
    ,stageIntro: 'Descubrimiento'
    ,stageCore: 'Parametros principales'
    ,stagePrimarySelection: 'Listo para una primera seleccion'
    ,stageDetails: 'Afinando detalles'
    ,stagePreciseSelection: 'Listo para una seleccion precisa'
    ,assistantGreeting: 'Hola! Soy tu asistente de inmobiliaria en Estyle Properties.\n\nTe ayudo a encontrar la mejor opcion en nuestra web. Cuentame, por favor, que buscas?'
  }
};

// UA пока использует RU-копию интерфейса
if (!LOCALES.UA) {
  LOCALES.UA = { ...LOCALES.RU };
}

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
    this.maxRecordingTime = 30;
    this.minRecordingTime = 1;
    this.messages = [];
    this.mediaRecorder = null;
    this.stream = null;
    this.audioBlob = null;
    this.recordedChunks = [];

    // ⚠️ больше НЕ создаём id на фронте — читаем если сохранён, иначе null
    this.sessionId = this.getInitialSessionId();
    
    // 🆕 Sprint I: server-side role (read-only, обновляется из server responses)
    this.role = null;
    this.supportedLanguages = ['RU', 'UA', 'EN', 'AR'];
    this.defaultLanguage = 'EN';
    this.currentLang = this.defaultLanguage;

    // параметры
    const attrApi = this.getAttribute('api-url') || 'https://voice-widget-backend-tgdubai-split.up.railway.app/api/audio/upload';
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
    this._menuLanguageCode = nextLang;
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
    return LOCALES[this.currentLang] || LOCALES[this.defaultLanguage] || LOCALES.EN;
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

    setPlaceholder('mainTextInput', locale.inputPlaceholder);
    setPlaceholder('textInput', locale.inputPlaceholder);
    setPlaceholder('ctxName', locale.namePlaceholder);
    setPlaceholder('ctxPhone', locale.phonePlaceholder);
    setPlaceholder('ctxEmail', locale.emailPlaceholder);
    setPlaceholder('reqName', locale.requestNamePlaceholder);
    setPlaceholder('reqPhone', locale.requestPhonePlaceholder);
    setPlaceholder('reqEmail', locale.requestEmailPlaceholder);
    setPlaceholder('reqComment', locale.requestCommentPlaceholder);
    setPlaceholder('inDialogLeadName', locale.namePlaceholder);
    setPlaceholder('inDialogLeadPhone', locale.requestPhonePlaceholder);
    setPlaceholder('inDialogLeadEmail', locale.emailPlaceholder);

    setText('.main-text', locale.chatGreeting);
    setText('.sub-text', locale.chatSubGreeting);
    setText('#appContactButton', locale.appHeaderContact || 'Связаться');
    setText('#appOnlineText', locale.appHeaderOnline || 'Online');
    setText('#appLangButton', ['UA', 'RU'].includes(this.currentLang) ? this.currentLang : 'RU');
    setText('#appThemeButton', this.getTheme() === 'light' ? '◑' : '◐');
    setTextAll('.recording-label', locale.recordingLabel);
    setText('.loading-text', locale.loadingText);
    setTitle('mainToggleButton', locale.speakTitle);
    setTitle('toggleButton', locale.speakTitle);
    setTitle('mainSendButton', locale.sendTitle);
    setTitle('sendButton', locale.sendTitle);
    root.querySelectorAll('.header-action.header-right').forEach((el) => el.setAttribute('title', locale.closeWidgetTitle));
    root.querySelectorAll('.header-action.header-left').forEach((el) => el.setAttribute('title', locale.statsTitle));

    setText('#ctxStatusText', locale.statusFulfilled);
    setText('#ctxStageMessage', locale.ctxStageMessage);
    setText('.data-storage-text', locale.ctxDataStorage);
    setText('.hint-text', locale.ctxHint);
    setText('#ctxLeaveReqBtn', locale.leaveRequest);
    setText('#ctxContactError', locale.contactError);
    setText('#ctxConsentError', locale.consentError);
    setText('#ctxSendBtn', locale.send);
    setText('#ctxCancelBtn', locale.cancel);
    setText('#ctxThanksDoneBtn', locale.close);
    setText('#ctxThanksOverlayClose', locale.close);
    setText('#ctxSpamWarningCancelBtn', locale.cancel);
    setText('#ctxSpamWarningContinueBtn', locale.continue);
    setText('#ctxSpamBlockCloseBtn', locale.understood);
    setText('#whatDataUnderstoodBtn', locale.understood);
    setText('#dataUnderstoodBtn', locale.understood);
    setText('.footer-text', locale.footerWhatData);

    setText('#reqContactError', locale.requestContactError);
    setText('#reqConsentError', locale.requestConsentError);
    setText('.request-send-btn', locale.send);
    setText('.request-cancel-btn', locale.cancel);
    setText('#requestThanksOverlayClose', locale.close);
    setText('#requestSpamWarningCancelBtn', locale.cancel);
    setText('#requestSpamWarningContinueBtn', locale.continue);
    setText('#requestSpamBlockCloseBtn', locale.understood);
    setText('#privacyCancelBtn', locale.cancel);
    setText('#privacyContinueBtn', locale.continue);

    const reqLabels = root.querySelectorAll('#requestScreen .request-field-label');
    if (reqLabels[0]) reqLabels[0].textContent = locale.requestNameLabel;
    if (reqLabels[1]) reqLabels[1].textContent = locale.requestContactLabel;
    if (reqLabels[2]) reqLabels[2].textContent = locale.requestPreferredMethodLabel;
    if (reqLabels[3]) reqLabels[3].textContent = locale.requestCommentLabel;
    setText('#requestScreen .request-title', locale.requestTitle);

    const consentTextNodes = root.querySelectorAll('.ctx-consent-text, .request-consent-text, .in-dialog-lead__consent-text');
    consentTextNodes.forEach((node) => {
      const link = node.querySelector('a');
      if (link) link.textContent = locale.privacyPolicy;
      const textBeforeLink = `${locale.consentText} `;
      if (node.childNodes.length > 0) node.childNodes[0].textContent = textBeforeLink;
    });

    const reqMethodList = this.$byIdFrom(root, 'reqMethodList');
    if (reqMethodList) {
      const options = reqMethodList.querySelectorAll('.request-select-item');
      options.forEach((option) => {
        const v = option.getAttribute('data-value');
        if (v === 'WhatsApp') option.textContent = locale.methodWhatsApp;
        if (v === 'Telegram') option.textContent = locale.methodTelegram;
        if (v === 'Phone Call') option.textContent = locale.methodPhoneCall;
        if (v === 'Email') option.textContent = locale.methodEmail;
      });
      const currentValue = this.$byIdFrom(root, 'reqMethod')?.value;
      const reqMethodLabel = this.$byIdFrom(root, 'reqMethodLabel');
      if (reqMethodLabel) {
        if (currentValue === 'WhatsApp') reqMethodLabel.textContent = locale.methodWhatsApp;
        if (currentValue === 'Telegram') reqMethodLabel.textContent = locale.methodTelegram;
        if (currentValue === 'Phone Call') reqMethodLabel.textContent = locale.methodPhoneCall;
        if (currentValue === 'Email') reqMethodLabel.textContent = locale.methodEmail;
      }
    }

    const ctxPrivacy = this.$byIdFrom(root, 'ctxPrivacyOverlay');
    if (ctxPrivacy) {
      const title = ctxPrivacy.querySelector('.data-title');
      const body = ctxPrivacy.querySelector('.data-body');
      if (title) title.textContent = locale.privacyLeavingTitle;
      if (body) body.textContent = locale.privacyLeavingBody;
    }
    const privacy = this.$byIdFrom(root, 'privacyOverlay');
    if (privacy) {
      const title = privacy.querySelector('.data-title');
      const body = privacy.querySelector('.data-body');
      if (title) title.textContent = locale.privacyLeavingTitle;
      if (body) body.textContent = locale.privacyLeavingBody;
    }
    const ctxThanks = this.$byIdFrom(root, 'ctxThanks');
    if (ctxThanks) {
      const title = ctxThanks.querySelector('.ctx-thanks-title');
      const body = ctxThanks.querySelector('.ctx-thanks-text');
      if (title) title.textContent = locale.thanksTitle;
      if (body) body.textContent = locale.thanksBody;
    }
    const reqThanks = this.$byIdFrom(root, 'requestThanksOverlay');
    if (reqThanks) {
      const title = reqThanks.querySelector('.data-title');
      const body = reqThanks.querySelector('.data-body');
      if (title) title.textContent = locale.thanksTitle;
      if (body) body.textContent = locale.thanksBody;
    }
    const ctxThanksOverlay = this.$byIdFrom(root, 'ctxThanksOverlay');
    if (ctxThanksOverlay) {
      const title = ctxThanksOverlay.querySelector('.data-title');
      const body = ctxThanksOverlay.querySelector('.data-body');
      if (title) title.textContent = locale.thanksTitle;
      if (body) body.textContent = locale.thanksBody;
    }

    const updateSpamBlockBody = (overlayId, timerId) => {
      const overlay = this.$byIdFrom(root, overlayId);
      const timer = this.$byIdFrom(root, timerId);
      if (!overlay) return;
      const title = overlay.querySelector('.data-title');
      const body = overlay.querySelector('.data-body');
      if (title) title.textContent = locale.spamRepeatTitle;
      if (body) {
        const timerValue = timer ? timer.textContent : '60';
        body.innerHTML = locale.spamBlockBody.replace('<span class="timer"></span>', `<span id="${timerId}">${timerValue}</span>`);
      }
    };
    const updateSpamWarnBody = (overlayId) => {
      const overlay = this.$byIdFrom(root, overlayId);
      if (!overlay) return;
      const title = overlay.querySelector('.data-title');
      const body = overlay.querySelector('.data-body');
      if (title) title.textContent = locale.spamRepeatTitle;
      if (body) body.textContent = locale.spamRepeatBody;
    };
    updateSpamWarnBody('ctxSpamWarningOverlay');
    updateSpamWarnBody('requestSpamWarningOverlay');
    updateSpamBlockBody('ctxSpamBlockOverlay', 'ctxSpamBlockTimer');
    updateSpamBlockBody('requestSpamBlockOverlay', 'requestSpamBlockTimer');

    const whatData = this.$byIdFrom(root, 'whatDataOverlay');
    if (whatData) {
      const title = whatData.querySelector('.data-title');
      if (title) title.textContent = locale.whatDataTitle;
    }
    const dataOverlay = this.$byIdFrom(root, 'dataOverlay');
    if (dataOverlay) {
      const title = dataOverlay.querySelector('.data-title');
      const body = dataOverlay.querySelector('.data-body');
      if (title) title.textContent = locale.dataStorageTitle;
      if (body) body.textContent = locale.dataStorageBody;
    }
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

    this.updateMenuUI();
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

    // Initialize send buttons with disabled state
    const mainSendButton = this.$byId('mainSendButton');
    const sendButton = this.$byId('sendButton');
    if (mainSendButton) mainSendButton.setAttribute('aria-disabled', 'true');
    if (sendButton) sendButton.setAttribute('aria-disabled', 'true');

    console.log('✅ Voice Widget инициализирован');

    // v2 menu overlay init (after DOM is ready)
    try { this.setupMenuOverlay(); } catch {}
    try { this.initializePropertiesCatalog(); } catch {}

    
  }

  connectedCallback() {
    this._initializeInstance();
    if (this.isTelegramWebApp) {
      this.setAttribute('data-telegram', '1');
    } else {
      this.removeAttribute('data-telegram');
    }
    this.currentLang = this.getInitialLanguage();
    this._menuLanguageCode = this.currentLang;
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
    let theme = 'dark';
    try {
      const saved = localStorage.getItem('vw_theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
    } catch {}
    this.applyTheme(theme);
  }

  getTheme() {
    if (this._theme === 'light' || this._theme === 'dark') return this._theme;
    const raw = this.getAttribute('data-theme');
    return raw === 'light' ? 'light' : 'dark';
  }

  getMicIconByTheme() {
    return this.getTheme() === 'light' ? 'mic-btn-light.svg' : 'mic-btn.svg';
  }

  getStopIconByTheme() {
    return this.getTheme() === 'light' ? 'stop-btn-light.svg' : 'stop-btn.svg';
  }

  getSendIconByTheme() {
    return this.getTheme() === 'light' ? 'send-btn-light.svg' : 'send-btn.svg';
  }

  getStatsIconByTheme() {
    return this.getTheme() === 'light' ? 'menu_light_theme.svg' : 'menu_dark_theme.svg';
  }

  getCloseIconByTheme() {
    return this.getTheme() === 'light' ? 'main_close_btn-light.svg' : 'main_close_btn.svg';
  }

  getContactIconByTheme() {
    return this.getTheme() === 'light' ? 'Contactme-light.svg' : 'Contactme.svg';
  }

  getLanguageIconByTheme() {
    return this.getTheme() === 'light' ? 'Language-light.svg' : 'Language.svg';
  }

  getInsightsIconByTheme() {
    return this.getTheme() === 'light' ? 'Insights-light.svg' : 'Insights.svg';
  }

  getLogoByTheme() {
    return this.getTheme() === 'light' ? 'LOGO-light.svg' : 'LOGO.svg';
  }

  getReturnIconByTheme() {
    return this.getTheme() === 'light' ? 'return_light_btn.svg' : 'return_btn.svg';
  }

  getInsightsProgressTrackStrokeByTheme() {
    return this.getTheme() === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  }

  updateSendButtonIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getSendIconByTheme()}`;
    const mainSendImg = this.getRoot().querySelector('#mainSendButton img');
    const chatSendImg = this.getRoot().querySelector('#sendButton img');
    if (mainSendImg) mainSendImg.setAttribute('src', nextSrc);
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

  updateInsightsProgressTrackStroke() {
    const trackCircle = this.getRoot().querySelector('#contextScreen .progress-ring svg circle:first-child');
    if (!trackCircle) return;
    trackCircle.setAttribute('stroke', this.getInsightsProgressTrackStrokeByTheme());
  }

  applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    this._theme = next;
    if (this.isConnected) this.setAttribute('data-theme', next);
    else this._pendingThemeAttr = next;
    try { localStorage.setItem('vw_theme', next); } catch {}
    try {
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
      this.updateSendButtonIcons();
      this.updateStatsIcons();
      this.updateLogoIcons();
      this.updateCloseIcons();
      this.updateInsightsProgressTrackStroke();
    } catch {}
  }

  toggleTheme() {
    const next = this.getTheme() === 'light' ? 'dark' : 'light';
    this.applyTheme(next);
  }

  checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const statusIndicator = this.$byId('statusIndicator');
      if (statusIndicator) statusIndicator.innerHTML = '<div class="status-text">❌ Браузер не поддерживает запись аудио</div>';
      const mainButton = this.$byId('mainButton');
      if (mainButton) {
        mainButton.disabled = true;
        mainButton.style.opacity = '0.5';
        mainButton.style.cursor = 'not-allowed';
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
  </div>

  

  <div class="widget" role="dialog" aria-modal="true" aria-label="Voice Assistant">
    <!-- Header removed for v2 UI -->

    <!-- Content -->
    <div class="content">
      <header class="app-header">
        <button class="app-header-btn header-action-btn" id="appContactButton" type="button">Связаться</button>
        <div class="app-header-status">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="appOnlineText">Online</span>
        </div>
        <div class="app-header-actions">
          <button class="app-header-btn app-lang-btn" id="appLangButton" type="button">RU</button>
          <button class="app-header-btn app-theme-btn" id="appThemeButton" type="button" aria-label="Toggle theme">◐</button>
        </div>
      </header>
      <div class="app-body">
      <!-- Main Screen (скрыт через CSS, в DOM сохранён) -->
      <div class="main-screen hidden" id="mainScreen">
        <div class="voice-widget-container">
            <div class="bg-grid"></div>
            <div class="screen-header">
              <button class="header-action header-left" type="button" title="Открыть меню">
                <img src="${ASSETS_BASE}${this.getStatsIconByTheme()}" alt="Stats">
              </button>
              <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
            </div>
            <div class="main-center">
              <div class="main-hero">
                <button class="mic-button" id="mainButton" aria-pressed="false">
                    <img src="${ASSETS_BASE}MicBig.png" alt="Microphone" style="width: 100%; height: 100%;">
                </button>
              </div>
              <div class="main-copy">
                <div class="text-container">
                    <p class="main-text">${this.getCurrentLocale().chatGreeting}</p>
                    <p class="sub-text">${this.getCurrentLocale().chatSubGreeting}</p>
                </div>
              </div>
            </div>
        <div class="input-container">
          <div class="text-input-wrapper">
                    <textarea id="mainTextInput" class="input-field" rows="1" placeholder="Write your request..."></textarea>
                    <div class="recording-indicator" id="mainRecordingIndicator" style="display:none;">
                        <div class="recording-label">Идёт запись</div>
              <div class="record-timer" id="mainRecordTimer">00:00</div>
            </div>
          </div>
                <div class="input-buttons">
                    <button class="input-btn" id="mainToggleButton" type="button" title="Говорить">
                        <img src="${ASSETS_BASE}${this.getMicIconByTheme()}" alt="Microphone">
                    </button>
                    <button class="input-btn" id="mainSendButton" type="button" title="Отправить">
                        <img src="${ASSETS_BASE}${this.getSendIconByTheme()}" alt="Send">
                    </button>
                </div>
            </div>
        </div>
      </div>

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
          <div class="dialogue-container" id="messagesContainer">
              <div class="thread" id="thread"></div>
        </div>
          <div class="loading dialog-overlay" id="loadingIndicator"><span class="loading-text">Обрабатываю запрос <span class="dots"><span class="d1">•</span><span class="d2">•</span><span class="d3">•</span></span></span></div>
          <div class="input-area">
            <div class="objects-counter-pill" id="objectsCounterPill" role="button" tabindex="0">Найдено 2,345 объектов</div>
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


      <!-- Context Screen (v2) -->
      <div class="context-screen hidden" id="contextScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header"></div>
          <div class="context-main-container">
            <div class="progress-grid-container">
              <div class="grid-column-left"></div>
              <div class="grid-column-center">
                <div class="progress-ring">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="${this.getInsightsProgressTrackStrokeByTheme()}" stroke-width="12"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-accent)" stroke-width="12" stroke-dasharray="276.46" stroke-dashoffset="2.76" stroke-linecap="round" transform="rotate(-90 50 50)"/>
                  </svg>
                  <div class="progress-text" id="ctxProgressText">99%</div>
            </div>
          </div>
              <div class="grid-column-right">
                <div class="data-storage-text">Data storage & encrypting</div>
          </div>
            </div>
            <div class="status-text" id="ctxStatusText">Status: fulfilled</div>
            <div class="main-message" id="ctxStageMessage">Well done! You've fulfilled the system with the data that will make search much closer to your goal!</div>
            <div class="context-gradient-line"></div>
            <div class="hint-text">You can leave the request to make manager start working by your case immediately</div>
            <div class="context-leave-request-button"><button class="context-leave-request-btn" id="ctxLeaveReqBtn">Leave request</button></div>
            <div class="ctx-request-form" id="ctxRequestForm">
              <div class="ctx-field">
                <input class="ctx-input" id="ctxName" type="text" placeholder="Name">
              </div>
              <div class="ctx-field ctx-row">
                <div class="dial-select">
                  <button class="dial-btn" type="button" id="ctxDialBtn"><span class="dial-flag">🇦🇪</span><span class="dial-code">+971</span></button>
                  <div class="dial-list" id="ctxDialList">
                    <div class="dial-item" data-cc="AE" data-code="+971"><span class="dial-flag">🇦🇪</span><span class="dial-code">+971 AE</span></div>
                    <div class="dial-item" data-cc="FR" data-code="+33"><span class="dial-flag">🇫🇷</span><span class="dial-code">+33 FR</span></div>
                    <div class="dial-item" data-cc="DE" data-code="+49"><span class="dial-flag">🇩🇪</span><span class="dial-code">+49 DE</span></div>
                    <div class="dial-item" data-cc="UA" data-code="+380"><span class="dial-flag">🇺🇦</span><span class="dial-code">+380 UA</span></div>
                    <div class="dial-item" data-cc="RU" data-code="+7"><span class="dial-flag">🇷🇺</span><span class="dial-code">+7 RU</span></div>
                    <div class="dial-item" data-cc="PL" data-code="+48"><span class="dial-flag">🇵🇱</span><span class="dial-code">+48 PL</span></div>
                    <div class="dial-item" data-cc="UK" data-code="+44"><span class="dial-flag">🇬🇧</span><span class="dial-code">+44 UK</span></div>
                  </div>
                </div>
                <input class="ctx-input" id="ctxPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Phone">
              </div>
              <div class="ctx-field">
                <div class="email-wrap">
                  <input class="ctx-input" id="ctxEmail" type="email" autocomplete="email" placeholder="E-mail">
                  <span class="email-ghost" id="ctxEmailGhost"></span>
                </div>
              </div>
              <input type="hidden" id="ctxCode" value="+971" />
              <div class="ctx-error" id="ctxContactError">Please provide phone or email</div>
              <div class="ctx-field">
                <label class="ctx-consent">
                  <input class="ctx-checkbox" id="ctxConsent" type="checkbox">
                  <span class="ctx-consent-text">I consent to the processing of my data for managing this request and contacting me about properties. <a class="ctx-privacy-link" href="#">Privacy Policy</a></span>
                </label>
              </div>
              <div class="ctx-error" id="ctxConsentError">Please accept the Privacy Policy</div>
              <div class="ctx-actions">
                <button class="ctx-send-btn" id="ctxSendBtn">Send</button>
                <button class="ctx-cancel-btn" id="ctxCancelBtn">Cancel</button>
              </div>
            </div>
            <!-- Context Privacy confirm Popup -->
            <div class="data-overlay" id="ctxPrivacyOverlay" style="display:none;">
              <div class="data-modal">
                <div class="data-title">Leaving this site</div>
                <div class="data-body">
                  You’re about to leave this site and open our Privacy Policy in a new tab.
                  Do you want to continue?
                </div>
                <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
                  <button class="data-btn" id="ctxPrivacyCancelBtn">Cancel</button>
                  <button class="data-btn" id="ctxPrivacyContinueBtn">Continue</button>
                </div>
              </div>
            </div>
            <div class="ctx-thanks" id="ctxThanks">
              <div class="ctx-thanks-title">Thank you!</div>
              <div class="ctx-thanks-text">Your request has been received. We’ll contact you soon.</div>
              <button class="ctx-done-btn" id="ctxThanksDoneBtn">Close</button>
            </div>
              <!-- Context Thanks Popup -->
              <div class="data-overlay" id="ctxThanksOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Thank you!</div>
                  <div class="data-body">Your request has been received. We'll contact you soon.</div>
                  <button class="data-btn" id="ctxThanksOverlayClose">Close</button>
                </div>
              </div>
              <!-- Context Spam Warning Popup -->
              <div class="data-overlay" id="ctxSpamWarningOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Повторная отправка</div>
                  <div class="data-body">Вы уже отправили заявку, желаете сделать это повторно?</div>
                  <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
                    <button class="data-btn" id="ctxSpamWarningCancelBtn">Отмена</button>
                    <button class="data-btn" id="ctxSpamWarningContinueBtn">Продолжить</button>
                  </div>
                </div>
              </div>
              <!-- Context Spam Block Popup -->
              <div class="data-overlay" id="ctxSpamBlockOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Повторная отправка</div>
                  <div class="data-body">Вы уже отправили заявку, и сможете отправить её повторно через <span id="ctxSpamBlockTimer">60</span> секунд.</div>
                  <button class="data-btn" id="ctxSpamBlockCloseBtn">Понятно</button>
                </div>
              </div>
            <!-- What data do we know popup -->
            <div class="data-overlay" id="whatDataOverlay" style="display:none;">
              <div class="data-modal">
                <div class="data-title">What data do we know?</div>
                <div class="data-body" id="whatDataBody">
                  <!-- filled dynamically from insights -->
                </div>
                <button class="data-btn" id="whatDataUnderstoodBtn">Understood</button>
              </div>
            </div>
            <!-- Data storage popup -->
            <div class="data-overlay" id="dataOverlay" style="display:none;">
              <div class="data-modal">
                <div class="data-title">Data storage & encrypting</div>
                <div class="data-body">
                  We store your data on secure EU-based servers. Data in transit is protected with modern TLS and HSTS; data at rest is encrypted (AES‑256). Access is strictly limited and audited. We never sell your personal information. You can request deletion at any time via Support.
                </div>
                <button class="data-btn" id="dataUnderstoodBtn">Understood</button>
              </div>
            </div>
          </div>
          <div class="footer-text">What data do we know?</div>
            </div>
          </div>

      <!-- Request Screen (v2) -->
      <div class="request-screen hidden" id="requestScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header"></div>
          <div class="request-main-container">
            <div class="request-title">Leave a request</div>
            <div class="request-field">
              <div class="request-field-label">Name</div>
              <input class="request-input" id="reqName" type="text" placeholder="Your name" autocomplete="off" />
      </div>
            <div class="request-field">
              <div class="request-field-label">Contact (phone/ WhatsApp/ e-mail)</div>
              <div class="request-row">
                <div class="dial-select">
                  <button class="dial-btn" type="button" id="reqDialBtn"><span class="dial-flag">🇦🇪</span><span class="dial-code">+971</span></button>
                  <div class="dial-list" id="reqDialList">
                    <div class="dial-item" data-cc="AE" data-code="+971"><span class="dial-flag">🇦🇪</span><span class="dial-code">+971 AE</span></div>
                    <div class="dial-item" data-cc="FR" data-code="+33"><span class="dial-flag">🇫🇷</span><span class="dial-code">+33 FR</span></div>
                    <div class="dial-item" data-cc="DE" data-code="+49"><span class="dial-flag">🇩🇪</span><span class="dial-code">+49 DE</span></div>
                    <div class="dial-item" data-cc="UA" data-code="+380"><span class="dial-flag">🇺🇦</span><span class="dial-code">+380 UA</span></div>
                    <div class="dial-item" data-cc="RU" data-code="+7"><span class="dial-flag">🇷🇺</span><span class="dial-code">+7 RU</span></div>
                    <div class="dial-item" data-cc="PL" data-code="+48"><span class="dial-flag">🇵🇱</span><span class="dial-code">+48 PL</span></div>
                    <div class="dial-item" data-cc="UK" data-code="+44"><span class="dial-flag">🇬🇧</span><span class="dial-code">+44 UK</span></div>
    </div>
                </div>
                <input class="request-input request-code-input" id="reqCode" type="hidden" value="+971" />
                <input class="request-input request-phone-input" id="reqPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="1234567" />
    </div>
              <div class="email-wrap">
                <input class="request-input" id="reqEmail" type="email" autocomplete="email" placeholder="yourmail@gmail.com" />
                <span class="email-ghost" id="reqEmailGhost"></span>
              </div>
              <div class="request-error" id="reqContactError">Please provide phone or email</div>
        </div>
            <div class="request-field">
              <div class="request-field-label">Preferred contact method</div>
              <div class="request-select" id="reqMethodSelect"><span id="reqMethodLabel">WhatsApp</span><span class="request-caret">▾</span></div>
              <div class="request-select-list" id="reqMethodList">
                <div class="request-select-item" data-value="WhatsApp">WhatsApp</div>
                <div class="request-select-item" data-value="Telegram">Telegram</div>
                <div class="request-select-item" data-value="Phone Call">Phone Call</div>
                <div class="request-select-item" data-value="Email">Email</div>
              </div>
              <input type="hidden" id="reqMethod" value="WhatsApp" />
          </div>
            <div class="request-field">
              <div class="request-field-label">Comment (optional)</div>
              <textarea class="request-textarea" id="reqComment" placeholder="Short note"></textarea>
        </div>
            <div class="request-actions-container">
              <div class="request-consent">
                <input class="request-checkbox" id="reqConsent" type="checkbox" />
                <div class="request-consent-text">I consent to the processing of my data for managing this request and contacting me about properties. <a class="request-privacy-link" href="#">Privacy Policy</a></div>
        </div>
              <div class="request-error" id="reqConsentError">Please accept the Privacy Policy</div>
              <div class="request-buttons">
                <button class="request-send-btn">Send</button>
                <button class="request-cancel-btn">Cancel</button>
        </div>
        </div>
        </div>
        </div>
      <!-- Request Thanks Popup -->
      <div class="data-overlay" id="requestThanksOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Thank you!</div>
          <div class="data-body">Your request has been received. We'll contact you soon.</div>
          <button class="data-btn" id="requestThanksOverlayClose">Close</button>
        </div>
        </div>
      <!-- Request Spam Warning Popup -->
      <div class="data-overlay" id="requestSpamWarningOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Повторная отправка</div>
          <div class="data-body">Вы уже отправили заявку, желаете сделать это повторно?</div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
            <button class="data-btn" id="requestSpamWarningCancelBtn">Отмена</button>
            <button class="data-btn" id="requestSpamWarningContinueBtn">Продолжить</button>
          </div>
        </div>
      </div>
      <!-- Request Spam Block Popup -->
      <div class="data-overlay" id="requestSpamBlockOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Повторная отправка</div>
          <div class="data-body">Вы уже отправили заявку, и сможете отправить её повторно через <span id="requestSpamBlockTimer">60</span> секунд.</div>
          <button class="data-btn" id="requestSpamBlockCloseBtn">Понятно</button>
        </div>
      </div>
      <!-- Privacy confirm Popup -->
      <div class="data-overlay" id="privacyOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Leaving this site</div>
          <div class="data-body">
            You’re about to leave this site and open our Privacy Policy in a new tab.
            Do you want to continue?
          </div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
            <button class="data-btn" id="privacyCancelBtn">Cancel</button>
            <button class="data-btn" id="privacyContinueBtn">Continue</button>
          </div>
        </div>
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
  const screenIds = ['mainScreen','dialogScreen','contextScreen','requestScreen'];
  const showScreen = (screenName) => {
    screenIds.forEach(id => this.$byId(id)?.classList.add('hidden'));
    const targetId = screenName === 'dialog' ? 'dialogScreen' : screenName === 'main' ? 'mainScreen' : screenName + 'Screen';
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
    try { this.toggleTheme(); this.updateInterface(); } catch {}
  });
  this.$byId('appContactButton')?.addEventListener('click', () => {
    try { showScreen('request'); } catch {}
  });
  const objectsPill = this.$byId('objectsCounterPill');
  const openPropertiesSlider = () => { try { this.renderPropertiesFromCatalog(); } catch {} };
  objectsPill?.addEventListener('click', openPropertiesSlider);
  objectsPill?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openPropertiesSlider();
    }
  });

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
    if (!sessionStorage.getItem('vw_greeting_shown')) {
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
  this.setupRequestForm = () => {
    const root = this.getRoot();
    const sendBtn = root.querySelector('.request-send-btn');
    const cancelBtn = root.querySelector('.request-cancel-btn');
    if (!sendBtn) return;
    const thanksOverlay = this.$byIdFrom(root, 'requestThanksOverlay');
    const get = (id) => this.$byIdFrom(root, id);
    const markError = (el, on) => { if (!el) return; el.classList.toggle('error', !!on); };
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toDigits = (v) => String(v || '').replace(/\D+/g, '');
    const isEmail = (v) => emailRe.test(String(v || '').trim());
    // Phone format (demo): country code + 9–10 national digits (operator 3 digits + 6–7 digits).
    const isPhone = (cc, ph) => {
      const ccDigits = toDigits(cc);
      const phDigits = toDigits(ph);
      if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 3) return false;
      if (!phDigits) return false;
      if (phDigits.length < 9 || phDigits.length > 10) return false;
      if (ccDigits.length + phDigits.length > 15) return false;
      return true;
    };
    // Email inline completion (request)
    const emailSuggestDomains = ['gmail.com','mail.ru','proton.me','rambler.ru','yahoo.com'];
    const reqEmail = get('reqEmail');
    const reqEmailGhost = get('reqEmailGhost');
    const measureText = (inputEl, text) => {
      if (!inputEl) return 0;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const cs = getComputedStyle(inputEl);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      return ctx.measureText(text).width;
    };
    const updateReqEmailGhost = () => {
      const v = reqEmail?.value || '';
      const at = v.indexOf('@');
      if (!reqEmailGhost || at < 0) { if (reqEmailGhost) reqEmailGhost.textContent=''; return; }
      const tail = v.slice(at + 1).toLowerCase();
      let suggestion = null;
      if (tail.length === 0) suggestion = emailSuggestDomains[0];
      else suggestion = emailSuggestDomains.find(d => d.startsWith(tail));
      if (!suggestion) { reqEmailGhost.textContent=''; return; }
      const suffix = suggestion.slice(tail.length); // "съедаем" уже введённое
      // позиция — ширина всего введённого текста
      const padLeft = 10; // как у инпута
      const left = padLeft + measureText(reqEmail, v);
      reqEmailGhost.style.left = `${left}px`;
      reqEmailGhost.textContent = suffix;
      reqEmailGhost.dataset.domain = suggestion;
    };
    reqEmail?.addEventListener('input', updateReqEmailGhost);
    reqEmailGhost?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!reqEmail || !reqEmailGhost) return;
      const v = reqEmail.value;
      const at = v.indexOf('@');
      if (at < 0) return;
      const local = v.slice(0, at);
      const domain = reqEmailGhost.dataset.domain || '';
      if (!domain) return;
      reqEmail.value = `${local}@${domain}`;
      reqEmail.focus();
      updateReqEmailGhost();
    });
    // Dial select (request)
    const reqDialBtn = get('reqDialBtn');
    const reqDialList = get('reqDialList');
    const reqCode = get('reqCode');
    const toggleReqDial = (show) => { if (reqDialList) reqDialList.style.display = show ? 'block' : 'none'; };
    reqDialBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = reqDialList && reqDialList.style.display === 'block';
      toggleReqDial(!visible);
    });
    reqDialList?.querySelectorAll('.dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code') || '+971';
        const flag = item.querySelector('.dial-flag')?.textContent || '🇦🇪';
        if (reqDialBtn) {
          const codeEl = reqDialBtn.querySelector('.dial-code'); const flagEl = reqDialBtn.querySelector('.dial-flag');
          if (codeEl) codeEl.textContent = code;
          if (flagEl) flagEl.textContent = flag;
        }
        if (reqCode) reqCode.value = code;
        toggleReqDial(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!reqDialList || !reqDialBtn) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![reqDialList, reqDialBtn].some(el => path.includes(el))) toggleReqDial(false);
    }, { capture:true });
    // Preferred contact method select
    const reqMethodSelect = get('reqMethodSelect');
    const reqMethodList = get('reqMethodList');
    const reqMethodLabel = get('reqMethodLabel');
    const reqMethodInput = get('reqMethod');
    const toggleReqMethod = (show) => { if (reqMethodList) reqMethodList.style.display = show ? 'block' : 'none'; };
    reqMethodSelect?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = reqMethodList && reqMethodList.style.display === 'block';
      toggleReqMethod(!visible);
    });
    reqMethodList?.querySelectorAll('.request-select-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-value') || 'WhatsApp';
        if (reqMethodLabel) reqMethodLabel.textContent = val;
        if (reqMethodInput) reqMethodInput.value = val;
        toggleReqMethod(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!reqMethodList || !reqMethodSelect) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![reqMethodList, reqMethodSelect].some(el => path.includes(el))) toggleReqMethod(false);
    }, { capture:true });
    const showContactError = (on, msg) => {
      const el = get('reqContactError');
      if (el && typeof msg === 'string' && msg.length) el.textContent = msg;
      if (el) el.classList.toggle('visible', !!on);
    };
    const showConsentError = (on) => {
      const wrap = root.querySelector('.request-consent');
      const checkbox = get('reqConsent');
      const textEl = wrap?.querySelector('.request-consent-text');
      const el = get('reqConsentError');
      if (el) el.classList.toggle('visible', !!on);
      if (checkbox) checkbox.classList.toggle('error', !!on);
      if (on && textEl) { textEl.classList.add('shake'); setTimeout(()=>textEl.classList.remove('shake'), 500); }
    };
    const shake = (el) => {
      if (!el) return;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 500);
    };
    // Clear hints on input
    ['reqCode','reqPhone','reqEmail'].forEach(id => {
      get(id)?.addEventListener('input', () => {
        showContactError(false);
        ['reqCode','reqPhone','reqEmail'].forEach(fid => markError(get(fid), false));
      });
    });
    get('reqConsent')?.addEventListener('change', () => {
      showConsentError(false);
      const checkbox = get('reqConsent');
      if (checkbox) checkbox.classList.remove('error');
    });
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // read values
      const name = get('reqName')?.value?.trim() || '';
      const code = get('reqCode')?.value?.trim() || '';
      const phone = get('reqPhone')?.value?.trim() || '';
      const email = get('reqEmail')?.value?.trim() || '';
      const consent = !!get('reqConsent')?.checked;
      // validate contact
      const phoneOk = isPhone(code, phone);
      const emailOk = isEmail(email);
      const contactOk = phoneOk || emailOk;
      const phoneHas = phone.length > 0;
      const emailHas = email.length > 0;
      // if both empty -> shake both + generic error
      if (!phoneHas && !emailHas) {
        markError(get('reqPhone'), true);
        markError(get('reqEmail'), true);
        shake(get('reqPhone')); shake(get('reqEmail'));
        showContactError(true, 'Required: phone or email');
        // also check consent here to shake if needed
        if (!consent) showConsentError(true);
        return;
      }
      // If at least one is valid -> proceed (clear errors regardless of the other)
      if (contactOk) {
        markError(get('reqPhone'), false);
        markError(get('reqEmail'), false);
        showContactError(false);
      } else {
        // One or both present but invalid → show only one specific message, mark all invalid
        markError(get('reqPhone'), phoneHas && !phoneOk);
        markError(get('reqEmail'), emailHas && !emailOk);
        let msg = phoneHas && !phoneOk
          ? 'Invalid phone number. Use 9–10 digits after country code.'
          : 'Invalid email address. Example: name@domain.com';
        showContactError(true, msg);
        if (!phoneOk && phoneHas) shake(get('reqPhone'));
        if (!emailOk && emailHas) shake(get('reqEmail'));
        return;
      }
      if (!consent) { showConsentError(true); shake(root.querySelector('.request-consent')); return; }
      
      // Проверка защиты от спама (общая для обеих форм)
      const formType = 'lead'; // Общий тип для full и short форм
      const submitCount = this.leadSpamProtection.getSubmitCount(formType);
      const isBlocked = this.leadSpamProtection.isBlocked(formType);
      const warningShown = this.leadSpamProtection.isWarningShown(formType);
      
      // Если заблокирован - показываем поп-ап блокировки
      if (isBlocked) {
        const blockOverlay = get('requestSpamBlockOverlay');
        const timerEl = get('requestSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если счетчик уже 2 (после нажатия "Продолжить" во второй раз) - устанавливаем блокировку ПЕРЕД отправкой
      if (submitCount === 2) {
        this.leadSpamProtection.setBlocked(formType);
        const blockOverlay = get('requestSpamBlockOverlay');
        const timerEl = get('requestSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если вторая отправка и предупреждение еще не показывали - показываем поп-ап предупреждения
      if (submitCount === 1 && !warningShown) {
        const warningOverlay = get('requestSpamWarningOverlay');
        if (warningOverlay) {
          warningOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Отправляем данные на бэкенд
      const submitLead = async () => {
        try {
          // Получаем базовый URL API (заменяем /api/audio/upload на /api/leads)
          const leadsApiUrl = this.apiUrl.replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
          
          // Получаем значения формы
          const comment = get('reqComment')?.value?.trim() || null;
          const preferredMethodRaw = get('reqMethod')?.value || 'WhatsApp';
          
          // Нормализуем preferredContactMethod: WhatsApp -> whatsapp, Phone Call -> phone, Email -> email, Telegram -> telegram
          const methodMap = {
            'WhatsApp': 'whatsapp',
            'Phone Call': 'phone',
            'Email': 'email',
            'Telegram': 'telegram'
          };
          // По умолчанию используем whatsapp, если метод не найден в мапе
          const preferredContactMethod = methodMap[preferredMethodRaw] || 'whatsapp';
          
          const language = (this.currentLang || this.defaultLanguage).toLowerCase();
          
          // Формируем данные для отправки
          const leadData = {
            sessionId: this.sessionId || null,
            source: 'widget_full_form',
            name: name,
            phoneCountryCode: code || null,
            phoneNumber: phone || null,
            email: email || null,
            preferredContactMethod: preferredContactMethod,
            comment: comment,
            language: language,
            propertyId: null, // пока не передаём
            consent: true
          };
          
          // Отправляем запрос
          const response = await fetch(leadsApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
          });
          
          const result = await response.json().catch(() => ({ ok: false, error: 'Failed to parse server response' }));
          
          if (result?.ok === true) {
            // Успешно отправлено → показываем thanks popup
            if (thanksOverlay) thanksOverlay.style.display = 'flex';
            // Очищаем форму
            ['reqName','reqCode','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value=''; });
            if (get('reqConsent')) get('reqConsent').checked = false;
            showContactError(false); showConsentError(false);
            
            // Увеличиваем счетчик отправок
            const submitCount = this.leadSpamProtection.getSubmitCount(formType);
            this.leadSpamProtection.incrementSubmitCount(formType);
            
            // Если это третья отправка (submitCount был 2, стал 3) - устанавливаем блокировку
            if (submitCount === 2) {
              this.leadSpamProtection.setBlocked(formType);
            }
          } else {
            // Ошибка валидации или сервера
            const errorMsg = result.error || 'Failed to submit request. Please try again later.';
            showContactError(true, errorMsg);
            console.error('❌ Lead submission error:', result);
          }
        } catch (err) {
          // Ошибка сети или другая непредвиденная ошибка
          console.error('❌ Lead submission network error:', err);
          showContactError(true, 'Network error. Please check your connection and try again.');
        }
      };
      
      // Вызываем асинхронную функцию отправки (если не показан поп-ап предупреждения)
      if (!(submitCount === 1 && !warningShown)) {
        submitLead();
      }
    });
    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      ['reqName','reqCode','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value=''; });
      if (get('reqConsent')) get('reqConsent').checked = false;
      ['reqCode','reqPhone','reqEmail'].forEach(id => markError(get(id), false));
      showContactError(false); showConsentError(false);
      if (reqEmailGhost) reqEmailGhost.textContent='';
    });
    this.$byIdFrom(root, 'requestThanksOverlayClose')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanksOverlay) thanksOverlay.style.display = 'none';
    });
    // Обработчик закрытия поп-апа блокировки
    this.$byIdFrom(root, 'requestSpamBlockCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const blockOverlay = this.$byIdFrom(root, 'requestSpamBlockOverlay');
      if (blockOverlay) blockOverlay.style.display = 'none';
    });
    // Обработчики поп-апа предупреждения для full form
    const requestWarningOverlay = this.$byIdFrom(root, 'requestSpamWarningOverlay');
    const requestWarningCancelBtn = this.$byIdFrom(root, 'requestSpamWarningCancelBtn');
    const requestWarningContinueBtn = this.$byIdFrom(root, 'requestSpamWarningContinueBtn');
    if (requestWarningCancelBtn) {
      requestWarningCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (requestWarningOverlay) requestWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
      });
    }
    if (requestWarningContinueBtn) {
      requestWarningContinueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (requestWarningOverlay) requestWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
        // Увеличиваем счетчик ДО отправки, чтобы третья попытка сразу показывала блокировку
        this.leadSpamProtection.incrementSubmitCount('lead');
        // Продолжаем отправку после закрытия поп-апа
        // Вызываем обработчик кнопки отправки напрямую
        const sendBtn = root.querySelector('.request-send-btn');
        if (sendBtn) {
          // Эмулируем клик для повторной отправки
          sendBtn.click();
        }
      });
    }
  };
  try { this.setupRequestForm(); } catch {}
 

  // Expose helpers
  this.showScreen = showScreen;
  this.showMainScreen = () => showScreen('main');
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
  // Lightbox interactions: click on backdrop closes; click on image — no action
  try {
    const box = this.$byId('imgLightbox');
    const img = this.$byId('imgLightboxImg');
    if (box) {
      box.addEventListener('click', (e) => {
        if (e.target === box) { // only backdrop, not image
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
    // ignore clicks on other buttons/icons
    if (e.target.closest('button')) return;
    // 1) direct <img> inside card screen
    const imgEl = e.target.closest('.card-screen .cs-image img');
    if (imgEl && imgEl.src) { this.openImageOverlay(imgEl.src); return; }
    // 2) property card background or card mock image areas
    const bgEl = e.target.closest('.card-image, .card-mock .cm-image, .card-screen .cs-image');
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
  this.resetRequestScreen = () => {
    try {
      const thanksOverlay = this.$byId('requestThanksOverlay');
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      const get = (id) => this.$byId(id);
      // Clear fields
      ['reqName','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value = ''; });
      const consent = get('reqConsent');
      if (consent) consent.checked = false, consent.classList.remove('error');
      // Errors and hints
      ['reqCode','reqPhone','reqEmail'].forEach(id => { const el = get(id); if (el) el.classList.remove('error'); });
      const errContact = get('reqContactError'); if (errContact) errContact.classList.remove('visible');
      const errConsent = get('reqConsentError'); if (errConsent) errConsent.classList.remove('visible');
      // Preferred method select
      const methodLabel = get('reqMethodLabel'); if (methodLabel) methodLabel.textContent = 'WhatsApp';
      const methodList = get('reqMethodList'); if (methodList) methodList.style.display = 'none';
      const methodHidden = get('reqMethod'); if (methodHidden) methodHidden.value = 'WhatsApp';
      // Dial select defaults
      const dialBtn = get('reqDialBtn'); 
      if (dialBtn) {
        const codeEl = dialBtn.querySelector('.dial-code'); const flagEl = dialBtn.querySelector('.dial-flag');
        if (codeEl) codeEl.textContent = '+971';
        if (flagEl) flagEl.textContent = '🇦🇪';
      }
      const dialList = get('reqDialList'); if (dialList) dialList.style.display = 'none';
      const codeHidden = get('reqCode'); if (codeHidden) codeHidden.value = '+971';
    } catch {}
  };

  // Helper: reset Context screen state (Leave request form)
  this.resetContextScreen = () => {
    try {
      const get = (id) => this.$byId(id);
      const form = get('ctxRequestForm');
      const btnWrap = this.getRoot().querySelector('.context-leave-request-button');
      const thanks = get('ctxThanks');
      const thanksOverlay = get('ctxThanksOverlay');
      if (thanks) thanks.style.display = 'none';
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      if (form) form.style.display = 'none';
      if (btnWrap) btnWrap.style.display = 'block';
      // Clear fields
      ['ctxName','ctxPhone','ctxEmail'].forEach(id => { const el = get(id); if (el) el.value = ''; });
      const consent = get('ctxConsent'); if (consent) consent.checked = false, consent.classList.remove('error');
      // Errors
      ['ctxPhone','ctxEmail'].forEach(id => { const el = get(id); if (el) el.classList.remove('error'); });
      const errContact = get('ctxContactError'); if (errContact) errContact.classList.remove('visible');
      const errConsent = get('ctxConsentError'); if (errConsent) errConsent.classList.remove('visible');
      // Dial defaults
      const dialBtn = get('ctxDialBtn');
      if (dialBtn) {
        const codeEl = dialBtn.querySelector('.dial-code'); const flagEl = dialBtn.querySelector('.dial-flag');
        if (codeEl) codeEl.textContent = '+971';
        if (flagEl) flagEl.textContent = '🇦🇪';
      }
      const dialList = get('ctxDialList'); if (dialList) dialList.style.display = 'none';
      const codeHidden = get('ctxCode'); if (codeHidden) codeHidden.value = '+971';
    } catch {}
  };
  
  
  // Context: leave request inline form toggles
  this.setupContextRequestForm = () => {
    const btn = this.$byId('ctxLeaveReqBtn');
    const form = this.$byId('ctxRequestForm');
    const ctxHint = this.getRoot().querySelector('#contextScreen .hint-text');
    const thanks = this.$byId('ctxThanks'); // legacy inline
    const thanksOverlay = this.$byId('ctxThanksOverlay');
    if (!btn || !form) return;
    const get = (id) => this.$byId(id);
    const markError = (el, on) => { if (!el) return; el.classList.toggle('error', !!on); };
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toDigits = (v) => String(v || '').replace(/\D+/g, '');
    const isEmail = (v) => emailRe.test(String(v || '').trim());
    const isPhone = (cc, v) => {
      const ccDigits = toDigits(cc);
      const phDigits = toDigits(v);
      if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 3) return false;
      if (!phDigits) return false;
      if (phDigits.length < 9 || phDigits.length > 10) return false;
      if (ccDigits.length + phDigits.length > 15) return false;
      return true;
    };
    // Email inline completion (context)
    const ctxEmail = get('ctxEmail');
    const ctxEmailGhost = get('ctxEmailGhost');
    const updateCtxEmailGhost = () => {
      const v = ctxEmail?.value || '';
      const at = v.indexOf('@');
      if (!ctxEmailGhost || at < 0) { if (ctxEmailGhost) ctxEmailGhost.textContent=''; return; }
      const tail = v.slice(at + 1).toLowerCase();
      let suggestion = null;
      if (tail.length === 0) suggestion = emailSuggestDomains[0];
      else suggestion = emailSuggestDomains.find(d => d.startsWith(tail));
      if (!suggestion) { ctxEmailGhost.textContent=''; return; }
      const suffix = suggestion.slice(tail.length);
      const padLeft = 10;
      const left = padLeft + measureText(ctxEmail, v);
      ctxEmailGhost.style.left = `${left}px`;
      ctxEmailGhost.textContent = suffix;
      ctxEmailGhost.dataset.domain = suggestion;
    };
    ctxEmail?.addEventListener('input', updateCtxEmailGhost);
    ctxEmailGhost?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!ctxEmail || !ctxEmailGhost) return;
      const v = ctxEmail.value;
      const at = v.indexOf('@');
      if (at < 0) return;
      const local = v.slice(0, at);
      const domain = ctxEmailGhost.dataset.domain || '';
      if (!domain) return;
      ctxEmail.value = `${local}@${domain}`;
      ctxEmail.focus();
      updateCtxEmailGhost();
    });
    // Dial select (context)
    const ctxDialBtn = get('ctxDialBtn');
    const ctxDialList = get('ctxDialList');
    const ctxCode = get('ctxCode');
    const toggleCtxDial = (show) => { if (ctxDialList) ctxDialList.style.display = show ? 'block' : 'none'; };
    ctxDialBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = ctxDialList && ctxDialList.style.display === 'block';
      toggleCtxDial(!visible);
    });
    ctxDialList?.querySelectorAll('.dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code') || '+971';
        const flag = item.querySelector('.dial-flag')?.textContent || '🇦🇪';
        if (ctxDialBtn) {
          const codeEl = ctxDialBtn.querySelector('.dial-code'); const flagEl = ctxDialBtn.querySelector('.dial-flag');
          if (codeEl) codeEl.textContent = code;
          if (flagEl) flagEl.textContent = flag;
        }
        if (ctxCode) ctxCode.value = code;
        toggleCtxDial(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!ctxDialList || !ctxDialBtn) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![ctxDialList, ctxDialBtn].some(el => path.includes(el))) toggleCtxDial(false);
    }, { capture:true });
    const showContactError = (on, msg) => { const el = get('ctxContactError'); if (el && typeof msg === 'string' && msg.length) el.textContent = msg; if (el) el.classList.toggle('visible', !!on); };
    const showConsentError = (on) => {
      const wrap = form.querySelector('.ctx-consent');
      const checkbox = get('ctxConsent');
      const textEl = wrap?.querySelector('.ctx-consent-text');
      const el = get('ctxConsentError');
      if (el) el.classList.toggle('visible', !!on);
      if (checkbox) checkbox.classList.toggle('error', !!on);
      if (on && textEl) { textEl.classList.add('shake'); setTimeout(()=>textEl.classList.remove('shake'), 500); }
    };
    const shake = (el) => { if (!el) return; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); };
    btn.addEventListener('click', () => {
      btn.parentElement.style.display = 'none';
      form.style.display = 'block';
      if (ctxHint) ctxHint.style.display = 'none';
      try { this.$byId('ctxName')?.focus(); } catch {}
    });
    this.$byId('ctxCancelBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      form.style.display = 'none';
      btn.parentElement.style.display = 'block';
      if (ctxHint) ctxHint.style.display = '';
      // clear errors
      ['ctxPhone','ctxEmail'].forEach(id => markError(get(id), false));
      showContactError(false); showConsentError(false);
    });
    // clear errors on input/change
    ['ctxPhone','ctxEmail'].forEach(id => get(id)?.addEventListener('input', () => {
      ['ctxPhone','ctxEmail'].forEach(fid => markError(get(fid), false));
      showContactError(false);
    }));
    get('ctxConsent')?.addEventListener('change', () => {
      showConsentError(false);
      const checkbox = get('ctxConsent');
      if (checkbox) checkbox.classList.remove('error');
    });
    this.$byId('ctxSendBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      // validation
      const name = get('ctxName')?.value?.trim() || '';
      const code = get('ctxCode')?.value?.trim() || '';
      const phone = get('ctxPhone')?.value?.trim() || '';
      const email = get('ctxEmail')?.value?.trim() || '';
      const consent = !!get('ctxConsent')?.checked;
      
      // Валидация имени
      if (!name || name.length === 0) {
        markError(get('ctxName'), true);
        shake(get('ctxName'));
        showContactError(true, 'Name is required');
        if (!consent) showConsentError(true);
        return;
      }
      
      const phoneOk = isPhone(code, phone);
      const emailOk = isEmail(email);
      const contactOk = phoneOk || emailOk;
      const phoneHas = phone.length > 0;
      const emailHas = email.length > 0;
      // empty both → generic error + shake both
      if (!phoneHas && !emailHas) {
        markError(get('ctxPhone'), true);
        markError(get('ctxEmail'), true);
        shake(get('ctxPhone')); shake(get('ctxEmail'));
        showContactError(true, 'Required: phone or email');
        if (!consent) showConsentError(true);
        return;
      }
      if (contactOk) {
        markError(get('ctxPhone'), false);
        markError(get('ctxEmail'), false);
        markError(get('ctxName'), false);
        showContactError(false);
      } else {
        markError(get('ctxPhone'), phoneHas && !phoneOk);
        markError(get('ctxEmail'), emailHas && !emailOk);
        let msg = phoneHas && !phoneOk
          ? 'Invalid phone number. Use 9–10 digits after country code.'
          : 'Invalid email address. Example: name@domain.com';
        showContactError(true, msg);
        if (!phoneOk && phoneHas) shake(get('ctxPhone'));
        if (!emailOk && emailHas) shake(get('ctxEmail'));
        return;
      }
      if (!consent) { showConsentError(true); shake(form.querySelector('.ctx-consent')); return; }
      
      // Проверка защиты от спама (общая для обеих форм)
      const formType = 'lead'; // Общий тип для full и short форм
      const submitCount = this.leadSpamProtection.getSubmitCount(formType);
      const isBlocked = this.leadSpamProtection.isBlocked(formType);
      const warningShown = this.leadSpamProtection.isWarningShown(formType);
      
      // Если заблокирован - показываем поп-ап блокировки
      if (isBlocked) {
        const blockOverlay = get('ctxSpamBlockOverlay');
        const timerEl = get('ctxSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если счетчик уже 2 (после нажатия "Продолжить" во второй раз) - устанавливаем блокировку ПЕРЕД отправкой
      if (submitCount === 2) {
        this.leadSpamProtection.setBlocked(formType);
        const blockOverlay = get('ctxSpamBlockOverlay');
        const timerEl = get('ctxSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если вторая отправка и предупреждение еще не показывали - показываем поп-ап предупреждения
      if (submitCount === 1 && !warningShown) {
        const warningOverlay = get('ctxSpamWarningOverlay');
        if (warningOverlay) {
          warningOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Отправляем данные на бэкенд
      const submitShortFormLead = async () => {
        try {
          // Получаем базовый URL API (заменяем /api/audio/upload на /api/leads)
          const leadsApiUrl = this.apiUrl.replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
          
          const language = (this.currentLang || this.defaultLanguage).toLowerCase();
          
          // Формируем данные для отправки (short form не имеет preferredContactMethod и comment)
          const leadData = {
            sessionId: this.sessionId || null,
            source: 'widget_short_form',
            name: name,
            phoneCountryCode: code || null,
            phoneNumber: phone || null,
            email: email || null,
            preferredContactMethod: 'phone', // по умолчанию для short form
            comment: null, // short form не имеет поля комментария
            language: language,
            propertyId: null, // пока не передаём
            consent: true
          };
          
          // Отправляем запрос
          const response = await fetch(leadsApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
          });
          
          const result = await response.json().catch(() => ({ ok: false, error: 'Failed to parse server response' }));
          
          if (result?.ok === true) {
            // Успешно отправлено → показываем thanks popup
            form.style.display = 'none';
            if (thanksOverlay) thanksOverlay.style.display = 'flex';
            // Очищаем поля
            ['ctxName','ctxPhone','ctxEmail'].forEach(id => { const el = this.$byId(id); if (el) el.value=''; });
            const c = this.$byId('ctxConsent'); if (c) c.checked = false;
            showContactError(false); showConsentError(false);
            
            // Увеличиваем счетчик отправок (если еще не увеличен при нажатии "Продолжить")
            const currentCount = this.leadSpamProtection.getSubmitCount(formType);
            // Увеличиваем только если счетчик еще не был увеличен (не был нажат "Продолжить")
            if (currentCount < 2) {
              this.leadSpamProtection.incrementSubmitCount(formType);
            }
            
            // Телеметрия: логируем успешную отправку short form
            try {
              logTelemetry(TelemetryEventTypes.LEAD_FORM_SUBMIT, {
                formType: 'short',
                sessionId: this.sessionId || null,
                language: language,
                hasComment: false,
                preferredContactMethod: 'phone',
                leadId: result.leadId || null
              });
            } catch (err) {
              console.error('❌ Failed to log LEAD_FORM_SUBMIT:', err);
            }
          } else {
            // Ошибка валидации или сервера
            const errorMsg = result.error || 'Failed to submit request. Please try again later.';
            showContactError(true, errorMsg);
            console.error('❌ Lead submission error:', result);
            
            // Телеметрия: логируем ошибку отправки
            try {
              logTelemetry(TelemetryEventTypes.LEAD_FORM_ERROR, {
                formType: 'short',
                sessionId: this.sessionId || null,
                language: language,
                error: errorMsg
              });
            } catch (err) {
              console.error('❌ Failed to log LEAD_FORM_ERROR:', err);
            }
          }
        } catch (err) {
          // Ошибка сети или другая непредвиденная ошибка
          console.error('❌ Lead submission network error:', err);
          showContactError(true, 'Network error. Please check your connection and try again.');
          
          // Телеметрия: логируем сетевую ошибку
          try {
            logTelemetry(TelemetryEventTypes.LEAD_FORM_ERROR, {
              formType: 'short',
              sessionId: this.sessionId || null,
              language: (this.currentLang || this.defaultLanguage).toLowerCase(),
              error: 'Network error'
            });
          } catch (telemetryErr) {
            console.error('❌ Failed to log LEAD_FORM_ERROR:', telemetryErr);
          }
        }
      };
      
      // Вызываем асинхронную функцию отправки (если не показан поп-ап предупреждения)
      if (!(submitCount === 1 && !warningShown)) {
        submitShortFormLead();
      }
    });
    // Обработчик закрытия поп-апа блокировки для short form
    this.$byId('ctxSpamBlockCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const blockOverlay = this.$byId('ctxSpamBlockOverlay');
      if (blockOverlay) blockOverlay.style.display = 'none';
    });
    this.$byId('ctxThanksDoneBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanks) thanks.style.display = 'none';
      btn.parentElement.style.display = 'block';
      if (ctxHint) ctxHint.style.display = '';
    });
    this.$byId('ctxThanksOverlayClose')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      btn.parentElement.style.display = 'block';
      if (ctxHint) ctxHint.style.display = '';
    });
    // Обработчик закрытия поп-апа блокировки для short form
    this.$byId('ctxSpamBlockCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const blockOverlay = this.$byId('ctxSpamBlockOverlay');
      if (blockOverlay) blockOverlay.style.display = 'none';
    });
    // Обработчики поп-апа предупреждения для short form
    const ctxWarningOverlay = this.$byId('ctxSpamWarningOverlay');
    const ctxWarningCancelBtn = this.$byId('ctxSpamWarningCancelBtn');
    const ctxWarningContinueBtn = this.$byId('ctxSpamWarningContinueBtn');
    if (ctxWarningCancelBtn) {
      ctxWarningCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (ctxWarningOverlay) ctxWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
      });
    }
    if (ctxWarningContinueBtn) {
      ctxWarningContinueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (ctxWarningOverlay) ctxWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
        // Увеличиваем счетчик ДО отправки, чтобы третья попытка сразу показывала блокировку
        this.leadSpamProtection.incrementSubmitCount('lead');
        // Продолжаем отправку после закрытия поп-апа
        // Вызываем обработчик кнопки отправки напрямую
        const sendBtn = this.$byId('ctxSendBtn');
        if (sendBtn) {
          // Эмулируем клик для повторной отправки
          sendBtn.click();
        }
      });
    }
  };
  try { this.setupContextRequestForm(); } catch {}
  
  // Context: Data storage info popup
  this.setupDataStoragePopup = () => {
    const trigger = this.getRoot().querySelector('.data-storage-text');
    const overlay = this.$byId('dataOverlay');
    const btn = this.$byId('dataUnderstoodBtn');
    trigger?.addEventListener('click', () => { if (overlay) overlay.style.display = 'flex'; });
    btn?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
  };
  try { this.setupDataStoragePopup(); } catch {}
  
  // Context: "What data do we know?" popup (insights)
  this.setupWhatDataPopup = () => {
    const trigger = this.getRoot().querySelector('#contextScreen .footer-text');
    const overlay = this.$byId('whatDataOverlay');
    const body = this.$byId('whatDataBody');
    const btn = this.$byId('whatDataUnderstoodBtn');
    const labelMap = {
      name: 'Name',
      operation: 'Operation',
      budget: 'Budget',
      type: 'Type',
      location: 'Location',
      rooms: 'Rooms',
      area: 'Area',
      details: 'Details',
      preferences: 'Preferences'
    };
    const render = () => {
      const u = (typeof this.getUnderstanding === 'function') ? this.getUnderstanding() : (this.understanding?.export?.() || {});
      const lines = [];
      Object.keys(labelMap).forEach((k) => {
        const v = u?.[k];
        if (v !== null && v !== undefined && String(v).trim().length) {
          lines.push(`<li><b>${labelMap[k]}:</b> ${String(v)}</li>`);
        }
      });
      const listHtml = lines.length ? `<ul style="padding-left:16px; margin:6px 0 10px 0;">${lines.join('')}</ul>` : `<div style="margin:6px 0 10px 0;">No data collected yet.</div>`;
      const consent = `<div style="margin-top:10px;">We collect information only with your consent and use it non‑commercially to improve property matching.</div>`;
      if (body) body.innerHTML = listHtml + consent;
    };
    trigger?.addEventListener('click', () => { render(); if (overlay) overlay.style.display = 'flex'; });
    btn?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
  };
  try { this.setupWhatDataPopup(); } catch {}

  // Request: Privacy Policy confirm
  this.setupPrivacyConfirm = () => {
    const link = this.getRoot().querySelector('.request-privacy-link');
    const overlay = this.$byId('privacyOverlay');
    const btnCancel = this.$byId('privacyCancelBtn');
    const btnContinue = this.$byId('privacyContinueBtn');
    const url = 'https://probable-akubra-781.notion.site/Privacy-Policy-2c8be0766f27802fb110cb4ab372771e';
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (overlay) overlay.style.display = 'flex';
      });
    }
    btnCancel?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
    btnContinue?.addEventListener('click', () => {
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { location.href = url; }
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupPrivacyConfirm(); } catch {}
  // Context: Privacy Policy confirm
  this.setupContextPrivacyConfirm = () => {
    const link = this.getRoot().querySelector('.ctx-privacy-link');
    const overlay = this.$byId('ctxPrivacyOverlay');
    const btnCancel = this.$byId('ctxPrivacyCancelBtn');
    const btnContinue = this.$byId('ctxPrivacyContinueBtn');
    const url = 'https://probable-akubra-781.notion.site/Privacy-Policy-2c8be0766f27802fb110cb4ab372771e';
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (overlay) overlay.style.display = 'flex';
      });
    }
    btnCancel?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
    btnContinue?.addEventListener('click', () => {
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { location.href = url; }
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupContextPrivacyConfirm(); } catch {}
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
      // Лимит карточек в одном слайдере: максимум 12
      try {
        const track = this.getRoot().querySelector('.cards-slider .cards-track');
        const count = track ? track.children.length : 0;
        if (count >= 12) {
          // shake-эффект на кнопке
          const btn = e.target.closest('.card-btn.next') || e.target;
          try {
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 500);
          } catch {}
          // системное сообщение ассистента
          try {
            const msg = 'Подскажите, какой из предложенных мною вариантов вам подошёл больше всего? Возможно, вы бы могли уточнить детальнее, что вы ищете, чтобы я смог предложить вам лучшие варианты?';
            this.ui?.addMessage?.({ type: 'assistant', content: msg, timestamp: new Date() });
          } catch {}
          return; // не отправляем next при достигнутом лимите
        }
      } catch {}
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
    } else if (e.target.matches('.card-btn[data-action="select"]')) {
      // Flip: визуальный тест — показываем back сторону карточки
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.add('flipped');
      // RMv3 / Sprint 1 / Task 1: фиксируем факт выбора карточки на сервере (server-first)
      const variantId = e.target.getAttribute('data-variant-id');
      try {
        if (this.api && variantId) {
          this.api.sendCardInteraction('select', variantId);
        }
      } catch {}
    } else if (e.target.closest('.card-back-header__close')) {
      // Назад с описания на фото (front)
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.remove('flipped');
    } else if (e.target.matches('.btn-open-form') || e.target.closest('.btn-open-form')) {
      // Описание -> форма заявки
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.add('card-slide--form-open');
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
    } else if (e.target.matches('.card-btn[data-action="send_card"]')) {
      // Показать карточку из последнего предложения
      const container = e.target.closest('.card-screen');
      if (container) container.remove();
      // ❗ Начинаем новый показ: удалим старый слайдер (если был)
      try {
        const oldHost = this.getRoot().querySelector('.card-screen.cards-slider-host');
        if (oldHost && oldHost.parentElement) {
          // 🆕 Sprint IV: отправляем ui_slider_ended перед удалением slider host (выход из slider-режима)
          if (this.api) {
            try {
              this.api.sendSliderEnded();
            } catch (e) {
              console.warn('Error sending slider ended confirmation:', e);
            }
          }
          oldHost.parentElement.removeChild(oldHost);
        }
      } catch {}
      // Мгновенно покажем карточку локально, чтобы не ждать сети
      try {
        if (this._lastSuggestedCard) {
          this.showMockCardWithActions(this._lastSuggestedCard);
          this.scrollCardHostIntoView();
          
          // Логируем card_show
          const track = this.getRoot().querySelector('.cards-slider .cards-track');
          const slides = track ? track.querySelectorAll('.card-slide') : [];
          
          logTelemetry(TelemetryEventTypes.CARD_SHOW, {
            propertyId: this._lastSuggestedCard.id,
            index: 0,
            totalInSlider: slides.length,
            source: 'recommendation'
          });
        }
      } catch {}
      // Попросим у бэкенда динамический комментарий (первый показ)
      try {
        if (this._lastSuggestedCard && this._lastSuggestedCard.id) {
          await this.api.sendCardInteraction('show', this._lastSuggestedCard.id);
        }
      } catch {}
      this.events.emit('send_card');
    } else if (e.target.matches('.card-btn[data-action="continue_dialog"]')) {
      const container = e.target.closest('.card-screen');
      if (container) container.remove();
      this.events.emit('continue_dialog');
    } else if (e.target.matches('.cards-dot')) {
      // Навигация по слайдеру через точки
      const dot = e.target;
      const row = dot.closest('.cards-dots-row');
      const slider = this.getRoot().querySelector('.cards-slider');
      if (!row || !slider) return;
      const dots = Array.from(row.querySelectorAll('.cards-dot'));
      const idx = dots.indexOf(dot);
      const slides = slider.querySelectorAll('.card-slide');
      if (idx >= 0 && slides[idx]) {
        const left = slides[idx].offsetLeft;
        slider.scrollTo({ left, behavior: 'smooth' });
        try { this.updateActiveCardSlide(); } catch {}
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
      // Show recording indicator on current screen
      const isMainScreen = this.$byId('mainScreen')?.classList.contains('hidden') === false;
      this.showRecordingIndicator(isMainScreen ? 'main' : 'chat');
      // Update toggle button state for both screens
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
    });
    this.events.on('recordingStopped', () => {
      // Hide recording indicators
      this.hideRecordingIndicator('main');
      this.hideRecordingIndicator('chat');
      // Update toggle button state for both screens
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
    });
    this.events.on('recordingCancelled', () => {
      // Hide recording indicators
      this.hideRecordingIndicator('main');
      this.hideRecordingIndicator('chat');
      // Update toggle button state for both screens
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
    });

    // Text message sent - switch to chat screen if on main
    this.events.on('textMessageSent', (d) => { 
      console.log('📤 Text message sent:', d?.text?.slice(0,50));
      // Switch to chat screen if we're on main screen
      if (this.$byId('mainScreen')?.classList.contains('hidden') === false) {
        this.showChatScreen();
      }
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
    const indicator = screen === 'main' 
      ? this.$byId('mainRecordingIndicator')
      : this.$byId('recordingIndicator');
    
    const wrapper = screen === 'main'
      ? this.getRoot().querySelector('#mainTextInput').closest('.text-input-wrapper')
      : this.getRoot().querySelector('#textInput').closest('.text-input-wrapper');
    
    if (indicator) {
      indicator.style.display = 'flex';
      if (wrapper) wrapper.classList.add('recording');
    }
  }

  hideRecordingIndicator(screen = 'chat') {
    const indicator = screen === 'main' 
      ? this.$byId('mainRecordingIndicator')
      : this.$byId('recordingIndicator');
    
    const wrapper = screen === 'main'
      ? this.getRoot().querySelector('#mainTextInput').closest('.text-input-wrapper')
      : this.getRoot().querySelector('#textInput').closest('.text-input-wrapper');
    
    if (indicator) {
      indicator.style.display = 'none';
      if (wrapper) wrapper.classList.remove('recording');
    }
  }




  
  startRecording() {
    if (this.ui.getCurrentState() === 'idle' || this.ui.getCurrentState() === 'typing' || this.ui.getCurrentState() === 'main') {
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
    const ctxProgressText = this.$byId('ctxProgressText');
    const ctxStatusText = this.$byId('ctxStatusText');
    const ctxStageMessage = this.$byId('ctxStageMessage');
      const progress = (typeof understanding.progress === 'number') ? understanding.progress : 0;
    if (progressFill && progressText) {
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}% — ${progress === 0 ? 'ожидание' : 'обработка'}`;
    }
    if (ctxProgressText) ctxProgressText.textContent = `${Math.max(0, Math.min(99, Math.round(progress)))}%`;
    if (ctxStatusText || ctxStageMessage) {
      // Map progress to state (explicit ranges with fallbacks)
      const p = progress;
      let status = 'initial request';
      let message = 'We’ve received your initial request. Share a few details to get started.';
      if ((p >= 22 && p <= 33) || (p >= 12 && p < 22)) {
        status = 'more info added';
        message = 'Great — we added more details. Keep going to refine the search.';
      } else if ((p >= 44 && p <= 55) || (p > 33 && p < 44)) {
        status = 'half path done';
        message = 'Halfway there. A couple more details will sharpen the results.';
      } else if ((p >= 66 && p <= 77) || (p > 55 && p < 66)) {
        status = 'almost done';
        message = 'Almost done. Final tweaks and we’ll have precise matches.';
      } else if ((p >= 88 && p <= 99) || (p > 77)) {
        status = 'fulfilled';
        message = 'Well done! Your data is enough for a confident, targeted search.';
      }
      if (ctxStatusText) ctxStatusText.textContent = `Status: ${status}`;
      if (ctxStageMessage) ctxStageMessage.textContent = message;
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

  updateObjectCount(count) {
    const pill = this.$byId('objectsCounterPill');
    if (!pill) return;
    const numeric = Number(count);
    const value = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
    if (value === 0) {
      pill.textContent = 'Объекты не найдены';
      return;
    }
    const formatted = new Intl.NumberFormat('en-US').format(value);
    pill.textContent = `Найдено ${formatted} объектов`;
  }

  _getPropertiesEndpointCandidates() {
    const defaults = [
      'https://voice-widget-backend-tgdubai-split.up.railway.app/api/properties',
      'https://voice-widget-backend-tgdubai-split.up.railway.app/api/cards'
    ];
    try {
      const u = new URL(String(this.apiUrl || ''));
      const base = `${u.protocol}//${u.host}`;
      return [`${base}/api/properties`, `${base}/api/cards`, ...defaults];
    } catch {
      return defaults;
    }
  }

  async loadAllProperties() {
    const candidates = this._getPropertiesEndpointCandidates();
    for (const endpoint of candidates) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) continue;
        const data = await response.json().catch(() => ({}));
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.properties)
            ? data.properties
            : Array.isArray(data.cards)
              ? data.cards
              : Array.isArray(data.items)
                ? data.items
                : [];
        if (Array.isArray(list)) {
          return list.filter((item) => item?.active !== false && item?.isActive !== false);
        }
      } catch {}
    }
    return [];
  }

  async initializePropertiesCatalog() {
    try {
      if (!window.appState) window.appState = {};
      const allProperties = await this.loadAllProperties();
      window.appState.allProperties = Array.isArray(allProperties) ? allProperties : [];
      this.updateObjectCount(window.appState.allProperties.length);
    } catch {
      try {
        if (!window.appState) window.appState = {};
        window.appState.allProperties = [];
      } catch {}
      this.updateObjectCount(0);
    }
  }

  clearPropertiesSlider() {
    try {
      const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
      if (host?.parentElement) host.parentElement.removeChild(host);
      this.getRoot().querySelectorAll('.card-btn[data-action="send_card"], .card-btn[data-action="continue_dialog"]').forEach((btn) => {
        const panel = btn.closest('.card-screen');
        if (panel?.parentElement) panel.parentElement.removeChild(panel);
      });
      this.getRoot().querySelectorAll('.message.assistant.dynamic-card-comment').forEach((el) => el.remove());
    } catch {}
  }

  renderPropertiesFromCatalog() {
    const list = Array.isArray(window?.appState?.allProperties) ? window.appState.allProperties : [];
    if (!list.length) {
      this.updateObjectCount(0);
      return;
    }
    this.clearPropertiesSlider();
    list.forEach((property) => {
      try { this.showPropertyCard(property); } catch {}
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

  // Send text from main screen
  sendTextFromMainScreen(text) {
    // Clear input
    const mainTextInput = this.$byId('mainTextInput');
    if (mainTextInput) {
      mainTextInput.value = '';
          // Update send button state
    const mainSendButton = this.$byId('mainSendButton');
    if (mainSendButton) {
      mainSendButton.disabled = true;
      mainSendButton.setAttribute('aria-disabled', 'true');
    }
    }

    // Switch to chat screen
    this.showChatScreen();

    // Add user message to chat
    const userMessage = { type: 'user', content: text, timestamp: new Date() };
    this.ui.addMessage(userMessage);

    // Send to API
    this.api.sendTextMessageFromText(text);
  }

  // Update toggle button state
  updateToggleButtonState(screen) {
    const isRecording = this.audioRecorder.isRecording;
    let toggleButton = null;

    if (screen === 'main') {
      toggleButton = this.$byId('mainToggleButton');
    } else if (screen === 'chat') {
      toggleButton = this.$byId('toggleButton');
    }

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
    let textInput = null;
    let sendButton = null;

    if (screen === 'main') {
      textInput = this.$byId('mainTextInput');
      sendButton = this.$byId('mainSendButton');
    } else if (screen === 'chat') {
      textInput = this.$byId('textInput');
      sendButton = this.$byId('sendButton');
    }

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

  // Ensure slider container exists in thread
  ensureCardsSlider() {
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
      </div>`;
      thread.appendChild(host);
      
      // 🆕 Sprint IV: отправляем ui_slider_started при создании slider host (вход в slider-режим)
      if (this.api) {
        requestAnimationFrame(() => {
          try {
            this.api.sendSliderStarted();
          } catch (e) {
            console.warn('Error sending slider started confirmation:', e);
          }
        });
      }
      
      // attach active slide updater
      const slider = host.querySelector('.cards-slider');
      const update = () => { try { this.updateActiveCardSlide(); } catch {} };
      if (slider) {
        slider.addEventListener('scroll', update, { passive: true });
        try { window.addEventListener('resize', update); } catch {}
        requestAnimationFrame(update);
      }
    }
    return host.querySelector('.cards-track');
  }

  // Add single card as slide into slider
  addCardSlide(normalized) {
    const track = this.ensureCardsSlider();
    if (!track) return;
    const locale = this.getCurrentLocale();
    const slide = document.createElement('div');
    slide.className = 'card-slide';
    const fallbackAssetOpenUrl = this.getCardAssetFallbackDataUrl();
    const assetSlots = Array.isArray(normalized.assetImages) ? normalized.assetImages.slice(0, 4) : [];
    while (assetSlots.length < 4) assetSlots.push('');
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
              <!-- Кнопка «Нравится» временно снята в виду чистки интерфейса (логика не удалена)
              <button class="card-btn like" data-action="like" data-variant-id="${normalized.id}" aria-label="Нравится">
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              -->
            </div>
            <div class="cs-image-media">${normalized.image ? `<img src="${normalized.image}" alt="${normalized.city} ${normalized.district}">` : 'Put image here'}</div>
          </div>
          <div class="cs-body">
            <div class="cs-row"><div class="cs-title">${normalized.city}</div><div class="cs-title">${normalized.priceLabel}</div></div>
            <div class="cs-row"><div class="cs-sub">${normalized.district}${normalized.neighborhood ? (', ' + normalized.neighborhood) : ''}</div><div class="cs-sub">${normalized.roomsLabel}</div></div>
            <div class="cs-row"><div class="cs-sub"></div><div class="cs-sub">${normalized.floorLabel}</div></div>
          </div>
          <div class="cards-dots-row"></div>
          <div class="card-actions-wrap">
            <div class="card-actions-panel">
              <button class="card-btn select" data-action="select" data-variant-id="${normalized.id}">${locale.cardSelect || 'Выбрать'}</button>
              <button class="card-btn next" data-action="next" data-variant-id="${normalized.id}">${locale.cardNext || 'Ещё одну'}</button>
            </div>
            <div class="card-dynamic-comment" style="margin:8px 0 0 0; font-size: 14px; line-height: 1.35; opacity: 0.85;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="card-slide-back">
        <div class="card-slide-back__bg${normalized.image ? '' : ' card-slide-back__bg--fallback'}" aria-hidden="true"></div>
        <div class="card-back-header">
          <button type="button" class="card-back-header__close" aria-label="Back">
            <img src="${ASSETS_BASE}${this.getReturnIconByTheme()}" alt="Back">
          </button>
          <span class="card-back-header__title">${normalized.id || ''} / ${normalized.city || ''} / ${normalized.priceLabel || ''}</span>
          <span class="card-back-header__spacer" aria-hidden="true"></span>
        </div>
        <div class="card-back-separator"></div><div class="card-back-description-slot">${(normalized.description || 'Description null').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <div class="card-back-specs">
          <span class="card-back-specs__item">Square: ${normalized.area_m2 || 'null'} m²</span>
          <span class="card-back-specs__item">Price/m²: ${normalized.pricePerM2Label || 'null'} AED</span>
          <span class="card-back-specs__item">Floor: ${normalized.floor || 'null'}</span>
          <span class="card-back-specs__item">Bathrooms: ${normalized.bathrooms || 'null'}</span>
        </div>
        <div class="card-back-assets">${assetTilesHtml}</div>
        <button type="button" class="btn-open-form">${locale.leaveRequest}</button>
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
    track.appendChild(slide);
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
    
    // scroll to last slide
    requestAnimationFrame(() => {
      // вычисляем целевую позицию именно нового слайда
      const targetLeft = slide.offsetLeft;
      try {
        const slider = this.getRoot().querySelector('.cards-slider');
        if (slider) slider.scrollTo({ left: targetLeft, behavior: 'smooth' });
        else track.scrollTo({ left: targetLeft, behavior: 'smooth' });
      } catch { track.scrollTo({ left: targetLeft, behavior: 'smooth' }); }
      // пометим новый слайд активным сразу
      try {
        const slider = this.getRoot().querySelector('.cards-slider');
        const allSlides = slider ? slider.querySelectorAll('.card-slide') : [];
        allSlides.forEach(s => s.classList.remove('active'));
        slide.classList.add('active');
        // обновим dots: активная — последний индекс
        const rows = slider ? slider.querySelectorAll('.cards-dots-row') : [];
        const activeIdx = allSlides.length ? allSlides.length - 1 : 0;
        rows.forEach(row => {
          const dots = row.querySelectorAll('.cards-dot');
          dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
        });
      } catch {}
      // прокрутить именно контейнер сообщений до карточки
      try { this.scrollCardHostIntoView(); } catch {}
      try { this.renderSliderDots(); } catch {}
    });
  }

  // Show property card in slider
  showPropertyCard(property) {
    const normalized = this.normalizeCardData(property);
    this.addCardSlide(normalized);
  }

  // Show mock card in slider (with actions)
  showMockCardWithActions(mock = {}) {
    const normalized = this.normalizeCardData(mock);
    this.addCardSlide(normalized);
  }

  // Обновить/установить динамический комментарий под активной карточкой
  setCardComment(text = '') {
    try {
      const slider = this.getRoot().querySelector('.cards-slider');
      if (!slider) return;
      const apply = () => {
        const active = slider.querySelector('.card-slide.active');
        const host = active || slider.querySelector('.card-slide:last-child');
        if (!host) return;
        const wrap = host.querySelector('.card-dynamic-comment');
        if (wrap) wrap.textContent = text || '';
      };
      // моментально на последний слайд
      apply();
      // повторим после layout/активации
      requestAnimationFrame(apply);
    } catch {}
  }

  // Рендер “пузыря” ассистента, синхронизированного с карточкой (не сохраняем в историю)
  renderCardCommentBubble(text = '') {
    try {
      const thread = this.$byId('thread');
      const host = this.getRoot().querySelector('.card-screen.cards-slider-host');
      if (!thread || !host) return;
      // Удалим предыдущий пузырь
      const prev = this.getRoot().querySelector('.message.assistant.dynamic-card-comment');
      if (prev && prev.parentElement) prev.parentElement.removeChild(prev);
      if (!text) return;
      // Определим связанный variantId активной карточки
      const active = this.getRoot().querySelector('.cards-slider .card-slide.active .cs');
      const variantId = active ? active.getAttribute('data-variant-id') : '';
      // Построим пузырь с той же разметкой, что и обычный assistant
      const wrapper = document.createElement('div');
      wrapper.className = 'message assistant dynamic-card-comment';
      if (variantId) wrapper.setAttribute('data-variant-id', variantId);
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble widget-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);
      // Вставим сразу после слайдера
      host.insertAdjacentElement('afterend', wrapper);
      // И прокрутим контейнер сообщений так, чтобы карточка и пузырь были видны
      this.scrollCardHostIntoView();
    } catch {}
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

  // (удалено) Генератор короткого комментария под карточкой.
  // Источник подсказки теперь — ответ бэкенда (assistantMessage).

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

  // ---------- ПРЕДЛОЖЕНИЕ ПОКАЗАТЬ КАРТОЧКУ ----------
  suggestCardOption(data = {}) {
    const thread = this.$byId('thread');
    const messages = this.$byId('messagesContainer');
    if (!thread || !messages) return;

    this._lastSuggestedCard = data;
    const locale = this.getCurrentLocale();

    const panel = document.createElement('div');
    panel.className = 'card-screen';
    panel.innerHTML = `
      <div class="cs" style="background:transparent; box-shadow:none;">
        <div class="card-actions-wrap">
        <div class="card-actions-panel">
            <button class="card-btn like" data-action="send_card">${locale.cardShow}</button>
            <button class="card-btn next" data-action="continue_dialog">${locale.cardCancel}</button>
          </div>
        </div>
      </div>`;

    thread.appendChild(panel);

    requestAnimationFrame(() => {
      const H = messages.clientHeight;
      messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
    });
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
  // - новая сущность: in-dialog lead block (не requestScreen/contextScreen)
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
                <input class="in-dialog-lead__input" id="inDialogLeadPhone${s}" type="tel" inputmode="tel" autocomplete="tel" placeholder="${locale.requestPhonePlaceholder}">
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
    const priceNum = toInt(raw.price);
    const roomsNum = toInt(raw.rooms);
    const floorNum = toInt(raw.floor);
    const areaNum = toInt(raw.area_m2);
    const pricePerM2Num = toInt(raw.price_per_m2);
    const bathroomsNum = toInt(raw.bathrooms);
    const city = raw.city || raw.location || '';
    const district = raw.district || raw.area || '';
    const neighborhood = raw.neighborhood || raw.neiborhood || raw.neiborhood || '';
    const image = raw.image || raw.imageUrl || '';
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

    const priceLabel = priceNum != null ? `${priceNum.toLocaleString('en-US')} AED` : (raw.price || raw.priceLabel || '');
    const roomsLabel = roomsNum != null ? `${roomsNum} rooms` : (raw.rooms || '');
    const floorLabel = floorNum != null ? `${floorNum} floor` : (raw.floor || '');
    const pricePerM2Label = formatNumberUS(pricePerM2Num != null ? pricePerM2Num : raw.price_per_m2);

    return {
      id: raw.id || '',
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
      priceEUR: priceNum != null ? priceNum : null,
      priceLabel
    };
  }

  getCardAssetFallbackDataUrl() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="48" fill="#e9e9e9"/><rect x="24" width="24" height="48" fill="#f5f5f5"/></pattern></defs><rect width="1200" height="900" fill="url(#p)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="72" font-weight="700">IMG NOT FOUND</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // ---------- УТИЛИТЫ ----------
  getLangCode() {
    const code = String(this.currentLang || this.defaultLanguage || 'EN').trim().toLowerCase().slice(0, 2);
    return ['en', 'es', 'ru'].includes(code) ? code : 'en';
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
    this.stopRecordingTimer('main');
    this.stopRecordingTimer('chat');
    
    this.audioRecorder?.cleanupRecording?.();
    this.ui?.clearRecordingState?.();
    this.events?.clear?.();
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
      '.main-screen:not(.hidden) .screen-header, ' +
      '.dialog-screen:not(.hidden) .screen-header, ' +
      '.context-screen:not(.hidden) .screen-header, ' +
      '.request-screen:not(.hidden) .screen-header'
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
        else if (this._menuState === 'selected') this._menuState = 'open';
        this.updateMenuUI();
      };
    }
  }

  updateMenuUI() {
    const overlay = this.getRoot().querySelector('.menu-overlay');
    if (!overlay) return;
    const locale = this.getCurrentLocale();
    const languageCodes = ['RU', 'EN', 'AR'];
    const languageFlags = { RU: '🇷🇺', EN: '🇬🇧', AR: '🇦🇪' };
    const languageLabels = { RU: 'Русский', EN: 'English', AR: 'العربية' };
    const themeMode = this.getTheme();
    const themeActionLabel = themeMode === 'light' ? locale.menuThemeToDark : locale.menuThemeToLight;
    const themeActionIcon = themeMode === 'light' ? 'dark-theme.svg' : 'light-theme.svg';
    if (!this._menuLanguageCode || !languageFlags[this._menuLanguageCode]) this._menuLanguageCode = this.currentLang || this.defaultLanguage;
    if (typeof this._menuLanguageDropdownOpen !== 'boolean') this._menuLanguageDropdownOpen = false;
    const syncLanguageOutsideClick = () => {
      const shouldListen = this._menuState === 'open' && this._menuLanguageDropdownOpen;
      if (!shouldListen) {
        if (this._menuLanguageOutsideClickBound && this._menuLanguageOutsideClickHandler) {
          this.getRoot().removeEventListener('click', this._menuLanguageOutsideClickHandler, true);
        }
        this._menuLanguageOutsideClickBound = false;
        return;
      }
      if (!this._menuLanguageOutsideClickHandler) {
        this._menuLanguageOutsideClickHandler = (e) => {
          if (!this._menuLanguageDropdownOpen || this._menuState !== 'open') return;
          const picker = this.getRoot()?.querySelector('[data-language-picker]');
          if (!picker) return;
          const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
          if (path.includes(picker)) return;
          this._menuLanguageDropdownOpen = false;
          this.updateMenuUI();
        };
      }
      if (!this._menuLanguageOutsideClickBound) {
        this.getRoot().addEventListener('click', this._menuLanguageOutsideClickHandler, true);
        this._menuLanguageOutsideClickBound = true;
      }
    };
    if (this._menuState === 'closed' || !this._menuState) overlay.classList.remove('open'); else overlay.classList.add('open');

    // Toggle side header actions and logo on active screen
    try {
      const activeHeader = this.getRoot().querySelector(
        '.main-screen:not(.hidden) .screen-header, ' +
        '.dialog-screen:not(.hidden) .screen-header, ' +
        '.context-screen:not(.hidden) .screen-header, ' +
        '.request-screen:not(.hidden) .screen-header'
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
          <div class="menu-col">
            <button class="menu-btn menu-btn--request" data-action="request"><img class="menu-btn__icon" src="${ASSETS_BASE}${this.getContactIconByTheme()}" alt="">${locale.menuRequest}</button>
            <div class="menu-language ${this._menuLanguageDropdownOpen ? 'open' : ''}" data-language-picker>
              <button class="menu-btn menu-btn--language menu-language-trigger" type="button" data-action="language">
                <img class="menu-btn__icon" src="${ASSETS_BASE}${this.getLanguageIconByTheme()}" alt="">${locale.menuLanguage}
              </button>
              <div class="menu-language-dropdown ${this._menuLanguageDropdownOpen ? 'open' : ''}">
                ${languageCodes.map((code) => `<button class="menu-language-option ${this._menuLanguageCode === code ? 'is-active' : ''}" type="button" data-language-code="${code}">${languageFlags[code]} ${languageLabels[code] || code}</button>`).join('')}
              </div>
            </div>
          </div>
          <div class="menu-col menu-col--middle" style="width:80px; align-items:center; justify-content:center;">
            <button class="menu-close-btn" aria-label="Close menu"><img src="${ASSETS_BASE}menu_close_btn.svg" alt="Close"></button>
          </div>
          <div class="menu-col">
            <button class="menu-btn menu-btn--context" data-action="context"><img class="menu-btn__icon" src="${ASSETS_BASE}${this.getInsightsIconByTheme()}" alt="">${locale.menuInsights}</button>
            <button class="menu-btn menu-btn--reset" data-action="theme"><img class="menu-btn__icon" src="${ASSETS_BASE}${themeActionIcon}" alt="">${themeActionLabel}</button>
          </div>
        </div>`;
      const closeBtn = content.querySelector('.menu-close-btn');
      if (closeBtn) closeBtn.onclick = () => { try { this.resetLegacyMenuState(); this.resetRequestScreen(); this.resetContextScreen(); } catch {} this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this._menuLanguageDropdownOpen = false; this.updateMenuUI(); };
      content.querySelectorAll('[data-language-code]').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const nextCode = e.currentTarget.getAttribute('data-language-code');
          if (!nextCode || !languageFlags[nextCode]) return;
          this._menuLanguageDropdownOpen = false;
          this.setLanguage(nextCode);
        };
      });
      content.querySelectorAll('.menu-btn').forEach(btn => {
        btn.onclick = (e) => {
          const action = e.currentTarget.getAttribute('data-action');
          if (!action) return;
          if (action === 'language') {
            e.preventDefault();
            e.stopPropagation();
            this._menuLanguageDropdownOpen = !this._menuLanguageDropdownOpen;
            this.updateMenuUI();
            return;
          }
          if (action === 'theme') {
            e.preventDefault();
            e.stopPropagation();
            this._menuLanguageDropdownOpen = false;
            this.toggleTheme();
            this.updateMenuUI();
            return;
          }
          this._menuLanguageDropdownOpen = false;
          if (action === 'request') { this.showScreen('request'); this._selectedMenu = 'request'; this._menuState = 'selected'; }
          if (action === 'context') { this.showScreen('context'); this._selectedMenu = 'context'; this._menuState = 'selected'; }
          this.updateMenuUI();
        };
      });
      syncLanguageOutsideClick();
    } else if (this._menuState === 'selected') {
      const labelMap = { request: locale.menuSelectedRequest, context: locale.menuSelectedContext };
      const colorClass = this._selectedMenu === 'request' ? 'menu-badge--request' : 'menu-badge--context';
      content.innerHTML = `
        <div class="menu-grid menu-grid--selected">
          <div class="menu-col menu-col--single">
            <button class="menu-link" data-action="back">${locale.menuBackToDialog}</button>
          </div>
          <div class="menu-col menu-col--single menu-col--middle" style="justify-content:center;">
            <button class="menu-close-btn" aria-label="Close menu"><img src="${ASSETS_BASE}menu_close_btn.svg" alt="Close"></button>
          </div>
          <div class="menu-col menu-col--single">
            <div class="menu-badge ${colorClass}">${labelMap[this._selectedMenu] || ''}</div>
          </div>
        </div>`;
      const closeBtn = content.querySelector('.menu-close-btn');
      if (closeBtn) closeBtn.onclick = () => { try { this.resetLegacyMenuState(); this.resetRequestScreen(); this.resetContextScreen(); } catch {} this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
      const backBtn = content.querySelector('[data-action="back"]');
      if (backBtn) backBtn.onclick = () => { this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
      syncLanguageOutsideClick();
    } else {
      content.innerHTML = '';
      syncLanguageOutsideClick();
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

  const backendUrl = 'https://voice-widget-backend-tgdubai-split.up.railway.app/api/audio/upload';
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
