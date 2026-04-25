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

const DEFAULT_THEME = (() => {
  try {
    const raw = typeof window !== 'undefined' ? window.__VW_DEFAULT_THEME__ : null;
    if (raw === 0 || raw === '0' || raw === 'light') return 'light';
    if (raw === 1 || raw === '1' || raw === 'dark') return 'dark';
    return null;
  } catch (e) {
    return null;
  }
})();

import { AudioRecorder } from './modules/audio-recorder.js';
import { UnderstandingManager } from './modules/understanding-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { APIClient } from './modules/api-client.js';
import { EventManager } from './modules/event-manager.js';
import { DebugMenuManager } from './modules/debug-menu.js';
import { initTelemetry, setConsent as setTelemetryConsent, log as logTelemetry, EventTypes as TelemetryEventTypes } from './modules/telemetryClient.js';

const LOCALES = {
  RU: {
    inputPlaceholder: 'Задайте вопрос...',
    launcherTitle: 'Спросите меня прямо здесь',
    launcherSubtitle: 'Можно написать или продиктовать',
    chatGreeting: 'Спроси меня!',
    chatSubGreeting: 'Помогу найти лучший вариант',
    recordingLabel: 'Идет запись',
    loadingText: 'Обрабатываю запрос',
    menuRequest: 'Оставить заявку',
    menuLanguage: 'Выбрать язык',
    menuInsights: 'Дополнительно',
    menuBackToDialog: 'Назад к диалогу',
    menuSelectedRequest: 'Оставить заявку',
    menuSelectedContext: 'Дополнительно',
    menuSelectedDebug: 'Debug меню',
    menuThemeToLight: 'Светлая тема',
    menuThemeToDark: 'Тёмная тема',
    debugTitle: 'Debug меню',
    debugRefresh: 'Обновить',
    debugCopy: 'Скопировать отчёт',
    debugCopied: 'Отчёт скопирован',
    debugSectionInsights: '1) AI understanding',
    debugSectionCanonical: '2) Canonical patch',
    debugSectionQuery: '3) Effective query',
    debugSectionCandidates: '4) Candidate pool summary',
    debugSectionMatch: '5) Candidate match breakdown',
    debugSectionMeta: '6) Last model/API metadata',
    debugSectionDialog: '7) Last dialog turn',
    debugSectionRaw: '8) Raw JSON',
    requestTitle: 'Оставить заявку',
    requestNameLabel: 'Имя',
    requestContactLabel: 'Контакт (телефон / WhatsApp / e-mail)',
    requestPreferredMethodLabel: 'Предпочитаемый способ связи',
    requestCommentLabel: 'Комментарий (необязательно)',
    requestNamePlaceholder: 'Ваше имя',
    requestPhonePlaceholder: '1234567',
    requestEmailPlaceholder: 'yourmail@gmail.com',
    requestCommentPlaceholder: 'Короткая заметка',
    requestContactError: 'Укажите телефон или email',
    requestConsentError: 'Примите Политику конфиденциальности',
    consentText: 'Я согласен(а) на обработку моих данных для обработки этого запроса и связи со мной по недвижимости.',
    privacyPolicy: 'Политика конфиденциальности',
    send: 'Отправить',
    cancel: 'Отмена',
    close: 'Закрыть',
    continue: 'Продолжить',
    understood: 'Понятно',
    thanksTitle: 'Спасибо!',
    thanksBody: 'Ваша заявка получена. Мы скоро с вами свяжемся.',
    statusFulfilled: 'Статус: заполнено',
    ctxDataStorage: 'Хранение и шифрование данных',
    ctxStageMessage: 'Отлично! Вы заполнили систему данными, и теперь подбор будет точнее.',
    ctxHint: 'Вы можете оставить заявку, чтобы менеджер сразу начал работу по вашему кейсу',
    leaveRequest: 'Оставить заявку',
    namePlaceholder: 'Имя',
    phonePlaceholder: 'Телефон',
    emailPlaceholder: 'E-mail',
    contactError: 'Укажите телефон или email',
    consentError: 'Примите Политику конфиденциальности',
    privacyLeavingTitle: 'Переход на другой сайт',
    privacyLeavingBody: 'Вы покидаете этот сайт и открываете Политику конфиденциальности в новой вкладке. Продолжить?',
    spamRepeatTitle: 'Повторная отправка',
    spamRepeatBody: 'Вы уже отправили заявку, желаете сделать это повторно?',
    spamBlockBody: 'Вы уже отправили заявку, и сможете отправить ее повторно через <span class="timer"></span> секунд.',
    whatDataTitle: 'Какие данные мы знаем?',
    dataStorageTitle: 'Хранение и шифрование данных',
    dataStorageBody: 'Мы храним данные на защищенных серверах в ЕС. Передача защищена современными TLS и HSTS; данные в хранилище зашифрованы (AES-256). Доступ строго ограничен и аудитируется. Мы не продаем ваши персональные данные. Вы можете запросить удаление в любой момент через поддержку.',
    footerWhatData: 'Какие данные мы знаем?',
    footerViral: 'Разработано VIA AI, хочу такой же виджет',
    methodWhatsApp: 'WhatsApp',
    methodTelegram: 'Telegram',
    methodPhoneCall: 'Звонок',
    methodEmail: 'Email',
    cardShow: 'Показать',
    cardCancel: 'Отменить',
    cardSelect: 'Выбрать',
    cardNext: 'Ещё одну',
    cardBack: 'Назад',
    cardDescription: 'Описание',
    cardDescriptionOk: 'OK',
    handoffMessage: 'Вы выбрали объект. Дальше можно уточнить детали или отменить.',
    handoffDetails: 'Подробнее',
    inDialogLeadTitle: 'Оставьте контакты',
    inDialogLeadNameLabel: 'Имя',
    inDialogLeadPhoneLabel: 'Телефон',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: 'Обязателен телефон или email',
    inDialogLeadConsentError: 'Примите Политику конфиденциальности',
    invalidPhone: 'Некорректный номер телефона. Используйте 9-10 цифр после кода страны.',
    invalidEmail: 'Некорректный email. Пример: name@domain.com',
    submitFailed: 'Не удалось отправить заявку. Попробуйте снова позже.',
    networkError: 'Ошибка сети. Проверьте подключение и попробуйте снова.',
    parseError: 'Не удалось разобрать ответ сервера',
    responseMissing: 'Ответ от сервера не получен.',
    sendTextError: 'Произошла ошибка при отправке сообщения. Попробуйте снова.',
    shortRecording: 'Запись слишком короткая',
    voiceMessageLabel: 'Голосовое сообщение ({seconds}с)',
    processingCardsError: 'Ошибка при обработке команды карточек',
    noSavedSession: 'Нет сохраненной сессии для восстановления',
    snapshotCorrupted: 'Снимок состояния поврежден',
    restoreError: 'Ошибка восстановления',
    sessionReset: 'Сессия сброшена'
    ,micErrorDuringRecord: 'Произошла ошибка во время записи'
    ,recordingCancelled: 'Запись отменена'
    ,micAccessDenied: 'Доступ к микрофону запрещен'
    ,micNotFound: 'Микрофон не найден'
    ,micBusy: 'Микрофон уже используется'
    ,micUnsupported: 'Настройки микрофона не поддерживаются'
    ,micAccessError: 'Ошибка доступа к микрофону'
    ,speakTitle: 'Говорить'
    ,sendTitle: 'Отправить'
    ,closeWidgetTitle: 'Закрыть виджет'
    ,statsTitle: 'Статистика'
    ,cookieTitle: 'Cookies и телеметрия'
    ,cookieBody: 'Мы используем cookies и собираем данные использования, чтобы улучшать продукт. Никакой сторонней рекламы и ретаргетинга. Настройки можно изменить в любое время.'
    ,cookieStrict: 'Строго необходимые (всегда включены)'
    ,cookiePerf: 'Производительность (тайминги, ошибки)'
    ,cookieAnalytics: 'Аналитика (анонимное использование)'
    ,cookieMarketing: 'Маркетинг (выключено — не используется)'
    ,cookieAcceptAll: 'Принять все'
    ,cookieRejectAll: 'Отклонить все'
    ,cookieManage: 'Настроить'
    ,cookieSave: 'Сохранить'
    ,insightDefault: 'не указано'
    ,stageWaiting: 'Ожидание'
    ,stageIntro: 'Знакомство'
    ,stageCore: 'Основные параметры'
    ,stagePrimarySelection: 'Готов к первичному подбору'
    ,stageDetails: 'Уточнение деталей'
    ,stagePreciseSelection: 'Готов к точному подбору'
    ,assistantGreeting: 'Здравствуйте! Я ваш помощник по подбору недвижимости в Estyle Properties.\n\nЯ помогу вам найти лучший вариант на нашем сайте. Опишите, пожалуйста, что бы вы хотели?'
  },
  EN: {
    inputPlaceholder: 'Ask a question...',
    launcherTitle: 'Ask me right here',
    launcherSubtitle: 'You can type or dictate',
    chatGreeting: 'Ask me!',
    chatSubGreeting: 'I can help you find the best option',
    recordingLabel: 'Recording',
    loadingText: 'Processing request',
    menuRequest: 'Contact me',
    menuLanguage: 'Language',
    menuInsights: 'Insights',
    menuBackToDialog: 'Back to dialogue',
    menuSelectedRequest: 'Leave request',
    menuSelectedContext: 'Insights',
    menuSelectedDebug: 'Debug menu',
    menuThemeToLight: 'Light mode',
    menuThemeToDark: 'Dark mode',
    debugTitle: 'Debug menu',
    debugRefresh: 'Refresh',
    debugCopy: 'Copy report',
    debugCopied: 'Report copied',
    debugSectionInsights: '1) AI understanding',
    debugSectionCanonical: '2) Canonical patch',
    debugSectionQuery: '3) Effective query',
    debugSectionCandidates: '4) Candidate pool summary',
    debugSectionMatch: '5) Candidate match breakdown',
    debugSectionMeta: '6) Last model/API metadata',
    debugSectionDialog: '7) Last dialog turn',
    debugSectionRaw: '8) Raw JSON',
    requestTitle: 'Leave a request',
    requestNameLabel: 'Name',
    requestContactLabel: 'Contact (phone / WhatsApp / e-mail)',
    requestPreferredMethodLabel: 'Preferred contact method',
    requestCommentLabel: 'Comment (optional)',
    requestNamePlaceholder: 'Your name',
    requestPhonePlaceholder: '1234567',
    requestEmailPlaceholder: 'yourmail@gmail.com',
    requestCommentPlaceholder: 'Short note',
    requestContactError: 'Please provide phone or email',
    requestConsentError: 'Please accept the Privacy Policy',
    consentText: 'I consent to the processing of my data for managing this request and contacting me about properties.',
    privacyPolicy: 'Privacy Policy',
    send: 'Send',
    cancel: 'Cancel',
    close: 'Close',
    continue: 'Continue',
    understood: 'Understood',
    thanksTitle: 'Thank you!',
    thanksBody: "Your request has been received. We'll contact you soon.",
    statusFulfilled: 'Status: fulfilled',
    ctxDataStorage: 'Data storage & encrypting',
    ctxStageMessage: "Well done! You've fulfilled the system with the data that will make search much closer to your goal!",
    ctxHint: 'You can leave the request to make manager start working by your case immediately',
    leaveRequest: 'Leave request',
    namePlaceholder: 'Name',
    phonePlaceholder: 'Phone',
    emailPlaceholder: 'E-mail',
    contactError: 'Please provide phone or email',
    consentError: 'Please accept the Privacy Policy',
    privacyLeavingTitle: 'Leaving this site',
    privacyLeavingBody: "You're about to leave this site and open our Privacy Policy in a new tab. Do you want to continue?",
    spamRepeatTitle: 'Repeated submission',
    spamRepeatBody: 'You already sent a request. Do you want to submit it again?',
    spamBlockBody: 'You already sent a request and can submit again in <span class="timer"></span> seconds.',
    whatDataTitle: 'What data do we know?',
    dataStorageTitle: 'Data storage & encrypting',
    dataStorageBody: 'We store your data on secure EU-based servers. Data in transit is protected with modern TLS and HSTS; data at rest is encrypted (AES-256). Access is strictly limited and audited. We never sell your personal information. You can request deletion at any time via Support.',
    footerWhatData: 'What data do we know?',
    footerViral: 'Powered by VIA AI, I want the same widget',
    methodWhatsApp: 'WhatsApp',
    methodTelegram: 'Telegram',
    methodPhoneCall: 'Phone Call',
    methodEmail: 'Email',
    cardShow: 'Show',
    cardCancel: 'Cancel',
    cardSelect: 'Select',
    cardNext: 'Another one',
    cardBack: 'Back',
    cardDescription: 'Description',
    cardDescriptionOk: 'OK',
    handoffMessage: 'You selected a property. You can ask for details or cancel.',
    handoffDetails: 'More details',
    inDialogLeadTitle: 'Leave your contact details',
    inDialogLeadNameLabel: 'Name',
    inDialogLeadPhoneLabel: 'Phone',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: 'Required: phone or email',
    inDialogLeadConsentError: 'Please accept the Privacy Policy',
    invalidPhone: 'Invalid phone number. Use 9-10 digits after country code.',
    invalidEmail: 'Invalid email address. Example: name@domain.com',
    submitFailed: 'Failed to submit request. Please try again later.',
    networkError: 'Network error. Please check your connection and try again.',
    parseError: 'Failed to parse server response',
    responseMissing: 'No response was received from the server.',
    sendTextError: 'An error occurred while sending the message. Please try again.',
    shortRecording: 'Recording is too short',
    voiceMessageLabel: 'Voice message ({seconds}s)',
    processingCardsError: 'Error while processing card command',
    noSavedSession: 'No saved session to restore',
    snapshotCorrupted: 'Snapshot is corrupted',
    restoreError: 'Restore failed',
    sessionReset: 'Session has been reset'
    ,micErrorDuringRecord: 'An error occurred while recording'
    ,recordingCancelled: 'Recording canceled'
    ,micAccessDenied: 'Microphone access denied'
    ,micNotFound: 'Microphone not found'
    ,micBusy: 'Microphone is already in use'
    ,micUnsupported: 'Microphone settings are not supported'
    ,micAccessError: 'Microphone access error'
    ,speakTitle: 'Speak'
    ,sendTitle: 'Send'
    ,closeWidgetTitle: 'Close widget'
    ,statsTitle: 'Statistics'
    ,cookieTitle: 'Cookies & telemetry'
    ,cookieBody: 'We use cookies and collect usage data to improve the product. No third-party ads or retargeting. You can change settings anytime.'
    ,cookieStrict: 'Strictly necessary (always enabled)'
    ,cookiePerf: 'Performance (timings, errors)'
    ,cookieAnalytics: 'Analytics (anonymous usage)'
    ,cookieMarketing: 'Marketing (off - not used)'
    ,cookieAcceptAll: 'Accept all'
    ,cookieRejectAll: 'Reject all'
    ,cookieManage: 'Manage'
    ,cookieSave: 'Save'
    ,insightDefault: 'not specified'
    ,stageWaiting: 'Waiting'
    ,stageIntro: 'Discovery'
    ,stageCore: 'Core parameters'
    ,stagePrimarySelection: 'Ready for initial selection'
    ,stageDetails: 'Refining details'
    ,stagePreciseSelection: 'Ready for precise selection'
    ,assistantGreeting: "Hello! I'm your real estate assistant at Estyle Properties.\n\nI'll help you find the best option on our site. Please describe what you're looking for?"
  },
  ES: {
    inputPlaceholder: 'Haz una pregunta...',
    launcherTitle: 'Preguntame aqui mismo',
    launcherSubtitle: 'Puedes escribir o dictar',
    chatGreeting: 'Preguntame!',
    chatSubGreeting: 'Te ayudo a encontrar la mejor opcion',
    recordingLabel: 'Grabando',
    loadingText: 'Procesando solicitud',
    menuRequest: 'Contactame',
    menuLanguage: 'Idioma',
    menuInsights: 'Insights',
    menuBackToDialog: 'Volver al dialogo',
    menuSelectedRequest: 'Dejar solicitud',
    menuSelectedContext: 'Insights',
    menuSelectedDebug: 'Debug menu',
    menuThemeToLight: 'Modo claro',
    menuThemeToDark: 'Modo oscuro',
    debugTitle: 'Debug menu',
    debugRefresh: 'Actualizar',
    debugCopy: 'Copiar informe',
    debugCopied: 'Informe copiado',
    debugSectionInsights: '1) AI understanding',
    debugSectionCanonical: '2) Canonical patch',
    debugSectionQuery: '3) Effective query',
    debugSectionCandidates: '4) Candidate pool summary',
    debugSectionMatch: '5) Candidate match breakdown',
    debugSectionMeta: '6) Last model/API metadata',
    debugSectionDialog: '7) Last dialog turn',
    debugSectionRaw: '8) Raw JSON',
    requestTitle: 'Dejar una solicitud',
    requestNameLabel: 'Nombre',
    requestContactLabel: 'Contacto (telefono / WhatsApp / e-mail)',
    requestPreferredMethodLabel: 'Metodo de contacto preferido',
    requestCommentLabel: 'Comentario (opcional)',
    requestNamePlaceholder: 'Tu nombre',
    requestPhonePlaceholder: '1234567',
    requestEmailPlaceholder: 'correo@gmail.com',
    requestCommentPlaceholder: 'Nota breve',
    requestContactError: 'Indica telefono o email',
    requestConsentError: 'Acepta la Politica de Privacidad',
    consentText: 'Acepto el tratamiento de mis datos para gestionar esta solicitud y contactarme sobre propiedades.',
    privacyPolicy: 'Politica de Privacidad',
    send: 'Enviar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    continue: 'Continuar',
    understood: 'Entendido',
    thanksTitle: 'Gracias!',
    thanksBody: 'Hemos recibido tu solicitud. Te contactaremos pronto.',
    statusFulfilled: 'Estado: completado',
    ctxDataStorage: 'Almacenamiento y cifrado de datos',
    ctxStageMessage: 'Muy bien! Has completado el sistema con datos que haran la busqueda mas precisa.',
    ctxHint: 'Puedes dejar una solicitud para que el gestor empiece a trabajar de inmediato',
    leaveRequest: 'Dejar solicitud',
    namePlaceholder: 'Nombre',
    phonePlaceholder: 'Telefono',
    emailPlaceholder: 'E-mail',
    contactError: 'Indica telefono o email',
    consentError: 'Acepta la Politica de Privacidad',
    privacyLeavingTitle: 'Saliendo de este sitio',
    privacyLeavingBody: 'Estas a punto de salir de este sitio y abrir nuestra Politica de Privacidad en una nueva pestana. Quieres continuar?',
    spamRepeatTitle: 'Envio repetido',
    spamRepeatBody: 'Ya enviaste una solicitud. Quieres enviarla de nuevo?',
    spamBlockBody: 'Ya enviaste una solicitud y podras enviarla de nuevo en <span class="timer"></span> segundos.',
    whatDataTitle: 'Que datos conocemos?',
    dataStorageTitle: 'Almacenamiento y cifrado de datos',
    dataStorageBody: 'Guardamos tus datos en servidores seguros de la UE. Los datos en transito estan protegidos con TLS y HSTS modernos; los datos en reposo estan cifrados (AES-256). El acceso es estrictamente limitado y auditado. Nunca vendemos tu informacion personal. Puedes solicitar la eliminacion en cualquier momento a traves de Soporte.',
    footerWhatData: 'Que datos conocemos?',
    footerViral: 'Desarrollado por VIA AI, quiero el mismo widget',
    methodWhatsApp: 'WhatsApp',
    methodTelegram: 'Telegram',
    methodPhoneCall: 'Llamada',
    methodEmail: 'Email',
    cardShow: 'Mostrar',
    cardCancel: 'Cancelar',
    cardSelect: 'Seleccionar',
    cardNext: 'Otra más',
    cardBack: 'Atras',
    cardDescription: 'Descripcion',
    cardDescriptionOk: 'OK',
    handoffMessage: 'Has elegido una propiedad. Puedes pedir mas detalles o cancelar.',
    handoffDetails: 'Mas detalles',
    inDialogLeadTitle: 'Deja tus datos de contacto',
    inDialogLeadNameLabel: 'Nombre',
    inDialogLeadPhoneLabel: 'Telefono',
    inDialogLeadEmailLabel: 'Email',
    inDialogLeadContactError: 'Obligatorio: telefono o email',
    inDialogLeadConsentError: 'Acepta la Politica de Privacidad',
    invalidPhone: 'Numero de telefono invalido. Usa 9-10 digitos despues del codigo de pais.',
    invalidEmail: 'Email invalido. Ejemplo: name@domain.com',
    submitFailed: 'No se pudo enviar la solicitud. Intentalo mas tarde.',
    networkError: 'Error de red. Revisa tu conexion e intentalo de nuevo.',
    parseError: 'No se pudo procesar la respuesta del servidor',
    responseMissing: 'No se recibio respuesta del servidor.',
    sendTextError: 'Ocurrio un error al enviar el mensaje. Intentalo de nuevo.',
    shortRecording: 'La grabacion es demasiado corta',
    voiceMessageLabel: 'Mensaje de voz ({seconds}s)',
    processingCardsError: 'Error al procesar el comando de tarjetas',
    noSavedSession: 'No hay una sesion guardada para restaurar',
    snapshotCorrupted: 'La instantanea esta danada',
    restoreError: 'Error al restaurar',
    sessionReset: 'La sesion fue reiniciada'
    ,micErrorDuringRecord: 'Se produjo un error durante la grabacion'
    ,recordingCancelled: 'Grabacion cancelada'
    ,micAccessDenied: 'Acceso al microfono denegado'
    ,micNotFound: 'Microfono no encontrado'
    ,micBusy: 'El microfono ya esta en uso'
    ,micUnsupported: 'La configuracion del microfono no es compatible'
    ,micAccessError: 'Error de acceso al microfono'
    ,speakTitle: 'Hablar'
    ,sendTitle: 'Enviar'
    ,closeWidgetTitle: 'Cerrar widget'
    ,statsTitle: 'Estadisticas'
    ,cookieTitle: 'Cookies y telemetria'
    ,cookieBody: 'Usamos cookies y recopilamos datos de uso para mejorar el producto. Sin anuncios de terceros ni retargeting. Puedes cambiar la configuracion en cualquier momento.'
    ,cookieStrict: 'Estrictamente necesarias (siempre activadas)'
    ,cookiePerf: 'Rendimiento (tiempos, errores)'
    ,cookieAnalytics: 'Analitica (uso anonimo)'
    ,cookieMarketing: 'Marketing (desactivado - no se usa)'
    ,cookieAcceptAll: 'Aceptar todo'
    ,cookieRejectAll: 'Rechazar todo'
    ,cookieManage: 'Configurar'
    ,cookieSave: 'Guardar'
    ,insightDefault: 'no especificado'
    ,stageWaiting: 'Esperando'
    ,stageIntro: 'Descubrimiento'
    ,stageCore: 'Parametros principales'
    ,stagePrimarySelection: 'Listo para una primera seleccion'
    ,stageDetails: 'Afinando detalles'
    ,stagePreciseSelection: 'Listo para una seleccion precisa'
    ,assistantGreeting: 'Hola! Soy tu asistente de inmobiliaria en Estyle Properties.\n\nTe ayudo a encontrar la mejor opcion en nuestra web. Cuentame, por favor, que buscas?'
  }
};

class VoiceWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._theme = null;
    this._pendingThemeAttr = null;

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
    
    // 🆕 Sprint I: server-side role (read-only, обновляется из server responses)
    this.role = null;
    this.supportedLanguages = ['RU', 'EN', 'ES'];
    this.defaultLanguage = 'EN';
    this.currentLang = this.defaultLanguage;

    // параметры
    const attrApi = this.getAttribute('api-url') || '';
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
      return fallback || '';
    };
    this.apiUrl = resolveApiUrl(attrApi);
    if (!this.apiUrl) {
      console.warn('⚠️ API URL is empty. Set <voice-widget api-url=\"...\"> or window.__VW_API_URL__.');
    }
    this.fieldName = this.getAttribute('field-name') || 'audio';
    this.responseField = this.getAttribute('response-field') || 'response';

    // модули
    this.events = new EventManager();
    this.audioRecorder = new AudioRecorder(this);
    this.understanding = new UnderstandingManager(this);
    this.ui = new UIManager(this);
    this.api = new APIClient(this);
    this.debugMenu = new DebugMenuManager(this);

    // Инициализация телеметрии
    const baseUrl = this.apiUrl.replace(/\/api\/audio\/upload\/?$/i, '');
    const sessionId = this.getInitialSessionId();
    initTelemetry({ baseUrl, sessionId });
    
    // Устанавливаем consent из localStorage при инициализации
    const consent = this.getConsent();
    if (consent && consent.selections) {
      setTelemetryConsent({ analytics: consent.selections.analytics === true });
    }

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

  getInitialLanguage() {
    const normalize = (value) => {
      if (typeof value !== 'string') return null;
      const code = value.trim().slice(0, 2).toUpperCase();
      return this.supportedLanguages.includes(code) ? code : null;
    };

    try {
      const fromStorage = normalize(localStorage.getItem('vw_lang'));
      if (fromStorage) return fromStorage;
    } catch {}

    const fromDocument = normalize(document?.documentElement?.lang || '');
    if (fromDocument) return fromDocument;

    const fromNavigator = normalize(navigator?.language || '');
    if (fromNavigator) return fromNavigator;

    return this.defaultLanguage;
  }

  setLanguage(lang) {
    const normalized = typeof lang === 'string' ? lang.trim().slice(0, 2).toUpperCase() : '';
    const nextLang = this.supportedLanguages.includes(normalized) ? normalized : this.defaultLanguage;
    this.currentLang = nextLang;
    this._menuLanguageCode = nextLang;
    try {
      localStorage.setItem('vw_lang', nextLang);
    } catch {}
    console.log(`[VoiceWidget] Language changed to: ${nextLang}`);
    this.updateInterface();
  }

  getCurrentLocale() {
    return LOCALES[this.currentLang] || LOCALES[this.defaultLanguage] || LOCALES.EN;
  }

  t(key, params = null) {
    const locale = this.getCurrentLocale();
    let value = locale?.[key] ?? LOCALES[this.defaultLanguage]?.[key] ?? '';
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    return value;
  }

  updateInterface() {
    const root = this.shadowRoot;
    if (!root) return;
    const locale = this.getCurrentLocale();
    const setText = (selector, text) => {
      const el = root.querySelector(selector);
      if (el && typeof text === 'string') el.textContent = text;
    };
    const setTextAll = (selector, text) => {
      root.querySelectorAll(selector).forEach((el) => {
        if (typeof text === 'string') el.textContent = text;
      });
    };
    const setPlaceholder = (id, text) => {
      const el = root.getElementById(id);
      if (el && typeof text === 'string') el.placeholder = text;
    };
    const setTitle = (id, text) => {
      const el = root.getElementById(id);
      if (el && typeof text === 'string') el.setAttribute('title', text);
    };

    setPlaceholder('mainTextInput', locale.inputPlaceholder);
    setPlaceholder('textInput', locale.inputPlaceholder);
    setPlaceholder('ctxName', locale.namePlaceholder);
    setPlaceholder('ctxPhone', locale.phonePlaceholder);
    setPlaceholder('ctxEmail', locale.emailPlaceholder);
    setPlaceholder('reqName', locale.requestNamePlaceholder);
    setPlaceholder('reqPhone', locale.requestPhonePlaceholder);
    setPlaceholder('reqEmail', locale.requestEmailPlaceholder);
    setPlaceholder('reqComment', locale.requestCommentPlaceholder);
    setPlaceholder('inDialogLeadName', locale.namePlaceholder);
    setPlaceholder('inDialogLeadPhone', locale.requestPhonePlaceholder);
    setPlaceholder('inDialogLeadEmail', locale.emailPlaceholder);

    setText('.launcher__title', locale.launcherTitle);
    setText('.launcher__subtitle', locale.launcherSubtitle);
    setText('.main-text', locale.chatGreeting);
    setText('.sub-text', locale.chatSubGreeting);
    setTextAll('.recording-label', locale.recordingLabel);
    setText('.loading-text', locale.loadingText);
    setTitle('mainToggleButton', locale.speakTitle);
    setTitle('toggleButton', locale.speakTitle);
    setTitle('mainSendButton', locale.sendTitle);
    setTitle('sendButton', locale.sendTitle);
    root.querySelectorAll('.header-action.header-right').forEach((el) => el.setAttribute('title', locale.menuRequest));
    root.querySelectorAll('.header-action.header-left').forEach((el) => el.setAttribute('title', locale.menuLanguage));
    root.querySelectorAll('.header-logo').forEach((el) => el.setAttribute('title', locale.menuSelectedDebug || locale.menuInsights));
    const floatingClose = root.getElementById('widgetCloseFloating');
    if (floatingClose) floatingClose.setAttribute('title', locale.closeWidgetTitle);

    setText('#ctxStatusText', locale.statusFulfilled);
    setText('#ctxStageMessage', locale.ctxStageMessage);
    setText('.data-storage-text', locale.ctxDataStorage);
    setText('.hint-text', locale.ctxHint);
    setText('#ctxLeaveReqBtn', locale.leaveRequest);
    setText('#ctxContactError', locale.contactError);
    setText('#ctxConsentError', locale.consentError);
    setText('#ctxSendBtn', locale.send);
    setText('#ctxCancelBtn', locale.cancel);
    setText('#ctxThanksDoneBtn', locale.close);
    setText('#ctxThanksOverlayClose', locale.close);
    setText('#ctxSpamWarningCancelBtn', locale.cancel);
    setText('#ctxSpamWarningContinueBtn', locale.continue);
    setText('#ctxSpamBlockCloseBtn', locale.understood);
    const ctxThemeBtn = root.getElementById('ctxThemeToggleBtn');
    if (ctxThemeBtn) ctxThemeBtn.textContent = this.getTheme() === 'light' ? locale.menuThemeToDark : locale.menuThemeToLight;
    setText('#whatDataUnderstoodBtn', locale.understood);
    setText('#dataUnderstoodBtn', locale.understood);
    setText('#whatDataTrigger', locale.footerWhatData);
    setTextAll('.viral-link-text', locale.footerViral);
    setText('#debugTitle', locale.debugTitle);
    setText('#debugRefreshBtn', locale.debugRefresh);
    setText('#debugCopyBtn', locale.debugCopy);
    setText('#debugSectionInsights', locale.debugSectionInsights);
    setText('#debugSectionCanonical', locale.debugSectionCanonical);
    setText('#debugSectionQuery', locale.debugSectionQuery);
    setText('#debugSectionCandidates', locale.debugSectionCandidates);
    setText('#debugSectionMatch', locale.debugSectionMatch);
    setText('#debugSectionMeta', locale.debugSectionMeta);
    setText('#debugSectionDialog', locale.debugSectionDialog);
    setText('#debugSectionRaw', locale.debugSectionRaw);

    setText('#reqContactError', locale.requestContactError);
    setText('#reqConsentError', locale.requestConsentError);
    setText('.request-send-btn', locale.send);
    setText('.request-cancel-btn', locale.cancel);
    setText('#requestThanksOverlayClose', locale.close);
    setText('#requestSpamWarningCancelBtn', locale.cancel);
    setText('#requestSpamWarningContinueBtn', locale.continue);
    setText('#requestSpamBlockCloseBtn', locale.understood);
    setText('#privacyCancelBtn', locale.cancel);
    setText('#privacyContinueBtn', locale.continue);

    const reqLabels = root.querySelectorAll('#requestScreen .request-field-label');
    if (reqLabels[0]) reqLabels[0].textContent = locale.requestNameLabel;
    if (reqLabels[1]) reqLabels[1].textContent = locale.requestContactLabel;
    if (reqLabels[2]) reqLabels[2].textContent = locale.requestPreferredMethodLabel;
    if (reqLabels[3]) reqLabels[3].textContent = locale.requestCommentLabel;
    setText('#requestScreen .request-title', locale.requestTitle);

    const consentTextNodes = root.querySelectorAll('.ctx-consent-text, .request-consent-text, .in-dialog-lead__consent-text');
    consentTextNodes.forEach((node) => {
      const link = node.querySelector('a');
      if (link) link.textContent = locale.privacyPolicy;
      const textBeforeLink = `${locale.consentText} `;
      if (node.childNodes.length > 0) node.childNodes[0].textContent = textBeforeLink;
    });

    const reqMethodList = root.getElementById('reqMethodList');
    if (reqMethodList) {
      const options = reqMethodList.querySelectorAll('.request-select-item');
      options.forEach((option) => {
        const v = option.getAttribute('data-value');
        if (v === 'WhatsApp') option.textContent = locale.methodWhatsApp;
        if (v === 'Telegram') option.textContent = locale.methodTelegram;
        if (v === 'Phone Call') option.textContent = locale.methodPhoneCall;
        if (v === 'Email') option.textContent = locale.methodEmail;
      });
      const currentValue = root.getElementById('reqMethod')?.value;
      const reqMethodLabel = root.getElementById('reqMethodLabel');
      if (reqMethodLabel) {
        if (currentValue === 'WhatsApp') reqMethodLabel.textContent = locale.methodWhatsApp;
        if (currentValue === 'Telegram') reqMethodLabel.textContent = locale.methodTelegram;
        if (currentValue === 'Phone Call') reqMethodLabel.textContent = locale.methodPhoneCall;
        if (currentValue === 'Email') reqMethodLabel.textContent = locale.methodEmail;
      }
    }

    const ctxPrivacy = root.getElementById('ctxPrivacyOverlay');
    if (ctxPrivacy) {
      const title = ctxPrivacy.querySelector('.data-title');
      const body = ctxPrivacy.querySelector('.data-body');
      if (title) title.textContent = locale.privacyLeavingTitle;
      if (body) body.textContent = locale.privacyLeavingBody;
    }
    const privacy = root.getElementById('privacyOverlay');
    if (privacy) {
      const title = privacy.querySelector('.data-title');
      const body = privacy.querySelector('.data-body');
      if (title) title.textContent = locale.privacyLeavingTitle;
      if (body) body.textContent = locale.privacyLeavingBody;
    }
    const ctxThanks = root.getElementById('ctxThanks');
    if (ctxThanks) {
      const title = ctxThanks.querySelector('.ctx-thanks-title');
      const body = ctxThanks.querySelector('.ctx-thanks-text');
      if (title) title.textContent = locale.thanksTitle;
      if (body) body.textContent = locale.thanksBody;
    }
    const reqThanks = root.getElementById('requestThanksOverlay');
    if (reqThanks) {
      const title = reqThanks.querySelector('.data-title');
      const body = reqThanks.querySelector('.data-body');
      if (title) title.textContent = locale.thanksTitle;
      if (body) body.textContent = locale.thanksBody;
    }
    const ctxThanksOverlay = root.getElementById('ctxThanksOverlay');
    if (ctxThanksOverlay) {
      const title = ctxThanksOverlay.querySelector('.data-title');
      const body = ctxThanksOverlay.querySelector('.data-body');
      if (title) title.textContent = locale.thanksTitle;
      if (body) body.textContent = locale.thanksBody;
    }

    const updateSpamBlockBody = (overlayId, timerId) => {
      const overlay = root.getElementById(overlayId);
      const timer = root.getElementById(timerId);
      if (!overlay) return;
      const title = overlay.querySelector('.data-title');
      const body = overlay.querySelector('.data-body');
      if (title) title.textContent = locale.spamRepeatTitle;
      if (body) {
        const timerValue = timer ? timer.textContent : '60';
        body.innerHTML = locale.spamBlockBody.replace('<span class="timer"></span>', `<span id="${timerId}">${timerValue}</span>`);
      }
    };
    const updateSpamWarnBody = (overlayId) => {
      const overlay = root.getElementById(overlayId);
      if (!overlay) return;
      const title = overlay.querySelector('.data-title');
      const body = overlay.querySelector('.data-body');
      if (title) title.textContent = locale.spamRepeatTitle;
      if (body) body.textContent = locale.spamRepeatBody;
    };
    updateSpamWarnBody('ctxSpamWarningOverlay');
    updateSpamWarnBody('requestSpamWarningOverlay');
    updateSpamBlockBody('ctxSpamBlockOverlay', 'ctxSpamBlockTimer');
    updateSpamBlockBody('requestSpamBlockOverlay', 'requestSpamBlockTimer');

    const whatData = root.getElementById('whatDataOverlay');
    if (whatData) {
      const title = whatData.querySelector('.data-title');
      if (title) title.textContent = locale.whatDataTitle;
    }
    const dataOverlay = root.getElementById('dataOverlay');
    if (dataOverlay) {
      const title = dataOverlay.querySelector('.data-title');
      const body = dataOverlay.querySelector('.data-body');
      if (title) title.textContent = locale.dataStorageTitle;
      if (body) body.textContent = locale.dataStorageBody;
    }
    const cookieOverlay = root.getElementById('cookieOverlay');
    if (cookieOverlay) {
      const title = cookieOverlay.querySelector('.data-title');
      const body = cookieOverlay.querySelector('.data-body');
      const strict = root.querySelector('#ccStrict + span');
      const perf = root.querySelector('#ccPerformance + span');
      const analytics = root.querySelector('#ccAnalytics + span');
      const marketing = root.querySelector('#ccMarketing + span');
      if (title) title.textContent = locale.cookieTitle;
      if (body && body.childNodes.length > 0) body.childNodes[0].textContent = `${locale.cookieBody} `;
      if (strict) strict.textContent = locale.cookieStrict;
      if (perf) perf.textContent = locale.cookiePerf;
      if (analytics) analytics.textContent = locale.cookieAnalytics;
      if (marketing) marketing.textContent = locale.cookieMarketing;
      setText('#cookieAcceptAllBtn', locale.cookieAcceptAll);
      setText('#cookieRejectAllBtn', locale.cookieRejectAll);
      setText('#cookieManageBtn', locale.cookieManage);
      setText('#cookieSaveBtn', locale.cookieSave);
    }

    this.updateMenuUI();
    try { this.refreshDebugMenu?.(); } catch {}
  }

  getConsent() {
    try {
      const raw =
        localStorage.getItem('vw_cookie_consent') ||
        localStorage.getItem('vw_consent') ||
        null;

      if (!raw) return null;

      if (raw === 'accepted') {
        return { selections: { analytics: true } };
      }

      if (raw === 'rejected') {
        return { selections: { analytics: false } };
      }

      return JSON.parse(raw);
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

    // 1) проверяем session на сервере 2) только потом грузим локальную историю (без "мигания")
    if (this.sessionId) {
      this.api.loadSessionInfo()
        .then((state) => {
          if (state?.expired) {
            try { this.ui.clearMessages(); } catch {}
            return;
          }
          try { this.ui.loadHistory(); } catch {}
        })
        .catch(() => {
          try { this.ui.loadHistory(); } catch {}
        });
    } else {
      this.ui.loadHistory();
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

  connectedCallback() {
    this.currentLang = this.getInitialLanguage();
    this._menuLanguageCode = this.currentLang;
    this.updateInterface();
    if (this._pendingThemeAttr) {
      try { this.setAttribute('data-theme', this._pendingThemeAttr); } catch {}
      this._pendingThemeAttr = null;
    }
    this.applyHostModeClasses();
    // Theme application uses this.setAttribute, so it must run after connect.
    if (this._themeInitializedOnce) return;
    this.initTheme();
    this._themeInitializedOnce = true;
  }

  applyHostModeClasses() {
    if (!this.isConnected) return;
    try {
      this.classList.toggle('vw-mobile', !!this._vwIsMobileLike);
      this.classList.toggle('vw-desktop', !this._vwIsMobileLike);
    } catch {}
  }

  initTheme() {
    let theme = DEFAULT_THEME || 'dark';
    try {
      const saved = localStorage.getItem('vw_theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
    } catch {}
    this.applyTheme(theme);
  }

  getTheme() {
    if (this._theme === 'light' || this._theme === 'dark') return this._theme;
    const raw = this.getAttribute('data-theme');
    return raw === 'light' ? 'light' : 'dark';
  }

  getMicIconByTheme() {
    return this.getTheme() === 'light' ? 'mic-btn-light.svg' : 'mic-btn.svg';
  }

  getStopIconByTheme() {
    return this.getTheme() === 'light' ? 'stop-btn-light.svg' : 'stop-btn.svg';
  }

  getSendIconByTheme() {
    return this.getTheme() === 'light' ? 'send-btn-light.svg' : 'send-btn.svg';
  }

  getStatsIconByTheme() {
    return this.getTheme() === 'light' ? 'menu_light_theme.svg' : 'menu_dark_theme.svg';
  }

  getContactIconByTheme() {
    return this.getTheme() === 'light' ? 'Contactme-light.svg' : 'Contactme.svg';
  }

  getLanguageIconByTheme() {
    return this.getTheme() === 'light' ? 'Language-light.svg' : 'Language.svg';
  }

  getInsightsIconByTheme() {
    return this.getTheme() === 'light' ? 'Insights-light.svg' : 'Insights.svg';
  }

  getLogoByTheme() {
    return this.getTheme() === 'light' ? 'LOGO-light.svg' : 'LOGO.svg';
  }

  getReturnIconByTheme() {
    return this.getTheme() === 'light' ? 'return_light_btn.svg' : 'return_btn.svg';
  }

  getInsightsProgressTrackStrokeByTheme() {
    return this.getTheme() === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  }

  updateSendButtonIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getSendIconByTheme()}`;
    const mainSendImg = this.shadowRoot.querySelector('#mainSendButton img');
    const chatSendImg = this.shadowRoot.querySelector('#sendButton img');
    if (mainSendImg) mainSendImg.setAttribute('src', nextSrc);
    if (chatSendImg) chatSendImg.setAttribute('src', nextSrc);
  }

  updateStatsIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getLanguageIconByTheme()}`;
    const statsIcons = this.shadowRoot.querySelectorAll('.header-action.header-left img');
    statsIcons.forEach((img) => img.setAttribute('src', nextSrc));
  }

  updateHeaderRightIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getContactIconByTheme()}`;
    const rightIcons = this.shadowRoot.querySelectorAll('.header-action.header-right img');
    rightIcons.forEach((img) => img.setAttribute('src', nextSrc));
  }

  updateLogoIcons() {
    const nextSrc = `${ASSETS_BASE}${this.getLogoByTheme()}`;
    const logos = this.shadowRoot.querySelectorAll('.header-logo');
    logos.forEach((img) => img.setAttribute('src', nextSrc));
  }

  updateInsightsProgressTrackStroke() {
    const trackCircle = this.shadowRoot.querySelector('#contextScreen .progress-ring svg circle:first-child');
    if (!trackCircle) return;
    trackCircle.setAttribute('stroke', this.getInsightsProgressTrackStrokeByTheme());
  }

  applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    this._theme = next;
    if (this.isConnected) this.setAttribute('data-theme', next);
    else this._pendingThemeAttr = next;
    try { localStorage.setItem('vw_theme', next); } catch {}
    try {
      this.updateToggleButtonState('main');
      this.updateToggleButtonState('chat');
      this.updateSendButtonIcons();
      this.updateStatsIcons();
      this.updateHeaderRightIcons();
      this.updateLogoIcons();
      this.updateInsightsProgressTrackStroke();
    } catch {}
  }

  toggleTheme() {
    const next = this.getTheme() === 'light' ? 'dark' : 'light';
    this.applyTheme(next);
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
    border:none; padding:0; cursor:pointer; z-index:10001; background:transparent; -webkit-appearance:none; appearance:none;
    box-shadow:0 10px 24px rgba(0,0,0,.18); display:flex; align-items:center; justify-content:center;
    transition:transform .15s ease, box-shadow .15s ease; pointer-events:auto; }
  .launcher:hover{ transform:scale(1.05); box-shadow:0 14px 32px rgba(0,0,0,.22); }
  /* Legacy icon kept in markup, not used in current launcher variants */
  .launcher__desktopIcon{ width:100%; height:100%; display:none; object-fit:contain; filter:brightness(0) invert(1); }
  .launcher__textBlock{ display:none; }
  .launcher__iconSlot{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; flex:0 0 auto; padding:0; margin:0; }
  
  /* Flip logos (coin-like): used on both mobile and desktop */
  .launcher__flip{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; perspective: 800px; pointer-events:none; }
  .launcher__flipInner{ width:100%; height:100%; display:block; position:relative; transform-style: preserve-3d; transition: transform 650ms cubic-bezier(.2,.8,.2,1); will-change: transform; }
  .launcher__face{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
  .launcher__face img{ width:100%; height:100%; display:block; object-fit:contain; filter:none !important; }
  .launcher__face svg{ width:100%; height:100%; display:block; }
  .launcher__face--back{ transform: rotateY(180deg); }
  .launcher.vw-launcher-back .launcher__flipInner{ transform: rotateY(180deg); }
  
  /* Desktop variant (wide card) is responsive by viewport width, not device classes */
  @media (min-width: 768px){
    .launcher{
      width: fit-content;
      min-width: 240px;
      max-width: 90vw;
      height:auto;
      min-height: clamp(60px, 6vw, 72px);
      padding:
        clamp(10px, 1.4vw, 14px)
        clamp(10px, 1.4vw, 14px)
        clamp(10px, 1.4vw, 14px)
        clamp(12px, 1.8vw, 18px);
      border-radius:18px;
      position:fixed;
      background:var(--color-bg);
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: clamp(10px, 1.4vw, 14px);
    }
    .launcher::before{
      content:"";
      position:absolute;
      inset:0;
      padding:1px;
      border-radius:inherit;
      pointer-events:none;
      background:linear-gradient(90deg, #5C7FE2 0%, #F05A4F 33%, #EDA136 66%, #1C7755 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }
    /* One-off sheen on hover/focus (diagonal 45deg sweep) */
    .launcher::after{
      content:"";
      position:absolute;
      inset:-40%;
      pointer-events:none;
      opacity:0;
      transform: translateX(-120%) rotate(45deg);
      background: linear-gradient(
        90deg,
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,0.00) 47%,
        rgba(255,255,255,0.14) 50%,
        rgba(255,255,255,0.00) 53%,
        rgba(255,255,255,0) 100%
      );
      will-change: transform, opacity;
    }
    .launcher:hover::after,
    .launcher:focus-visible::after{
      opacity:1;
      animation: vwLauncherSheen 6850ms cubic-bezier(.2,.8,.2,1) 1 forwards;
    }
    .launcher__textBlock{
      display:flex;
      flex-direction:column;
      gap:2px;
      flex: 1 1 auto;
      min-width:0;
      text-align:left;
      font-family: var(--ff);
    }
    .launcher__title{
      font-size: clamp(12px, 1vw + 10px, 14px);
      font-weight:500;
      line-height:18px;
      color:#ffffff;
      white-space:nowrap;
    }
    .launcher__subtitle{
      font-size: clamp(10px, 0.8vw + 8px, 12px);
      font-weight:300;
      line-height:16px;
      color:rgba(255,255,255,.72);
      white-space:nowrap;
    }
    .launcher__iconSlot{
      width:56px;
      height:56px;
      flex:0 0 56px;
    }
  }
  @keyframes vwLauncherSheen{
    0%{ transform: translateX(-120%) rotate(45deg); opacity:0; }
    15%{ opacity:1; }
    100%{ transform: translateX(120%) rotate(45deg); opacity:0; }
  }
  :host(.open) .launcher{ display:none; }

  /* (scroll-bottom-btn и scrim удалены как неиспользуемые) */

  /* Виджет — в закрытом состоянии не участвует в раскладке (host = только лаунчер) */
.widget{
    position:absolute;
    left:0;
    top:0;
    width:0;
    height:0;
    min-width:0;
    min-height:0;
    overflow:hidden;
    border-radius:20px;
    box-shadow:none;
    opacity:0;
    transition:opacity .2s ease;
    pointer-events:none;
}

.widget::before,
.widget::after{
    content:none;
}

:host(.open) .widget{
    position:relative;
    width:auto;
    height:auto;
    min-width:0;
    min-height:0;
    overflow:visible;
    opacity:1;
    pointer-events:auto;
}

.widget-close-floating{
    position:absolute;
    top:-14px;
    right:-6px;
    width:34px;
    height:34px;
    border:none;
    border-radius:999px;
    background:var(--bg-card);
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    z-index:9;
    box-shadow:0 6px 18px rgba(0,0,0,.22);
}
.widget-close-floating img{
    width:22px;
    height:22px;
    display:block;
}
.widget-close-floating:hover{ opacity:.92; }
.widget-close-floating:active{ opacity:.82; }
  /* Content */
  .content{ display:flex; flex-direction:column; height:100%; padding:0; gap:0; position:relative; z-index:3; }

  /* Mobile host centering handled by loader (#vw-host); no widget overrides here */

  /* Main Screen — скрыт навсегда, точка входа теперь dialogScreen */
  .main-screen{ display:none !important; }
  .main-screen.hidden{ display:none; }
  /* v2 screens visibility */
  .dialog-screen.hidden{ display:none; }
  .context-screen.hidden{ display:none; }
  .request-screen.hidden{ display:none; }
  .debug-screen.hidden{ display:none; }

  /* Chat */
  .thread{ display:flex; flex-direction:column; gap:2px; position:relative; z-index:1; min-height:0; }
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
  .card-screen .cs{ background:var(--bg-card); color:var(--color-text); border-radius:14px; margin-bottom:12px; box-shadow:none; overflow:hidden; width:100%; height:100%; display:flex; flex-direction:column; }
  .card-screen .cs-image{ height:260px; flex:0 0 260px; width:100%; display:grid; grid-template-areas:"stack"; align-items:stretch; justify-items:stretch; overflow:hidden; position:relative; background:repeating-linear-gradient(45deg,#e9e9e9,#e9e9e9 12px,#f5f5f5 12px,#f5f5f5 24px); color:#8a8a8a; font-weight:600; letter-spacing:.2px; }
  .card-screen .cs-image > *{ grid-area:stack; }
  .card-screen .cs-image .cs-image-media{ display:flex; align-items:center; justify-content:center; width:100%; height:100%; overflow:hidden; }
  .card-screen .cs-image .cs-image-nav{
    z-index:2;
    width:100%;
    height:100%;
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:0 12px;
    box-sizing:border-box;
    pointer-events:none;
  }
  .card-screen .cs-image .cs-image-nav-btn{
    pointer-events:auto;
    width:40px;
    height:40px;
    border-radius:999px;
    border:none;
    background:rgba(255,255,255,.72);
    color:var(--color-accent);
    font-size:28px;
    line-height:1;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    user-select:none;
  }
  .card-screen .cs-image .cs-image-nav-btn:hover{ background:rgba(255,255,255,.88); }
  .card-screen .cs-image .cs-image-nav-btn.is-hidden{ visibility:hidden; pointer-events:none; }
  /* overlay: слой поверх изображения для плашек */
  .card-screen .cs-image .cs-image-overlay{
    z-index:1;
    position:relative;
    width:100%;
    height:100%;
    display:flex;
    justify-content:flex-start;
    align-items:flex-start;
    padding:5px;
    box-sizing:border-box;
    pointer-events:none;
  }
  .card-screen .cs-image .cs-image-tags{
    display:flex;
    flex-wrap:wrap;
    gap:5px;
    max-width:100%;
    pointer-events:auto;
  }
  .card-screen .cs-image .cs-image-tag{
    border:none;
    background:var(--color-accent);
    color:#fff;
    border-radius:4px;
    padding:5px 10px;
    font-size:11px;
    line-height:1;
    font-weight:600;
    text-transform:uppercase;
    letter-spacing:.02em;
    cursor:default;
  }
  .card-screen .cs-image .card-btn.like[data-action="like"]{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:8px;
    border:none;
    background:transparent;
    border-radius:999px;
    cursor:pointer; 
  }
  .card-screen .cs-image .card-btn.like[data-action="like"]:hover{ background: rgba(255,255,255,0.18); }
  .card-screen .cs-image .card-btn.like[data-action="like"] svg,
  .card-screen .cs-image .card-btn.like[data-action="like"] svg *{ pointer-events:none; }
  .card-screen .cs-image .card-btn.like[data-action="like"] svg{ width:24px; height:24px; display:block; }
  .card-screen .cs-image .card-btn.like[data-action="like"] svg path{ fill: transparent; stroke:#ffffff; stroke-width:2; }
  .card-screen .cs-image .card-btn.like[data-action="like"]:active svg path{ fill:var(--color-accent); stroke:var(--color-accent); }
  .card-screen .cs-image .card-btn.like[data-action="like"].is-liked svg path{ fill:var(--color-accent); stroke:var(--color-accent); }
  .card-screen .cs-image img{ width:100%; height:100%; object-fit:cover; display:block; }
  .card-screen .cs-content{ flex:0 0 180px; min-height:180px; max-height:180px; display:flex; flex-direction:column; background:var(--bg-card); }
  .card-screen .cs-body{ flex:0 0 auto; min-height:0; padding:10px 12px; display:grid; gap:6px; background:var(--bg-card); }
  .card-screen .cs-row{ display:flex; justify-content:space-between; gap:12px; }
  .card-screen .cs-row > *{ min-width:0; }
  .card-screen .cs-title{ font-weight:700; color:var(--color-text); }
  .card-screen .cs-sub{ font-size:12px; color:var(--color-text); opacity:.75; }
  .card-screen .cs-title,.card-screen .cs-sub{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .card-screen .cs-icons-row{
    display:flex;
    flex:1 1 auto;
    align-items:flex-end;
    gap:14px;
    padding:2px 12px 6px;
    min-height:56px;
    background:var(--bg-card);
  }
  .card-screen .cs-icon-item{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:flex-end;
    min-width:32px;
    gap:4px;
    color:var(--color-text);
    font-size:12px;
    line-height:1;
  }
  .card-screen .cs-icon-item img{ width:24px; height:24px; object-fit:contain; display:block; filter: brightness(0) invert(1); }
  .card-screen .cs-icon-check{ font-size:14px; font-weight:700; color:#FFFFFF; line-height:1; }
  .card-screen .cs-price{ font-weight:700; color:var(--color-accent); }
  

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
  .card-title{ font-weight:700; font-size:var(--fs-body); color:var(--color-text); margin-bottom:4px; }
  .card-location{ font-size:var(--fs-small); color:var(--color-text); margin-bottom:8px; }
  .card-price{ font-weight:600; font-size:var(--fs-body); color:var(--color-accent); margin-bottom:16px; }
  .card-actions{ display:flex; gap:12px; }
  .card-actions .card-btn{ flex:1; }
  .card-btn{ height:40px; border:none; border-radius:12px; cursor:pointer; font-weight:600; font-size:var(--fs-btn); transition:transform .12s ease; }
  .card-btn:hover{ transform:translateY(-1px); }
  .card-btn.like{ background:linear-gradient(135deg,#FF8A4C,#FFA66E); color:#fff; }
  .card-btn.next{ background:rgba(255,255,255,.9); color:var(--color-text); border:1px solid rgba(0,0,0,.1); }

  /* Card mock inside assistant message */
  .card-mock{ background:#fff; color:#2b2b2b; border-radius:14px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.12); width:100%; }
  .card-mock .cm-image{ height: 220px; display:flex; align-items:center; justify-content:center; background:repeating-linear-gradient(45deg, #e9e9e9, #e9e9e9 12px, #f5f5f5 12px, #f5f5f5 24px); color:#8a8a8a; font-weight:600; letter-spacing:.2px; }
  .card-mock .cm-body{ padding:5px; display:grid; gap:8px; }
  .card-mock .cm-row{ display:flex; justify-content:space-between; gap:12px; }
  .card-mock .cm-title{ font-weight:700; color:#2b2b2b; }
  .card-mock .cm-sub{ font-size:12px; color:#666; }
  .card-mock .cm-price{ font-weight:700; color:#FF8A4C; }
  .card-actions-panel{ display:flex; gap:16px; align-items:center; }
  .card-actions-panel .card-btn{ flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; font-size:12px; height:36px; padding:0 18px; border-radius:10px; border:1.25px solid var(--color-accent); background:transparent; color:var(--color-accent); font-weight:600; transition:all .2s ease; }
                /* Unify in-process action buttons */
                .card-actions-panel .card-btn{
                  padding: var(--btn-py) var(--btn-px);
                  height: auto;
                  min-width: var(--btn-min-w);
                  border-radius:var(--btn-radius);
                  font: var(--fw-s) var(--fs-btn)/1 var(--ff);
                }
  /* like (filled) */
  .card-actions-panel .card-btn.like{ background:var(--color-accent); color:#fff; border:1.25px solid var(--color-accent); }
  .card-actions-panel .card-btn.like::before{ content:none; }
  .card-actions-panel .card-btn.like{ position:relative; }
  .card-actions-panel .card-btn.like:hover{ transform:translateY(-1px); }
  /* select (filled like primary) */
  .card-actions-panel .card-btn.select{ background:var(--color-accent); color:#fff; border:1.25px solid var(--color-accent); }
  .card-actions-panel .card-btn.select:hover{ transform:translateY(-1px); }
  .card-actions-panel--split{ justify-content:space-between; gap:10px; }
  .card-actions-panel--split .card-btn.select{ flex:0 0 auto; min-width:120px; }
  .card-price-action{
    border:none;
    background:transparent;
    color:var(--color-text);
    padding:0;
    margin:0;
    display:flex;
    flex-direction:column;
    align-items:flex-end;
    justify-content:center;
    gap:2px;
    cursor:pointer;
    font:inherit;
    text-align:right;
  }
  .card-price-action:hover .card-price-current{ opacity:.85; }
  .card-price-action:focus-visible{
    outline:2px solid var(--color-accent);
    outline-offset:4px;
    border-radius:6px;
  }
  .card-price-old{
    font-size:12px;
    line-height:1;
    color:var(--color-text);
    opacity:.55;
    text-decoration:line-through;
  }
  .card-price-current{
    font-size:16px;
    line-height:1.1;
    font-weight:700;
    color:var(--color-text);
    letter-spacing:.01em;
  }
  /* next (outlined) */
  .card-actions-panel .card-btn.next{ background:transparent; color:var(--color-accent); border:1.25px solid var(--color-accent); }
  .card-actions-panel .card-btn.next:hover{ opacity:.9; }

  /* ===== Cards Slider ===== */
  .cards-slider{ width:100%; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; position:relative; }
  .cards-track{ display:flex; gap:12px; width:100%; scroll-snap-type:x mandatory; }
  .card-slide{ flex:0 0 100%; scroll-snap-align:start; transition: transform .3s ease, opacity .3s ease; transform: scale(.985); opacity:.95; display:grid; grid-template-columns:1fr; grid-template-rows:auto; min-height:0; }
  .card-slide.active{ transform: scale(1); opacity:1; }
  /* flip: front and back in same grid cell (no absolute), size = max(front, back) */
  .card-slide-front,.card-slide-back{ grid-area:1/1; min-height:0; height:440px; transition: opacity .25s ease; }
  .card-slide-front{ opacity:1; pointer-events:auto; }

  .card-slide-back{ position:relative; overflow:hidden; opacity:0; pointer-events:none; background:var(--bg-card); border-radius:14px; display:flex; flex-direction:column; padding:20px; box-sizing:border-box; }
  .card-slide-back__bg{ position:absolute; inset:0; z-index:0; pointer-events:none; opacity:.1; background-position:center; background-repeat:no-repeat; background-size:cover; }
  .card-slide-back__bg--fallback{ background-image:repeating-linear-gradient(45deg,#e9e9e9,#e9e9e9 12px,#f5f5f5 12px,#f5f5f5 24px); }
  .card-slide-back > :not(.card-slide-back__bg){ position:relative; z-index:1; }
  .card-slide.flipped .card-slide-front{ opacity:0; pointer-events:none; }
  .card-slide.flipped .card-slide-back{ opacity:1; pointer-events:auto; }
  .card-slide-form{ grid-area:1/1; min-height:0; display:none; }
  .card-slide--form-open .card-slide-back{ display:none !important; }
  .card-slide--form-open .card-slide-form{ display:flex; flex-direction:column; height:440px; overflow:hidden; background:var(--bg-card); border-radius:14px; padding:20px; box-sizing:border-box; }
  .card-form-header{ height:24px; flex-shrink:0; display:flex; align-items:center; padding:0; margin-bottom:8px; width:100%; }
  .card-form-header__back{ width:18px; height:18px; flex-shrink:0; padding:0; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--color-accent); opacity:.9; border-radius:6px; transition: background-color .18s ease, transform .18s ease, opacity .18s ease, box-shadow .18s ease; }
  .card-form-header__back img{ display:block; filter: brightness(0) saturate(100%) invert(45%) sepia(79%) saturate(741%) hue-rotate(193deg) brightness(90%) contrast(88%); }
  .card-form-header__back:hover{ background:rgba(65,120,207,.12); transform:translateY(-1px); opacity:1; }
  .card-form-header__back:active{ transform:translateY(0); opacity:.88; }
  .card-form-header__back:focus-visible{ outline:2px solid var(--color-accent); outline-offset:2px; }
  .card-form-header__title{ flex:1; font-size:14px; font-weight:600; color:var(--color-text); margin:0; text-align:center; min-width:0; }
  .card-form-header__spacer{ width:18px; flex-shrink:0; }
  /* Card back: info panel (specs + actions) */
  .card-back-header{ flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:0; margin-bottom:8px; width:100%; }
  .card-back-header__back-badge,
  .card-back-header__ref-badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border-radius:4px;
    background:var(--color-accent);
    color:#fff;
    font-size:12px;
    line-height:1;
    font-weight:600;
    letter-spacing:.02em;
    padding:6px 10px;
    white-space:nowrap;
    min-height:26px;
    box-sizing:border-box;
  }
  .card-back-header__back-badge{
    border:none;
    cursor:pointer;
  }
  .card-back-header__back-badge:hover{ opacity:.92; }
  .card-back-header__back-badge:active{ opacity:.82; }
  .card-back-header__back-badge:focus-visible{ outline:2px solid var(--color-accent); outline-offset:2px; }
  .card-back-header__ref-badge{
    margin-left:auto;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:70%;
  }
  .card-back-separator{ width:100%; height:2px; border-radius:1px; background:linear-gradient(90deg, rgba(65, 120, 207, 0) 0%, var(--color-accent) 50%, rgba(65, 120, 207, 0) 100%); margin:12px 0; flex-shrink:0; }
  .card-back-specs{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:20px 20px;
    flex:1 1 auto;
    min-height:0;
    margin-top:12px;
    align-content:start;
  }
  .card-back-specs__item{
    display:flex;
    align-items:center;
    gap:8px;
    min-width:0;
  }
  .card-back-specs__icon{
    width:24px;
    height:24px;
    flex:0 0 24px;
    object-fit:contain;
    display:block;
    filter: brightness(0) invert(1);
  }
  .card-back-specs__text{
    min-width:0;
    display:grid;
    gap:1px;
    line-height:1.15;
  }
  .card-back-specs__label{
    font-size:12px;
    opacity:.75;
    text-transform:uppercase;
    letter-spacing:.02em;
  }
  .card-back-specs__value{
    font-size:12px;
    font-weight:600;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .card-back-actions{ margin-top:auto; display:flex; gap:10px; width:100%; }
  .card-slide-back .btn-open-form,
  .card-slide-back .btn-open-description{
    flex:1 1 0;
    min-width:0;
    padding:10px 12px;
    font-size:14px;
    font-weight:600;
    border-radius:10px;
    cursor:pointer;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .card-slide-back .btn-open-form{
    color:#fff;
    background:var(--color-accent);
    border:1px solid var(--color-accent);
  }
  .card-slide-back .btn-open-description{
    color:var(--color-accent);
    background:transparent;
    border:1px solid var(--color-accent);
  }
  .card-desc-modal{
    position:absolute !important;
    inset:0;
    z-index:4;
    display:none;
    align-items:center;
    justify-content:center;
    padding:16px;
    background:rgba(0,0,0,.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    box-sizing:border-box;
  }
  .card-desc-modal.is-open{ display:flex; }
  .card-desc-modal__dialog{
    width:100%;
    max-width:306px;
    max-height:100%;
    display:flex;
    flex-direction:column;
    gap:12px;
    border-radius:16px;
    background:rgba(23,22,24,.95);
    border:1px solid rgba(106,108,155,.30);
    padding:14px;
    box-sizing:border-box;
  }
  .card-desc-modal__text{
    max-height:230px;
    overflow-y:auto;
    font-size:12px;
    line-height:1.45;
    color:#FFFFFF;
    white-space:pre-line;
    text-align:left;
  }
  .card-desc-modal__actions{ display:flex; justify-content:center; }
  .card-desc-modal__ok{
    min-width: var(--btn-min-w);
    padding: var(--btn-py) var(--btn-px);
    border-radius: var(--btn-radius);
    border:1.25px solid var(--color-accent);
    background:var(--color-accent);
    color:#fff;
    font-size:12px;
    font-weight:600;
    cursor:pointer;
  }
  .card-back-placeholder{ background:var(--bg-card); border:2px dashed var(--color-accent); border-radius:14px; padding:24px; color:var(--color-text); font-size:14px; font-weight:600; text-align:center; min-height:100%; box-sizing:border-box; }
  .cards-slider{ scroll-behavior:smooth; scrollbar-width:none; -ms-overflow-style:none; }
  .cards-slider::-webkit-scrollbar{ display:none; width:0; height:0; }
  .cards-slider::-webkit-scrollbar-track{ background:transparent; }
  .cards-slider::-webkit-scrollbar-thumb{ background:transparent; }
  /* slider navigation row (outside slider body) */
  .cards-host-nav{ display:flex; justify-content:center; gap:12px; margin:10px 0 8px; }
  .cards-nav-btn{
    width:40px;
    height:40px;
    border-radius:12px;
    border:1.25px solid var(--color-accent);
    background:transparent;
    color:var(--color-accent);
    font-size:20px;
    line-height:1;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    transition:all .18s ease;
  }
  .cards-nav-btn:hover:not(:disabled){ background:rgba(65,120,207,.12); transform:translateY(-1px); }
  .cards-nav-btn:disabled{
    opacity:.35;
    cursor:not-allowed;
    transform:none;
  }
  /* actions container for clearer boundaries */
  .card-actions-wrap{ margin:0 8px 8px; padding:8px; border:1px solid rgba(71, 105, 165, 0); border-radius:12px; background:var(--bg-card); }
  .card-slide .cs{ width:100%; }

  /* ===== RMv3 / Sprint 2 / Task 2.2: Post-handoff block (UI-only) ===== */
  /* Reuse existing button base (.card-btn + .select/.next) via composition; do not touch other chat buttons */
  .handoff-actions{ margin-top:8px; }
  .handoff-btn{ }
  .handoff-block{ }
  /* RMv3 / Sprint 2 / Task 2.4: hide handoff actions when in-dialog lead block is open */
  .handoff-actions.handoff-actions--hidden{ display:none; }

  /* ===== RMv3: In-dialog lead block (UI-only, demo trigger: “Подробнее”) ===== */
  /* ВАЖНО:
     - новая сущность (не requestScreen/contextScreen)
     - новые классы/ID (префикс inDialogLead*)
     - scoped под .dialog-screen чтобы не затронуть другие экраны
     - без ghost-email / подсказок / валидации / ошибок */
  .dialog-screen .in-dialog-lead-block{ width:100%; margin:0; padding:0; }
  .dialog-screen .in-dialog-lead,
  .card-slide-back .in-dialog-lead{
    background:var(--bg-card);
    color:var(--color-text);
    border-radius:14px;
    box-shadow:none;
    overflow:hidden;
    width:100%;
  }
  .dialog-screen .in-dialog-lead{ margin-bottom: 10px; }
  .card-slide-back .in-dialog-lead{ margin-bottom: 10px; }
  .dialog-screen .in-dialog-lead__body,
  .card-slide-back .in-dialog-lead__body{ padding:12px; display:grid; gap:12px; }
  .card-slide-form .in-dialog-lead__body{ padding:2px; display:grid; gap:12px; max-height:100%; overflow-y:auto; }
  .dialog-screen .in-dialog-lead__title,
  .card-slide-back .in-dialog-lead__title{
    font-family: var(--ff);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
    opacity: .9;
  }
  .dialog-screen .in-dialog-lead__row,
  .card-slide-back .in-dialog-lead__row{ display:flex; gap: var(--space-s); align-items:center; }
  .dialog-screen .in-dialog-lead__row > *,
  .card-slide-back .in-dialog-lead__row > *{ flex:1 1 0; min-width:0; }
  .dialog-screen .in-dialog-lead__field,
  .card-slide-back .in-dialog-lead__field{ display:grid; gap:6px; }
  .dialog-screen .in-dialog-lead__label,
  .card-slide-back .in-dialog-lead__label{
    font-family: var(--ff);
    font-size: 10px;
    font-weight: 400;
    color: var(--color-text);
    opacity: .75;
  }
  /* Phone: dial selector + input (reuse existing .dial-select/.dial-btn/.dial-list styles) */
  .dialog-screen .in-dialog-lead__phone-row,
  .card-slide-back .in-dialog-lead__phone-row{ display:flex; gap: var(--space-s); align-items:center; }
  .dialog-screen .in-dialog-lead__phone-row .dial-select,
  .card-slide-back .in-dialog-lead__phone-row .dial-select{ flex:0 0 auto; }
  .dialog-screen .in-dialog-lead__phone-row .in-dialog-lead__input,
  .card-slide-back .in-dialog-lead__phone-row .in-dialog-lead__input{ flex:1 1 auto; min-width:0; }
  /* Visual reference: ctx-input (Context Screen) but with new class */
  .dialog-screen .in-dialog-lead__input,
  .card-slide-back .in-dialog-lead__input{
    width:100%;
    height: var(--field-h);
    border-radius:10px;
    background:rgba(106,108,155,.10);
    border:1px solid rgba(106,108,155,.30);
    color: var(--color-text);
    caret-color: var(--color-text);
    font-family: var(--ff);
    font-size:12px;
    font-weight:400;
    padding:0 var(--space-s);
    line-height: var(--field-h);
    box-sizing:border-box;
    transition: border-color .15s ease;
  }
  .dialog-screen .in-dialog-lead__input.error,
  .card-slide-back .in-dialog-lead__input.error{ border-color:#E85F62; }
  .dialog-screen .in-dialog-lead__input::placeholder,
  .card-slide-back .in-dialog-lead__input::placeholder{ color: var(--color-text); opacity: .6; }
  .dialog-screen .in-dialog-lead__input:focus,
  .dialog-screen .in-dialog-lead__input:focus-visible,
  .card-slide-back .in-dialog-lead__input:focus,
  .card-slide-back .in-dialog-lead__input:focus-visible{
    outline:none;
    border-width:1px;
    border-color:var(--color-accent);
    box-shadow:none;
  }
  /* Visual reference: ctx-consent (Context Screen) but with new class */
  .dialog-screen .in-dialog-lead__consent,
  .card-slide-back .in-dialog-lead__consent{ display:flex; align-items:flex-start; gap:8px; margin-top:2px; }
  .dialog-screen .in-dialog-lead__checkbox,
  .card-slide-back .in-dialog-lead__checkbox{ width:12px; height:12px; margin-top:2px; }
  .dialog-screen .in-dialog-lead__checkbox.error,
  .card-slide-back .in-dialog-lead__checkbox.error{ outline:2px solid #E85F62; border-radius:3px; }
  .dialog-screen .in-dialog-lead__consent-text,
  .card-slide-back .in-dialog-lead__consent-text{
    font-family: var(--ff);
    font-size:10px;
    font-weight:400;
    color: var(--color-text);
    opacity: .85;
    line-height:1.4;
    margin-bottom: 25px;
  }
  .dialog-screen .in-dialog-lead__privacy-link,
  .card-slide-back .in-dialog-lead__privacy-link{ color:var(--color-accent); text-decoration:none; }
  .dialog-screen .in-dialog-lead__error,
  .card-slide-back .in-dialog-lead__error{ display:none; color:#E85F62; font-size:12px; margin-top:6px; }
  .dialog-screen .in-dialog-lead__error.visible,
  .card-slide-back .in-dialog-lead__error.visible{ display:block; }
  /* Visual reference: ctx-send-btn (Context Screen) but with new class */
  .dialog-screen .in-dialog-lead__actions,
  .card-slide-back .in-dialog-lead__actions{ display:flex; gap: var(--space-m); margin-top: 6px; }
  .dialog-screen .in-dialog-lead__send,
  .card-slide-back .in-dialog-lead__send{
    flex:1 1 0;
    min-width: var(--btn-min-w);
    padding: var(--btn-py) var(--btn-px);
    background:var(--color-accent);
    color: #fff;
    border:1.25px solid var(--color-accent);
    border-radius: var(--btn-radius);
    font: var(--fw-s) var(--fs-btn)/1 var(--ff);
    cursor:pointer;
    transition: opacity .15s ease, transform .12s ease;
  }
  .dialog-screen .in-dialog-lead__send:hover,
  .card-slide-back .in-dialog-lead__send:hover{ opacity:.9; transform: translateY(-1px); }
  .dialog-screen .in-dialog-lead__send:active,
  .card-slide-back .in-dialog-lead__send:active{ transform: translateY(0); opacity:.85; }
  /* Cancel button (visual reference: ctx-cancel-btn, but isolated) */
  .dialog-screen .in-dialog-lead__cancel,
  .card-slide-back .in-dialog-lead__cancel{
    flex:1 1 0;
    min-width: var(--btn-min-w);
    padding: var(--btn-py) var(--btn-px);
    background:transparent;
    color:var(--color-accent);
    border:1.25px solid var(--color-accent);
    border-radius: var(--btn-radius);
    font: var(--fw-s) var(--fs-btn)/1 var(--ff);
    cursor:pointer;
    transition: opacity .15s ease, transform .12s ease;
  }
  .dialog-screen .in-dialog-lead__cancel:hover,
  .card-slide-back .in-dialog-lead__cancel:hover{ opacity:.9; transform: translateY(-1px); }
  .dialog-screen .in-dialog-lead__cancel:active,
  .card-slide-back .in-dialog-lead__cancel:active{ transform: translateY(0); opacity:.85; }

  /* In-dialog thanks (UI-only) */
  .dialog-screen .in-dialog-thanks__title{ font-size:14px; font-weight:600; color: var(--color-text); margin-bottom:6px; text-align:center; }
  .dialog-screen .in-dialog-thanks__text{ font-size:12px; font-weight:400; color: var(--color-text); opacity: .85; text-align:center; line-height:1.35; }
  .dialog-screen .in-dialog-thanks__actions{ display:flex; justify-content:center; margin-top:14px; }
  .dialog-screen .in-dialog-thanks__close{
    padding: var(--btn-py) var(--btn-px);
    min-width: var(--btn-min-w);
    background:var(--color-accent);
    color:#fff;
    border:1.25px solid var(--color-accent);
    border-radius: var(--btn-radius);
    font: var(--fw-s) var(--fs-btn)/1 var(--ff);
    cursor:pointer;
    transition: opacity .15s ease, transform .12s ease;
  }
  .dialog-screen .in-dialog-thanks__close:hover{ opacity:.9; transform: translateY(-1px); }
  .dialog-screen .in-dialog-thanks__close:active{ transform: translateY(0); opacity:.85; }

  /* ===== Inline Lead Bubbles ===== */

  /* Input (moved to unified block below) */
 
  
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
  .recording-label{ color:#A0A0A0; font-family: var(--ff); font-size:14px; font-weight:400; letter-spacing:0; opacity:1; }
  @keyframes shake{ 0%,100%{ transform:translateX(0); } 10%,30%,50%,70%,90%{ transform:translateX(-2px); } 20%,40%,60%,80%{ transform:translateX(2px); } }
  .shake{ animation:shake .5s ease-in-out; }
  .record-timer{ color:#A0A0A0; font-family: var(--ff); font-size:14px; font-weight:400; letter-spacing:0; min-width:42px; text-align:left; }

  

  .loading{ position:absolute; display:none; align-items:center; justify-content:center; background: rgba(53,67,96,0.10); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius:20px; z-index:2; pointer-events:none; }
  .loading.active{ display:flex; }
  .loading-text{ color:#ffffff; font-size:16px; font-weight:400; font-family: var(--ff); display:flex; align-items:center; gap:4px; }
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
                    all: initial;
                    font-size: 16px !important;
                    line-height: 1.4;
                    letter-spacing: normal;
                    box-sizing: border-box;
                    color: var(--color-text);
                    font-family: var(--ff);
                    text-align: left;
                    direction: ltr;
                    display: block;
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    pointer-events: auto;  /* клики только по виджету; #vw-host — pointer-events: none */
                    /* В закрытом состоянии host = только область лаунчера */
                    width: 60px;
                    height: 60px;
                }
                :host(.open) {
                    width: auto;
                    height: auto;
                }
                @media (min-width: 768px) {
                  :host:not(.open) {
                    width: fit-content;
                    min-width: 240px;
                    height: auto;
                    min-height: clamp(60px, 6vw, 72px);
                  }
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
                  /* theme colors (dark default) */
                  --color-bg: #161515;
                  --color-text: #FFFFFF;
                  --color-accent: #4178CF;
                  --bg-card: #363636;
                  --bg-bubble: rgba(71, 106, 165, 0.5);
                  --dialogue-border: rgba(255, 255, 255, 0.1);
                  /* sub-surface tokens */
                  --color-sub-dark: rgba(255, 255, 255, 0.04);
                  --color-sub-light: rgba(0, 0, 0, 0.06);
                  --color-sub-surface: var(--color-sub-dark);
                  /* weights */
                  --fw-r: 400;
                  --fw-m: 500;
                  --fw-s: 600;
                  --fw-b: 700;
                  /* sizes in em (от :host font-size: 14px — виджет автономен) */
                  --fs-display: 1.428em;   /* ~20px */
                  --fs-h1: 1.286em;        /* ~18px */
                  --fs-h2: 1.143em;        /* ~16px */
                  --fs-h3: 1em;            /* 14px */
                  --fs-body: 1em;          /* 14px */
                  --fs-body-alt: 0.929em;  /* ~13px */
                  --fs-small: 0.857em;     /* ~12px */
                  --fs-btn: 0.857em;       /* ~12px */
                  --fs-micro: 0.714em;     /* ~10px */
                  /* line-heights */
                  --lh-tight: 1.2;
                  --lh-normal: 1.4;
                  --lh-loose: 1.6;
                  /* spacing tokens (based on 14px root) */
                  --space-xxs: 0.286em;   /* ~4px */
                  --space-xs:  0.571em;   /* ~8px */
                  --space-s:   0.714em;   /* ~10px */
                  --space-m:   0.857em;   /* ~12px */
                  --space-l:   1.143em;   /* ~16px */
                  --space-xl:  1.714em;   /* ~24px */
                  --space-xxl: 4.286em;   /* ~60px */
                  /* unified action button sizes (em) based on 14px scale */
                 
                  --btn-radius: 0.714em;   /* ~10px */
                  --btn-px: 1.143em;       /* ~16px horizontal padding */
                  --btn-py: 0.857em;       /* ~12px vertical padding */
                  --btn-min-w: 7.143em;    /* ~100px min width */
                  /* form field height */
                  --field-h: 3.5em;        /* ~35px */
                  /* context progress ring */
                  --ring: clamp(72px, 26vw, 100px);
                  /* iOS text zoom handling */
                  -webkit-text-size-adjust: 100%;
                  text-size-adjust: 100%;
                }
                :host([data-theme="light"]),
                :host([theme="light"]) {
                  --color-bg: #F7F7F7;
                  --color-text: #3D3D3D;
                  --color-accent: #4178CF;
                  --bg-card: #D7DBE3;
                  --bg-bubble: rgba(190, 198, 210, 0.5);
                  --dialogue-border: rgba(0, 0, 0, 0.1);
                  --color-sub-surface: var(--color-sub-light);
                }
                :host([data-theme="light"]) .widget-bubble,
                :host([theme="light"]) .widget-bubble,
                :host([data-theme="light"]) .dialog-screen .in-dialog-lead,
                :host([theme="light"]) .dialog-screen .in-dialog-lead {
                  background: var(--bg-card);
                }
                :host([data-theme="light"]) .dialog-screen .in-dialog-lead__title,
                :host([theme="light"]) .dialog-screen .in-dialog-lead__title,
                :host([data-theme="light"]) .dialog-screen .in-dialog-lead__label,
                :host([theme="light"]) .dialog-screen .in-dialog-lead__label,
                :host([data-theme="light"]) .dialog-screen .in-dialog-lead__consent-text,
                :host([theme="light"]) .dialog-screen .in-dialog-lead__consent-text {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .dialog-screen .in-dialog-lead__input,
                :host([theme="light"]) .dialog-screen .in-dialog-lead__input {
                  color: var(--color-text);
                  caret-color: var(--color-text);
                  background: rgba(0, 0, 0, 0.06);
                  border-color: rgba(0, 0, 0, 0.15);
                }
                :host([data-theme="light"]) .dialog-screen .in-dialog-lead__input::placeholder,
                :host([theme="light"]) .dialog-screen .in-dialog-lead__input::placeholder {
                  color: var(--color-text);
                  opacity: .5;
                }
                :host([data-theme="light"]) .dialog-screen .in-dialog-thanks__title,
                :host([theme="light"]) .dialog-screen .in-dialog-thanks__title,
                :host([data-theme="light"]) .dialog-screen .in-dialog-thanks__text,
                :host([theme="light"]) .dialog-screen .in-dialog-thanks__text {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .user-bubble,
                :host([theme="light"]) .user-bubble {
                  background: transparent;
                  border: 1px solid var(--color-accent);
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .card-screen .cs,
                :host([theme="light"]) .card-screen .cs {
                  background: var(--bg-card);
                  color: #000000;
                }
                :host([data-theme="light"]) .card-screen .cs-title,
                :host([theme="light"]) .card-screen .cs-title,
                :host([data-theme="light"]) .card-screen .cs-sub,
                :host([theme="light"]) .card-screen .cs-sub,
                :host([data-theme="light"]) .card-screen .cs-price,
                :host([theme="light"]) .card-screen .cs-price {
                  color: #000000;
                }
                :host([data-theme="light"]) .card-screen .cs-icon-item img,
                :host([theme="light"]) .card-screen .cs-icon-item img {
                  filter: none;
                }
                :host([data-theme="light"]) .card-screen .card-back-specs__icon,
                :host([theme="light"]) .card-screen .card-back-specs__icon {
                  filter: none;
                }
                :host([data-theme="light"]) .card-screen .cs-icon-check,
                :host([theme="light"]) .card-screen .cs-icon-check {
                  color: var(--color-accent);
                }
                :host([data-theme="light"]) .menu-language-dropdown,
                :host([theme="light"]) .menu-language-dropdown {
                  background: var(--bg-card);
                }
                :host([data-theme="light"]) .input-container,
                :host([theme="light"]) .input-container {
                  background:
                    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
                    #4178CF border-box;
                }
                :host([data-theme="light"]) .launcher__title,
                :host([theme="light"]) .launcher__title {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .launcher__subtitle,
                :host([theme="light"]) .launcher__subtitle {
                  color: var(--color-text);
                  opacity: .72;
                }
                :host([data-theme="light"]) .main-text,
                :host([theme="light"]) .main-text,
                :host([data-theme="light"]) .sub-text,
                :host([theme="light"]) .sub-text {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .bg-grid,
                :host([theme="light"]) .bg-grid {
                  background:
                    repeating-linear-gradient(to right, rgba(65, 120, 207, 0.03) 0 1px, transparent 1px 50px),
                    repeating-linear-gradient(to bottom, rgba(65, 120, 207, 0.03) 0 1px, transparent 1px 70px);
                }
                :host([data-theme="light"]) .menu-link,
                :host([theme="light"]) .menu-link,
                :host([data-theme="light"]) .data-storage-text,
                :host([theme="light"]) .data-storage-text,
                :host([data-theme="light"]) .main-message,
                :host([theme="light"]) .main-message,
                :host([data-theme="light"]) .footer-text,
                :host([theme="light"]) .footer-text,
                :host([data-theme="light"]) .ctx-consent .ctx-consent-text,
                :host([theme="light"]) .ctx-consent .ctx-consent-text,
                :host([data-theme="light"]) .dial-btn,
                :host([theme="light"]) .dial-btn {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .ctx-input,
                :host([theme="light"]) .ctx-input,
                :host([data-theme="light"]) .ctx-textarea,
                :host([theme="light"]) .ctx-textarea {
                  color: var(--color-text);
                  caret-color: var(--color-text);
                }
                :host([data-theme="light"]) .request-title,
                :host([theme="light"]) .request-title,
                :host([data-theme="light"]) .request-field-label,
                :host([theme="light"]) .request-field-label,
                :host([data-theme="light"]) .request-consent-text,
                :host([theme="light"]) .request-consent-text {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .request-select-list,
                :host([theme="light"]) .request-select-list {
                  background: var(--bg-card);
                }
                :host([data-theme="light"]) .dial-list,
                :host([theme="light"]) .dial-list {
                  background: var(--bg-card);
                }
                :host([data-theme="light"]) .dial-item,
                :host([theme="light"]) .dial-item {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .dial-item:hover,
                :host([theme="light"]) .dial-item:hover {
                  background: rgba(0, 0, 0, 0.08);
                }
                :host([data-theme="light"]) .request-select,
                :host([theme="light"]) .request-select {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .request-select-item,
                :host([theme="light"]) .request-select-item {
                  color: var(--color-text);
                }
                :host([data-theme="light"]) .request-input,
                :host([theme="light"]) .request-input,
                :host([data-theme="light"]) .request-textarea,
                :host([theme="light"]) .request-textarea {
                  color: var(--color-text);
                  caret-color: var(--color-text);
                }
                :host([data-theme="light"]) .input-field,
                :host([theme="light"]) .input-field {
                  color: var(--color-text);
                  caret-color: var(--color-text);
                }
                /* Base font normalization to ensure consistent typography across screens */
                :host { font-family: var(--ff); }
                .voice-widget-container { font-family: var(--ff); }
                button, input, select, textarea { font-family: inherit; }
                /* Ensure chips and property card inherit widget font */
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
                .text-primary  { color: var(--color-text); }
                .text-secondary{ color: var(--color-text); opacity:.85; }
                .text-hint     { color: var(--color-text); opacity:.65; }
                .text-accent   { color: var(--color-accent); }
                
                .voice-widget-container {
                    width: clamp(320px, 92vw, 380px);
                    height: clamp(560px, 88vh, 720px);
                    background: var(--color-bg);
                    color: var(--color-text);
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
                /* Decorative grid overlay inside widget (1px lines) */
                .bg-grid{
                  position:absolute;
                  inset:0;
                  pointer-events:none;
                  z-index:1; /* выше эллипсов, ниже контента */
                  background:
                    repeating-linear-gradient(to right, rgba(255,255,255,0.03) 0 1px, transparent 1px 50px),
                    repeating-linear-gradient(to bottom, rgba(255,255,255,0.03) 0 1px, transparent 1px 70px);
                }
                /* Main screen sections */
                .main-header{ width:100%; max-width:360px; display:flex; flex-direction:column; align-items:center; gap:20px; padding: 15px }
                .main-header-grid{ width:100%; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; }
                .header-action{
                  width:36px; height:36px;
                  display:inline-flex; align-items:center; justify-content:center;
                  border-radius:10px; background:transparent;
                  border:none; outline:none; appearance:none; -webkit-appearance:none;
                  cursor:pointer; -webkit-tap-highlight-color:transparent;
                  transition: opacity .15s ease;
                }
                /* hover меняет только саму иконку */
                .header-action:hover{ background: transparent; }
                .header-action:focus, .header-action:focus-visible{ outline:none; box-shadow:none; }
                .header-action img{ width:28px; height:28px; display:block; transition: opacity .15s ease; }
                .header-action:hover img{ opacity:.82; }
                .header-left{ justify-self:start; }
                .header-right{ justify-self:end; }
                .logo{ width:auto; height:24px; display:block; }
                .main-center{ flex:1; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
                .main-hero{ width:100%; display:flex; justify-content:center; }
                .main-copy{ width:100%; max-width:360px; text-align:center; }
                
                /* Логотип */
                .logo {
                    width: auto;
                    height: auto;
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
                    font-family: var(--ff);
                    font-weight: 600;
                    font-size: 20px;
                    color: #FFFFFF;
                    margin: 0;
                    line-height: 1.2;
                }
                
                .sub-text {
                    font-family: var(--ff);
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
                    #4178CF border-box;
                    border: 1px solid transparent;
                    border-radius: 40px;
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    padding: 0 10px;
                    box-sizing: border-box;
                    position: relative;
                    box-shadow: 0 8px 24px rgba(0,0,0,.10);
                    margin: var(--space-xxl) 0 var(--space-s) 0;
                }
                
                /* Dialogue screen layout: keep history scrollable and input at the bottom */
                .dialog-screen .voice-widget-container{ display:flex; flex-direction:column; }
                .dialog-screen .dialogue-container{
                    /* override legacy absolute layout */
                    position: static; top: auto; left: auto; right: auto; bottom: auto;
                    width: 100%; max-width: 360px; margin: 0 auto;
                    flex:1; min-height:0; overflow-y:auto; overflow-x:hidden;
                    /* Anchor thread to bottom when content is short (messenger-like) */
                    display: flex; 
                    flex-direction: column; 
                    justify-content: flex-end;
                }
                .dialog-screen .input-container{
                    margin: auto 0 var(--space-s) 0; /* top:auto pushes input to bottom */
                }
                
                /* Make other v2 screens scrollable within widget bounds */
                .context-screen .voice-widget-container,
                .request-screen .voice-widget-container,
                .debug-screen .voice-widget-container{
                    display:flex;
                    flex-direction:column;
                }
                .context-screen .context-main-container,
                .request-screen .request-main-container,
                .debug-screen .debug-main-container{
                    flex:1;
                    min-height:0;
                    overflow-y:auto; overflow-x:hidden;
                }

                .debug-main-container{
                    width:100%;
                    max-width:360px;
                    margin: var(--space-l) auto 0 auto;
                    padding: 0 var(--space-l) var(--space-l) var(--space-l);
                    box-sizing:border-box;
                    display:grid;
                    gap:10px;
                }
                .debug-title{
                    font-family: var(--ff);
                    font-size:16px;
                    font-weight:600;
                    color:var(--color-text);
                }
                .debug-actions{
                    display:flex;
                    gap:8px;
                }
                .debug-btn{
                    flex:1 1 0;
                    min-width:0;
                    height:34px;
                    border-radius:10px;
                    border:1.25px solid var(--color-accent);
                    background:transparent;
                    color:var(--color-accent);
                    font-family:var(--ff);
                    font-size:12px;
                    font-weight:600;
                    cursor:pointer;
                }
                .debug-btn--primary{
                    background:var(--color-accent);
                    color:#fff;
                }
                .debug-section{
                    background:rgba(106,108,155,.10);
                    border:1px solid rgba(106,108,155,.30);
                    border-radius:10px;
                    padding:8px;
                    display:grid;
                    gap:6px;
                }
                .debug-section-title{
                    font-family:var(--ff);
                    font-size:11px;
                    font-weight:600;
                    color:var(--color-text);
                    opacity:.9;
                }
                .debug-section-pre{
                    margin:0;
                    white-space:pre-wrap;
                    word-break:break-word;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                    font-size:10px;
                    line-height:1.35;
                    color:var(--color-text);
                    opacity:.92;
                    max-height:140px;
                    overflow:auto;
                    scrollbar-width:thin;
                }
                
                
                
                .input-field {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    color: #FFFFFF;
                    font-family: var(--ff);
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
                    font-family: var(--ff);
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
                    font-family: var(--ff);
                    font-size: 24px;
                    font-weight: 600;
                    margin: 0 0 16px 0;
                }
                
                .placeholder-content p {
                    font-family: var(--ff);
                    font-size: 16px;
                    font-weight: 400;
                    color: #A0A0A0;
                    margin: 0;
                }
                
                /* Стили для Dialog Screen */
                .screen-header{
                    width:100%; max-width:320px; height:60px; margin:0 auto;
                    display:grid; grid-template-columns:1fr auto 1fr; align-items:center; position:relative; z-index:2;
                }
                /* overlay в диалоге должен перекрывать всю сетку хедера */
                .screen-header .menu-overlay{ grid-column:1 / -1; grid-row:1; z-index:4; }
                .screen-header .header-action{ grid-row:1; }
                .screen-header .header-left{ grid-column:1; justify-self:start; }
                .screen-header .header-right{ grid-column:3; justify-self:end; }
                .screen-header .header-logo{ grid-column:2; grid-row:1; justify-self:center; width:auto; height:18px; display:block; cursor:pointer; }
                /* скрываем крайние кнопки при открытом меню */
                .screen-header.menu-opened .header-action{ display:none; }
                .screen-header.menu-opened .header-logo{ display:none; }
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
                    border: 1px solid var(--dialogue-border);
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
                .request-main-container::-webkit-scrollbar{ width:2px; }
                .context-main-container::-webkit-scrollbar-track,
                .request-main-container::-webkit-scrollbar-track{ background:transparent; }
                .context-main-container::-webkit-scrollbar-thumb,
                .request-main-container::-webkit-scrollbar-thumb{
                    background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.5) 20%,rgba(100,100,100,.5) 80%,transparent 100%);
                    border-radius:1px;
                }
                .context-main-container::-webkit-scrollbar-thumb:hover,
                .request-main-container::-webkit-scrollbar-thumb:hover{
                    background:linear-gradient(to bottom,transparent 0%,rgba(100,100,100,.7) 20%,rgba(100,100,100,.7) 80%,transparent 100%);
                }
                .context-main-container,
                .request-main-container{ scrollbar-width:thin; scrollbar-color:rgba(100,100,100,.5) transparent; }
                
                .message-bubble {
                    border-radius: 10px;
                    padding: 10px;
                    margin-bottom: 16px;
                    font-family: var(--ff);
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                    max-width: 97%;
                }
                
                .widget-bubble {
                    background: var(--bg-bubble);
                    color: var(--color-text);
                    margin-right: 20px;
                    margin-left: 0;
                    white-space: pre-line;
                }
                
                .user-bubble {
                    background: transparent;
                    border: 1px solid var(--color-accent);
                    color: var(--color-text);
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
                    font-family: var(--ff);
                    font-size: clamp(0.857rem, 2.8vw, 1.286rem);
                    font-weight: 400;
                    color: var(--color-accent) ;
                }
                
                .data-storage-text {
                    font-family: var(--ff);
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
                .data-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:var(--color-accent); color:#fff; border:1.25px solid var(--color-accent); border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; margin:14px auto 0; display:flex; align-items:center; justify-content:center; }
                .data-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                
                .status-text {
                    font-family: var(--ff);
                    font-size: var(--fs-micro);
                    font-weight: 400;
                    color: var(--color-accent);
                    margin-bottom: var(--space-xl);
                }
                
                .main-message {
                    font-family: var(--ff);
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
                    background: linear-gradient(90deg, rgba(65, 120, 207, 0) 0%, var(--color-accent) 50%, rgba(65, 120, 207, 0) 100%);
                    margin: 0 auto 10px auto;
                }
                
                .hint-text {
                    font-family: var(--ff);
                    font-size: 12px;
                    font-weight: 200;
                    color: var(--color-text);
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
                    background: var(--color-accent);
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
                .ctx-input{ width:100%; height: var(--field-h); border-radius:10px; background:rgba(106,108,155,.10); border:1px solid rgba(106,108,155,.30); color:#FFFFFF; caret-color:#FFFFFF; font-family: var(--ff); font-size:12px; font-weight:400; padding:0 var(--space-s); line-height: var(--field-h); box-sizing:border-box; transition: border-color .15s ease; }
                .ctx-input.error{ border-color:#E85F62; }
                .ctx-input:focus,
                .ctx-input:focus-visible{ outline:none; border-width:1px; border-color:var(--color-accent); box-shadow:none; }
                .ctx-textarea{ width:100%; min-height:80px; border-radius:10px; background:rgba(106,108,155,.10); border:1px solid rgba(106,108,155,.30); color:#FFFFFF; caret-color:#FFFFFF; font-family: var(--ff); font-size:12px; font-weight:400; padding:10px; resize:vertical; box-sizing:border-box; }
                .ctx-textarea{ overflow-y:auto; scrollbar-width: none; -ms-overflow-style: none; }
                .ctx-textarea::-webkit-scrollbar{ width:0; height:0; }
                .ctx-textarea:focus,
                .ctx-textarea:focus-visible{ outline:none; border-width:1px; border-color:var(--color-accent); box-shadow:none; }
                .ctx-textarea.error{ border-color:#E85F62; }
                .ctx-consent{ display:flex; align-items:flex-start; gap:8px; margin-top:6px; }
                .ctx-consent .ctx-checkbox{ width:12px; height:12px; margin-top:2px; }
                .ctx-consent .ctx-consent-text{ font-family: var(--ff); font-size:10px; font-weight:400; color:#C4C4C4; line-height:1.4; }
                .ctx-consent .ctx-privacy-link{ color:var(--color-accent); text-decoration:none; }
                .ctx-checkbox.error{ outline:2px solid #E85F62; border-radius:3px; }
                .ctx-error{ display:none; color:#E85F62; font-size:12px; margin-top:6px; }
                .ctx-error.visible{ display:block; }
                .ctx-actions{ display:flex; gap: var(--space-m); justify-content: space-between; margin-top: var(--space-m); }
                .ctx-send-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:var(--color-accent); color:#fff; border:1.25px solid var(--color-accent); border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; }
                .ctx-cancel-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:transparent; color:var(--color-accent); border:1.25px solid var(--color-accent); border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; }
                .ctx-actions .ctx-send-btn, .ctx-actions .ctx-cancel-btn{ flex:1 1 0; min-width:0; }
                .ctx-send-btn, .ctx-cancel-btn, .ctx-done-btn{ font: var(--fw-s) var(--fs-btn)/1 var(--ff); }
                
                /* thanks block after send */
                .ctx-thanks{ display:none; margin-top:16px; text-align:center; }
                .ctx-thanks-title{ font-size:14px; font-weight:600; color:#FFFFFF; margin-bottom:6px; }
                .ctx-thanks-text{ font-size:12px; font-weight:400; color:#C4C4C4; }
                .ctx-thanks .ctx-done-btn{ padding:var(--btn-py) var(--btn-px); min-width:var(--btn-min-w); background:var(--color-accent); color:#fff; border:1.25px solid var(--color-accent); border-radius:var(--btn-radius); font-size:12px; font-weight:600; cursor:pointer; margin-top:14px; }
                
                .footer-text {
                    position: relative;
                    margin: 0 auto;
                    display: inline-block;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    font-family: var(--ff);
                    font-size: 10px;
                    font-weight: 400;
                    color: #A9A9A9;
                    text-align: center;
                    cursor: pointer;
                    transition: transform .15s ease, opacity .15s ease;
                }
                .footer-text:hover{ transform: scale(1.1); opacity:.9; }
                .footer-text.viral-link-text{
                    display: inline-block;
                    text-decoration: none;
                    -webkit-tap-highlight-color: transparent;
                }
                
                /* Декоративная линия для ContextScreen */
                .context-gradient-line {
                    width: 320px;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(65, 120, 207, 0) 0%, var(--color-accent) 50%, rgba(65, 120, 207, 0) 100%);
                    margin: var(--space-l) 0;
                }
                
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
                    font-family: var(--ff);
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
                    font-family: var(--ff);
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
                    caret-color: #FFFFFF;
                    font-family: var(--ff);
                    font-size: 12px;
                    font-weight: 400;
                    padding-left: var(--space-s);
                    line-height: var(--field-h);
                    box-sizing: border-box;
                    transition: border-color .15s ease;
                }
                .request-input.error{ border-color:#E85F62; }
                .request-input:focus,
                .request-input:focus-visible{ outline:none; border-width:1px; border-color:var(--color-accent); box-shadow:none; }
                
                
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
                .email-suggest .chip{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:10px; border:1px solid var(--color-accent); color:var(--color-accent); font-size:12px; font-weight:600; cursor:pointer; background:transparent; }
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
                    font-family: var(--ff);
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
                    caret-color: #FFFFFF;
                    font-family: var(--ff);
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
                .request-textarea:focus-visible{ outline:none; border-width:1px; border-color:var(--color-accent); box-shadow:none; }
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
                    font-family: var(--ff);
                    font-size: 10px;
                    font-weight: 400;
                    color: #C4C4C4;
                    line-height: 1.4;
                }
                
                .request-privacy-link {
                    color: var(--color-accent);
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
                    background: var(--color-accent);
                    color: #FFFFFF;
                    border: none;
                }
                
                .request-cancel-btn {
                    background: transparent;
                    color: var(--color-text);
                    border: 1px solid var(--color-accent);
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
                    overflow: visible;
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
                    width: 140px;
                    height: 25px;
                    background: transparent;
                    border-radius: 8px;
                    border: 0.1px solid rgba(65, 120, 207, 0.4);
                    color: #DBDBDB;
                    font-family: var(--ff);
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: transform 0.15s ease, opacity 0.15s ease;
                    display: inline-flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 8px;
                    padding: 0 6px;
                }
                .menu-btn:hover { transform: scale(1.05); opacity: 0.85; }
                .menu-btn--request { color: var(--color-text); }
                .menu-btn--language { color: var(--color-text); }
                .menu-btn--context { color: var(--color-text); }
                .menu-btn--reset { color: var(--color-text); }
                .menu-btn .menu-btn__icon{ width:18px; height:18px; flex:0 0 18px; }
                .menu-btn--request .menu-btn__icon,
                .menu-btn--language .menu-btn__icon{ width:16px; height:16px; flex:0 0 16px; }
                .menu-language {
                    position: relative;
                    width: 140px;
                }
                .menu-language-trigger {
                    width: 140px;
                }
                .menu-language-dropdown {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 0;
                    width: 140px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    background: rgba(15, 16, 20, 0.98);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
                    display: none;
                    z-index: 20;
                    padding: 4px;
                }
                .menu-language-dropdown.open {
                    display: block;
                }
                .menu-language-option {
                    width: 100%;
                    height: 24px;
                    border: none;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--color-text);
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0 8px;
                    font-family: var(--ff);
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                }
                .menu-language-option:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
                .menu-language-option.is-active {
                    color: var(--color-text);
                    background: rgba(255, 255, 255, 0.12);
                }
                .header-language-menu{
                    position:absolute;
                    top:44px;
                    left:0;
                    z-index:20;
                    display:none;
                }
                .header-language-menu.open{
                    display:block;
                }
                .menu-link {
                    width: 110px;
                    height: 25px;
                    border-radius: 20px;
                    background: transparent;
                    border: none;
                    color: #FFFFFF;
                    font-family: var(--ff);
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
                    font-family: var(--ff);
                    font-size: 12px;
                    color: currentColor;
                }
                .menu-badge--request { color: var(--color-accent); }
                .menu-badge--context { color: var(--color-accent); }

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
    <span class="launcher__textBlock" aria-hidden="true">
      <span class="launcher__title">${this.getCurrentLocale().launcherTitle}</span>
      <span class="launcher__subtitle">${this.getCurrentLocale().launcherSubtitle}</span>
    </span>
    <span class="launcher__iconSlot" aria-hidden="true">
      <!-- Desktop legacy icon (kept for safety, but hidden in vw-mobile/vw-desktop) -->
      <img class="launcher__desktopIcon" src="${ASSETS_BASE}MicBig.png" alt="" />
      <!-- Flip logos (attention animation) -->
      <span class="launcher__flip">
        <span class="launcher__flipInner">
          <span class="launcher__face launcher__face--front"><svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<g>
<g clip-path="url(#paint0_angular_1071_1216_clip_path)" data-figma-skip-parse="true"><g transform="matrix(0 -0.0169404 0.0169409 0 17.9995 17.999)"><foreignObject x="-1000" y="-1000" width="2000" height="2000"><div xmlns="http://www.w3.org/1999/xhtml" style="background:conic-gradient(from 90deg,rgba(141, 75, 109, 1) 0deg,rgba(239, 68, 68, 1) 91.7308deg,rgba(238, 202, 0, 1) 178.269deg,rgba(41, 84, 153, 1) 264.808deg,rgba(141, 75, 109, 1) 360deg);height:100%;width:100%;opacity:1"></div></foreignObject></g></g><path d="M18 1.05859C27.3562 1.05876 34.9404 8.64315 34.9404 17.999C34.9402 27.3547 27.3561 34.9393 18 34.9395C8.6438 34.9395 1.05877 27.3548 1.05859 17.999C1.05859 8.64304 8.64369 1.05859 18 1.05859ZM12.543 19.0156C12.1688 19.0157 11.8618 19.3205 11.9033 19.6924C12.0561 21.0607 12.6684 22.3451 13.6514 23.3281C14.5617 24.2383 15.7309 24.8291 16.9854 25.0332V28.165H19.0186V25.0205C20.2442 24.8053 21.3844 24.2199 22.2764 23.3281L22.3682 23.2354C23.2979 22.2651 23.8774 21.018 24.0254 19.6924L24.0293 19.623C24.0283 19.3059 23.7733 19.0519 23.4541 19.0195L23.3857 19.0156H22.8184C22.4676 19.0157 22.1835 19.2843 22.0996 19.6221L22.0859 19.6904C21.9543 20.4942 21.589 21.247 21.0312 21.8506L20.917 21.9688C20.1338 22.7518 19.0714 23.1924 17.9639 23.1924L17.8604 23.1904C16.7904 23.1638 15.7694 22.7273 15.0107 21.9688L14.8965 21.8506C14.3387 21.247 13.9744 20.4942 13.8428 19.6904L13.8281 19.6221C13.7442 19.2844 13.461 19.0158 13.1104 19.0156H12.543ZM17.3613 25.085C17.5607 25.1048 17.7618 25.1142 17.9639 25.1143C18.1662 25.1143 18.3678 25.1048 18.5674 25.085H18.6797V27.8574H17.3242V25.085H17.3613ZM13.1104 19.3545C13.2862 19.3547 13.4685 19.506 13.5078 19.7451C13.6596 20.6719 14.0989 21.5353 14.7715 22.208C15.6182 23.0546 16.7665 23.5312 17.9639 23.5312C19.1613 23.5313 20.3105 23.0546 21.1572 22.208C21.8297 21.5353 22.2681 20.6718 22.4199 19.7451C22.4592 19.5059 22.6424 19.3546 22.8184 19.3545H23.3857C23.584 19.3547 23.7046 19.5086 23.6885 19.6543C23.5442 20.9467 22.9656 22.1604 22.0371 23.0889C20.9569 24.1688 19.4914 24.7754 17.9639 24.7754C16.4366 24.7753 14.9717 24.1687 13.8916 23.0889C12.9631 22.1604 12.3835 20.9467 12.2393 19.6543C12.2232 19.5086 12.3446 19.3545 12.543 19.3545H13.1104ZM17.9668 9.53027C16.2828 9.53038 14.918 10.8951 14.918 12.5791V17.6611L14.9219 17.8184C15.0038 19.4292 16.3356 20.7108 17.9668 20.7109C19.6508 20.7109 21.0164 19.345 21.0166 17.6611V12.5791C21.0166 10.8951 19.6509 9.53027 17.9668 9.53027ZM17.9668 9.86914C19.4638 9.86914 20.6777 11.0822 20.6777 12.5791V17.6611C20.6775 19.1579 19.4637 20.3721 17.9668 20.3721C16.47 20.372 15.2571 19.1578 15.2568 17.6611V12.5791C15.2569 11.0823 16.4699 9.86925 17.9668 9.86914Z" data-figma-gradient-fill="{&#34;type&#34;:&#34;GRADIENT_ANGULAR&#34;,&#34;stops&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.93725490570068359,&#34;g&#34;:0.26666668057441711,&#34;b&#34;:0.26666668057441711,&#34;a&#34;:1.0},&#34;position&#34;:0.25480768084526062},{&#34;color&#34;:{&#34;r&#34;:0.93494594097137451,&#34;g&#34;:0.79470425844192505,&#34;b&#34;:0.0,&#34;a&#34;:1.0},&#34;position&#34;:0.49519231915473938},{&#34;color&#34;:{&#34;r&#34;:0.16078431904315948,&#34;g&#34;:0.32941177487373352,&#34;b&#34;:0.60000002384185791,&#34;a&#34;:1.0},&#34;position&#34;:0.73557692766189575}],&#34;stopsVar&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.93725490570068359,&#34;g&#34;:0.26666668057441711,&#34;b&#34;:0.26666668057441711,&#34;a&#34;:1.0},&#34;position&#34;:0.25480768084526062},{&#34;color&#34;:{&#34;r&#34;:0.93494594097137451,&#34;g&#34;:0.79470425844192505,&#34;b&#34;:0.0,&#34;a&#34;:1.0},&#34;position&#34;:0.49519231915473938},{&#34;color&#34;:{&#34;r&#34;:0.16078431904315948,&#34;g&#34;:0.32941177487373352,&#34;b&#34;:0.60000002384185791,&#34;a&#34;:1.0},&#34;position&#34;:0.73557692766189575}],&#34;transform&#34;:{&#34;m00&#34;:-8.1069096477103669e-14,&#34;m01&#34;:33.88183593750,&#34;m02&#34;:1.058593750,&#34;m10&#34;:-33.8808593750,&#34;m11&#34;:1.2881306264700410e-12,&#34;m12&#34;:34.9394531250},&#34;opacity&#34;:1.0,&#34;blendMode&#34;:&#34;NORMAL&#34;,&#34;visible&#34;:true}"/>
</g>
<path d="M34.9412 18C34.9412 8.64365 27.3564 1.05882 18 1.05882C8.64365 1.05882 1.05882 8.64365 1.05882 18C1.05882 27.3564 8.64365 34.9412 18 34.9412C27.3564 34.9412 34.9412 27.3564 34.9412 18ZM36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18Z" fill="#2D251C"/>
<defs>
<clipPath id="paint0_angular_1071_1216_clip_path"><path d="M18 1.05859C27.3562 1.05876 34.9404 8.64315 34.9404 17.999C34.9402 27.3547 27.3561 34.9393 18 34.9395C8.6438 34.9395 1.05877 27.3548 1.05859 17.999C1.05859 8.64304 8.64369 1.05859 18 1.05859ZM12.543 19.0156C12.1688 19.0157 11.8618 19.3205 11.9033 19.6924C12.0561 21.0607 12.6684 22.3451 13.6514 23.3281C14.5617 24.2383 15.7309 24.8291 16.9854 25.0332V28.165H19.0186V25.0205C20.2442 24.8053 21.3844 24.2199 22.2764 23.3281L22.3682 23.2354C23.2979 22.2651 23.8774 21.018 24.0254 19.6924L24.0293 19.623C24.0283 19.3059 23.7733 19.0519 23.4541 19.0195L23.3857 19.0156H22.8184C22.4676 19.0157 22.1835 19.2843 22.0996 19.6221L22.0859 19.6904C21.9543 20.4942 21.589 21.247 21.0312 21.8506L20.917 21.9688C20.1338 22.7518 19.0714 23.1924 17.9639 23.1924L17.8604 23.1904C16.7904 23.1638 15.7694 22.7273 15.0107 21.9688L14.8965 21.8506C14.3387 21.247 13.9744 20.4942 13.8428 19.6904L13.8281 19.6221C13.7442 19.2844 13.461 19.0158 13.1104 19.0156H12.543ZM17.3613 25.085C17.5607 25.1048 17.7618 25.1142 17.9639 25.1143C18.1662 25.1143 18.3678 25.1048 18.5674 25.085H18.6797V27.8574H17.3242V25.085H17.3613ZM13.1104 19.3545C13.2862 19.3547 13.4685 19.506 13.5078 19.7451C13.6596 20.6719 14.0989 21.5353 14.7715 22.208C15.6182 23.0546 16.7665 23.5312 17.9639 23.5312C19.1613 23.5313 20.3105 23.0546 21.1572 22.208C21.8297 21.5353 22.2681 20.6718 22.4199 19.7451C22.4592 19.5059 22.6424 19.3546 22.8184 19.3545H23.3857C23.584 19.3547 23.7046 19.5086 23.6885 19.6543C23.5442 20.9467 22.9656 22.1604 22.0371 23.0889C20.9569 24.1688 19.4914 24.7754 17.9639 24.7754C16.4366 24.7753 14.9717 24.1687 13.8916 23.0889C12.9631 22.1604 12.3835 20.9467 12.2393 19.6543C12.2232 19.5086 12.3446 19.3545 12.543 19.3545H13.1104ZM17.9668 9.53027C16.2828 9.53038 14.918 10.8951 14.918 12.5791V17.6611L14.9219 17.8184C15.0038 19.4292 16.3356 20.7108 17.9668 20.7109C19.6508 20.7109 21.0164 19.345 21.0166 17.6611V12.5791C21.0166 10.8951 19.6509 9.53027 17.9668 9.53027ZM17.9668 9.86914C19.4638 9.86914 20.6777 11.0822 20.6777 12.5791V17.6611C20.6775 19.1579 19.4637 20.3721 17.9668 20.3721C16.47 20.372 15.2571 19.1578 15.2568 17.6611V12.5791C15.2569 11.0823 16.4699 9.86925 17.9668 9.86914Z"/></clipPath></defs>
</svg></span>
          <span class="launcher__face launcher__face--back"><svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<g>
<g clip-path="url(#paint0_angular_1071_1198_clip_path)" data-figma-skip-parse="true"><g transform="matrix(0 -0.0169414 0.0169414 0 18 18)"><foreignObject x="-1000" y="-1000" width="2000" height="2000"><div xmlns="http://www.w3.org/1999/xhtml" style="background:conic-gradient(from 90deg,rgba(141, 75, 109, 1) 0deg,rgba(239, 68, 68, 1) 91.7308deg,rgba(238, 202, 0, 1) 178.269deg,rgba(41, 84, 153, 1) 264.808deg,rgba(141, 75, 109, 1) 360deg);height:100%;width:100%;opacity:1"></div></foreignObject></g></g><path d="M18 1.05859C27.3562 1.05872 34.9414 8.64372 34.9414 18C34.9413 27.3562 27.3562 34.9413 18 34.9414C8.64372 34.9414 1.05872 27.3562 1.05859 18C1.05859 8.64365 8.64365 1.05859 18 1.05859ZM13.6484 11.6475L13.4443 11.6582C12.4357 11.7605 11.6485 12.6118 11.6484 13.6475V24.2041L11.6611 24.4033C11.7774 25.3128 12.6759 25.9214 13.5635 25.6914L13.7539 25.6289C14.059 25.5067 14.3163 25.2899 14.4883 25.0127L14.5566 24.8906L15.3311 23.3408C15.6488 22.706 16.2772 22.2897 16.9785 22.2402L17.1201 22.2354H22.3545L22.5586 22.2256C23.4994 22.1298 24.2479 21.3812 24.3438 20.4404L24.3545 20.2354V13.6475C24.3544 12.6122 23.5668 11.7609 22.5586 11.6582L22.3545 11.6475H13.6484ZM22.3545 12.0576C23.2321 12.0581 23.9443 12.7697 23.9443 13.6475V20.2354C23.9441 21.113 23.232 21.8256 22.3545 21.8262H17.1201C16.2074 21.8262 15.3721 22.3419 14.9639 23.1582L14.1895 24.707C14.0663 24.953 13.8568 25.1457 13.6016 25.248C12.8628 25.5435 12.0592 24.9996 12.0586 24.2041V13.6475C12.0586 12.7694 12.7703 12.0576 13.6484 12.0576H22.3545ZM14.8242 15.8828C14.2397 15.883 13.7658 16.3568 13.7656 16.9414C13.7658 17.5259 14.2397 18.0008 14.8242 18.001C15.4087 18.0008 15.8836 17.5259 15.8838 16.9414C15.8836 16.3569 15.4087 15.883 14.8242 15.8828ZM18.001 15.8828C17.4163 15.8828 16.9425 16.3568 16.9424 16.9414C16.9426 17.526 17.4163 18.001 18.001 18.001C18.5854 18.0008 19.0594 17.5259 19.0596 16.9414C19.0594 16.3569 18.5855 15.883 18.001 15.8828ZM21.1777 15.8828C20.593 15.8828 20.1183 16.3568 20.1182 16.9414C20.1184 17.526 20.5931 18.001 21.1777 18.001C21.7621 18.0006 22.2361 17.5258 22.2363 16.9414C22.2362 16.357 21.7621 15.8832 21.1777 15.8828Z" data-figma-gradient-fill="{&#34;type&#34;:&#34;GRADIENT_ANGULAR&#34;,&#34;stops&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.93725490570068359,&#34;g&#34;:0.26666668057441711,&#34;b&#34;:0.26666668057441711,&#34;a&#34;:1.0},&#34;position&#34;:0.25480768084526062},{&#34;color&#34;:{&#34;r&#34;:0.93494594097137451,&#34;g&#34;:0.79470425844192505,&#34;b&#34;:0.0,&#34;a&#34;:1.0},&#34;position&#34;:0.49519231915473938},{&#34;color&#34;:{&#34;r&#34;:0.16078431904315948,&#34;g&#34;:0.32941177487373352,&#34;b&#34;:0.60000002384185791,&#34;a&#34;:1.0},&#34;position&#34;:0.73557692766189575}],&#34;stopsVar&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.93725490570068359,&#34;g&#34;:0.26666668057441711,&#34;b&#34;:0.26666668057441711,&#34;a&#34;:1.0},&#34;position&#34;:0.25480768084526062},{&#34;color&#34;:{&#34;r&#34;:0.93494594097137451,&#34;g&#34;:0.79470425844192505,&#34;b&#34;:0.0,&#34;a&#34;:1.0},&#34;position&#34;:0.49519231915473938},{&#34;color&#34;:{&#34;r&#34;:0.16078431904315948,&#34;g&#34;:0.32941177487373352,&#34;b&#34;:0.60000002384185791,&#34;a&#34;:1.0},&#34;position&#34;:0.73557692766189575}],&#34;transform&#34;:{&#34;m00&#34;:-8.1071434288038091e-14,&#34;m01&#34;:33.88281250,&#34;m02&#34;:1.058593750,&#34;m10&#34;:-33.88281250,&#34;m11&#34;:1.2882048943188562e-12,&#34;m12&#34;:34.941406250},&#34;opacity&#34;:1.0,&#34;blendMode&#34;:&#34;NORMAL&#34;,&#34;visible&#34;:true}"/>
</g>
<path d="M34.9412 18C34.9412 8.64365 27.3564 1.05882 18 1.05882C8.64365 1.05882 1.05882 8.64365 1.05882 18C1.05882 27.3564 8.64365 34.9412 18 34.9412C27.3564 34.9412 34.9412 27.3564 34.9412 18ZM36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18Z" fill="#2D251C"/>
<defs>
<clipPath id="paint0_angular_1071_1198_clip_path"><path d="M18 1.05859C27.3562 1.05872 34.9414 8.64372 34.9414 18C34.9413 27.3562 27.3562 34.9413 18 34.9414C8.64372 34.9414 1.05872 27.3562 1.05859 18C1.05859 8.64365 8.64365 1.05859 18 1.05859ZM13.6484 11.6475L13.4443 11.6582C12.4357 11.7605 11.6485 12.6118 11.6484 13.6475V24.2041L11.6611 24.4033C11.7774 25.3128 12.6759 25.9214 13.5635 25.6914L13.7539 25.6289C14.059 25.5067 14.3163 25.2899 14.4883 25.0127L14.5566 24.8906L15.3311 23.3408C15.6488 22.706 16.2772 22.2897 16.9785 22.2402L17.1201 22.2354H22.3545L22.5586 22.2256C23.4994 22.1298 24.2479 21.3812 24.3438 20.4404L24.3545 20.2354V13.6475C24.3544 12.6122 23.5668 11.7609 22.5586 11.6582L22.3545 11.6475H13.6484ZM22.3545 12.0576C23.2321 12.0581 23.9443 12.7697 23.9443 13.6475V20.2354C23.9441 21.113 23.232 21.8256 22.3545 21.8262H17.1201C16.2074 21.8262 15.3721 22.3419 14.9639 23.1582L14.1895 24.707C14.0663 24.953 13.8568 25.1457 13.6016 25.248C12.8628 25.5435 12.0592 24.9996 12.0586 24.2041V13.6475C12.0586 12.7694 12.7703 12.0576 13.6484 12.0576H22.3545ZM14.8242 15.8828C14.2397 15.883 13.7658 16.3568 13.7656 16.9414C13.7658 17.5259 14.2397 18.0008 14.8242 18.001C15.4087 18.0008 15.8836 17.5259 15.8838 16.9414C15.8836 16.3569 15.4087 15.883 14.8242 15.8828ZM18.001 15.8828C17.4163 15.8828 16.9425 16.3568 16.9424 16.9414C16.9426 17.526 17.4163 18.001 18.001 18.001C18.5854 18.0008 19.0594 17.5259 19.0596 16.9414C19.0594 16.3569 18.5855 15.883 18.001 15.8828ZM21.1777 15.8828C20.593 15.8828 20.1183 16.3568 20.1182 16.9414C20.1184 17.526 20.5931 18.001 21.1777 18.001C21.7621 18.0006 22.2361 17.5258 22.2363 16.9414C22.2362 16.357 21.7621 15.8832 21.1777 15.8828Z"/></clipPath></defs>
</svg></span>
        </span>
      </span>
    </span>
  </button>
  
  <!-- Image lightbox overlay -->
  <div class="img-lightbox" id="imgLightbox" aria-hidden="true">
    <img id="imgLightboxImg" alt="">
  </div>

  

  <div class="widget" role="dialog" aria-modal="true" aria-label="Voice Assistant">
    <button class="widget-close-floating" id="widgetCloseFloating" type="button" title="Close widget">
      <img src="${ASSETS_BASE}main_close_btn.svg" alt="Close">
    </button>
    <!-- Header removed for v2 UI -->

    <!-- Content -->
    <div class="content">
      <!-- Main Screen (скрыт через CSS, в DOM сохранён) -->
      <div class="main-screen hidden" id="mainScreen">
        <div class="voice-widget-container">
            <div class="bg-grid"></div>
            <div class="screen-header">
              <button class="header-action header-left" type="button" title="Статистика">
                <img src="${ASSETS_BASE}${this.getLanguageIconByTheme()}" alt="Language">
              </button>
              <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
              <button class="header-action header-right" type="button" title="Закрыть виджет">
                <img src="${ASSETS_BASE}${this.getContactIconByTheme()}" alt="Request">
              </button>
            </div>
            <div class="main-center">
              <div class="main-hero">
                <button class="mic-button" id="mainButton" aria-pressed="false">
                    <img src="${ASSETS_BASE}MicBig.png" alt="Microphone" style="width: 100%; height: 100%;">
                </button>
              </div>
              <div class="main-copy">
                <div class="text-container">
                    <p class="main-text">${this.getCurrentLocale().chatGreeting}</p>
                    <p class="sub-text">${this.getCurrentLocale().chatSubGreeting}</p>
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
                        <img src="${ASSETS_BASE}${this.getMicIconByTheme()}" alt="Microphone">
                    </button>
                    <button class="input-btn" id="mainSendButton" type="button" title="Отправить">
                        <img src="${ASSETS_BASE}${this.getSendIconByTheme()}" alt="Send">
                    </button>
                </div>
            </div>
        </div>
      </div>

      <!-- Dialogue Screen (v2) — основной экран при открытии виджета -->
      <div class="dialog-screen" id="dialogScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header">
            <button class="header-action header-left" type="button" title="Статистика">
              <img src="${ASSETS_BASE}${this.getLanguageIconByTheme()}" alt="Language">
            </button>
            <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
            <button class="header-action header-right" type="button" title="Закрыть виджет">
              <img src="${ASSETS_BASE}${this.getContactIconByTheme()}" alt="Request">
            </button>
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
              <button class="input-btn" id="toggleButton" type="button" title="Говорить"><img src="${ASSETS_BASE}${this.getMicIconByTheme()}" alt="Microphone"></button>
              <button class="input-btn" id="sendButton" type="button" title="Отправить"><img src="${ASSETS_BASE}${this.getSendIconByTheme()}" alt="Send"></button>
        </div>
      </div>
          <a class="footer-text viral-link-text" id="dialogViralLink" href="#">Разработано VIA AI, хочу такой же виджет</a>
        </div>
          </div>


      <!-- Context Screen (v2) -->
      <div class="context-screen hidden" id="contextScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header">
            <button class="header-action header-left" type="button" title="Language">
              <img src="${ASSETS_BASE}${this.getLanguageIconByTheme()}" alt="Language">
            </button>
            <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
            <button class="header-action header-right" type="button" title="Request">
              <img src="${ASSETS_BASE}${this.getContactIconByTheme()}" alt="Request">
            </button>
          </div>
          <div class="context-main-container">
            <div class="progress-grid-container">
              <div class="grid-column-left"></div>
              <div class="grid-column-center">
                <div class="progress-ring">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="${this.getInsightsProgressTrackStrokeByTheme()}" stroke-width="12"/>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-accent)" stroke-width="12" stroke-dasharray="276.46" stroke-dashoffset="2.76" stroke-linecap="round" transform="rotate(-90 50 50)"/>
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
            <button class="footer-text" id="whatDataTrigger" type="button">What data do we know?</button>
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
            <!-- Context Privacy confirm Popup -->
            <div class="data-overlay" id="ctxPrivacyOverlay" style="display:none;">
              <div class="data-modal">
                <div class="data-title">Leaving this site</div>
                <div class="data-body">
                  You’re about to leave this site and open our Privacy Policy in a new tab.
                  Do you want to continue?
                </div>
                <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
                  <button class="data-btn" id="ctxPrivacyCancelBtn">Cancel</button>
                  <button class="data-btn" id="ctxPrivacyContinueBtn">Continue</button>
                </div>
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
                  <div class="data-body">Your request has been received. We'll contact you soon.</div>
                  <button class="data-btn" id="ctxThanksOverlayClose">Close</button>
                </div>
              </div>
              <!-- Context Spam Warning Popup -->
              <div class="data-overlay" id="ctxSpamWarningOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Повторная отправка</div>
                  <div class="data-body">Вы уже отправили заявку, желаете сделать это повторно?</div>
                  <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
                    <button class="data-btn" id="ctxSpamWarningCancelBtn">Отмена</button>
                    <button class="data-btn" id="ctxSpamWarningContinueBtn">Продолжить</button>
                  </div>
                </div>
              </div>
              <!-- Context Spam Block Popup -->
              <div class="data-overlay" id="ctxSpamBlockOverlay" style="display:none;">
                <div class="data-modal">
                  <div class="data-title">Повторная отправка</div>
                  <div class="data-body">Вы уже отправили заявку, и сможете отправить её повторно через <span id="ctxSpamBlockTimer">60</span> секунд.</div>
                  <button class="data-btn" id="ctxSpamBlockCloseBtn">Понятно</button>
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
            <a class="footer-text viral-link-text" id="contextViralLink" href="#">Powered by VIA AI, I want the same widget</a>
            <button class="ctx-send-btn" id="ctxThemeToggleBtn" type="button">Dark mode</button>
            </div>
          </div>

      <!-- Request Screen (v2) -->
      <div class="request-screen hidden" id="requestScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header">
            <button class="header-action header-left" type="button" title="Language">
              <img src="${ASSETS_BASE}${this.getLanguageIconByTheme()}" alt="Language">
            </button>
            <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
            <button class="header-action header-right" type="button" title="Request">
              <img src="${ASSETS_BASE}${this.getContactIconByTheme()}" alt="Request">
            </button>
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
            <a class="footer-text viral-link-text" id="requestViralLink" href="#">Powered by VIA AI, I want the same widget</a>
        </div>
        </div>
      <!-- Request Thanks Popup -->
      <div class="data-overlay" id="requestThanksOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Thank you!</div>
          <div class="data-body">Your request has been received. We'll contact you soon.</div>
          <button class="data-btn" id="requestThanksOverlayClose">Close</button>
        </div>
        </div>
      <!-- Request Spam Warning Popup -->
      <div class="data-overlay" id="requestSpamWarningOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Повторная отправка</div>
          <div class="data-body">Вы уже отправили заявку, желаете сделать это повторно?</div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
            <button class="data-btn" id="requestSpamWarningCancelBtn">Отмена</button>
            <button class="data-btn" id="requestSpamWarningContinueBtn">Продолжить</button>
          </div>
        </div>
      </div>
      <!-- Request Spam Block Popup -->
      <div class="data-overlay" id="requestSpamBlockOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Повторная отправка</div>
          <div class="data-body">Вы уже отправили заявку, и сможете отправить её повторно через <span id="requestSpamBlockTimer">60</span> секунд.</div>
          <button class="data-btn" id="requestSpamBlockCloseBtn">Понятно</button>
        </div>
      </div>
      <!-- Privacy confirm Popup -->
      <div class="data-overlay" id="privacyOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Leaving this site</div>
          <div class="data-body">
            You’re about to leave this site and open our Privacy Policy in a new tab.
            Do you want to continue?
          </div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
            <button class="data-btn" id="privacyCancelBtn">Cancel</button>
            <button class="data-btn" id="privacyContinueBtn">Continue</button>
          </div>
        </div>
      </div>
      </div>

      <!-- Debug Screen (temporary) -->
      <div class="debug-screen hidden" id="debugScreen">
        <div class="voice-widget-container">
          <div class="bg-grid"></div>
          <div class="screen-header">
            <button class="header-action header-left" type="button" title="Language">
              <img src="${ASSETS_BASE}${this.getLanguageIconByTheme()}" alt="Language">
            </button>
            <img src="${ASSETS_BASE}${this.getLogoByTheme()}" alt="VIA.AI" class="header-logo">
            <button class="header-action header-right" type="button" title="Request">
              <img src="${ASSETS_BASE}${this.getContactIconByTheme()}" alt="Request">
            </button>
          </div>
          <div class="debug-main-container">
            <div class="debug-title" id="debugTitle">Debug menu</div>
            <div class="debug-actions">
              <button type="button" class="debug-btn debug-btn--primary" id="debugRefreshBtn">Refresh</button>
              <button type="button" class="debug-btn" id="debugCopyBtn">Copy report</button>
            </div>

            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionInsights">1) AI understanding</div>
              <pre class="debug-section-pre" id="debugInsightsPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionCanonical">2) Canonical patch</div>
              <pre class="debug-section-pre" id="debugCanonicalPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionQuery">3) Effective query</div>
              <pre class="debug-section-pre" id="debugQueryPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionCandidates">4) Candidate pool summary</div>
              <pre class="debug-section-pre" id="debugCandidatesPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionMatch">5) Candidate match breakdown</div>
              <pre class="debug-section-pre" id="debugMatchPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionMeta">6) Last model/API metadata</div>
              <pre class="debug-section-pre" id="debugMetaPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionDialog">7) Last dialog turn</div>
              <pre class="debug-section-pre" id="debugDialogPre">-</pre>
            </section>
            <section class="debug-section">
              <div class="debug-section-title" id="debugSectionRaw">8) Raw JSON</div>
              <pre class="debug-section-pre" id="debugRawPre">-</pre>
            </section>
            <a class="footer-text viral-link-text" id="debugViralLink" href="#">Powered by VIA AI, I want the same widget</a>
          </div>
        </div>
      </div>

      <!-- Cookie/Telemetry Consent Banner -->
      <div class="data-overlay" id="cookieOverlay" style="display:none;">
        <div class="data-modal">
          <div class="data-title">Cookies & telemetry</div>
          <div class="data-body">
            We use cookies and collect usage data to improve the product. No third‑party ads or retargeting. You can change settings anytime.
            <div class="cookie-manage" id="cookieManagePanel" style="margin-top:10px; display:none;">
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccStrict" checked disabled>
                <span>Strictly necessary (always enabled)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccPerformance" checked>
                <span>Performance (timings, errors)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccAnalytics" checked>
                <span>Analytics (anonymous usage)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                <input type="checkbox" id="ccMarketing">
                <span>Marketing (off — not used)</span>
              </label>
            </div>
          </div>
          <div style="display:flex; gap:8px; justify-content:center; margin-top:8px; flex-wrap:wrap;">
            <button class="data-btn" id="cookieAcceptAllBtn">Accept all</button>
            <button class="data-btn" id="cookieRejectAllBtn">Reject all</button>
            <button class="data-btn" id="cookieManageBtn">Manage</button>
            <button class="data-btn" id="cookieSaveBtn" style="display:none;">Save</button>
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
  
  // Mobile-like detection (used for launcher flip UI + to avoid auto-keyboard focus)
  this._vwIsMobileLike = (() => {
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const touch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
      const ua = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      return Boolean(coarse || touch || ua);
    } catch { return false; }
  })();
  this.applyHostModeClasses();
  
  // Launcher "attention" flip animation (mobile only). Stops forever after first widget open.
  const _launcherEl = $("#launcher");
  if (!this._vwLauncherFlipTimers) this._vwLauncherFlipTimers = [];
  const _clearLauncherFlipTimers = () => {
    try { (this._vwLauncherFlipTimers || []).forEach(id => { try { clearTimeout(id); } catch {} }); } catch {}
    this._vwLauncherFlipTimers = [];
  };
  this._vwStopLauncherAttention = () => {
    this._vwLauncherAttentionStopped = true;
    _clearLauncherFlipTimers();
    try { _launcherEl?.classList.remove('vw-launcher-back'); } catch {}
  };
  const _scheduleLauncher = (ms, fn) => {
    try {
      if (this._vwLauncherAttentionStopped) return null;
      const id = window.setTimeout(() => { try { fn?.(); } catch {} }, ms);
      this._vwLauncherFlipTimers.push(id);
      return id;
    } catch { return null; }
  };
  const _flipToBack = () => {
    try {
      if (this._vwLauncherAttentionStopped) return;
      if (this.classList.contains('open')) return;
      _launcherEl?.classList.add('vw-launcher-back');
    } catch {}
  };
  const _flipToFront = () => {
    try {
      if (this._vwLauncherAttentionStopped) return;
      if (this.classList.contains('open')) return;
      _launcherEl?.classList.remove('vw-launcher-back');
    } catch {}
  };
  const _startLauncherAttention = () => {
    try {
      if (!_launcherEl) return;
      if (this._vwLauncherAttentionStopped) return;
      if (this._vwLauncherAttentionStarted) return;
      this._vwLauncherAttentionStarted = true;
      
      const recurring = () => {
        _scheduleLauncher(30000, () => {
          _flipToBack();
          _scheduleLauncher(5000, () => {
            _flipToFront();
            recurring();
          });
        });
      };
      
      // Initial series: 5s -> flip -> 5s -> flip back, then every 30s repeat (flip + 5s + flip back)
      _scheduleLauncher(5000, () => {
        _flipToBack();
        _scheduleLauncher(5000, () => {
          _flipToFront();
          recurring();
        });
      });
    } catch {}
  };
  // Start attention animation on load (mobile only, until first open)
  _startLauncherAttention();

  // Screen management (fresh query each time to avoid stale refs)
  const screenIds = ['mainScreen','dialogScreen','contextScreen','requestScreen','debugScreen'];
  const showScreen = (screenName) => {
    screenIds.forEach(id => this.shadowRoot.getElementById(id)?.classList.add('hidden'));
    const targetId = screenName === 'dialog' ? 'dialogScreen' : screenName === 'main' ? 'mainScreen' : screenName + 'Screen';
    const targetEl = this.shadowRoot.getElementById(targetId) || this.shadowRoot.getElementById('dialogScreen');
    targetEl?.classList.remove('hidden');
    // ensure menu overlay is attached to the active screen header
    try { this.setupMenuOverlay(); } catch {}
  };

  // Outside tap-to-close (no overlay, no page blocking)
  // Important: we do NOT preventDefault / stopPropagation, so the host page remains fully interactive.
  if (!this._onOutsidePointerDown) {
    this._onOutsidePointerDown = (ev) => {
      try {
        if (!this.classList.contains('open')) return;
        const path = (ev && typeof ev.composedPath === 'function') ? ev.composedPath() : [];
        // In Shadow DOM, composedPath includes the host element (`this`) for internal clicks.
        const isInside = Array.isArray(path) ? path.includes(this) : false;
        if (isInside) return;
        if (typeof this.closeWidget === 'function') this.closeWidget();
      } catch {}
    };
  }
  this._enableOutsideClose = () => {
    try {
      if (this._outsideCloseEnabled) return;
      this._outsideCloseEnabled = true;
      // pointerdown is preferred; touchstart/mousedown are fallbacks
      document.addEventListener('pointerdown', this._onOutsidePointerDown, true);
      document.addEventListener('touchstart', this._onOutsidePointerDown, true);
      document.addEventListener('mousedown', this._onOutsidePointerDown, true);
    } catch {}
  };
  this._disableOutsideClose = () => {
    try {
      if (!this._outsideCloseEnabled) return;
      this._outsideCloseEnabled = false;
      document.removeEventListener('pointerdown', this._onOutsidePointerDown, true);
      document.removeEventListener('touchstart', this._onOutsidePointerDown, true);
      document.removeEventListener('mousedown', this._onOutsidePointerDown, true);
    } catch {}
  };

  // Launcher
  let _sessionStarted = false;
  $("#launcher")?.addEventListener("click", () => {
    // Attention flip must stop forever after the first open
    try { this._vwStopLauncherAttention?.(); } catch {}
    this.classList.add("open");
    try { this._enableOutsideClose?.(); } catch {}
    this.showChatScreen();
    try {
      if (!sessionStorage.getItem('vw_greeting_shown')) {
        this.showGreetingMessage();
        sessionStorage.setItem('vw_greeting_shown', '1');
      }
    } catch {}
    
    // Логируем session_start при первом открытии
    if (!_sessionStarted) {
      _sessionStarted = true;
      const consent = this.getConsent();
      logTelemetry(TelemetryEventTypes.SESSION_START, {
        url: window.location.href,
        referrer: document.referrer || null,
        lang: navigator.language || null,
        widgetVersion: '1.0',
        consent: consent ? {
          analytics: consent.selections?.analytics === true,
          performance: consent.selections?.performance === true,
          marketing: consent.selections?.marketing === true
        } : null
      });
    }
    
    // Логируем widget_open
    logTelemetry(TelemetryEventTypes.WIDGET_OPEN);
    // Не фокусируем поле на мобильных, чтобы не вызывать автопоявление клавиатуры
    try {
      if (!this._vwIsMobileLike) {
        this.shadowRoot.getElementById("textInput")?.focus();
      }
    } catch {}
    // Не блокируем прокрутку страницы при открытом виджете
  });

  // --------- Cookie consent logic ---------
  this._CONSENT_VERSION = 1;
  this.getConsent = () => {
    try {
      const raw = localStorage.getItem('vw_cookie_consent');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.v !== this._CONSENT_VERSION) return null;
      return obj;
    } catch { return null; }
  };
  this.setConsent = (selections) => {
    const obj = { v: this._CONSENT_VERSION, ts: Date.now(), selections: { ...selections, strictlyNecessary: true } };
    try { localStorage.setItem('vw_cookie_consent', JSON.stringify(obj)); } catch {}
    try { document.cookie = `vw_consent=v${this._CONSENT_VERSION}; path=/; SameSite=Lax`; } catch {}
    
    // Связываем с телеметрией
    const analytics = selections.analytics === true;
    setTelemetryConsent({ analytics });
    
    // Логируем изменение согласия
    logTelemetry(TelemetryEventTypes.CONSENT_UPDATE, {
      analytics,
      performance: selections.performance === true,
      marketing: selections.marketing === true,
      timestampLocal: new Date().toISOString()
    });
    
    return obj;
  };
  this.maybeShowCookieBanner = () => {
    const consent = this.getConsent();
    const overlay = this.shadowRoot.getElementById('cookieOverlay');
    if (!consent && overlay) overlay.style.display = 'flex';
  };
  // Initialize consent UI handlers
  this.setupCookieBanner = () => {
    const overlay = this.shadowRoot.getElementById('cookieOverlay');
    const manage = this.shadowRoot.getElementById('cookieManagePanel');
    const btnAccept = this.shadowRoot.getElementById('cookieAcceptAllBtn');
    const btnReject = this.shadowRoot.getElementById('cookieRejectAllBtn');
    const btnManage = this.shadowRoot.getElementById('cookieManageBtn');
    const btnSave = this.shadowRoot.getElementById('cookieSaveBtn');
    const ccPerf = this.shadowRoot.getElementById('ccPerformance');
    const ccAnal = this.shadowRoot.getElementById('ccAnalytics');
    const ccMkt = this.shadowRoot.getElementById('ccMarketing');
    btnAccept?.addEventListener('click', () => {
      this.setConsent({ performance: true, analytics: true, marketing: false });
      if (overlay) overlay.style.display = 'none';
    });
    btnReject?.addEventListener('click', () => {
      this.setConsent({ performance: false, analytics: false, marketing: false });
      if (overlay) overlay.style.display = 'none';
    });
    btnManage?.addEventListener('click', () => {
      if (manage && btnSave) { manage.style.display = 'block'; btnSave.style.display = 'inline-block'; }
    });
    btnSave?.addEventListener('click', () => {
      const selections = {
        performance: !!ccPerf?.checked,
        analytics: !!ccAnal?.checked,
        marketing: !!ccMkt?.checked
      };
      this.setConsent(selections);
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupCookieBanner(); } catch {}
  // show on first open of widget
  const _origLauncher = $("#launcher");
  _origLauncher?.addEventListener("click", () => { try { this.maybeShowCookieBanner(); } catch {} }, { once: true });

  // Helper: close widget and restore page scroll
  this.closeWidget = () => {
    this.classList.remove("open");
    try { this._disableOutsideClose?.(); } catch {}
    
    // Логируем widget_close и session_end
    logTelemetry(TelemetryEventTypes.WIDGET_CLOSE);
    
    // Логируем session_end при закрытии виджета
    const messagesCount = this.messages ? this.messages.length : 0;
    const cardsShown = this.shadowRoot.querySelectorAll('.card-slide').length;
    logTelemetry(TelemetryEventTypes.SESSION_END, {
      reason: 'user_close',
      messagesCount,
      cardsShown
    });
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
    } catch {}
  };

  // (legacy header/details and overlay lead panel handlers removed)

  // Утилита для защиты от спама лид-форм
  this.leadSpamProtection = {
    // Получить ключи для sessionStorage
    getKeys: (formType) => ({
      count: `vw_lead_submit_count_${formType}`,
      warningShown: `vw_lead_warning_shown_${formType}`,
      blockedUntil: `vw_lead_blocked_until_${formType}`
    }),
    
    // Получить количество отправок
    getSubmitCount: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return 0;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const count = sessionStorage.getItem(keys.count);
        return count ? parseInt(count, 10) : 0;
      } catch {
        return 0;
      }
    },
    
    // Увеличить счетчик отправок
    incrementSubmitCount: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const current = this.leadSpamProtection.getSubmitCount(formType);
        sessionStorage.setItem(keys.count, String(current + 1));
      } catch {}
    },
    
    // Проверить, был ли показан поп-ап предупреждения
    isWarningShown: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return false;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        return sessionStorage.getItem(keys.warningShown) === 'true';
      } catch {
        return false;
      }
    },
    
    // Отметить, что поп-ап предупреждения был показан
    setWarningShown: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        sessionStorage.setItem(keys.warningShown, 'true');
      } catch {}
    },
    
    // Проверить, заблокирован ли пользователь
    isBlocked: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return false;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const blockedUntil = sessionStorage.getItem(keys.blockedUntil);
        if (!blockedUntil) return false;
        const timestamp = parseInt(blockedUntil, 10);
        return Date.now() < timestamp;
      } catch {
        return false;
      }
    },
    
    // Получить оставшееся время блокировки в секундах
    getBlockedTimeLeft: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return 0;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const blockedUntil = sessionStorage.getItem(keys.blockedUntil);
        if (!blockedUntil) return 0;
        const timestamp = parseInt(blockedUntil, 10);
        const left = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
        return left;
      } catch {
        return 0;
      }
    },
    
    // Установить блокировку на 60 секунд
    setBlocked: (formType) => {
      // TEMP (demo): антиспам для lead-форм отключён
      if (formType === 'lead') return;
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        const blockedUntil = Date.now() + 60000; // 60 секунд
        sessionStorage.setItem(keys.blockedUntil, String(blockedUntil));
      } catch {}
    },
    
    // Сбросить защиту (после успешной отправки после предупреждения)
    reset: (formType) => {
      try {
        const keys = this.leadSpamProtection.getKeys(formType);
        sessionStorage.removeItem(keys.count);
        sessionStorage.removeItem(keys.warningShown);
        sessionStorage.removeItem(keys.blockedUntil);
      } catch {}
    }
  };

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
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toDigits = (v) => String(v || '').replace(/\D+/g, '');
    const isEmail = (v) => emailRe.test(String(v || '').trim());
    // Phone format (demo): country code + 9–10 national digits (operator 3 digits + 6–7 digits).
    const isPhone = (cc, ph) => {
      const ccDigits = toDigits(cc);
      const phDigits = toDigits(ph);
      if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 3) return false;
      if (!phDigits) return false;
      if (phDigits.length < 9 || phDigits.length > 10) return false;
      if (ccDigits.length + phDigits.length > 15) return false;
      return true;
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
        let msg = phoneHas && !phoneOk
          ? 'Invalid phone number. Use 9–10 digits after country code.'
          : 'Invalid email address. Example: name@domain.com';
        showContactError(true, msg);
        if (!phoneOk && phoneHas) shake(get('reqPhone'));
        if (!emailOk && emailHas) shake(get('reqEmail'));
        return;
      }
      if (!consent) { showConsentError(true); shake(root.querySelector('.request-consent')); return; }
      
      // Проверка защиты от спама (общая для обеих форм)
      const formType = 'lead'; // Общий тип для full и short форм
      const submitCount = this.leadSpamProtection.getSubmitCount(formType);
      const isBlocked = this.leadSpamProtection.isBlocked(formType);
      const warningShown = this.leadSpamProtection.isWarningShown(formType);
      
      // Если заблокирован - показываем поп-ап блокировки
      if (isBlocked) {
        const blockOverlay = get('requestSpamBlockOverlay');
        const timerEl = get('requestSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если счетчик уже 2 (после нажатия "Продолжить" во второй раз) - устанавливаем блокировку ПЕРЕД отправкой
      if (submitCount === 2) {
        this.leadSpamProtection.setBlocked(formType);
        const blockOverlay = get('requestSpamBlockOverlay');
        const timerEl = get('requestSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если вторая отправка и предупреждение еще не показывали - показываем поп-ап предупреждения
      if (submitCount === 1 && !warningShown) {
        const warningOverlay = get('requestSpamWarningOverlay');
        if (warningOverlay) {
          warningOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Отправляем данные на бэкенд
      const submitLead = async () => {
        try {
          // Получаем базовый URL API (заменяем /api/audio/upload на /api/leads)
          const leadsApiUrl = this.apiUrl.replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
          
          // Получаем значения формы
          const comment = get('reqComment')?.value?.trim() || null;
          const preferredMethodRaw = get('reqMethod')?.value || 'WhatsApp';
          
          // Нормализуем preferredContactMethod: WhatsApp -> whatsapp, Phone Call -> phone, Email -> email, Telegram -> telegram
          const methodMap = {
            'WhatsApp': 'whatsapp',
            'Phone Call': 'phone',
            'Email': 'email',
            'Telegram': 'telegram'
          };
          // По умолчанию используем whatsapp, если метод не найден в мапе
          const preferredContactMethod = methodMap[preferredMethodRaw] || 'whatsapp';
          
          const language = (this.currentLang || this.defaultLanguage).toLowerCase();
          
          // Формируем данные для отправки
          const leadData = {
            sessionId: this.sessionId || null,
            source: 'widget_full_form',
            name: name,
            phoneCountryCode: code || null,
            phoneNumber: phone || null,
            email: email || null,
            preferredContactMethod: preferredContactMethod,
            comment: comment,
            language: language,
            propertyId: null, // пока не передаём
            consent: true
          };
          
          // Отправляем запрос
          const response = await fetch(leadsApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
          });
          
          const result = await response.json().catch(() => ({ ok: false, error: 'Failed to parse server response' }));
          
          if (result?.ok === true) {
            // Успешно отправлено → показываем thanks popup
            if (thanksOverlay) thanksOverlay.style.display = 'flex';
            // Очищаем форму
            ['reqName','reqCode','reqPhone','reqEmail','reqComment'].forEach(id => { const el = get(id); if (el) el.value=''; });
            if (get('reqConsent')) get('reqConsent').checked = false;
            showContactError(false); showConsentError(false);
            
            // Увеличиваем счетчик отправок
            const submitCount = this.leadSpamProtection.getSubmitCount(formType);
            this.leadSpamProtection.incrementSubmitCount(formType);
            
            // Если это третья отправка (submitCount был 2, стал 3) - устанавливаем блокировку
            if (submitCount === 2) {
              this.leadSpamProtection.setBlocked(formType);
            }
          } else {
            // Ошибка валидации или сервера
            const errorMsg = result.error || 'Failed to submit request. Please try again later.';
            showContactError(true, errorMsg);
            console.error('❌ Lead submission error:', result);
          }
        } catch (err) {
          // Ошибка сети или другая непредвиденная ошибка
          console.error('❌ Lead submission network error:', err);
          showContactError(true, 'Network error. Please check your connection and try again.');
        }
      };
      
      // Вызываем асинхронную функцию отправки (если не показан поп-ап предупреждения)
      if (!(submitCount === 1 && !warningShown)) {
        submitLead();
      }
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
    // Обработчик закрытия поп-апа блокировки
    root.getElementById('requestSpamBlockCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const blockOverlay = root.getElementById('requestSpamBlockOverlay');
      if (blockOverlay) blockOverlay.style.display = 'none';
    });
    // Обработчики поп-апа предупреждения для full form
    const requestWarningOverlay = root.getElementById('requestSpamWarningOverlay');
    const requestWarningCancelBtn = root.getElementById('requestSpamWarningCancelBtn');
    const requestWarningContinueBtn = root.getElementById('requestSpamWarningContinueBtn');
    if (requestWarningCancelBtn) {
      requestWarningCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (requestWarningOverlay) requestWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
      });
    }
    if (requestWarningContinueBtn) {
      requestWarningContinueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (requestWarningOverlay) requestWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
        // Увеличиваем счетчик ДО отправки, чтобы третья попытка сразу показывала блокировку
        this.leadSpamProtection.incrementSubmitCount('lead');
        // Продолжаем отправку после закрытия поп-апа
        // Вызываем обработчик кнопки отправки напрямую
        const sendBtn = root.querySelector('.request-send-btn');
        if (sendBtn) {
          // Эмулируем клик для повторной отправки
          sendBtn.click();
        }
      });
    }
  };
  try { this.setupRequestForm(); } catch {}
 

  // Expose helpers
  this.showScreen = showScreen;
  this.showMainScreen = () => showScreen('main');
  this.showChatScreen = () => showScreen('dialog');
  this.showGreetingMessage = () => {
    try { this.ui?.addMessage?.({ type: 'assistant', content: this.t('assistantGreeting') || '', timestamp: new Date(), greeting: true }); } catch {}
  };
  // (legacy) this.showDetailsScreen was used for v1 Details screen — removed
  
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
  
  // Legacy reset hook kept as no-op for menu close flow compatibility.
  this.resetLegacyMenuState = () => {};

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
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toDigits = (v) => String(v || '').replace(/\D+/g, '');
    const isEmail = (v) => emailRe.test(String(v || '').trim());
    const isPhone = (cc, v) => {
      const ccDigits = toDigits(cc);
      const phDigits = toDigits(v);
      if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 3) return false;
      if (!phDigits) return false;
      if (phDigits.length < 9 || phDigits.length > 10) return false;
      if (ccDigits.length + phDigits.length > 15) return false;
      return true;
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
      const name = get('ctxName')?.value?.trim() || '';
      const code = get('ctxCode')?.value?.trim() || '';
      const phone = get('ctxPhone')?.value?.trim() || '';
      const email = get('ctxEmail')?.value?.trim() || '';
      const consent = !!get('ctxConsent')?.checked;
      
      // Валидация имени
      if (!name || name.length === 0) {
        markError(get('ctxName'), true);
        shake(get('ctxName'));
        showContactError(true, 'Name is required');
        if (!consent) showConsentError(true);
        return;
      }
      
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
        markError(get('ctxName'), false);
        showContactError(false);
      } else {
        markError(get('ctxPhone'), phoneHas && !phoneOk);
        markError(get('ctxEmail'), emailHas && !emailOk);
        let msg = phoneHas && !phoneOk
          ? 'Invalid phone number. Use 9–10 digits after country code.'
          : 'Invalid email address. Example: name@domain.com';
        showContactError(true, msg);
        if (!phoneOk && phoneHas) shake(get('ctxPhone'));
        if (!emailOk && emailHas) shake(get('ctxEmail'));
        return;
      }
      if (!consent) { showConsentError(true); shake(form.querySelector('.ctx-consent')); return; }
      
      // Проверка защиты от спама (общая для обеих форм)
      const formType = 'lead'; // Общий тип для full и short форм
      const submitCount = this.leadSpamProtection.getSubmitCount(formType);
      const isBlocked = this.leadSpamProtection.isBlocked(formType);
      const warningShown = this.leadSpamProtection.isWarningShown(formType);
      
      // Если заблокирован - показываем поп-ап блокировки
      if (isBlocked) {
        const blockOverlay = get('ctxSpamBlockOverlay');
        const timerEl = get('ctxSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если счетчик уже 2 (после нажатия "Продолжить" во второй раз) - устанавливаем блокировку ПЕРЕД отправкой
      if (submitCount === 2) {
        this.leadSpamProtection.setBlocked(formType);
        const blockOverlay = get('ctxSpamBlockOverlay');
        const timerEl = get('ctxSpamBlockTimer');
        if (blockOverlay && timerEl) {
          const updateTimer = () => {
            const left = this.leadSpamProtection.getBlockedTimeLeft(formType);
            if (timerEl) timerEl.textContent = left;
            if (left > 0) {
              setTimeout(updateTimer, 1000);
            } else {
              if (blockOverlay) blockOverlay.style.display = 'none';
            }
          };
          updateTimer();
          blockOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Если вторая отправка и предупреждение еще не показывали - показываем поп-ап предупреждения
      if (submitCount === 1 && !warningShown) {
        const warningOverlay = get('ctxSpamWarningOverlay');
        if (warningOverlay) {
          warningOverlay.style.display = 'flex';
        }
        return;
      }
      
      // Отправляем данные на бэкенд
      const submitShortFormLead = async () => {
        try {
          // Получаем базовый URL API (заменяем /api/audio/upload на /api/leads)
          const leadsApiUrl = this.apiUrl.replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
          
          const language = (this.currentLang || this.defaultLanguage).toLowerCase();
          
          // Формируем данные для отправки (short form не имеет preferredContactMethod и comment)
          const leadData = {
            sessionId: this.sessionId || null,
            source: 'widget_short_form',
            name: name,
            phoneCountryCode: code || null,
            phoneNumber: phone || null,
            email: email || null,
            preferredContactMethod: 'phone', // по умолчанию для short form
            comment: null, // short form не имеет поля комментария
            language: language,
            propertyId: null, // пока не передаём
            consent: true
          };
          
          // Отправляем запрос
          const response = await fetch(leadsApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
          });
          
          const result = await response.json().catch(() => ({ ok: false, error: 'Failed to parse server response' }));
          
          if (result?.ok === true) {
            // Успешно отправлено → показываем thanks popup
            form.style.display = 'none';
            if (thanksOverlay) thanksOverlay.style.display = 'flex';
            // Очищаем поля
            ['ctxName','ctxPhone','ctxEmail'].forEach(id => { const el = this.shadowRoot.getElementById(id); if (el) el.value=''; });
            const c = this.shadowRoot.getElementById('ctxConsent'); if (c) c.checked = false;
            showContactError(false); showConsentError(false);
            
            // Увеличиваем счетчик отправок (если еще не увеличен при нажатии "Продолжить")
            const currentCount = this.leadSpamProtection.getSubmitCount(formType);
            // Увеличиваем только если счетчик еще не был увеличен (не был нажат "Продолжить")
            if (currentCount < 2) {
              this.leadSpamProtection.incrementSubmitCount(formType);
            }
            
            // Телеметрия: логируем успешную отправку short form
            try {
              logTelemetry(TelemetryEventTypes.LEAD_FORM_SUBMIT, {
                formType: 'short',
                sessionId: this.sessionId || null,
                language: language,
                hasComment: false,
                preferredContactMethod: 'phone',
                leadId: result.leadId || null
              });
            } catch (err) {
              console.error('❌ Failed to log LEAD_FORM_SUBMIT:', err);
            }
          } else {
            // Ошибка валидации или сервера
            const errorMsg = result.error || 'Failed to submit request. Please try again later.';
            showContactError(true, errorMsg);
            console.error('❌ Lead submission error:', result);
            
            // Телеметрия: логируем ошибку отправки
            try {
              logTelemetry(TelemetryEventTypes.LEAD_FORM_ERROR, {
                formType: 'short',
                sessionId: this.sessionId || null,
                language: language,
                error: errorMsg
              });
            } catch (err) {
              console.error('❌ Failed to log LEAD_FORM_ERROR:', err);
            }
          }
        } catch (err) {
          // Ошибка сети или другая непредвиденная ошибка
          console.error('❌ Lead submission network error:', err);
          showContactError(true, 'Network error. Please check your connection and try again.');
          
          // Телеметрия: логируем сетевую ошибку
          try {
            logTelemetry(TelemetryEventTypes.LEAD_FORM_ERROR, {
              formType: 'short',
              sessionId: this.sessionId || null,
              language: (this.currentLang || this.defaultLanguage).toLowerCase(),
              error: 'Network error'
            });
          } catch (telemetryErr) {
            console.error('❌ Failed to log LEAD_FORM_ERROR:', telemetryErr);
          }
        }
      };
      
      // Вызываем асинхронную функцию отправки (если не показан поп-ап предупреждения)
      if (!(submitCount === 1 && !warningShown)) {
        submitShortFormLead();
      }
    });
    // Обработчик закрытия поп-апа блокировки для short form
    this.shadowRoot.getElementById('ctxSpamBlockCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const blockOverlay = this.shadowRoot.getElementById('ctxSpamBlockOverlay');
      if (blockOverlay) blockOverlay.style.display = 'none';
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
    // Обработчик закрытия поп-апа блокировки для short form
    this.shadowRoot.getElementById('ctxSpamBlockCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const blockOverlay = this.shadowRoot.getElementById('ctxSpamBlockOverlay');
      if (blockOverlay) blockOverlay.style.display = 'none';
    });
    // Обработчики поп-апа предупреждения для short form
    const ctxWarningOverlay = this.shadowRoot.getElementById('ctxSpamWarningOverlay');
    const ctxWarningCancelBtn = this.shadowRoot.getElementById('ctxSpamWarningCancelBtn');
    const ctxWarningContinueBtn = this.shadowRoot.getElementById('ctxSpamWarningContinueBtn');
    if (ctxWarningCancelBtn) {
      ctxWarningCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (ctxWarningOverlay) ctxWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
      });
    }
    if (ctxWarningContinueBtn) {
      ctxWarningContinueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (ctxWarningOverlay) ctxWarningOverlay.style.display = 'none';
        this.leadSpamProtection.setWarningShown('lead');
        // Увеличиваем счетчик ДО отправки, чтобы третья попытка сразу показывала блокировку
        this.leadSpamProtection.incrementSubmitCount('lead');
        // Продолжаем отправку после закрытия поп-апа
        // Вызываем обработчик кнопки отправки напрямую
        const sendBtn = this.shadowRoot.getElementById('ctxSendBtn');
        if (sendBtn) {
          // Эмулируем клик для повторной отправки
          sendBtn.click();
        }
      });
    }
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
    const trigger = this.shadowRoot.querySelector('#whatDataTrigger');
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

  this.setupViralLinks = () => {
    const links = this.shadowRoot.querySelectorAll('.viral-link-text');
    links.forEach((link) => {
      if (!link) return;
      link.addEventListener('click', (e) => {
        if (String(link.getAttribute('href') || '') === '#') e.preventDefault();
      });
    });
  };
  try { this.setupViralLinks(); } catch {}

  // Request: Privacy Policy confirm
  this.setupPrivacyConfirm = () => {
    const link = this.shadowRoot.querySelector('.request-privacy-link');
    const overlay = this.shadowRoot.getElementById('privacyOverlay');
    const btnCancel = this.shadowRoot.getElementById('privacyCancelBtn');
    const btnContinue = this.shadowRoot.getElementById('privacyContinueBtn');
    const url = 'https://probable-akubra-781.notion.site/Privacy-Policy-2c8be0766f27802fb110cb4ab372771e';
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (overlay) overlay.style.display = 'flex';
      });
    }
    btnCancel?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
    btnContinue?.addEventListener('click', () => {
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { location.href = url; }
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupPrivacyConfirm(); } catch {}
  // Context: Privacy Policy confirm
  this.setupContextPrivacyConfirm = () => {
    const link = this.shadowRoot.querySelector('.ctx-privacy-link');
    const overlay = this.shadowRoot.getElementById('ctxPrivacyOverlay');
    const btnCancel = this.shadowRoot.getElementById('ctxPrivacyCancelBtn');
    const btnContinue = this.shadowRoot.getElementById('ctxPrivacyContinueBtn');
    const url = 'https://probable-akubra-781.notion.site/Privacy-Policy-2c8be0766f27802fb110cb4ab372771e';
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (overlay) overlay.style.display = 'flex';
      });
    }
    btnCancel?.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
    btnContinue?.addEventListener('click', () => {
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { location.href = url; }
      if (overlay) overlay.style.display = 'none';
    });
  };
  try { this.setupContextPrivacyConfirm(); } catch {}
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
          </div>
        </div>
      </div>
    `;
  };


  // Card events
  this.shadowRoot.addEventListener('click', async (e) => {
    if (e.target.closest('.cs-image-nav-btn')) {
      const navBtn = e.target.closest('.cs-image-nav-btn');
      const imageRoot = navBtn ? navBtn.closest('.cs-image') : null;
      if (!imageRoot) return;
      const gallery = Array.isArray(imageRoot.__gallery) ? imageRoot.__gallery : [];
      if (gallery.length < 2) return;
      const delta = navBtn.getAttribute('data-action') === 'image-prev' ? -1 : 1;
      let idx = Number(imageRoot.__index || 0) + delta;
      if (idx < 0) idx = gallery.length - 1;
      if (idx >= gallery.length) idx = 0;
      imageRoot.__index = idx;
      const img = imageRoot.querySelector('.cs-image-media img');
      if (img) {
        img.loading = 'lazy';
        img.src = gallery[idx];
      }
      return;
    } else if (e.target.matches('.card-btn[data-action="like"]')) {
      // UI toggle (фиксируем состояние сердечка). При отключении — без side-effects.
      try {
        e.target.classList.toggle('is-liked');
        if (!e.target.classList.contains('is-liked')) return;
      } catch {}
      const variantId = e.target.getAttribute('data-variant-id');
      
      // Логируем card_like
      const track = this.shadowRoot.querySelector('.cards-slider .cards-track');
      const slides = track ? track.querySelectorAll('.card-slide') : [];
      const currentIndex = Array.from(slides).findIndex(slide => 
        slide.querySelector(`[data-variant-id="${variantId}"]`)
      );
      
      logTelemetry(TelemetryEventTypes.CARD_LIKE, {
        propertyId: variantId,
        index: currentIndex >= 0 ? currentIndex : null,
        totalInSlider: slides.length
      });
      
      this.events.emit('like', { variantId });
    } else if (e.target.closest('[data-action="select"][data-variant-id]')) {
      // Flip: визуальный тест — показываем back сторону карточки
      const selectAction = e.target.closest('[data-action="select"][data-variant-id]');
      const slide = selectAction?.closest('.card-slide');
      if (slide) slide.classList.add('flipped');
      // RMv3 / Sprint 1 / Task 1: фиксируем факт выбора карточки на сервере (server-first)
      const variantId = selectAction?.getAttribute('data-variant-id');
      try {
        if (this.api && variantId) {
          this.api.sendCardInteraction('select', variantId);
        }
      } catch {}
    } else if (e.target.closest('.card-back-header__back-badge')) {
      // Назад с описания на фото (front)
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.remove('flipped');
    } else if (e.target.matches('.btn-open-form') || e.target.closest('.btn-open-form')) {
      // Back -> форма заявки
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.add('card-slide--form-open');
    } else if (e.target.matches('.btn-open-description') || e.target.closest('.btn-open-description')) {
      // Open description modal
      const slide = e.target.closest('.card-slide');
      const modal = slide?.querySelector('.card-desc-modal');
      if (modal) modal.classList.add('is-open');
    } else if (e.target.matches('.card-desc-modal__ok') || e.target.closest('.card-desc-modal__ok')) {
      // Close description modal by OK
      const modal = e.target.closest('.card-desc-modal');
      if (modal) modal.classList.remove('is-open');
    } else if (e.target.matches('.card-desc-modal')) {
      // Close description modal by overlay click
      e.target.classList.remove('is-open');
    } else if (e.target.closest('.card-form-header__back')) {
      // Форма -> назад к описанию
      const slide = e.target.closest('.card-slide');
      if (slide) slide.classList.remove('card-slide--form-open');
    } else if (e.target.matches('.in-dialog-lead__send')) {
      const formRoot = e.target.closest('.in-dialog-lead');
      try { this.submitInDialogLeadForm?.(formRoot); } catch {}
    } else if (e.target.matches('.in-dialog-lead__cancel')) {
      const slide = e.target.closest('.card-slide');
      if (slide) {
        slide.classList.remove('flipped');
      } else {
        try { this.cancelHandoffFlowUI(); } catch {}
        try { this.sendHandoffCancelToServer?.(); } catch {}
      }
    } else if (e.target.matches('.in-dialog-lead__privacy-link')) {
      // UI-only: keep link inert for demo stage (no navigation)
      try { e.preventDefault(); } catch {}
    } else if (e.target.matches('#inDialogThanksCloseBtn')) {
      try {
        const t = this.shadowRoot.getElementById('inDialogLeadThanksBlock');
        if (t && t.parentElement) t.parentElement.removeChild(t);
      } catch {}
    } else if (e.target.matches('#widgetCloseFloating') || e.target.closest('#widgetCloseFloating')) {
      try { this.closeWidget?.(); } catch {}
    } else if (e.target.matches('.menu-link[data-action="back"]') || e.target.closest('.menu-link[data-action="back"]')) {
      e.preventDefault();
      this._headerLangDropdownOpen = false;
      this.showScreen('dialog');
      this.updateMenuUI();
    } else if (e.target.matches('.menu-close-btn') || e.target.closest('.menu-close-btn')) {
      e.preventDefault();
      this._headerLangDropdownOpen = false;
      this.showScreen('dialog');
      this.updateMenuUI();
    } else if (e.target.closest('[data-language-code]')) {
      e.preventDefault();
      const code = String(e.target.closest('[data-language-code]')?.getAttribute('data-language-code') || '').trim();
      if (code) this.setLanguage(code);
      this._headerLangDropdownOpen = false;
      this.updateMenuUI();
    } else if (e.target.closest('.header-action.header-left')) {
      e.preventDefault();
      e.stopPropagation();
      this._headerLangDropdownOpen = !this._headerLangDropdownOpen;
      this.updateMenuUI();
    } else if (e.target.closest('.header-logo')) {
      e.preventDefault();
      const debugScreen = this.shadowRoot.getElementById('debugScreen');
      const isDebug = debugScreen && !debugScreen.classList.contains('hidden');
      this._headerLangDropdownOpen = false;
      this.showScreen(isDebug ? 'dialog' : 'debug');
      if (!isDebug) {
        try { this.refreshDebugMenu(); } catch {}
      }
      this.updateMenuUI();
    } else if (e.target.closest('.header-action.header-right')) {
      e.preventDefault();
      const requestScreen = this.shadowRoot.getElementById('requestScreen');
      const isRequest = requestScreen && !requestScreen.classList.contains('hidden');
      this._headerLangDropdownOpen = false;
      this.showScreen(isRequest ? 'dialog' : 'request');
      this.updateMenuUI();
    } else if (this._headerLangDropdownOpen) {
      const inDropdown = e.target.closest('.header-language-menu');
      const inLangBtn = e.target.closest('.header-action.header-left');
      if (!inDropdown && !inLangBtn) {
        this._headerLangDropdownOpen = false;
        this.updateMenuUI();
      }
    } else if (e.target.matches('#ctxThemeToggleBtn') || e.target.closest('#ctxThemeToggleBtn')) {
      e.preventDefault();
      this.toggleTheme();
      this.updateInterface();
    } else if (e.target.matches('#debugRefreshBtn') || e.target.closest('#debugRefreshBtn')) {
      e.preventDefault();
      try { this.refreshDebugMenu(); } catch {}
    } else if (e.target.matches('#debugCopyBtn') || e.target.closest('#debugCopyBtn')) {
      e.preventDefault();
      try { this.copyDebugReport(); } catch {}
    } else if (e.target.matches('.card-btn[data-action="send_card"]')) {
      // Показать карточку из последнего предложения
      const container = e.target.closest('.card-screen');
      if (container) container.remove();
      // ❗ Начинаем новый показ: удалим старый слайдер (если был)
      try {
        const oldHost = this.shadowRoot.querySelector('.card-screen.cards-slider-host');
        if (oldHost && oldHost.parentElement) {
          // 🆕 Sprint IV: отправляем ui_slider_ended перед удалением slider host (выход из slider-режима)
          if (this.api) {
            try {
              this.api.sendSliderEnded();
            } catch (e) {
              console.warn('Error sending slider ended confirmation:', e);
            }
          }
          oldHost.parentElement.removeChild(oldHost);
        }
      } catch {}
      // Мгновенно покажем карточку локально, чтобы не ждать сети
      try {
        if (this._lastSuggestedCard) {
          this.showMockCardWithActions(this._lastSuggestedCard);
          this.scrollCardHostIntoView();
          
          // Логируем card_show
          const track = this.shadowRoot.querySelector('.cards-slider .cards-track');
          const slides = track ? track.querySelectorAll('.card-slide') : [];
          
          logTelemetry(TelemetryEventTypes.CARD_SHOW, {
            propertyId: this._lastSuggestedCard.id,
            index: 0,
            totalInSlider: slides.length,
            source: 'recommendation'
          });
        }
      } catch {}
      // Попросим у бэкенда динамический комментарий (первый показ)
      try {
        if (this._lastSuggestedCard && this._lastSuggestedCard.id) {
          await this.api.sendCardInteraction('show', this._lastSuggestedCard.id);
        }
      } catch {}
      this.events.emit('send_card');
    } else if (e.target.matches('.card-btn[data-action="continue_dialog"]')) {
      const container = e.target.closest('.card-screen');
      if (container) container.remove();
      this.events.emit('continue_dialog');
    } else if (e.target.closest('.cards-nav-btn')) {
      const navBtn = e.target.closest('.cards-nav-btn');
      if (!navBtn || navBtn.disabled) return;
      const slider = this.shadowRoot.querySelector('.cards-slider');
      if (!slider) return;
      const slides = slider.querySelectorAll('.card-slide');
      if (!slides.length) return;
      const active = slider.querySelector('.card-slide.active') || slides[slides.length - 1];
      const currentIdx = Math.max(0, Array.from(slides).indexOf(active));
      const action = navBtn.getAttribute('data-action');
      if (action === 'slide-prev') {
        const idx = currentIdx - 1;
        if (idx >= 0 && slides[idx]) {
          const left = slides[idx].offsetLeft;
          slider.scrollTo({ left, behavior: 'smooth' });
          try { this.updateActiveCardSlide(); } catch {}
        }
      } else {
        const idx = currentIdx + 1;
        // Queue-aware right navigation:
        // - if next slide already rendered: go to it
        // - otherwise (only at rendered tail): request and append one more card
        if (idx < slides.length && slides[idx]) {
          const left = slides[idx].offsetLeft;
          slider.scrollTo({ left, behavior: 'smooth' });
          try { this.updateActiveCardSlide(); } catch {}
        } else {
          if (this._isGeneratingNext) return;
          const variantId = active?.querySelector('[data-variant-id]')?.getAttribute('data-variant-id');
          if (!variantId) return;
          this._isGeneratingNext = true;
          try { this.updateActiveCardSlide(); } catch {}

          logTelemetry(TelemetryEventTypes.CARD_NEXT, {
            propertyId: variantId,
            index: currentIdx,
            totalInSlider: slides.length,
            source: 'recommendation'
          });

          this.events.emit('next_option', { variantId });
        }
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
      this._pushDebugHistory('extraction_applied', {
        progress: u?.progress ?? null,
        filled: Object.entries(u || {}).filter(([k, v]) => k !== 'progress' && v !== null && v !== undefined && String(v).trim() !== '').map(([k]) => k)
      });
      try { this.refreshDebugMenu(); } catch {}
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
    this.events.on('cardInteractionSent', ({ action }) => {
      this._pushDebugHistory('query_applied', { action: action || 'unknown' });
      if (action === 'next') {
        this._isGeneratingNext = false;
        try { this.updateActiveCardSlide(); } catch {}
      }
      try { this.refreshDebugMenu(); } catch {}
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
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}${this.getStopIconByTheme()}" alt="Stop" />`;
        toggleButton.setAttribute('title', 'Сбросить');
      } else {
        // Show mic icon
        toggleButton.innerHTML = `<img src="${ASSETS_BASE}${this.getMicIconByTheme()}" alt="Microphone" />`;
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
          <div class="cards-host-nav">
            <button type="button" class="cards-nav-btn" data-action="slide-prev" aria-label="Previous slide">&#8592;</button>
            <button type="button" class="cards-nav-btn" data-action="slide-next" aria-label="Next slide">&#8594;</button>
          </div>
      </div>`;
      thread.appendChild(host);
      if (typeof this._isGeneratingNext !== 'boolean') this._isGeneratingNext = false;
      
      // 🆕 Sprint IV: отправляем ui_slider_started при создании slider host (вход в slider-режим)
      if (this.api) {
        requestAnimationFrame(() => {
          try {
            this.api.sendSliderStarted();
          } catch (e) {
            console.warn('Error sending slider started confirmation:', e);
          }
        });
      }
      
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
    const locale = this.getCurrentLocale();
    const langCode = this.getLangCode();
    const specI18n = {
      ru: {
        bedrooms: 'Спальни',
        bathrooms: 'Ванные',
        built_area: 'Площадь дома',
        plot_area: 'Участок',
        terrace: 'Терраса',
        floor: 'Этаж',
        parking: 'Паркинг',
        pool: 'Бассейн',
        year_built: 'Год постройки',
        orientation: 'Ориентация',
        beach: 'Пляж',
        airport: 'Аэропорт',
        golf: 'Гольф',
        amenities: 'Удобства',
        yes: 'Да'
      },
      es: {
        bedrooms: 'Dormitorios',
        bathrooms: 'Baños',
        built_area: 'Área construida',
        plot_area: 'Parcela',
        terrace: 'Terraza',
        floor: 'Planta',
        parking: 'Parking',
        pool: 'Piscina',
        year_built: 'Año',
        orientation: 'Orientación',
        beach: 'Playa',
        airport: 'Aeropuerto',
        golf: 'Golf',
        amenities: 'Servicios',
        yes: 'Sí'
      },
      en: {
        bedrooms: 'Bedrooms',
        bathrooms: 'Bathrooms',
        built_area: 'Built area',
        plot_area: 'Plot area',
        terrace: 'Terrace',
        floor: 'Floor',
        parking: 'Parking',
        pool: 'Pool',
        year_built: 'Year built',
        orientation: 'Orientation',
        beach: 'Beach',
        airport: 'Airport',
        golf: 'Golf',
        amenities: 'Amenities',
        yes: 'Yes'
      }
    };
    const specText = specI18n[langCode] || specI18n.en;
    const formatNumeric = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '';
      const rounded = Math.round(n * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0$/, '');
    };
    const formatDistance = (value, med) => {
      if (value == null || Number(value) <= 0) return null;
      const unit = String(med || '').trim().toLowerCase() || 'm';
      const shown = formatNumeric(value);
      if (!shown) return null;
      if (unit === 'km') return `${shown} km`;
      if (unit === 'min') return `${shown} min`;
      return `${shown} m`;
    };
    const slide = document.createElement('div');
    slide.className = 'card-slide';
    let gallery = Array.isArray(normalized.imageGallery)
      ? normalized.imageGallery.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    if (normalized.image && !gallery.includes(normalized.image)) gallery.unshift(normalized.image);
    const canSwitchImage = gallery.length > 1;
    const coverImage = gallery[0] || normalized.image || '';
    const locationLine = [normalized.city, normalized.province].filter(Boolean).join(' / ');
    const typeStatusLine = [normalized.property_type, normalized.listing_status].filter(Boolean).join('. ');
    const tagBadgesHtml = Array.isArray(normalized.tags) && normalized.tags.length
      ? `<div class="cs-image-tags">${normalized.tags.map((t) => `<button type="button" class="cs-image-tag" tabindex="-1" aria-hidden="true">${t}</button>`).join('')}</div>`
      : '';
    const descriptionText = normalized.descriptionPlain || '-';
    const iconItems = [];
    if (normalized.area_m2 != null) {
      iconItems.push(`<div class="cs-icon-item"><img src="${ASSETS_BASE}house-blue.svg" alt="Area"><span>${normalized.area_m2}m²</span></div>`);
    }
    if (normalized.plot_m2 != null) {
      iconItems.push(`<div class="cs-icon-item"><img src="${ASSETS_BASE}plano-blue.svg" alt="Plot"><span>${normalized.plot_m2}m²</span></div>`);
    }
    if (normalized.rooms && Number(normalized.rooms) > 0) {
      iconItems.push(`<div class="cs-icon-item"><img src="${ASSETS_BASE}bed-blue.svg" alt="Bedrooms"><span>${normalized.rooms}</span></div>`);
    }
    if (normalized.bathrooms && Number(normalized.bathrooms) > 0) {
      iconItems.push(`<div class="cs-icon-item"><img src="${ASSETS_BASE}bath-blue.svg" alt="Bathrooms"><span>${normalized.bathrooms}</span></div>`);
    }
    if (normalized.has_parking === true) {
      iconItems.push(`<div class="cs-icon-item"><img src="${ASSETS_BASE}garaje-blue.svg" alt="Parking"><span class="cs-icon-check">&#10003;</span></div>`);
    }
    if (normalized.has_pool === true) {
      iconItems.push(`<div class="cs-icon-item"><img src="${ASSETS_BASE}pool-blue.svg" alt="Pool"><span class="cs-icon-check">&#10003;</span></div>`);
    }
    const iconsRowHtml = iconItems.length ? `<div class="cs-icons-row">${iconItems.join('')}</div>` : '';
    const featurePrimary = [
      { key: 'bedrooms', label: specText.bedrooms, icon: `${ASSETS_BASE}bed-blue.svg`, value: normalized.roomsNum != null && normalized.roomsNum > 0 ? String(normalized.roomsNum) : null },
      { key: 'bathrooms', label: specText.bathrooms, icon: `${ASSETS_BASE}bath-blue.svg`, value: normalized.bathroomsNum != null && normalized.bathroomsNum > 0 ? String(normalized.bathroomsNum) : null },
      { key: 'built_area', label: specText.built_area, icon: `${ASSETS_BASE}house-blue.svg`, value: normalized.areaNum != null && normalized.areaNum > 0 ? `${normalized.areaNum} m²` : null },
      { key: 'plot_area', label: specText.plot_area, icon: `${ASSETS_BASE}plano-blue.svg`, value: normalized.plotNum != null && normalized.plotNum > 0 ? `${normalized.plotNum} m²` : null },
      { key: 'terrace', label: specText.terrace, icon: `${ASSETS_BASE}plano-blue.svg`, value: normalized.terraceNum != null && normalized.terraceNum > 0 ? `${normalized.terraceNum} m²` : null },
      { key: 'floor', label: specText.floor, icon: `${ASSETS_BASE}floor-blue.svg`, value: normalized.floorNum != null && normalized.floorNum > 0 ? String(normalized.floorNum) : null },
      { key: 'parking', label: specText.parking, icon: `${ASSETS_BASE}garaje-blue.svg`, value: normalized.has_parking === true ? specText.yes : null },
      { key: 'pool', label: specText.pool, icon: `${ASSETS_BASE}pool-blue.svg`, value: normalized.has_pool === true ? specText.yes : null },
      { key: 'year_built', label: specText.year_built, icon: `${ASSETS_BASE}year-blue.svg`, value: normalized.yearBuiltNum != null && normalized.yearBuiltNum > 0 ? String(normalized.yearBuiltNum) : null },
      { key: 'orientation', label: specText.orientation, icon: `${ASSETS_BASE}orientation-blue.svg`, value: normalized.orientationText || null },
      { key: 'distance_beach', label: specText.beach, icon: `${ASSETS_BASE}distance-blue.svg`, value: formatDistance(normalized.distanceBeachNum, normalized.distanceBeachMed) }
    ];
    const featureSecondary = [
      { key: 'distance_airport', label: specText.airport, icon: `${ASSETS_BASE}distance-blue.svg`, value: formatDistance(normalized.distanceAirportNum, normalized.distanceAirportMed) },
      { key: 'distance_golf', label: specText.golf, icon: `${ASSETS_BASE}distance-blue.svg`, value: formatDistance(normalized.distanceGolfNum, normalized.distanceGolfMed) },
      { key: 'distance_amenities', label: specText.amenities, icon: `${ASSETS_BASE}distance-blue.svg`, value: formatDistance(normalized.distanceAmenitiesNum, normalized.distanceAmenitiesMed) }
    ];
    const features = [];
    for (const item of featurePrimary) {
      if (!item.value) continue;
      features.push(item);
      if (features.length >= 10) break;
    }
    if (features.length < 10) {
      for (const item of featureSecondary) {
        if (!item.value) continue;
        features.push(item);
        if (features.length >= 10) break;
      }
    }
    const backSpecsHtml = features.map((item) => `
          <div class="card-back-specs__item" data-feature="${item.key}">
            <img class="card-back-specs__icon" src="${item.icon}" alt="${item.label}">
            <div class="card-back-specs__text">
              <span class="card-back-specs__label">${item.label}</span>
              <span class="card-back-specs__value">${item.value}</span>
            </div>
          </div>`).join('');
    slide.innerHTML = `
      <div class="card-slide-front">
        <div class="cs" data-variant-id="${normalized.id}" data-city="${normalized.city}" data-district="${normalized.province}" data-rooms="${normalized.rooms}" data-price-eur="${normalized.priceEUR}" data-image="${normalized.image}">
          <div class="cs-image">
            <div class="cs-image-nav">
              <button type="button" class="cs-image-nav-btn${canSwitchImage ? '' : ' is-hidden'}" data-action="image-prev" aria-label="Previous image">&#8249;</button>
              <button type="button" class="cs-image-nav-btn${canSwitchImage ? '' : ' is-hidden'}" data-action="image-next" aria-label="Next image">&#8250;</button>
            </div>
            <div class="cs-image-overlay">
              ${tagBadgesHtml}
              <!-- Кнопка «Нравится» временно снята в виду чистки интерфейса (логика не удалена)
              <button class="card-btn like" data-action="like" data-variant-id="${normalized.id}" aria-label="Нравится">
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              -->
            </div>
            <div class="cs-image-media">${coverImage ? `<img src="${coverImage}" alt="${normalized.city} ${normalized.province}" loading="lazy">` : 'Put image here'}</div>
          </div>
          <div class="cs-content">
            <div class="cs-body">
              <div class="cs-row"><div class="cs-title">${locationLine}</div></div>
              <div class="cs-row"><div class="cs-sub">${typeStatusLine}</div></div>
            </div>
            ${iconsRowHtml}
            <div class="card-actions-wrap">
              <div class="card-actions-panel card-actions-panel--split">
                <button class="card-btn select" data-action="select" data-variant-id="${normalized.id}">${locale.cardSelect || 'Выбрать'}</button>
                <button
                  type="button"
                  class="card-price-action"
                  data-action="select"
                  data-variant-id="${normalized.id}"
                  aria-label="${locale.cardSelect || 'Выбрать'}"
                >
                  ${normalized.priceOldLabel ? `<span class="card-price-old">${normalized.priceOldLabel}</span>` : ''}
                  <span class="card-price-current">${normalized.priceLabel || ''}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="card-slide-back">
        <div class="card-slide-back__bg${normalized.image ? '' : ' card-slide-back__bg--fallback'}" aria-hidden="true"></div>
        <div class="card-back-header">
          <button type="button" class="card-back-header__back-badge" aria-label="${locale.cardBack || 'Назад'}">${locale.cardBack || 'Назад'}</button>
          <span class="card-back-header__ref-badge">REF: ${normalized.id || '-'}</span>
        </div>
        <div class="card-back-separator"></div>
        <div class="card-back-specs">${backSpecsHtml}</div>
        <div class="card-back-actions">
          <button type="button" class="btn-open-form">${locale.leaveRequest}</button>
          <button type="button" class="btn-open-description">${locale.cardDescription || 'Описание'}</button>
        </div>
        <div class="card-desc-modal" aria-hidden="true">
          <div class="card-desc-modal__dialog" role="dialog" aria-modal="true" aria-label="${locale.cardDescription || 'Описание'}">
            <div class="card-desc-modal__text">${descriptionText || '-'}</div>
            <div class="card-desc-modal__actions">
              <button type="button" class="card-desc-modal__ok">${locale.cardDescriptionOk || 'OK'}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card-slide-form">
        <div class="card-form-header">
          <button type="button" class="card-form-header__back" aria-label="Back">
            <img src="${ASSETS_BASE}${this.getReturnIconByTheme()}" alt="Back">
          </button>
          <span class="card-form-header__title">${locale.leaveRequest}</span>
          <span class="card-form-header__spacer" aria-hidden="true"></span>
        </div><div class="card-back-separator"></div>
        ${this.getInDialogLeadFormHTML(this.getCurrentLocale(), '_' + normalized.id)}
      </div>`;
    track.appendChild(slide);
    try {
      const imageRoot = slide.querySelector('.cs-image');
      if (imageRoot) {
        imageRoot.__gallery = gallery;
        imageRoot.__index = 0;
      }
    } catch {}
    try {
      const backBg = slide.querySelector('.card-slide-back__bg');
      if (backBg && coverImage) {
        backBg.style.backgroundImage = `url("${coverImage}")`;
      }
    } catch {}
    try { this.bindInDialogLeadForm(slide.querySelector('.card-slide-form .in-dialog-lead'), '_' + normalized.id); } catch {}
    
    // 🆕 Sprint I: отправляем подтверждение факта рендера карточки после визуального показа
    const cardId = normalized.id;
    if (cardId && this.api) {
      // Используем requestAnimationFrame для гарантии, что DOM обновлен и карточка видима
      requestAnimationFrame(() => {
        try {
          this.api.sendCardRendered(cardId);
        } catch (e) {
          console.warn('Failed to send card rendered confirmation:', e);
        }
      });
    }
    
    // scroll to last slide
    requestAnimationFrame(() => {
      // вычисляем целевую позицию именно нового слайда
      const targetLeft = slide.offsetLeft;
      try {
        const slider = this.shadowRoot.querySelector('.cards-slider');
        if (slider) slider.scrollTo({ left: targetLeft, behavior: 'smooth' });
        else track.scrollTo({ left: targetLeft, behavior: 'smooth' });
      } catch { track.scrollTo({ left: targetLeft, behavior: 'smooth' }); }
      // пометим новый слайд активным сразу
      try {
        const slider = this.shadowRoot.querySelector('.cards-slider');
        const allSlides = slider ? slider.querySelectorAll('.card-slide') : [];
        allSlides.forEach(s => s.classList.remove('active'));
        slide.classList.add('active');
      } catch {}
      // прокрутить именно контейнер сообщений до карточки
      try { this.scrollCardHostIntoView(); } catch {}
      try { this.updateActiveCardSlide(); } catch {}
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

  // Прокрутка контейнера сообщений так, чтобы карточка была полностью видна
  scrollCardHostIntoView() {
    try {
      const messages = this.shadowRoot.getElementById('messagesContainer');
      const host = this.shadowRoot.querySelector('.card-screen.cards-slider-host');
      if (!messages || !host) return;
      const bottom = host.offsetTop + host.offsetHeight;
      const viewBottom = messages.scrollTop + messages.clientHeight;
      // если нижняя часть карточки не видна — прокрутим до низа карточки
      if (bottom > viewBottom - 8) {
        const target = Math.max(0, bottom - messages.clientHeight + 8);
        messages.scrollTo({ top: target, behavior: 'smooth' });
      }
    } catch {}
  }

  // (удалено) Генератор короткого комментария под карточкой.
  // Источник подсказки теперь — ответ бэкенда (assistantMessage).

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
    
    // 🆕 Sprint IV: определяем предыдущую активную карточку для сравнения
    const previousActive = slider.querySelector('.card-slide.active');
    const previousCardId = previousActive ? previousActive.querySelector('[data-variant-id]')?.getAttribute('data-variant-id') : null;
    
    slides.forEach(s => s.classList.remove('active'));
    if (closest) closest.classList.add('active');
    
    // 🆕 Sprint IV: отправляем ui_focus_changed только если фокус реально изменился
    if (closest) {
      const currentCardId = closest.querySelector('[data-variant-id]')?.getAttribute('data-variant-id');
      if (currentCardId && currentCardId !== previousCardId && this.api) {
        requestAnimationFrame(() => {
          try {
            this.api.sendFocusChanged(currentCardId);
          } catch (e) {
            console.warn('Error sending focus changed confirmation:', e);
          }
        });
      }
    }
    
    const activeIdx = Array.from(slides).indexOf(closest);
    // update global prev/next slider controls state
    const navHost = this.shadowRoot.querySelector('.cards-host-nav');
    const rows = navHost ? [navHost] : [];
    rows.forEach(row => {
      const prev = row.querySelector('.cards-nav-btn[data-action="slide-prev"]');
      const next = row.querySelector('.cards-nav-btn[data-action="slide-next"]');
      if (prev) prev.disabled = activeIdx <= 0;
      if (next) next.disabled = this._isGeneratingNext === true;
    });
  }

  // ---------- ПРЕДЛОЖЕНИЕ ПОКАЗАТЬ КАРТОЧКУ ----------
  suggestCardOption(data = {}) {
    const thread = this.shadowRoot.getElementById('thread');
    const messages = this.shadowRoot.getElementById('messagesContainer');
    if (!thread || !messages) return;

    this._lastSuggestedCard = data;
    const locale = this.getCurrentLocale();

    const panel = document.createElement('div');
    panel.className = 'card-screen';
    panel.innerHTML = `
      <div class="cs" style="background:transparent; box-shadow:none;">
        <div class="card-actions-wrap">
        <div class="card-actions-panel">
            <button class="card-btn like" data-action="send_card">${locale.cardShow}</button>
            <button class="card-btn next" data-action="continue_dialog">${locale.cardCancel}</button>
          </div>
        </div>
      </div>`;

    thread.appendChild(panel);

    requestAnimationFrame(() => {
      const H = messages.clientHeight;
      messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
    });
  }

  // ---------- RMv3 / Sprint 2 / Task 2.2: Post-handoff block (UI-only) ----------
  // ВАЖНО:
  // - не LLM-сообщение
  // - не отправляет API запросы
  // - клики по кнопкам не делают ничего, кроме стандартного :hover/:active
  renderPostHandoffBlock({ cardId } = {}) {
    try {
      const locale = this.getCurrentLocale();
      const thread = this.shadowRoot.getElementById('thread');
      const messages = this.shadowRoot.getElementById('messagesContainer');
      if (!thread || !messages) return;

      // Ensure single block (replace previous if any)
      try {
        const existing = this.shadowRoot.querySelector('.handoff-block');
        if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
      } catch {}

      const panel = document.createElement('div');
      panel.className = 'card-screen handoff-block';
      panel.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="card-actions-wrap">
            <div class="cs-sub handoff-message">${locale.handoffMessage}</div>
            <div class="card-actions-panel handoff-actions">
              <button class="card-btn select handoff-btn" type="button" data-handoff-action="details">${locale.handoffDetails}</button>
              <button class="card-btn next handoff-btn" type="button" data-handoff-action="cancel">${locale.cancel}</button>
            </div>
          </div>
        </div>`;
      thread.appendChild(panel);

      // keep scroll behavior consistent with other chat inserts
      requestAnimationFrame(() => {
        const H = messages.clientHeight;
        messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
      });
    } catch {}
  }

  // ---------- RMv3: In-dialog lead block (UI-only) ----------
  // ВАЖНО:
  // - новая сущность: in-dialog lead block (не requestScreen/contextScreen)
  // - только UI: нет submit handler, нет fetch, нет валидации/ошибок
  // - demo-only trigger: кликом по “Подробнее” в post-handoff блоке
  cancelHandoffFlowUI() {
    // UI-only: полная отмена handoff в чате
    // - убрать in-dialog lead block (если открыт)
    // - убрать handoff-блок целиком ("Вы выбрали объект…")
    try {
      // cleanup: in-dialog dial outside-click handler (if attached)
      if (this._inDialogLeadDialOutsideHandler) {
        try { document.removeEventListener('click', this._inDialogLeadDialOutsideHandler, true); } catch {}
        this._inDialogLeadDialOutsideHandler = null;
      }
      const lead = this.shadowRoot.getElementById('inDialogLeadBlock');
      if (lead && lead.parentElement) lead.parentElement.removeChild(lead);
    } catch {}
    try {
      const handoff = this.shadowRoot.querySelector('.handoff-block');
      if (handoff && handoff.parentElement) handoff.parentElement.removeChild(handoff);
    } catch {}
  }

  sendHandoffCancelToServer() {
    // Server-first: фиксируем cancel на сервере (cardId не тащим)
    try {
      const sessionId = this.sessionId || '';
      if (!sessionId) return;
      const interactionUrl = String(this.apiUrl || '').replace(/\/upload\/?$/i, '/interaction');
      fetch(interactionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'handoff_cancel', sessionId })
      }).catch(() => {});
    } catch {}
  }

  renderInDialogLeadThanksBlock() {
    // UI-only: отдельная thanks-форма для in-dialog lead form (не ctx/request overlays)
    try {
      const locale = this.getCurrentLocale();
      const thread = this.shadowRoot.getElementById('thread');
      const messages = this.shadowRoot.getElementById('messagesContainer');
      if (!thread || !messages) return;
      // deterministic: single
      const existing = this.shadowRoot.getElementById('inDialogLeadThanksBlock');
      if (existing) return;
      const panel = document.createElement('div');
      panel.className = 'card-screen';
      panel.id = 'inDialogLeadThanksBlock';
      panel.innerHTML = `
        <div class="cs" style="background:transparent; box-shadow:none;">
          <div class="card-actions-wrap">
            <div class="in-dialog-thanks__title">${locale.thanksTitle}</div>
            <div class="in-dialog-thanks__text">${locale.thanksBody}</div>
            <div class="in-dialog-thanks__actions">
              <button class="in-dialog-thanks__close" id="inDialogThanksCloseBtn" type="button">${locale.close}</button>
            </div>
          </div>
        </div>
      `;
      thread.appendChild(panel);
      requestAnimationFrame(() => {
        const H = messages.clientHeight;
        messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
      });
    } catch {}
  }

  submitInDialogLeadForm(formRoot) {
    // formRoot = .in-dialog-lead (from slide back or legacy block); if absent, use getElementById
    try {
      const locale = this.getCurrentLocale();
      const root = this.shadowRoot;
      const el = (baseId) => formRoot ? (formRoot.querySelector(`[id^="${baseId}"]`) || formRoot.querySelector(`#${baseId}`)) : root.getElementById(baseId);
      const nameEl = el('inDialogLeadName') || (formRoot && formRoot.querySelector('input[type="text"]'));
      const phoneEl = el('inDialogLeadPhone') || (formRoot && formRoot.querySelector('input[type="tel"]'));
      const emailEl = el('inDialogLeadEmail') || (formRoot && formRoot.querySelector('input[type="email"]'));
      const consentEl = el('inDialogLeadGdpr') || (formRoot && formRoot.querySelector('.in-dialog-lead__checkbox'));
      const errs = formRoot ? formRoot.querySelectorAll('.in-dialog-lead__error') : [];
      const consentErr = el('inDialogLeadConsentError') || (errs[0] || null);
      const contactErr = el('inDialogLeadContactError') || (errs[1] || null);

      const markError = (el, on) => { if (!el) return; el.classList.toggle('error', !!on); };
      const showErr = (el, on, msg) => {
        if (!el) return;
        if (typeof msg === 'string' && msg.length) el.textContent = msg;
        el.classList.toggle('visible', !!on);
      };
      const shake = (el) => { if (!el) return; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); };

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const toDigits = (v) => String(v || '').replace(/\D+/g, '');
      const isEmail = (v) => emailRe.test(String(v || '').trim());
      // Phone format (demo): country code + 9–10 national digits (operator 3 digits + 6–7 digits).
      // No guessing: only format checks.
      const isPhone = (cc, v) => {
        const ccDigits = toDigits(cc);
        const phDigits = toDigits(v);
        if (!ccDigits || ccDigits.length < 1 || ccDigits.length > 3) return false;
        if (!phDigits) return false;
        if (phDigits.length < 9 || phDigits.length > 10) return false;
        if (ccDigits.length + phDigits.length > 15) return false; // E.164 sanity
        return true;
      };

      const name = nameEl?.value?.trim() || ''; // name optional by spec
      const phone = phoneEl?.value?.trim() || '';
      const email = emailEl?.value?.trim() || '';
      const consent = !!consentEl?.checked;
      const codeEl = el('inDialogLeadCode') || (formRoot && formRoot.querySelector('input[type="hidden"]'));
      const phoneCountryCode = codeEl?.value?.trim() || '+34';

      // Reset previous errors
      markError(phoneEl, false);
      markError(emailEl, false);
      if (consentEl) consentEl.classList.remove('error');
      showErr(contactErr, false);
      showErr(consentErr, false);

      const phoneOk = isPhone(phoneCountryCode, phone);
      const emailOk = isEmail(email);
      const phoneHas = phone.length > 0;
      const emailHas = email.length > 0;
      const contactOk = phoneOk || emailOk;

      // Contact required: phone or email
      if (!phoneHas && !emailHas) {
        markError(phoneEl, true);
        markError(emailEl, true);
        shake(phoneEl); shake(emailEl);
        showErr(contactErr, true, locale.inDialogLeadContactError);
        if (!consent) {
          showErr(consentErr, true, locale.inDialogLeadConsentError);
          if (consentEl) consentEl.classList.add('error');
        }
        return;
      }

      if (!contactOk) {
        markError(phoneEl, phoneHas && !phoneOk);
        markError(emailEl, emailHas && !emailOk);
        const msg = phoneHas && !phoneOk
          ? locale.invalidPhone
          : locale.invalidEmail;
        showErr(contactErr, true, msg);
        if (!phoneOk && phoneHas) shake(phoneEl);
        if (!emailOk && emailHas) shake(emailEl);
        return;
      }

      if (!consent) {
        showErr(consentErr, true, locale.inDialogLeadConsentError);
        if (consentEl) consentEl.classList.add('error');
        shake(consentEl);
        return;
      }

      // Submit to backend (/api/leads), isolated from other forms
      const leadsApiUrl = String(this.apiUrl || '').replace(/\/api\/audio\/upload\/?$/i, '/api/leads');
      const language = (this.currentLang || this.defaultLanguage).toLowerCase();
      const payload = {
        sessionId: this.sessionId || null,
        source: 'widget_in_dialog',
        name: name,
        phoneCountryCode: phoneCountryCode,
        phoneNumber: phone || null,
        email: email || null,
        preferredContactMethod: 'phone',
        comment: null,
        language: language,
        propertyId: null,
        consent: true
      };

      fetch(leadsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(r => r.json().catch(() => ({ ok: false, error: locale.parseError })))
        .then((result) => {
          if (result?.ok === true) {
            const slide = formRoot?.closest('.card-slide');
            if (slide) slide.classList.remove('flipped');
            try { this.cancelHandoffFlowUI(); } catch {}
            try { this.renderInDialogLeadThanksBlock(); } catch {}
          } else {
            const msg = result?.error || locale.submitFailed;
            showErr(contactErr, true, msg);
          }
        })
        .catch(() => {
          showErr(contactErr, true, locale.networkError);
        });
    } catch {}
  }

  // HTML формы in-dialog lead (для слайдера back и legacy handoff)
  getInDialogLeadFormHTML(locale, idSuffix = '') {
    const s = idSuffix;
    return `
        <div class="in-dialog-lead" role="group" aria-label="In-dialog lead block">
          <div class="in-dialog-lead__body">
            <div class="in-dialog-lead__field">
              <label class="in-dialog-lead__label" for="inDialogLeadName${s}">${locale.inDialogLeadNameLabel}</label>
              <input class="in-dialog-lead__input" id="inDialogLeadName${s}" type="text" autocomplete="name" placeholder="${locale.namePlaceholder}">
            </div>
            <div class="in-dialog-lead__field">
              <label class="in-dialog-lead__label" for="inDialogLeadPhone${s}">${locale.inDialogLeadPhoneLabel}</label>
              <div class="in-dialog-lead__phone-row">
                <div class="dial-select">
                  <button class="dial-btn" type="button" id="inDialogLeadDialBtn${s}"><span class="dial-flag">🇪🇸</span><span class="dial-code">+34</span></button>
                  <div class="dial-list" id="inDialogLeadDialList${s}">
                    <div class="dial-item" data-cc="ES" data-code="+34"><span class="dial-flag">🇪🇸</span><span class="dial-code">+34 ES</span></div>
                    <div class="dial-item" data-cc="FR" data-code="+33"><span class="dial-flag">🇫🇷</span><span class="dial-code">+33 FR</span></div>
                    <div class="dial-item" data-cc="DE" data-code="+49"><span class="dial-flag">🇩🇪</span><span class="dial-code">+49 DE</span></div>
                    <div class="dial-item" data-cc="UA" data-code="+380"><span class="dial-flag">🇺🇦</span><span class="dial-code">+380 UA</span></div>
                    <div class="dial-item" data-cc="RU" data-code="+7"><span class="dial-flag">🇷🇺</span><span class="dial-code">+7 RU</span></div>
                    <div class="dial-item" data-cc="PL" data-code="+48"><span class="dial-flag">🇵🇱</span><span class="dial-code">+48 PL</span></div>
                    <div class="dial-item" data-cc="UK" data-code="+44"><span class="dial-flag">🇬🇧</span><span class="dial-code">+44 UK</span></div>
                  </div>
                </div>
                <input class="in-dialog-lead__input" id="inDialogLeadPhone${s}" type="tel" inputmode="tel" autocomplete="tel" placeholder="${locale.requestPhonePlaceholder}">
                <input id="inDialogLeadCode${s}" type="hidden" value="+34" />
              </div>
            </div>
            <div class="in-dialog-lead__field">
              <label class="in-dialog-lead__label" for="inDialogLeadEmail${s}">${locale.inDialogLeadEmailLabel}</label>
              <input class="in-dialog-lead__input" id="inDialogLeadEmail${s}" type="email" autocomplete="email" placeholder="${locale.emailPlaceholder}">
            </div>
            <label class="in-dialog-lead__consent">
              <input class="in-dialog-lead__checkbox" id="inDialogLeadGdpr${s}" type="checkbox">
              <span class="in-dialog-lead__consent-text">
                ${locale.consentText}
                <a class="in-dialog-lead__privacy-link" href="#" aria-label="${locale.privacyPolicy}">${locale.privacyPolicy}</a>
              </span>
            </label>
            <div class="in-dialog-lead__error" id="inDialogLeadConsentError${s}">${locale.inDialogLeadConsentError}</div>
            <div class="in-dialog-lead__error" id="inDialogLeadContactError${s}">${locale.inDialogLeadContactError}</div>
            <div class="in-dialog-lead__actions">
              <button class="in-dialog-lead__send" id="inDialogLeadSendBtn${s}" type="button">${locale.send}</button>
            </div>
          </div>
        </div>`;
  }

  bindInDialogLeadForm(formRoot, idSuffix = '') {
    if (!formRoot) return;
    const s = idSuffix;
    const get = (baseId) => formRoot.querySelector(`#${baseId}${s}`) || formRoot.querySelector(`#${baseId}`);
    const dialBtn = get('inDialogLeadDialBtn');
    const dialList = get('inDialogLeadDialList');
    const codeInput = get('inDialogLeadCode');
    const phoneEl = get('inDialogLeadPhone');
    const emailEl = get('inDialogLeadEmail');
    const consentEl = get('inDialogLeadGdpr');
    const contactErr = get('inDialogLeadContactError');
    const consentErr = get('inDialogLeadConsentError');
    const toggleDial = (show) => { if (dialList) dialList.style.display = show ? 'block' : 'none'; };
    dialBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const visible = dialList && dialList.style.display === 'block';
      toggleDial(!visible);
    });
    dialList?.querySelectorAll('.dial-item').forEach(item => {
      item.addEventListener('click', () => {
        const code = item.getAttribute('data-code') || '+34';
        const flag = item.querySelector('.dial-flag')?.textContent || '🇪🇸';
        if (dialBtn) {
          const codeEl = dialBtn.querySelector('.dial-code');
          const flagEl = dialBtn.querySelector('.dial-flag');
          if (codeEl) codeEl.textContent = code;
          if (flagEl) flagEl.textContent = flag;
        }
        if (codeInput) codeInput.value = code;
        toggleDial(false);
      });
    });
    const clearContactErr = () => {
      try { if (contactErr) contactErr.classList.remove('visible'); } catch {}
      try { if (phoneEl) phoneEl.classList.remove('error'); } catch {}
      try { if (emailEl) emailEl.classList.remove('error'); } catch {}
    };
    const clearConsentErr = () => {
      try { if (consentErr) consentErr.classList.remove('visible'); } catch {}
      try { if (consentEl) consentEl.classList.remove('error'); } catch {}
    };
    phoneEl?.addEventListener('input', () => { clearContactErr(); });
    emailEl?.addEventListener('input', () => { clearContactErr(); });
    consentEl?.addEventListener('change', () => { clearConsentErr(); });
  }

  renderInDialogLeadBlock() {
    // Legacy: форма после handoff-блока — больше не используется (flow: слайдер → Выбрать → back с формой)
    try {
      const locale = this.getCurrentLocale();
      const thread = this.shadowRoot.getElementById('thread');
      const messages = this.shadowRoot.getElementById('messagesContainer');
      if (!thread || !messages) return;
      const existing = this.shadowRoot.getElementById('inDialogLeadBlock');
      if (existing) return;
      const panel = document.createElement('div');
      panel.className = 'in-dialog-lead-block';
      panel.id = 'inDialogLeadBlock';
      panel.innerHTML = this.getInDialogLeadFormHTML(locale, '');
      const handoffBlock = this.shadowRoot.querySelector('.handoff-block');
      if (handoffBlock?.parentElement) handoffBlock.insertAdjacentElement('afterend', panel);
      else return;
      this.bindInDialogLeadForm(panel.querySelector('.in-dialog-lead'), '');
      requestAnimationFrame(() => {
        const H = messages.clientHeight;
        messages.scrollTop = Math.max(0, messages.scrollHeight - Math.floor(H * 0.7));
      });
    } catch {}
  }

  // ---------- НОРМАЛИЗАЦИЯ ДАННЫХ КАРТОЧКИ ----------
  normalizeCardData(raw = {}) {
    const toInt = (v) => {
      if (v == null) return null;
      const n = String(v).replace(/[^0-9]/g, '');
      return n ? parseInt(n, 10) : null;
    };
    const toNumber = (v) => {
      if (v == null) return null;
      const n = Number.parseFloat(String(v).replace(',', '.').replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const toBool = (v) => {
      if (v === true || v === false) return v;
      if (v == null) return false;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    };
    const toLabel = (v) => String(v || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const normalizeTag = (v) => String(v || '').replace(/<[^>]+>/g, ' ').trim().replace(/\s+/g, ' ').toUpperCase();
    const toDistanceUnit = (v) => {
      const s = String(v || '').trim().toLowerCase();
      if (!s) return null;
      if (/(km|kilom)/.test(s)) return 'km';
      if (/(min)/.test(s)) return 'min';
      if (/(mt|mts|metro|metre|meter|\bm\b)/.test(s)) return 'm';
      return null;
    };
    const normalizeOrientation = (v, lang = 'en') => {
      const input = String(v || '').trim();
      if (!input) return '';
      const dict = {
        N: 'N', NORTH: 'N', NORTE: 'N', С: 'N',
        S: 'S', SOUTH: 'S', SUR: 'S', Ю: 'S',
        E: 'E', EAST: 'E', ESTE: 'E', В: 'E',
        W: 'W', O: 'W', WEST: 'W', OESTE: 'W', З: 'W',
        NE: 'NE', NORESTE: 'NE', СВ: 'NE',
        NW: 'NW', NO: 'NW', NOROESTE: 'NW', СЗ: 'NW',
        SE: 'SE', SURESTE: 'SE', ЮВ: 'SE',
        SW: 'SW', SO: 'SW', SUROESTE: 'SW', SUDOESTE: 'SW', ЮЗ: 'SW'
      };
      const labels = {
        en: { N: 'North', S: 'South', E: 'East', W: 'West', NE: 'North East', NW: 'North West', SE: 'South East', SW: 'South West' },
        es: { N: 'Norte', S: 'Sur', E: 'Este', W: 'Oeste', NE: 'Noreste', NW: 'Noroeste', SE: 'Sureste', SW: 'Suroeste' },
        ru: { N: 'Север', S: 'Юг', E: 'Восток', W: 'Запад', NE: 'Северо-восток', NW: 'Северо-запад', SE: 'Юго-восток', SW: 'Юго-запад' }
      };
      const target = labels[lang] || labels.en;
      const tokens = input
        .toUpperCase()
        .replace(/[().]/g, ' ')
        .split(/[\s,;/|-]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const normalized = [];
      for (const token of tokens) {
        const key = dict[token];
        if (key && !normalized.includes(key)) normalized.push(key);
      }
      if (!normalized.length) return toLabel(input);
      return normalized.map((k) => target[k] || k).join(', ');
    };
    const toPlainDescription = (v) => {
      const input = String(v || '').trim();
      if (!input) return '';
      let s = input
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, ' ');

      s = s
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');

      s = s
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
        .join('\n')
        .trim();
      return s;
    };
    const priceNum = toInt(raw.price);
    const roomsNum = toInt(raw.rooms);
    const floorNum = toInt(raw.floor);
    const areaNum = toInt(raw.area_m2);
    const plotNum = toInt(raw.plot_m2);
    const pricePerM2Num = toInt(raw.price_per_m2);
    const bathroomsNum = toInt(raw.bathrooms);
    const terraceNum = toInt(raw.terrace_m2);
    const yearBuiltNum = toInt(raw.year_built);
    const distanceBeachNum = toNumber(raw.distance_beach);
    const distanceAirportNum = toNumber(raw.distance_airport);
    const distanceGolfNum = toNumber(raw.distance_golf);
    const distanceAmenitiesNum = toNumber(raw.distance_amenities);
    const distanceBeachMed = toDistanceUnit(raw.distance_beach_med ?? raw.distanceBeachMed);
    const distanceAirportMed = toDistanceUnit(raw.distance_airport_med ?? raw.distanceAirportMed);
    const distanceGolfMed = toDistanceUnit(raw.distance_golf_med ?? raw.distanceGolfMed);
    const distanceAmenitiesMed = toDistanceUnit(raw.distance_amenities_med ?? raw.distanceAmenitiesMed);
    const city = raw.city || raw.location || '';
    const province = raw.province || raw.district || raw.area || '';
    const neighborhood = raw.neighborhood || raw.neiborhood || raw.neiborhood || '';
    const propertyType = toLabel(raw.property_type);
    const listingStatusRaw = toLabel(raw.listing_status);
    const operationRaw = String(raw.operation || '').trim().toLowerCase();
    const isNewBuild = toBool(raw.is_new_build);
    const listingStatus = listingStatusRaw || (operationRaw === 'rent' ? 'RENT' : (isNewBuild ? 'NEW BUILD' : 'RESALE'));
    const image = raw.image || raw.imageUrl || '';
    const readList = (src) => {
      if (Array.isArray(src)) return src;
      if (typeof src === 'string') {
        const trimmed = src.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [];
          } catch {}
        }
        return trimmed.split(',').map(v => v.trim()).filter(Boolean);
      }
      return [];
    };
    const assetPool = [
      ...readList(raw.images),
      ...readList(raw.assets),
      ...readList(raw.gallery),
      ...readList(raw.photos)
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);
    if (image && !assetPool.includes(image)) assetPool.unshift(image);
    const imageGallery = assetPool;
    const coverImage = image || imageGallery[0] || '';
    const rawTags = Array.isArray(raw.tags)
      ? raw.tags
      : (typeof raw.tags === 'string'
          ? raw.tags.split(',').map((v) => v.trim()).filter(Boolean)
          : []);
    const tags = Array.from(new Set(rawTags.map(normalizeTag).filter(Boolean))).slice(0, 4);
    const orientationText = normalizeOrientation(raw.orientation || '', this.getLangCode());

    const priceOldNum = toInt(raw.price_old ?? raw.priceOld ?? raw.old_price ?? raw.oldPrice);
    const priceLabel = raw.price || (priceNum != null ? `${priceNum} €` : (raw.priceLabel || ''));
    const priceOldLabel = raw.price_old || raw.priceOld || raw.old_price || raw.oldPrice || (priceOldNum != null ? `${priceOldNum} €` : '');
    const roomsLabel = roomsNum != null ? `${roomsNum} rooms` : (raw.rooms || '');
    const floorLabel = floorNum != null ? `${floorNum} floor` : (raw.floor || '');

    return {
      id: raw.id || '',
      image: coverImage,
      imageGallery,
      city,
      province,
      neighborhood,
      property_type: propertyType ? propertyType.toUpperCase() : '',
      listing_status: listingStatus ? listingStatus.toUpperCase() : '',
      description: raw.description || '',
      descriptionPlain: toPlainDescription(raw.description || ''),
      rooms: roomsNum != null ? String(roomsNum) : (raw.rooms || ''),
      roomsLabel,
      floor: floorNum != null ? String(floorNum) : (raw.floor || ''),
      floorLabel,
      roomsNum,
      floorNum,
      areaNum,
      plotNum,
      bathroomsNum,
      terraceNum,
      yearBuiltNum,
      distanceBeachNum,
      distanceBeachMed,
      distanceAirportNum,
      distanceAirportMed,
      distanceGolfNum,
      distanceGolfMed,
      distanceAmenitiesNum,
      distanceAmenitiesMed,
      orientationText,
      area_m2: areaNum != null ? areaNum : (raw.area_m2 ?? null),
      plot_m2: plotNum != null ? plotNum : (raw.plot_m2 ?? null),
      price_per_m2: pricePerM2Num != null ? pricePerM2Num : (raw.price_per_m2 ?? null),
      bathrooms: bathroomsNum != null ? String(bathroomsNum) : (raw.bathrooms ?? null),
      has_parking: toBool(raw.has_parking),
      has_pool: toBool(raw.has_pool),
      tags,
      priceEUR: priceNum != null ? priceNum : null,
      priceOldEUR: priceOldNum != null ? priceOldNum : null,
      priceOldLabel,
      priceLabel
    };
  }

  // ---------- УТИЛИТЫ ----------
  getLangCode() {
    const code = String(this.currentLang || this.defaultLanguage || 'EN').trim().toLowerCase().slice(0, 2);
    return ['en', 'es', 'ru'].includes(code) ? code : 'en';
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

    this.showChatScreen();
    this.showGreetingMessage();

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

  _pushDebugHistory(event, payload = {}) {
    this.debugMenu?.pushHistory?.(event, payload);
  }

  storeLastApiPayload(payload, meta = {}) {
    this.debugMenu?.storeLastApiPayload?.(payload, meta);
  }

  buildDebugCanonicalPatch(insights = {}) {
    return this.debugMenu?.buildCanonicalPatch?.(insights || {}) || {};
  }

  getDebugEffectiveSearchParams(insights = {}) {
    return this.debugMenu?.getEffectiveSearchParams?.(insights || {}) || {};
  }

  async copyDebugReport() {
    return this.debugMenu?.copyReport?.();
  }

  refreshDebugMenu() {
    return this.debugMenu?.refresh?.();
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
    try { this._disableOutsideClose?.(); } catch {}
    try { this._vwStopLauncherAttention?.(); } catch {}
    // Safety: if an older build locked the page and didn't restore, try to restore only if we know we locked it.
    try {
      if (this._scrollLockedMobile) {
        const de = document.documentElement;
        const b = document.body;
        de.style.overflow = this._prevPageOverflowDoc || '';
        b.style.overflow = this._prevPageOverflowBody || '';
        b.style.touchAction = this._prevPageTouchAction || '';
        this._scrollLockedMobile = false;
      }
    } catch {}
    console.log('👋 Voice Widget disconnected and cleaned up');
  }

  // ===== Header controls (language, insights, request) =====
  setupMenuOverlay() {
    // legacy menu overlay intentionally disabled
    try {
      this.shadowRoot.querySelectorAll('.menu-overlay').forEach((el) => el.remove());
    } catch {}
    this.updateMenuUI();
  }

  updateMenuUI() {
    const dialogScreen = this.shadowRoot.getElementById('dialogScreen');
    const contextScreen = this.shadowRoot.getElementById('contextScreen');
    const requestScreen = this.shadowRoot.getElementById('requestScreen');
    const debugScreen = this.shadowRoot.getElementById('debugScreen');
    const isContext = !!(contextScreen && !contextScreen.classList.contains('hidden'));
    const isRequest = !!(requestScreen && !requestScreen.classList.contains('hidden'));
    const isDebug = !!(debugScreen && !debugScreen.classList.contains('hidden'));
    const isDialog = !!(dialogScreen && !dialogScreen.classList.contains('hidden'));
    const activeHeader = this.shadowRoot.querySelector(
      (isContext
        ? '#contextScreen .screen-header'
        : isRequest
        ? '#requestScreen .screen-header'
        : isDebug
        ? '#debugScreen .screen-header'
        : '.dialog-screen:not(.hidden) .screen-header')
    );
    if (!activeHeader) return;

    const locale = this.getCurrentLocale();
    const languageCodes = ['RU', 'EN', 'ES'];
    const languageFlags = { RU: '🇷🇺', EN: '🇬🇧', ES: '🇪🇸' };
    if (!this._menuLanguageCode || !languageFlags[this._menuLanguageCode]) this._menuLanguageCode = this.currentLang || this.defaultLanguage;
    if (typeof this._headerLangDropdownOpen !== 'boolean') this._headerLangDropdownOpen = false;

    const leftBtn = activeHeader.querySelector('.header-action.header-left');
    const rightBtn = activeHeader.querySelector('.header-action.header-right');
    const logo = activeHeader.querySelector('.header-logo');
    const leftImg = leftBtn?.querySelector('img');
    const rightImg = rightBtn?.querySelector('img');
    const logoImg = logo?.tagName === 'IMG' ? logo : logo?.querySelector('img');
    if (leftImg) leftImg.setAttribute('src', `${ASSETS_BASE}${this.getLanguageIconByTheme()}`);
    if (rightImg) rightImg.setAttribute('src', `${ASSETS_BASE}${this.getContactIconByTheme()}`);
    if (logoImg) logoImg.setAttribute('src', `${ASSETS_BASE}${this.getLogoByTheme()}`);
    if (leftBtn) leftBtn.setAttribute('title', locale.menuLanguage);
    if (rightBtn) rightBtn.setAttribute('title', locale.menuRequest);
    if (logo) logo.setAttribute('title', locale.menuSelectedDebug || locale.menuInsights);

    // Internal screens: show selected-state header overlay (back + close + badge)
    if (isContext || isRequest || isDebug) {
      this._headerLangDropdownOpen = false;
      activeHeader.classList.add('menu-opened');
      this.shadowRoot.querySelectorAll('.header-language-menu').forEach((el) => el.remove());
      let overlay = activeHeader.querySelector('.menu-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'menu-overlay open';
        activeHeader.appendChild(overlay);
      } else {
        overlay.classList.add('open');
      }
      const badgeText = isRequest
        ? locale.menuSelectedRequest
        : isDebug
        ? locale.menuSelectedDebug
        : locale.menuSelectedContext;
      const badgeClass = isRequest ? 'menu-badge--request' : 'menu-badge--context';
      overlay.innerHTML = `
        <div class="menu-overlay-content">
          <div class="menu-grid menu-grid--selected">
            <div class="menu-col menu-col--single">
              <button class="menu-link" data-action="back">${locale.menuBackToDialog}</button>
            </div>
            <div class="menu-col menu-col--single menu-col--middle" style="justify-content:center;">
              <button class="menu-close-btn" aria-label="Close menu"><img src="${ASSETS_BASE}menu_close_btn.svg" alt="Close"></button>
            </div>
            <div class="menu-col menu-col--single">
              <div class="menu-badge ${badgeClass}">${badgeText || ''}</div>
            </div>
          </div>
        </div>`;
    } else if (isDialog) {
      activeHeader.classList.remove('menu-opened');
      activeHeader.querySelectorAll('.menu-overlay').forEach((el) => el.remove());
    }

    if (!isDialog) {
      const ctxThemeBtn = this.shadowRoot.getElementById('ctxThemeToggleBtn');
      if (ctxThemeBtn) ctxThemeBtn.textContent = this.getTheme() === 'light' ? locale.menuThemeToDark : locale.menuThemeToLight;
      return;
    }

    let langMenu = activeHeader.querySelector('.header-language-menu');
    if (!langMenu) {
      langMenu = document.createElement('div');
      langMenu.className = 'header-language-menu';
      activeHeader.appendChild(langMenu);
    }
    langMenu.classList.toggle('open', !!this._headerLangDropdownOpen);
    langMenu.innerHTML = `
      <div class="menu-language-dropdown ${this._headerLangDropdownOpen ? 'open' : ''}">
        ${languageCodes.map((code) => `<button class="menu-language-option ${this._menuLanguageCode === code ? 'is-active' : ''}" type="button" data-language-code="${code}">${languageFlags[code]} ${code}</button>`).join('')}
      </div>
    `;

    const ctxThemeBtn = this.shadowRoot.getElementById('ctxThemeToggleBtn');
    if (ctxThemeBtn) ctxThemeBtn.textContent = this.getTheme() === 'light' ? locale.menuThemeToDark : locale.menuThemeToLight;
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
