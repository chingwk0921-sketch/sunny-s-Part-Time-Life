const HOURLY_RATE = 200;
const $ = (id) => document.getElementById(id);

const dateText = $('dateText');
const clockText = $('clockText');
const clockBtn = $('clockBtn');
const clockMainText = $('clockMainText');
const clockSubText = $('clockSubText');
const workTimer = $('workTimer');
const todayState = $('todayState');
const statusText = $('statusText');
const shade = $('shade');
const sheet = $('settlementSheet');

let isWorking = false;
let clockInTime = null;
let clockOutTime = null;
let timer = null;
let latestSummary = null;

function pad(n){ return String(n).padStart(2,'0'); }
function timeOnly(date){ return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatTimer(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = pad(Math.floor(total / 3600));
  const m = pad(Math.floor((total % 3600) / 60));
  const s = pad(total % 60);
  return `${h}:${m}:${s}`;
}
function roundedHours(start, end){
  const raw = (end - start) / 36e5;
  return Math.max(0.1, Math.round(raw * 10) / 10);
}

function updateClock(){
  const now = new Date();
  const week = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][now.getDay()];
  dateText.textContent = `${now.getFullYear()} / ${pad(now.getMonth()+1)} / ${pad(now.getDate())}　${week}`;
  clockText.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

function startWork(){
  isWorking = true;
  clockInTime = new Date();
  clockBtn.classList.add('working');
  clockMainText.textContent = 'WORKING';
  clockSubText.textContent = '工作中';
  statusText.textContent = 'Working';
  todayState.textContent = `✦ ${timeOnly(clockInTime)} 已開始工作`;
  timer = setInterval(() => {
    workTimer.textContent = formatTimer(new Date() - clockInTime);
  }, 1000);
}

function finishWork(){
  isWorking = false;
  clockOutTime = new Date();
  clearInterval(timer);
  const hours = roundedHours(clockInTime, clockOutTime);
  const basePay = Math.round(hours * HOURLY_RATE);
  latestSummary = { clockInTime, clockOutTime, hours, basePay };

  $('periodText').textContent = `${timeOnly(clockInTime)} – ${timeOnly(clockOutTime)}`;
  $('hoursText').textContent = `${hours} 小時`;
  $('formulaHours').textContent = `${hours} 小時`;
  $('basePayText').textContent = `$ ${basePay}`;
  $('lunchInput').value = '';
  $('reimburseInput').value = '';
  $('noteInput').value = '';
  calculatePay();

  clockBtn.classList.remove('working');
  clockMainText.textContent = 'CLOCK IN';
  clockSubText.textContent = '再次開始';
  workTimer.textContent = '00:00:00';
  statusText.textContent = 'Ready';
  todayState.textContent = `✦ 今日已完成 ${hours} 小時`;
  openSheet();
}

function openSheet(){
  shade.classList.add('show');
  sheet.classList.add('show');
  sheet.setAttribute('aria-hidden','false');
}
function closeSheet(){
  shade.classList.remove('show');
  sheet.classList.remove('show');
  sheet.setAttribute('aria-hidden','true');
}

function calculatePay(){
  if(!latestSummary) return;
  const lunch = parseInt($('lunchInput').value, 10) || 0;
  const reimburse = parseInt($('reimburseInput').value, 10) || 0;
  const finalPay = latestSummary.basePay - lunch + reimburse;
  $('finalPayText').textContent = `$ ${finalPay}`;
}

function getRecords(){
  try { return JSON.parse(localStorage.getItem('sunnyClockRecords') || '[]'); }
  catch { return []; }
}
function setRecords(records){ localStorage.setItem('sunnyClockRecords', JSON.stringify(records)); }

function saveRecord(){
  if(!latestSummary) return;
  const lunch = parseInt($('lunchInput').value, 10) || 0;
  const reimburse = parseInt($('reimburseInput').value, 10) || 0;
  const finalPay = latestSummary.basePay - lunch + reimburse;
  const record = {
    id: Date.now(),
    date: new Date().toLocaleDateString('zh-TW'),
    clockIn: latestSummary.clockInTime.toISOString(),
    clockOut: latestSummary.clockOutTime.toISOString(),
    hours: latestSummary.hours,
    basePay: latestSummary.basePay,
    lunch,
    reimburse,
    note: $('noteInput').value.trim(),
    finalPay
  };
  const records = [record, ...getRecords()].slice(0, 30);
  setRecords(records);
  closeSheet();
  alert('已儲存今日打卡紀錄');
}

function renderRecords(){
  const list = $('recordList');
  const records = getRecords();
  if(!records.length){
    list.innerHTML = '<div class="empty">目前還沒有紀錄</div>';
    return;
  }
  list.innerHTML = records.map(r => {
    const start = timeOnly(new Date(r.clockIn));
    const end = timeOnly(new Date(r.clockOut));
    const note = r.note ? `｜${r.note}` : '';
    return `<div class="record-item"><b><span>${r.date}</span><span>$ ${r.finalPay}</span></b><p>${start} – ${end}｜${r.hours} 小時｜午餐 -${r.lunch}｜代墊 +${r.reimburse}${note}</p></div>`;
  }).join('');
}

clockBtn.addEventListener('click', () => isWorking ? finishWork() : startWork());
$('lunchInput').addEventListener('input', calculatePay);
$('reimburseInput').addEventListener('input', calculatePay);
$('saveBtn').addEventListener('click', saveRecord);
shade.addEventListener('click', closeSheet);
$('recordsBtn').addEventListener('click', () => { renderRecords(); $('recordsPanel').classList.add('show'); });
$('closeRecordsBtn').addEventListener('click', () => $('recordsPanel').classList.remove('show'));
$('resetBtn').addEventListener('click', () => {
  if(isWorking && confirm('確定要取消這次打卡嗎？')){
    clearInterval(timer);
    isWorking = false;
    clockBtn.classList.remove('working');
    clockMainText.textContent = 'CLOCK IN';
    clockSubText.textContent = '開始工作';
    workTimer.textContent = '00:00:00';
    statusText.textContent = 'Ready';
    todayState.textContent = '✦ 今日尚未打卡';
  }
});
