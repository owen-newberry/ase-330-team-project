// Simple client-side boards manager: create, list, filter, persist to localStorage
const STORAGE_KEY = 'prod_boards_v1';
const REWARDS_KEY = 'prod_rewards_v1';
const STREAK_KEY = 'prod_streak_v1';
const HAS_VISITED = 'has_visited_site';
let boards = [];
let activeFilter = 'All';
let currentCalendarMonth = new Date();

// Motivational quotes
const MOTIVATIONAL_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Success is not final, failure is not fatal.", author: "Winston Churchill" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Small progress is still progress.", author: "Unknown" }
];

// Achievements definitions
const ACHIEVEMENTS = [
  { id: 'first_task', title: 'First Steps', icon: '🎯', desc: 'Complete your first task', check: (stats) => stats.totalCompleted >= 1 },
  { id: 'five_tasks', title: 'Getting Started', icon: '⭐', desc: 'Complete 5 tasks', check: (stats) => stats.totalCompleted >= 5 },
  { id: 'ten_tasks', title: 'On a Roll', icon: '🌟', desc: 'Complete 10 tasks', check: (stats) => stats.totalCompleted >= 10 },
  { id: 'fifty_tasks', title: 'Task Master', icon: '🏆', desc: 'Complete 50 tasks', check: (stats) => stats.totalCompleted >= 50 },
  { id: 'first_board', title: 'Organized', icon: '📋', desc: 'Create your first board', check: (stats) => stats.totalBoards >= 1 },
  { id: 'five_boards', title: 'Multi-tasker', icon: '📚', desc: 'Create 5 boards', check: (stats) => stats.totalBoards >= 5 },
  { id: 'hundred_points', title: 'Point Collector', icon: '💰', desc: 'Earn 100 points', check: (stats) => stats.totalPoints >= 100 },
  { id: 'streak_three', title: 'Consistent', icon: '🔥', desc: '3 day streak', check: (stats) => stats.streak >= 3 },
  { id: 'streak_seven', title: 'Week Warrior', icon: '💪', desc: '7 day streak', check: (stats) => stats.streak >= 7 }
];
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

// Streak management
function loadStreak() {
  const raw = localStorage.getItem(STREAK_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) { return { count: 0, lastDate: null }; }
  }
  return { count: 0, lastDate: null };
}

function saveStreak(streak) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

