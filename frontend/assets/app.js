/* ════════════════════════════════════════════════════
   Manhwaflix — Shared App Logic v4
   Rebranded, improved error display, retry helpers
════════════════════════════════════════════════════ */

const APP_NAME = 'Manhwaflix';
const API_BASE = window.location.origin;

// ─── API ────────────────────────────────────────────
const API = {
  async search18fx(q) {
    const r = await fetch(`${API_BASE}/api/search18fx?q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error(`18FX search failed (${r.status})`);
    return r.json();
  },
  async searchAsura(q) {
    const r = await fetch(`${API_BASE}/api/searchAsura?q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error(`AsuraScans search failed (${r.status})`);
    return r.json();
  },
};

// ─── Storage ────────────────────────────────────────
const Store = {
  saveProgress(mangaUrl, mangaTitle, cover, chapterUrl, chapterTitle, source, page, percent) {
    const data = {
      mangaUrl, mangaTitle, cover,
      chapterUrl, chapterTitle, source,
      page: page || 1,
      percent: percent || 0,
      ts: Date.now(),
    };
    try {
      localStorage.setItem('mfx_progress', JSON.stringify(data));
      const reads = Store.getReadChapters(mangaUrl);
      reads.add(chapterUrl);
      localStorage.setItem(`mfx_read_${_storeKey(mangaUrl)}`, JSON.stringify([...reads]));
    } catch(e) {}
  },
  getProgress() {
    try {
      // Support both old key (pfx_progress) and new key (mfx_progress)
      return JSON.parse(
        localStorage.getItem('mfx_progress') ||
        localStorage.getItem('pfx_progress') ||
        'null'
      );
    } catch { return null; }
  },
  getReadChapters(mangaUrl) {
    try {
      const key = `mfx_read_${_storeKey(mangaUrl)}`;
      const old = `pfx_read_${_storeKey(mangaUrl)}`;
      return new Set(JSON.parse(
        localStorage.getItem(key) || localStorage.getItem(old) || '[]'
      ));
    } catch { return new Set(); }
  },
  getLibrary() {
    try {
      return JSON.parse(
        localStorage.getItem('mfx_library') ||
        localStorage.getItem('pfx_library') ||
        '[]'
      );
    } catch { return []; }
  },
  addToLibrary(manga) {
    try {
      const lib = Store.getLibrary().filter(m => m.url !== manga.url);
      lib.unshift({ ...manga, savedAt: Date.now() });
      localStorage.setItem('mfx_library', JSON.stringify(lib.slice(0, 100)));
    } catch(e) {}
  },
  removeFromLibrary(url) {
    try {
      const lib = Store.getLibrary().filter(m => m.url !== url);
      localStorage.setItem('mfx_library', JSON.stringify(lib));
    } catch(e) {}
  },
  isInLibrary(url) {
    return Store.getLibrary().some(m => m.url === url);
  },
};

function _storeKey(url) {
  try { return btoa(url).slice(0, 24); } catch { return url.slice(-24); }
}

// ─── Navigation ─────────────────────────────────────
const Nav = {
  go(path, params = {}) {
    const u = new URL(window.location.origin + path);
    Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
    window.location.href = u.toString();
  },
  param(key) {
    return new URLSearchParams(window.location.search).get(key);
  },
};

// ─── Telegram WebApp ────────────────────────────────
const TG = window.Telegram?.WebApp;
if (TG) {
  TG.ready();
  TG.expand();
  TG.enableClosingConfirmation();
  try { TG.disableVerticalSwipes(); } catch(e) {}
}

// ─── Toast ──────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'default', duration = 2600) {
  let t = document.getElementById('mfx-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mfx-toast';
    t.className = 'pfx-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `pfx-toast pfx-toast--${type} pfx-toast--show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('pfx-toast--show'), duration);
}

// ─── Error Banner ────────────────────────────────────
// Renders a full inline error with retry button inside a container
function renderError(container, message, onRetry) {
  container.innerHTML = `
    <div class="mfx-error-state">
      <div class="mfx-error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p class="mfx-error-msg">${escHtml(message)}</p>
      ${onRetry ? `<button class="mfx-retry-btn" id="mfx-retry-btn">Try Again</button>` : ''}
    </div>
  `;
  if (onRetry) {
    document.getElementById('mfx-retry-btn')?.addEventListener('click', onRetry);
  }
}

// ─── Render Cards ────────────────────────────────────
function renderCard(manga, onclick) {
  const d = document.createElement('div');
  d.className = 'manga-card';

  const coverSrc = manga.cover
    ? `/api/image?url=${encodeURIComponent(manga.cover)}`
    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="%23111"/></svg>';

  const srcBadge = manga.source === 'asurascans'
    ? `<span class="card-src card-src--as">AS</span>`
    : manga.source === 'manga18fx'
    ? `<span class="card-src card-src--fx">18FX</span>`
    : '';

  d.innerHTML = `
    <div class="card-cover">
      <img
        src="${coverSrc}"
        alt="${escHtml(manga.title)}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22><rect width=%22200%22 height=%22300%22 fill=%22%23111%22/><text x=%22100%22 y=%22155%22 text-anchor=%22middle%22 fill=%22%23333%22 font-size=%2218%22>?</text></svg>'"
      >
      ${manga.latest_chapter ? `<span class="card-badge">${escHtml(manga.latest_chapter)}</span>` : ''}
      ${srcBadge}
      <div class="card-overlay"></div>
    </div>
    <p class="card-title">${escHtml(manga.title)}</p>
  `;

  d.addEventListener('click', onclick || (() => Nav.go('/manga', {
    url: manga.url, title: manga.title, cover: manga.cover, source: manga.source || '',
  })));

  requestAnimationFrame(() => d.classList.add('card--visible'));
  return d;
}

function renderSkeletons(container, count = 6) {
  container.innerHTML = Array(count).fill(0).map(() => `
    <div class="skel-card">
      <div class="skel skel-cover"></div>
      <div class="skel skel-line" style="width:82%"></div>
      <div class="skel skel-line" style="width:55%"></div>
    </div>
  `).join('');
}

function staggerCards(container) {
  const cards = container.querySelectorAll('.manga-card');
  cards.forEach((card, i) => {
    card.style.animationDelay = `${i * 38}ms`;
    card.classList.add('card--visible');
  });
}

// ─── Escape HTML ─────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── SVG Icons ────────────────────────────────────────
const ICONS = {
  search:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  lib:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  home:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  back:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  prev:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  next:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  up:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  heart:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFill: `<svg viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  check:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  trash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  grid:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  list:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  sort:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`,
  warning:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};