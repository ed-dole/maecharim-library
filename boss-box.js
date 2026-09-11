(() => {
  'use strict';

  const BOSS_WEB_APP_URL =
    window.APP_CONFIG.API_URL;
  const TEAM_API_URL = BOSS_WEB_APP_URL + '?mode=team';
  const BOSS_API_URL = BOSS_WEB_APP_URL + '?mode=boss';

  const text = value => String(value ?? '').trim();
  const esc = value => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  let resizeTimer = 0;

  function normalizeTeam(result) {
    const source = result?.team || result?.data?.team || result?.data || result || [];
    if (!Array.isArray(source)) return [];

    return source
      .map((item, index) => Array.isArray(item)
        ? {
            order: text(item[0]) || String(index + 1),
            name: text(item[1]),
            position: text(item[2]),
            image: text(item[3])
          }
        : {
            order: text(item?.order || item?.no || item?.index) || String(index + 1),
            name: text(item?.name || item?.fullName || item?.['ชื่อ'] || item?.['ชื่อ-นามสกุล']),
            position: text(item?.position || item?.title || item?.['ตำแหน่ง']),
            image: text(item?.image || item?.photo || item?.imageUrl || item?.['รูปภาพบุคลากร'])
          })
      .filter(item => item.name || item.position || item.image)
      .sort((a, b) => (Number(a.order) || 999999) - (Number(b.order) || 999999));
  }

  function normalizeBoss(result) {
    const source = result?.boss || result?.data?.boss || result?.data || result || {};
    return {
      image: text(source.image || source.photo || source.url || source['รูป'] || source['รูปภาพ']),
      name: text(source.name || source.fullName || source['ชื่อ']),
      position: text(source.position || source.title || source['ตำแหน่ง']),
      popupImage: text(source.popupImage || source.popup_image || source['รูปป๊อปอัป'] || source['รูป Pop-up']),
      popupUrl: text(source.popupUrl || source.popup_url || source.detailUrl || source['ลิงก์อ่านเพิ่มเติม']),
      popupMode: text(source.popupMode || source.popup_mode || source.mode || source['เปิด/ปิด']).toLowerCase()
    };
  }

  function showBossStatus(message, isError = false) {
    const box = document.getElementById('bossBox');
    const track = document.getElementById('bossTrack');
    if (!box || !track) return;
    box.removeAttribute('hidden');
    track.innerHTML = `<div class="boss-carousel-status${isError ? ' is-error' : ''}">${esc(message || '')}</div>`;
    const prev = document.getElementById('bossPrev');
    const next = document.getElementById('bossNext');
    if (prev) prev.hidden = true;
    if (next) next.hidden = true;
  }

  function hideBossBox() {
    // index.html ต้องคงแถวบุคลากรไว้เสมอ เพื่อไม่ให้แถวบนหายไปเมื่อ API มีปัญหา
    if (document.getElementById('bossTrack')) {
      showBossStatus('ยังไม่มีข้อมูลบุคลากรในชีต boss');
      return;
    }
    document.getElementById('bossBox')?.setAttribute('hidden', '');
  }

  function renderLegacyBoss(boss) {
    const box = document.getElementById('bossBox');
    const photo = document.getElementById('bossPhoto');
    const name = document.getElementById('bossName');
    const position = document.getElementById('bossPosition');
    if (!box || !photo || !name || !position) return;

    if (!boss.image && !boss.name && !boss.position) {
      box.setAttribute('hidden', '');
      return;
    }

    if (boss.image) {
      photo.src = boss.image;
      photo.hidden = false;
    } else {
      photo.removeAttribute('src');
      photo.hidden = true;
    }
    name.textContent = boss.name;
    name.hidden = !boss.name;
    position.textContent = boss.position;
    position.hidden = !boss.position;
    box.removeAttribute('hidden');
  }

  function updateArrows() {
    const viewport = document.getElementById('bossViewport');
    const prev = document.getElementById('bossPrev');
    const next = document.getElementById('bossNext');
    if (!viewport || !prev || !next) return;

    const overflow = viewport.scrollWidth > viewport.clientWidth + 4;
    prev.hidden = !overflow;
    next.hidden = !overflow;
    if (!overflow) return;

    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    prev.disabled = viewport.scrollLeft <= 4;
    next.disabled = viewport.scrollLeft >= maxScroll - 4;
  }

  function renderTeam(items) {
    const box = document.getElementById('bossBox');
    const track = document.getElementById('bossTrack');
    if (!box || !track) return;

    if (!items.length) {
      hideBossBox();
      return;
    }

    track.innerHTML = items.map((item, index) => {
      const image = item.image
        ? `<img class="boss-card-photo" src="${esc(item.image)}" alt="${esc(item.name || 'บุคลากร')}" loading="lazy">`
        : '<span class="boss-card-photo boss-card-photo-placeholder"><i class="fa-solid fa-user" aria-hidden="true"></i></span>';

      return `<article class="boss-card" data-boss-index="${index}">
        <div class="boss-card-photo-wrap">${image}</div>
        <div class="boss-card-text">
          <div class="boss-card-name">${esc(item.name || '-')}</div>
          <div class="boss-card-position">${esc(item.position || '')}</div>
        </div>
      </article>`;
    }).join('');

    box.removeAttribute('hidden');
    requestAnimationFrame(() => {
      const viewport = document.getElementById('bossViewport');
      if (viewport) viewport.scrollLeft = 0;
      updateArrows();
    });
  }

  async function fetchTeam() {
    let firstError = null;

    // 1) homefast ใหม่มี team จาก boss!A:D อยู่แล้ว ลดจำนวน request และแสดงเร็วขึ้น
    try {
      if (window.SiteFast?.getHomeFast) {
        const home = await window.SiteFast.getHomeFast();
        const team = normalizeTeam(home?.data?.team || home?.team || []);
        if (team.length) return team;
      }
    } catch (error) {
      firstError = error;
    }

    // 2) อ่าน mode=team โดยตรง
    try {
      if (window.SiteFast?.fetchMode) {
        const result = await window.SiteFast.fetchMode('team', { _t: Date.now() }, { key: '', ttl: 0 });
        const team = normalizeTeam(result);
        if (team.length || result?.success === true) return team;
      }
    } catch (error) {
      firstError = firstError || error;
    }

    // 3) fallback fetch ตรง ไม่ใช้ cache
    const url = TEAM_API_URL + '&_t=' + Date.now();
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.success === false) {
      throw new Error(result.message || firstError?.message || 'โหลดข้อมูลบุคลากรไม่สำเร็จ');
    }
    return normalizeTeam(result);
  }

  async function loadTeam() {
    try {
      showBossStatus('กำลังโหลดข้อมูลบุคลากร...');
      const items = await fetchTeam();
      if (!items.length) {
        showBossStatus('ยังไม่มีข้อมูลบุคลากรในชีต boss');
        return;
      }
      renderTeam(items);
    } catch (error) {
      console.error('โหลดข้อมูลบุคลากรไม่สำเร็จ:', error);
      showBossStatus(`โหลดข้อมูลบุคลากรไม่สำเร็จ: ${error?.message || error}`, true);
    }
  }

  function bindCarousel() {
    const viewport = document.getElementById('bossViewport');
    const prev = document.getElementById('bossPrev');
    const next = document.getElementById('bossNext');
    if (!viewport || !prev || !next) return;

    const move = direction => {
      const card = viewport.querySelector('.boss-card');
      const gap = 24;
      const step = card ? card.getBoundingClientRect().width + gap : viewport.clientWidth * 0.8;
      viewport.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    viewport.addEventListener('scroll', () => requestAnimationFrame(updateArrows), { passive: true });
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateArrows, 120);
    }, { passive: true });
  }

  function closeBossPopup() {
    const popup = document.getElementById('bossPopup');
    if (!popup) return;
    popup.setAttribute('hidden', '');
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('boss-popup-open');
  }

  function renderBossPopup(boss) {
    const popup = document.getElementById('bossPopup');
    const image = document.getElementById('bossPopupImage');
    const actions = document.getElementById('bossPopupActions');
    const detail = document.getElementById('bossPopupDetail');
    if (!popup || !image || !actions || !detail) return;

    if (boss.popupMode !== 'block' || !boss.popupImage) {
      closeBossPopup();
      return;
    }

    image.src = boss.popupImage;
    if (boss.popupUrl) {
      detail.href = boss.popupUrl;
      actions.removeAttribute('hidden');
    } else {
      detail.removeAttribute('href');
      actions.setAttribute('hidden', '');
    }

    popup.removeAttribute('hidden');
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('boss-popup-open');
  }

  function bindBossPopupEvents() {
    document.getElementById('bossPopupClose')?.addEventListener('click', closeBossPopup);
    document.getElementById('bossPopup')?.addEventListener('click', event => {
      if (event.target.id === 'bossPopup') closeBossPopup();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeBossPopup();
    });
  }

  async function loadBossPopup() {
    try {
      let result;
      if (window.SiteFast) {
        result = { success: true, boss: await window.SiteFast.homePart('boss') };
      } else {
        const response = await fetch(BOSS_API_URL, { method: 'GET', cache: 'default', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      }
      if (result.success === false) throw new Error(result.message || 'โหลดข้อมูล popup ไม่สำเร็จ');
      const boss = normalizeBoss(result);
      if (!document.getElementById('bossTrack')) renderLegacyBoss(boss);
      renderBossPopup(boss);
    } catch (error) {
      console.warn('โหลด popup ผู้บริหารไม่สำเร็จ:', error);
      closeBossPopup();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindBossPopupEvents();
    if (document.getElementById('bossTrack')) {
      bindCarousel();
      loadTeam();
    }
    loadBossPopup();
  });

  document.addEventListener('team-admin-updated', () => {
    if (window.SiteFast?.clear) window.SiteFast.clear('team');
    loadTeam();
  });
})();