function updateStreak() {
  const streak = loadStreak();
  const today = new Date().toDateString();
  const lastDate = streak.lastDate ? new Date(streak.lastDate).toDateString() : null;
  
  if (lastDate === today) {
    // Already updated today
    return streak;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (lastDate === yesterday.toDateString()) {
    // Consecutive day
    streak.count++;
    streak.lastDate = new Date().toISOString();
  } else if (lastDate !== today) {
    // Streak broken or first time
    streak.count = 1;
    streak.lastDate = new Date().toISOString();
  }
  
  saveStreak(streak);
  return streak;
}

function getStats() {
  let totalCompleted = 0;
  let totalRedeemed = 0;
  boards.forEach(b => {
    (b.cards || []).forEach(c => {
      if (c.column === 'done') totalCompleted++;
      if (c.redeemed) totalRedeemed++;
    });
  });
  const streak = loadStreak();
  return {
    totalCompleted,
    totalRedeemed,
    totalBoards: boards.length,
    totalPoints: rewards.points,
    streak: streak.count
  };
}

function renderAchievements() {
  const container = document.getElementById('achievements-list');
  if (!container) return;
  
  const stats = getStats();
  container.innerHTML = '';
  
  ACHIEVEMENTS.forEach(ach => {
    const unlocked = ach.check(stats);
    const badge = document.createElement('div');
    badge.className = 'badge-achievement' + (unlocked ? '' : ' locked');
    badge.title = ach.desc;
    badge.innerHTML = `<span>${ach.icon}</span><span>${ach.title}</span>`;
    container.appendChild(badge);
  });
}

function renderStreak() {
  const el = document.getElementById('streak-count');
  if (!el) return;
  const streak = loadStreak();
  el.textContent = `${streak.count} day${streak.count !== 1 ? 's' : ''}`;
}

function renderMotivationalQuote() {
  const quoteEl = document.getElementById('motivational-quote');
  const authorEl = quoteEl?.parentElement?.querySelector('small');
  if (!quoteEl) return;
  
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  quoteEl.textContent = `"${quote.text}"`;
  if (authorEl) authorEl.textContent = `— ${quote.author}`;
}

// Calendar view
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('cal-month-label');
  if (!grid || !label) return;
  
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  
  label.textContent = currentCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Get all tasks with due dates
  const tasksWithDates = [];
  boards.forEach(b => {
    (b.cards || []).forEach(c => {
      if (c.dueDate) {
        tasksWithDates.push({ ...c, boardName: b.name, boardId: b.id });
      }
    });
  });
  
  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  
  grid.innerHTML = '';
  
  // Day headers
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    const header = document.createElement('div');
    header.className = 'text-center small fw-semibold py-1';
    header.style.background = 'var(--bg-spot)';
    header.textContent = day;
    grid.appendChild(header);
  });
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day';
    empty.style.opacity = '0.3';
    grid.appendChild(empty);
  }
  
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    const cellDate = new Date(year, month, day);
    if (cellDate.toDateString() === today.toDateString()) {
      cell.classList.add('today');
    }
    
    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.textContent = day;
    cell.appendChild(dayNum);
    
    // Find tasks due on this day
    const dayTasks = tasksWithDates.filter(t => {
      const dueDate = new Date(t.dueDate);
      return dueDate.getFullYear() === year && dueDate.getMonth() === month && dueDate.getDate() === day;
    });
    
    // Sort tasks by time
    dayTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    dayTasks.slice(0, 3).forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = 'calendar-task';
      // Format time (e.g., "2:30 PM")
      const dueTime = new Date(task.dueDate);
      const timeStr = dueTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      taskEl.innerHTML = `${escapeHtml(task.title)} <span class="calendar-task-time">${timeStr}</span>`;
      taskEl.title = `${task.title} at ${timeStr} (${task.boardName})`;
      cell.appendChild(taskEl);
    });
    
    if (dayTasks.length > 3) {
      const more = document.createElement('div');
      more.className = 'small text-muted';
      more.textContent = `+${dayTasks.length - 3} more`;
      cell.appendChild(more);
    }
    
    grid.appendChild(cell);
  }
}

function setupCalendarNav() {
  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');
  
  if (prev) {
    prev.addEventListener('click', () => {
      currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
      renderCalendar();
    });
  }
  
  if (next) {
    next.addEventListener('click', () => {
      currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
      renderCalendar();
    });
  }
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


function saveRewards(){ localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards)); }

