const HOURLY_RATE = 200;
const STORAGE_KEY = 'sunny_clockin_records_v3';

const $ = (id) => document.getElementById(id);
const state = { working:false, start:null, end:null, timer:null, elapsed:0, basePay:0, finalPay:0 };

const weekNames = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
function pad(n){ return String(n).padStart(2,'0'); }
function timeText(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fullTimeText(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function dateText(d){ return `${d.getFullYear()} / ${pad(d.getMonth()+1)} / ${pad(d.getDate())}　${weekNames[d.getDay()]}`; }
function money(n){ return `$ ${Math.round(n).toLocaleString('zh-TW')}`; }

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
  const lunch = Number($('lunchInput').value || 0);
  const reimburse = Number($('reimburseInput').value || 0);
  state.finalPay = Math.max(0, state.basePay - lunch + reimburse);
  $('finalPayText').textContent = money(state.finalPay);
}

function openSheet(){ $('overlay').classList.add('show'); $('settlementSheet').classList.add('show'); $('settlementSheet').setAttribute('aria-hidden','false'); }
function closeAll(){
  $('overlay').classList.remove('show');
  $('settlementSheet').classList.remove('show');
  $('recordsPanel').classList.remove('show');
  $('settingsPanel').classList.remove('show');
}
function openPanel(id){ closeAll(); $('overlay').classList.add('show'); $(id).classList.add('show'); renderRecords(); }

function getRecords(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function setRecords(records){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function saveRecord(){
  const records = getRecords();
  const lunch = Number($('lunchInput').value || 0);
  const reimburse = Number($('reimburseInput').value || 0);
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
    finalPay: state.finalPay
  });
  setRecords(records.slice(0, 60));
  closeAll();
  $('todayNote').textContent = '✦ 已儲存今日紀錄';
}
function renderRecords(){
  const list = $('recordsList');
  const records = getRecords();
  if(!records.length){ list.innerHTML = '<p class="setting-text">目前還沒有打卡紀錄。</p>'; return; }
  list.innerHTML = records.map(r => `
    <article class="record-item">
      <b>${r.date}</b>
      <div>${r.start} – ${r.end}｜${r.hours} 小時｜${money(r.finalPay)}</div>
      ${r.note ? `<small>${r.note}</small>` : ''}
    </article>
  `).join('');
}

$('clockButton').addEventListener('click', () => state.working ? endWork() : startWork());
$('lunchInput').addEventListener('input', calculatePay);
$('reimburseInput').addEventListener('input', calculatePay);
$('saveBtn').addEventListener('click', saveRecord);
$('overlay').addEventListener('click', closeAll);
$('recordsBtn').addEventListener('click', () => openPanel('recordsPanel'));
$('settingsBtn').addEventListener('click', () => openPanel('settingsPanel'));
document.querySelectorAll('[data-close-panel]').forEach(btn => btn.addEventListener('click', closeAll));

updateClock();
setInterval(updateClock, 1000);
renderRecords();
