// modules/telemetryClient.js
/**
 * Клиент для отправки телеметрии на бэкенд
 * Отправляет события только если пользователь дал согласие на analytics
 */

// Типы событий (синхронизированы с бэкендом)
export const EventTypes = {
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
export function initTelemetry({ baseUrl, sessionId, userId = null }) {
  config.baseUrl = baseUrl;
  config.sessionId = sessionId;
  config.userId = userId;
}

/**
 * Установка согласия на аналитику
 * @param {Object} consent - { analytics: boolean }
 */
export function setConsent({ analytics }) {
  config.analytics = analytics === true;
}

/**
 * Получить текущее состояние согласия
 * @returns {boolean}
 */
export function getConsent() {
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
export async function log(eventType, payload = {}) {
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
