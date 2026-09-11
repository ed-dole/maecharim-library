(() => {
  'use strict';
  const API_URL=window.APP_CONFIG.API_URL;
  const CSS_FILES=['edit-website.css?v=20260827-2','news-manager.css?v=20260902-newsurl-optional-2','newsletter-manager.css?v=20260826-1','newsletter-overlay.css?v=20260826-3','facebook-manager.css?v=20260826-1','admin-subpage.css?v=20260901-index-team-1','team-manager.css?v=20260901-index-team-1','book-manager.css?v=20260904-1'];
  const JS_FILES=['edit-website.js?v=20260827-2','news-manager.js?v=20260902-newsurl-optional-2','newsletter-manager.js?v=20260826-4','facebook-manager.js?v=20260826-2','team-manager.js?v=20260901-index-team-1','book-manager.js?v=20260904-1'];
  let toolsPromise=null;
  let storagePromise=null;
  const STORAGE_CACHE_KEY='mysiteAdminStorageV1';
  const STORAGE_CACHE_MS=5*60*1000;
  const $=id=>document.getElementById(id);
  async function api(payload){const response=await fetch(API_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const result=await response.json();if(!result.success)throw new Error(result.message||'ดำเนินการไม่สำเร็จ');return result}
  function formatStorageGb(bytes){
    const gb=Math.max(0,Number(bytes)||0)/(1024*1024*1024);
    if(gb===0)return '0 GB';
    if(gb<0.01)return '<0.01 GB';
    if(gb<10)return gb.toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+' GB';
    return gb.toFixed(1).replace(/\.0$/,'')+' GB';
  }
  function renderAdminStorage(data,state){
    const meter=$('adminStorageMeter'),used=$('adminStorageUsed'),limit=$('adminStorageLimit'),fill=$('adminStorageFill'),track=$('adminStorageTrack');
    if(!meter||!used||!limit||!fill||!track)return;
    meter.classList.toggle('is-loading',state==='loading');
    meter.classList.toggle('is-error',state==='error');
    if(state==='loading'){used.textContent='กำลังตรวจสอบพื้นที่...';return}
    if(state==='error'){used.textContent='ตรวจสอบพื้นที่ไม่สำเร็จ';fill.style.width='0%';track.setAttribute('aria-valuenow','0');return}
    const bytes=Math.max(0,Number(data&&data.usedBytes)||0);
    const maxBytes=Math.max(1,Number(data&&data.limitBytes)||100*1024*1024*1024);
    const percent=Math.min(100,Math.max(0,(bytes/maxBytes)*100));
    used.textContent='ใช้พื้นที่แล้ว '+formatStorageGb(bytes);
    limit.textContent=(data&&data.limitLabel)||'100 GB';
    fill.style.width=percent.toFixed(2)+'%';
    track.setAttribute('aria-valuenow',String(Math.round(percent)));
    track.setAttribute('aria-valuetext',used.textContent+' จาก '+limit.textContent);
    meter.title='ไฟล์ '+Number(data&&data.fileCount||0).toLocaleString('th-TH')+' ไฟล์ • '+Number(data&&data.folderCount||0).toLocaleString('th-TH')+' โฟลเดอร์';
  }
  function readStorageCache(){
    try{const cached=JSON.parse(sessionStorage.getItem(STORAGE_CACHE_KEY)||'null');return cached&&cached.savedAt&&Date.now()-cached.savedAt<STORAGE_CACHE_MS?cached.data:null}catch(_){return null}
  }
  function writeStorageCache(data){try{sessionStorage.setItem(STORAGE_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(_){}}
  function loadAdminStorage(force=false){
    const token=sessionStorage.getItem('mysiteAdminToken');
    if(!token)return Promise.resolve();
    const cached=!force&&readStorageCache();
    if(cached)renderAdminStorage(cached,'ready');else renderAdminStorage(null,'loading');
    if(storagePromise)return storagePromise;
    storagePromise=api({mode:'adminstorage',token,fresh:force?'1':'0'})
      .then(result=>{const data=result.data||{};writeStorageCache(data);renderAdminStorage(data,'ready');return data})
      .catch(error=>{if(!cached)renderAdminStorage(null,'error');console.warn('admin storage:',error);return null})
      .finally(()=>{storagePromise=null});
    return storagePromise;
  }
  function loadStyle(href){return new Promise((resolve,reject)=>{if(document.querySelector(`link[data-admin-tool="${href}"]`))return resolve();const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.adminTool=href;link.onload=resolve;link.onerror=()=>reject(new Error('โหลด '+href+' ไม่สำเร็จ'));document.head.appendChild(link)})}
  function loadScript(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[data-admin-tool="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.dataset.adminTool=src;script.onload=resolve;script.onerror=()=>reject(new Error('โหลด '+src+' ไม่สำเร็จ'));document.body.appendChild(script)})}
  function loadAdminTools(){if(toolsPromise)return toolsPromise;toolsPromise=(async()=>{await Promise.all(CSS_FILES.map(loadStyle));for(const src of JS_FILES)await loadScript(src)})();return toolsPromise}
  function setAdminUi(enabled){document.body.classList.toggle('admin-edit-mode',enabled);$('adminLoginButton').hidden=enabled;$('adminLogoutButton').hidden=!enabled}
  async function activateAdmin(){await loadAdminTools();setAdminUi(true);$('adminLoginModal').hidden=true;loadAdminStorage(false)}
  function openLogin(){ $('adminLoginStatus').textContent='';$('adminLoginModal').hidden=false;setTimeout(()=>$('adminUsername').focus(),30) }
  function closeLogin(){ $('adminLoginModal').hidden=true }
  $('adminLoginButton').addEventListener('click',openLogin);$('adminLoginClose').addEventListener('click',closeLogin);$('adminLoginModal').addEventListener('click',e=>{if(e.target===$('adminLoginModal'))closeLogin()});
  $('adminLoginForm').addEventListener('submit',async event=>{event.preventDefault();const status=$('adminLoginStatus'),submit=$('adminLoginSubmit');status.textContent='';submit.disabled=true;submit.textContent='กำลังตรวจสอบ...';try{const result=await api({mode:'adminlogin',username:$('adminUsername').value.trim(),password:$('adminPassword').value});sessionStorage.setItem('mysiteAdminToken',result.token);sessionStorage.setItem('mysiteAdminName',result.username||'Admin');submit.textContent='กำลังโหลดเครื่องมือ...';await activateAdmin()}catch(error){sessionStorage.removeItem('mysiteAdminToken');status.textContent=error.message}finally{submit.disabled=false;submit.textContent='เข้าสู่ระบบ'}});
  $('adminForgotButton').addEventListener('click',async()=>{const modal=await Swal.fire({title:'ลืมรหัสผ่าน',input:'email',inputLabel:'กรอก Email ที่ลงทะเบียนไว้',showCancelButton:true,confirmButtonText:'ส่งข้อมูลเข้าสู่ Email',cancelButtonText:'ยกเลิก',confirmButtonColor:'#dc2626',inputValidator:value=>!value?'กรุณากรอก Email':undefined});if(!modal.isConfirmed)return;Swal.fire({title:'กำลังส่ง Email...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});try{await api({mode:'adminforgot',email:modal.value.trim()});Swal.fire({icon:'success',title:'ส่ง Email แล้ว',text:'กรุณาตรวจสอบกล่องจดหมายและจดหมายขยะ'})}catch(error){Swal.fire({icon:'error',title:'ส่งไม่สำเร็จ',text:error.message})}});
  $('adminTogglePassword').addEventListener('click',event=>{const input=$('adminPassword');input.type=input.type==='password'?'text':'password';event.currentTarget.querySelector('i').className=input.type==='password'?'fa-solid fa-eye':'fa-solid fa-eye-slash'});
  $('adminLogoutButton').addEventListener('click',()=>{sessionStorage.removeItem('mysiteAdminToken');sessionStorage.removeItem('mysiteAdminName');setAdminUi(false);if(window.Swal)Swal.close()});
  const existingToken=sessionStorage.getItem('mysiteAdminToken');
  if(existingToken){
    api({mode:'editwebsite',editor:'text',token:existingToken})
      .then(()=>loadAdminTools())
      .then(()=>{setAdminUi(true);loadAdminStorage(false)})
      .catch(()=>{sessionStorage.removeItem('mysiteAdminToken');sessionStorage.removeItem('mysiteAdminName');setAdminUi(false)});
  }else setAdminUi(false);
})();
