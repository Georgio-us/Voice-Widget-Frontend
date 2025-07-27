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

// Новые свойства для превью
this.isInPreviewMode = false;
        this.speechRecognition = null;
        this.transcriptPreview = '';

        // Новые свойства для индикатора громкости
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.animationId = null;

        // Configurable parameters
        this.apiUrl = this.getAttribute('api-url') || 'https://voice-widget-backend-production.up.railway.app/api/audio/upload';
        this.fieldName = this.getAttribute('field-name') || 'audio';
        this.responseField = this.getAttribute('response-field') || 'response';

        this.render();
        this.bindEvents();
        this.checkBrowserSupport();
        this.initializeUI();
        this.initSpeechRecognition();
    }
        // Проверка виджета
        connectedCallback() {
        console.log('✅ Виджет подключён!');
    }
    initializeUI() {
        const recordingControls = this.shadowRoot.getElementById('recordingControls');
        const sendBtn = this.shadowRoot.getElementById('sendButton');

        recordingControls.style.display = 'flex';
        recordingControls.classList.add('active');
    }

    bindEvents() {
        const mainBtn = this.shadowRoot.getElementById('mainButton');
        const stopBtn = this.shadowRoot.getElementById('stopButton');
        const sendBtn = this.shadowRoot.getElementById('sendButton');

        mainBtn?.addEventListener('click', () => this.toggleRecording());
        stopBtn?.addEventListener('click', () => this.cancelRecording());
        sendBtn?.addEventListener('click', () => this.sendMessage());
    }

    // Проверка виджета
    connectedCallback() {
        console.log('✅ Виджет подключён!');
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

    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            this.speechRecognition.continuous = true;
            this.speechRecognition.interimResults = true;
            this.speechRecognition.lang = 'ru-RU';

            this.speechRecognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.transcriptPreview = finalTranscript || interimTranscript;
            };

            this.speechRecognition.onerror = (event) => {
                console.log('Speech recognition error:', event.error);
            };
        }
    }

    initAudioAnalyser(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;

            this.microphone.connect(this.analyser);

            this.visualizeVolume();
        } catch (error) {
            console.log('Audio analyser not available:', error);
        }
    }

    visualizeVolume() {
        if (!this.analyser || !this.isRecording) {
            this.stopVolumeVisualization();
            return;
        }

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedVolume = Math.min(average / 128, 1);

        this.updateVolumeIndicator(normalizedVolume);

        this.animationId = requestAnimationFrame(() => this.visualizeVolume());
    }

    updateVolumeIndicator(level) {
        const volumeBars = this.shadowRoot.querySelectorAll('.volume-bar');
        const mainButton = this.shadowRoot.getElementById('mainButton');

        volumeBars.forEach((bar, index) => {
            const threshold = (index + 1) / volumeBars.length;
            if (level > threshold) {
                bar.classList.add('active');
                bar.style.height = `${20 + Math.random() * 20}px`;
            } else {
                bar.classList.remove('active');
                bar.style.height = '8px';
            }
        });

        if (level > 0.7) {
            mainButton.classList.add('loud-pulse');
        } else {
            mainButton.classList.remove('loud-pulse');
        }
    }

    stopVolumeVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const volumeBars = this.shadowRoot.querySelectorAll('.volume-bar');
        volumeBars.forEach(bar => {
            bar.classList.remove('active');
            bar.style.height = '8px';
        });

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
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

                .main-button.loud-pulse {
                    animation: loudPulse 0.3s ease;
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

                @keyframes loudPulse {
                    0% { 
                        box-shadow: 
                            0 8px 24px rgba(255, 122, 0, 0.3),
                            0 4px 12px rgba(255, 122, 0, 0.2),
                            0 0 0 0 rgba(255, 122, 0, 0.4);
                    }
                    50% { 
                        box-shadow: 
                            0 8px 24px rgba(255, 122, 0, 0.5),
                            0 4px 12px rgba(255, 122, 0, 0.4),
                            0 0 0 10px rgba(255, 122, 0, 0.1);
                    }
                    100% { 
                        box-shadow: 
                            0 8px 24px rgba(255, 122, 0, 0.3),
                            0 4px 12px rgba(255, 122, 0, 0.2),
                            0 0 0 0 rgba(255, 122, 0, 0);
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
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 
                        0 4px 16px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
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

                .recording-controls.active .wave-animation {
                    display: none;
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

                .volume-indicator {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    height: 24px;
                    margin: 0 12px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .recording-controls.active .volume-indicator {
                    opacity: 1;
                }

                .volume-bar {
                    width: 3px;
                    height: 8px;
                    background: rgba(255, 122, 0, 0.3);
                    border-radius: 1.5px;
                    transition: all 0.1s ease;
                    transform-origin: center bottom;
                }

                .volume-bar.active {
                    background: linear-gradient(135deg, #FF7A00, #ff9500);
                    box-shadow: 0 0 8px rgba(255, 122, 0, 0.6);
                    animation: volumePulse 0.2s ease;
                }

                @keyframes volumePulse {
                    0% { transform: scaleY(1); }
                    50% { transform: scaleY(1.2); }
                    100% { transform: scaleY(1); }
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

                .stop-button:hover:not(:disabled) {
                    background: rgba(255, 55, 66, 1);
                    transform: scale(1.05);
                }

                .send-button {
                    background: rgba(46, 213, 115, 0.9);
                }

                .send-button:hover:not(:disabled) {
                    background: rgba(38, 208, 104, 1);
                    transform: scale(1.05);
                }

                .send-button.active {
                    opacity: 1 !important;
                    pointer-events: auto !important;
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
                    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
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
                    transition: all 0.3s ease;
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

                .message-bubble:hover {
                    transform: translateY(-1px);
                    box-shadow: 
                        0 6px 20px rgba(0, 0, 0, 0.12),
                        0 2px 8px rgba(0, 0, 0, 0.08);
                }

                .message-text {
                    display: inline-block;
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
                    transition: opacity 0.3s ease;
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
                    display: none !important;
                }

                .typing-indicator .message-bubble {
                    padding: 16px 20px;
                    min-width: 80px;
                }

                .typing-dots {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .typing-dot {
                    width: 8px;
                    height: 8px;
                    background: rgba(29, 29, 31, 0.6);
                    border-radius: 50%;
                    animation: typingDot 1.4s ease-in-out infinite;
                }

                .typing-dot:nth-child(1) { animation-delay: 0s; }
                .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .typing-dot:nth-child(3) { animation-delay: 0.4s; }

                @keyframes typingDot {
                    0%, 60%, 100% {
                        transform: scale(1);
                        opacity: 0.5;
                    }
                    30% {
                        transform: scale(1.3);
                        opacity: 1;
                    }
                }

                .message-preview {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    border-radius: 18px;
                    padding: 16px;
                    margin-bottom: 16px;
                    border: 2px solid rgba(255, 122, 0, 0.3);
                    animation: slideInUp 0.3s ease-out;
                }

                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .preview-text {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .preview-label {
                    font-size: 12px;
                    color: rgba(29, 29, 31, 0.6);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .preview-content {
                    font-size: 16px;
                    color: #1d1d1f;
                    font-weight: 500;
                    font-style: italic;
                }

                .preview-duration {
                    font-size: 18px;
                    color: #FF7A00;
                    font-weight: 700;
                }

                .preview-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .preview-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .cancel-preview {
                    background: rgba(255, 71, 87, 0.1);
                    color: #FF4757;
                }

                .cancel-preview:hover {
                    background: rgba(255, 71, 87, 0.2);
                    transform: scale(1.05);
                }

                .send-preview {
                    background: rgba(46, 213, 115, 0.9);
                    color: white;
                }

                .send-preview:hover {
                    background: rgba(38, 208, 104, 1);
                    transform: scale(1.05);
                }

                .preview-icon {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }

                .error-message {
                    margin: 16px 0;
                    animation: slideIn 0.3s ease-out;
                    transition: all 0.3s ease;
                }

                .error-container {
                    background: rgba(255, 71, 87, 0.1);
                    border: 2px solid rgba(255, 71, 87, 0.3);
                    border-radius: 16px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    text-align: center;
                }

                .error-icon {
                    font-size: 32px;
                    line-height: 1;
                }

                .error-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .error-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #FF4757;
                }

                .error-description {
                    font-size: 14px;
                    color: rgba(29, 29, 31, 0.7);
                }

                .retry-button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: rgba(255, 122, 0, 0.9);
                    color: white;
                    border: none;
                    border-radius: 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin-top: 8px;
                }

                .retry-button:hover {
                    background: rgba(255, 122, 0, 1);
                    transform: scale(1.05);
                    box-shadow: 0 4px 16px rgba(255, 122, 0, 0.3);
                }

                .retry-icon {
                    width: 18px;
                    height: 18px;
                    fill: currentColor;
                }

                .permission-guide {
                    margin: 16px 0;
                    animation: slideIn 0.3s ease-out;
                }

                .guide-container {
                    background: rgba(255, 255, 255, 0.95);
                    border: 2px solid rgba(255, 122, 0, 0.3);
                    border-radius: 16px;
                    padding: 20px;
                }

                .guide-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    justify-content: center;
                }

                .guide-icon {
                    font-size: 24px;
                }

                .guide-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1d1d1f;
                }

                .guide-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .guide-step {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px;
                    background: rgba(255, 122, 0, 0.05);
                    border-radius: 8px;
                }

                .step-number {
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(135deg, #FF7A00, #e66800);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 700;
                    flex-shrink: 0;
                }

                .step-text {
                    font-size: 14px;
                    color: #1d1d1f;
                    line-height: 1.4;
                }

                .guide-button {
                    width: 100%;
                    padding: 12px;
                    background: linear-gradient(135deg, #FF7A00, #e66800);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .guide-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(255, 122, 0, 0.3);
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
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

                    .volume-indicator {
                        margin: 0 8px;
                    }
                    
                    .volume-bar {
                        width: 2px;
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
                        <div class="volume-indicator" id="volumeIndicator">
                            <div class="volume-bar"></div>
                            <div class="volume-bar"></div>
                            <div class="volume-bar"></div>
                            <div class="volume-bar"></div>
                            <div class="volume-bar"></div>
                        </div>
                        <div class="timer" id="timer">0:00</div>
                    </div>
                    <div class="control-buttons">
                        <button class="control-button stop-button" id="stopButton" title="Отменить запись">
                            <svg class="button-icon" viewBox="0 0 24 24">
                                <rect x="6" y="6" width="12" height="12" rx="2"/>
                            </svg>
                        </button>
                        <button class="control-button send-button" id="sendButton" title="Отправить голосовое сообщение">
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
                        <div class="empty-state-text">Нажмите кнопку записи<br>чтобы начать диалог</div></div>
                    </div>
                </div>
                </div>
            </div>
        `;
    }
}
customElements.define('voice-widget', VoiceWidget);
