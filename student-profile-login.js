(() => {
  'use strict';

  function showMessage(options) {
    if (window.Swal) return Swal.fire(options);
    window.alert(options.text || options.title || 'เกิดข้อผิดพลาด');
    return Promise.resolve();
  }


  function setTextColor(element, value) {
    const color = String(value || '').trim();
    if (!element || !color) return;
    try {
      if (window.CSS && CSS.supports && !CSS.supports('color', color)) return;
    } catch (_) {}
    element.style.color = color;
  }

  function applyLoginCardConfig(config) {
    const data = config || {};
    const title = document.getElementById('studentServicesLoginTitle');
    const subtitle = document.getElementById('studentServicesLoginSubtitle');
    const photo = document.getElementById('studentServicesLoginPhoto');
    const logo = document.getElementById('studentServicesLoginLogo');

    if (title && data.title) title.textContent = String(data.title);
    if (subtitle) subtitle.textContent = String(data.subtitle || '');
    setTextColor(title, data.titleColor);
    setTextColor(subtitle, data.subtitleColor);

    if (photo && data.photo) photo.src = String(data.photo);
    if (logo && data.logo) {
      logo.src = String(data.logo);
      logo.hidden = false;
    }
  }

  async function loadLoginCardConfig() {
    try {
      if (!window.SiteFast || typeof window.SiteFast.getHomeFast !== 'function') return;
      const result = await window.SiteFast.getHomeFast();
      const data = result?.data || result || {};
      if (data.studentLogin) applyLoginCardConfig(data.studentLogin);
    } catch (error) {
      // การโหลดรูป/ข้อความเป็นเพียงส่วนแสดงผล ไม่ให้กระทบระบบ Login เดิม
      console.warn('student login card config:', error);
    }
  }

  async function login(event) {
    event.preventDefault();

    const input = document.getElementById('studentServicesId');
    const button = document.getElementById('studentServicesLoginBtn');
    const rollno = String(input?.value || '').replace(/\D/g, '').trim().slice(0, 10);

    if (!rollno) {
      await showMessage({
        icon: 'warning',
        title: 'กรุณากรอกรหัสนักศึกษา',
        text: 'ระบุรหัสนักศึกษาก่อนเข้าสู่ระบบ',
        confirmButtonText: 'ตกลง'
      });
      input?.focus();
      return;
    }

    if (input) input.value = rollno;
    if (button) {
      button.disabled = true;
      button.textContent = 'กำลังเข้าสู่ระบบ...';
    }

    /*
     * เดิมหน้านี้เรียก Apps Script แบบ JSONP เพื่อตรวจรหัสก่อน 1 รอบ
     * แล้ว profile.html จึงเรียก Web App ซ้ำอีกรอบ ทำให้ช้าและเกิด false timeout
     * ทั้งที่ Web App ค้นหาพบรหัสได้จริง
     *
     * รุ่นนี้ส่งรหัสไป profile.html ทันที แล้วให้ Web App โปรไฟล์เป็นผู้ตรวจรหัส
     * เพียงครั้งเดียว จึงไม่มี REQUEST_TIMEOUT/JSONP ที่ตัดการทำงานกลางทาง
     */
    try {
      sessionStorage.setItem('SSS_PROFILE_ROLLNO', rollno);
    } catch (_) {}

    const profileUrl = `profile.html?rollno=${encodeURIComponent(rollno)}`;
    window.location.assign(profileUrl);
  }

  function init() {
    const form = document.getElementById('studentServicesLoginForm');
    const input = document.getElementById('studentServicesId');

    input?.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
    });
    form?.addEventListener('submit', login);
    loadLoginCardConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