function updateRewardsUI(){
  // Update points display in navbar (all pages)
  const navPtsEl = document.getElementById('nav-points');
  if (navPtsEl) navPtsEl.textContent = String(rewards.points);
  
  const ptsEl = document.getElementById('rewards-points');
  const accPtsEl = document.getElementById('account-points');
  const homePtsEl = document.getElementById('points-badge');
  const list = document.getElementById('goals-list');
  if (ptsEl) ptsEl.textContent = String(rewards.points);
  if (accPtsEl) accPtsEl.textContent = String(rewards.points);
  if (homePtsEl) homePtsEl.textContent = String(rewards.points);
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
    a.style.minHeight = '120px';
    a.style.position = 'relative';
    a.style.overflow = 'hidden';

    // Add color indicator bar on left side if board has a background
    if (b.background) {
      const colorBar = document.createElement('div');
      colorBar.className = 'board-color-indicator';
      // Extract color from background value
      let bgColor = b.background;
      if (bgColor.startsWith('url(')) {
        bgColor = '#6f42c1'; // fallback for images
      } else if (bgColor.startsWith('linear-gradient')) {
        // Extract first color from gradient
        const match = bgColor.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/);
        bgColor = match ? match[0] : '#0d6efd';
      }
      colorBar.style.background = bgColor;
      a.appendChild(colorBar);
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    body.style.paddingLeft = b.background ? '16px' : '';
    
    // Task stats for this board
    const todoCount = (b.cards||[]).filter(c=>c.column==='todo').length;
    const inProgressCount = (b.cards||[]).filter(c=>c.column==='inprogress').length;
    const doneCount = (b.cards||[]).filter(c=>c.column==='done').length;
    
    const title = document.createElement('h5');
    title.className = 'card-title mb-1';
    title.textContent = b.name;
    
    const stats = document.createElement('div');
    stats.className = 'small text-muted mb-1';
    stats.innerHTML = `<span class="me-2">📋 ${todoCount}</span><span class="me-2">🔄 ${inProgressCount}</span><span>✅ ${doneCount}</span>`;
    
    const meta = document.createElement('div');
    meta.className = 'board-meta mb-2';
    meta.textContent = `Updated ${formatDate(b.updatedAt)}`;
    const actions = document.createElement('div');
    actions.className = 'd-flex gap-2';
    const open = document.createElement('button');
    open.className = 'btn btn-sm btn-outline-primary';
    open.textContent = 'Open';
    open.addEventListener('click', (e)=>{ e.preventDefault(); window.location.href = `board.html?board=${b.id}`; });
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-outline-danger';
    del.textContent = 'Delete';
    del.addEventListener('click', (e)=>{
      e.preventDefault(); if (!confirm('Delete board "'+b.name+'"?')) return; boards = boards.filter(x=>x.id!==b.id); save(); render();
    });
    actions.appendChild(open);
    actions.appendChild(del);

    body.appendChild(title);
    body.appendChild(stats);
    body.appendChild(meta);
    body.appendChild(actions);
    a.appendChild(body);
    gallery.appendChild(a);
  });

  // Add a final card that opens the "Create new board" modal
  const createCard = document.createElement('div');
  createCard.className = 'card text-center border-dashed';
  createCard.style.minHeight = '120px';
  createCard.style.display = 'flex';
  createCard.style.alignItems = 'center';
  createCard.style.justifyContent = 'center';
  createCard.innerHTML = `
    <div class="card-body">
      <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#newBoardModal">+ Create board</button>
    </div>
  `;
  gallery.appendChild(createCard);
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
  // Ensure rewards state is loaded for all pages so points stay in sync across account/rewards/boards
  loadRewards();
  updateRewardsUI();
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
  
  // Initialize home page features (calendar, achievements, streak, quotes)
  if (document.body.id === 'page-home') {
    renderCalendar();
    setupCalendarNav();
    renderAchievements();
    renderStreak();
    renderMotivationalQuote();
    
    // Update stats on home page
    const stats = getStats();
    const todoEl = document.getElementById('stat-todo');
    const progressEl = document.getElementById('stat-progress');
    const doneEl = document.getElementById('stat-done');
    
    let todoCount = 0, inProgressCount = 0, doneCount = 0;
    boards.forEach(b => {
      (b.cards || []).forEach(c => {
        if (c.column === 'todo') todoCount++;
        else if (c.column === 'inprogress') inProgressCount++;
        else if (c.column === 'done') doneCount++;
      });
    });
    
    if (todoEl) todoEl.textContent = todoCount;
    if (progressEl) progressEl.textContent = inProgressCount;
    if (doneEl) doneEl.textContent = doneCount;

    // Upcoming tasks for the current week (across all boards)
    const upcomingEl = document.getElementById('upcoming-list');
    if (upcomingEl) {
      const now = Date.now();
      const weekAhead = now + 1000 * 60 * 60 * 24 * 7;
      const upcoming = [];
      boards.forEach(b => {
        (b.cards || []).forEach(c => {
          if (c.dueDate) {
            const t = new Date(c.dueDate).getTime();
            if (t >= now && t <= weekAhead) upcoming.push(Object.assign({}, c, { boardName: b.name, boardId: b.id }));
          }
        });
      });
      upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      // If fewer than targetCount upcoming items, include the next nearest due tasks (beyond the week)
      const TARGET_COUNT = 5;
      if (upcoming.length < TARGET_COUNT) {
        // collect candidate future tasks (after weekAhead) not already included
        const includedIds = new Set(upcoming.map(x=>x.id));
        const futureCandidates = [];
        boards.forEach(b => {
          (b.cards || []).forEach(c => {
            if (c.dueDate) {
              const t = new Date(c.dueDate).getTime();
              if (t > weekAhead && !includedIds.has(c.id)) {
                futureCandidates.push(Object.assign({}, c, { boardName: b.name, boardId: b.id }));
              }
            }
          });
        });
        futureCandidates.sort((a,b)=> new Date(a.dueDate) - new Date(b.dueDate));
        for (let i=0; i<futureCandidates.length && upcoming.length < TARGET_COUNT; i++) {
          upcoming.push(futureCandidates[i]);
        }
      }
      if (upcoming.length === 0) {
        upcomingEl.innerHTML = '<div class="text-muted">No upcoming tasks this week.</div>';
      } else {
        let html = '<div class="horizontal-gallery d-flex overflow-auto pb-2">';
        upcoming.forEach(t => {
          const urg = getUrgency(t.dueDate);
          const urgClass = urg.class ? urg.class : '';
          const urgLabel = urg.label ? escapeHtml(urg.label) : '';
          html += `
            <div class="card card-item p-2 me-3 ${urgClass}" style="min-width:220px;flex:0 0 auto;">
              <div class="card-body">
                <h6 class="card-title">${escapeHtml(t.title)}</h6>
                <p class="small text-muted mb-1">Due: ${escapeHtml(formatDate(t.dueDate))}${urgLabel ? ' — <span class="fw-semibold">'+urgLabel+'</span>' : ''}</p>
                <p class="mb-0">${escapeHtml(t.description||'')}</p>
                <div class="small text-muted mt-2">Board: ${escapeHtml(t.boardName)}</div>
              </div>
            </div>`;
        });
        html += '</div>';
        upcomingEl.innerHTML = html;
      }
    }
  }
  
  // Account page features
  if (document.body.id === 'page-account') {
    renderAchievements();
    
    // Update stats
    const stats = getStats();
    const boardsEl = document.getElementById('stat-boards');
    const completedEl = document.getElementById('stat-completed');
    const streakEl = document.getElementById('stat-streak');
    
    if (boardsEl) boardsEl.textContent = stats.totalBoards;
    if (completedEl) completedEl.textContent = stats.totalCompleted;
    if (streakEl) streakEl.textContent = stats.streak;
  }

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

