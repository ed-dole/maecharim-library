(() => {
  'use strict';

  const WEB_APP_URL =
    window.APP_CONFIG.API_URL;
  const API_URL = WEB_APP_URL + '?mode=course';
  let allItems = [];

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

  function getFilteredItems() {
    const search = document.getElementById('courseSearch');
    const keyword = String(search?.value || '').trim().toLocaleLowerCase('th');
    if (!keyword) return allItems;

    return allItems.filter(item => [
      item.courseName,
      item.teacherName,
      item.uploadDate,
      item.area
    ].join(' ').toLocaleLowerCase('th').includes(keyword));
  }

  function renderTable() {
    const body = document.getElementById('courseTableBody');
    const count = document.getElementById('courseCount');
    if (!body || !count) return;

    const items = getFilteredItems();
    count.textContent = `จำนวน ${items.length} รายการ`;

    if (!items.length) {
      body.innerHTML = '<tr><td class="course-empty" colspan="5">ไม่พบรายการหลักสูตรที่ค้นหา</td></tr>';
      return;
    }

    body.innerHTML = items.map((item, index) => {
      const fileUrl = safeUrl(item.fileUrl);
      const button = fileUrl
        ? `<a class="course-download" href="${escapeHtml(fileUrl)}"
             target="_blank" rel="noopener noreferrer">ดาวน์โหลดไฟล์</a>`
        : '<span class="course-no-file">ไม่มีไฟล์</span>';

      return `<tr>
        <td class="course-number">${index + 1}</td>
        <td class="course-name">${escapeHtml(item.courseName || '-')}</td>
        <td>${escapeHtml(item.teacherName || '-')}</td>
        <td>${escapeHtml(item.uploadDate || '-')}</td>
        <td class="course-download-cell">${button}</td>
      </tr>`;
    }).join('');
  }

  async function loadCourses() {
    const status = document.getElementById('courseStatus');
    const body = document.getElementById('courseTableBody');
    const count = document.getElementById('courseCount');

    try {
      const response = await fetch(API_URL, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (result.success === false) throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');

      allItems = (Array.isArray(result.items) ? result.items : [])
        .map(item => ({
          courseName: String(item.courseName || '').trim(),
          teacherName: String(item.teacherName || '').trim(),
          uploadDate: String(item.uploadDate || '').trim(),
          fileUrl: String(item.fileUrl || '').trim(),
          area: String(item.area || '').trim()
        }))
        .filter(item => item.courseName || item.teacherName || item.uploadDate || item.fileUrl);

      status.hidden = true;
      renderTable();
    } catch (error) {
      console.error('โหลดคลังหลักสูตรไม่สำเร็จ:', error);
      status.hidden = true;
      count.textContent = 'โหลดข้อมูลไม่สำเร็จ';
      body.innerHTML = `<tr><td class="course-error" colspan="5">โหลดรายการไม่สำเร็จ<br>${escapeHtml(error.message)}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('courseSearch')?.addEventListener('input', renderTable);
    loadCourses();
  });
  document.addEventListener('course-admin-updated', loadCourses);
})();
