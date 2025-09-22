// ========================================
// 🚀 Voice Widget - Демо для консоли
// ========================================

// ⚠️ ВАЖНО: Замените URL на ваш домен!
const WIDGET_URL = 'https://georgio-us.github.io/Voice-Widget-Frontend';

// Функция загрузки виджета
async function loadVoiceWidget() {
  try {
    console.log('🚀 Загружаю Voice Widget...');
    
    // Проверяем, не загружен ли уже
    if (document.querySelector('voice-widget')) {
      console.warn('⚠️ Voice Widget уже загружен на странице');
      return;
    }

    // 1. Загружаем Marked.js
    if (!window.marked) {
      const markedScript = document.createElement('script');
      markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      document.head.appendChild(markedScript);
      await new Promise(resolve => markedScript.onload = resolve);
      console.log('✅ Marked.js загружен');
    }

    // 2. Загружаем CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = `${WIDGET_URL}/voice-widget.css`;
    document.head.appendChild(cssLink);
    await new Promise(resolve => cssLink.onload = resolve);
    console.log('✅ CSS загружен');

    // 3. Загружаем основной JS
    const mainScript = document.createElement('script');
    mainScript.type = 'module';
    mainScript.src = `${WIDGET_URL}/voice-widget.js`;
    document.head.appendChild(mainScript);
    await new Promise(resolve => mainScript.onload = resolve);
    console.log('✅ Основной JS загружен');

    // 4. Загружаем markdown renderer
    const markdownScript = document.createElement('script');
    markdownScript.type = 'module';
    markdownScript.src = `${WIDGET_URL}/markdown-render.js`;
    document.head.appendChild(markdownScript);
    await new Promise(resolve => markdownScript.onload = resolve);
    console.log('✅ Markdown renderer загружен');

    // 5. Создаем виджет
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      pointer-events: none;
    `;
    
    container.innerHTML = `
      <voice-widget
        api-url="https://voice-widget-backend-production.up.railway.app/api/audio/upload"
        field-name="audio"
        response-field="response">
      </voice-widget>
    `;
    
    document.body.appendChild(container);
    
    // 6. Ждем регистрации custom element
    await customElements.whenDefined('voice-widget');
    
    console.log('🎉 Voice Widget успешно загружен!');
    console.log('💡 Виджет появится в правом нижнем углу страницы');
    
    // Возвращаем ссылку на виджет для управления
    return {
      widget: container.querySelector('voice-widget'),
      container: container,
      remove: () => {
        container.remove();
        console.log('🗑️ Voice Widget удален');
      }
    };

  } catch (error) {
    console.error('❌ Ошибка загрузки Voice Widget:', error);
    console.log('💡 Убедитесь, что URL в коде указан правильно:', WIDGET_URL);
  }
}

// Функция удаления виджета
function removeVoiceWidget() {
  const containers = document.querySelectorAll('div[style*="position: fixed"]');
  containers.forEach(container => {
    if (container.querySelector('voice-widget')) {
      container.remove();
      console.log('🗑️ Voice Widget удален');
      return;
    }
  });
  console.log('⚠️ Voice Widget не найден на странице');
}

// Выводим инструкции в консоль
console.log(`
🎯 Voice Widget Demo готов к использованию!

📋 Команды:
• loadVoiceWidget() - загрузить виджет
• removeVoiceWidget() - удалить виджет

⚠️  ВАЖНО: Перед использованием замените URL в коде на ваш домен!
Текущий URL: ${WIDGET_URL}

🚀 Для загрузки выполните: loadVoiceWidget()
`);

// Экспортируем функции в глобальную область
window.loadVoiceWidget = loadVoiceWidget;
window.removeVoiceWidget = removeVoiceWidget;
