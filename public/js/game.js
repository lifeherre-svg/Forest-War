/* Forest War - partida: interpolación, render 2.5D, HUD y controles. */
(() => {
  'use strict';
  const FW = (window.FW = window.FW || {});
  const A = FW.Art;
  const TILE = A.TILE;
  const INTERP = 100;
  const JOY_R = 60;
  const COL = { me: '#5ce65c', ally: '#3d8bff', enemy: '#ff4b3e' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, SCALE = 1;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const SAFE = { l: 0, r: 0, t: 0, b: 0 };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sin vibración */ } };

  const G = {
    active: false, over: false, meta: new Map(), myId: null, myTeam: null, mode: null, map: null,
    snaps: [], floaters: [], effects: [], feed: [], lastMe: null, myPos: null, camX: 0, camY: 0,
    shake: 0, lastHp: null, lastGems: 0, lastSup: 0, sample: null, spectate: null,
  };
  let DATA = null;
  let socket = null;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    const cs = getComputedStyle(probe);
    SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0;
    SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    SCALE = Math.min(W / 1150, H / 700);
    if (isTouch) SCALE = Math.max(SCALE, Math.min(W, H) / 600);
  }
  window.addEventListener('resize', resize);
  resize();

  function relation(team, id) {
    if (id === G.myId) return 'me';
    return team === G.myTeam ? 'ally' : 'enemy';
  }
  const palOf = (meta) => {
    const b = DATA.brawlers[meta.brawler];
    return (b.skins[meta.skin] || b.skins.default).pal;
  };

  function start(info, myId, data, sock) {
    DATA = data; socket = sock;
    G.active = true; G.over = false;
    G.myId = myId;
    G.mode = info.mode;
    G.map = A.buildMap(info.map.rows);
    G.meta = new Map(info.players.map((p) => [p.id, p]));
    const me = G.meta.get(myId);
    G.myTeam = me ? me.team : null;
    G.snaps = []; G.floaters = []; G.effects = []; G.feed = [];
    G.lastMe = null; G.myPos = null; G.shake = 0; G.lastHp = null; G.lastGems = 0; G.lastSup = 0; G.spectate = null;
    input.fs = 0; input.ss = 0; input.fire = false;
    keys.clear();
    resize();
  }

  function stop() { G.active = false; }
  function gameOver() { G.over = true; input.fire = false; }

  function onState(d) {
    if (!G.active) return;
    const now = performance.now();
    G.snaps.push({ t: now, d });
    if (G.snaps.length > 40) G.snaps.shift();
    const me = d.me;
    if (G.lastMe) {
      if (me.sup >= 1 && G.lastSup < 1) FW.Sfx.superReady();
      if (me.hp < G.lastMe.hp && me.alive) { G.shake = Math.min(10, G.shake + 5); FW.Sfx.hurt(); buzz(30); }
      if (!me.alive && G.lastMe.alive) buzz([80, 50, 80]);
    }
    G.lastSup = me.sup;
    const mine = d.p.find((p) => p[0] === G.myId);
    if (mine && mine[6] > G.lastGems) FW.Sfx.gem();
    if (mine) G.lastGems = mine[6];
    G.lastMe = me;
    for (const ev of d.ev) handleEvent(ev, now);
  }

  function handleEvent(ev, now) {
    if (ev.k === 'hit') {
      G.floaters.push({ x: ev.x + (Math.random() - 0.5) * 24, y: ev.y - 70, text: String(ev.d), t: now, col: ev.id === G.myId ? '#ff6b5e' : '#fff' });
      G.effects.push({ type: 'spark', x: ev.x, y: ev.y - 30, t: now, dur: 250 });
      FW.Sfx.hit();
    } else if (ev.k === 'heal') {
      G.floaters.push({ x: ev.x + (Math.random() - 0.5) * 24, y: ev.y - 70, text: '+' + ev.d, t: now, col: '#7dff7a' });
      FW.Sfx.heal();
    } else if (ev.k === 'atk') {
      const m = G.meta.get(ev.id);
      G.effects.push({ type: 'flash', x: ev.x + Math.cos(ev.a) * 26, y: ev.y - 28 + Math.sin(ev.a) * 16, t: now, dur: 110 });
      if (m) FW.Sfx.shot(m.brawler, ev.id === G.myId);
    } else if (ev.k === 'boom') {
      G.effects.push({ type: 'boom', x: ev.x, y: ev.y, r: ev.r, t: now, dur: 450 });
      FW.Sfx.boom();
    } else if (ev.k === 'super') {
      G.effects.push({ type: 'ring', x: ev.x, y: ev.y, r: 80, t: now, dur: 500 });
      FW.Sfx.super();
    } else if (ev.k === 'kill') {
      G.effects.push({ type: 'poof', x: ev.x, y: ev.y - 25, r: 50, t: now, dur: 700 });
      G.feed.push({ a: ev.a, v: ev.v, t: now });
      if (G.feed.length > 5) G.feed.shift();
      if (ev.a === G.myId) FW.Sfx.kill();
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
    const A_ = a.d, B = b.d;
    const pa = new Map(A_.p.map((p) => [p[0], p]));
    const players = B.p.map((p) => {
      const o = pa.get(p[0]);
      return {
        id: p[0], x: o ? lerp(o[1], p[1], alpha) : p[1], y: o ? lerp(o[2], p[2], alpha) : p[2],
        hp: o ? lerp(o[3], p[3], alpha) : p[3], aim: p[4], bush: !!(p[5] & 1), sup: !!(p[5] & 2), dash: !!(p[5] & 4),
        shield: !!(p[5] & 8), moving: !!(p[5] & 16), gems: p[6],
      };
    });
    const ba = new Map(A_.b.map((x) => [x[0], x]));
    const bullets = B.b.map((x) => {
      const o = ba.get(x[0]);
      return { x: o ? lerp(o[1], x[1], alpha) : x[1], y: o ? lerp(o[2], x[2], alpha) : x[2], kind: x[3], ang: o ? Math.atan2(x[2] - o[2], x[1] - o[1]) : 0 };
    });
    const la = new Map(A_.l.map((x) => [x[0], x]));
    const lobs = B.l.map((x) => {
      const o = la.get(x[0]);
      return { x0: x[1], y0: x[2], x1: x[3], y1: x[4], t: o ? lerp(o[5], x[5], alpha) : x[5], kind: x[6] };
    });
    const zone = lerp(A_.s.z || 0, B.s.z || 0, alpha);
    return { players, bullets, lobs, clouds: B.c, gems: B.g, s: B.s, k: B.k, zone };
  }

  // -------------------------------------------------------------- dibujo
  const FONT = (px) => `${px}px 'Lilita One', 'Nunito', sans-serif`;
  function text(str, x, y, px, fill, align = 'center', lw) {
    ctx.font = FONT(px);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw || Math.max(3, px / 4.5);
    ctx.strokeStyle = '#000';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }
  function panel(x, y, w, h, r, fill, stroke = '#000') {
    A.rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
  }

  function drawFrame(now) {
    const S = sample();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#1d4a22';
    ctx.fillRect(0, 0, W, H);
    if (!S || !G.map) return;
    G.sample = S;

    const meP = S.players.find((p) => p.id === G.myId);
    if (meP) { G.myPos = { x: meP.x, y: meP.y }; G.spectate = null; }
    else if (G.lastMe && !G.lastMe.alive && G.lastMe.rs === -1 && S.players.length) {
      // Eliminado en Supervivencia: seguir a otro jugador.
      let t = S.players.find((p) => p.id === G.spectate) || S.players[0];
      G.spectate = t.id;
      G.myPos = { x: t.x, y: t.y };
    } else if (G.lastMe && !G.myPos) G.myPos = { x: G.lastMe.x, y: G.lastMe.y };
    if (G.myPos) {
      const hw = W / 2 / SCALE, hh = H / 2 / SCALE;
      const mw = G.map.width, mh = G.map.height;
      const tx = mw > hw * 2 ? clamp(G.myPos.x, hw, mw - hw) : mw / 2;
      const ty = mh > hh * 2 ? clamp(G.myPos.y - 20, hh - 40, mh - hh) : mh / 2;
      G.camX = tx; G.camY = ty;
    }
    G.shake *= 0.85;
    const shx = (Math.random() - 0.5) * G.shake, shy = (Math.random() - 0.5) * G.shake;

    const ox = W / 2 - G.camX * SCALE + shx, oy = H / 2 - G.camY * SCALE + shy;
    ctx.setTransform(DPR * SCALE, 0, 0, DPR * SCALE, DPR * ox, DPR * oy);
    const vx0 = G.camX - W / 2 / SCALE - 80, vx1 = G.camX + W / 2 / SCALE + 80;
    const vy0 = G.camY - H / 2 / SCALE - 80, vy1 = G.camY + H / 2 / SCALE + 120;
    const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    ctx.drawImage(G.map.layer, 0, 0);
    const tx0 = Math.max(0, Math.floor(vx0 / TILE)), tx1 = Math.min(G.map.w - 1, Math.floor(vx1 / TILE));
    const ty0 = Math.max(0, Math.floor(vy0 / TILE)), ty1 = Math.min(G.map.h - 1, Math.floor(vy1 / TILE));
    A.drawWater(ctx, G.map, now, tx0, ty0, tx1, ty1);

    // Zonas (nube tóxica / curación)
    for (const [, x, y, r, heal] of S.clouds) {
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      if (heal) { g.addColorStop(0, 'rgba(255,250,150,0.5)'); g.addColorStop(1, 'rgba(120,255,140,0.18)'); }
      else { g.addColorStop(0, 'rgba(170,240,80,0.5)'); g.addColorStop(1, 'rgba(130,60,170,0.2)'); }
      A.ell(ctx, x, y, r, r * 0.92); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = heal ? 'rgba(255,255,170,0.7)' : 'rgba(150,80,200,0.6)'; ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const a = now / 800 + i * 0.9;
        const px = x + Math.cos(a * 1.3) * r * 0.6, py = y + Math.sin(a) * r * 0.55 - ((now / 12 + i * 30) % 40);
        if (heal) text('+', px, py, 16, '#b6ff9a');
        else { A.circ(ctx, px, py, 7 + (i % 3) * 3); ctx.fillStyle = 'rgba(190,255,110,0.45)'; ctx.fill(); }
      }
    }

    if (meP && G.lastMe && G.lastMe.alive) drawAimGuide(meP);

    // Pasada en profundidad: muros, arbustos, personajes y cristales por filas.
    const buckets = new Map();
    const push = (row, item) => { if (!buckets.has(row)) buckets.set(row, []); buckets.get(row).push(item); };
    for (const p of S.players) push(Math.floor(p.y / TILE), { k: 'p', y: p.y, p });
    for (const [, x, y] of S.gems) if (inView(x, y)) push(Math.floor(y / TILE), { k: 'g', y, x });
    for (let r = ty0; r <= Math.min(G.map.h - 1, ty1 + 1); r++) {
      for (const it of G.map.rowItems[r]) {
        if (it.x < vx0 - TILE || it.x > vx1) continue;
        if (it.kind === 'rock') A.drawRock(ctx, it.x, it.y, it.v);
        else if (it.kind === 'crate') A.drawCrate(ctx, it.x, it.y);
        else if (it.kind === 'tree') A.drawTree(ctx, it.x, it.y, it.v);
        else {
          const near = G.myPos && Math.hypot(G.myPos.x - (it.x + 25), G.myPos.y - (it.y + 25)) < 100;
          A.drawBush(ctx, it.x, it.y, it.v, now, near ? 0.45 : 1);
        }
      }
      const list = buckets.get(r);
      if (!list) continue;
      list.sort((a, b) => a.y - b.y);
      for (const it of list) {
        if (it.k === 'g') { A.drawGem(ctx, it.x, it.y, now); continue; }
        const p = it.p;
        const meta = G.meta.get(p.id);
        if (!meta) continue;
        const rel = relation(meta.team, p.id);
        const def = DATA.brawlers[meta.brawler];
        A.drawBrawler(ctx, meta.brawler, palOf(meta), {
          x: p.x, y: p.y + 8, scale: def.radius / 22, aim: p.aim, t: now + p.id.length * 97, moving: p.moving || p.dash,
          alpha: p.bush ? (rel === 'enemy' ? 0.55 : 0.6) : 1, ring: COL[rel], superReady: p.sup, shield: p.shield,
        });
        if (p.dash) {
          ctx.globalAlpha = 0.35;
          A.ell(ctx, p.x - Math.cos(p.aim) * 30, p.y - 20, 22, 12); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Proyectiles
    for (const b of S.bullets) if (inView(b.x, b.y)) A.drawBullet(ctx, b.kind, b.x, b.y, b.ang, now);
    for (const l of S.lobs) {
      const x = lerp(l.x0, l.x1, l.t), y = lerp(l.y0, l.y1, l.t);
      A.drawLob(ctx, l.kind, x, y, Math.sin(Math.PI * l.t) * 120, l.x1, l.y1, l.kind === 'cloud' ? 150 : 75);
    }

    drawEffects(now);

    // Barras de vida, nombres y munición
    for (const p of S.players) {
      const meta = G.meta.get(p.id);
      if (!meta) continue;
      const def = DATA.brawlers[meta.brawler];
      const rel = relation(meta.team, p.id);
      const top = p.y - 70 * (def.radius / 22) - 18;
      const bw = 64, bh = 12;
      panel(p.x - bw / 2 - 2, top - 2, bw + 4, bh + 4, 6, '#2a2a2a');
      const frac = clamp(p.hp / meta.maxHp, 0, 1);
      if (frac > 0) {
        A.rrect(ctx, p.x - bw / 2, top, bw * frac, bh, 5);
        const g = ctx.createLinearGradient(0, top, 0, top + bh);
        g.addColorStop(0, A.sh(COL[rel], 0.35)); g.addColorStop(1, COL[rel]);
        ctx.fillStyle = g; ctx.fill();
      }
      text(String(Math.max(0, Math.round(p.hp))), p.x, top - 9, 15, '#fff');
      if (rel !== 'me') text(meta.name, p.x, top - 26, 13, rel === 'ally' ? '#bcd8ff' : '#ffc4be');
      if (p.gems > 0) {
        const gy = top - (rel === 'me' ? 30 : 46);
        A.drawGem(ctx, p.x - 12, gy + 14, now); text(String(p.gems), p.x + 10, gy, 16, '#e6c8ff');
      }
      if (p.id === G.myId && G.lastMe) {
        const ammo = G.lastMe.ammo;
        const sw = 20, gap = 3, ay = top + bh + 5;
        for (let i = 0; i < 3; i++) {
          const x = p.x - (sw * 3 + gap * 2) / 2 + i * (sw + gap);
          panel(x - 1.5, ay - 1.5, sw + 3, 9, 3, '#3a2a12');
          const f = clamp(ammo - i, 0, 1);
          if (f > 0) { ctx.fillStyle = f >= 1 ? '#ff9d2e' : '#c2752a'; ctx.fillRect(x, ay, sw * f, 6); }
        }
      }
    }

    // Números flotantes
    G.floaters = G.floaters.filter((f) => now - f.t < 900);
    for (const f of G.floaters) {
      const k = (now - f.t) / 900;
      ctx.globalAlpha = 1 - k * k;
      const pop = k < 0.15 ? 1 + (0.15 - k) * 4 : 1;
      text(f.text, f.x, f.y - k * 45, 20 * pop, f.col);
      ctx.globalAlpha = 1;
    }

    // Niebla tóxica (Supervivencia)
    if (S.zone > 0) {
      const z = S.zone, mw = G.map.width, mh = G.map.height;
      ctx.fillStyle = 'rgba(80,190,60,0.42)';
      ctx.fillRect(-500, -500, mw + 1000, z + 500);
      ctx.fillRect(-500, mh - z, mw + 1000, z + 500);
      ctx.fillRect(-500, z, z + 500, mh - 2 * z);
      ctx.fillRect(mw - z, z, z + 500, mh - 2 * z);
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(200,255,120,0.8)';
      ctx.setLineDash([18, 12]); ctx.lineDashOffset = -now / 40;
      ctx.strokeRect(z, z, mw - 2 * z, mh - 2 * z); ctx.setLineDash([]);
      for (let i = 0; i < 24; i++) {
        const a = i * 1.7 + now / 3000;
        const side = i % 4;
        const along = ((i * 137 + now / 30) % (mw));
        let px, py;
        if (side === 0) { px = along; py = z - 30 - (i % 3) * 20; } else if (side === 1) { px = along; py = mh - z + 30 + (i % 3) * 20; }
        else if (side === 2) { px = z - 30; py = (along / mw) * mh; } else { px = mw - z + 30; py = (along / mw) * mh; }
        A.circ(ctx, px, py, 18 + Math.sin(a) * 6); ctx.fillStyle = 'rgba(150,230,90,0.35)'; ctx.fill();
      }
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawHUD(S, now);
    drawTouch();
  }

  function drawEffects(now) {
    G.effects = G.effects.filter((e) => now - e.t < e.dur);
    for (const e of G.effects) {
      const k = (now - e.t) / e.dur;
      ctx.globalAlpha = 1 - k;
      if (e.type === 'boom') {
        A.ell(ctx, e.x, e.y, e.r * (0.4 + k * 0.7), e.r * (0.4 + k * 0.7) * 0.9);
        ctx.fillStyle = 'rgba(183,255,106,0.55)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#4f8f1a'; ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785;
          A.circ(ctx, e.x + Math.cos(a) * e.r * k, e.y + Math.sin(a) * e.r * k * 0.8 - k * 30, 8 * (1 - k) + 2);
          ctx.fillStyle = '#d7ff9a'; ctx.fill();
        }
      } else if (e.type === 'ring') {
        A.ell(ctx, e.x, e.y, e.r * (0.3 + k), e.r * (0.3 + k) * 0.5);
        ctx.lineWidth = 10 * (1 - k) + 1; ctx.strokeStyle = '#ffd23d'; ctx.stroke();
      } else if (e.type === 'spark') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = i * 1.047 + e.x;
          const r0 = 6 + k * 14, r1 = 12 + k * 22;
          ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0); ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1); ctx.stroke();
        }
      } else if (e.type === 'flash') {
        A.circ(ctx, e.x, e.y, 12 * (1 - k) + 4); ctx.fillStyle = '#fff6b0'; ctx.fill();
      } else if (e.type === 'poof') {
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * 2 * i) / 10;
          A.circ(ctx, e.x + Math.cos(a) * e.r * k, e.y + Math.sin(a) * e.r * k * 0.7 - k * 20, 13 * (1 - k) + 3);
          ctx.fillStyle = i % 2 ? '#fff' : '#ffe27a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function superRange(s) { return s.range || s.dist || s.radius || 300; }

  function drawSuperGuide(meP, s) {
    const j = touch.sup;
    const ang = Math.atan2(j.y - j.oy, j.x - j.ox);
    const dist = (Math.min(JOY_R, Math.hypot(j.x - j.ox, j.y - j.oy)) / JOY_R) * superRange(s);
    ctx.save();
    ctx.translate(meP.x, meP.y);
    ctx.fillStyle = 'rgba(255,210,61,0.3)';
    ctx.strokeStyle = 'rgba(255,230,120,0.95)';
    ctx.lineWidth = 3;
    if (s.type === 'ring' || s.type === 'heal' || s.type === 'shield') {
      const r = s.type === 'ring' ? s.range : s.type === 'heal' ? s.radius : 45;
      A.ell(ctx, 0, 0, r, r * 0.92); ctx.fill(); ctx.stroke();
    } else if (s.type === 'cloud') {
      const d = clamp(dist || s.range, 60, s.range);
      A.ell(ctx, Math.cos(ang) * d, Math.sin(ang) * d, s.radius, s.radius * 0.92); ctx.fill(); ctx.stroke();
    } else {
      ctx.rotate(ang);
      const w = s.type === 'dash' ? 26 : s.bulletR + 4;
      A.rrect(ctx, 0, -w, s.type === 'dash' ? s.dist : s.range, w * 2, w); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawAimGuide(meP) {
    const meta = G.meta.get(G.myId);
    const a = DATA.brawlers[meta.brawler].attack;
    let show = !isTouch;
    let ang = input.aim, dist = input.aimDist;
    if (isTouch && touch.sup.id !== null && touch.sup.dragged) {
      drawSuperGuide(meP, DATA.brawlers[meta.brawler].super);
      return;
    }
    if (isTouch && touch.aim.id !== null && touch.aim.dragged) {
      show = true;
      ang = Math.atan2(touch.aim.y - touch.aim.oy, touch.aim.x - touch.aim.ox);
      dist = (Math.min(JOY_R, Math.hypot(touch.aim.x - touch.aim.ox, touch.aim.y - touch.aim.oy)) / JOY_R) * a.range;
    }
    if (!show) return;
    ctx.save();
    ctx.translate(meP.x, meP.y);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    if (a.type === 'lob') {
      const d = clamp(dist || a.range, 60, a.range);
      A.ell(ctx, Math.cos(ang) * d, Math.sin(ang) * d, a.radius, a.radius * 0.92); ctx.fill(); ctx.stroke();
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * d, Math.sin(ang) * d); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.rotate(ang);
      if (a.type === 'spread') {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, a.range, -a.spread / 2 - 0.05, a.spread / 2 + 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        A.rrect(ctx, 0, -a.bulletR - 2, a.range, a.bulletR * 2 + 4, a.bulletR + 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function fmtTime(s) {
    s = Math.ceil(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function scorePill(x, y, w, h, fill, label, value, gem, now) {
    panel(x, y, w, h, 12, fill);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
    A.rrect(ctx, x + 2, y + 2, w - 4, h / 2, 10); ctx.fillStyle = g; ctx.fill();
    if (gem) { ctx.save(); ctx.translate(x + 22, y + h / 2 + 8); ctx.scale(0.8, 0.8); A.drawGem(ctx, 0, 0, 0); ctx.restore(); }
    else text(label, x + 20, y + h / 2, 18, '#fff');
    text(String(value), x + w - 24, y + h / 2 + 1, 24, '#fff');
  }

  function drawHUD(S, now) {
    const st = S.s;
    const cx = W / 2;
    const sm = W < 720 ? 0.8 : 1;
    ctx.save();
    ctx.translate(cx, 8);
    ctx.scale(sm, sm);
    panel(-44, 0, 88, 40, 12, 'rgba(20,20,30,0.75)');
    text(fmtTime(st.tl), 0, 21, 24, st.tl < 30 ? '#ff8a7e' : '#fff');
    const myTeam = G.myTeam;
    if (G.mode === 'gems' || G.mode === 'tdm') {
      const vals = G.mode === 'gems' ? st.tg : st.sc;
      const mine = myTeam === 1 ? 1 : 0, other = 1 - mine;
      scorePill(-160, 0, 106, 40, COL.ally, '⚔', vals[mine], G.mode === 'gems', now);
      scorePill(54, 0, 106, 40, COL.enemy, '⚔', vals[other], G.mode === 'gems', now);
      if (G.mode === 'tdm') text('Primero a ' + DATA.modes.tdm.target, 0, 54, 15, '#fff');
      if (st.cd) {
        const ours = st.cd.team === myTeam;
        const n = Math.ceil(st.cd.left);
        text(String(n), 0, 92, 50, ours ? '#7fc0ff' : '#ff8a7e');
        text(ours ? '¡Aguantad los cristales!' : '¡Recuperad los cristales!', 0, 128, 18, '#fff');
        if (G.lastCd !== n) { G.lastCd = n; FW.Sfx.tick(); }
      }
    } else if (G.mode === 'survival') {
      panel(54, 0, 110, 40, 12, 'rgba(20,20,30,0.75)');
      text('☠ ' + st.al, 109, 21, 22, '#fff');
      if (S.zone > 0 && S.zone < 40) text('¡La niebla tóxica se acerca!', 0, 62, 20, '#b6ff7a');
    }
    ctx.restore();

    if (G.mode === 'ffa') {
      const list = (S.k || []).slice().sort((a, b) => b[1] - a[1]).slice(0, 5);
      const lx = SAFE.l + 62;
      panel(lx, 8, 178, 28 + list.length * 21, 12, 'rgba(20,20,30,0.7)');
      text('Derribos · meta ' + DATA.modes.ffa.target, lx + 10, 22, 14, '#ffd23d', 'left');
      list.forEach(([id, k], i) => {
        const m = G.meta.get(id);
        text((m ? m.name : '?').slice(0, 13), lx + 10, 44 + i * 21, 14, id === G.myId ? '#a6ff9a' : '#fff', 'left');
        text(String(k), lx + 166, 44 + i * 21, 15, '#fff', 'right');
      });
    }

    // Registro de derribos
    G.feed = G.feed.filter((f) => now - f.t < 5000);
    G.feed.forEach((f, i) => {
      const a = G.meta.get(f.a), v = G.meta.get(f.v);
      const y = (G.mode === 'ffa' ? 22 : 64) + i * 24;
      const aName = a ? a.name : 'Niebla', vName = v ? v.name : '¿?';
      const rx = W - 12 - SAFE.r;
      ctx.font = FONT(14);
      const vw = ctx.measureText(vName).width;
      text(vName, rx, y, 14, v ? COL[relation(v.team, v.id)] : '#fff', 'right');
      text(' 💥 ', rx - vw, y, 14, '#fff', 'right');
      ctx.font = FONT(14);
      const sw = ctx.measureText(' 💥 ').width;
      text(aName, rx - vw - sw, y, 14, a ? COL[relation(a.team, a.id)] : '#b6ff7a', 'right');
    });

    if (st.si > 0) {
      const n = Math.ceil(st.si);
      if (G.lastCount !== n) { G.lastCount = n; FW.Sfx.tick(); }
      const k = st.si % 1;
      text(String(n), cx, H / 2 - 50, 110 + k * 40, '#ffd23d', 'center', 10);
      text(DATA.modes[G.mode].name, cx, H / 2 + 30, 32, '#fff');
    } else if (st.tl > DATA.modes[G.mode].duration - 1) {
      text('¡A LUCHAR!', cx, H / 2 - 50, 80, '#ffd23d', 'center', 10);
    }

    const me = G.lastMe;
    if (me && !me.alive && !G.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      if (me.rs === -1) {
        text('¡ELIMINADO!', cx, H / 2 - 30, 54, '#ff6b5e', 'center', 8);
        text('Espera al final para ver tus recompensas', cx, H / 2 + 20, 20, '#fff');
      } else {
        text('Reapareces en ' + Math.ceil(me.rs), cx, H / 2, 38, '#fff');
      }
    }

    if (me && me.alive) {
      const b = superBtn();
      const ready = me.sup >= 1;
      if (isTouch && touch.sup.id !== null) return;
      A.circ(ctx, b.x, b.y, b.r + 5); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * me.sup); ctx.closePath();
      ctx.fillStyle = ready ? '#ffd23d' : 'rgba(255,200,61,0.6)'; ctx.fill();
      A.circ(ctx, b.x, b.y, b.r); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
      if (ready) { A.circ(ctx, b.x, b.y, b.r + 7 + Math.sin(now / 110) * 3); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd23d'; ctx.stroke(); }
      text('★', b.x, b.y - (isTouch ? 0 : 5), b.r * 0.95, ready ? '#fff' : '#eee');
      if (!isTouch) text('E', b.x, b.y + b.r * 0.55, 13, '#fff');
    }
  }

  // ------------------------------------------------------------- entrada
  const input = { mx: 0, my: 0, aim: 0, aimDist: 300, fire: false, fs: 0, ss: 0 };
  const keys = new Set();
  const mouse = { x: 0, y: 0 };
  const touch = {
    move: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    aim: { id: null, ox: 0, oy: 0, x: 0, y: 0, dragged: false },
    sup: { id: null, ox: 0, oy: 0, x: 0, y: 0, dragged: false },
  };

  // Posiciones de los controles (respetando el notch en horizontal).
  const aimHome = () => ({ x: W - SAFE.r - 130, y: H - SAFE.b - 105 });
  const moveHome = () => ({ x: SAFE.l + 120, y: H - SAFE.b - 110 });
  function superBtn() {
    if (!isTouch) return { x: W - 62, y: H - 62, r: 36 };
    return { x: W - SAFE.r - 255, y: H - SAFE.b - 70, r: 38 };
  }

  const gameKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE']);
  window.addEventListener('keydown', (e) => {
    if (!G.active || G.over) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (gameKeys.has(e.code)) e.preventDefault();
    if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) { input.ss++; sendInput(); }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); input.fire = false; });

  cv.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  cv.addEventListener('mousedown', (e) => {
    if (isTouch && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    FW.Sfx.unlock();
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

  const startJoy = (j, t, extra = {}) => Object.assign(j, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, dragged: false }, extra);

  cv.addEventListener('touchstart', (e) => {
    e.preventDefault();
    FW.Sfx.unlock();
    for (const t of e.changedTouches) {
      const b = superBtn();
      if (touch.sup.id === null && Math.hypot(t.clientX - b.x, t.clientY - b.y) < b.r + 16) {
        if (G.lastMe && G.lastMe.sup >= 1) { startJoy(touch.sup, t, { ox: b.x, oy: b.y }); buzz(10); }
        else buzz(5);
        continue;
      }
      if (t.clientX < W / 2) {
        if (touch.move.id === null) startJoy(touch.move, t);
      } else if (touch.aim.id === null) {
        startJoy(touch.aim, t);
      }
    }
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      for (const j of [touch.move, touch.aim, touch.sup]) {
        if (j.id !== t.identifier) continue;
        j.x = t.clientX; j.y = t.clientY;
        if (j !== touch.move && Math.hypot(j.x - j.ox, j.y - j.oy) > 18) j.dragged = true;
      }
    }
  }, { passive: false });
  const touchEnd = (e) => {
    for (const t of e.changedTouches) {
      if (touch.move.id === t.identifier) touch.move.id = null;
      const meta = G.meta.get(G.myId);
      const def = meta ? DATA.brawlers[meta.brawler] : null;
      if (touch.aim.id === t.identifier) {
        const j = touch.aim;
        const range = def ? def.attack.range : 400;
        if (j.dragged) {
          input.aim = Math.atan2(j.y - j.oy, j.x - j.ox);
          input.aimDist = (Math.min(JOY_R, Math.hypot(j.x - j.ox, j.y - j.oy)) / JOY_R) * range;
        } else autoAim();
        input.fs++;
        sendInput();
        buzz(12);
        j.id = null; j.dragged = false;
      }
      if (touch.sup.id === t.identifier) {
        const j = touch.sup;
        if (e.type === 'touchend') {
          if (j.dragged) {
            input.aim = Math.atan2(j.y - j.oy, j.x - j.ox);
            input.aimDist = (Math.min(JOY_R, Math.hypot(j.x - j.ox, j.y - j.oy)) / JOY_R) * (def ? superRange(def.super) : 400);
          } else autoAim();
          input.ss++;
          sendInput();
          buzz(40);
        }
        j.id = null; j.dragged = false;
      }
    }
  };
  cv.addEventListener('touchend', touchEnd);
  cv.addEventListener('touchcancel', touchEnd);

  function drawTouch() {
    if (!isTouch) return;
    const drawJoy = (j, home, color, rad = JOY_R) => {
      const active = j.id !== null;
      const ox = active ? j.ox : home.x, oy = active ? j.oy : home.y;
      ctx.globalAlpha = active ? 1 : 0.75;
      A.circ(ctx, ox, oy, rad); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
      let kx = ox, ky = oy;
      if (active) {
        const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy);
        const k = d > rad ? rad / d : 1;
        kx = ox + dx * k; ky = oy + dy * k;
      }
      A.circ(ctx, kx, ky, 28); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
      A.circ(ctx, kx - 8, ky - 9, 8); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      ctx.globalAlpha = 1;
    };
    drawJoy(touch.move, moveHome(), 'rgba(61,139,255,0.95)');
    drawJoy(touch.aim, aimHome(), 'rgba(255,90,78,0.95)');
    if (touch.sup.id !== null) {
      drawJoy(touch.sup, superBtn(), 'rgba(255,210,61,1)');
      text('SÚPER', touch.sup.ox, touch.sup.oy - JOY_R - 14, 16, '#ffd23d');
    }
  }

  function sendInput() {
    if (!G.active || !socket) return;
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
    if (!isTouch && G.myPos && G.camX) {
      const wx = G.camX + (mouse.x - W / 2) / SCALE;
      const wy = G.camY + (mouse.y - H / 2) / SCALE;
      input.aim = Math.atan2(wy - G.myPos.y, wx - G.myPos.x);
      input.aimDist = Math.hypot(wx - G.myPos.x, wy - G.myPos.y);
    }
    socket.emit('input', input);
  }
  setInterval(sendInput, 1000 / 30);

  function loop(now) {
    if (G.active) drawFrame(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  FW.Game = { start, stop, onState, gameOver, get active() { return G.active; }, isTouch };
})();
