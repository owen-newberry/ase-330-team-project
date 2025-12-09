// Simple client-side boards manager: create, list, filter, persist to localStorage
const STORAGE_KEY = 'prod_boards_v1';
const REWARDS_KEY = 'prod_rewards_v1';
const STREAK_KEY = 'prod_streak_v1';
const BADGES_KEY = 'prod_badges_v1';
const STATS_KEY = 'prod_stats_v1';
const CLAIMED_REWARDS_KEY = 'prod_claimed_rewards_v1';
const HAS_VISITED = 'has_visited_site';
const TUTORIAL_COMPLETED = 'tutorial_completed';

let boards = [];
let activeFilter = 'All';
let currentCalendarMonth = new Date();
let currentTutorialStep = 1;
let userBadges = [];
let userStats = { tasksCompleted: 0, streak: 0, lastCompletionDate: null, level: 1, xp: 0 };
let currentBoard = null; // Track the currently viewed board

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

// Achievements definitions (used on home/account pages)
// Now with tiered progression: bronze -> silver -> gold
const ACHIEVEMENTS = [
  // Task completion tiers
  { id: 'tasks_bronze', title: 'Task Rookie', icon: '🎯', tier: 'bronze', category: 'tasks', desc: 'Complete 1 task', check: (stats) => stats.totalCompleted >= 1 },
  { id: 'tasks_silver', title: 'Task Veteran', icon: '🎯', tier: 'silver', category: 'tasks', desc: 'Complete 25 tasks', check: (stats) => stats.totalCompleted >= 25 },
  { id: 'tasks_gold', title: 'Task Master', icon: '🎯', tier: 'gold', category: 'tasks', desc: 'Complete 100 tasks', check: (stats) => stats.totalCompleted >= 100 },
  
  // Board creation tiers
  { id: 'boards_bronze', title: 'Organizer', icon: '📋', tier: 'bronze', category: 'boards', desc: 'Create 1 board', check: (stats) => stats.totalBoards >= 1 },
  { id: 'boards_silver', title: 'Project Pro', icon: '📋', tier: 'silver', category: 'boards', desc: 'Create 5 boards', check: (stats) => stats.totalBoards >= 5 },
  { id: 'boards_gold', title: 'Board Boss', icon: '📋', tier: 'gold', category: 'boards', desc: 'Create 10 boards', check: (stats) => stats.totalBoards >= 10 },
  
  // Points earning tiers
  { id: 'points_bronze', title: 'Point Starter', icon: '💰', tier: 'bronze', category: 'points', desc: 'Earn 50 points', check: (stats) => stats.totalPoints >= 50 },
  { id: 'points_silver', title: 'Point Collector', icon: '💰', tier: 'silver', category: 'points', desc: 'Earn 250 points', check: (stats) => stats.totalPoints >= 250 },
  { id: 'points_gold', title: 'Point Hoarder', icon: '💰', tier: 'gold', category: 'points', desc: 'Earn 1000 points', check: (stats) => stats.totalPoints >= 1000 },
  
  // Streak tiers
  { id: 'streak_bronze', title: 'Getting Started', icon: '🔥', tier: 'bronze', category: 'streak', desc: '3 day streak', check: (stats) => stats.streak >= 3 },
  { id: 'streak_silver', title: 'Week Warrior', icon: '🔥', tier: 'silver', category: 'streak', desc: '7 day streak', check: (stats) => stats.streak >= 7 },
  { id: 'streak_gold', title: 'Streak Legend', icon: '🔥', tier: 'gold', category: 'streak', desc: '30 day streak', check: (stats) => stats.streak >= 30 }
];

