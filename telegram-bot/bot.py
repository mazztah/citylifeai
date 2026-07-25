"""
CityLife AI Telegram Bot.

Aufgaben (siehe Konzept: "den Telegram-Bot für Missionen, Highscores und
Multiplayer einsetzen"):
- /start  -> öffnet die Mini App (WorldScene) über einen WebApp-Button
- /rangliste -> zeigt die aktuelle Bestenliste aus dem Backend
- /story  -> zeigt das aktuelle Story-Kapitel des Spielers, ohne die Mini App zu öffnen
- /hilfe  -> kurze Erklärung der Steuerung

Startet standardmäßig im Long-Polling-Modus (einfachste Betriebsart für Dev/
Kleinserver). Für Produktivbetrieb kann auf Webhook umgestellt werden
(siehe Kommentar unten bei `main()`).
"""
import asyncio
import logging
import os

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("citylife-bot")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
MINI_APP_URL = os.environ.get("MINI_APP_URL", "http://localhost:5173")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: Message):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🚗 CityLife AI öffnen", web_app=WebAppInfo(url=MINI_APP_URL))]
        ]
    )
    await message.answer(
        "Willkommen bei <b>CityLife AI</b> 🏙️\n\n"
        "Du erbst ein Haus in Hannover - und stolperst dabei in eine Geschichte "
        "über sieben Grundstücke, einen anonymen Investor und ein Familiengeheimnis.\n\n"
        "Fahr durch die echten Straßen der Innenstadt, erledige Missionen und verfolge "
        "die Story Kapitel für Kapitel. Nutze /rangliste für die Bestenliste und "
        "/hilfe für die Steuerung.",
        reply_markup=keyboard,
        parse_mode="HTML",
    )


@dp.message(Command("hilfe"))
async def cmd_help(message: Message):
    await message.answer(
        "🎮 <b>Steuerung</b>\n"
        "W / ↑  Gas geben\nS / ↓  Bremsen\nA / ←  links lenken\nD / →  rechts lenken\n\n"
        "Auf dem Handy: Steuerkreuz unten links in der Mini App antippen.\n"
        "Fahr einfach zu den leuchtenden Missionsmarkern, um Missionen zu erfüllen.",
        parse_mode="HTML",
    )


@dp.message(Command("rangliste"))
async def cmd_leaderboard(message: Message):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{BACKEND_URL}/leaderboard")
            resp.raise_for_status()
            entries = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Rangliste konnte nicht geladen werden: %s", exc)
        await message.answer("Die Rangliste ist gerade nicht erreichbar. Versuch es später erneut.")
        return

    if not entries:
        await message.answer("Noch keine Einträge in der Rangliste - sei die/der Erste!")
        return

    lines = ["🏆 <b>CityLife AI - Rangliste Hannover</b>\n"]
    for i, entry in enumerate(entries, start=1):
        medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(i, f"{i}.")
        lines.append(f"{medal} {entry['display_name']} - Lvl {entry['level']} ({entry['xp']} XP)")
    await message.answer("\n".join(lines), parse_mode="HTML")


@dp.message(F.text == "/story")
async def cmd_story(message: Message):
    await message.answer(
        "Öffne die Mini App mit /start, um dein aktuelles Story-Kapitel und den "
        "nächsten Cliffhanger direkt im Spiel zu sehen."
    )


async def main():
    if not bot:
        logger.error(
            "TELEGRAM_BOT_TOKEN ist nicht gesetzt. Setze die Umgebungsvariable und starte erneut."
        )
        return

    logger.info("CityLife AI Bot startet (Long Polling). Mini App: %s", MINI_APP_URL)
    # Für Produktivbetrieb: statt polling einen Webhook registrieren, z.B.
    # await bot.set_webhook(url=f"{PUBLIC_URL}/telegram/webhook") und die
    # aiogram-Webhook-Integration mit FastAPI/Starlette verwenden.
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
