(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL + '?mode=facebook';
  const PAGE_SIZE = 4;
  const state = { items: [], filteredItems: [], page: 0 };

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

  function scaleFrames() {
    document.querySelectorAll('.fb-card-preview').forEach(box => {
      const iframe = box.querySelector('iframe');
      if (!iframe) return;
      iframe.style.transform = `scale(${Math.min(1, box.clientWidth / 500)})`;
    });
  }

  function fillAreaFilter(items) {
    const select = document.getElementById('fbAreaFilter');
    const areas = [...new Set(
      items.map(item => String(item.area || '').trim()).filter(Boolean)
    )].sort((a,b) => a.localeCompare(b,'th'));

    select.innerHTML =
      '<option value="">ทุกพื้นที่</option>' +
      areas.map(area => `<option value="${esc(area)}">${esc(area)}</option>`).join('');
  }

  function updateFilteredItems(resetPage = false) {
    const selected = document.getElementById('fbAreaFilter').value;
    state.filteredItems = uniqueLatest(
      state.items.filter(item => !selected || item.area === selected)
    );

    if (resetPage) state.page = 0;

    const maxPage = Math.max(0, Math.ceil(state.filteredItems.length / PAGE_SIZE) - 1);
    if (state.page > maxPage) state.page = maxPage;
  }

  function render() {
    const grid = document.getElementById('fbPageGrid');
    const status = document.getElementById('fbPageStatus');
    const count = document.getElementById('fbResultCount');
    const controls = document.getElementById('fbSliderControls');
    const prevBtn = document.getElementById('fbPrevBtn');
    const nextBtn = document.getElementById('fbNextBtn');
    const indicator = document.getElementById('fbPageIndicator');
    const selected = document.getElementById('fbAreaFilter').value;

    const total = state.filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = state.page * PAGE_SIZE;
    const visibleItems = state.filteredItems.slice(start, start + PAGE_SIZE);

    count.textContent = `พบ ${total} รายการ`;

    if (!total) {
      grid.innerHTML = '';
      status.hidden = false;
      status.textContent = selected ? 'ไม่พบโพสต์ในพื้นที่นี้' : 'ยังไม่มีโพสต์ Facebook';
      controls.hidden = true;
      return;
    }

    status.hidden = true;

    grid.innerHTML = visibleItems.map(item => {
      const embedUrl = safeHttps(item.embedUrl);
      const facebookUrl = safeHttps(item.facebookUrl);
      if (!embedUrl || !facebookUrl) return '';

      return `
        <article class="fb-card" data-url="${esc(facebookUrl)}" tabindex="0" role="link">
          <div class="fb-card-preview">
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
          <div class="fb-card-body">
            <h2 class="fb-card-area">${esc(item.area || 'ไม่ระบุพื้นที่')}</h2>
            ${item.date ? `<div class="fb-card-date"><i class="fa-regular fa-calendar"></i>${esc(item.date)}</div>` : ''}
            <div class="fb-card-open"><i class="fa-brands fa-facebook"></i> เปิดโพสต์บน Facebook</div>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.fb-card').forEach(card => {
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

    controls.hidden = totalPages <= 1;
    prevBtn.disabled = state.page <= 0;
    nextBtn.disabled = state.page >= totalPages - 1;
    indicator.textContent = `${state.page + 1} / ${totalPages}`;

    requestAnimationFrame(scaleFrames);
  }

  function goPrevious() {
    if (state.page <= 0) return;
    state.page -= 1;
    render();
  }

  function goNext() {
    const totalPages = Math.ceil(state.filteredItems.length / PAGE_SIZE);
    if (state.page >= totalPages - 1) return;
    state.page += 1;
    render();
  }

  async function load() {
    const status = document.getElementById('fbPageStatus');
    try {
      const response = await fetch(API_URL + '&_t=' + Date.now(), {cache:'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const result = await response.json();
      if (result.success === false) {
        throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');
      }

      state.items = uniqueLatest(Array.isArray(result.items) ? result.items : []);
      fillAreaFilter(state.items);
      updateFilteredItems(true);
      render();
    } catch (error) {
      console.error('fbpost:', error);
      status.hidden = false;
      status.textContent = 'โหลดโพสต์ Facebook ไม่สำเร็จ';
      document.getElementById('fbSliderControls').hidden = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fbAreaFilter').addEventListener('change', () => {
      updateFilteredItems(true);
      render();
    });
    document.getElementById('fbPrevBtn').addEventListener('click', goPrevious);
    document.getElementById('fbNextBtn').addEventListener('click', goNext);
    load();
  });

  window.addEventListener('resize', scaleFrames);
})();
