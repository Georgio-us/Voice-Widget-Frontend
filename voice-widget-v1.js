// ========================================
/* 📁 voice-widget.js (ОБНОВЛЁННАЯ ВЕРСИЯ v2) */
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
    // (scrim удалён как неиспользуемый)

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

  /* (scroll-bottom-btn и scrim удалены как неиспользуемые) */

  /* Виджет — статичное появление без прыжков */
.widget{
    width:auto;
    height:auto;
    border-radius:20px;
    overflow:visible;
    box-shadow:none;
    position:relative;
    opacity:0;
    transition:opacity .2s ease;
    pointer-events:none;
}

.widget::before,
.widget::after{
    content:none;
}

:host(.open) .widget{
    opacity:1;
    pointer-events:auto;
}
  /* Content */
  .content{ display:flex; flex-direction:column; height:100%; padding:0; gap:0; position:relative; z-index:3; }

  /* Mobile host centering handled by loader (#vw-host); no widget overrides here */

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
  .card-actions-panel{ display:flex; gap:16px; align-items:center; }
  .card-actions-panel .card-btn{ flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; font-size:12px; height:36px; padding:0 18px; border-radius:10px; border:1.25px solid #476AA5; background:transparent; color:#476AA5; font-weight:600; transition:all .2s ease; }
                /* Unify in-process action buttons */
                .card-actions-panel .card-btn{
                  padding: var(--btn-py) var(--btn-px);
                  height: auto;
                  min-width: var(--btn-min-w);
                  border-radius:var(--btn-radius);
                  font: var(--fw-s) var(--fs-btn)/1 var(--ff);
                }
  /* like (filled) */
  .card-actions-panel .card-btn.like{ background:#476AA5; color:#fff; border:1.25px solid #5F81BA; }
  .card-actions-panel .card-btn.like::before{ content:none; }
  .card-actions-panel .card-btn.like{ position:relative; }
  .card-actions-panel .card-btn.like:hover{ transform:translateY(-1px); }
  /* next (outlined) */
  .card-actions-panel .card-btn.next{ background:transparent; color:#476AA5; border:1.25px solid #476AA5; }
  .card-actions-panel .card-btn.next:hover{ opacity:.9; }

  /* ===== Cards Slider ===== */
  .cards-slider{ width:100%; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; position:relative; }
  .cards-track{ display:flex; gap:12px; width:100%; scroll-snap-type:x mandatory; }
  .card-slide{ flex:0 0 100%; scroll-snap-align:start; transition: transform .3s ease, opacity .3s ease; transform: scale(.985); opacity:.95; }
  .card-slide.active{ transform: scale(1); opacity:1; }
  .cards-slider{ scroll-behavior:smooth; scrollbar-width:thin; scrollbar-color: rgba(255,255,255,.02) transparent; }
  .cards-slider::-webkit-scrollbar{ height:3px; }
  .cards-slider::-webkit-scrollbar-track{ background:transparent; }
  .cards-slider::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.02); border-radius:2px; }
  /* dots row inside actions area (blue theme) */
  .cards-dots-row{ display:flex; justify-content:center; gap:8px; margin:4px 0 10px; }
  .cards-dot{ width:12px; height:6px; border-radius:6px; background:#5F81BA; opacity:.5; border:1px solid #476AA5; transition: width .2s ease, opacity .2s ease, background .2s ease; cursor:pointer; }
  .cards-dot.active{ width:24px; background:#476AA5; opacity:1; }
  /* actions container for clearer boundaries */
  .card-actions-wrap{ margin:8px; padding:10px; border:1px solid rgba(71, 105, 165, 0); border-radius:12px; background:rgba(71, 105, 165, 0); }
  .card-slide .cs{ width:100%; }

  /* ===== Inline Lead Bubbles ===== */

  /* Input */
  .input-container{ display:flex; gap:12px; align-items:center; padding:16px; width:360px; height:60px; background:rgba(51,51,51,.7); border-radius:20px; border:1px solid transparent; background-clip:padding-box; position:relative; box-shadow:0 8px 24px rgba(0,0,0,.10); }
 
  
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
                @media (max-width: 450px){
                  /* На мобилках :host не фиксируем — пусть следует флексу #vw-host */
                  :host{
                    position: static;
                    bottom: auto;
                    right: auto;
                  }
                }
                
                /* ========================= */
                /*      Typography tokens    */
                /* ========================= */
                :host {
                  /* family */
                  --ff: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                  /* weights */
                  --fw-r: 400;
                  --fw-m: 500;
                  --fw-s: 600;
                  --fw-b: 700;
                  /* sizes in rem (внутри виджета, без изменения html) */
                  --fs-display: 1.428rem;   /* ~20px */
                  --fs-h1: 1.286rem;        /* ~18px */
                  --fs-h2: 1.143rem;        /* ~16px */
                  --fs-h3: 1rem;            /* 14px */
                  --fs-body: 1rem;          /* 14px */
                  --fs-body-alt: 0.929rem;  /* ~13px */
                  --fs-small: 0.857rem;     /* ~12px */
                  --fs-btn: 0.857rem;       /* ~12px */
                  --fs-micro: 0.714rem;     /* ~10px */
                  /* line-heights */
                  --lh-tight: 1.2;
                  --lh-normal: 1.4;
                  --lh-loose: 1.6;
                  /* spacing tokens (based on 14px root) */
                  --space-xxs: 0.286rem;   /* ~4px */
                  --space-xs:  0.571rem;   /* ~8px */
                  --space-s:   0.714rem;   /* ~10px */
                  --space-m:   0.857rem;   /* ~12px */
                  --space-l:   1.143rem;   /* ~16px */
                  --space-xl:  1.714rem;   /* ~24px */
                  --space-xxl: 4.286rem;   /* ~60px */
                  /* unified action button sizes (rem) based on 14px scale */
                 
                  --btn-radius: 0.714rem;   /* ~10px */
                  --btn-px: 1.143rem;       /* ~16px horizontal padding */
                  --btn-py: 0.857rem;       /* ~12px vertical padding */
                  --btn-min-w: 7.143rem;    /* ~100px min width */
                  /* form field height */
                  --field-h: 2.5rem;        /* ~35px */
                  /* context progress ring */
                  --ring: clamp(72px, 26vw, 100px);
                  /* iOS text zoom handling */
                  -webkit-text-size-adjust: 100%;
                  text-size-adjust: 100%;
                }
                /* Base font normalization to ensure consistent typography across screens */
                :host { font-family: var(--ff); }
                .voice-widget-container { font-family: var(--ff); }
                button, input, select, textarea { font-family: inherit; }
                /* Ensure chips and property card inherit widget font */
                .support-issue-chip { font-family: var(--ff); }
                .property-card { font-family: var(--ff); }
                /* semantic text classes */
                .text-display { font: var(--fw-s) var(--fs-display)/var(--lh-tight) var(--ff); }
                .text-h1      { font: var(--fw-s) var(--fs-h1)/var(--lh-tight) var(--ff); }
                .text-h2      { font: var(--fw-s) var(--fs-h2)/var(--lh-tight) var(--ff); }
                .text-h3      { font: var(--fw-s) var(--fs-h3)/var(--lh-normal) var(--ff); }
                .text-body    { font: var(--fw-r) var(--fs-body)/var(--lh-normal) var(--ff); }
                .text-body-alt{ font: var(--fw-r) var(--fs-body-alt)/var(--lh-normal) var(--ff); }
                .text-small   { font: var(--fw-r) var(--fs-small)/var(--lh-normal) var(--ff); }
                .text-micro   { font: var(--fw-r) var(--fs-micro)/var(--lh-loose) var(--ff); opacity:.85; }
                /* placeholder helpers (назначаются на input/textarea) */
                .placeholder-main::placeholder  { font: var(--fw-r) var(--fs-h3)/1 var(--ff); opacity:.65; }
                .placeholder-field::placeholder { font: var(--fw-r) var(--fs-small)/1 var(--ff); opacity:.65; }
                /* buttons text */
                .btn-text-primary   { font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                .btn-text-secondary { font: var(--fw-s) var(--fs-btn)/1 var(--ff); opacity:.95; }
                /* color helpers */
                .text-primary  { color:#FFFFFF; }
                .text-secondary{ color:#C3C3C3; }
                .text-hint     { color:#A9A9A9; }
                .text-accent   { color:#DF87F8; }
                
                .voice-widget-container {
                    width: clamp(320px, 92vw, 380px);
                    height: clamp(560px, 88vh, 720px);
                    background: #171618;
                    background-image: url('./assets/Net_lights.svg');
                    background-repeat: no-repeat;
                    background-position: center;
                    background-size: cover;
                    border-radius: 20px;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 16px;
                    box-sizing: border-box;
                    gap: 12px;
                }
                
                /* Main screen sections */
                .main-header{ width:100%; max-width:360px; display:flex; flex-direction:column; align-items:center; gap:20px; padding: 15px }
                .main-center{ flex:1; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
                .main-hero{ width:100%; display:flex; justify-content:center; }
                .main-copy{ width:100%; max-width:360px; text-align:center; }
                
                /* Логотип */
                .logo {
                    width: auto;
                    height: auto;
                    margin-top: 8px;
                    align-self: center;
                }
                
                /* Декоративная градиентная линия */
                .gradient-line {
                    width: 100%;
                    max-width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0) 100%);
                    margin: 4px auto 0;
                }
                
                /* Кнопка микрофона */
                .mic-button {
                    width: clamp(80px, 28vw, 100px);
                    height: clamp(80px, 28vw, 100px);
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
                
                .mic-button:hover { transform: scale(1.05); }
                .mic-button:focus, .mic-button:focus-visible { outline: none; box-shadow: none; }
                .mic-button::-moz-focus-inner { border: 0; }
                
                /* Тексты под кнопкой */
                .text-container { text-align: center; margin-top: 8px; }
                
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
                    width: 100%;
                    max-width: 360px;
                    height: 60px;
                    background:
                      linear-gradient(#2B272C, #2B272C) padding-box,
                      linear-gradient(90deg, #5C7FE2 0%, #F05A4F 33%, #EDA136 66%, #1C7755 100%) border-box;
                    border: 1px solid transparent;
                    border-radius: 40px;
                    display: flex;
                    align-items: center;
                    padding: 0 10px;
                    box-sizing: border-box;
                    margin: var(--space-xxl) 0 var(--space-s) 0;
                }
                
                /* Dialogue screen layout: keep history scrollable and input at the bottom */
                .dialog-screen .voice-widget-container{ display:flex; flex-direction:column; }
                .dialog-screen .dialogue-container{
                    /* override legacy absolute layout */
                    position: static; top: auto; left: auto; right: auto; bottom: auto;
                    width: 100%; max-width: 360px; margin: 0 auto;
                    flex:1; min-height:0; overflow-y:auto; overflow-x:hidden;
                }
                .dialog-screen .input-container{
                    margin: auto 0 var(--space-s) 0; /* top:auto pushes input to bottom */
                }
                
                /* Make other v2 screens scrollable within widget bounds */
                .context-screen .voice-widget-container,
                .request-screen .voice-widget-container,
                .support-screen .voice-widget-container{
                    display:flex;
                    flex-direction:column;
                }
                .context-screen .context-main-container,
                .request-screen .request-main-container,
                .support-screen .support-main-container{
                    flex:1;
                    min-height:0;
                    overflow-y:auto; overflow-x:hidden;
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
                /* Multiline support for textarea inputs */
                textarea.input-field{
                    width:100%;
                    height:auto;
                    min-height:18px;
                    max-height:100px;
                    line-height:1.3;
                    resize:none;
                    overflow-y:auto; /* скроллим, но прячем полосу */
                    padding-top:8px;
                    padding-bottom:8px;
                    /* скрыть полосы прокрутки во всех движках */
                    scrollbar-width: none;          /* Firefox */
                    -ms-overflow-style: none;       /* IE/Edge */
                }
                textarea.input-field::-webkit-scrollbar{
                    width:0; height:0;             /* WebKit */
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
                .screen-header{
                    width:100%; max-width:360px; height:60px; margin:0 auto;
                    display:grid; place-items:center; position:relative; z-index:2;
                }
                .menu-button {
                    position: absolute;
                    top: 25px;
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
                /* inside header we use normal flow (no absolute) */
                .screen-header .menu-button{ position: static; top:auto; left:auto; transform:none; z-index: 3; grid-area:1/1; }
                .menu-button img { transition: transform 0.15s ease, opacity 0.15s ease; }
                .menu-button:hover img { transform: scale(1.08); opacity: 0.85; }
                /* При открытом меню центрируем кнопку по вертикали в зоне overlay (100px, padding-top 15px => центр на 50px) */
                .menu-button.menu-open {
                    top: 50px;
                    transform: translate(-50%, -50%);
                }
                .screen-header .menu-button.menu-open{ top:auto; transform:none; }
                .menu-button.hidden{ display:none; }
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
                /* Thin scrollbar for other scrollable screens */
                .context-main-container::-webkit-scrollbar,
                .request-main-container::-webkit-scrollbar,
                .support-main-container::-webkit-scrollbar{ width:2px; }
                .context-main-container::-webkit-scrollbar-track,
                .request-main-container::-webkit-scrollbar-track,
                .support-main-container::-webkit-scrollbar-track{ background:transparent; }
                .context-main-container::-webkit-scrollbar-thumb,
                .request-main-container::-webkit-scrollbar-thumb,
                .support-main-container::-webkit-scrollbar-thumb{
                    background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.5) 20%,rgba(100,100,100,.5) 80%,transparent 100%);
                    border-radius:1px;
                }
                .context-main-container::-webkit-scrollbar-thumb:hover,
                .request-main-container::-webkit-scrollbar-thumb:hover,
                .support-main-container::-webkit-scrollbar-thumb:hover{
                    background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.7) 20%,rgba(100,100,100,.7) 80%,transparent 100%);
                }
                .context-main-container,
                .request-main-container,
                .support-main-container{ scrollbar-width:thin; scrollbar-color:rgba(100,100,100,.5) transparent; }
                
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
                    position: static;
                    width: 100%;
                    max-width: 360px;
                    margin: var(--space-l) auto 0;
                    padding: 0 var(--space-l);
                    text-align: center;
                }
                
                .progress-grid-container {
                    display: grid;
                    grid-template-columns: minmax(0,1fr) var(--ring) minmax(0,1fr);
                    align-items: center;
                    gap: var(--space-s);
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
                    width: var(--ring);
                    height: var(--ring);
                }
                
                .progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: clamp(0.857rem, 2.8vw, 1.286rem);
                    font-weight: 400;
                    color: #FFFFFF;
                }
                
                .data-storage-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: var(--fs-micro);
                    font-weight: 400;
                    color: #A9A9A9;
                    cursor: pointer;
                    transition: transform .15s ease, opacity .15s ease;
                }
                .data-storage-text:hover{ transform: scale(1.1); opacity:.9; }
                
                /* Data storage popup */
                .data-overlay{ position:absolute; inset:0; background:rgba(0,0,0,.45); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display:none; align-items:center; justify-content:center; z-index:20; }
                .data-modal{ width: calc(100% - 40px); max-width:320px; border-radius:16px; background:rgba(23,22,24,.95); border:1px solid rgba(106,108,155,.30); padding:16px; color:#FFFFFF; text-align:center; }
                .data-title{ font-size:14px; font-weight:600; margin:0 0 8px 0; text-align:center; }
                .data-body{ font-size:12px; font-weight:400; color:#C3C3C3; line-height:1.5; }
                .data-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:#476AA5; color:#fff; border:1.25px solid #5F81BA; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; margin:14px auto 0; display:flex; align-items:center; justify-content:center; }
                .data-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                
                .status-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: var(--fs-micro);
                    font-weight: 400;
                    color: #e85f62;
                    margin-bottom: var(--space-xl);
                }
                
                .main-message {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    color: #FFFFFF;
                    line-height: 1.4;
                    margin-bottom: var(--space-m);
                }
                
                .context-gradient-line {
                    width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(to right, rgba(90, 127, 227, 0.1), rgba(232, 95, 98, 1), rgba(85, 122, 219, 0.1))
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
                    /* thematic color */
                    padding: var(--btn-py) var(--btn-px);
                    min-width: var(--btn-min-w);
                    background: #e85f62;
                    border: none;
                    border-radius: var(--btn-radius);
                    color: #FFFFFF;
                    font: var(--fw-s) var(--fs-btn)/1 var(--ff);
                    cursor: pointer;
                    transition: opacity 0.3s ease;
                }
                
                .context-leave-request-btn:hover {
                    opacity: 0.8;
                }
                
                /* ===== Context: inline request form ===== */
                .ctx-request-form{ display:none; margin-top:16px; }
                .ctx-field{ margin-bottom: var(--space-m); text-align:left; }
                /* compact row for contact fields */
                .ctx-row{ display:flex; gap: var(--space-s); align-items: center; }
                .ctx-row .ctx-input{ flex:1 1 0; min-width:0; }
                .ctx-input{ width:100%; height: var(--field-h); border-radius:10px; background:rgba(106,108,155,.10); border:1px solid rgba(106,108,155,.30); color:#FFFFFF; font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size:12px; font-weight:400; padding:0 var(--space-s); line-height: var(--field-h); box-sizing:border-box; transition: border-color .15s ease; }
                .ctx-input.error{ border-color:#E85F62; }
                .ctx-input:focus,
                .ctx-input:focus-visible{ outline:none; border-width:1px; border-color:#5F81BA; box-shadow:none; }
                .ctx-textarea{ width:100%; min-height:80px; border-radius:10px; background:rgba(106,108,155,.10); border:1px solid rgba(106,108,155,.30); color:#FFFFFF; font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size:12px; font-weight:400; padding:10px; resize:vertical; box-sizing:border-box; }
                .ctx-textarea{ overflow-y:auto; scrollbar-width: none; -ms-overflow-style: none; }
                .ctx-textarea::-webkit-scrollbar{ width:0; height:0; }
                .ctx-textarea:focus,
                .ctx-textarea:focus-visible{ outline:none; border-width:1px; border-color:#5F81BA; box-shadow:none; }
                .ctx-textarea.error{ border-color:#E85F62; }
                .ctx-consent{ display:flex; align-items:flex-start; gap:8px; margin-top:6px; }
                .ctx-consent .ctx-checkbox{ width:12px; height:12px; margin-top:2px; }
                .ctx-consent .ctx-consent-text{ font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size:10px; font-weight:400; color:#C4C4C4; line-height:1.4; }
                .ctx-consent .ctx-privacy-link{ color:#DF87F8; text-decoration:none; }
                .ctx-checkbox.error{ outline:2px solid #E85F62; border-radius:3px; }
                .ctx-error{ display:none; color:#E85F62; font-size:12px; margin-top:6px; }
                .ctx-error.visible{ display:block; }
                .ctx-actions{ display:flex; gap: var(--space-m); justify-content: space-between; margin-top: var(--space-m); }
                .ctx-send-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:#476AA5; color:#fff; border:1.25px solid #5F81BA; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; }
                .ctx-cancel-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:transparent; color:#476AA5; border:1.25px solid #476AA5; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; }
                .ctx-actions .ctx-send-btn, .ctx-actions .ctx-cancel-btn{ flex:1 1 0; min-width:0; }
                .ctx-send-btn, .ctx-cancel-btn, .ctx-done-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                
                /* thanks block after send */
                .ctx-thanks{ display:none; margin-top:16px; text-align:center; }
                .ctx-thanks-title{ font-size:14px; font-weight:600; color:#FFFFFF; margin-bottom:6px; }
                .ctx-thanks-text{ font-size:12px; font-weight:400; color:#C4C4C4; }
                .ctx-thanks .ctx-done-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:#476AA5; color:#fff; border:1.25px solid #5F81BA; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; margin-top:14px; }
                
                .footer-text {
                    position: relative;
                    margin: 0 auto;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #A9A9A9;
                    text-align: center;
                    cursor: pointer;
                    transition: transform .15s ease, opacity .15s ease;
                }
                .footer-text:hover{ transform: translateX(-50%) scale(1.1); opacity:.9; }
                
                /* Декоративная линия для ContextScreen */
                .context-gradient-line {
                    width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0.1) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0.1) 100%);
                    margin: var(--space-l) 0;
                }
                
                /* ========================= */
                /*        Support Screen     */
                /* ========================= */
                .support-main-container {
                    position: static;
                    width: 100%;
                    max-width: 360px;
                    margin: var(--space-l) auto 0;
                    padding: 0 var(--space-l);
                }
                
                .support-faq-title {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px;
                    font-weight: 400;
                    color: #EDCF23;
                    text-align: left;
                }
                
                .support-faq-list {
                    margin-top: var(--space-m);
                }
                .support-faq-list.disabled{ opacity:.5; pointer-events:none; }
                
                .support-faq-item {
                    margin-bottom: var(--space-m);
                    border: 1px solid rgba(237, 207, 34, 0.38);
                    border-radius: 10px;
                    background: rgba(106,108,155,0.06);
                    overflow: hidden;
                }
                
                .support-faq-question {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    color: #FFFFFF;
                    padding: 10px 12px;
                    cursor: pointer;
                }
                
                .support-faq-question::before {
                    content: '';
                }
                .support-faq-question .faq-caret{
                    width: 10px; height: 10px; border-right: 2px solid #A0A0A0; border-bottom: 2px solid #A0A0A0; transform: rotate(45deg); transition: transform .2s ease, opacity .2s ease;
                }
                .support-faq-item.open .support-faq-question .faq-caret{ transform: rotate(225deg); }
                
                .support-faq-answer {
                    display: none;
                    padding: 10px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 11px;
                    font-weight: 300;
                    color: #C3C3C3;
                }
                .support-faq-item.open .support-faq-answer{ display:block; }
                
                .support-gradient-line {
                    width: 100%;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(to right, rgba(90, 127, 227, 0.1), rgba(237, 207, 34, 1), rgba(85, 122, 219, 0.1));
                    margin: var(--space-l) 0;
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
                    padding: var(--btn-py) var(--btn-px);
                    min-width: var(--btn-min-w);
                    margin-top: 25px;
                    background: #EDCF23;
                    border: none;
                    border-radius: var(--btn-radius);
                    color: #3B3B3B;
                    font: var(--fw-s) var(--fs-btn)/1 var(--ff);
                    cursor: pointer;
                    transition: opacity 0.3s ease;
                }
                
                .support-contact-btn:hover {
                    opacity: 0.9;
                }
                
                /* Support form */
                .support-form{ display:none; margin-top:16px; }
                .support-form > * + *{ margin-top:10px; }
                .support-issues{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; margin-top: 25px; }
                .support-issue-chip{ padding:6px 10px; border-radius:10px; border:1px solid #476AA5; background:transparent; color:#fff; font-size:10px; font-weight:400; cursor:pointer; }
                .support-issue-chip:hover{ opacity:.9; }
                .support-issue-chip.active{ background:#476AA5; color:#fff; border-color:#5F81BA; }
                .support-textarea{ width:100%; min-height:80px; border-radius:10px; background:rgba(106,108,155,.10); border:1px solid rgba(106,108,155,.30); color:#FFFFFF; font-family:'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size:12px; font-weight:400; padding:10px; box-sizing:border-box; resize:vertical; transition: border-color .15s ease; }
                .support-textarea:focus,
                .support-textarea:focus-visible{
                  outline: none;
                  border-width: 1px;
                  border-color: #5F81BA;
                  box-shadow: none;
                }
                .support-textarea{ overflow-y:auto; scrollbar-width: none; -ms-overflow-style: none; }
                .support-textarea::-webkit-scrollbar{ width:0; height:0; }
                
                .support-actions{ display:flex; gap:20px; justify-content: space-between; margin-top:20px; }
                .support-send-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:#476AA5; color:#fff; border:1.25px solid #5F81BA; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; }
                .support-cancel-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:transparent; color:#476AA5; border:1.25px solid #476AA5; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; }
                .support-actions .support-send-btn, .support-actions .support-cancel-btn{ flex:1 1 0; min-width:0; }
                .support-send-btn, .support-cancel-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                
                /* Support thanks */
                .support-thanks{ display:none; margin-top:16px; text-align:center; }
                .support-thanks-title{ font-size:14px; font-weight:600; color:#FFFFFF; margin-bottom:6px; }
                .support-thanks-text{ font-size:12px; font-weight:400; color:#C4C4C4; }
                .support-done-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:#476AA5; color:#fff; border:1.25px solid #5F81BA; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; margin-top:14px; }
                .support-done-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                
                .support-footer-text {
                    position: relative;
                    margin: 0 auto;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px;
                    font-weight: 400;
                    color: #A9A9A9;
                    text-align: center;
                    cursor: pointer;
                    transition: transform .15s ease, opacity .15s ease;
                }
                .support-footer-text:hover{ transform: translateX(-50%) scale(1.1); opacity:.9; }
                
                /* ========================= */
                /*        Request Screen     */
                /* ========================= */
                /* iOS: предотвратить zoom при фокусе на полях (минимум 16px) */
                @supports (-webkit-touch-callout: none) {
                  .input-field,
                  .request-input,
                  .ctx-input,
                  .request-select,
                  .request-textarea,
                  .ctx-textarea,
                  .support-textarea,
                  .dial-btn {
                    font-size: 16px;
                  }
                }
                .request-main-container {
                    position: static;
                    width: 100%;
                    max-width: 360px;
                    margin: var(--space-l) auto 0 auto;
                    padding: 0 var(--space-l);
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
                    height: var(--field-h);
                    border-radius: 10px;
                    background: rgba(106, 108, 155, 0.10);
                    border: 1px solid rgba(106, 108, 155, 0.30);
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    padding-left: var(--space-s);
                    line-height: var(--field-h);
                    box-sizing: border-box;
                    transition: border-color .15s ease;
                }
                .request-input.error{ border-color:#E85F62; }
                .request-input:focus,
                .request-input:focus-visible{ outline:none; border-width:1px; border-color:#5F81BA; box-shadow:none; }
                
                
                .request-input::placeholder {
                    color: #A0A0A0;
                }
                
                .request-row {
                    display: flex;
                    gap: var(--space-s);
                    margin-bottom: 10px;
                }
                /* Dial code select */
                .dial-select{ position:relative; }
                .dial-btn{ display:flex; align-items:center; justify-content:center; gap:6px; padding: 0 .75rem; height:var(--field-h); line-height:var(--field-h); border-radius:10px; background:rgba(106,108,155,.10); border:1px solid rgba(106,108,155,.30); color:#FFFFFF; cursor:pointer; }
                .dial-flag{ font-size:14px; line-height:1; }
                .dial-code{ font-size:12px; }
                .dial-list{ position:absolute; top: calc(var(--field-h) + var(--space-xxs)); left:0; right:auto; min-width:120px; background:#1e1d20; border:1px solid rgba(106,108,155,.30); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.25); padding:6px; display:none; z-index:30; }
                .dial-item{ display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; cursor:pointer; color:#FFFFFF; font-size:12px; }
                .dial-item:hover{ background:rgba(106,108,155,.15); }
                .request-error{ display:none; color:#E85F62; font-size:12px; margin-top:6px; }
                .request-error.visible{ display:block; }
                .request-checkbox.error{ outline:2px solid #E85F62; border-radius:3px; }
                
                /* Email suggest chip */
                .email-suggest{ display:none; margin-top:6px; }
                .email-suggest .chip{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:10px; border:1px solid #476AA5; color:#476AA5; font-size:12px; font-weight:600; cursor:pointer; background:transparent; }
                .email-suggest .chip:hover{ background:rgba(71,106,165,.12); }
                /* Inline email ghost (completion inside input) */
                .email-wrap{ position:relative; }
                .email-wrap .email-ghost{
                  position:absolute; top:0; left:0;
                  padding-left: var(--space-s); height: var(--field-h); line-height: var(--field-h);
                  color: rgba(255,255,255,.35);
                  pointer-events:none; cursor:default; 
                  white-space:nowrap; overflow:hidden;
                  z-index:2;
                  font: inherit;
                  display:none;
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
                    height: var(--field-h);
                    border-radius: 10px;
                    background: rgba(106, 108, 155, 0.10);
                    border: 1px solid rgba(106, 108, 155, 0.30);
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px;
                    font-weight: 400;
                    padding: 0 var(--space-s);
                    box-sizing: border-box;
                    cursor: pointer;
                }
                .request-select:hover{ background: rgba(106,108,155,0.14); }
                .request-select-list{ display:none; margin-top:6px; background:#1e1d20; border:1px solid rgba(106,108,155,.30); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.25); padding:6px; }
                .request-select-item{ display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; cursor:pointer; color:#FFFFFF; font-size:12px; }
                .request-select-item:hover{ background:rgba(106,108,155,.15); }
                
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
                    transition: border-color .15s ease;
                    resize: vertical;
                    box-sizing: border-box;
                }
                .request-textarea{ overflow-y:auto; scrollbar-width: none; -ms-overflow-style: none; }
                .request-textarea::-webkit-scrollbar{ width:0; height:0; }
                .request-textarea:focus,
                .request-textarea:focus-visible{ outline:none; border-width:1px; border-color:#5F81BA; box-shadow:none; }
                .request-textarea.error{ border-color:#E85F62; }
                
                .request-textarea::placeholder {
                    color: #A0A0A0;
                }
                
                .request-actions-container {
                    width: 100%;
                    padding: 0;
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
                    padding: var(--btn-py) var(--btn-px);
                    min-width: var(--btn-min-w);
                    border-radius: var(--btn-radius);
                    font: var(--fw-s) var(--fs-btn)/1 var(--ff);
                    cursor: pointer;
                }
                .request-buttons .request-send-btn, .request-buttons .request-cancel-btn{ flex:1 1 0; min-width:0; }
                
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
                    position: static;              /* внутри header, без абсолютов */
                    width: 100%;
                    height: 60px;                  /* высота шапки */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;          /* активируем в .open */
                    z-index: 1;
                    grid-area:1/1;                 /* накладываемся на ту же ячейку, что и кнопка */
                }
                .menu-overlay::before {
                    content: none;
                }
                .menu-overlay.open {
                    pointer-events: auto;
                }
                .menu-overlay.open::before {
                    opacity: 0;
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

                /* ===== Human contact popup ===== */
                .human-overlay{ position:absolute; inset:0; background:rgba(0,0,0,.45); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display:none; align-items:center; justify-content:center; z-index:20; }
                .human-modal{ width: calc(100% - 40px); max-width:320px; border-radius:16px; background:rgba(23,22,24,.95); border:1px solid rgba(106,108,155,.30); padding:16px; color:#FFFFFF; text-align:center; }
                .human-title{ font-size:14px; font-weight:600; margin:0 0 8px 0; }
                .human-timer{ font-size:18px; font-weight:700; color:#EDCF23; margin:6px 0 10px 0; letter-spacing:.5px; }
                .human-note{ font-size:12px; color:#C3C3C3; margin:0 0 14px 0; }
                .human-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:#476AA5; color:#fff; border:1.25px solid #5F81BA; border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; margin:0 auto; display:inline-flex; align-items:center; justify-content:center; }
                .human-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
  </style>

  <!-- COMPAT: v1 chat/details minimal support (do not remove until full v2 wiring) -->
  <style>
  /* COMPAT-V1: Чат — прокрутка контейнеров (v2: переносим на dialogue-container) */
  .dialogue-container{ overflow-y:auto; overflow-x:hidden; }
  .thread{ display:flex; flex-direction:column; }

  /* COMPAT-V1: Лоадер поверх чата */
  #loadingIndicator{ position:absolute; display:none; }
  #loadingIndicator.active{ display:flex; }

    /* === Mobile height fix v3: стабильная карточка + адекватный скролл === */

  /* 1) На мобилках задаём минимальную и максимальную высоту.
        Это возвращает “карточный” вид: не схлопывается по контенту. */
  @media (max-width: 450px) {
    .voice-widget-container {
      min-height: 560px;   /* как в твоём clamp, нижняя граница */
      max-height: 720px;   /* верхняя граница, чтобы не раздувалось бесконечно */
    }

   
  }

  /* 2) Если браузер умеет 100svh (iOS 16+/18, новые Chrome/Android),
        то подменяем высоту карточки на “экран минус отступы”. */
  @supports (height: 100svh) {
    @media (max-width: 450px) {
      .voice-widget-container {
        /* Карточка занимает экран по высоте, но не больше 720
           и не меньше 560, чтобы не была крошечной. */
        height: min(720px, max(560px, calc(100svh - 40px)));
      }
    }
  }

  /* Page dim overlay (site dim when widget is open) */
  .page-dim{
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.35);
    opacity: 0;
    pointer-events: none; /* включим на мобайле из JS для тапа-вне */
    transition: opacity .2s ease;
    z-index: 2;
  }
  :host(.open) .page-dim{ opacity: 1; }
  
  /* Image lightbox (fullscreen image viewer) */
  .img-lightbox{
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.9);
    z-index: 10002; /* above widget and launcher */
  }
  .img-lightbox.open{ display:flex; }
  .img-lightbox img{
    max-width: 96vw;
    max-height: 96vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0,0,0,.5);
    background: #111;
  }



  </style>

  <!-- Launcher -->
  <button class="launcher" id="launcher" title="Спросить голосом" aria-label="Спросить голосом">
    <img src="${ASSETS_BASE}MicBig.png" alt="Voice" />
  </button>

  <!-- Page dim overlay -->
  <div class="page-dim" id="pageDim" aria-hidden="true"></div>
  
  <!-- Image lightbox overlay -->
  <div class="img-lightbox" id="imgLightbox" aria-hidden="true">
    <img id="imgLightboxImg" alt="">
  </div>

  

  <div class="widget" role="dialog" aria-modal="true" aria-label="Voice Assistant">
    <!-- Header removed for v2 UI -->

    <!-- Content -->
    <div class="content">
      <!-- Main Screen -->
      <div class="main-screen" id="mainScreen">
        <div class="voice-widget-container">
            <div class="main-header">
              <img src="${ASSETS_BASE}LOGO.svg" alt="VIA.AI" class="logo">
              <div class="gradient-line"></div>
            </div>
            <div class="main-center">
              <div class="main-hero">
                <button class="mic-button" id="mainButton" aria-pressed="false">
                    <img src="${ASSETS_BASE}MicBig.png" alt="Microphone" style="width: 100%; height: 100%;">
                </button>
              </div>
              <div class="main-copy">
                <div class="text-container">
                    <p class="main-text">Press to speak</p>
                    <p class="sub-text">Voice Intelligent Assistance</p>
                </div>
              </div>
            </div>
        <div class="input-container">
          <div class="text-input-wrapper">
                    <textarea id="mainTextInput" class="input-field" rows="1" placeholder="Write your request..."></textarea>
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
          <div class="screen-header">
            <div class="menu-button">
              <img src="${ASSETS_BASE}menu_icon.svg" alt="Menu" style="width: 32px; height: 32px;">
            </div>
          </div>
          <div class="dialogue-container" id="messagesContainer">
              <div class="thread" id="thread"></div>
        </div>
          <div class="loading dialog-overlay" id="loadingIndicator"><span class="loading-text">Обрабатываю запрос <span class="dots"><span class="d1">•</span><span class="d2">•</span><span class="d3">•</span></span></span></div>
        <div class="input-container">
          <div class="text-input-wrapper">
              <textarea id="textInput" class="input-field" rows="1" placeholder="Write your request..."></textarea>
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
          <div class="screen-header">
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
                  <div class="progress-text" id="ctxProgressText">99%</div>
            </div>
          </div>
              <div class="grid-column-right">
                <div class="data-storage-text">Data storage & encrypting</div>
          </div>
            </div>
            <div class="status-text" id="ctxStatusText">Status: fulfilled</div>
            <div class="main-message" id="ctxStageMessage">Well done! You've fulfilled the system with the data that will make search much closer to your goal!</div>
            <div class="context-gradient-line"></div>
            <div class="hint-text">You can leave the request to make manager start working by your case immediately</div>
            <div class="context-leave-request-button"><button class="context-leave-request-btn" id="ctxLeaveReqBtn">Leave request</button></div>
            <div class="ctx-request-form" id="ctxRequestForm">
              <div class="ctx-field">
                <input class="ctx-input" id="ctxName" type="text" placeholder="Name">
              </div>
              <div class="ctx-field ctx-row">
                <div class="dial-select">
                  <button class="dial-btn" type="button" id="ctxDialBtn"><span class="dial-flag">🇪🇸</span><span class="dial-code">+34</span></button>
                  <div class="dial-list" id="ctxDialList">
                    <div class="dial-item" data-cc="ES" data-code="+34"><span class="dial-flag">🇪🇸</span><span class="dial-code">+34 ES</span></div>
                    <div class="dial-item" data-cc="FR" data-code="+33"><span class="dial-flag">🇫🇷</span><span class="dial-code">+33 FR</span></div>
                    <div class="dial-item" data-cc="DE" data-code="+49"><span class="dial-flag">🇩🇪</span><span class="dial-code">+49 DE</span></div>
                    <div class="dial-item" data-cc="UA" data-code="+380"><span class="dial-flag">🇺🇦</span><span class="dial-code">+380 UA</span></div>
                    <div class="dial-item" data-cc="RU" data-code="+7"><span class="dial-flag">🇷🇺</span><span class="dial-code">+7 RU</span></div>
                    <div class="dial-item" data-cc="PL" data-code="+48"><span class="dial-flag">🇵🇱</span><span class="dial-code">+48 PL</span></div>
                    <div class="dial-item" data-cc="UK" data-code="+44"><span class="dial-flag">🇬🇧</span><span class="dial-code">+44 UK</span></div>
                  </div>
                </div>
                <input class="ctx-input" id="ctxPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Phone">
              </div>
              <div class="ctx-field">
                <div class="email-wrap">
                  <input class="ctx-input" id="ctxEmail" type="email" autocomplete="email" placeholder="E-mail">
                  <span class="email-ghost" id="ctxEmailGhost"></span>
                </div>
              </div>
              <input type="hidden" id="ctxCode" value="+34" />
              <div class="ctx-error" id="ctxContactError">Please provide phone or email</div>
              <div class="ctx-field">
                <label class="ctx-consent">
                  <input class="ctx-checkbox" id="ctxConsent" type="checkbox">
                  <span class="ctx-consent-text">I consent to the processing of my data for managing this request and contacting me about properties. <a class="ctx-privacy-link" href="#">Privacy Policy</a></span>
                </label>
              </div>
              <div class="ctx-error" id="ctxConsentError">Please accept the Privacy Policy</div>
              <div class="ctx-actions">
                <button class="ctx-send-btn" id="ctxSendBtn">Send</button>
                <button class="ctx-cancel-btn" id="ctxCancelBtn">Cancel</button>
              </div>
            </div>
            <div class="ctx-thanks" id="ctxThanks">
              <div class="ctx-thanks-title">Thank you!</div>
              <div class="ctx-thanks-text">Your request has been received. We’ll contact you soon.</div>
              <button class="ctx-done-btn" id="ctxThanksDoneBtn">Close</button>
            </div>
              <!-- Context Thanks Popup -->
              <div class="data-overlay" id="ctxThanksOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Thank you!</div>
                  <div class="data-body">Your request has been received. We’ll contact you soon.</div>
                  <button class="data-btn" id="ctxThanksOverlayClose">Close</button>
                </div>
              </div>
            <!-- What data do we know popup -->
            <div class="data-overlay" id="whatDataOverlay" style="display:none;">
              <div class="data-modal">
                <div class="data-title">What data do we know?</div>
                <div class="data-body" id="whatDataBody">
                  <!-- filled dynamically from insights -->
                </div>
                <button class="data-btn" id="whatDataUnderstoodBtn">Understood</button>
              </div>
            </div>
            <!-- Data storage popup -->
            <div class="data-overlay" id="dataOverlay" style="display:none;">
              <div class="data-modal">
                <div class="data-title">Data storage & encrypting</div>
                <div class="data-body">
                  We store your data on secure EU-based servers. Data in transit is protected with modern TLS and HSTS; data at rest is encrypted (AES‑256). Access is strictly limited and audited. We never sell your personal information. You can request deletion at any time via Support.
                </div>
                <button class="data-btn" id="dataUnderstoodBtn">Understood</button>
              </div>
            </div>
          </div>
          <div class="footer-text">What data do we know?</div>
            </div>
          </div>

      <!-- Request Screen (v2) -->
      <div class="request-screen hidden" id="requestScreen">
        <div class="voice-widget-container">
          <div class="screen-header">
          </div>
          <div class="request-main-container">
            <div class="request-title">Leave a request</div>
            <div class="request-field">
              <div class="request-field-label">Name</div>
              <input class="request-input" id="reqName" type="text" placeholder="Your name" autocomplete="off" />
      </div>
            <div class="request-field">
              <div class="request-field-label">Contact (phone/ WhatsApp/ e-mail)</div>
              <div class="request-row">
                <div class="dial-select">
                  <button class="dial-btn" type="button" id="reqDialBtn"><span class="dial-flag">🇪🇸</span><span class="dial-code">+34</span></button>
                  <div class="dial-list" id="reqDialList">
                    <div class="dial-item" data-cc="ES" data-code="+34"><span class="dial-flag">🇪🇸</span><span class="dial-code">+34 ES</span></div>
                    <div class="dial-item" data-cc="FR" data-code="+33"><span class="dial-flag">🇫🇷</span><span class="dial-code">+33 FR</span></div>
                    <div class="dial-item" data-cc="DE" data-code="+49"><span class="dial-flag">🇩🇪</span><span class="dial-code">+49 DE</span></div>
                    <div class="dial-item" data-cc="UA" data-code="+380"><span class="dial-flag">🇺🇦</span><span class="dial-code">+380 UA</span></div>
                    <div class="dial-item" data-cc="RU" data-code="+7"><span class="dial-flag">🇷🇺</span><span class="dial-code">+7 RU</span></div>
                    <div class="dial-item" data-cc="PL" data-code="+48"><span class="dial-flag">🇵🇱</span><span class="dial-code">+48 PL</span></div>
                    <div class="dial-item" data-cc="UK" data-code="+44"><span class="dial-flag">🇬🇧</span><span class="dial-code">+44 UK</span></div>
    </div>
                </div>
                <input class="request-input request-code-input" id="reqCode" type="hidden" value="+34" />
                <input class="request-input request-phone-input" id="reqPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="1234567" />
    </div>
              <div class="email-wrap">
                <input class="request-input" id="reqEmail" type="email" autocomplete="email" placeholder="yourmail@gmail.com" />
                <span class="email-ghost" id="reqEmailGhost"></span>
              </div>
              <div class="request-error" id="reqContactError">Please provide phone or email</div>
        </div>
            <div class="request-field">
              <div class="request-field-label">Preferred contact method</div>
              <div class="request-select" id="reqMethodSelect"><span id="reqMethodLabel">WhatsApp</span><span class="request-caret">▾</span></div>
              <div class="request-select-list" id="reqMethodList">
                <div class="request-select-item" data-value="WhatsApp">WhatsApp</div>
                <div class="request-select-item" data-value="Telegram">Telegram</div>
                <div class="request-select-item" data-value="Phone Call">Phone Call</div>
                <div class="request-select-item" data-value="Email">Email</div>
              </div>
              <input type="hidden" id="reqMethod" value="WhatsApp" />
          </div>
            <div class="request-field">
              <div class="request-field-label">Comment (optional)</div>
              <textarea class="request-textarea" id="reqComment" placeholder="Short note"></textarea>
        </div>
            <div class="request-actions-container">
              <div class="request-consent">
                <input class="request-checkbox" id="reqConsent" type="checkbox" />
                <div class="request-consent-text">I consent to the processing of my data for managing this request and contacting me about properties. <a class="request-privacy-link" href="#">Privacy Policy</a></div>
        </div>
              <div class="request-error" id="reqConsentError">Please accept the Privacy Policy</div>
              <div class="request-buttons">
                <button class="request-send-btn">Send</button>
                <button class="request-cancel-btn">Cancel</button>
        </div>
        </div>
        </div>
        </div>
      <!-- Request Thanks Popup -->
      <div class="data-overlay" id="requestThanksOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Thank you!</div>
          <div class="data-body">Your request has been received. We’ll contact you soon.</div>
          <button class="data-btn" id="requestThanksOverlayClose">Close</button>
        </div>
        </div>
      </div>

      <!-- Support Screen (v2) -->
      <div class="support-screen hidden" id="supportScreen">
        <div class="voice-widget-container">
          <div class="screen-header">
          </div>
          <div class="support-main-container">
            <div class="support-faq-title">FAQ</div>
            <div class="support-faq-list">
              <div class="support-faq-item"><div class="support-faq-question">Where is my data stored?<span class="faq-caret"></span></div><div class="support-faq-answer">Your data is safely encrypted and stored on our secure EU servers.</div></div>
              <div class="support-faq-item"><div class="support-faq-question">How can I delete my information?<span class="faq-caret"></span></div><div class="support-faq-answer">Just send us a short message — we’ll remove your data immediately.</div></div>
              <div class="support-faq-item"><div class="support-faq-question">Why can’t I send my request?<span class="faq-caret"></span></div><div class="support-faq-answer">Check your internet connection or try again in a few minutes.</div></div>
              <div class="support-faq-item"><div class="support-faq-question">How can I be sure my info is safe?<span class="faq-caret"></span></div><div class="support-faq-answer">We never share or sell your data. You can review our Privacy Policy anytime.</div></div>
            </div>
            <div class="support-gradient-line"></div>
            <div class="support-hint-text">Got questions or something doesn't work as expected? We're here to help you resolve it quickly.</div>
            <div class="support-contact-button"><button class="support-contact-btn">Contact Support</button></div>
              <div class="support-form" id="supportForm">
                <div class="request-select" id="supportIssueSelect"><span id="supportIssueLabel">Choose problem</span><span class="request-caret">▾</span></div>
                <div class="request-select-list" id="supportIssueList">
                  <div class="request-select-item" data-issue="Lead not received">Lead not received</div>
                  <div class="request-select-item" data-issue="Database error">Database error</div>
                  <div class="request-select-item" data-issue="Wrong answers">Wrong answers</div>
                  <div class="request-select-item" data-issue="Access problem">Access problem</div>
                  <div class="request-select-item" data-issue="Billing problem">Billing problem</div>
                </div>
                <textarea class="support-textarea" id="supportIssueInput" placeholder="Issue / describe your problem"></textarea>
                <div class="support-actions">
                  <button class="support-send-btn">Send</button>
                  <button class="support-cancel-btn">Cancel</button>
                </div>
              </div>
              <div class="support-thanks" id="supportThanks">
                <div class="support-thanks-title">Thank you!</div>
                <div class="support-thanks-text">Your message has been received. We’ll get back to you soon.</div>
                <button class="support-done-btn" id="supportThanksDoneBtn">Close</button>
              </div>
              <!-- Support Thanks Popup -->
              <div class="data-overlay" id="supportThanksOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Thank you!</div>
                  <div class="data-body">Your message has been received. We’ll get back to you soon.</div>
                  <button class="data-btn" id="supportThanksOverlayClose">Close</button>
                </div>
              </div>
          </div>
          <div class="support-footer-text">Want to talk with a human</div>
            <!-- Human contact popup -->
            <div class="human-overlay" id="humanOverlay" style="display:none;">
              <div class="human-modal">
                <div class="human-title">Next human will be available in</div>
                <div class="human-timer"><span id="humanEtaTimer">15:00</span> minutes</div>
                <div class="human-note">You will be contacted by method you put in account.<br/>Thanks for patience!</div>
                <button class="human-btn" id="humanContinueBtn">Continue</button>
              </div>
            </div>
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
    // ensure menu overlay is attached to the active screen header
    try { this.setupMenuOverlay(); } catch {}
  };

  // Launcher
  $("#launcher")?.addEventListener("click", () => {
    this.classList.add("open");
    // Не фокусируем поле на мобильных, чтобы не вызывать автопоявление клавиатуры
    try {
      const isMobileLike = (() => {
        try {
          const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
          const ua = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
          return Boolean(coarse || touch || ua);
        } catch { return false; }
      })();
      if (!isMobileLike) {
        this.shadowRoot.getElementById("textInput")?.focus();
      }
      // На мобильных — блокируем скролл страницы, чтобы скроллился только виджет
      if (isMobileLike) {
        const de = document.documentElement;
        const b = document.body;
        this._prevPageOverflowDoc = de.style.overflow || '';
        this._prevPageOverflowBody = b.style.overflow || '';
        this._prevPageTouchAction = b.style.touchAction || '';
        de.style.overflow = 'hidden';
        b.style.overflow = 'hidden';
        b.style.touchAction = 'none';
        this._scrollLockedMobile = true;
        // Разрешаем клик по затемнению закрывать виджет на мобайле
        const dim = this.shadowRoot.getElementById('pageDim');
        if (dim) dim.style.pointerEvents = 'auto';
      } else {
        // На десктопе не блокируем скролл и не даём кликом по затемнению закрывать
        const dim = this.shadowRoot.getElementById('pageDim');
        if (dim) dim.style.pointerEvents = 'none';
      }
    } catch {}
    // Не блокируем прокрутку страницы при открытом виджете
  });

  // Helper: close widget and restore page scroll
  this.closeWidget = () => {
    this.classList.remove("open");
    // Ничего не меняем у страницы — скролл всегда доступен
    // Явно снимаем фокус, чтобы на повторном открытии клавиатура не всплывала
    try {
      this.shadowRoot.getElementById("textInput")?.blur();
      this.shadowRoot.getElementById("mainTextInput")?.blur();
      this.shadowRoot.activeElement && typeof this.shadowRoot.activeElement.blur === 'function' && this.shadowRoot.activeElement.blur();
      // Если скролл был залочен (мобилки) — вернём как было
      if (this._scrollLockedMobile) {
        const de = document.documentElement;
        const b = document.body;
        de.style.overflow = this._prevPageOverflowDoc || '';
        b.style.overflow = this._prevPageOverflowBody || '';
        b.style.touchAction = this._prevPageTouchAction || '';
        this._scrollLockedMobile = false;
      }
      // Отключим обработку кликов по затемнению
      const dim = this.shadowRoot.getElementById('pageDim');
      if (dim) dim.style.pointerEvents = 'none';
    } catch {}
  };

  // (legacy header/details and overlay lead panel handlers removed)

  // Request Screen (v2) — без логики на данном этапе
  // Add basic validation and submit behavior
  this.setupRequestForm = () => {
    const root = this.shadowRoot;
    const sendBtn = root.querySelector('.request-send-btn');
    const cancelBtn = root.querySelector('.request-cancel-btn');
    if (!sendBtn) return;
    const thanksOverlay = root.getElementById('requestThanksOverlay');
    const get = (id) => root.getElementById(id);
    const markError = (el, on) => { if (!el) return; el.classList.toggle('error', !!on); };
    const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
    const isPhone = (cc, ph) => {
      const s = `${cc||''}${ph||''}`.replace(/\s+/g,'');
      return s.length >= 6 && /^[+0-9\-()]+$/.test(s);
    };
    // Email inline completion (request)
    const emailSuggestDomains = ['gmail.com','mail.ru','proton.me','rambler.ru','yahoo.com'];
    const reqEmail = get('reqEmail');
    const reqEmailGhost = get('reqEmailGhost');
    const measureText = (inputEl, text) => {
      if (!inputEl) return 0;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const cs = getComputedStyle(inputEl);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      return ctx.measureText(text).width;
    };
    const updateReqEmailGhost = () => {
      const v = reqEmail?.value || '';
      const at = v.indexOf('@');
      if (!reqEmailGhost || at < 0) { if (reqEmailGhost) reqEmailGhost.textContent=''; return; }
      const tail = v.slice(at + 1).toLowerCase();
      let suggestion = null;
      if (tail.length === 0) suggestion = emailSuggestDomains[0];
      else suggestion = emailSuggestDomains.find(d => d.startsWith(tail));
      if (!suggestion) { reqEmailGhost.textContent=''; return; }
      const suffix = suggestion.slice(tail.length); // "съедаем" уже введённое
      // позиция — ширина всего введённого текста
      const padLeft = 10; // как у инпута
      const left = padLeft + measureText(reqEmail, v);
      reqEmailGhost.style.left = `${left}px`;
      reqEmailGhost.textContent = suffix;
      reqEmailGhost.dataset.domain = suggestion;
    };
    reqEmail?.addEventListener('input', updateReqEmailGhost);
    reqEmailGhost?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!reqEmail || !reqEmailGhost) return;
      const v = reqEmail.value;
      const at = v.indexOf('@');
      if (at < 0) return;
      const local = v.slice(0, at);
      const domain = reqEmailGhost.dataset.domain || '';
      if (!domain) return;
      reqEmail.value = `${local}@${domain}`;
      reqEmail.focus();
      updateReqEmailGhost();
    });
    // Dial select (request)
    const reqDialBtn = get('reqDialBtn');
    const reqDialList = get('reqDialList');
    const reqCode = get('reqCode');
    const toggleReqDial = (show) => { if (reqDialList) reqDialList.style.display = show ? 'block' : 'none'; };
    reqDialBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = reqDialList && reqDialList.style.display === 'block';
      toggleReqDial(!visible);
    });
    reqDialList?.querySelectorAll('.dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code') || '+34';
        const flag = item.querySelector('.dial-flag')?.textContent || '🇪🇸';
        if (reqDialBtn) {
          const codeEl = reqDialBtn.querySelector('.dial-code'); const flagEl = reqDialBtn.querySelector('.dial-flag');
          if (codeEl) codeEl.textContent = code;
          if (flagEl) flagEl.textContent = flag;
        }
        if (reqCode) reqCode.value = code;
        toggleReqDial(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!reqDialList || !reqDialBtn) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![reqDialList, reqDialBtn].some(el => path.includes(el))) toggleReqDial(false);
    }, { capture:true });
    // Preferred contact method select
    const reqMethodSelect = get('reqMethodSelect');
    const reqMethodList = get('reqMethodList');
    const reqMethodLabel = get('reqMethodLabel');
    const reqMethodInput = get('reqMethod');
    const toggleReqMethod = (show) => { if (reqMethodList) reqMethodList.style.display = show ? 'block' : 'none'; };
    reqMethodSelect?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = reqMethodList && reqMethodList.style.display === 'block';
      toggleReqMethod(!visible);
    });
    reqMethodList?.querySelectorAll('.request-select-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-value') || 'WhatsApp';
        if (reqMethodLabel) reqMethodLabel.textContent = val;
        if (reqMethodInput) reqMethodInput.value = val;
        toggleReqMethod(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!reqMethodList || !reqMethodSelect) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![reqMethodList, reqMethodSelect].some(el => path.includes(el))) toggleReqMethod(false);
    }, { capture:true });
    const showContactError = (on, msg) => {
      const el = get('reqContactError');
      if (el && typeof msg === 'string' && msg.length) el.textContent = msg;
      if (el) el.classList.toggle('visible', !!on);
    };
    const showConsentError = (on) => {
      const wrap = root.querySelector('.request-consent');
      const checkbox = get('reqConsent');
      const textEl = wrap?.querySelector('.request-consent-text');
      const el = get('reqConsentError');
      if (el) el.classList.toggle('visible', !!on);
      if (checkbox) checkbox.classList.toggle('error', !!on);
      if (on && textEl) { textEl.classList.add('shake'); setTimeout(()=>textEl.classList.remove('shake'), 500); }
    };
    const shake = (el) => {
      if (!el) return;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 500);
    };
    // Clear hints on input
    ['reqCode','reqPhone','reqEmail'].forEach(id => {
      get(id)?.addEventListener('input', () => {
        showContactError(false);
        ['reqCode','reqPhone','reqEmail'].forEach(fid => markError(get(fid), false));
      });
    });
    get('reqConsent')?.addEventListener('change', () => {
      showConsentError(false);
      const checkbox = get('reqConsent');
      if (checkbox) checkbox.classList.remove('error');
    });
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // read values
      const name = get('reqName')?.value?.trim() || '';
      const code = get('reqCode')?.value?.trim() || '';
      const phone = get('reqPhone')?.value?.trim() || '';
      const email = get('reqEmail')?.value?.trim() || '';
      const consent = !!get('reqConsent')?.checked;
      // validate contact
      const phoneOk = isPhone(code, phone);
      const emailOk = isEmail(email);
      const contactOk = phoneOk || emailOk;
      const phoneHas = phone.length > 0;
      const emailHas = email.length > 0;
      // if both empty -> shake both + generic error
      if (!phoneHas && !emailHas) {
        markError(get('reqPhone'), true);
        markError(get('reqEmail'), true);
        shake(get('reqPhone')); shake(get('reqEmail'));
        showContactError(true, 'Required: phone or email');
        // also check consent here to shake if needed
        if (!consent) showConsentError(true);
        return;
      }
      // If at least one is valid -> proceed (clear errors regardless of the other)
      if (contactOk) {
        markError(get('reqPhone'), false);
        markError(get('reqEmail'), false);
        showContactError(false);
      } else {
        // One or both present but invalid → show only one specific message, mark all invalid
        markError(get('reqPhone'), phoneHas && !phoneOk);
        markError(get('reqEmail'), emailHas && !emailOk);
        let msg = phoneHas && !phoneOk ? 'Invalid phone number' : 'Invalid email address';
        showContactError(true, msg);
        if (!phoneOk && phoneHas) shake(get('reqPhone'));
        if (!emailOk && emailHas) shake(get('reqEmail'));
        return;
      }
      if (!consent) { showConsentError(true); shake(root.querySelector('.request-consent')); return; }
      // submit stub → show thanks popup
      if (thanksOverlay) thanksOverlay.style.display = 'flex';
      // optional: clear
      ['reqName','reqCode','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value=''; });
      if (get('reqConsent')) get('reqConsent').checked = false;
      showContactError(false); showConsentError(false);
    });
    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      ['reqName','reqCode','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value=''; });
      if (get('reqConsent')) get('reqConsent').checked = false;
      ['reqCode','reqPhone','reqEmail'].forEach(id => markError(get(id), false));
      showContactError(false); showConsentError(false);
      if (reqEmailGhost) reqEmailGhost.textContent='';
    });
    root.getElementById('requestThanksOverlayClose')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanksOverlay) thanksOverlay.style.display = 'none';
    });
  };
  try { this.setupRequestForm(); } catch {}
 

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
  
  // Page dim click to close on mobile
  try {
    const dim = this.shadowRoot.getElementById('pageDim');
    if (dim) {
      dim.addEventListener('click', () => {
        try {
          const isMobileLike = (() => {
            try {
              const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
              const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
              const ua = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
              return Boolean(coarse || touch || ua);
            } catch { return false; }
          })();
          if (isMobileLike) this.closeWidget();
        } catch {}
      }, { passive: true });
    }
  } catch {}
  
  // Image Lightbox — open/close helpers
  this.openImageOverlay = (url) => {
    try {
      if (!url) return;
      const box = this.shadowRoot.getElementById('imgLightbox');
      const img = this.shadowRoot.getElementById('imgLightboxImg');
      if (!box || !img) return;
      img.src = url;
      box.classList.add('open');
      this._imageOverlayOpen = true;
    } catch {}
  };
  this.closeImageOverlay = () => {
    try {
      const box = this.shadowRoot.getElementById('imgLightbox');
      const img = this.shadowRoot.getElementById('imgLightboxImg');
      if (img) img.src = '';
      if (box) box.classList.remove('open');
      this._imageOverlayOpen = false;
    } catch {}
  };
  // Lightbox interactions: click on backdrop closes; click on image — no action
  try {
    const box = this.shadowRoot.getElementById('imgLightbox');
    const img = this.shadowRoot.getElementById('imgLightboxImg');
    if (box) {
      box.addEventListener('click', (e) => {
        if (e.target === box) { // only backdrop, not image
          e.stopPropagation();
          this.closeImageOverlay();
        }
      });
      // Swipe-to-close on mobile corners
      let sx = 0, sy = 0, st = 0, eligible = false;
      const cornerPad = 24, distThresh = 32, timeThresh = 400;
      box.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0]; if (!t) return;
        const rect = box.getBoundingClientRect();
        sx = t.clientX; sy = t.clientY; st = Date.now();
        const inLeft = sx >= rect.left && sx <= rect.left + cornerPad && sy >= rect.top && sy <= rect.top + cornerPad;
        const inRight = sx <= rect.right && sx >= rect.right - cornerPad && sy >= rect.top && sy <= rect.top + cornerPad;
        const inBL = sx >= rect.left && sx <= rect.left + cornerPad && sy <= rect.bottom && sy >= rect.bottom - cornerPad;
        const inBR = sx <= rect.right && sx >= rect.right - cornerPad && sy <= rect.bottom && sy >= rect.bottom - cornerPad;
        eligible = inLeft || inRight || inBL || inBR;
      }, { passive: true });
      box.addEventListener('touchend', (e) => {
        if (!eligible) return;
        const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]); if (!t) return;
        const dx = Math.abs(t.clientX - sx);
        const dy = Math.abs(t.clientY - sy);
        const dt = Date.now() - st;
        if (dt <= timeThresh && (dx > distThresh || dy > distThresh)) {
          this.closeImageOverlay();
        }
        eligible = false;
      }, { passive: true });
    }
    if (img) {
      img.addEventListener('click', (e) => e.stopPropagation()); // prevent closing by clicking on image
    }
  } catch {}
  // Global ESC: close image overlay first, then (if none) close widget
  this._onGlobalKeydown = (e) => {
    if (e.key !== 'Escape') return;
    if (!this.classList.contains('open')) return;
    e.preventDefault();
    e.stopPropagation();
    if (this._imageOverlayOpen) { this.closeImageOverlay(); return; }
    this.closeWidget();
  };
  try { document.addEventListener('keydown', this._onGlobalKeydown, true); } catch {}
  
  // Delegate clicks on images to open overlay
  this._extractBgUrl = (el) => {
    try {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage || '';
      const m = bg.match(/url\\([\"\\']?(.*?)[\"\\']?\\)/i);
      return (m && m[1]) ? m[1] : '';
    } catch { return ''; }
  };
  this._onImageClick = (e) => {
    // ignore clicks on buttons/icons
    if (e.target.closest('button')) return;
    // 1) direct <img> inside card screen
    const imgEl = e.target.closest('.card-screen .cs-image img');
    if (imgEl && imgEl.src) { this.openImageOverlay(imgEl.src); return; }
    // 2) property card background or card mock image areas
    const bgEl = e.target.closest('.card-image, .card-mock .cm-image, .card-screen .cs-image');
    if (bgEl) {
      const url = this._extractBgUrl(bgEl);
      if (url) { this.openImageOverlay(url); return; }
      // fallback: if it contains an img, use it
      const innerImg = bgEl.querySelector('img');
      if (innerImg && innerImg.src) { this.openImageOverlay(innerImg.src); return; }
    }
  };
  try { this.shadowRoot.addEventListener('click', this._onImageClick); } catch {}
  // Mobile swipe-to-close from widget corners
  this._setupMobileGestures = () => {
    try {
      const containers = this.shadowRoot.querySelectorAll('.voice-widget-container');
      containers.forEach((container) => {
        if (!container || container._swipeBound) return;
        let startX = 0, startY = 0, startT = 0, eligible = false;
        const cornerPad = 24; // px
        const distThresh = 32; // px (чуть мягче)
        const timeThresh = 400; // ms (чуть мягче)
        const onStart = (e) => {
          // проверка «мобильности»
          try {
            const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
            const ua = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
            const isMobileLike = Boolean(coarse || touch || ua);
            if (!isMobileLike) return;
          } catch {}
          const t = e.touches && e.touches[0]; if (!t) return;
          const rect = container.getBoundingClientRect();
          startX = t.clientX; startY = t.clientY; startT = Date.now();
          const inLeft = startX >= rect.left && startX <= rect.left + cornerPad && startY >= rect.top && startY <= rect.top + cornerPad;
          const inRight = startX <= rect.right && startX >= rect.right - cornerPad && startY >= rect.top && startY <= rect.top + cornerPad;
          const inBL = startX >= rect.left && startX <= rect.left + cornerPad && startY <= rect.bottom && startY >= rect.bottom - cornerPad;
          const inBR = startX <= rect.right && startX >= rect.right - cornerPad && startY <= rect.bottom && startY >= rect.bottom - cornerPad;
          eligible = inLeft || inRight || inBL || inBR;
        };
        const onEnd = (e) => {
          if (!eligible) return;
          const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]); if (!t) return;
          const dx = Math.abs(t.clientX - startX);
          const dy = Math.abs(t.clientY - startY);
          const dt = Date.now() - startT;
          if (dt <= timeThresh && (dx > distThresh || dy > distThresh)) {
            this.closeWidget();
          }
          eligible = false;
        };
        container.addEventListener('touchstart', onStart, { passive: true });
        container.addEventListener('touchend', onEnd, { passive: true });
        container._swipeBound = true;
      });
    } catch {}
  };
  try { this._setupMobileGestures(); } catch {}
  
  // Support FAQ toggles
  this.setupSupportFaq = () => {
    const items = this.shadowRoot.querySelectorAll('.support-faq-item');
    items.forEach((it) => {
      const q = it.querySelector('.support-faq-question');
      if (!q) return;
      q.addEventListener('click', () => {
        it.classList.toggle('open');
      });
    });
  };
  try { this.setupSupportFaq(); } catch {}
  
  // Support Contact Form interactions
  this.setupSupportForm = () => {
    const wrap = this.shadowRoot.querySelector('.support-contact-button');
    const hint = this.shadowRoot.querySelector('.support-hint-text');
    const btn = this.shadowRoot.querySelector('.support-contact-btn');
    const form = this.shadowRoot.getElementById('supportForm');
    const thanks = this.shadowRoot.getElementById('supportThanks'); // legacy inline
    const thanksOverlay = this.shadowRoot.getElementById('supportThanksOverlay');
    const faqList = this.shadowRoot.querySelector('.support-faq-list');
    const ta = this.shadowRoot.getElementById('supportIssueInput');
    const issueSelect = this.shadowRoot.getElementById('supportIssueSelect');
    const issueList = this.shadowRoot.getElementById('supportIssueList');
    const issueLabel = this.shadowRoot.getElementById('supportIssueLabel');
    const toggleIssueList = (show) => { if (issueList) issueList.style.display = show ? 'block' : 'none'; };
    if (btn && form) {
      btn.addEventListener('click', () => {
        if (wrap) wrap.style.display = 'none';
        if (hint) hint.style.display = 'none';
        form.style.display = 'block';
        // collapse and disable FAQ while form is active
        try {
          this.shadowRoot.querySelectorAll('.support-faq-item.open').forEach(it => it.classList.remove('open'));
          faqList?.classList.add('disabled');
        } catch {}
        try { ta?.focus(); } catch {}
        if (issueLabel) issueLabel.textContent = 'Choose problem';
        toggleIssueList(false);
      });
    }
    // Issue select → fill textarea
    issueSelect?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = issueList && issueList.style.display === 'block';
      toggleIssueList(!visible);
    });
    issueList?.querySelectorAll('.request-select-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.getAttribute('data-issue') || item.textContent || '';
        if (issueLabel) issueLabel.textContent = key || 'Choose problem';
        // Templates for quick fill
        const templates = {
          'Lead not received': 'Hello Support,\n\nWe are not receiving new leads in our CRM as expected. Please check the integration and delivery pipeline.\n\nDetails: ',
          'Database error': 'Hello Support,\n\nWe are getting a database error while working with the service. It seems related to connectivity or query failures.\n\nDetails: ',
          'Wrong answers': 'Hello Support,\n\nAssistant responses look inconsistent/incorrect in recent dialogues. Could you review the session and adjust logic or prompts?\n\nDetails: ',
          'Access problem': 'Hello Support,\n\nThere is an access/permissions problem for our account. Some features/pages are unavailable.\n\nDetails: ',
          'Billing problem': 'Hello Support,\n\nWe have an issue with billing/payments. Please check our invoices and payment status.\n\nDetails: ',
        };
        const txt = templates[key] || (key + ': ');
        if (ta) {
          ta.value = txt;
          try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch {}
        }
        
        toggleIssueList(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!issueList || !issueSelect) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![issueList, issueSelect].some(el => path.includes(el))) toggleIssueList(false);
    }, { capture:true });
    // Send (stub)
    form?.querySelector('.support-send-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const text = (ta?.value || '').trim();
      if (!text) { this.ui.showNotification('⚠️ Please describe the issue'); return; }
      // Show thanks popup
      form.style.display = 'none';
      if (thanksOverlay) thanksOverlay.style.display = 'flex';
      // reset input/chips
      if (ta) ta.value = '';
      if (issueLabel) issueLabel.textContent = 'Choose problem';
      toggleIssueList(false);
    });
    // Cancel → hide form back
    form?.querySelector('.support-cancel-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      form.style.display = 'none';
      if (wrap) wrap.style.display = 'block';
      if (hint) hint.style.display = '';
      // enable FAQ back
      faqList?.classList.remove('disabled');
      if (issueLabel) issueLabel.textContent = 'Choose problem';
      toggleIssueList(false);
    });
    // Thanks close (legacy inline) → back to initial state
    this.shadowRoot.getElementById('supportThanksDoneBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanks) thanks.style.display = 'none';
      if (wrap) wrap.style.display = 'block';
      if (hint) hint.style.display = '';
      faqList?.classList.remove('disabled');
      if (issueLabel) issueLabel.textContent = 'Choose problem';
      toggleIssueList(false);
    });
    // Thanks popup close → back to initial state
    this.shadowRoot.getElementById('supportThanksOverlayClose')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      if (wrap) wrap.style.display = 'block';
      if (hint) hint.style.display = '';
      faqList?.classList.remove('disabled');
      if (issueLabel) issueLabel.textContent = 'Choose problem';
      toggleIssueList(false);
    });
  };
  try { this.setupSupportForm(); } catch {}
  
  // Helper: reset Support screen interactive state (acts like Cancel)
  this.resetSupportScreen = () => {
    try {
      const wrap = this.shadowRoot.querySelector('.support-contact-button');
      const hint = this.shadowRoot.querySelector('.support-hint-text');
      const form = this.shadowRoot.getElementById('supportForm');
      const thanks = this.shadowRoot.getElementById('supportThanks');
      const thanksOverlay = this.shadowRoot.getElementById('supportThanksOverlay');
      const faqList = this.shadowRoot.querySelector('.support-faq-list');
      const issueLabel = this.shadowRoot.getElementById('supportIssueLabel');
      const issueList = this.shadowRoot.getElementById('supportIssueList');
      const ta = this.shadowRoot.getElementById('supportIssueInput');
      if (form) form.style.display = 'none';
      if (thanks) thanks.style.display = 'none';
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      if (wrap) wrap.style.display = 'block';
      if (hint) hint.style.display = '';
      if (faqList) faqList.classList.remove('disabled');
      if (issueLabel) issueLabel.textContent = 'Choose problem';
      if (issueList) issueList.style.display = 'none';
      if (ta) ta.value = '';
    } catch {}
  };

  // Helper: reset Request screen state
  this.resetRequestScreen = () => {
    try {
      const thanksOverlay = this.shadowRoot.getElementById('requestThanksOverlay');
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      const get = (id) => this.shadowRoot.getElementById(id);
      // Clear fields
      ['reqName','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value = ''; });
      const consent = get('reqConsent');
      if (consent) consent.checked = false, consent.classList.remove('error');
      // Errors and hints
      ['reqCode','reqPhone','reqEmail'].forEach(id => { const el = get(id); if (el) el.classList.remove('error'); });
      const errContact = get('reqContactError'); if (errContact) errContact.classList.remove('visible');
      const errConsent = get('reqConsentError'); if (errConsent) errConsent.classList.remove('visible');
      // Preferred method select
      const methodLabel = get('reqMethodLabel'); if (methodLabel) methodLabel.textContent = 'WhatsApp';
      const methodList = get('reqMethodList'); if (methodList) methodList.style.display = 'none';
      const methodHidden = get('reqMethod'); if (methodHidden) methodHidden.value = 'WhatsApp';
      // Dial select defaults
      const dialBtn = get('reqDialBtn'); 
      if (dialBtn) {
        const codeEl = dialBtn.querySelector('.dial-code'); const flagEl = dialBtn.querySelector('.dial-flag');
        if (codeEl) codeEl.textContent = '+34';
        if (flagEl) flagEl.textContent = '🇪🇸';
      }
      const dialList = get('reqDialList'); if (dialList) dialList.style.display = 'none';
      const codeHidden = get('reqCode'); if (codeHidden) codeHidden.value = '+34';
    } catch {}
  };

  // Helper: reset Context screen state (Leave request form)
  this.resetContextScreen = () => {
    try {
      const get = (id) => this.shadowRoot.getElementById(id);
      const form = get('ctxRequestForm');
      const btnWrap = this.shadowRoot.querySelector('.context-leave-request-button');
      const thanks = get('ctxThanks');
      const thanksOverlay = get('ctxThanksOverlay');
      if (thanks) thanks.style.display = 'none';
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      if (form) form.style.display = 'none';
      if (btnWrap) btnWrap.style.display = 'block';
      // Clear fields
      ['ctxName','ctxPhone','ctxEmail'].forEach(id => { const el = get(id); if (el) el.value = ''; });
      const consent = get('ctxConsent'); if (consent) consent.checked = false, consent.classList.remove('error');
      // Errors
      ['ctxPhone','ctxEmail'].forEach(id => { const el = get(id); if (el) el.classList.remove('error'); });
      const errContact = get('ctxContactError'); if (errContact) errContact.classList.remove('visible');
      const errConsent = get('ctxConsentError'); if (errConsent) errConsent.classList.remove('visible');
      // Dial defaults
      const dialBtn = get('ctxDialBtn');
      if (dialBtn) {
        const codeEl = dialBtn.querySelector('.dial-code'); const flagEl = dialBtn.querySelector('.dial-flag');
        if (codeEl) codeEl.textContent = '+34';
        if (flagEl) flagEl.textContent = '🇪🇸';
      }
      const dialList = get('ctxDialList'); if (dialList) dialList.style.display = 'none';
      const codeHidden = get('ctxCode'); if (codeHidden) codeHidden.value = '+34';
    } catch {}
  };
  
  // Human contact popup with persistent countdown
  this.setupHumanPopup = () => {
    const footer = this.shadowRoot.querySelector('.support-footer-text');
    const overlay = this.shadowRoot.getElementById('humanOverlay');
    const btnClose = this.shadowRoot.getElementById('humanContinueBtn');
    const timerEl = this.shadowRoot.getElementById('humanEtaTimer');
    let intervalId = null;
    const DURATION_MS = 15 * 60 * 1000; // 15 minutes
    const LS_KEY = 'vw_human_eta_until';

    const getDeadline = () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        const parsed = raw ? parseInt(raw, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > Date.now()) return parsed;
      } catch {}
      return null;
    };
    const setDeadline = (ts) => { try { localStorage.setItem(LS_KEY, String(ts)); } catch {} };
    const fmt = (ms) => {
      const total = Math.max(0, Math.floor(ms / 1000));
      const m = Math.floor(total / 60).toString().padStart(2, '0');
      const s = (total % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };
    const startTimer = () => {
      const dl = getDeadline() || (Date.now() + DURATION_MS);
      if (!getDeadline()) setDeadline(dl);
      const tick = () => {
        const left = dl - Date.now();
        if (timerEl) timerEl.textContent = fmt(left);
        if (left <= 0 && intervalId) { clearInterval(intervalId); intervalId = null; }
      };
      tick();
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, 1000);
    };

    footer?.addEventListener('click', () => {
      if (overlay) overlay.style.display = 'flex';
      startTimer(); // не сбрасываем, использует сохранённый дедлайн
    });
    btnClose?.addEventListener('click', () => {
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupHumanPopup(); } catch {}
  
  // Context: leave request inline form toggles
  this.setupContextRequestForm = () => {
    const btn = this.shadowRoot.getElementById('ctxLeaveReqBtn');
    const form = this.shadowRoot.getElementById('ctxRequestForm');
    const ctxHint = this.shadowRoot.querySelector('#contextScreen .hint-text');
    const thanks = this.shadowRoot.getElementById('ctxThanks'); // legacy inline
    const thanksOverlay = this.shadowRoot.getElementById('ctxThanksOverlay');
    if (!btn || !form) return;
    const get = (id) => this.shadowRoot.getElementById(id);
    const markError = (el, on) => { if (!el) return; el.classList.toggle('error', !!on); };
    const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
    const isPhone = (cc, v) => {
      const s = `${cc||''}${v||''}`.replace(/\s+/g,'');
      return s.length >= 6 && /^[+0-9\-()]+$/.test(s);
    };
    // Email inline completion (context)
    const ctxEmail = get('ctxEmail');
    const ctxEmailGhost = get('ctxEmailGhost');
    const updateCtxEmailGhost = () => {
      const v = ctxEmail?.value || '';
      const at = v.indexOf('@');
      if (!ctxEmailGhost || at < 0) { if (ctxEmailGhost) ctxEmailGhost.textContent=''; return; }
      const tail = v.slice(at + 1).toLowerCase();
      let suggestion = null;
      if (tail.length === 0) suggestion = emailSuggestDomains[0];
      else suggestion = emailSuggestDomains.find(d => d.startsWith(tail));
      if (!suggestion) { ctxEmailGhost.textContent=''; return; }
      const suffix = suggestion.slice(tail.length);
      const padLeft = 10;
      const left = padLeft + measureText(ctxEmail, v);
      ctxEmailGhost.style.left = `${left}px`;
      ctxEmailGhost.textContent = suffix;
      ctxEmailGhost.dataset.domain = suggestion;
    };
    ctxEmail?.addEventListener('input', updateCtxEmailGhost);
    ctxEmailGhost?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!ctxEmail || !ctxEmailGhost) return;
      const v = ctxEmail.value;
      const at = v.indexOf('@');
      if (at < 0) return;
      const local = v.slice(0, at);
      const domain = ctxEmailGhost.dataset.domain || '';
      if (!domain) return;
      ctxEmail.value = `${local}@${domain}`;
      ctxEmail.focus();
      updateCtxEmailGhost();
    });
    // Dial select (context)
    const ctxDialBtn = get('ctxDialBtn');
    const ctxDialList = get('ctxDialList');
    const ctxCode = get('ctxCode');
    const toggleCtxDial = (show) => { if (ctxDialList) ctxDialList.style.display = show ? 'block' : 'none'; };
    ctxDialBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const visible = ctxDialList && ctxDialList.style.display === 'block';
      toggleCtxDial(!visible);
    });
    ctxDialList?.querySelectorAll('.dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code') || '+34';
        const flag = item.querySelector('.dial-flag')?.textContent || '🇪🇸';
        if (ctxDialBtn) {
          const codeEl = ctxDialBtn.querySelector('.dial-code'); const flagEl = ctxDialBtn.querySelector('.dial-flag');
          if (codeEl) codeEl.textContent = code;
          if (flagEl) flagEl.textContent = flag;
        }
        if (ctxCode) ctxCode.value = code;
        toggleCtxDial(false);
      });
    });
    document.addEventListener('click', (ev) => {
      if (!ctxDialList || !ctxDialBtn) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (![ctxDialList, ctxDialBtn].some(el => path.includes(el))) toggleCtxDial(false);
    }, { capture:true });
    const showContactError = (on, msg) => { const el = get('ctxContactError'); if (el && typeof msg === 'string' && msg.length) el.textContent = msg; if (el) el.classList.toggle('visible', !!on); };
    const showConsentError = (on) => {
      const wrap = form.querySelector('.ctx-consent');
      const checkbox = get('ctxConsent');
      const textEl = wrap?.querySelector('.ctx-consent-text');
      const el = get('ctxConsentError');
      if (el) el.classList.toggle('visible', !!on);
      if (checkbox) checkbox.classList.toggle('error', !!on);
      if (on && textEl) { textEl.classList.add('shake'); setTimeout(()=>textEl.classList.remove('shake'), 500); }
    };
    const shake = (el) => { if (!el) return; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); };
    btn.addEventListener('click', () => {
      btn.parentElement.style.display = 'none';
      form.style.display = 'block';
      if (ctxHint) ctxHint.style.display = 'none';
      try { this.shadowRoot.getElementById('ctxName')?.focus(); } catch {}
    });
    this.shadowRoot.getElementById('ctxCancelBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      form.style.display = 'none';
      btn.parentElement.style.display = 'block';
      if (ctxHint) ctxHint.style.display = '';
      // clear errors
      ['ctxPhone','ctxEmail'].forEach(id => markError(get(id), false));
      showContactError(false); showConsentError(false);
    });
    // clear errors on input/change
    ['ctxPhone','ctxEmail'].forEach(id => get(id)?.addEventListener('input', () => {
      ['ctxPhone','ctxEmail'].forEach(fid => markError(get(fid), false));
      showContactError(false);
    }));
    get('ctxConsent')?.addEventListener('change', () => {
      showConsentError(false);
      const checkbox = get('ctxConsent');
      if (checkbox) checkbox.classList.remove('error');
    });
    this.shadowRoot.getElementById('ctxSendBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      // validation
      const code = get('ctxCode')?.value?.trim() || '';
      const phone = get('ctxPhone')?.value?.trim() || '';
      const email = get('ctxEmail')?.value?.trim() || '';
      const consent = !!get('ctxConsent')?.checked;
      const phoneOk = isPhone(code, phone);
      const emailOk = isEmail(email);
      const contactOk = phoneOk || emailOk;
      const phoneHas = phone.length > 0;
      const emailHas = email.length > 0;
      // empty both → generic error + shake both
      if (!phoneHas && !emailHas) {
        markError(get('ctxPhone'), true);
        markError(get('ctxEmail'), true);
        shake(get('ctxPhone')); shake(get('ctxEmail'));
        showContactError(true, 'Required: phone or email');
        if (!consent) showConsentError(true);
        return;
      }
      if (contactOk) {
        markError(get('ctxPhone'), false);
        markError(get('ctxEmail'), false);
        showContactError(false);
      } else {
        markError(get('ctxPhone'), phoneHas && !phoneOk);
        markError(get('ctxEmail'), emailHas && !emailOk);
        let msg = phoneHas && !phoneOk ? 'Invalid phone number' : 'Invalid email address';
        showContactError(true, msg);
        if (!phoneOk && phoneHas) shake(get('ctxPhone'));
        if (!emailOk && emailHas) shake(get('ctxEmail'));
        return;
      }
      if (!consent) { showConsentError(true); shake(form.querySelector('.ctx-consent')); return; }
      // show thanks popup instead of returning button
      form.style.display = 'none';
      if (thanksOverlay) thanksOverlay.style.display = 'flex';
      // clear fields
      ['ctxName','ctxPhone','ctxEmail'].forEach(id => { const el = this.shadowRoot.getElementById(id); if (el) el.value=''; });
      const c = this.shadowRoot.getElementById('ctxConsent'); if (c) c.checked = false;
      showContactError(false); showConsentError(false);
    });
    this.shadowRoot.getElementById('ctxThanksDoneBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanks) thanks.style.display = 'none';
      btn.parentElement.style.display = 'block';
      if (ctxHint) ctxHint.style.display = '';
    });
    this.shadowRoot.getElementById('ctxThanksOverlayClose')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (thanksOverlay) thanksOverlay.style.display = 'none';
      btn.parentElement.style.display = 'block';
      if (ctxHint) ctxHint.style.display = '';
    });
  };
  try { this.setupContextRequestForm(); } catch {}
  
  // Context: Data storage info popup
  this.setupDataStoragePopup = () => {
    const trigger = this.shadowRoot.querySelector('.data-storage-text');
    const overlay = this.shadowRoot.getElementById('dataOverlay');
    const btn = this.shadowRoot.getElementById('dataUnderstoodBtn');
    trigger?.addEventListener('click', () => { if (overlay) overlay.style.display = 'flex'; });
    btn?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
  };
  try { this.setupDataStoragePopup(); } catch {}
  
  // Context: "What data do we know?" popup (insights)
  this.setupWhatDataPopup = () => {
    const trigger = this.shadowRoot.querySelector('#contextScreen .footer-text');
    const overlay = this.shadowRoot.getElementById('whatDataOverlay');
    const body = this.shadowRoot.getElementById('whatDataBody');
    const btn = this.shadowRoot.getElementById('whatDataUnderstoodBtn');
    const labelMap = {
      name: 'Name',
      operation: 'Operation',
      budget: 'Budget',
      type: 'Type',
      location: 'Location',
      rooms: 'Rooms',
      area: 'Area',
      details: 'Details',
      preferences: 'Preferences'
    };
    const render = () => {
      const u = (typeof this.getUnderstanding === 'function') ? this.getUnderstanding() : (this.understanding?.export?.() || {});
      const lines = [];
      Object.keys(labelMap).forEach((k) => {
        const v = u?.[k];
        if (v !== null && v !== undefined && String(v).trim().length) {
          lines.push(`<li><b>${labelMap[k]}:</b> ${String(v)}</li>`);
        }
      });
      const listHtml = lines.length ? `<ul style="padding-left:16px; margin:6px 0 10px 0;">${lines.join('')}</ul>` : `<div style="margin:6px 0 10px 0;">No data collected yet.</div>`;
      const consent = `<div style="margin-top:10px;">We collect information only with your consent and use it non‑commercially to improve property matching.</div>`;
      if (body) body.innerHTML = listHtml + consent;
    };
    trigger?.addEventListener('click', () => { render(); if (overlay) overlay.style.display = 'flex'; });
    btn?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
  };
  try { this.setupWhatDataPopup(); } catch {}
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
  // (scroll-to-bottom функционал удалён как неиспользуемый)

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
    } else if (e.target.matches('.cards-dot')) {
      // Навигация по слайдеру через точки
      const dot = e.target;
      const row = dot.closest('.cards-dots-row');
      const slider = this.shadowRoot.querySelector('.cards-slider');
      if (!row || !slider) return;
      const dots = Array.from(row.querySelectorAll('.cards-dot'));
      const idx = dots.indexOf(dot);
      const slides = slider.querySelectorAll('.card-slide');
      if (idx >= 0 && slides[idx]) {
        const left = slides[idx].offsetLeft;
        slider.scrollTo({ left, behavior: 'smooth' });
        try { this.updateActiveCardSlide(); } catch {}
      }
    }
  });
}

  // ---------- ПРЯМО ТУТ ЗАКАНЧИВВАЕТСЯ ФУНКЦИЯ РЕНДЕР (В НЕЙ ЛЕЖАТ СТИЛИ v2/ ----------
                  // верстка и стили всех экранов в разметке и стилях/ 
                  // логика и верстка старой лид формы (удалено)/
                  // логика и верстка инлайн лид формы (удалено)/
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
    const ctxProgressText = this.shadowRoot.getElementById('ctxProgressText');
    const ctxStatusText = this.shadowRoot.getElementById('ctxStatusText');
    const ctxStageMessage = this.shadowRoot.getElementById('ctxStageMessage');
      const progress = (typeof understanding.progress === 'number') ? understanding.progress : 0;
    if (progressFill && progressText) {
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}% — ${progress === 0 ? 'ожидание' : 'обработка'}`;
    }
    if (ctxProgressText) ctxProgressText.textContent = `${Math.max(0, Math.min(99, Math.round(progress)))}%`;
    if (ctxStatusText || ctxStageMessage) {
      // Map progress to state (explicit ranges with fallbacks)
      const p = progress;
      let status = 'initial request';
      let message = 'We’ve received your initial request. Share a few details to get started.';
      if ((p >= 22 && p <= 33) || (p >= 12 && p < 22)) {
        status = 'more info added';
        message = 'Great — we added more details. Keep going to refine the search.';
      } else if ((p >= 44 && p <= 55) || (p > 33 && p < 44)) {
        status = 'half path done';
        message = 'Halfway there. A couple more details will sharpen the results.';
      } else if ((p >= 66 && p <= 77) || (p > 55 && p < 66)) {
        status = 'almost done';
        message = 'Almost done. Final tweaks and we’ll have precise matches.';
      } else if ((p >= 88 && p <= 99) || (p > 77)) {
        status = 'fulfilled';
        message = 'Well done! Your data is enough for a confident, targeted search.';
      }
      if (ctxStatusText) ctxStatusText.textContent = `Status: ${status}`;
      if (ctxStageMessage) ctxStageMessage.textContent = message;
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

  // Ensure slider container exists in thread
  ensureCardsSlider() {
    const thread = this.shadowRoot.getElementById('thread');
    const messages = this.shadowRoot.getElementById('messagesContainer');
    if (!thread || !messages) return null;
    let host = this.shadowRoot.querySelector('.card-screen.cards-slider-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'card-screen cards-slider-host';
      host.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="cards-slider">
            <div class="cards-track"></div>
        </div>
      </div>`;
      thread.appendChild(host);
      // attach active slide updater
      const slider = host.querySelector('.cards-slider');
      const update = () => { try { this.updateActiveCardSlide(); } catch {} };
      if (slider) {
        slider.addEventListener('scroll', update, { passive: true });
        try { window.addEventListener('resize', update); } catch {}
        requestAnimationFrame(update);
      }
    }
    return host.querySelector('.cards-track');
  }

  // Add single card as slide into slider
  addCardSlide(normalized) {
    const track = this.ensureCardsSlider();
    if (!track) return;
    const slide = document.createElement('div');
    slide.className = 'card-slide';
    slide.innerHTML = `
      <div class="cs" data-variant-id="${normalized.id}" data-city="${normalized.city}" data-district="${normalized.district}" data-rooms="${normalized.rooms}" data-price-eur="${normalized.priceEUR}" data-image="${normalized.image}">
        <div class="cs-image">${normalized.image ? `<img src="${normalized.image}" alt="${normalized.city} ${normalized.district}">` : 'Put image here'}</div>
        <div class="cs-body">
          <div class="cs-row"><div class="cs-title">${normalized.city}</div><div class="cs-title">${normalized.priceLabel}</div></div>
          <div class="cs-row"><div class="cs-sub">${normalized.district}${normalized.neighborhood ? (', ' + normalized.neighborhood) : ''}</div><div class="cs-sub">${normalized.roomsLabel}</div></div>
          <div class="cs-row"><div class="cs-sub"></div><div class="cs-sub">${normalized.floorLabel}</div></div>
        </div>
        <div class="cards-dots-row"></div>
        <div class="card-actions-wrap">
          <div class="card-actions-panel">
            <button class="card-btn like" data-action="like" data-variant-id="${normalized.id}">I like it</button>
            <button class="card-btn next" data-action="next" data-variant-id="${normalized.id}">One more</button>
          </div>
          <div class="card-dynamic-comment" style="margin:8px 0 0 0; font-size: 14px; line-height: 1.35; opacity: 0.85;"></div>
          </div>
        </div>`;
    track.appendChild(slide);
    // scroll to last slide
    requestAnimationFrame(() => {
      // вычисляем целевую позицию именно нового слайда
      const targetLeft = slide.offsetLeft;
      track.scrollTo({ left: targetLeft, behavior: 'smooth' });
      // пометим новый слайд активным сразу
      try {
        const slider = this.shadowRoot.querySelector('.cards-slider');
        const allSlides = slider ? slider.querySelectorAll('.card-slide') : [];
        allSlides.forEach(s => s.classList.remove('active'));
        slide.classList.add('active');
        // обновим dots: активная — последний индекс
        const rows = slider ? slider.querySelectorAll('.cards-dots-row') : [];
        const activeIdx = allSlides.length ? allSlides.length - 1 : 0;
        rows.forEach(row => {
          const dots = row.querySelectorAll('.cards-dot');
          dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
        });
      } catch {}
      // ensure the thread scrolls to show the newly added slide
      try { this.scrollThreadToBottom(true); } catch {}
      try { this.renderSliderDots(); } catch {}
    });
  }

  // Show property card in slider
  showPropertyCard(property) {
    const normalized = this.normalizeCardData(property);
    this.addCardSlide(normalized);
  }

  // Show mock card in slider (with actions)
  showMockCardWithActions(mock = {}) {
    const normalized = this.normalizeCardData(mock);
    this.addCardSlide(normalized);
  }

  // Обновить/установить динамический комментарий под активной карточкой
  setCardComment(text = '') {
    try {
      const slider = this.shadowRoot.querySelector('.cards-slider');
      if (!slider) return;
      const active = slider.querySelector('.card-slide.active');
      const host = active || slider.querySelector('.card-slide:last-child');
      if (!host) return;
      const wrap = host.querySelector('.card-dynamic-comment');
      if (wrap) {
        wrap.textContent = text || '';
      }
    } catch {}
  }

  // Highlight active slide (nearest to center)
  updateActiveCardSlide() {
    const slider = this.shadowRoot.querySelector('.cards-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.card-slide');
    if (!slides.length) return;
    const center = slider.scrollLeft + slider.clientWidth / 2;
    let closest = null; let best = Infinity;
    slides.forEach((s) => {
      const mid = s.offsetLeft + s.clientWidth / 2;
      const d = Math.abs(mid - center);
      if (d < best) { best = d; closest = s; }
    });
    slides.forEach(s => s.classList.remove('active'));
    if (closest) closest.classList.add('active');
    const activeIdx = Array.from(slides).indexOf(closest);
    // update each slide dots row
    const rows = slider.querySelectorAll('.cards-dots-row');
    rows.forEach(row => {
      const dots = row.querySelectorAll('.cards-dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    });
  }

  // Build dots per slide count
  renderSliderDots() {
    const slider = this.shadowRoot.querySelector('.cards-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.card-slide');
    const count = slides.length;
    const rows = slider.querySelectorAll('.cards-dots-row');
    rows.forEach((wrap) => {
      const existing = wrap.querySelectorAll('.cards-dot').length;
      if (existing !== count) {
        wrap.innerHTML = new Array(count).fill(0).map((_,i)=>`<span class="cards-dot${i===count-1?' active':''}"></span>`).join('');
      }
    });
    try { this.updateActiveCardSlide(); } catch {}
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
        <div class="card-actions-wrap">
        <div class="card-actions-panel">
            <button class="card-btn like" data-action="send_card">Показать</button>
            <button class="card-btn next" data-action="continue_dialog">Продолжить</button>
          </div>
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
    // Привязываем overlay ТОЛЬКО к header активных экранов v2 (main не использует overlay)
    const container = this.shadowRoot.querySelector(
      '.dialog-screen:not(.hidden) .screen-header, ' +
      '.context-screen:not(.hidden) .screen-header, ' +
      '.request-screen:not(.hidden) .screen-header, ' +
      '.support-screen:not(.hidden) .screen-header'
    );
    let overlay = this.shadowRoot.querySelector('.menu-overlay');
    if (!container) {
      // Нет подходящего header — удаляем overlay, чтобы не мешал низу виджета
      if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'menu-overlay';
      const content = document.createElement('div');
      content.className = 'menu-overlay-content';
      overlay.appendChild(content);
      container.appendChild(overlay);
    } else if (overlay.parentElement !== container) {
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
    // Keep header icon constant; hide header button when overlay is open/selected
    if (menuImg) menuImg.src = `${ASSETS_BASE}menu_icon.svg`;
    if (menuBtn) {
      if (this._menuState !== 'closed' && this._menuState) { 
        menuBtn.classList.add('hidden'); 
      } else { 
        menuBtn.classList.remove('hidden'); 
      }
      // legacy class no longer affects positioning within dialog-header
      menuBtn.classList.remove('menu-open');
    }

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
      if (closeBtn) closeBtn.onclick = () => { try { this.resetSupportScreen(); this.resetRequestScreen(); this.resetContextScreen(); } catch {} this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
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
      if (closeBtn) closeBtn.onclick = () => { try { this.resetSupportScreen(); this.resetRequestScreen(); this.resetContextScreen(); } catch {} this.showScreen('dialog'); this._menuState = 'closed'; this._selectedMenu = null; this.updateMenuUI(); };
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
