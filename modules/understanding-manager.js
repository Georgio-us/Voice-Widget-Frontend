// ========================================
// 📁 modules/understanding-manager.js
// ========================================
// Управление пониманием запроса и анализом insights

export class UnderstandingManager {
    constructor(widget) {
        this.widget = widget;
        
        // 🆕 Расширенная структура понимания запроса (9 параметров)
        this.understanding = {
            // Блок 1: Основная информация (33.3%)
            name: null,           // 10%
            operation: null,      // 12%  
            budget: null,         // 11%
            
            // Блок 2: Параметры недвижимости (33.3%)
            type: null,           // 11%
            location: null,       // 11%
            rooms: null,          // 11%
            
            // Блок 3: Детали и предпочтения (33.3%)
            area: null,           // 11%
            details: null,        // 11% (детали локации: возле парка, пересечение улиц)
            preferences: null,    // 11%
            
            progress: 0
        };
    }

    // Обновление понимания запроса
    update(insights) {
        if (!insights) return;
        
        console.log('🧠 Обновляю понимание:', insights);
        
        // Обновляем локальное состояние
        this.understanding = { ...this.understanding, ...insights };
        
        // Пересчитываем прогресс
        const progress = this.calculateProgress();
        this.understanding.progress = progress;
        
        // Обновляем UI
        this.updateUnderstandingDisplay();
        
        // Уведомляем другие модули
        this.widget.events.emit('understandingUpdated', this.understanding);
    }

    // 🆕 Гибкая система расчета прогресса
    calculateProgress() {
        const weights = {
            // Блок 1: Основная информация (33.3%)
            name: 10,
            operation: 12,
            budget: 11,
            
            // Блок 2: Параметры недвижимости (33.3%)
            type: 11,
            location: 11,
            rooms: 11,
            
            // Блок 3: Детали и предпочтения (33.3%)
            area: 11,
            details: 11,    // детали локации: возле парка, пересечение улиц
            preferences: 11
        };
        
        let totalProgress = 0;
        
        for (const [field, weight] of Object.entries(weights)) {
            if (this.understanding[field] && this.understanding[field].trim()) {
                totalProgress += weight;
            }
        }
        
        return Math.min(totalProgress, 99); // максимум 99%, чтобы было место для округления
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

    // Обновление отдельного поля insights
    updateInsightItem(field, value) {
        const indicator = this.widget.shadowRoot.getElementById(`${field}Indicator`);
        const valueElement = this.widget.shadowRoot.getElementById(`${field}Value`);
        
        if (!indicator || !valueElement) {
            console.warn(`🔍 Элементы для поля ${field} не найдены`);
            return;
        }
        
        if (value && value.trim()) {
            indicator.classList.add('filled');
            valueElement.textContent = value;
        } else {
            indicator.classList.remove('filled');
            valueElement.textContent = this.getDefaultText(field);
        }
    }

    // Получение текста по умолчанию для поля
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

    // Получение текста стадии по проценту
    getStageText(progress) {
        if (progress === 0) return 'Ожидание';
        if (progress <= 20) return 'Знакомство';
        if (progress <= 40) return 'Основные параметры';
        if (progress <= 60) return 'Готов к первичному подбору';
        if (progress <= 80) return 'Уточнение деталей';
        return 'Готов к точному подбору';
    }

    // 🔄 Миграция старого формата insights в новый
    migrateInsights(oldInsights) {
        return {
            // Основная информация
            name: oldInsights.name || null,
            operation: oldInsights.operation || null,
            budget: oldInsights.budget || null,
            
            // Параметры недвижимости  
            type: oldInsights.type || null,
            location: oldInsights.location || null,
            rooms: null,    // новое поле
            
            // Детали и предпочтения
            area: null,         // новое поле
            details: null,      // новое поле (детали локации)
            preferences: null,  // новое поле
            
            progress: oldInsights.progress || 0
        };
    }

    // Сброс понимания запроса
    reset() {
        for (const key in this.understanding) {
            if (key !== 'progress') {
                this.understanding[key] = null;
            }
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