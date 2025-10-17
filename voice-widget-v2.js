/**
 * Voice Widget v2 - Новая версия виджета
 * Shadow DOM + изолированные стили
 * Мультиэкранная структура для тестирования верстки
 */

class VoiceWidgetV2 extends HTMLElement {
    constructor() {
        super();
        
        // Создаем Shadow DOM
        this.attachShadow({ mode: 'open' });
        
        // Текущий экран (для ручного переключения)
        // Доступные экраны: 'start', 'dialog', 'context', 'request', 'support'
        this.currentScreen = 'request'; // ← ИЗМЕНИТЕ ЗДЕСЬ для переключения экранов
        this.screens = ['start', 'dialog', 'context', 'request', 'support'];
        this.menuState = 'closed'; // 'closed' | 'open' | 'selected'
        this.selectedMenu = null;   // 'context' | 'support' | 'request' | null
        
        // Рендерим начальную структуру
        this.render();
    }
    
    // Публичные методы навигации по экранам (временная утилита для предпросмотра)
    setScreen(screen) {
        if (this.screens.includes(screen)) {
            this.currentScreen = screen;
            this.render();
        }
    }
    nextScreen() {
        const idx = this.screens.indexOf(this.currentScreen);
        const next = (idx + 1) % this.screens.length;
        this.currentScreen = this.screens[next];
        this.render();
    }
    prevScreen() {
        const idx = this.screens.indexOf(this.currentScreen);
        const prev = (idx - 1 + this.screens.length) % this.screens.length;
        this.currentScreen = this.screens[prev];
        this.render();
    }
    
    // Маршрутизатор экранов
    getScreenTemplate() {
        switch(this.currentScreen) {
            case 'start':
                return this.renderStartScreen();
            case 'dialog':
                return this.renderDialogScreen();
            case 'context':
                return this.renderContextScreen();
            case 'request':
                return this.renderRequestScreen();
            case 'support':
                return this.renderSupportScreen();
            default:
                return this.renderStartScreen();
        }
    }
    
