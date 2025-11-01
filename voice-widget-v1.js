// ========================================
/* 📁 voice-widget.js (ОБНОВЛЁННАЯ ВЕРСИЯ) */
// ========================================

// Базовый путь для ассетов
const ASSETS_BASE = (() => {
  try {
    const fromWindow = typeof window !== 'undefined' ? window.__VW_ASSETS_BASE__ : '';
    const base = fromWindow || new URL('./assets/', import.meta.url).toString();
    return base.endsWith('/') ? base : base + '/';
  } catch (e) {
    // Fallback на относительный путь, если import.meta.url недоступен
    const base = 'assets/';
    return base;
  }
})();

import { AudioRecorder } from './modules/audio-recorder.js';
import { UnderstandingManager } from './modules/understanding-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { APIClient } from './modules/api-client.js';
import { EventManager } from './modules/event-manager.js';

class VoiceWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // базовые состояния
    this.isRecording = false;
    this.recordingTime = 0;
    this.maxRecordingTime = 30;
    this.minRecordingTime = 1;
    this.messages = [];
    this.mediaRecorder = null;
    this.stream = null;
    this.audioBlob = null;
    this.recordedChunks = [];

    // ⚠️ больше НЕ создаём id на фронте — читаем если сохранён, иначе null
    this.sessionId = this.getInitialSessionId();

    // параметры
    const attrApi = this.getAttribute('api-url') || 'https://voice-widget-backend-production.up.railway.app/api/audio/upload';
    const resolveApiUrl = (fallback) => {
      try {
        const fromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('vwApi') : null;
        const fromGlobal = typeof window !== 'undefined' ? window.__VW_API_URL__ : null;
        const fromStorage = (() => { try { return localStorage.getItem('vw_api_url'); } catch { return null; } })();
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocal = /^(localhost|127\.0\.0\.1|::1)$/i.test(host);
        if (fromQuery) return fromQuery;
        if (fromGlobal) return fromGlobal;
        if (fromStorage) return fromStorage;
        if (isLocal) return 'http://localhost:3001/api/audio/upload';
      } catch {}
      return fallback;
    };
    this.apiUrl = resolveApiUrl(attrApi);
    this.fieldName = this.getAttribute('field-name') || 'audio';
    this.responseField = this.getAttribute('response-field') || 'response';

    // модули
    this.events = new EventManager();
    this.audioRecorder = new AudioRecorder(this);
    this.understanding = new UnderstandingManager(this);
    this.ui = new UIManager(this);
    this.api = new APIClient(this);

    // i18n (lead form)
    this.leadI18n = this.buildLeadI18nDictionary();

    this.render();
    this.bindEvents();
    this.checkBrowserSupport();
    this.initializeUI();
  }

  // берем id из localStorage (если ранее выдал сервер); иначе null
  getInitialSessionId() {
    try {
      return (
        localStorage.getItem('vw_sessionId') ||
        localStorage.getItem('voiceWidgetSessionId') ||
        null
      );
    } catch {
      return null;
    }
  }

  // ---------- UI init ----------
  initializeUI() {
    this.ui.initializeUI();

    // единый ввод
    this.ui.bindUnifiedInputEvents();
    this.ui.bindFunctionButtons();
    this.ui.bindAccordionEvents();

    // грузим данные сессии только если id есть
    if (this.sessionId) {
      this.api.loadSessionInfo();
    }

    // Initialize understanding bar with 0%
    this.updateHeaderUnderstanding(0);

    // Initialize send buttons with disabled state
    const mainSendButton = this.shadowRoot.getElementById('mainSendButton');
    const sendButton = this.shadowRoot.getElementById('sendButton');
    if (mainSendButton) mainSendButton.setAttribute('aria-disabled', 'true');
    if (sendButton) sendButton.setAttribute('aria-disabled', 'true');

    console.log('✅ Voice Widget инициализирован');

    // v2 menu overlay init (after DOM is ready)
    try { this.setupMenuOverlay(); } catch {}

    // Применяем i18n к форме лида и кнопке
    this.applyLeadI18n();

    // Реакция на смену локали через localStorage
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === 'vw_lang') {
          this.applyLeadI18n();
          this.populateTimeSlots();
        }
      });
    } catch {}
  }

  checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const statusIndicator = this.shadowRoot.getElementById('statusIndicator');
      if (statusIndicator) statusIndicator.innerHTML = '<div class="status-text">❌ Браузер не поддерживает запись аудио</div>';
      const mainButton = this.shadowRoot.getElementById('mainButton');
      if (mainButton) {
        mainButton.disabled = true;
        mainButton.style.opacity = '0.5';
        mainButton.style.cursor = 'not-allowed';
      }
    }
  }

 // ---------- RENDER ----------
