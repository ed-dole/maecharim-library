
(() => {
  'use strict';

  const API_URL = window.APP_CONFIG.API_URL;
  const TEACHER_URL = API_URL + '?page=teacher';
  let student = JSON.parse(localStorage.getItem('LEARN_STUDENT') || 'null');
  let editProfileRemovePhoto = false;
  let activities = [];
  let currentActivityTarget = 'all';
  let hourText = "ชั่วโมง";
  let detailSlideIndex = 0;
  let detailSlideTimer = null;

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  async function callApi(action, data = {}, method = 'POST') {
    let response;
    if (method === 'GET') {
      const url = new URL(API_URL);
      url.searchParams.set('mode', 'learning');
      url.searchParams.set('action', action);
      Object.entries(data).forEach(([key, value]) => url.searchParams.set(key, value ?? ''));
      response = await fetch(url.toString(), { cache: 'no-store' });
    } else {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ mode: 'learning', action, data })
      });
    }
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch { throw new Error('API ส่งข้อมูลกลับมาไม่ใช่ JSON'); }
    if (!response.ok || result?.success === false) throw new Error(result?.message || `HTTP ${response.status}`);
    return Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
  }

  function showPage(id, btn) {
    const root = $('learningBaseModule');
    if (!root) return;
    root.querySelectorAll(':scope > .learning-container > section').forEach(s => s.classList.add('learning-hidden'));
    $(id)?.classList.remove('learning-hidden');
    root.querySelectorAll('.learning-tabs button').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');

    // เมื่อกดแท็บ "กิจกรรมทั้งหมด" ให้ยกเลิกตัวกรองกลุ่มเป้าหมาย
    // และแสดงกิจกรรมทุกประเภทใน activityGrid ทันที
    if (id === 'activitiesPage') {
      currentActivityTarget = 'all';
      root.querySelectorAll('.shopactivity-target-btn').forEach(button => {
        const isActive = button.dataset.targetFilter === 'all';
        button.classList.toggle('target-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      renderActivities(activities);
    }

    if (id === 'historyPage') loadHistory();
  }

  function openStudentModal() {
    const modal = $('studentModal');
    const loginSection = $('loginSection');
    const registerBox = $('registerBox');
    const newBtn = $('newRegisterBtn');
    const logoutBox = $('logoutBox');

    modal.style.display = 'flex';
    registerBox.style.display = 'none';
    loginSection.style.display = 'block';
    clearStudentPhoto();

    if (student) {
      $('loginPhone').value = student.phone || '';
      logoutBox.style.display = 'block';
      if (newBtn) newBtn.style.display = 'none';
    } else {
      $('loginPhone').value = '';
      logoutBox.style.display = 'none';
      if (newBtn) newBtn.style.display = 'inline-block';
    }
  }

  function closeModal(id) {
    const modal = $(id);
    if (modal) modal.style.display = 'none';
    if (id === 'detailModal') clearInterval(detailSlideTimer);
  }

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ''));
    };

    reader.onerror = () => {
      reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    };

    reader.readAsDataURL(file);
  });
}

  function clearStudentPhoto() {
    const input = $('stuPhoto');
    const wrap = $('stuPhotoPreviewWrap');
    const preview = $('stuPhotoPreview');
    if (input) input.value = '';
    if (preview) preview.removeAttribute('src');
    if (wrap) wrap.hidden = true;
  }
