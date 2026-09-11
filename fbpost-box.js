(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL + '?mode=facebook';
  const MAX_HOME_ITEMS = 8;

  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');

  const safeHttps = value => {
    const url = String(value || '').trim();
    return /^https:\/\//i.test(url) ? url : '';
  };

  function dateValue(dateText) {
    const text = String(dateText || '').trim();
    if (!text) return 0;

    const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!match) {
      const parsed = Date.parse(text);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    let day = Number(match[1]);
    let month = Number(match[2]) - 1;
    let year = Number(match[3]);

    if (year < 100) year += 2500;
    if (year >= 2400) year -= 543;

    return new Date(year, month, day).getTime();
  }

  function sortLatest(items) {
    return [...items].sort((a, b) => {
      const byExactTime = Number(b.sortTime || 0) - Number(a.sortTime || 0);
      if (byExactTime !== 0) return byExactTime;
      const byDate = dateValue(b.date) - dateValue(a.date);
      if (byDate !== 0) return byDate;
      return String(a.area || '').localeCompare(String(b.area || ''), 'th');
    });
  }

  function uniqueLatest(items) {
    const seen = new Set();
    return sortLatest(items).filter(item => {
      const key = String(item.facebookUrl || item.embedUrl || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function scaleFacebookFrames(root) {
    root.querySelectorAll('.fbpost-box-preview').forEach(box => {
      const iframe = box.querySelector('iframe');
      if (!iframe) return;
      const scale = Math.min(1, box.clientWidth / 500);
      iframe.style.transform = `scale(${scale})`;
    });
  }

  function render(items) {
    const status = document.getElementById('fbpostBoxStatus');
    const grid = document.getElementById('fbpostBoxGrid');
    if (!status || !grid) return;

    const rows = uniqueLatest(items).slice(0, MAX_HOME_ITEMS);

    if (!rows.length) {
      status.hidden = false;
      status.textContent = 'ยังไม่มีโพสต์ Facebook';
      grid.innerHTML = '';
      return;
    }

    status.hidden = true;
    grid.innerHTML = rows.map(item => {
      const embedUrl = safeHttps(item.embedUrl);
      const facebookUrl = safeHttps(item.facebookUrl);
      if (!embedUrl || !facebookUrl) return '';

      return `
        <article class="fbpost-box-card" data-url="${esc(facebookUrl)}" tabindex="0" role="link">
          <div class="fbpost-box-preview">
            <iframe
              src="${esc(embedUrl)}"
              title="โพสต์ Facebook ${esc(item.area || '')}"
              loading="lazy"
              scrolling="no"
              frameborder="0"
              allowfullscreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share">
            </iframe>
          </div>
          <div class="fbpost-box-card-body">
            <h3 class="fbpost-box-area">${esc(item.area || 'ไม่ระบุพื้นที่')}</h3>
            ${item.date ? `<div class="fbpost-box-date"><i class="fa-regular fa-calendar"></i>${esc(item.date)}</div>` : ''}
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.fbpost-box-card').forEach(card => {
      const open = () => {
        const url = card.dataset.url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });

    requestAnimationFrame(() => scaleFacebookFrames(grid));
  }

  async function load() {
    const status = document.getElementById('fbpostBoxStatus');
    const grid = document.getElementById('fbpostBoxGrid');
    if (!status || !grid) return;

    try {
      let result;
      if (window.SiteFast) {
        result = await window.SiteFast.fetchMode('facebook', {}, { key: 'facebook-home-v2', ttl: 180000 });
      } else {
        const response = await fetch(API_URL, { method:'GET', cache:'default' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        result = await response.json();
      }
      if (result.success === false) {
        throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');
      }

      render(Array.isArray(result.items) ? result.items : []);
    } catch (error) {
      console.error('FBpostBox:', error);
      status.hidden = false;
      status.textContent = 'โหลดโพสต์ Facebook ไม่สำเร็จ';
      grid.innerHTML = '';
    }
  }

  window.addEventListener('resize', () => {
    const grid = document.getElementById('fbpostBoxGrid');
    if (grid) scaleFacebookFrames(grid);
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (window.SiteFast) window.SiteFast.whenNear('FBpostBox', load);
    else load();
  });
  document.addEventListener('facebook-admin-updated', load);
})();
