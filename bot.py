from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
import json
import uuid
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token="6731485857:AAGASr2K8oRsk0iePmDDrZFYqxn0i_JlnMs")
dp = Dispatcher()

waiting_queues = defaultdict(list)
active_chats = {}

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "Добро пожаловать в анонимный чат!",
        reply_markup=types.ReplyKeyboardMarkup(
            keyboard=[
                [types.KeyboardButton(
                    text="Открыть чат",
                    web_app=types.WebAppInfo(url="https://f197967916d4.ngrok-free.app")
                )]
            ],
            resize_keyboard=True
        )
    )

@dp.message(lambda message: message.web_app_data)
async def handle_web_app_data(message: types.Message):
    try:
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        
        if data['action'] == 'search_partner':
            topic = data['topic']
            if user_id not in waiting_queues[topic]:
                waiting_queues[topic].append(user_id)
                await check_matches(topic)
                
        elif data['action'] == 'send_message':
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
                        "text": data['text']
                    })
                )

    except Exception as e:
        logger.error(f"Error: {e}")

async def check_matches(topic: str):
    if len(waiting_queues[topic]) >= 2:
        user1, user2 = waiting_queues[topic][0], waiting_queues[topic][1]
        chat_id = str(uuid.uuid4())
        
        active_chats[user1] = chat_id
        active_chats[user2] = chat_id
        
        for user_id in [user1, user2]:
            await bot.send_message(
                user_id,
                json.dumps({
                    "action": "chat_started",
                    "chat_id": chat_id
                })
            )
        
        waiting_queues[topic] = waiting_queues[topic][2:]

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())