// Tier styling helpers
const TIER_STYLES = {
  bronze: { bg: '#cd7f32', color: '#fff', label: 'Bronze' },
  silver: { bg: '#c0c0c0', color: '#333', label: 'Silver' },
  gold: { bg: 'linear-gradient(135deg, #ffd700, #ffec8b)', color: '#333', label: 'Gold' }
};

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
  
  // Only show achievements that are actually unlocked
  const categories = ['tasks', 'boards', 'points', 'streak'];
  let hasAnyUnlocked = false;
  
  categories.forEach(cat => {
    const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
    // Find highest unlocked tier only - don't show locked ones
    let toShow = catAchievements.find(a => a.check(stats) && a.tier === 'gold') ||
                 catAchievements.find(a => a.check(stats) && a.tier === 'silver') ||
                 catAchievements.find(a => a.check(stats) && a.tier === 'bronze');
    
    if (toShow) {
      hasAnyUnlocked = true;
      const tierStyle = TIER_STYLES[toShow.tier];
      const badge = document.createElement('div');
      badge.className = 'badge-achievement badge-tier-' + toShow.tier;
      badge.title = `${toShow.desc} (${tierStyle.label})`;
      badge.innerHTML = `
        <span class="badge-icon">${toShow.icon}</span>
        <span class="badge-info">
          <span class="badge-title">${toShow.title}</span>
          <span class="badge-tier" style="background: ${tierStyle.bg}; color: ${tierStyle.color};">${tierStyle.label}</span>
        </span>
      `;
      container.appendChild(badge);
    }
  });
  
  // Show message if no achievements unlocked yet
  if (!hasAnyUnlocked) {
    container.innerHTML = '<p class="text-muted small mb-0">Complete tasks, create boards, and build streaks to unlock achievements!</p>';
  }
}

// Render full achievements page
function renderAchievementsPage() {
  const grid = document.getElementById('achievements-grid');
  const unlockedEl = document.getElementById('achievements-unlocked');
  const totalEl = document.getElementById('achievements-total');
  
  if (!grid) return;
  
  const stats = getStats();
  let unlockedCount = 0;
  
  grid.innerHTML = '';
  
  // Group by category for better display
  const categories = [
    { key: 'tasks', label: 'Task Completion', icon: '✅' },
    { key: 'boards', label: 'Board Creation', icon: '📋' },
    { key: 'points', label: 'Points Earning', icon: '⭐' },
    { key: 'streak', label: 'Daily Streaks', icon: '🔥' }
  ];
  
  categories.forEach(cat => {
    const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat.key);
    
    // Category header
    const headerCol = document.createElement('div');
    headerCol.className = 'col-12 mt-3';
    headerCol.innerHTML = `<h6 class="text-muted">${cat.icon} ${cat.label}</h6>`;
    grid.appendChild(headerCol);
    
    catAchievements.forEach(ach => {
      const unlocked = ach.check(stats);
      if (unlocked) unlockedCount++;
      
      const tierStyle = TIER_STYLES[ach.tier];
      const col = document.createElement('div');
      col.className = 'col-md-4';
      
      col.innerHTML = `
        <div class="card h-100 ${unlocked ? '' : 'opacity-50'}" style="border-left: 4px solid ${tierStyle.bg.includes('gradient') ? '#ffd700' : tierStyle.bg};">
          <div class="card-body">
            <div class="d-flex align-items-center mb-2">
              <span class="fs-3 me-2">${ach.icon}</span>
              <div>
                <h6 class="mb-0">${ach.title}</h6>
                <span class="badge" style="background: ${tierStyle.bg}; color: ${tierStyle.color}; font-size: 0.7rem;">${tierStyle.label}</span>
              </div>
              ${unlocked ? '<i class="bi bi-check-circle-fill text-success ms-auto fs-4"></i>' : '<i class="bi bi-lock-fill text-muted ms-auto fs-4"></i>'}
            </div>
            <p class="small text-muted mb-0">${ach.desc}</p>
          </div>
        </div>
      `;
      
      grid.appendChild(col);
    });
  });
  
  if (unlockedEl) unlockedEl.textContent = unlockedCount;
  if (totalEl) totalEl.textContent = ACHIEVEMENTS.length;
  
  // Update stats
  const statCompleted = document.getElementById('ach-stat-completed');
  const statBoards = document.getElementById('ach-stat-boards');
  const statPoints = document.getElementById('ach-stat-points');
  const statStreak = document.getElementById('ach-stat-streak');
  
  if (statCompleted) statCompleted.textContent = stats.totalCompleted;
  if (statBoards) statBoards.textContent = stats.totalBoards;
  if (statPoints) statPoints.textContent = stats.totalPoints;
  if (statStreak) statStreak.textContent = stats.streak + ' days';
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

