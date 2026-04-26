// ========================================
// 📁 modules/understanding-manager.js
// ========================================

export class UnderstandingManager {
  constructor(widget) {
    this.widget = widget;
    this.understanding = {
      name: null,
      operation: null,
      budget: null,
      type: null,
      location: null,
      rooms: null,
      area: null,
      details: null,
      preferences: null
    };
  }

  t(key) {
    if (this.widget && typeof this.widget.t === 'function') {
      return this.widget.t(key);
    }
    return '';
  }

  isFilled(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    return true;
  }

  update(insights) {
    if (!insights) return;
    const migrated = this.migrateInsights(insights);
    this.understanding = { ...this.understanding, ...migrated };
    this.updateUnderstandingDisplay();
    this.widget.events.emit('understandingUpdated', this.understanding);
  }

  updateUnderstandingDisplay() {
    // Keep progress UI disabled in current deterministic flow.
    const progressFill = this.widget.shadowRoot.getElementById('progressFill');
    const progressText = this.widget.shadowRoot.getElementById('progressText');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '';

    try {
      const ctx = this.widget.shadowRoot.getElementById('contextScreen');
      if (ctx) {
        const ctxText = ctx.querySelector('.progress-text');
        if (ctxText) ctxText.textContent = '';
      }
    } catch {}

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

  updateInsightItem(field, value) {
    const indicator = this.widget.shadowRoot.getElementById(`${field}Indicator`);
    const valueElement = this.widget.shadowRoot.getElementById(`${field}Value`);
    if (!indicator && !valueElement) return;

    const filled = this.isFilled(value);
    if (valueElement) {
      valueElement.textContent = filled ? String(value) : this.getDefaultText(field);
    }
    if (indicator) {
      indicator.classList.toggle('filled', filled);
    }
  }

  getDefaultText() {
    return this.t('insightDefault') || 'not specified';
  }

  migrateInsights(oldInsights = {}) {
    const src = oldInsights?.params ? oldInsights.params : oldInsights;
    const pick = (...keys) => {
      for (const k of keys) {
        if (src && src[k] !== undefined && src[k] !== null && String(src[k]).length) return src[k];
      }
      return null;
    };
    return {
      name: pick('name'),
      operation: pick('operation', 'operationType'),
      budget: pick('budget'),
      type: pick('type', 'propertyType'),
      location: pick('location', 'district'),
      rooms: pick('rooms'),
      area: pick('area'),
      details: pick('details', 'locationDetails'),
      preferences: pick('preferences', 'additional')
    };
  }

  reset() {
    for (const key in this.understanding) this.understanding[key] = null;
    this.updateUnderstandingDisplay();
  }

  export() {
    return { ...this.understanding };
  }

  import(insights) {
    this.understanding = { ...this.understanding, ...insights };
    delete this.understanding.progress;
    this.updateUnderstandingDisplay();
  }
}
