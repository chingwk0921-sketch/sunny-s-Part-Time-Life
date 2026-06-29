const HOURLY_RATE = 200;

// === Supabase 雲端同步設定 ===
// 建好 Supabase Table 後，把下面兩行換成妳自己的專案資料。
// 不填也可以正常使用，資料會先存在本機。
const SUPABASE_URL = 'https://squfelhactoisdjigrjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdWZlbGhhY3RvaXNkamlncmptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3Mjg4MDEsImV4cCI6MjA5ODMwNDgwMX0.DTvMySP_5hC3bUzyi38WW9Fo68-wKfp2scPmFahyuYA';
const SUPABASE_TABLE = 'clock_in_records';
let supabaseClient = null;
const STORAGE_KEY = 'sunny_clockin_records_v3';
const TEACHER_PASSWORD_KEY = 'sunny_clockin_teacher_password_v1';

const $ = (id) => document.getElementById(id);
const state = { working:false, start:null, end:null, timer:null, elapsed:0, basePay:0, finalPay:0, editingId:null };

const weekNames = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
function pad(n){ return String(n).padStart(2,'0'); }
function timeText(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fullTimeText(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function dateText(d){ return `${d.getFullYear()} / ${pad(d.getMonth()+1)} / ${pad(d.getDate())}　${weekNames[d.getDay()]}`; }
function money(n){ return `$ ${Math.round(Number(n) || 0).toLocaleString('zh-TW')}`; }
function numberValue(id){ return Number($(id).value || 0); }

function updateClock(){
  const now = new Date();
  $('dateText').textContent = dateText(now);
  $('clockText').textContent = fullTimeText(now);
}

function updateWorkTimer(){
  const seconds = Math.max(0, Math.floor((Date.now() - state.start.getTime()) / 1000));
  state.elapsed = seconds;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  $('workTimer').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function startWork(){
  state.working = true;
  state.start = new Date();
  $('clockButton').classList.add('working');
  $('buttonEn').textContent = 'WORKING';
  $('buttonZh').textContent = '結束工作';
  $('statusText').textContent = 'Working';
  $('todayNote').textContent = '✦ 工作中，記得好好呼吸';
  updateWorkTimer();
  state.timer = setInterval(updateWorkTimer, 1000);
}

function endWork(){
  state.working = false;
  state.end = new Date();
  clearInterval(state.timer);

  const rawHours = (state.end - state.start) / 3600000;
  const hours = Math.max(0.1, Math.round(rawHours * 10) / 10);
  state.basePay = Math.round(hours * HOURLY_RATE);
  state.finalPay = state.basePay;

  $('periodText').textContent = `${timeText(state.start)} – ${timeText(state.end)}`;
  $('hoursText').textContent = hours.toFixed(1);
  $('formulaHours').textContent = hours.toFixed(1);
  $('basePayText').textContent = money(state.basePay);
  $('lunchInput').value = '';
  $('reimburseInput').value = '';
  $('noteInput').value = '';
  $('dailyNoteInput').value = '';
  calculatePay();
  openSheet();

  $('clockButton').classList.remove('working');
  $('buttonEn').textContent = 'CLOCK IN';
  $('buttonZh').textContent = '再次開始';
  $('workTimer').textContent = '00:00:00';
  $('statusText').textContent = 'Ready';
  $('todayNote').textContent = '✦ 今日已完成一段工作';
}

function calculatePay(){
  const lunch = numberValue('lunchInput');
  const reimburse = numberValue('reimburseInput');
  state.finalPay = Math.max(0, state.basePay - lunch + reimburse);
  $('finalPayText').textContent = money(state.finalPay);
}

function openSheet(){ $('overlay').classList.add('show'); $('settlementSheet').classList.add('show'); $('settlementSheet').setAttribute('aria-hidden','false'); }
function closeAll(){
  $('overlay').classList.remove('show');
  $('settlementSheet').classList.remove('show');
  $('recordsPanel').classList.remove('show');
  $('settingsPanel').classList.remove('show');
  $('editPanel').classList.remove('show');
}
function openPanel(id){
  closeAll();
  $('overlay').classList.add('show');
  $(id).classList.add('show');
  if(id === 'recordsPanel') renderRecords();
  if(id === 'settingsPanel') updatePasswordStatus();
}

function getRecords(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function setRecords(records){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); renderMonthSummary(); }
function getTeacherPassword(){ return localStorage.getItem(TEACHER_PASSWORD_KEY) || ''; }
function setTeacherPassword(password){ localStorage.setItem(TEACHER_PASSWORD_KEY, password); updatePasswordStatus(); }
function clearTeacherPassword(){ localStorage.removeItem(TEACHER_PASSWORD_KEY); updatePasswordStatus(); }
function updatePasswordStatus(){
  const el = $('passwordStatusText');
  if(!el) return;
  el.textContent = getTeacherPassword() ? '已設定密碼，發薪確認需輸入密碼。' : '尚未設定密碼';
}


function cloudEnabled(){
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
}
function initCloud(){
  if(!cloudEnabled()){
    const cloudStatus = $('cloudStatusText');
    if(cloudStatus) cloudStatus.textContent = '尚未連接雲端。若要同步給老師，請在 app.js 填入 Supabase URL 與 anon key。';
    return;
  }
  try{
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    $('statusText').textContent = 'Online';
    const syncNote = $('syncNote');
    if(syncNote) syncNote.textContent = '♧ 打卡紀錄將保存於本機，並同步至雲端';
    const cloudStatus = $('cloudStatusText');
    if(cloudStatus) cloudStatus.textContent = '已連接 Supabase，老師打開同一個網址即可查看同步紀錄。';
    loadFromCloud();
  }catch(error){
    console.error('Supabase 初始化失敗', error);
  }
}
function recordToCloudRow(record){
  return {
    id: String(record.id),
    work_date: record.date,
    start_time: record.start,
    end_time: record.end,
    hours: Number(record.hours || 0),
    hourly_rate: HOURLY_RATE,
    base_pay: Number(record.basePay || 0),
    lunch_deduction: Number(record.lunch || 0),
    reimbursement: Number(record.reimburse || 0),
    note: record.note || '',
    final_pay: Number(record.finalPay || 0),
    paid: Boolean(record.paid),
    paid_at: record.paidAt || '',
    paid_note: record.paidNote || '',
    updated_at: new Date().toISOString()
  };
}
function cloudRowToRecord(row){
  return {
    id: row.id,
    date: row.work_date || '',
    start: row.start_time || '',
    end: row.end_time || '',
    hours: String(row.hours || '0.0'),
    basePay: Number(row.base_pay || 0),
    lunch: Number(row.lunch_deduction || 0),
    reimburse: Number(row.reimbursement || 0),
    note: row.note || '',
    finalPay: Number(row.final_pay || 0),
    paid: Boolean(row.paid),
    paidAt: row.paid_at || '',
    paidNote: row.paid_note || ''
  };
}
async function syncOneRecord(record){
  if(!supabaseClient) return;
  const { error } = await supabaseClient.from(SUPABASE_TABLE).upsert(recordToCloudRow(record), { onConflict:'id' });
  if(error) throw error;
}
async function deleteCloudRecord(id){
  if(!supabaseClient) return;
  const { error } = await supabaseClient.from(SUPABASE_TABLE).delete().eq('id', String(id));
  if(error) throw error;
}
async function syncAllToCloud(){
  if(!supabaseClient){ alert('尚未連接雲端，請先在 app.js 填入 Supabase 設定。'); return; }
  try{
    const records = getRecords();
    if(records.length){
      const { error } = await supabaseClient.from(SUPABASE_TABLE).upsert(records.map(recordToCloudRow), { onConflict:'id' });
      if(error) throw error;
    }
    await loadFromCloud(false);
    alert('同步完成。');
  }catch(error){
    console.error('同步失敗', error);
    alert('同步失敗，請檢查 Supabase Table 欄位或網路。');
  }
}
async function loadFromCloud(silent=true){
  if(!supabaseClient) return;
  try{
    const { data, error } = await supabaseClient.from(SUPABASE_TABLE).select('*').order('id', { ascending:false });
    if(error) throw error;
    if(Array.isArray(data)){
      setRecords(data.map(cloudRowToRecord));
      renderRecords();
    }
  }catch(error){
    console.error('讀取雲端失敗', error);
    if(!silent) alert('讀取雲端失敗。');
  }
}
function renderMonthSummary(){
  const box = $('monthSummary');
  if(!box) return;
  const records = getRecords();
  const now = new Date();
  const key = `${now.getFullYear()} / ${pad(now.getMonth()+1)}`;
  const monthRecords = records.filter(r => (r.date || '').startsWith(key));
  const hours = monthRecords.reduce((sum,r)=>sum + Number(r.hours || 0),0);
  const total = monthRecords.reduce((sum,r)=>sum + Number(r.finalPay || 0),0);
  const paid = monthRecords.filter(r=>r.paid).reduce((sum,r)=>sum + Number(r.finalPay || 0),0);
  const unpaid = total - paid;
  box.innerHTML = `
    <div><small>本月工時</small><b>${hours.toFixed(1)} h</b></div>
    <div><small>本月薪資</small><b>${money(total)}</b></div>
    <div><small>已核實</small><b>${money(paid)}</b></div>
    <div><small>待核實</small><b>${money(unpaid)}</b></div>
  `;
}

function saveRecord(){
  const records = getRecords();
  const lunch = numberValue('lunchInput');
  const reimburse = numberValue('reimburseInput');
  const note = [$('noteInput').value.trim(), $('dailyNoteInput').value.trim()].filter(Boolean).join('｜');
  records.unshift({
    id: Date.now(),
    date: dateText(state.start),
    start: timeText(state.start),
    end: timeText(state.end),
    hours: $('hoursText').textContent,
    basePay: state.basePay,
    lunch,
    reimburse,
    note,
    finalPay: state.finalPay,
    paid: false,
    paidAt: '',
    paidNote: ''
  });
  setRecords(records.slice(0, 60));
  syncOneRecord(records[0]).catch(error => console.error('雲端同步失敗', error));
  closeAll();
  $('todayNote').textContent = '✦ 已儲存今日紀錄';
  renderRecords();
}

function renderRecords(){
  const list = $('recordsList');
  const records = getRecords();
  if(!records.length){ list.innerHTML = '<p class="setting-text">目前還沒有打卡紀錄。</p>'; return; }
  const unpaidTotal = records.filter(r => !r.paid).reduce((sum, r) => sum + Number(r.finalPay || 0), 0);
  list.innerHTML = `
    <div class="unpaid-summary">
      <span>尚未核實發薪</span>
      <strong>${money(unpaidTotal)}</strong>
    </div>
  ` + records.map(r => `
    <article class="record-item ${r.paid ? 'paid' : ''}">
      <div class="record-main">
        <div class="record-title-line">
          <b>${r.date}</b>
          <span class="paid-badge ${r.paid ? 'ok' : ''}">${r.paid ? '已發薪' : '未發薪'}</span>
        </div>
        <div>${r.start} – ${r.end}｜${r.hours} 小時｜${money(r.finalPay)}</div>
        ${r.note ? `<small>${r.note}</small>` : ''}
        ${r.paid ? `<small class="paid-note">核實時間：${r.paidAt || '已核實'}${r.paidNote ? `｜${r.paidNote}` : ''}</small>` : ''}
      </div>
      <div class="record-actions">
        <button type="button" data-edit-record="${r.id}">編輯</button>
        <button type="button" class="pay" data-paid-record="${r.id}">${r.paid ? '取消發薪' : '核實發薪'}</button>
        <button type="button" class="danger" data-delete-record="${r.id}">刪除</button>
      </div>
    </article>
  `).join('');
}

function findRecord(id){ return getRecords().find(r => String(r.id) === String(id)); }
function calculateEditPay(){
  const hours = Math.max(0, numberValue('editHours'));
  const basePay = Math.round(hours * HOURLY_RATE);
  const lunch = numberValue('editLunch');
  const reimburse = numberValue('editReimburse');
  $('editFinalPay').textContent = money(Math.max(0, basePay - lunch + reimburse));
}
function openEditRecord(id){
  const record = findRecord(id);
  if(!record) return;
  state.editingId = record.id;
  $('editId').value = record.id;
  $('editDate').value = record.date || '';
  $('editStart').value = record.start || '';
  $('editEnd').value = record.end || '';
  $('editHours').value = record.hours || '0.0';
  $('editLunch').value = record.lunch || '';
  $('editReimburse').value = record.reimburse || '';
  $('editNote').value = record.note || '';
  calculateEditPay();
  openPanel('editPanel');
}
function updateRecord(){
  const id = $('editId').value;
  const records = getRecords();
  const index = records.findIndex(r => String(r.id) === String(id));
  if(index === -1) return;
  const hours = Math.max(0, numberValue('editHours'));
  const basePay = Math.round(hours * HOURLY_RATE);
  const lunch = numberValue('editLunch');
  const reimburse = numberValue('editReimburse');
  records[index] = {
    ...records[index],
    date: $('editDate').value.trim() || records[index].date,
    start: $('editStart').value || records[index].start,
    end: $('editEnd').value || records[index].end,
    hours: hours.toFixed(1),
    basePay,
    lunch,
    reimburse,
    note: $('editNote').value.trim(),
    finalPay: Math.max(0, basePay - lunch + reimburse)
  };
  setRecords(records);
  syncOneRecord(records[index]).catch(error => console.error('雲端同步失敗', error));
  closeAll();
  openPanel('recordsPanel');
}
function deleteRecord(id = $('editId').value){
  const record = findRecord(id);
  if(!record) return;
  const ok = confirm(`確定要刪除這筆紀錄嗎？\n${record.date} ${record.start} – ${record.end}`);
  if(!ok) return;
  setRecords(getRecords().filter(r => String(r.id) !== String(id)));
  deleteCloudRecord(id).catch(error => console.error('雲端刪除失敗', error));
  closeAll();
  openPanel('recordsPanel');
}

function verifyTeacherPassword(){
  const saved = getTeacherPassword();
  if(!saved){
    alert('尚未設定老師密碼，請先到「設定」建立密碼。');
    openPanel('settingsPanel');
    return false;
  }
  const input = prompt('請輸入老師密碼');
  if(input === null) return false;
  if(input !== saved){
    alert('密碼不正確，無法核實發薪。');
    return false;
  }
  return true;
}
function togglePaidRecord(id){
  const records = getRecords();
  const index = records.findIndex(r => String(r.id) === String(id));
  if(index === -1) return;
  if(!verifyTeacherPassword()) return;
  const record = records[index];
  if(record.paid){
    const ok = confirm('確定要取消這筆「已發薪」核實嗎？');
    if(!ok) return;
    records[index] = { ...record, paid:false, paidAt:'', paidNote:'' };
  } else {
    const note = prompt('發薪備註（可空白，例如：現領 / 匯款 / 累積結清）') || '';
    const now = new Date();
    records[index] = {
      ...record,
      paid:true,
      paidAt:`${dateText(now)} ${fullTimeText(now)}`,
      paidNote:note.trim()
    };
  }
  setRecords(records);
  syncOneRecord(records[index]).catch(error => console.error('雲端同步失敗', error));
  renderRecords();
}
function saveTeacherPasswordFromSettings(){
  const password = $('teacherPasswordInput').value.trim();
  const confirmPassword = $('teacherPasswordConfirm').value.trim();
  if(password.length < 4){ alert('密碼至少 4 碼，會比較不容易誤按。'); return; }
  if(password !== confirmPassword){ alert('兩次輸入的密碼不一樣。'); return; }
  setTeacherPassword(password);
  $('teacherPasswordInput').value = '';
  $('teacherPasswordConfirm').value = '';
  alert('已儲存老師密碼。');
}
function clearTeacherPasswordFromSettings(){
  const ok = confirm('確定要清除老師密碼嗎？清除後將無法核實發薪，需重新設定。');
  if(!ok) return;
  clearTeacherPassword();
  $('teacherPasswordInput').value = '';
  $('teacherPasswordConfirm').value = '';
}

$('clockButton').addEventListener('click', () => state.working ? endWork() : startWork());
$('lunchInput').addEventListener('input', calculatePay);
$('reimburseInput').addEventListener('input', calculatePay);
$('saveBtn').addEventListener('click', saveRecord);
$('overlay').addEventListener('click', closeAll);
$('recordsBtn').addEventListener('click', () => openPanel('recordsPanel'));
$('settingsBtn').addEventListener('click', () => openPanel('settingsPanel'));
$('recordsList').addEventListener('click', (event) => {
  const editBtn = event.target.closest('[data-edit-record]');
  const deleteBtn = event.target.closest('[data-delete-record]');
  const paidBtn = event.target.closest('[data-paid-record]');
  if(editBtn) openEditRecord(editBtn.dataset.editRecord);
  if(paidBtn) togglePaidRecord(paidBtn.dataset.paidRecord);
  if(deleteBtn) deleteRecord(deleteBtn.dataset.deleteRecord);
});
['editHours','editLunch','editReimburse'].forEach(id => $(id).addEventListener('input', calculateEditPay));
$('updateRecordBtn').addEventListener('click', updateRecord);
$('deleteRecordBtn').addEventListener('click', () => deleteRecord());
$('saveTeacherPasswordBtn').addEventListener('click', saveTeacherPasswordFromSettings);
$('clearTeacherPasswordBtn').addEventListener('click', clearTeacherPasswordFromSettings);
$('manualSyncBtn').addEventListener('click', syncAllToCloud);
document.querySelectorAll('[data-close-panel]').forEach(btn => btn.addEventListener('click', closeAll));

updateClock();
setInterval(updateClock, 1000);
updatePasswordStatus();
renderMonthSummary();
renderRecords();
initCloud();
