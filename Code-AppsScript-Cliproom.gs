const SHEET_CLIP_ID ="1qzpQphmKAe5ws_BFOVpceOaZ1YDU2GWHsxuIFvCyNlc" //id sheet ชีตคลิป


const SHEETS = { SETTINGS:'Settings', USERS:'Users', COURSES:'Courses', CHECKPOINTS:'Checkpoints', QUESTIONS:'Questions', PROGRESS:'Progress', ATTEMPTS:'Attempts', EVENTS:'Events', CERTIFICATE:'Certificate' };

function doGet(e) {
  const mode=String(e&&e.parameter&&e.parameter.mode||'').toLowerCase();
  if(mode==='cliproombox'){
    const callback=String(e.parameter.callback||'cliproomCatalogCallback').replace(/[^a-zA-Z0-9_.$]/g,'');
    const catalog=getPublicCatalog();
    return ContentService
      .createTextOutput(callback+'('+JSON.stringify({success:true,settings:catalog.settings,courses:catalog.courses})+')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  const page=String(e&&e.parameter&&e.parameter.page||'').toLowerCase();
  const template=page==='admin'?'Admin':'Index';
  return HtmlService.createTemplateFromFile(template).evaluate()
    .setTitle((template==='Admin'?'ผู้ดูแลระบบ - ':'')+(getSetting_('APP_NAME') || 'ระบบอบรมออนไลน์'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1');
}

function setupSystem() {
  const ss = SpreadsheetApp.openById(SHEET_CLIP_ID);
  const defs = {
    Settings: [['KEY','VALUE','คำอธิบาย'],['APP_NAME','ระบบอบรมออนไลน์','ชื่อระบบ'],['ORG_NAME','หน่วยงานตัวอย่าง','ชื่อหน่วยงาน'],['LOGO_URL','','ลิงก์โลโก้'],['CERT_SIGNER','นางปราณี ชูใจรัก','ผู้ลงนาม'],['CERT_POSITION','ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอ','ตำแหน่ง'],['PASS_PERCENT','80','เกณฑ์ผ่านแบบทดสอบ'],['SESSION_MINUTES','120','อายุการเข้าสู่ระบบ']],
    Users: [['PHONE','NAME','PIN_HASH','ROLE','ACTIVE','CREATED_AT'],['0812345678','ผู้เรียนตัวอย่าง',hash_('1234'),'STUDENT',true,new Date()]],
    Courses: [['COURSE_ID','TITLE','DESCRIPTION','COVER_URL','VIDEO_TYPE','VIDEO_URL','DURATION_SEC','FINAL_PASS_PERCENT','ACTIVE','SORT_ORDER'],['COURSE001','หลักสูตรอบรมตัวอย่าง','ดูวิดีโอให้ครบและตอบคำถามระหว่างทาง','https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900','YOUTUBE','https://www.youtube.com/watch?v=dQw4w9WgXcQ',180,80,true,1]],
    Checkpoints: [['CHECKPOINT_ID','COURSE_ID','AT_SEC','QUESTION_COUNT','PASS_PERCENT','ORDER','MAX_ATTEMPTS'],['CP001','COURSE001',45,5,80,1,0],['CP002','COURSE001',100,5,80,2,0]],
    Questions: [['QUESTION_ID','CHECKPOINT_ID','QUESTION','CHOICE_A','CHOICE_B','CHOICE_C','CHOICE_D','CORRECT','EXPLANATION'],
      ['Q001','CP001','เมื่อสัญญาณไฟแดงควรทำอย่างไร','หยุดรถ','เร่งผ่าน','บีบแตร','เลี้ยวทันที','A','ต้องหยุดรถหลังเส้นหยุด'],
      ['Q002','CP001','ผู้ขับขี่ควรคาดเข็มขัดนิรภัยเมื่อใด','เฉพาะทางไกล','ทุกครั้ง','เมื่อมีตำรวจ','เฉพาะกลางคืน','B','ควรคาดทุกครั้ง'],
      ['Q003','CP001','ก่อนเปลี่ยนช่องทางควรทำสิ่งใด','เร่งทันที','ปิดไฟหน้า','ให้สัญญาณและดูรถ','หยุดกลางถนน','C','ตรวจสอบและให้สัญญาณก่อน'],
      ['Q004','CP001','การใช้โทรศัพท์ขณะขับรถมีผลอย่างไร','ปลอดภัยขึ้น','ลดสมาธิ','ประหยัดน้ำมัน','ไม่มีผล','B','ทำให้เสียสมาธิ'],
      ['Q005','CP001','เมื่อฝนตกควรขับอย่างไร','เร็วขึ้น','ชิดคันหน้า','ลดความเร็วและเพิ่มระยะ','ปิดไฟ','C','ถนนลื่นและระยะเบรกเพิ่ม'],
      ['Q006','CP002','พบคนข้ามทางม้าลายควรทำอย่างไร','เร่งผ่าน','หยุดให้ข้าม','บีบแตร','เลี้ยวหนี','B','ต้องให้ทางคนข้าม'],
      ['Q007','CP002','ควรตรวจยางรถเมื่อใด','เป็นประจำ','เมื่อยางแตก','ไม่จำเป็น','ปีละครั้งเท่านั้น','A','ตรวจสภาพและแรงดันเป็นประจำ'],
      ['Q008','CP002','ระยะห่างจากรถคันหน้าควรเป็นอย่างไร','ใกล้ที่สุด','เพียงพอให้หยุดได้','หนึ่งเมตรเสมอ','ไม่สำคัญ','B','ต้องมีระยะหยุดรถปลอดภัย'],
      ['Q009','CP002','เมื่อรู้สึกง่วงควรทำอย่างไร','เปิดเพลงดังแล้วขับต่อ','จอดพัก','เร่งให้ถึงเร็ว','ดื่มน้ำแล้วไม่ต้องพัก','B','จอดในจุดปลอดภัยและพัก'],
      ['Q010','CP002','หมวกนิรภัยมีหน้าที่สำคัญอย่างไร','กันแดด','ลดการบาดเจ็บศีรษะ','ทำให้เร็วขึ้น','ใช้แทนใบขับขี่','B','ช่วยป้องกันศีรษะ']],
    Progress: [['PHONE','COURSE_ID','MAX_WATCHED_SEC','CURRENT_SEC','WATCHED_SEC','LAST_HEARTBEAT','STATUS','COMPLETED_AT','CERT_NO']],
    Attempts: [['TIMESTAMP','PHONE','COURSE_ID','CHECKPOINT_ID','SCORE','TOTAL','PERCENT','PASSED','ANSWERS_JSON']],
    Events: [['TIMESTAMP','PHONE','COURSE_ID','TYPE','DETAIL','USER_AGENT']]
  };
  Object.keys(defs).forEach(name => {
    let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); sh.clear();
    sh.getRange(1,1,defs[name].length,defs[name][0].length).setValues(defs[name]);
    sh.setFrozenRows(1); sh.getRange(1,1,1,defs[name][0].length).setFontWeight('bold').setBackground('#123b69').setFontColor('#fff'); sh.autoResizeColumns(1,defs[name][0].length);
  });
  ss.getSheetByName(SHEETS.USERS).getRange('A:A').setNumberFormat('@');
  return 'ติดตั้งสำเร็จ: โทร 0812345678 / PIN 1234';
}

function upgradeSystemV2(){
  const users=sheet_(SHEETS.USERS); users.getRange('A:A').setNumberFormat('@');
  const courses=sheet_(SHEETS.COURSES), headers=courses.getRange(1,1,1,courses.getLastColumn()).getValues()[0].map(String);
  ['COVER_URL','SORT_ORDER'].forEach(h=>{if(!headers.includes(h)){courses.getRange(1,courses.getLastColumn()+1).setValue(h);headers.push(h);}});
  courses.getRange(1,1,1,courses.getLastColumn()).setFontWeight('bold').setBackground('#123b69').setFontColor('#fff');
  return 'อัปเกรดสำเร็จ: เพิ่ม COVER_URL, SORT_ORDER และแก้รูปแบบเบอร์โทรแล้ว';
}

function login(phone,pin) {
  phone=cleanPhone_(phone); const rows=rows_(SHEETS.USERS); const u=rows.find(r=>normalizePhone_(r.PHONE)===phone && String(r.PIN_HASH)===hash_(String(pin)) && truthy_(r.ACTIVE));
  if(!u) throw new Error('เบอร์โทรศัพท์หรือ PIN ไม่ถูกต้อง');
  const token=Utilities.getUuid();
  const sessionJson=JSON.stringify({phone,name:u.NAME,role:u.ROLE,createdAt:new Date().toISOString()});
  PropertiesService.getScriptProperties().setProperty('S_'+token,sessionJson);
  CacheService.getScriptCache().put('S_'+token,sessionJson,21600);
  return {token,user:{phone,name:u.NAME,role:u.ROLE},settings:publicSettings_(),courses:getCourses_(),dashboard:getDashboard_(phone)};
}
function upgradeAdminDashboard(){
  const sh=ensureCheckpointAttemptsColumn_();
  sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold').setBackground('#123b69').setFontColor('#fff');
  return 'อัปเกรด Admin Dashboard สำเร็จ';
}
function ensureCheckpointAttemptsColumn_(){const sh=sheet_(SHEETS.CHECKPOINTS),headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);if(!headers.includes('MAX_ATTEMPTS'))sh.getRange(1,sh.getLastColumn()+1).setValue('MAX_ATTEMPTS');return sh;}
function registerUser(name,phone,pin){
  name=String(name||'').trim().replace(/\s+/g,' ');
  phone=normalizePhone_(phone);
  pin=String(pin||'').trim();
  if(name.length<2||name.length>120) throw new Error('กรุณากรอกชื่อ–นามสกุลให้ถูกต้อง');
  if(!/^0\d{9}$/.test(phone)) throw new Error('เบอร์โทรศัพท์ต้องมี 10 หลักและขึ้นต้นด้วย 0');
  if(!/^\d{4,8}$/.test(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–8 หลัก');
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    if(rows_(SHEETS.USERS).some(r=>normalizePhone_(r.PHONE)===phone)) throw new Error('เบอร์โทรศัพท์นี้ลงทะเบียนแล้ว');
    const sh=sheet_(SHEETS.USERS), row=sh.getLastRow()+1;
    sh.getRange(row,1).setNumberFormat('@').setValue(phone);
    sh.getRange(row,2,1,5).setValues([[name,hash_(pin),'STUDENT',true,new Date()]]);
    return {success:true,phone:phone,name:name};
  } finally { lock.releaseLock(); }
}
function resume(token){ const s=session_(token); return {user:s,settings:publicSettings_(),courses:getCourses_(),dashboard:getDashboard_(s.phone)}; }
function logout(token){ CacheService.getScriptCache().remove('S_'+token); PropertiesService.getScriptProperties().deleteProperty('S_'+token); return true; }
function getPublicCatalog(){return {settings:publicSettings_(),courses:getCourses_()};}
function getDashboard(token){return getDashboard_(session_(token).phone);}

function cancelCourse(token,courseId){
  const s=session_(token),id=String(courseId||''),progress=findProgressRow_(s.phone,id);
  if(!progress.data)throw new Error('ไม่พบข้อมูลหลักสูตรที่กำลังอบรม');
  if(String(progress.data[6]||'')==='COMPLETED')throw new Error('ไม่สามารถยกเลิกหลักสูตรที่ผ่านการอบรมแล้ว');
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error('ระบบกำลังบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
  try{
    const progressSheet=sheet_(SHEETS.PROGRESS),progressValues=progressSheet.getDataRange().getValues();
    for(let i=progressValues.length-1;i>=1;i--)if(normalizePhone_(progressValues[i][0])===normalizePhone_(s.phone)&&String(progressValues[i][1])===id&&String(progressValues[i][6]||'')!=='COMPLETED')progressSheet.deleteRow(i+1);
    const attemptsSheet=sheet_(SHEETS.ATTEMPTS),attemptValues=attemptsSheet.getDataRange().getValues();
    for(let i=attemptValues.length-1;i>=1;i--)if(normalizePhone_(attemptValues[i][1])===normalizePhone_(s.phone)&&String(attemptValues[i][2])===id)attemptsSheet.deleteRow(i+1);
  }finally{lock.releaseLock();}
  sheet_(SHEETS.EVENTS).appendRow([new Date(),s.phone,id,'COURSE_CANCELLED','ผู้เรียนยกเลิกหลักสูตร','']);
  return{success:true,dashboard:getDashboard_(s.phone)};
}

function getCourse(token,courseId){ const s=session_(token); const c=rows_(SHEETS.COURSES).find(r=>String(r.COURSE_ID)===String(courseId)&&truthy_(r.ACTIVE)); if(!c) throw new Error('ไม่พบหลักสูตร');
  const cps=rows_(SHEETS.CHECKPOINTS).filter(r=>String(r.COURSE_ID)===String(courseId)).sort((a,b)=>Number(a.ORDER)-Number(b.ORDER)).map(r=>({id:String(r.CHECKPOINT_ID),at:Number(r.AT_SEC),count:Number(r.QUESTION_COUNT),pass:Number(r.PASS_PERCENT)}));
  const p=getProgress_(s.phone,courseId); return {course:c,checkpoints:cps,progress:p,completed:completedCheckpointIds_(s.phone,courseId)};
}

function restartCourse(token,courseId){
  const s=session_(token),id=String(courseId||''),c=rows_(SHEETS.COURSES).find(r=>String(r.COURSE_ID)===id&&truthy_(r.ACTIVE));if(!c)throw new Error('ไม่พบหลักสูตร');
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error('ระบบกำลังบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
  try{const p=findProgressRow_(s.phone,id),sh=sheet_(SHEETS.PROGRESS);if(p.data){if(String(p.data[6]||'')==='COMPLETED')throw new Error('หลักสูตรนี้ผ่านการอบรมแล้ว');p.data[2]=0;p.data[3]=0;p.data[4]=0;p.data[5]='';p.data[6]='IN_PROGRESS';p.data[7]='';p.data[8]='';sh.getRange(p.row,1,1,p.data.length).setValues([p.data]);}else sh.appendRow([s.phone,id,0,0,0,'','IN_PROGRESS','','']);}finally{lock.releaseLock();}
  const result=getCourse(token,id);result.completed=[];result.progress.maxWatchedSec=0;result.progress.currentSec=0;result.progress.watchedSec=0;return result;
}

function heartbeat(token,payload){ const s=session_(token), lock=LockService.getScriptLock(); if(!lock.tryLock(1500))return{busy:true}; try{
  const now=Date.now(), courseId=String(payload.courseId), current=Math.max(0,Number(payload.current)||0), delta=Math.max(0,Math.min(15,Number(payload.delta)||0));
  const p=findProgressRow_(s.phone,courseId), sh=sheet_(SHEETS.PROGRESS); let data=p.data;
  if(!data){ data=[s.phone,courseId,0,0,0,'','IN_PROGRESS','','']; sh.appendRow(data); p.row=sh.getLastRow(); }
  const last=data[5] ? new Date(data[5]).getTime() : 0; const valid=payload.visible===true && payload.playing===true && now-last<30000;
  const add=valid?delta:0, maxAllowed=Number(data[2]||0)+20; data[2]=Math.max(Number(data[2]||0),Math.min(current,maxAllowed)); data[3]=Math.min(current,Number(data[2]||0)+20); data[4]=Number(data[4]||0)+add; data[5]=new Date();
  sh.getRange(p.row,1,1,data.length).setValues([data]); return {busy:false,maxWatched:Number(data[2]),watched:Number(data[4])};
  } finally{lock.releaseLock();}}

function getCheckpointQuiz(token,courseId,checkpointId){ const s=session_(token); const cp=rows_(SHEETS.CHECKPOINTS).find(r=>String(r.CHECKPOINT_ID)===String(checkpointId)&&String(r.COURSE_ID)===String(courseId)); if(!cp) throw new Error('ไม่พบแบบทดสอบ');
  const maxAttempts=Number(cp.MAX_ATTEMPTS||0), used=rows_(SHEETS.ATTEMPTS).filter(r=>normalizePhone_(r.PHONE)===normalizePhone_(s.phone)&&String(r.COURSE_ID)===String(courseId)&&String(r.CHECKPOINT_ID)===String(checkpointId)).length;if(maxAttempts>0&&used>=maxAttempts)throw new Error('คุณใช้สิทธิ์ทำแบบทดสอบครบ '+maxAttempts+' ครั้งแล้ว');
  const p=getProgress_(s.phone,courseId); if(Number(p.maxWatchedSec)+5<Number(cp.AT_SEC)) throw new Error('ยังรับชมไม่ถึงช่วงแบบทดสอบ');
  return shuffle_(rows_(SHEETS.QUESTIONS).filter(q=>String(q.CHECKPOINT_ID)===String(checkpointId))).slice(0,Number(cp.QUESTION_COUNT)).map(q=>({id:String(q.QUESTION_ID),text:q.QUESTION,choices:[q.CHOICE_A,q.CHOICE_B,q.CHOICE_C,q.CHOICE_D]}));
}

function submitQuiz(token,courseId,checkpointId,answers){ const s=session_(token), cp=rows_(SHEETS.CHECKPOINTS).find(r=>String(r.CHECKPOINT_ID)===String(checkpointId)&&String(r.COURSE_ID)===String(courseId)); if(!cp) throw new Error('ไม่พบแบบทดสอบ');
  const maxAttempts=Number(cp.MAX_ATTEMPTS||0), used=rows_(SHEETS.ATTEMPTS).filter(r=>normalizePhone_(r.PHONE)===normalizePhone_(s.phone)&&String(r.COURSE_ID)===String(courseId)&&String(r.CHECKPOINT_ID)===String(checkpointId)).length;
  if(maxAttempts>0&&used>=maxAttempts)throw new Error('คุณใช้สิทธิ์ทำแบบทดสอบครบ '+maxAttempts+' ครั้งแล้ว');
  const qs=rows_(SHEETS.QUESTIONS).filter(q=>String(q.CHECKPOINT_ID)===String(checkpointId)&&answers.hasOwnProperty(String(q.QUESTION_ID))); let score=0;
  const detail=qs.map(q=>{const a=Number(answers[String(q.QUESTION_ID)]), correct='ABCD'.indexOf(String(q.CORRECT).toUpperCase()); const ok=a===correct;if(ok)score++;return {id:q.QUESTION_ID,correct,ok,explanation:q.EXPLANATION};});
  const total=qs.length, percent=total?Math.round(score*100/total):0, passed=total>0&&percent>=Number(cp.PASS_PERCENT||80);
  sheet_(SHEETS.ATTEMPTS).appendRow([new Date(),s.phone,courseId,checkpointId,score,total,percent,passed,JSON.stringify(answers)]); return {score,total,percent,passed,detail};
}

function completeCourse(token,courseId,currentSec){ const s=session_(token), c=rows_(SHEETS.COURSES).find(r=>String(r.COURSE_ID)===String(courseId)); if(!c) throw new Error('ไม่พบหลักสูตร');
  const p=findProgressRow_(s.phone,courseId), required=rows_(SHEETS.CHECKPOINTS).filter(x=>String(x.COURSE_ID)===String(courseId)).map(x=>String(x.CHECKPOINT_ID)), passed=completedCheckpointIds_(s.phone,courseId);
  if(Number(currentSec)+5<Number(c.DURATION_SEC)||required.some(id=>!passed.includes(id))) throw new Error('ยังดูวิดีโอหรือทำแบบทดสอบไม่ครบ');
  const certScore=certificateScore_(s.phone,courseId), certConfig=getCertificateConfig_();
  if(certScore.percent<Number(certConfig.passPercent||80))throw new Error('คะแนนรวม '+certScore.percent+'% ยังไม่ผ่านเกณฑ์ '+Number(certConfig.passPercent||80)+'%\n\nกรุณาเข้าอบรมอีกครั้งเพื่อทำแบบทดสอบใหม่');
  const data=p.data, cert=data[8]||('CERT-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd')+'-'+Utilities.getUuid().slice(0,6).toUpperCase());
  data[2]=Math.max(Number(data[2]),Number(c.DURATION_SEC)); data[3]=Number(c.DURATION_SEC); data[6]='COMPLETED'; data[7]=data[7]||new Date(); data[8]=cert; sheet_(SHEETS.PROGRESS).getRange(p.row,1,1,data.length).setValues([data]); return certificateData_(s,courseId);
}
function getCertificate(token,courseId){return certificateData_(session_(token),courseId);}
function certificateData_(s,courseId){
  const p=findProgressRow_(s.phone,courseId); if(!p.data||String(p.data[6])!=='COMPLETED')throw new Error('ยังไม่ผ่านการอบรมหลักสูตรนี้');
  const c=rows_(SHEETS.COURSES).find(r=>String(r.COURSE_ID)===String(courseId)); if(!c)throw new Error('ไม่พบหลักสูตร');
  const score=certificateScore_(s.phone,courseId), cfg=getCertificateConfig_();
  if(score.percent<Number(cfg.passPercent||80))throw new Error('คะแนนยังไม่ถึงเกณฑ์รับเกียรติบัตร');
  return {name:s.name,courseId:String(courseId),course:c.TITLE,score:score.score,total:score.total,percent:score.percent,date:thaiDate_(p.data[7]),certNo:p.data[8],config:cfg};
}
function certificateScore_(phone,courseId){
  const best={}, attempts=rows_(SHEETS.ATTEMPTS).filter(r=>normalizePhone_(r.PHONE)===normalizePhone_(phone)&&String(r.COURSE_ID)===String(courseId));
  attempts.forEach(r=>{const id=String(r.CHECKPOINT_ID),pct=Number(r.PERCENT||0);if(!best[id]||pct>best[id].percent)best[id]={score:Number(r.SCORE||0),total:Number(r.TOTAL||0),percent:pct};});
  const vals=Object.keys(best).map(k=>best[k]), score=vals.reduce((n,x)=>n+x.score,0), total=vals.reduce((n,x)=>n+x.total,0);return{score,total,percent:total?Math.round(score*100/total):0};
}
function getCertificateConfig_(){
  const sh=SpreadsheetApp.openById(SHEET_CLIP_ID).getSheetByName(SHEETS.CERTIFICATE); 
  if(!sh)throw new Error('ไม่พบชีต Certificate');
  const image=String(sh.getRange('C2').getDisplayValue()||'').trim(), rows=sh.getRange('B3:E13').getDisplayValues(), keys=['title','subtitle','username','score','percentage','scorevalue','category','date','line','branding','branding2'], elements={};
  keys.forEach((k,i)=>elements[k]={text:rows[i][0]||'',color:rows[i][1]||'#000000',size:Number(rows[i][2])||16,y:Number(rows[i][3])||0});
  return{image:image,passPercent:Number(sh.getRange('B14').getValue())||80,elements:elements};
}
function thaiDate_(value){const d=value?new Date(value):new Date(),m=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];return 'วันที่ '+d.getDate()+' '+m[d.getMonth()]+' '+(d.getFullYear()+543)+' เวลา '+Utilities.formatDate(d,'Asia/Bangkok','HH:mm')+' น.';}
function logEvent(token,courseId,type,detail,ua){let phone='UNKNOWN';try{phone=session_(token).phone}catch(e){} sheet_(SHEETS.EVENTS).appendRow([new Date(),phone,courseId,type,String(detail||'').slice(0,500),String(ua||'').slice(0,300)]);return true;}

function adminGetBootstrap(token){
  ensureCheckpointAttemptsColumn_();
  const admin=assertAdmin_(token),courses=rows_(SHEETS.COURSES),checkpoints=rows_(SHEETS.CHECKPOINTS),users=rows_(SHEETS.USERS),progress=rows_(SHEETS.PROGRESS),attempts=rows_(SHEETS.ATTEMPTS);
  return {
    admin:{phone:admin.phone,name:admin.name,role:admin.role},settings:publicSettings_(),
    overview:{courses:courses.length,activeCourses:courses.filter(x=>truthy_(x.ACTIVE)).length,users:users.length,activeUsers:users.filter(x=>truthy_(x.ACTIVE)).length,completed:progress.filter(x=>String(x.STATUS)==='COMPLETED').length,inProgress:progress.filter(x=>String(x.STATUS)!=='COMPLETED').length,attempts:attempts.length},
    courses:courses.map(x=>({id:String(x.COURSE_ID),title:String(x.TITLE||x.COURSE_ID),duration:Number(x.DURATION_SEC||0),active:truthy_(x.ACTIVE)})),
    checkpoints:checkpoints.map(x=>({id:String(x.CHECKPOINT_ID),courseId:String(x.COURSE_ID),at:Number(x.AT_SEC||0),order:Number(x.ORDER||0)}))
  };
}

function adminGetData(token,section){assertAdmin_(token);section=String(section||'').toLowerCase();if(section==='checkpoints')ensureCheckpointAttemptsColumn_();const map={settings:SHEETS.SETTINGS,courses:SHEETS.COURSES,checkpoints:SHEETS.CHECKPOINTS,questions:SHEETS.QUESTIONS,users:SHEETS.USERS,progress:SHEETS.PROGRESS,attempts:SHEETS.ATTEMPTS,events:SHEETS.EVENTS};const name=map[section];if(!name)throw new Error('ไม่พบส่วนจัดการ');const sh=sheet_(name),v=sh.getDataRange().getValues(),headers=v.shift().map(String);let data=v.filter(r=>r.some(x=>x!==''&&x!==null));if(['progress','attempts','events'].includes(section)&&data.length>500)data=data.slice(-500);const rows=data.map((r,idx)=>{const o={_row:idx+2};headers.forEach((h,i)=>o[h]=adminValue_(r[i]));if(name===SHEETS.USERS)delete o.PIN_HASH;return o});return{section:section,headers:headers.filter(h=>!(name===SHEETS.USERS&&h==='PIN_HASH')),rows:rows};}
function adminSaveRecord(token,section,data,originalId){assertAdmin_(token);section=String(section||'').toLowerCase();const map={settings:{sheet:SHEETS.SETTINGS,key:'KEY'},courses:{sheet:SHEETS.COURSES,key:'COURSE_ID'},checkpoints:{sheet:SHEETS.CHECKPOINTS,key:'CHECKPOINT_ID'},questions:{sheet:SHEETS.QUESTIONS,key:'QUESTION_ID'}};const cfg=map[section];if(!cfg)throw new Error('ส่วนนี้ไม่อนุญาตให้บันทึก');data=Object.assign({},data||{});if(!String(data[cfg.key]||'').trim()&&section!=='settings')data[cfg.key]=nextAdminId_(section);const sh=sheet_(cfg.sheet),headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),key=String(data[cfg.key]||'').trim();if(!key)throw new Error('กรุณากรอก '+cfg.key);validateAdminRecord_(section,data);const vals=sh.getDataRange().getValues();let row=0;for(let i=1;i<vals.length;i++)if(String(vals[i][headers.indexOf(cfg.key)])===String(originalId||key)){row=i+1;break}if(!row&&vals.slice(1).some(r=>String(r[headers.indexOf(cfg.key)])===key))throw new Error(cfg.key+' ซ้ำ');const out=headers.map(h=>adminInput_(data[h]));if(row)sh.getRange(row,1,1,headers.length).setValues([out]);else sh.appendRow(out);return{success:true,id:key};}
function adminSaveUser(token,data,originalPhone){assertAdmin_(token);const phone=normalizePhone_(data.PHONE),name=String(data.NAME||'').trim(),role=String(data.ROLE||'STUDENT').toUpperCase();if(!/^0\d{9}$/.test(phone))throw new Error('เบอร์โทรต้องมี 10 หลัก');if(!name)throw new Error('กรุณากรอกชื่อ');if(!['ADMIN','STUDENT'].includes(role))throw new Error('ROLE ไม่ถูกต้อง');const sh=sheet_(SHEETS.USERS);sh.getRange('A:A').setNumberFormat('@');const v=sh.getDataRange().getValues(),headers=v[0].map(String),old=normalizePhone_(originalPhone||phone);let row=0,oldData=null;for(let i=1;i<v.length;i++){if(normalizePhone_(v[i][0])===old){row=i+1;oldData=v[i];break}}if(v.slice(1).some((r,i)=>normalizePhone_(r[0])===phone&&(i+2)!==row))throw new Error('เบอร์โทรนี้มีอยู่แล้ว');const pin=String(data.PIN||'').trim(),hash=pin?hash_(pin):(oldData?oldData[headers.indexOf('PIN_HASH')]:'');if(!hash)throw new Error('กรุณากำหนด PIN');if(pin&&!/^\d{4,8}$/.test(pin))throw new Error('PIN ต้องเป็นตัวเลข 4–8 หลัก');const out=headers.map(h=>h==='PHONE'?phone:h==='NAME'?name:h==='PIN_HASH'?hash:h==='ROLE'?role:h==='ACTIVE'?truthy_(data.ACTIVE):h==='CREATED_AT'?(oldData?oldData[headers.indexOf(h)]:new Date()):'');if(row)sh.getRange(row,1,1,headers.length).setValues([out]);else sh.appendRow(out);return{success:true};}
function adminDeleteRecord(token,section,id){const admin=assertAdmin_(token),map={courses:{sheet:SHEETS.COURSES,key:'COURSE_ID'},checkpoints:{sheet:SHEETS.CHECKPOINTS,key:'CHECKPOINT_ID'},questions:{sheet:SHEETS.QUESTIONS,key:'QUESTION_ID'},users:{sheet:SHEETS.USERS,key:'PHONE'}};const cfg=map[String(section||'').toLowerCase()];if(!cfg)throw new Error('ส่วนนี้ไม่อนุญาตให้ลบ');if(section==='users'&&normalizePhone_(id)===normalizePhone_(admin.phone))throw new Error('ไม่สามารถลบบัญชีที่กำลังใช้งาน');if(section==='courses'&&(rows_(SHEETS.CHECKPOINTS).some(r=>String(r.COURSE_ID)===String(id))||rows_(SHEETS.PROGRESS).some(r=>String(r.COURSE_ID)===String(id))))throw new Error('หลักสูตรมีข้อมูลอ้างอิง กรุณาปิด ACTIVE แทนการลบ');if(section==='checkpoints'&&rows_(SHEETS.QUESTIONS).some(r=>String(r.CHECKPOINT_ID)===String(id)))throw new Error('Checkpoint มีคำถามอ้างอิง กรุณาลบคำถามก่อน');const sh=sheet_(cfg.sheet),v=sh.getDataRange().getValues(),headers=v[0].map(String),col=headers.indexOf(cfg.key);for(let i=1;i<v.length;i++){const val=cfg.key==='PHONE'?normalizePhone_(v[i][col]):String(v[i][col]);if(val===(cfg.key==='PHONE'?normalizePhone_(id):String(id))){sh.deleteRow(i+1);return{success:true}}}throw new Error('ไม่พบรายการ');}
function assertAdmin_(token){const s=session_(token),u=rows_(SHEETS.USERS).find(r=>normalizePhone_(r.PHONE)===normalizePhone_(s.phone));if(!u||!truthy_(u.ACTIVE)||String(u.ROLE||'').toUpperCase()!=='ADMIN')throw new Error('คุณไม่มีสิทธิ์ผู้ดูแลระบบ');return{phone:normalizePhone_(u.PHONE),name:u.NAME,role:u.ROLE};}
function adminValue_(v){if(v instanceof Date)return safeDateString_(v);return v;}
function adminInput_(v){if(v===true||String(v).toUpperCase()==='TRUE')return true;if(String(v).toUpperCase()==='FALSE')return false;return v==null?'':v;}
function nextAdminId_(section){const cfg={courses:{sheet:SHEETS.COURSES,key:'COURSE_ID',prefix:'COURSE'},checkpoints:{sheet:SHEETS.CHECKPOINTS,key:'CHECKPOINT_ID',prefix:'CP'},questions:{sheet:SHEETS.QUESTIONS,key:'QUESTION_ID',prefix:'Q'}}[section];if(!cfg)throw new Error('ไม่สามารถสร้างรหัสอัตโนมัติ');const used={};rows_(cfg.sheet).forEach(r=>used[String(r[cfg.key])]=true);let n=1,id='';do{id=cfg.prefix+String(n++).padStart(3,'0')}while(used[id]);return id;}
function validateAdminRecord_(section,d){if(section==='courses'){if(!d.TITLE)throw new Error('กรุณากรอกชื่อหลักสูตร');if(Number(d.DURATION_SEC)<=0)throw new Error('DURATION_SEC ต้องมากกว่า 0')}if(section==='checkpoints'){if(!d.COURSE_ID||!d.AT_SEC)throw new Error('กรุณาเลือกหลักสูตรและกำหนดเวลา');const c=rows_(SHEETS.COURSES).find(x=>String(x.COURSE_ID)===String(d.COURSE_ID));if(!c)throw new Error('ไม่พบ COURSE_ID');if(Number(d.AT_SEC)>=Number(c.DURATION_SEC))throw new Error('เวลาแบบทดสอบต้องน้อยกว่าความยาววิดีโอ')}if(section==='questions'){if(!d.CHECKPOINT_ID||!d.QUESTION)throw new Error('ข้อมูลคำถามไม่ครบ');if(!rows_(SHEETS.CHECKPOINTS).some(x=>String(x.CHECKPOINT_ID)===String(d.CHECKPOINT_ID)))throw new Error('ไม่พบ CHECKPOINT_ID');if(!/^[ABCD]$/.test(String(d.CORRECT||'').toUpperCase()))throw new Error('CORRECT ต้องเป็น A, B, C หรือ D')}}

function getCourses_(){return rows_(SHEETS.COURSES).filter(r=>truthy_(r.ACTIVE)).sort((a,b)=>Number(a.SORT_ORDER||999)-Number(b.SORT_ORDER||999)).map(r=>({id:String(r.COURSE_ID),title:r.TITLE,description:r.DESCRIPTION,coverUrl:r.COVER_URL||'',duration:Number(r.DURATION_SEC)}));}
function getDashboard_(phone){const cm={};getCourses_().forEach(c=>cm[c.id]=c);const items=rows_(SHEETS.PROGRESS).filter(r=>normalizePhone_(r.PHONE)===normalizePhone_(phone)).map(r=>{const c=cm[String(r.COURSE_ID)]||{};return{courseId:String(r.COURSE_ID),title:c.title||String(r.COURSE_ID),coverUrl:c.coverUrl||'',maxWatchedSec:Number(r.MAX_WATCHED_SEC||0),duration:Number(c.duration||0),status:String(r.STATUS||'IN_PROGRESS'),certNo:String(r.CERT_NO||''),completedAt:safeDateString_(r.COMPLETED_AT)}});return{attendanceCount:items.length,completedCount:items.filter(x=>x.status==='COMPLETED').length,inProgressCount:items.filter(x=>x.status!=='COMPLETED').length,inProgress:items.filter(x=>x.status!=='COMPLETED'),completed:items.filter(x=>x.status==='COMPLETED')};}
function safeDateString_(value){if(!value)return'';const d=new Date(value);return isNaN(d.getTime())?String(value):Utilities.formatDate(d,'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");}
function getProgress_(phone,id){const p=findProgressRow_(phone,id).data||[];return {maxWatchedSec:Number(p[2]||0),currentSec:Number(p[3]||0),watchedSec:Number(p[4]||0),status:p[6]||'NEW',certNo:p[8]||''};}
function findProgressRow_(phone,id){const sh=sheet_(SHEETS.PROGRESS),v=sh.getDataRange().getValues();for(let i=1;i<v.length;i++)if(normalizePhone_(v[i][0])===normalizePhone_(phone)&&String(v[i][1])===String(id))return{row:i+1,data:v[i]};return{row:0,data:null};}
function completedCheckpointIds_(phone,courseId){const done={};rows_(SHEETS.ATTEMPTS).filter(r=>normalizePhone_(r.PHONE)===normalizePhone_(phone)&&String(r.COURSE_ID)===String(courseId)).forEach(r=>done[String(r.CHECKPOINT_ID)]=1);return Object.keys(done);}
function publicSettings_(){return {appName:getSetting_('APP_NAME'),orgName:getSetting_('ORG_NAME'),logoUrl:getSetting_('LOGO_URL')};}
function getSetting_(k){const r=rows_(SHEETS.SETTINGS).find(x=>String(x.KEY)===k);return r?r.VALUE:'';}
function rows_(n){const v=sheet_(n).getDataRange().getValues(),h=v.shift().map(String);return v.filter(r=>r.some(x=>x!==''&&x!==null)).map(r=>{const o={};h.forEach((x,i)=>o[x]=r[i]);return o;});}
function sheet_(n){
  const sh=SpreadsheetApp.openById(SHEET_CLIP_ID).getSheetByName(n);
  if(!sh)throw new Error('กรุณารัน setupSystem() ก่อนใช้งาน: ไม่พบชีต '+n);return sh;}
function session_(t){if(!t)throw new Error('SESSION_EXPIRED');const key='S_'+t,cache=CacheService.getScriptCache();let raw=cache.get(key);if(!raw){raw=PropertiesService.getScriptProperties().getProperty(key);if(raw)cache.put(key,raw,21600);}if(!raw)throw new Error('SESSION_EXPIRED');return JSON.parse(raw);}
function hash_(s){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s));}
function cleanPhone_(s){return normalizePhone_(s);} function normalizePhone_(s){let p=String(s==null?'':s).trim().replace(/\.0$/,'').replace(/\D/g,'');if(p.length===9)p='0'+p;return p;} function truthy_(v){return v===true||String(v).toUpperCase()==='TRUE'||String(v)==='1';} function shuffle_(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