    // Рендер стартового экрана
    renderStartScreen() {
        return `
            <div class="voice-widget-container">
                <!-- Логотип -->
                <img src="./assets/LOGO.svg" alt="VIA.AI" class="logo">
                
                <!-- Декоративная линия -->
                <div class="gradient-line"></div>
                
                <!-- Кнопка микрофона -->
                <div class="mic-button">
                    <img src="./assets/MicBig.png" alt="Microphone" style="width: 100%; height: 100%;">
                </div>
                
                <!-- Тексты под кнопкой -->
                <div class="text-container">
                    <p class="main-text">Press to speak</p>
                    <p class="sub-text">Voice Intelligent Assistance</p>
                </div>
                
                <!-- Поле ввода -->
                <div class="input-container">
                    <input type="text" class="input-field" placeholder="Write your request...">
                    <div class="input-buttons">
                        <button class="input-btn" type="button">
                            <img src="./assets/mic_btn.svg" alt="Microphone">
                        </button>
                        <button class="input-btn" type="button">
                            <img src="./assets/stop_btn.svg" alt="Stop">
                        </button>
                        <button class="input-btn" type="button">
                            <img src="./assets/send_btn.svg" alt="Send">
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Рендер экрана диалога
    renderDialogScreen() {
        return `
            <div class="voice-widget-container">
                <!-- Кнопка меню -->
                <div class="menu-button">
                    <img src="./assets/menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
                </div>
                
                <!-- Контейнер диалога -->
                <div class="dialogue-container">
                    <!-- Пузырь виджета -->
                    <div class="message-bubble widget-bubble">
                        Нажмите кнопку записи чтобы начать
                    </div>
                    
                    <!-- Пузырь пользователя -->
                    <div class="message-bubble user-bubble">
                        Так же как и расстояние до низа виджета равна 30px Ну и на последок — шрифты в правой колонке в блоках с информацией равны 10рх
                    </div>
                    
                    <!-- Пузырь виджета -->
                    <div class="message-bubble widget-bubble">
                        Понял, учту все параметры для верстки
                    </div>
                </div>
                
                <!-- Поле ввода (как в Start Screen) -->
                <div class="input-container">
                    <input type="text" class="input-field" placeholder="Write your request...">
                    <div class="input-buttons">
                        <button class="input-btn" type="button">
                            <img src="./assets/mic_btn.svg" alt="Microphone">
                        </button>
                        <button class="input-btn" type="button">
                            <img src="./assets/stop_btn.svg" alt="Stop">
                        </button>
                        <button class="input-btn" type="button">
                            <img src="./assets/send_btn.svg" alt="Send">
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Рендер экрана контекста
    renderContextScreen() {
        return `
            <div class="voice-widget-container">
                <!-- Кнопка меню (как в Dialog Screen) -->
                <div class="menu-button">
                    <img src="./assets/menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
                </div>
                
                <!-- Основной контейнер для всех элементов -->
                <div class="context-main-container">
                    <!-- Круговой прогресс-индикатор с сеткой -->
                    <div class="progress-grid-container">
                        <!-- Левая колонка (пустая) -->
                        <div class="grid-column-left"></div>
                        
                        <!-- Центральная колонка (прогресс-индикатор) -->
                        <div class="grid-column-center">
                            <div class="progress-ring">
                                <svg width="100" height="100" viewBox="0 0 100 100">
                                    <!-- Подложка кольца -->
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255, 255, 255, 0.1)" stroke-width="12"/>
                                    <!-- Активная дуга (99%) -->
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="#E85F62" stroke-width="12" 
                                            stroke-dasharray="276.46" stroke-dashoffset="2.76" 
                                            stroke-linecap="round" transform="rotate(-90 50 50)"/>
                                </svg>
                                <div class="progress-text">99%</div>
                            </div>
                        </div>
                        
                        <!-- Правая колонка (текст) -->
                        <div class="grid-column-right">
                            <div class="data-storage-text">Data storage & encrypting</div>
                        </div>
                    </div>
                    
                    <!-- Статус -->
                    <div class="status-text">Status: fulfilled</div>
                    
                    <!-- Основной текст -->
                    <div class="main-message">
                        Well done! You've fulfilled the system with the data that will make search much closer to your goal!
                    </div>
                    
                    <!-- Декоративная линия ContextScreen -->
                    <div class="context-gradient-line"></div>
                    
                    <!-- Подсказка -->
                    <div class="hint-text">
                        You can leave the request to make manager start working by your case immediately
                    </div>
                    
                    <!-- Кнопка Leave request -->
                    <div class="context-leave-request-button">
                        <button class="context-leave-request-btn">Leave request</button>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer-text">What data do we know?</div>
            </div>
        `;
    }
    
    // Рендер экрана запроса
    renderRequestScreen() {
        return `
            <div class="voice-widget-container">
                <!-- Меню -->
                <div class="menu-button">
                    <img src="./assets/menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
                </div>

                <!-- Основной контейнер формы (25px поля) -->
                <div class="request-main-container">
                        <!-- Заголовок -->
                        <div class="request-title">Leave a request</div>

                        <!-- Name -->
                        <div class="request-field">
                            <div class="request-field-label">Name</div>
                            <input class="request-input" type="text" placeholder="Your name" />
                        </div>

                        <!-- Contact -->
                        <div class="request-field">
                            <div class="request-field-label">Contact (phone/ WhatsApp/ e-mail)</div>
                            <div class="request-row">
                                <input class="request-input request-code-input" type="text" placeholder="+34" />
                                <input class="request-input request-phone-input" type="text" placeholder="1234567" />
                            </div>
                            <input class="request-input" type="email" placeholder="yourmail@gmail.com" />
                        </div>

                        <!-- Preferred contact method -->
                        <div class="request-field">
                            <div class="request-field-label">Preferred contact method</div>
                            <div class="request-select">
                                <span>WhatsApp</span>
                                <span class="request-caret">▾</span>
                            </div>
                        </div>

                        <!-- Convenient time -->
                        <div class="request-field">
                            <div class="request-field-label">Convenient time</div>
                            <div class="request-select">
                                <span>Today 13–15 (Fri, 17/10)</span>
                                <span class="request-caret">▾</span>
                            </div>
                        </div>

                        <!-- Comment -->
                        <div class="request-field">
                            <div class="request-field-label">Comment (optional)</div>
                            <textarea class="request-textarea" placeholder="Short note"></textarea>
                        </div>
                        <!-- Контейнер согласия и кнопок (доп. внутренние отступы по 5px) -->
                        <div class="request-actions-container">
                            <div class="request-consent">
                                <input class="request-checkbox" type="checkbox" />
                                <div class="request-consent-text">
                                    I consent to the processing of my data for managing this request and contacting me about properties. <a class="request-privacy-link" href="#">Privacy Policy</a>
                                </div>
                            </div>

                            <div class="request-buttons">
                                <button class="request-send-btn">Send</button>
                                <button class="request-cancel-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Рендер экрана поддержки
    renderSupportScreen() {
        return `
            <div class="voice-widget-container">
                <!-- Кнопка меню (как на других экранах) -->
                <div class="menu-button">
                    <img src="./assets/menu_icon.svg" alt="Menu" style="width: 40px; height: 40px;">
                </div>

                <!-- Основной контейнер контента экрана поддержки -->
                <div class="support-main-container">
                    <!-- Заголовок FAQ -->
                    <div class="support-faq-title">FAQ</div>

                    <!-- Список вопросов/ответов (раскрыты по умолчанию) -->
                    <div class="support-faq-list">
                        <div class="support-faq-item">
                            <div class="support-faq-question">Where is my data stored?</div>
                            <div class="support-faq-answer">Your data is safely encrypted and stored on our secure EU servers.</div>
                        </div>

                        <div class="support-faq-item">
                            <div class="support-faq-question">How can I delete my information?</div>
                            <div class="support-faq-answer">Just send us a short message — we’ll remove your data immediately.</div>
                        </div>

                        <div class="support-faq-item">
                            <div class="support-faq-question">Why can’t I send my request?</div>
                            <div class="support-faq-answer">Check your internet connection or try again in a few minutes.</div>
                        </div>

                        <div class="support-faq-item">
                            <div class="support-faq-question">How can I be sure my info is safe?</div>
                            <div class="support-faq-answer">We never share or sell your data. You can review our Privacy Policy anytime.</div>
                        </div>
                    </div>

                    <!-- Декоративная линия -->
                    <div class="support-gradient-line"></div>

                    <!-- Подсказка -->
                    <div class="support-hint-text">Got questions or something doesn’t work as expected? We’re here to help you resolve it quickly.</div>

                    <!-- Кнопка Contact Support -->
                    <div class="support-contact-button">
                        <button class="support-contact-btn">Contact Support</button>
                    </div>
                </div>

                <!-- Футер -->
                <div class="support-footer-text">Want to talk with a human</div>
            </div>
        `;
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
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
                }
                
                .input-btn:hover {
                    opacity: 0.7;
                }
                
                .input-btn svg {
                    width: 24px;
                    height: 24px;
                    fill: #FFFFFF;
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
                
                .message-bubble {
                    border-radius: 10px;
                    padding: 10px;
                    margin-bottom: 16px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                    max-width: calc(100% - 50px);
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
                    top: 110px; /* от верхней части виджета */
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% - 50px); /* по 25px отступы слева/справа */
                }

                .support-faq-title {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px; /* Regular */
                    font-weight: 400;
                    color: #EDCF23;
                    text-align: left;
                }

                .support-faq-list {
                    margin-top: 15px; /* отступ от FAQ */
                }

                .support-faq-item {
                    margin-bottom: 20px; /* отступ между вопросами */
                }

                .support-faq-question {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px; /* Regular */
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
                    font-size: 13px; /* Light */
                    font-weight: 300;
                    color: #C3C3C3;
                }

                .support-gradient-line {
                    width: 100%;
                    height: 2px;
                    border-radius: 1px;
                    background: linear-gradient(90deg, rgba(90, 127, 227, 0.1) 0%, rgba(148, 51, 50, 1) 50%, rgba(85, 122, 219, 0.1) 100%);
                    margin: 0 auto 10px auto; /* внутри контейнера, снизу 10px */
                }

                .support-hint-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px; /* Thin */
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
                    margin-top: 25px; /* отбивается от верхнего блока */
                    background: #EDCF23;
                    border: none;
                    border-radius: 20px;
                    color: #3B3B3B;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px; /* Regular */
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
                    top: 110px; /* от верхней части виджета */
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% - 50px); /* по 25px слева/справа */
                }

                .request-title {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px; /* Regular */
                    font-weight: 400;
                    color: #FFFFFF;
                    margin-bottom: 15px; /* от заголовка к первому подзаголовку */
                    text-align: left;
                }

                .request-field {
                    margin-bottom: 20px; /* от input к следующему подзаголовку */
                }

                .request-field-label {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px; /* Semibold */
                    font-weight: 600;
                    color: #FFFFFF;
                    margin-bottom: 5px; /* от подзаголовка к input */
                }

                .request-input {
                    width: 100%;
                    height: 35px;
                    border-radius: 10px;
                    background: rgba(106, 108, 155, 0.10);
                    border: 1px solid rgba(106, 108, 155, 0.30);
                    color: #FFFFFF;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 12px; /* Regular */
                    font-weight: 400;
                    padding-left: 10px; /* отступ плейсхолдера слева */
                    line-height: 35px; /* вертикальная центровка текста */
                    box-sizing: border-box;
                }

                .request-input::placeholder {
                    color: #A0A0A0;
                }

                .request-row {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px; /* небольшой отступ между строкой телефона и email */
                }

                .request-code-input {
                    width: 100px; /* поле кода страны */
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
                    padding: 10px; /* слева 10px как у input */
                    resize: vertical;
                    box-sizing: border-box;
                }

                .request-textarea::placeholder {
                    color: #A0A0A0;
                }

                .request-actions-container {
                    width: 100%;
                    padding: 0 5px; /* доп. 5px слева/справа поверх 25px у контейнера */
                    box-sizing: border-box;
                }

                .request-consent {
                    display: flex;
                    align-items: flex-start;
                }

                .request-checkbox {
                    width: 12px;
                    height: 12px;
                    margin-right: 10px; /* отступ от чекбокса до текста */
                }

                .request-consent-text {
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 10px; /* Regular */
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
                    gap: 20px; /* расстояние между кнопками */
                    margin-top: 20px; /* отступ сверху для блока кнопок */
                }

                .request-send-btn,
                .request-cancel-btn {
                    width: 150px;
                    height: 40px;
                    border-radius: 10px;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 15px; /* Regular */
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
                    align-items: center; /* центр по вертикали */
                    justify-content: center; /* центр по горизонтали */
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
                    opacity: 0.1; /* фон проявляется с 0.1 */
                }
                /* Контентная область меню внутри overlay */
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
                    z-index: 1; /* выше фонового ::before */
                }
                .menu-overlay.open .menu-overlay-content {
                    opacity: 1;
                    visibility: visible;
                    pointer-events: auto;
                }
                .menu-grid {
                    display: grid;
                    grid-template-columns: 110px 80px 110px; /* лево / центр / право */
                    align-items: center;
                    justify-content: center;
                }
                /* Грид для состояния с 2 селекторами (left badge/link + right badge) */
                .menu-grid--selected {
                    display: grid;
                    grid-template-columns: 110px 80px 110px;
                    align-items: center; /* вертикальный центр всех ячеек */
                    justify-content: center;
                    height: 60px; /* на всю высоту контейнера */
                }
                .menu-col {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center; /* вертикальный центр */
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
            
            ${this.getScreenTemplate()}
        `;
        // Настройка оверлея меню и обработчика кнопки
        this.setupMenuOverlay();
    }

    setupMenuOverlay() {
        const container = this.shadowRoot.querySelector('.voice-widget-container');
        if (!container) return;
        // Создаём оверлей и его контент (после render innerHTML всегда новый DOM)
        let overlay = this.shadowRoot.querySelector('.menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'menu-overlay';
            const content = document.createElement('div');
            content.className = 'menu-overlay-content';
            overlay.appendChild(content);
            container.appendChild(overlay);
        }
        // Обновляем визуальное состояние
        this.updateMenuUI();
        // Навешиваем обработчик на иконку меню
        const menuImg = this.shadowRoot.querySelector('.menu-button img');
        if (menuImg) {
            menuImg.onclick = () => {
                // toggle: closed->open, open->closed, selected->open
                if (this.menuState === 'closed') this.menuState = 'open';
                else if (this.menuState === 'open') this.menuState = 'closed';
                else if (this.menuState === 'selected') this.menuState = 'open';
                this.updateMenuUI();
            };
        }
        // Навесим обработчики после отрисовки контента в updateMenuUI
    }

    updateMenuUI() {
        const overlay = this.shadowRoot.querySelector('.menu-overlay');
        if (!overlay) return;
        // показать/скрыть overlay
        if (this.menuState === 'closed') overlay.classList.remove('open'); else overlay.classList.add('open');

        const menuImg = this.shadowRoot.querySelector('.menu-button img');
        const menuBtn = this.shadowRoot.querySelector('.menu-button');
        if (menuImg) {
            // в открытом селекторе — иконка close, иначе стандартная
            menuImg.src = this.menuState === 'open' ? './assets/menu_close_btn.svg' : './assets/menu_icon.svg';
        }
        if (menuBtn) {
            if (this.menuState !== 'closed') menuBtn.classList.add('menu-open'); else menuBtn.classList.remove('menu-open');
        }

        // Перестраиваем контент overlay под состояние
        let content = overlay.querySelector('.menu-overlay-content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'menu-overlay-content';
            overlay.appendChild(content);
        }

        if (this.menuState === 'open') {
            content.innerHTML = `
                <div class="menu-grid">
                    <div class="menu-col">
                        <button class="menu-btn menu-btn--request" data-action="request">Leave request</button>
                        <button class="menu-btn menu-btn--support" data-action="support">Support</button>
                    </div>
                    <div class="menu-col" style="width:80px; align-items:center;"></div>
                    <div class="menu-col">
                        <button class="menu-btn menu-btn--context" data-action="context">Context</button>
                        <button class="menu-btn menu-btn--reset" data-action="reset">Reset session</button>
                    </div>
                </div>`;
            // Обработчики выбора
            content.querySelectorAll('.menu-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const action = e.currentTarget.getAttribute('data-action');
                    if (action === 'request') { this.setScreen('request'); this.selectedMenu = 'request'; this.menuState = 'selected'; }
                    if (action === 'support') { this.setScreen('support'); this.selectedMenu = 'support'; this.menuState = 'selected'; }
                    if (action === 'context') { this.setScreen('context'); this.selectedMenu = 'context'; this.menuState = 'selected'; }
                    if (action === 'reset') { this.setScreen('start'); this.selectedMenu = null; this.menuState = 'closed'; }
                    this.updateMenuUI();
                };
            });
        } else if (this.menuState === 'selected') {
            const labelMap = { request: 'Leave request', support: 'Support', context: 'Context' };
            const colorClass = this.selectedMenu === 'request' ? 'menu-badge--request' : this.selectedMenu === 'support' ? 'menu-badge--support' : 'menu-badge--context';
            content.innerHTML = `
                <div class="menu-grid menu-grid--selected">
                    <div class="menu-col menu-col--single">
                        <button class="menu-link" data-action="back">Back to dialogue</button>
                    </div>
                    <div class="menu-col menu-col--single menu-col--middle"></div>
                    <div class="menu-col menu-col--single">
                        <div class="menu-badge ${colorClass}">${labelMap[this.selectedMenu] || ''}</div>
                    </div>
                </div>`;
            const backBtn = content.querySelector('[data-action="back"]');
            if (backBtn) {
                backBtn.onclick = () => {
                    this.setScreen('dialog');
                    this.menuState = 'closed';
                    this.selectedMenu = null;
                    this.updateMenuUI();
                };
            }
        } else {
            // closed: контент спрячется за счёт стилей
            content.innerHTML = '';
        }
    }
}

// Регистрируем новый компонент
customElements.define('voice-widget-v2', VoiceWidgetV2);
