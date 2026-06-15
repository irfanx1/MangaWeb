# PornhwaFlix

Premium manhwa reader Telegram Mini App.

## Stack
- **Backend**: FastAPI + aiohttp + BeautifulSoup
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Bot**: python-telegram-bot v21
- **Source**: hentai20.io (scraped, never embedded)

---

## Project Structure

```
pornhwaflix/
├── backend/
│   ├── main.py          ← FastAPI server (serves API + frontend)
│   ├── scraper.py       ← hentai20.io scraper
│   └── requirements.txt
├── frontend/
│   ├── index.html       ← Homepage
│   ├── search.html      ← Search
│   ├── manga.html       ← Manga details + chapter list
│   ├── reader.html      ← Chapter reader
│   ├── library.html     ← Saved manga
│   └── assets/
│       ├── style.css
│       └── app.js
└── bot.py               ← Telegram bot
```

---

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Set env vars and run:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Bot

Install:

```bash
pip install python-telegram-bot==21.3
```

Run:

```bash
BOT_TOKEN=your_token WEBAPP_URL=https://yourdomain.com python bot.py
```

### 3. Expose with HTTPS

Telegram Mini Apps **require HTTPS**. Use one of:
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) (free, no port forwarding)
- [ngrok](https://ngrok.com/) for local dev: `ngrok http 8000`
- Deploy to VPS with Nginx + Let's Encrypt

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=...` | Search manga |
| GET | `/api/manga?url=...` | Manga details + chapters |
| GET | `/api/chapter?url=...` | Chapter image URLs |
| GET | `/api/home` | Homepage data (trending/latest) |

---

## Telegram Bot Setup

1. Talk to [@BotFather](https://t.me/BotFather)
2. Create a bot, get the token
3. Set `BOT_TOKEN` env var
4. Set `WEBAPP_URL` to your HTTPS backend URL
5. In BotFather: `/setmenubutton` → set URL to your WEBAPP_URL

---

## Notes

- The source site is **never embedded** — only image URLs are fetched
- All reading progress is stored in `localStorage`
- Library is saved locally per device
- Telegram Back Button is supported on all pages
