(() => {
  'use strict';

  const API_URL =
    window.APP_CONFIG.API_URL;

  const fields = {
    userTotal: 'userTotalBox',
    userPrimary: 'userPrimaryBox',
    userMiddle: 'userMiddleBox',
    userHigh: 'userHighBox',
    adminTotal: 'adminTotalBox',
    adminPrimary: 'adminPrimaryBox',
    adminMiddle: 'adminMiddleBox',
    adminHigh: 'adminHighBox',
    registrationCount: 'registrationCountBox',
    loginCount: 'loginCountBox',
    adminLoginCount: 'adminLoginCountBox',
    userLoginCount: 'userLoginCountBox',
    websiteVisitCount: 'websiteVisitCountBox'
  };

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value || 0).toLocaleString('th-TH');
  }

  async function loadHomeSummary() {
    const section = document.getElementById('homeSection');
    if (!section) return;

    section.classList.add('home-summary-loading');

    try {
      const url = new URL(API_URL);
      url.searchParams.set('mode', 'homeSummary');
      const response = window.SiteFast
        ? await window.SiteFast.fetchMode('homeSummary', {}, { key: '', ttl: 0 }).then(data => ({ ok: true, json: async () => data }))
        : await fetch(url.toString(), { cache: 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (result.success === false) {
        throw new Error(result.message || 'โหลดข้อมูลสรุปไม่สำเร็จ');
      }

      const data = result.data || result;
      Object.entries(fields).forEach(([key, id]) => setValue(id, data[key]));
    } catch (error) {
      console.error('loadHomeSummary error:', error);
    } finally {
      section.classList.remove('home-summary-loading');
    }
  }

  function scheduleHomeSummary() {
    const run = () => loadHomeSummary();
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1800 });
    else setTimeout(run, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHomeSummary, { once: true });
  } else {
    scheduleHomeSummary();
  }
})();
