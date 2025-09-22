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
      name: null,        // 10%
      operation: null,   // 12%
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

    // Обновляем локальное состояние
    this.understanding = { ...this.understanding, ...insights };

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
      name: 10,
      operation: 12,
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
    const defaults = {
      name: 'не определено',
      operation: 'не определена',
      budget: 'не определен',
      type: 'не определен',
      location: 'не определен',
      details: 'не определены',
      rooms: 'не определено',
      area: 'не определена',
      preferences: 'не определены'
    };
    return defaults[field] || 'не определено';
  }

  // Текст стадии по проценту
  getStageText(progress) {
    if (progress === 0) return 'Ожидание';
    if (progress <= 20) return 'Знакомство';
    if (progress <= 40) return 'Основные параметры';
    if (progress <= 60) return 'Готов к первичному подбору';
    if (progress <= 80) return 'Уточнение деталей';
    return 'Готов к точному подбору';
  }

  // Миграция старого формата insights в новый
  migrateInsights(oldInsights = {}) {
    return {
      // Основная информация
      name: oldInsights.name ?? null,
      operation: oldInsights.operation ?? null,
      budget: oldInsights.budget ?? null,

      // Параметры недвижимости
      type: oldInsights.type ?? null,
      location: oldInsights.location ?? null,
      rooms: oldInsights.rooms ?? null,

      // Детали и предпочтения
      area: oldInsights.area ?? null,
      details: oldInsights.details ?? null,
      preferences: oldInsights.preferences ?? null,

      progress: oldInsights.progress ?? 0
    };
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
