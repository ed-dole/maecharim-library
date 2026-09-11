(() => {
  'use strict';

  const API_URL =
    window.APP_CONFIG.API_URL;

  const FALLBACK_PHOTO =
    'https://static.wixstatic.com/media/a503e5_9064df4bf13044dab24382c889fa7d87~mv2.png';

  const $ = id => document.getElementById(id);

  function getStudent() {
    try {
      return JSON.parse(
        localStorage.getItem('LEARN_STUDENT') || 'null'
      );
    } catch (_) {
      return null;
    }
  }

  function safePhoto(url) {
    const value = String(url || '').trim();
    return value || FALLBACK_PHOTO;
  }

  async function getTotalHours(studentId) {
    if (!studentId) return 0;

    const url = new URL(API_URL);
    url.searchParams.set('mode', 'learning');
    url.searchParams.set('action', 'getStudentTotalHours');
    url.searchParams.set('studentId', studentId);
    url.searchParams.set('_t', Date.now());

    const response = await fetch(url.toString(), {
      cache: 'no-store'
    });
    const result = await response.json();

    if (!response.ok || result?.success === false) {
      throw new Error(
        result?.message || 'โหลดข้อมูลกิจกรรมไม่สำเร็จ'
      );
    }

    const value = Object.prototype.hasOwnProperty.call(
      result,
      'data'
    )
      ? result.data
      : result;

    return Number(value) || 0;
  }

  async function renderProfile(studentOverride) {
    const student =
      studentOverride === undefined
        ? getStudent()
        : studentOverride;

    const photo = $('mobileProfilePhoto');
    const hours = $('mobileProfileHours');
    const hoursLabel = $('mobileProfileHoursLabel');

    if (!photo || !hours) return;

    photo.onerror = () => {
      photo.onerror = null;
      photo.src = FALLBACK_PHOTO;
    };

    if (hoursLabel) {
      hoursLabel.textContent = 'Point';
    }

    if (!student) {
      photo.src = FALLBACK_PHOTO;
      photo.alt = 'เข้าสู่ระบบ';
      photo.title = 'เข้าสู่ระบบ';
      hours.textContent = '0';
      return;
    }

    const studentPhoto =
      student.photo ||
      student.photoUrl ||
      student.image ||
      student.imageUrl ||
      '';

    const studentName =
      student.fullname ||
      student.fullName ||
      student.name ||
      'สมาชิก';

    const studentId =
      student.studentId ||
      student.studentID ||
      student.id ||
      '';

    photo.src = safePhoto(studentPhoto);
    photo.alt = studentName;
    photo.title = studentName;
    hours.textContent = '...';

    if (!studentId) {
      hours.textContent = '0';
      return;
    }

    try {
      const totalHours = await getTotalHours(studentId);
      hours.textContent = String(totalHours || 0);
    } catch (error) {
      console.error('โหลด Point ไม่สำเร็จ:', error);
      hours.textContent = '0';
    }
  }

  function openAccount() {
    const currentStudent = getStudent();

    if (!currentStudent) {
      window.LearningBase?.openStudentModal?.();
      return;
    }

    window.LearningBase?.openEditProfile?.();
  }

  function openCart() {
    window.LearningBase?.openCart?.();
  }

  function openScore() {
    window.LearningBase?.openScoreModal?.();
  }

  function activateWithKeyboard(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const photo = $('mobileProfilePhoto');
    const point = $('mobileProfilePoint');

    $('profileCartBtn')?.addEventListener('click', openCart);

    photo?.addEventListener('click', openAccount);
    photo?.addEventListener('keydown', event => {
      activateWithKeyboard(event, openAccount);
    });

    point?.addEventListener('click', openScore);
    point?.addEventListener('keydown', event => {
      activateWithKeyboard(event, openScore);
    });

    renderProfile();
  });

  window.addEventListener('LEARN_AUTH_CHANGED', event => {
    const newStudent = event.detail?.student || getStudent();
    renderProfile(newStudent);
  });

  window.addEventListener('storage', event => {
    if (event.key === 'LEARN_STUDENT') {
      renderProfile();
    }
  });

  window.ProfileBox = {
    renderProfile,
    resetProfileBox() {},
    hideProfileBox() {}
  };
})();
