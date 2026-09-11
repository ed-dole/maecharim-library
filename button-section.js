(()=>{
'use strict';
const API=String(window.APP_CONFIG?.API_URL||'').trim();
const ICON_SOURCE_MAX=100*1024*1024; // ผู้ใช้กำหนดไม่เกิน 100 MB
const ICON_TARGET_MAX=800*1024;      // ย่อสำหรับใช้งานเว็บให้เบากว่า 100 MB มาก
const ICON_MAX_DIMENSION=512;
const ICON_STYLES=new Set(['icon-text','icon-only','icon-top','compact']);
const STYLE_OPTIONS=[
  ['text','ข้อความอย่างเดียว'],
  ['icon-text','ไอคอน + ชื่อปุ่ม (แนวนอน)'],
  ['icon-only','ไอคอนอย่างเดียว'],
  ['icon-top','ไอคอนด้านบน + ชื่อปุ่ม'],
  ['compact','ปุ่มแคปซูล ไอคอน + ชื่อ']
];
let state={style:'icon-text',items:[]};
let previewKey='';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validUrl=v=>/^https?:\/\//i.test(String(v||'').trim());
const validColor=v=>/^#[0-9a-f]{6}$/i.test(String(v||'').trim());
const uid=()=>`btn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
function needsIcon(style){return ICON_STYLES.has(String(style||''))}
function normalizeStyle(value){return STYLE_OPTIONS.some(x=>x[0]===value)?value:'icon-text'}
function normalizeItem(item,index){
  return {
    key:String(item?.key||uid()),
    name:String(item?.name||'').trim(),
    iconUrl:String(item?.iconUrl||'').trim(),
    url:String(item?.url||'').trim(),
    buttonColor:validColor(item?.buttonColor)?String(item.buttonColor):'#2563eb',
    textColor:validColor(item?.textColor)?String(item.textColor):'#ffffff',
    order:Number(item?.order)||index+1,
    visible:item?.visible!==false,
    pendingFile:item?.pendingFile||null,
    previewIconUrl:String(item?.previewIconUrl||item?.iconUrl||'').trim(),
    previewObjectUrl:String(item?.previewObjectUrl||'').trim()
  };
}
async function publicLoad(){
  const r=await fetch(`${API}?mode=buttonsection&_t=${Date.now()}`,{cache:'no-store'});
  const j=await r.json();
  if(!r.ok||j.success===false)throw new Error(j.message||'โหลดรายการปุ่มไม่สำเร็จ');
  return j.data||{style:'icon-text',items:[]};
}
async function adminApi(action,data={}){
  const token=sessionStorage.getItem('mysiteAdminToken')||'';
  const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({mode:'buttonsectionadmin',action,token,data})});
  const j=await r.json();
  if(!r.ok||!j.success)throw new Error(j.message||'ดำเนินการไม่สำเร็จ');
  return j.data||{};
}
function render(data){
  const grid=$('buttonSectionGrid');if(!grid)return;
  const style=normalizeStyle(data?.style);
  const items=(Array.isArray(data?.items)?data.items:[]).filter(x=>x&&x.visible!==false&&x.name&&x.url);
  if(!items.length){
    grid.innerHTML='<div class="button-section-empty">ยังไม่มีรายการปุ่ม</div>';
    return;
  }
  grid.innerHTML=items.map(item=>{
    const bg=validColor(item.buttonColor)?item.buttonColor:'#2563eb';
    const color=validColor(item.textColor)?item.textColor:'#ffffff';
    const icon=needsIcon(style)&&item.iconUrl?`<img class="button-section-icon" src="${esc(item.iconUrl)}" alt="" loading="lazy" decoding="async">`:'';
    return `<a class="button-section-item is-${esc(style)}" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" style="--button-bg:${esc(bg)};--button-color:${esc(color)}" aria-label="${esc(item.name)}">${icon}<span class="button-section-label">${esc(item.name)}</span></a>`;
  }).join('');
}
async function refresh(){
  try{render(await publicLoad())}catch(err){const grid=$('buttonSectionGrid');if(grid)grid.innerHTML=`<div class="button-section-empty">${esc(err.message)}</div>`}
}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('ย่อรูปไอคอนไม่สำเร็จ')),type,quality))}
function blobDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('อ่านไฟล์ไอคอนไม่สำเร็จ'));r.readAsDataURL(blob)})}
async function compressIcon(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
  if(file.size>ICON_SOURCE_MAX)throw new Error('ไฟล์รูปภาพต้นฉบับต้องมีขนาดไม่เกิน 100 MB');
  const objectUrl=URL.createObjectURL(file);
  try{
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('เปิดรูปไอคอนไม่สำเร็จ'));image.src=objectUrl});
    let width=Math.max(1,image.naturalWidth||image.width||1),height=Math.max(1,image.naturalHeight||image.height||1);
    const scale=Math.min(1,ICON_MAX_DIMENSION/Math.max(width,height));
    width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');
    let quality=.90,blob=null;
    for(let attempt=0;attempt<24;attempt++){
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('เบราว์เซอร์ไม่รองรับการย่อรูปภาพ');
      ctx.clearRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
      blob=await canvasBlob(canvas,'image/webp',quality);
      if(blob.size<=ICON_TARGET_MAX){
        const base=(String(file.name||'button-icon').replace(/\.[^.]+$/,'')||'button-icon').replace(/[\\/:*?"<>|]/g,'_');
        return {dataUrl:await blobDataUrl(blob),fileName:base+'.webp',size:blob.size};
      }
      if(quality>.5)quality=Math.max(.5,quality-.08);
      else{width=Math.max(64,Math.round(width*.82));height=Math.max(64,Math.round(height*.82));quality=.82}
    }
    throw new Error('ไม่สามารถย่อรูปไอคอนให้เหมาะกับเว็บไซต์ได้ กรุณาเลือกรูปอื่น');
  }finally{URL.revokeObjectURL(objectUrl)}
}
function styleSelectHtml(){return STYLE_OPTIONS.map(([v,l])=>`<option value="${v}" ${state.style===v?'selected':''}>${l}</option>`).join('')}
function rowHtml(item,index){
  const iconHidden=needsIcon(state.style)?'':' is-hidden';
  const preview=item.iconUrl?`<img class="button-manager-icon-preview" src="${esc(item.iconUrl)}" alt="">`:'';
  const previewClass=item.key===previewKey?' class="is-previewing"':'';
  return `<tr data-key="${esc(item.key)}"${previewClass}>
    <td><div class="button-manager-order"><button type="button" class="button-manager-small-btn" data-up="${esc(item.key)}" title="เลื่อนขึ้น">▲</button><button type="button" class="button-manager-small-btn" data-down="${esc(item.key)}" title="เลื่อนลง">▼</button></div></td>
    <td><input class="button-name" type="text" value="${esc(item.name)}" placeholder="ชื่อปุ่ม" maxlength="80"></td>
    <td class="button-manager-icon-cell button-manager-icon-column${iconHidden}"><div class="button-manager-icon-row">${preview}<input class="button-icon-url" type="url" value="${esc(item.iconUrl)}" placeholder="https://..."><label class="button-manager-upload-label"><i class="fa-solid fa-cloud-arrow-up"></i>อัปโหลด<input class="button-manager-file" type="file" accept="image/*"></label></div><small class="button-manager-icon-status">URL รูปไอคอน หรืออัปโหลดรูป (ต้นฉบับไม่เกิน 100 MB)</small></td>
    <td><input class="button-url" type="url" value="${esc(item.url)}" placeholder="https://..."></td>
    <td><input class="button-bg" type="color" value="${esc(item.buttonColor)}" title="สีปุ่ม"></td>
    <td><input class="button-text" type="color" value="${esc(item.textColor)}" title="สีข้อความ"></td>
    <td class="button-manager-visible"><input class="button-visible" type="checkbox" ${item.visible?'checked':''}></td>
    <td><button type="button" class="button-manager-small-btn button-manager-delete" data-delete="${esc(item.key)}" title="ลบ"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`;
}
function managerHtml(){
  return `<div class="button-manager-shell">
    <div class="button-manager-toolbar">
      <div class="button-manager-style-wrap"><label>รูปแบบปุ่มทั้ง SECTION</label><select id="buttonManagerStyle" class="button-manager-style">${styleSelectHtml()}</select></div>
      <div id="buttonManagerPreview" class="button-manager-preview" aria-live="polite"></div>
      <button id="buttonManagerAdd" type="button" class="button-manager-add"><i class="fa-solid fa-plus"></i> เพิ่มปุ่ม</button>
    </div>
    <div class="button-manager-note">รูปแบบที่เลือกจะใช้กับปุ่มทุกปุ่มใน SECTION เดียวกัน ตัวอย่างตรงกลางจะแสดงปุ่มที่กำลังแก้ไข และเปลี่ยนทันทีเมื่อแก้ชื่อ สี หรือไอคอน หากยังไม่มีรายการจะแสดงโมเดลของรูปแบบปุ่มที่เลือก</div>
    <div class="button-manager-table-wrap"><table class="button-manager-table"><thead><tr><th>ลำดับ</th><th>ชื่อปุ่ม</th><th class="button-manager-icon-column ${needsIcon(state.style)?'':'is-hidden'}">รูปภาพ/ไอคอน</th><th>URL</th><th>สีปุ่ม</th><th>สีข้อความ</th><th>แสดง</th><th>ลบ</th></tr></thead><tbody id="buttonManagerBody">${state.items.length?state.items.map(rowHtml).join(''):'<tr><td colspan="8" style="text-align:center;padding:28px">ยังไม่มีรายการปุ่ม กด + เพิ่มปุ่ม</td></tr>'}</tbody></table></div>
  </div>`;
}
function previewIconMarkup(src,isModel){
  if(!needsIcon(state.style))return '';
  if(src)return `<img class="button-section-icon" src="${esc(src)}" alt="">`;
  return `<span class="button-manager-preview-icon-model${isModel?' is-model':''}" aria-hidden="true"><i class="fa-regular fa-image"></i></span>`;
}
function getPreviewRow(popup){
  if(!popup)return null;
  let row=null;
  if(previewKey){
    row=[...popup.querySelectorAll('#buttonManagerBody tr[data-key]')].find(tr=>tr.dataset.key===previewKey)||null;
  }
  if(!row)row=popup.querySelector('#buttonManagerBody tr[data-key]');
  if(row)previewKey=row.dataset.key||'';
  return row;
}
function markPreviewRow(popup){
  if(!popup)return;
  popup.querySelectorAll('#buttonManagerBody tr[data-key]').forEach(tr=>tr.classList.toggle('is-previewing',!!previewKey&&tr.dataset.key===previewKey));
}
function activatePreview(key){
  previewKey=String(key||'');
  const popup=Swal.getPopup();
  markPreviewRow(popup);
  updateManagerPreview();
}
function updateManagerPreview(){
  const popup=Swal.getPopup();if(!popup)return;
  const holder=popup.querySelector('#buttonManagerPreview');if(!holder)return;
  const selectedStyle=normalizeStyle(popup.querySelector('#buttonManagerStyle')?.value||state.style);
  state.style=selectedStyle;
  const row=getPreviewRow(popup);
  markPreviewRow(popup);
  let name='ชื่อปุ่ม',bg='#e2e8f0',text='#64748b',icon='',isModel=true;
  if(row){
    const key=row.dataset.key;
    const item=state.items.find(x=>x.key===key)||{};
    name=String(row.querySelector('.button-name')?.value||'').trim()||'ชื่อปุ่ม';
    bg=row.querySelector('.button-bg')?.value||'#2563eb';
    text=row.querySelector('.button-text')?.value||'#ffffff';
    const typed=String(row.querySelector('.button-icon-url')?.value||'').trim();
    icon=String(item.previewIconUrl||typed||item.iconUrl||'').trim();
    isModel=false;
  }
  const iconMarkup=needsIcon(selectedStyle)?previewIconMarkup(icon,isModel):'';
  const modelClass=isModel?' is-model':'';
  holder.innerHTML=`<div class="button-manager-preview-caption">${isModel?'โมเดลรูปแบบปุ่ม':'ตัวอย่างปุ่มที่กำลังแก้ไข'}</div><div class="button-manager-preview-stage"><span class="button-section-item button-manager-preview-button is-${esc(selectedStyle)}${modelClass}" style="--button-bg:${esc(bg)};--button-color:${esc(text)}">${iconMarkup}<span class="button-section-label">${esc(name)}</span></span></div>`;
}
function releaseItemPreview(item){
  if(item?.previewObjectUrl){try{URL.revokeObjectURL(item.previewObjectUrl)}catch(ignore){};item.previewObjectUrl='';}
}
function cleanupPreviewObjectUrls(){state.items.forEach(releaseItemPreview)}
function syncStateFromDom(){
  const popup=Swal.getPopup();if(!popup)return;
  const rows=[...popup.querySelectorAll('#buttonManagerBody tr[data-key]')];
  const old=new Map(state.items.map(x=>[x.key,x]));
  state.items=rows.map((tr,index)=>{
    const key=tr.dataset.key,prev=old.get(key)||{};
    return normalizeItem({
      ...prev,key,
      name:tr.querySelector('.button-name')?.value||'',
      iconUrl:tr.querySelector('.button-icon-url')?.value||prev.iconUrl||'',
      url:tr.querySelector('.button-url')?.value||'',
      buttonColor:tr.querySelector('.button-bg')?.value||'#2563eb',
      textColor:tr.querySelector('.button-text')?.value||'#ffffff',
      visible:!!tr.querySelector('.button-visible')?.checked,
      order:index+1
    },index);
  });
}
function rerenderManager(){syncStateFromDom();Swal.update({html:managerHtml()});bindManager()}
function bindManager(){
  const popup=Swal.getPopup();if(!popup)return;
  const style=popup.querySelector('#buttonManagerStyle');
  if(style)style.onchange=()=>{syncStateFromDom();state.style=normalizeStyle(style.value);Swal.update({html:managerHtml()});bindManager()};
  popup.querySelector('#buttonManagerAdd')?.addEventListener('click',()=>{syncStateFromDom();const added=normalizeItem({buttonColor:'#2563eb',textColor:'#ffffff',visible:true},state.items.length);state.items.push(added);previewKey=added.key;Swal.update({html:managerHtml()});bindManager()});
  popup.querySelectorAll('[data-delete]').forEach(btn=>btn.onclick=()=>{syncStateFromDom();const removedKey=btn.dataset.delete;const removed=state.items.find(x=>x.key===removedKey);releaseItemPreview(removed);const removedIndex=state.items.findIndex(x=>x.key===removedKey);state.items=state.items.filter(x=>x.key!==removedKey);if(previewKey===removedKey){const next=state.items[Math.min(Math.max(removedIndex,0),Math.max(state.items.length-1,0))];previewKey=next?.key||'';}Swal.update({html:managerHtml()});bindManager()});
  popup.querySelectorAll('[data-up]').forEach(btn=>btn.onclick=()=>{syncStateFromDom();const i=state.items.findIndex(x=>x.key===btn.dataset.up);if(i>0)[state.items[i-1],state.items[i]]=[state.items[i],state.items[i-1]];Swal.update({html:managerHtml()});bindManager()});
  popup.querySelectorAll('[data-down]').forEach(btn=>btn.onclick=()=>{syncStateFromDom();const i=state.items.findIndex(x=>x.key===btn.dataset.down);if(i>=0&&i<state.items.length-1)[state.items[i],state.items[i+1]]=[state.items[i+1],state.items[i]];Swal.update({html:managerHtml()});bindManager()});
  popup.querySelectorAll('tr[data-key]').forEach((tr)=>{
    const key=tr.dataset.key;
    const item=state.items.find(x=>x.key===key);
    const refreshCurrent=()=>activatePreview(key);
    tr.addEventListener('focusin',refreshCurrent);
    tr.addEventListener('pointerdown',refreshCurrent);
    tr.querySelector('.button-name')?.addEventListener('input',refreshCurrent);
    tr.querySelector('.button-bg')?.addEventListener('input',refreshCurrent);
    tr.querySelector('.button-text')?.addEventListener('input',refreshCurrent);
    const file=tr.querySelector('.button-manager-file');
    if(file)file.onchange=()=>{
      const selected=file.files&&file.files[0];if(!selected)return;
      const status=tr.querySelector('.button-manager-icon-status');
      if(!String(selected.type||'').startsWith('image/')){if(status)status.textContent='กรุณาเลือกไฟล์รูปภาพเท่านั้น';file.value='';return;}
      if(selected.size>ICON_SOURCE_MAX){if(status)status.textContent='ไฟล์รูปภาพต้นฉบับต้องมีขนาดไม่เกิน 100 MB';file.value='';return;}
      if(item){
        releaseItemPreview(item);
        item.pendingFile=selected;
        item.previewObjectUrl=URL.createObjectURL(selected);
        item.previewIconUrl=item.previewObjectUrl;
        if(status)status.textContent=`เลือกแล้ว: ${selected.name} (${Math.ceil(selected.size/1024)} KB) ตัวอย่างเปลี่ยนแล้ว และจะย่อ/อัปโหลดเมื่อกดบันทึก`;
        refreshCurrent();
      }
    };
    const iconUrl=tr.querySelector('.button-icon-url');
    if(iconUrl)iconUrl.oninput=()=>{
      if(item){
        const value=iconUrl.value.trim();
        if(value){releaseItemPreview(item);item.pendingFile=null;item.previewIconUrl=value;}
        else if(!item.pendingFile)item.previewIconUrl='';
      }
      refreshCurrent();
    };
  });
  updateManagerPreview();
}
async function collectAndSave(){
  syncStateFromDom();
  state.style=normalizeStyle(Swal.getPopup()?.querySelector('#buttonManagerStyle')?.value||state.style);
  for(let i=0;i<state.items.length;i++){
    const item=state.items[i];
    item.name=String(item.name||'').trim();item.url=String(item.url||'').trim();item.iconUrl=String(item.iconUrl||'').trim();
    if(!item.name)throw new Error(`แถวที่ ${i+1}: กรุณาระบุชื่อปุ่ม`);
    if(!validUrl(item.url))throw new Error(`แถวที่ ${i+1}: URL ปุ่มไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://`);
    if(!validColor(item.buttonColor)||!validColor(item.textColor))throw new Error(`แถวที่ ${i+1}: สีปุ่มหรือสีข้อความไม่ถูกต้อง`);
    if(needsIcon(state.style)){
      if(item.pendingFile){
        Swal.getTitle().textContent=`กำลังย่อและอัปโหลดไอคอน ${i+1}/${state.items.length}`;
        const packed=await compressIcon(item.pendingFile);
        const uploaded=await adminApi('uploadicon',{imageData:packed.dataUrl,imageName:packed.fileName});
        releaseItemPreview(item);item.iconUrl=String(uploaded.url||'').trim();item.previewIconUrl=item.iconUrl;item.pendingFile=null;
      }
      if(!validUrl(item.iconUrl))throw new Error(`แถวที่ ${i+1}: กรุณาระบุ URL ไอคอนหรืออัปโหลดรูปไอคอน`);
    }
    item.order=i+1;
  }
  Swal.getTitle().textContent='กำลังบันทึกรายการปุ่ม...';
  const result=await adminApi('save',{style:state.style,items:state.items.map(({pendingFile,previewIconUrl,previewObjectUrl,key,...x})=>x)});
  return result;
}
async function openManager(){
  try{
    Swal.fire({title:'กำลังโหลดรายการปุ่ม...',didOpen:()=>Swal.showLoading(),allowOutsideClick:false,showConfirmButton:false});
    const data=await adminApi('list');
    state.style=normalizeStyle(data.style);state.items=(data.items||[]).map(normalizeItem);previewKey=state.items[0]?.key||'';
    const result=await Swal.fire({
      title:'จัดการปุ่ม',html:managerHtml(),width:'96vw',showCancelButton:true,confirmButtonText:'บันทึกทั้งหมด',cancelButtonText:'ยกเลิก',confirmButtonColor:'#16a34a',customClass:{popup:'button-manager-popup'},
      didOpen:bindManager,
      willClose:cleanupPreviewObjectUrls,
      preConfirm:async()=>{try{Swal.showLoading();return await collectAndSave()}catch(err){Swal.hideLoading();Swal.showValidationMessage(err.message);return false}}
    });
    if(result.isConfirmed){render(result.value||await publicLoad());document.dispatchEvent(new CustomEvent('buttonsection-updated'));Swal.fire({icon:'success',title:'บันทึกปุ่มเรียบร้อยแล้ว',timer:1200,showConfirmButton:false})}
  }catch(err){Swal.fire('ผิดพลาด',err.message,'error')}
}
$('manageButtonSectionButton')?.addEventListener('click',openManager);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
else refresh();
})();
