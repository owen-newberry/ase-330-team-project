// Simple client-side boards manager: create, list, filter, persist to localStorage
const STORAGE_KEY = "prod_boards_v1";
const REWARDS_KEY = "prod_rewards_v1";
const BADGES_KEY = "prod_badges_v1";
const STATS_KEY = "prod_stats_v1";
const HAS_VISITED = "has_visited_site";
const TUTORIAL_COMPLETED = "tutorial_completed";
let boards = [];
let activeFilter = "All";
let currentTutorialStep = 1;
let userBadges = [];
let userStats = { tasksCompleted: 0, streak: 0, lastCompletionDate: null, level: 1, xp: 0 };

function $(s) {
  return document.querySelector(s);
}
function $all(s) {
  return Array.from(document.querySelectorAll(s));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      boards = JSON.parse(raw);
    } catch (e) {
      boards = [];
    }
  } else {
    // sample seed data
    boards = [
      {
        id: id(),
        name: "Product Board",
        updatedAt: Date.now() - 1000 * 60 * 60 * 24,
        color: "#6f42c1",
      },
      {
        id: id(),
        name: "Marketing",
        updatedAt: Date.now() - 1000 * 60 * 60 * 5,
        color: "#198754",
      },
    ];
    save();
  }
  loadBadges();
  loadStats();
}

// rewards state: { points: number, goals: Array<{id,title,target}> }
let rewards = { points: 0, goals: [] };

function loadRewards() {
  const raw = localStorage.getItem(REWARDS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // migration: older shape used 'goal' number — convert to a single titled goal
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.goals)) {
          rewards = { points: Number(parsed.points || 0), goals: parsed.goals };
        } else if (parsed.goal && !parsed.goals) {
          rewards = {
            points: Number(parsed.points || 0),
            goals: [
              {
                id: "g_" + Math.random().toString(36).slice(2, 8),
                title: "Goal",
                target: Number(parsed.goal) || 0,
              },
            ],
          };
        } else {
          rewards = { points: Number(parsed.points || 0), goals: [] };
        }
      }
    } catch (e) {
      rewards = { points: 0, goals: [] };
    }
  } else {
    rewards = { points: 0, goals: [] };
    saveRewards();
  }
}

function saveRewards() {
  localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards));
}

function updateRewardsUI() {
  const ptsEl = document.getElementById("rewards-points");
  const list = document.getElementById("goals-list");
  if (ptsEl) ptsEl.textContent = String(rewards.points);
  if (!list) return;
  list.innerHTML = "";
  if (!rewards.goals || rewards.goals.length === 0) {
    list.innerHTML = '<div class="text-muted">No goals set yet.</div>';
    return;
  }
  rewards.goals.forEach((g) => {
    const card = document.createElement("div");
    card.className = "card mb-2";
    const body = document.createElement("div");
    body.className = "card-body p-2";
    const row = document.createElement("div");
    row.className = "d-flex justify-content-between align-items-start";
    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "fw-semibold";
    title.textContent = g.title || "Untitled";
    const meta = document.createElement("div");
    meta.className = "small text-muted";
    meta.textContent = "Target: " + (g.target || 0) + " pts";
    left.appendChild(title);
    left.appendChild(meta);
    const right = document.createElement("div");
    // action buttons: claim (if reached) and remove
    if (rewards.points >= (g.target || 0) && (g.target || 0) > 0) {
      const claim = document.createElement("button");
      claim.className = "btn btn-sm btn-success me-2";
      claim.textContent = "Claim";
      claim.addEventListener("click", () => {
        claimGoal(g.id);
      });
      right.appendChild(claim);
    }
    const del = document.createElement("button");
    del.className = "btn btn-sm btn-outline-danger";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      removeGoal(g.id);
    });
    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    body.appendChild(row);

    // progress
    const pct =
      g.target && g.target > 0
        ? Math.min(100, Math.round((rewards.points / g.target) * 100))
        : 0;
    const progWrap = document.createElement("div");
    progWrap.className = "mt-2";
    const prog = document.createElement("div");
    prog.className = "progress";
    prog.style.height = "12px";
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.style.width = pct + "%";
    bar.textContent = pct + "%";
    prog.appendChild(bar);
    progWrap.appendChild(prog);
    body.appendChild(progWrap);

    card.appendChild(body);
    list.appendChild(card);
  });
}

