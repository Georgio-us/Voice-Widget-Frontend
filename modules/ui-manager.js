// ========================================
// 📁 modules/ui-manager.js
// ========================================
// Управление интерфейсом и всеми UI элементами

export class UIManager {
    constructor(widget) {
        this.widget = widget;
        this.shadowRoot = widget.shadowRoot;
    }

    initializeUI() {
        const recordingControls = this.shadowRoot.getElementById('recordingControls');
        recordingControls.style.display = 'none';
        
        // Скрываем скроллбар в пустом состоянии
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        messagesContainer.style.overflowY = 'hidden';
        
        // 🆕 Инициализация состояний кнопок для UX логики
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        const sendTextButton = this.shadowRoot.getElementById('sendTextButton');
        
        // Voice button неактивна до начала диалога (акцент на центральной кнопке)
        voiceButton.disabled = true;
        voiceButton.style.opacity = '0.5';
        voiceButton.style.cursor = 'not-allowed';
        
        // Send text button всегда видима, но неактивна до ввода текста
        sendTextButton.style.display = 'flex';
        sendTextButton.disabled = true;
        sendTextButton.style.opacity = '0.5';
        sendTextButton.style.cursor = 'not-allowed';
        
        // Добавляем флаг для отслеживания начала диалога
        this.widget.dialogStarted = false;
        
        this.widget.understanding.updateUnderstandingDisplay();
    }

    // 🆕 МЕТОД АКТИВАЦИИ КНОПОК ПОСЛЕ НАЧАЛА ДИАЛОГА
    activateDialogButtons() {
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        
        if (voiceButton && voiceButton.disabled) {
            voiceButton.disabled = false;
            voiceButton.style.opacity = '1';
            voiceButton.style.cursor = 'pointer';
            
            console.log('✅ Voice button активирована - диалог начат');
            this.widget.dialogStarted = true;
        }
    }

