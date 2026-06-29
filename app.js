/* ============================================
   STRATA — app.js
   All state lives in localStorage. No backend, no tracking.
   ============================================ */

const STORAGE_KEY = 'strata-study-planner-v1';

const SUBJECT_COLORS = [
  '#E8862C', '#6B9080', '#C1554A', '#8E7CC3',
  '#4F8FC0', '#D4B23F', '#5C9E8F', '#B85C8A'
];

const DEFAULT_STATE = {
  examDate: null,
  subjects: [],       // {id, name, color, targetHours, loggedMinutes}
  tasks: {},          // { 'YYYY-MM-DD': [ {id, subjectId, title, done} ] }
  sessions: {},        // { 'YYYY-MM-DD': totalMinutesStudied }
  streak: { current: 0, longest: 0, lastActiveDate: null },
  activeSubjectId: null,
  timerSettings: { focus: 25, shortBreak: 5, longBreak: 15, cycleLength: 4 },
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch (e) {
    console.warn('Could not load saved data, starting fresh.', e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save — storage may be full or disabled.', e);
    showToast('Could not save changes. Storage may be full.');
  }
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

/* ============================================
   SUBJECTS
   ============================================ */
function renderSubjects() {
  const list = document.getElementById('subjectList');
  const emptyHint = document.getElementById('subjectEmptyHint');
  list.innerHTML = '';

  if (state.subjects.length === 0) {
    emptyHint.style.display = 'block';
  } else {
    emptyHint.style.display = 'none';
  }

  state.subjects.forEach(subject => {
    const targetMinutes = (subject.targetHours || 0) * 60;
    const pct = targetMinutes > 0
      ? Math.min(100, Math.round((subject.loggedMinutes / targetMinutes) * 100))
      : 0;

    const card = document.createElement('div');
    card.className = 'subject-card' + (subject.id === state.activeSubjectId ? ' is-active' : '');
    card.style.setProperty('--subject-color', subject.color);
    card.dataset.id = subject.id;

    const hoursLogged = (subject.loggedMinutes / 60).toFixed(1);
    const targetText = subject.targetHours ? `${hoursLogged}h / ${subject.targetHours}h` : `${hoursLogged}h logged`;

    card.innerHTML = `
      <div class="subject-card-top">
        <span class="subject-dot"></span>
        <span class="subject-name">${escapeHtml(subject.name)}</span>
        <span class="subject-delete" data-action="delete-subject" title="Remove subject">&times;</span>
      </div>
      <div class="subject-progress-track">
        <div class="subject-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="subject-meta">
        <span>${targetText}</span>
        ${subject.targetHours ? `<span>${pct}%</span>` : ''}
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'delete-subject') {
        e.stopPropagation();
        deleteSubject(subject.id);
        return;
      }
      setActiveSubject(subject.id);
    });

    list.appendChild(card);
  });
}

function setActiveSubject(id) {
  state.activeSubjectId = id;
  saveState();
  renderSubjects();
  updateTimerSubjectLabel();
}

function deleteSubject(id) {
  const subject = state.subjects.find(s => s.id === id);
  if (!subject) return;
  if (!confirm(`Remove "${subject.name}"? This won't delete logged time but the subject will disappear from your list.`)) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  if (state.activeSubjectId === id) state.activeSubjectId = null;
  // remove tasks tied to this subject
  Object.keys(state.tasks).forEach(day => {
    state.tasks[day] = state.tasks[day].filter(t => t.subjectId !== id);
  });
  saveState();
  renderSubjects();
  renderTasks();
  updateTimerSubjectLabel();
}

function addSubject(name, color, targetHours) {
  state.subjects.push({
    id: uid(),
    name: name.trim(),
    color,
    targetHours: targetHours ? Number(targetHours) : 0,
    loggedMinutes: 0,
  });
  saveState();
  renderSubjects();
  populateTaskSubjectSelect();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================
   TASKS (today's plan)
   ============================================ */
function renderTasks() {
  const key = todayKey();
  const list = document.getElementById('taskList');
  const emptyHint = document.getElementById('taskEmptyHint');
  const tasks = state.tasks[key] || [];

  list.innerHTML = '';
  emptyHint.style.display = tasks.length === 0 ? 'block' : 'none';

  tasks.forEach(task => {
    const subject = state.subjects.find(s => s.id === task.subjectId);
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' is-done' : '');
    li.innerHTML = `
      <span class="task-checkbox ${task.done ? 'is-done' : ''}" data-action="toggle">
        ${task.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' : ''}
      </span>
      ${subject ? `<span class="task-dot" style="background:${subject.color}"></span>` : ''}
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-delete" data-action="delete">&times;</span>
    `;
    li.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleTask(task.id));
    li.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task.id));
    list.appendChild(li);
  });
}

function toggleTask(id) {
  const key = todayKey();
  const tasks = state.tasks[key] || [];
  const task = tasks.find(t => t.id === id);
  if (task) task.done = !task.done;
  saveState();
  renderTasks();
}

function deleteTask(id) {
  const key = todayKey();
  state.tasks[key] = (state.tasks[key] || []).filter(t => t.id !== id);
  saveState();
  renderTasks();
}

function addTask(subjectId, title) {
  const key = todayKey();
  if (!state.tasks[key]) state.tasks[key] = [];
  state.tasks[key].push({ id: uid(), subjectId, title: title.trim(), done: false });
  saveState();
  renderTasks();
}

function populateTaskSubjectSelect() {
  const select = document.getElementById('taskSubject');
  select.innerHTML = '';
  if (state.subjects.length === 0) {
    select.innerHTML = '<option value="">Add a subject first</option>';
    return;
  }
  state.subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });
}

