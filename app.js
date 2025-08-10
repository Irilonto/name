document.addEventListener('DOMContentLoaded', async () => {
    const tg = window.Telegram.WebApp;
    
    // Инициализация WebApp
    tg.expand();
    tg.enableClosingConfirmation();
    tg.BackButton.show();
    tg.BackButton.onClick(handleBackButton);

    // Состояние приложения (теперь темная тема по умолчанию)
    const state = {
        selectedTopic: 'general',
        currentChatId: null,
        isDarkTheme: true // Изменено на true для темной темы по умолчанию
    };

    // DOM элементы
    const elements = {
        startChatBtn: document.getElementById('startChatBtn'),
        cancelSearchBtn: document.getElementById('cancelSearchBtn'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        themeCards: document.querySelectorAll('.theme-card'),
        chatScreen: document.getElementById('chatScreen'),
        backToMainBtn: document.getElementById('backToMainBtn'),
        sendMessageBtn: document.getElementById('sendMessageBtn'),
        messageInput: document.getElementById('messageInput'),
        messagesContainer: document.getElementById('messagesContainer'),
        pages: {
            home: document.getElementById('homePage'),
            profile: document.getElementById('profilePage'),
            settings: document.getElementById('settingsPage')
        },
        darkThemeToggle: document.getElementById('darkThemeToggle'),
        userIdElement: document.getElementById('userId'),
        themeSwitcher: document.getElementById('themeSwitcher') // Добавлен переключатель темы
    };

    // Инициализация
    function init() {
        setupEventListeners();
        loadUserData();
        applySavedTheme();
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        // Выбор темы
        elements.themeCards.forEach(card => {
            card.addEventListener('click', () => selectTopic(card));
        });

        // Чат действия
        elements.startChatBtn.addEventListener('click', startSearch);
        elements.cancelSearchBtn.addEventListener('click', cancelSearch);
        elements.backToMainBtn.addEventListener('click', leaveChat);
        elements.sendMessageBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => navigate(btn.dataset.page));
        });

        // Настройки
        elements.darkThemeToggle.addEventListener('change', toggleTheme);
        elements.themeSwitcher.addEventListener('click', toggleTheme); // Добавлен обработчик для переключателя
    }

    // Загрузка данных пользователя
    function loadUserData() {
        if (tg.initDataUnsafe?.user) {
            elements.userIdElement.textContent = tg.initDataUnsafe.user.id;
        }
    }

    // Выбор темы чата
    function selectTopic(card) {
        elements.themeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedTopic = card.dataset.topic;
    }

    // Поиск собеседника
    function startSearch() {
        showLoading(true);
        tg.sendData(JSON.stringify({
            action: 'search_partner',
            topic: state.selectedTopic,
            user_id: tg.initDataUnsafe?.user?.id
        }));
    }

    // Отмена поиска
    function cancelSearch() {
        showLoading(false);
        tg.sendData(JSON.stringify({ action: 'cancel_search' }));
    }

    // Отправка сообщения
    function sendMessage() {
        const message = elements.messageInput.value.trim();
        if (message && state.currentChatId) {
            tg.sendData(JSON.stringify({
                action: 'send_message',
                chat_id: state.currentChatId,
                text: message
            }));
            addMessage(message, true);
            elements.messageInput.value = '';
        }
    }

    // Добавление сообщения в чат
    function addMessage(text, isMyMessage) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isMyMessage ? 'my-message' : 'partner-message'}`;
        messageElement.innerHTML = `
            <div class="message-content">${text}</div>
            <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        elements.messagesContainer.appendChild(messageElement);
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    // Навигация по страницам
    function navigate(pageName) {
        Object.values(elements.pages).forEach(page => page.classList.remove('active'));
        elements.pages[pageName].classList.add('active');
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageName);
        });
        
        tg.BackButton[pageName === 'home' ? 'hide' : 'show']();
    }

    // Обработка кнопки "Назад"
    function handleBackButton() {
        navigate('home');
    }

    // Выход из чата
    function leaveChat() {
        elements.chatScreen.style.display = 'none';
        navigate('home');
        tg.sendData(JSON.stringify({ action: 'leave_chat' }));
    }

    // Переключение темы
    function toggleTheme() {
        state.isDarkTheme = !state.isDarkTheme;
        localStorage.setItem('darkTheme', state.isDarkTheme);
        applyTheme();
    }

    // Применение темы (обновлено для нового CSS)
    function applyTheme() {
        document.body.classList.toggle('light-theme', !state.isDarkTheme);
        elements.darkThemeToggle.checked = state.isDarkTheme;
    }

    // Загрузка сохраненной темы (обновлено)
    function applySavedTheme() {
        const savedTheme = localStorage.getItem('darkTheme');
        if (savedTheme !== null) {
            state.isDarkTheme = savedTheme === 'true';
        }
        applyTheme();
    }

    // Показать/скрыть загрузку
    function showLoading(show) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // Обработка входящих сообщений
    tg.onEvent('messageReceived', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch(data.action) {
                case 'chat_started':
                    state.currentChatId = data.chat_id;
                    showLoading(false);
                    navigate('home');
                    elements.chatScreen.style.display = 'flex';
                    break;
                    
                case 'new_message':
                    addMessage(data.text, false);
                    break;
                    
                case 'chat_ended':
                    tg.showPopup({
                        title: 'Чат завершен',
                        message: 'Собеседник покинул чат',
                        buttons: [{ type: 'ok' }]
                    });
                    elements.chatScreen.style.display = 'none';
                    navigate('home');
                    break;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
            tg.showAlert(`Ошибка: ${e.message}`);
        }
    });

    // Инициализация приложения
    init();
});