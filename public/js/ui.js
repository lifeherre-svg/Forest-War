/* Forest War - menús, perfil, tienda, pase, salas y resultados. */
(() => {
  'use strict';
  const FW = window.FW;
  const A = FW.Art;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };
  const DIFF_NAMES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
  const COIN = '<span class="ic-coin"></span>';
  const EM = '<span class="ic-em"></span>';

  const socket = io();
  let DATA = null;
  let P = null;
  let myId = null;
  let room = null;
  let screen = 'loading';
  let mode = store.get('fw-mode') || 'gems';
  let botDifficulty = store.get('fw-botdiff') || 'normal';
  let viewBrawler = null;
  let inPublicGame = false;
  let pendingJoin = new URLSearchParams(location.search).get('sala');
  let firstProfile = !store.get('fw-token');

  // ----------------------------------------------------------- utilidades
  function show(id) {
    screen = id;
    for (const s of ['loading', 'home', 'brawlers', 'shop', 'pass', 'friends', 'room', 'queue', 'game']) $(s).classList.toggle('hidden', s !== id);
    render();
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  function modal(html, onClick) {
    $('modalBody').innerHTML = html;
    $('modal').classList.remove('hidden');
    $('modalBody').onclick = (e) => { if (onClick) onClick(e); };
  }
  const closeModal = () => $('modal').classList.add('hidden');
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  function fmtLeft(ms) {
    if (ms <= 0) return '0m';
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  const act = (action, args) => { FW.Sfx.click(); socket.emit('profileAction', { action, args }); };

  // Retratos cacheados de cada luchador/aspecto.
  const portraitCache = new Map();
  function portrait(type, skin = 'default', size = 128) {
    const key = type + skin + size;
    if (portraitCache.has(key)) return portraitCache.get(key);
    const b = DATA.brawlers[type];
    const pal = (b.skins[skin] || b.skins.default).pal;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const s = size / 100;
    A.drawBrawler(ctx, type, pal, { x: size / 2, y: size * 0.93, scale: s * (type === 'brutus' || type === 'tortu' ? 1.02 : 1.08), aim: 0.25, t: 300 });
    const url = c.toDataURL();
    portraitCache.set(key, url);
    return url;
  }

  // Dónde se consigue un luchador o aspecto en el pase.
  function passSource(r) {
    for (const [track, list] of [['free', DATA.pass.free], ['premium', DATA.pass.premium]]) {
      const i = list.findIndex((x) => x.t === r.t && (r.t === 'brawler' ? x.id === r.id : x.b === r.b && x.s === r.s));
      if (i >= 0) return { track, tier: i + 1 };
    }
    return null;
  }

  function rewardView(r) {
    if (r.t === 'coins') return { icon: COIN, img: null, label: `${r.n} monedas`, short: String(r.n) };
    if (r.t === 'emeralds') return { icon: EM, img: null, label: `${r.n} esmeraldas`, short: String(r.n) };
    if (r.t === 'brawler') return { img: portrait(r.id), label: `¡Nuevo luchador: ${DATA.brawlers[r.id].name}!`, short: DATA.brawlers[r.id].name };
    if (r.t === 'skin') return { img: portrait(r.b, r.s), label: `Aspecto: ${DATA.brawlers[r.b].skins[r.s].name}`, short: DATA.brawlers[r.b].skins[r.s].name };
    if (r.t === 'pass') return { icon: '👑', label: '¡Pase Premium desbloqueado!', short: 'Premium' };
    return { icon: '?', label: '', short: '' };
  }

  function showRewards(list) {
    FW.Sfx.reward();
    const items = list.map((r, i) => {
      const v = rewardView(r);
      const dup = r.dup ? '<div class="small muted">(repetido, convertido)</div>' : '';
      return `<div class="reward-pop" style="animation-delay:${i * 0.08}s">${v.img ? `<img src="${v.img}" alt="">` : `<div class="ri">${v.icon}</div>`}<div class="rl">${esc(v.label)}</div>${dup}</div>`;
    }).join('');
    modal(`<h3 class="stroke">¡Recompensa!</h3><div class="reward-list">${items}</div><button class="btn btn-yellow big" data-close>¡Genial!</button>`, (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  }

  // ------------------------------------------------------------- conexión
  socket.on('connect', () => {
    myId = socket.id;
    socket.emit('auth', { token: store.get('fw-token'), name: store.get('fw-name') || '' });
  });
  socket.on('disconnect', () => {
    FW.Game.stop();
    room = null;
    if (screen !== 'loading') { show('loading'); $('loading').querySelector('.loading-txt').textContent = 'Reconectando…'; }
  });
  socket.on('hello', (d) => { DATA = d; });
  socket.on('token', (t) => store.set('fw-token', t));
  socket.on('profile', (p) => {
    P = p;
    if (screen === 'loading') {
      show('home');
      if (firstProfile) { firstProfile = false; askName(true); }
      if (pendingJoin) { socket.emit('joinRoom', { code: pendingJoin }); pendingJoin = null; }
    } else render();
  });
  socket.on('rewards', showRewards);
  socket.on('errorMsg', (m) => toast(m));

  // ------------------------------------------------------------- render
  function render() {
    if (!P || !DATA) return;
    $$('.js-coins').forEach((e) => (e.textContent = P.coins));
    $$('.js-em').forEach((e) => (e.textContent = P.emeralds));
    $$('.js-mute').forEach((e) => (e.textContent = FW.Sfx.muted ? '🔇' : '🔊'));
    if (screen === 'home') renderHome();
    if (screen === 'brawlers') renderBrawlers();
    if (screen === 'shop') renderShop();
    if (screen === 'pass') renderPass();
    if (screen === 'room') renderRoom();
  }

  function claimableCount() {
    const ps = P.pass;
    let n = 0;
    for (let t = 1; t <= ps.tier; t++) {
      if (!ps.claimedFree.includes(t)) n++;
      if (ps.premiumActive && !ps.claimedPremium.includes(t)) n++;
    }
    return n;
  }

  function renderHome() {
    const sel = P.selected;
    const o = P.owned[sel];
    $('pName').textContent = P.name;
    $('pTrophies').textContent = P.totalTrophies;
    $('avatarImg').src = portrait(sel, o.skin, 96);
    $('selName').textContent = DATA.brawlers[sel].name;
    $('selTrophies').textContent = P.trophies[sel] || 0;
    $('selLevel').textContent = 'Nivel ' + o.level;
    const ps = P.pass;
    $('passTier').textContent = ps.tier;
    $('passXp').style.width = (ps.tier >= DATA.pass.tiers ? 100 : (ps.xpInTier / DATA.pass.xpPerTier) * 100) + '%';
    $('passXpTxt').textContent = ps.tier >= DATA.pass.tiers ? '¡COMPLETADO!' : `${ps.xpInTier}/${DATA.pass.xpPerTier} XP`;
    $('passTrial').textContent = ps.premium ? '👑 Premium activo' : ps.trialActive ? `🎁 Premium GRATIS · quedan ${fmtLeft(ps.trialEndsAt - Date.now())}` : '🔒 Premium: desbloquéalo con esmeraldas';
    $('passDot').classList.toggle('hidden', claimableCount() === 0);
    $('shopDot').classList.toggle('hidden', !P.dailyAvailable);
    const m = DATA.modes[mode];
    $('modeIc').textContent = m.icon;
    $('modeName').textContent = m.name;
  }

  // Escaparate animado del luchador en el inicio.
  const sc = $('showcase');
  const sctx = sc.getContext('2d');
  let mouseX = 0.5;
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX / window.innerWidth; });
  function drawShowcase(now) {
    if (screen === 'home' && P && DATA) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = sc.clientWidth, h = sc.clientHeight;
      if (sc.width !== Math.round(w * dpr) || sc.height !== Math.round(h * dpr)) { sc.width = Math.round(w * dpr); sc.height = Math.round(h * dpr); }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, w, h);
      const cx = w / 2, base = h * 0.86;
      const g = sctx.createRadialGradient(cx, base - h * 0.35, 10, cx, base - h * 0.35, Math.min(w, h) * 0.48);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = g; sctx.fillRect(0, 0, w, h);
      // Plataforma de hierba
      A.ell(sctx, cx, base + 10, w * 0.3, h * 0.07); sctx.fillStyle = '#3d7a2a'; sctx.fill(); sctx.lineWidth = 4; sctx.strokeStyle = '#000'; sctx.stroke();
      A.ell(sctx, cx, base, w * 0.3, h * 0.07); sctx.fillStyle = '#7fd04f'; sctx.fill(); sctx.stroke();
      A.ell(sctx, cx - w * 0.08, base - h * 0.015, w * 0.1, h * 0.02); sctx.fillStyle = 'rgba(255,255,255,0.25)'; sctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = now / 2000 + i * 0.785;
        const r = w * 0.32;
        const sx = cx + Math.cos(a) * r, sy = base - h * 0.3 + Math.sin(a * 1.3) * h * 0.25;
        A.circ(sctx, sx, sy, 3 + (i % 3)); sctx.fillStyle = 'rgba(255,255,200,' + (0.4 + Math.sin(now / 300 + i) * 0.3) + ')'; sctx.fill();
      }
      const sel = P.selected, o = P.owned[sel];
      const b = DATA.brawlers[sel];
      const scale = (h / 100) * 0.95;
      const aim = (mouseX - 0.5) * 1.2 + Math.sin(now / 1500) * 0.15;
      A.drawBrawler(sctx, sel, (b.skins[o.skin] || b.skins.default).pal, { x: cx, y: base, scale, aim, t: now, moving: false });
    }
    requestAnimationFrame(drawShowcase);
  }
  requestAnimationFrame(drawShowcase);

  // ------------------------------------------------------------- navegación
  document.addEventListener('click', (e) => {
    FW.Sfx.unlock();
    const go = e.target.closest('[data-go]');
    if (go) {
      FW.Sfx.click();
      if (go.dataset.go === 'brawlers') viewBrawler = P ? P.selected : null;
      show(go.dataset.go);
    }
    const mute = e.target.closest('.js-mute');
    if (mute) { FW.Sfx.toggle(); render(); }
  });

  function askName(first) {
    modal(`<h3 class="stroke">${first ? '¡Bienvenido al bosque!' : 'Cambiar nombre'}</h3>
      <p class="muted">${first ? '¿Cómo quieres llamarte?' : 'Elige un nombre nuevo'}</p>
      <input id="nameInput" maxlength="14" placeholder="Tu nombre" value="${esc(first ? '' : P.name)}">
      ${first ? `<p class="small muted">🎁 Durante tu primera semana el <b>Pase Premium es gratis</b>.</p>` : ''}
      <button class="btn btn-yellow big" data-save>Aceptar</button>`, (e) => {
      if (!e.target.closest('[data-save]')) return;
      const n = $('nameInput').value.trim() || 'Jugador';
      store.set('fw-name', n);
      act('setName', { name: n });
      closeModal();
    });
    setTimeout(() => $('nameInput') && $('nameInput').focus(), 50);
    $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('modalBody').querySelector('[data-save]').click(); });
  }
  $('profileBtn').onclick = () => askName(false);

  $('modeBtn').onclick = () => {
    FW.Sfx.click();
    const opts = Object.entries(DATA.modes).map(([k, m]) => `
      <button class="mode-opt${k === mode ? ' on' : ''}" data-mode="${k}"><div class="mi">${m.icon}</div><div class="mn">${m.name}</div><div class="md">${m.desc}</div></button>`).join('');
    modal(`<h3 class="stroke">Elige modo</h3><div class="modes-list">${opts}</div>`, (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      mode = b.dataset.mode;
      store.set('fw-mode', mode);
      closeModal();
      FW.Sfx.click();
      render();
    });
  };

  $('playBtn').onclick = () => {
    FW.Sfx.click();
    socket.emit('quickPlay', { mode });
    $('qMode').textContent = DATA.modes[mode].icon + ' ' + DATA.modes[mode].name;
    $('qCount').textContent = '1/?';
    show('queue');
  };
  $('cancelQueueBtn').onclick = () => { socket.emit('leaveRoom'); show('home'); };
  socket.on('queue', (q) => {
    if (screen !== 'queue') return;
    $('qCount').textContent = `${q.count}/${q.max}`;
    $('qSub').textContent = q.startsIn > 0 ? `Empieza en ${Math.ceil(q.startsIn / 1000)} s. Si faltan jugadores, completaremos con bots.` : '¡Preparando partida!';
  });

  // ------------------------------------------------------------- luchadores
  function brawlerStats(id, level) {
    const b = DATA.brawlers[id];
    const mult = 1 + 0.08 * (level - 1);
    const a = b.attack;
    let dmg = a.dmg * mult;
    let dmgTxt = Math.round(dmg);
    if (a.type === 'spread') dmgTxt = `${Math.round(dmg)} × ${a.count}`;
    if (a.type === 'burst') dmgTxt = `${Math.round(dmg)} × ${a.count}`;
    const range = a.range >= 600 ? 'Muy largo' : a.range >= 450 ? 'Largo' : a.range >= 300 ? 'Medio' : 'Corto';
    const speed = b.speed >= 260 ? 'Muy rápido' : b.speed >= 240 ? 'Rápido' : b.speed >= 225 ? 'Normal' : 'Lento';
    return { hp: Math.round(b.hp * mult), dmg: dmgTxt, range, speed, mult };
  }

  function renderBrawlers() {
    const ids = Object.keys(DATA.brawlers);
    if (!viewBrawler || !DATA.brawlers[viewBrawler]) viewBrawler = P.selected;
    $('bGrid').innerHTML = ids.map((id) => {
      const b = DATA.brawlers[id];
      const o = P.owned[id];
      return `<button class="b-card${o ? '' : ' locked'}${id === viewBrawler ? ' sel' : ''}" data-b="${id}">
        ${o ? `<span class="lvl">${o.level}</span>` : ''}<span class="rar rar-${b.rarity}">${b.rarity}</span>
        <img src="${portrait(id, o ? o.skin : 'default')}" alt="">
        <div class="bn">${b.name}</div>
        <div class="bt">${o ? `<span class="ic-trophy sm"></span>${P.trophies[id] || 0}` : '🔒'}</div></button>`;
    }).join('');

    const id = viewBrawler;
    const b = DATA.brawlers[id];
    const o = P.owned[id];
    const level = o ? o.level : 1;
    const st = brawlerStats(id, level);
    let actions = '';
    if (o) {
      const isSel = P.selected === id;
      const next = level < DATA.levels.max ? DATA.levels.cost[level + 1] : null;
      actions = `<div class="row-btns">
        <button class="btn btn-yellow" data-act="select" ${isSel ? 'disabled' : ''}>${isSel ? 'Seleccionado' : 'Seleccionar'}</button>
        ${next ? `<button class="btn btn-green" data-act="upgrade" ${P.coins < next ? 'disabled' : ''}>Nivel ${level + 1} · <span class="price-tag">${COIN}${next}</span></button>` : '<button class="btn btn-green" disabled>Nivel máximo</button>'}
      </div>`;
    } else {
      const src = passSource({ t: 'brawler', id });
      actions = `<div class="row-btns"><button class="btn btn-yellow" data-act="buy" ${P.coins < b.price ? 'disabled' : ''}>Desbloquear · <span class="price-tag">${COIN}${b.price}</span></button></div>
        ${src ? `<p class="small muted">También en el Pase del Bosque: nivel ${src.tier} (${src.track === 'free' ? 'gratis' : 'premium'}).</p>` : ''}`;
    }
    const skins = Object.entries(b.skins).map(([sid, s]) => {
      const has = o && o.skins.includes(sid);
      const on = o && o.skin === sid;
      let price = '';
      if (!has) {
        if (s.price) price = `<div class="price">${EM}${s.price}</div>`;
        else { const src = passSource({ t: 'skin', b: id, s: sid }); price = `<div class="price">Pase ${src ? src.tier : ''}</div>`; }
      }
      return `<button class="skin${on ? ' on' : ''}${has ? '' : ' lock'}" data-skin="${sid}"><img src="${portrait(id, sid, 96)}" alt=""><div>${esc(s.name)}</div>${price}</button>`;
    }).join('');
    $('bDetail').innerHTML = `
      <div class="bd-top"><img src="${portrait(id, o ? o.skin : 'default', 160)}" alt="">
        <div><span class="rar rar-${b.rarity}" style="position:static;display:inline-block;margin-bottom:4px;font-size:11px;padding:2px 6px;border-radius:6px;border:2px solid #000;color:#fff;font-weight:900">${b.rarity}</span>
        <div class="bd-name">${b.name}</div><div class="bd-desc">${b.animal} · ${o ? 'Nivel ' + level : 'Bloqueado'}</div><div class="bd-desc">${b.desc}</div></div></div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Vida</div><div class="v">${st.hp}</div></div>
        <div class="stat"><div class="k">Daño</div><div class="v">${st.dmg}</div></div>
        <div class="stat"><div class="k">Alcance</div><div class="v">${st.range}</div></div>
        <div class="stat"><div class="k">Velocidad</div><div class="v">${st.speed}</div></div>
      </div>
      <div class="ability"><b>Ataque · ${b.attack.name}</b></div>
      <div class="ability"><b>Súper · ${b.superName}</b><br>${b.superDesc}</div>
      ${actions}
      <div class="label">Aspectos</div>
      <div class="skins">${skins}</div>`;
  }

  $('bGrid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-b]');
    if (!c) return;
    FW.Sfx.click();
    viewBrawler = c.dataset.b;
    renderBrawlers();
  });
  $('bDetail').addEventListener('click', (e) => {
    const id = viewBrawler;
    const a = e.target.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'select') act('select', { id });
      if (a.dataset.act === 'upgrade') act('upgrade', { id });
      if (a.dataset.act === 'buy') act('buyBrawler', { id });
      return;
    }
    const s = e.target.closest('[data-skin]');
    if (!s) return;
    const sid = s.dataset.skin;
    const o = P.owned[id];
    if (!o) return toast('Primero desbloquea este luchador.');
    if (o.skins.includes(sid)) return act('select', { id, skin: sid });
    const skin = DATA.brawlers[id].skins[sid];
    if (skin.price) {
      modal(`<h3 class="stroke">${esc(skin.name)}</h3><img src="${portrait(id, sid, 160)}" alt="" width="160" height="160">
        <button class="btn btn-green big" data-buy>Comprar · <span class="price-tag">${EM}${skin.price}</span></button>`, (ev) => {
        if (ev.target.closest('[data-buy]')) { act('buySkin', { b: id, s: sid }); closeModal(); }
      });
    } else toast('Este aspecto se consigue en el Pase del Bosque.');
  });

  // ------------------------------------------------------------- tienda
  function renderShop() {
    const ps = P.pass;
    let html = '<div class="shop-sec"><h3>Ofertas</h3><div class="shop-row">';
    html += `<div class="offer gift"><div class="em-big">🎁</div><div class="on">Regalo diario</div><div class="small">40 monedas + 5 esmeraldas</div>
      <button class="btn btn-yellow" data-shop="daily" ${P.dailyAvailable ? '' : 'disabled'}>${P.dailyAvailable ? '¡Gratis!' : 'Vuelve mañana'}</button></div>`;
    let passBtn;
    if (ps.premium) passBtn = '<button class="btn btn-yellow" disabled>Activo</button>';
    else if (ps.trialActive) passBtn = `<button class="btn btn-yellow" data-go="pass">GRATIS ${fmtLeft(ps.trialEndsAt - Date.now())}</button>`;
    else passBtn = `<button class="btn btn-yellow" data-shop="pass" ${P.emeralds < DATA.pass.premiumPrice ? 'disabled' : ''}>Comprar · <span class="price-tag">${EM}${DATA.pass.premiumPrice}</span></button>`;
    html += `<div class="offer big"><div class="em-big">👑</div><div class="on stroke">Pase Premium</div><div class="small">Desbloquea la vía premium: aspectos exclusivos, luchadores y más recompensas.</div>${passBtn}</div>`;
    html += '</div></div>';

    const locked = Object.entries(DATA.brawlers).filter(([id]) => !P.owned[id]);
    if (locked.length) {
      html += '<div class="shop-sec"><h3>Luchadores</h3><div class="shop-row">';
      for (const [id, b] of locked) {
        html += `<div class="offer"><img src="${portrait(id)}" alt=""><div class="on">${b.name}</div><div class="small muted">${b.rarity}</div>
          <button class="btn btn-green" data-shop="brawler" data-id="${id}" ${P.coins < b.price ? 'disabled' : ''}><span class="price-tag">${COIN}${b.price}</span></button></div>`;
      }
      html += '</div></div>';
    }
    const skins = [];
    for (const [id, b] of Object.entries(DATA.brawlers)) {
      for (const [sid, s] of Object.entries(b.skins)) {
        if (!s.price) continue;
        const o = P.owned[id];
        if (o && o.skins.includes(sid)) continue;
        skins.push(`<div class="offer"><img src="${portrait(id, sid)}" alt=""><div class="on">${esc(s.name)}</div><div class="small muted">${b.name}${o ? '' : ' (necesitas el luchador)'}</div>
          <button class="btn btn-green" data-shop="skin" data-id="${id}" data-s="${sid}" ${!o || P.emeralds < s.price ? 'disabled' : ''}><span class="price-tag">${EM}${s.price}</span></button></div>`);
      }
    }
    if (skins.length) html += `<div class="shop-sec"><h3>Aspectos</h3><div class="shop-row">${skins.join('')}</div></div>`;
    html += `<p class="small" style="color:#dbe6ff;text-align:center">Las monedas y esmeraldas se ganan jugando y en el Pase del Bosque. No hay compras con dinero real.</p>`;
    $('shopBody').innerHTML = html;
  }
  $('shopBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop]');
    if (!b) return;
    const k = b.dataset.shop;
    if (k === 'daily') act('daily');
    if (k === 'pass') act('buyPass');
    if (k === 'brawler') act('buyBrawler', { id: b.dataset.id });
    if (k === 'skin') act('buySkin', { b: b.dataset.id, s: b.dataset.s });
  });

  // ------------------------------------------------------------- pase
  let passScrolled = false;
  function renderPass() {
    const ps = P.pass;
    const D = DATA.pass;
    let banner;
    if (ps.premium) banner = '<div class="trial-banner"><big>👑 Pase Premium activo</big>Disfruta de todas las recompensas premium.</div>';
    else if (ps.trialActive) {
      banner = `<div class="trial-banner"><big>🎁 ¡Premium GRATIS tu primera semana!</big>Reclama todas las recompensas premium que alcances. Termina en <b>${fmtLeft(ps.trialEndsAt - Date.now())}</b>.</div>`;
    } else {
      banner = `<div class="trial-banner off"><big>🔒 Tu semana gratis terminó</big>Desbloquea la vía premium por ${D.premiumPrice} esmeraldas.
        <div style="margin-top:6px"><button class="btn btn-purple" data-pass="buy" ${P.emeralds < D.premiumPrice ? 'disabled' : ''}>Desbloquear · <span class="price-tag">${EM}${D.premiumPrice}</span></button></div></div>`;
    }
    const n = claimableCount();
    $('passHead').innerHTML = `<div class="ph-tier">${ps.tier}</div>
      <div class="ph-main"><div class="ph-season">${esc(D.name)}</div>
        <div class="xpbar"><i style="width:${ps.tier >= D.tiers ? 100 : (ps.xpInTier / D.xpPerTier) * 100}%"></i><span>${ps.tier >= D.tiers ? '¡COMPLETADO!' : `${ps.xpInTier}/${D.xpPerTier} XP hasta el nivel ${ps.tier + 1}`}</span></div>
        <div class="small muted">Gana XP en cada partida (más si ganas y derribas enemigos).</div></div>
      ${banner}
      <button class="btn btn-yellow" data-pass="all" ${n ? '' : 'disabled'}>Reclamar todo${n ? ` (${n})` : ''}</button>`;

    let html = '';
    for (let t = 1; t <= D.tiers; t++) {
      const reached = t <= ps.tier;
      const cell = (track, r) => {
        const claimed = (track === 'premium' ? ps.claimedPremium : ps.claimedFree).includes(t);
        const unlocked = track === 'free' || ps.premiumActive;
        const cls = claimed ? 'claimed' : reached && unlocked ? 'claimable' : 'locked';
        const v = rewardView(r);
        const vis = v.img ? `<img src="${v.img}" alt="">` : `<div class="ri">${v.icon}</div>`;
        return `<div class="reward ${track === 'premium' ? 'prem' : ''} ${cls}" data-track="${track}" data-tier="${t}" title="${esc(v.label)}">${vis}<div class="rv">${esc(v.short)}</div></div>`;
      };
      html += `<div class="tier${reached ? ' reached' : ''}">${cell('premium', D.premium[t - 1])}<div class="tier-num"><span>${t}</span></div>${cell('free', D.free[t - 1])}</div>`;
    }
    $('passTrack').innerHTML = html;
    if (!passScrolled) {
      passScrolled = true;
      requestAnimationFrame(() => { $('passTrack').scrollLeft = Math.max(0, (ps.tier - 2) * 128); });
    }
  }
  $('pass').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pass]');
    if (b) {
      if (b.dataset.pass === 'all') act('claimAll');
      if (b.dataset.pass === 'buy') act('buyPass');
      return;
    }
    const r = e.target.closest('.reward.claimable');
    if (r) act('claim', { track: r.dataset.track, tier: +r.dataset.tier });
    else if (e.target.closest('.reward.locked')) {
      const rr = e.target.closest('.reward');
      if (rr.dataset.track === 'premium' && !P.pass.premiumActive) toast('Necesitas el Pase Premium.');
      else toast(`Llega al nivel ${rr.dataset.tier} del pase para reclamarlo.`);
    }
  });

  // ------------------------------------------------------------- salas privadas
  $('createBtn').onclick = () => { FW.Sfx.click(); socket.emit('createRoom'); };
  const join = () => {
    const code = $('codeInput').value.trim().toUpperCase();
    if (code.length < 5) return toast('Escribe el código de 5 letras.');
    FW.Sfx.click();
    socket.emit('joinRoom', { code });
  };
  $('joinBtn').onclick = join;
  $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  if (pendingJoin) $('codeInput').value = pendingJoin.toUpperCase();

  socket.on('joined', ({ code, you }) => {
    myId = you;
    history.replaceState(null, '', '?sala=' + code);
  });
  socket.on('roomState', (r) => {
    room = r;
    if (!FW.Game.active && screen !== 'room') show('room');
    else if (screen === 'room') renderRoom();
  });
  $('leaveRoomBtn').onclick = () => {
    socket.emit('leaveRoom');
    room = null;
    history.replaceState(null, '', location.pathname);
    show('home');
  };
  $('copyLinkBtn').onclick = async () => {
    const url = location.origin + location.pathname + '?sala=' + room.code;
    try { await navigator.clipboard.writeText(url); toast('¡Enlace copiado! Pásaselo a tus amigos.'); }
    catch (e) { prompt('Copia este enlace:', url); }
  };
  $('startBtn').onclick = () => { FW.Sfx.click(); socket.emit('startGame'); };

  function seg(el, items, current, enabled, onPick) {
    el.innerHTML = '';
    for (const [id, label] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = id === current ? 'on' : '';
      b.disabled = !enabled;
      b.onclick = () => { FW.Sfx.click(); onPick(id); };
      el.appendChild(b);
    }
  }

  function renderRoom() {
    if (!room) return;
    const isHost = room.hostId === myId;
    const me = room.members.find((m) => m.id === myId);
    const m = DATA.modes[room.mode];
    $('roomCode').textContent = room.code;
    seg($('modeSeg'), Object.entries(DATA.modes).map(([k, v]) => [k, v.icon + ' ' + v.name]), room.mode, isHost && !room.inGame, (mode) => socket.emit('setMode', { mode }));
    $('roomModeDesc').textContent = m.desc;
    seg($('mapSeg'), Object.entries(DATA.maps).map(([k, v]) => [k, v.name]), room.map, isHost && !room.inGame, (map) => socket.emit('setMap', { map }));
    $('diffSetting').classList.toggle('hidden', !isHost);
    seg($('diffSeg'), Object.entries(DIFF_NAMES), botDifficulty, true, (d) => { botDifficulty = d; store.set('fw-botdiff', d); renderRoom(); });

    const cols = m.team
      ? [{ team: 0, title: 'Equipo Azul', cls: 't0', max: 4 }, { team: 1, title: 'Equipo Rojo', cls: 't1', max: 4 }]
      : [{ team: null, title: 'Jugadores', cls: 'tffa', max: 8 }];
    const bOpts = (sel) => Object.entries(DATA.brawlers).map(([k, b]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${b.name}</option>`).join('');
    const dOpts = (sel) => Object.entries(DIFF_NAMES).map(([k, n]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${n}</option>`).join('');
    let html = '';
    for (const c of cols) {
      const list = c.team === null ? room.members : room.members.filter((x) => x.team === c.team);
      const canAdd = isHost && !room.inGame && list.length < c.max && room.members.length < 8;
      const canSwitch = c.team !== null && me && me.team !== c.team && !room.inGame && list.length < c.max;
      html += `<div class="card team ${c.cls}"><div class="team-head"><h3>${c.title} <span class="small muted">(${list.length}/${c.max})</span></h3><div class="row-btns">`;
      if (canSwitch) html += `<button class="btn btn-ghost" data-act="team" data-team="${c.team}">Unirme aquí</button>`;
      if (canAdd) html += `<button class="btn btn-ghost" data-act="addbot" data-team="${c.team === null ? '' : c.team}">+ Bot</button>`;
      html += '</div></div>';
      for (const x of list) {
        const b = DATA.brawlers[x.brawler];
        const tags = [];
        if (x.id === room.hostId) tags.push('<span class="tag">Anfitrión</span>');
        if (x.id === myId) tags.push('<span class="tag">Tú</span>');
        html += `<div class="member${x.id === myId ? ' me' : ''}"><img src="${portrait(x.brawler, x.skin, 64)}" alt=""><div class="nm">${esc(x.name)}<div class="sub">${b.name} · Nv ${x.level}${x.isBot ? ' · Bot ' + DIFF_NAMES[x.difficulty] : ''}</div></div>${tags.join(' ')}`;
        if (x.isBot && isHost && !room.inGame) {
          html += `<div class="ctrl"><select data-act="botbrawler" data-id="${x.id}" aria-label="Luchador del bot">${bOpts(x.brawler)}</select>`;
          html += `<select data-act="botdiff" data-id="${x.id}" aria-label="Dificultad del bot">${dOpts(x.difficulty)}</select>`;
          if (m.team) html += `<button class="btn btn-ghost" data-act="botteam" data-id="${x.id}" data-team="${1 - x.team}" title="Cambiar de equipo">⇄</button>`;
          html += `<button class="btn btn-ghost" data-act="rmbot" data-id="${x.id}" title="Quitar bot">✕</button></div>`;
        }
        html += '</div>';
      }
      for (let i = list.length; i < Math.min(c.max, m.team ? 3 : 4); i++) html += '<div class="empty-slot">Hueco libre</div>';
      html += '</div>';
    }
    $('teams').innerHTML = html;
    $('roomPick').innerHTML = Object.keys(P.owned).map((id) => `<button class="${me && me.brawler === id ? 'on' : ''}" data-pick="${id}" ${room.inGame ? 'disabled' : ''} title="${DATA.brawlers[id].name}"><img src="${portrait(id, P.owned[id].skin, 96)}" alt=""></button>`).join('');
    $('startBtn').classList.toggle('hidden', !isHost || room.inGame);
    $('waitHost').classList.toggle('hidden', isHost && !room.inGame);
    $('waitHost').textContent = room.inGame ? 'Hay una partida en curso. Entrarás en la siguiente.' : 'Esperando a que el anfitrión empiece…';
  }
  $('teams').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    FW.Sfx.click();
    const a = el.dataset.act;
    const team = el.dataset.team === '' || el.dataset.team === undefined ? null : +el.dataset.team;
    if (a === 'team') socket.emit('setTeam', { team });
    if (a === 'addbot') socket.emit('addBot', { team, difficulty: botDifficulty });
    if (a === 'rmbot') socket.emit('removeBot', { id: el.dataset.id });
    if (a === 'botteam') socket.emit('editBot', { id: el.dataset.id, team });
  });
  $('teams').addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'botbrawler') socket.emit('editBot', { id: el.dataset.id, brawler: el.value });
    if (el.dataset.act === 'botdiff') socket.emit('editBot', { id: el.dataset.id, difficulty: el.value });
  });
  $('roomPick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) act('select', { id: b.dataset.pick });
  });

  // ------------------------------------------------------------- partida
  socket.on('gameStart', (info) => {
    closeModal();
    inPublicGame = !!info.public;
    $('results').classList.add('hidden');
    show('game');
    FW.Game.start(info, myId, DATA, socket);
  });
  socket.on('state', (d) => FW.Game.onState(d));

  socket.on('gameOver', (res) => {
    FW.Game.gameOver();
    const me = res.players.find((p) => p.id === myId);
    let title, cls = '';
    const team = DATA.modes[res.mode].team;
    if (team) {
      if (res.winner === null) { title = 'EMPATE'; cls = 'draw'; }
      else if (me && res.winner === me.team) title = '¡VICTORIA!';
      else { title = 'DERROTA'; cls = 'lose'; }
      $('resultSub').textContent = res.winner === null ? '' : `Gana el ${res.winner === 0 ? 'Equipo Azul' : 'Equipo Rojo'}`;
    } else {
      const place = me ? me.place : null;
      if (place === 1) title = '¡VICTORIA!';
      else { title = place ? `PUESTO #${place}` : 'FIN'; cls = place && place <= Math.ceil(res.total / 2) ? 'draw' : 'lose'; }
      const w = res.players.find((p) => p.place === 1);
      $('resultSub').textContent = w ? `Ganador: ${w.name}` : '';
    }
    $('resultTitle').textContent = title;
    $('resultTitle').className = cls;
    const r = res.rewards;
    let rw = '';
    if (r) {
      if (res.public) rw += `<div class="rw${r.trophies < 0 ? ' neg' : ''}"><span class="ic-trophy"></span>${r.trophies >= 0 ? '+' : ''}${r.trophies}</div>`;
      rw += `<div class="rw xp">+${r.xp} XP</div><div class="rw">${COIN}+${r.coins}</div>`;
      if (r.newTier) rw += `<div class="rw xp">¡Nivel ${r.newTier} del pase!</div>`;
    }
    $('resultRewards').innerHTML = rw;
    const myTeam = me ? me.team : null;
    $('resultPlayers').innerHTML = res.players.map((p) => {
      const rel = p.id === myId ? 'me' : team ? (p.team === myTeam ? '' : 'enemy') : 'enemy';
      return `<div class="rp ${rel}">${p.place ? `<span class="rank">${p.place}</span>` : ''}<img src="${portrait(p.brawler, p.skin, 96)}" alt=""><div class="rn">${esc(p.name)}</div><div class="rs">💥${p.kills} · ${p.damage}</div></div>`;
    }).join('');
    setTimeout(() => {
      $('results').classList.remove('hidden');
      if (title === '¡VICTORIA!') FW.Sfx.win(); else FW.Sfx.lose();
    }, 1300);
  });

  $('continueBtn').onclick = () => {
    FW.Sfx.click();
    FW.Game.stop();
    $('results').classList.add('hidden');
    if (!inPublicGame && room) show('room');
    else show('home');
  };
  $('quitBtn').onclick = () => {
    modal('<h3 class="stroke">Pausa</h3><p class="muted">La partida sigue en marcha.</p><h3 class="stroke" style="font-size:22px">¿Salir de la partida?</h3><p class="muted">Si sales ahora no recibirás recompensas.</p><div class="row-btns" style="width:100%"><button class="btn btn-ghost" data-no>Seguir jugando</button><button class="btn btn-red" data-yes>Salir</button></div>', (e) => {
      if (e.target.closest('[data-no]')) closeModal();
      if (e.target.closest('[data-yes]')) {
        closeModal();
        FW.Game.stop();
        socket.emit('leaveRoom');
        room = null;
        history.replaceState(null, '', location.pathname);
        show('home');
      }
    });
  };

  // ------------------------------------------------------------- app móvil
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('installBtn').classList.remove('hidden');
  });
  if (isIOS && !standalone) $('installBtn').classList.remove('hidden');
  window.addEventListener('appinstalled', () => { $('installBtn').classList.add('hidden'); toast('¡Forest War instalado en tu móvil!'); });
  $('installBtn').onclick = async () => {
    FW.Sfx.click();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      $('installBtn').classList.add('hidden');
      return;
    }
    modal(`<h3 class="stroke">Instalar en iPhone</h3>
      <ol class="ios-steps"><li>Pulsa el botón <b>Compartir</b> ⬆️ de Safari.</li><li>Elige <b>«Añadir a pantalla de inicio»</b>.</li><li>Abre Forest War desde su icono: se juega a pantalla completa.</li></ol>
      <button class="btn btn-yellow big" data-close>Entendido</button>`, (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  };

  // Pantalla completa y bloqueo en horizontal (Android) con el primer toque.
  function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    } catch (e) { /* no soportado */ }
  }
  function goFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const r = req.call(el, { navigationUI: 'hide' });
      if (r && r.then) r.then(lockLandscape).catch(() => {});
    } catch (e) { /* no soportado */ }
  }
  if (FW.Game.isTouch && !standalone && (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !isIOS) {
    $('tapStart').classList.remove('hidden');
    $('tapStart').addEventListener('click', () => {
      FW.Sfx.unlock();
      goFullscreen();
      $('tapStart').classList.add('hidden');
    });
  } else if (standalone) {
    document.addEventListener('touchend', lockLandscape, { once: true });
  }
  // Si se sale de pantalla completa durante la partida, ofrecer volver.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && FW.Game.isTouch && !standalone && !isIOS) $('tapStart').classList.remove('hidden');
  });

  // Refrescar contadores de tiempo (prueba gratis del pase).
  setInterval(() => { if (screen === 'home' || screen === 'pass') render(); }, 30000);
})();