function earnPoints(amount) {
  rewards.points = Math.max(
    0,
    Number(rewards.points || 0) + Number(amount || 0)
  );
  rewards.points = Math.round(rewards.points);
  saveRewards();
  updateRewardsUI();
}

function tryRedeem(cost) {
  cost = Number(cost || 0);
  if (isNaN(cost) || cost <= 0) return false;
  if (rewards.points >= cost) {
    rewards.points = Math.round(rewards.points - cost);
    saveRewards();
    updateRewardsUI();
    return true;
  }
  return false;
}

function addGoal(title, target) {
  const g = {
    id: "g_" + Math.random().toString(36).slice(2, 8),
    title: String(title || "Untitled"),
    target: Math.max(0, Math.round(Number(target) || 0)),
  };
  rewards.goals.unshift(g);
  saveRewards();
  updateRewardsUI();
}

function removeGoal(id) {
  rewards.goals = rewards.goals.filter((g) => g.id !== id);
  saveRewards();
  updateRewardsUI();
}

function claimGoal(id) {
  const g = rewards.goals.find((x) => x.id === id);
  if (!g) return;
  if (rewards.points >= g.target) {
    // deduct points and remove goal
    rewards.points = Math.round(rewards.points - g.target);
    rewards.goals = rewards.goals.filter((x) => x.id !== id);
    saveRewards();
    updateRewardsUI();
    fireConfetti();
    alert("Goal claimed: " + g.title + " — " + g.target + " points spent.");
  } else {
    alert("Not enough points to claim this goal.");
  }
}

// --- Badge System ---
const BADGE_DEFINITIONS = [
  { id: 'first_task', name: 'First Steps', icon: '🎯', description: 'Complete your first task', requirement: (stats) => stats.tasksCompleted >= 1 },
  { id: 'task_master_5', name: 'Task Master', icon: '⭐', description: 'Complete 5 tasks', requirement: (stats) => stats.tasksCompleted >= 5 },
  { id: 'task_master_10', name: 'Dedicated', icon: '🏆', description: 'Complete 10 tasks', requirement: (stats) => stats.tasksCompleted >= 10 },
  { id: 'task_master_25', name: 'Achiever', icon: '🎖️', description: 'Complete 25 tasks', requirement: (stats) => stats.tasksCompleted >= 25 },
  { id: 'task_master_50', name: 'Champion', icon: '👑', description: 'Complete 50 tasks', requirement: (stats) => stats.tasksCompleted >= 50 },
  { id: 'streak_3', name: '3-Day Streak', icon: '🔥', description: 'Complete tasks 3 days in a row', requirement: (stats) => stats.streak >= 3 },
  { id: 'streak_7', name: 'Week Warrior', icon: '💪', description: 'Complete tasks 7 days in a row', requirement: (stats) => stats.streak >= 7 },
  { id: 'points_100', name: 'Century', icon: '💯', description: 'Earn 100 points', requirement: () => rewards.points >= 100 },
  { id: 'points_500', name: 'Point Master', icon: '💎', description: 'Earn 500 points', requirement: () => rewards.points >= 500 },
  { id: 'level_5', name: 'Rising Star', icon: '🌟', description: 'Reach level 5', requirement: (stats) => stats.level >= 5 },
];

function loadBadges() {
  const raw = localStorage.getItem(BADGES_KEY);
  if (raw) {
    try { userBadges = JSON.parse(raw); } catch(e) { userBadges = []; }
  } else {
    userBadges = [];
    saveBadges();
  }
}

function saveBadges() {
  localStorage.setItem(BADGES_KEY, JSON.stringify(userBadges));
}

