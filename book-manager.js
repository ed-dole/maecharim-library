(() => {
  'use strict';

  const API = String(window.APP_CONFIG?.API_URL || '').trim();
  const SOURCE_MAX_BYTES = 100 * 1024 * 1024; // รับไฟล์ต้นฉบับได้สูงสุด 100 MB
  const UPLOAD_TARGET_BYTES = 1200 * 1024;     // ย่อจริงให้เหมาะกับเว็บและต่ำกว่าขีดจำกัด Apps Script
  const PLACEHOLDER = 'https://placehold.co/180x240?text=Book';

  let state = { items: [], categories: [] };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  })[ch]);

  const text30 = value => {
    const chars = Array.from(String(value || '').replace(/\s+/g, ' ').trim());
    return esc(chars.length > 30 ? chars.slice(0, 30).join('') + '....' : chars.join(''));
  };

  async function api(action, data = {}) {
    if (!API) throw new Error('ไม่พบ URL ของ Apps Script');
    const token = sessionStorage.getItem('mysiteAdminToken') || '';
    const response = await fetch(API, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify({ mode:'bookadmin', action, data, token })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'ดำเนินการไม่สำเร็จ');
    return result.data;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('แปลงรูปภาพไม่สำเร็จ')), 'image/jpeg', quality);
    });
  }

  async function compressCover(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
    if (file.size > SOURCE_MAX_BYTES) throw new Error('ไฟล์ต้นฉบับมีขนาดเกิน 100 MB');

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('เปิดรูปภาพไม่สำเร็จ'));
        img.src = objectUrl;
      });

      let width = Math.max(1, image.naturalWidth || image.width || 1);
      let height = Math.max(1, image.naturalHeight || image.height || 1);
      const scale = Math.min(1, 1800 / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      let quality = .9;
      const canvas = document.createElement('canvas');

      for (let attempt = 0; attempt < 32; attempt++) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha:false });
        if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการย่อรูปภาพ');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        const blob = await canvasToJpegBlob(canvas, quality);
        if (blob.size <= UPLOAD_TARGET_BYTES) {
          const base = (String(file.name || 'book-cover').replace(/\.[^.]+$/, '') || 'book-cover').replace(/[\\/:*?"<>|]/g, '_');
          return { dataUrl: await blobToDataUrl(blob), fileName: base + '.jpg', size: blob.size };
        }
        if (quality > .5) quality = Math.max(.5, quality - .08);
        else {
          width = Math.max(360, Math.round(width * .84));
          height = Math.max(480, Math.round(height * .84));
          quality = .82;
        }
      }
      throw new Error('ไม่สามารถย่อรูปภาพได้ กรุณาเลือกรูปอื่น');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function load() {
    const data = await api('list');
    state.items = Array.isArray(data?.items) ? data.items : [];
    state.categories = Array.isArray(data?.categories) ? data.categories : [];
  }

  function tableHtml() {
    const rows = state.items.map(item => `
      <tr>
        <td class="book-manager-number">${esc(item.bookNo)}</td>
        <td>${esc(item.category)}</td>
        <td class="book-manager-title-cell">${esc(item.title)}</td>
        <td><img class="book-manager-thumb" src="${esc(item.imageUrl || PLACEHOLDER)}" alt="${esc(item.title || 'ปกหนังสือ')}" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"></td>
        <td class="book-manager-detail-cell" title="${esc(item.detail || '')}">${text30(item.detail)}</td>
        <td>
          <div class="book-manager-row-actions">
            <button class="book-manager-btn book-manager-edit" type="button" data-book-edit="${item.rowNumber}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
            <button class="book-manager-btn book-manager-delete" type="button" data-book-delete="${item.rowNumber}"><i class="fa-solid fa-trash"></i> ลบ</button>
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="book-manager-empty">ยังไม่มีรายการหนังสือ</td></tr>';

    return `
      <div class="book-manager-shell">
        <div class="book-manager-toolbar">
          <div>
            <h2><i class="fa-solid fa-book-open"></i> หนังสือที่น่าสนใจ</h2>
            <p>ข้อมูลจากชีต book • รายการล่าสุดอยู่บนสุด</p>
          </div>
          <button id="bookManagerAdd" class="book-manager-add" type="button"><i class="fa-solid fa-plus"></i> เพิ่มหนังสือ</button>
        </div>
        <div class="book-manager-table-wrap">
          <table class="book-manager-table">
            <thead><tr><th>เล่มที่</th><th>หมวด</th><th>ชื่อหนังสือ</th><th>URL รูปปก</th><th>รายละเอียดที่น่าสนใจ</th><th>จัดการ</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function openManager() {
    Swal.fire({ title:'กำลังโหลดรายการหนังสือ...', allowOutsideClick:false, didOpen:() => Swal.showLoading() });
    try {
      await load();
      renderManager();
    } catch (error) {
      Swal.fire({ icon:'error', title:'โหลดข้อมูลไม่สำเร็จ', text:error.message });
    }
  }

  function renderManager() {
    Swal.fire({
      html: tableHtml(),
      width: 'min(1500px,97vw)',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: { popup:'book-manager-popup' },
      didOpen: bindManager
    });
  }

  function bindManager() {
    const root = Swal.getPopup();
    if (!root) return;
    root.querySelector('#bookManagerAdd')?.addEventListener('click', () => openEditor());
    root.querySelectorAll('[data-book-edit]').forEach(button => {
      button.addEventListener('click', () => openEditor(state.items.find(item => item.rowNumber === Number(button.dataset.bookEdit)) || {}));
    });
    root.querySelectorAll('[data-book-delete]').forEach(button => {
      button.addEventListener('click', () => removeBook(Number(button.dataset.bookDelete)));
    });
  }

  function categoryOptions(selected) {
    const current = String(selected || '').trim();
    const categories = state.categories.slice();
    if (current && !categories.includes(current)) categories.unshift(current);
    if (!categories.length) return '<option value="">ยังไม่มีหมวดใน book!G2:G</option>';
    return '<option value="">-- เลือกหมวด --</option>' + categories.map(category => `<option value="${esc(category)}" ${category === current ? 'selected' : ''}>${esc(category)}</option>`).join('');
  }

  async function openEditor(item = {}) {
    let upload = null;
    const existingImage = String(item.imageUrl || '').trim();
    const html = `
      <div class="book-editor-grid">
        <div class="book-editor-preview">
          <div class="book-editor-cover-frame"><img id="bookEditorPreview" src="${esc(existingImage || PLACEHOLDER)}" alt="ตัวอย่างปก" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"></div>
          <span id="bookEditorPreviewCategory" class="book-editor-preview-category">${esc(item.category || 'หมวดหนังสือ')}</span>
          <strong id="bookEditorPreviewTitle">${esc(item.title || 'ชื่อหนังสือ')}</strong>
        </div>
        <div class="book-editor-form">
          <label for="bookEditorCategory">หมวด</label>
          <select id="bookEditorCategory">${categoryOptions(item.category)}</select>

          <label for="bookEditorTitle">ชื่อหนังสือ</label>
          <input id="bookEditorTitle" type="text" maxlength="300" value="${esc(item.title || '')}" placeholder="ระบุชื่อหนังสือ">

          <label for="bookEditorImageUrl">URL รูปปก หรืออัปโหลดรูป</label>
          <div class="book-editor-image-row">
            <input id="bookEditorImageUrl" type="url" value="${esc(existingImage)}" placeholder="https://...">
            <label class="book-editor-upload-button" for="bookEditorImageFile"><i class="fa-solid fa-cloud-arrow-up"></i> อัปโหลดรูป</label>
            <input id="bookEditorImageFile" type="file" accept="image/*" hidden>
          </div>
          <small id="bookEditorImageStatus" class="book-editor-image-status">รับไฟล์ต้นฉบับสูงสุด 100 MB และย่อให้เหมาะกับเว็บไซต์ก่อนอัปโหลด Google Drive</small>

          <label for="bookEditorDetail">รายละเอียดที่น่าสนใจ</label>
          <textarea id="bookEditorDetail" rows="7" placeholder="พิมพ์ / เมื่อต้องการเริ่มบรรทัดใหม่">${esc(item.detail || '')}</textarea>
          <small class="book-editor-help">ใช้เครื่องหมาย / เพื่อขึ้นบรรทัดใหม่ตอนแสดงผล</small>
        </div>
      </div>`;

    const result = await Swal.fire({
      title: item.rowNumber ? `แก้ไขหนังสือ เล่มที่ ${esc(item.bookNo)}` : 'เพิ่มหนังสือ',
      html,
      width: 1040,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#16a34a',
      didOpen: () => {
        const root = Swal.getPopup();
        const category = root.querySelector('#bookEditorCategory');
        const title = root.querySelector('#bookEditorTitle');
        const imageUrl = root.querySelector('#bookEditorImageUrl');
        const imageFile = root.querySelector('#bookEditorImageFile');
        const preview = root.querySelector('#bookEditorPreview');
        const status = root.querySelector('#bookEditorImageStatus');
        const syncText = () => {
          root.querySelector('#bookEditorPreviewCategory').textContent = category.value || 'หมวดหนังสือ';
          root.querySelector('#bookEditorPreviewTitle').textContent = title.value || 'ชื่อหนังสือ';
        };
        category.addEventListener('change', syncText);
        title.addEventListener('input', syncText);
        imageUrl.addEventListener('input', () => {
          upload = null;
          preview.src = imageUrl.value.trim() || PLACEHOLDER;
          status.textContent = 'ใช้ URL รูปปกที่ระบุ';
          status.className = 'book-editor-image-status';
        });
        imageFile.addEventListener('change', async () => {
          const file = imageFile.files?.[0];
          if (!file) return;
          status.textContent = 'กำลังย่อรูปภาพ...';
          status.className = 'book-editor-image-status is-loading';
          try {
            upload = await compressCover(file);
            imageUrl.value = '';
            preview.src = upload.dataUrl;
            status.textContent = `พร้อมอัปโหลด ${file.name} • ${Math.ceil(upload.size / 1024)} KB`;
            status.className = 'book-editor-image-status is-ready';
          } catch (error) {
            upload = null;
            imageFile.value = '';
            status.textContent = error.message;
            status.className = 'book-editor-image-status is-error';
          }
        });
      },
      preConfirm: () => {
        const root = Swal.getPopup();
        const data = {
          rowNumber: item.rowNumber || '',
          category: root.querySelector('#bookEditorCategory').value.trim(),
          title: root.querySelector('#bookEditorTitle').value.trim(),
          imageUrl: root.querySelector('#bookEditorImageUrl').value.trim(),
          imageData: upload?.dataUrl || '',
          imageName: upload?.fileName || '',
          detail: root.querySelector('#bookEditorDetail').value.trim()
        };
        if (!data.category) { Swal.showValidationMessage('กรุณาเลือกหมวดจาก book!G2:G'); return false; }
        if (!data.title) { Swal.showValidationMessage('กรุณาระบุชื่อหนังสือ'); return false; }
        if (!data.imageUrl && !data.imageData) { Swal.showValidationMessage('กรุณาระบุ URL รูปปกหรืออัปโหลดรูป'); return false; }
        if (data.imageUrl && !/^https?:\/\//i.test(data.imageUrl)) { Swal.showValidationMessage('URL รูปปกไม่ถูกต้อง'); return false; }
        if (!data.detail) { Swal.showValidationMessage('กรุณาระบุรายละเอียดที่น่าสนใจ'); return false; }
        return data;
      }
    });

    if (!result.isConfirmed) { renderManager(); return; }
    try {
      Swal.fire({ title:'กำลังบันทึกหนังสือ...', allowOutsideClick:false, didOpen:() => Swal.showLoading() });
      await api('save', result.value);
      document.dispatchEvent(new Event('book-admin-updated'));
      await load();
      renderManager();
    } catch (error) {
      Swal.fire({ icon:'error', title:'บันทึกไม่สำเร็จ', text:error.message }).then(() => renderManager());
    }
  }

  async function removeBook(rowNumber) {
    const confirm = await Swal.fire({
      icon:'warning', title:'ยืนยันการลบหนังสือ?', text:'รายการนี้จะถูกลบออกจากคอลัมน์ A:E ของชีต book',
      showCancelButton:true, confirmButtonText:'ลบ', cancelButtonText:'ยกเลิก', confirmButtonColor:'#dc2626'
    });
    if (!confirm.isConfirmed) { renderManager(); return; }
    try {
      Swal.fire({ title:'กำลังลบ...', allowOutsideClick:false, didOpen:() => Swal.showLoading() });
      await api('delete', { rowNumber });
      document.dispatchEvent(new Event('book-admin-updated'));
      await load();
      renderManager();
    } catch (error) {
      Swal.fire({ icon:'error', title:'ลบไม่สำเร็จ', text:error.message }).then(() => renderManager());
    }
  }

  document.getElementById('manageFeaturedBooksButton')?.addEventListener('click', openManager);
})();