render() {
  this.shadowRoot.innerHTML = `
  <style>
  *, *::before, *::after { box-sizing: border-box; }

  /* Global button image sizing rule */
  .btn img, .btn svg, button img, button svg { 
    width:100%; height:100%; display:block; object-fit:contain;
  }

  /* launcher/scrim */
  .launcher{ position:fixed; right:20px; bottom:20px; width:60px; height:60px; border-radius:50%;
    border:none; cursor:pointer; z-index:10001; background:linear-gradient(135deg,#FF8A4C,#A855F7);
    box-shadow:0 10px 24px rgba(0,0,0,.18); display:flex; align-items:center; justify-content:center;
    transition:transform .15s ease, box-shadow .15s ease; }
  .launcher:hover{ transform:scale(1.05); box-shadow:0 14px 32px rgba(0,0,0,.22); }
  .launcher svg{ width:100%; height:100%; fill:#fff }
  .launcher img{ width:100%; height:100%; display:block; object-fit:contain; filter:brightness(0) invert(1); }
  :host(.open) .launcher{ display:none; }

  /* Scroll-to-bottom FAB */
  .scroll-bottom-btn{ position:fixed; right:20px; bottom:88px; width:48px; height:48px; border:none; border-radius:999px; cursor:pointer; display:flex; align-items:center; justify-content:center; background:linear-gradient(90deg,#8B5CF6 0%, #A855F7 100%); box-shadow:0 10px 24px rgba(168,85,247,.30); color:#fff; z-index:10002; opacity:0; pointer-events:none; transition:opacity .2s ease, transform .2s ease; }
  .scroll-bottom-btn.visible{ opacity:1; pointer-events:auto; }
  .scroll-bottom-btn:hover{ transform: translateY(-1px); }
  .scroll-bottom-btn .chevron{ width:14px; height:14px; border-right:2px solid #fff; border-bottom:2px solid #fff; transform: rotate(45deg); margin-top:-2px; }

  .scrim{ position:fixed; inset:0; background:rgba(0,0,0,.28); opacity:0; pointer-events:none; transition:opacity .2s ease; }
  :host(.open) .scrim{ opacity:1; pointer-events:auto; }

  /* виджет */
  .widget{ width:380px; height:720px; border-radius:20px; overflow:hidden; box-shadow:none;
    position:relative; transform-origin:bottom right; transition:opacity .2s ease, transform .2s ease;
    opacity:0; transform: translateY(8px) scale(.98); pointer-events:none; backdrop-filter:none; -webkit-backdrop-filter:none; }
  /* CLEANUP: remove legacy overlays to reveal v2 backgrounds */
  .widget::before{ content:none; }
  .widget::after{ content:none; }
  :host(.open) .widget{ opacity:1; transform:none; pointer-events:auto; }


  /* Content */
  .content{ display:flex; flex-direction:column; height:100%; padding:0; gap:0; position:relative; z-index:3; }

  /* Main Screen */
  .main-screen{ display:flex; flex-direction:column; height:100%; }
  .main-screen.hidden{ display:none; }
  /* v2 screens visibility */
  .dialog-screen.hidden{ display:none; }
  .context-screen.hidden{ display:none; }
  .request-screen.hidden{ display:none; }
  .support-screen.hidden{ display:none; }

  /* Chat */
  .thread{ display:flex; flex-direction:column; gap:12px; position:relative; z-index:1; min-height:0; }
  .message{ display:flex; }
  .message.user{ justify-content:flex-end; }
  .message.assistant{ justify-content:flex-start; }
  .bubble--full{ max-width:100%; width:100%; align-self:stretch; padding:5px; border-radius:16px; }
  .message.assistant .bubble--full{ border-bottom-left-radius:16px; }
  .message.user .bubble--full{ border-bottom-right-radius:16px; }

  /* Card screen message (full-bleed inside thread) */
  .card-screen{ width:100%; margin:0; padding:0; }
  .thread > .card-screen{ margin-top:-6px; margin-bottom:-6px; }
  .thread > .card-screen:first-child{ margin-top:0; }
  .thread > .card-screen:last-child{ margin-bottom:0; }
  .card-screen .cs{ background:#333333; color:#ffffff; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,.12); overflow:hidden; width:100%; }
  .card-screen .cs-image{ aspect-ratio:1/1; width:100%; display:flex; align-items:center; justify-content:center; background:repeating-linear-gradient(45deg,#e9e9e9,#e9e9e9 12px,#f5f5f5 12px,#f5f5f5 24px); color:#8a8a8a; font-weight:600; letter-spacing:.2px; }
  .card-screen .cs-image img{ width:100%; height:100%; object-fit:cover; display:block; }
  .card-screen .cs-body{ padding:8px; display:grid; gap:8px; }
  .card-screen .cs-row{ display:flex; justify-content:space-between; gap:12px; }
  .card-screen .cs-title{ font-weight:700; color:#ffffff; }
  .card-screen .cs-sub{ font-size:12px; color:#BBBBBB; }
  .card-screen .cs-price{ font-weight:700; color:#FF8A4C; }
  

  /* Compact markdown styles inside assistant bubbles */
  .vw-md { line-height:1.5; }
  .vw-md > :first-child { margin-top: 0 !important; }
  .vw-md > :last-child { margin-bottom: 0 !important; }
  .vw-md p { margin: 0 0 8px; }
  .vw-md h1, .vw-md h2, .vw-md h3, .vw-md h4, .vw-md h5, .vw-md h6 { margin: 8px 0 6px; line-height:1.2; }
  .vw-md ul, .vw-md ol { margin: 2px 0 6px 0; padding-left: 16px; }
  .vw-md p + ul, .vw-md p + ol,
  .vw-md h1 + ul, .vw-md h2 + ul, .vw-md h3 + ul, .vw-md h4 + ul, .vw-md h5 + ul, .vw-md h6 + ul,
  .vw-md h1 + ol, .vw-md h2 + ol, .vw-md h3 + ol, .vw-md h4 + ol, .vw-md h5 + ol, .vw-md h6 + ol { margin-top: 4px; }
  .vw-md li { margin: 2px 0; }
  .vw-md blockquote { margin: 6px 0 8px; padding: 6px 10px; border-left: 2px solid rgba(255,255,255,.25); background: rgba(255,255,255,.06); border-radius: 8px; }
  .vw-md code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: rgba(0,0,0,.25); padding: 1px 4px; border-radius: 4px; }
  .vw-md pre { background: rgba(0,0,0,.25); padding: 10px 12px; border-radius: 10px; overflow:auto; }
  .vw-md pre code { background: transparent; padding: 0; }

  /* Links — мягкий цвет и подчёркивание */
  .vw-md a { color: #C4B5FD; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: rgba(196,181,253,.6); }
  .vw-md a:hover { color: #DDD6FE; text-decoration-color: rgba(221,214,254,.9); }
  .vw-md a:visited { color: #BFA8FD; }

  /* Highlight (не ссылка) */
  .vw-md mark, .vw-md .highlight { background: rgba(167, 139, 250, 0.28); color: inherit; padding: 0 2px; border-radius: 3px; }
  /* Ссылки, используемые как подсветка (например href="#...") — делаем как highlight и отключаем клики */
  .vw-md a[href^="#"] { background: rgba(167, 139, 250, 0.28); color: inherit; text-decoration: none; pointer-events: none; cursor: default; border-radius: 3px; padding: 0 2px; }

  /* ===== СТАРЫЕ СТИЛИ УДАЛЕНЫ, ОСТАЛСЯ ЛИШЬ СКЕЛЕТ ===== */

  /* Property Card */
  .property-card{ background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.12); margin-top:8px; width:100%; }
  .card-image{ width:100%; height:200px; background-size:cover; background-position:center; background-color:#f5f5f5; }
  .card-content{ padding:16px; }
  .card-title{ font-weight:700; font-size:var(--fs-body); color:var(--txt); margin-bottom:4px; }
  .card-location{ font-size:var(--fs-meta); color:var(--muted); margin-bottom:8px; }
  .card-price{ font-weight:600; font-size:var(--fs-body); color:var(--orange); margin-bottom:16px; }
  .card-actions{ display:flex; gap:12px; }
  .card-btn{ flex:1; height:40px; border:none; border-radius:12px; cursor:pointer; font-weight:600; font-size:var(--fs-button); transition:transform .12s ease; }
  .card-btn:hover{ transform:translateY(-1px); }
  .card-btn.like{ background:linear-gradient(135deg,#FF8A4C,#FFA66E); color:#fff; }
  .card-btn.next{ background:rgba(255,255,255,.9); color:var(--txt); border:1px solid rgba(0,0,0,.1); }

  /* Card mock inside assistant message */
  .card-mock{ background:#fff; color:#2b2b2b; border-radius:14px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.12); width:100%; }
  .card-mock .cm-image{ height: 220px; display:flex; align-items:center; justify-content:center; background:repeating-linear-gradient(45deg, #e9e9e9, #e9e9e9 12px, #f5f5f5 12px, #f5f5f5 24px); color:#8a8a8a; font-weight:600; letter-spacing:.2px; }
  .card-mock .cm-body{ padding:5px; display:grid; gap:8px; }
  .card-mock .cm-row{ display:flex; justify-content:space-between; gap:12px; }
  .card-mock .cm-title{ font-weight:700; color:#2b2b2b; }
  .card-mock .cm-sub{ font-size:12px; color:#666; }
  .card-mock .cm-price{ font-weight:700; color:#FF8A4C; }
  .card-actions-panel{ margin-top:8px; display:flex; gap:16px; align-items:center; }
  .card-actions-panel .card-btn{ flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; font-size:12px; height:36px; }
  /* like → как .btn-back */
  .card-actions-panel .card-btn.like{ height:36px; padding:0 18px; border:none; border-radius:12px; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s ease; background:rgba(51,51,51,.8); color:#fff; border:1px solid transparent; }
  .card-actions-panel .card-btn.like::before{ content:''; position:absolute; inset:0; border-radius:12px; padding:1px; background:conic-gradient(from 0deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 81%,#300E7E 100%); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude; pointer-events:none; }
  .card-actions-panel .card-btn.like{ position:relative; }
  .card-actions-panel .card-btn.like:hover{ background:#646464; transform:translateY(-1px); }
  /* next → как .btn-refresh (текстовая) */
  .card-actions-panel .card-btn.next{ background:transparent; color:#BBBBBB; padding:0; border:none; height:36px; font-weight:600; font-size:12px; }
  .card-actions-panel .card-btn.next:hover{ color:#ffffff; }

  /* ===== Inline Lead Bubbles ===== */

  /* Input */
  .input-container{ display:flex; gap:12px; align-items:center; padding:16px; width:360px; height:60px; background:rgba(51,51,51,.7); border-radius:20px; border:1px solid transparent; background-clip:padding-box; position:relative; box-shadow:0 8px 24px rgba(0,0,0,.10); }
  .input-container::before{ content:''; position:absolute; inset:0; border-radius:20px; padding:1px; pointer-events:none; z-index:0;
    background:conic-gradient(from 0deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 81%,#300E7E 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor; mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude; }
  
  /* v2 input: скрываем плейсхолдер во время записи */
  .text-input-wrapper.recording .input-field::placeholder { opacity:0; color:transparent; }
  .text-input-wrapper{ flex:1; position:relative; display:flex; align-items:center; }

  /* Индикатор записи рендерим там же, где плейсхолдер */
  .recording-indicator{
    position:absolute; left:10px; right:auto; top:50%; bottom:auto;
    transform:translateY(-50%);
    display:flex; align-items:center; gap:6px; background:transparent; pointer-events:none;
    height:auto; padding:0;
  }
  .recording-label{ color:#A0A0A0; font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; font-weight:400; letter-spacing:0; opacity:1; }
  @keyframes shake{ 0%,100%{ transform:translateX(0); } 10%,30%,50%,70%,90%{ transform:translateX(-2px); } 20%,40%,60%,80%{ transform:translateX(2px); } }
  .shake{ animation:shake .5s ease-in-out; }
  .record-timer{ color:#A0A0A0; font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; font-weight:400; letter-spacing:0; min-width:42px; text-align:left; }

  

  .loading{ position:absolute; display:none; align-items:center; justify-content:center; background: rgba(53,67,96,0.10); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius:20px; z-index:2; pointer-events:none; }
  .loading.active{ display:flex; }
  .loading-text{ color:#ffffff; font-size:16px; font-weight:400; font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; display:flex; align-items:center; gap:4px; }
  .loading-text .dots{ display:inline-flex; gap:2px; margin-left:2px; }
  .loading-text .dots span{ display:inline-block; opacity:.2; animation:dotBlink 1.2s infinite ease-in-out; }
  .loading-text .dots .d1{ animation-delay:0s; }
  .loading-text .dots .d2{ animation-delay:.15s; }
  .loading-text .dots .d3{ animation-delay:.3s; }
  @keyframes dotBlink{ 0%,100%{ opacity:.2; transform:translateY(0); } 50%{ opacity:1; transform:translateY(-2px); } }

  /* ===== УДАЛЕНО: старая overlay lead‑форма v1 (.lead-panel/.lead-box и т.д.).
     Важно: inline lead поток (renderInlineLeadStep) ранее использовал классы .lead-box/.lead-input/.lead-select/.lead-textarea.
     В v2 нужна новая реализация под requestScreen (экраны и логика уже есть). Эти стили будут переосмыслены при необходимости. ===== */

  /* ===== Responsive & Mobile polish (deleted) ===== */



 

  /* === V2 styles appended (cascade override) === */
                /* Основные стили виджета */
                :host {
                    display: block;
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                }
                
                .voice-widget-container {
                    width: 380px;
                    height: 720px;
                    background: #171618;
                    background-image: url('./assets/Net_lights.svg');
                    background-repeat: no-repeat;
                    background-position: center;
                    background-size: cover;
                    border-radius: 20px;
                    position: relative;
                    overflow: hidden;
                }
                
                /* Логотип */
                .logo {
                    position: absolute;
                    top: 35px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: auto;
                    height: auto;
                }
                
                /* Декоративная градиентная линия */
                .gradient-line {
                    position: absolute;
                    top: 85px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0) 100%);
                }
                
                /* Кнопка микрофона */
                .mic-button {
                    position: absolute;
                    top: 225px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 100px;
                    height: 100px;
                    background: transparent; /* remove default button bg */
                    border: none;            /* remove default button border */
                    padding: 0;              /* collapse inner spacing */
                    outline: none;           /* remove default focus ring */
                    -webkit-tap-highlight-color: transparent; /* remove iOS highlight */
                    cursor: pointer;
                    transition: transform 0.3s ease;
                }
                
                .mic-button img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                
                .mic-button:hover {
                    transform: translateX(-50%) scale(1.05);
                }
                .mic-button:focus, .mic-button:focus-visible { outline: none; box-shadow: none; }
                .mic-button::-moz-focus-inner { border: 0; }
                
                /* Тексты под кнопкой */
                .text-container {
                    position: absolute;
                    top: 350px;
                    left: 50%;
                    transform: translateX(-50%);
                    text-align: center;
                }
                
                .main-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-weight: 600;
                    font-size: 20px;
                    color: #FFFFFF;
                    margin: 0;
                    line-height: 1.2;
                }
                
                .sub-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-weight: 300;
                    font-size: 14px;
                    color: #A0A0A0;
                    margin: 20px 0 0 0;
                    line-height: 1.2;
                }
                
                /* Поле ввода */
                .input-container {
                    position: absolute;
                    bottom: 25px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 360px;
                    height: 60px;
                    background: rgba(43, 39, 44, 0.6);
                    border: 1px solid transparent;
                    border-radius: 40px;
                    display: flex;
                    align-items: center;
                    padding: 0 10px;
                    box-sizing: border-box;
                }
                
                .input-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    border-radius: 40px;
                    padding: 1px;
                    background: linear-gradient(90deg, #5C7FE2 0%, #F05A4F 33%, #EDA136 66%, #1C7755 100%);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask-composite: exclude;
                    -webkit-mask-composite: xor;
                }
                
                .input-field {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px;
                    font-weight: 400;
                    padding: 0 10px;
                }
                
                .input-field::placeholder {
                    color: #A0A0A0;
                }
                
                .input-buttons {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                
                .input-btn {
                    width: 38px;
                    height: 38px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.3s ease;
                    position: relative;
                    z-index: 1;
                }
                
                .input-btn:hover {
                    opacity: 0.7;
                }
                
                .input-btn svg {
                    width: 38px;
                    height: 38px;
                    fill: #FFFFFF;
                }
                .input-btn img {
                    width: 38px;
                    height: 38px;
                    display: block;
                }
                
                /* Стили для заглушек экранов */
                .screen-label {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    background: rgba(255, 255, 255, 0.1);
                    color: #FFFFFF;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 500;
                    z-index: 10;
                }
                
                .placeholder-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #FFFFFF;
                }
                
                .placeholder-content h3 {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 24px;
                    font-weight: 600;
                    margin: 0 0 16px 0;
                }
                
                .placeholder-content p {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px;
                    font-weight: 400;
                    color: #A0A0A0;
                    margin: 0;
                }
                
                /* Стили для Dialog Screen */
                .menu-button {
                    position: absolute;
                    top: 35px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10; /* поверх overlay */
                }
                .menu-button img { transition: transform 0.15s ease, opacity 0.15s ease; }
                .menu-button:hover img { transform: scale(1.08); opacity: 0.85; }
                /* При открытом меню центрируем кнопку по вертикали в зоне overlay (100px, padding-top 15px => центр на 50px) */
                .menu-button.menu-open {
                    top: 50px;
                    transform: translate(-50%, -50%);
                }
                /* Close button inside grid (center column) */
                .menu-close-btn{ width:40px; height:40px; background:transparent; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:100px; transition: background .15s ease, transform .15s ease; }
                .menu-close-btn:hover{ background: rgba(255,255,255,.10); }
                .menu-close-btn:active{ transform: scale(.96); }
                .menu-close-btn img{ width:40px; height:40px; display:block; border-radius:100px; }
                
                .dialogue-container {
                    position: absolute;
                    top: 85px;
                    left: 10px;
                    right: 10px;
                    width: 360px;
                    height: 540px;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: transparent;
                    overflow-y: auto;
                    padding: 20px;
                    box-sizing: border-box;
                }
                /* overlay sized to dialogue viewport */
                .dialog-overlay{ top:85px; left:10px; right:10px; height:540px; }
                /* v1-like thin scrollbar for dialogue container */
                .dialogue-container::-webkit-scrollbar{ width:2px; }
                .dialogue-container::-webkit-scrollbar-track{ background:transparent; }
                .dialogue-container::-webkit-scrollbar-thumb{ background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.5) 20%,rgba(100,100,100,.5) 80%,transparent 100%); border-radius:1px; }
                .dialogue-container::-webkit-scrollbar-thumb:hover{ background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.7) 20%,rgba(100,100,100,.7) 80%,transparent 100%); }
                .dialogue-container{ scrollbar-width:thin; scrollbar-color:rgba(100,100,100,.5) transparent; }
                
                .message-bubble {
                    border-radius: 10px;
                    padding: 10px;
                    margin-bottom: 16px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                    max-width: 97%;
                }
                
                .widget-bubble {
                    background: rgba(71, 106, 165, 0.5);
                    color: #FFFFFF;
                    margin-right: 20px;
                    margin-left: 0;
                }
                
                .user-bubble {
                    background: transparent;
                    border: 1px solid rgba(152, 152, 152, 0.5);
                    color: #FFFFFF;
                    margin-left: 20px;
                    margin-right: 0;
                    margin-left: auto;
                }
                
                /* Стили для Context Screen */
                .context-main-container {
                    position: absolute;
                    top: 135px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 360px;
                    text-align: center;
                }
                
                .progress-grid-container {
                    display: grid;
                    grid-template-columns: 1fr 100px 1fr;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .grid-column-left {
                    /* Пустая левая колонка */
                }
                
                .grid-column-center {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                
                .grid-column-right {
                    display: flex;
                    align-items: center;
                    padding-left: 20px;
                }
                
                .progress-ring {
                    position: relative;
                    width: 100px;
                    height: 100px;
                }
                
                .progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 18px;
                    font-weight: 400;
                    color: #FFFFFF;
                }
                
                .data-storage-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #A9A9A9;
                }
                
                .status-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #DF87F8;
                    margin-bottom: 20px;
                }
                
                .main-message {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 13px;
                    font-weight: 400;
                    color: #FFFFFF;
                    line-height: 1.4;
                    margin-bottom: 20px;
                }
                
                .context-gradient-line {
                    width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0.1) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0.1) 100%);
                    margin: 0 auto 10px auto;
                }
                
                .hint-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 200;
                    color: #a9a9a9;
                    line-height: 1.4;
                    margin-bottom: 25px;
                }
                
                .context-leave-request-button {
                    text-align: center;
                }
                
                .context-leave-request-btn {
                    width: 110px;
                    height: 25px;
                    background: #476AA5;
                    border: none;
                    border-radius: 20px;
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    cursor: pointer;
                    transition: opacity 0.3s ease;
                }
                
                .context-leave-request-btn:hover {
                    opacity: 0.8;
                }
                
                .footer-text {
                    position: absolute;
                    bottom: 25px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #A9A9A9;
                    text-align: center;
                }
                
                /* Декоративная линия для ContextScreen */
                .context-gradient-line {
                    width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0.1) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0.1) 100%);
                    margin-bottom: 10px;
                }
                
                /* ========================= */
                /*        Support Screen     */
                /* ========================= */
                .support-main-container {
                    position: absolute;
                    top: 110px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% - 50px);
                }
                
                .support-faq-title {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px;
                    font-weight: 400;
                    color: #EDCF23;
                    text-align: left;
                }
                
                .support-faq-list {
                    margin-top: 15px;
                }
                
                .support-faq-item {
                    margin-bottom: 20px;
                }
                
                .support-faq-question {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px;
                    font-weight: 400;
                    color: #FFFFFF;
                }
                
                .support-faq-question::before {
                    content: '▸';
                    color: #FFFFFF;
                    line-height: 1;
                    transform: translateY(1px);
                }
                
                .support-faq-answer {
                    margin-top: 6px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 13px;
                    font-weight: 300;
                    color: #C3C3C3;
                }
                
                .support-gradient-line {
                    width: 100%;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0.1) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0.1) 100%);
                    margin: 0 auto 10px auto;
                }
                
                .support-hint-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 100;
                    color: #FFFFFF;
                    line-height: 1.4;
                    text-align: center;
                }
                
                .support-contact-button {
                    text-align: center;
                }
                
                .support-contact-btn {
                    width: 110px;
                    height: 25px;
                    margin-top: 25px;
                    background: #EDCF23;
                    border: none;
                    border-radius: 20px;
                    color: #3B3B3B;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    cursor: pointer;
                    transition: opacity 0.3s ease;
                }
                
                .support-contact-btn:hover {
                    opacity: 0.9;
                }
                
                .support-footer-text {
                    position: absolute;
                    bottom: 25px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #A9A9A9;
                    text-align: center;
                }
                
                /* ========================= */
                /*        Request Screen     */
                /* ========================= */
                .request-main-container {
                    position: absolute;
                    top: 110px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% - 50px);
                }
                
                .request-title {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px;
                    font-weight: 400;
                    color: #FFFFFF;
                    margin-bottom: 15px;
                    text-align: left;
                }
                
                .request-field {
                    margin-bottom: 20px;
                }
                
                .request-field-label {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    color: #FFFFFF;
                    margin-bottom: 5px;
                }
                
                .request-input {
                    width: 100%;
                    height: 35px;
                    border-radius: 10px;
                    background: rgba(106, 108, 155, 0.10);
                    border: 1px solid rgba(106, 108, 155, 0.30);
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    padding-left: 10px;
                    line-height: 35px;
                    box-sizing: border-box;
                }
                
                .request-input::placeholder {
                    color: #A0A0A0;
                }
                
                .request-row {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                }
                
                .request-code-input {
                    width: 100px;
                    flex: 0 0 100px;
                }
                
                .request-phone-input {
                    flex: 1;
                }
                
                .request-select {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    height: 35px;
                    border-radius: 10px;
                    background: rgba(106, 108, 155, 0.10);
                    border: 1px solid rgba(106, 108, 155, 0.30);
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    padding: 0 10px;
                    box-sizing: border-box;
                }
                
                .request-caret {
                    color: #C4C4C4;
                    margin-left: 8px;
                }
                
                .request-textarea {
                    width: 100%;
                    min-height: 80px;
                    border-radius: 10px;
                    background: rgba(106, 108, 155, 0.10);
                    border: 1px solid rgba(106, 108, 155, 0.30);
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    padding: 10px;
                    resize: vertical;
                    box-sizing: border-box;
                }
                
                .request-textarea::placeholder {
                    color: #A0A0A0;
                }
                
                .request-actions-container {
                    width: 100%;
                    padding: 0 5px;
                    box-sizing: border-box;
                }
                
                .request-consent {
                    display: flex;
                    align-items: flex-start;
                }
                
                .request-checkbox {
                    width: 12px;
                    height: 12px;
                    margin-right: 10px;
                }
                
                .request-consent-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #C4C4C4;
                    line-height: 1.4;
                }
                
                .request-privacy-link {
                    color: #DF87F8;
                    text-decoration: none;
                }
                
                .request-buttons {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    margin-top: 20px;
                }
                
                .request-send-btn,
                .request-cancel-btn {
                    width: 150px;
                    height: 40px;
                    border-radius: 10px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 15px;
                    font-weight: 400;
                    cursor: pointer;
                }
                
                .request-send-btn {
                    background: #476AA5;
                    color: #FFFFFF;
                    border: none;
                }
                
                .request-cancel-btn {
                    background: transparent;
                    color: #FFFFFF;
                    border: 1px solid #476AA5;
                }
                
                /* ========================= */
                /*         Menu Overlay      */
                /* ========================= */
                .menu-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(0px);
                    -webkit-backdrop-filter: blur(0px);
                    transition: backdrop-filter 0.3s ease-in-out;
                    pointer-events: none;
                    z-index: 9;
                }
                .menu-overlay::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 20px;
                    background: linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, rgba(153,153,153,0.3) 100%);
                    opacity: 0;
                    transition: opacity 0.3s ease-in-out;
                    pointer-events: none;
                }
                .menu-overlay.open {
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    pointer-events: auto;
                }
                .menu-overlay.open::before {
                    opacity: 0.1;
                }
                .menu-overlay-content {
                    width: 300px;
                    height: 60px;
                    margin: 0 auto;
                    box-sizing: border-box;
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                    transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
                    position: relative;
                    z-index: 1;
                }
                .menu-overlay.open .menu-overlay-content {
                    opacity: 1;
                    visibility: visible;
                    pointer-events: auto;
                }
                .menu-grid {
                    display: grid;
                    grid-template-columns: 110px 80px 110px;
                    align-items: center;
                    justify-content: center;
                }
                .menu-grid--selected {
                    display: grid;
                    grid-template-columns: 110px 80px 110px;
                    align-items: center;
                    justify-content: center;
                    height: 60px;
                }
                .menu-col {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                .menu-col--single {
                    flex-direction: row;
                    gap: 0;
                }
                .menu-col--middle { width: 80px; }
                .menu-btn {
                    width: 110px;
                    height: 25px;
                    background: transparent;
                    border-radius: 20px;
                    border: 1px solid currentColor;
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    cursor: pointer;
                    transition: transform 0.15s ease, opacity 0.15s ease;
                }
                .menu-btn:hover { transform: scale(1.05); opacity: 0.85; }
                .menu-btn--request { color: #6A6C9B; }
                .menu-btn--support { color: #EDCF23; }
                .menu-btn--context { color: #E85F62; }
                .menu-btn--reset { color: #FFFFFF; }
                .menu-link {
                    width: 110px;
                    height: 25px;
                    border-radius: 20px;
                    background: transparent;
                    border: none;
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    cursor: pointer;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .menu-link:hover { opacity: 0.85; }
                .menu-badge {
                    width: 110px;
                    height: 25px;
                    border-radius: 20px;
                    border: 1px solid currentColor;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    color: currentColor;
                }
                .menu-badge--request { color: #6A6C9B; }
                .menu-badge--support { color: #EDCF23; }
                .menu-badge--context { color: #E85F62; }
  </style>

  <!-- COMPAT: v1 chat/details minimal support (do not remove until full v2 wiring) -->
  <style>
  /* COMPAT-V1: Чат — прокрутка контейнеров (v2: переносим на dialogue-container) */
  .dialogue-container{ overflow:auto; }
  .thread{ display:flex; flex-direction:column; }

  /* COMPAT-V1: Лоадер поверх чата */
  #loadingIndicator{ position:absolute; display:none; }
  #loadingIndicator.active{ display:flex; }

  /* COMPAT-V1: Панель лида */
  .lead-panel{ position:absolute; inset:0; display:none; }
  .lead-panel.active{ display:flex; }
  </style>

  <!-- Launcher -->
  <button class="launcher" id="launcher" title="Спросить голосом" aria-label="Спросить голосом">
    <img src="${ASSETS_BASE}MicBig.png" alt="Voice" />
  </button>

  <div class="scrim" id="scrim"></div>

  <div class="widget" role="dialog" aria-modal="true" aria-label="Voice Assistant">
    <!-- Header removed for v2 UI -->

    <!-- Content -->
    <div class="content">
      <!-- Main Screen -->
      <div class="main-screen" id="mainScreen">
        <div class="voice-widget-container">
            <img src="${ASSETS_BASE}LOGO.svg" alt="VIA.AI" class="logo">
            <div class="gradient-line"></div>
            <button class="mic-button" id="mainButton" aria-pressed="false">
                <img src="${ASSETS_BASE}MicBig.png" alt="Microphone" style="width: 100%; height: 100%;">
            </button>
            <div class="text-container">
                <p class="main-text">Press to speak</p>
                <p class="sub-text">Voice Intelligent Assistance</p>
        </div>
        <div class="input-container">
          <div class="text-input-wrapper">
                    <input id="mainTextInput" type="text" class="input-field" placeholder="Write your request...">
                    <div class="recording-indicator" id="mainRecordingIndicator" style="display:none;">
                        <div class="recording-label">Идёт запись</div>
              <div class="record-timer" id="mainRecordTimer">00:00</div>
            </div>
          </div>
                <div class="input-buttons">
                    <button class="input-btn" id="mainToggleButton" type="button" title="Говорить">
                        <img src="${ASSETS_BASE}mic_btn.svg" alt="Microphone">
                    </button>
                    <button class="input-btn" id="mainSendButton" type="button" title="Отправить">
                        <img src="${ASSETS_BASE}send_btn.svg" alt="Send">
                    </button>
                </div>
            </div>
        </div>
      </div>

      <!-- Dialogue Screen (v2) wired to v1 logic -->
      <div class="dialog-screen hidden" id="dialogScreen">
        <div class="voice-widget-container">
          <div class="menu-button">
            <img src="${ASSETS_BASE}menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
          </div>
          <div class="dialogue-container" id="messagesContainer">
              <div class="thread" id="thread"></div>
          <button class="scroll-bottom-btn" id="btnScrollBottom" title="Scroll to bottom" aria-label="Scroll to bottom"><span class="chevron"></span></button>
        </div>
          <div class="loading dialog-overlay" id="loadingIndicator"><span class="loading-text">Обрабатываю запрос <span class="dots"><span class="d1">•</span><span class="d2">•</span><span class="d3">•</span></span></span></div>
        <div class="input-container">
          <div class="text-input-wrapper">
              <input id="textInput" type="text" class="input-field" placeholder="Write your request...">
            <div class="recording-indicator" id="recordingIndicator" style="display: none;">
                <div class="recording-label">Идёт запись</div>
              <div class="record-timer" id="chatRecordTimer">00:00</div>
            </div>
          </div>
            <div class="input-buttons">
              <button class="input-btn" id="toggleButton" type="button" title="Говорить"><img src="${ASSETS_BASE}mic_btn.svg" alt="Microphone"></button>
              <button class="input-btn" id="sendButton" type="button" title="Отправить"><img src="${ASSETS_BASE}send_btn.svg" alt="Send"></button>
        </div>
      </div>
        </div>
          </div>


      <!-- Context Screen (v2) -->
      <div class="context-screen hidden" id="contextScreen">
        <div class="voice-widget-container">
          <div class="menu-button">
            <img src="${ASSETS_BASE}menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
              </div>
          <div class="context-main-container">
            <div class="progress-grid-container">
              <div class="grid-column-left"></div>
              <div class="grid-column-center">
                <div class="progress-ring">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255, 255, 255, 0.1)" stroke-width="12"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#E85F62" stroke-width="12" stroke-dasharray="276.46" stroke-dashoffset="2.76" stroke-linecap="round" transform="rotate(-90 50 50)"/>
                  </svg>
                  <div class="progress-text">99%</div>
            </div>
          </div>
              <div class="grid-column-right">
                <div class="data-storage-text">Data storage & encrypting</div>
          </div>
            </div>
            <div class="status-text">Status: fulfilled</div>
            <div class="main-message">Well done! You've fulfilled the system with the data that will make search much closer to your goal!</div>
            <div class="context-gradient-line"></div>
            <div class="hint-text">You can leave the request to make manager start working by your case immediately</div>
            <div class="context-leave-request-button"><button class="context-leave-request-btn">Leave request</button></div>
          </div>
          <div class="footer-text">What data do we know?</div>
            </div>
          </div>

      <!-- Request Screen (v2) -->
      <div class="request-screen hidden" id="requestScreen">
        <div class="voice-widget-container">
          <div class="menu-button">
            <img src="${ASSETS_BASE}menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
        </div>
          <div class="request-main-container">
            <div class="request-title">Leave a request</div>
            <div class="request-field">
              <div class="request-field-label">Name</div>
              <input class="request-input" type="text" placeholder="Your name" />
      </div>
            <div class="request-field">
              <div class="request-field-label">Contact (phone/ WhatsApp/ e-mail)</div>
              <div class="request-row">
                <input class="request-input request-code-input" type="text" placeholder="+34" />
                <input class="request-input request-phone-input" type="text" placeholder="1234567" />
    </div>
              <input class="request-input" type="email" placeholder="yourmail@gmail.com" />
        </div>
            <div class="request-field">
              <div class="request-field-label">Preferred contact method</div>
              <div class="request-select"><span>WhatsApp</span><span class="request-caret">▾</span></div>
          </div>
            <div class="request-field">
              <div class="request-field-label">Convenient time</div>
              <div class="request-select"><span>Today 13–15 (Fri, 17/10)</span><span class="request-caret">▾</span></div>
          </div>
            <div class="request-field">
              <div class="request-field-label">Comment (optional)</div>
              <textarea class="request-textarea" placeholder="Short note"></textarea>
        </div>
            <div class="request-actions-container">
              <div class="request-consent">
                <input class="request-checkbox" type="checkbox" />
                <div class="request-consent-text">I consent to the processing of my data for managing this request and contacting me about properties. <a class="request-privacy-link" href="#">Privacy Policy</a></div>
        </div>
              <div class="request-buttons">
                <button class="request-send-btn">Send</button>
                <button class="request-cancel-btn">Cancel</button>
        </div>
        </div>
        </div>
        </div>
      </div>

      <!-- Support Screen (v2) -->
      <div class="support-screen hidden" id="supportScreen">
        <div class="voice-widget-container">
          <div class="menu-button">
            <img src="${ASSETS_BASE}menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
    </div>
          <div class="support-main-container">
            <div class="support-faq-title">FAQ</div>
            <div class="support-faq-list">
              <div class="support-faq-item"><div class="support-faq-question">Where is my data stored?</div><div class="support-faq-answer">Your data is safely encrypted and stored on our secure EU servers.</div></div>
              <div class="support-faq-item"><div class="support-faq-question">How can I delete my information?</div><div class="support-faq-answer">Just send us a short message — we’ll remove your data immediately.</div></div>
              <div class="support-faq-item"><div class="support-faq-question">Why can’t I send my request?</div><div class="support-faq-answer">Check your internet connection or try again in a few minutes.</div></div>
              <div class="support-faq-item"><div class="support-faq-question">How can I be sure my info is safe?</div><div class="support-faq-answer">We never share or sell your data. You can review our Privacy Policy anytime.</div></div>
            </div>
            <div class="support-gradient-line"></div>
            <div class="support-hint-text">Got questions or something doesn’t work as expected? We’re here to help you resolve it quickly.</div>
            <div class="support-contact-button"><button class="support-contact-btn">Contact Support</button></div>
          </div>
          <div class="support-footer-text">Want to talk with a human</div>
        </div>
      </div>
          </div>

        </div>
      </div>
    </div>

  </div>
  `;


  /* ...ВЕСЬ КОД ПРОСМОТРЕННЫЙ ДО ЭТОЙ ЧАСТИ ЯВЛЯЕТСЯ НУЖНЫМ И АКТУАЛИЗИРОВАННЫМ... */



  const $ = s => this.shadowRoot.querySelector(s);

  // Screen management (fresh query each time to avoid stale refs)
  const screenIds = ['mainScreen','dialogScreen','contextScreen','requestScreen','supportScreen'];
  const showScreen = (screenName) => {
    screenIds.forEach(id => this.shadowRoot.getElementById(id)?.classList.add('hidden'));
    this.shadowRoot.getElementById(screenName === 'dialog' ? 'dialogScreen' : screenName === 'main' ? 'mainScreen' : screenName + 'Screen')?.classList.remove('hidden');
  };

  // Launcher
  $("#launcher")?.addEventListener("click", () => {
    this.classList.add("open");
    this.shadowRoot.getElementById("textInput")?.focus();
    // Lock host page scroll while widget is open (but allow scroll inside widget)
    try {
      const prev = document.documentElement.style.overflow;
      this._prevPageOverflow = prev || '';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'pan-y';
    } catch {}
  });

  // Helper: close widget and restore page scroll
  this.closeWidget = () => {
    this.classList.remove("open");
    try {
      document.documentElement.style.overflow = this._prevPageOverflow || '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    } catch {}
  };

  // (legacy header/details and overlay lead panel handlers removed)

  // Request screen actions
  const reqSend = this.shadowRoot.querySelector('#requestScreen .request-send-btn');
  if (reqSend) reqSend.addEventListener('click', (e) => { e.preventDefault(); this.openLeadPanel(); });
  const reqCancel = this.shadowRoot.querySelector('#requestScreen .request-cancel-btn');
  if (reqCancel) reqCancel.addEventListener('click', (e) => {
    e.preventDefault();
    if (this.messages && this.messages.length > 0) this.showChatScreen(); else this.showMainScreen();
    // also close menu state if any
    this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI();
  });

  // Populate time slots (Europe/Madrid)
  this.populateTimeSlots();

  // Populate country codes (basic)
  const ccSel = $('#leadCountryCode');
  if (ccSel) {
    const codes = [
      { c:'+34', l:'🇪🇸 +34' },
      { c:'+49', l:'🇩🇪 +49' },
      { c:'+33', l:'🇫🇷 +33' },
      { c:'+39', l:'🇮🇹 +39' },
      { c:'+44', l:'🇬🇧 +44' },
      { c:'+1',  l:'🇺🇸 +1' },
      { c:'+7',  l:'🇷🇺 +7' },
      { c:'+380',l:'🇺🇦 +380' }
    ];
    ccSel.innerHTML = codes.map((o,i)=>`<option value="${o.c}" ${o.c==='+34'?'selected':''}>${o.l}</option>`).join('');
  }

  // Email domain hints on '@'
  const emailInput = $('#leadEmail');
  if (emailInput) {
    emailInput.addEventListener('input', (e) => {
      const v = String(emailInput.value || '');
      const at = v.indexOf('@');
      if (at >= 0) {
        // простая подсказка: если нет домена — добавим типовые домены
        const after = v.slice(at+1);
        if (!after) {
          // показываем нотификацию один раз
          this.ui.showNotification('Try: gmail.com, outlook.com, yahoo.com');
        }
      }
    });
  }

  /* ===== LEGACY LEAD FORM HANDLER (v1 overlay) — kept as reference =====
  // Submit lead
  $('#leadSubmit')?.addEventListener('click', async () => {
    const name = $('#leadName')?.value?.trim();
    const email = $('#leadEmail')?.value?.trim();
    const phoneRaw = $('#leadPhone')?.value?.replace(/\D/g,'') || '';
    const cc = $('#leadCountryCode')?.value || '';
    const channel = $('#leadChannel')?.value;
    const timeValue = $('#leadTime')?.value;
    const note = $('#leadNote')?.value?.trim();
    const consent = $('#leadConsent')?.checked === true;

    // validation helpers
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasEmail = !!email;
    const hasPhone = !!phoneRaw;

    const markInvalid = (el) => { if (el){ el.classList.add('lead-invalid','shake-lead'); setTimeout(()=>el.classList.remove('shake-lead'),500);} };
    const clearInvalid = (el) => { if (el){ el.classList.remove('lead-invalid'); } };

    clearInvalid($('#leadName'));
    clearInvalid($('#leadEmail'));
    clearInvalid($('#leadPhone'));
    $('#leadContactError') && ($('#leadContactError').textContent = '');
    $('#leadConsentError') && ($('#leadConsentError').textContent = '');

    // Name is optional now
    const eN = $('#leadNameError'); if (eN) eN.textContent = '';
    if (!hasEmail && !hasPhone) {
      markInvalid($('#leadEmail'));
      markInvalid($('#leadPhone'));
      const err = this.tLead('errContactRequired') || this.tLead('fillBoth');
      const el = $('#leadContactError'); if (el) el.textContent = err;
      this.ui.showNotification(err);
      return;
    }
    if (hasEmail && !emailRe.test(email)) {
      markInvalid($('#leadEmail'));
      const err = this.tLead('errEmailInvalid') || 'Invalid email';
      const el = $('#leadContactError'); if (el) el.textContent = err;
      this.ui.showNotification(err);
      return;
    }
    if (hasPhone && phoneRaw.length < 6) {
      markInvalid($('#leadPhone'));
      const err = this.tLead('errPhoneInvalid') || 'Invalid phone number';
      const el = $('#leadContactError'); if (el) el.textContent = err;
      this.ui.showNotification(err);
      return;
    }
    if (!consent) {
      const err = this.tLead('consentRequired');
      const wrap = this.shadowRoot.querySelector('.lead-consent');
      if (wrap) wrap.classList.add('lead-invalid','shake-lead');
      const el = $('#leadConsentError'); if (el) el.textContent = err;
      this.ui.showNotification(err);
      setTimeout(()=>{ if (wrap) wrap.classList.remove('shake-lead'); }, 500);
      return;
    }

    const contactValue = hasEmail ? email : (cc + phoneRaw);
    const contactChannel = hasEmail ? 'email' : 'phone';

    // Name is optional in big form too; no blocking on name

    let time_window = null;
    try { time_window = timeValue ? JSON.parse(timeValue) : null; } catch {}

    // Resolve backend base URL from existing audio API url
    const baseApi = (() => {
      try {
        const audioUrl = this.apiUrl || '';
        // typical: http://host:3001/api/audio/upload → http://host:3001
        const u = new URL(audioUrl, window.location.href);
        return `${u.protocol}//${u.host}`;
      } catch {
        return '';
      }
    })();
    const leadsUrl = `${baseApi}/api/leads`;

    const payload = {
      name,
      contact: { channel: channel === 'whatsapp' && !hasEmail ? 'whatsapp' : contactChannel, value: contactValue },
      time_window,
      language: this.getLangCode(),
      gdpr: { consent, locale: this.getLangCode() },
      context: { sessionId: this.sessionId || null, notes: note || null, source: 'widget' }
    };

    try {
      const resp = await fetch(leadsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok && data?.ok) {
        // Спасибо-форма
        const box = this.shadowRoot.querySelector('.lead-box');
        if (box) {
          box.classList.add('thankyou');
          const successText = this.tLead('success') || 'Thanks! We will contact you in the selected time.';
          const m = successText.match(/^(.*?[.!?])\s*(.*)$/u);
          const title = m ? m[1] : successText;
          const note = m && m[2] ? m[2] : '';
          const noteHtml = note ? `<p class="lead-thanks-note">${note}</p>` : '';
          box.innerHTML = `
            <h2 class="lead-thanks-title">${title}</h2>
            ${noteHtml}
            <div class="lead-actions">
              <button class="lead-submit" id="leadContinue">${this.tLead('inlineContinue') || 'Continue'}</button>
            </div>
          `;
          const cont = this.shadowRoot.getElementById('leadContinue');
          if (cont) cont.addEventListener('click', () => {
            leadPanel?.classList.remove('active');
            leadPanel?.setAttribute('aria-hidden', 'true');
            box.classList.remove('thankyou');
          });
        }
      } else {
        // Показать ошибки валидации, если есть
        if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
          const first = data.errors[0];
          this.ui.showNotification(`${first.field}: ${first.message}`);
        } else {
          this.ui.showNotification(this.tLead('errorGeneric'));
        }
      }
    } catch (e) {
      console.error('Lead submit error:', e);
      this.ui.showNotification(this.tLead('errorNetwork'));
    }
  });
  */
  
  // (legacy details buttons removed)

  // Escape key (global) — закрыть виджет и вернуть скролл страницы
  this._onGlobalKeydown = (e) => {
    if (e.key !== 'Escape') return;
    if (!this.classList.contains('open')) return;
    e.preventDefault();
    e.stopPropagation();
    this.closeWidget();
  };
  try { document.addEventListener('keydown', this._onGlobalKeydown, true); } catch {}

  // Expose helpers
  this.showScreen = showScreen;
  this.showMainScreen = () => showScreen('main');
  this.showChatScreen = () => showScreen('dialog');
  // (legacy) this.showDetailsScreen was used for v1 Details screen — removed
  
  // Thread auto-scroll helper
  this._isThreadNearBottom = true;
  this.scrollThreadToBottom = (force = false) => {
    const thread = this.shadowRoot.getElementById('thread');
    if (!thread) return;
    const doScroll = () => { thread.scrollTop = thread.scrollHeight; };
    if (force || this._isThreadNearBottom) {
      requestAnimationFrame(doScroll);
    }
  };
  // Observe user scroll to preserve natural behavior
  (()=>{
    const thread = this.shadowRoot.getElementById('thread');
    if (!thread) return;
    const updateFlag = () => {
      const delta = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
      this._isThreadNearBottom = delta < 120; // px threshold
      const btn = this.shadowRoot.getElementById('btnScrollBottom');
      if (btn) {
        if (delta > 240) btn.classList.add('visible');
        else btn.classList.remove('visible');
      }
    };
    thread.addEventListener('scroll', updateFlag, { passive:true });
    // initialize
    updateFlag();
  })();

  // Scroll-to-bottom button behavior
  const btnScrollBottom = this.shadowRoot.getElementById('btnScrollBottom');
  if (btnScrollBottom) {
    btnScrollBottom.addEventListener('click', () => this.scrollThreadToBottom(true));
  }
  /* ===== STUB: openLeadPanel (legacy v1 overlay) — перепривяжем позже к requestScreen =====
  this.openLeadPanel = () => {
    const leadPanelEl = this.shadowRoot.getElementById('leadPanel');
    if (leadPanelEl) {
      leadPanelEl.classList.add('active');
      leadPanelEl.setAttribute('aria-hidden', 'false');
      const nameEl = this.shadowRoot.getElementById('leadName');
      if (nameEl) nameEl.focus();
    }
  };
  */

  // Property card (как было)
  this.renderPropertyCard = (property) => {
    return `
      <div class="property-card" data-variant-id="\${property.id || ''}">
        <div class="card-image" style="background-image: url('\${property.image || ''}')"></div>
        <div class="card-content">
          <div class="card-title">\${property.title || 'Название не указано'}</div>
          <div class="card-location">\${property.location || 'Локация не указана'}</div>
          <div class="card-price">\${property.price || 'Цена не указана'}</div>
          <div class="card-actions">
            <button class="card-btn like" data-action="like" data-variant-id="\${property.id || ''}">Мне нравится!</button>
            <button class="card-btn next" data-action="next" data-variant-id="\${property.id || ''}">Ещё вариант</button>
          </div>
        </div>
      </div>
    `;
  };

  // ---------- Inline Lead Bubbles (framework) ----------
  // State (kept per widget instance; can be augmented from session later)
  this.inlineLeadState = { step: null, data: { time_window: null, channel: null, contact: null, gdpr: false } };

  this.startInlineLeadFlow = () => {
    if (this.inlineLeadState.step) return; // already running
    this.inlineLeadState = { step: 'A', data: { time_window: null, channel: null, contact: null, gdpr: false } };
    this.renderInlineLeadStep();
  };

  // CTA bubble to start inline flow or open panel form
  this.showInlineLeadCTA = () => {
    if (this.inlineLeadState.step) { this.ui.showNotification(this.tLead('inlineAlready') || 'Already in progress'); return; }
    const thread = this.shadowRoot.getElementById('thread'); if (!thread) return;
    const wrap = document.createElement('div');
    wrap.className = 'message assistant';
    wrap.innerHTML = `<div class="bubble bubble--full"><div class="lead-bubble">
      <div class="lb-title">${this.tLead('inlineCtaTitle') || 'I can take your contact and arrange a call'}</div>
      <div class="lb-actions" style="margin-top:6px;">
        <button class="lb-btn primary" id="lbCtaInline">${this.tLead('inlineCtaInline') || 'Write here'}</button>
        <button class="lb-btn secondary" id="lbCtaForm">${this.tLead('inlineCtaForm') || 'Open form'}</button>
      </div>
    </div></div>`;
    thread.appendChild(wrap);
    wrap.querySelector('#lbCtaInline')?.addEventListener('click', ()=> this.startInlineLeadFlow());
    wrap.querySelector('#lbCtaForm')?.addEventListener('click', ()=> this.openLeadPanel());
  };

  this.cancelInlineLeadFlow = () => {
    this.inlineLeadState = { step: null, data: { time_window: null, channel: null, contact: null, gdpr: false } };
    // remove pending bubbles silently — без системного сообщения
  };

  this.renderInlineLeadStep = () => {
    const step = this.inlineLeadState.step;
    if (!step) return;
    const thread = this.shadowRoot.getElementById('thread');
    if (!thread) return;

    // Remove previous inline lead bubble (replace instead of stacking)
    const existingInline = thread.querySelectorAll('.lead-box[id^="lb-"]');
    if (existingInline.length) {
      const last = existingInline[existingInline.length - 1];
      last.closest('.message')?.remove();
    }

    const bubble = document.createElement('div');
    bubble.className = 'message assistant';
    // Render form as standalone (not inside chat bubble)
    const formWrap = document.createElement('div');
    formWrap.className = 'lead-box';
    formWrap.id = `lb-${Date.now()}`;
    bubble.appendChild(formWrap);
    thread.appendChild(bubble);

    const lb = formWrap;

    if (step === 'A') {
      lb.innerHTML = `
        <div class="lead-title">${this.tLead('timeLabel') || 'Time'}</div>
        <div class="lead-row">
          <label class="lead-label" for="lbTimeRange">${this.tLead('timeLabel') || 'Time'}</label>
          <select class="lead-select" id="lbTimeRange"></select>
          <div class="lead-error" id="lbErr"></div>
        </div>
        <div class="lead-actions" style="justify-content:center;">
          <button class="lead-submit" id="lbNext" style="width:120px; height:40px; flex:0 0 auto;">${this.tLead('inlineContinue') || 'Continue'}</button>
        </div>`;

      const tz = 'Europe/Madrid';
      const now = new Date();
      const fmt = (d) => d.toLocaleString('en-US', { weekday:'short', month:'2-digit', day:'2-digit' });
      const today = fmt(now);
      const tomorrowDate = new Date(now.getTime() + 24*60*60*1000);
      const tomorrow = fmt(tomorrowDate);
      const options = [
        { v: { date: now.toISOString().slice(0,10), from:'17:00', to:'19:00', timezone: tz }, l: `${this.tLead('today')} 17–19 (${today})` },
        { v: { date: now.toISOString().slice(0,10), from:'19:00', to:'21:00', timezone: tz }, l: `${this.tLead('today')} 19–21 (${today})` },
        { v: { date: tomorrowDate.toISOString().slice(0,10), from:'10:00', to:'12:00', timezone: tz }, l: `${this.tLead('tomorrow')} 10–12 (${tomorrow})` },
        { v: { date: tomorrowDate.toISOString().slice(0,10), from:'12:00', to:'14:00', timezone: tz }, l: `${this.tLead('tomorrow')} 12–14 (${tomorrow})` }
      ];
      const sel = lb.querySelector('#lbTimeRange');
      if (sel) sel.innerHTML = options.map((o,i)=>`<option value='${JSON.stringify(o.v)}' ${i===0?'selected':''}>${o.l}</option>`).join('');

      const updateTimeCta = () => {
        const val = lb.querySelector('#lbTimeRange')?.value;
        const next = lb.querySelector('#lbNext');
        if (next) next.disabled = !val;
      };
      lb.querySelector('#lbTimeRange')?.addEventListener('change', updateTimeCta);
      updateTimeCta();

      lb.querySelector('#lbNext')?.addEventListener('click', ()=>{
        const val = lb.querySelector('#lbTimeRange')?.value;
        const errEl = lb.querySelector('#lbErr');
        if (!val) { if (errEl) errEl.textContent = this.tLead('errTimeRequired') || 'Select date and time'; return; }
        try { this.inlineLeadState.data.time_window = JSON.parse(val); } catch { this.inlineLeadState.data.time_window = null; }
        // Skip channel selection step; default to phone
        this.inlineLeadState.data.channel = 'phone';
        this.inlineLeadState.step = 'C';
        this.renderInlineLeadStep();
      });
      // no cancel button per spec
      return;
    }

    // step B (channel selection) removed per spec

    if (step === 'C') {
      lb.innerHTML = `
        <div class="lead-title">${this.tLead('contactLabel') || 'Contact'}</div>
        <div class="lead-row">
          <label class="lead-label" for="lbPhoneInput">${this.tLead('optPhone')||'Phone'}</label>
          <div style="display:flex; gap:8px;"><select class="lead-select lbCountryCode"></select><input class="lead-input" id="lbPhoneInput" type="tel" inputmode="numeric" pattern="[0-9]*" placeholder="600112233" /></div>
        </div>
        <div class="lead-row">
          <label class="lead-label" for="lbEmailInput">${this.tLead('optEmail')||'Email'}</label>
          <input class="lead-input" id="lbEmailInput" type="email" inputmode="email" placeholder="name@example.com" maxlength="254" />
          <div class="lead-error" id="lbErr"></div>
        </div>
        <div class="lead-row">
          <label class="lead-label" for="lbChannel">${this.tLead('channelLabel')||'Preferred method'}</label>
          <select class="lead-select" id="lbChannel">
            <option value="whatsapp">${this.tLead('optWhatsApp')||'WhatsApp'}</option>
            <option value="phone" selected>${this.tLead('optPhone')||'Phone'}</option>
            <option value="email">${this.tLead('optEmail')||'Email'}</option>
          </select>
        </div>
        <div class="lead-actions" style="justify-content:center;">
          <button class="lead-submit" id="lbNext" disabled style="width:120px; height:40px; flex:0 0 auto;">${this.tLead('inlineContinue') || 'Continue'}</button>
        </div>`;

      // populate country codes from full form
      const src = this.shadowRoot.getElementById('leadCountryCode');
      const dst = lb.querySelector('.lbCountryCode');
      if (src && dst) dst.innerHTML = src.innerHTML;

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const updateCta = () => {
        const selected = String(lb.querySelector('#lbChannel')?.value || 'phone');
        const next = lb.querySelector('#lbNext');
        const errEl = lb.querySelector('#lbErr'); if (errEl) errEl.textContent = '';
        if (selected === 'email') {
          const em = String(lb.querySelector('#lbEmailInput')?.value||'').trim();
          next.disabled = !(emailRe.test(em));
        } else {
          const raw = String(lb.querySelector('#lbPhoneInput')?.value||'').replace(/\D/g,'');
          next.disabled = raw.length < 6;
        }
      };
      lb.querySelector('#lbPhoneInput')?.addEventListener('input', updateCta);
      lb.querySelector('#lbEmailInput')?.addEventListener('input', updateCta);
      lb.querySelector('#lbChannel')?.addEventListener('change', updateCta);
      updateCta();

      lb.querySelector('#lbNext')?.addEventListener('click', ()=>{
        const selected = String(lb.querySelector('#lbChannel')?.value || 'phone');
        const errEl = lb.querySelector('#lbErr'); if (errEl) errEl.textContent = '';
        if (selected === 'email') {
          const em = String(lb.querySelector('#lbEmailInput')?.value||'').trim();
          if (!emailRe.test(em)) { if (errEl) errEl.textContent = this.tLead('errEmailInvalid')||'Invalid email'; return; }
          this.inlineLeadState.data.channel = 'email';
          this.inlineLeadState.data.contact = { channel: 'email', value: em };
        } else {
          const raw = String(lb.querySelector('#lbPhoneInput')?.value||'').replace(/\D/g,'');
          if (raw.length < 6) { if (errEl) errEl.textContent = this.tLead('errPhoneInvalid')||'Invalid phone'; return; }
          const cc = String(lb.querySelector('.lbCountryCode')?.value || '');
          this.inlineLeadState.data.channel = selected === 'whatsapp' ? 'whatsapp' : 'phone';
          this.inlineLeadState.data.contact = { channel: 'phone', value: `+${(cc+raw).replace(/^\++/,'')}`.replace(/^\++/,'+') };
        }
        this.inlineLeadState.step = 'D';
        this.renderInlineLeadStep();
      });
      return;
    }

    if (step === 'D') {
      lb.innerHTML = `
        <div class="lead-title">GDPR</div>
        <div class="lead-row">
          <label class="lead-consent"><input type="checkbox" id="lbGdpr" /><span class="consent-text">${this.tLead('consentRequired')||'Please accept the Privacy Policy'} <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span></label>
          <div class="lead-error" id="lbErr"></div>
        </div>
          <div class="lead-row">
            <label class="lead-label" for="lbName">${this.tLead('yourName')||'Your name'} (${this.tLead('optional')||'optional'})</label>
            <input class="lead-input" id="lbName" type="text" inputmode="text" />
          <div class="lead-error" id="lbNameErr"></div>
        </div>
        <div class="lead-actions" style="justify-content:center;">
          <button class="lead-submit" id="lbSubmit" style="width:120px; height:40px; flex:0 0 auto;">${this.tLead('inlineContinue')||'Continue'}</button>
        </div>`;
      lb.querySelector('#lbSubmit')?.addEventListener('click', async ()=>{
        const ok = lb.querySelector('#lbGdpr')?.checked === true;
        const errEl = lb.querySelector('#lbErr');
        if (!ok) { if (errEl) errEl.textContent = this.tLead('consentRequired'); return; }
        // submit via /api/leads (same payload shape)
        const payload = {
          name: lb.querySelector('#lbName')?.value?.trim() || null,
          contact: this.inlineLeadState.data.contact,
          time_window: this.inlineLeadState.data.time_window,
          language: this.getLangCode(),
          gdpr: { consent: true, locale: this.getLangCode() },
          context: { sessionId: this.sessionId || null, notes: this.inlineLeadState.data.time_window ? null : 'schedule_later', source: 'inline' }
        };
        try {
          const baseApi = (() => { try { const u = new URL(this.apiUrl, window.location.href); return `${u.protocol}//${u.host}`;} catch { return ''; }})();
          const resp = await fetch(`${baseApi}/api/leads`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          const data = await resp.json().catch(()=>({}));
          if (resp.ok && data?.ok) {
            // Confirmation bubble with CTA (replace previous inline bubble)
            const thread = this.shadowRoot.getElementById('thread');
            const existingInline2 = thread?.querySelectorAll('.lead-box[id^="lb-"]');
            if (existingInline2 && existingInline2.length) {
              const last = existingInline2[existingInline2.length - 1];
              last.closest('.message')?.remove();
            }
            const bubble = document.createElement('div');
            bubble.className = 'message assistant';
            const code = this.getLangCode();
            const sysMsg = (code === 'ru')
              ? 'Отлично! Я передал менеджеру информацию, а пока если у вас ещё есть вопросы — буду рад помочь.'
              : (code === 'uk')
                ? 'Чудово! Я передав інформацію менеджеру. Якщо виникнуть ще питання — із задоволенням допоможу.'
                : (code === 'es')
                  ? '¡Genial! He compartido tu información con un gestor. Si tienes más preguntas, estaré encantado de ayudar.'
                  : (code === 'fr')
                    ? 'Super ! J’ai transmis vos informations au manager. Si vous avez d’autres questions, je serai ravi d’aider.'
                    : (code === 'de')
                      ? 'Super! Ich habe Ihre Informationen an den Manager weitergegeben. Bei weiteren Fragen helfe ich gerne.'
                      : 'Great! I have shared your info with a manager. If you have more questions, I\'m happy to help.';
            bubble.innerHTML = `<div class=\"bubble\">${sysMsg}</div>`;
            thread.appendChild(bubble);
            this.inlineLeadState = { step: null, data: { time_window:null, channel:null, contact:null, gdpr:false } };
          } else {
            if (data?.errors?.length) { if (errEl) errEl.textContent = `${data.errors[0].field}: ${data.errors[0].message}`; }
            else { if (errEl) errEl.textContent = this.tLead('errorGeneric') || 'An error occurred'; }
          }
        } catch (e) {
          if (errEl) errEl.textContent = this.tLead('errorNetwork') || 'Network error';
        }
      });
      return;
    }
  };

  // Card events
  this.shadowRoot.addEventListener('click', (e) => {
    if (e.target.matches('.card-btn[data-action="like"]')) {
      const variantId = e.target.getAttribute('data-variant-id');
      this.events.emit('like', { variantId });
    } else if (e.target.matches('.card-btn[data-action="next"]')) {
      const variantId = e.target.getAttribute('data-variant-id');
      this.events.emit('next_option', { variantId });
    } else if (e.target.matches('.card-btn[data-action="send_card"]')) {
      // Показать карточку из последнего предложения
      const container = e.target.closest('.card-screen');
      if (container) container.remove();
      if (this._lastSuggestedCard) {
        this.showMockCardWithActions(this._lastSuggestedCard);
      }
      this.events.emit('send_card');
    } else if (e.target.matches('.card-btn[data-action="continue_dialog"]')) {
      const container = e.target.closest('.card-screen');
      if (container) container.remove();
      this.events.emit('continue_dialog');
    }
  });
}

  // ---------- ПРЯМО ТУТ ЗАКАНЧИВВАЕТСЯ ФУНКЦИЯ РЕНДЕР (В НЕЙ ЛЕЖАТ СТИЛИ v2/ ----------
                  // верстка и стили всех экранов в разметке и стилях/ 
                  // логика и верстка старой лид формы (актуализировать)/
                  // логика и верстка инлайн лид формы/
                  // логика карточек квартир) 




  // ---------- EVENTS / COORDINATION ----------
  bindEvents() {
    // события рекордера → UI
    this.events.on('recordingStarted', () => {
      this.showChatScreen();
      // Show recording indicator on current screen
      const isMainScreen = this.shadowRoot.getElementById('mainScreen')?.classList.contains('hidden') === false;
      this.showRecordingIndicator(isMainScreen ? 'main' : 'chat');
      // Update toggle button state for both screens
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
    });
    this.events.on('recordingStopped', () => {
      // Hide recording indicators
      this.hideRecordingIndicator('main');
      this.hideRecordingIndicator('chat');
      // Update toggle button state for both screens
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
    });
    this.events.on('recordingCancelled', () => {
      // Hide recording indicators
      this.hideRecordingIndicator('main');
      this.hideRecordingIndicator('chat');
      // Update toggle button state for both screens
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
    });

    // Text message sent - switch to chat screen if on main
    this.events.on('textMessageSent', (d) => { 
      console.log('📤 Text message sent:', d?.text?.slice(0,50));
      // Switch to chat screen if we're on main screen
      if (this.shadowRoot.getElementById('mainScreen')?.classList.contains('hidden') === false) {
        this.showChatScreen();
      }
    });

    // understanding
    this.events.on('understandingUpdated', (u) => { 
      console.log('🧠 Understanding updated:', u);
      this.updateDetailsScreen(u);
    });

    // UI
    this.events.on('uiStateChanged', (data) => {
      console.log(`🎯 UI State: ${data.from} → ${data.to}`);
      if (data.to === 'recording') this.isRecording = true;
      else if (data.from === 'recording') this.isRecording = false;
    });

    // API
    this.events.on('messageReceived', (d) => { 
      console.log('📥 Message received:', d?.type);
      if (d?.type === 'property_card') {
        this.showPropertyCard(d.data);
      }
    });
    
    
    // Card interactions
    this.events.on('like', (data) => {
      console.log('❤️ Like clicked:', data.variantId);
      // Send variant ID back to backend
      this.api.sendCardInteraction('like', data.variantId);
    });
    this.events.on('next_option', (data) => {
      console.log('⏭️ Next option clicked:', data.variantId);
      // Send variant ID back to backend
      this.api.sendCardInteraction('next', data.variantId);
    });

    // ошибки/нотификации/лоадеры
    this.events.on('error', (e) => { console.error('🚨 Widget error:', e); this.ui.showNotification(`❌ Ошибка: ${e.message}`); });
    this.events.on('notification', (m) => this.ui.showNotification(m));
    this.events.on('loadingStart', () => this.ui.showLoading());
    this.events.on('loadingEnd', () => this.ui.hideLoading());

    console.log('🔗 Event coordination established');
  }

  // ---------- ПУБЛИЧНЫЕ МЕТОДЫ ----------
  
  // Helper function to update understanding percentage
  // Update header understanding bar only
  updateHeaderUnderstanding(percent) {
    // Understanding bar removed — no-op
  }

  // Recording indicator management
  showRecordingIndicator(screen = 'chat') {
    const indicator = screen === 'main' 
      ? this.shadowRoot.getElementById('mainRecordingIndicator')
      : this.shadowRoot.getElementById('recordingIndicator');
    
    const wrapper = screen === 'main'
      ? this.shadowRoot.querySelector('#mainTextInput').closest('.text-input-wrapper')
      : this.shadowRoot.querySelector('#textInput').closest('.text-input-wrapper');
    
    if (indicator) {
      indicator.style.display = 'flex';
      if (wrapper) wrapper.classList.add('recording');
    }
  }

  hideRecordingIndicator(screen = 'chat') {
    const indicator = screen === 'main' 
      ? this.shadowRoot.getElementById('mainRecordingIndicator')
      : this.shadowRoot.getElementById('recordingIndicator');
    
    const wrapper = screen === 'main'
      ? this.shadowRoot.querySelector('#mainTextInput').closest('.text-input-wrapper')
      : this.shadowRoot.querySelector('#textInput').closest('.text-input-wrapper');
    
    if (indicator) {
      indicator.style.display = 'none';
      if (wrapper) wrapper.classList.remove('recording');
    }
  }




  
  startRecording() {
    if (this.ui.getCurrentState() === 'idle' || this.ui.getCurrentState() === 'typing' || this.ui.getCurrentState() === 'main') {
      return this.audioRecorder.startRecording();
    }
    console.warn('⚠️ Cannot start recording in state:', this.ui.getCurrentState());
    return false;
  }
  sendTextMessage() {
    if (this.ui.getCurrentState() === 'typing') return this.api.sendTextMessage();
    console.warn('⚠️ Cannot send text in state:', this.ui.getCurrentState());
    return false;
  }
  cancelRecording() {
    if (this.ui.getCurrentState() === 'recording') return this.audioRecorder.cancelRecording();
    console.warn('⚠️ No recording to cancel in state:', this.ui.getCurrentState());
    return false;
  }

  // Update details screen with understanding data (канонические ключи)
  updateDetailsScreen(understanding) {
    const params = understanding.params || understanding;
    
    // Update progress
    const progressFill = this.shadowRoot.getElementById('progressFill');
    const progressText = this.shadowRoot.getElementById('progressText');
    if (progressFill && progressText) {
      const progress = (typeof understanding.progress === 'number') ? understanding.progress : 0;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}% — ${progress === 0 ? 'ожидание' : 'обработка'}`;
    }

    // Update parameter values and dots
    const updateParam = (id, value, dotId) => {
      const valueEl = this.shadowRoot.getElementById(id);
      const dotEl = this.shadowRoot.getElementById(dotId);
      if (valueEl) {
        const text = value || 'не определено';
        valueEl.textContent = text;
        valueEl.setAttribute('title', text);
        valueEl.setAttribute('data-tooltip', text);
      }
      if (dotEl) dotEl.classList.toggle('on', !!value);
    };

    updateParam('nameValue', params.name, 'nameDot');
    updateParam('operationValue', params.operation ?? params.operationType, 'operationDot');
    updateParam('budgetValue', params.budget, 'budgetDot');
    updateParam('typeValue', params.type ?? params.propertyType, 'typeDot');
    updateParam('locationValue', params.location ?? params.district, 'locationDot');
    updateParam('roomsValue', params.rooms, 'roomsDot');
    updateParam('areaValue', params.area, 'areaDot');
    updateParam('detailsValue', params.details ?? params.locationDetails, 'detailsDot');
    updateParam('preferencesValue', params.preferences ?? params.additional, 'preferencesDot');
  }

  // Send text from main screen
  sendTextFromMainScreen(text) {
    // Clear input
    const mainTextInput = this.shadowRoot.getElementById('mainTextInput');
    if (mainTextInput) {
      mainTextInput.value = '';
          // Update send button state
    const mainSendButton = this.shadowRoot.getElementById('mainSendButton');
    if (mainSendButton) {
      mainSendButton.disabled = true;
      mainSendButton.setAttribute('aria-disabled', 'true');
    }
    }

    // Switch to chat screen
    this.showChatScreen();

    // Add user message to chat
    const userMessage = { type: 'user', content: text, timestamp: new Date() };
    this.ui.addMessage(userMessage);

    // Send to API
    this.api.sendTextMessageFromText(text);
  }

  // Update toggle button state
  updateToggleButtonState(screen) {
    const isRecording = this.audioRecorder.isRecording;
    let toggleButton = null;

    if (screen === 'main') {
      toggleButton = this.shadowRoot.getElementById('mainToggleButton');
    } else if (screen === 'chat') {
      toggleButton = this.shadowRoot.getElementById('toggleButton');
    }

    if (toggleButton) {
      if (isRecording) {
        // Show stop icon
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}stop_btn.svg" alt="Stop" />`;
        toggleButton.setAttribute('title', 'Сбросить');
      } else {
        // Show mic icon
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}mic_btn.svg" alt="Microphone" />`;
        toggleButton.setAttribute('title', 'Говорить');
      }
    }
  }

  // Update send button state
  updateSendButtonState(screen) {
    let textInput = null;
    let sendButton = null;

    if (screen === 'main') {
      textInput = this.shadowRoot.getElementById('mainTextInput');
      sendButton = this.shadowRoot.getElementById('mainSendButton');
    } else if (screen === 'chat') {
      textInput = this.shadowRoot.getElementById('textInput');
      sendButton = this.shadowRoot.getElementById('sendButton');
    }

    if (textInput && sendButton) {
      const text = textInput.value.trim();
      const hasText = !!text;
      
      // Always keep send button visible and enabled
      sendButton.disabled = false;
      sendButton.setAttribute('aria-disabled', 'false');
      sendButton.style.opacity = '1';
      sendButton.style.visibility = 'visible';
      sendButton.style.display = 'flex';
      
      // Add shaking animation when empty (but keep button visible)
      if (!hasText) {
        textInput.classList.add('shake');
        // Remove shake class after animation completes
        setTimeout(() => {
          textInput.classList.remove('shake');
        }, 500);
      } else {
        textInput.classList.remove('shake');
      }
    }
  }

  // Show property card in chat
  showPropertyCard(property) {
    const thread = this.shadowRoot.getElementById('thread');
    if (!thread) return;

    const normalized = this.normalizeCardData(property);
    const wrapper = document.createElement('div');
    wrapper.className = 'card-screen';
    wrapper.innerHTML = `
      <div class="cs" data-variant-id="${normalized.id}">
        <div class="cs-image">${normalized.image ? `<img src="${normalized.image}" alt="${normalized.city} ${normalized.district}">` : 'Put image here'}</div>
        <div class="cs-body">
          <div class="cs-row"><div class="cs-title">${normalized.city}</div><div class="cs-title">${normalized.priceLabel}</div></div>
          <div class="cs-row"><div class="cs-sub">${normalized.district}${normalized.neighborhood ? (', ' + normalized.neighborhood) : ''}</div><div class="cs-sub">${normalized.roomsLabel}</div></div>
          <div class="cs-row"><div class="cs-sub"></div><div class="cs-sub">${normalized.floorLabel}</div></div>
        </div>
      </div>`;
    thread.appendChild(wrapper);
  }

  // Show mock card + action panel as separate messages and keep 70/30 viewport split
  showMockCardWithActions(mock = {}) {
    const thread = this.shadowRoot.getElementById('thread');
    const messages = this.shadowRoot.getElementById('messagesContainer');
    if (!thread || !messages) return;

    // 1) Card message (assistant)
    const cardMsg = document.createElement('div');
    cardMsg.className = 'card-screen';
    const normalized = this.normalizeCardData(mock);
    cardMsg.innerHTML = `
      <div class="cs" data-variant-id="${normalized.id}" data-city="${normalized.city}" data-district="${normalized.district}" data-rooms="${normalized.rooms}" data-price-eur="${normalized.priceEUR}" data-image="${normalized.image}">
        <div class="cs-image">${normalized.image ? `<img src="${normalized.image}" alt="${normalized.city} ${normalized.district}">` : 'Put image here'}</div>
        <div class="cs-body">
          <div class="cs-row"><div class="cs-title">${normalized.city}</div><div class="cs-title">${normalized.priceLabel}</div></div>
          <div class="cs-row"><div class="cs-sub">${normalized.district}${normalized.neighborhood ? (', ' + normalized.neighborhood) : ''}</div><div class="cs-sub">${normalized.roomsLabel}</div></div>
          <div class="cs-row"><div class="cs-sub"></div><div class="cs-sub">${normalized.floorLabel}</div></div>
        </div>
      </div>`;

    thread.appendChild(cardMsg);

    // 2) Actions panel (system) — единственный экземпляр. Если уже есть, просто переносим под последнюю карточку
    const existingPanel = this.shadowRoot.querySelector('.card-actions-panel');
    if (existingPanel) {
      const panelWrapper = existingPanel.closest('.card-screen');
      if (panelWrapper && panelWrapper.parentElement !== thread) {
        // на всякий случай
        panelWrapper.remove();
        thread.appendChild(panelWrapper);
      } else if (panelWrapper) {
        // переместить в конец (под только что добавленную карточку)
        thread.appendChild(panelWrapper);
      }
      // обновим variant-id на кнопках под новый кандидат
      existingPanel.querySelectorAll('.card-btn').forEach(btn => btn.setAttribute('data-variant-id', normalized.id));
    } else {
      const actionsMsg = document.createElement('div');
      actionsMsg.className = 'card-screen';
      actionsMsg.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="card-actions-panel">
            <button class="card-btn like" data-action="like" data-variant-id="${normalized.id}">Мне нравится!</button>
            <button class="card-btn next" data-action="next" data-variant-id="${normalized.id}">Ещё вариант</button>
          </div>
        </div>`;
      thread.appendChild(actionsMsg);
    }

    // 3) Scroll/height logic to keep ~70/30 split
    requestAnimationFrame(() => {
      const H = messages.clientHeight;
      const targetLower = Math.max(0, Math.floor(H * 0.7));
      const actionPanel = existingPanel || (actionsMsg ? actionsMsg.querySelector('.card-actions-panel') : null);
      const gap = 12; // safety gap from thread spacing

      // limit card height if needed
      const cardEl = cardMsg.querySelector('.card-mock');
      if (cardEl && actionPanel) {
        // Убираем внутренний скролл — показываем полностью; просто подгоняем прокрутку контейнера
        cardEl.style.maxHeight = '';
        cardEl.style.overflow = 'visible';
      }

      // scroll so that ~30% remains visible above
      messages.scrollTop = Math.max(0, messages.scrollHeight - targetLower);
    });

    // Attach click handlers (reuse existing event pipeline)
    // Delegated globally; no extra listeners required here
  }

  // ---------- ПРЕДЛОЖЕНИЕ ПОКАЗАТЬ КАРТОЧКУ ----------
  suggestCardOption(data = {}) {
    const thread = this.shadowRoot.getElementById('thread');
    const messages = this.shadowRoot.getElementById('messagesContainer');
    if (!thread || !messages) return;

    this._lastSuggestedCard = data;

    const panel = document.createElement('div');
    panel.className = 'card-screen';
    panel.innerHTML = `
      <div class="cs" style="background:transparent; box-shadow:none;">
        <div class="card-actions-panel">
          <button class="card-btn like" data-action="send_card">Отправить квартиру</button>
          <button class="card-btn next" data-action="continue_dialog">Продолжить диалог</button>
        </div>
      </div>`;

    thread.appendChild(panel);

    requestAnimationFrame(() => {
      const H = messages.clientHeight;
      messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
    });
  }

  // ---------- НОРМАЛИЗАЦИЯ ДАННЫХ КАРТОЧКИ ----------
  normalizeCardData(raw = {}) {
    const toInt = (v) => {
      if (v == null) return null;
      const n = String(v).replace(/[^0-9]/g, '');
      return n ? parseInt(n, 10) : null;
    };
    const priceNum = toInt(raw.price);
    const roomsNum = toInt(raw.rooms);
    const floorNum = toInt(raw.floor);
    const city = raw.city || raw.location || '';
    const district = raw.district || raw.area || '';
    const neighborhood = raw.neighborhood || raw.neiborhood || raw.neiborhood || '';
    const image = raw.image || raw.imageUrl || '';

    const priceLabel = raw.price || (priceNum != null ? `${priceNum} €` : (raw.priceLabel || ''));
    const roomsLabel = roomsNum != null ? `${roomsNum} rooms` : (raw.rooms || '');
    const floorLabel = floorNum != null ? `${floorNum} floor` : (raw.floor || '');

    return {
      id: raw.id || '',
      image,
      city,
      district,
      neighborhood,
      rooms: roomsNum != null ? String(roomsNum) : (raw.rooms || ''),
      roomsLabel,
      floor: floorNum != null ? String(floorNum) : (raw.floor || ''),
      floorLabel,
      priceEUR: priceNum != null ? priceNum : null,
      priceLabel
    };
  }

  // ---------- УТИЛИТЫ ----------
  getLangCode() {
    try {
      const lang = localStorage.getItem('vw_lang');
      if (!lang) return 'en';
      const code = lang.trim().toLowerCase().slice(0,2);
      return ['en','es','ru','uk','fr','de','it'].includes(code) ? code : 'en';
    } catch { return 'en'; }
  }

  buildLeadI18nDictionary() {
    return {
      en: {
        openButton: 'Leave a request',
        title: 'Leave a request',
        nameLabel: 'Name', namePh: 'Your name',
        contactLabel: 'Contact (phone / WhatsApp / e-mail)', contactPh: '+34 600 00 00 00 / name@example.com',
        channelLabel: 'Preferred contact method', optWhatsapp: 'WhatsApp', optPhone: 'Phone', optEmail: 'E-mail',
        timeLabel: 'Convenient time', today: 'today', tomorrow: 'tomorrow',
        noteLabel: 'Comment (optional)', notePh: 'Short note',
        cancel: 'Cancel', submit: 'Send',
        fillBoth: 'Please fill in name and contact',
        success: 'Thanks! We will contact you in the selected time.',
        errorGeneric: 'An error occurred, please try again',
        errorNetwork: 'Network error. Please try again',
        consentRequired: 'Please accept the Privacy Policy',
        errNameRequired: 'Name is required',
        errContactRequired: 'Provide either phone or email',
        errEmailInvalid: 'Email is invalid',
        errPhoneInvalid: 'Phone number is invalid',
        inlineContinue: 'Continue',
        inlineSkip: 'Skip / schedule later',
        inlineSend: 'Send',
        inlineCancel: 'Cancel',
        inlineGdprTitle: 'GDPR consent',
        inlineContactMethodQ: 'How should we contact you?',
        errTimeRequired: 'Please select date and time',
        inlineTzHeader: 'Europe/Madrid · next 7 days',
        inlineCtaTitle: 'I can take your contact and arrange a call',
        inlineCtaInline: 'Write here',
        inlineCtaForm: 'Open form',
        inlineAlready: 'Lead capture is already in progress'
      },
      es: {
        openButton: 'Enviar solicitud',
        title: 'Enviar solicitud',
        nameLabel: 'Nombre', namePh: 'Tu nombre',
        contactLabel: 'Contacto (teléfono / WhatsApp / e-mail)', contactPh: '+34 600 00 00 00 / nombre@ejemplo.com',
        channelLabel: 'Método de contacto preferido', optWhatsapp: 'WhatsApp', optPhone: 'Teléfono', optEmail: 'E-mail',
        timeLabel: 'Hora conveniente', today: 'hoy', tomorrow: 'mañana',
        noteLabel: 'Comentario (opcional)', notePh: 'Nota breve',
        cancel: 'Cancelar', submit: 'Enviar',
        fillBoth: 'Por favor, introduce nombre y contacto',
        success: '¡Gracias! Nos pondremos en contacto en el horario indicado.',
        errorGeneric: 'Ocurrió un error, inténtelo de nuevo',
        errorNetwork: 'Error de red. Inténtalo de nuevo',
        consentRequired: 'Por favor, acepte la Política de Privacidad',
        errNameRequired: 'El nombre es obligatorio',
        errContactRequired: 'Indique teléfono o e‑mail',
        errEmailInvalid: 'E‑mail no válido',
        errPhoneInvalid: 'Teléfono no válido',
        inlineContinue: 'Continuar',
        inlineSkip: 'Omitir / acordamos después',
        inlineSend: 'Enviar',
        inlineCancel: 'Cancelar',
        inlineGdprTitle: 'Consentimiento GDPR',
        inlineContactMethodQ: '¿Cómo le es más cómodo que contactemos?',
        errTimeRequired: 'Seleccione fecha y hora',
        inlineTzHeader: 'Europa/Madrid · próximos 7 días',
        inlineCtaTitle: 'Puedo tomar su contacto y coordinar una llamada',
        inlineCtaInline: 'Escribir aquí',
        inlineCtaForm: 'Abrir formulario',
        inlineAlready: 'Ya estamos recopilando los datos'
      },
      ru: {
        openButton: 'Оставить заявку',
        title: 'Оставить заявку',
        nameLabel: 'Имя', namePh: 'Ваше имя',
        contactLabel: 'Контакт (телефон / WhatsApp / e-mail)', contactPh: '+34 600 00 00 00 / name@example.com',
        channelLabel: 'Предпочтительный способ связи', optWhatsapp: 'WhatsApp', optPhone: 'Телефон', optEmail: 'E-mail',
        timeLabel: 'Удобное время', today: 'сегодня', tomorrow: 'завтра',
        noteLabel: 'Комментарий (опционально)', notePh: 'Короткая заметка',
        cancel: 'Отмена', submit: 'Отправить заявку',
        fillBoth: 'Заполните имя и контакт',
        success: 'Спасибо! Мы свяжемся с вами в выбранное время.',
        errorGeneric: 'Произошла ошибка, попробуйте снова',
        errorNetwork: 'Сеть недоступна. Попробуйте ещё раз',
        consentRequired: 'Пожалуйста, подтвердите согласие с Политикой конфиденциальности',
        errNameRequired: 'Укажите имя',
        errContactRequired: 'Укажите телефон или e‑mail',
        errEmailInvalid: 'Некорректный e‑mail',
        errPhoneInvalid: 'Некорректный номер телефона',
        inlineContinue: 'Продолжить',
        inlineSkip: 'Пропустить / согласуем позже',
        inlineSend: 'Отправить',
        inlineCancel: 'Отмена',
        inlineGdprTitle: 'Согласие на обработку данных',
        inlineContactMethodQ: 'Как с вами удобнее связаться?',
        errTimeRequired: 'Выберите дату и время',
        inlineTzHeader: 'Europe/Madrid · ближайшие 7 дней',
        inlineCtaTitle: 'Могу взять ваш контакт и согласовать звонок',
        inlineCtaInline: 'Написать здесь',
        inlineCtaForm: 'Открыть форму',
        inlineAlready: 'Сбор данных уже идёт'
      },
      uk: {
        openButton: 'Залишити заявку',
        title: 'Залишити заявку',
        nameLabel: "Ім'я", namePh: 'Ваше ім’я',
        contactLabel: 'Контакт (телефон / WhatsApp / e-mail)', contactPh: '+34 600 00 00 00 / name@example.com',
        channelLabel: 'Бажаний спосіб зв’язку', optWhatsapp: 'WhatsApp', optPhone: 'Телефон', optEmail: 'E-mail',
        timeLabel: 'Зручний час', today: 'сьогодні', tomorrow: 'завтра',
        noteLabel: 'Коментар (необов’язково)', notePh: 'Коротка нотатка',
        cancel: 'Скасувати', submit: 'Надіслати',
        fillBoth: 'Заповніть ім’я та контакт',
        success: 'Дякуємо! Зв’яжемося у вибране вікно',
        errorGeneric: 'Не вдалося надіслати. Спробуйте ще раз',
        errorNetwork: 'Проблема з мережею. Спробуйте ще раз',
        consentRequired: 'Будь ласка, прийміть Політику конфіденційності',
        errNameRequired: "Вкажіть ім'я",
        errContactRequired: 'Вкажіть телефон або e‑mail',
        errEmailInvalid: 'Некоректний e‑mail',
        errPhoneInvalid: 'Некоректний номер телефону',
        inlineContinue: 'Продовжити',
        inlineSkip: 'Пропустити / узгодимо пізніше',
        inlineSend: 'Надіслати',
        inlineCancel: 'Скасувати',
        inlineGdprTitle: 'Згода на обробку даних',
        inlineContactMethodQ: 'Як з вами зручніше зв’язатися?',
        errTimeRequired: 'Виберіть дату і час',
        inlineTzHeader: 'Europe/Madrid · найближчі 7 днів',
        inlineCtaTitle: 'Можу взяти ваш контакт і узгодити дзвінок',
        inlineCtaInline: 'Написати тут',
        inlineCtaForm: 'Відкрити форму',
        inlineAlready: 'Збір даних уже триває'
      },
      fr: {
        openButton: 'Laisser une demande',
        title: 'Laisser une demande',
        nameLabel: 'Nom', namePh: 'Votre nom',
        contactLabel: 'Contact (téléphone / WhatsApp / e-mail)', contactPh: '+34 600 00 00 00 / nom@exemple.com',
        channelLabel: 'Méthode de contact préférée', optWhatsapp: 'WhatsApp', optPhone: 'Téléphone', optEmail: 'E-mail',
        timeLabel: 'Horaire souhaité', today: 'aujourd’hui', tomorrow: 'demain',
        noteLabel: 'Commentaire (optionnel)', notePh: 'Note courte',
        cancel: 'Annuler', submit: 'Envoyer',
        fillBoth: 'Veuillez indiquer le nom et le contact',
        success: 'Merci ! Nous vous contacterons dans le créneau choisi',
        errorGeneric: 'Échec de l’envoi. Réessayez',
        errorNetwork: 'Erreur réseau. Réessayez',
        consentRequired: 'Veuillez accepter la politique de confidentialité',
        errNameRequired: 'Le nom est requis',
        errContactRequired: 'Indiquez un téléphone ou un e‑mail',
        errEmailInvalid: 'E‑mail invalide',
        errPhoneInvalid: 'Numéro de téléphone invalide',
        inlineContinue: 'Continuer',
        inlineSkip: 'Passer / à convenir plus tard',
        inlineSend: 'Envoyer',
        inlineCancel: 'Annuler',
        inlineGdprTitle: 'Consentement RGPD',
        inlineContactMethodQ: 'Comment préférez-vous être contacté ?',
        errTimeRequired: 'Sélectionnez la date et l’heure',
        inlineTzHeader: 'Europe/Madrid · 7 prochains jours',
        inlineCtaTitle: 'Je peux prendre vos coordonnées et planifier un appel',
        inlineCtaInline: 'Écrire ici',
        inlineCtaForm: 'Ouvrir le formulaire',
        inlineAlready: 'La collecte est déjà en cours'
      },
      de: {
        openButton: 'Anfrage senden',
        title: 'Anfrage senden',
        nameLabel: 'Name', namePh: 'Ihr Name',
        contactLabel: 'Kontakt (Telefon / WhatsApp / E-Mail)', contactPh: '+34 600 00 00 00 / name@beispiel.com',
        channelLabel: 'Bevorzugter Kontaktweg', optWhatsapp: 'WhatsApp', optPhone: 'Telefon', optEmail: 'E-Mail',
        timeLabel: 'Passende Zeit', today: 'heute', tomorrow: 'morgen',
        noteLabel: 'Kommentar (optional)', notePh: 'Kurze Notiz',
        cancel: 'Abbrechen', submit: 'Senden',
        fillBoth: 'Bitte Name und Kontakt ausfüllen',
        success: 'Danke! Wir melden uns im gewählten Zeitraum',
        errorGeneric: 'Senden fehlgeschlagen. Bitte erneut versuchen',
        errorNetwork: 'Netzwerkfehler. Bitte erneut versuchen',
        consentRequired: 'Bitte akzeptieren Sie die Datenschutzrichtlinie',
        errNameRequired: 'Name ist erforderlich',
        errContactRequired: 'Telefon oder E‑Mail angeben',
        errEmailInvalid: 'E‑Mail ist ungültig',
        errPhoneInvalid: 'Telefonnummer ist ungültig',
        inlineContinue: 'Weiter',
        inlineSkip: 'Überspringen / später abstimmen',
        inlineSend: 'Senden',
        inlineCancel: 'Abbrechen',
        inlineGdprTitle: 'DSGVO-Zustimmung',
        inlineContactMethodQ: 'Wie sollen wir Sie kontaktieren?',
        errTimeRequired: 'Bitte Datum und Uhrzeit wählen',
        inlineTzHeader: 'Europe/Madrid · nächste 7 Tage',
        inlineCtaTitle: 'Ich kann Ihre Kontaktdaten aufnehmen und einen Anruf planen',
        inlineCtaInline: 'Hier schreiben',
        inlineCtaForm: 'Formular öffnen',
        inlineAlready: 'Erfassung läuft bereits'
      },
      it: {
        openButton: 'Invia richiesta',
        title: 'Invia richiesta',
        nameLabel: 'Nome', namePh: 'Il tuo nome',
        contactLabel: 'Contatto (telefono / WhatsApp / e-mail)', contactPh: '+34 600 00 00 00 / nome@esempio.com',
        channelLabel: 'Metodo di contatto preferito', optWhatsapp: 'WhatsApp', optPhone: 'Telefono', optEmail: 'E-mail',
        timeLabel: 'Orario comodo', today: 'oggi', tomorrow: 'domani',
        noteLabel: 'Commento (opzionale)', notePh: 'Nota breve',
        cancel: 'Annulla', submit: 'Invia',
        fillBoth: 'Compila nome e contatto',
        success: 'Grazie! Ti contatteremo nella fascia scelta',
        errorGeneric: 'Invio non riuscito. Riprova',
        errorNetwork: 'Errore di rete. Riprova',
        consentRequired: 'Si prega di accettare l’Informativa sulla privacy',
        errNameRequired: 'Il nome è obbligatorio',
        errContactRequired: 'Indica telefono o e‑mail',
        errEmailInvalid: 'E‑mail non valida',
        errPhoneInvalid: 'Numero di telefono non valido',
        inlineContinue: 'Continua',
        inlineSkip: 'Salta / concordiamo dopo',
        inlineSend: 'Invia',
        inlineCancel: 'Annulla',
        inlineGdprTitle: 'Consenso GDPR',
        inlineContactMethodQ: 'Come preferisci essere contattato?',
        errTimeRequired: 'Seleziona data e ora',
        inlineTzHeader: 'Europe/Madrid · prossimi 7 giorni',
        inlineCtaTitle: 'Posso prendere il tuo contatto e fissare una chiamata',
        inlineCtaInline: 'Scrivi qui',
        inlineCtaForm: 'Apri il form',
        inlineAlready: 'La raccolta è già in corso'
      }
    };
  }

  tLead(key) {
    const dict = this.leadI18n || {};
    const code = this.getLangCode();
    return (dict[code] && dict[code][key]) || (dict.en && dict.en[key]) || '';
  }

  applyLeadI18n() {
    const setText = (sel, text) => { const el = this.shadowRoot.getElementById(sel); if (el) el.textContent = text; };
    const setPh = (sel, text) => { const el = this.shadowRoot.getElementById(sel); if (el) el.setAttribute('placeholder', text); };

    const openBtn = this.shadowRoot.getElementById('btnOpenLead');
    if (openBtn) openBtn.textContent = this.tLead('openButton');

    setText('leadTitle', this.tLead('title'));
    setText('leadNameLabel', this.tLead('nameLabel'));
    setPh('leadName', this.tLead('namePh'));
    setText('leadContactLabel', this.tLead('contactLabel'));
    setText('leadChannelLabel', this.tLead('channelLabel'));
    const optWA = this.shadowRoot.getElementById('optWhatsApp'); if (optWA) optWA.textContent = this.tLead('optWhatsapp');
    const optPh = this.shadowRoot.getElementById('optPhone'); if (optPh) optPh.textContent = this.tLead('optPhone');
    const optEm = this.shadowRoot.getElementById('optEmail'); if (optEm) optEm.textContent = this.tLead('optEmail');
    setText('leadTimeLabel', this.tLead('timeLabel'));
    setText('leadNoteLabel', this.tLead('noteLabel'));
    setPh('leadNote', this.tLead('notePh'));
    const btnCancel = this.shadowRoot.getElementById('leadCancel'); if (btnCancel) btnCancel.textContent = this.tLead('cancel');
    const btnSubmit = this.shadowRoot.getElementById('leadSubmit'); if (btnSubmit) btnSubmit.textContent = this.tLead('submit');

    // Consent text (GDPR)
    const code = this.getLangCode();
    let consentText = '';
    if (code === 'es') {
      consentText = 'Acepto el tratamiento de mis datos para gestionar esta solicitud y contactar conmigo sobre inmuebles.';
    } else if (code === 'ru') {
      consentText = 'Я соглашаюсь на обработку моих данных для обработки этой заявки и связи со мной по вопросам недвижимости.';
    } else {
      consentText = 'I consent to the processing of my data for managing this request and contacting me about properties.';
    }
    const consentEl = this.shadowRoot.getElementById('leadConsentText');
    if (consentEl) {
      consentEl.innerHTML = `${consentText} <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>`;
    }
  }

  populateTimeSlots() {
    const timeSel = this.shadowRoot.getElementById('leadTime');
    if (!timeSel) return;
    const now = new Date();
    const tz = 'Europe/Madrid';
    const locale = this.getLangCode();
    const fmt = (d) => d.toLocaleDateString(locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : locale,
      { weekday:'short', day:'2-digit', month:'2-digit', timeZone: tz });
    const today = fmt(now);
    const tomorrowDate = new Date(now.getTime() + 24*60*60*1000);
    const tomorrow = fmt(tomorrowDate);
    const options = [
      { v: { date: now.toISOString().slice(0,10), from:'17:00', to:'19:00', timezone: tz }, l: `${this.tLead('today')} 17–19 (${today})` },
      { v: { date: now.toISOString().slice(0,10), from:'19:00', to:'21:00', timezone: tz }, l: `${this.tLead('today')} 19–21 (${today})` },
      { v: { date: tomorrowDate.toISOString().slice(0,10), from:'10:00', to:'12:00', timezone: tz }, l: `${this.tLead('tomorrow')} 10–12 (${tomorrow})` },
      { v: { date: tomorrowDate.toISOString().slice(0,10), from:'12:00', to:'14:00', timezone: tz }, l: `${this.tLead('tomorrow')} 12–14 (${tomorrow})` },
    ];
    timeSel.innerHTML = options.map((o, i) => `<option value='${JSON.stringify(o.v)}' ${i===0?'selected':''}>${o.l}</option>`).join('');
  }
  getCurrentState() {
    return {
      ui: this.ui.getCurrentState(),
      recording: this.audioRecorder.isRecording,
      messages: this.messages.length,
      understanding: this.understanding.export()
    };
  }
  isCurrentlyRecording() { return this.ui.isRecording() && this.audioRecorder.isRecording; }
  isIdle() { return this.ui.isIdle() && !this.audioRecorder.isRecording; }

  // очистка сессии (совместимость со старыми вызовами)
  clearSession() {
    try {
      localStorage.removeItem('vw_sessionId');
      localStorage.removeItem('voiceWidgetSessionId');
    } catch {}
    this.sessionId = null;

    this.understanding.reset();
    this.ui.clearMessages();
    this.ui.setState('idle');

    if (this.audioRecorder.isRecording) {
      this.audioRecorder.cancelRecording();
    }

    // Reset to main screen
    this.showMainScreen();
    
    console.log('🗑️ Сессия очищена, sessionId сброшен (ожидаем новый от сервера)');
  }

  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      uiState: this.ui.getCurrentState(),
      isRecording: this.audioRecorder.isRecording,
      messagesCount: this.messages.length,
      understanding: this.understanding.export(),
      dialogStarted: this.dialogStarted
    };
  }

  onStateChange(cb) {
    this.events.on('uiStateChanged', cb);
    this.events.on('understandingUpdated', cb);
    this.events.on('messageReceived', cb);
  }

  disconnectedCallback() {
    // Clean up recording timers
    this.stopRecordingTimer('main');
    this.stopRecordingTimer('chat');
    
    this.audioRecorder?.cleanupRecording?.();
    this.ui?.clearRecordingState?.();
    this.events?.clear?.();
    try { document.removeEventListener('keydown', this._onGlobalKeydown, true); } catch {}
    console.log('👋 Voice Widget disconnected and cleaned up');
  }

  // ===== v2 Menu Overlay integration (UI only) =====
  setupMenuOverlay() {
    // Создаём единый overlay на весь виджет (не привязан к конкретному экрану)
    const container = this.shadowRoot.querySelector('.widget');
    if (!container) return;
    let overlay = this.shadowRoot.querySelector('.menu-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'menu-overlay';
      const content = document.createElement('div');
      content.className = 'menu-overlay-content';
      overlay.appendChild(content);
      container.appendChild(overlay);
    }
    this.updateMenuUI();
    // Навешиваем обработчики на все кнопки меню на текущем экране
    this.shadowRoot.querySelectorAll('.menu-button img').forEach(img => {
      img.onclick = () => {
        if (this._menuState === 'closed' || !this._menuState) this._menuState = 'open';
        else if (this._menuState === 'open') this._menuState = 'closed';
        else if (this._menuState === 'selected') this._menuState = 'open';
        this.updateMenuUI();
      };
    });
  }

  updateMenuUI() {
    const overlay = this.shadowRoot.querySelector('.menu-overlay');
    if (!overlay) return;
    if (this._menuState === 'closed' || !this._menuState) overlay.classList.remove('open'); else overlay.classList.add('open');

    const menuImg = this.shadowRoot.querySelector('.menu-button img');
    const menuBtn = this.shadowRoot.querySelector('.menu-button');
    if (menuImg) menuImg.src = (this._menuState === 'open') ? `${ASSETS_BASE}menu_close_btn.svg` : `${ASSETS_BASE}menu_icon.svg`;
    if (menuBtn) { if (this._menuState !== 'closed' && this._menuState) menuBtn.classList.add('menu-open'); else menuBtn.classList.remove('menu-open'); }

    let content = overlay.querySelector('.menu-overlay-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'menu-overlay-content';
      overlay.appendChild(content);
    }

    if (this._menuState === 'open') {
      content.innerHTML = `
        <div class="menu-grid">
          <div class="menu-col">
            <button class="menu-btn menu-btn--request" data-action="request">Leave request</button>
            <button class="menu-btn menu-btn--support" data-action="support">Support</button>
          </div>
          <div class="menu-col menu-col--middle" style="width:80px; align-items:center; justify-content:center;">
            <button class="menu-close-btn" aria-label="Close menu"><img src="${ASSETS_BASE}menu_close_btn.svg" alt="Close"></button>
          </div>
          <div class="menu-col">
            <button class="menu-btn menu-btn--context" data-action="context">Context</button>
            <button class="menu-btn menu-btn--reset" data-action="reset">Reset session</button>
          </div>
        </div>`;
      const closeBtn = content.querySelector('.menu-close-btn');
      if (closeBtn) closeBtn.onclick = () => { this._menuState = 'closed'; this.updateMenuUI(); };
      content.querySelectorAll('.menu-btn').forEach(btn => {
        btn.onclick = (e) => {
          const action = e.currentTarget.getAttribute('data-action');
          if (action === 'request') { this.showScreen('request'); this._selectedMenu = 'request'; this._menuState = 'selected'; }
          if (action === 'support') { this.showScreen('support'); this._selectedMenu = 'support'; this._menuState = 'selected'; }
          if (action === 'context') { this.showScreen('context'); this._selectedMenu = 'context'; this._menuState = 'selected'; }
          if (action === 'reset') { this.clearSession(); this.showMainScreen(); this._selectedMenu = null; this._menuState = 'closed'; }
          this.updateMenuUI();
        };
      });
    } else if (this._menuState === 'selected') {
      const labelMap = { request: 'Leave request', support: 'Support', context: 'Context' };
      const colorClass = this._selectedMenu === 'request' ? 'menu-badge--request' : this._selectedMenu === 'support' ? 'menu-badge--support' : 'menu-badge--context';
      content.innerHTML = `
        <div class="menu-grid menu-grid--selected">
          <div class="menu-col menu-col--single">
            <button class="menu-link" data-action="back">Back to dialogue</button>
          </div>
          <div class="menu-col menu-col--single menu-col--middle" style="justify-content:center;">
            <button class="menu-close-btn" aria-label="Close menu"><img src="${ASSETS_BASE}menu_close_btn.svg" alt="Close"></button>
          </div>
          <div class="menu-col menu-col--single">
            <div class="menu-badge ${colorClass}">${labelMap[this._selectedMenu] || ''}</div>
          </div>
        </div>`;
      const closeBtn = content.querySelector('.menu-close-btn');
      if (closeBtn) closeBtn.onclick = () => { this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
      const backBtn = content.querySelector('[data-action="back"]');
      if (backBtn) backBtn.onclick = () => { this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
    } else {
      content.innerHTML = '';
    }
  }

  // совместимость
  cleanupAfterSend() { this.audioRecorder.cleanupAfterSend(); }
  updateUnderstanding(i) { this.understanding.update(i); }
  getUnderstanding() { return this.understanding.export(); }
  resetUnderstanding() { this.understanding.reset(); }
  setApiUrl(url) { this.apiUrl = url; if (this.api) this.api.apiUrl = url; try { localStorage.setItem('vw_api_url', url); } catch {} }
  getMessages() { return [...this.messages]; }
  getCurrentSessionId() { return this.sessionId; }
  setUnderstanding(insights) { this.understanding.update(insights); }
}

customElements.define('voice-widget', VoiceWidget);
