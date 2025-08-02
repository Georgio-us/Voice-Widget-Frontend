// ========================================
// 📁 modules/event-manager.js
// ========================================
// Система событий для коммуникации между модулями

export class EventManager {
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