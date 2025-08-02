// ========================================
// 📁 voice-widget.js (НОВАЯ ВЕРСИЯ С МОДУЛЯМИ)
// ========================================

// 🔗 ИМПОРТЫ МОДУЛЕЙ
import { AudioRecorder } from './modules/audio-recorder.js';
import { UnderstandingManager } from './modules/understanding-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { APIClient } from './modules/api-client.js';
import { EventManager } from './modules/event-manager.js';

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
        
        // SessionId это для контекста диалогов
        this.sessionId = this.getOrCreateSessionId();
        
        // Configurable parameters
        this.apiUrl = this.getAttribute('api-url') || 'https://voice-widget-backend-production.up.railway.app/api/audio/upload';
        this.fieldName = this.getAttribute('field-name') || 'audio';
        this.responseField = this.getAttribute('response-field') || 'response';
        
        // 🔥 ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
        this.events = new EventManager();
        this.audioRecorder = new AudioRecorder(this);
        this.understanding = new UnderstandingManager(this);
        this.ui = new UIManager(this);
        this.api = new APIClient(this);
        
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
        this.ui.initializeUI();
        this.api.loadSessionInfo();
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
    min-height: auto;
    position: relative;
}

                .widget-container {
                    display: flex;
                    height: 90vh;
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

                /* 🆕 VOICE BUTTON - обновленные стили с disabled состоянием */
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

                .voice-button:not(:disabled):hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
                }

                .voice-button:disabled {
                    background: rgba(255, 255, 255, 0.1);
                    opacity: 0.5;
                    cursor: default !important;
                    box-shadow: none;
                }

                .voice-button:disabled .input-icon {
                    fill: rgba(255, 255, 255, 0.4);
                }

                /* 🆕 SEND TEXT BUTTON - обновленные стили с disabled состоянием */
                .send-text-button {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8B5CF6, #A855F7);
                    border: none;
                    cursor: pointer;
                    display: flex; /* 🔥 Изменено: всегда видима */
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                }

                .send-text-button:not(:disabled):hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
                }

                .send-text-button:disabled {
                    background: rgba(255, 255, 255, 0.1);
                    opacity: 0.5;
                    cursor: default !important;
                    box-shadow: none;
                }

                .send-text-button:disabled .input-icon {
                    fill: rgba(255, 255, 255, 0.4);
                }

                .input-icon {
                    width: 20px;
                    height: 20px;
                    fill: white;
                    transition: fill 0.2s ease;
                }

                /* 🆕 ФУНКЦИОНАЛЬНЫЕ КНОПКИ В INPUT AREA */
                .function-buttons-input {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-start; /* 🔄 смещаем влево */
                }

                .function-btn-input {
                    background: transparent;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 10px; /* 👈 уменьшенный padding */
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-family: inherit;
                    /* удаляем растягивание */
                    flex: none;
                    justify-content: flex-start;
                }

                .function-btn-input:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.25);
                    transform: translateY(-1px);
                }

                .function-btn-input svg {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
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

                /* RIGHT PANEL - UNDERSTANDING (🔥 ОБНОВЛЕННАЯ СТРУКТУРА) */
                .understanding-panel {
                    width: 340px;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 60px 20px 20px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                /* JARVIS SPHERE (КОМПАКТНЫЙ) */
                .jarvis-container {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 12px;
                    flex-shrink: 0;
                }

                .jarvis-sphere {
                    width: 80px;
                    height: 80px;
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
                        0 0 30px rgba(147, 51, 234, 0.3),
                        inset 0 0 30px rgba(255, 255, 255, 0.1);
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
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: white;
                    opacity: 0.9;
                    animation: jarvis-pulse 1.5s ease-in-out infinite;
                }

                @keyframes jarvis-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.1); opacity: 1; }
                }

                /* UNDERSTANDING PROGRESS (ФИКСИРОВАННЫЙ) */
                .understanding-section {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 16px;
                    margin-bottom: 12px;
                    flex-shrink: 0;
                }

                .section-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 12px;
                }

                .progress-container {
                    margin-bottom: 0;
                }

                .progress-bar {
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 6px;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4ade80, #22c55e);
                    border-radius: 3px;
                    transition: width 0.5s ease;
                    width: 0%;
                }

                .progress-text {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                }

                /* 🔥 ACCORDION CONTAINER (СКРОЛЛИРУЕМЫЙ) */
                .accordion-container {
                    flex: 1;
                    overflow-y: auto;
                    padding-right: 4px;
                }

                .accordion-container::-webkit-scrollbar {
                    width: 4px;
                }

                .accordion-container::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }

                .accordion-container::-webkit-scrollbar-thumb {
                    background: rgba(147, 51, 234, 0.3);
                    border-radius: 2px;
                }

                /* 🔥 БАЗОВЫЕ СТИЛИ ДЛЯ БЛОКОВ */
                .info-block {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    margin-bottom: 12px;
                    overflow: hidden;
                }

                /* 🔥 СТАТИЧНЫЕ БЛОКИ (без аккордеона) */
                .static-block {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    margin-bottom: 12px;
                    overflow: hidden;
                }

                .static-header {
                    display: flex;
                    align-items: center;
                    padding: 16px 18px 12px 18px;
                    background: rgba(255, 255, 255, 0.02);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .static-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .static-content {
                    padding: 14px 18px 18px 18px;
                }

                /* 🔥 ACCORDION BLOCKS (только для "Детали и предпочтения") */
                .accordion-block {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    margin-bottom: 12px;
                    overflow: hidden;
                }

                .accordion-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 18px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                    background: rgba(255, 255, 255, 0.02);
                }

                .accordion-header:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .accordion-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .accordion-arrow {
                    width: 0;
                    height: 0;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 6px solid rgba(255, 255, 255, 0.6);
                    transition: transform 0.3s ease;
                    flex-shrink: 0;
                }

                .accordion-block.open .accordion-arrow {
                    transform: rotate(180deg);
                }

                .accordion-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .accordion-block.open .accordion-content {
                    max-height: 220px;
                }

                .accordion-content-inner {
                    padding: 0 18px 18px 18px;
                }

                .block-icon {
                    width: 14px;
                    height: 14px;
                    opacity: 0.8;
                    flex-shrink: 0;
                }

                .understanding-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .understanding-item:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }

                .item-indicator {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.3);
                    flex-shrink: 0;
                }

                .item-indicator.filled {
                    background: #4ade80;
                }

                .item-text {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.85);
                    flex: 1;
                    min-width: 0;
                    font-weight: 500;
                }

                .item-value {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.65);
                    font-style: italic;
                    text-align: right;
                    flex-shrink: 0;
                    max-width: 120px;
                    word-wrap: break-word;
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
                        .chat-response {
                    background: linear-gradient(145deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
                    padding: 20px;
                    border-radius: 14px;
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                    color: #eaeaea;
                    line-height: 1.75;
                    font-size: 16px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    .chat-response h1,
                    .chat-response h2,
                    .chat-response h3 {
                    margin: 24px 0 12px;
                    color: #ffb347;
                    font-weight: 700;
                    line-height: 1.3;
                    }

                    .chat-response h1 {
                    font-size: 24px;
                    }
                    .chat-response h2 {
                    font-size: 20px;
                    }
                    .chat-response h3 {
                    font-size: 18px;
                    }

                    .chat-response p {
                    margin: 12px 0;
                    }

                    .chat-response ul,
                    .chat-response ol {
                    margin: 14px 0;
                    padding-left: 22px;
                    }

                    .chat-response li {
                    margin: 6px 0;
                    }

                    .chat-response code {
                    background-color: rgba(255, 255, 255, 0.08);
                    padding: 3px 6px;
                    border-radius: 6px;
                    font-family: 'Fira Code', monospace;
                    font-size: 15px;
                    color: #ffdca8;
                    }

                    .chat-response pre {
                    margin: 16px 0;
                    }

                    .chat-response pre code {
                    display: block;
                    padding: 16px;
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 10px;
                    overflow-x: auto;
                    font-family: 'Fira Code', monospace;
                    font-size: 14px;
                    color: #aaffdd;
                    }

                    .chat-response blockquote {
                    margin: 16px 0;
                    padding: 12px 18px;
                    border-left: 4px solid #ffa94d;
                    background: rgba(255, 255, 255, 0.03);
                    color: #cccccc;
                    font-style: italic;
                    border-radius: 6px;
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

                    .function-buttons-input {
                        display: none;
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

                       <!-- 🆕 ФУНКЦИОНАЛЬНЫЕ КНОПКИ ПЕРЕНЕСЕНЫ СЮДА -->
                       <div class="function-buttons-input">
                           <button class="function-btn-input" id="imageBtn">
                               <svg viewBox="0 0 24 24">
                                   <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                               </svg>
                               Изображения
                           </button>
                           
                           <button class="function-btn-input" id="documentBtn">
                               <svg viewBox="0 0 24 24">
                                   <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                               </svg>
                               Документы
                           </button>
                           
                           <button class="function-btn-input" id="pdfBtn">
                               <svg viewBox="0 0 24 24">
                                   <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                               </svg>
                               Скачать PDF
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

               <!-- RIGHT PANEL - UNDERSTANDING (🔥 ОБНОВЛЕННАЯ СТРУКТУРА БЕЗ ACCORDION) -->
               <div class="understanding-panel">
                   <!-- UNDERSTANDING PROGRESS (перемещен наверх) -->
                   <div class="understanding-section">
                       <div class="section-title">Понимание запроса</div>
                       <div class="progress-container">
                           <div class="progress-bar">
                               <div class="progress-fill" id="progressFill"></div>
                           </div>
                           <div class="progress-text" id="progressText">0% - Ожидание</div>
                       </div>
                   </div>

                   <!-- JARVIS SPHERE (перемещена под прогресс) -->
                   <div class="jarvis-container">
                       <div class="jarvis-sphere">
                           <div class="jarvis-core"></div>
                       </div>
                   </div>

                   <!-- ACCORDION CONTAINER (обновленная структура) -->
                   <div class="accordion-container">
                       <!-- СТАТИЧНЫЙ БЛОК 1: ОСНОВНАЯ ИНФОРМАЦИЯ (БЕЗ ACCORDION) -->
                       <div class="static-block">
                           <div class="static-header">
                               <div class="static-title">
                                   <svg class="block-icon" viewBox="0 0 24 24" fill="currentColor">
                                       <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                   </svg>
                                   Основная информация
                               </div>
                           </div>
                           <div class="static-content">
                               <div class="understanding-item">
                                   <div class="item-indicator" id="nameIndicator"></div>
                                   <div class="item-text">Имя клиента</div>
                                   <div class="item-value" id="nameValue">не определено</div>
                               </div>
                               <div class="understanding-item">
                                   <div class="item-indicator" id="operationIndicator"></div>
                                   <div class="item-text">Тип операции</div>
                                   <div class="item-value" id="operationValue">не определена</div>
                               </div>
                               <div class="understanding-item">
                                   <div class="item-indicator" id="budgetIndicator"></div>
                                   <div class="item-text">Бюджет</div>
                                   <div class="item-value" id="budgetValue">не определен</div>
                               </div>
                           </div>
                       </div>

                       <!-- СТАТИЧНЫЙ БЛОК 2: ПАРАМЕТРЫ НЕДВИЖИМОСТИ (БЕЗ ACCORDION) -->
                       <div class="static-block">
                           <div class="static-header">
                               <div class="static-title">
                                   <svg class="block-icon" viewBox="0 0 24 24" fill="currentColor">
                                       <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                                   </svg>
                                   Параметры недвижимости
                               </div>
                           </div>
                           <div class="static-content">
                               <div class="understanding-item">
                                   <div class="item-indicator" id="typeIndicator"></div>
                                   <div class="item-text">Тип недвижимости</div>
                                   <div class="item-value" id="typeValue">не определен</div>
                               </div>
                               <div class="understanding-item">
                                   <div class="item-indicator" id="locationIndicator"></div>
                                   <div class="item-text">Город/район</div>
                                   <div class="item-value" id="locationValue">не определен</div>
                               </div>
                               <div class="understanding-item">
                                   <div class="item-indicator" id="roomsIndicator"></div>
                                   <div class="item-text">Количество комнат</div>
                                   <div class="item-value" id="roomsValue">не определено</div>
                               </div>
                           </div>
                       </div>

                       <!-- ACCORDION БЛОК 3: ДЕТАЛИ И ПРЕДПОЧТЕНИЯ (ОСТАЕТСЯ С ACCORDION) -->
                       <div class="accordion-block">
                           <div class="accordion-header" data-accordion="details-preferences">
                               <div class="accordion-title">
                                   <svg class="block-icon" viewBox="0 0 24 24" fill="currentColor">
                                       <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                   </svg>
                                   Детали и предпочтения
                               </div>
                               <div class="accordion-arrow"></div>
                           </div>
                           <div class="accordion-content" id="accordion-details-preferences">
                               <div class="accordion-content-inner">
                                   <div class="understanding-item">
                                       <div class="item-indicator" id="areaIndicator"></div>
                                       <div class="item-text">Площадь</div>
                                       <div class="item-value" id="areaValue">не определена</div>
                                   </div>
                                   <div class="understanding-item">
                                       <div class="item-indicator" id="detailsIndicator"></div>
                                       <div class="item-text">Детали локации</div>
                                       <div class="item-value" id="detailsValue">не определены</div>
                                   </div>
                                   <div class="understanding-item">
                                       <div class="item-indicator" id="preferencesIndicator"></div>
                                       <div class="item-text">Предпочтения</div>
                                       <div class="item-value" id="preferencesValue">не определены</div>
                                   </div>
                               </div>
                           </div>
                       </div>
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

        // Главные кнопки записи - ДЕЛЕГАЦИЯ К МОДУЛЯМ
        mainButton.addEventListener('click', () => {
            if (!this.audioRecorder.isRecording && !mainButton.disabled) {
                this.audioRecorder.startRecording();
            }
        });

        voiceButton.addEventListener('click', () => {
            if (!this.audioRecorder.isRecording && !voiceButton.disabled) {
                this.audioRecorder.startRecording();
            }
        });

        // Кнопки управления записью - ДЕЛЕГАЦИЯ К МОДУЛЯМ
        stopButton.addEventListener('click', () => {
            if (this.audioRecorder.isRecording) {
                this.audioRecorder.cancelRecording();
            }
        });

        sendButton.addEventListener('click', () => {
            if (this.audioRecorder.isRecording) {
                this.audioRecorder.finishAndSend();
            } else if (this.audioBlob && this.recordingTime >= this.minRecordingTime) {
                this.api.sendMessage();
            } else {
                this.ui.showWarning('⚠️ Сначала сделайте запись');
            }
        });

        // 🔥 ОБНОВЛЕННАЯ ЛОГИКА ТЕКСТОВОГО ВВОДА
        textInput.addEventListener('input', () => {
            const hasText = textInput.value.trim().length > 0;
            sendTextButton.disabled = !hasText;
            if (hasText) {
                sendTextButton.style.opacity = '1';
                sendTextButton.style.cursor = 'pointer';
            } else {
                sendTextButton.style.opacity = '0.5';
                sendTextButton.style.cursor = 'not-allowed';
            }
        });

        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.ui.isMobile()) {
                e.preventDefault();
                if (textInput.value.trim() && !sendTextButton.disabled) {
                    this.api.sendTextMessage();
                }
            }
        });

        sendTextButton.addEventListener('click', () => {
            if (textInput.value.trim() && !sendTextButton.disabled) {
                this.api.sendTextMessage();
            }
        });

        // Функциональные кнопки - ДЕЛЕГАЦИЯ К UI МОДУЛЮ
        this.ui.bindFunctionButtons();
        
        // 🔥 Только для третьего блока "Детали и предпочтения" - ДЕЛЕГАЦИЯ К UI МОДУЛЮ
        this.ui.bindAccordionEvents();
    }

    // Простые методы утилиты, которые не требуют модулей
    cleanupAfterSend() {
        this.audioRecorder.cleanupAfterSend();
    }

    // 🔥 ОБНОВЛЕННЫЕ ПУБЛИЧНЫЕ МЕТОДЫ с логикой кнопок - ВСЕ ДЕЛЕГАЦИИ К МОДУЛЯМ
    clearSession() {
        localStorage.removeItem('voiceWidgetSessionId');
        this.sessionId = this.getOrCreateSessionId();
        
        const sessionDisplay = this.shadowRoot.getElementById('sessionDisplay');
        sessionDisplay.textContent = this.sessionId.slice(-8);
        
        this.understanding.reset();
        this.ui.clearMessages();
        
        console.log('🗑️ Сессия очищена, создан новый sessionId:', this.sessionId);
    }

    getCurrentSessionId() {
        return this.sessionId;
    }

    setApiUrl(url) {
        this.apiUrl = url;
    }

    getMessages() {
        return [...this.messages];
    }

    isCurrentlyRecording() {
        return this.audioRecorder.isRecording;
    }

    setUnderstanding(insights) {
        this.understanding.update(insights);
    }

    getUnderstanding() {
        return this.understanding.export();
    }

    resetUnderstanding() {
        this.understanding.reset();
    }

    disconnectedCallback() {
        if (this.audioRecorder) {
            this.audioRecorder.cleanupRecording();
        }
    }
}

// Регистрируем кастомный элемент
customElements.define('voice-widget', VoiceWidget);