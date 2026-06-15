"""
PornhwaFlix — Telegram Bot
Launches the Mini App via WebApp button.
"""

import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("PornhwaFlixBot")

BOT_TOKEN  = "8779761016:AAHOaC1Uc61QKgu-yj9yhNc0jiHBH1XK6eU"
WEBAPP_URL = "https://cosmic-gloomily-jinx.ngrok-free.dev"   # e.g. https://yourdomain.com


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton(
            text="Open PornhwaFlix",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )
    ]])
    await update.message.reply_photo(
        photo="https://i.pinimg.com/736x/0a/65/8c/0a658cd8621bafb4c996eef69353ef28.jpg",  # Replace with actual photo URL
        caption="Welcome to *PornhwaFlix* — your premium manhwa reader.\n\n"
                "Tap the button below to open the reader.",
        parse_mode="Markdown",
        reply_markup=keyboard,
    )


async def help_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "*PornhwaFlix Commands*\n\n"
        "/start — Open the reader\n"
        "/help  — Show this message",
        parse_mode="Markdown",
    )


if __name__ == "__main__":
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help",  help_cmd))
    log.info("Bot starting...")
    app.run_polling(drop_pending_updates=True)
