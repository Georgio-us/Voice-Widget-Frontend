// ========================================
// 📁 modules/api-client.js
// ========================================
// Работа с сервером и API запросами

export class APIClient {
    constructor(widget) {
        this.widget = widget;
        this.apiUrl = widget.apiUrl;
        this.fieldName = widget.fieldName;
        this.responseField = widget.responseField;
    }

    // 🆕 Загрузка информации о сессии с сервера
    async loadSessionInfo() {
        try {
            const sessionUrl = this.apiUrl.replace('/upload', `/session/${this.widget.sessionId}`);
            const response = await fetch(sessionUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.insights) {
                    // Преобразуем старый формат в новый, если необходимо
                    const migratedInsights = this.widget.understanding.migrateInsights(data.insights);
                    this.widget.understanding.update(migratedInsights);
                    console.log('📥 Загружены данные сессии:', data);
                }
            }
        } catch (error) {
            console.log('ℹ️ Новая сессия или CORS ошибка, используем локальные данные');
        }
    }

    async sendTextMessage() {
        const textInput = this.widget.shadowRoot.getElementById('textInput');
        const sendTextButton = this.widget.shadowRoot.getElementById('sendTextButton');
        const messageText = textInput.value.trim();
        
        if (!messageText) return;

        textInput.value = '';
        // 🔥 ОБНОВЛЕНО: Вместо скрытия - делаем disabled
        sendTextButton.disabled = true;
        sendTextButton.style.opacity = '0.5';
        sendTextButton.style.cursor = 'not-allowed';

        this.widget.ui.showLoading();

        const userMessage = {
            type: 'user',
            content: messageText,
            timestamp: new Date()
        };
        
        this.widget.ui.addMessage(userMessage);

        try {
            const formData = new FormData();
            formData.append('text', messageText);
            formData.append('sessionId', this.widget.sessionId);

            console.log('📤 Отправляем текст с sessionId:', this.widget.sessionId);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('📥 Ответ от сервера на текст:', {
                sessionId: data.sessionId,
                messageCount: data.messageCount,
                insights: data.insights,
                tokens: data.tokens,
                timing: data.timing
            });
            
            this.widget.ui.hideLoading();
            this.widget.ui.updateMessageCount();

            // 🆕 Обновляем insights из ответа сервера
            if (data.insights) {
                this.widget.understanding.update(data.insights);
            }

            const assistantMessage = {
                type: 'assistant',
                content: data[this.responseField] || 'Ответ не получен от сервера.',
                timestamp: new Date()
            };
            this.widget.ui.addMessage(assistantMessage);

        } catch (error) {
            this.widget.ui.hideLoading();
            console.error('Ошибка при отправке текста:', error);
            
            const assistantMessage = {
                type: 'assistant',
                content: error.message.includes('CORS') || error.message.includes('502') 
                    ? 'CORS ошибка: Бэкенд недоступен с localhost. Проверьте настройки сервера или тестируйте с того же домена.'
                    : 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
                timestamp: new Date()
            };
            this.widget.ui.addMessage(assistantMessage);
        }

        this.widget.dispatchEvent(new CustomEvent('textMessageSend', {
            detail: { text: messageText }
        }));
    }

    async sendMessage() {
        if (!this.widget.audioRecorder.audioBlob) {
        console.error('Нет аудио для отправки');
        return;
        }

        if (this.widget.audioRecorder.recordingTime < this.widget.audioRecorder.minRecordingTime) {
        this.widget.ui.showNotification('⚠️ Запись слишком короткая');
        return;
    }

        this.widget.ui.showLoading();

         const userMessage = {
        type: 'user',
        content: `Голосовое сообщение (${this.widget.audioRecorder.recordingTime}с)`, // ← Тоже исправить
        timestamp: new Date()
             };
    
         this.widget.ui.addMessage(userMessage);

         try {
           const formData = new FormData();
            formData.append(this.fieldName, this.widget.audioRecorder.audioBlob, 'voice-message.webm'); // ← И здесь
            formData.append('sessionId', this.widget.sessionId);

            console.log('📤 Отправляем аудио с sessionId:', this.widget.sessionId);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('📥 Ответ от сервера на аудио:', {
                sessionId: data.sessionId,
                messageCount: data.messageCount,
                insights: data.insights,
                tokens: data.tokens,
                timing: data.timing
            });
            
            this.widget.ui.hideLoading();
            this.widget.ui.updateMessageCount();

            // 🆕 Обновляем транскрипцию в пользовательском сообщении
            if (data.transcription) {
                const lastUserMessage = this.widget.messages[this.widget.messages.length - 1];
                if (lastUserMessage && lastUserMessage.type === 'user') {
                    lastUserMessage.content = data.transcription;
                    
                    const userMessages = this.widget.shadowRoot.querySelectorAll('.message.user');
                    const lastUserMessageElement = userMessages[userMessages.length - 1];
                    if (lastUserMessageElement) {
                        const bubble = lastUserMessageElement.querySelector('.message-bubble');
                        if (bubble) {
                            bubble.textContent = data.transcription;
                        }
                    }
                }
            }

            // 🆕 Обновляем insights из ответа сервера
            if (data.insights) {
                this.widget.understanding.update(data.insights);
            }

            const assistantMessage = {
                type: 'assistant',
                content: data[this.responseField] || 'Ответ не получен от сервера.',
                timestamp: new Date()
            };
            this.widget.ui.addMessage(assistantMessage);

            this.widget.cleanupAfterSend();

        } catch (error) {
            this.widget.ui.hideLoading();
            console.error('Ошибка при отправке аудио:', error);
            
            const assistantMessage = {
                type: 'assistant',
                content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
                timestamp: new Date()
            };
            this.widget.ui.addMessage(assistantMessage);
        }

        this.widget.dispatchEvent(new CustomEvent('messageSend', {
            detail: { duration: this.widget.recordingTime }
        }));
    }
}