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

  .icon-btn{ width:38px; height:38px; display:flex; align-items:center; justify-content:center;
    background:transparent; border:0; padding:0; cursor:pointer; transition:filter .2s ease; position:relative; z-index:4; }
  .icon-btn img, .icon-btn svg{ width:100%; height:100%; display:block; object-fit:contain; }
  .icon-btn:hover{ filter:brightness(1.05); }

  :host{
    position:fixed; right:20px; z-index:10000;

    /* габариты */
    --vw-h: 760px;
    --vw-w: 420px;
    --vw-radius:16px;

    /* типографика (проектные + добавленные) */
    --header-h: 60px;
    --fs-title: 16px;
    --fs-subtitle: 16px;
    --fs-body: 12px;
    --fs-meta: 12px;
    --fs-meta-value: 12px;
    --fs-hero: 28px;
    --fs-button: 14px;
    --fs-placeholder: 14px;

    /* цвета */
    --grad-1:#A18CD1; --grad-2:#FBC2EB;
    --txt:#4E4E4E; 
    --muted:#7F7F7F;
    --dot:#D9DEE6; --dot-on:#8AD39D; --orange:#FF7A45;
    --shadow:0 20px 60px rgba(0,0,0,.18);

    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;
    top: calc(50% - var(--vw-h) / 2);
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

  .scrim{ position:fixed; inset:0; background:rgba(0,0,0,.28); opacity:0; pointer-events:none; transition:opacity .2s ease; }
  :host(.open) .scrim{ opacity:1; pointer-events:auto; }

  /* виджет */
  .widget{ width:400px; height:760px; border-radius:20px; overflow:hidden; box-shadow:var(--shadow);
    position:relative; transform-origin:bottom right; transition:opacity .2s ease, transform .2s ease;
    opacity:0; transform: translateY(8px) scale(.98); pointer-events:none; backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); }
  .widget::before{ content:''; position:absolute; inset:0; background:rgba(0,0,0,.7); border-radius:20px; z-index:1; }
  .widget::after{ content:''; position:absolute; inset:0; background:linear-gradient(90deg,#300E7E 0%, #BD65A4 100%); opacity:.2; border-radius:20px; z-index:2; }
  :host(.open) .widget{ opacity:1; transform:none; pointer-events:auto; }

  /* Header (без фона и без градиентной обводки, top:10px) */
  .header{
    position: sticky;
    top: 10px;
    z-index: 3;
    display:flex; align-items:center; justify-content:space-between;
    width:400px; height:60px; padding:0 20px;
    background: transparent;             /* было rgba(...) */
    border-radius:20px 20px 0 0;
    border:1px solid transparent;        /* оставили прозрачный 1px */
    background-clip:padding-box;
    position:relative;
  }
  .header::before{ content: none; }      /* убрана градиентная обводка */

  .title{ font-weight:700; font-size:var(--fs-title); display:flex; gap:8px; align-items:center;
    background:linear-gradient(90deg,#300E7E 0%, #BD65A4 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; color:transparent; position:relative; z-index:4; }
  .header-left{ display:flex; align-items:center; position:relative; z-index:4; }
  .header-left img{ width:91px; height:38px; object-fit:contain; }
  .header-center{ display:none; }
  .header-actions{ margin-left:auto; display:flex; align-items:center; gap:8px; position:relative; z-index:4; }
  .header-question-btn, .header-switch-btn{ display:flex; align-items:center; justify-content:center; background:transparent; border:0; padding:0; cursor:pointer; transition:filter .2s ease; position:relative; z-index:4; }
  .header-question-btn{ width:24px; height:24px; } .header-switch-btn{ width:56px; height:24px; }
  .header-question-btn img, .header-switch-btn img{ width:100%; height:100%; display:block; object-fit:contain; }
  .header-question-btn:hover, .header-switch-btn:hover{ filter:brightness(1.05); }

  /* Lead capture header button */
  .header-lead-btn{ display:inline-flex; align-items:center; height:26px; padding:0 10px; border:none; cursor:pointer; border-radius:999px; white-space:nowrap; background:rgba(255,255,255,.14); color:#fff; font-weight:600; font-size:12px; box-shadow:0 2px 8px rgba(0,0,0,.18); transition:transform .12s ease, box-shadow .2s ease; }
  .header-lead-btn:hover{ transform: translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.22); }

  /* Understanding bar removed */

  /* Content */
  .content{ display:flex; flex-direction:column; height:calc(100% - 60px); padding:30px 20px 30px; gap:30px; position:relative; z-index:3; }
  /* Для Details — те же отступы, что и для чата */
  .content.understanding-mode { padding: 30px 20px 30px; }  /* было 0 20px */

  /* Main Screen */
  .main-screen{ display:flex; flex-direction:column; height:100%; }
  .main-screen.hidden{ display:none; }
  .main-content{ display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:24px; text-align:center; }
  .big-mic{ width:120px; height:120px; border:none; cursor:pointer; background:transparent; display:flex; align-items:center; justify-content:center; transition:transform .15s ease; }
  .big-mic:hover{ transform:scale(1.05); }
  .big-mic svg{ width:100%; height:100%; fill:#fff; }
  .big-mic img{ width:100%; height:100%; display:block; object-fit:contain; }

  /* Главный экран — роли */
  .main-title{   /* Voice Intelligent Assistance — подзаголовок */
    font-size:var(--fs-subtitle); font-weight:400; color:var(--muted); line-height:1.35;
  }
  .main-subtitle{ /* Press To Speak — крупный хедер */
    font-size:var(--fs-hero); font-weight:700; color:#FFFFFF; line-height:1.15;
  }

  /* Chat */
  .chat-screen{ display:flex; flex-direction:column; height:100%; gap:20px; min-height:0; }
  .chat-screen.hidden{ display:none; }
  .messages-frame{ flex:1; border-radius:20px; background:transparent; border:1px solid transparent; position:relative; display:flex; flex-direction:column; min-height:0; height:400px; }
  .messages-frame::before{
    content:''; position:absolute; inset:0; border-radius:20px; padding:1px;
    background:conic-gradient(from 0deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 81%,#300E7E 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor; mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude;
  }
  .messages{ flex:1; overflow:auto; padding:16px; border-radius:20px; background:transparent; border:none; scrollbar-gutter:stable both-edges; position:relative; z-index:1; height:100%; min-height:0; max-height:100%; margin:2px; }
  .messages::-webkit-scrollbar{ width:2px; }
  .messages::-webkit-scrollbar-track{ background:transparent; }
  .messages::-webkit-scrollbar-thumb{ background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.5) 20%,rgba(100,100,100,.5) 80%,transparent 100%); border-radius:1px; }
  .messages::-webkit-scrollbar-thumb:hover{ background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.7) 20%,rgba(100,100,100,.7) 80%,transparent 100%); }
  .messages{ scrollbar-width:thin; scrollbar-color:rgba(100,100,100,.5) transparent; }
  .thread{ display:flex; flex-direction:column; gap:12px; position:relative; z-index:1; min-height:0; }
  .message{ display:flex; }
  .message.user{ justify-content:flex-end; }
  .message.assistant{ justify-content:flex-start; }
  .bubble{ max-width:97%; padding:12px 16px; border-radius:20px; line-height:1.45; font-size:var(--fs-body); box-shadow:0 4px 16px rgba(0,0,0,.08); word-break:break-word; white-space:pre-wrap; overflow-wrap:anywhere; }
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
  .message.user .bubble{ background:#333333; color:#fff; border-bottom-right-radius:8px; }
  .message.assistant .bubble{ background:#646464; color:#fff; border-bottom-left-radius:8px; }

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
  /* Стили удалены: inline bubble наследует стили от классов большой формы (lead-*) */

  /* Input */
  .input-container{ display:flex; gap:12px; align-items:center; padding:16px; width:360px; height:60px; background:rgba(51,51,51,.7); border-radius:20px; border:1px solid transparent; background-clip:padding-box; position:relative; box-shadow:0 8px 24px rgba(0,0,0,.10); }
  .input-container::before{ content:''; position:absolute; inset:0; border-radius:20px; padding:1px;
    background:conic-gradient(from 0deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 81%,#300E7E 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor; mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude; }
  .text-input{ flex:1; background:transparent; border:none; outline:none; color:#FFFFFF; font-size:calc(var(--fs-body) + 2px); padding:8px 0; position:relative; z-index:4; }
  .text-input::placeholder{ color:#ffffff; opacity:.6; font-size:var(--fs-placeholder); font-weight:400; }
  .text-input-wrapper.recording .text-input::placeholder { opacity:0; }
  .text-input-wrapper{ flex:1; position:relative; display:flex; align-items:center; }

  .recording-indicator{ position:absolute; left:0; top:0; right:0; bottom:0; display:flex; align-items:center; gap:12px; padding:8px 0; background:transparent; pointer-events:none; }
  .visualizer{ display:flex; align-items:center; gap:2px; }
  .wave{ width:3px; height:12px; background:#A78BFA; border-radius:2px; animation:wave 1.2s ease-in-out infinite; }
  .wave:nth-child(1){ animation-delay:0s; } .wave:nth-child(2){ animation-delay:.2s; } .wave:nth-child(3){ animation-delay:.4s; }
  @keyframes wave{ 0%,40%,100%{ height:12px; } 20%{ height:20px; } }
  @keyframes shake{ 0%,100%{ transform:translateX(0); } 10%,30%,50%,70%,90%{ transform:translateX(-2px); } 20%,40%,60%,80%{ transform:translateX(2px); } }
  .shake{ animation:shake .5s ease-in-out; }
  .record-timer{ color:#FFFFFF; font-size:12px; font-weight:600; letter-spacing:.2px; min-width:42px; text-align:left; }

  .details-btn{ display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 16px; border:none; cursor:pointer; border-radius:999px; white-space:nowrap; background:linear-gradient(90deg,#300E7E 0%, #BD65A4 100%); color:#fff; font-weight:600; font-size:var(--fs-button); box-shadow:0 4px 12px rgba(48,14,126,.20); transition:transform .12s ease, box-shadow .2s ease; }
  .details-btn:hover{ transform: translateY(-1px); box-shadow:0 6px 16px rgba(48,14,126,.28); }
  .details-btn svg{ width:100%; height:100%; fill:#fff; }
  .details-btn.dialog-mode{ background:linear-gradient(90deg,#8B5CF6 0%, #A855F7 100%); }

  .loading{ position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:linear-gradient(90deg, rgba(48,14,126,.10), rgba(189,101,164,.10)); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius:20px; z-index:2; pointer-events:none; }
  .loading.active{ display:flex; }
  .loading-text{ color:#ffffff; font-size:20px; font-weight:600; display:flex; align-items:center; gap:4px; }
  .loading-text .dots{ display:inline-flex; gap:2px; margin-left:2px; }
  .loading-text .dots span{ display:inline-block; opacity:.2; animation:dotBlink 1.2s infinite ease-in-out; }
  .loading-text .dots .d1{ animation-delay:0s; }
  .loading-text .dots .d2{ animation-delay:.15s; }
  .loading-text .dots .d3{ animation-delay:.3s; }
  @keyframes dotBlink{ 0%,100%{ opacity:.2; transform:translateY(0); } 50%{ opacity:1; transform:translateY(-2px); } }

  /* ======= DETAILS ======= */
  .details-screen{ display:flex; flex-direction:column; height:100%; gap:20px; }
  .details-screen.hidden{ display:none; }

  .details-content{
    flex:1;
    overflow:visible;
    padding:0 0 24px;         /* было 8px 0 24px */
    background:transparent;
    border:none;
    position:relative;
  }

  /* секции — без горизонтальных margin, радиус 20px как у чата */
  .progress-section, .details-section{
    margin:16px 0;            /* было 16px 20px */
    padding:16px;
    border-radius:20px;       /* было 16px */
    background:rgba(255,255,255,0.04);
    border:1px solid transparent;
    position:relative;
  }
  .progress-section{ margin-top:12px; padding:14px 16px; }
  .details-section::before, .progress-section::before{
    content:''; position:absolute; inset:0; border-radius:20px; padding:1px; /* радиус 20px */
    background:conic-gradient(from 0deg, #300E7E 0%, #782160 23%, #E646B9 46%, #2D065A 64%, #BD65A4 81%, #300E7E 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite:xor;
    mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite:exclude;
  }

  .details-title{ font-weight:400; font-size:var(--fs-subtitle); color:#ffffff; margin-bottom:18px; position:relative; z-index:1; }

  .progress-bar{ height:4px; border-radius:2px; overflow:hidden; background:rgba(255,255,255,.18); margin-bottom:10px; position:relative; z-index:1; }
  .progress-fill{ height:100%; width:0%; background:#A78BFA; transition:width .28s ease; }
  .progress-text{ font-size:var(--fs-meta); color:var(--muted); text-align:left; z-index:1; position:relative; }

  .param-list{ display:grid; grid-auto-rows:minmax(18px, auto); row-gap:10px; position:relative; z-index:1; }
  .param-row{
    display:grid;
    grid-template-columns: minmax(0, 50%) minmax(0, 50%);
    column-gap:16px; align-items:center; line-height:1.35;
  }
  .param-label{ font-size:var(--fs-body); color:#ffffff; display:flex; align-items:center; gap:10px; font-weight:500; }
  .param-dot{ width:6px; height:6px; border-radius:50%; background:#E646B9; flex-shrink:0; }

  .param-value{
    font-size:var(--fs-meta-value);
    color:var(--muted);       /* было #BBBBBB */
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    justify-self:end; text-align:right; max-width:100%; font-weight:400;
    position:relative; cursor: default; user-select: auto;
  }
  .param-value:hover { outline: none; text-decoration: none; }
  .param-value:focus { outline: none; }

  /* Tooltip for param-value */
  /* кастомный tooltip отключен — используем нативный title */

  .action-buttons{ display:flex; gap:16px; margin:18px 0 4px 0; align-items:center; }  /* было 18px 20px 4px 20px */
  .btn-back, .btn-refresh{ height:40px; padding:0 24px; border:none; border-radius:12px; font-size:var(--fs-button); font-weight:600; cursor:pointer; transition:all .2s ease; position:relative; z-index:1; }
  .btn-back{ background:rgba(51,51,51,.8); color:#fff; border:1px solid transparent; }
  .btn-back::before{ content:''; position:absolute; inset:0; border-radius:12px; padding:1px;
    background:conic-gradient(from 0deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 81%,#300E7E 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor;
    mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude; }
  .btn-back:hover{ background:#646464; transform:translateY(-1px); }
  .btn-refresh{ background:transparent; color:#BBBBBB; padding:0; }
  .btn-refresh:hover{ color:#ffffff; }

  .legal-text{ margin:14px 0 0 0; height:auto; display:flex; justify-content:center; }  /* центрируем контейнер */
  .tooltip-container{ position:relative; display:inline-block; }
  .tooltip-trigger{ font-size:var(--fs-meta); color:#E646B9; cursor:pointer; text-decoration:underline; text-decoration-color:rgba(230,70,185,.5); transition:color .2s ease; }
  .tooltip-trigger:hover{ color:#ffffff; }
  .tooltip-content{
    position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:360px; background:rgba(51,51,51,.95);
    border:1px solid transparent; border-radius:16px; padding:20px; opacity:0; visibility:hidden; transition:all .3s ease; z-index:1000; backdrop-filter: blur(10px);
    box-shadow:0 20px 60px rgba(0,0,0,.4); height:auto; min-height:auto;
  }
  .tooltip-content::before{ content:''; position:absolute; inset:0; border-radius:16px; padding:1px;
    background: conic-gradient(from 0deg, #300E7E 0%, #782160 23%, #E646B9 46%, #2D065A 64%, #BD65A4 81%, #300E7E 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; }
  .tooltip-content p{ font-size:var(--fs-meta); line-height:1.6; color:var(--muted); margin-bottom:12px; position:relative; z-index:1; } /* цвет = muted */
  .tooltip-content p:last-child{ margin-bottom:0; }
  .tooltip-container:hover .tooltip-content{ opacity:1; visibility:visible; }
  .tooltip-content::after{ content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:6px solid transparent; border-top-color:rgba(51,51,51,.95); }

  /* Lead form overlay */
  .lead-panel{ position:absolute; inset:0; display:none; align-items:center; justify-content:center; z-index:1000; }
  .lead-panel.active{ display:flex; }
  .lead-overlay{ position:absolute; inset:0; background:rgba(0,0,0,.40); z-index:0; }
  .lead-box{ position:relative; width:400px; background:rgba(51,51,51,.95); border:none; border-radius:20px; padding:16px; box-shadow:0 18px 48px rgba(0,0,0,.35); z-index:1; pointer-events:auto; }
  .lead-box.thankyou{ width:80%; height:30%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .lead-box::before{ content:none; }
  .lead-title{ font-weight:600; color:#fff; margin:0 0 10px 0; font-size:14px; }
  .lead-thanks-title{ margin:0 0 8px 0; color:#fff; font-size:20px; font-weight:700; text-align:center; }
  .lead-thanks-note{ margin:0 0 12px 0; color:#fff; opacity:.7; font-weight:300; text-align:center; }
  .lead-row{ display:flex; flex-direction:column; gap:6px; margin:8px 0; }
  .lead-label{ font-size:12px; color:#BBBBBB; }
  .lead-input, .lead-select, .lead-textarea{ width:100%; height:36px; border-radius:12px; border:1px solid rgba(167,139,250,.35); background:rgba(167,139,250,.12); color:#fff; padding:8px 12px; font-size:13px; outline:none; pointer-events:auto; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
  .lead-input:hover, .lead-select:hover, .lead-textarea:hover{ border-color: rgba(167,139,250,.55); background: rgba(167,139,250,.16); }
  .lead-input:focus, .lead-select:focus, .lead-textarea:focus{ border-color:#A78BFA; box-shadow:0 0 0 3px rgba(167,139,250,.25); }
  /* Custom select styling */
  .lead-select{ -webkit-appearance:none; appearance:none; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23C4B5FD" viewBox="0 0 16 16"><path d="M4.646 6.646a.5.5 0 0 1 .708 0L8 9.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z"/></svg>'); background-repeat:no-repeat; background-position: right 10px center; padding-right:36px; }
  .lead-textarea{ height:64px; resize:vertical; }
  .lead-actions{ display:flex; gap:10px; margin-top:10px; }
  .lead-submit{ flex:1; height:40px; border:none; border-radius:12px; background:linear-gradient(90deg,#8B5CF6 0%, #A855F7 100%); color:#fff; font-weight:700; cursor:pointer; pointer-events:auto; box-shadow:0 6px 16px rgba(168,85,247,.22); transition:transform .12s ease, box-shadow .15s ease, filter .15s ease; }
  .lead-box.thankyou .lead-actions{ justify-content:center; }
  .lead-box.thankyou #leadContinue{ width:200px; height:50px; flex:0 0 auto; }
  .lead-submit:hover{ filter: brightness(1.06); transform: translateY(-1px); box-shadow:0 8px 20px rgba(168,85,247,.28); }
  .lead-cancel{ flex:1; height:40px; border:1px solid rgba(255,255,255,.18); border-radius:12px; background:transparent; color:#FFFFFF; font-weight:700; cursor:pointer; pointer-events:auto; transition:transform .12s ease, background .15s ease, border-color .15s ease; }
  .lead-cancel:hover{ background:rgba(255,255,255,.08); transform: translateY(-1px); border-color: rgba(255,255,255,.28); }
  .lead-consent{ display:flex; align-items:flex-start; gap:8px; margin-top:6px; pointer-events:auto; }
  .lead-consent input{ margin-top:3px; pointer-events:auto; }
  .lead-invalid{ border-color:#FF6363 !important; box-shadow:0 0 0 2px rgba(255,99,99,.25); }
  .shake-lead{ animation: shake .5s ease-in-out; }
  .lead-consent.lead-invalid .consent-text{ color:#FF9A9A; }
  .lead-error{ font-size:11px; color:#FF9A9A; margin-top:4px; min-height:14px; }
  .lead-consent .consent-text{ font-size:12px; color:#BBBBBB; line-height:1.4; }
  .lead-consent .consent-text a{ color:#C4B5FD; text-decoration:underline; }

  /* Специальный класс для popup с хранением данных */
  .legal-popup{
    position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:380px; background:rgba(51,51,51,.95);
    border:1px solid transparent; border-radius:16px; padding:24px; opacity:0; visibility:hidden; transition:all .3s ease; z-index:1000; backdrop-filter: blur(10px);
    box-shadow:0 20px 60px rgba(0,0,0,.4); height:auto; min-height:auto;
  }
  .legal-popup::before{ content:''; position:absolute; inset:0; border-radius:16px; padding:1px;
    background: conic-gradient(from 0deg, #300E7E 0%, #782160 23%, #E646B9 46%, #2D065A 64%, #BD65A4 81%, #300E7E 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; }
  .legal-popup p{ font-size:var(--fs-meta); line-height:1.6; color:var(--muted); margin-bottom:16px; position:relative; z-index:1; }
  .legal-popup p:last-child{ margin-bottom:0; }
  .tooltip-container:hover .legal-popup{ opacity:1; visibility:visible; }

  /* Responsive */
  @media (max-width:1024px){
    :host{ left:0; right:0; bottom:auto; top:auto; }
    .widget{ width:100%; max-width:640px; margin:0 auto; border-radius:16px 16px 0 0; transform:translateY(100%); transition:transform .28s ease, opacity .28s ease; }
    :host(.open) .widget{ transform:translateY(0); }
  }
  /* Mobile iPhone range: 430, 414, 390, 375, 360 */
  @media (max-width:430px){
    .widget{ height:100dvh; width:100%; max-width:none; border-radius:16px 16px 0 0; overflow:auto; }
    .content{ padding-bottom:max(12px, env(safe-area-inset-bottom)); height:auto; min-height:100%; }
    .lead-box{ width:100%; max-width:100%; padding:16px; margin:8px 10px; }
    .lead-actions .lead-submit{ min-width:160px; }
  }
  @media (max-width:414px){
    .lead-box{ padding:14px; margin:8px 8px; }
    .messages-frame{ overflow:auto; }
  }
  @media (max-width:390px){
    .lead-box{ padding:12px; }
    .lead-row{ margin:6px 0; }
    #lbCountryCode{ flex:0 0 110px !important; }
    .messages-frame{ overflow:auto; }
  }
  @media (max-width:375px){
    .lead-box{ padding:12px; }
    #lbCountryCode{ flex:0 0 100px !important; }
    .messages-frame{ overflow:auto; }
  }
  @media (max-width:360px){
    .lead-box{ padding:10px; margin:6px; }
    #lbCountryCode{ flex:0 0 96px !important; }
    .lead-actions .lead-submit{ min-width:150px; }
    .messages-frame{ overflow:auto; }
  }
  @media (prefers-reduced-motion:reduce){ *{ transition:none!important; animation:none!important; } }
  </style>

  <!-- Launcher -->
  <button class="launcher" id="launcher" title="Спросить голосом" aria-label="Спросить голосом">
    <img src="${ASSETS_BASE}Voice-big-btn.svg" alt="Voice" />
  </button>

  <div class="scrim" id="scrim"></div>

  <div class="widget" role="dialog" aria-modal="true" aria-label="Voice Assistant">
    <!-- Header -->
    <div class="header">
      <div class="header-left"><img src="${ASSETS_BASE}logo-group-resized.svg" alt="VIA logo" /></div>
      <div class="header-actions">
        <button class="header-question-btn" id="btnToggle" title="Details"><img src="${ASSETS_BASE}details-btn.svg" alt="Details" /></button>
        <button class="header-lead-btn" id="btnOpenLead"></button>
      </div>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Main Screen -->
      <div class="main-screen" id="mainScreen">
        <div class="main-content">
          <button class="big-mic" id="mainButton" aria-pressed="false"><img src="${ASSETS_BASE}Voice-big-btn.svg" alt="Voice" /></button>
          <div>
            <div class="main-title">Voice Intelligent Assistance</div>
            <div class="main-subtitle">Press To Speak</div>
          </div>
        </div>

        <div class="input-container">
          <div class="text-input-wrapper">
            <input class="text-input" id="mainTextInput" type="text" placeholder="Введите ваш вопрос…"/>
            <div class="recording-indicator" id="mainRecordingIndicator" style="display: none;">
              <div class="visualizer"><div class="wave"></div><div class="wave"></div><div class="wave"></div></div>
              <div class="record-timer" id="mainRecordTimer">00:00</div>
            </div>
          </div>
          <button class="icon-btn" id="mainToggleButton" aria-pressed="false" title="Говорить"><img src="${ASSETS_BASE}mic-btn.svg" alt="Microphone" /></button>
          <button class="icon-btn" id="mainSendButton" title="Отправить"><img src="${ASSETS_BASE}send-btn.svg" alt="Send" /></button>
        </div>
      </div>

      <!-- Chat Screen -->
      <div class="chat-screen hidden" id="chatScreen">
        <div class="messages-frame">
          <div class="messages" id="messagesContainer">
            <div class="thread" id="thread"></div>
          </div>
            <div class="loading" id="loadingIndicator"><span class="loading-text">Обрабатываю запрос <span class="dots"><span class="d1">•</span><span class="d2">•</span><span class="d3">•</span></span></span></div>
        </div>

        <div class="input-container">
          <div class="text-input-wrapper">
            <input class="text-input" id="textInput" type="text" placeholder="Введите ваш вопрос…"/>
            <div class="recording-indicator" id="recordingIndicator" style="display: none;">
              <div class="visualizer"><div class="wave"></div><div class="wave"></div><div class="wave"></div></div>
              <div class="record-timer" id="chatRecordTimer">00:00</div>
            </div>
          </div>
          <button class="icon-btn" id="toggleButton" aria-pressed="false" title="Говорить"><img src="${ASSETS_BASE}mic-btn.svg" alt="Microphone" /></button>
          <button class="icon-btn" id="sendButton" title="Отправить"><img src="${ASSETS_BASE}send-btn.svg" alt="Send" /></button>
        </div>
      </div>

      <!-- Details Screen -->
      <div class="details-screen hidden" id="detailsScreen">
        <div class="details-content">
          <div class="progress-section">
            <div class="details-title">Понимание запроса</div>
            <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
            <div class="progress-text" id="progressText">0% — ожидание</div>
          </div>

          <div class="legal-text">
            <div class="tooltip-container">
              <span class="tooltip-trigger">Хранение данных</span>
              <div class="legal-popup">
                <p>Данные зашифрованы и используются только для определения лучшего варианта недвижимости. Не сохраняются после завершения сессии.</p>
                <p>Данные могут быть использованы для записи на встречу, передачи менеджеру и в рекламных целях только с согласия пользователя. Будут храниться в зашифрованном виде по закону.</p>
              </div>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn-back" id="btnBackToChat">Назад к диалогу</button>
            <button class="btn-refresh" id="btnRefreshSession">Обновить сессию</button>
          </div>

          <div class="details-section">
            <div class="details-title">Основная информация</div>
            <div class="param-list">
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Имя клиента</div><div class="param-value" id="nameValue" title="не определено">не определено</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Тип операции</div><div class="param-value" id="operationValue" title="не определена">не определена</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Бюджет</div><div class="param-value" id="budgetValue" title="не определен">не определен</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Тип недвижимости</div><div class="param-value" id="typeValue" title="не определен">не определен</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Город/район</div><div class="param-value" id="locationValue" title="не определен">не определен</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Количество комнат</div><div class="param-value" id="roomsValue" title="не определено">не определено</div></div>
            </div>
          </div>

          <div class="details-section">
            <div class="details-title">Детали и предпочтения</div>
            <div class="param-list">
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Площадь</div><div class="param-value" id="areaValue" title="не определена">не определена</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Детали локации</div><div class="param-value" id="detailsValue" title="не определены">не определены</div></div>
              <div class="param-row"><div class="param-label"><span class="param-dot"></span> Дополнительно</div><div class="param-value" id="preferencesValue" title="не определены">не определены</div></div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Lead Panel -->
    <div class="lead-panel" id="leadPanel" aria-hidden="true">
      <div class="lead-overlay" id="leadOverlay"></div>
      <div class="lead-box" role="dialog" aria-modal="true" aria-labelledby="leadTitle">
        <div class="lead-title" id="leadTitle"></div>
        <div class="lead-row">
          <label class="lead-label" for="leadName" id="leadNameLabel"></label>
          <input class="lead-input" id="leadName" type="text" />
          <div class="lead-error" id="leadNameError"></div>
        </div>
        <div class="lead-row" id="leadContactRow">
          <label class="lead-label" id="leadContactLabel"></label>
          <div style="display:flex; gap:8px;">
            <select class="lead-select" id="leadCountryCode" style="flex:0 0 120px"></select>
            <input class="lead-input" id="leadPhone" type="tel" inputmode="numeric" pattern="[0-9]*" placeholder="600112233" />
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <input class="lead-input" id="leadEmail" type="email" placeholder="name@example.com" />
          </div>
          <div class="lead-error" id="leadContactError"></div>
        </div>
        <div class="lead-row">
          <label class="lead-label" for="leadChannel" id="leadChannelLabel"></label>
          <select class="lead-select" id="leadChannel">
            <option value="whatsapp" id="optWhatsApp"></option>
            <option value="phone" id="optPhone"></option>
            <option value="email" id="optEmail"></option>
          </select>
        </div>
        <div class="lead-row">
          <label class="lead-label" for="leadTime" id="leadTimeLabel"></label>
          <select class="lead-select" id="leadTime"></select>
        </div>
        <div class="lead-row">
          <label class="lead-label" for="leadNote" id="leadNoteLabel"></label>
          <textarea class="lead-textarea" id="leadNote"></textarea>
        </div>
        <div class="lead-consent">
          <input type="checkbox" id="leadConsent" />
          <div class="consent-text" id="leadConsentText"></div>
        </div>
        <div class="lead-error" id="leadConsentError"></div>
        <div class="lead-actions">
          <button class="lead-cancel" id="leadCancel"></button>
          <button class="lead-submit" id="leadSubmit"></button>
        </div>
      </div>
    </div>
  </div>
  `;


  /* ...весь остальной JS из твоего рендера (обработчики, showScreen и т.д.) без изменений... */



  const $ = s => this.shadowRoot.querySelector(s);

  // Screen management
  const screens = {
    main: $('#mainScreen'),
    chat: $('#chatScreen'),
    details: $('#detailsScreen')
  };

  const showScreen = (screenName) => {
    Object.values(screens).forEach(screen => screen?.classList.add('hidden'));
    screens[screenName]?.classList.remove('hidden');
    
    // Add/remove understanding-mode class for content
    const content = this.shadowRoot.querySelector('.content');
    if (content) {
      if (screenName === 'details') {
        content.classList.add('understanding-mode');
      } else {
        content.classList.remove('understanding-mode');
      }
    }

    // Auto-scroll to bottom on returning to chat
    if (screenName === 'chat') {
      this.scrollThreadToBottom(true);
    }
  };

  // Launcher
  $("#launcher")?.addEventListener("click", () => {
    this.classList.add("open");
    this.shadowRoot.getElementById("textInput")?.focus();
  });

  // Header toggle button
  $("#btnToggle")?.addEventListener("click", () => {
    const isDetailsMode = screens.details?.classList.contains('hidden') === false;
    if (isDetailsMode) {
      showScreen('chat');
      this.events.emit('details-close');
      this.updateHeaderToggleButton('dialog');
    } else {
      showScreen('details');
      this.events.emit('details-open');
      this.updateHeaderToggleButton('details');
    }
  });

  // Lead panel open/close
  const leadPanel = $('#leadPanel');
  $('#btnOpenLead')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    leadPanel?.classList.add('active');
    leadPanel?.setAttribute('aria-hidden', 'false');
    $('#leadName')?.focus();
  });
  $('#leadOverlay')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    leadPanel?.classList.remove('active');
    leadPanel?.setAttribute('aria-hidden', 'true');
  });
  $('#leadCancel')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    leadPanel?.classList.remove('active');
    leadPanel?.setAttribute('aria-hidden', 'true');
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
  
  // Details screen buttons
  $("#btnBackToChat")?.addEventListener("click", () => {
    if (this.messages && this.messages.length > 0) {
      showScreen('chat');
      this.events.emit('details-close');
      this.updateHeaderToggleButton('dialog');
    } else {
      showScreen('main');
      this.events.emit('details-close');
      this.updateHeaderToggleButton('main');
    }
  });
  
  $("#btnRefreshSession")?.addEventListener("click", () => {
    this.messages = [];
    this.sessionId = null;
    try {
      localStorage.removeItem('vw_sessionId');
      localStorage.removeItem('voiceWidgetSessionId');
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }
    const thread = this.shadowRoot.getElementById('thread');
    if (thread) thread.innerHTML = '';
    const mainTextInput = this.shadowRoot.getElementById('mainTextInput');
    if (mainTextInput) mainTextInput.value = '';
    const textInput = this.shadowRoot.getElementById('textInput');
    if (textInput) textInput.value = '';
    this.updateUnderstanding(0);
    showScreen('main');
    this.events.emit('details-close');
    this.updateHeaderToggleButton('main');
    console.log('Session reset successfully');
  });

  // Escape key
  this.shadowRoot.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (screens.details?.classList.contains('hidden') === false) {
        showScreen('chat');
        this.events.emit('details-close');
      } else if (screens.chat?.classList.contains('hidden') === false) {
        showScreen('main');
      } else {
        this.classList.remove("open");
      }
    }
  });

  // Expose helpers
  this.showScreen = showScreen;
  this.showMainScreen = () => showScreen('main');
  this.showChatScreen = () => showScreen('chat');
  this.showDetailsScreen = () => showScreen('details');
  
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
    };
    thread.addEventListener('scroll', updateFlag, { passive:true });
    // initialize
    updateFlag();
  })();
  this.openLeadPanel = () => {
    const leadPanelEl = this.shadowRoot.getElementById('leadPanel');
    if (leadPanelEl) {
      leadPanelEl.classList.add('active');
      leadPanelEl.setAttribute('aria-hidden', 'false');
      const nameEl = this.shadowRoot.getElementById('leadName');
      if (nameEl) nameEl.focus();
    }
  };

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
    this.scrollThreadToBottom(true);
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
    this.scrollThreadToBottom(false);

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
          <div style="display:flex; gap:8px;"><select class="lead-select" id="lbCountryCode" style="flex:0 0 120px"></select><input class="lead-input" id="lbPhoneInput" type="tel" inputmode="numeric" placeholder="600112233" /></div>
        </div>
        <div class="lead-row">
          <label class="lead-label" for="lbEmailInput">${this.tLead('optEmail')||'Email'}</label>
          <input class="lead-input" id="lbEmailInput" type="email" placeholder="name@example.com" maxlength="254" />
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
      const dst = lb.querySelector('#lbCountryCode');
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
          const cc = String(lb.querySelector('#lbCountryCode')?.value || '');
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
          <input class="lead-input" id="lbName" type="text" />
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
            this.scrollThreadToBottom(true);
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
    this.events.on('textMessageSent', (d) => { console.log('📤 Text message sent:', d?.text?.slice(0,50)); });

    // Screen transitions
    this.events.on('details-open', () => {
      console.log('📊 Details screen opened');
    });
    this.events.on('details-close', () => {
      console.log('📊 Details screen closed');
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
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}stop-btn.svg" alt="Stop" />`;
        toggleButton.setAttribute('title', 'Сбросить');
      } else {
        // Show mic icon
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}mic-btn.svg" alt="Microphone" />`;
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

  // Update header toggle button
  updateHeaderToggleButton(mode) {
    const toggleButton = this.shadowRoot.getElementById('btnToggle');
    if (!toggleButton) return;

    if (mode === 'details') {
      // Show return icon when details are open
      toggleButton.innerHTML = `<img src="${ASSETS_BASE}return-btn.svg" alt="Return" />`;
      toggleButton.setAttribute('title', 'Return to Dialog');
    } else {
      // Show question icon when in dialog mode
      toggleButton.innerHTML = `<img src="${ASSETS_BASE}details-btn.svg" alt="Details" />`;
      toggleButton.setAttribute('title', 'Details');
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
    this.scrollThreadToBottom(false);
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
      const actionPanel = actionsMsg.querySelector('.card-actions-panel');
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
    console.log('👋 Voice Widget disconnected and cleaned up');
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
