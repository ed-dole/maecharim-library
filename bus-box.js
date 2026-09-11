(() => {
  'use strict';

  const BUS_WEB_APP_URL =
    window.APP_CONFIG.API_URL;
  const BUS_API_URL = BUS_WEB_APP_URL + '?mode=bus';

  let busItems = [];
  let busIndex = 0;

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function normalizeBusItem(row) {
    return {
      place: String(row.place || row.location || row['สถานที่จัดกิจกรรม'] || '').trim(),
      vehicle: String(row.vehicle || row.busType || row['ประเภทรถ'] || '').trim(),
      date: String(row.date || row.activityDate || row['วันที่จัดกิจกรรม'] || '').trim(),
      time: String(row.time || row.activityTime || row['เวลาจัดกิจกรรม'] || '').trim(),
      detail: String(row.detail || row.activity || row['กิจกรรมที่น่าสนใจ'] || '').trim()
    };
  }

  async function loadBus() {
    try {
      const response = await fetch(BUS_API_URL + '&_t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (result.success === false) {
        throw new Error(result.message || 'โหลดข้อมูลรถโมบายไม่สำเร็จ');
      }

      const raw = result.items || result.data?.items || result.data || [];
      busItems = (Array.isArray(raw) ? raw : [])
        .map(normalizeBusItem)
        .filter(item => item.place || item.vehicle || item.date || item.time || item.detail);

      if (!busItems.length) {
        hideBusBox();
        return;
      }

      busIndex = 0;
      showBusBox();
      renderBus();
    } catch (error) {
      console.error('โหลดข้อมูลกิจกรรมรถโมบายไม่สำเร็จ:', error);
      hideBusBox();
    }
  }

  function bindBusControls() {
    document.getElementById('busPrev')?.addEventListener('click', () => {
      if (!busItems.length) return;
      busIndex = (busIndex - 1 + busItems.length) % busItems.length;
      renderBus();
    });

    document.getElementById('busNext')?.addEventListener('click', () => {
      if (!busItems.length) return;
      busIndex = (busIndex + 1) % busItems.length;
      renderBus();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindBusControls();
    loadBus();
  });
})();
