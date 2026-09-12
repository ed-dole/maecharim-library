(() => {
  'use strict';

  const MAIN_API_URL = (window.SiteFast && window.SiteFast.API_URL) || (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
  const EXEC_CACHE_KEY = 'SITE_FAST:cliproom-exec-v3';
  const EXEC_CACHE_AGE = 10 * 60 * 1000;
  const CATALOG_CACHE_KEY = 'SITE_FAST:cliproom-catalog-v3-dynamic-exec';
  const CATALOG_STALE_AGE = 24 * 60 * 60 * 1000;
  const JSONP_TIMEOUT = 45 * 1000;
  const RETRY_DELAYS = [1000, 1800, 3200, 6000, 10000, 16000, 30000];

  const track = document.getElementById('cliproomTrack');
  if (!track) return;

  let courses = [];
  let page = 0;
  let perPage = 3;
  let timer = null;
  let loadingStarted = false;
  let activeCliproomExecUrl = '';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const cardsPerPage = () => window.innerWidth <= 620 ? 1 : window.innerWidth <= 900 ? 2 : 3;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const retryDelay = attempt => RETRY_DELAYS[Math.min(Math.max(0, attempt - 1), RETRY_DELAYS.length - 1)];

  async function waitRetry(ms) {
    if (navigator.onLine === false) {
      await Promise.race([
        new Promise(resolve => window.addEventListener('online', resolve, { once: true })),
        sleep(Math.max(ms, 15000))
      ]);
      return;
    }
    await sleep(ms);
  }

  function storageGet(key, maxAge) {
    for (const storage of [window.sessionStorage, window.localStorage]) {
      try {
        const saved = JSON.parse(storage.getItem(key) || 'null');
        if (saved && saved.savedAt && Date.now() - saved.savedAt <= maxAge) return saved;
      } catch (_) {}
    }
    return null;
  }

  function storageSet(key, value) {
    const raw = JSON.stringify(value);
    try { sessionStorage.setItem(key, raw); } catch (_) {}
    try { localStorage.setItem(key, raw); } catch (_) {}
  }

  function storageRemove(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function jsonpRequest(baseUrl, params) {
    return new Promise((resolve, reject) => {
      const callbackName = '__cliproomJsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let timeoutId = null;
      let settled = false;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      };
      const finish = (ok, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        ok ? resolve(value) : reject(value);
      };

      window[callbackName] = payload => finish(true, payload);

      try {
        const url = new URL(baseUrl);
        Object.entries(params || {}).forEach(([key, value]) => {
          if (value !== undefined && value !== null) url.searchParams.set(key, value);
        });
        url.searchParams.set('callback', callbackName);
        url.searchParams.set('_t', String(Date.now()));
        script.src = url.toString();
        script.async = true;
        script.onerror = () => finish(false, new Error('เชื่อมต่อ Apps Script ไม่สำเร็จ'));
        timeoutId = setTimeout(() => finish(false, new Error('Apps Script ใช้เวลาตอบกลับนานเกินไป')), JSONP_TIMEOUT);
        document.head.appendChild(script);
      } catch (error) {
        finish(false, error);
      }
    });
  }

  function readExecCache() {
    const saved = storageGet(EXEC_CACHE_KEY, EXEC_CACHE_AGE);
    const url = String(saved?.url || '').trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec(?:[?#].*)?$/i.test(url) ? url : '';
  }

  function writeExecCache(url) {
    storageSet(EXEC_CACHE_KEY, { savedAt: Date.now(), url });
  }

  function clearExecCache() {
    storageRemove(EXEC_CACHE_KEY);
  }

  async function resolveCliproomExecUrl(forceFresh = false) {
    const mainApi = String(MAIN_API_URL || '').trim();
    if (!mainApi) throw new Error('ไม่พบ URL ของ Apps Script หลัก');

    if (!forceFresh) {
      const cached = readExecCache();
      if (cached) return cached;
    }

    let attempt = 0;
    while (true) {
      try {
        const result = await jsonpRequest(mainApi, { mode: 'cliproomexec' });
        if (!result || result.success === false) {
          throw new Error((result && result.message) || 'อ่าน URL Cliproom จากชีตไม่สำเร็จ');
        }
        const execUrl = String(result.url || '').trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec(?:[?#].*)?$/i.test(execUrl)) {
          throw new Error('URL Cliproom จากชีตไม่ถูกต้อง');
        }
        writeExecCache(execUrl);
        return execUrl;
      } catch (error) {
        attempt += 1;
        const delay = retryDelay(attempt);
        console.warn(`Cliproom resolver retry #${attempt}:`, error);
        if (!courses.length) {
          track.innerHTML = `<div class="cliproom-loading">กำลังเชื่อมต่อระบบหลักสูตร...<br><small>ลองใหม่อัตโนมัติ ครั้งที่ ${attempt}</small></div>`;
        }
        await waitRetry(delay);
      }
    }
  }

  function render() {
    if (!courses.length) {
      track.innerHTML = '<div class="cliproom-loading">กำลังรอข้อมูลหลักสูตร...</div>';
      const dots = document.getElementById('cliproomDots');
      if (dots) dots.innerHTML = '';
      return;
    }

    track.innerHTML = courses.map(course => `
      <article class="cliproom-card" tabindex="0" role="link" aria-label="เปิดหลักสูตร ${esc(course.title)}">
        <span class="cliproom-cover">
          ${course.coverUrl ? `<img src="${esc(course.coverUrl)}" alt="${esc(course.title)}" loading="lazy" decoding="async">` : ''}
          <span class="cliproom-play" aria-hidden="true">▶</span>
        </span>
        <div class="cliproom-body">
          <h3>${esc(course.title)}</h3>
          <p>${esc(course.description || 'เลือกหลักสูตรเพื่อเริ่มการอบรมออนไลน์')}</p>
        </div>
      </article>
    `).join('');

    track.querySelectorAll('.cliproom-card').forEach(card => {
      card.addEventListener('click', openCliproom);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCliproom();
        }
      });
    });

    update(true);
  }

  function update(reset) {
    const old = perPage;
    perPage = cardsPerPage();
    if (reset || old !== perPage) page = 0;
    const count = Math.max(1, Math.ceil(courses.length / perPage));
    page = Math.max(0, Math.min(page, count - 1));
    const card = track.querySelector('.cliproom-card');
    if (card) track.style.transform = `translateX(-${page * perPage * (card.getBoundingClientRect().width + 18)}px)`;
    const dots = document.getElementById('cliproomDots');
    if (dots) {
      dots.innerHTML = Array.from({ length: count }, (_, i) =>
        `<button class="cliproom-dot ${i === page ? 'active' : ''}" type="button" data-page="${i}" aria-label="หน้าที่ ${i + 1}"></button>`
      ).join('');
      dots.querySelectorAll('[data-page]').forEach(dot => {
        dot.onclick = event => {
          event.stopPropagation();
          page = Number(dot.dataset.page);
          update(false);
          restart();
        };
      });
    }
    const prev = document.getElementById('cliproomPrev');
    const next = document.getElementById('cliproomNext');
    if (prev) prev.disabled = page === 0;
    if (next) next.disabled = page === count - 1;
  }

  const openCliproom = () => window.open('cliproom.html', '_blank', 'noopener');

  function move(step) {
    const count = Math.max(1, Math.ceil(courses.length / perPage));
    page = (page + step + count) % count;
    update(false);
    restart();
  }

  function restart() {
    clearInterval(timer);
    if (courses.length > perPage) timer = setInterval(() => move(1), 6000);
  }

  function readCatalogCache(execUrl) {
    const saved = storageGet(CATALOG_CACHE_KEY, CATALOG_STALE_AGE);
    if (!saved || saved.execUrl !== execUrl || !saved.payload) return null;
    return saved.payload;
  }

  function writeCatalogCache(payload) {
    storageSet(CATALOG_CACHE_KEY, {
      savedAt: Date.now(),
      execUrl: activeCliproomExecUrl,
      payload
    });
  }

  function receive(payload) {
    if (!payload || payload.success !== true || !Array.isArray(payload.courses)) return false;
    writeCatalogCache(payload);
    courses = payload.courses;
    if (!courses.length) {
      track.innerHTML = '<div class="cliproom-loading">ยังไม่มีหลักสูตรที่เปิดใช้งาน</div>';
      const dots = document.getElementById('cliproomDots');
      if (dots) dots.innerHTML = '';
      return true;
    }
    render();
    restart();
    return true;
  }

  async function fetchCatalog(execUrl) {
    const payload = await jsonpRequest(execUrl, { mode: 'cliproomBox' });
    if (!payload || payload.success !== true || !Array.isArray(payload.courses)) {
      throw new Error((payload && payload.message) || 'ข้อมูลหลักสูตรไม่สมบูรณ์');
    }
    return payload;
  }

  async function loadCatalog() {
    if (loadingStarted) return;
    loadingStarted = true;
    let attempt = 0;
    let cacheShown = false;

    while (true) {
      try {
        activeCliproomExecUrl = await resolveCliproomExecUrl(attempt > 0);

        if (!cacheShown) {
          const cached = readCatalogCache(activeCliproomExecUrl);
          if (cached && receive(cached)) cacheShown = true;
        }

        const payload = await fetchCatalog(activeCliproomExecUrl);
        receive(payload);
        return;
      } catch (error) {
        attempt += 1;
        clearExecCache();
        const delay = retryDelay(attempt);
        console.warn(`Cliproom catalog retry #${attempt}:`, error);
        if (!courses.length) {
          track.innerHTML = `<div class="cliproom-loading">กำลังโหลดรายการหลักสูตร...<br><small>เชื่อมต่อไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ ครั้งที่ ${attempt}</small></div>`;
        }
        await waitRetry(delay);
      }
    }
  }

  window.cliproomCatalogCallback = payload => receive(payload);
  const prev = document.getElementById('cliproomPrev');
  const next = document.getElementById('cliproomNext');
  if (prev) prev.onclick = event => { event.stopPropagation(); move(-1); };
  if (next) next.onclick = event => { event.stopPropagation(); move(1); };
  window.addEventListener('resize', () => update(false));

  if (window.SiteFast) window.SiteFast.whenNear('cliproomBox', loadCatalog, '900px 0px');
  else loadCatalog();
})();
