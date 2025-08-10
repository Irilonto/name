import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
import json
import uuid
import asyncio
from collections import defaultdict
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Конфигурация
BOT_TOKEN = "6731485857:AAGASr2K8oRsk0iePmDDrZFYqxn0i_JlnMs"
ADMIN_IDS = [6639587496]  # ID администраторов

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Структуры данных
waiting_queues = defaultdict(list)
active_chats = {}
user_stats = defaultdict(dict)
chat_history = defaultdict(list)
user_ratings = defaultdict(list)
reported_users = set()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    user_id = message.from_user.id
    
    # Инициализация статистики пользователя
    if user_id not in user_stats:
        user_stats[user_id] = {
            "first_seen": datetime.now(),
            "total_chats": 0,
            "active": False,
            "banned": False,
            "last_seen": datetime.now()
        }
    
    await message.answer(
        "👋 Добро пожаловать в анонимный чат!\n\n"
        "📌 Используйте WebApp для поиска собеседников\n"
        "🔍 Доступные команды:\n"
        "/stats - ваша статистика\n"
        "/help - справка\n"
        "/report - пожаловаться на собеседника"
    )

@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    await message.answer(
        "ℹ️ <b>Справка по боту</b>\n\n"
        "1. Откройте WebApp через меню\n"
        "2. Выберите тему и начните общение\n"
        "3. После чата вы можете оценить собеседника\n\n"
        "⚠️ Правила:\n"
        "- Не раскрывайте личные данные\n"
        "- Уважайте собеседников\n"
        "- Запрещен спам и оскорбления",
        parse_mode="HTML"
    )

@dp.message(Command("stats"))
async def cmd_stats(message: types.Message):
    user_id = message.from_user.id
    stats = user_stats.get(user_id, {})
    
    if not stats:
        await message.answer("❌ Статистика не найдена. Начните с /start")
        return
    
    avg_rating = sum(user_ratings.get(user_id, [5])) / len(user_ratings.get(user_id, [5]))
    
    await message.answer(
        f"📊 <b>Ваша статистика</b>:\n\n"
        f"• Чатов: <b>{stats.get('total_chats', 0)}</b>\n"
        f"• Рейтинг: <b>{avg_rating:.1f}</b>/5\n"
        f"• В системе: <b>{(datetime.now() - stats['first_seen']).days}</b> дней\n\n"
        f"🆔 Ваш ID: <code>{user_id}</code>",
        parse_mode="HTML"
    )

@dp.message(Command("report"))
async def cmd_report(message: types.Message):
    user_id = message.from_user.id
    chat_id = active_chats.get(user_id)
    
    if not chat_id:
        await message.answer("❌ Вы не в активном чате")
        return
    
    partner_id = next(uid for uid in active_chats if active_chats[uid] == chat_id and uid != user_id)
    reported_users.add(partner_id)
    
    await message.answer(
        "⚠️ <b>Жалоба отправлена</b>\n\n"
        "Администратор проверит вашу жалобу. Спасибо за обратную связь!",
        parse_mode="HTML"
    )
    
    # Уведомление админам
    for admin_id in ADMIN_IDS:
        await bot.send_message(
            admin_id,
            f"🚨 Новая жалоба!\n\n"
            f"От: {user_id}\n"
            f"На: {partner_id}\n"
            f"Чат: {chat_id}"
        )

@dp.message(lambda message: message.web_app_data)
async def handle_web_app_data(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        
        if user_stats.get(user_id, {}).get('banned'):
            await message.answer("❌ Вы заблокированы")
            return
            
        if data['action'] == 'search_partner':
            await handle_search_partner(message, data, user_id)
        elif data['action'] == 'send_message':
            await handle_send_message(data, user_id)
        elif data['action'] == 'leave_chat':
            await handle_leave_chat(user_id)
        elif data['action'] == 'cancel_search':
            await handle_cancel_search(data, user_id)
        elif data['action'] == 'rate_partner':
            await handle_rate_partner(data, user_id)
            
    except Exception as e:
        logger.error(f"Error processing web app data: {e}", exc_info=True)
        await message.answer("⚠️ Ошибка обработки запроса")

async def handle_search_partner(message, data, user_id):
    topic = data['topic']
    if user_id not in waiting_queues[topic]:
        waiting_queues[topic].append(user_id)
        user_stats[user_id]["active"] = True
        await message.answer(f"🔍 Ищем собеседника по теме: {topic}...")
        await check_matches(topic)

async def handle_send_message(data, user_id):
    chat_id = active_chats.get(user_id)
    if chat_id:
        partner_id = next(
            uid for uid in active_chats 
            if active_chats[uid] == chat_id and uid != user_id
        )
        await bot.send_message(
            partner_id,
            json.dumps({
                "action": "new_message",
                "text": data['text'],
                "timestamp": datetime.now().isoformat()
            })
        )

async def handle_leave_chat(user_id):
    await end_chat_session(user_id, "Собеседник покинул чат")

async def handle_cancel_search(data, user_id):
    topic = data.get('topic')
    if topic and user_id in waiting_queues[topic]:
        waiting_queues[topic].remove(user_id)
        user_stats[user_id]["active"] = False
        await bot.send_message(user_id, "❌ Поиск отменен")

async def handle_rate_partner(data, user_id):
    chat_id = data['chat_id']
    rating = float(data['rating'])
    
    partner_id = next(
        uid for uid in active_chats 
        if active_chats[uid] == chat_id and uid != user_id
    )
    
    user_ratings[partner_id].append(rating)
    await bot.send_message(
        user_id,
        f"⭐ Вы оценили собеседника: {rating}/5"
    )

async def check_matches(topic: str):
    if len(waiting_queues[topic]) >= 2:
        user1, user2 = waiting_queues[topic][0], waiting_queues[topic][1]
        chat_id = str(uuid.uuid4())
        
        active_chats[user1] = chat_id
        active_chats[user2] = chat_id
        
        # Обновляем статистику
        user_stats[user1]["total_chats"] += 1
        user_stats[user2]["total_chats"] += 1
        
        for user_id in [user1, user2]:
            await bot.send_message(
                user_id,
                json.dumps({
                    "action": "chat_started",
                    "chat_id": chat_id,
                    "topic": topic,
                    "partner_id": user2 if user_id == user1 else user1
                })
            )
        
        waiting_queues[topic] = waiting_queues[topic][2:]

async def end_chat_session(user_id: int, reason: str):
    chat_id = active_chats.get(user_id)
    if chat_id:
        partner_id = next(
            (uid for uid in active_chats 
             if active_chats[uid] == chat_id and uid != user_id),
            None
        )
        
        if partner_id:
            await bot.send_message(
                partner_id,
                json.dumps({
                    "action": "chat_ended",
                    "reason": reason
                })
            )
            user_stats[partner_id]["active"] = False
        
        active_chats.pop(user_id, None)
        if partner_id:
            active_chats.pop(partner_id, None)
        
        user_stats[user_id]["active"] = False

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())