// Urgency helper: returns urgency level based on due date
function getUrgency(dueDate){
  if (!dueDate) return { level: 'none', label: '', class: '' };
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) return { level: 'overdue', label: 'Overdue', class: 'urgency-overdue' };
  if (hoursLeft < 24) return { level: 'urgent', label: 'Due Today', class: 'urgency-urgent' };
  if (hoursLeft < 72) return { level: 'soon', label: 'Due Soon', class: 'urgency-soon' };
  return { level: 'normal', label: '', class: '' };
}

// Priority labels and sort order
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, undefined: 3 };

function sortCards(cards){
  return [...cards].sort((a, b) => {
    // Sort by priority first
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    // Then by due date (earliest first, no date last)
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });
}

function renderBoardColumns(board){
  const cols = ['todo','inprogress','done'];
  cols.forEach(col => {
    const list = document.getElementById('col-'+col);
    if (!list) return;
    list.innerHTML = '';
    const items = sortCards((board.cards||[]).filter(c=>c.column===col));
    items.forEach(card => {
      const el = document.createElement('div');
      el.className = 'card-item';
      el.draggable = true;
      el.dataset.cardId = card.id;

      // Urgency indicator
      const urgency = getUrgency(card.dueDate);
      if (urgency.class) el.classList.add(urgency.class);

      // Point weight badge (top-left)
      const pointWeight = card.points || 10;
      const pointBadge = `<span class="point-badge" title="${pointWeight} points">${pointWeight} pts</span>`;

      // Priority badge
      const priorityBadge = card.priority ? `<span class="priority-badge priority-${card.priority}">${card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}</span>` : '';

      // Due date with urgency label
      let dueText = '';
      if (card.dueDate) {
        const urgLabel = urgency.label ? ` <span class="urgency-label">${urgency.label}</span>` : '';
        dueText = `<div class="small text-muted">Due: ${escapeHtml(formatDate(card.dueDate))}${urgLabel}</div>`;
      }

      el.innerHTML = `${pointBadge}${priorityBadge}<div><strong>${escapeHtml(card.title)}</strong></div><div class="small text-muted">${card.description||''}</div>${dueText}`;
      // attach drag handlers
      el.addEventListener("dragstart", onDragStart);
      el.addEventListener("dragend", onDragEnd);

      // If the card is in the done column, show a redeem button (if not redeemed)
      if (col === 'done'){
        const btnWrap = document.createElement('div');
        btnWrap.className = 'mt-2';
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-success';
        const REWARD_PER_TASK = card.points || 10; // points per redeemed completed task (configurable per card)
        if (card.redeemed) {
          btn.textContent = "Redeemed";
          btn.disabled = true;
          btn.classList.add("btn-outline-success");
          btn.classList.remove("btn-success");
        } else {
          btn.textContent = `Redeem +${REWARD_PER_TASK} pts`;
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
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
        // add a remove button next to redeem so users can delete completed tasks
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger ms-2 remove-card';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', (e)=>{
          e.preventDefault(); e.stopPropagation();
          if (!confirm('Remove this task?')) return;
          board.cards = (board.cards||[]).filter(c=>c.id !== card.id);
          board.updatedAt = Date.now();
          save();
          renderBoardColumns(board);
        });
        btnWrap.appendChild(removeBtn);
        el.appendChild(btnWrap);
      }

      // open details modal when card clicked (but avoid when clicking controls)
      el.addEventListener('click', (e)=>{
        openTaskModal(board, card.id);
      });

      // add remove button for non-done cards
      if (col !== 'done'){
        const ctrlWrap = document.createElement('div');
        ctrlWrap.className = 'mt-2 d-flex justify-content-end';
        const rm = document.createElement('button');
        rm.className = 'btn btn-sm btn-outline-danger remove-card';
        rm.textContent = 'Remove';
        rm.addEventListener('click', (e)=>{
          e.preventDefault(); e.stopPropagation();
          if (!confirm('Remove this task?')) return;
          board.cards = (board.cards||[]).filter(c=>c.id !== card.id);
          board.updatedAt = Date.now();
          save();
          renderBoardColumns(board);
        });
        ctrlWrap.appendChild(rm);
        el.appendChild(ctrlWrap);
      }

      list.appendChild(el);
    });
  });
}

