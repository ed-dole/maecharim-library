(() => {
  'use strict';

  const WEB_APP_URL =
    window.APP_CONFIG.API_URL;
  const API_URL = WEB_APP_URL + '?mode=reward';
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

  function mainImageHtml(item, className) {
    const image = safeUrl(item.mainImage);
    if (!image) {
      return `<div class="${className} reward-image-empty">ไม่มีรูปภาพรางวัล</div>`;
    }
    return `<img class="${className}" src="${escapeHtml(image)}"
                 alt="${escapeHtml(item.award || 'รูปภาพรางวัล')}" loading="lazy">`;
  }

  function getFilteredItems() {
    const input = document.getElementById('rewardSearch');
    const keyword = String(input?.value || '').trim().toLocaleLowerCase('th');
    if (!keyword) return allItems;

    return allItems.filter(item => [
      item.award,
      item.recipient,
      item.organization,
      item.receivedDate,
      item.area
    ].join(' ').toLocaleLowerCase('th').includes(keyword));
  }

  function renderItems() {
    const grid = document.getElementById('rewardGrid');
    if (!grid) return;

    const items = getFilteredItems();
    if (!items.length) {
      grid.innerHTML = '<div class="reward-empty">ไม่พบรายการรางวัลที่ค้นหา</div>';
      return;
    }

    grid.innerHTML = items.map(item => {
      const realIndex = allItems.indexOf(item);
      return `<article class="reward-card" role="button" tabindex="0"
                       data-reward-index="${realIndex}"
                       aria-label="เปิดรายละเอียด ${escapeHtml(item.award || 'รางวัล')}">
        <div class="reward-card-image-wrap">
          ${mainImageHtml(item, 'reward-card-image')}
        </div>
        <h2>${escapeHtml(item.award || 'ไม่ระบุชื่อรางวัล')}</h2>
      </article>`;
    }).join('');
  }

  function detailImagesHtml(images) {
    const validImages = (Array.isArray(images) ? images : [])
      .map(safeUrl)
      .filter(Boolean);

    if (!validImages.length) {
      return '<div class="reward-no-support-images">ไม่มีรูปประกอบ</div>';
    }

    return `<div class="reward-support-grid">
      ${validImages.map((url, index) => `
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
           aria-label="เปิดรูปประกอบ ${index + 1}">
          <img src="${escapeHtml(url)}" alt="รูปประกอบ ${index + 1}" loading="lazy">
        </a>`).join('')}
    </div>`;
  }

  function openModal(index) {
    const item = allItems[index];
    const modal = document.getElementById('rewardModal');
    const content = document.getElementById('rewardModalContent');
    if (!item || !modal || !content) return;

    const detailUrl = safeUrl(item.detailUrl);
    const detailButton = detailUrl
      ? `<a class="reward-detail-button" href="${escapeHtml(detailUrl)}"
            target="_blank" rel="noopener noreferrer">รายละเอียดเพิ่มเติม</a>`
      : '';

    content.innerHTML = `<div class="reward-modal-layout">
      <div class="reward-modal-main-image-wrap">
        ${mainImageHtml(item, 'reward-modal-main-image')}
      </div>
      <div class="reward-modal-info">
        <dl>
          <div><dt>รางวัล</dt><dd id="rewardModalTitle">${escapeHtml(item.award || '-')}</dd></div>
          <div><dt>ผู้ได้รับรางวัล</dt><dd>${escapeHtml(item.recipient || '-')}</dd></div>
          <div><dt>จากหน่วยงาน</dt><dd>${escapeHtml(item.organization || '-')}</dd></div>
          <div><dt>วันที่ได้รับ</dt><dd>${escapeHtml(item.receivedDate || '-')}</dd></div>
          ${item.date ? `<div><dt>วันที่เพิ่มรายการ</dt><dd>${escapeHtml(item.date)}</dd></div>` : ''}
        </dl>
        <section class="reward-support-section">
          <h3>รูปภาพประกอบ</h3>
          ${detailImagesHtml(item.images)}
        </section>
        ${detailButton}
      </div>
    </div>`;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('reward-modal-open');
    document.getElementById('rewardModalClose')?.focus();
  }

  function closeModal() {
    const modal = document.getElementById('rewardModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('reward-modal-open');
  }

  function bindEvents() {
    const grid = document.getElementById('rewardGrid');
    const search = document.getElementById('rewardSearch');
    const modal = document.getElementById('rewardModal');
    const close = document.getElementById('rewardModalClose');

    search?.addEventListener('input', renderItems);
    grid?.addEventListener('click', event => {
      const card = event.target.closest('[data-reward-index]');
      if (card) openModal(Number(card.dataset.rewardIndex));
    });
    grid?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-reward-index]');
      if (!card) return;
      event.preventDefault();
      openModal(Number(card.dataset.rewardIndex));
    });
    close?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal?.hidden) closeModal();
    });
  }

  async function loadRewards() {
    const status = document.getElementById('rewardStatus');
    const grid = document.getElementById('rewardGrid');

    try {
      const response = await fetch(API_URL, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success === false) throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');

      allItems = (Array.isArray(result.items) ? result.items : [])
        .map(item => ({
          mainImage: String(item.mainImage || '').trim(),
          award: String(item.award || '').trim(),
          recipient: String(item.recipient || '').trim(),
          organization: String(item.organization || '').trim(),
          images: Array.isArray(item.images) ? item.images.map(String) : [],
          receivedDate: String(item.receivedDate || '').trim(),
          detailUrl: String(item.detailUrl || '').trim(),
          date: String(item.date || '').trim(),
          area: String(item.area || '').trim()
        }))
        .filter(item => item.mainImage || item.award || item.recipient || item.organization);

      status.hidden = true;
      if (!allItems.length) {
        grid.innerHTML = '<div class="reward-empty">ยังไม่มีรายการรางวัลหรือเกียรติบัตร</div>';
        return;
      }
      renderItems();
    } catch (error) {
      console.error('โหลดรายการรางวัลไม่สำเร็จ:', error);
      status.hidden = true;
      grid.innerHTML = `<div class="reward-error">โหลดรายการไม่สำเร็จ<br>${escapeHtml(error.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadRewards();
  });
  document.addEventListener('reward-admin-updated', loadRewards);
})();
