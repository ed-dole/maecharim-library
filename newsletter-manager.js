(() => {
  'use strict';
  const API=window.APP_CONFIG.API_URL;
  const state={items:[],query:'',page:1,perPage:5};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const validUrl=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)}catch(_){return false}};
  async function api(action,data={}){
    const token=sessionStorage.getItem('mysiteAdminToken')||'';
    const res=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({mode:'activityadmin',action,data,token})});
    const out=await res.json(); if(!out.success) throw new Error(out.message||'ดำเนินการไม่สำเร็จ'); return out.data;
  }
  async function load(){const data=await api('list');state.items=data.items||[];}
  function filtered(){return state.items.filter(x=>String(x.title||'').toLowerCase().includes(state.query.toLowerCase()))}
  function managerHtml(){
    const all=filtered(),pages=Math.max(1,Math.ceil(all.length/state.perPage));state.page=Math.min(state.page,pages);
    const rows=all.slice((state.page-1)*5,state.page*5).map(x=>`<tr><td>${esc(x.title)}</td><td><img class="newsletter-thumb" data-image="${esc(x.image)}" src="${esc(x.image)}" alt="${esc(x.title)}"></td><td>${x.url?`<a class="newsletter-link" href="${esc(x.url)}" target="_blank" rel="noopener">คลิกเพื่อดูรายละเอียด</a>`:'<span class="newsletter-empty-url">ไม่ได้ระบุ url รายละเอียด</span>'}</td><td>${esc(x.date)}</td><td><div class="newsletter-actions"><button class="newsletter-btn newsletter-edit" data-edit="${x.rowNumber}">แก้ไข</button><button class="newsletter-btn newsletter-delete" data-delete="${x.rowNumber}">ลบ</button></div></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center">ไม่พบรายการ</td></tr>';
    const nav=Array.from({length:pages},(_,i)=>`<button data-page="${i+1}" class="${state.page===i+1?'active':''}">${i+1}</button>`).join('');
    return `<div class="newsletter-popup"><div class="newsletter-toolbar"><b class="newsletter-total">จำนวนรายการทั้งหมด ${all.length} รายการ</b><input id="newsletterSearch" class="newsletter-search" value="${esc(state.query)}" placeholder="ค้นหาเรื่อง"><button id="newsletterAdd" class="newsletter-btn newsletter-add">+เพิ่มรายการ</button></div><div class="newsletter-table-wrap"><table class="newsletter-table"><thead><tr><th>เรื่อง</th><th>ภาพปก</th><th>url รายละเอียด</th><th>วันที่</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table></div><div class="newsletter-pages">${nav}</div></div>`;
  }
  function bindManager(){
    const q=document.getElementById('newsletterSearch');q?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.query=e.target.value;state.page=1;rerender();const next=document.getElementById('newsletterSearch');next?.focus();next?.setSelectionRange(pos,pos)});
    document.getElementById('newsletterAdd')?.addEventListener('click',()=>openEditor());
    document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=+b.dataset.page;rerender()});
    document.querySelectorAll('[data-image]').forEach(img=>img.onclick=()=>showImageOverlay(img.dataset.image,img.alt));
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(state.items.find(x=>x.rowNumber===+b.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>remove(+b.dataset.delete));
  }
  function showImageOverlay(src,alt){
    const popup=Swal.getPopup();if(!popup)return;
    popup.querySelector('.newsletter-image-overlay')?.remove();
    const layer=document.createElement('div');layer.className='newsletter-image-overlay';
    layer.innerHTML=`<div class="newsletter-image-dialog" role="dialog" aria-modal="true"><button class="newsletter-image-close" type="button" aria-label="ปิด">&times;</button><img class="newsletter-image-large" src="${esc(src)}" alt="${esc(alt||'ภาพปก')}"></div>`;
    const close=()=>layer.remove();layer.addEventListener('click',e=>{if(e.target===layer)close()});layer.querySelector('.newsletter-image-close').onclick=close;popup.appendChild(layer);
  }
  function rerender(){const box=document.querySelector('.swal2-html-container');if(box){box.innerHTML=managerHtml();bindManager()}}
  async function openManager(){
    Swal.fire({title:'กำลังโหลด...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
    try{await load();state.query='';state.page=1;await Swal.fire({title:'เพิ่ม/ลบ จดหมายข่าว',html:managerHtml(),width:'min(1250px,97vw)',showConfirmButton:false,showCloseButton:true,didOpen:bindManager})}catch(e){Swal.fire('เกิดข้อผิดพลาด',e.message,'error')}
  }
  async function compress(file){
    if(!file.type.startsWith('image/'))throw new Error('กรุณาเลือกไฟล์รูปภาพ');
    const data=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)});
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=data});
    let scale=Math.min(1,1280/Math.max(img.width,img.height)),quality=.74,result='';
    for(let n=0;n<5;n++){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);result=c.toDataURL('image/jpeg',quality);if(result.length<900000)break;scale*=.78;quality=Math.max(.52,quality-.06)}
    return {dataUrl:result,fileName:(file.name.replace(/\.[^.]+$/,'')||'newsletter')+'.jpg'};
  }
  function createActionOverlay(title,html){
    const popup=Swal.getPopup();if(!popup)return null;popup.querySelector('.newsletter-action-overlay')?.remove();
    const layer=document.createElement('div');layer.className='newsletter-action-overlay';layer.innerHTML=`<div class="newsletter-action-dialog"><h3>${esc(title)}</h3>${html}</div>`;popup.appendChild(layer);return layer;
  }
  function openEditor(item){
    const editing=!!item;let upload=null;
    const form=`<div class="newsletter-form"><label>เรื่อง *<input id="nlTitle" value="${esc(item?.title||'')}"></label><label>URL รูปภาพ<input id="nlImageUrl" type="url" value="${esc(item?.image||'')}" placeholder="https://..."></label><label>หรืออัปโหลดรูปภาพ<input id="nlFile" type="file" accept="image/*"></label><span class="newsletter-hint">ระบบจะย่อรูปก่อนส่งและบันทึกลง Google Drive</span><img id="nlPreview" class="newsletter-preview" ${item?.image?`src="${esc(item.image)}"`:'hidden'}><label>url รายละเอียด (เว้นว่างได้)<input id="nlDetail" type="url" value="${esc(item?.url||'')}" placeholder="https://..."></label><div id="nlError" class="newsletter-action-error"></div><div class="newsletter-action-buttons"><button class="newsletter-btn newsletter-cancel" type="button">ยกเลิก</button><button class="newsletter-btn newsletter-add newsletter-save" type="button">${editing?'บันทึกการแก้ไข':'เพิ่มรายการ'}</button></div></div>`;
    const layer=createActionOverlay(editing?'แก้ไขจดหมายข่าว':'เพิ่มจดหมายข่าว',form);if(!layer)return;
    layer.querySelector('.newsletter-cancel').onclick=()=>layer.remove();
    layer.querySelector('#nlFile').onchange=async e=>{const error=layer.querySelector('#nlError');try{error.textContent='กำลังย่อรูป...';upload=await compress(e.target.files[0]);const p=layer.querySelector('#nlPreview');p.src=upload.dataUrl;p.hidden=false;error.textContent=''}catch(err){upload=null;error.textContent=err.message}};
    layer.querySelector('.newsletter-save').onclick=async()=>{const error=layer.querySelector('#nlError'),button=layer.querySelector('.newsletter-save'),title=layer.querySelector('#nlTitle').value.trim(),imageUrl=layer.querySelector('#nlImageUrl').value.trim(),url=layer.querySelector('#nlDetail').value.trim();error.textContent='';if(!title)return error.textContent='กรุณากรอกเรื่อง';if(!upload&&!imageUrl)return error.textContent='กรุณาอัปโหลดรูปหรือใส่ URL รูปภาพ';if(imageUrl&&!validUrl(imageUrl))return error.textContent='URL รูปภาพไม่ถูกต้อง';if(url&&!validUrl(url))return error.textContent='url รายละเอียดไม่ถูกต้อง';button.disabled=true;button.textContent='กำลังบันทึก...';try{await api('save',{rowNumber:item?.rowNumber||0,title,imageUrl,url,imageData:upload?.dataUrl||'',imageName:upload?.fileName||''});await load();document.dispatchEvent(new Event('activity-admin-updated'));layer.remove();rerender()}catch(err){error.textContent='บันทึกไม่สำเร็จ: '+err.message;button.disabled=false;button.textContent=editing?'บันทึกการแก้ไข':'เพิ่มรายการ'}};
  }
  function remove(rowNumber){
    const layer=createActionOverlay('ยืนยันการลบ?',`<p>รายการจะถูกลบออกจากชีต</p><div id="nlDeleteError" class="newsletter-action-error"></div><div class="newsletter-action-buttons"><button class="newsletter-btn newsletter-cancel" type="button">ยกเลิก</button><button class="newsletter-btn newsletter-delete newsletter-confirm-delete" type="button">ลบ</button></div>`);if(!layer)return;
    layer.querySelector('.newsletter-cancel').onclick=()=>layer.remove();layer.querySelector('.newsletter-confirm-delete').onclick=async()=>{const button=layer.querySelector('.newsletter-confirm-delete'),error=layer.querySelector('#nlDeleteError');button.disabled=true;button.textContent='กำลังลบ...';try{await api('delete',{rowNumber});await load();document.dispatchEvent(new Event('activity-admin-updated'));layer.remove();rerender()}catch(err){error.textContent='ลบไม่สำเร็จ: '+err.message;button.disabled=false;button.textContent='ลบ'}};
  }
  function initializeNewsletterManager(){const button=document.getElementById('manageNewsletterButton');if(button&&!button.dataset.managerReady){button.dataset.managerReady='1';button.addEventListener('click',openManager)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeNewsletterManager,{once:true});else initializeNewsletterManager();
})();
