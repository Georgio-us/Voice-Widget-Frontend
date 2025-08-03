// ========================================
// 📁 modules/ui-manager.js (ФИНАЛЬНАЯ ВЕРСИЯ ДЛЯ ОДНОГО АДАПТИВНОГО ЭЛЕМЕНТА)
// ========================================
// Управление интерфейсом с единым переключаемым input элементом

export class UIManager {
    constructor(widget) {
        this.widget = widget;
        this.shadowRoot = widget.shadowRoot;
        
        // 🔥 STATE MACHINE для единого интерфейса
        this.inputState = 'idle'; // idle, typing, recording, recorded
        this.recordingTime = 0;
        this.recordingTimer = null;
        
        // Элементы единого интерфейса
        this.elements = {};
        
        // Привязываем события к состояниям
        this.bindToInternalEvents();
    }

    // 🔥 ИНИЦИАЛИЗАЦИЯ UI
    initializeUI() {
        // Кэшируем элементы
        this.cacheElements();
        
        // Инициализируем состояние
        this.setState('idle');
        
        // Скрываем скроллбар в пустом состоянии
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.style.overflowY = 'hidden';
        }
        
        // Добавляем флаг для отслеживания начала диалога
        this.widget.dialogStarted = false;
        
        // Обновляем понимание запроса
        if (this.widget.understanding) {
            this.widget.understanding.updateUnderstandingDisplay();
        }
    }

    // ✅ ОБНОВЛЕНО: КЭШИРОВАНИЕ ЭЛЕМЕНТОВ ДЛЯ НОВОЙ СТРУКТУРЫ
    cacheElements() {
        this.elements = {
            // ✅ НОВЫЙ: Единый адаптивный элемент
            adaptiveInputField: this.shadowRoot.getElementById('adaptiveInputField'),
            
            // ✅ ОБНОВЛЕНО: textInput теперь внутри adaptiveInputField
            textInput: this.shadowRoot.getElementById('textInput'),
            
            // Основные контейнеры
            unifiedContainer: this.shadowRoot.getElementById('unifiedInputContainer'),
            
            // Кнопки
            micButton: this.shadowRoot.getElementById('micButton'),
            cancelButton: this.shadowRoot.getElementById('cancelButton'),
            sendButton: this.shadowRoot.getElementById('sendButton'),
            
            // Старые элементы (для совместимости)
            mainButton: this.shadowRoot.getElementById('mainButton'),
            messagesContainer: this.shadowRoot.getElementById('messagesContainer'),
            emptyState: this.shadowRoot.getElementById('emptyState')
        };
    }

    // 🔥 ПРИВЯЗКА К ВНУТРЕННИМ СОБЫТИЯМ
    bindToInternalEvents() {
        // Слушаем события от других модулей
        this.widget.events.on('recordingStarted', () => {
            this.setState('recording');
        });

        this.widget.events.on('recordingStopped', () => {
            this.setState('idle');
        });

        this.widget.events.on('recordingCancelled', () => {
            this.setState('idle');
        });

        this.widget.events.on('timerUpdated', (time) => {
            this.updateRecordingTimer(time);
        });

        this.widget.events.on('showNotification', (message) => {
            this.showNotification(message);
        });

        // ✅ ДОБАВЛЕНО: Слушаем события отправки текста
        this.widget.events.on('textMessageSent', () => {
            // После успешной отправки очищаем поле и возвращаемся в idle
            const { textInput } = this.elements;
            if (textInput) {
                textInput.value = '';
            }
            this.setState('idle');
        });
    }

    // 🔥 STATE MACHINE - ГЛАВНЫЙ МЕТОД
    setState(newState, data = {}) {
        console.log(`🎯 UI State: ${this.inputState} → ${newState}`);
        
        const oldState = this.inputState;
        this.inputState = newState;
        
        // Выполняем переход
        this.executeStateTransition(oldState, newState, data);
        
        // Уведомляем другие модули
        this.widget.events.emit('uiStateChanged', { 
            from: oldState, 
            to: newState, 
            data 
        });
    }

    // 🔥 ВЫПОЛНЕНИЕ ПЕРЕХОДА СОСТОЯНИЙ
    executeStateTransition(from, to, data) {
        // Сначала очищаем старое состояние
        this.clearState(from);
        
        // Затем применяем новое состояние
        this.applyState(to, data);
    }

    // ✅ ОБНОВЛЕНА: ОЧИСТКА СОСТОЯНИЯ
    clearState(state) {
        const { adaptiveInputField, micButton, cancelButton, sendButton, unifiedContainer } = this.elements;
        
        switch (state) {
            case 'idle':
                // Ничего особенного не делаем
                break;
                
            case 'typing':
                // Убираем активность кнопки отправки если нет текста
                const textInput = adaptiveInputField?.querySelector('input');
                if (!textInput?.value?.trim()) {
                    sendButton?.classList.remove('active');
                }
                break;
                
            case 'recording':
                // ✅ ОБНОВЛЕНО: Показываем кнопку микрофона обратно
                if (micButton) {
                    micButton.classList.remove('recording', 'hidden');
                }
                
                // ✅ ДОБАВЛЕНО: Убираем оранжевую рамку
                if (unifiedContainer) {
                    unifiedContainer.classList.remove('recording-active');
                }
                
                // Очищаем таймер
                if (this.recordingTimer) {
                    clearInterval(this.recordingTimer);
                    this.recordingTimer = null;
                }
                break;
                
            case 'recorded':
                // Очищаем состояние записи
                this.clearRecordingState();
                break;
        }
    }

    // 🔥 ПРИМЕНЕНИЕ СОСТОЯНИЯ
    applyState(state, data) {
        switch (state) {
            case 'idle':
                this.applyIdleState();
                break;
                
            case 'typing':
                this.applyTypingState();
                break;
                
            case 'recording':
                this.applyRecordingState();
                break;
                
            case 'recorded':
                this.applyRecordedState(data);
                break;
        }
    }

    // ✅ ПОЛНОСТЬЮ ПЕРЕПИСАНО: СОСТОЯНИЕ IDLE
    applyIdleState() {
        const { adaptiveInputField, micButton, cancelButton, sendButton } = this.elements;
        
        // ✅ ПЕРЕКЛЮЧАЕМ НА ТЕКСТОВЫЙ РЕЖИМ
        if (adaptiveInputField) {
            adaptiveInputField.className = 'adaptive-input-field text-mode';
            
            // Создаем текстовое поле если его нет
            let textInput = adaptiveInputField.querySelector('input');
            if (!textInput) {
                adaptiveInputField.innerHTML = '<input type="text" id="textInput" placeholder="Введите ваш вопрос...">';
                textInput = adaptiveInputField.querySelector('input');
                
                // Переподключаем события для нового input
                this.bindTextInputEvents(textInput);
            }
            
            // Настраиваем текстовое поле
            if (textInput) {
                textInput.placeholder = 'Введите ваш вопрос...';
                textInput.disabled = false;
                textInput.style.opacity = '1';
            }
        }
        
        // ✅ ОБНОВЛЕНО: Кнопка микрофона зависит от состояния диалога
        if (micButton) {
            micButton.style.display = 'flex';
            micButton.classList.remove('recording', 'hidden');
            
            // ✅ ДОБАВЛЕНО: Активность зависит от начала диалога
            if (this.widget.dialogStarted) {
                micButton.disabled = false;
                micButton.classList.add('active');
            } else {
                micButton.disabled = true;
                micButton.classList.remove('active');
            }
        }
        
        // Скрываем кнопку отмены
        if (cancelButton) {
            cancelButton.classList.remove('active');
        }
        
        // Настройка кнопки отправки
        if (sendButton) {
            const textInput = adaptiveInputField?.querySelector('input');
            const hasText = textInput?.value?.trim();
            sendButton.classList.toggle('active', Boolean(hasText));
            sendButton.disabled = !hasText;
        }
    }

    // ✅ ОБНОВЛЕНО: СОСТОЯНИЕ TYPING
    applyTypingState() {
        const { adaptiveInputField, sendButton, micButton } = this.elements;
        
        // Активируем кнопку отправки если есть текст
        const textInput = adaptiveInputField?.querySelector('input');
        const hasText = textInput?.value?.trim();
        if (sendButton) {
            sendButton.classList.toggle('active', Boolean(hasText));
            sendButton.disabled = !hasText;
        }

        // ✅ ОБНОВЛЕНО: Убеждаемся что кнопка микрофона в правильном состоянии
        if (micButton) {
            micButton.classList.remove('hidden');
            
            // ✅ ДОБАВЛЕНО: Активность зависит от состояния диалога
            if (this.widget.dialogStarted) {
                micButton.classList.add('active');
                micButton.disabled = false;
            } else {
                micButton.classList.remove('active');
                micButton.disabled = true;
            }
        }
    }

    // ✅ ПОЛНОСТЬЮ ПЕРЕПИСАНО: СОСТОЯНИЕ RECORDING
    applyRecordingState() {
        const { adaptiveInputField, micButton, cancelButton, sendButton, unifiedContainer } = this.elements;
        
        // ✅ ПЕРЕКЛЮЧАЕМ НА РЕЖИМ ЗАПИСИ
        if (adaptiveInputField) {
            adaptiveInputField.className = 'adaptive-input-field recording-mode';
            
            // Заменяем содержимое на индикатор записи
            adaptiveInputField.innerHTML = `
                <div class="recording-timer" id="recordingTimer">0:00</div>
                <div class="recording-waves">
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                </div>
                <div class="recording-text">Идет запись...</div>
            `;
        }
        
        // ✅ ДОБАВЛЕНО: Оранжевая рамка контейнера
        if (unifiedContainer) {
            unifiedContainer.classList.add('recording-active');
        }
        
        // ✅ ГЛАВНОЕ: СКРЫВАЕМ кнопку микрофона во время записи
        if (micButton) {
            micButton.classList.add('hidden');
        }
        
        // Показываем кнопку отмены
        if (cancelButton) {
            cancelButton.classList.add('active');
        }
        
        // Активируем кнопку отправки
        if (sendButton) {
            sendButton.classList.add('active');
            sendButton.disabled = false;
        }
        
        // Сбрасываем и запускаем таймер
        this.recordingTime = 0;
        this.startRecordingTimer();
        
        console.log('🎙️ Recording state applied - field switched to recording mode');
    }

    // ✅ ОБНОВЛЕНО: СОСТОЯНИЕ RECORDED
    applyRecordedState(data) {
        // Возвращаемся к idle состоянию
        this.applyIdleState();
        
        // Можно добавить специальную логику для recorded состояния
        console.log('📼 Recording finished, switched back to text mode');
    }

    // ✅ ОБНОВЛЕНО: ОБРАБОТЧИКИ СОБЫТИЙ ВВОДА
    handleTextInput() {
        const { adaptiveInputField } = this.elements;
        const textInput = adaptiveInputField?.querySelector('input');
        const hasText = textInput?.value?.trim();
        
        if (hasText && this.inputState === 'idle') {
            this.setState('typing');
        } else if (!hasText && this.inputState === 'typing') {
            this.setState('idle');
        } else if (this.inputState === 'typing') {
            // Просто обновляем состояние кнопки
            this.applyTypingState();
        }
    }

    handleTextKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !this.isMobile()) {
            e.preventDefault();
            const { adaptiveInputField } = this.elements;
            const textInput = adaptiveInputField?.querySelector('input');
            if (this.inputState === 'typing' && textInput?.value?.trim()) {
                this.handleSendText();
            }
        }
    }

    // 🔥 ОБРАБОТЧИКИ КНОПОК
    handleMicClick() {
        console.log('🎤 Mic button clicked, current state:', this.inputState);
        
        if (this.inputState === 'idle' || this.inputState === 'typing') {
            // Начинаем запись
            this.widget.audioRecorder.startRecording();
        }
    }

    handleCancelClick() {
        console.log('❌ Cancel button clicked, current state:', this.inputState);
        
        if (this.inputState === 'recording') {
            // Отменяем запись
            this.widget.audioRecorder.cancelRecording();
        }
    }

    handleSendClick() {
        console.log('➤ Send button clicked, current state:', this.inputState);
        
        if (this.inputState === 'typing') {
            this.handleSendText();
        } else if (this.inputState === 'recording') {
            this.widget.audioRecorder.finishAndSend();
        } else if (this.inputState === 'recorded') {
            // Отправляем записанное аудио
            this.widget.api.sendMessage();
        }
    }

    // ✅ ОБНОВЛЕНО: ОТПРАВКА ТЕКСТА
    handleSendText() {
        const { adaptiveInputField } = this.elements;
        const textInput = adaptiveInputField?.querySelector('input');
        const text = textInput?.value?.trim();
        
        if (text) {
            // ✅ НЕ ОЧИЩАЕМ ПОЛЕ ЗДЕСЬ - это сделает API после успешной отправки
            // Отправляем через API модуль
            this.widget.api.sendTextMessage();
        }
    }

    // ✅ ОБНОВЛЕНО: ТАЙМЕР ЗАПИСИ
    startRecordingTimer() {
        this.recordingTime = 0;
        this.recordingTimer = setInterval(() => {
            this.recordingTime++;
            this.updateRecordingTimer(this.recordingTime);
        }, 1000);
    }

    updateRecordingTimer(time) {
        const { adaptiveInputField } = this.elements;
        const recordingTimer = adaptiveInputField?.querySelector('#recordingTimer');
        if (recordingTimer) {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            recordingTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    clearRecordingState() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        this.recordingTime = 0;
    }

    // ✅ НОВЫЙ: ПРИВЯЗКА СОБЫТИЙ К ТЕКСТОВОМУ ПОЛЮ
    bindTextInputEvents(textInput) {
        if (textInput) {
            textInput.addEventListener('input', () => this.handleTextInput());
            textInput.addEventListener('keydown', (e) => this.handleTextKeyDown(e));
        }
    }

    // ✅ ОБНОВЛЕНО: ПРИВЯЗКА СОБЫТИЙ К НОВЫМ ЭЛЕМЕНТАМ
    bindUnifiedInputEvents() {
        const { micButton, cancelButton, sendButton, mainButton, adaptiveInputField } = this.elements;
        
        // Обработчики текстового поля (для начального состояния)
        const initialTextInput = adaptiveInputField?.querySelector('input');
        this.bindTextInputEvents(initialTextInput);
        
        // Обработчики кнопок
        micButton?.addEventListener('click', () => this.handleMicClick());
        cancelButton?.addEventListener('click', () => this.handleCancelClick());
        sendButton?.addEventListener('click', () => this.handleSendClick());
        
        // Старая главная кнопка (для совместимости)
        mainButton?.addEventListener('click', () => {
            if (!this.widget.audioRecorder?.isRecording && !mainButton.disabled) {
                this.handleMicClick();
            }
        });
        
        console.log('🔗 Unified input events bound successfully');
    }

    // ✅ ОБНОВЛЕНО: АКТИВАЦИЯ КНОПОК ПОСЛЕ НАЧАЛА ДИАЛОГА
    activateDialogButtons() {
        const { micButton } = this.elements;
        
        if (micButton) {
            micButton.disabled = false;
            micButton.classList.add('active'); // ✅ ДОБАВЛЕНО: активируем визуально
            
            console.log('✅ Dialog buttons activated - маленькая кнопка микрофона активна');
            this.widget.dialogStarted = true;
        }
    }

    // 🔥 СООБЩЕНИЯ (обновленные методы)
    addMessage(message) {
        this.widget.messages.push(message);
        const messagesContainer = this.elements.messagesContainer;
        const emptyState = this.elements.emptyState;
        
        // Скрываем пустое состояние при первом сообщении
        if (this.widget.messages.length === 1) {
            if (emptyState) {
                emptyState.style.display = 'none';
                messagesContainer.style.overflowY = 'auto';
            }
            this.activateDialogButtons();
        }

        const messageElement = this.createMessageElement(message);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.updateMessageCount();
    }

    createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble';

        if (message.type === 'assistant') {
            bubbleElement.classList.add('chat-response');
            bubbleElement.innerHTML = marked.parse(message.content);
        } else {
            bubbleElement.textContent = message.content;
        }

        messageElement.appendChild(bubbleElement);
        return messageElement;
    }

    // 🔥 УТИЛИТАРНЫЕ МЕТОДЫ
    updateMessageCount() {
        const messageCountElement = this.shadowRoot.getElementById('messageCount');
        if (messageCountElement) {
            messageCountElement.textContent = this.widget.messages.length;
        }
    }

    showLoading() {
        const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('active');
        }
    }

    hideLoading() {
        const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('active');
        }
    }

    showNotification(message) {
        console.log('📢', message);
        // Здесь можно добавить toast notifications
    }

    showWarning(message) {
        console.log('⚠️', message);
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
               || 'ontouchstart' in window;
    }

    // 🔥 ФУНКЦИОНАЛЬНЫЕ КНОПКИ (остаются без изменений)
    bindFunctionButtons() {
        const imageBtn = this.shadowRoot.getElementById('imageBtn');
        const documentBtn = this.shadowRoot.getElementById('documentBtn');
        const pdfBtn = this.shadowRoot.getElementById('pdfBtn');

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

    // 🔥 АККОРДЕОН (остается без изменений)
    bindAccordionEvents() {
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

        if (accordionBlock.classList.contains('open')) {
            accordionBlock.classList.remove('open');
            console.log('📁 Закрыл "Детали и предпочтения"');
        } else {
            accordionBlock.classList.add('open');
            console.log('📂 Открыл "Детали и предпочтения"');
        }
    }

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

    // ✅ ОБНОВЛЕНО: ОЧИСТКА
    clearMessages() {
        this.widget.messages = [];
        const messagesContainer = this.elements.messagesContainer;
        const emptyState = this.elements.emptyState;
        
        if (messagesContainer && emptyState) {
            messagesContainer.innerHTML = '';
            const newEmptyState = emptyState.cloneNode(true);
            messagesContainer.appendChild(newEmptyState);
            newEmptyState.style.display = 'block';
            messagesContainer.style.overflowY = 'hidden';
        }
        
        // Сбрасываем состояние диалога
        this.widget.dialogStarted = false;
        this.setState('idle');
        
        this.updateMessageCount();
        
        // Переподключаем события для новой главной кнопки
        const newMainButton = this.shadowRoot.getElementById('mainButton');
        if (newMainButton) {
            newMainButton.addEventListener('click', () => {
                if (!this.widget.audioRecorder?.isRecording && !newMainButton.disabled) {
                    this.handleMicClick();
                }
            });
        }
    }

    // 🔥 ГЕТТЕРЫ СОСТОЯНИЯ
    getCurrentState() {
        return this.inputState;
    }

    isRecording() {
        return this.inputState === 'recording';
    }

    isTyping() {
        return this.inputState === 'typing';
    }

    isIdle() {
        return this.inputState === 'idle';
    }
}