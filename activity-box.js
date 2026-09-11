(() => {
  'use strict';

  const ACTIVITY_API_URL =
    window.APP_CONFIG.API_URL + '?mode=activity';

  const state = {
    items: []
  };

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function normalizeActivity(row) {
 return {
  title: String(
    row.title ??
    row.topic ??
    ''
  ).trim(),

  image: String(
    row.image ??
    row.imageUrl ??
    ''
  ).trim(),

  url: String(
    row.url ??
    row.link ??
    ''
  ).trim(),

  date: String(
    row.date ??
    ''
  ).trim()
};
  }

  function activityDateValue(value) {
    const text=String(value||'').trim(),match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if(match){let year=Number(match[3]);if(year<100)year+=year>=60?2500:2000;if(year>=2400)year-=543;return new Date(year,Number(match[2])-1,Number(match[1])).getTime()||0}
    const parsed=Date.parse(text);return Number.isNaN(parsed)?0:parsed;
  }


  function renderActivities(items) {
    const grid = document.getElementById('activityBoxGrid');
    const status = document.getElementById('activityBoxStatus');

    if (!grid || !status) return;

    if (!items.length) {
      grid.innerHTML = '';
      status.hidden = false;
      status.textContent = 'ยังไม่มีข้อมูลกิจกรรม';
      return;
    }

    status.hidden = true;

    grid.innerHTML = items.map((item, index) => {
      const title = escapeHtml(item.title || 'กิจกรรม');
      const image = escapeHtml(
        item.image ||
        'https://placehold.co/900x650?text=Activity'
      );
      const url = escapeHtml(item.url || '');
      const clickableClass = item.url ? ' is-clickable' : '';

      return `
        <article class="activity-box-card${clickableClass}">
          <a class="activity-box-image-link"
             href="${url || '#'}"
             ${item.url ? 'target="_blank" rel="noopener noreferrer"' : ''}
             aria-label="เปิดรายละเอียด ${title}"
             ${item.url ? '' : 'aria-disabled="true" tabindex="-1"'}>
            <img
              src="${image}"
              alt="${title}"
              loading="lazy"
              onerror="this.onerror=null;this.src='https://placehold.co/900x650?text=Activity';">
            <span class="activity-box-badge">
              <i class="fa fa-star" aria-hidden="true"></i>
              กิจกรรม
            </span>
          </a>

<div class="activity-box-card-body">

    <h3>${title}</h3>

    ${
      item.date
      ? `<div class="activity-box-date">
            <i class="fa fa-calendar"></i>
            ${escapeHtml(item.date)}
         </div>`
      : ''
    }

</div>
        </article>
      `;
    }).join('');
  }

async function loadActivities() {
  const status = document.getElementById('activityBoxStatus');

  try {
    let result;

    if (window.SiteFast) {
      result = { success: true, activities: await window.SiteFast.homePart('activity') };
    } else {
      const response = await fetch(ACTIVITY_API_URL, { method: 'GET', cache: 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    }

    if (!result.success) {
      throw new Error(
        result.message || 'โหลดข้อมูลกิจกรรมไม่สำเร็จ'
      );
    }

state.items = (result.activities || [])
  .map(normalizeActivity)
  .filter(item => item.title || item.image)
  .sort((a,b)=>activityDateValue(b.date)-activityDateValue(a.date))
  .slice(0, 6);   // แสดงเฉพาะ 6 รายการล่าสุด

    renderActivities(state.items);

  } catch (error) {
    console.error('Activity Box:', error);

    if (status) {
      status.hidden = false;
      status.textContent =
        'ไม่สามารถโหลดข้อมูลกิจกรรมได้ กรุณาตรวจสอบ Apps Script';
    }
  }
}

  document.addEventListener('DOMContentLoaded', loadActivities);
  document.addEventListener('activity-admin-updated', () => {
    window.SiteFast?.clear('homefast');
    loadActivities();
  });
})();
