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
        
        // SessionId для контекста диалогов
        this.sessionId = this.getOrCreateSessionId();
        
        // Данные понимания запроса (заглушки)
        this.understanding = {
            progress: 15,
            stage: 'Начальная информация',
            propertyType: '',
            preferredArea: '',
            budget: '',
            requirements: ''
        };
        
        // Configurable parameters
        this.apiUrl = this.getAttribute('api-url') || 'https://voice-widget-backend-production.up.railway.app/api/audio/upload';
        this.fieldName = this.getAttribute('field-name') || 'audio';
        this.responseField = this.getAttribute('response-field') || 'response';
        
        this.render();
        this.bindEvents();
        this.checkBrowserSupport();
        this.initializeUI();
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('voiceWidgetSessionId');
        if (!sessionId) {
            sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('voiceWidgetSessionId', sessionId);
            console.log('✨ Создан новый sessionId:', sessionId);
        } else {
            console.log('📋 Использую существующий sessionId:', sessionId);
        }
        return sessionId;
    }

    initializeUI() {
        const recordingControls = this.shadowRoot.getElementById('recordingControls');
        recordingControls.style.display = 'none';
        
        // Скрываем скроллбар в пустом состоянии
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        messagesContainer.style.overflowY = 'hidden';
        
        this.updateUnderstandingDisplay();
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
    max-width: 1200px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border-radius: 24px;
    overflow: hidden;
    height: auto;
    min-height: 700px;
    position: relative;
}

                .widget-container {
                    display: flex;
                    height: 100%;
                    position: relative;
                }

                /* HEADER */
                .widget-header {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 12px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 100;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .widget-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: white;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: #4ade80;
                    border-radius: 50%;
                    animation: pulse-dot 2s ease-in-out infinite;
                }

                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .widget-subtitle {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.7);
                    margin: 0;
                    font-weight: 400;
                }

                .header-right {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.5);
                    font-weight: 500;
                }

                /* LEFT PANEL - CHAT */
                .chat-panel {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 80px 24px 24px 24px;
                    position: relative;
                }

                .messages-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 24px;
                }

                .messages-container {
                    flex: 1;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(15px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 20px;
                    margin-bottom: 20px;
                }

                .messages-container::-webkit-scrollbar {
                    width: 6px;
                }

                .messages-container::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 3px;
                }

                .messages-container::-webkit-scrollbar-thumb {
                    background: rgba(147, 51, 234, 0.5);
                    border-radius: 3px;
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: rgba(255, 255, 255, 0.6);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    min-height: 200px;
                }

                .record-button-large {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #FF6B35, #F7931E);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 20px;
                    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    box-shadow: 
                        0 8px 24px rgba(255, 107, 53, 0.3),
                        0 4px 12px rgba(255, 107, 53, 0.2);
                }

                .record-button-large:hover {
                    transform: scale(1.05);
                    box-shadow: 
                        0 12px 32px rgba(255, 107, 53, 0.4),
                        0 6px 16px rgba(255, 107, 53, 0.3);
                }

                .record-button-large.recording {
                    animation: pulse-glow 2s ease-in-out infinite;
                }

                @keyframes pulse-glow {
                    0%, 100% {
                        box-shadow: 
                            0 8px 24px rgba(255, 107, 53, 0.3),
                            0 4px 12px rgba(255, 107, 53, 0.2),
                            0 0 0 0 rgba(255, 107, 53, 0.4);
                    }
                    50% {
                        box-shadow: 
                            0 8px 24px rgba(255, 107, 53, 0.5),
                            0 4px 12px rgba(255, 107, 53, 0.4),
                            0 0 0 20px rgba(255, 107, 53, 0);
                    }
                }

                .mic-icon {
                    width: 28px;
                    height: 28px;
                    fill: white;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
                }

                .empty-state-text {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: white;
                }

                .empty-state-subtitle {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.6);
                }

                /* RECORDING CONTROLS */
                .recording-controls {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(20px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    padding: 16px;
                    margin-bottom: 16px;
                    display: none;
                    align-items: center;
                    justify-content: space-between;
                }

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
                    background: linear-gradient(135deg, #FF6B35, #F7931E);
                    border-radius: 2px;
                    animation: wave 1.5s ease-in-out infinite;
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
                    color: #FF6B35;
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
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .stop-button {
                    background: rgba(239, 68, 68, 0.8);
                }

                .stop-button:hover {
                    background: rgba(220, 38, 38, 0.9);
                    transform: scale(1.05);
                }

                .send-button {
                    background: rgba(34, 197, 94, 0.8);
                }

                .send-button:hover {
                    background: rgba(22, 163, 74, 0.9);
                    transform: scale(1.05);
                }

                .button-icon {
                    width: 20px;
                    height: 20px;
                    fill: white;
                }

                /* INPUT AREA */
                .input-area {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 16px;
                }

                .input-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .text-input {
                    flex: 1;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: white;
                    outline: none;
                    transition: all 0.3s ease;
                    font-family: inherit;
                }

                .text-input::placeholder {
                    color: rgba(255, 255, 255, 0.5);
                }

                .text-input:focus {
                    border-color: rgba(147, 51, 234, 0.5);
                    background: rgba(255, 255, 255, 0.15);
                    box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
                }

                .voice-button {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #FF6B35, #F7931E);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                }

                .voice-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
                }

                .send-text-button {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8B5CF6, #A855F7);
                    border: none;
                    cursor: pointer;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                }

                .send-text-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
                }

                .input-icon {
                    width: 20px;
                    height: 20px;
                    fill: white;
                }

                /* MOBILE FUNCTION BUTTONS */
                .mobile-functions {
                    display: none;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 12px;
                    margin-top: 16px;
                }

                .mobile-function-btn {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    padding: 12px;
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-family: inherit;
                }

                .mobile-function-btn:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(255, 255, 255, 0.3);
                }

                .mobile-function-btn svg {
                    width: 14px;
                    height: 14px;
                    fill: currentColor;
                }

                /* RIGHT PANEL - UNDERSTANDING */
                .understanding-panel {
                    width: 300px;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 60px 20px 20px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* JARVIS SPHERE */
                .jarvis-container {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 16px;
                }

                .jarvis-sphere {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, 
                        rgba(147, 51, 234, 0.8) 0%, 
                        rgba(168, 85, 247, 0.6) 50%, 
                        rgba(196, 181, 253, 0.4) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    animation: jarvis-rotate 4s linear infinite;
                    box-shadow: 
                        0 0 40px rgba(147, 51, 234, 0.3),
                        inset 0 0 40px rgba(255, 255, 255, 0.1);
                }

                .jarvis-sphere::before {
                    content: '';
                    position: absolute;
                    top: 10%;
                    left: 10%;
                    right: 10%;
                    bottom: 10%;
                    border-radius: 50%;
                    background: linear-gradient(135deg, 
                        transparent 0%, 
                        rgba(255, 255, 255, 0.2) 50%, 
                        transparent 100%);
                    animation: jarvis-glow 2s ease-in-out infinite alternate;
                }

                @keyframes jarvis-rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes jarvis-glow {
                    from { opacity: 0.3; }
                    to { opacity: 0.8; }
                }

                .jarvis-core {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: white;
                    opacity: 0.9;
                    animation: jarvis-pulse 1.5s ease-in-out infinite;
                }

                @keyframes jarvis-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.1); opacity: 1; }
                }

                /* UNDERSTANDING PROGRESS */
                .understanding-section {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 16px;
                }

                .section-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 12px;
                }

                .progress-container {
                    margin-bottom: 16px;
                }

                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4ade80, #22c55e);
                    border-radius: 4px;
                    transition: width 0.5s ease;
                    width: 15%;
                }

                .progress-text {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                }

                .understanding-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .understanding-item:last-child {
                    border-bottom: none;
                }

                .item-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.3);
                    flex-shrink: 0;
                }

                .item-indicator.filled {
                    background: #4ade80;
                }

                .item-text {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.8);
                    flex: 1;
                }

                .item-value {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                    font-style: italic;
                }

                /* FUNCTION BUTTONS */
                .function-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .function-btn {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 12px;
                    padding: 12px;
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-family: inherit;
                }

                .function-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.25);
                    transform: translateY(-1px);
                }

                .function-btn svg {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }

                /* MESSAGES */
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
                    word-wrap: break-word;
                    position: relative;
                }

                .message.user .message-bubble {
                    background: linear-gradient(135deg, #FF6B35, #F7931E);
                    color: white;
                    border-bottom-right-radius: 6px;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                }

                .message.assistant .message-bubble {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border-bottom-left-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .typing-cursor {
                    color: #8B5CF6;
                    font-weight: bold;
                    animation: blink 1s infinite;
                }

                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }

                /* LOADING */
                .loading-indicator {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    gap: 12px;
                    color: rgba(255, 255, 255, 0.7);
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
                    background: linear-gradient(135deg, #8B5CF6, #A855F7);
                    border-radius: 50%;
                    animation: loadingDots 1.4s ease-in-out infinite both;
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

                /* RESPONSIVE */
                @media (max-width: 768px) {
                    :host {
                        max-width: 100%;
                        margin: 0;
                        border-radius: 0;
                        height: 100vh;
                    }

                    .widget-container {
                        flex-direction: column;
                    }

                    .understanding-panel {
                        display: none;
                    }

                    .chat-panel {
                        width: 100%;
                    }

                    .widget-header {
                        padding: 10px 16px;
                    }

                    .chat-panel {
                        padding: 55px 16px 16px 16px;
                    }

                    .mobile-functions {
                        display: grid;
                    }

                    .messages-container {
                        max-height: 300px;
                        min-height: 250px;
                    }

                    .record-button-large {
                        width: 60px;
                        height: 60px;
                    }

                    .mic-icon {
                        width: 24px;
                        height: 24px;
                    }
                }

                @media (max-width: 480px) {
                    .empty-state {
                        padding: 30px 15px;
                        min-height: 180px;
                    }

                    .empty-state-text {
                        font-size: 16px;
                    }

                    .record-button-large {
                        width: 55px;
                        height: 55px;
                    }

                    .mic-icon {
                        width: 22px;
                        height: 22px;
                    }
                }
            </style>

            <div class="widget-container">
                <!-- HEADER -->
                <div class="widget-header">
                    <div class="header-left">
                        <h2 class="widget-title">
                            Voice Assistant
                            <div class="status-dot"></div>
                        </h2>
                        <p class="widget-subtitle">Джон - эксперт по недвижимости в Валенсии</p>
                    </div>
                    <div class="header-right">
                        Session: <span id="sessionDisplay">${this.sessionId.slice(-8)}</span> | Messages: <span id="messageCount">0</span>
                    </div>
                </div>

                <!-- LEFT PANEL - CHAT -->
                <div class="chat-panel">
                    <div class="messages-area">
                        <div class="loading-indicator" id="loadingIndicator">
                            <span>Обрабатываю запрос</span>
                            <div class="loading-dots">
                                <div class="loading-dot"></div>
                                <div class="loading-dot"></div>
                                <div class="loading-dot"></div>
                            </div>
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

                        <div class="messages-container" id="messagesContainer">
                            <div class="empty-state" id="emptyState">
                                <button class="record-button-large" id="mainButton">
                                    <svg class="mic-icon" viewBox="0 0 24 24">
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-3.07c3.39-.5 6-3.4 6-6.93h-2z"/>
                                    </svg>
                                </button>
                                <div class="empty-state-text">Нажмите кнопку записи</div>
                                <div class="empty-state-subtitle">чтобы начать диалог</div>
                            </div>
                        </div>
                    </div>

                    <div class="input-area">
                        <div class="input-container">
                            <input type="text" class="text-input" id="textInput" placeholder="Или введите ваш вопрос...">
                            <button class="voice-button" id="voiceButton">
                                <svg class="input-icon" viewBox="0 0 24 24">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-3.07c3.39-.5 6-3.4 6-6.93h-2z"/>
                                </svg>
                            </button>
                            <button class="send-text-button" id="sendTextButton">
                                <svg class="input-icon" viewBox="0 0 24 24">
                                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                                </svg>
                            </button>
                        </div>

                        <div class="mobile-functions">
                            <button class="mobile-function-btn" id="mobileImgBtn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                                Изображения
                            </button>
                            <button class="mobile-function-btn" id="mobileDocBtn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                                Документы
                            </button>
                            <button class="mobile-function-btn" id="mobilePdfBtn">
                                <svg viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                                Скачать PDF
                            </button>
                        </div>
                    </div>
                </div>

                <!-- RIGHT PANEL - UNDERSTANDING -->
                <div class="understanding-panel">
                    <!-- JARVIS SPHERE -->
                    <div class="jarvis-container">
                        <div class="jarvis-sphere">
                            <div class="jarvis-core"></div>
                        </div>
                    </div>

                    <!-- UNDERSTANDING PROGRESS -->
                    <div class="understanding-section">
                        <div class="section-title">Понимание запроса</div>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" id="progressFill"></div>
                            </div>
                            <div class="progress-text" id="progressText">15% - Начальная информация</div>
                        </div>
                        
                        <div class="understanding-item">
                            <div class="item-indicator" id="propertyTypeIndicator"></div>
                            <div class="item-text">Тип недвижимости</div>
                            <div class="item-value" id="propertyTypeValue">не определен</div>
                        </div>
                        
                        <div class="understanding-item">
                            <div class="item-indicator" id="areaIndicator"></div>
                            <div class="item-text">Предпочтительный район</div>
                            <div class="item-value" id="areaValue">не определен</div>
                        </div>
                        
                        <div class="understanding-item">
                            <div class="item-indicator" id="budgetIndicator"></div>
                            <div class="item-text">Бюджет</div>
                            <div class="item-value" id="budgetValue">не определен</div>
                        </div>
                        
                        <div class="understanding-item">
                            <div class="item-indicator" id="requirementsIndicator"></div>
                            <div class="item-text">Особые требования</div>
                            <div class="item-value" id="requirementsValue">не определены</div>
                        </div>
                    </div>

                    <!-- FUNCTION BUTTONS -->
                    <div class="function-buttons">
                        <button class="function-btn" id="imageBtn">
                            <svg viewBox="0 0 24 24">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                            Изображения
                        </button>
                        
                        <button class="function-btn" id="documentBtn">
                            <svg viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            Документы
                        </button>
                        
                        <button class="function-btn" id="pdfBtn">
                            <svg viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            Скачать PDF
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const mainButton = this.shadowRoot.getElementById('mainButton');
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        const stopButton = this.shadowRoot.getElementById('stopButton');
        const sendButton = this.shadowRoot.getElementById('sendButton');
        const textInput = this.shadowRoot.getElementById('textInput');
        const sendTextButton = this.shadowRoot.getElementById('sendTextButton');

        // Главные кнопки записи
        mainButton.addEventListener('click', () => {
            if (!this.isRecording && !mainButton.disabled) {
                this.startRecording();
            }
        });

        voiceButton.addEventListener('click', () => {
            if (!this.isRecording && !voiceButton.disabled) {
                this.startRecording();
            }
        });

        // Кнопки управления записью
        stopButton.addEventListener('click', () => {
            if (this.isRecording) {
                this.cancelRecording();
            }
        });

        sendButton.addEventListener('click', () => {
            if (this.isRecording) {
                this.finishAndSend();
            } else if (this.audioBlob && this.recordingTime >= this.minRecordingTime) {
                this.sendMessage();
            } else {
                this.showWarning('⚠️ Сначала сделайте запись');
            }
        });

        // Текстовый ввод
        textInput.addEventListener('input', () => {
            const hasText = textInput.value.trim().length > 0;
            sendTextButton.style.display = hasText ? 'flex' : 'none';
        });

        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.isMobile()) {
                e.preventDefault();
                if (textInput.value.trim()) {
                    this.sendTextMessage();
                }
            }
        });

        sendTextButton.addEventListener('click', () => {
            if (textInput.value.trim()) {
                this.sendTextMessage();
            }
        });

        // Функциональные кнопки
        this.bindFunctionButtons();
    }

    bindFunctionButtons() {
        // Desktop функции
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

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
               || 'ontouchstart' in window;
    }

    // Методы понимания запроса
    updateUnderstanding(data) {
        if (data.progress !== undefined) {
            this.understanding.progress = data.progress;
            const progressFill = this.shadowRoot.getElementById('progressFill');
            const progressText = this.shadowRoot.getElementById('progressText');
            
            progressFill.style.width = `${data.progress}%`;
            progressText.textContent = `${data.progress}% - ${data.stage || this.understanding.stage}`;
        }

        const fields = ['propertyType', 'preferredArea', 'budget', 'requirements'];
        fields.forEach(field => {
            if (data[field] !== undefined) {
                this.understanding[field] = data[field];
                this.updateUnderstandingItem(field, data[field]);
            }
        });
    }

    updateUnderstandingItem(field, value) {
        const indicator = this.shadowRoot.getElementById(`${field}Indicator`);
        const valueElement = this.shadowRoot.getElementById(`${field}Value`);
        
        if (value && value.trim()) {
            indicator.classList.add('filled');
            valueElement.textContent = value;
        } else {
            indicator.classList.remove('filled');
            valueElement.textContent = 'не определен';
        }
    }

    updateUnderstandingDisplay() {
        const progressFill = this.shadowRoot.getElementById('progressFill');
        const progressText = this.shadowRoot.getElementById('progressText');
        
        progressFill.style.width = `${this.understanding.progress}%`;
        progressText.textContent = `${this.understanding.progress}% - ${this.understanding.stage}`;

        // Обновляем все поля
        Object.keys(this.understanding).forEach(key => {
            if (['progress', 'stage'].includes(key)) return;
            this.updateUnderstandingItem(key, this.understanding[key]);
        });
    }

    // Все остальные методы остаются как в оригинале
    async startRecording() {
        try {
            this.isRecording = true;
            this.recordingTime = 0;
            this.recordedChunks = [];
            this.audioBlob = null;

            const mainButton = this.shadowRoot.getElementById('mainButton');
            const voiceButton = this.shadowRoot.getElementById('voiceButton');
            const waveAnimation = this.shadowRoot.getElementById('waveAnimation');
            const recordingControls = this.shadowRoot.getElementById('recordingControls');

            mainButton.classList.add('recording');
            voiceButton.classList.add('recording');
            waveAnimation.classList.add('active');
            
            recordingControls.style.display = 'flex';
            recordingControls.classList.add('active');

            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

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

            this.recordingTimer = setInterval(() => {
                this.recordingTime++;
                this.updateTimer();

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

    cancelRecording() {
        if (!this.isRecording) return;

        console.log('🔴 Отменяем запись');

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const mainButton = this.shadowRoot.getElementById('mainButton');
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        const waveAnimation = this.shadowRoot.getElementById('waveAnimation');
        const recordingControls = this.shadowRoot.getElementById('recordingControls');

        mainButton.classList.remove('recording');
        voiceButton.classList.remove('recording');
        waveAnimation.classList.remove('active');
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');

        this.cleanupRecording();
        this.showNotification('❌ Запись отменена');

        this.dispatchEvent(new CustomEvent('recordingCancelled'));
    }

    async finishAndSend() {
        if (!this.isRecording) return;

        console.log('🟢 Завершаем запись и отправляем');

        if (this.recordingTime < this.minRecordingTime) {
            this.showNotification('⚠️ Запись слишком короткая');
            return;
        }

        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        const mainButton = this.shadowRoot.getElementById('mainButton');
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        const waveAnimation = this.shadowRoot.getElementById('waveAnimation');

        mainButton.classList.remove('recording');
        voiceButton.classList.remove('recording');
        waveAnimation.classList.remove('active');

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

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.sendMessage();
    }

    async sendTextMessage() {
        const textInput = this.shadowRoot.getElementById('textInput');
        const sendTextButton = this.shadowRoot.getElementById('sendTextButton');
        const messageText = textInput.value.trim();
        
        if (!messageText) return;

        textInput.value = '';
        sendTextButton.style.display = 'none';

        this.showLoading();

        const userMessage = {
            type: 'user',
            content: messageText,
            timestamp: new Date()
        };
        
        this.addMessage(userMessage);

        try {
            const formData = new FormData();
            formData.append('text', messageText);
            formData.append('sessionId', this.sessionId);

            console.log('📤 Отправляем текст с sessionId:', this.sessionId);

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
                tokens: data.tokens,
                timing: data.timing
            });
            
            this.hideLoading();
            this.updateMessageCount();

            const assistantMessage = {
                type: 'assistant',
                content: data[this.responseField] || 'Ответ не получен от сервера.',
                timestamp: new Date()
            };
            this.addMessage(assistantMessage);

            // Симуляция обновления понимания (в будущем из бэкенда)
            this.simulateUnderstandingUpdate();

        } catch (error) {
            this.hideLoading();
            console.error('Ошибка при отправке текста:', error);
            
            const assistantMessage = {
                type: 'assistant',
                content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
                timestamp: new Date()
            };
            this.addMessage(assistantMessage);
        }

        this.dispatchEvent(new CustomEvent('textMessageSend', {
            detail: { text: messageText }
        }));
    }

    async sendMessage() {
        if (!this.audioBlob) {
            console.error('Нет аудио для отправки');
            return;
        }

        if (this.recordingTime < this.minRecordingTime) {
            this.showNotification('⚠️ Запись слишком короткая');
            return;
        }

        this.showLoading();

        const userMessage = {
            type: 'user',
            content: `Голосовое сообщение (${this.recordingTime}с)`,
            timestamp: new Date()
        };
        
        this.addMessage(userMessage);

        try {
            const formData = new FormData();
            formData.append(this.fieldName, this.audioBlob, 'voice-message.webm');
            formData.append('sessionId', this.sessionId);

            console.log('📤 Отправляем с sessionId:', this.sessionId);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('📥 Ответ от сервера:', {
                sessionId: data.sessionId,
                messageCount: data.messageCount,
                tokens: data.tokens,
                timing: data.timing
            });
            
            this.hideLoading();
            this.updateMessageCount();

            if (data.transcription) {
                const lastUserMessage = this.messages[this.messages.length - 1];
                if (lastUserMessage && lastUserMessage.type === 'user') {
                    lastUserMessage.content = data.transcription;
                    
                    const userMessages = this.shadowRoot.querySelectorAll('.message.user');
                    const lastUserMessageElement = userMessages[userMessages.length - 1];
                    if (lastUserMessageElement) {
                        const bubble = lastUserMessageElement.querySelector('.message-bubble');
                        if (bubble) {
                            bubble.textContent = data.transcription;
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

            this.cleanupAfterSend();

            // Симуляция обновления понимания
            this.simulateUnderstandingUpdate();

        } catch (error) {
            this.hideLoading();
            console.error('Ошибка при отправке:', error);
            
            const assistantMessage = {
                type: 'assistant',
                content: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
                timestamp: new Date()
            };
            this.addMessage(assistantMessage);
        }

        this.dispatchEvent(new CustomEvent('messageSend', {
            detail: { duration: this.recordingTime }
        }));
    }

    simulateUnderstandingUpdate() {
        // Временная симуляция - в будущем данные будут приходить от бэкенда
        const currentProgress = this.understanding.progress;
        let newProgress = Math.min(currentProgress + Math.random() * 20, 100);
        
        const updates = {
            progress: Math.round(newProgress)
        };

        if (newProgress > 25 && !this.understanding.propertyType) {
            updates.propertyType = 'Квартира';
        }
        if (newProgress > 45 && !this.understanding.preferredArea) {
            updates.preferredArea = 'Центр города';
        }
        if (newProgress > 65 && !this.understanding.budget) {
            updates.budget = '200,000 - 350,000 €';
        }
        if (newProgress > 85 && !this.understanding.requirements) {
            updates.requirements = 'Балкон, паркинг';
        }

        if (newProgress < 35) {
            updates.stage = 'Начальная информация';
        } else if (newProgress < 65) {
            updates.stage = 'Уточнение деталей';
        } else if (newProgress < 90) {
            updates.stage = 'Финальные требования';
        } else {
            updates.stage = 'Готов к подбору';
        }

        this.updateUnderstanding(updates);
    }

    addMessage(message) {
        this.messages.push(message);
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        const emptyState = this.shadowRoot.getElementById('emptyState');
        
        if (this.messages.length === 1 && emptyState) {
            emptyState.style.display = 'none';
            // Показываем скроллбар только когда есть сообщения
            messagesContainer.style.overflowY = 'auto';
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble';
        
        if (message.type === 'assistant') {
            bubbleElement.textContent = '';
            this.typeWriter(bubbleElement, message.content, 30);
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

    updateTimer() {
        const timer = this.shadowRoot.getElementById('timer');
        const minutes = Math.floor(this.recordingTime / 60);
        const seconds = this.recordingTime % 60;
        timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateMessageCount() {
        const messageCountElement = this.shadowRoot.getElementById('messageCount');
        messageCountElement.textContent = this.messages.length;
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
        // Простое уведомление - можно расширить
        console.log('📢', message);
        
        // Можно добавить toast уведомления в будущем
        if (typeof window !== 'undefined' && window.alert) {
            // Пока просто в консоль, чтобы не мешать UX
        }
    }

    handleRecordingError(message) {
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        const mainButton = this.shadowRoot.getElementById('mainButton');
        const voiceButton = this.shadowRoot.getElementById('voiceButton');
        const waveAnimation = this.shadowRoot.getElementById('waveAnimation');
        const recordingControls = this.shadowRoot.getElementById('recordingControls');

        mainButton.classList.remove('recording');
        voiceButton.classList.remove('recording');
        waveAnimation.classList.remove('active');
        
        recordingControls.style.display = 'none';
        recordingControls.classList.remove('active');

        this.cleanupRecording();
        this.showNotification(`❌ ${message}`);
    }

    cleanupRecording() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;

        const timer = this.shadowRoot.getElementById('timer');
        timer.textContent = '0:00';
    }

    cleanupAfterSend() {
        this.audioBlob = null;
        this.recordedChunks = [];
        this.recordingTime = 0;

        const timer = this.shadowRoot.getElementById('timer');
        timer.textContent = '0:00';
        
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

    // Публичные методы для управления
    clearSession() {
        localStorage.removeItem('voiceWidgetSessionId');
        this.sessionId = this.getOrCreateSessionId();
        
        const sessionDisplay = this.shadowRoot.getElementById('sessionDisplay');
        sessionDisplay.textContent = this.sessionId.slice(-8);
        
        console.log('🗑️ Сессия очищена, создан новый sessionId:', this.sessionId);
    }

    getCurrentSessionId() {
        return this.sessionId;
    }

    clearMessages() {
        this.messages = [];
        const messagesContainer = this.shadowRoot.getElementById('messagesContainer');
        const emptyState = this.shadowRoot.getElementById('emptyState');
        
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(emptyState.cloneNode(true));
        emptyState.style.display = 'block';
        
        // Скрываем скроллбар когда нет сообщений
        messagesContainer.style.overflowY = 'hidden';
        
        this.updateMessageCount();
        shadowRoot.getElementById('messagesContainer');
        
        
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(emptyState.cloneNode(true));
        emptyState.style.display = 'block';
        
        this.updateMessageCount();
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

    // Методы для управления пониманием запроса (API для будущего использования)
    setUnderstanding(data) {
        this.updateUnderstanding(data);
    }

    getUnderstanding() {
        return { ...this.understanding };
    }

    resetUnderstanding() {
        this.understanding = {
            progress: 0,
            stage: 'Ожидание',
            propertyType: '',
            preferredArea: '',
            budget: '',
            requirements: ''
        };
        this.updateUnderstandingDisplay();
    }
}

// Регистрируем кастомный элемент
customElements.define('voice-widget', VoiceWidget);