const practices = [
  { id: "baduanjin", name: "武当八段锦", meta: "舒展 · 完整跟练" },
  { id: "wuqinxi", name: "健身气功五禽戏", meta: "全身 · 呼吸口令" },
  { id: "taiji", name: "武当太极十三势", meta: "太极 · 动作教学" },
  { id: "zhanzhuang", name: "武当站桩", meta: "静功 · 袁师懋教学" },
  { id: "jingang", name: "八部金刚功", meta: "镜像 · 原声口令" },
  { id: "yijinjing", name: "倪海厦 · 易筋经组合", meta: "传统养生 · 长时跟练" },
  { id: "free", name: "自由练习", meta: "自行安排" }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const TIMER_KEY = "qingyang-active-timer-v2";
const SESSION_KEY = "qingyang-training-sessions-v2";
const LEGACY_CHECKIN_KEY = "qingyang-checkins";

let timerTicker = null;

function practiceName(id) {
  return practices.find(item => item.id === id)?.name || "自由练习";
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} 秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
  return `${m} 分钟`;
}

function formatTime(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function loadPlayer(card) {
  const player = $(".practice-player", card);
  const status = $(".player-status", card);
  if (!player || !player.dataset.src) return;
  if (player.getAttribute("src") === player.dataset.src) return;
  if (status) {
    status.textContent = "正在连接播放器……";
    status.classList.add("loading");
  }
  player.onload = () => {
    if (!status) return;
    status.textContent = "播放器已响应。若画面提示超时，可点“重新加载”。";
    status.classList.remove("loading");
  };
  player.setAttribute("src", player.dataset.src);
}

function unloadPlayer(card) {
  const player = $(".practice-player", card);
  const status = $(".player-status", card);
  if (!player) return;
  player.onload = null;
  player.setAttribute("src", "about:blank");
  if (status) {
    status.textContent = "展开后才连接播放器。";
    status.classList.remove("loading");
  }
}

function reloadPlayer(card) {
  const player = $(".practice-player", card);
  const status = $(".player-status", card);
  if (!player || !player.dataset.src) return;
  if (!card.open) card.open = true;
  if (status) {
    status.textContent = "正在重新连接播放器……";
    status.classList.add("loading");
  }
  player.onload = null;
  player.setAttribute("src", "about:blank");
  setTimeout(() => loadPlayer(card), 350);
}

function activeTimer() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMER_KEY) || "null");
    if (!value || typeof value !== "object") return null;
    return value;
  } catch {
    return null;
  }
}

function saveActiveTimer(state) {
  try {
    if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    else localStorage.removeItem(TIMER_KEY);
  } catch {}
}

function timerElapsed(state = activeTimer()) {
  if (!state) return 0;
  let elapsed = Number(state.elapsedSeconds) || 0;
  if (state.status === "running" && state.runningSince) {
    elapsed += (Date.now() - Number(state.runningSince)) / 1000;
  }
  return Math.max(0, elapsed);
}

function readSessions() {
  try {
    const data = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessions)); } catch {}
}

function syncPracticeSelects(id) {
  $$(".timer-practice-select").forEach(select => {
    if ($(`option[value="${id}"]`, select)) select.value = id;
  });
  $$('[data-timer-practice-name]').forEach(node => {
    node.textContent = practiceName(id);
  });
}

function selectedPracticeId() {
  return $(".timer-practice-select")?.value || "baduanjin";
}

function timerHasProgress(state = activeTimer()) {
  return !!state && timerElapsed(state) >= 1;
}

function setTimerPractice(id) {
  const state = activeTimer();
  if (state && timerHasProgress(state)) return;
  syncPracticeSelects(id);
}

