"""
PornhwaFlix — AsuraScans Scraper
Uses curl_cffi AsyncSession for Cloudflare bypass.
"""
import re
import json
import logging
from urllib.parse import urljoin, quote, quote_plus
from curl_cffi.requests import AsyncSession
from bs4 import BeautifulSoup

logger = logging.getLogger("pornhwaflix.scraper_asura")

BASE_URL = "https://asurascans.com"
API_URL  = "https://api.asurascans.com"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         BASE_URL,
}

API_HEADERS = {
    **HEADERS,
    "Host":   "api.asurascans.com",
    "Accept": "application/json, text/plain, */*",
}

async def _get(url: str, headers: dict = None, rjson: bool = False):
    """Async GET using curl_cffi (handles Cloudflare)."""
    try:
        async with AsyncSession(impersonate="chrome124") as s:
            r = await s.get(url, headers=headers or HEADERS, timeout=45)
            r.raise_for_status()
            return r.json() if rjson else r.text
    except Exception as e:
        logger.error("AsuraScans fetch failed %s: %s", url, e)
        return None


def _img(tag) -> str:
    if not tag: return ""
    for attr in ("src", "data-src", "data-lazy-src"):
        v = (tag.get(attr) or "").strip()
        if v and v.startswith("http"): return v
    return ""

async def fetch_image_bytes(url: str):
    try:
        async with AsyncSession(
            impersonate="chrome124"
        ) as s:

            r = await s.get(
                url,
                headers={
                    "Referer": BASE_URL,
                    "User-Agent": HEADERS["User-Agent"]
                },
                timeout=45
            )

            r.raise_for_status()

            mime = (
                r.headers.get(
                    "content-type",
                    "image/jpeg"
                )
                .split(";")[0]
                .strip()
            )

            return r.content, mime

    except Exception as e:
        logger.error(
            "Asura image fetch failed %s: %s",
            url,
            e
        )

        return None, None

# ── Search ────────────────────────────────────────────────────────────────────
async def search(query: str) -> list[dict]:
    url  = f"{API_URL}/api/search?q={quote_plus(query)}"
    data = await _get(url, headers=API_HEADERS, rjson=True)
    if not isinstance(data, dict) or "data" not in data:
        return []

    results = []
    for item in data["data"]:
        title = item.get("title") or ""
        pub   = item.get("public_url") or ""
        if not pub: continue
        manga_url = urljoin(BASE_URL, pub)
        results.append({
            "title":          title.strip(),
            "url":            manga_url,
            "cover":          item.get("cover") or "",
            "latest_chapter": "",
            "source":         "asurascans",
        })
    return results


# ── Manga detail ─────────────────────────────────────────────────────────────
async def get_manga(manga_url: str) -> dict:
    html = await _get(manga_url)
    if not html:
        return {"title": "", "cover": "", "description": "", "chapters": [], "source": "asurascans"}

    bs = BeautifulSoup(html, "html.parser")

    # Title
    h1    = bs.find("h1") or bs.find("h2")
    title = h1.text.strip() if h1 else ""

    # Cover
    cover = ""
    ptag  = bs.select_one("div.rounded-xl.z-0.w-full.h-full.absolute.top-0.left-0")
    if ptag and (img_tag := ptag.find_next("img")):
        cover = _img(img_tag)

    # Description
    desc_node = bs.select_one("div.mt-3.relative")
    desc_node = desc_node.find_next("p") if desc_node else None
    description = desc_node.text.strip()[:600] if desc_node else ""

    # Chapters
    chapters  = []
    container = bs.select_one("div.divide-y.divide-white\\/5")
    if container:
        for a_tag in container.find_all("a"):
            ch_url = a_tag.get("href", "")
            if not ch_url: continue
            ch_url   = urljoin(BASE_URL, ch_url)
            title_el = a_tag.find("span")
            ch_title = _parse_chapter_title(title_el) if title_el else a_tag.text.strip()
            if not ch_title: continue
            match = re.search(r"[\d.]+", ch_title)
            num   = match.group(0) if match else str(len(chapters) + 1)
            chapters.append({
                "number": num,
                "title":  ch_title,
                "url":    ch_url,
                "date":   "",
            })

    return {
        "title":       title,
        "cover":       cover,
        "description": description,
        "chapters":    chapters,
        "source":      "asurascans",
    }


