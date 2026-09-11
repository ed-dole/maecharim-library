(() => {
  'use strict';

  const WEB_APP_URL =
    window.APP_CONFIG.API_URL;
  const API_URL = WEB_APP_URL + '?mode=bestpractice';

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeUrl = value => {
    const url = String(value || '').trim();
    if (!/^https?:\/\//i.test(url)) return '';
    return url.replace(/^http:\/\//i, 'https://');
  };

  const dateValue = value => {
    const text=String(value||'').trim();
    const match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(match){let year=Number(match[3]);if(year<100)year+=2500;if(year>2400)year-=543;return new Date(year,Number(match[2])-1,Number(match[1])).getTime()||0;}
    return Date.parse(text)||0;
  };

  async function loadBestPractices() {
    const status = document.getElementById('bestPracticeStatus');
    const grid = document.getElementById('bestPracticeGrid');
    if (!status || !grid) return;

    try {
      const response = await fetch(API_URL + '&_t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success === false) throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');

      const items = (Array.isArray(result.items)
        ? result.items
        : (Array.isArray(result.data) ? result.data : []))
        .slice().sort((a,b)=>dateValue(b.date)-dateValue(a.date)||(Number(b.order)||0)-(Number(a.order)||0));

      status.hidden = true;

      if (!items.length) {
        grid.innerHTML = '<div class="bp-empty">ยังไม่มีรายการ Best Practice</div>';
        return;
      }

      grid.innerHTML = items.map((item, index) => {
        const poster = safeUrl(item.poster || item.image || '');
        const fileUrl = safeUrl(item.fileUrl || item.url || '');
        if (!poster || !fileUrl) return '';

        return `<article class="bp-card">
          <div class="bp-poster-wrap">
            <img class="bp-poster" src="${escapeHtml(poster)}"
                 alt="Best Practice รายการที่ ${index + 1}" loading="lazy">
          </div>
          <a class="bp-open" href="${escapeHtml(fileUrl)}"
             target="_blank" rel="noopener noreferrer">Open file</a>
        </article>`;
      }).join('');

      if (!grid.children.length) {
        grid.innerHTML = '<div class="bp-empty">ไม่พบรายการที่มีรูปโปสเตอร์และลิงก์ไฟล์ครบถ้วน</div>';
      }
    } catch (error) {
      console.error('โหลด Best Practice ไม่สำเร็จ:', error);
      status.hidden = true;
      grid.innerHTML = `<div class="bp-error">โหลดรายการไม่สำเร็จ<br>${escapeHtml(error.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', loadBestPractices);
  document.addEventListener('best-practice-admin-updated', loadBestPractices);
})();