function openEditProfile() {
  if (!student) {
    openStudentModal();
    return;
  }

  const modal = $('editProfileModal');
  if (!modal) return;

  editProfileRemovePhoto = false;

  $('editFullname').value = student.fullname || '';
  $('editPhone').value = student.phone || '';
  $('editAddress').value = student.address || '';

  const photoInput = $('editPhoto');
  const previewWrap = $('editPhotoPreviewWrap');
  const preview = $('editPhotoPreview');

  if (photoInput) {
    photoInput.value = '';
  }

  if (student.photo) {
    preview.src = student.photo;
    previewWrap.hidden = false;
  } else {
    preview.removeAttribute('src');
    previewWrap.hidden = true;
  }

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    $('editFullname')?.focus();
  }, 0);
}
function closeEditProfile() {
  const modal = $('editProfileModal');

  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }

  document.body.style.overflow = '';

  const photoInput = $('editPhoto');

  if (photoInput) {
    photoInput.value = '';
  }

  editProfileRemovePhoto = false;

  // คืนค่า Profile Popup ให้เป็นสถานะปิด
  window.ProfileBox?.resetProfileBox();
}
  function removeEditProfilePhoto() {
  const input = $('editPhoto');
  const preview = $('editPhotoPreview');
  const wrap = $('editPhotoPreviewWrap');

  editProfileRemovePhoto = true;

  if (input) {
    input.value = '';
  }

  if (preview) {
    preview.removeAttribute('src');
  }

  if (wrap) {
    wrap.hidden = true;
  }
}
  async function saveEditProfile() {
  if (!student?.studentId) {
    closeEditProfile();

    return Swal.fire(
      'แจ้งเตือน',
      'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      'warning'
    );
  }

const fullname = $('editFullname')?.value.trim() || '';
const phone = $('editPhone')?.value.trim() || '';
const address = $('editAddress')?.value.trim() || '';

// บังคับเฉพาะชื่อและเบอร์โทร
if (!fullname || !phone) {
  return Swal.fire(
    'แจ้งเตือน',
    'กรุณากรอกชื่อ-นามสกุล และเบอร์โทรให้ครบ',
    'warning'
  );
}

  if (!/^0\d{9}$/.test(phone)) {
    return Swal.fire(
      'แจ้งเตือน',
      'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก',
      'warning'
    );
  }

  const photoInput = $('editPhoto');
  const photoFile = photoInput?.files?.[0] || null;

  const data = {
    studentId: student.studentId,
    fullname,
    phone,
    address,

    // หากไม่เลือกรูปใหม่ Backend จะเก็บรูปเดิมไว้
    photoBase64: '',
    photoName: '',

    // true เมื่อต้องการลบรูปเดิม
    removePhoto: editProfileRemovePhoto
  };

  if (photoFile) {
    if (!photoFile.type.startsWith('image/')) {
      return Swal.fire(
        'แจ้งเตือน',
        'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        'warning'
      );
    }

    if (photoFile.size > 5 * 1024 * 1024) {
      return Swal.fire(
        'แจ้งเตือน',
        'รูปภาพต้องมีขนาดไม่เกิน 5 MB',
        'warning'
      );
    }

    try {
      data.photoBase64 = await fileToDataUrl(photoFile);
      data.photoName =
        photoFile.name || `student-${Date.now()}.jpg`;

      // เมื่อเลือกรูปใหม่ ไม่ต้องลบรูป
      data.removePhoto = false;

    } catch (error) {
      return Swal.fire(
        'ผิดพลาด',
        error.message,
        'error'
      );
    }
  }

  const saveButton = $('saveEditProfileBtn');

  try {
    if (saveButton) {
      saveButton.disabled = true;
    }

    Swal.fire({
      title: 'กำลังบันทึกข้อมูล',
      text: photoFile
        ? 'กำลังอัปโหลดรูปภาพใหม่'
        : 'กรุณารอสักครู่...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const res = await callApi(
      'updateStudentProfile',
      data
    );

    Swal.close();

    if (!res.ok) {
      return Swal.fire(
        'แจ้งเตือน',
        res.message || 'ไม่สามารถบันทึกข้อมูลได้',
        'warning'
      );
    }

    student = res.student;

    localStorage.setItem(
      'LEARN_STUDENT',
      JSON.stringify(student)
    );

    closeEditProfile();

    // อัปเดตชื่อ รูป ชั่วโมง และข้อมูลบน Profile Box
    updateTop();

    await Swal.fire(
      'สำเร็จ',
      res.message || 'บันทึกข้อมูลเรียบร้อยแล้ว',
      'success'
    );

  } catch (error) {
    Swal.close();

    Swal.fire(
      'ผิดพลาด',
      error.message,
      'error'
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
    }
  }
}
  function triggerMobileProfilePhotoEffect() {
    const photo = $('mobileProfilePhoto');
    if (!photo) return;

    // ลบคลาสก่อนเพื่อให้เรียก effect ซ้ำได้ทุกครั้ง
    photo.classList.remove('profile-login-success-effect');
    void photo.offsetWidth;
    photo.classList.add('profile-login-success-effect');

    const cleanup = () => {
      photo.classList.remove('profile-login-success-effect');
      photo.removeEventListener('animationend', cleanup);
    };

    photo.addEventListener('animationend', cleanup);
    setTimeout(cleanup, 1800);
  }

  async function registerStudent() {
    const photoInput = $('stuPhoto');
    const photoFile = photoInput?.files?.[0] || null;

    const data = {
      fullname: $('stuFullname').value.trim(),
      phone: $('stuPhone').value.trim(),
      address: $('stuAddress').value.trim(),
      photoBase64: '',
      photoName: ''
    };

    if (!data.fullname || !data.phone || !data.address)
      return Swal.fire('แจ้งเตือน','กรุณากรอก ชื่อ-นามสกุล เบอร์โทร และที่อยู่ ให้ครบ','warning');
    if (!/^0\d{9}$/.test(data.phone))
      return Swal.fire('แจ้งเตือน','เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก','warning');

    if (photoFile) {
      if (!photoFile.type.startsWith('image/')) {
        return Swal.fire('แจ้งเตือน','กรุณาเลือกไฟล์รูปภาพเท่านั้น','warning');
      }
      if (photoFile.size > 5 * 1024 * 1024) {
        return Swal.fire('แจ้งเตือน','รูปภาพต้องมีขนาดไม่เกิน 5 MB','warning');
      }
      data.photoBase64 = await fileToDataUrl(photoFile);
      data.photoName = photoFile.name || `student-${Date.now()}.jpg`;
    }

    try {
      Swal.fire({
        title: 'กำลังลงทะเบียน',
        text: photoFile ? 'กำลังอัปโหลดรูปภาพ' : 'กรุณารอสักครู่...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      const res = await callApi('registerStudent', data);
      Swal.close();

      if (!res.ok || !res.student) {
        return Swal.fire('แจ้งเตือน', res.message || 'ลงทะเบียนไม่สำเร็จ', 'warning');
      }

      // แจ้งลงทะเบียนสำเร็จ 2 วินาที และปิดอัตโนมัติ ไม่ต้องกด OK
      await Swal.fire({
        icon: 'success',
        title: 'สำเร็จ',
        text: res.message || 'ลงทะเบียนสำเร็จ',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      });

      // ถือว่าลงทะเบียนสำเร็จ = เข้าสู่ระบบทันที
      student = res.student;
      localStorage.setItem('LEARN_STUDENT', JSON.stringify(student));
      closeModal('studentModal');
      clearStudentPhoto();
      updateTop();

      // แจ้งสถานะเข้าสู่ระบบ 1 วินาที แล้วปิดอัตโนมัติ
      await Swal.fire({
        icon: 'success',
        title: 'เข้าสู่ระบบแล้ว',
        timer: 1000,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      });

      // เน้นรูปโปรไฟล์หลัง Popup ปิด เพื่อให้ผู้ใช้เห็นตำแหน่งบัญชีของตนชัดเจน
      triggerMobileProfilePhotoEffect();
    } catch(err) { Swal.close(); Swal.fire('ผิดพลาด',err.message,'error'); }
  }

  async function studentLogin() {
    try {
      Swal.showLoading();
      const res = await callApi('studentLogin', { phone: $('loginPhone').value.trim() });
      Swal.close();
      if (!res.ok) return Swal.fire('แจ้งเตือน',res.message,'warning');
      student = res.student;
      localStorage.setItem('LEARN_STUDENT',JSON.stringify(student));
      closeModal('studentModal'); updateTop();
      Swal.fire('สำเร็จ',res.message,'success');
    } catch(err) { Swal.close(); Swal.fire('ผิดพลาด',err.message,'error'); }
  }

  async function loadActivities() {
    const grid = $('activityGrid');
    if (!grid) return;
    grid.innerHTML='กำลังโหลด...';
    try {
      activities = await callApi('getActivities', {}, 'GET') || [];
      renderActivities(getFilteredActivitiesByTarget());
    } catch(err) { grid.innerHTML=`<div class="learning-list-item">โหลดกิจกรรมไม่สำเร็จ: ${escapeHtml(err.message)}</div>`; }
  }

function renderActivities(list) {
  const grid = $('activityGrid');

  if (!list.length) {
    grid.innerHTML = '<div class="learning-list-item">ยังไม่มีกิจกรรม</div>';
    return;
  }

  grid.innerHTML = list.map(a => `
    <article class="learning-card shopactivity-card">

      <div class="learning-card-image-wrap">
        <img
          src="${escapeHtml(a.image1 || 'https://placehold.co/600x400?text=Activity')}"
          alt="${escapeHtml(a.title || 'กิจกรรม')}"
          class="learning-card-image"
          role="button"
          tabindex="0"
          title="คลิกเพื่อดูรายละเอียด"
          onclick="LearningBase.openActivityDetail('${escapeHtml(a.activityId)}')"
          onkeydown="if(event.key==='Enter'){LearningBase.openActivityDetail('${escapeHtml(a.activityId)}')}"
          onerror="this.onerror=null;this.src='https://placehold.co/600x400?text=Activity';"
        >
        <div class="learning-point-badge">${escapeHtml(a.hours || '0')} Point</div>
      </div>

      <div class="learning-card-body">

        <h3 class="learning-card-title">
          ${escapeHtml(a.title || '-')}
        </h3>

        <div class="learning-card-meta-line">
          สำหรับ - ${escapeHtml(a.learningType || '-')}
        </div>

        <div class="learning-card-meta-line">
          วันที่จัดกิจกรรม : ${formatThaiDate(a.activityDate)}
        </div>

        <div class="learning-card-meta-line">
          สถานที่ : ${escapeHtml(a.location || '-')}
        </div>

      </div>

      <button
        type="button"
        class="learning-card-cart-btn"
        onclick="LearningBase.addToCart('${escapeHtml(a.activityId)}')"
      >
        <i class="fa fa-shopping-bag"></i>
        ใส่ตะกร้า
      </button>

    </article>
  `).join('');
}
  function requireStudent() {
    if (student) return true;
    Swal.fire('กรุณายืนยันตัวตน','กดปุ่ม Login ก่อนเลือกกิจกรรม','warning');
    openStudentModal(); return false;
  }

  async function addToCart(activityId) {
    if (!requireStudent()) return;
    try {
      Swal.showLoading();
      const res=await callApi('addToCart',{studentId:student.studentId,activityId});
      Swal.close(); Swal.fire(res.ok?'สำเร็จ':'แจ้งเตือน',res.message,res.ok?'success':'warning');
      loadCartCount();
    } catch(err) { Swal.close(); Swal.fire('ผิดพลาด',err.message,'error'); }
  }

  async function openCart() {
    if (!requireStudent()) return;
    $('cartModal').style.display='flex'; $('cartList').innerHTML='กำลังโหลด...';
    try {
      const list=await callApi('getMyCart',{studentId:student.studentId},'GET') || [];
      if (!list.length) return $('cartList').innerHTML='<div class="learning-list-item">ยังไม่มีกิจกรรมในตะกร้า</div>';
      const total=list.reduce((s,c)=>s+getActivityHours(c.activity),0);
      $('cartList').innerHTML=`<div class="learning-cart-summary"><b>รวมทั้งหมด ${total} ${escapeHtml(hourText)}</b></div>`+
      list.map(c=>`<div class="learning-cart-item">

    <img
        class="learning-cart-image"
        src="${escapeHtml(c.activity?.image1 || 'https://placehold.co/300x200?text=Activity')}"
        alt="${escapeHtml(c.activity?.title || 'กิจกรรม')}"
        loading="lazy"
        onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=Activity';">

    <div class="learning-cart-info">
        <div class="learning-cart-title">
            ${escapeHtml(c.activity?.title||'-')}
        </div>

        <span class="learning-muted">
            ${escapeHtml(hourText)}: ${getActivityHours(c.activity)} ${escapeHtml(hourText)}
        </span><br>

        <span class="learning-muted">
            วันที่ ${formatThaiDate(c.activity?.activityDate)}
        </span>

        <div class="learning-cart-actions">
            <button class="btn-green learning-confirm-btn"
                onclick="LearningBase.confirmJoin('${escapeHtml(c.activityId)}')">
                ยืนยันเข้าร่วม
            </button>

            <button class="btn-red learning-delete-btn"
                onclick="LearningBase.cancelCartItem('${escapeHtml(c.cartId)}')">
                ลบ
            </button>
        </div>
    </div>

</div>`).join('');
    } catch(err) { $('cartList').innerHTML=`<div class="learning-list-item">${escapeHtml(err.message)}</div>`; }
  }

async function loadCartCount() {

  const profileCartBtn = $('profileCartBtn');

  if (!student) {
    if (profileCartBtn) {
      profileCartBtn.innerHTML =
        '<i class="fa fa-shopping-cart"></i> 0 ตะกร้า';
    }
    return;
  }

  try {

    const list = await callApi(
      'getMyCart',
      {
        studentId: student.studentId
      },
      'GET'
    );

    const count = (list || []).length;

    if (profileCartBtn) {
      profileCartBtn.innerHTML =
        `<i class="fa fa-shopping-cart"></i> ${count} ตะกร้า`;
    }

  } catch (error) {

    if (profileCartBtn) {
      profileCartBtn.innerHTML =
        '<i class="fa fa-shopping-cart"></i> 0 ตะกร้า';
    }

  }

}

  async function confirmJoin(activityId) {
    if (!requireStudent()) return;
    try {
      Swal.showLoading(); const res=await callApi('confirmJoin',{studentId:student.studentId,activityId});
      Swal.close(); await Swal.fire(res.ok?'สำเร็จ':'แจ้งเตือน',res.message,res.ok?'success':'warning');
      loadCartCount(); if ($('cartModal').style.display==='flex') openCart();
    } catch(err) { Swal.close(); Swal.fire('ผิดพลาด',err.message,'error'); }
  }

  async function loadHistory() {
    if (!requireStudent()) return;
    $('historyList').innerHTML='กำลังโหลด...';
    try {
      const list=await callApi('getMyHistory',{studentId:student.studentId},'GET')||[];
      $('historyList').innerHTML=list.length?list.map(h=>`<div class="learning-list-item"><b>${escapeHtml(h.activity?.title||'-')}</b><br><span class="learning-muted">ฐาน ${escapeHtml(h.activity?.baseNo||'-')} | วันที่ ${formatThaiDate(h.activity?.activityDate)}</span><br><span class="learning-tag">ยืนยันแล้ว</span></div>`).join(''):'<div class="learning-list-item">ยังไม่มีประวัติการยืนยันกิจกรรม</div>';
    } catch(err) { $('historyList').innerHTML=`<div class="learning-list-item">${escapeHtml(err.message)}</div>`; }
  }

  async function cancelCartItem(cartId) {
    const result=await Swal.fire({title:'ยืนยันการยกเลิก?',text:'ต้องการลบกิจกรรมนี้ออกจากตะกร้าหรือไม่',icon:'warning',showCancelButton:true,confirmButtonText:'ใช่, ยกเลิก',cancelButtonText:'ไม่'});
    if (!result.isConfirmed) return;
    try { Swal.showLoading(); const res=await callApi('cancelCart',{cartId}); Swal.close(); await Swal.fire(res.ok?'สำเร็จ':'แจ้งเตือน',res.message,res.ok?'success':'warning'); openCart(); loadCartCount(); }
    catch(err) { Swal.close(); Swal.fire('ผิดพลาด',err.message,'error'); }
  }

  function showRegisterBox() {
    $('studentModal').style.display = 'flex';
    $('loginSection').style.display = 'none';
    $('logoutBox').style.display = 'none';
    $('registerBox').style.display = 'block';
    clearStudentPhoto();
    setTimeout(() => $('stuFullname')?.focus(), 0);
  }

  function openActivityDetail(activityId) {
    const a=activities.find(x=>x.activityId===activityId);
    if(!a) return Swal.fire('แจ้งเตือน','ไม่พบข้อมูลกิจกรรม','warning');
    const images=[a.image1,a.image2,a.image3].filter(Boolean);
    const slider=images.length?`<div class="detail-slider">${images.map((img,i)=>`<div class="detail-slide ${i===0?'active':''}"><img src="${escapeHtml(img)}" alt=""></div>`).join('')}</div><div class="detail-dots">${images.map((_,i)=>`<span class="detail-dot ${i===0?'active':''}"></span>`).join('')}</div>`:'';
    
    
$('detailContent').innerHTML = `
  ${slider}

  <div class="detail-info">

    <h2>${escapeHtml(a.title || '-')}</h2>

    <div class="line">
      <b>Point :</b>
      ${escapeHtml(a.hours || '0')}
    </div>

    <div class="line">
      <b>กิจกรรมสำหรับ :</b>
      ${escapeHtml(a.learningType || '-')}
    </div>

    <div class="line">
      <b>รายละเอียดกิจกรรม :</b>
      ${escapeHtml(a.detail || '-')}
    </div>

    <div class="line">
      <b>คุณสมบัติ :</b>
      ${escapeHtml(a.qualification || '-')}
    </div>

    <div class="line">
      <b>วันที่จัดกิจกรรม :</b>
      ${formatThaiDate(a.activityDate)}
    </div>

  </div>
`;
    $('detailAddCartBtn').onclick=()=>addToCart(activityId); $('detailModal').style.display='flex'; startDetailSlider();
  }
function updateTop() {
  const accountBtn = $('accountBtn');
  const scoreBadge = $('studentScoreBadge');

  if (accountBtn) {
    accountBtn.textContent = student
      ? `👤 ${student.fullname}`
      : 'Login';
  }

  if (!student && scoreBadge) {
    scoreBadge.hidden = true;
    scoreBadge.textContent = 'คะแนนรวม 0/0';
  }
document.addEventListener('change', event => {
  if (event.target?.id !== 'editPhoto') return;

  const file = event.target.files?.[0];
  const wrap = $('editPhotoPreviewWrap');
  const preview = $('editPhotoPreview');

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    event.target.value = '';

    Swal.fire(
      'แจ้งเตือน',
      'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
      'warning'
    );

    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    event.target.value = '';

    Swal.fire(
      'แจ้งเตือน',
      'รูปภาพต้องมีขนาดไม่เกิน 5 MB',
      'warning'
    );

    return;
  }

  editProfileRemovePhoto = false;

  const objectUrl = URL.createObjectURL(file);

  preview.src = objectUrl;

  preview.onload = () => {
    URL.revokeObjectURL(objectUrl);
  };

  wrap.hidden = false;
});
  window.dispatchEvent(
    new CustomEvent('LEARN_AUTH_CHANGED', {
      detail: {
        student: student || null
      }
    })
  );

  loadMyTotalHours();
  loadCartCount();
}
  function startDetailSlider() {
    clearInterval(detailSlideTimer); detailSlideIndex=0;
    const slides=document.querySelectorAll('#detailModal .detail-slide'),dots=document.querySelectorAll('#detailModal .detail-dot');
    if(slides.length<=1)return;
    detailSlideTimer=setInterval(()=>{slides[detailSlideIndex].classList.remove('active');dots[detailSlideIndex]?.classList.remove('active');detailSlideIndex=(detailSlideIndex+1)%slides.length;slides[detailSlideIndex].classList.add('active');dots[detailSlideIndex]?.classList.add('active');},2500);
  }

  function getFilteredActivitiesByTarget() {
    if (currentActivityTarget === 'all') return activities;

    return activities.filter(a => {
      const type = String(a?.learningType || '').trim();
      if (currentActivityTarget === 'public') return type.includes('ประชาชน');
      return type.includes('นักศึกษา');
    });
  }

  function filterActivitiesByTarget(target, btn) {
    currentActivityTarget = ['all', 'student', 'public'].includes(target) ? target : 'all';

    document.querySelectorAll('.shopactivity-target-btn').forEach(button => {
      const isActive = button.dataset.targetFilter === currentActivityTarget;
      button.classList.toggle('target-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    renderActivities(getFilteredActivitiesByTarget());
  }
  function getActivityHours(a) { return Number(a?.hours||a?.['ชั่วโมง']||a?.hour||0); }
  function formatThaiDate(value) { if(!value)return'-';const d=new Date(value);if(isNaN(d))return escapeHtml(value);return d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}); }

async function loadMyTotalHours() {
  const scoreBtn = $('scoreBtn');

  if (!scoreBtn) return;

  if (!student) {
    scoreBtn.textContent = `รวม 0 ${hourText}`;
    return;
  }

  try {
    const total = await callApi(
      'getStudentTotalHours',
      {
        studentId: student.studentId
      },
      'GET'
    );

    scoreBtn.textContent =
      `รวม ${total || 0} ${hourText}`;

  } catch (error) {
    scoreBtn.textContent = `รวม 0 ${hourText}`;
  }
}
  async function openScoreModal() {
    if(!requireStudent())return;
    try{Swal.showLoading();const res=await callApi('getMyScoreDetail',{studentId:student.studentId},'GET');Swal.close();const list=res.list||[],total=res.total||0;if(!list.length)return Swal.fire(`${hourText}สะสม`,`ยังไม่มีรายการ${hourText}ที่ได้รับ`,'info');const html=`<div style="text-align:left"><h3>รวมทั้งหมด ${total} ${escapeHtml(hourText)}</h3><table style="width:100%;border-collapse:collapse"><tbody>${list.map(x=>`<tr><td style="padding:8px;border:1px solid #ddd">${escapeHtml(x.title)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(x.baseNo)}</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(x.actualHours)}</td></tr>`).join('')}</tbody></table></div>`;Swal.fire({title:`รายการ${hourText}ที่ได้รับ`,html,width:800,confirmButtonText:'ปิด'});}catch(err){Swal.close();Swal.fire('ผิดพลาด',err.message,'error');}
  }

  function logoutFromEditProfile() {
    Swal.fire({
      title:'ออกจากระบบ?',
      text:'คุณต้องการออกจากระบบใช่หรือไม่',
      icon:'warning',
      showCancelButton:true,
      confirmButtonText:'ออกจากระบบ',
      cancelButtonText:'ยกเลิก',
      confirmButtonColor:'#ef4444',
      reverseButtons:true
    }).then(r=>{
      if(!r.isConfirmed)return;
      student=null;
      localStorage.removeItem('LEARN_STUDENT');
      closeEditProfile();
      closeModal('studentModal');
      updateTop();
      const root=$('learningBaseModule');
      if(root)showPage('activitiesPage',root.querySelector('.learning-tabs button'));
    });
  }

  function closeStudentModal() {
    Swal.fire({title:'ออกจากระบบ?',icon:'warning',showCancelButton:true,confirmButtonText:'ออกจากระบบ',cancelButtonText:'ยกเลิก'}).then(r=>{if(!r.isConfirmed)return;student=null;localStorage.removeItem('LEARN_STUDENT');closeModal('studentModal');updateTop();showPage('activitiesPage',$('learningBaseModule').querySelector('.learning-tabs button'));});
  }


  document.addEventListener('change', event => {
    if (event.target?.id !== 'stuPhoto') return;
    const file = event.target.files?.[0];
    const wrap = $('stuPhotoPreviewWrap');
    const preview = $('stuPhotoPreview');

    if (!file) {
      clearStudentPhoto();
      return;
    }
    if (!file.type.startsWith('image/')) {
      clearStudentPhoto();
      Swal.fire('แจ้งเตือน','กรุณาเลือกไฟล์รูปภาพเท่านั้น','warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      clearStudentPhoto();
      Swal.fire('แจ้งเตือน','รูปภาพต้องมีขนาดไม่เกิน 5 MB','warning');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.onload = () => URL.revokeObjectURL(objectUrl);
    wrap.hidden = false;
  });

  function updateHourText() {
    const label = $('profileHoursLabel');
    if (label) label.textContent = `${hourText}`;
  }

  async function loadSetting() {
    try {
      let json;
      if (window.SiteFast) {
        json = { success: true, data: await window.SiteFast.homePart('setting') };
      } else {
        const url = new URL(API_URL);
        url.searchParams.set('mode', 'setting');
        const response = await fetch(url.toString(), { cache: 'default' });
        json = await response.json();
      }
      if (json?.success !== false) {
        const setting = json?.data || json || {};
        hourText = String(setting?.hourText || 'ชั่วโมง').trim() || 'ชั่วโมง';

        const headerImageUrl = String(
          setting?.headerImage ||
          setting?.headerImageUrl ||
          setting?.shopActivityHeaderImage ||
          setting?.shopHeaderImage ||
          setting?.settingB3 ||
          setting?.b3 ||
          ''
        ).trim();
        const headerImage = $('shopActivityHeaderImage');

        if (headerImage && headerImageUrl) {
          headerImage.onload = () => { headerImage.hidden = false; };
          headerImage.onerror = () => {
            headerImage.hidden = true;
            headerImage.removeAttribute('src');
          };
          headerImage.src = headerImageUrl;
        } else if (headerImage) {
          headerImage.hidden = true;
          headerImage.removeAttribute('src');
        }
      }
    } catch (error) {
      console.error('loadSetting error:', error);
    }
    updateHourText();
  }

 window.LearningBase = {
  showPage,
  openStudentModal,
  closeModal,
  registerStudent,
  studentLogin,
  loadActivities,
  addToCart,
  openCart,
  confirmJoin,
  loadHistory,
  cancelCartItem,
  showRegisterBox,
  openActivityDetail,
  filterActivitiesByTarget,
  openScoreModal,
  closeStudentModal,
  clearStudentPhoto,
  getHourText: () => hourText,

  // ระบบแก้ไขโปรไฟล์ใหม่
  openEditProfile,
  closeEditProfile,
  removeEditProfilePhoto,
  saveEditProfile,
  logoutFromEditProfile
};
document.addEventListener('DOMContentLoaded', async () => {
  const teacherLink = $('teacherPageLink');

  if (teacherLink) {
    teacherLink.href = TEACHER_URL;
  }

  await loadSetting();

  try {
    updateTop();
  } catch (error) {
    console.error('updateTop error:', error);
  }

  loadActivities();
});
})();
