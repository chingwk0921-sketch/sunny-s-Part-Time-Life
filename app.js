// Sunny Studio Clock 1.0
// 若要啟用 Supabase：填入下方兩欄，並建立 clock_in_records 資料表。
const SUPABASE_URL = 'https://squfelhactoisdjigrjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdWZlbGhhY3RvaXNkamlncmptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3Mjg4MDEsImV4cCI6MjA5ODMwNDgwMX0.DTvMySP_5hC3bUzyi38WW9Fo68-wKfp2scPmFahyuYA';
const HOURLY_RATE = 200;
const STORAGE_KEY = 'sunny_studio_clock_records_v1';
const WORKING_KEY = 'sunny_studio_clock_working_v1';

let db = null;
let records = [];
let working = null;
let timer = null;
let pendingSettlement = null;

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('zh-TW')}`;
const pad = (n) => String(n).padStart(2, '0');
const toLocalInputValue = (iso) => {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit', hour12:false});
const fmtDate = (iso) => new Date(iso).toLocaleDateString('zh-TW', {month:'2-digit', day:'2-digit'}).replaceAll('/', ' / ');
const calcHours = (start, end) => Math.max(0.1, Math.round(((new Date(end) - new Date(start)) / 36e5) * 10) / 10);
const calcBase = (hours) => Math.round(hours * HOURLY_RATE);
const calcFinal = (r) => calcBase(r.hours) - (Number(r.lunch) || 0) + (Number(r.reimburse) || 0);

function init() {
  records = loadRecords();
  working = JSON.parse(localStorage.getItem(WORKING_KEY) || 'null');
  initCloud();
  bindEvents();
  tickClock();
  setInterval(tickClock, 1000);
  updateClockUI();
  renderAll();
}

function initCloud() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    $('cloud-status').classList.add('online');
    $('cloud-status').querySelector('b').textContent = 'Cloud';
  }
}

function bindEvents() {
  $('clock-button').addEventListener('click', toggleClock);
  $('save-settle-btn').addEventListener('click', saveSettlement);
  ['lunch-input','reimburse-input'].forEach(id => $(id).addEventListener('input', updateSettlementTotal));
  document.querySelectorAll('[data-close-sheet]').forEach(btn => btn.addEventListener('click', closeSettlementSheet));
  document.querySelectorAll('[data-close-edit]').forEach(btn => btn.addEventListener('click', closeEditSheet));
  $('save-edit-btn').addEventListener('click', saveEdit);
  $('add-manual-btn').addEventListener('click', addManualRecord);
  $('sync-now-btn').addEventListener('click', syncAllToCloud);
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.page)));
}

function tickClock() {
  const now = new Date();
  $('today-text').textContent = now.toLocaleDateString('zh-TW', {year:'numeric', month:'2-digit', day:'2-digit', weekday:'long'}).replaceAll('/', ' / ');
  $('now-time').textContent = now.toLocaleTimeString('zh-TW', {hour12:false});
  if (working) updateWorkingTimer();
}

function toggleClock() {
  if (!working) {
    working = { clockIn: new Date().toISOString() };
    localStorage.setItem(WORKING_KEY, JSON.stringify(working));
    updateClockUI();
    return;
  }
  const clockOut = new Date().toISOString();
  const hours = calcHours(working.clockIn, clockOut);
  pendingSettlement = { id: crypto.randomUUID(), clockIn: working.clockIn, clockOut, hours, lunch: 0, reimburse: 0, note: '', paid: false, paymentMethod: '', paymentDate: '' };
  localStorage.removeItem(WORKING_KEY);
  working = null;
  updateClockUI(true);
  openSettlementSheet();
}

function updateClockUI(done = false) {
  const btn = $('clock-button');
  const status = $('status-card');
  if (working) {
    btn.classList.add('working');
    status.className = 'status-card working';
    $('clock-main').textContent = 'WORKING';
    $('clock-sub').textContent = '工作中';
    $('status-text').textContent = `上班 ${fmtTime(working.clockIn)} 開始`;
    $('status-detail').textContent = '再按一次圓形按鈕即可下班結算。';
    updateWorkingTimer();
  } else {
    btn.classList.remove('working');
    status.className = done ? 'status-card done' : 'status-card';
    $('clock-main').textContent = 'CLOCK IN';
    $('clock-sub').textContent = '開始工作';
    $('clock-timer').textContent = '00:00:00';
    $('status-text').textContent = done ? '今日已完成一筆打卡' : '今日尚未打卡';
    $('status-detail').textContent = '時薪 $200，自動計算今日薪資。';
  }
}

function updateWorkingTimer() {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(working.clockIn).getTime()) / 1000));
  $('clock-timer').textContent = `${pad(Math.floor(sec/3600))}:${pad(Math.floor((sec%3600)/60))}:${pad(sec%60)}`;
}

function openSettlementSheet() {
  const r = pendingSettlement;
  $('settle-time').textContent = `${fmtTime(r.clockIn)} → ${fmtTime(r.clockOut)}`;
  $('settle-hours').textContent = `${r.hours}h`;
  $('settle-base').textContent = money(calcBase(r.hours));
  $('lunch-input').value = '';
  $('reimburse-input').value = '';
  $('note-input').value = '';
  updateSettlementTotal();
  $('settle-sheet').classList.remove('hidden');
}
function closeSettlementSheet(){ $('settle-sheet').classList.add('hidden'); pendingSettlement = null; }
function updateSettlementTotal(){
  if (!pendingSettlement) return;
  const lunch = Number($('lunch-input').value) || 0;
  const reimburse = Number($('reimburse-input').value) || 0;
  $('final-pay').textContent = money(calcBase(pendingSettlement.hours) - lunch + reimburse);
}
function saveSettlement() {
  if (!pendingSettlement) return;
  pendingSettlement.lunch = Number($('lunch-input').value) || 0;
  pendingSettlement.reimburse = Number($('reimburse-input').value) || 0;
  pendingSettlement.note = $('note-input').value.trim();
  pendingSettlement.finalPay = calcFinal(pendingSettlement);
  records.unshift(pendingSettlement);
  saveRecords();
  closeSettlementSheet();
  renderAll();
  switchPage('records');
  syncRecordToCloud(pendingSettlement);
}

function renderAll(){ renderRecords(); renderStats(); }
function renderRecords() {
  const list = $('record-list');
  if (!records.length) { list.innerHTML = `<p class="empty">目前還沒有打卡紀錄</p>`; }
  else list.innerHTML = records.map(recordTemplate).join('');
  const unpaid = records.filter(r=>!r.paid).reduce((s,r)=>s+calcFinal(r),0);
  $('pending-total').textContent = money(unpaid);
  list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openEdit(btn.dataset.edit)));
  list.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteRecord(btn.dataset.delete)));
  list.querySelectorAll('[data-pay]').forEach(btn => btn.addEventListener('click', () => togglePaid(btn.dataset.pay)));
}
function recordTemplate(r) {
  const final = calcFinal(r);
  return `<article class="record-card">
    <div class="record-top"><span class="record-date">${fmtDate(r.clockIn)}</span><span class="pay-badge ${r.paid?'paid':''}">${r.paid?'已發薪':'待發薪'}</span></div>
    <div class="time-line"><div><small>上班</small><strong>${fmtTime(r.clockIn)}</strong></div><span class="arrow">→</span><div><small>下班</small><strong>${fmtTime(r.clockOut)}</strong></div></div>
    <div class="record-money"><span>${r.hours}h × $${HOURLY_RATE}</span><strong>${money(final)}</strong></div>
    ${r.note ? `<p class="record-note">${escapeHtml(r.note)}</p>` : ''}
    <div class="record-actions">
      <button class="icon-btn" data-edit="${r.id}" type="button">編輯</button>
      <button class="icon-btn danger" data-delete="${r.id}" type="button">刪除</button>
      <button class="icon-btn pay" data-pay="${r.id}" type="button">${r.paid?'取消發薪':'確認發薪'}</button>
    </div>
  </article>`;
}

function openEdit(id) {
  const r = records.find(x => x.id === id); if (!r) return;
  $('edit-id').value = r.id;
  $('edit-in').value = toLocalInputValue(r.clockIn);
  $('edit-out').value = toLocalInputValue(r.clockOut);
  $('edit-lunch').value = r.lunch || '';
  $('edit-reimburse').value = r.reimburse || '';
  $('edit-note').value = r.note || '';
  $('edit-sheet').classList.remove('hidden');
}
function closeEditSheet(){ $('edit-sheet').classList.add('hidden'); }
function saveEdit() {
  const id = $('edit-id').value;
  const r = records.find(x => x.id === id); if (!r) return;
  const clockIn = new Date($('edit-in').value).toISOString();
  const clockOut = new Date($('edit-out').value).toISOString();
  if (new Date(clockOut) <= new Date(clockIn)) { alert('下班時間要晚於上班時間喔'); return; }
  r.clockIn = clockIn; r.clockOut = clockOut; r.hours = calcHours(clockIn, clockOut);
  r.lunch = Number($('edit-lunch').value) || 0;
  r.reimburse = Number($('edit-reimburse').value) || 0;
  r.note = $('edit-note').value.trim(); r.finalPay = calcFinal(r);
  saveRecords(); closeEditSheet(); renderAll(); syncRecordToCloud(r);
}
function deleteRecord(id) { if (!confirm('確定要刪除這筆紀錄嗎？')) return; records = records.filter(r=>r.id!==id); saveRecords(); renderAll(); }
function togglePaid(id) {
  const r = records.find(x=>x.id===id); if (!r) return;
  r.paid = !r.paid;
  r.paymentDate = r.paid ? new Date().toISOString() : '';
  saveRecords(); renderAll(); syncRecordToCloud(r);
}
function addManualRecord() {
  const now = new Date(); const end = now.toISOString(); const start = new Date(now.getTime()-4*36e5).toISOString();
  const r = {id:crypto.randomUUID(), clockIn:start, clockOut:end, hours:4, lunch:0, reimburse:0, note:'手動新增', paid:false, paymentMethod:'', paymentDate:''};
  records.unshift(r); saveRecords(); renderAll(); openEdit(r.id);
}

function renderStats() {
  const now = new Date();
  const monthRecords = records.filter(r => { const d = new Date(r.clockIn); return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth(); });
  const hours = Math.round(monthRecords.reduce((s,r)=>s+r.hours,0)*10)/10;
  const total = monthRecords.reduce((s,r)=>s+calcFinal(r),0);
  const paid = monthRecords.filter(r=>r.paid).reduce((s,r)=>s+calcFinal(r),0);
  $('stat-hours').textContent = `${hours}h`;
  $('stat-total').textContent = money(total);
  $('stat-paid').textContent = money(paid);
  $('stat-unpaid').textContent = money(total-paid);
  $('stat-count').textContent = monthRecords.length;
}

function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
  $(`page-${page}`).classList.add('page-active');
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));
  $('page-title').textContent = page === 'clock' ? '用心工作・好好生活' : page === 'records' ? '紀錄每一份努力' : '清楚掌握月結';
}

function loadRecords(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function escapeHtml(str){ return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function syncRecordToCloud(r) {
  if (!db) return;
  try {
    await db.from('clock_in_records').upsert({
      id: r.id, clock_in: r.clockIn, clock_out: r.clockOut, hours: r.hours, hourly_rate: HOURLY_RATE,
      salary: calcBase(r.hours), lunch: r.lunch || 0, reimburse: r.reimburse || 0, note: r.note || '',
      final_pay: calcFinal(r), payment_status: r.paid ? 'paid' : 'unpaid', payment_date: r.paymentDate || null, updated_at: new Date().toISOString()
    });
  } catch(e) { console.warn('雲端同步失敗：', e); }
}
async function syncAllToCloud(){
  if (!db) { alert('目前還沒填 Supabase 設定，所以會先使用本機紀錄。'); return; }
  for (const r of records) await syncRecordToCloud(r);
  alert('同步完成');
}

init();
