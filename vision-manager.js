(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL;
  const EDITOR = 'vision';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
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

  function normalizeRows(rows) {
    const result = Array.isArray(rows) ? rows.map(row => ({
      title: String(row?.title ?? row?.[0] ?? ''),
      detail: String(row?.detail ?? row?.[1] ?? '')
    })) : [];

    while (result.length < 2) result.push({ title: '', detail: '' });
    return result;
  }

  function rowHtml(row, index) {
    const sheetRow = index + 2;
    const specialLabel = sheetRow === 2
      ? 'ข้อความเล็กส่วนหัว'
      : sheetRow === 3
        ? 'หัวข้อใหญ่'
        : '';

    const titleField = specialLabel
      ? `<span class="vision-manager-badge" data-vision-fixed-title="${esc(row.title || specialLabel)}">${esc(specialLabel)}</span>`
      : `<input class="vision-manager-input" data-vision-col="title" type="text"
           value="${esc(row.title)}" autocomplete="off">`;

    const detailField = sheetRow >= 4
      ? `<textarea class="vision-manager-input vision-manager-detail" data-vision-col="detail" rows="4"
           placeholder="พิมพ์ / เพื่อขึ้นบรรทัดใหม่">${esc(row.detail)}</textarea>`
      : `<input class="vision-manager-input" data-vision-col="detail" type="text"
           value="${esc(row.detail)}" autocomplete="off">`;

    return `
      <tr data-vision-row="${index}">
        <td>${titleField}</td>
        <td>${detailField}</td>
      </tr>`;
  }

  function managerHtml(data) {
    const headers = Array.isArray(data.headers) ? data.headers : ['หัวข้อ', 'รายละเอียด'];
    const rows = normalizeRows(data.rows);

    return `
      <div class="vision-manager-popup">
        <div class="vision-manager-table-wrap">
          <table class="vision-manager-table">
            <thead>
              <tr>
                <th>${esc(headers[0] || 'หัวข้อ')}</th>
                <th>${esc(headers[1] || 'รายละเอียด')}</th>
              </tr>
            </thead>
            <tbody id="visionManagerBody">
              ${rows.map(rowHtml).join('')}
            </tbody>
          </table>
        </div>
        <div class="vision-manager-toolbar">
          <button id="visionManagerAdd" class="vision-manager-add" type="button">+ เพิ่มแถวใหม่</button>
        </div>
        <div id="visionManagerError" class="vision-manager-error"></div>
        <div class="vision-manager-actions">
          <button id="visionManagerSave" class="vision-manager-save" type="button">บันทึกข้อมูล</button>
        </div>
      </div>`;
  }

  function bindSlashNewline(textarea) {
    if (!textarea || textarea.dataset.slashBound === '1') return;
    textarea.dataset.slashBound = '1';

    textarea.addEventListener('beforeinput', event => {
      if (event.inputType !== 'insertText' || event.data !== '/') return;
      event.preventDefault();
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      textarea.setRangeText('\n', start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // รองรับการวางข้อความที่มี / มาจาก Sheet หรือ Clipboard
    textarea.addEventListener('input', () => {
      if (!textarea.value.includes('/')) return;
      const caret = textarea.selectionStart ?? textarea.value.length;
      const before = textarea.value.slice(0, caret);
      const removedBefore = (before.match(/\//g) || []).length;
      textarea.value = textarea.value.replace(/\s*\/\s*/g, '\n');
      const nextCaret = Math.max(0, caret - removedBefore * 0);
      textarea.setSelectionRange(Math.min(nextCaret, textarea.value.length), Math.min(nextCaret, textarea.value.length));
    });
  }

  function bindDetailTextareas(root) {
    root.querySelectorAll('.vision-manager-detail').forEach(bindSlashNewline);
  }

  function addRow() {
    const body = document.getElementById('visionManagerBody');
    if (!body) return;
    const index = body.querySelectorAll('tr[data-vision-row]').length;
    body.insertAdjacentHTML('beforeend', rowHtml({ title: '', detail: '' }, index));
    const row = body.lastElementChild;
    bindDetailTextareas(row);
    row?.querySelector('[data-vision-col="title"]')?.focus();
  }

  function collectRows() {
    return Array.from(document.querySelectorAll('#visionManagerBody tr[data-vision-row]')).map(row => {
      const titleInput = row.querySelector('[data-vision-col="title"]');
      const fixedTitle = row.querySelector('[data-vision-fixed-title]')?.dataset.visionFixedTitle ?? '';
      const title = titleInput ? titleInput.value : fixedTitle;
      const detail = row.querySelector('[data-vision-col="detail"]')?.value ?? '';
      return [String(title).trim(), String(detail).trim()];
    });
  }

  function applySavedRows(rows) {
    const normalized = Array.isArray(rows) ? rows.map(row => [
      String(row?.[0] ?? ''), String(row?.[1] ?? '')
    ]) : [];

    const data = {
      kicker: normalized[0]?.[1] || '',
      title: normalized[1]?.[1] || '',
      sections: normalized.slice(2).map(row => ({ title: row[0], detail: row[1] }))
    };

    window.AboutPage?.renderVision(data);
  }

  async function openManager() {
    Swal.fire({
      title: 'กำลังโหลดข้อมูลวิสัยทัศน์...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const data = await api('editwebsite');

      await Swal.fire({
        title: 'จัดการ วิสัยทัศน์ อัตลักษณ์ พันธกิจ',
        html: managerHtml(data),
        width: 'min(1120px, 97vw)',
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: () => {
          const popup = Swal.getHtmlContainer();
          const addButton = document.getElementById('visionManagerAdd');
          const saveButton = document.getElementById('visionManagerSave');
          const errorBox = document.getElementById('visionManagerError');

          if (popup) bindDetailTextareas(popup);
          addButton?.addEventListener('click', addRow);

          saveButton?.addEventListener('click', async () => {
            if (!errorBox) return;
            const rows = collectRows();
            errorBox.textContent = '';

            if (rows.length < 2) {
              errorBox.textContent = 'ต้องมีอย่างน้อยแถว Q2 และ Q3';
              return;
            }

            saveButton.disabled = true;
            saveButton.textContent = 'กำลังบันทึก...';

            try {
              const result = await api('saveeditwebsite', { values: rows });
              applySavedRows(result.values || rows);
              window.SiteFast?.clear?.('homefast');
              window.SiteFast?.clear?.('about');

              Swal.fire({
                icon: 'success',
                title: 'บันทึกข้อมูลแล้ว',
                text: 'หน้า Vision ถูกอัปเดตเรียบร้อย',
                timer: 1400,
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
    if (event.detail?.page === 'vision') openManager();
  });
})();