/* ============================================
   POMODORO TIMER
   ============================================ */
const RING_CIRCUMFERENCE = 2 * Math.PI * 108;

const timer = {
  mode: 'focus',          // 'focus' | 'shortBreak' | 'longBreak'
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  running: false,
  intervalId: null,
  completedFocusSessions: 0,
  minutesAccrued: 0,       // partial minute tracking for current session
};

function getSettings() {
  return {
    focus: clampInt(document.getElementById('focusMins').value, 1, 120, 25),
    shortBreak: clampInt(document.getElementById('shortBreakMins').value, 1, 60, 5),
    longBreak: clampInt(document.getElementById('longBreakMins').value, 1, 60, 15),
    cycleLength: clampInt(document.getElementById('cycleLength').value, 1, 12, 4),
  };
}

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function persistTimerSettings() {
  state.timerSettings = getSettings();
  saveState();
}

function modeDurationSeconds(mode) {
  const s = getSettings();
  if (mode === 'focus') return s.focus * 60;
  if (mode === 'shortBreak') return s.shortBreak * 60;
  return s.longBreak * 60;
}

function updateTimerSubjectLabel() {
  const label = document.getElementById('timerSubject');
  const subject = state.subjects.find(s => s.id === state.activeSubjectId);
  if (timer.mode !== 'focus') {
    label.textContent = timer.mode === 'shortBreak' ? 'short break' : 'long break';
  } else {
    label.textContent = subject ? subject.name : 'pick a subject';
  }
}

function renderTimerDisplay() {
  const mins = Math.floor(timer.remainingSeconds / 60);
  const secs = timer.remainingSeconds % 60;
  document.getElementById('timerClock').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const ring = document.getElementById('ringProgress');
  const pctElapsed = 1 - (timer.remainingSeconds / timer.totalSeconds);
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pctElapsed);
  ring.classList.toggle('is-break', timer.mode !== 'focus');

  const pill = document.getElementById('modePill');
  pill.classList.toggle('is-break', timer.mode !== 'focus');
  pill.textContent = timer.mode === 'focus' ? 'Pomodoro'
    : timer.mode === 'shortBreak' ? 'Short break' : 'Long break';

  document.getElementById('startPauseBtn').textContent = timer.running ? 'pause' : 'start';
  updateTimerSubjectLabel();
}

function resetTimer(toMode) {
  pauseTimer();
  timer.mode = toMode || timer.mode;
  timer.totalSeconds = modeDurationSeconds(timer.mode);
  timer.remainingSeconds = timer.totalSeconds;
  renderTimerDisplay();
}

function startTimer() {
  if (timer.mode === 'focus' && !state.activeSubjectId && state.subjects.length > 0) {
    showToast('Tip: select a subject on the left to track time against it.');
  }
  timer.running = true;
  renderTimerDisplay();
  timer.intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timer.intervalId);
  renderTimerDisplay();
}

function tick() {
  timer.remainingSeconds--;

  if (timer.mode === 'focus') {
    timer.minutesAccrued += 1 / 60;
    if (timer.minutesAccrued >= 1) {
      const wholeMinutes = Math.floor(timer.minutesAccrued);
      timer.minutesAccrued -= wholeMinutes;
      logStudyMinutes(wholeMinutes);
    }
  }

  if (timer.remainingSeconds <= 0) {
    completeSession();
    return;
  }
  renderTimerDisplay();
}

