// ========================================
// 📁 modules/understanding-manager.js
// ========================================
// Управление пониманием запроса и анализом insights

export class UnderstandingManager {
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
    const progressFill = this.widget.shadowRoot.getElementById('progressFill');
    const progressText = this.widget.shadowRoot.getElementById('progressText');

    const progress = this.understanding.progress;

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    if (progressText) {
      progressText.textContent = `${progress}% - ${this.getStageText(progress)}`;
    }

    // v2 Context screen sync: update circular progress and text if present
    try {
      const ctx = this.widget.shadowRoot.getElementById('contextScreen');
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
    const indicator = this.widget.shadowRoot.getElementById(`${field}Indicator`); // может отсутствовать
    const valueElement = this.widget.shadowRoot.getElementById(`${field}Value`);

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
