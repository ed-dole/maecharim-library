(() => {
  'use strict';
  const API = window.APP_CONFIG.API_URL;
  const state = { items: [], query: '', page: 1 };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);

  async function api(action, data = {}) {
    const token = sessionStorage.getItem('mysiteAdminToken') || '';
    const response = await fetch(API, { method:'POST', cache:'no-store', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify({ mode:'teamadmin', action, data, token }) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'ดำเนินการไม่สำเร็จ');
    return result.data;
  }

  async function load() { state.items = await api('list'); }
  function filtered() { const q=state.query.trim().toLowerCase(); return q ? state.items.filter(x => `${x.order} ${x.name} ${x.position}`.toLowerCase().includes(q)) : state.items; }
  function html() {
    const all=filtered(), pages=Math.max(1,Math.ceil(all.length/5)); state.page=Math.min(state.page,pages);
    const rows=all.slice((state.page-1)*5,state.page*5).map(x=>`<tr><td>${esc(x.order)}</td><td>${esc(x.name)}</td><td>${esc(x.position)}</td><td><img class="team-manager-thumb" src="${esc(x.image)}" alt="${esc(x.name)}" data-team-image="${esc(x.image)}"></td><td><div class="team-manager-actions"><button class="team-manager-btn team-manager-edit" data-team-edit="${x.rowNumber}">แก้ไข</button><button class="team-manager-btn team-manager-delete" data-team-delete="${x.rowNumber}">ลบ</button></div></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center">ไม่พบรายการ</td></tr>';
    const nav=Array.from({length:pages},(_,i)=>`<button type="button" data-team-page="${i+1}" class="${state.page===i+1?'active':''}">${i+1}</button>`).join('');
    return `<div class="team-manager-popup"><div class="team-manager-toolbar"><b class="team-manager-total">จำนวนรายการทั้งหมด ${all.length} รายการ</b><input id="teamManagerSearch" class="team-manager-search" value="${esc(state.query)}" placeholder="ค้นหาชื่อหรือตำแหน่ง" autocomplete="off"><button id="teamManagerAdd" class="team-manager-btn team-manager-add" type="button">+เพิ่มรายการ</button></div><div class="team-manager-table-wrap"><table class="team-manager-table"><thead><tr><th>ลำดับ</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>รูปภาพบุคลากร</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table></div><div class="team-manager-pages">${nav}</div></div>`;
  }
  function rerender() { const container=document.querySelector('.swal2-html-container'); if(!container)return; container.innerHTML=html(); bind(); }
  function bind() {
    const search=document.getElementById('teamManagerSearch');
    search?.addEventListener('input',event=>{ const position=event.target.selectionStart; state.query=event.target.value; state.page=1; rerender(); const next=document.getElementById('teamManagerSearch'); next?.focus(); next?.setSelectionRange(position,position); });
    document.getElementById('teamManagerAdd')?.addEventListener('click',()=>openEditor());
    document.querySelectorAll('[data-team-page]').forEach(button=>button.onclick=()=>{ state.page=Number(button.dataset.teamPage); rerender(); });
    document.querySelectorAll('[data-team-edit]').forEach(button=>button.onclick=()=>openEditor(state.items.find(item=>item.rowNumber===Number(button.dataset.teamEdit))));
    document.querySelectorAll('[data-team-delete]').forEach(button=>button.onclick=()=>remove(Number(button.dataset.teamDelete)));
    document.querySelectorAll('[data-team-image]').forEach(image=>image.onclick=()=>showImage(image.dataset.teamImage,image.alt));
  }
  function overlay(title, content, extra='') { const popup=Swal.getPopup(); if(!popup)return null; popup.querySelector('.team-manager-action-overlay')?.remove(); const layer=document.createElement('div'); layer.className=`team-manager-overlay team-manager-action-overlay ${extra}`; layer.innerHTML=`<div class="team-manager-dialog"><h3>${esc(title)}</h3>${content}</div>`; popup.appendChild(layer); return layer; }
  function showImage(src,alt) { if(!src)return; const popup=Swal.getPopup(); if(!popup)return; const layer=document.createElement('div'); layer.className='team-manager-overlay team-manager-image-overlay'; layer.innerHTML=`<div class="team-manager-image-dialog"><button class="team-manager-image-close" type="button" aria-label="ปิด">&times;</button><img class="team-manager-large-image" src="${esc(src)}" alt="${esc(alt||'รูปภาพบุคลากร')}"></div>`; const close=()=>layer.remove(); layer.onclick=e=>{if(e.target===layer)close()}; layer.querySelector('.team-manager-image-close').onclick=close; popup.appendChild(layer); }
  function validUrl(value) { try { const url=new URL(value); return url.protocol==='https:'||url.protocol==='http:'; } catch (_) { return false; } }
  function compress(file) { return new Promise((resolve,reject)=>{ if(!file)return reject(new Error('กรุณาเลือกไฟล์รูปภาพ')); if(!file.type.startsWith('image/'))return reject(new Error('ไฟล์ต้องเป็นรูปภาพ')); const reader=new FileReader(); reader.onerror=()=>reject(new Error('อ่านไฟล์ไม่สำเร็จ')); reader.onload=()=>{ const image=new Image(); image.onerror=()=>reject(new Error('เปิดรูปภาพไม่สำเร็จ')); image.onload=()=>{ const max=900, ratio=Math.min(1,max/Math.max(image.width,image.height)), canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.width*ratio)); canvas.height=Math.max(1,Math.round(image.height*ratio)); canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height); resolve({ dataUrl:canvas.toDataURL('image/jpeg',.72), fileName:(file.name.replace(/\.[^.]+$/,'')||'personnel')+'.jpg' }); }; image.src=reader.result; }; reader.readAsDataURL(file); }); }
  function openEditor(item) {
    const editing=Boolean(item); let upload=null;
    const layer=overlay(editing?'แก้ไขข้อมูลบุคลากร':'เพิ่มข้อมูลบุคลากร',`<div class="team-manager-form"><label>ชื่อ-นามสกุล *<input id="teamName" value="${esc(item?.name||'')}"></label><label>ตำแหน่ง *<input id="teamPosition" value="${esc(item?.position||'')}"></label><label>URL รูปภาพ<input id="teamImageUrl" type="url" value="${esc(item?.image||'')}" placeholder="https://..."></label><label>หรืออัปโหลดรูปภาพ<input id="teamImageFile" type="file" accept="image/*"></label><span class="team-manager-hint">ระบบจะย่อรูปก่อนอัปโหลดลง Google Drive</span><img id="teamImagePreview" class="team-manager-preview" ${item?.image?`src="${esc(item.image)}"`:'hidden'}><div id="teamManagerError" class="team-manager-error"></div><div class="team-manager-form-actions"><button class="team-manager-btn team-manager-cancel" type="button">ยกเลิก</button><button class="team-manager-btn team-manager-save" type="button">${editing?'บันทึกการแก้ไข':'เพิ่มรายการ'}</button></div></div>`);
    if(!layer)return;
    layer.querySelector('.team-manager-cancel').onclick=()=>layer.remove();
    layer.querySelector('#teamImageFile').onchange=async event=>{ const error=layer.querySelector('#teamManagerError'); try { error.textContent='กำลังย่อรูป...'; upload=await compress(event.target.files[0]); const preview=layer.querySelector('#teamImagePreview'); preview.src=upload.dataUrl; preview.hidden=false; error.textContent=''; } catch(e) { upload=null; error.textContent=e.message; } };
    layer.querySelector('.team-manager-save').onclick=async()=>{ const name=layer.querySelector('#teamName').value.trim(),position=layer.querySelector('#teamPosition').value.trim(),imageUrl=layer.querySelector('#teamImageUrl').value.trim(),error=layer.querySelector('#teamManagerError'),button=layer.querySelector('.team-manager-save'); error.textContent=''; if(!name)return error.textContent='กรุณากรอกชื่อ-นามสกุล'; if(!position)return error.textContent='กรุณากรอกตำแหน่ง'; if(!upload&&!imageUrl)return error.textContent='กรุณาอัปโหลดรูปหรือใส่ URL รูปภาพ'; if(imageUrl&&!validUrl(imageUrl))return error.textContent='URL รูปภาพไม่ถูกต้อง'; button.disabled=true; button.textContent='กำลังบันทึก...'; try { await api('save',{ rowNumber:item?.rowNumber||0,name,position,imageUrl,imageData:upload?.dataUrl||'',imageName:upload?.fileName||'' }); await load(); document.dispatchEvent(new Event('team-admin-updated')); layer.remove(); rerender(); } catch(e) { error.textContent='บันทึกไม่สำเร็จ: '+e.message; button.disabled=false; button.textContent=editing?'บันทึกการแก้ไข':'เพิ่มรายการ'; } };
  }
  function remove(rowNumber) { const layer=overlay('ยืนยันการลบ?',`<p style="text-align:center">รายการบุคลากรจะถูกลบออกจากชีต</p><div id="teamDeleteError" class="team-manager-error"></div><div class="team-manager-form-actions"><button class="team-manager-btn team-manager-cancel" type="button">ยกเลิก</button><button class="team-manager-btn team-manager-confirm-delete" type="button">ลบ</button></div>`); if(!layer)return; layer.querySelector('.team-manager-cancel').onclick=()=>layer.remove(); layer.querySelector('.team-manager-confirm-delete').onclick=async()=>{ const button=layer.querySelector('.team-manager-confirm-delete'),error=layer.querySelector('#teamDeleteError'); button.disabled=true; button.textContent='กำลังลบ...'; try { await api('delete',{rowNumber}); await load(); document.dispatchEvent(new Event('team-admin-updated')); layer.remove(); rerender(); } catch(e) { error.textContent='ลบไม่สำเร็จ: '+e.message; button.disabled=false; button.textContent='ลบ'; } }; }
  async function openManager() { Swal.fire({ title:'กำลังโหลดข้อมูลบุคลากร...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() }); try { await load(); await Swal.fire({ title:'จัดการข้อมูลบุคลากร', html:html(), width:'min(1180px, 96vw)', showConfirmButton:false, showCloseButton:true, didOpen:bind }); } catch(e) { Swal.fire({icon:'error',title:'โหลดข้อมูลไม่สำเร็จ',text:e.message}); } }
  document.addEventListener('admin:manage-data',event=>{ if(event.detail?.page==='team')openManager(); });
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.admin-manage-data-button[data-admin-page="team"]');
    if(!button)return;
    event.preventDefault();
    openManager();
  });
})();