function completeSession() {
  pauseTimer();
  // flush any fractional minute remainder for focus sessions
  if (timer.mode === 'focus' && timer.minutesAccrued > 0) {
    logStudyMinutes(Math.round(timer.minutesAccrued));
    timer.minutesAccrued = 0;
  }

  playChime();

  if (timer.mode === 'focus') {
    timer.completedFocusSessions++;
    const settings = getSettings();
    const nextMode = (timer.completedFocusSessions % settings.cycleLength === 0)
      ? 'longBreak' : 'shortBreak';
    showToast('Focus session complete. Time for a break.');
    resetTimer(nextMode);
  } else {
    showToast('Break\'s over. Ready for another round?');
    resetTimer('focus');
  }
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) { /* audio not available, fail silently */ }
}

function logStudyMinutes(minutes) {
  if (minutes <= 0) return;
  const key = todayKey();

  // subject time
  const subject = state.subjects.find(s => s.id === state.activeSubjectId);
  if (subject) subject.loggedMinutes = (subject.loggedMinutes || 0) + minutes;

  // daily session total
  state.sessions[key] = (state.sessions[key] || 0) + minutes;

  updateStreak(key);
  saveState();
  renderSubjects();
  renderStreakStats();
  renderContributionGraph();
  renderMonthCalendar();
}

function updateStreak(activeDayKey) {
  const streak = state.streak;
  if (streak.lastActiveDate === activeDayKey) return; // already counted today

  const yesterday = todayKey(new Date(Date.now() - 86400000));
  if (streak.lastActiveDate === yesterday) {
    streak.current += 1;
  } else if (streak.lastActiveDate !== activeDayKey) {
    streak.current = 1;
  }
  streak.longest = Math.max(streak.longest, streak.current);
  streak.lastActiveDate = activeDayKey;
}

/* ============================================
   STREAK STATS + CONTRIBUTION GRAPH
   ============================================ */
function renderStreakStats() {
  document.querySelector('#streakCount .streak-number').textContent = state.streak.current;

  const todayMinutes = state.sessions[todayKey()] || 0;
  document.getElementById('statToday').textContent = formatMinutes(todayMinutes);

  let weekMinutes = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 86400000);
    weekMinutes += state.sessions[todayKey(d)] || 0;
  }
  document.getElementById('statWeek').textContent = formatMinutes(weekMinutes);

  const totalMinutes = Object.values(state.sessions).reduce((a, b) => a + b, 0);
  document.getElementById('statTotal').textContent = formatMinutes(totalMinutes);
}

function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function levelForMinutes(mins) {
  if (!mins) return 0;
  if (mins < 25) return 1;
  if (mins < 60) return 2;
  if (mins < 120) return 3;
  return 4;
}

