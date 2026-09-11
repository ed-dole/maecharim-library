(() => {
  'use strict';

  const API_URL = String(window.APP_CONFIG?.API_URL || '').trim();
  const BOOK_API_URL = API_URL ? API_URL + '?mode=books' : '';
  const PLACEHOLDER_LARGE = 'https://placehold.co/360x520?text=Book';
  const PLACEHOLDER_SMALL = 'https://placehold.co/300x430?text=Book';

  let books = [];
  let activeBookIndex = 0;
  let bookTimer = null;
  let initialized = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  })[character]);

  function formatBookDetailHtml(value) {
    return escapeHtml(String(value || 'ยังไม่มีรายละเอียด')).replace(/\s*\/\s*/g, '<br>');
  }

  function normalizeBook(row, index) {
    row = row || {};
    return {
      id: String(row.bookId || row.id || row.number || row['เล่มที่'] || index + 1),
      category: String(row.category || row['หมวด'] || '').trim(),
      title: String(row.title || row.bookName || row['ชื่อหนังสือ'] || '').trim(),
      image: String(row.image || row.imageUrl || row['URL รูปปก'] || '').trim(),
      detail: String(row.detail || row.description || row['รายละเอียดที่น่าสนใจ'] || '').trim()
    };
  }

  async function loadBooks() {
    const slides = document.getElementById('bookSlides');
    const grid = document.getElementById('allBooksGrid');
    if (!slides || !grid) return;
    if (!BOOK_API_URL) {
      slides.innerHTML = '<div class="book-loading">ไม่พบ URL ของ Apps Script</div>';
      return;
    }

    try {
      const response = await fetch(BOOK_API_URL + '&_t=' + Date.now(), { method:'GET', cache:'no-store', credentials:'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success === false) throw new Error(result.message || 'โหลดหนังสือไม่สำเร็จ');

      const raw = result.data || result.books || result;
      books = (Array.isArray(raw) ? raw : []).map(normalizeBook).filter(book => book.title || book.image);
      if (!books.length) {
        slides.innerHTML = '<div class="book-loading">ยังไม่มีรายการหนังสือในชีต book</div>';
        grid.innerHTML = '';
        document.getElementById('bookDots')?.replaceChildren();
        return;
      }

      activeBookIndex = 0;
      renderBookSlider();
      renderAllBooks();
      startBookAutoSlide();
    } catch (error) {
      console.error('โหลดรายการหนังสือไม่สำเร็จ:', error);
      slides.innerHTML = `<div class="book-loading">โหลดรายการหนังสือไม่สำเร็จ: ${escapeHtml(error.message)}</div>`;
    }
  }

  function circularDistance(index, active, length) {
    let distance = index - active;
    if (distance > length / 2) distance -= length;
    if (distance < -length / 2) distance += length;
    return distance;
  }

  function renderBookSlider() {
    const slides = document.getElementById('bookSlides');
    const dots = document.getElementById('bookDots');
    if (!slides || !dots || !books.length) return;

    slides.innerHTML = books.map((book, index) => {
      const distance = circularDistance(index, activeBookIndex, books.length);
      const positionClass =
        distance === 0 ? 'is-active' :
        distance === -1 ? 'is-prev' :
        distance === -2 ? 'is-far-prev' :
        distance === -3 ? 'is-super-far-prev' :
        distance === 1 ? 'is-next' :
        distance === 2 ? 'is-far-next' :
        distance === 3 ? 'is-super-far-next' : 'is-hidden';
      const image = book.image || PLACEHOLDER_LARGE;
      return `
        <button class="book-cover ${positionClass}" type="button" data-book-index="${index}" aria-label="ดูรายละเอียด ${escapeHtml(book.title || 'หนังสือ')}">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(book.title || 'ปกหนังสือ')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER_LARGE}';">
          <span class="book-cover-caption">${escapeHtml(book.title || '-')}</span>
        </button>`;
    }).join('');

    dots.innerHTML = books.map((_, index) => `
      <button class="book-slider-dot ${index === activeBookIndex ? 'active' : ''}" type="button" data-book-dot="${index}" aria-label="ไปหนังสือเล่มที่ ${index + 1}"></button>
    `).join('');

    slides.querySelectorAll('[data-book-index]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.bookIndex);
        if (index === activeBookIndex) openBookDetail(index);
        else setActiveBook(index);
      });
    });
    dots.querySelectorAll('[data-book-dot]').forEach(button => {
      button.addEventListener('click', () => setActiveBook(Number(button.dataset.bookDot)));
    });
  }

  function setActiveBook(index) {
    if (!books.length) return;
    activeBookIndex = (index + books.length) % books.length;
    renderBookSlider();
    restartBookAutoSlide();
  }

  function startBookAutoSlide() {
    clearInterval(bookTimer);
    if (books.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    bookTimer = setInterval(() => {
      activeBookIndex = (activeBookIndex + 1) % books.length;
      renderBookSlider();
    }, 3500);
  }

  function restartBookAutoSlide() { startBookAutoSlide(); }

  function renderAllBooks() {
    const grid = document.getElementById('allBooksGrid');
    if (!grid) return;
    grid.innerHTML = books.map((book, index) => {
      const image = book.image || PLACEHOLDER_SMALL;
      return `
        <article class="all-book-card">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(book.title || 'ปกหนังสือ')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER_SMALL}';">
          <div class="all-book-card-body">
            <span class="all-book-category">${escapeHtml(book.category || 'ไม่ระบุหมวด')}</span>
            <h3>${escapeHtml(book.title || '-')}</h3>
            <button class="book-detail-button" type="button" data-open-book="${index}">ดูรายละเอียด</button>
          </div>
        </article>`;
    }).join('');
    grid.querySelectorAll('[data-open-book]').forEach(button => {
      button.addEventListener('click', () => openBookDetail(Number(button.dataset.openBook)));
    });
  }

  function openBookDetail(index) {
    const book = books[index];
    const modal = document.getElementById('bookDetailModal');
    const content = document.getElementById('bookDetailContent');
    if (!book || !modal || !content) return;
    const image = book.image || PLACEHOLDER_LARGE;
    content.innerHTML = `
      <div class="book-detail-layout">
        <div class="book-detail-image-wrap"><img src="${escapeHtml(image)}" alt="${escapeHtml(book.title || 'ปกหนังสือ')}" onerror="this.onerror=null;this.src='${PLACEHOLDER_LARGE}';"></div>
        <div class="book-detail-info">
          <span class="book-detail-label">หมวด</span>
          <div class="book-detail-category">${escapeHtml(book.category || 'ไม่ระบุหมวด')}</div>
          <span class="book-detail-label">ชื่อหนังสือ</span>
          <h2 id="bookDetailTitle">${escapeHtml(book.title || '-')}</h2>
          <span class="book-detail-label">รายละเอียดที่น่าสนใจ</span>
          <p>${formatBookDetailHtml(book.detail)}</p>
        </div>
      </div>`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('book-modal-open');
  }

  function closeBookDetail() {
    const modal = document.getElementById('bookDetailModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('book-modal-open');
  }

  function bindBookControls() {
    document.getElementById('bookPrev')?.addEventListener('click', () => setActiveBook(activeBookIndex - 1));
    document.getElementById('bookNext')?.addEventListener('click', () => setActiveBook(activeBookIndex + 1));
    const toggleButton = document.getElementById('toggleBookListBtn');
    const panel = document.getElementById('allBooksPanel');
    if (toggleButton && panel) {
      toggleButton.addEventListener('click', () => {
        const willOpen = panel.hasAttribute('hidden');
        panel.toggleAttribute('hidden', !willOpen);
        toggleButton.setAttribute('aria-expanded', String(willOpen));
        const icon = toggleButton.querySelector('.book-toggle-icon i');
        if (icon) icon.className = willOpen ? 'fa fa-eye' : 'fa fa-eye-slash';
        if (willOpen) window.setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
      });
    }
    document.getElementById('bookDetailClose')?.addEventListener('click', closeBookDetail);
    document.getElementById('bookDetailModal')?.addEventListener('click', event => {
      if (event.target.id === 'bookDetailModal') closeBookDetail();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeBookDetail(); });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    bindBookControls();
    loadBooks();
  }

  document.addEventListener('book-admin-updated', loadBooks);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