function loadStats() {
  const raw = localStorage.getItem(STATS_KEY);
  if (raw) {
    try { userStats = JSON.parse(raw); } catch(e) { userStats = { tasksCompleted: 0, streak: 0, lastCompletionDate: null, level: 1, xp: 0 }; }
  } else {
    userStats = { tasksCompleted: 0, streak: 0, lastCompletionDate: null, level: 1, xp: 0 };
    saveStats();
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(userStats));
}

function checkAndUnlockBadges() {
  let newBadges = [];
  BADGE_DEFINITIONS.forEach(badge => {
    if (!userBadges.includes(badge.id) && badge.requirement(userStats)) {
      userBadges.push(badge.id);
      newBadges.push(badge);
    }
  });
  if (newBadges.length > 0) {
    saveBadges();
    newBadges.forEach(badge => {
      setTimeout(() => {
        fireConfetti();
        showBadgeNotification(badge);
      }, 300);
    });
  }
}

function showBadgeNotification(badge) {
  const notification = document.createElement('div');
  notification.className = 'badge-notification';
  notification.innerHTML = `
    <div class="badge-notification-content">
      <div class="badge-notification-icon">${badge.icon}</div>
      <div class="badge-notification-text">
        <strong>Badge Unlocked!</strong><br>
        <span>${badge.name}</span>
      </div>
    </div>
  `;
  notification.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;background:white;padding:1rem;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.2);border:2px solid #ffd700;animation:slideInRight 0.5s ease;';
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.5s ease';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function updateBadgesUI() {
  const container = document.getElementById('badges-container');
  if (!container) return;
  container.innerHTML = '';
  BADGE_DEFINITIONS.slice(0, 6).forEach(badge => {
    const unlocked = userBadges.includes(badge.id);
    const badgeEl = document.createElement('div');
    badgeEl.className = `badge-item ${unlocked ? 'unlocked' : 'locked'}`;
    badgeEl.title = badge.description;
    badgeEl.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">${badge.name}</div>
    `;
    container.appendChild(badgeEl);
  });
}

function updatePointsDisplay() {
  const pointsElements = document.querySelectorAll('#nav-points-value, #points-badge, #rewards-points, #account-points');
  pointsElements.forEach(el => {
    if (el) el.textContent = rewards.points || 0;
  });
}

function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

function incrementTaskCompletion() {
  const today = new Date().toDateString();
  const lastDate = userStats.lastCompletionDate ? new Date(userStats.lastCompletionDate).toDateString() : null;
  
  userStats.tasksCompleted++;
  userStats.xp += 10;
  
  // Check level up (every 100 XP = 1 level)
  const newLevel = Math.floor(userStats.xp / 100) + 1;
  if (newLevel > userStats.level) {
    userStats.level = newLevel;
    fireConfetti();
    alert(`🎉 Level Up! You are now level ${userStats.level}!`);
  }
  
  // Update streak
  if (lastDate === today) {
    // Same day, don't change streak
  } else if (lastDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === lastDate) {
      userStats.streak++;
    } else {
      userStats.streak = 1;
    }
  } else {
    userStats.streak = 1;
  }
  
  userStats.lastCompletionDate = new Date().toISOString();
  saveStats();
  checkAndUnlockBadges();
}

// Sorting functions
function sortTasksByPriority(board, column) {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  if (!board.cards) return;
  
  const columnCards = board.cards.filter(c => c.column === column);
  const otherCards = board.cards.filter(c => c.column !== column);
  
  columnCards.sort((a, b) => {
    const priorityA = priorityOrder[a.priority || 'medium'];
    const priorityB = priorityOrder[b.priority || 'medium'];
    return priorityA - priorityB;
  });
  
  board.cards = [...columnCards, ...otherCards];
  save();
  renderBoardColumns(board);
}

function sortTasksByDate(board, column) {
  if (!board.cards) return;
  
  const columnCards = board.cards.filter(c => c.column === column);
  const otherCards = board.cards.filter(c => c.column !== column);
  
  columnCards.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  board.cards = [...columnCards, ...otherCards];
  save();
  renderBoardColumns(board);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

function id() {
  return "b_" + Math.random().toString(36).slice(2, 9);
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function render() {
  const gallery = $("#boards-gallery");
  if (!gallery) return;
  gallery.innerHTML = "";
  if (boards.length === 0) {
    gallery.innerHTML = '<div class="text-muted">No boards yet.</div>';
    return;
  }
  boards.forEach((b) => {
    const a = document.createElement("a");
    a.className = "card text-decoration-none text-dark";
    a.href = `board.html?board=${b.id}`;
    a.style.minHeight = "120px";
    a.style.position = "relative";
    // Do not apply any saved background on dashboard cards — keep cards plain for readability
    a.style.background = "";
    a.classList.remove("text-white");
    a.classList.add("text-dark");
    
    // Add color bar at top if board has a color
    if (b.background) {
      const colorBar = document.createElement("div");
      colorBar.style.cssText = `position:absolute;top:0;left:0;right:0;height:4px;background:${b.background};border-radius:6px 6px 0 0;`;
      a.appendChild(colorBar);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h5");
    title.className = "card-title mb-1";
    title.textContent = b.name;
    const meta = document.createElement("div");
    meta.className = "board-meta mb-2";
    meta.textContent = `Last updated ${formatDate(b.updatedAt)}`;
    const actions = document.createElement("div");
    actions.className = "d-flex gap-2";
    const open = document.createElement("button");
    open.className = "btn btn-sm btn-outline-primary";
    open.textContent = "Open";
    open.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = `board.html?board=${b.id}`;
    });
    const del = document.createElement("button");
    del.className = "btn btn-sm btn-danger";
    del.textContent = "Delete";
    del.style.cssText = "margin-left:auto;"; // Push delete to far right
    del.addEventListener("click", (e) => {
      e.preventDefault();
      if (!confirm('Delete board "' + b.name + '"?')) return;
      boards = boards.filter((x) => x.id !== b.id);
      save();
      render();
    });
    actions.appendChild(open);
    actions.appendChild(del);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);
    a.appendChild(body);
    gallery.appendChild(a);
  });
}

function setupForm() {
  const form = $("#new-board-form");
  if (!form) return;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $("#board-name").value.trim();
    const bgInput = document.querySelector('input[name="board-bg"]:checked');
    const background = bgInput ? bgInput.value : "";
    if (!name) return alert("Please provide a board name");
    const b = { id: id(), name, updatedAt: Date.now(), background, cards: [] };
    boards.unshift(b);
    save();
    // reset form and hide modal
    form.reset();
    const modalEl = document.getElementById("newBoardModal");
    const modal =
      bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    activeFilter = "All";
    render();
  });
}

function renderUpcomingTasks() {
  const container = document.getElementById("upcoming-tasks-container");
  const noTasksMsg = document.getElementById("no-upcoming-tasks");
  if (!container) return;
  
  // Get all tasks with due dates from all boards
  const allTasks = [];
  boards.forEach(board => {
    if (board.cards && Array.isArray(board.cards)) {
      board.cards.forEach(card => {
        if (card.dueDate && card.column !== 'done') {
          allTasks.push({
            ...card,
            boardId: board.id,
            boardName: board.name
          });
        }
      });
    }
  });
  
  // Sort by due date (earliest first)
  allTasks.sort((a, b) => {
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  // Show only upcoming tasks (limit to first 10)
  const upcomingTasks = allTasks.slice(0, 10);
  
  container.innerHTML = '';
  
  if (upcomingTasks.length === 0) {
    if (noTasksMsg) noTasksMsg.style.display = 'block';
    return;
  }
  
  if (noTasksMsg) noTasksMsg.style.display = 'none';
  
  upcomingTasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'card card-item p-2 me-3';
    card.style.minWidth = '220px';
    card.style.flex = '0 0 auto';
    card.style.cursor = 'pointer';
    
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dueDateText = dueDate.toLocaleDateString();
    let dueDateClass = 'text-muted';
    
    if (dueDate.toDateString() === today.toDateString()) {
      dueDateText = 'Due: Today';
      dueDateClass = 'text-danger fw-bold';
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      dueDateText = 'Due: Tomorrow';
      dueDateClass = 'text-warning fw-bold';
    } else if (dueDate < today) {
      dueDateText = 'Overdue!';
      dueDateClass = 'text-danger fw-bold';
    } else {
      const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      dueDateText = `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
    }
    
    card.innerHTML = `
      <div class="card-body">
        <h6 class="card-title">${escapeHtml(task.title)}</h6>
        <p class="small ${dueDateClass} mb-1">${dueDateText}</p>
        <p class="small text-muted mb-1"><i class="bi bi-folder"></i> ${escapeHtml(task.boardName)}</p>
        ${task.description ? `<p class="mb-0 small">${escapeHtml(task.description)}</p>` : ''}
      </div>
    `;
    
    card.addEventListener('click', () => {
      window.location.href = `board.html?board=${task.boardId}`;
    });
    
    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  setupForm();
  render();
  
  // Initialize points display on all pages
  loadRewards();
  updatePointsDisplay();
  updateBadgesUI();
  
  // Initialize upcoming tasks on homepage
  if (document.getElementById("upcoming-tasks-container")) {
    renderUpcomingTasks();
  }

  // wire background preview interactions
  wireBgPreview();

  // If this is a board detail page, initialize board UI
  const params = new URLSearchParams(window.location.search);
  const boardId = params.get("board");
  if (boardId && document.body.id === "page-board") {
    initBoardDetail(boardId);
  }

  // small helper: wire nav search to filter boards by name/team
  const search = document.getElementById("nav-search");
  if (search) {
    let t;
    search.addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        const q = search.value.trim().toLowerCase();
        if (!q) {
          activeFilter = "All";
          render();
          return;
        }
        // filter by name
        const gallery = $("#boards-gallery");
        gallery.innerHTML = "";
        const filtered = boards.filter((b) => b.name.toLowerCase().includes(q));
        if (filtered.length === 0) {
          gallery.innerHTML = '<div class="text-muted">No matches.</div>';
          return;
        }
        filtered.forEach((b) => {
          const a = document.createElement("a");
          a.className = "card text-decoration-none text-dark";
          a.href = `boards.html?board=${b.id}`;
          // Do not apply any saved background on dashboard search cards — keep plain for readability
          a.style.background = "";
          a.classList.remove("text-white");
          a.classList.add("text-dark");
          const body = document.createElement("div");
          body.className = "card-body";
          const title = document.createElement("h5");
          title.className = "card-title mb-1";
          title.textContent = b.name;
          const meta = document.createElement("div");
          meta.className = "board-meta mb-2";
          meta.textContent = `Last updated ${formatDate(b.updatedAt)}`;
          body.appendChild(title);
          body.appendChild(meta);
          a.appendChild(body);
          gallery.appendChild(a);
        });
      }, 200);
    });
  }

  // --- Rewards page wiring: load state, update UI, and wire buttons ---
  if (document.body.id === "page-rewards") {
    loadRewards();
    updateRewardsUI();

    const earnBtn = document.getElementById("earn-points");
    if (earnBtn) earnBtn.addEventListener("click", () => earnPoints(10));

    const addBtn = document.getElementById("add-goal");
    const goalInput = document.getElementById("goal-input");
    const goalTitle = document.getElementById("goal-title");
    if (addBtn && goalInput && goalTitle) {
      addBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const v = Number(goalInput.value);
        const title = (goalTitle.value || "").trim();
        if (!title) return alert("Please enter a title for the goal.");
        if (isNaN(v) || v < 1)
          return alert("Please enter a point target greater than zero.");
        addGoal(title, v);
        goalInput.value = "";
        goalTitle.value = "";
      });
    }

    // redeem catalog buttons
    Array.from(document.querySelectorAll(".redeem-btn")).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cost = Number(btn.dataset.cost || 0);
        if (tryRedeem(cost)) {
          alert("Redeemed for " + cost + " points — enjoy!");
        } else {
          alert("Not enough points to redeem this item.");
        }
      });
    });
  }

  // --- Tutorial functionality for first-time users ---
  initTutorial();
});