function startTimer(id = selectedPracticeId()) {
  let state = activeTimer();

  if (state && timerHasProgress(state)) {
    if (state.status === "running") return;
    state.status = "running";
    state.runningSince = Date.now();
    if (!state.startedAt) {
      state.startedAt = new Date(Date.now() - (Number(state.elapsedSeconds) || 0) * 1000).toISOString();
    }
    saveActiveTimer(state);
  } else {
    const now = new Date();
    state = {
      practiceId: id,
      practiceName: practiceName(id),
      elapsedSeconds: 0,
      runningSince: now.getTime(),
      status: "running",
      startedDate: todayKey(now),
      startedAt: now.toISOString()
    };
    saveActiveTimer(state);
  }

  syncPracticeSelects(state.practiceId);
  renderTimer();
}

function pauseTimer() {
  const state = activeTimer();
  if (!state || state.status !== "running") return;
  state.elapsedSeconds = timerElapsed(state);
  state.runningSince = null;
  state.status = "paused";
  saveActiveTimer(state);
  renderTimer();
}

function finishTimer() {
  const state = activeTimer();
  if (!state) return;
  const durationSeconds = Math.floor(timerElapsed(state));
  if (durationSeconds < 1) {
    saveActiveTimer(null);
    renderTimer();
    return;
  }

  const now = new Date();
  const sessions = readSessions();
  const startedAt = state.startedAt || new Date(now.getTime() - durationSeconds * 1000).toISOString();
  sessions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: todayKey(now),
    practiceId: state.practiceId,
    practiceName: state.practiceName || practiceName(state.practiceId),
    durationSeconds,
    startedAt,
    endedAt: now.toISOString()
  });
  saveSessions(sessions);

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CHECKIN_KEY) || "[]");
    const dates = Array.isArray(legacy) ? legacy : [];
    const key = todayKey(now);
    if (!dates.includes(key)) dates.push(key);
    localStorage.setItem(LEGACY_CHECKIN_KEY, JSON.stringify(dates));
  } catch {}

  const lastPractice = state.practiceId;
  saveActiveTimer(null);
  syncPracticeSelects(lastPractice);
  renderTimer();
  renderTrainingStats();
}

function timerStateText(state) {
  if (!state) return "尚未开始";
  if (state.status === "running") return `正在记录 · ${state.practiceName || practiceName(state.practiceId)}`;
  if (state.status === "paused") return `已暂停 · ${state.practiceName || practiceName(state.practiceId)}`;
  return "尚未开始";
}

function renderTimer() {
  const state = activeTimer();
  const elapsed = timerElapsed(state);
  const hasProgress = timerHasProgress(state);
  const running = state?.status === "running";
  const paused = state?.status === "paused";
  const pid = state?.practiceId || selectedPracticeId();

  syncPracticeSelects(pid);

  $$('[data-timer-display]').forEach(node => node.textContent = formatClock(elapsed));
  $$('[data-timer-state]').forEach(node => node.textContent = timerStateText(state));
  $$('[data-timer-practice-name]').forEach(node => node.textContent = practiceName(pid));

  $$('.timer-practice-select').forEach(select => {
    select.disabled = !!state;
  });

  $$('[data-timer-action="start"]').forEach(button => {
    button.disabled = running;
    button.textContent = paused ? "继续" : "开始";
    if (button.classList.contains('timer-start')) button.textContent = paused ? "继续计时" : "开始计时";
  });
  $$('[data-timer-action="pause"]').forEach(button => button.disabled = !running);
  $$('[data-timer-action="finish"]').forEach(button => button.disabled = !state || !hasProgress);

  const idlePanel = $('[data-side-timer-idle]');
  const activePanel = $('[data-side-timer-active]');
  if (idlePanel) idlePanel.hidden = !!state;
  if (activePanel) activePanel.hidden = !state;

  const sideToggle = $('#sideTimerToggle');
  if (sideToggle) {
    sideToggle.disabled = !state;
    sideToggle.textContent = running ? "暂停" : "继续";
  }
}

