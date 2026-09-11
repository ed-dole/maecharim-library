(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL;
  const CONFIG = {
    text: { title: 'แก้ไขข้อความ', range: 'setting!S1:T4' },
    image: { title: 'แก้ไขโลโก้ ชื่อ รูปหัวเว็บไซต์', range: 'website_image!A1:B4' }
  };
  let activeHighlight = '';
  const highlightBox = document.createElement('div');
  highlightBox.className = 'editwebsite-highlight-box';
  highlightBox.setAttribute('aria-hidden', 'true');

  function getUnionRect(elements) {
    const rects = elements
      .filter(element => element && !element.hidden)
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0);
    if (!rects.length) return null;
    return {
      top: Math.min(...rects.map(rect => rect.top)),
      left: Math.min(...rects.map(rect => rect.left)),
      right: Math.max(...rects.map(rect => rect.right)),
      bottom: Math.max(...rects.map(rect => rect.bottom))
    };
  }

  function updateHighlight() {
    if (!activeHighlight) return;
    const targets = activeHighlight === 'text'
      ? ['heroKickerText', 'heroTitleText', 'heroDescriptionText'].map(id => document.getElementById(id))
      : [document.getElementById('websiteHeroOverlay')];
    const rect = getUnionRect(targets);
    if (!rect) return hideHighlight();
    const padding = activeHighlight === 'text' ? 18 : 5;
    highlightBox.style.top = `${Math.max(3, rect.top - padding)}px`;
    highlightBox.style.left = `${Math.max(3, rect.left - padding)}px`;
    highlightBox.style.width = `${Math.min(window.innerWidth - Math.max(3, rect.left - padding) - 3, rect.right - rect.left + padding * 2)}px`;
    highlightBox.style.height = `${Math.min(window.innerHeight - Math.max(3, rect.top - padding) - 3, rect.bottom - rect.top + padding * 2)}px`;
    highlightBox.classList.add('is-visible');
  }

  function showHighlight(type) {
    activeHighlight = type;
    document.body.classList.toggle('editwebsite-highlight-image', type === 'image');
    updateHighlight();
  }

  function hideHighlight() {
    activeHighlight = '';
    highlightBox.classList.remove('is-visible');
    document.body.classList.remove('editwebsite-highlight-image');
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[char]);

  async function request(params) {
    const token = sessionStorage.getItem('mysiteAdminToken') || '';
    const response = await fetch(API_URL, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({}, params, { token }))
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.success === false) throw new Error(result.message || 'ดำเนินการไม่สำเร็จ');
    return result;
  }

  function isValidUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function compressImage(file, options = {}) {
    const maxWidth = Number(options.maxWidth || 1400);
    const maxHeight = Number(options.maxHeight || 900);
    const quality = Number(options.quality || 0.72);
    const maxBytes = Number(options.maxBytes || 900000);
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || '').startsWith('image/')) {
        reject(new Error('กรุณาเลือกไฟล์รูปภาพ'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
        image.onload = () => {
          const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          const context = canvas.getContext('2d');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          let outputQuality = quality;
          let dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
          while (Math.ceil(dataUrl.length * 0.75) > maxBytes && outputQuality > 0.38) {
            outputQuality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
          }
          resolve({
            dataUrl,
            fileName: `${String(file.name || 'website-image').replace(/\.[^.]+$/, '')}.jpg`
          });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function imageEditorHtml(rows) {
    const logo = rows[0] && rows[0].value ? rows[0].value : '';
    const brand = rows[1] && rows[1].value ? rows[1].value : '';
    const hero = rows[2] && rows[2].value ? rows[2].value : '';
    return `<div class="editwebsite-popup editwebsite-image-form">
      <div class="editwebsite-image-field">
        <label for="editwebsiteLogoUrl">โลโก้ <span class="editwebsite-required">*</span></label>
        <input id="editwebsiteLogoUrl" class="editwebsite-input" type="url" value="${escapeHtml(logo)}" placeholder="https://...">
        <div class="editwebsite-upload-row"><span>หรือ</span><label class="editwebsite-upload-button"><i class="fa-solid fa-upload"></i> อัปโหลดโลโก้<input id="editwebsiteLogoFile" type="file" accept="image/*"></label></div>
        <small>ระบบจะย่อรูปก่อนอัปโหลดเข้า Google Drive</small>
        <img id="editwebsiteLogoPreview" class="editwebsite-image-preview is-logo" src="${escapeHtml(logo)}" ${logo ? '' : 'hidden'} alt="ตัวอย่างโลโก้">
      </div>
      <label class="editwebsite-text-field">ชื่อระบบ (ข้อความ)<textarea id="editwebsiteBrandName" class="editwebsite-input" rows="2">${escapeHtml(brand)}</textarea></label>
      <div class="editwebsite-image-field">
        <label for="editwebsiteHeroUrl">รูปหัวเว็บ <span class="editwebsite-required">*</span></label>
        <input id="editwebsiteHeroUrl" class="editwebsite-input" type="url" value="${escapeHtml(hero)}" placeholder="https://...">
        <div class="editwebsite-upload-row"><span>หรือ</span><label class="editwebsite-upload-button"><i class="fa-solid fa-upload"></i> อัปโหลดรูปหัวเว็บ<input id="editwebsiteHeroFile" type="file" accept="image/*"></label></div>
        <small>ระบบจะย่อรูปให้เหมาะสำหรับแสดงผลออนไลน์</small>
        <img id="editwebsiteHeroPreview" class="editwebsite-image-preview" src="${escapeHtml(hero)}" ${hero ? '' : 'hidden'} alt="ตัวอย่างรูปหัวเว็บ">
      </div>
      <div id="editwebsiteStatus" class="editwebsite-status">รูปภาพต้องเลือกอัปโหลดหรือระบุ URL อย่างใดอย่างหนึ่ง</div>
    </div>`;
  }

  function applyPreview(type, values) {
    if (type === 'text') {
      ['heroKickerText', 'heroTitleText', 'heroDescriptionText'].forEach((id, index) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = values[index] || '';
        element.hidden = !values[index];
      });
      return;
    }

    const logoUrl = values[0] || '';
    const brandName = values[1] || '';
    const heroUrl = values[2] || '';
    document.querySelectorAll('[data-website-brand-icon]').forEach(icon => {
      icon.textContent = '';
      icon.style.backgroundImage = logoUrl ? `url("${logoUrl}")` : '';
      icon.style.backgroundSize = 'cover';
      icon.style.backgroundPosition = 'center';
    });
    document.querySelectorAll('[data-website-brand-name]').forEach(name => {
      name.textContent = brandName;
    });
    if (brandName) document.title = brandName;
    const overlay = document.getElementById('websiteHeroOverlay');
    if (overlay && heroUrl) {
      overlay.style.backgroundImage = `linear-gradient(90deg,rgba(5,28,44,.96) 0%,rgba(5,28,44,.79) 40%,rgba(5,28,44,.1) 78%),url("${heroUrl}")`;
      overlay.style.backgroundSize = 'cover';
      overlay.style.backgroundPosition = 'center';
      overlay.classList.add('website-hero-ready');
    }
  }

  async function openEditor(type) {
    const config = CONFIG[type];
    if (!config || !window.Swal) return;

    Swal.fire({ title: 'กำลังโหลดข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const result = await request({ mode: 'editwebsite', editor: type });
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const headers = Array.isArray(result.headers) ? result.headers : ['รายการ', 'ข้อมูล'];
      const html = type === 'image' ? imageEditorHtml(rows) : `<div class="editwebsite-popup"><table class="editwebsite-table"><thead><tr><th>${escapeHtml(headers[0] || 'รายการ')}</th><th>${escapeHtml(headers[1] || 'ข้อมูล')}</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${escapeHtml(row.label)}</td><td><textarea class="editwebsite-input" data-row="${index}" rows="${index === 2 ? 3 : 2}">${escapeHtml(row.value)}</textarea></td></tr>`).join('')}</tbody></table><div id="editwebsiteStatus" class="editwebsite-status">แก้ไขข้อมูล แล้วกด “บันทึก”</div></div>`;

      let logoUpload = null;
      let heroUpload = null;

      const modal = await Swal.fire({
        title: config.title,
        html,
        width: type === 'text' ? 760 : 820,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626',
        focusConfirm: false,
        didOpen: () => {
          if (type !== 'image') return;
          const popup = Swal.getPopup();
          const status = popup.querySelector('#editwebsiteStatus');
          const bindUpload = (inputId, previewId, kind) => {
            popup.querySelector(inputId).addEventListener('change', async event => {
              try {
                status.textContent = 'กำลังย่อรูป...';
                status.classList.remove('is-error');
                const upload = await compressImage(event.target.files[0], kind === 'logo'
                  ? { maxWidth: 500, maxHeight: 500, quality: 0.76, maxBytes: 350000 }
                  : { maxWidth: 1600, maxHeight: 900, quality: 0.72, maxBytes: 900000 });
                if (kind === 'logo') logoUpload = upload;
                else heroUpload = upload;
                const preview = popup.querySelector(previewId);
                preview.src = upload.dataUrl;
                preview.hidden = false;
                status.textContent = 'ย่อรูปเรียบร้อย พร้อมบันทึก';
              } catch (error) {
                if (kind === 'logo') logoUpload = null;
                else heroUpload = null;
                status.textContent = error.message;
                status.classList.add('is-error');
              }
            });
          };
          bindUpload('#editwebsiteLogoFile', '#editwebsiteLogoPreview', 'logo');
          bindUpload('#editwebsiteHeroFile', '#editwebsiteHeroPreview', 'hero');
        },
        preConfirm: async () => {
          const popup = Swal.getPopup();
          const status = document.getElementById('editwebsiteStatus');
          let values;
          let uploadData = {};
          if (type === 'image') {
            const logoUrl = popup.querySelector('#editwebsiteLogoUrl').value.trim();
            const brandName = popup.querySelector('#editwebsiteBrandName').value.trim();
            const heroUrl = popup.querySelector('#editwebsiteHeroUrl').value.trim();
            if (!logoUpload && !logoUrl) return Swal.showValidationMessage('กรุณาอัปโหลดหรือใส่ URL โลโก้');
            if (!heroUpload && !heroUrl) return Swal.showValidationMessage('กรุณาอัปโหลดหรือใส่ URL รูปหัวเว็บ');
            if (logoUrl && !isValidUrl(logoUrl)) return Swal.showValidationMessage('URL โลโก้ไม่ถูกต้อง');
            if (heroUrl && !isValidUrl(heroUrl)) return Swal.showValidationMessage('URL รูปหัวเว็บไม่ถูกต้อง');
            values = [logoUrl, brandName, heroUrl];
            uploadData = {
              logoData: logoUpload ? logoUpload.dataUrl : '',
              logoName: logoUpload ? logoUpload.fileName : '',
              heroData: heroUpload ? heroUpload.dataUrl : '',
              heroName: heroUpload ? heroUpload.fileName : ''
            };
          } else {
            values = Array.from(popup.querySelectorAll('.editwebsite-input')).map(input => input.value.trim());
          }
          status.textContent = 'กำลังบันทึก...';
          status.classList.remove('is-error');
          try {
            const saved = await request({ mode: 'saveeditwebsite', editor: type, values: JSON.stringify(values), data: uploadData });
            return Array.isArray(saved.values) ? saved.values : values;
          } catch (error) {
            status.textContent = error.message;
            status.classList.add('is-error');
            Swal.showValidationMessage(error.message);
            return false;
          }
        }
      });

      if (modal.isConfirmed) {
        // Forget the in-memory/local homefast payload so the new B2/B4 values
        // cannot be replaced by an older cached hero/logo later in this page.
        if (window.SiteFast) window.SiteFast.clear('homefast');
        try { window.__SITE_HOMEFAST_PREFETCH = null; } catch (_) {}

        applyPreview(type, modal.value);
        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', text: 'อัปโหลดรูปและอัปเดตหน้าเว็บไซต์เรียบร้อย', timer: 1700, showConfirmButton: false });
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message, confirmButtonText: 'ตกลง' });
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-editwebsite]');
    if (button) openEditor(button.dataset.editwebsite);
  });

  function initializeEditWebsite() {
    if (document.body.contains(highlightBox)) return;
    document.body.appendChild(highlightBox);
    document.querySelectorAll('.editwebsite-btn[data-editwebsite]').forEach(button => {
      const type = button.dataset.editwebsite;
      button.addEventListener('mouseenter', () => showHighlight(type));
      button.addEventListener('mouseleave', hideHighlight);
      button.addEventListener('focus', () => showHighlight(type));
      button.addEventListener('blur', hideHighlight);
    });
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeEditWebsite, { once:true });
  else initializeEditWebsite();
})();