function renderContributionGraph() {
  const graph = document.getElementById('contributionGraph');
  graph.innerHTML = '';

  const WEEKS = 18;
  const totalDays = WEEKS * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // align so the grid ends on today, filling columns Sun-Sat
  const endDow = today.getDay(); // 0=Sun
  const startDate = new Date(today.getTime() - (totalDays - 1 - (6 - endDow)) * 86400000);

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getTime() + i * 86400000);
    const key = todayKey(d);
    const mins = state.sessions[key] || 0;
    const cell = document.createElement('div');
    cell.className = `contrib-cell lvl-${levelForMinutes(mins)}`;
    cell.title = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${mins ? formatMinutes(mins) : 'no study'}`;
    if (d > today) cell.style.visibility = 'hidden';
    graph.appendChild(cell);
  }
}

/* ============================================
   MONTH CALENDAR
   ============================================ */
let calendarViewDate = new Date();

function renderMonthCalendar() {
  const grid = document.getElementById('monthCalendar');
  const label = document.getElementById('calMonthLabel');
  grid.innerHTML = '';

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  label.textContent = calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayKey();

  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day is-empty';
    grid.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const key = todayKey(dateObj);
    const mins = state.sessions[key] || 0;
    const el = document.createElement('div');
    el.className = 'cal-day' + (mins > 0 ? ' has-activity' : '') + (key === todayStr ? ' is-today' : '');
    el.textContent = day;
    el.title = mins ? `${formatMinutes(mins)} studied` : 'No study logged';
    grid.appendChild(el);
  }
}

/* ============================================
   EXAM COUNTDOWN
   ============================================ */
function renderExamCountdown() {
  const container = document.getElementById('examCountdown');
  if (!state.examDate) {
    container.innerHTML = '<button class="set-exam-btn" id="setExamBtn" title="Set exam date">set exam date</button>';
    document.getElementById('setExamBtn').addEventListener('click', openExamModal);
    return;
  }
  const exam = new Date(state.examDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((exam - today) / 86400000);

  let text;
  if (daysLeft > 0) text = `<span class="days-left">${daysLeft}</span> day${daysLeft === 1 ? '' : 's'} to GATE`;
  else if (daysLeft === 0) text = `<span class="days-left">Today</span> is the day`;
  else text = `Exam day passed`;

  container.innerHTML = `${text} <button class="change-exam-btn" id="setExamBtn">change</button>`;
  document.getElementById('setExamBtn').addEventListener('click', openExamModal);
}

function openExamModal() {
  const modal = document.getElementById('examModal');
  document.getElementById('examDateInput').value = state.examDate || '';
  modal.showModal();
}

/* ============================================
   MODALS — wiring
   ============================================ */
function buildColorSwatches() {
  const container = document.getElementById('colorSwatches');
  container.innerHTML = '';
  SUBJECT_COLORS.forEach((color, idx) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (idx === 0 ? ' is-selected' : '');
    swatch.style.background = color;
    swatch.dataset.color = color;
    swatch.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-selected'));
      swatch.classList.add('is-selected');
    });
    container.appendChild(swatch);
  });
}

function getSelectedColor() {
  const selected = document.querySelector('#colorSwatches .color-swatch.is-selected');
  return selected ? selected.dataset.color : SUBJECT_COLORS[0];
}

/* ============================================
   INIT
   ============================================ */
function init() {
  // restore timer settings
  if (state.timerSettings) {
    document.getElementById('focusMins').value = state.timerSettings.focus;
    document.getElementById('shortBreakMins').value = state.timerSettings.shortBreak;
    document.getElementById('longBreakMins').value = state.timerSettings.longBreak;
    document.getElementById('cycleLength').value = state.timerSettings.cycleLength;
  }
  timer.totalSeconds = modeDurationSeconds('focus');
  timer.remainingSeconds = timer.totalSeconds;

  buildColorSwatches();
  renderSubjects();
  populateTaskSubjectSelect();
  renderTasks();
  renderTimerDisplay();
  renderStreakStats();
  renderContributionGraph();
  renderMonthCalendar();
  renderExamCountdown();

  // --- Subject modal ---
  document.getElementById('addSubjectBtn').addEventListener('click', () => {
    document.getElementById('subjectForm').reset();
    buildColorSwatches();
    document.getElementById('subjectModal').showModal();
  });
  document.getElementById('cancelSubjectBtn').addEventListener('click', () => {
    document.getElementById('subjectModal').close();
  });
  document.getElementById('subjectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('subjectName').value;
    const target = document.getElementById('subjectTarget').value;
    if (!name.trim()) return;
    addSubject(name, getSelectedColor(), target);
    document.getElementById('subjectModal').close();
    showToast(`Added "${name.trim()}" to your subjects.`);
  });

  // --- Task modal ---
  document.getElementById('addTaskBtn').addEventListener('click', () => {
    if (state.subjects.length === 0) {
      showToast('Add a subject first, then plan tasks against it.');
      return;
    }
    document.getElementById('taskForm').reset();
    populateTaskSubjectSelect();
    if (state.activeSubjectId) document.getElementById('taskSubject').value = state.activeSubjectId;
    document.getElementById('taskModal').showModal();
  });
  document.getElementById('cancelTaskBtn').addEventListener('click', () => {
    document.getElementById('taskModal').close();
  });
  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('taskSubject').value;
    const title = document.getElementById('taskTitle').value;
    if (!subjectId || !title.trim()) return;
    addTask(subjectId, title);
    document.getElementById('taskModal').close();
  });

  // --- Exam modal ---
  document.getElementById('cancelExamBtn').addEventListener('click', () => {
    document.getElementById('examModal').close();
  });
  document.getElementById('examForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.examDate = document.getElementById('examDateInput').value;
    saveState();
    renderExamCountdown();
    document.getElementById('examModal').close();
  });

  // --- Timer controls ---
  document.getElementById('startPauseBtn').addEventListener('click', () => {
    timer.running ? pauseTimer() : startTimer();
  });
  document.getElementById('resetBtn').addEventListener('click', () => resetTimer());
  document.getElementById('skipBtn').addEventListener('click', () => completeSession());

  ['focusMins', 'shortBreakMins', 'longBreakMins', 'cycleLength'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      persistTimerSettings();
      if (!timer.running) resetTimer();
    });
  });

  // --- Calendar nav ---
  document.getElementById('calPrev').addEventListener('click', () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
    renderMonthCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
    renderMonthCalendar();
  });

  // refresh exam countdown + calendar at local midnight rollover (cheap interval check)
  setInterval(() => {
    renderExamCountdown();
    renderContributionGraph();
    renderMonthCalendar();
  }, 60000);

  // warn before closing tab while a focus session is running
  window.addEventListener('beforeunload', (e) => {
    if (timer.running && timer.mode === 'focus') {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
