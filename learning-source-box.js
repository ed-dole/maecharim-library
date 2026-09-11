(() => {
  'use strict';

  const WEB_APP_URL =
    window.APP_CONFIG.API_URL;

  const $ = id => document.getElementById(id);
  let currentArea = null;

  const esc = value =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const escAttr = esc;

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const clampPercent = value => Math.max(0, Math.min(100, num(value)));

  const formatNumber = value => num(value).toLocaleString('th-TH');

  const sourceImage = source =>
    source?.image_url || source?.image2_url || source?.image3_url || '';

  function sourceUrl(source) {
    const url = new URL('learning.html', window.location.href);
    if (source?.id) url.searchParams.set('id', source.id);
    if (currentArea?.name) url.searchParams.set('area', currentArea.name);
    url.searchParams.set('source', 'index-map');
    return url.href;
  }

  function markerHtml(source, index) {
    const image = sourceImage(source);
    const x = clampPercent(source.map_x ?? 50);
    const y = clampPercent(source.map_y ?? 50);
    const color = /^#[0-9a-f]{6}$/i.test(String(source.marker_color || ''))
      ? source.marker_color
      : '#ef4444';

    return `
      <button
        class="lsb-source-marker"
        type="button"
        data-source-id="${escAttr(source.id)}"
        data-source-index="${index}"
        style="left:${x}%;top:${y}%;--lsb-source-color:${escAttr(color)}"
        aria-label="${escAttr(source.name || 'แหล่งเรียนรู้')}"
      >
        <span class="lsb-source-pin" aria-hidden="true">
          <i class="fa-solid fa-location-dot"></i>
        </span>
        <span class="lsb-source-marker-name">${esc(source.name || 'แหล่งเรียนรู้')}</span>

        <span class="lsb-source-popup" role="tooltip">
          ${image ? `
            <img src="${escAttr(image)}" alt="${escAttr(source.name || '')}" loading="lazy">
          ` : `
            <span class="lsb-source-popup-noimage">ไม่มีรูปภาพ</span>
          `}
          <span class="lsb-source-popup-body">
            <strong>${esc(source.name || 'แหล่งเรียนรู้')}</strong>
            ${source.category ? `<small><i class="fa-solid fa-tag"></i>${esc(source.category)}</small>` : ''}
            ${source.address ? `<small><i class="fa-solid fa-location-dot"></i>${esc(source.address)}</small>` : ''}
            <span class="lsb-source-popup-stats">
              <span><i class="fa-solid fa-star"></i>${formatNumber(source.averageRating || 0)}</span>
              <span><i class="fa-regular fa-eye"></i>${formatNumber(source.views || 0)}</span>
            </span>
            <em>คลิกเพื่อดูรายละเอียด</em>
          </span>
        </span>
      </button>
    `;
  }

  function slideCardHtml(source, index) {
    const image = sourceImage(source);
    return `
      <article
        class="lsb-source-slide-card"
        data-source-card="${escAttr(source.id)}"
        data-source-index="${index}"
        tabindex="0"
        role="button"
        aria-label="ดูรายละเอียด ${escAttr(source.name || 'แหล่งเรียนรู้')}"
      >
        <div class="lsb-source-slide-image">
          ${image ? `
            <img src="${escAttr(image)}" alt="${escAttr(source.name || '')}" loading="lazy">
          ` : `
            <div class="lsb-source-slide-noimage"><i class="fa-regular fa-image"></i></div>
          `}
          ${source.category ? `<span class="lsb-source-slide-category">${esc(source.category)}</span>` : ''}
        </div>
        <div class="lsb-source-slide-info">
          <strong>${esc(source.name || 'แหล่งเรียนรู้')}</strong>
          <span>
            <i class="fa-solid fa-star" aria-hidden="true"></i>
            ${formatNumber(source.averageRating || 0)}
            <b>•</b>
            <i class="fa-regular fa-eye" aria-hidden="true"></i>
            ${formatNumber(source.views || 0)}
          </span>
        </div>
      </article>
    `;
  }

  function renderExplorer(area) {
    const grid = $('lsbAreaGrid');
    const showAllWrap = $('lsbShowAllWrap');
    if (!grid) return;

    currentArea = area || {};
    const sources = Array.isArray(currentArea.sources) ? currentArea.sources : [];
    const mapImage = currentArea.mapImage || sourceImage(sources[0]) || '';

    if (showAllWrap) showAllWrap.hidden = true;

    grid.innerHTML = `
      <div class="lsb-map-explorer">
        <div class="lsb-main-map-wrap">
          <div class="lsb-main-map" aria-label="${escAttr(currentArea.mapTitle || 'แผนที่แหล่งเรียนรู้')}">
            ${mapImage ? `
              <img class="lsb-main-map-image" src="${escAttr(mapImage)}" alt="${escAttr(currentArea.mapTitle || currentArea.name || 'แผนที่แหล่งเรียนรู้')}">
            ` : `
              <div class="lsb-main-map-empty">
                <i class="fa-regular fa-map"></i>
                <span>ยังไม่ได้กำหนดภาพแผนที่</span>
              </div>
            `}

            <div class="lsb-source-markers">
              ${sources.map(markerHtml).join('')}
            </div>

            <div class="lsb-map-summary">
              <strong>${esc(currentArea.mapTitle || currentArea.name || 'แผนที่แหล่งเรียนรู้')}</strong>
              <span>${formatNumber(sources.length)} แหล่งเรียนรู้</span>
            </div>
          </div>
        </div>

        <div class="lsb-source-carousel" ${sources.length ? '' : 'hidden'}>
          <div class="lsb-source-carousel-heading">
            <div>
              <span>รายการแหล่งเรียนรู้</span>
              <strong>${formatNumber(sources.length)} แห่ง</strong>
            </div>
            <small>เลื่อนดูรายการ หรือวางเมาส์ที่หมุดบนภาพ</small>
          </div>

          <div class="lsb-source-carousel-shell">
            <button class="lsb-source-carousel-arrow lsb-source-carousel-prev" type="button" aria-label="รายการก่อนหน้า">
              <i class="fa-solid fa-chevron-left"></i>
            </button>

            <div class="lsb-source-carousel-viewport" tabindex="0">
              <div class="lsb-source-carousel-track">
                ${sources.map(slideCardHtml).join('')}
              </div>
            </div>

            <button class="lsb-source-carousel-arrow lsb-source-carousel-next" type="button" aria-label="รายการถัดไป">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        ${sources.length ? '' : `
          <div class="lsb-empty">ยังไม่มีรายการแหล่งเรียนรู้ในชีต learning_sources</div>
        `}
      </div>
    `;

    bindExplorerEvents(grid);
  }

  function openSource(sourceId) {
    if (!currentArea || !Array.isArray(currentArea.sources)) return;
    const source = currentArea.sources.find(item => String(item.id) === String(sourceId));
    if (!source) return;
    window.open(sourceUrl(source), '_blank', 'noopener,noreferrer');
  }

  function setActiveSource(sourceId, scrollCard) {
    const grid = $('lsbAreaGrid');
    if (!grid) return;

    grid.querySelectorAll('.lsb-source-marker.is-active, .lsb-source-slide-card.is-active')
      .forEach(el => el.classList.remove('is-active'));

    const marker = [...grid.querySelectorAll('.lsb-source-marker')]
      .find(el => el.dataset.sourceId === String(sourceId));
    const card = [...grid.querySelectorAll('.lsb-source-slide-card')]
      .find(el => el.dataset.sourceCard === String(sourceId));

    marker?.classList.add('is-active');
    card?.classList.add('is-active');

    if (scrollCard && card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function clearActiveSource(sourceId) {
    const grid = $('lsbAreaGrid');
    if (!grid) return;
    const marker = [...grid.querySelectorAll('.lsb-source-marker')]
      .find(el => el.dataset.sourceId === String(sourceId));
    const card = [...grid.querySelectorAll('.lsb-source-slide-card')]
      .find(el => el.dataset.sourceCard === String(sourceId));
    marker?.classList.remove('is-active');
    card?.classList.remove('is-active');
  }

  function bindExplorerEvents(grid) {
    grid.querySelectorAll('.lsb-source-marker').forEach(marker => {
      const sourceId = marker.dataset.sourceId;
      marker.addEventListener('mouseenter', () => setActiveSource(sourceId, false));
      marker.addEventListener('mouseleave', () => clearActiveSource(sourceId));
      marker.addEventListener('focus', () => setActiveSource(sourceId, true));
      marker.addEventListener('blur', () => clearActiveSource(sourceId));
      marker.addEventListener('click', () => openSource(sourceId));
    });

    grid.querySelectorAll('.lsb-source-slide-card').forEach(card => {
      const sourceId = card.dataset.sourceCard;
      card.addEventListener('mouseenter', () => setActiveSource(sourceId, false));
      card.addEventListener('mouseleave', () => clearActiveSource(sourceId));
      card.addEventListener('focus', () => setActiveSource(sourceId, false));
      card.addEventListener('blur', () => clearActiveSource(sourceId));
      card.addEventListener('click', () => openSource(sourceId));
      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSource(sourceId);
      });
    });

    const viewport = grid.querySelector('.lsb-source-carousel-viewport');
    const prev = grid.querySelector('.lsb-source-carousel-prev');
    const next = grid.querySelector('.lsb-source-carousel-next');

    const scrollCarousel = direction => {
      if (!viewport) return;
      viewport.scrollBy({
        left: direction * Math.max(260, viewport.clientWidth * 0.82),
        behavior: 'smooth'
      });
    };

    prev?.addEventListener('click', () => scrollCarousel(-1));
    next?.addEventListener('click', () => scrollCarousel(1));
  }

  window.receiveLearningAreas = function(result) {
    clearTimeout(window.lsbLoadTimer);
    const grid = $('lsbAreaGrid');
    if (!grid) return;

    if (!result || result.success !== true) {
      console.error('Learning areas:', result);
      grid.innerHTML = '<div class="lsb-loading">ไม่สามารถโหลดข้อมูลได้</div>';
      return;
    }

    const areas = Array.isArray(result.areas) ? result.areas : [];
    if (!areas.length) {
      grid.innerHTML = '<div class="lsb-loading">ยังไม่มีข้อมูลแหล่งเรียนรู้</div>';
      return;
    }

    renderExplorer(areas[0]);
  };

  function loadLearningAreas() {
    const grid = $('lsbAreaGrid');
    if (!grid) {
      console.error('ไม่พบ element #lsbAreaGrid');
      return;
    }

    grid.innerHTML = '<div class="lsb-loading">กำลังโหลดแหล่งเรียนรู้...</div>';

    if (window.SiteFast) {
      window.SiteFast.fetchMode('learningAreas', { v: '6' }, {
        key: 'learning-areas-map-v6',
        ttl: 60000
      })
        .then(window.receiveLearningAreas)
        .catch(error => {
          console.error('Learning Areas API:', error);
          grid.innerHTML = '<div class="lsb-loading">ไม่สามารถเชื่อมต่อข้อมูลได้</div>';
        });
      return;
    }

    document.getElementById('lsbAreaJsonp')?.remove();
    clearTimeout(window.lsbLoadTimer);

    window.lsbLoadTimer = setTimeout(() => {
      grid.innerHTML = '<div class="lsb-loading">หมดเวลารอข้อมูล</div>';
    }, 30000);

    const script = document.createElement('script');
    script.id = 'lsbAreaJsonp';
    script.async = true;
    script.src =
      WEB_APP_URL +
      '?mode=learningAreas' +
      '&v=6' +
      '&callback=window.receiveLearningAreas' +
      '&_=' +
      Date.now();

    script.onerror = () => {
      clearTimeout(window.lsbLoadTimer);
      grid.innerHTML = '<div class="lsb-loading">ไม่สามารถเชื่อมต่อข้อมูลได้</div>';
      script.remove();
    };

    document.body.appendChild(script);
  }

  if (window.SiteFast) {
    window.SiteFast.whenNear('learningSourceBox', loadLearningAreas);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLearningAreas);
  } else {
    loadLearningAreas();
  }
})();