// Render boards gallery on home page
function renderHomeBoardsGallery() {
  const gallery = document.getElementById('home-boards-gallery');
  const noBoards = document.getElementById('no-boards-message');
  if (!gallery) return;
  
  gallery.innerHTML = '';
  
  if (boards.length === 0) {
    if (noBoards) noBoards.style.display = '';
    return;
  }
  
  if (noBoards) noBoards.style.display = 'none';
  
  boards.forEach(b => {
    const cardCount = (b.cards || []).length;
    const todoCount = (b.cards || []).filter(c => c.column === 'todo').length;
    const inProgressCount = (b.cards || []).filter(c => c.column === 'inprogress').length;
    const doneCount = (b.cards || []).filter(c => c.column === 'done').length;
    
    const a = document.createElement('a');
    a.href = `board.html?board=${b.id}`;
    a.className = 'card card-item p-2 me-3 text-decoration-none text-dark';
    a.style.minWidth = '200px';
    a.style.flex = '0 0 auto';
    
    a.innerHTML = `
      <div class="card-body">
        <h6 class="card-title">${escapeHtml(b.name)}</h6>
        <p class="small text-muted mb-0">📋 ${todoCount} · 🔄 ${inProgressCount} · ✅ ${doneCount}</p>
      </div>
    `;
    
    gallery.appendChild(a);
  });
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
  
  // Empty cells before first day (with other-month styling)
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day other-month';
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
      taskEl.className = `calendar-task priority-${task.priority || 'low'}`;
      taskEl.style.cursor = 'pointer';
      // Format time (e.g., "2:30 PM")
      const dueTime = new Date(task.dueDate);
      const timeStr = dueTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      taskEl.innerHTML = `${escapeHtml(task.title)} <span class="calendar-task-time">${timeStr}</span>`;
      taskEl.title = `${task.title} at ${timeStr} (${task.boardName}) - Click to view`;
      // Navigate to task detail on click
      taskEl.addEventListener('click', () => {
        window.location.href = `board.html?board=${task.boardId}&task=${task.id}`;
      });
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
    // Start with empty boards
    boards = [];
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
  // Update points display in navbar (all pages) - check both ID variants for consistency
  const navPtsEl = document.getElementById('nav-points');
  const navPtsVal = document.getElementById('nav-points-value');
  if (navPtsEl) navPtsEl.textContent = String(rewards.points);
  if (navPtsVal) navPtsVal.textContent = String(rewards.points);
  
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

// Claimed rewards history
function loadClaimedRewards() {
  const raw = localStorage.getItem(CLAIMED_REWARDS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) { return []; }
  }
  return [];
}

function saveClaimedReward(title, points) {
  const claimed = loadClaimedRewards();
  claimed.unshift({
    id: 'cr_' + Math.random().toString(36).slice(2, 8),
    title,
    points,
    claimedAt: new Date().toISOString()
  });
  localStorage.setItem(CLAIMED_REWARDS_KEY, JSON.stringify(claimed));
}

