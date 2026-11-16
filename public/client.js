/* Forest War - cliente */
(() => {
  'use strict';

  const socket = io();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };

  const TILE = 50;
  const DIFF_NAMES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
  const COL = { me: '#5ccf5c', ally: '#3d8bff', enemy: '#ff5a4e' };

  let DATA = { brawlers: {}, modes: {}, maps: {} };
  let myId = null;
  let room = null;
  let botDifficulty = store.get('fw-botdiff') || 'normal';

  function show(screen) {
    for (const s of ['menu', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== screen);
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  // ------------------------------------------------------------------ MENÚ
  const params = new URLSearchParams(location.search);
  $('nameInput').value = store.get('fw-name') || '';
  if (params.get('sala')) $('codeInput').value = params.get('sala').toUpperCase();

  const getName = () => {
    const n = $('nameInput').value.trim() || 'Jugador';
    store.set('fw-name', n);
    return n;
  };
  $('createBtn').onclick = () => socket.emit('createRoom', { name: getName() });
  const join = () => {
    const code = $('codeInput').value.trim().toUpperCase();
    if (code.length < 5) { $('menuMsg').textContent = 'Escribe el código de 5 letras de la sala.'; return; }
    socket.emit('joinRoom', { code, name: getName() });
  };
  $('joinBtn').onclick = join;
  $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('codeInput').value ? join() : $('createBtn').click()); });

  socket.on('connect', () => { myId = socket.id; });
  socket.on('disconnect', () => {
    G.active = false;
    room = null;
    show('menu');
    $('menuMsg').textContent = 'Se perdió la conexión con el servidor.';
  });
  socket.on('hello', (d) => { DATA = d; if (room) renderLobby(); });
  socket.on('errorMsg', (m) => {
    if (!$('menu').classList.contains('hidden')) $('menuMsg').textContent = m;
    else toast(m);
  });
  socket.on('joined', ({ code, you }) => {
    myId = you;
    $('menuMsg').textContent = '';
    history.replaceState(null, '', '?sala=' + code);
  });
  socket.on('roomState', (r) => {
    room = r;
    if (!G.active) { show('lobby'); renderLobby(); }
  });

  // ------------------------------------------------------------------ SALA
  $('leaveBtn').onclick = () => {
    socket.emit('leaveRoom');
    room = null;
    history.replaceState(null, '', location.pathname);
    show('menu');
  };
  $('copyLinkBtn').onclick = async () => {
    const url = location.origin + location.pathname + '?sala=' + room.code;
    try { await navigator.clipboard.writeText(url); toast('¡Enlace copiado! Pásaselo a tus amigos.'); }
    catch (e) { prompt('Copia este enlace:', url); }
  };
  $('startBtn').onclick = () => socket.emit('startGame');

  function segButtons(el, items, current, enabled, onPick) {
    el.innerHTML = '';
    for (const [id, label] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = id === current ? 'on' : '';
      b.disabled = !enabled;
      b.onclick = () => onPick(id);
      el.appendChild(b);
    }
  }

  function renderLobby() {
    if (!room || !DATA.modes[room.mode]) return;
    const isHost = room.hostId === myId;
    const me = room.members.find((m) => m.id === myId);
    const mode = DATA.modes[room.mode];
    $('roomCode').textContent = room.code;

    segButtons($('modeBtns'), Object.entries(DATA.modes).map(([k, v]) => [k, v.name]), room.mode, isHost && !room.inGame, (mode) => socket.emit('setMode', { mode }));
    $('modeDesc').textContent = mode.desc;
    segButtons($('mapBtns'), Object.entries(DATA.maps).map(([k, v]) => [k, v.name]), room.map, isHost && !room.inGame, (map) => socket.emit('setMap', { map }));
    $('botSetting').classList.toggle('hidden', !isHost);
    segButtons($('diffBtns'), Object.entries(DIFF_NAMES), botDifficulty, true, (d) => { botDifficulty = d; store.set('fw-botdiff', d); renderLobby(); });

    // Equipos
    const cols = mode.team
      ? [{ team: 0, title: 'Equipo Azul', cls: 't0', max: 4 }, { team: 1, title: 'Equipo Rojo', cls: 't1', max: 4 }]
      : [{ team: null, title: 'Jugadores', cls: 'tffa', max: 8 }];
    const brawlerOpts = (sel) => Object.entries(DATA.brawlers).map(([k, b]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${b.emoji} ${b.name}</option>`).join('');
    const diffOpts = (sel) => Object.entries(DIFF_NAMES).map(([k, n]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${n}</option>`).join('');
    let html = '';
    for (const c of cols) {
      const list = c.team === null ? room.members : room.members.filter((m) => m.team === c.team);
      const canAdd = isHost && !room.inGame && list.length < c.max && room.members.length < 8;
      const canSwitch = c.team !== null && me && me.team !== c.team && !room.inGame && list.length < c.max;
      html += `<div class="card team ${c.cls}"><div class="team-head"><h3>${c.title} <span class="small">(${list.length}/${c.max})</span></h3><div class="head-btns">`;
      if (canSwitch) html += `<button class="btn btn-ghost" data-act="team" data-team="${c.team}">Unirme aquí</button>`;
      if (canAdd) html += `<button class="btn btn-ghost" data-act="addbot" data-team="${c.team === null ? '' : c.team}">+ Bot</button>`;
      html += '</div></div>';
      for (const m of list) {
        const b = DATA.brawlers[m.brawler] || {};
        const tags = [];
        if (m.id === room.hostId) tags.push('<span class="tag">Anfitrión</span>');
        if (m.id === myId) tags.push('<span class="tag">Tú</span>');
        html += `<div class="member${m.id === myId ? ' me' : ''}"><span class="em">${b.emoji || '?'}</span><div class="nm">${esc(m.name)}<div class="sub">${esc(b.name || '')}${m.isBot ? ' · Bot ' + DIFF_NAMES[m.difficulty] : ''}</div></div>${tags.join(' ')}`;
        if (m.isBot && isHost && !room.inGame) {
          html += '<div class="ctrl">';
          html += `<select data-act="botbrawler" data-id="${m.id}" aria-label="Luchador del bot">${brawlerOpts(m.brawler)}</select>`;
          html += `<select data-act="botdiff" data-id="${m.id}" aria-label="Dificultad del bot">${diffOpts(m.difficulty)}</select>`;
          if (mode.team) html += `<button class="btn btn-ghost" data-act="botteam" data-id="${m.id}" data-team="${1 - m.team}" title="Cambiar de equipo">⇄</button>`;
          html += `<button class="btn btn-ghost" data-act="rmbot" data-id="${m.id}" title="Quitar bot">✕</button>`;
          html += '</div>';
        }
        html += '</div>';
      }
      for (let i = list.length; i < Math.min(c.max, mode.team ? 3 : 4); i++) html += '<div class="empty-slot">Hueco libre</div>';
      html += '</div>';
    }
    $('teams').innerHTML = html;

    // Luchadores
    const maxHp = 6000, maxSpd = 280, maxRange = 720;
    $('brawlerPicker').innerHTML = Object.entries(DATA.brawlers).map(([k, b]) => `
      <button class="brawler${me && me.brawler === k ? ' on' : ''}" data-brawler="${k}" ${room.inGame ? 'disabled' : ''}>
        <div class="top"><span class="em">${b.emoji}</span><span class="bn">${b.name}</span></div>
        <div class="ds">${b.desc}</div>
        <div class="stats">
          <span>Vida</span><div class="bar"><i style="width:${(b.hp / maxHp) * 100}%"></i></div>
          <span>Velocidad</span><div class="bar"><i style="width:${(b.speed / maxSpd) * 100}%"></i></div>
          <span>Alcance</span><div class="bar"><i style="width:${(b.attack.range / maxRange) * 100}%"></i></div>
        </div>
        <div class="super-n">Súper: ${b.superName}</div>
      </button>`).join('');

    $('startBtn').classList.toggle('hidden', !isHost || room.inGame);
    $('waitHost').classList.toggle('hidden', isHost && !room.inGame);
    $('waitHost').textContent = room.inGame
      ? 'Hay una partida en curso. Entrarás en la siguiente.'
      : 'Esperando a que el anfitrión empiece la partida…';
    $('lobbyMsg').textContent = '';
  }

  $('teams').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    const act = el.dataset.act;
    const team = el.dataset.team === '' || el.dataset.team === undefined ? null : +el.dataset.team;
    if (act === 'team') socket.emit('setTeam', { team });
    if (act === 'addbot') socket.emit('addBot', { team, difficulty: botDifficulty });
    if (act === 'rmbot') socket.emit('removeBot', { id: el.dataset.id });
    if (act === 'botteam') socket.emit('editBot', { id: el.dataset.id, team });
  });
  $('teams').addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'botbrawler') socket.emit('editBot', { id: el.dataset.id, brawler: el.value });
    if (el.dataset.act === 'botdiff') socket.emit('editBot', { id: el.dataset.id, difficulty: el.value });
  });
  $('brawlerPicker').addEventListener('click', (e) => {
    const el = e.target.closest('[data-brawler]');
    if (el) socket.emit('setBrawler', { brawler: el.dataset.brawler });
  });

  // ------------------------------------------------------------------ JUEGO
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, SCALE = 1;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const G = {
    active: false, meta: new Map(), myTeam: null, mode: null, map: null,
    snaps: [], floaters: [], effects: [], feed: [], lastMe: null, myPos: null, camX: 0, camY: 0, over: false,
  };
  const INTERP = 100;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    SCALE = Math.min(W / 1100, H / 680);
    $('rotateHint').classList.toggle('hidden', !(isTouch && H > W));
  }
  window.addEventListener('resize', resize);
  resize();

  function buildMap(rows) {
    const h = rows.length, w = rows[0].length;
    const tiles = [];
    const bushes = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      const t = c === '#' ? 1 : c === '~' ? 2 : c === '*' ? 3 : 0;
      tiles.push(t);
      if (t === 3) bushes.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, s: (x * 7 + y * 13) % 5 });
    }
    const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= w || ty >= h ? 1 : tiles[ty * w + tx]);
    const layer = document.createElement('canvas');
    layer.width = w * TILE; layer.height = h * TILE;
    const c = layer.getContext('2d');
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      c.fillStyle = (x + y) % 2 ? '#86b95d' : '#7fb257';
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    for (let i = 0; i < w * h * 1.5; i++) {
      c.fillStyle = rnd() < 0.5 ? 'rgba(60,110,40,0.35)' : 'rgba(170,210,110,0.35)';
      const gx = rnd() * w * TILE, gy = rnd() * h * TILE;
      c.fillRect(gx, gy, 3, 6);
    }
    // Zonas de aparición
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === 'A' || ch === 'B') {
        c.fillStyle = ch === 'A' ? 'rgba(61,139,255,0.25)' : 'rgba(255,90,78,0.25)';
        c.beginPath(); c.arc(x * TILE + 25, y * TILE + 25, 22, 0, Math.PI * 2); c.fill();
      }
    }
    // Agua
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tileAt(x, y) !== 2) continue;
      c.fillStyle = '#3d93c9';
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const yy = y * TILE + 15 + k * 20;
        c.beginPath(); c.moveTo(x * TILE + 8, yy); c.quadraticCurveTo(x * TILE + 18, yy - 5, x * TILE + 28, yy); c.stroke();
      }
      c.fillStyle = '#c9b27a';
      if (tileAt(x, y - 1) !== 2) c.fillRect(x * TILE, y * TILE, TILE, 4);
      if (tileAt(x, y + 1) !== 2) c.fillRect(x * TILE, y * TILE + TILE - 4, TILE, 4);
      if (tileAt(x - 1, y) !== 2) c.fillRect(x * TILE, y * TILE, 4, TILE);
      if (tileAt(x + 1, y) !== 2) c.fillRect(x * TILE + TILE - 4, y * TILE, 4, TILE);
    }
    // Árboles (muros)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tileAt(x, y) !== 1) continue;
      c.fillStyle = '#1f3b22';
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tileAt(x, y) !== 1) continue;
      const cx = x * TILE + 25, cy = y * TILE + 25;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.arc(cx + 4, cy + 6, 30, 0, Math.PI * 2); c.fill();
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tileAt(x, y) !== 1) continue;
      const cx = x * TILE + 25, cy = y * TILE + 25;
      const v = (x * 31 + y * 17) % 3;
      c.fillStyle = ['#2f6b34', '#337338', '#2b6330'][v];
      c.strokeStyle = '#173019'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, 29, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#4b9446';
      c.beginPath(); c.arc(cx - 7, cy - 8, 16, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(160,220,120,0.5)';
      c.beginPath(); c.arc(cx - 11, cy - 12, 6, 0, Math.PI * 2); c.fill();
    }
    return { rows, w, h, tiles, bushes, layer, width: w * TILE, height: h * TILE, tileAt };
  }

  socket.on('gameStart', (info) => {
    G.active = true;
    G.over = false;
    G.mode = info.mode;
    G.map = buildMap(info.map.rows);
    G.meta = new Map(info.players.map((p) => [p.id, p]));
    const me = G.meta.get(myId);
    G.myTeam = me ? me.team : null;
    G.snaps = []; G.floaters = []; G.effects = []; G.feed = [];
    G.lastMe = null; G.myPos = null;
    input.fs = 0; input.ss = 0; input.fire = false;
    keys.clear();
    $('results').classList.add('hidden');
    show('game');
    resize();
  });

  socket.on('state', (d) => {
    if (!G.active) return;
    const now = performance.now();
    G.snaps.push({ t: now, d });
    if (G.snaps.length > 40) G.snaps.shift();
    G.lastMe = d.me;
    for (const ev of d.ev) handleEvent(ev, now);
  });

  function relation(team, id) {
    if (id === myId) return 'me';
    return team === G.myTeam ? 'ally' : 'enemy';
  }

  function handleEvent(ev, now) {
    if (ev.k === 'hit') {
      G.floaters.push({ x: ev.x + (Math.random() - 0.5) * 20, y: ev.y - 30, text: String(ev.d), t: now, mine: ev.id === myId });
    } else if (ev.k === 'boom') {
      G.effects.push({ type: 'boom', x: ev.x, y: ev.y, r: ev.r, t: now, dur: 400 });
    } else if (ev.k === 'super') {
      G.effects.push({ type: 'ring', x: ev.x, y: ev.y, r: 70, t: now, dur: 450 });
    } else if (ev.k === 'kill') {
      G.effects.push({ type: 'poof', x: ev.x, y: ev.y, r: 40, t: now, dur: 600 });
      G.feed.push({ a: ev.a, v: ev.v, t: now });
      if (G.feed.length > 5) G.feed.shift();
    }
  }

  function sample() {
    const s = G.snaps;
    if (!s.length) return null;
    const rt = performance.now() - INTERP;
    let a = s[0], b = s[0], alpha = 0;
    for (let i = s.length - 1; i > 0; i--) {
      if (s[i - 1].t <= rt) {
        a = s[i - 1]; b = s[i];
        alpha = clamp((rt - a.t) / (b.t - a.t || 1), 0, 1);
        break;
      }
    }
    const A = a.d, B = b.d;
    const pa = new Map(A.p.map((p) => [p[0], p]));
    const players = B.p.map((p) => {
      const o = pa.get(p[0]);
      return {
        id: p[0], x: o ? lerp(o[1], p[1], alpha) : p[1], y: o ? lerp(o[2], p[2], alpha) : p[2],
        hp: p[3], aim: p[4], bush: !!(p[5] & 1), sup: !!(p[5] & 2), dash: !!(p[5] & 4), gems: p[6],
      };
    });
    const ba = new Map(A.b.map((x) => [x[0], x]));
    const bullets = B.b.map((x) => {
      const o = ba.get(x[0]);
      const px = o ? lerp(o[1], x[1], alpha) : x[1], py = o ? lerp(o[2], x[2], alpha) : x[2];
      return { x: px, y: py, kind: x[3], ang: o ? Math.atan2(x[2] - o[2], x[1] - o[1]) : 0 };
    });
    const la = new Map(A.l.map((x) => [x[0], x]));
    const lobs = B.l.map((x) => {
      const o = la.get(x[0]);
      return { x0: x[1], y0: x[2], x1: x[3], y1: x[4], t: o ? lerp(o[5], x[5], alpha) : x[5], kind: x[6] };
    });
    return { players, bullets, lobs, clouds: B.c, gems: B.g, s: B.s, k: B.k };
  }

  // ------------------------------------------------------------- dibujo
  const FONT = (px) => `${px}px 'Lilita One', 'Nunito', sans-serif`;

  function outlinedText(text, x, y, px, fill, align = 'center') {
    ctx.font = FONT(px);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, px / 5);
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function circle(x, y, r, fill, stroke, lw = 3) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function eyes(ex, ey, er, pupil = '#111', white = '#fff') {
    for (const s of [-1, 1]) {
      circle(ex, ey * s, er, white, '#000', 2);
      circle(ex + er * 0.35, ey * s, er * 0.5, pupil);
    }
  }

  function drawBrawler(type, x, y, r, aim, ring, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.75, r * 1.0, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ring; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 1.12, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(aim);
    const wob = Math.sin(time / 120) * 0.08;
    ctx.lineJoin = 'round';
    if (type === 'pinon') {
      ctx.save(); ctx.rotate(wob);
      ctx.fillStyle = '#c86d1c'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-r * 1.05, 0, r * 0.85, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0a050';
      ctx.beginPath(); ctx.ellipse(-r * 1.2, 0, r * 0.45, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#e8892c';
        ctx.beginPath(); ctx.moveTo(-r * 0.3, s * r * 0.55); ctx.lineTo(-r * 0.05, s * r * 1.15); ctx.lineTo(r * 0.3, s * r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      circle(0, 0, r, '#e8892c', '#000');
      circle(r * 0.4, 0, r * 0.5, '#f6c38b');
      eyes(r * 0.5, r * 0.32, r * 0.22);
      circle(r * 0.92, 0, r * 0.12, '#3a2412');
    } else if (type === 'brutus') {
      for (const s of [-1, 1]) { circle(-r * 0.15, s * r * 0.8, r * 0.33, '#6e4529', '#000'); circle(-r * 0.15, s * r * 0.8, r * 0.16, '#d9a77a'); }
      circle(0, 0, r, '#8a5a3b', '#000');
      // Garras
      for (const s of [-1, 1]) circle(r * 0.55, s * r * 0.85, r * 0.25, '#6e4529', '#000', 2);
      circle(r * 0.55, 0, r * 0.42, '#d9b48f', '#000', 2);
      circle(r * 0.85, 0, r * 0.14, '#111');
      eyes(r * 0.22, r * 0.38, r * 0.17);
    } else if (type === 'ulma') {
      ctx.fillStyle = '#7d8699'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(-r * 0.2, s * r * 0.6); ctx.lineTo(-r * 0.5, s * r * 1.15); ctx.lineTo(r * 0.25, s * r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // Alas
      ctx.save(); ctx.rotate(wob);
      for (const s of [-1, 1]) { ctx.fillStyle = '#6f788a'; ctx.beginPath(); ctx.ellipse(-r * 0.3, s * r * 0.9, r * 0.6, r * 0.28, s * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      circle(0, 0, r, '#9aa3b5', '#000');
      circle(r * 0.3, 0, r * 0.68, '#dde2ea');
      eyes(r * 0.42, r * 0.33, r * 0.27, '#111', '#ffd23d');
      ctx.fillStyle = '#f29a1f';
      ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.13); ctx.lineTo(r * 1.08, 0); ctx.lineTo(r * 0.75, r * 0.13); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      circle(0, 0, r * 1.08, '#d8433b', '#000');
      const dots = [[-0.45, -0.4, 0.2], [-0.5, 0.35, 0.17], [0.05, -0.65, 0.15], [0.0, 0.62, 0.16], [-0.1, 0, 0.14]];
      for (const [dx, dy, dr] of dots) circle(dx * r, dy * r, dr * r, '#fff4e0');
      circle(r * 0.6, 0, r * 0.45, '#f4e1c1', '#000', 2);
      eyes(r * 0.68, r * 0.2, r * 0.13);
    }
    ctx.restore();
  }

  const BULLET_STYLE = {
    pinon: ['#7b4a1e', 7], pinonS: ['#e8892c', 10],
    brutus: ['#fff3dc', 12], brutusS: ['#fff', 12],
    ulma: ['#eef3ff', 8], ulmaS: ['#a6e3ff', 15],
    champi: ['#b7ff6a', 8], champiS: ['#b7ff6a', 8],
  };

  function drawBullet(b) {
    const [color, r] = BULLET_STYLE[b.kind] || ['#fff', 8];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.ang);
    if (b.kind.startsWith('ulma')) {
      ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 2.2, r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (b.kind === 'ulmaS') { ctx.globalAlpha = 0.35; circle(0, 0, r * 1.6, '#a6e3ff'); }
    } else if (b.kind.startsWith('brutus')) {
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-r * 0.6, 0, r, -0.9, 0.9); ctx.stroke();
    } else {
      circle(0, 0, r, color, '#000', 2);
      if (b.kind === 'pinon' || b.kind === 'pinonS') { ctx.fillStyle = '#4a2c10'; ctx.beginPath(); ctx.arc(-r * 0.2, 0, r, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawFrame(now) {
    const S = sample();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0d1a12';
    ctx.fillRect(0, 0, W, H);
    if (!S || !G.map) return;

    const meP = S.players.find((p) => p.id === myId);
    if (meP) G.myPos = { x: meP.x, y: meP.y };
    else if (G.lastMe) G.myPos = G.myPos || { x: G.lastMe.x, y: G.lastMe.y };
    if (G.myPos) {
      const hw = W / 2 / SCALE, hh = H / 2 / SCALE;
      const mw = G.map.width, mh = G.map.height;
      G.camX = mw > hw * 2 ? clamp(G.myPos.x, hw, mw - hw) : mw / 2;
      G.camY = mh > hh * 2 ? clamp(G.myPos.y, hh, mh - hh) : mh / 2;
    }
    G.sample = S;

    const ox = W / 2 - G.camX * SCALE, oy = H / 2 - G.camY * SCALE;
    ctx.setTransform(DPR * SCALE, 0, 0, DPR * SCALE, DPR * ox, DPR * oy);
    const vx0 = G.camX - W / 2 / SCALE - 60, vx1 = G.camX + W / 2 / SCALE + 60;
    const vy0 = G.camY - H / 2 / SCALE - 60, vy1 = G.camY + H / 2 / SCALE + 60;
    const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    ctx.drawImage(G.map.layer, 0, 0);

    // Arbustos
    for (const b of G.map.bushes) {
      if (!inView(b.x, b.y)) continue;
      const near = G.myPos && Math.hypot(G.myPos.x - b.x, G.myPos.y - b.y) < 95;
      ctx.globalAlpha = near ? 0.45 : 1;
      const off = b.s * 2;
      circle(b.x - 10, b.y + 6, 19, '#3f9a3a', '#1d4d1b', 3);
      circle(b.x + 11, b.y + 4 - off, 18, '#48a842', '#1d4d1b', 3);
      circle(b.x, b.y - 10, 18, '#52b74a', '#1d4d1b', 3);
      circle(b.x - 4, b.y - 13, 6, 'rgba(200,255,160,0.45)');
      ctx.globalAlpha = 1;
    }

    // Nubes tóxicas
    for (const c of S.clouds) {
      const [, x, y, r] = c;
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(160,230,80,0.45)');
      g.addColorStop(1, 'rgba(120,60,160,0.15)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = now / 900 + i;
        circle(x + Math.cos(a * 1.3) * r * 0.6, y + Math.sin(a) * r * 0.6, 8 + (i % 3) * 3, 'rgba(180,255,100,0.35)');
      }
    }

    // Cristales
    for (const [, x, y] of S.gems) {
      const bob = Math.sin(now / 250 + x) * 3;
      ctx.save(); ctx.translate(x, y + bob);
      ctx.fillStyle = 'rgba(200,120,255,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b56cff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, -2); ctx.lineTo(0, 13); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e6c8ff';
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(5, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Guía de apuntado propia
    if (meP && G.lastMe && G.lastMe.alive) drawAimGuide(meP);

    // Jugadores
    const sorted = [...S.players].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const meta = G.meta.get(p.id);
      if (!meta) continue;
      const def = DATA.brawlers[meta.brawler];
      const rel = relation(meta.team, p.id);
      ctx.globalAlpha = p.bush ? (rel === 'enemy' ? 0.6 : 0.75) : 1;
      if (p.sup) {
        ctx.globalAlpha *= 0.5 + Math.sin(now / 150) * 0.2;
        circle(p.x, p.y, def.radius + 10, 'rgba(255,200,61,0.45)');
        ctx.globalAlpha = p.bush ? 0.7 : 1;
      }
      drawBrawler(meta.brawler, p.x, p.y, def.radius, p.aim, COL[rel], now);
      ctx.globalAlpha = 1;
    }

    // Proyectiles
    for (const b of S.bullets) if (inView(b.x, b.y)) drawBullet(b);
    for (const l of S.lobs) {
      const x = lerp(l.x0, l.x1, l.t), y = lerp(l.y0, l.y1, l.t);
      const hgt = Math.sin(Math.PI * l.t) * 110;
      const rad = l.kind === 'cloud' ? 150 : 75;
      ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,60,60,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(l.x1, l.y1, rad * 0.9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      circle(x, y - hgt, l.kind === 'cloud' ? 16 : 12, l.kind === 'cloud' ? '#9b4fd1' : '#d8433b', '#000', 2.5);
      circle(x - 3, y - hgt - 3, 3, '#fff4e0');
    }

    // Efectos
    G.effects = G.effects.filter((e) => now - e.t < e.dur);
    for (const e of G.effects) {
      const k = (now - e.t) / e.dur;
      ctx.globalAlpha = 1 - k;
      if (e.type === 'boom') {
        circle(e.x, e.y, e.r * (0.5 + k * 0.6), 'rgba(183,255,106,0.5)', '#3f7a1a', 4);
      } else if (e.type === 'ring') {
        circle(e.x, e.y, e.r * (0.3 + k), null, '#ffc83d', 8 * (1 - k) + 1);
      } else {
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8;
          circle(e.x + Math.cos(a) * e.r * k, e.y + Math.sin(a) * e.r * k, 10 * (1 - k) + 2, '#e9e4d8');
        }
      }
      ctx.globalAlpha = 1;
    }

    // Barras de vida y nombres
    for (const p of sorted) {
      const meta = G.meta.get(p.id);
      if (!meta) continue;
      const def = DATA.brawlers[meta.brawler];
      const rel = relation(meta.team, p.id);
      const top = p.y - def.radius - 22;
      const bw = 70, bh = 13;
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x - bw / 2 - 2, top - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(p.x - bw / 2, top, bw, bh);
      ctx.fillStyle = COL[rel];
      ctx.fillRect(p.x - bw / 2, top, bw * clamp(p.hp / def.hp, 0, 1), bh);
      outlinedText(String(Math.max(0, p.hp)), p.x, top + bh / 2 + 1, 12, '#fff');
      outlinedText(meta.name, p.x, top - 12, 14, rel === 'me' ? '#c8ffb8' : '#fff');
      if (p.gems > 0) outlinedText('💎' + p.gems, p.x, top - 30, 15, '#e6c8ff');
      if (p.id === myId && G.lastMe) {
        const ammo = G.lastMe.ammo;
        const sw = 22, gap = 3, ay = p.y + def.radius + 12;
        for (let i = 0; i < 3; i++) {
          const x = p.x - (sw * 3 + gap * 2) / 2 + i * (sw + gap);
          ctx.fillStyle = '#000'; ctx.fillRect(x - 1.5, ay - 1.5, sw + 3, 9);
          ctx.fillStyle = '#5a4a2a'; ctx.fillRect(x, ay, sw, 6);
          ctx.fillStyle = '#ff9d2e'; ctx.fillRect(x, ay, sw * clamp(ammo - i, 0, 1), 6);
        }
      }
    }

    // Números de daño
    G.floaters = G.floaters.filter((f) => now - f.t < 800);
    for (const f of G.floaters) {
      const k = (now - f.t) / 800;
      ctx.globalAlpha = 1 - k * k;
      outlinedText(f.text, f.x, f.y - k * 40, 18, f.mine ? '#ff6b5e' : '#fff');
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawHUD(S, now);
    drawTouch();
  }

  function drawAimGuide(meP) {
    const meta = G.meta.get(myId);
    const def = DATA.brawlers[meta.brawler];
    const a = def.attack;
    let show = !isTouch;
    let ang = input.aim, dist = input.aimDist;
    if (isTouch) {
      if (touch.aim.id !== null && touch.aim.dragged) {
        show = true;
        ang = Math.atan2(touch.aim.y - touch.aim.oy, touch.aim.x - touch.aim.ox);
        dist = (Math.min(JOY_R, Math.hypot(touch.aim.x - touch.aim.ox, touch.aim.y - touch.aim.oy)) / JOY_R) * a.range;
      }
    }
    if (!show) return;
    ctx.save();
    ctx.translate(meP.x, meP.y);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    if (a.type === 'lob') {
      const d = clamp(dist || a.range, 60, a.range);
      ctx.beginPath(); ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d, a.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * d, Math.sin(ang) * d); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.rotate(ang);
      if (a.type === 'spread') {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, a.range, -a.spread / 2 - 0.04, a.spread / 2 + 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.rect(0, -a.bulletR, a.range, a.bulletR * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function fmtTime(s) {
    s = Math.ceil(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
  }

  function drawHUD(S, now) {
    const st = S.s;
    const cx = W / 2;
    const sm = W < 700 ? 0.8 : 1;
    // Tiempo
    roundRect(cx - 42 * sm, 8, 84 * sm, 34 * sm, 10, 'rgba(0,0,0,0.55)');
    outlinedText(fmtTime(st.tl), cx, 8 + 17 * sm, 22 * sm, st.tl < 30 ? '#ff8a7e' : '#fff');

    const myTeam = G.myTeam;
    if (G.mode === 'gems' || G.mode === 'tdm') {
      const vals = G.mode === 'gems' ? st.tg : st.sc;
      const mine = myTeam === 1 ? 1 : 0, other = 1 - mine;
      const icon = G.mode === 'gems' ? '💎 ' : '⚔ ';
      roundRect(cx - 150 * sm, 8, 96 * sm, 34 * sm, 10, COL.ally);
      outlinedText(icon + vals[mine], cx - 102 * sm, 8 + 17 * sm, 22 * sm, '#fff');
      roundRect(cx + 54 * sm, 8, 96 * sm, 34 * sm, 10, COL.enemy);
      outlinedText(icon + vals[other], cx + 102 * sm, 8 + 17 * sm, 22 * sm, '#fff');
      if (G.mode === 'tdm') outlinedText('Primero a ' + DATA.modes.tdm.target, cx, 58 * sm, 14 * sm, '#fff');
      if (st.cd) {
        const ours = st.cd.team === myTeam;
        outlinedText((ours ? '¡Ganáis en ' : '¡Pierdes en ') + Math.ceil(st.cd.left) + '!', cx, 64 * sm, 26 * sm, ours ? '#9fd0ff' : '#ff8a7e');
      }
    } else {
      const list = (S.k || []).slice().sort((a, b) => b[1] - a[1]).slice(0, 5);
      ctx.textAlign = 'left';
      roundRect(8, 8, 170, 24 + list.length * 20, 10, 'rgba(0,0,0,0.55)');
      outlinedText('Derribos (meta ' + DATA.modes.ffa.target + ')', 18, 20, 13, '#ffc83d', 'left');
      list.forEach(([id, k], i) => {
        const m = G.meta.get(id);
        outlinedText((m ? m.name : '?').slice(0, 12), 18, 40 + i * 20, 14, id === myId ? '#c8ffb8' : '#fff', 'left');
        outlinedText(String(k), 166, 40 + i * 20, 14, '#fff', 'right');
      });
    }

    // Registro de derribos
    G.feed = G.feed.filter((f) => now - f.t < 5000);
    G.feed.forEach((f, i) => {
      const a = G.meta.get(f.a), v = G.meta.get(f.v);
      const y = (G.mode === 'ffa' ? 20 : 60) + i * 22;
      const aName = a ? a.name : '¿?', vName = v ? v.name : '¿?';
      ctx.font = FONT(14);
      const vw = ctx.measureText(vName).width;
      outlinedText(vName, W - 12, y, 14, v ? COL[relation(v.team, v.id)] : '#fff', 'right');
      outlinedText(' 💀 ', W - 12 - vw, y, 14, '#fff', 'right');
      ctx.font = FONT(14);
      const sw = ctx.measureText(' 💀 ').width;
      outlinedText(aName, W - 12 - vw - sw, y, 14, a ? COL[relation(a.team, a.id)] : '#fff', 'right');
    });

    // Cuenta atrás inicial
    if (st.si > 0) {
      outlinedText(String(Math.ceil(st.si)), cx, H / 2 - 40, 96, '#ffc83d');
      outlinedText(DATA.modes[G.mode].name, cx, H / 2 + 30, 28, '#fff');
    } else if (st.si === 0 && st.tl > DATA.modes[G.mode].duration - 0.8) {
      outlinedText('¡A LUCHAR!', cx, H / 2 - 40, 72, '#ffc83d');
    }

    // Muerto
    const me = G.lastMe;
    if (me && !me.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      outlinedText('Reapareces en ' + Math.ceil(me.rs), cx, H / 2, 34, '#fff');
    }

    // Botón de súper
    if (me) {
      const b = superBtn();
      const ready = me.sup >= 1;
      circle(b.x, b.y, b.r + 4, 'rgba(0,0,0,0.5)');
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * me.sup); ctx.closePath();
      ctx.fillStyle = ready ? '#ffc83d' : 'rgba(255,200,61,0.55)'; ctx.fill();
      circle(b.x, b.y, b.r, null, '#000', 3);
      if (ready) circle(b.x, b.y, b.r + 6 + Math.sin(now / 120) * 3, null, '#ffc83d', 3);
      outlinedText('★', b.x, b.y - (isTouch ? 0 : 6), b.r * 0.9, ready ? '#fff' : '#ddd');
      if (!isTouch) outlinedText('E', b.x, b.y + b.r * 0.55, 13, '#fff');
    }
  }

  // ---------------------------------------------------------------- entrada
  const input = { mx: 0, my: 0, aim: 0, aimDist: 300, fire: false, fs: 0, ss: 0 };
  const keys = new Set();
  const mouse = { x: 0, y: 0 };
  const JOY_R = 60;
  const touch = { move: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aim: { id: null, ox: 0, oy: 0, x: 0, y: 0, dragged: false } };

  function superBtn() {
    return isTouch ? { x: W - 70, y: H - 190, r: 36 } : { x: W - 60, y: H - 60, r: 34 };
  }

  const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE']);
  window.addEventListener('keydown', (e) => {
    if (!G.active || G.over) return;
    if (gameKeys.has(e.code)) e.preventDefault();
    if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) { input.ss++; sendInput(); }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); input.fire = false; });

  cv.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  cv.addEventListener('mousedown', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    const b = superBtn();
    if (e.button === 2 || Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r + 6) { input.ss++; sendInput(); return; }
    if (e.button === 0) { input.fire = true; input.fs++; sendInput(); }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  function autoAim() {
    const S = G.sample;
    if (!S || !G.myPos) return false;
    let best = null, bd = Infinity;
    for (const p of S.players) {
      const m = G.meta.get(p.id);
      if (!m || relation(m.team, p.id) !== 'enemy') continue;
      const d = Math.hypot(p.x - G.myPos.x, p.y - G.myPos.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return false;
    input.aim = Math.atan2(best.y - G.myPos.y, best.x - G.myPos.x);
    input.aimDist = bd;
    return true;
  }

  cv.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const b = superBtn();
      if (Math.hypot(t.clientX - b.x, t.clientY - b.y) < b.r + 14) {
        if (!(touch.aim.id !== null && touch.aim.dragged)) autoAim();
        input.ss++; sendInput();
        continue;
      }
      if (t.clientX < W / 2 && touch.move.id === null) {
        Object.assign(touch.move, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY });
      } else if (t.clientX >= W / 2 && touch.aim.id === null) {
        Object.assign(touch.aim, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, dragged: false });
      }
    }
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      for (const j of [touch.move, touch.aim]) {
        if (j.id !== t.identifier) continue;
        j.x = t.clientX; j.y = t.clientY;
        if (j === touch.aim && Math.hypot(j.x - j.ox, j.y - j.oy) > 18) j.dragged = true;
      }
    }
  }, { passive: false });
  const touchEnd = (e) => {
    for (const t of e.changedTouches) {
      if (touch.move.id === t.identifier) touch.move.id = null;
      if (touch.aim.id === t.identifier) {
        const j = touch.aim;
        const meta = G.meta.get(myId);
        const range = meta ? DATA.brawlers[meta.brawler].attack.range : 400;
        if (j.dragged) {
          input.aim = Math.atan2(j.y - j.oy, j.x - j.ox);
          input.aimDist = (Math.min(JOY_R, Math.hypot(j.x - j.ox, j.y - j.oy)) / JOY_R) * range;
        } else {
          autoAim();
        }
        input.fs++;
        sendInput();
        j.id = null; j.dragged = false;
      }
    }
  };
  cv.addEventListener('touchend', touchEnd);
  cv.addEventListener('touchcancel', touchEnd);

  function drawTouch() {
    if (!isTouch) return;
    const drawJoy = (j, defX, defY, color) => {
      const active = j.id !== null;
      const ox = active ? j.ox : defX, oy = active ? j.oy : defY;
      circle(ox, oy, JOY_R, 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.5)', 3);
      let kx = ox, ky = oy;
      if (active) {
        const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy);
        const k = d > JOY_R ? JOY_R / d : 1;
        kx = ox + dx * k; ky = oy + dy * k;
      }
      circle(kx, ky, 26, color, '#000', 3);
    };
    drawJoy(touch.move, 110, H - 110, 'rgba(61,139,255,0.85)');
    drawJoy(touch.aim, W - 160, H - 90, 'rgba(255,90,78,0.85)');
  }

  function sendInput() {
    if (!G.active) return;
    let mx = 0, my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (touch.move.id !== null) {
      const dx = touch.move.x - touch.move.ox, dy = touch.move.y - touch.move.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) { const k = Math.min(1, d / JOY_R) / d; mx = dx * k; my = dy * k; }
    }
    input.mx = mx; input.my = my;
    if (!isTouch && G.myPos) {
      const wx = G.camX + (mouse.x - W / 2) / SCALE;
      const wy = G.camY + (mouse.y - H / 2) / SCALE;
      input.aim = Math.atan2(wy - G.myPos.y, wx - G.myPos.x);
      input.aimDist = Math.hypot(wx - G.myPos.x, wy - G.myPos.y);
    }
    socket.emit('input', input);
  }
  setInterval(sendInput, 1000 / 30);

  // ---------------------------------------------------------------- final
  socket.on('gameOver', (res) => {
    G.over = true;
    input.fire = false;
    const me = res.players.find((p) => p.id === myId);
    const title = $('resultTitle');
    let text, cls = '';
    if (res.mode === 'ffa') {
      if (res.winner === myId) text = '¡Victoria!';
      else if (res.winner === null) { text = 'Empate'; cls = 'draw'; }
      else { text = 'Derrota'; cls = 'lose'; }
      const w = res.players.find((p) => p.id === res.winner);
      $('resultSub').textContent = w ? `Ganador: ${w.name}` : 'Nadie ha conseguido ganar.';
    } else {
      if (res.winner === null) { text = 'Empate'; cls = 'draw'; }
      else if (me && res.winner === me.team) text = '¡Victoria!';
      else { text = 'Derrota'; cls = 'lose'; }
      $('resultSub').textContent = res.winner === null ? '' : `Gana el ${res.winner === 0 ? 'Equipo Azul' : 'Equipo Rojo'}`;
    }
    title.textContent = text;
    title.className = cls;
    $('resultTable').innerHTML = '<tr><th>Jugador</th><th>Derribos</th><th>Caídas</th><th>Daño</th></tr>' + res.players.map((p) => {
      const b = DATA.brawlers[p.brawler];
      const tcls = res.mode === 'ffa' ? '' : 't' + p.team;
      return `<tr class="${tcls}${p.id === myId ? ' me' : ''}"><td>${b ? b.emoji : ''} ${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.damage}</td></tr>`;
    }).join('');
    setTimeout(() => $('results').classList.remove('hidden'), 1200);
  });

  $('backLobbyBtn').onclick = () => {
    G.active = false;
    $('results').classList.add('hidden');
    show(room ? 'lobby' : 'menu');
    if (room) renderLobby();
  };
  $('quitBtn').onclick = () => {
    if (!confirm('¿Salir de la partida?')) return;
    G.active = false;
    socket.emit('leaveRoom');
    room = null;
    history.replaceState(null, '', location.pathname);
    show('menu');
  };

  function loop(now) {
    if (G.active) drawFrame(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