    updateTimer(recordingTime) {
        const timer = this.shadowRoot.getElementById('timer');
        const minutes = Math.floor(recordingTime / 60);
        const seconds = recordingTime % 60;
        timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateMessageCount() {
        const messageCountElement = this.shadowRoot.getElementById('messageCount');
        messageCountElement.textContent = this.widget.messages.length;
    }

    showLoading() {
        const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
        loadingIndicator.classList.add('active');
    }

    hideLoading() {
        const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
        loadingIndicator.classList.remove('active');
    }

    showNotification(message) {
        console.log('📢', message);
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД addMessage с активацией кнопок
    addMessage(message) {
        this.widget.messages.push(message);
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        const emptyState = this.shadowRoot.getElementById('emptyState');
        
        // 🆕 Скрываем пустое состояние и активируем кнопки
        if (this.widget.messages.length === 1) {
            if (emptyState) {
                emptyState.style.display = 'none';
                messagesContainer.style.overflowY = 'auto';
            }
            this.activateDialogButtons();
        }

        // Создаём обёртку сообщения
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        
        // Создаём "пузырь"
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble';

        // 💬 Рендерим ассистента через Markdown
        if (message.type === 'assistant') {
            bubbleElement.classList.add('chat-response');
            bubbleElement.innerHTML = marked.parse(message.content);
        } else {
            bubbleElement.textContent = message.content;
        }

        messageElement.appendChild(bubbleElement);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    typeWriter(element, text, speed = 30) {
        let i = 0;
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        element.appendChild(cursor);
        
        const typeInterval = setInterval(() => {
            if (i < text.length) {
                element.insertBefore(document.createTextNode(text.charAt(i)), cursor);
                i++;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                cursor.remove();
                clearInterval(typeInterval);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, speed);
    }

    showWarning(message) {
        console.log('⚠️', message);
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
               || 'ontouchstart' in window;
    }

    bindFunctionButtons() {
        // Desktop функции (перенесены к input area)
        const imageBtn = this.shadowRoot.getElementById('imageBtn');
        const documentBtn = this.shadowRoot.getElementById('documentBtn');
        const pdfBtn = this.shadowRoot.getElementById('pdfBtn');

        // Mobile функции
        const mobileImgBtn = this.shadowRoot.getElementById('mobileImgBtn');
        const mobileDocBtn = this.shadowRoot.getElementById('mobileDocBtn');
        const mobilePdfBtn = this.shadowRoot.getElementById('mobilePdfBtn');

        [imageBtn, mobileImgBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    console.log('🖼️ Функция добавления изображений в разработке');
                    this.showNotification('🖼️ Функция в разработке');
                });
            }
        });

        [documentBtn, mobileDocBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    console.log('📄 Функция добавления документов в разработке');
                    this.showNotification('📄 Функция в разработке');
                });
            }
        });

        [pdfBtn, mobilePdfBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    console.log('📊 Функция скачивания PDF в разработке');
                    this.showNotification('📊 Функция в разработке');
                });
            }
        });
    }

    // 🔥 ОПТИМИЗИРОВАННЫЕ ACCORDION МЕТОДЫ (только для "Детали и предпочтения")
    bindAccordionEvents() {
        // Находим только аккордеон для "Детали и предпочтения"
        const detailsAccordionHeader = this.shadowRoot.querySelector('[data-accordion="details-preferences"]');
        
        if (detailsAccordionHeader) {
            detailsAccordionHeader.addEventListener('click', () => {
                this.toggleDetailsAccordion();
            });
            console.log('📂 Инициализирован аккордеон для "Детали и предпочтения"');
        }
    }

    toggleDetailsAccordion() {
        const accordionBlock = this.shadowRoot.querySelector('[data-accordion="details-preferences"]')?.closest('.accordion-block');
        
        if (!accordionBlock) {
            console.warn('🔍 Блок "Детали и предпочтения" не найден');
            return;
        }

        // Переключаем класс open
        if (accordionBlock.classList.contains('open')) {
            accordionBlock.classList.remove('open');
            console.log('📁 Закрыл "Детали и предпочтения"');
        } else {
            accordionBlock.classList.add('open');
            console.log('📂 Открыл "Детали и предпочтения"');
        }
    }

    // 🔥 УПРОЩЕННЫЕ ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ АККОРДЕОНОМ
    openDetailsAccordion() {
        const accordionBlock = this.shadowRoot.querySelector('[data-accordion="details-preferences"]')?.closest('.accordion-block');
        if (accordionBlock) {
            accordionBlock.classList.add('open');
            console.log('📂 Принудительно открыл "Детали и предпочтения"');
        }
    }

    closeDetailsAccordion() {
        const accordionBlock = this.shadowRoot.querySelector('[data-accordion="details-preferences"]')?.closest('.accordion-block');
        if (accordionBlock) {
            accordionBlock.classList.remove('open');
            console.log('📁 Принудительно закрыл "Детали и предпочтения"');
        }
    }

    clearMessages() {
        this.widget.messages = [];
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        const emptyState = this.shadowRoot.getElementById('emptyState');
        
        messagesContainer.innerHTML = '';
        const newEmptyState = emptyState.cloneNode(true);
        messagesContainer.appendChild(newEmptyState);
        newEmptyState.style.display = 'block';
        
        messagesContainer.style.overflowY = 'hidden';
        
        // 🆕 Сбрасываем состояние диалога при очистке сообщений
        this.widget.dialogStarted = false;
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        const sendTextButton = this.shadowRoot.getElementById('sendTextButton');
        
        if (voiceButton) {
            voiceButton.disabled = true;
            voiceButton.style.opacity = '0.5';
            voiceButton.style.cursor = 'not-allowed';
        }
        
        if (sendTextButton) {
            sendTextButton.disabled = true;
            sendTextButton.style.opacity = '0.5';
            sendTextButton.style.cursor = 'not-allowed';
        }
        
        this.updateMessageCount();
        
        const newMainButton = this.shadowRoot.getElementById('mainButton');
        newMainButton.addEventListener('click', () => {
            if (!this.widget.isRecording && !newMainButton.disabled) {
                this.widget.startRecording();
           }
       });
    }
}