function renderClaimedRewards() {
  const container = document.getElementById('claimed-rewards-list');
  if (!container) return;
  
  const claimed = loadClaimedRewards();
  
  if (claimed.length === 0) {
    container.innerHTML = `
      <div class="text-muted text-center py-3">
        <i class="bi bi-trophy fs-1 opacity-50"></i>
        <p class="mb-0 mt-2">No rewards claimed yet. Complete goals to see them here!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = claimed.map(r => `
    <div class="d-flex justify-content-between align-items-center p-2 mb-2 rounded" style="background: rgba(102, 126, 234, 0.1);">
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <div class="small text-muted">${new Date(r.claimedAt).toLocaleDateString()}</div>
      </div>
      <span class="badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">${r.points} pts</span>
    </div>
  `).join('');
}

function updateRewardsStats() {
  const claimed = loadClaimedRewards();
  const statRedeemed = document.getElementById('stat-redeemed');
  const statGoalsClaimed = document.getElementById('stat-goals-claimed');
  const statTotalEarned = document.getElementById('stat-total-earned');
  
  // Count redeemed tasks
  let redeemedCount = 0;
  boards.forEach(b => {
    (b.cards || []).forEach(c => {
      if (c.redeemed) redeemedCount++;
    });
  });
  
  // Calculate total earned (current points + spent on goals)
  const totalSpentOnGoals = claimed.reduce((sum, r) => sum + (r.points || 0), 0);
  const totalEarned = rewards.points + totalSpentOnGoals;
  
  if (statRedeemed) statRedeemed.textContent = redeemedCount;
  if (statGoalsClaimed) statGoalsClaimed.textContent = claimed.length;
  if (statTotalEarned) statTotalEarned.textContent = totalEarned;
}

function claimGoal(id) {
  const g = rewards.goals.find((x) => x.id === id);
  if (!g) return;
  if (rewards.points >= g.target) {
    // Save to claimed rewards history
    saveClaimedReward(g.title, g.target);
    // deduct points and remove goal
    rewards.points = Math.round(rewards.points - g.target);
    rewards.goals = rewards.goals.filter((x) => x.id !== id);
    saveRewards();
    updateRewardsUI();
    renderClaimedRewards();
    updateRewardsStats();
    fireConfetti();
    alert("🎉 Goal claimed: " + g.title + " — " + g.target + " points spent!");
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
  const stats = getStats();
  let newBadges = [];
  
  // Check all achievements from the ACHIEVEMENTS array
  ACHIEVEMENTS.forEach(achievement => {
    if (!userBadges.includes(achievement.id) && achievement.check(stats)) {
      userBadges.push(achievement.id);
      newBadges.push({
        id: achievement.id,
        name: achievement.title,
        icon: achievement.icon,
        tier: achievement.tier,
        description: achievement.desc
      });
    }
  });
  
  if (newBadges.length > 0) {
    saveBadges();
    newBadges.forEach((badge, index) => {
      setTimeout(() => {
        fireConfetti();
        showBadgeNotification(badge);
      }, 300 + (index * 500)); // Stagger notifications if multiple unlock at once
    });
  }
}

function showBadgeNotification(badge) {
  const tierStyle = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
  const notification = document.createElement('div');
  notification.className = 'badge-notification';
  
  // Determine border color based on tier
  let borderColor = '#cd7f32'; // bronze default
  if (badge.tier === 'silver') borderColor = '#c0c0c0';
  if (badge.tier === 'gold') borderColor = '#ffd700';
  
  notification.innerHTML = `
    <div class="badge-notification-content">
      <div class="badge-notification-icon">${badge.icon}</div>
      <div class="badge-notification-text">
        <strong>Achievement Unlocked!</strong><br>
        <span>${badge.name}</span>
        <span class="badge-tier tier-${badge.tier}" style="font-size: 0.7rem; margin-left: 8px;">${tierStyle.label}</span>
      </div>
    </div>
  `;
  notification.style.cssText = `position:fixed;top:20px;right:20px;z-index:10000;background:white;padding:1rem;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.2);border:2px solid ${borderColor};animation:slideInRight 0.5s ease;`;
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
  const pointsElements = document.querySelectorAll('#nav-points, #nav-points-value, #points-badge, #rewards-points, #account-points');
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
function sortTasksByPriority(column) {
  if (!currentBoard || !currentBoard.cards) return;
  const board = currentBoard;
  
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, '': 4 };
  
  const columnCards = board.cards.filter(c => c.column === column);
  const otherCards = board.cards.filter(c => c.column !== column);
  
  columnCards.sort((a, b) => {
    const priorityA = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 4;
    const priorityB = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 4;
    return priorityA - priorityB;
  });
  
  board.cards = [...otherCards, ...columnCards];
  board.updatedAt = Date.now();
  
  // Update the board in the global boards array
  const idx = boards.findIndex(b => b.id === board.id);
  if (idx !== -1) boards[idx] = board;
  
  save();
  renderBoardColumns(board);
  // Update button states after a microtask to ensure DOM is ready
  setTimeout(() => updateSortButtonStates(column, 'priority'), 0);
}

function sortTasksByDate(column) {
  if (!currentBoard || !currentBoard.cards) return;
  const board = currentBoard;
  
  const columnCards = board.cards.filter(c => c.column === column);
  const otherCards = board.cards.filter(c => c.column !== column);
  
  columnCards.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  board.cards = [...otherCards, ...columnCards];
  board.updatedAt = Date.now();
  
  // Update the board in the global boards array
  const idx = boards.findIndex(b => b.id === board.id);
  if (idx !== -1) boards[idx] = board;
  
  save();
  renderBoardColumns(board);
  // Update button states after a microtask to ensure DOM is ready
  setTimeout(() => updateSortButtonStates(column, 'date'), 0);
}

// Update sort button visual states
function updateSortButtonStates(column, activeSort) {
  // Reset all buttons in this column
  $all(`.sort-btn[data-col="${column}"]`).forEach(btn => {
    btn.classList.remove('btn-primary', 'active');
    btn.classList.add('btn-outline-secondary');
  });
  // Highlight the active one
  const activeBtn = document.querySelector(`.sort-btn[data-col="${column}"][data-sort="${activeSort}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('btn-outline-secondary');
    activeBtn.classList.add('btn-primary', 'active');
  }
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

// Parse flexible time input (e.g., "1400", "800", "9:00", "2:30", "14:00") and AM/PM to 24hr format
function parseTimeInput(timeStr, ampm) {
  if (!timeStr || !timeStr.trim()) return null;
  let cleaned = timeStr.trim().replace(/[^0-9:]/g, '');
  if (!cleaned) return null;
  
  let hours, minutes;
  
  if (cleaned.includes(':')) {
    // Format like "9:00" or "14:30"
    const parts = cleaned.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10) || 0;
  } else if (cleaned.length <= 2) {
    // Format like "9" or "14" (just hours)
    hours = parseInt(cleaned, 10);
    minutes = 0;
  } else if (cleaned.length === 3) {
    // Format like "800" or "930"
    hours = parseInt(cleaned.slice(0, 1), 10);
    minutes = parseInt(cleaned.slice(1), 10);
  } else if (cleaned.length >= 4) {
    // Format like "1400" or "0900"
    hours = parseInt(cleaned.slice(0, 2), 10);
    minutes = parseInt(cleaned.slice(2, 4), 10);
  }
  
  if (isNaN(hours) || hours < 0 || hours > 23) return null;
  if (isNaN(minutes) || minutes < 0 || minutes > 59) return null;
  
  // If hours > 12, it's already 24hr format, ignore AM/PM
  if (hours <= 12 && ampm) {
    if (ampm === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
  }
  
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

// Convert 24hr time to 12hr format with AM/PM
function to12HourFormat(hours24) {
  const h = parseInt(hours24, 10);
  if (h === 0) return { time: '12:00', ampm: 'AM' };
  if (h === 12) return { time: '12:00', ampm: 'PM' };
  if (h > 12) return { time: (h - 12) + ':' + String(parseInt(hours24.split(':')[1] || 0, 10)).padStart(2, '0'), ampm: 'PM' };
  return { time: h + ':' + String(parseInt(hours24.split(':')[1] || 0, 10)).padStart(2, '0'), ampm: 'AM' };
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
    a.style.overflow = 'visible';

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
    
    // 3-dot dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown position-absolute';
    dropdown.style.top = '8px';
    dropdown.style.right = '8px';
    dropdown.style.zIndex = '10';
    
    const dropdownBtn = document.createElement('button');
    dropdownBtn.className = 'btn btn-sm btn-light border-0';
    dropdownBtn.type = 'button';
    dropdownBtn.setAttribute('data-bs-toggle', 'dropdown');
    dropdownBtn.setAttribute('data-bs-auto-close', 'true');
    dropdownBtn.setAttribute('aria-expanded', 'false');
    dropdownBtn.innerHTML = '<i class="bi bi-three-dots-vertical"></i>';
    dropdownBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    
    const dropdownMenu = document.createElement('ul');
    dropdownMenu.className = 'dropdown-menu dropdown-menu-end shadow';
    dropdownMenu.addEventListener('click', (e) => { e.stopPropagation(); });
    
    // Open option
    const openLi = document.createElement('li');
    const openLink = document.createElement('a');
    openLink.className = 'dropdown-item';
    openLink.href = '#';
    openLink.innerHTML = '<i class="bi bi-folder2-open me-2"></i>Open';
    openLink.addEventListener('click', (e) => { 
      e.preventDefault(); 
      e.stopPropagation();
      window.location.href = `board.html?board=${b.id}`; 
    });
    openLi.appendChild(openLink);
    
    // Edit/Rename option
    const editLi = document.createElement('li');
    const editLink = document.createElement('a');
    editLink.className = 'dropdown-item';
    editLink.href = '#';
    editLink.innerHTML = '<i class="bi bi-pencil me-2"></i>Rename';
    editLink.addEventListener('click', (e) => { 
      e.preventDefault(); 
      e.stopPropagation();
      const newName = prompt('Enter new name for board:', b.name);
      if (newName && newName.trim()) {
        b.name = newName.trim();
        b.updatedAt = Date.now();
        save();
        render();
      }
    });
    editLi.appendChild(editLink);
    
    // Divider
    const dividerLi = document.createElement('li');
    dividerLi.innerHTML = '<hr class="dropdown-divider">';
    
    // Delete option
    const deleteLi = document.createElement('li');
    const deleteLink = document.createElement('a');
    deleteLink.className = 'dropdown-item text-danger';
    deleteLink.href = '#';
    deleteLink.innerHTML = '<i class="bi bi-trash me-2"></i>Delete';
    deleteLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Delete board "'+b.name+'"?')) return; 
      boards = boards.filter(x=>x.id!==b.id); 
      save(); 
      render();
    });
    deleteLi.appendChild(deleteLink);
    
    dropdownMenu.appendChild(openLi);
    dropdownMenu.appendChild(editLi);
    dropdownMenu.appendChild(dividerLi);
    dropdownMenu.appendChild(deleteLi);
    dropdown.appendChild(dropdownBtn);
    dropdown.appendChild(dropdownMenu);

    body.appendChild(title);
    body.appendChild(stats);
    body.appendChild(meta);
    a.appendChild(dropdown);
    a.appendChild(body);
    gallery.appendChild(a);
  });
  
  // Note: Create board button is now in the HTML below the gallery
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
    
    // Priority badge HTML
    const priorityBadge = task.priority 
      ? `<span class="priority-badge priority-${task.priority}">${task.priority}</span>` 
      : '';
    
    // Points badge HTML
    const pointsBadge = task.points 
      ? `<span class="point-badge">⭐ ${task.points}</span>` 
      : '';
    
    card.innerHTML = `
      <div class="card-body">
        ${pointsBadge}
        <h6 class="card-title">${escapeHtml(task.title)}</h6>
        ${priorityBadge}
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
    renderHomeBoardsGallery();
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
          const urg = getUrgency(t.dueDate, t);
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

  // Achievements page features
  if (document.body.id === 'page-achievements') {
    renderAchievementsPage();
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
    renderClaimedRewards();

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
  
  // Set the global currentBoard reference
  currentBoard = board;
  
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
  
  // Check if we should open a specific task modal (from calendar click)
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("task");
  if (taskId) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      openTaskModal(board, taskId);
    }, 100);
  }
}

// Urgency helper: returns urgency level based on due date
// If card is provided and is done, no urgency is shown
function getUrgency(dueDate, card = null){
  if (!dueDate) return { level: 'none', label: '', class: '' };
  // If task is done, don't show urgency
  if (card && card.column === 'done') return { level: 'none', label: '', class: '' };
  
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) return { level: 'overdue', label: 'Overdue', class: 'urgency-overdue' };
  if (hoursLeft < 24) return { level: 'soon', label: 'Due Soon', class: 'urgency-soon' };
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
    
    // Update the count badge for this column
    const countEl = document.getElementById(col + '-count');
    if (countEl) countEl.textContent = items.length;
    
    items.forEach(card => {
      const el = document.createElement('div');
      el.className = 'card-item';
      el.draggable = true;
      el.dataset.cardId = card.id;

      // Urgency indicator (pass card to check if done)
      const urgency = getUrgency(card.dueDate, card);
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
        btnWrap.className = 'mt-2 d-flex justify-content-between align-items-center';
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
        removeBtn.className = 'btn btn-sm btn-danger remove-card';
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
        rm.className = 'btn btn-sm btn-danger remove-card';
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
        document.getElementById('new-task-date').value = '';
        document.getElementById('new-task-time').value = '';
        document.getElementById('new-task-ampm').value = 'AM';
        document.getElementById('new-task-priority').value = '';
        document.getElementById('new-task-points').value = '10';
      });
    }
    
    newTaskForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const column = document.getElementById('new-task-column').value;
      const title = document.getElementById('new-task-title').value.trim();
      const description = document.getElementById('new-task-desc').value.trim();
      const dateVal = document.getElementById('new-task-date').value;
      const timeVal = document.getElementById('new-task-time').value;
      const ampmVal = document.getElementById('new-task-ampm').value;
      const priority = document.getElementById('new-task-priority').value;
      const points = parseInt(document.getElementById('new-task-points').value, 10) || 10;
      if (!title) return;
      const card = { id: 'c_'+Math.random().toString(36).slice(2,9), title, description, column, priority, points };
      if (dateVal) {
        const parsedTime = parseTimeInput(timeVal, ampmVal);
        const dueDateTime = parsedTime ? `${dateVal}T${parsedTime}` : `${dateVal}T23:59`;
        card.dueDate = new Date(dueDateTime).toISOString();
      }
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

  // Wire sort buttons using event delegation on the board root
  const boardRoot = document.getElementById('board-root');
  if (boardRoot && !boardRoot.dataset.sortWired) {
    boardRoot.dataset.sortWired = 'true';
    boardRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('.sort-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const col = btn.dataset.col;
      const sortType = btn.dataset.sort;
      if (sortType === 'priority') {
        sortTasksByPriority(col);
      } else if (sortType === 'date') {
        sortTasksByDate(col);
      }
    });
  }
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
  const totalSteps = 5;

  function updateStep() {
    // Hide all steps
    for (let i = 1; i <= totalSteps; i++) {
      const step = document.getElementById(`tutorial-step-${i}`);
      if (step) step.classList.add('d-none');
    }
    // Show current step
    const currentStep = document.getElementById(`tutorial-step-${currentTutorialStep}`);
    if (currentStep) currentStep.classList.remove('d-none');
    
    // Update progress
    if (progressBadge) progressBadge.textContent = `${currentTutorialStep} of ${totalSteps}`;
    
    // Show/hide buttons
    if (prevBtn) prevBtn.style.display = currentTutorialStep > 1 ? '' : 'none';
    if (nextBtn) nextBtn.style.display = currentTutorialStep < totalSteps ? '' : 'none';
    if (finishBtn) finishBtn.style.display = currentTutorialStep === totalSteps ? '' : 'none';
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentTutorialStep < totalSteps) {
        currentTutorialStep++;
        updateStep();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentTutorialStep > 1) {
        currentTutorialStep--;
        updateStep();
      }
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      localStorage.setItem(TUTORIAL_COMPLETED, 'true');
      const modal = bootstrap.Modal.getInstance(document.getElementById('tutorialModal'));
      if (modal) modal.hide();
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      localStorage.setItem(TUTORIAL_COMPLETED, 'true');
      const modal = bootstrap.Modal.getInstance(document.getElementById('tutorialModal'));
      if (modal) modal.hide();
    });
  }

  updateStep();
}

// Reset tutorial - called from account page
function resetTutorial() {
  localStorage.removeItem(TUTORIAL_COMPLETED);
  currentTutorialStep = 1;
  alert('Tutorial reset! Visit the home page to see the tutorial again.');
}

// Show tutorial - called from navbar button
function showTutorial() {
  const tutorialModal = document.getElementById('tutorialModal');
  if (!tutorialModal) {
    alert('Tutorial is only available on the home page.');
    return;
  }
  currentTutorialStep = 1;
  setupTutorialNavigation();
  const modal = new bootstrap.Modal(tutorialModal);
  modal.show();
}

// Show page-specific tutorial/help modal
function showPageTutorial() {
  const pageTutorialModal = document.getElementById('pageTutorialModal');
  if (!pageTutorialModal) {
    alert('No help available for this page.');
    return;
  }
  const modal = new bootstrap.Modal(pageTutorialModal);
  modal.show();
}

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
  const dateInput = document.getElementById('task-edit-date');
  const timeInput = document.getElementById('task-edit-time');
  const ampmInput = document.getElementById('task-edit-ampm');
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
  if (card.dueDate) {
    const d = new Date(card.dueDate);
    dateInput.value = d.toISOString().slice(0,10);
    // Convert to 12-hour format for display
    const hours = d.getHours();
    const mins = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    timeInput.value = displayHours + ':' + String(mins).padStart(2, '0');
    ampmInput.value = ampm;
  } else {
    dateInput.value = '';
    timeInput.value = '';
    ampmInput.value = 'AM';
  }
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
    if (dateInput.value) {
      const parsedTime = parseTimeInput(timeInput.value, ampmInput.value);
      const dueDateTime = parsedTime ? `${dateInput.value}T${parsedTime}` : `${dateInput.value}T23:59`;
      c.dueDate = new Date(dueDateTime).toISOString();
    } else {
      c.dueDate = null;
    }
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