function wireBgPreview() {
  const preview = document.getElementById("bg-preview-large");
  const choices = Array.from(
    document.querySelectorAll('input[name="board-bg"]')
  );
  if (!preview || choices.length === 0) return;

  function applyBg(val) {
    // set as CSS background value; if value is a plain color we set backgroundColor
    if (/^url\(|^linear-gradient\(|^rgba|^rgb|^#/.test(val)) {
      preview.style.background = val;
    } else {
      preview.style.background = val;
    }
  }

  // initial apply for the checked one
  const checked = document.querySelector('input[name="board-bg"]:checked');
  if (checked) applyBg(checked.value);

  // change on selection
  choices.forEach((ch) => {
    ch.addEventListener("change", () => {
      if (ch.checked) applyBg(ch.value);
    });
    // preview on hover
    const label = ch.closest(".bg-choice");
    if (label) {
      label.addEventListener("mouseenter", () => applyBg(ch.value));
      label.addEventListener("mouseleave", () => {
        const cur = document.querySelector('input[name="board-bg"]:checked');
        if (cur) applyBg(cur.value);
      });
    }
  });

  // when modal opens, ensure preview reflects current selection
  const modalEl = document.getElementById("newBoardModal");
  if (modalEl) {
    modalEl.addEventListener("shown.bs.modal", () => {
      const cur = document.querySelector('input[name="board-bg"]:checked');
      if (cur) applyBg(cur.value);
    });
  }
}

// --- Board detail functions ---
function getBoardById(id) {
  return boards.find((b) => b.id === id);
}

function initBoardDetail(boardId) {
  const board = getBoardById(boardId);
  if (!board) {
    const root = document.getElementById("board-root");
    if (root)
      root.innerHTML =
        '<div class="alert alert-warning">Board not found.</div>';
    return;
  }
  // set title and background
  const titleEl = document.getElementById("board-title");
  if (titleEl) titleEl.textContent = board.name;
  // Do not apply the board's saved background on the board detail page in this prototype.
  // Backgrounds are still saved with the board object for gallery/preview use,
  // but we avoid applying them here to keep the detail view readable and consistent.
  // const header = document.getElementById('board-header');
  // if (header && board.background) header.style.background = board.background;

  renderBoardColumns(board);
  setupBoardInteractions(board);
}

function renderBoardColumns(board) {
  const cols = ["todo", "inprogress", "done"];
  cols.forEach((col) => {
    const list = document.getElementById("col-" + col);
    const countBadge = document.getElementById(col + "-count");
    if (!list) return;
    list.innerHTML = "";
    let items = (board.cards || []).filter((c) => c.column === col);
    
    // Auto-sort "To Do" column by due date (upcoming tasks first)
    if (col === "todo") {
      items.sort((a, b) => {
        // Tasks with no due date go to the bottom
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        // Sort by due date (earliest first)
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    }
    
    // Update count badge
    if (countBadge) countBadge.textContent = items.length;
    
    items.forEach((card) => {
      const el = document.createElement("div");
      el.className = `card-item priority-${card.priority || 'medium'}`;
      el.draggable = true;
      el.dataset.cardId = card.id;
      
      // Build card content with priority and due date
      let cardHTML = `<div><strong>${escapeHtml(card.title)}</strong></div>`;
      
      // Add priority badge
      if (card.priority) {
        cardHTML += `<div class="mt-1"><span class="priority-badge ${card.priority}">${card.priority}</span></div>`;
      }
      
      // Add due date
      if (card.dueDate) {
        const dueDate = new Date(card.dueDate);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let dueDateClass = 'due-date';
        if (dueDate < today) dueDateClass += ' overdue';
        else if (dueDate <= tomorrow) dueDateClass += ' due-soon';
        
        cardHTML += `<div class="${dueDateClass}"><i class="bi bi-calendar-event"></i> ${dueDate.toLocaleDateString()}</div>`;
      }
      
      if (card.description) {
        cardHTML += `<div class="small text-muted mt-1">${escapeHtml(card.description)}</div>`;
      }
      
      el.innerHTML = cardHTML;
      
      // attach drag handlers
      el.addEventListener("dragstart", onDragStart);
      el.addEventListener("dragend", onDragEnd);

      // If the card is in the done column, show a redeem button (if not redeemed)
      if (col === "done") {
        const btnWrap = document.createElement("div");
        btnWrap.className = "mt-2";
        const btn = document.createElement("button");
        btn.className = "btn btn-sm btn-success";
        const REWARD_PER_TASK = 10; // points per redeemed completed task
        if (card.redeemed) {
          btn.textContent = "Redeemed";
          btn.disabled = true;
          btn.classList.add("btn-outline-success");
          btn.classList.remove("btn-success");
        } else {
          btn.textContent = `Redeem +${REWARD_PER_TASK} pts`;
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            // prevent double-redeem
            if (card.redeemed) return;
            // award points and mark card redeemed
            try {
              earnPoints(REWARD_PER_TASK);
              incrementTaskCompletion();
              updatePointsDisplay();
              updateBadgesUI();
              fireConfetti();
            } catch (err) {
              console.error("Error awarding points", err);
            }
            card.redeemed = true;
            // persist boards and update UI
            save();
            // update button state
            btn.textContent = "Redeemed";
            btn.disabled = true;
            btn.classList.add("btn-outline-success");
            btn.classList.remove("btn-success");
            // refresh goals UI if rewards panel exists
            if (typeof updateRewardsUI === "function") updateRewardsUI();
          });
        }
        btnWrap.appendChild(btn);
        el.appendChild(btnWrap);
      }

      list.appendChild(el);
    });
  });
}

function setupBoardInteractions(board) {
  // Single add task form
  const addTaskForm = document.getElementById("add-task-form");
  if (addTaskForm) {
    addTaskForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const titleInput = document.getElementById("new-task-title");
      const descInput = document.getElementById("new-task-desc");
      const prioritySelect = document.getElementById("new-task-priority");
      const dueDateInput = document.getElementById("new-task-duedate");
      
      const title = titleInput.value.trim();
      const description = descInput ? descInput.value.trim() : "";
      const priority = prioritySelect ? prioritySelect.value : "medium";
      const dueDate = dueDateInput ? dueDateInput.value : null;
      
      if (!title) return;
      
      // Always add new tasks to "To Do" column
      const card = {
        id: "c_" + Math.random().toString(36).slice(2, 9),
        title,
        description,
        column: "todo",
        priority,
        dueDate,
        createdAt: Date.now()
      };
      
      board.cards = board.cards || [];
      board.cards.push(card);
      board.updatedAt = Date.now();
      save();
      renderBoardColumns(board);
      
      // Clear form
      titleInput.value = "";
      if (descInput) descInput.value = "";
      if (dueDateInput) dueDateInput.value = "";
      if (prioritySelect) prioritySelect.value = "medium";
    });
  }

  // Sort buttons
  $all(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const col = btn.dataset.col;
      const sortType = btn.dataset.sort;
      if (sortType === 'priority') {
        sortTasksByPriority(board, col);
      } else if (sortType === 'date') {
        sortTasksByDate(board, col);
      }
    });
  });

  // columns dragover/drop
  $all(".board-column").forEach((colEl) => {
    colEl.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      colEl.classList.add("drag-over");
    });
    colEl.addEventListener("dragleave", (ev) => {
      colEl.classList.remove("drag-over");
    });
    colEl.addEventListener("drop", (ev) => {
      ev.preventDefault();
      colEl.classList.remove("drag-over");
      const cardId = ev.dataTransfer.getData("text/plain");
      moveCardToColumn(board, cardId, colEl.dataset.col);
    });
  });
}

