(() => {
  'use strict';

  const SECTION_MENU_MAP = {
    bestPracticeBox: 'works',
    cliproomBox: 'cliproom',
    learningBaseModule: 'shopactivity'
  };

  const ACTIVE_SECTION_MAP = {
    home: 'home',
    bestPracticeBox: 'works',
    cliproomBox: 'cliproom',
    learningBaseModule: 'shopactivity'
  };

  const SUBMENUS = {
    works: {
      title: 'ผลงานของเรา',
      getItems() {
        return [
          { label: 'Best Practice', href: 'best_practice.html' },
          { label: 'สื่อ/นวัตกรรม', href: 'innovation.html' },
          { label: 'คลังสื่อการสอน', href: 'media.html' },
          { label: 'รางวัล เกียรติบัตร', href: 'reward.html' },
          { label: 'คลังหลักสูตร', href: 'course.html' }
        ];
      }
    },
    district: {
      title: 'สกร.ระดับตำบล',
      getItems() { return readDesktopMenu('districtMenuList'); }
    },
    library: {
      title: 'ห้องสมุด',
      getItems() { return readDesktopMenu('libraryMenuList'); }
    }
  };

  let nav;
  let menuItems = [];
  let moreButton;
  let panel;
  let panelTitle;
  let panelBody;
  let sectionObserver;
  let resizeFrame = 0;
  let activeKey = 'home';

  function readDesktopMenu(id) {
    const box = document.getElementById(id);
    if (!box) return [];
    return Array.from(box.querySelectorAll('a[href]')).map(link => ({
      label: String(link.textContent || '').trim(),
      href: link.href,
      target: link.target || '_blank',
      rel: link.rel || 'noopener noreferrer'
    })).filter(item => item.label && item.href);
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    nav?.classList.remove('mobile-bottom-panel-open');
    menuItems.forEach(item => item.setAttribute('aria-expanded', 'false'));
    moreButton?.setAttribute('aria-expanded', 'false');
  }

  function renderPanel(title, items, options = {}) {
    if (!panel || !panelTitle || !panelBody) return;
    panelTitle.textContent = title;
    panelBody.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'mobile-bottom-panel-empty';
      empty.textContent = options.emptyText || 'ยังไม่มีข้อมูล';
      panelBody.appendChild(empty);
    } else {
      items.forEach(item => {
        if (item.kind === 'submenu') {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mobile-bottom-panel-row mobile-bottom-panel-submenu';
          button.dataset.menuKey = item.menuKey;
          button.innerHTML = `<i class="${item.icon}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span><i class="fa-solid fa-chevron-right mobile-bottom-panel-chevron" aria-hidden="true"></i>`;
          button.addEventListener('click', () => openSubmenu(item.menuKey));
          panelBody.appendChild(button);
          return;
        }

        const link = document.createElement('a');
        link.className = 'mobile-bottom-panel-row';
        link.href = item.href;
        if (item.target) link.target = item.target;
        if (item.rel) link.rel = item.rel;
        if (item.icon) {
          link.innerHTML = `<i class="${item.icon}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span>`;
        } else {
          link.textContent = item.label;
        }
        link.addEventListener('click', closePanel);
        panelBody.appendChild(link);
      });
    }

    panel.hidden = false;
    nav.classList.add('mobile-bottom-panel-open');
  }

  function openSubmenu(menuKey) {
    const config = SUBMENUS[menuKey];
    if (!config) return;
    menuItems.forEach(item => item.setAttribute('aria-expanded', item.dataset.menuKey === menuKey ? 'true' : 'false'));
    moreButton?.setAttribute('aria-expanded', 'false');
    renderPanel(config.title, config.getItems(), {
      emptyText: menuKey === 'works' ? 'ยังไม่มีรายการ' : 'กำลังโหลดหรือยังไม่มีข้อมูล'
    });
  }

  function openOverflow() {
    const overflowed = menuItems.filter(item => item.classList.contains('mobile-bottom-overflowed') && !item.hidden);
    const rows = overflowed.map(item => {
      const label = item.querySelector('span')?.textContent?.trim() || '';
      const icon = item.querySelector('i')?.className || 'fa-solid fa-link';
      const menuKey = item.dataset.menuKey;
      if (menuKey) return { kind: 'submenu', menuKey, label, icon };
      return {
        label,
        icon,
        href: item.getAttribute('href') || '#',
        target: item.getAttribute('target') || '',
        rel: item.getAttribute('rel') || ''
      };
    });
    menuItems.forEach(item => item.setAttribute('aria-expanded', 'false'));
    moreButton?.setAttribute('aria-expanded', 'true');
    renderPanel('เมนูเพิ่มเติม', rows);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function isSectionVisible(sectionId) {
    const section = document.getElementById(sectionId);
    return !section || section.dataset.sectionVisible !== 'false';
  }

  function syncVisibility() {
    Object.entries(SECTION_MENU_MAP).forEach(([sectionId, menuKey]) => {
      const item = menuItems.find(node => node.dataset.menuKey === menuKey);
      if (!item) return;
      const visible = isSectionVisible(sectionId);
      item.hidden = !visible;
      item.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (!visible) item.setAttribute('tabindex', '-1');
      else item.removeAttribute('tabindex');
    });

    if (panel && !panel.hidden) closePanel();
    fitItems();
  }

  function fitItems() {
    if (!nav || window.innerWidth > 1024) return;

    const availableItems = menuItems.filter(item => !item.hidden);
    availableItems.forEach(item => item.classList.remove('mobile-bottom-overflowed'));
    moreButton.hidden = true;

    const navWidth = Math.max(280, nav.clientWidth || window.innerWidth);
    const minItemWidth = navWidth <= 360 ? 72 : 78;
    const capacity = Math.max(3, Math.floor(navWidth / minItemWidth));

    if (availableItems.length > capacity) {
      const directCount = Math.max(2, capacity - 1);
      availableItems.forEach((item, index) => {
        item.classList.toggle('mobile-bottom-overflowed', index >= directCount);
      });
      moreButton.hidden = false;
    }

    const directVisible = availableItems.filter(item => !item.classList.contains('mobile-bottom-overflowed')).length;
    const columns = directVisible + (moreButton.hidden ? 0 : 1);
    nav.style.setProperty('--mobile-bottom-columns', String(Math.max(1, columns)));
  }

  function setActive(menuKey) {
    activeKey = menuKey;
    menuItems.forEach(item => item.classList.toggle('active', item.dataset.menuKey === menuKey));
  }

  function bindSectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    sectionObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting && entry.target.dataset.sectionVisible !== 'false')
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!visible.length) return;
      const menuKey = ACTIVE_SECTION_MAP[visible[0].target.id];
      if (menuKey) setActive(menuKey);
    }, {
      root: null,
      rootMargin: '-18% 0px -62% 0px',
      threshold: [0.01, 0.12, 0.25]
    });

    Object.keys(ACTIVE_SECTION_MAP).forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) sectionObserver.observe(section);
    });
  }

  function bindSectionVisibilityWatch() {
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'attributes' && record.attributeName === 'data-section-visible')) {
        syncVisibility();
      }
    });
    Object.keys(SECTION_MENU_MAP).forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) observer.observe(section, { attributes: true, attributeFilter: ['data-section-visible'] });
    });
  }

  function bindDesktopMenuWatch() {
    const observer = new MutationObserver(() => {
      if (panel && !panel.hidden) {
        const expanded = menuItems.find(item => item.getAttribute('aria-expanded') === 'true');
        const key = expanded?.dataset.menuKey;
        if (key === 'district' || key === 'library') openSubmenu(key);
      }
    });
    ['districtMenuList', 'libraryMenuList'].forEach(id => {
      const box = document.getElementById(id);
      if (box) observer.observe(box, { childList: true, subtree: true });
    });
  }

  function init() {
    nav = document.getElementById('mobileBottomNav');
    if (!nav) return;

    menuItems = Array.from(nav.querySelectorAll('[data-mobile-bottom-item]'));
    moreButton = document.getElementById('mobileBottomMore');
    panel = document.getElementById('mobileBottomPanel');
    panelTitle = document.getElementById('mobileBottomPanelTitle');
    panelBody = document.getElementById('mobileBottomPanelBody');

    menuItems.forEach(item => {
      const menuKey = item.dataset.menuKey;
      if (SUBMENUS[menuKey]) {
        item.addEventListener('click', event => {
          event.preventDefault();
          const sameOpen = item.getAttribute('aria-expanded') === 'true' && panel && !panel.hidden;
          if (sameOpen) closePanel();
          else openSubmenu(menuKey);
        });
      } else {
        item.addEventListener('click', () => {
          closePanel();
          if (menuKey) setActive(menuKey);
        });
      }
    });

    moreButton?.addEventListener('click', event => {
      event.preventDefault();
      const sameOpen = moreButton.getAttribute('aria-expanded') === 'true' && panel && !panel.hidden;
      if (sameOpen) closePanel();
      else openOverflow();
    });

    document.getElementById('mobileBottomPanelClose')?.addEventListener('click', closePanel);

    document.addEventListener('click', event => {
      if (!nav.contains(event.target) && !panel?.contains(event.target)) closePanel();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePanel();
    });

    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        closePanel();
        fitItems();
      });
    }, { passive: true });

    bindSectionObserver();
    bindSectionVisibilityWatch();
    bindDesktopMenuWatch();
    syncVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.MobileBottomNav = {
    syncVisibility,
    fitItems,
    close: closePanel
  };
})();
