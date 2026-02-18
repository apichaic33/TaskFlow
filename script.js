'use strict';
const API='https://script.google.com/macros/s/AKfycbyfSGhc5nJGWh9FJsKA3HWBijJ5uryoHZfv5buIc8BO4SUYCCfvZpZEcg8hGyQqtqYnAA/exec';
const S={api:localStorage.getItem('tf_api')||API,tasks:[],projects:[],routines:[],page:'dash',filter:'all'};

addEventListener('DOMContentLoaded',()=>{
  const av=localStorage.getItem('tf_av')||'A';
  const nm=localStorage.getItem('tf_name')||'User';
  const ca=document.getElementById('cfg-api');
  const cn=document.getElementById('cfg-name');
  const cav=document.getElementById('cfg-av');
  if(ca)ca.value=S.api;
  if(cn)cn.value=nm;
  if(cav)cav.value=av;
  const isClaude=location.hostname.includes('claude')||location.hostname.includes('anthropic');
  if(!isClaude)loadAll();else{go(document.querySelector('[data-p="setup"]'),'setup');toast('กรุณา Publish จาก Claude');}
});

function go(el,page){
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  if(el)el.classList.add('on');
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  const pg=document.getElementById('pg-'+page);
  if(pg)pg.classList.add('on');
  S.page=page;
  document.getElementById('content').scrollTop=0;
  const r={tasks:renderTasks,today:renderToday,proj:renderProjs,dash:renderDash};
  if(r[page])r[page]();
}

let _n=0;
function jsonpCall(params){
  return new Promise((resolve,reject)=>{
    if(!S.api){reject(new Error('ยังไม่ได้ตั้งค่า URL'));return;}
    const cb='_cb'+(++_n);
    const qs=Object.entries(Object.assign({callback:cb},params))
      .map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(typeof v==='object'?JSON.stringify(v):v))
      .join('&');
    const url=S.api+'?'+qs;
    let done=false;
    const t=setTimeout(()=>{if(!done){done=true;cleanup();reject(new Error('Timeout'));}},15000);
    window[cb]=d=>{if(done)return;done=true;clearTimeout(t);cleanup();d&&d.ok?resolve(d.data):reject(new Error(d&&d.error||'API Error'));};
    const s=document.createElement('script');
    s.id=cb;s.src=url;
    s.onerror=()=>{if(!done){done=true;clearTimeout(t);cleanup();reject(new Error('โหลดไม่ได้'));}};
    function cleanup(){delete window[cb];const el=document.getElementById(cb);if(el)el.remove();}
    document.head.appendChild(s);
  });
}

async function apiCall(action,payload){
  const params={action};
  if(payload){params.method='POST';params.payload=JSON.stringify(payload);}
  return jsonpCall(params).catch(e=>{toast('❌ '+e.message);return null;});
}

async function loadAll(){
  setSyncing(true);
  const d=await apiCall('getAll');
  if(d){
    S.tasks=(d.tasks||[]).map(nr);
    S.projects=(d.projects||[]).map(nr);
    S.routines=(d.routines||[]).map(nr);
    refreshBadges();renderDash();
    toast('✓ โหลดข้อมูลแล้ว');
    const ob=document.getElementById('ok-box');
    if(ob){ob.style.display='block';ob.textContent='✓ เชื่อมต่อสำเร็จ';}
    const hb=document.getElementById('howto-box');
    if(hb)hb.style.display='none';
  }
  setSyncing(false);
}
async function syncData(){await loadAll();}

function nr(o){const r={};for(const k in o){const v=o[k];r[k]=(v instanceof Date)?v.toISOString().slice(0,10):v;}return r;}

function setSyncing(on){
  const dot=document.getElementById('dot');
  const lbl=document.getElementById('slbl');
  dot.className='dot'+(on?' busy':'');
  lbl.textContent=on?'กำลังซิงค์...':'Sync';
}