function onDragStart(ev) {
  const id = this.dataset.cardId;
  ev.dataTransfer.setData("text/plain", id);
  this.classList.add("dragging");
}
function onDragEnd(ev) {
  this.classList.remove("dragging");
}

function moveCardToColumn(board, cardId, targetColumn) {
  const card = (board.cards || []).find((c) => c.id === cardId);
  if (!card) return;
  card.column = targetColumn;
  board.updatedAt = Date.now();
  save();
  renderBoardColumns(board);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

// --- Tutorial functions ---
function initTutorial() {
  // Only run on home page
  if (document.body.id !== "page-home") return;

  const tutorialModal = document.getElementById("tutorialModal");
  if (!tutorialModal) return;

  // Check if user has completed tutorial
  const hasCompleted = localStorage.getItem(TUTORIAL_COMPLETED);

  // Show tutorial for first-time users
  if (!hasCompleted) {
    const modal = new bootstrap.Modal(tutorialModal);
    modal.show();
    setupTutorialNavigation();
  }
}

function setupTutorialNavigation() {
  const nextBtn = document.getElementById("tutorial-next");
  const prevBtn = document.getElementById("tutorial-prev");
  const skipBtn = document.getElementById("tutorial-skip");
  const finishBtn = document.getElementById("tutorial-finish");
  const progressBadge = document.getElementById("tutorial-progress");
  const totalSteps = 4;

  if (!nextBtn || !prevBtn || !skipBtn || !finishBtn || !progressBadge) return;

  // Next button
  nextBtn.addEventListener("click", () => {
    if (currentTutorialStep < totalSteps) {
      showTutorialStep(currentTutorialStep + 1);
    }
  });

  // Previous button
  prevBtn.addEventListener("click", () => {
    if (currentTutorialStep > 1) {
      showTutorialStep(currentTutorialStep - 1);
    }
  });

  // Skip button
  skipBtn.addEventListener("click", () => {
    completeTutorial();
  });

  // Finish button
  finishBtn.addEventListener("click", () => {
    completeTutorial();
  });
}

function showTutorialStep(stepNumber) {
  const totalSteps = 4;
  const prevBtn = document.getElementById("tutorial-prev");
  const nextBtn = document.getElementById("tutorial-next");
  const finishBtn = document.getElementById("tutorial-finish");
  const progressBadge = document.getElementById("tutorial-progress");

  // Hide all steps
  for (let i = 1; i <= totalSteps; i++) {
    const step = document.getElementById(`tutorial-step-${i}`);
    if (step) step.classList.add("d-none");
  }

  // Show current step
  const currentStep = document.getElementById(`tutorial-step-${stepNumber}`);
  if (currentStep) currentStep.classList.remove("d-none");

  // Update current step tracker
  currentTutorialStep = stepNumber;

  // Update progress badge
  if (progressBadge)
    progressBadge.textContent = `${stepNumber} of ${totalSteps}`;

  // Update button visibility
  if (prevBtn) prevBtn.style.display = stepNumber > 1 ? "inline-block" : "none";
  if (nextBtn)
    nextBtn.style.display = stepNumber < totalSteps ? "inline-block" : "none";
  if (finishBtn)
    finishBtn.style.display =
      stepNumber === totalSteps ? "inline-block" : "none";
}

function completeTutorial() {
  localStorage.setItem(TUTORIAL_COMPLETED, "true");
  const tutorialModal = document.getElementById("tutorialModal");
  if (tutorialModal) {
    const modal = bootstrap.Modal.getInstance(tutorialModal);
    if (modal) modal.hide();
  }
  currentTutorialStep = 1;
}

// Function to reset tutorial (can be called from account page)
function resetTutorial() {
  localStorage.removeItem(TUTORIAL_COMPLETED);
  currentTutorialStep = 1;
  alert("Tutorial reset! Refresh the home page to see it again.");
}
