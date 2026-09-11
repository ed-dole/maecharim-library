(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL;
  const text = value => String(value ?? '').trim();

  function safeUrl(value) {
    try {
      const url = new URL(text(value));
      return /^https?:$/i.test(url.protocol) ? url.toString() : '';
    } catch (_) {
      return '';
    }
  }

  function slashToNewline(value) {
    return String(value ?? '')
      .trim()
      .replace(/\s*\/\s*/g, '\n');
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    const content = text(value);
    if (!element) return false;
    element.textContent = content;
    element.closest('[data-optional]')?.toggleAttribute('hidden', !content);
    return Boolean(content);
  }

  function setSocial(id, value) {
    const element = document.getElementById(id);
    const url = safeUrl(value);
    if (!element) return false;
    element.hidden = !url;
    if (url) element.href = url;
    else element.removeAttribute('href');
    return Boolean(url);
  }

  function legacyVisionSections(data) {
    return [
      { title: 'วิสัยทัศน์', detail: data.vision },
      { title: 'อัตลักษณ์', detail: data.identity },
      { title: 'พันธกิจ', detail: data.mission }
    ].filter(item => text(item.title) || text(item.detail));
  }

  function renderVision(data) {
    data = data || {};

    const kicker = document.getElementById('visionKicker') || document.querySelector('.about-kicker');
    const title = document.getElementById('visionPageTitle') || document.querySelector('.about-heading h1');
    const root = document.getElementById('visionContent');

    const kickerText = text(data.kicker) || 'VISION, IDENTITY, MISSION';
    const titleText = text(data.title) || 'วิสัยทัศน์ อัตลักษณ์ พันธกิจ';

    if (kicker) kicker.textContent = kickerText;
    if (title) title.textContent = titleText;
    document.title = titleText;

    if (!root) return;
    root.replaceChildren();

    let sections = Array.isArray(data.sections) ? data.sections : [];
    if (!sections.length) sections = legacyVisionSections(data);

    sections = sections
      .map(item => ({
        title: text(item?.title),
        detail: String(item?.detail ?? '').trim()
      }))
      .filter(item => item.title || item.detail);

    if (!sections.length) {
      const empty = document.createElement('div');
      empty.className = 'about-empty';
      empty.textContent = 'ยังไม่มีข้อมูลสำหรับแสดง';
      root.appendChild(empty);
      return;
    }

    sections.forEach(item => {
      const section = document.createElement('section');
      section.className = 'vision-section';

      if (item.title) {
        const heading = document.createElement('h2');
        heading.textContent = item.title;
        section.appendChild(heading);
      }

      if (item.detail) {
        const copy = document.createElement('p');
        copy.className = 'vision-copy';
        // ตั้งแต่ Q4 ลงไป เครื่องหมาย / แสดงเป็นขึ้นบรรทัดใหม่
        copy.textContent = slashToNewline(item.detail);
        section.appendChild(copy);
      }

      root.appendChild(section);
    });
  }

  function renderContact(data) {
    const panel = document.getElementById('contactPanel');
    const visible = [
      setText('contactOrganization', data.organization),
      setText('contactAddress', data.address),
      setText('contactPhone', data.phone),
      setSocial('contactFacebook', data.facebook),
      setSocial('contactLine', data.line)
    ];

    const socials = document.getElementById('contactSocials');
    if (socials) socials.hidden = !(visible[3] || visible[4]);

    const coordinate = text(data.coordinate);
    const wrap = document.getElementById('contactMapWrap');
    const frame = document.getElementById('contactMap');
    const link = document.getElementById('contactMapLink');

    if (coordinate && wrap && frame && link) {
      const query = encodeURIComponent(coordinate);
      frame.src = `https://www.google.com/maps?q=${query}&z=14&output=embed`;
      link.href = `https://www.google.com/maps/search/?api=1&query=${query}`;
      wrap.hidden = false;
    } else if (wrap) {
      wrap.hidden = true;
    }

    if (!visible.some(Boolean) && !coordinate && panel) {
      panel.innerHTML = '<div class="about-empty">ยังไม่มีข้อมูลสำหรับแสดง</div>';
    }
  }

  async function loadAboutPage() {
    const page = text(document.body.dataset.aboutPage).toLowerCase();
    const content = document.getElementById('aboutPageContent');

    try {
      const url = new URL(API_URL);
      url.searchParams.set('mode', 'aboutPages');
      url.searchParams.set('_t', Date.now());
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (result.success === false) throw new Error(result.message || 'โหลดข้อมูลไม่สำเร็จ');

      if (page === 'vision') renderVision(result.vision || {});
      else if (page === 'contact') renderContact(result.contact || {});
    } catch (error) {
      console.error('loadAboutPage error:', error);
      if (content) {
        content.className = 'about-error';
        content.textContent = 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
      }
    }
  }

  window.AboutPage = Object.freeze({
    load: loadAboutPage,
    renderVision,
    renderContact,
    slashToNewline
  });

  document.addEventListener('DOMContentLoaded', loadAboutPage);
})();