function setupBoardInteractions(board){
  // Wire new task form submission
  const newTaskForm = document.getElementById('new-task-form');
  if (newTaskForm) {
    // Reset form when modal opens
    const modalEl = document.getElementById('newTaskModal');
    if (modalEl) {
      modalEl.addEventListener('show.bs.modal', () => {
        document.getElementById('new-task-title').value = '';
        document.getElementById('new-task-desc').value = '';
        document.getElementById('new-task-column').value = 'todo';
        document.getElementById('new-task-duedate').value = '';
        document.getElementById('new-task-priority').value = '';
        document.getElementById('new-task-points').value = '10';
      });
    }
    
    newTaskForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const column = document.getElementById('new-task-column').value;
      const title = document.getElementById('new-task-title').value.trim();
      const description = document.getElementById('new-task-desc').value.trim();
      const dueVal = document.getElementById('new-task-duedate').value;
      const priority = document.getElementById('new-task-priority').value;
      const points = parseInt(document.getElementById('new-task-points').value, 10) || 10;
      if (!title) return;
      const card = { id: 'c_'+Math.random().toString(36).slice(2,9), title, description, column, priority, points };
      if (dueVal) card.dueDate = new Date(dueVal).toISOString();
      board.cards = board.cards || [];
      board.cards.push(card);
      board.updatedAt = Date.now();
      save();
      renderBoardColumns(board);
      const modalEl = document.getElementById('newTaskModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    });
  }

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

// --- Task details / edit / delete modal handlers ---
function findCard(board, cardId){ return (board.cards||[]).find(c=>c.id===cardId); }

function openTaskModal(board, cardId){
  const card = findCard(board, cardId);
  if (!card) return;
  const modalEl = document.getElementById('taskDetailsModal');
  if (!modalEl) return;
  // populate view
  document.getElementById('task-detail-title').textContent = card.title || '';
  document.getElementById('task-detail-desc').textContent = card.description || '';
  // human-friendly status labels
  function columnLabel(col){
    if (!col) return 'Unknown';
    const map = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
    return map[col] || String(col).replace(/[-_]/g,' ');
  }

  const statusLabel = columnLabel(card.column);
  const redeemedLabel = card.redeemed ? 'Yes' : 'No';
  document.getElementById('task-detail-meta').textContent = `Status: ${statusLabel} • Redeemed: ${redeemedLabel}`;
  const dueEl = document.getElementById('task-detail-due');
  if (card.dueDate){
    try { dueEl.textContent = 'Due: ' + formatDate(card.dueDate); dueEl.style.display = ''; }
    catch(e){ dueEl.textContent = ''; dueEl.style.display = 'none'; }
  } else { dueEl.textContent = ''; dueEl.style.display = 'none'; }

  // prepare edit form (hidden by default)
  document.getElementById('task-edit-form').style.display = 'none';
  document.getElementById('task-details-view').style.display = '';
  document.getElementById('task-edit-toggle').style.display = '';
  document.getElementById('task-delete-btn').style.display = '';
  document.getElementById('task-save-btn').style.display = 'none';

  // store current card id and board id on modal element for handlers
  modalEl.dataset.cardId = card.id;
  modalEl.dataset.boardId = board.id;

  // wire edit toggle
  const toggle = document.getElementById('task-edit-toggle');
  const saveBtn = document.getElementById('task-save-btn');
  const deleteBtn = document.getElementById('task-delete-btn');
  const editForm = document.getElementById('task-edit-form');
  const titleInput = document.getElementById('task-edit-title');
  const descInput = document.getElementById('task-edit-desc');
  const dueInput = document.getElementById('task-edit-duedate');
  const priorityInput = document.getElementById('task-edit-priority');
  const pointsInput = document.getElementById('task-edit-points');

  // ensure previous listeners are not duplicated: replace by cloning the node
  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);
  const newSave = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSave, saveBtn);
  const newDelete = deleteBtn.cloneNode(true);
  deleteBtn.parentNode.replaceChild(newDelete, deleteBtn);

  // fill inputs for edit
  titleInput.value = card.title || '';
  descInput.value = card.description || '';
  dueInput.value = card.dueDate ? new Date(card.dueDate).toISOString().slice(0,16) : '';
  if (priorityInput) priorityInput.value = card.priority || '';
  if (pointsInput) pointsInput.value = card.points || 10;

  // toggle handler
  newToggle.addEventListener('click', ()=>{
    const showingEdit = editForm.style.display !== 'none';
    if (!showingEdit){
      // show edit
      document.getElementById('task-details-view').style.display = 'none';
      editForm.style.display = '';
      newToggle.textContent = 'Cancel';
      newSave.style.display = '';
    } else {
      // cancel edit
      editForm.style.display = 'none';
      document.getElementById('task-details-view').style.display = '';
      newToggle.textContent = 'Edit';
      newSave.style.display = 'none';
    }
  });

  // save handler
  newSave.addEventListener('click', ()=>{
    const bId = modalEl.dataset.boardId;
    const cId = modalEl.dataset.cardId;
    const b = getBoardById(bId);
    if (!b) return;
    const c = findCard(b, cId);
    if (!c) return;
    c.title = titleInput.value.trim() || c.title;
    c.description = descInput.value.trim() || '';
    c.dueDate = dueInput.value ? new Date(dueInput.value).toISOString() : null;
    c.priority = priorityInput ? priorityInput.value : c.priority;
    c.points = pointsInput ? parseInt(pointsInput.value, 10) || 10 : c.points;
    b.updatedAt = Date.now();
    save();
    renderBoardColumns(b);
    // update modal view back to display mode
    document.getElementById('task-details-view').style.display = '';
    editForm.style.display = 'none';
    newToggle.textContent = 'Edit';
    newSave.style.display = 'none';
    // refresh populated fields
    openTaskModal(b, c.id);
  });

  // delete handler
  newDelete.addEventListener('click', ()=>{
    if (!confirm('Delete this task?')) return;
    const bId = modalEl.dataset.boardId;
    const cId = modalEl.dataset.cardId;
    const b = getBoardById(bId);
    if (!b) return;
    b.cards = (b.cards||[]).filter(x=>x.id!==cId);
    b.updatedAt = Date.now();
    save();
    renderBoardColumns(b);
    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    bsModal.hide();
  });

  // show modal
  const bs = bootstrap.Modal.getOrCreateInstance(modalEl);
  bs.show();
}

