(() => {
  'use strict';

  // Web App เดิมของระบบหลัก (ไม่ต้องสร้าง Apps Script แยก)
  const STUDENT_SERVICE_API_URL =
    window.APP_CONFIG.API_URL;

  const LEVELS = ['ประถม', 'ม.ต้น', 'ม.ปลาย'];
  const MEDALS = ['🥇1', '🥈2', '🥉3'];
  const CACHE_KEY = 'studentServiceTop3:v1';
  const CACHE_AGE = 5 * 60 * 1000;
  const AUTO_ROTATE_DELAY = 4000;
  let rankingData = null;
  let autoRotateTimer = null;
  let activeLevelIndex = 0;
  let autoRotateStoppedByUser = false;

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return cached && Date.now() - cached.savedAt < CACHE_AGE
        ? cached.data
        : null;
    } catch (_) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {}
  }

  function renderCard(card, level) {
    const type = card.dataset.rankingType;
    const ranking = card.querySelector('.student-service-ranking');
    const rows = rankingData && rankingData[type] && Array.isArray(rankingData[type][level])
      ? rankingData[type][level].slice(0, 3)
      : [];

    card.querySelectorAll('.student-service-tabs button').forEach(button => {
      const active = button.dataset.level === level;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });

    if (!rows.length) {
      ranking.innerHTML = '<span class="student-service-ranking-status">ยังไม่มีข้อมูล</span>';
      return;
    }

    ranking.innerHTML = rows.map((row, index) => `
      <span title="${escapeHtml(row.teacher)}">
        ${MEDALS[index]} &nbsp;${escapeHtml(row.teacher)}
      </span>
      <b title="${Number(row.percent || 0).toFixed(2)}%">
        ${Number(row.percent || 0).toFixed(2)}%
      </b>
    `).join('');
  }

  function renderAll(level) {
    document.querySelectorAll('[data-ranking-type]').forEach(card => {
      const active = card.querySelector('.student-service-tabs .is-active');
      renderCard(card, level || (active ? active.dataset.level : LEVELS[0]));
    });
  }

  function stopAutoRotate() {
    if (autoRotateTimer) {
      window.clearInterval(autoRotateTimer);
      autoRotateTimer = null;
    }
  }

  function startAutoRotate() {
    stopAutoRotate();
    if (autoRotateStoppedByUser || !rankingData) return;

    autoRotateTimer = window.setInterval(() => {
      activeLevelIndex = (activeLevelIndex + 1) % LEVELS.length;
      renderAll(LEVELS[activeLevelIndex]);
    }, AUTO_ROTATE_DELAY);
  }

  function showError(message) {
    document.querySelectorAll('[data-ranking-type] .student-service-ranking').forEach(box => {
      box.innerHTML = `<span class="student-service-ranking-status">${escapeHtml(message)}</span>`;
    });
  }

  async function loadRankings() {
    rankingData = readCache();
    if (rankingData) {
      activeLevelIndex = 0;
      renderAll(LEVELS[activeLevelIndex]);
      startAutoRotate();
      return;
    }

    if (!/^https:\/\/script\.google\.com\/macros\/s\//.test(STUDENT_SERVICE_API_URL)) {
      showError('กรุณาตั้งค่า URL Apps Script');
      return;
    }

    try {
      let result;
      if (window.SiteFast) {
        result = await window.SiteFast.fetchMode(
          'studentServiceTop3',
          {},
          { key: 'studentServiceTop3:v2', ttl: CACHE_AGE }
        );
      } else {
        const separator = STUDENT_SERVICE_API_URL.includes('?') ? '&' : '?';
        const response = await fetch(
          `${STUDENT_SERVICE_API_URL}${separator}mode=studentServiceTop3`,
          { method: 'GET', cache: 'default' }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      }
      if (!result || (!result.worksheet && !result.quiz)) {
        throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      }

      rankingData = result;
      writeCache(result);
      activeLevelIndex = 0;
      renderAll(LEVELS[activeLevelIndex]);
      startAutoRotate();
    } catch (error) {
      console.error('Student service ranking:', error);
      showError('โหลดอันดับไม่สำเร็จ');
    }
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('.student-service-tabs button');
    if (!tab) return;

    autoRotateStoppedByUser = true;
    stopAutoRotate();

    activeLevelIndex = Math.max(0, LEVELS.indexOf(tab.dataset.level));
    if (rankingData) renderAll(LEVELS[activeLevelIndex]);
  });

  function scheduleRankings() {
    if (window.SiteFast) window.SiteFast.whenNear('studentServicesBox', loadRankings, '700px 0px');
    else if ('requestIdleCallback' in window) requestIdleCallback(loadRankings, { timeout: 2200 });
    else setTimeout(loadRankings, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRankings, { once: true });
  } else {
    scheduleRankings();
  }
})();