def _parse_chapter_title(span_el) -> str:
    parts = []
    for content in span_el.contents:
        if hasattr(content, "text"):
            parts.append(content.text.strip())
        elif isinstance(content, str):
            parts.append(content.strip())
    return " ".join(p for p in parts if p).replace("  ", " ")


# ── Chapter images ────────────────────────────────────────────────────────────
async def get_chapter(chapter_url: str) -> dict:
    html = await _get(chapter_url)
    if not html:
        return {"title": "", "chapter": "", "images": [], "source": "asurascans"}

    bs = BeautifulSoup(html, "html.parser")

    h1    = bs.find("h1") or bs.find("h2")
    title = h1.text.strip() if h1 else ""

    ch_match   = re.search(r"chapter[-\s]?([\d.]+)", title, re.IGNORECASE) or \
                 re.search(r"chapter[-\s]?([\d.]+)", chapter_url, re.IGNORECASE)
    ch_num     = ch_match.group(1) if ch_match else ""

    images = []

    # Method 1: astro-island props (primary)
    for astro in bs.find_all("astro-island"):
        props_str = astro.get("props")
        if not isinstance(props_str, str): continue
        try:
            props = _clean_astro(props_str)
        except Exception:
            continue
        if not props or "pages" not in props: continue
        for img_group in props["pages"]:
            if not isinstance(img_group, list): continue
            for img_item in img_group:
                try:
                    if not isinstance(img_item[1], dict): continue
                    url_val = img_item[1].get("url")
                    if url_val and isinstance(url_val, list) and url_val:
                        images.append(quote(url_val[-1], safe=":/%?=&#+"))
                except Exception:
                    continue
        if images: break

    # Method 2: fallback to regular img tags
    if not images:
        for img in bs.select("div#readerarea img, div.reading-content img, main img, article img, section img"):
            src = _img(img)
            if src: images.append(quote(src, safe=":/%?=&#+"))

    # Sort pages by the leading number in the filename — keeps order stable
    # regardless of which extraction method ran or what order props came in.    

    return {"title": title, "chapter": ch_num, "images": images, "source": "asurascans"}

def _clean_astro(props_str: str):
    while True:
        try:
            return json.loads(props_str)
        except Exception:
            if "&quot;" not in props_str:
                raise
            props_str = props_str.replace("&quot;", '"')


# ── Latest Updates ────────────────────────────────────────────────────────────
async def get_latest() -> list[dict]:
    html = await _get(BASE_URL)
    if not html: return []
    bs, results, seen = BeautifulSoup(html, "html.parser"), [], set()

    for item in bs.select("div.grid > div, div[class*='update'] > div"):
        cover_a = item.select_one("a[href*='/comics/']")
        img_tag = item.select_one("img")
        if not cover_a: continue
        manga_url = urljoin(BASE_URL, cover_a.get("href", ""))
        if manga_url in seen: continue
        seen.add(manga_url)

        title = (cover_a.get("title") or (img_tag.get("alt", "") if img_tag else "") or "").strip()
        if not title:
            h = item.select_one("h3, h2, span.font-bold, a.font-bold")
            title = h.text.strip() if h else ""
        cover    = _img(img_tag) if img_tag else ""
        chapters = []
        for ch_a in item.select("a[href*='/chapter/']")[:3]:
            ch_url   = urljoin(BASE_URL, ch_a.get("href", ""))
            time_el  = ch_a.find_next_sibling("span")
            date     = time_el.text.strip() if time_el else ""
            chapters.append({"title": ch_a.text.strip(), "url": ch_url, "date": date})

        if not title: continue
        results.append({"title": title, "url": manga_url, "cover": cover,
                        "source": "asurascans", "chapters": chapters, "rating": None})
        if len(results) >= 20: break
    return results


# ── Popular / Trending ────────────────────────────────────────────────────────
async def get_popular() -> list[dict]:
    url  = f"{API_URL}/api/series?page=1&perPage=15&order=rating"
    data = await _get(url, headers=API_HEADERS, rjson=True)
    if not isinstance(data, dict) or "data" not in data: return []
    results = []
    for item in data["data"]:
        pub = item.get("public_url", "")
        if not pub: continue
        results.append({
            "title":  (item.get("title") or "").strip(),
            "url":    urljoin(BASE_URL, pub),
            "cover":  item.get("cover", ""),
            "source": "asurascans",
            "rating": item.get("rating"),
        })
    return results[:15]