function renderTrainingStats() {
  const sessions = readSessions();
  const today = todayKey();
  const todaySessions = sessions.filter(item => item.date === today);
  const todayTotal = todaySessions.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0);

  $$('[data-today-total]').forEach(node => node.textContent = formatDuration(todayTotal));

  const sessionCount = $('#todaySessionCount');
  if (sessionCount) sessionCount.textContent = String(todaySessions.length);

  const daySet = new Set(sessions.map(item => item.date).filter(Boolean));
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CHECKIN_KEY) || "[]");
    if (Array.isArray(legacy)) legacy.forEach(date => daySet.add(date));
  } catch {}
  const totalDays = $('#totalPracticeDays');
  if (totalDays) totalDays.textContent = String(daySet.size);

  const list = $('#todaySessions');
  if (!list) return;
  if (todaySessions.length === 0) {
    list.innerHTML = '<p class="history-empty">今天还没有记录。开始一套练习吧。</p>';
    return;
  }

  list.innerHTML = todaySessions
    .slice()
    .reverse()
    .map(item => {
      const endDate = item.endedAt ? new Date(item.endedAt) : null;
      const startDate = item.startedAt
        ? new Date(item.startedAt)
        : (endDate ? new Date(endDate.getTime() - (Number(item.durationSeconds) || 0) * 1000) : null);
      const startText = formatTime(startDate);
      const endText = formatTime(endDate);
      const range = startText && endText ? `${startText}–${endText}` : (endText ? `${endText} 结束` : "今天");
      return `
        <div class="history-row">
          <div><strong>${item.practiceName || practiceName(item.practiceId)}</strong><span>${range}</span></div>
          <b>${formatDuration(item.durationSeconds || 0)}</b>
          <button type="button" data-delete-session="${item.id}" aria-label="删除这条记录">删除</button>
        </div>`;
    })
    .join('');

  $$('[data-delete-session]', list).forEach(button => {
    button.addEventListener('click', () => {
      const next = readSessions().filter(item => item.id !== button.dataset.deleteSession);
      saveSessions(next);
      renderTrainingStats();
    });
  });
}

function initTimer() {
  $$('.timer-practice-select').forEach(select => {
    select.addEventListener('change', () => syncPracticeSelects(select.value));
  });

  $$('[data-timer-action="start"]').forEach(button => button.addEventListener('click', () => startTimer()));
  $$('[data-timer-action="pause"]').forEach(button => button.addEventListener('click', pauseTimer));
  $$('[data-timer-action="finish"]').forEach(button => button.addEventListener('click', finishTimer));

  const sideToggle = $('#sideTimerToggle');
  if (sideToggle) {
    sideToggle.addEventListener('click', () => {
      const state = activeTimer();
      if (!state) return;
      if (state.status === 'running') pauseTimer();
      else startTimer(state.practiceId);
    });
  }

  renderTimer();
  renderTrainingStats();

  timerTicker = window.setInterval(() => {
    renderTimer();
  }, 500);

  window.addEventListener('beforeunload', () => {
    const state = activeTimer();
    if (state?.status === 'running') {
      state.elapsedSeconds = timerElapsed(state);
      state.runningSince = null;
      state.status = 'paused';
      saveActiveTimer(state);
    }
  });
}

function openPractice(id, scroll = true) {
  const target = document.getElementById(id);
  if (!target) return;
  $$(".practice-card").forEach(card => {
    if (card !== target) {
      card.open = false;
      unloadPlayer(card);
    }
  });
  target.open = true;
  loadPlayer(target);
  setTimerPractice(id);
  if (scroll) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

function initPracticeCards() {
  $$(".practice-card").forEach(card => {
    card.addEventListener("toggle", () => {
      if (card.open) {
        $$(".practice-card").forEach(other => {
          if (other !== card) {
            other.open = false;
            unloadPlayer(other);
          }
        });
        loadPlayer(card);
        setTimerPractice(card.id);
      } else {
        unloadPlayer(card);
      }
    });

    const reload = $(".reload-button", card);
    if (reload) reload.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      reloadPlayer(card);
    });

    const playerButtons = $(".player-bar > div", card);
    if (playerButtons && !$(".practice-timer-button", playerButtons)) {
      const timerButton = document.createElement('button');
      timerButton.type = 'button';
      timerButton.className = 'practice-timer-button';
      timerButton.textContent = '开始计时';
      timerButton.addEventListener('click', event => {
        event.preventDefault();
        setTimerPractice(card.id);
        startTimer(card.id);
      });
      playerButtons.prepend(timerButton);
    }
  });
}

