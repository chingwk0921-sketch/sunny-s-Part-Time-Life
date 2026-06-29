const HOURLY_RATE = 200;
const STORAGE_KEY = 'sunny-clockin-records-v1';

const els = {
  todayText: document.getElementById('todayText'),
  clockText: document.getElementById('clockText'),
  clockButton: document.getElementById('clockButton'),
  clockEn: document.getElementById('clockEn'),
  clockZh: document.getElementById('clockZh'),
  workTimer: document.getElementById('workTimer'),
  hintText: document.getElementById('hintText'),
  settlementPanel: document.getElementById('settlementPanel'),
  totalHours: document.getElementById('totalHours'),
  basePay: document.getElementById('basePay'),
  finalPay: document.getElementById('finalPay'),
  lunchInput: document.getElementById('lunchInput'),
  reimburseInput: document.getElementById('reimburseInput'),
  noteInput: document.getElementById('noteInput'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  statusText: document.getElementById('statusText')
};

let isWorking = false;
let clockInTime = null;
let clockOutTime = null;
let timerId = null;
let liveSeconds = 0;
let settlement = { hours: 0, basePay: 0, finalPay: 0 };

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const week = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][date.getDay()];
  return `${y} / ${m} / ${d}　${week}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('zh-TW', { hour12: false });
}

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateNow() {
  const now = new Date();
  els.todayText.textContent = formatDate(now);
  els.clockText.textContent = formatTime(now);
}

function startWork() {
  isWorking = true;
  clockInTime = new Date();
  clockOutTime = null;
  liveSeconds = 0;

  els.clockButton.classList.add('working');
  els.clockEn.textContent = 'WORKING';
  els.clockZh.textContent = '工作進行中';
  els.workTimer.classList.remove('hidden');
  els.hintText.textContent = `✦ 上班時間 ${formatTime(clockInTime)}`;
  els.settlementPanel.classList.remove('open');
  els.settlementPanel.setAttribute('aria-hidden', 'true');

  timerId = setInterval(() => {
    liveSeconds = Math.floor((new Date() - clockInTime) / 1000);
    els.workTimer.textContent = formatDuration(liveSeconds);
  }, 1000);
}

function stopWork() {
  isWorking = false;
  clockOutTime = new Date();
  clearInterval(timerId);

  els.clockButton.classList.remove('working');
  els.clockEn.textContent = 'CLOCK IN';
  els.clockZh.textContent = '再次開始';
  els.workTimer.classList.add('hidden');
  els.hintText.textContent = `✦ 下班時間 ${formatTime(clockOutTime)}`;

  const rawHours = (clockOutTime - clockInTime) / 1000 / 60 / 60;
  const hours = Math.max(0.1, Math.round(rawHours * 10) / 10);
  const basePay = Math.round(hours * HOURLY_RATE);

  settlement.hours = hours;
  settlement.basePay = basePay;

  els.totalHours.textContent = `${hours.toFixed(1)} 小時`;
  els.basePay.textContent = `$ ${basePay}`;
  calculateFinalPay();

  els.settlementPanel.classList.add('open');
  els.settlementPanel.setAttribute('aria-hidden', 'false');
}

function calculateFinalPay() {
  const lunch = Number(els.lunchInput.value) || 0;
  const reimburse = Number(els.reimburseInput.value) || 0;
  settlement.finalPay = settlement.basePay - lunch + reimburse;
  els.finalPay.textContent = `$ ${settlement.finalPay}`;
}

function saveRecord() {
  if (!clockInTime || !clockOutTime) {
    alert('請先完成一次打卡喔。');
    return;
  }

  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  records.unshift({
    date: formatDate(clockInTime),
    clockInTime: clockInTime.toISOString(),
    clockOutTime: clockOutTime.toISOString(),
    hourlyRate: HOURLY_RATE,
    hours: settlement.hours,
    basePay: settlement.basePay,
    lunchDeduction: Number(els.lunchInput.value) || 0,
    reimbursement: Number(els.reimburseInput.value) || 0,
    note: els.noteInput.value.trim(),
    finalPay: settlement.finalPay,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  els.statusText.textContent = 'Saved';
  alert('已儲存今日紀錄 ✨');
}

function resetToday() {
  clearInterval(timerId);
  isWorking = false;
  clockInTime = null;
  clockOutTime = null;
  liveSeconds = 0;
  settlement = { hours: 0, basePay: 0, finalPay: 0 };

  els.clockButton.classList.remove('working');
  els.clockEn.textContent = 'CLOCK IN';
  els.clockZh.textContent = '開始工作';
  els.workTimer.textContent = '00:00:00';
  els.workTimer.classList.add('hidden');
  els.hintText.textContent = '✦ 今日尚未打卡';
  els.totalHours.textContent = '0.0 小時';
  els.basePay.textContent = '$ 0';
  els.finalPay.textContent = '$ 0';
  els.lunchInput.value = '';
  els.reimburseInput.value = '';
  els.noteInput.value = '';
  els.settlementPanel.classList.remove('open');
}

els.clockButton.addEventListener('click', () => {
  if (isWorking) stopWork();
  else startWork();
});
els.lunchInput.addEventListener('input', calculateFinalPay);
els.reimburseInput.addEventListener('input', calculateFinalPay);
els.saveBtn.addEventListener('click', saveRecord);
els.resetBtn.addEventListener('click', resetToday);

updateNow();
setInterval(updateNow, 1000);
