// ========================================
/* 📁 voice-widget.js (ОБНОВЛЁННАЯ ВЕРСИЯ) */
// ========================================

// Базовый путь для ассетов
const ASSETS_BASE = window.__VW_ASSETS_BASE__ || '${ASSETS_BASE}';

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
    this.apiUrl = this.getAttribute('api-url') || 'https://voice-widget-backend-production.up.railway.app/api/audio/upload';
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

    // грузим данные сессии только если id есть
    if (this.sessionId) {
      this.api.loadSessionInfo();
    }

    // Initialize understanding bar with 0%
    this.updateUnderstanding(0);

    // Initialize send buttons with disabled state
    const mainSendButton = this.shadowRoot.getElementById('mainSendButton');
    const sendButton = this.shadowRoot.getElementById('sendButton');
    if (mainSendButton) mainSendButton.setAttribute('aria-disabled', 'true');
    if (sendButton) sendButton.setAttribute('aria-disabled', 'true');

    console.log('✅ Voice Widget инициализирован');
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
  .header-center{ display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; z-index:4; }
  .header-actions{ display:flex; align-items:center; gap:8px; position:relative; z-index:4; }
  .header-question-btn, .header-switch-btn{ display:flex; align-items:center; justify-content:center; background:transparent; border:0; padding:0; cursor:pointer; transition:filter .2s ease; position:relative; z-index:4; }
  .header-question-btn{ width:24px; height:24px; } .header-switch-btn{ width:56px; height:24px; }
  .header-question-btn img, .header-switch-btn img{ width:100%; height:100%; display:block; object-fit:contain; }
  .header-question-btn:hover, .header-switch-btn:hover{ filter:brightness(1.05); }

  /* Understanding bar (header) — Meta System */
  .understanding-title{ font-size:var(--fs-meta); color:var(--muted); margin-bottom:4px; font-weight:500; }
  .understanding-scale{ width:140px; height:2px; position:relative; border-radius:2px; overflow:hidden; }
  .understanding-track{ position:absolute; inset:0; background:rgba(255,255,255,.15); border-radius:2px; }
  .understanding-fill{ position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 100%); border-radius:2px; transition:width .3s ease; }

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
  .bubble{ max-width:90%; padding:12px 16px; border-radius:20px; line-height:1.45; font-size:var(--fs-body); box-shadow:0 4px 16px rgba(0,0,0,.08); word-break:break-word; white-space:pre-wrap; overflow-wrap:anywhere; }
  .message.user .bubble{ background:#333333; color:#fff; border-bottom-right-radius:8px; }
  .message.assistant .bubble{ background:#646464; color:#fff; border-bottom-left-radius:8px; }

  /* Property Card */
  .property-card{ background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.12); margin-top:8px; }
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

  /* Input */
  .input-container{ display:flex; gap:12px; align-items:center; padding:16px; width:360px; height:60px; background:rgba(51,51,51,.7); border-radius:20px; border:1px solid transparent; background-clip:padding-box; position:relative; box-shadow:0 8px 24px rgba(0,0,0,.10); }
  .input-container::before{ content:''; position:absolute; inset:0; border-radius:20px; padding:1px;
    background:conic-gradient(from 0deg,#300E7E 0%,#782160 23%,#E646B9 46%,#2D065A 64%,#BD65A4 81%,#300E7E 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor; mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); mask-composite:exclude; }
  .text-input{ flex:1; background:transparent; border:none; outline:none; color:var(--txt); font-size:var(--fs-body); padding:8px 0; position:relative; z-index:4; }
  .text-input::placeholder{ color:#ffffff; opacity:.6; font-size:var(--fs-placeholder); font-weight:400; }
  .text-input-wrapper.recording .text-input::placeholder { opacity:0; }
  .text-input-wrapper{ flex:1; position:relative; display:flex; align-items:center; }

  .recording-indicator{ position:absolute; left:0; top:0; right:0; bottom:0; display:flex; align-items:center; gap:12px; padding:8px 0; background:transparent; pointer-events:none; }
  .visualizer{ display:flex; align-items:center; gap:2px; }
  .wave{ width:3px; height:12px; background:#FF8A4C; border-radius:2px; animation:wave 1.2s ease-in-out infinite; }
  .wave:nth-child(1){ animation-delay:0s; } .wave:nth-child(2){ animation-delay:.2s; } .wave:nth-child(3){ animation-delay:.4s; }
  @keyframes wave{ 0%,40%,100%{ height:12px; } 20%{ height:20px; } }
  @keyframes shake{ 0%,100%{ transform:translateX(0); } 10%,30%,50%,70%,90%{ transform:translateX(-2px); } 20%,40%,60%,80%{ transform:translateX(2px); } }
  .shake{ animation:shake .5s ease-in-out; }

  .details-btn{ display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 16px; border:none; cursor:pointer; border-radius:999px; white-space:nowrap; background:linear-gradient(90deg,#300E7E 0%, #BD65A4 100%); color:#fff; font-weight:600; font-size:var(--fs-button); box-shadow:0 4px 12px rgba(48,14,126,.20); transition:transform .12s ease, box-shadow .2s ease; }
  .details-btn:hover{ transform: translateY(-1px); box-shadow:0 6px 16px rgba(48,14,126,.28); }
  .details-btn svg{ width:100%; height:100%; fill:#fff; }
  .details-btn.dialog-mode{ background:linear-gradient(90deg,#8B5CF6 0%, #A855F7 100%); }

  .loading{ position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.4)); backdrop-filter: blur(2px); border-radius:20px; z-index:2; font-weight:600; color:#3b2a86; pointer-events:none; }
  .loading.active{ display:flex; }

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
  .progress-fill{ height:100%; width:0%; background:conic-gradient(from 0deg, #300E7E 0%, #782160 23%, #E646B9 46%, #2D065A 64%, #BD65A4 81%, #300E7E 100%); transition:width .28s ease; }
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
  }

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
      <div class="header-center">
        <div class="understanding-title">deep understanding: 0%</div>
        <div class="understanding-scale"><div class="understanding-track"></div><div class="understanding-fill" id="understandingFill"></div></div>
      </div>
      <div class="header-actions">
        <button class="header-question-btn" id="btnToggle" title="Details"><img src="${ASSETS_BASE}details-btn.svg" alt="Details" /></button>
        <button class="header-switch-btn" title="Switch Mode"><img src="${ASSETS_BASE}switch-mode.svg" alt="Switch Mode" /></button>
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
            <div class="loading" id="loadingIndicator"><span>Обрабатываю запрос…</span></div>
          </div>
        </div>

        <div class="input-container">
          <div class="text-input-wrapper">
            <input class="text-input" id="textInput" type="text" placeholder="Введите ваш вопрос…"/>
            <div class="recording-indicator" id="recordingIndicator" style="display: none;">
              <div class="visualizer"><div class="wave"></div><div class="wave"></div><div class="wave"></div></div>
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
  updateUnderstanding(percent) {
    const fill = this.shadowRoot.getElementById('understandingFill');
    const title = this.shadowRoot.querySelector('.understanding-title');
    
    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    
    if (title) {
      title.textContent = `deep understanding: ${Math.max(0, Math.min(100, percent))}%`;
    }
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

  // Update details screen with understanding data
  updateDetailsScreen(understanding) {
    const params = understanding.params || {};
    
    // Update progress
    const progressFill = this.shadowRoot.getElementById('progressFill');
    const progressText = this.shadowRoot.getElementById('progressText');
    if (progressFill && progressText) {
      const progress = understanding.progress || 0;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}% — ${progress === 0 ? 'ожидание' : 'обработка'}`;
    }

    // Update parameter values and dots
    const updateParam = (id, value, dotId) => {
      const valueEl = this.shadowRoot.getElementById(id);
      const dotEl = this.shadowRoot.getElementById(dotId);
      if (valueEl) valueEl.textContent = value || 'не определено';
      if (dotEl) dotEl.classList.toggle('on', !!value);
    };

    updateParam('nameValue', params.name, 'nameDot');
    updateParam('operationValue', params.operationType, 'operationDot');
    updateParam('budgetValue', params.budget, 'budgetDot');
    updateParam('typeValue', params.propertyType, 'typeDot');
    updateParam('locationValue', params.district, 'locationDot');
    updateParam('roomsValue', params.rooms, 'roomsDot');
    updateParam('areaValue', params.area, 'areaDot');
    updateParam('detailsValue', params.locationDetails, 'detailsDot');
    updateParam('preferencesValue', params.additional, 'preferencesDot');
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
        toggleButton.innerHTML = '<img src="${ASSETS_BASE}stop-btn.svg" alt="Stop" />';
        toggleButton.setAttribute('title', 'Сбросить');
      } else {
        // Show mic icon
        toggleButton.innerHTML = '<img src="${ASSETS_BASE}mic-btn.svg" alt="Microphone" />';
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
      toggleButton.innerHTML = '<img src="${ASSETS_BASE}return-btn.svg" alt="Return" />';
      toggleButton.setAttribute('title', 'Return to Dialog');
    } else {
      // Show question icon when in dialog mode
      toggleButton.innerHTML = '<img src="${ASSETS_BASE}details-btn.svg" alt="Details" />';
      toggleButton.setAttribute('title', 'Details');
    }
  }

  // Show property card in chat
  showPropertyCard(property) {
    const thread = this.shadowRoot.getElementById('thread');
    if (!thread) return;

    const cardHtml = this.renderPropertyCard(property);
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
      <div class="bubble">
        ${cardHtml}
      </div>
    `;
    
    thread.appendChild(messageDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  // ---------- УТИЛИТЫ ----------
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
  setApiUrl(url) { this.apiUrl = url; if (this.api) this.api.apiUrl = url; }
  getMessages() { return [...this.messages]; }
  getCurrentSessionId() { return this.sessionId; }
  setUnderstanding(insights) { this.understanding.update(insights); }
}

customElements.define('voice-widget', VoiceWidget);
