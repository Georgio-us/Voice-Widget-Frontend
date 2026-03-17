/*! Voice Widget Loader (script + init) */
(function (window, document) {
  if (window.VoiceWidget && window.VoiceWidget.init) return;

  // База URL по loader.js (для поиска voice-widget-v1.js по умолчанию)
  const SCRIPT_BASE = (() => {
    try {
      const src = (document.currentScript && document.currentScript.src) || '';
      if (!src) return '';
      const clean = src.split('?')[0].split('#')[0];
      return clean.slice(0, clean.lastIndexOf('/') + 1);
    } catch { return ''; }
  })();

  const DEFAULTS = {
    apiUrl: undefined,
    zIndex: 9999,
    widgetUrl: undefined,           // явный URL на voice-widget-v1.js (если не указан — берём из SCRIPT_BASE)
    assetsBase: undefined           // опционально: база для ассетов (передадим в window.__VW_ASSETS_BASE__)
  };

  function ensureWidgetLoaded(options) {
    // Уже зарегистрирован
    if (window.customElements && window.customElements.get && window.customElements.get('voice-widget')) {
      return Promise.resolve();
    }
    // Укажем базу ассетов, если задано
    if (options && options.assetsBase) {
      try { window.__VW_ASSETS_BASE__ = options.assetsBase; } catch {}
    }
    // Добавим <script type="module" src=".../voice-widget-v1.js">
    return new Promise((resolve, reject) => {
      try {
        const url = (options && options.widgetUrl) || (SCRIPT_BASE ? (SCRIPT_BASE + 'voice-widget-v1.js') : '');
        if (!url) return reject(new Error('widgetUrl is not defined and SCRIPT_BASE is empty'));
        // Если уже добавлен такой скрипт — не дублируем
        const exists = Array.from(document.querySelectorAll('script[type="module"]'))
          .some(s => (s.src || '').split('?')[0].endsWith('/voice-widget-v1.js'));
        if (!exists) {
          const s = document.createElement('script');
          s.type = 'module';
          s.src = url;
          s.onerror = (e) => reject(new Error('Failed to load voice-widget-v1.js'));
          document.head.appendChild(s);
        }
        // Ждём регистрации кастом-элемента
        if (window.customElements && window.customElements.whenDefined) {
          window.customElements.whenDefined('voice-widget').then(resolve).catch(reject);
        } else {
          // Фоллбек — небольшая задержка
          const check = () => {
            if (window.customElements && window.customElements.get && window.customElements.get('voice-widget')) resolve();
            else setTimeout(check, 50);
          };
          check();
        }
      } catch (e) { reject(e); }
    });
  }

  function createHostIfNeeded(options) {
    let host = document.getElementById('root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'root';
      document.body.appendChild(host);
    }
    positionHost(host, options);
    return host;
  }

  function positionHost(host, options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.width = '100vw';
    host.style.height = '100vh';
    host.style.margin = '0';
    host.style.padding = '0';
    host.style.overflow = 'hidden';
    host.style.pointerEvents = 'auto';
    host.style.zIndex = String(cfg.zIndex || DEFAULTS.zIndex);
  }

  // стабилизируем позицию при изменении визуального вьюпорта (iOS клавиатура/toolbar)
  function bindViewportStabilizer(host, options) {
    try {
      if (!window.visualViewport) return;
      const handler = () => positionHost(host, options);
      window.visualViewport.addEventListener('resize', handler);
      window.visualViewport.addEventListener('scroll', handler);
      // сохраним для потенциального удаления (не обязательно)
      host.__vw_vv_handler__ = handler;
    } catch {}
  }

  function ensureElement(host, options) {
    let el = host.querySelector('voice-widget');
    if (!el) {
      el = document.createElement('voice-widget');
      host.appendChild(el);
    }
    // передать API URL, если нужно
    if (options && options.apiUrl && typeof el.setApiUrl === 'function') {
      try { el.setApiUrl(options.apiUrl); } catch {}
    } else if (options && options.apiUrl) {
      // как fallback — через атрибут (если компонент научится его читать)
      el.setAttribute('data-api-url', options.apiUrl);
    }
    try { el.classList.add('open'); } catch {}
    return el;
  }

  window.VoiceWidget = {
    init(opts) {
      const options = Object.assign({}, DEFAULTS, opts || {});
      return ensureWidgetLoaded(options).then(() => {
        const host = createHostIfNeeded(options);
        positionHost(host, options);
        bindViewportStabilizer(host, options);
        const el = ensureElement(host, options);
        return { host, el };
      });
    },
    // на случай, если тег уже вёрстан на странице (необязательное)
    upgrade(opts) {
      const options = Object.assign({}, DEFAULTS, opts || {});
      return ensureWidgetLoaded(options).then(() => {
        const host = createHostIfNeeded(options);
        positionHost(host, options);
        bindViewportStabilizer(host, options);
        // переместим существующий тег внутрь host
        let el = document.querySelector('voice-widget');
        if (el && el.parentElement !== host) host.appendChild(el);
        if (!el) el = ensureElement(host, options);
        return { host, el };
      });
    }
  };
})(window, document);