function today(){return new Date().toISOString().slice(0,10);}
function toTH(s){if(!s)return '';const[y,m,d]=String(s).split('-');const mn=['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];return(d||'')+' '+(mn[+m]||'');}
function pName(id){const p=S.projects.find(x=>x.id===id);return p?p.name:'';}
function progOf(pid){const t=S.tasks.filter(x=>x.project_id===pid&&String(x.is_routine).toUpperCase()!=='TRUE');if(!t.length)return 0;return Math.round(t.filter(x=>x.status==='done').length/t.length*100);}
function todayT(){return S.tasks.filter(t=>t.due_date&&String(t.due_date).slice(0,10)===today()&&String(t.is_routine).toUpperCase()!=='TRUE');}
function activeT(){return S.tasks.filter(t=>t.status!=='done'&&String(t.is_routine).toUpperCase()!=='TRUE');}
function overT(){const t=today();return S.tasks.filter(x=>x.due_date&&String(x.due_date).slice(0,10)<t&&x.status!=='done');}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function refreshBadges(){
  const a=activeT().length,td=todayT().filter(t=>t.status!=='done').length;
  const bt=document.getElementById('b-tasks'),bto=document.getElementById('b-today');
  bt.textContent=a;bt.className='badge'+(a>0?' show':'');
  bto.textContent=td;bto.className='badge'+(td>0?' show':'');
}

function renderDash(){
  const tt=todayT(),at=activeT(),ov=overT();
  const total=S.tasks.filter(t=>String(t.is_routine).toUpperCase()!=='TRUE').length;
  const done=S.tasks.filter(t=>t.status==='done').length;
  document.getElementById('s1').textContent=total;
  document.getElementById('s2').textContent=done;
  document.getElementById('s3').textContent=ov.length;
  document.getElementById('s4').textContent=S.projects.length;
  document.getElementById('d-today').innerHTML=taskCards(tt.slice(0,5))||emptyH('📭','ไม่มีงานวันนี้');
  document.getElementById('d-projs').innerHTML=projCards(S.projects);
  animProg();
}

function renderTasks(){
  const q=(document.getElementById('srch-inp').value||'').toLowerCase();
  let t=S.tasks.filter(x=>String(x.is_routine).toUpperCase()!=='TRUE');
  if(q)t=t.filter(x=>String(x.title).toLowerCase().includes(q));
  if(S.filter!=='all')t=t.filter(x=>x.status===S.filter);
  document.getElementById('task-list').innerHTML=taskCards(t)||emptyH('📭','ไม่พบงาน');
}
function setF(btn,val){S.filter=val;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));btn.classList.add('on');renderTasks();}

function renderToday(){
  const tt=todayT();
  document.getElementById('today-list').innerHTML=taskCards(tt)||emptyH('📅','ไม่มีงานวันนี้');
}

function renderProjs(){document.getElementById('proj-list').innerHTML=projCards(S.projects,true);animProg();}

