(() => {
  'use strict';

  const API_URL =
    window.APP_CONFIG.API_URL;

  let loadPromise = null;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeUrl = value => {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) ? url.replace(/^http:\/\//i, 'https://') : '';
  };

  function dateValue(value) {
    const text = String(value || '').trim();
    if (!text) return 0;
    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (match) {
      let year = Number(match[3]);
      if (year < 100) year += 2500;
      if (year >= 2400) year -= 543;
      return new Date(year, Number(match[2]) - 1, Number(match[1])).getTime() || 0;
    }
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function normalize(item, index) {
    return {
      order: String(item?.order ?? item?.no ?? (index + 1)).trim(),
      poster: safeUrl(item?.poster || item?.image || ''),
      fileUrl: safeUrl(item?.fileUrl || item?.url || ''),
      date: String(item?.date || '').trim()
    };
  }

  function render(items) {
    const status = document.getElementById('bestPracticeBoxStatus');
    const slider = document.getElementById('bestPracticeBoxSlider');
    const track = document.getElementById('bestPracticeBoxTrack');
    if (!status || !slider || !track) return;

    const rows = (Array.isArray(items) ? items : [])
      .map(normalize)
      .filter(item => item.poster || item.fileUrl)
      .sort((a, b) => dateValue(b.date) - dateValue(a.date) || Number(b.order || 0) - Number(a.order || 0));

    if (!rows.length) {
      status.hidden = false;
      status.textContent = 'ยังไม่มีรายการ Best Practice ในชีต best_practice';
      slider.hidden = true;
      track.innerHTML = '';
      return;
    }

    status.hidden = true;
    slider.hidden = false;

    track.innerHTML = rows.map((item, index) => {
      const poster = item.poster || 'https://placehold.co/900x1200?text=Best+Practice';
      const href = item.fileUrl || 'best_practice.html';
      const order = esc(item.order || String(index + 1));
      return `
        <article class="best-practice-box-card">
          <a class="best-practice-box-card-link" href="${esc(href)}" ${item.fileUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="เปิด Best Practice ลำดับ ${order}">
            <div class="best-practice-box-poster-wrap">
              <img class="best-practice-box-poster" src="${esc(poster)}" alt="Best Practice ลำดับ ${order}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/900x1200?text=Best+Practice';">
              <span class="best-practice-box-badge">BEST PRACTICE</span>
            </div>
            <div class="best-practice-box-card-body">
              <strong>Best Practice ${order}</strong>
              ${item.date ? `<span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${esc(item.date)}</span>` : ''}
            </div>
          </a>
        </article>`;
    }).join('');

    requestAnimationFrame(updateArrows);
  }

  function getViewport() {
    return document.getElementById('bestPracticeBoxViewport');
  }

  function updateArrows() {
    const viewport = getViewport();
    const prev = document.getElementById('bestPracticeBoxPrev');
    const next = document.getElementById('bestPracticeBoxNext');
    if (!viewport || !prev || !next) return;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth - 2);
    prev.disabled = viewport.scrollLeft <= 2;
    next.disabled = viewport.scrollLeft >= max;
  }

  function slide(direction) {
    const viewport = getViewport();
    if (!viewport) return;
    const card = viewport.querySelector('.best-practice-box-card');
    const gap = 18;
    const step = card ? (card.getBoundingClientRect().width + gap) : viewport.clientWidth * 0.9;
    const visible = card ? Math.max(1, Math.floor((viewport.clientWidth + gap) / step)) : 1;
    viewport.scrollBy({ left: direction * step * visible, behavior: 'smooth' });
  }

  async function directFetch() {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 18000) : null;
    try {
      const url = API_URL + '?mode=bestpractice&_t=' + Date.now();
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller?.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchBestPractice() {
    // ใช้ SiteFast ก่อน แต่ถ้าเกิดปัญหาให้ fallback ยิง Apps Script โดยตรง
    if (window.SiteFast?.fetchMode) {
      try {
        return await window.SiteFast.fetchMode('bestpractice', { v: '2' }, {
          key: 'best-practice-home-v2',
          ttl: 120000
        });
      } catch (siteFastError) {
        console.warn('Best Practice SiteFast fallback:', siteFastError);
      }
    }
    return directFetch();
  }

  async function load(force = false) {
    if (loadPromise && !force) return loadPromise;

    const status = document.getElementById('bestPracticeBoxStatus');
    const slider = document.getElementById('bestPracticeBoxSlider');
    if (!status) return;

    status.hidden = false;
    status.textContent = 'กำลังโหลด Best Practice...';
    if (slider) slider.hidden = true;

    loadPromise = (async () => {
      try {
        const result = await fetchBestPractice();
        if (result?.success === false) throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');
        const items = Array.isArray(result?.items)
          ? result.items
          : (Array.isArray(result?.data) ? result.data : []);
        render(items);
      } catch (error) {
        console.error('Best Practice Box:', error);
        status.hidden = false;
        status.textContent = 'โหลด Best Practice ไม่สำเร็จ: ' + (error?.message || 'ไม่ทราบสาเหตุ');
        if (slider) slider.hidden = true;
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  function init() {
    document.getElementById('bestPracticeBoxPrev')?.addEventListener('click', () => slide(-1));
    document.getElementById('bestPracticeBoxNext')?.addEventListener('click', () => slide(1));
    getViewport()?.addEventListener('scroll', updateArrows, { passive: true });

    // ลด request ตอนเปิดหน้าแรก: โหลดเมื่อใกล้ SECTION แต่ยังเริ่มก่อนผู้ใช้เลื่อนถึงจริง
    if (window.SiteFast?.whenNear) window.SiteFast.whenNear('bestPracticeBox', load, '1000px 0px');
    else load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('resize', updateArrows);
  window.addEventListener('pageshow', event => {
    if (event.persisted && document.getElementById('bestPracticeBoxStatus')?.textContent.includes('กำลังโหลด')) {
      load(true);
    }
  });

  document.addEventListener('best-practice-admin-updated', () => {
    window.SiteFast?.clear('best-practice-home');
    load(true);
  });
})();
