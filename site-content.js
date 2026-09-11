(() => {
  'use strict';

  const API_URL =
    window.APP_CONFIG.API_URL;
  const SEARCH_PAGES = [
    'activity.html', 'best_practice.html', 'cliproom.html',
    'contact.html', 'course.html', 'ex.html', 'innovation.html', 'learning.html',
    'media.html', 'reward.html', 'shopactivity.html',
    'vision.html'
  ];

  function formatSlash(value) {
    return String(value || '')
      .trim()
      .replace(/\s*\/\s*/g, '\n');
  }

  function setOptionalText(id, value, prefix) {
    const element = document.getElementById(id);
    const content = formatSlash(value);
    if (!element) return;

    element.textContent = content ? String(prefix || '') + content : '';
    element.hidden = !content;
  }

  async function loadSiteContent() {
    try {
      let result;

      if (window.SiteFast) {
        result = Object.assign({ success: true }, await window.SiteFast.homePart('about'));
      } else {
        const url = new URL(API_URL);
        url.searchParams.set('mode', 'aboutPages');
        const response = await fetch(url.toString(), { cache: 'default' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      }
      if (result.success === false) {
        throw new Error(result.message || 'โหลดข้อความเว็บไซต์ไม่สำเร็จ');
      }

      const hero = result.hero || {};
      const footer = result.footer || {};
      const vision = result.vision || {};

      // เมนูหน้าแรกใช้หัวข้อใหญ่เดียวกับ vision.html (setting!Q3)
      const visionMenu = document.querySelector('a[href="vision.html"][role="menuitem"]');
      if (visionMenu && String(vision.title || '').trim()) {
        visionMenu.textContent = String(vision.title).trim();
      }

      setOptionalText('heroKickerText', hero.kicker);
      setOptionalText('heroTitleText', hero.title);
      setOptionalText('heroDescriptionText', hero.description);
      setOptionalText('footerDescription', footer.description);
      setOptionalText('footerOrganization', footer.organization);
      setOptionalText('footerAddress', footer.address);
      setOptionalText('footerPhone', footer.phone, 'โทร. ');
    } catch (error) {
      console.error('loadSiteContent error:', error);
    }
  }

  function clearSearchHit() {
    document.querySelectorAll('.site-search-hit').forEach(element => {
      element.classList.remove('site-search-hit');
    });
  }

  function searchableElements() {
    const selector = [
      'main h1', 'main h2', 'main h3', 'main h4', 'main p',
      'main a', 'main button', 'main [aria-label]',
      '.announcement p', '.main-nav a', '.footer p', '.footer h4', '.footer a'
    ].join(',');

    return Array.from(document.querySelectorAll(selector)).filter(element => {
      if (element.closest('#siteSearchForm')) return false;
      if (element.hidden) return false;
      return element.offsetParent !== null && element.textContent.trim();
    });
  }

  async function notifySearch(title, text, icon) {
    if (window.Swal) {
      return Swal.fire({ icon, title, text, confirmButtonText: 'ตกลง' });
    }
    window.alert(`${title}\n${text}`);
  }

  async function searchWebsite(event) {
    event.preventDefault();
    clearSearchHit();

    const input = document.getElementById('siteSearchInput');
    const query = String(input?.value || '').trim().toLocaleLowerCase('th-TH');
    if (!query) return;

    const matches = searchableElements().filter(element =>
      element.textContent.toLocaleLowerCase('th-TH').includes(query)
    );

    if (matches.length) {
      const firstMatch = matches[0];
      firstMatch.classList.add('site-search-hit');
      firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (matches.length > 1) {
        await notifySearch('พบข้อมูล', `พบในหน้านี้ ${matches.length} ตำแหน่ง และแสดงตำแหน่งแรก`, 'success');
      }
      return;
    }

    const pageMatches = await findMatchingPages(query);
    if (!pageMatches.length) {
      await notifySearch('ไม่พบข้อมูล', `ไม่พบข้อความ “${input.value.trim()}” ในเว็บไซต์`, 'info');
      input?.focus();
      return;
    }

    await notifySearch('พบข้อมูล', `พบใน ${pageMatches[0]} กำลังเปิดหน้าที่พบ`, 'success');
    window.location.href = pageMatches[0];
  }

  async function findMatchingPages(query) {
    const results = await Promise.all(SEARCH_PAGES.map(async page => {
      try {
        const response = await fetch(page, { cache: 'no-store' });
        if (!response.ok) return '';

        const html = await response.text();
        const documentCopy = new DOMParser().parseFromString(html, 'text/html');
        documentCopy.querySelectorAll('script, style, noscript').forEach(node => node.remove());
        const text = documentCopy.body?.textContent || '';
        return text.toLocaleLowerCase('th-TH').includes(query) ? page : '';
      } catch (error) {
        console.warn(`search page ${page} error:`, error);
        return '';
      }
    }));

    return results.filter(Boolean);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSiteContent();
    document.getElementById('siteSearchForm')?.addEventListener('submit', searchWebsite);
  });
})();
