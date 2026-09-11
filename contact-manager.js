(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL;
  const EDITOR = 'contact';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));

  function adminToken() {
    return sessionStorage.getItem('mysiteAdminToken') || '';
  }

  async function api(mode, extra = {}) {
    const response = await fetch(API_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({
        mode,
        editor: EDITOR,
        token: adminToken()
      }, extra))
    });

    let result;
    try {
      result = await response.json();
    } catch (_) {
      throw new Error('เซิร์ฟเวอร์ส่งข้อมูลกลับไม่ถูกต้อง');
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'ดำเนินการไม่สำเร็จ');
    }
    return result;
  }

  function validCoordinate(value) {
    const match = String(value || '').trim().match(
      /^\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*$/
    );
    if (!match) return false;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    return Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function validPhone(value) {
    return /^\d{6,15}$/.test(String(value || '').trim());
  }

  function validUrlFor(value, type) {
    const raw = String(value || '').trim();
    if (!raw) return true;

    try {
      const url = new URL(raw);
      if (!/^https?:$/i.test(url.protocol)) return false;
      const host = url.hostname.toLowerCase().replace(/^www\./, '');

      if (type === 'facebook') {
        return host === 'facebook.com' || host.endsWith('.facebook.com');
      }

      if (type === 'line') {
        return host === 'line.me' || host.endsWith('.line.me') ||
          host === 'lin.ee' || host.endsWith('.lin.ee');
      }

      return false;
    } catch (_) {
      return false;
    }
  }

  function fieldForRow(row, index) {
    const value = esc(row.value || '');
    const rowNumber = index + 2;

    if (rowNumber === 3) {
      return `<input class="contact-manager-input" data-contact-value="${index}" type="text"
        value="${value}" placeholder="เช่น 14.7996289, 100.6256088"
        autocomplete="off" spellcheck="false">`;
    }

    if (rowNumber === 5) {
      return `<input class="contact-manager-input" data-contact-value="${index}" type="text"
        inputmode="tel" value="${value}" placeholder="เช่น 036413582"
        autocomplete="off" spellcheck="false">`;
    }

    if (rowNumber === 6 || rowNumber === 7) {
      const placeholder = rowNumber === 6
        ? 'https://www.facebook.com/...'
        : 'https://line.me/... หรือ https://lin.ee/...';
      return `<input class="contact-manager-input" data-contact-value="${index}" type="url"
        value="${value}" placeholder="${placeholder}"
        autocomplete="off" spellcheck="false">`;
    }

    if (rowNumber === 4) {
      return `<textarea class="contact-manager-input contact-manager-textarea"
        data-contact-value="${index}" rows="3">${value}</textarea>`;
    }

    return `<input class="contact-manager-input" data-contact-value="${index}" type="text"
      value="${value}" autocomplete="off">`;
  }

  function managerHtml(data) {
    const headers = data.headers || ['รายการ', 'ระบุ'];
    const rows = Array.isArray(data.rows) ? data.rows : [];

    return `
      <div class="contact-manager-popup">
        <div class="contact-manager-note">
          แก้ไขได้เฉพาะคอลัมน์ <b>${esc(headers[1] || 'N')}</b> เท่านั้น
        </div>
        <div class="contact-manager-table-wrap">
          <table class="contact-manager-table">
            <thead>
              <tr>
                <th>${esc(headers[0] || 'รายการ')}</th>
                <th>${esc(headers[1] || 'ระบุ')}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr>
                  <td class="contact-manager-label">${esc(row.label || '')}</td>
                  <td>${fieldForRow(row, index)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div id="contactManagerError" class="contact-manager-error"></div>
        <div class="contact-manager-actions">
          <button id="contactManagerSave" class="contact-manager-save" type="button">
            บันทึกข้อมูล
          </button>
        </div>
      </div>`;
  }

  function validateValues(values) {
    const coordinate = values[1] || '';
    const phone = values[3] || '';
    const facebook = values[4] || '';
    const line = values[5] || '';

    if (coordinate && !validCoordinate(coordinate)) {
      return 'พิกัด N3 ไม่ถูกต้อง กรุณาระบุเป็น ละติจูด, ลองจิจูด เช่น 14.7996289, 100.6256088';
    }

    if (phone && !validPhone(phone)) {
      return 'เบอร์โทร N5 ต้องเป็นตัวเลข 6–15 หลัก และสามารถขึ้นต้นด้วย 0 ได้';
    }

    if (!validUrlFor(facebook, 'facebook')) {
      return 'N6 ต้องเป็น URL ของ Facebook เท่านั้น เช่น https://www.facebook.com/ชื่อเพจ';
    }

    if (!validUrlFor(line, 'line')) {
      return 'N7 ต้องเป็น URL ของ Line เท่านั้น เช่น https://line.me/... หรือ https://lin.ee/...';
    }

    return '';
  }

  function applySavedValues(values) {
    const text = value => String(value ?? '').trim();

    const organization = document.getElementById('contactOrganization');
    const address = document.getElementById('contactAddress');
    const phone = document.getElementById('contactPhone');

    if (organization) {
      organization.textContent = text(values[0]);
      organization.closest('[data-optional]')?.toggleAttribute('hidden', !text(values[0]));
    }
    if (address) {
      address.textContent = text(values[2]);
      address.closest('[data-optional]')?.toggleAttribute('hidden', !text(values[2]));
    }
    if (phone) {
      phone.textContent = text(values[3]);
      phone.closest('[data-optional]')?.toggleAttribute('hidden', !text(values[3]));
    }

    const facebook = document.getElementById('contactFacebook');
    const line = document.getElementById('contactLine');
    const socials = document.getElementById('contactSocials');

    function setSocial(element, value) {
      if (!element) return false;
      const url = text(value);
      element.hidden = !url;
      if (url) element.href = url;
      else element.removeAttribute('href');
      return Boolean(url);
    }

    const hasFacebook = setSocial(facebook, values[4]);
    const hasLine = setSocial(line, values[5]);
    if (socials) socials.hidden = !(hasFacebook || hasLine);

    const coordinate = text(values[1]);
    const wrap = document.getElementById('contactMapWrap');
    const frame = document.getElementById('contactMap');
    const mapLink = document.getElementById('contactMapLink');

    if (coordinate && wrap && frame && mapLink) {
      const query = encodeURIComponent(coordinate);
      frame.src = `https://www.google.com/maps?q=${query}&z=14&output=embed`;
      mapLink.href = `https://www.google.com/maps/search/?api=1&query=${query}`;
      wrap.hidden = false;
    } else if (wrap) {
      wrap.hidden = true;
    }
  }

  async function openManager() {
    Swal.fire({
      title: 'กำลังโหลดข้อมูลติดต่อ...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const data = await api('editwebsite');

      await Swal.fire({
        title: 'จัดการข้อมูลติดต่อ',
        html: managerHtml(data),
        width: 'min(980px, 96vw)',
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: () => {
          const saveButton = document.getElementById('contactManagerSave');
          const errorBox = document.getElementById('contactManagerError');

          if (!saveButton || !errorBox) return;

          saveButton.addEventListener('click', async () => {
            const inputs = Array.from(document.querySelectorAll('[data-contact-value]'));
            const values = inputs.map(input => input.value.trim());
            const validationError = validateValues(values);

            errorBox.textContent = '';
            if (validationError) {
              errorBox.textContent = validationError;
              return;
            }

            saveButton.disabled = true;
            saveButton.textContent = 'กำลังบันทึก...';

            try {
              const result = await api('saveeditwebsite', { values });
              applySavedValues(result.values || values);

              Swal.fire({
                icon: 'success',
                title: 'บันทึกข้อมูลแล้ว',
                text: 'ข้อมูลหน้า ติดต่อ/สอบถาม ถูกอัปเดตเรียบร้อย',
                timer: 1300,
                showConfirmButton: false
              });
            } catch (error) {
              errorBox.textContent = 'บันทึกไม่สำเร็จ: ' + error.message;
              saveButton.disabled = false;
              saveButton.textContent = 'บันทึกข้อมูล';
            }
          });
        }
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'โหลดข้อมูลไม่สำเร็จ',
        text: error.message
      });
    }
  }

  document.addEventListener('admin:manage-data', event => {
    if (event.detail?.page === 'contact') openManager();
  });
})();
