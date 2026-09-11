(() => {
  'use strict';

  const MAIN_API_URL =
    (window.SiteFast && window.SiteFast.API_URL) ||
    (window.APP_CONFIG && window.APP_CONFIG.API_URL) ||
    '';
  const CACHE_KEY = 'SITE_FAST:cliproom-catalog-v2-dynamic-exec';
  const CACHE_AGE = 5 * 60 * 1000;
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

  async function resolveCliproomExecUrl() {
    const mainApi = String(MAIN_API_URL || '').trim();
    if (!mainApi) throw new Error('ไม่พบ URL ของ Apps Script หลัก');

    const url = new URL(mainApi);
    url.searchParams.set('mode', 'cliproomexec');
    url.searchParams.set('_t', String(Date.now()));

    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    });
    const result = await response.json();
    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || `HTTP ${response.status}`);
    }

    const execUrl = String(result?.url || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec(?:[?#].*)?$/i.test(execUrl)) {
      throw new Error('URL Cliproom จากชีตไม่ถูกต้อง');
    }
    return execUrl;
  }

  function render() {
    if (!courses.length) {
      track.innerHTML = '<div class="cliproom-loading cliproom-error">ยังโหลดรายการหลักสูตรไม่ได้<br>กรุณาตรวจสอบ URL Cliproom ในชีตและ Deployment ของ Apps Script</div>';
      document.getElementById('cliproomDots').innerHTML = '';
      return;
    }

    track.innerHTML = courses.map(course => `
      <article class="cliproom-card" tabindex="0" role="link" aria-label="เปิดหลักสูตร ${esc(course.title)}">
        <span class="cliproom-cover">
          ${course.coverUrl ? `<img src="${esc(course.coverUrl)}" alt="${esc(course.title)}" loading="lazy">` : ''}
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
    if (card) {
      track.style.transform = `translateX(-${page * perPage * (card.getBoundingClientRect().width + 18)}px)`;
    }
    const dots = document.getElementById('cliproomDots');
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
    document.getElementById('cliproomPrev').disabled = page === 0;
    document.getElementById('cliproomNext').disabled = page === count - 1;
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

  function readCache(execUrl) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!saved || saved.execUrl !== execUrl || Date.now() - saved.savedAt > CACHE_AGE) return null;
      return saved.payload;
    } catch (_) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        execUrl: activeCliproomExecUrl,
        payload
      }));
    } catch (_) {}
  }

  function receive(payload) {
    clearTimeout(window.__cliproomTimeout);
    if (payload?.success && Array.isArray(payload.courses)) writeCache(payload);
    courses = payload?.success && Array.isArray(payload.courses) ? payload.courses : [];
    render();
    restart();
  }

  async function loadCatalog() {
    if (loadingStarted) return;
    loadingStarted = true;

    try {
      activeCliproomExecUrl = await resolveCliproomExecUrl();
      const cached = readCache(activeCliproomExecUrl);
      if (cached) {
        receive(cached);
        return;
      }

      window.cliproomCatalogCallback = receive;
      const catalogUrl = new URL(activeCliproomExecUrl);
      catalogUrl.searchParams.set('mode', 'cliproomBox');
      catalogUrl.searchParams.set('callback', 'cliproomCatalogCallback');
      catalogUrl.searchParams.set('_t', String(Date.now()));

      const script = document.createElement('script');
      script.src = catalogUrl.toString();
      script.async = true;
      script.onerror = () => receive(null);
      document.head.appendChild(script);
      window.__cliproomTimeout = setTimeout(() => receive(null), 12000);
    } catch (error) {
      console.error('โหลด URL Cliproom ไม่สำเร็จ:', error);
      receive(null);
    }
  }

  window.cliproomCatalogCallback = receive;
  document.getElementById('cliproomPrev').onclick = event => { event.stopPropagation(); move(-1); };
  document.getElementById('cliproomNext').onclick = event => { event.stopPropagation(); move(1); };
  window.addEventListener('resize', () => update(false));

  if (window.SiteFast) window.SiteFast.whenNear('cliproomBox', loadCatalog);
  else loadCatalog();
})();