function taskCards(tasks){
  if(!tasks||!tasks.length)return '';
  return tasks.map(t=>{
    const duestr=t.due_date?toTH(t.due_date):'';
    const proj=t.project_id?pName(t.project_id):'';
    return`<div class="task ${t.status==='done'?'done':''}" onclick="editTask('${esc(t.id)}')">
      <button class="ck ${t.status==='done'?'on':''}" onclick="toggleDone(event,'${esc(t.id)}')"></button>
      <div class="tbody">
        <div class="ttitle ${t.status==='done'?'s':''}">${esc(t.title)}</div>
        <div class="tmeta">
          ${proj?`<span class="tag">${esc(proj)}</span>`:''}
          ${duestr?`<span class="tag ${String(t.due_date).slice(0,10)<today()?'due':''}">${duestr}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function projCards(projs,addNew=false){
  if(!projs.length&&!addNew)return emptyH('🗂️','ยังไม่มีโปรเจค');
  let h=projs.map(p=>{
    const pct=progOf(p.id);
    return`<div class="proj">
      <div class="pname">${esc(p.name)}</div>
      <div class="pdesc">${esc(p.description||'')}</div>
      <div class="prog"><div class="progf" data-w="${pct}"></div></div>
      <div class="pmeta">
        <span>${pct}% เสร็จ</span>
        <span>${S.tasks.filter(t=>t.project_id===p.id).length} งาน</span>
      </div>
    </div>`;
  }).join('');
  if(addNew)h+=`<div class="proj" style="border-style:dashed;opacity:.5" onclick="openModal('proj')"><div style="text-align:center;padding:20px 0">+ สร้างโปรเจคใหม่</div></div>`;
  return h;
}

function emptyH(ic,txt){return`<div class="empty"><div class="empty-ic">${ic}</div><div class="empty-txt">${txt}</div></div>`;}
function animProg(){setTimeout(()=>{document.querySelectorAll('.progf[data-w]').forEach(e=>{e.style.width=e.dataset.w+'%';});},60);}

async function toggleDone(e,id){
  e.stopPropagation();
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  const ns=t.status==='done'?'todo':'done';t.status=ns;refreshBadges();
  const pg=S.page;
  if(pg==='dash')renderDash();else if(pg==='tasks')renderTasks();else if(pg==='today')renderToday();
  const r=await apiCall('update',{action:'update',sheet:'Tasks',id,data:{status:ns}});
  if(!r)t.status=ns==='done'?'todo':'done';
  else toast(ns==='done'?'✓ เสร็จแล้ว':'○ เปิดอีกครั้ง');
}

function editTask(id){const t=S.tasks.find(x=>x.id===id);if(t)openModal('task',t);}

function openModal(type,task=null){
  if(type==='task'){
    const sel=document.getElementById('t-pr');
    sel.innerHTML='<option value="">— ไม่ระบุ —</option>'+S.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if(task){
      document.getElementById('modal-task-tit').textContent='แก้ไขงาน';
      document.getElementById('t-ti').value=task.title||'';
      document.getElementById('t-pr').value=task.project_id||'';
      document.getElementById('t-pi').value=task.priority||'medium';
      document.getElementById('t-du').value=String(task.due_date||'').slice(0,10);
      document.getElementById('t-st').value=task.status||'todo';
      document.getElementById('t-eid').value=task.id;
    }else{
      document.getElementById('modal-task-tit').textContent='เพิ่มงาน';
      ['t-ti','t-eid'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('t-pr').value='';
      document.getElementById('t-pi').value='medium';
      document.getElementById('t-du').value='';
      document.getElementById('t-st').value='todo';
    }
  }
  document.getElementById('ov-'+type).classList.add('on');
  document.getElementById('modal-'+type).classList.add('on');
}

function closeModal(type){
  document.getElementById('ov-'+type).classList.remove('on');
  document.getElementById('modal-'+type).classList.remove('on');
}

async function saveTask(){
  const title=document.getElementById('t-ti').value.trim();
  if(!title){toast('กรุณาใส่ชื่องาน');return;}
  const data={title,project_id:document.getElementById('t-pr').value,priority:document.getElementById('t-pi').value,due_date:document.getElementById('t-du').value,status:document.getElementById('t-st').value,is_routine:'FALSE',routine_freq:'',routine_days:'',description:'',time_start:'',duration_min:''};
  const eid=document.getElementById('t-eid').value;
  closeModal('task');
  if(eid){const r=await apiCall('update',{action:'update',sheet:'Tasks',id:eid,data});if(r){const i=S.tasks.findIndex(t=>t.id===eid);if(i>-1)Object.assign(S.tasks[i],data);toast('✓ อัปเดตแล้ว');}}
  else{const r=await apiCall('create',{action:'create',sheet:'Tasks',data});if(r){S.tasks.push(nr(r));toast('✓ เพิ่มงานแล้ว');}}
  refreshBadges();
  const pg=S.page;if(pg==='dash')renderDash();else if(pg==='tasks')renderTasks();else if(pg==='today')renderToday();
}

async function saveProj(){
  const name=document.getElementById('p-na').value.trim();if(!name){toast('กรุณาใส่ชื่อ');return;}
  const data={name,description:document.getElementById('p-de').value,emoji:'',color:'',deadline:document.getElementById('p-dl').value,members:'',status:'active'};
  closeModal('proj');
  const r=await apiCall('create',{action:'create',sheet:'Projects',data});
  if(r){S.projects.push(nr(r));toast('✓ สร้างแล้ว');}
  if(S.page==='proj')renderProjs();if(S.page==='dash')renderDash();
}

function saveSettings(){
  const url=document.getElementById('cfg-api').value.trim();if(!url){toast('กรุณากรอก URL');return;}
  S.api=url;localStorage.setItem('tf_api',url);
  const nm=document.getElementById('cfg-name').value.trim()||'User';
  const av=document.getElementById('cfg-av').value.trim()||'A';
  localStorage.setItem('tf_name',nm);localStorage.setItem('tf_av',av);
  toast('✓ บันทึกแล้ว — กำลังโหลด...');
  loadAll();go(document.querySelector('[data-p="dash"]'),'dash');
}

function clearAll(){
  if(!confirm('ล้างค่าทั้งหมด?'))return;
  localStorage.clear();S.api=API;S.tasks=[];S.projects=[];S.routines=[];
  document.getElementById('cfg-api').value=API;
  toast('✓ ล้างแล้ว');
}

function toast(msg){
  const w=document.getElementById('toasts');const el=document.createElement('div');
  el.className='toast';el.textContent=msg;w.prepend(el);
  setTimeout(()=>{el.style.transition='opacity .3s';el.style.opacity='0';setTimeout(()=>el.remove(),300);},2500);
}
