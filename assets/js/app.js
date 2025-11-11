// Simple client-side boards manager: create, list, filter, persist to localStorage
(function(){
  const STORAGE_KEY = 'prod_boards_v1';
  const TEAMS_KEY = 'prod_teams_v1';
  const REWARDS_KEY = 'prod_rewards_v1';
  let boards = [];
  let teams = [];
  let activeFilter = 'All';

  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.from(document.querySelectorAll(s)); }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { boards = JSON.parse(raw); } catch(e){ boards = []; }
    } else {
      // sample seed data
      boards = [
        {id: id(), name: 'Product Board', team: 'Core Team', updatedAt: Date.now()-1000*60*60*24},
        {id: id(), name: 'Marketing', team: 'Growth', updatedAt: Date.now()-1000*60*60*5},
      ];
      save();
    }
    // load teams
    const tRaw = localStorage.getItem(TEAMS_KEY);
    if (tRaw) {
      try { teams = JSON.parse(tRaw); } catch(e){ teams = []; }
    } else {
      teams = [
        { id: 't_'+Math.random().toString(36).slice(2,8), name: 'Core Team', members:['alex@example.com'], background: '#6f42c1', updatedAt: Date.now()-1000*60*60*48 },
      ];
      saveTeams();
    }
  }

  function saveTeams(){ localStorage.setItem(TEAMS_KEY, JSON.stringify(teams)); }

  // rewards state: { points: number, goals: Array<{id,title,target}> }
  let rewards = { points: 0, goals: [] };

  function loadRewards(){
    const raw = localStorage.getItem(REWARDS_KEY);
    if (raw){
      try {
        const parsed = JSON.parse(raw);
        // migration: older shape used 'goal' number — convert to a single titled goal
        if (parsed && typeof parsed === 'object'){
          if (Array.isArray(parsed.goals)) {
            rewards = { points: Number(parsed.points||0), goals: parsed.goals };
          } else if (parsed.goal && !parsed.goals) {
            rewards = { points: Number(parsed.points||0), goals: [{ id: 'g_'+Math.random().toString(36).slice(2,8), title: 'Goal', target: Number(parsed.goal) || 0 }] };
          } else {
            rewards = { points: Number(parsed.points||0), goals: [] };
          }
        }
      } catch(e){ rewards = { points:0, goals:[] }; }
    } else {
      rewards = { points: 0, goals: [] };
      saveRewards();
    }
  }

  function saveRewards(){ localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards)); }

  function updateRewardsUI(){
    const ptsEl = document.getElementById('rewards-points');
    const list = document.getElementById('goals-list');
    if (ptsEl) ptsEl.textContent = String(rewards.points);
    if (!list) return;
    list.innerHTML = '';
    if (!rewards.goals || rewards.goals.length === 0){
      list.innerHTML = '<div class="text-muted">No goals set yet.</div>';
      return;
    }
    rewards.goals.forEach(g => {
      const card = document.createElement('div');
      card.className = 'card mb-2';
      const body = document.createElement('div'); body.className='card-body p-2';
      const row = document.createElement('div'); row.className = 'd-flex justify-content-between align-items-start';
      const left = document.createElement('div');
      const title = document.createElement('div'); title.className='fw-semibold'; title.textContent = g.title || 'Untitled';
      const meta = document.createElement('div'); meta.className='small text-muted'; meta.textContent = 'Target: ' + (g.target||0) + ' pts';
      left.appendChild(title); left.appendChild(meta);
      const right = document.createElement('div');
      // action buttons: claim (if reached) and remove
      if (rewards.points >= (g.target||0) && (g.target||0) > 0){
        const claim = document.createElement('button'); claim.className='btn btn-sm btn-success me-2'; claim.textContent='Claim';
        claim.addEventListener('click', ()=>{ claimGoal(g.id); });
        right.appendChild(claim);
      }
      const del = document.createElement('button'); del.className='btn btn-sm btn-outline-danger'; del.textContent='Remove';
      del.addEventListener('click', ()=>{ removeGoal(g.id); });
      right.appendChild(del);
      row.appendChild(left); row.appendChild(right);
      body.appendChild(row);

      // progress
      const pct = (g.target && g.target > 0) ? Math.min(100, Math.round((rewards.points / g.target) * 100)) : 0;
      const progWrap = document.createElement('div'); progWrap.className='mt-2';
      const prog = document.createElement('div'); prog.className='progress'; prog.style.height='12px';
      const bar = document.createElement('div'); bar.className='progress-bar'; bar.setAttribute('role','progressbar'); bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax','100'); bar.style.width = pct + '%'; bar.textContent = pct + '%';
      prog.appendChild(bar); progWrap.appendChild(prog); body.appendChild(progWrap);

      card.appendChild(body); list.appendChild(card);
    });
  }

  function earnPoints(amount){
    rewards.points = Math.max(0, Number(rewards.points||0) + Number(amount||0));
    rewards.points = Math.round(rewards.points);
    saveRewards();
    updateRewardsUI();
  }

  function tryRedeem(cost){
    cost = Number(cost||0);
    if (isNaN(cost) || cost <= 0) return false;
    if (rewards.points >= cost){
      rewards.points = Math.round(rewards.points - cost);
      saveRewards();
      updateRewardsUI();
      return true;
    }
    return false;
  }

  function addGoal(title, target){
    const g = { id: 'g_'+Math.random().toString(36).slice(2,8), title: String(title || 'Untitled'), target: Math.max(0, Math.round(Number(target)||0)) };
    rewards.goals.unshift(g);
    saveRewards();
    updateRewardsUI();
  }

  function removeGoal(id){
    rewards.goals = rewards.goals.filter(g=>g.id!==id);
    saveRewards();
    updateRewardsUI();
  }

  function claimGoal(id){
    const g = rewards.goals.find(x=>x.id===id);
    if (!g) return;
    if (rewards.points >= g.target){
      // deduct points and remove goal
      rewards.points = Math.round(rewards.points - g.target);
      rewards.goals = rewards.goals.filter(x=>x.id!==id);
      saveRewards();
      updateRewardsUI();
      alert('Goal claimed: ' + g.title + ' — ' + g.target + ' points spent.');
    } else {
      alert('Not enough points to claim this goal.');
    }
  }

  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(boards)); }

  function id(){ return 'b_'+Math.random().toString(36).slice(2,9); }

  function formatDate(ts){
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function renderFilters(){
    const container = $('#team-filters');
    if (!container) return;
    // use teams from teams storage when available
    const teams = Array.from(new Set(teamsFromData().filter(Boolean)));
    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'btn btn-sm btn-outline-secondary me-2';
    allBtn.textContent = 'All';
    if (activeFilter === 'All') allBtn.classList.add('active');
    allBtn.addEventListener('click', ()=>{ activeFilter='All'; render(); });
    container.appendChild(allBtn);
    teams.forEach(t=>{
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline-secondary me-2';
      btn.textContent = t;
      if (activeFilter === t) btn.classList.add('active');
      btn.addEventListener('click', ()=>{ activeFilter=t; render(); });
      container.appendChild(btn);
    });
  }

  function teamsFromData(){
    // prefer explicit teams list if present, otherwise infer from boards
    if (teams && teams.length) return teams.map(t=>t.name);
    return Array.from(new Set(boards.map(b=>b.team).filter(Boolean)));
  }

  function render(){
    renderFilters();
    populateTeamSelect();
    const gallery = $('#boards-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    const shown = boards.filter(b => activeFilter === 'All' || b.team === activeFilter);
    if (shown.length === 0){
      gallery.innerHTML = '<div class="text-muted">No boards yet.</div>';
      return;
    }
    shown.forEach(b=>{
      const a = document.createElement('a');
      a.className = 'card text-decoration-none text-dark';
      a.href = `board.html?board=${b.id}`;
      a.style.minHeight = '120px';
      // Do not apply any saved background on dashboard cards — keep cards plain for readability
      a.style.background = '';
      a.classList.remove('text-white');
      a.classList.add('text-dark');

      const body = document.createElement('div');
      body.className = 'card-body';
      const title = document.createElement('h5');
      title.className = 'card-title mb-1';
      title.textContent = b.name;
      const meta = document.createElement('div');
      meta.className = 'board-meta mb-2';
      meta.textContent = `${b.team || 'No team'} • Last updated ${formatDate(b.updatedAt)}`;
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
      actions.appendChild(open); actions.appendChild(del);

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(actions);
      a.appendChild(body);
      gallery.appendChild(a);
    });
  }

  // --- Teams dashboard rendering and form handling ---
  function renderTeams(){
    const gallery = $('#teams-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    if (!teams || teams.length === 0) { gallery.innerHTML = '<div class="text-muted">No teams yet.</div>'; return; }
    teams.forEach(t=>{
      const a = document.createElement('a');
      a.className = 'card text-decoration-none text-dark';
      a.href = `teams.html?team=${encodeURIComponent(t.name)}`;
      const body = document.createElement('div'); body.className='card-body';
      const title = document.createElement('h5'); title.className='card-title mb-1'; title.textContent = t.name;
      const meta = document.createElement('div'); meta.className='board-meta mb-2';
      meta.textContent = `${(t.members||[]).length} members • Last updated ${formatDate(t.updatedAt||0)}`;
      const actions = document.createElement('div'); actions.className='d-flex gap-2';
      const open = document.createElement('button'); open.className='btn btn-sm btn-outline-primary'; open.textContent='Open';
      open.addEventListener('click', e => { e.preventDefault(); window.location.href = `teams.html?team=${encodeURIComponent(t.name)}`; });
      const del = document.createElement('button'); del.className='btn btn-sm btn-outline-danger'; del.textContent='Delete';
      del.addEventListener('click', e=>{ e.preventDefault(); if(!confirm('Delete team "'+t.name+'"?')) return; teams = teams.filter(x=>x.id!==t.id); saveTeams(); renderTeams(); populateTeamSelect(); render(); });
      actions.appendChild(open); actions.appendChild(del);
      body.appendChild(title); body.appendChild(meta); body.appendChild(actions); a.appendChild(body); gallery.appendChild(a);
    });
  }

  function setupTeamForm(){
    const form = $('#new-team-form');
    if (!form) return;
    form.addEventListener('submit', ev=>{
      ev.preventDefault();
      const name = $('#team-name').value.trim();
      const members = ($('#team-members').value || '').split(',').map(s=>s.trim()).filter(Boolean);
      const bgInput = document.querySelector('input[name="team-bg"]:checked');
      const background = bgInput ? bgInput.value : '';
      if (!name) return alert('Please provide a team name');
      const t = { id: 't_'+Math.random().toString(36).slice(2,8), name, members, background, updatedAt: Date.now() };
      teams.unshift(t);
      saveTeams();
      form.reset();
      const modalEl = document.getElementById('newTeamModal');
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.hide();
      renderTeams();
      populateTeamSelect();
      render();
    });

    // wire team bg preview similar to boards
    const choices = Array.from(document.querySelectorAll('input[name="team-bg"]'));
    const preview = document.getElementById('team-bg-preview-large');
    if (preview && choices.length) {
      const apply = v=> preview.style.background = v;
      const cur = document.querySelector('input[name="team-bg"]:checked'); if (cur) apply(cur.value);
      choices.forEach(ch=>{ ch.addEventListener('change', ()=>{ if (ch.checked) apply(ch.value); }); const lbl = ch.closest('.bg-choice'); if (lbl){ lbl.addEventListener('mouseenter', ()=>apply(ch.value)); lbl.addEventListener('mouseleave', ()=>{ const c = document.querySelector('input[name="team-bg"]:checked'); if (c) apply(c.value); }); } });
    }
  }

  function setupForm(){
    const form = $('#new-board-form');
    if (!form) return;
    form.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const name = $('#board-name').value.trim();
      // determine team from select or new input
      const select = $('#board-team-select');
      const newTeamInput = $('#board-team-new');
      let team = '';
      if (select) {
        if (select.value === '__other__') {
          team = newTeamInput ? newTeamInput.value.trim() : '';
        } else {
          team = select.value.trim();
        }
      }
      const bgInput = document.querySelector('input[name="board-bg"]:checked');
      const background = bgInput ? bgInput.value : '';
      if (!name) return alert('Please provide a board name');
  const b = { id: id(), name, team, updatedAt: Date.now(), background, cards: [] };
      boards.unshift(b);
      save();
      // reset form and hide modal
      form.reset();
      const modalEl = document.getElementById('newBoardModal');
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.hide();
      activeFilter = 'All';
      render();
    });

    // wire select change to show/hide 'new team' input
    const teamSelect = $('#board-team-select');
    const teamNew = $('#board-team-new');
    if (teamSelect && teamNew) {
      teamSelect.addEventListener('change', ()=>{
        if (teamSelect.value === '__other__') {
          teamNew.classList.remove('d-none');
          teamNew.focus();
        } else {
          teamNew.classList.add('d-none');
        }
      });
    }
  }

  function populateTeamSelect(){
    const sel = $('#board-team-select');
    if (!sel) return;
    const existing = sel.value; // preserve selection
    // compute unique teams from boards
    const teams = Array.from(new Set(boards.map(b=>b.team).filter(Boolean)));
    // clear options
    sel.innerHTML = '';
    const optNone = document.createElement('option'); optNone.value=''; optNone.textContent='No team'; sel.appendChild(optNone);
    teams.forEach(t=>{
      const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
    });
    const optOther = document.createElement('option'); optOther.value='__other__'; optOther.textContent='Other...'; sel.appendChild(optOther);
    // restore previous selection when possible
    if (existing) {
      const match = Array.from(sel.options).some(o=>o.value===existing);
      if (match) sel.value = existing; else sel.value='';
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    load();
    setupForm();
    render();

    // wire background preview interactions
    wireBgPreview();

    // setup teams page if present
    setupTeamForm();
    renderTeams();

    // If this is a board detail page, initialize board UI
    const params = new URLSearchParams(window.location.search);
    const boardId = params.get('board');
    if (boardId && document.body.id === 'page-board') {
      initBoardDetail(boardId);
    }

    // small helper: wire nav search to filter boards by name/team
    const search = document.getElementById('nav-search');
    if (search){
      let t;
      search.addEventListener('input', (e)=>{
        clearTimeout(t);
        t = setTimeout(()=>{
          const q = search.value.trim().toLowerCase();
          if (!q) { activeFilter='All'; render(); return; }
          // filter by name or team
          const gallery = $('#boards-gallery');
          gallery.innerHTML = '';
          const filtered = boards.filter(b => b.name.toLowerCase().includes(q) || (b.team||'').toLowerCase().includes(q));
          if (filtered.length===0){ gallery.innerHTML = '<div class="text-muted">No matches.</div>'; return; }
          filtered.forEach(b=>{
            const a = document.createElement('a');
            a.className = 'card text-decoration-none text-dark';
            a.href = `boards.html?board=${b.id}`;
            // Do not apply any saved background on dashboard search cards — keep plain for readability
            a.style.background = '';
            a.classList.remove('text-white'); a.classList.add('text-dark');
            const body = document.createElement('div');
            body.className = 'card-body';
            const title = document.createElement('h5'); title.className='card-title mb-1'; title.textContent=b.name;
            const meta = document.createElement('div'); meta.className='board-meta mb-2'; meta.textContent = `${b.team||'No team'} • Last updated ${formatDate(b.updatedAt)}`;
            body.appendChild(title); body.appendChild(meta);
            a.appendChild(body); gallery.appendChild(a);
          });
        }, 200);
      });
    }

    // --- Rewards page wiring: load state, update UI, and wire buttons ---
    if (document.body.id === 'page-rewards'){
      loadRewards();
      updateRewardsUI();

      const earnBtn = document.getElementById('earn-points');
      if (earnBtn) earnBtn.addEventListener('click', ()=> earnPoints(10));

      const addBtn = document.getElementById('add-goal');
      const goalInput = document.getElementById('goal-input');
      const goalTitle = document.getElementById('goal-title');
      if (addBtn && goalInput && goalTitle){
        addBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          const v = Number(goalInput.value);
          const title = (goalTitle.value || '').trim();
          if (!title) return alert('Please enter a title for the goal.');
          if (isNaN(v) || v < 1) return alert('Please enter a point target greater than zero.');
          addGoal(title, v);
          goalInput.value = '';
          goalTitle.value = '';
        });
      }

      // redeem catalog buttons
      Array.from(document.querySelectorAll('.redeem-btn')).forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          const cost = Number(btn.dataset.cost || 0);
          if (tryRedeem(cost)){
            alert('Redeemed for ' + cost + ' points — enjoy!');
          } else {
            alert('Not enough points to redeem this item.');
          }
        });
      });
    }
  });

  function wireBgPreview(){
    const preview = document.getElementById('bg-preview-large');
    const choices = Array.from(document.querySelectorAll('input[name="board-bg"]'));
    if (!preview || choices.length === 0) return;

    function applyBg(val){
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
    choices.forEach(ch => {
      ch.addEventListener('change', ()=>{
        if (ch.checked) applyBg(ch.value);
      });
      // preview on hover
      const label = ch.closest('.bg-choice');
      if (label){
        label.addEventListener('mouseenter', ()=> applyBg(ch.value));
        label.addEventListener('mouseleave', ()=> {
          const cur = document.querySelector('input[name="board-bg"]:checked');
          if (cur) applyBg(cur.value);
        });
      }
    });

    // when modal opens, ensure preview reflects current selection
    const modalEl = document.getElementById('newBoardModal');
    if (modalEl){
      modalEl.addEventListener('shown.bs.modal', ()=>{
        const cur = document.querySelector('input[name="board-bg"]:checked');
        if (cur) applyBg(cur.value);
      });
    }
  }

  // --- Board detail functions ---
  function getBoardById(id){ return boards.find(b=>b.id===id); }

  function initBoardDetail(boardId){
    const board = getBoardById(boardId);
    if (!board) {
      const root = document.getElementById('board-root');
      if (root) root.innerHTML = '<div class="alert alert-warning">Board not found.</div>';
      return;
    }
    // set title and background
    const titleEl = document.getElementById('board-title');
    if (titleEl) titleEl.textContent = board.name;
  // Do not apply the board's saved background on the board detail page in this prototype.
  // Backgrounds are still saved with the board object for gallery/preview use,
  // but we avoid applying them here to keep the detail view readable and consistent.
  // const header = document.getElementById('board-header');
  // if (header && board.background) header.style.background = board.background;

    renderBoardColumns(board);
    setupBoardInteractions(board);
  }

  function renderBoardColumns(board){
    const cols = ['todo','inprogress','done'];
    cols.forEach(col => {
      const list = document.getElementById('col-'+col);
      if (!list) return;
      list.innerHTML = '';
      const items = (board.cards||[]).filter(c=>c.column===col);
      items.forEach(card => {
        const el = document.createElement('div');
        el.className = 'card-item';
        el.draggable = true;
        el.dataset.cardId = card.id;
        el.innerHTML = `<div><strong>${escapeHtml(card.title)}</strong></div><div class="small text-muted">${card.description||''}</div>`;
        // attach drag handlers
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);

        // If the card is in the done column, show a redeem button (if not redeemed)
        if (col === 'done'){
          const btnWrap = document.createElement('div');
          btnWrap.className = 'mt-2';
          const btn = document.createElement('button');
          btn.className = 'btn btn-sm btn-success';
          const REWARD_PER_TASK = 10; // points per redeemed completed task
          if (card.redeemed) {
            btn.textContent = 'Redeemed';
            btn.disabled = true;
            btn.classList.add('btn-outline-success');
            btn.classList.remove('btn-success');
          } else {
            btn.textContent = `Redeem +${REWARD_PER_TASK} pts`;
            btn.addEventListener('click', (e)=>{
              e.preventDefault();
              // prevent double-redeem
              if (card.redeemed) return;
              // award points and mark card redeemed
              try {
                earnPoints(REWARD_PER_TASK);
              } catch(err) {
                console.error('Error awarding points', err);
              }
              card.redeemed = true;
              // persist boards and update UI
              save();
              // update button state
              btn.textContent = 'Redeemed';
              btn.disabled = true;
              btn.classList.add('btn-outline-success');
              btn.classList.remove('btn-success');
              // refresh goals UI if rewards panel exists
              if (typeof updateRewardsUI === 'function') updateRewardsUI();
            });
          }
          btnWrap.appendChild(btn);
          el.appendChild(btnWrap);
        }

        list.appendChild(el);
      });
    });
  }

  function setupBoardInteractions(board){
    // add card forms
    $all('.add-card-form').forEach(form => {
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const input = form.querySelector('.new-card-title');
        const desc = form.querySelector('.new-card-desc');
        const column = form.dataset.column;
        const title = input.value.trim();
        const description = desc ? desc.value.trim() : '';
        if (!title) return;
        const card = { id: 'c_'+Math.random().toString(36).slice(2,9), title, description, column };
        board.cards = board.cards || [];
        board.cards.push(card);
        board.updatedAt = Date.now();
        save();
        renderBoardColumns(board);
        input.value = '';
        if (desc) desc.value = '';
      });
    });

    // columns dragover/drop
    $all('.board-column').forEach(colEl => {
      colEl.addEventListener('dragover', ev => { ev.preventDefault(); colEl.classList.add('drag-over'); });
      colEl.addEventListener('dragleave', ev => { colEl.classList.remove('drag-over'); });
      colEl.addEventListener('drop', ev => {
        ev.preventDefault(); colEl.classList.remove('drag-over');
        const cardId = ev.dataTransfer.getData('text/plain');
        moveCardToColumn(board, cardId, colEl.dataset.col);
      });
    });
  }

  function onDragStart(ev){
    const id = this.dataset.cardId;
    ev.dataTransfer.setData('text/plain', id);
    this.classList.add('dragging');
  }
  function onDragEnd(ev){ this.classList.remove('dragging'); }

  function moveCardToColumn(board, cardId, targetColumn){
    const card = (board.cards||[]).find(c=>c.id===cardId);
    if (!card) return;
    card.column = targetColumn;
    board.updatedAt = Date.now();
    save();
    renderBoardColumns(board);
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }
})();
