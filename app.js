document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.enableClosingConfirmation();

    // Элементы интерфейса
    const UI = {
        startChatBtn: document.getElementById('startChatBtn'),
        cancelSearchBtn: document.getElementById('cancelSearchBtn'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        themeCards: document.querySelectorAll('.theme-card'),
        chatScreen: document.getElementById('chatScreen'),
        backToMainBtn: document.getElementById('backToMainBtn'),
        sendMessageBtn: document.getElementById('sendMessageBtn'),
        messageInput: document.getElementById('messageInput'),
        messagesContainer: document.getElementById('messagesContainer'),
        navButtons: document.querySelectorAll('.nav-btn'),
        pages: {
            home: document.getElementById('homePage'),
            profile: document.getElementById('profilePage'),
            settings: document.getElementById('settingsPage')
        },
        darkThemeToggle: document.getElementById('darkThemeToggle'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        userIdElement: document.getElementById('userId')
    };

    // Состояние приложения
    const state = {
        selectedTopic: 'general',
        currentChatId: null
    };

    // Инициализация
    function init() {
        setupThemeSelection();
        setupChatActions();
        setupNavigation();
        setupSettings();
        initUserProfile();
    }

    // Выбор темы
    function setupThemeSelection() {
        UI.themeCards.forEach(card => {
            card.addEventListener('click', () => {
                UI.themeCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.selectedTopic = card.dataset.topic;
            });
        });
    }

    // Действия чата
    function setupChatActions() {
        // Начать поиск собеседника
        UI.startChatBtn.addEventListener('click', () => {
            UI.loadingOverlay.style.display = 'flex';
            
            tg.sendData(JSON.stringify({
                action: 'search_partner',
                topic: state.selectedTopic,
                user_id: tg.initDataUnsafe?.user?.id
            }));
        });

        // Отмена поиска
        UI.cancelSearchBtn.addEventListener('click', () => {
            UI.loadingOverlay.style.display = 'none';
            tg.sendData(JSON.stringify({ action: 'cancel_search' }));
        });

        // Возврат на главную
        UI.backToMainBtn.addEventListener('click', () => {
            UI.chatScreen.style.display = 'none';
            showPage('home');
            tg.sendData(JSON.stringify({ action: 'leave_chat' }));
        });

        // Отправка сообщения
        UI.sendMessageBtn.addEventListener('click', sendMessage);
        UI.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Навигация
    function setupNavigation() {
        UI.navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const pageName = btn.dataset.page;
                showPage(pageName);
            });
        });
    }

    // Показать страницу
    function showPage(pageName) {
        // Скрыть все страницы
        Object.values(UI.pages).forEach(page => {
            page.classList.remove('active');
        });
        
        // Показать выбранную страницу
        UI.pages[pageName].classList.add('active');
        
        // Обновить активную кнопку в навигации
        UI.navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageName);
        });
    }

    // Настройки
    function setupSettings() {
        // Темная тема
        UI.darkThemeToggle.addEventListener('change', function() {
            if (this.checked) {
                enableDarkTheme();
            } else {
                disableDarkTheme();
            }
        });

        // Очистка истории
        UI.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите очистить историю чатов?')) {
                alert('История чатов очищена');
                // Здесь можно добавить реальную очистку истории
            }
        });
    }

    // Темная тема
    function enableDarkTheme() {
        document.documentElement.style.setProperty('--light-color', '#1a1a1a');
        document.documentElement.style.setProperty('--dark-color', '#f5f6fa');
        document.documentElement.style.setProperty('--card-bg', '#2d2d2d');
        document.documentElement.style.setProperty('--border-color', '#3d3d3d');
        document.documentElement.style.setProperty('--chat-bg', '#252525');
    }

    function disableDarkTheme() {
        document.documentElement.style.setProperty('--light-color', '#f5f6fa');
        document.documentElement.style.setProperty('--dark-color', '#2d3436');
        document.documentElement.style.setProperty('--card-bg', '#ffffff');
        document.documentElement.style.setProperty('--border-color', '#e0e0e0');
        document.documentElement.style.setProperty('--chat-bg', '#f0f2f5');
    }

    // Профиль пользователя
    function initUserProfile() {
        if (tg.initDataUnsafe?.user) {
            UI.userIdElement.textContent = tg.initDataUnsafe.user.id;
            // Здесь можно добавить загрузку других данных пользователя
        }
    }

    // Отправка сообщения
    function sendMessage() {
        const message = UI.messageInput.value.trim();
        if (message && state.currentChatId) {
            tg.sendData(JSON.stringify({
                action: 'send_message',
                chat_id: state.currentChatId,
                text: message
            }));
            addMessage(message, true);
            UI.messageInput.value = '';
        }
    }

    // Добавление сообщения в чат
    function addMessage(text, isMyMessage) {
        const messageElement = document.createElement('div');
        messageElement.className = isMyMessage ? 'message my-message' : 'message partner-message';
        messageElement.textContent = text;
        UI.messagesContainer.appendChild(messageElement);
        UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
    }

    // Обработка входящих сообщений от бота
    Telegram.WebApp.onEvent('messageReceived', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch(data.action) {
                case 'chat_started':
                    state.currentChatId = data.chat_id;
                    UI.loadingOverlay.style.display = 'none';
                    showPage('home', false); // Скрываем основной интерфейс
                    UI.chatScreen.style.display = 'block';
                    break;
                    
                case 'new_message':
                    addMessage(data.text, false);
                    break;
                    
                case 'chat_ended':
                    alert('Собеседник покинул чат');
                    UI.chatScreen.style.display = 'none';
                    showPage('home');
                    break;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
        }
    });

    // Обход предупреждения ngrok
    if (navigator.userAgent.includes('ngrok')) {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
    }

    // Инициализация приложения
    init();
});