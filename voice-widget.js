class VoiceWidget extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isRecording = false;
        this.recordingTime = 0;
        this.recordingTimer = null;
        this.maxRecordingTime = 30;
        this.minRecordingTime = 1;
        this.messages = [];
        this.mediaRecorder = null;
        this.stream = null;
        this.audioBlob = null;
        this.recordedChunks = [];
        
        // Configurable parameters
        this.apiUrl = this.getAttribute('api-url') || 'https://voice-widget-backend-production.up.railway.app/api/audio/upload';
        this.fieldName = this.getAttribute('field-name') || 'audio';
        this.responseField = this.getAttribute('response-field') || 'response'; // ✅ ОБНОВЛЕНО - теперь 'response'
        
        this.render();
        this.bindEvents();
        this.checkBrowserSupport();
        this.initializeUI();
    }

    initializeUI() {
        const recordingControls = this.shadowRoot.getElementById('recordingControls');
        
        // ✅ ИЗМЕНЕНО - скрываем блок по умолчанию
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');
    }

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
            statusIndicator.innerHTML = '<div class="status-text">❌ Браузер не поддерживает запись аудио</div>';
            
            const mainButton = this.shadowRoot.getElementById('mainButton');
            mainButton.disabled = true;
            mainButton.style.opacity = '0.5';
            mainButton.style.cursor = 'not-allowed';
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    max-width: 500px;
                    margin: 0 auto;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .widget-container {
                    position: relative;
                    background: rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 
                        0 8px 32px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.4),
                        inset 0 -1px 0 rgba(255, 255, 255, 0.1);
                    padding: 32px;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                .widget-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, 
                        transparent, 
                        rgba(255, 255, 255, 0.8) 50%, 
                        transparent);
                    animation: shimmer 3s ease-in-out infinite;
                }

                @keyframes shimmer {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 1; }
                }

                .widget-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .widget-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1d1d1f;
                    margin: 0 0 8px 0;
                    background: linear-gradient(135deg, #1d1d1f, #424245);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .widget-subtitle {
                    font-size: 16px;
                    color: rgba(29, 29, 31, 0.7);
                    margin: 0;
                    font-weight: 500;
                }

                .main-interface {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .main-button {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #FF7A00, #e66800);
                    border: none;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    box-shadow: 
                        0 8px 24px rgba(255, 122, 0, 0.3),
                        0 4px 12px rgba(255, 122, 0, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }

                .main-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.5;
                }

                .main-button::before {
                    content: '';
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    right: -2px;
                    bottom: -2px;
                    background: linear-gradient(45deg, #FF7A00, #ff9500, #FF7A00);
                    border-radius: 50%;
                    z-index: -1;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .main-button:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 
                        0 12px 32px rgba(255, 122, 0, 0.4),
                        0 6px 16px rgba(255, 122, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.4);
                }

                .main-button:hover:not(:disabled)::before {
                    opacity: 1;
                }

                .main-button:active:not(:disabled) {
                    transform: scale(0.95);
                }

                .main-button.recording {
                    animation: pulse-glow 2s ease-in-out infinite;
                }

                @keyframes pulse-glow {
                    0%, 100% {
                        box-shadow: 
                            0 8px 24px rgba(255, 122, 0, 0.3),
                            0 4px 12px rgba(255, 122, 0, 0.2),
                            0 0 0 0 rgba(255, 122, 0, 0.4);
                    }
                    50% {
                        box-shadow: 
                            0 8px 24px rgba(255, 122, 0, 0.5),
                            0 4px 12px rgba(255, 122, 0, 0.4),
                            0 0 0 20px rgba(255, 122, 0, 0);
                    }
                }

                .mic-icon {
                    width: 40px;
                    height: 40px;
                    fill: white;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
                }

                .status-indicator {
                    margin-bottom: 20px;
                    text-align: center;
                    min-height: 20px;
                }

                .status-text {
                    font-size: 14px;
                    color: rgba(29, 29, 31, 0.6);
                    font-weight: 500;
                }

                .recording-controls {
                    background: rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    padding: 20px;
                    margin-bottom: 20px;
                    /* ✅ ИЗМЕНЕНО - скрыто по умолчанию */
                    display: none;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 
                        0 4px 16px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }

                /* ✅ ВЕРНУЛИ .recording-controls.active */
                .recording-controls.active {
                    display: flex;
                    animation: slideIn 0.3s ease-out;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .recording-indicator {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .wave-animation {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .wave-animation.active {
                    opacity: 1;
                }

                .wave-bar {
                    width: 4px;
                    height: 16px;
                    background: linear-gradient(135deg, #FF7A00, #e66800);
                    border-radius: 2px;
                    animation: wave 1.5s ease-in-out infinite;
                    box-shadow: 0 2px 4px rgba(255, 122, 0, 0.3);
                }

                .wave-bar:nth-child(2) { animation-delay: 0.1s; }
                .wave-bar:nth-child(3) { animation-delay: 0.2s; }
                .wave-bar:nth-child(4) { animation-delay: 0.3s; }
                .wave-bar:nth-child(5) { animation-delay: 0.4s; }

                @keyframes wave {
                    0%, 100% { 
                        height: 8px; 
                        opacity: 0.6; 
                    }
                    50% { 
                        height: 24px; 
                        opacity: 1; 
                    }
                }

                .timer {
                    font-size: 16px;
                    font-weight: 700;
                    color: #FF7A00;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    min-width: 60px;
                }

                .control-buttons {
                    display: flex;
                    gap: 12px;
                }

                .control-button {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .stop-button {
                    background: rgba(255, 71, 87, 0.9);
                }

                .stop-button:hover {
                    background: rgba(255, 55, 66, 1);
                    transform: scale(1.05);
                }

                .send-button {
                    background: rgba(46, 213, 115, 0.9);
                }

                .send-button:hover {
                    background: rgba(38, 208, 104, 1);
                    transform: scale(1.05);
                }

                .button-icon {
                    width: 20px;
                    height: 20px;
                    fill: white;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
                }

                .messages-container {
                    background: rgba(255, 255, 255, 0.3);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    max-height: 300px;
                    overflow-y: auto;
                    padding: 20px;
                    box-shadow: 
                        inset 0 1px 0 rgba(255, 255, 255, 0.3),
                        0 4px 16px rgba(0, 0, 0, 0.1);
                    margin-bottom: 20px;
                }

                .messages-container::-webkit-scrollbar {
                    width: 6px;
                }

                .messages-container::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }

                .messages-container::-webkit-scrollbar-thumb {
                    background: rgba(255, 122, 0, 0.3);
                    border-radius: 3px;
                }

                .messages-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 122, 0, 0.5);
                }

                .message {
                    margin-bottom: 16px;
                    animation: messageSlide 0.3s ease-out;
                }

                @keyframes messageSlide {
                    from {
                        opacity: 0;
                        transform: translateY(15px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .message.user {
                    text-align: right;
                }

                .message.assistant {
                    text-align: left;
                }

                .message-bubble {
                    display: inline-block;
                    max-width: 85%;
                    padding: 14px 18px;
                    border-radius: 18px;
                    font-size: 15px;
                    line-height: 1.4;
                    font-weight: 500;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    word-wrap: break-word;
                    position: relative;
                }

                /* ✅ ДОБАВЛЕНО - стили для курсора печати */
                .typing-cursor {
                    color: #FF7A00;
                    font-weight: bold;
                    animation: blink 1s infinite;
                }

                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }

                .message.user .message-bubble {
                    background: rgba(255, 122, 0, 0.9);
                    color: white;
                    border-bottom-right-radius: 6px;
                    box-shadow: 0 4px 12px rgba(255, 122, 0, 0.3);
                }

                .message.assistant .message-bubble {
                    background: rgba(255, 255, 255, 0.6);
                    color: #1d1d1f;
                    border-bottom-left-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .voice-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.8);
                    margin-top: 6px;
                    font-weight: 500;
                }

                .voice-icon {
                    width: 12px;
                    height: 12px;
                    fill: rgba(255, 255, 255, 0.8);
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: rgba(29, 29, 31, 0.6);
                }

                .empty-state-icon {
                    width: 48px;
                    height: 48px;
                    fill: rgba(29, 29, 31, 0.3);
                    margin-bottom: 16px;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                }

                .empty-state-text {
                    font-size: 16px;
                    font-weight: 500;
                    line-height: 1.5;
                }

                .loading-indicator {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    gap: 12px;
                    color: rgba(29, 29, 31, 0.7);
                    font-size: 15px;
                    font-weight: 500;
                }

                .loading-indicator.active {
                    display: flex;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .loading-dots {
                    display: flex;
                    gap: 4px;
                }

                .loading-dot {
                    width: 8px;
                    height: 8px;
                    background: linear-gradient(135deg, #FF7A00, #e66800);
                    border-radius: 50%;
                    animation: loadingDots 1.4s ease-in-out infinite both;
                    box-shadow: 0 2px 4px rgba(255, 122, 0, 0.3);
                }

                .loading-dot:nth-child(1) { animation-delay: -0.32s; }
                .loading-dot:nth-child(2) { animation-delay: -0.16s; }

                @keyframes loadingDots {
                    0%, 80%, 100% { 
                        transform: scale(0.8); 
                        opacity: 0.5; 
                    }
                    40% { 
                        transform: scale(1.2); 
                        opacity: 1; 
                    }
                }

                /* Mobile adaptivity */
                @media (max-width: 768px) {
                    :host {
                        max-width: 100%;
                        margin: 0 10px;
                    }

                    .widget-container {
                        padding: 24px;
                        border-radius: 20px;
                    }

                    .widget-title {
                        font-size: 22px;
                    }

                    .main-button {
                        width: 100px;
                        height: 100px;
                    }

                    .mic-icon {
                        width: 32px;
                        height: 32px;
                    }

                    .messages-container {
                        max-height: 250px;
                    }

                    .message-bubble {
                        max-width: 90%;
                        font-size: 14px;
                    }
                }

                @media (max-width: 480px) {
                    .widget-container {
                        padding: 20px;
                        border-radius: 16px;
                    }

                    .widget-title {
                        font-size: 20px;
                    }

                    .main-button {
                        width: 90px;
                        height: 90px;
                    }

                    .mic-icon {
                        width: 28px;
                        height: 28px;
                    }

                    .recording-controls {
                        flex-direction: column;
                        gap: 16px;
                        align-items: center;
                    }

                    .control-buttons {
                        gap: 20px;
                    }
                }
            </style>

            <div class="widget-container">
                <div class="widget-header">
                    <h2 class="widget-title">Голосовой помощник</h2>
                    <p class="widget-subtitle">Нажмите кнопку и говорите</p>
                </div>

                <div class="main-interface">
                    <button class="main-button" id="mainButton">
                        <svg class="mic-icon" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-3.07c3.39-.5 6-3.4 6-6.93h-2z"/>
                        </svg>
                    </button>
                </div>

                <div class="status-indicator" id="statusIndicator">
                    <div class="status-text">Готов к записи</div>
                </div>

                <div class="recording-controls" id="recordingControls">
                    <div class="recording-indicator">
                        <div class="wave-animation" id="waveAnimation">
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                        </div>
                        <div class="timer" id="timer">0:00</div>
                    </div>
                    <div class="control-buttons">
                        <button class="control-button stop-button" id="stopButton" title="Отменить запись">
                            <svg class="button-icon" viewBox="0 0 24 24">
                                <rect x="6" y="6" width="12" height="12" rx="2"/>
                            </svg>
                        </button>
                        <button class="control-button send-button" id="sendButton" title="Отправить сообщение">
                            <svg class="button-icon" viewBox="0 0 24 24">
                                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="loading-indicator" id="loadingIndicator">
                    <span>Обрабатываю запрос</span>
                    <div class="loading-dots">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>
                </div>

                <div class="messages-container" id="messagesContainer">
                    <div class="empty-state" id="emptyState">
                        <svg class="empty-state-icon" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-3.07c3.39-.5 6-3.4 6-6.93h-2z"/>
                        </svg>
                        <div class="empty-state-text">Нажмите кнопку записи<br>чтобы начать диалог</div>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const mainButton = this.shadowRoot.getElementById('mainButton');
        const stopButton = this.shadowRoot.getElementById('stopButton');
        const sendButton = this.shadowRoot.getElementById('sendButton');

        // Главная кнопка записи
        mainButton.addEventListener('click', () => {
            if (!this.isRecording && !mainButton.disabled) {
                this.startRecording();
            }
        });

        // ✅ ИСПРАВЛЕНО - кнопка STOP = ОТМЕНА записи
        stopButton.addEventListener('click', () => {
            if (this.isRecording) {
                this.cancelRecording(); // Отменяет и полностью сбрасывает
            }
        });

        // ✅ ИСПРАВЛЕНО - кнопка SEND = ОТПРАВИТЬ запись
        sendButton.addEventListener('click', () => {
            if (this.isRecording) {
                // Во время записи - завершаем и отправляем
                this.finishAndSend();
            } else if (this.audioBlob && this.recordingTime >= this.minRecordingTime) {
                // Если есть готовая запись - отправляем
                this.sendMessage();
            } else {
                // Нет записи - показываем предупреждение
                this.showWarning('⚠️ Сначала сделайте запись');
            }
        });
    }

    async startRecording() {
        try {
            this.isRecording = true;
            this.recordingTime = 0;
            this.recordedChunks = [];
            this.audioBlob = null; // Очищаем предыдущую запись

            const mainButton = this.shadowRoot.getElementById('mainButton');
            const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
            const waveAnimation = this.shadowRoot.getElementById('waveAnimation');
            const recordingControls = this.shadowRoot.getElementById('recordingControls');

            mainButton.classList.add('recording');
            waveAnimation.classList.add('active');
            statusIndicator.innerHTML = '<div class="status-text">🔴 Запись...</div>';
            
            // ✅ ДОБАВЛЕНО - показываем блок с кнопками
            recordingControls.style.display = 'flex';
            recordingControls.classList.add('active');

            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Определяем MIME-тип
            let mimeType = '';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            }

            this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                // Создаем blob только если не отменено
                if (this.recordedChunks.length > 0) {
                    this.audioBlob = new Blob(this.recordedChunks, mimeType ? { type: mimeType } : {});
                    console.log('✅ Аудио готово к отправке');
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('Ошибка записи:', event.error);
                this.handleRecordingError('Произошла ошибка во время записи');
            };

            this.mediaRecorder.start(100);

            // Таймер записи
            this.recordingTimer = setInterval(() => {
                this.recordingTime++;
                this.updateTimer();

                // Автоматическая остановка при достижении лимита
                if (this.recordingTime >= this.maxRecordingTime) {
                    this.finishAndSend();
                }
            }, 1000);

            this.dispatchEvent(new CustomEvent('recordingStart'));

        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            this.handleRecordingError(this.getErrorMessage(err));
        }
    }

    // ✅ НОВЫЙ МЕТОД - отмена записи (кнопка STOP)
    cancelRecording() {
        if (!this.isRecording) return;

        console.log('🔴 Отменяем запись');

        // Останавливаем запись
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        // Останавливаем MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        // Останавливаем поток
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Сбрасываем UI
        const mainButton = this.shadowRoot.getElementById('mainButton');
        const waveAnimation = this.shadowRoot.getElementById('waveAnimation');
        const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
        const recordingControls = this.shadowRoot.getElementById('recordingControls');

        mainButton.classList.remove('recording');
        waveAnimation.classList.remove('active');
        
        // ✅ ДОБАВЛЕНО - скрываем блок с кнопками
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');

        // Полная очистка состояния
        this.cleanupRecording();

        // Показываем статус отмены
        statusIndicator.innerHTML = '<div class="status-text">❌ Запись отменена</div>';
        setTimeout(() => {
            statusIndicator.innerHTML = '<div class="status-text">Готов к записи</div>';
        }, 2000);

        this.dispatchEvent(new CustomEvent('recordingCancelled'));
    }

    // ✅ НОВЫЙ МЕТОД - завершение записи и отправка (кнопка SEND)
    async finishAndSend() {
        if (!this.isRecording) return;

        console.log('🟢 Завершаем запись и отправляем');

        // Проверяем минимальную длину
        if (this.recordingTime < this.minRecordingTime) {
            this.showWarning('⚠️ Запись слишком короткая');
            return;
        }

        const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
        statusIndicator.innerHTML = '<div class="status-text">⏳ Завершаем запись...</div>';

        // Останавливаем запись
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        // Сбрасываем UI
        const mainButton = this.shadowRoot.getElementById('mainButton');
        const waveAnimation = this.shadowRoot.getElementById('waveAnimation');

        mainButton.classList.remove('recording');
        waveAnimation.classList.remove('active');

        // Ждем создания blob и отправляем
        await new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                if (this.recordedChunks.length > 0) {
                    this.audioBlob = new Blob(this.recordedChunks, { 
                        type: this.mediaRecorder.mimeType || 'audio/webm' 
                    });
                    console.log('✅ Blob создан, отправляем...');
                    resolve();
                }
            };

            this.mediaRecorder.stop();
        });

        // Останавливаем поток
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Отправляем сообщение
        this.sendMessage();
    }

    // ✅ ВСПОМОГАТЕЛЬНЫЙ МЕТОД - показать предупреждение
    showWarning(message) {
        const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
        statusIndicator.innerHTML = `<div class="status-text">${message}</div>`;
        setTimeout(() => {
            statusIndicator.innerHTML = '<div class="status-text">Готов к записи</div>';
        }, 2000);
    }

    updateTimer() {
        const timer = this.shadowRoot.getElementById('timer');
        const minutes = Math.floor(this.recordingTime / 60);
        const seconds = this.recordingTime % 60;
        timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async sendMessage() {
        if (!this.audioBlob) {
            console.error('Нет аудио для отправки');
            return;
        }

        if (this.recordingTime < this.minRecordingTime) {
            this.showWarning('⚠️ Запись слишком короткая');
            return;
        }

        this.showLoading();
        const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
        
        statusIndicator.innerHTML = '<div class="status-text">📤 Отправляю сообщение...</div>';

        // Добавляем пользовательское сообщение
        const userMessage = {
            type: 'user',
            content: `Голосовое сообщение (${this.recordingTime}с)`,
            timestamp: new Date()
        };
        
        this.addMessage(userMessage);

        try {
            // Подготавливаем данные для отправки
            const formData = new FormData();
            formData.append(this.fieldName, this.audioBlob, 'voice-message.webm');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            this.hideLoading();
            statusIndicator.innerHTML = '<div class="status-text">✅ Сообщение отправлено</div>';

            // ✅ ИСПРАВЛЕНО - Показываем краткое резюме пользователю
            if (data.summary) {
                // Обновляем последнее сообщение пользователя с кратким резюме
                const lastUserMessage = this.messages[this.messages.length - 1];
                if (lastUserMessage && lastUserMessage.type === 'user') {
                    lastUserMessage.content = data.summary; // ✅ Показываем только краткое резюме
                    lastUserMessage.fullTranscription = data.transcription; // ✅ Сохраняем полную транскрипцию про запас
                    
                    // ✅ ИСПРАВЛЕНО - Обновляем отображение в DOM через shadowRoot
                    const userMessages = this.shadowRoot.querySelectorAll('.message.user');
                    const lastUserMessageElement = userMessages[userMessages.length - 1];
                    if (lastUserMessageElement) {
                        const bubble = lastUserMessageElement.querySelector('.message-bubble');
                        if (bubble) {
                            bubble.textContent = data.summary; // ✅ Показываем краткое резюме
                        }
                    }
                }
            }

            const assistantMessage = {
                type: 'assistant',
                content: data[this.responseField] || 'Ответ не получен от сервера.',
                timestamp: new Date()
            };
            this.addMessage(assistantMessage);

            // ✅ Очистка после успешной отправки
            this.cleanupAfterSend();

            setTimeout(() => {
                statusIndicator.innerHTML = '<div class="status-text">Готов к записи</div>';
            }, 2000);

        } catch (error) {
            this.hideLoading();
            console.error('Ошибка при отправке:', error);
            
            statusIndicator.innerHTML = '<div class="status-text">❌ Ошибка при отправке</div>';

            const assistantMessage = {
                type: 'assistant',
                content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
                timestamp: new Date()
            };
            this.addMessage(assistantMessage);

            setTimeout(() => {
                statusIndicator.innerHTML = '<div class="status-text">Готов к записи</div>';
            }, 3000);
        }

        // Отправляем событие
        this.dispatchEvent(new CustomEvent('messageSend', {
            detail: { duration: this.recordingTime }
        }));
    }

    addMessage(message) {
        this.messages.push(message);
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        const emptyState = this.shadowRoot.getElementById('emptyState');
        
        // Скрываем пустое состояние при первом сообщении
        if (this.messages.length === 1 && emptyState) {
            emptyState.style.display = 'none';
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble';
        
        // ✅ ДОБАВЛЕНО - машинная печать для ассистента
        if (message.type === 'assistant') {
            bubbleElement.textContent = ''; // Начинаем с пустого текста
            this.typeWriter(bubbleElement, message.content, 30); // 30ms между символами
        } else {
            bubbleElement.textContent = message.content;
        }
        
        messageElement.appendChild(bubbleElement);
        
        // Добавляем индикатор голосового сообщения для пользователя
        if (message.type === 'user') {
            const voiceIndicator = document.createElement('div');
            voiceIndicator.className = 'voice-indicator';
            voiceIndicator.innerHTML = `
                <svg class="voice-icon" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-3.07c3.39-.5 6-3.4 6-6.93h-2z"/>
                </svg>
                <span>Голосовое сообщение</span>
            `;
            messageElement.appendChild(voiceIndicator);
        }
        
        messagesContainer.appendChild(messageElement);
        
        // Прокручиваем к низу
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ✅ НОВЫЙ МЕТОД - эффект машинной печати
    typeWriter(element, text, speed = 30) {
        let i = 0;
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        
        // Добавляем курсор печати
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        element.appendChild(cursor);
        
        const typeInterval = setInterval(() => {
            if (i < text.length) {
                // Вставляем символ перед курсором
                element.insertBefore(document.createTextNode(text.charAt(i)), cursor);
                i++;
                
                // Автоскролл во время печати
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                // Убираем курсор когда текст напечатан
                cursor.remove();
                clearInterval(typeInterval);
                
                // Финальный скролл
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, speed);
    }

    showLoading() {
        const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
        loadingIndicator.classList.add('active');
    }

    hideLoading() {
        const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
        loadingIndicator.classList.remove('active');
    }

    handleRecordingError(message) {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        const mainButton = this.shadowRoot.getElementById('mainButton');
        const waveAnimation = this.shadowRoot.getElementById('waveAnimation');
        const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
        const recordingControls = this.shadowRoot.getElementById('recordingControls');

        mainButton.classList.remove('recording');
        waveAnimation.classList.remove('active');
        statusIndicator.innerHTML = `<div class="status-text">❌ ${message}</div>`;
        
        // ✅ ДОБАВЛЕНО - скрываем блок при ошибке
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');

        this.cleanupRecording();

        setTimeout(() => {
            statusIndicator.innerHTML = '<div class="status-text">Готов к записи</div>';
        }, 3000);
    }

    // ✅ ИСПРАВЛЕННЫЙ cleanupRecording - полная очистка
    cleanupRecording() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;

        // Сбрасываем таймер
        const timer = this.shadowRoot.getElementById('timer');
        timer.textContent = '0:00';
    }

    // ✅ ИСПРАВЛЕННЫЙ cleanupAfterSend - очистка после отправки
    cleanupAfterSend() {
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;

        // Сбрасываем таймер
        const timer = this.shadowRoot.getElementById('timer');
        timer.textContent = '0:00';
        
        // ✅ ДОБАВЛЕНО - скрываем блок с кнопками после отправки
        const recordingControls = this.shadowRoot.getElementById('recordingControls');
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');
    }

    getErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return 'Доступ к микрофону запрещен';
        } else if (error.name === 'NotFoundError') {
            return 'Микрофон не найден';
        } else if (error.name === 'NotReadableError') {
            return 'Микрофон уже используется';
        } else if (error.name === 'OverconstrainedError') {
            return 'Настройки микрофона не поддерживаются';
        } else {
            return 'Ошибка доступа к микрофону';
        }
    }

    // Lifecycle method - очистка при удалении компонента
    disconnectedCallback() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }

    // Публичные методы для внешнего управления
    clearMessages() {
        this.messages = [];
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        const emptyState = this.shadowRoot.getElementById('emptyState');
        
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(emptyState.cloneNode(true));
        emptyState.style.display = 'block';
    }

    setApiUrl(url) {
        this.apiUrl = url;
    }

    getMessages() {
        return [...this.messages];
    }

    isCurrentlyRecording() {
        return this.isRecording;
    }
}

// Регистрируем кастомный элемент
customElements.define('voice-widget', VoiceWidget);