function initJumpButtons() {
  $$('[data-target]').forEach(button => {
    button.addEventListener("click", () => openPractice(button.dataset.target));
  });
}

function pickRandomPractice(openIt = true) {
  const choices = practices.filter(item => item.id !== 'free');
  const choice = choices[Math.floor(Math.random() * choices.length)];
  const result = $("#randomResult");
  if (result) result.innerHTML = `今天可以试试：<strong>${choice.name}</strong>`;
  if (openIt) setTimeout(() => openPractice(choice.id), 180);
  return choice;
}

function initRandom() {
  const main = $("#randomPracticeBtn");
  if (main) main.addEventListener("click", () => pickRandomPractice(true));
}

function exportRecords() {
  const payload = {
    app: "清养",
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: readSessions(),
    checkins: (() => {
      try {
        const data = JSON.parse(localStorage.getItem(LEGACY_CHECKIN_KEY) || "[]");
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    })()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `清养练习记录-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importRecordsFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      if (!payload || !Array.isArray(payload.sessions)) throw new Error("invalid");

      const current = readSessions();
      const byId = new Map(current.map(item => [item.id, item]));
      payload.sessions.forEach(item => {
        if (!item || typeof item !== "object") return;
        const id = item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        byId.set(id, { ...item, id });
      });
      const merged = Array.from(byId.values()).sort((a, b) => String(a.endedAt || "").localeCompare(String(b.endedAt || "")));
      saveSessions(merged);

      if (Array.isArray(payload.checkins)) {
        let existing = [];
        try {
          const parsed = JSON.parse(localStorage.getItem(LEGACY_CHECKIN_KEY) || "[]");
          existing = Array.isArray(parsed) ? parsed : [];
        } catch {}
        const dates = Array.from(new Set([...existing, ...payload.checkins].filter(Boolean)));
        localStorage.setItem(LEGACY_CHECKIN_KEY, JSON.stringify(dates));
      }

      renderTrainingStats();
      window.alert("练习记录已经导入。原有记录不会被覆盖，会自动合并。");
    } catch {
      window.alert("这个文件不是有效的“清养”练习记录备份。");
    }
  };
  reader.readAsText(file, "utf-8");
}

function initRecordBackup() {
  const exportBtn = $('#exportRecordsBtn');
  const importInput = $('#importRecordsInput');
  if (exportBtn) exportBtn.addEventListener('click', exportRecords);
  if (importInput) {
    importInput.addEventListener('change', () => {
      importRecordsFile(importInput.files?.[0]);
      importInput.value = "";
    });
  }
}

function showInstallDialog() {
  const dialog = $('#installDialog');
  if (dialog) dialog.hidden = false;
}

function hideInstallDialog() {
  const dialog = $('#installDialog');
  if (dialog) dialog.hidden = true;
}

function initPWAInstall() {
  // 不拦截 beforeinstallprompt：让 Chrome / Edge / 360 / 系统浏览器
  // 自己决定何时显示原生“安装应用 / 添加到主屏幕”提示。
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

function initAnchorLinks() {
  $$('#main a[href^="#"], .sidebar a[href^="#"]').forEach(link => {
    link.addEventListener("click", event => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTimer();
  initPracticeCards();
  initJumpButtons();
  initRandom();
  initRecordBackup();
  initPWAInstall();
  initAnchorLinks();
});
