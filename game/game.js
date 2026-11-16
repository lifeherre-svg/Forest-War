const { BRAWLERS, MODES, MAPS, LEVELS } = require('./constants');
const { GameMap } = require('./map');
const { Bot } = require('./bot');

const DT = 1 / 30;
const START_DELAY = 3;
const REVEAL_DIST = 140;
const GEM_INTERVAL = 7;
const GEM_TARGET = 10;
const GEM_COUNTDOWN = 15;

let nextId = 1;
const r1 = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;

class Game {
  constructor({ mode, mapId, members, onEnd }) {
    this.mode = mode;
    this.modeDef = MODES[mode];
    this.mapId = mapId;
    this.map = new GameMap(MAPS[mapId]);
    this.time = 0;
    this.tick = 0;
    this.startAt = START_DELAY;
    this.endAt = START_DELAY + this.modeDef.duration;
    this.players = new Map();
    this.bullets = [];
    this.lobs = [];
    this.clouds = [];
    this.gems = [];
    this.events = [];
    this.score = [0, 0];
    this.nextGemAt = START_DELAY + 2;
    this.countdown = null;
    this.over = false;
    this.onEnd = onEnd;
    this.snapCache = new Map();
    this.zone = 0;
    this.nextGasTick = 0;
    this.elim = [];

    let ffaIdx = 0;
    for (const m of members) {
      const def = BRAWLERS[m.brawler] || BRAWLERS.pinon;
      const level = Math.max(1, Math.min(LEVELS.max, m.level || 1));
      const mult = LEVELS.mult(level);
      const p = {
        id: m.id, name: m.name, brawler: m.brawler, def, isBot: !!m.isBot, pid: m.pid || null,
        skin: def.skins[m.skin] ? m.skin : 'default', level, mult, burst: null, shieldUntil: 0,
        look: m.look || null,
        team: this.modeDef.team ? m.team : 100 + ffaIdx++,
        x: 0, y: 0, vx: 0, vy: 0, r: def.radius, hp: Math.round(def.hp * mult), maxHp: Math.round(def.hp * mult),
        ammo: 3, nextShot: 0, superCharge: 0, alive: true, respawnAt: 0,
        lastHurt: -99, lastAttack: -99, revealUntil: 0, fireQueuedUntil: 0,
        kills: 0, deaths: 0, gems: 0, damage: 0, aim: 0, dash: null, knock: null,
        input: { mx: 0, my: 0, aim: 0, aimDist: 0, fire: false, fs: 0, ss: 0 },
        lastFs: 0, lastSs: 0, placed: false,
      };
      if (this.modeDef.team) p.aim = p.team === 0 ? 0 : Math.PI;
      this.players.set(p.id, p);
      this.spawn(p, true);
      if (p.isBot) p.bot = new Bot(this, p, m.difficulty);
    }
  }

  startInfo() {
    return {
      mode: this.mode,
      map: { rows: this.map.rows, name: this.map.name, id: this.mapId },
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, brawler: p.brawler, skin: p.skin, level: p.level, maxHp: p.maxHp, team: p.team, isBot: p.isBot })),
    };
  }

  isEnemy(a, b) { return a.team !== b.team; }

  spawnPoints(p) {
    return this.modeDef.team ? this.map.spawns[p.team] : this.map.ffaSpawns;
  }

  spawn(p, initial) {
    const pts = this.spawnPoints(p);
    let best = pts[0], bestScore = -Infinity;
    for (const pt of pts) {
      let minD = 5000;
      for (const q of this.players.values()) {
        if (q === p || !q.alive || !q.placed) continue;
        if (!initial && !this.isEnemy(p, q)) continue;
        if (initial && this.modeDef.team && !this.isEnemy(p, q)) {
          // Repartir compañeros entre las casillas de aparición.
          minD = Math.min(minD, Math.hypot(q.x - pt.x, q.y - pt.y) * 3);
          continue;
        }
        minD = Math.min(minD, Math.hypot(q.x - pt.x, q.y - pt.y));
      }
      const score = minD + Math.random() * 40;
      if (score > bestScore) { bestScore = score; best = pt; }
    }
    p.x = best.x; p.y = best.y; p.placed = true;
  }

  setInput(id, inp) {
    const p = this.players.get(id);
    if (!p || !inp || typeof inp !== 'object') return;
    const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : 0);
    p.input.mx = num(inp.mx, -1, 1);
    p.input.my = num(inp.my, -1, 1);
    p.input.aim = num(inp.aim, -10, 10);
    p.input.aimDist = num(inp.aimDist, 0, 3000);
    p.input.fire = !!inp.fire;
    p.input.fs = num(inp.fs, 0, 1e9) | 0;
    p.input.ss = num(inp.ss, 0, 1e9) | 0;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.dropGems(p);
    if (this.mode === 'survival' && p.alive) this.elim.push(p.id);
    this.players.delete(id);
  }

  // ---------------------------------------------------------------- bucle
  update() {
    if (this.over) return;
    this.time += DT;
    this.tick++;
    this.events = [];
    this.snapCache.clear();
    const now = this.time;
    const active = now >= this.startAt;

    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.modeDef.respawn !== null && now >= p.respawnAt) this.respawn(p);
        continue;
      }
      if (p.bot && active) p.bot.update(DT);
      this.updatePlayer(p, DT, active);
    }
    if (active) {
      this.updateBullets(DT);
      this.updateLobs(DT);
      this.updateClouds();
      if (this.mode === 'gems') this.updateGems();
      if (this.mode === 'survival') this.updateGas();
    }
    this.checkEnd();
  }

  moveCircle(p, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    for (let i = 0; i < steps; i++) {
      p.x += dx / steps;
      p.y += dy / steps;
      this.map.collide(p, p.r);
    }
  }

  updatePlayer(p, dt, active) {
    const now = this.time;
    const inp = p.input;
    p.aim = inp.aim;
    if (p.ammo < 3) p.ammo = Math.min(3, p.ammo + dt / p.def.reload);
    if (now - p.lastHurt > 3 && now - p.lastAttack > 3 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.13 * dt);
    }
    if (!active) { p.vx = p.vy = 0; return; }

    const ox = p.x, oy = p.y;
    if (p.dash) {
      this.updateDash(p, dt);
    } else {
      let mx = inp.mx, my = inp.my;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      const spd = p.def.speed * (now < p.shieldUntil ? p.def.super.speedMult : 1);
      this.moveCircle(p, mx * spd * dt, my * spd * dt);
    }
    if (p.knock) {
      this.moveCircle(p, p.knock.vx * dt, p.knock.vy * dt);
      p.knock.t -= dt;
      if (p.knock.t <= 0) p.knock = null;
    }
    p.vx = (p.x - ox) / dt;
    p.vy = (p.y - oy) / dt;

    if (inp.ss !== p.lastSs) {
      p.lastSs = inp.ss;
      if (p.superCharge >= 1 && !p.dash) this.useSuper(p);
    }
    if (inp.fs !== p.lastFs) {
      p.lastFs = inp.fs;
      p.fireQueuedUntil = now + 0.3;
    }
    if (p.burst && now >= p.burst.nextAt) {
      const a = p.def.attack;
      this.fireBullet(p, p.burst.ang, a, p.brawler);
      p.burst.left--;
      p.burst.nextAt = now + a.interval;
      if (p.burst.left <= 0) p.burst = null;
    }
    const wantFire = inp.fire || now < p.fireQueuedUntil;
    if (wantFire && p.ammo >= 1 && now >= p.nextShot && !p.dash && !p.burst) {
      p.fireQueuedUntil = 0;
      this.attack(p);
    }
  }

  fireBullet(p, ang, spec, kind, opts = {}) {
    this.bullets.push({
      id: nextId++, x: p.x, y: p.y,
      vx: Math.cos(ang) * spec.speed, vy: Math.sin(ang) * spec.speed,
      owner: p.id, team: p.team, dmg: spec.dmg * p.mult, range: spec.range, traveled: 0,
      r: spec.bulletR, pierce: !!opts.pierce, charge: !opts.isSuper, hit: new Set(), kind,
    });
  }

  attack(p) {
    const now = this.time;
    const a = p.def.attack;
    p.ammo -= 1;
    p.nextShot = now + a.cooldown;
    p.lastAttack = now;
    p.revealUntil = now + 1.2;
    const ang = p.input.aim;
    this.events.push({ k: 'atk', id: p.id, x: r1(p.x), y: r1(p.y), a: r2(ang) });
    if (a.type === 'spread') {
      for (let i = 0; i < a.count; i++) {
        const off = a.count > 1 ? -a.spread / 2 + (a.spread * i) / (a.count - 1) : 0;
        this.fireBullet(p, ang + off, a, p.brawler);
      }
    } else if (a.type === 'single') {
      this.fireBullet(p, ang, a, p.brawler, { pierce: a.pierce });
    } else if (a.type === 'burst') {
      p.burst = { ang, left: a.count, nextAt: now };
    } else if (a.type === 'lob') {
      this.launchLob(p, ang, a.range, a.flight, 'spore');
    }
  }

  launchLob(p, ang, range, flight, kind) {
    const dist = Math.max(60, Math.min(range, p.input.aimDist || range));
    this.lobs.push({
      id: nextId++, x0: p.x, y0: p.y,
      x1: Math.max(0, Math.min(this.map.width, p.x + Math.cos(ang) * dist)),
      y1: Math.max(0, Math.min(this.map.height, p.y + Math.sin(ang) * dist)),
      t: 0, dur: flight, owner: p.id, team: p.team, kind, mult: p.mult,
    });
  }

  useSuper(p) {
    const now = this.time;
    const s = p.def.super;
    p.superCharge = 0;
    p.lastAttack = now;
    p.revealUntil = now + 1.2;
    const ang = p.input.aim;
    this.events.push({ k: 'super', id: p.id, x: r1(p.x), y: r1(p.y) });
    if (s.type === 'ring') {
      for (let i = 0; i < s.count; i++) this.fireBullet(p, ang + (Math.PI * 2 * i) / s.count, s, p.brawler + 'S', { isSuper: true });
    } else if (s.type === 'pierce') {
      this.fireBullet(p, ang, s, p.brawler + 'S', { isSuper: true, pierce: true });
    } else if (s.type === 'dash') {
      p.dash = { dx: Math.cos(ang), dy: Math.sin(ang), left: s.dist, hit: new Set() };
    } else if (s.type === 'cloud') {
      this.launchLob(p, ang, s.range, s.flight, 'cloud');
    } else if (s.type === 'heal') {
      this.clouds.push({ id: nextId++, x: p.x, y: p.y, r: s.radius, dps: s.hps * p.mult, endAt: now + s.duration, nextTick: now, owner: p.id, team: p.team, heal: true });
    } else if (s.type === 'shield') {
      p.shieldUntil = now + s.duration;
    }
  }

  updateDash(p, dt) {
    const s = p.def.super;
    const step = Math.min(s.speed * dt, p.dash.left);
    const ox = p.x, oy = p.y;
    this.moveCircle(p, p.dash.dx * step, p.dash.dy * step);
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.dash.left -= step;
    for (const e of this.players.values()) {
      if (!e.alive || !this.isEnemy(p, e) || p.dash.hit.has(e.id)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < p.r + e.r + 8) {
        p.dash.hit.add(e.id);
        const nx = (e.x - p.x) / (d || 1), ny = (e.y - p.y) / (d || 1);
        e.knock = { vx: (nx * s.knock) / 0.2, vy: (ny * s.knock) / 0.2, t: 0.2 };
        this.damage(p, e, s.dmg * p.mult, false);
      }
    }
    if (p.dash.left <= 0 || moved < step * 0.4) p.dash = null;
  }

  updateBullets(dt) {
    const keep = [];
    for (const b of this.bullets) {
      const total = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(total / 12));
      let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        b.traveled += total / steps;
        if (this.map.blocksShot(b.x, b.y)) { dead = true; break; }
        for (const e of this.players.values()) {
          if (!e.alive || e.team === b.team || b.hit.has(e.id)) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            b.hit.add(e.id);
            this.damage(this.players.get(b.owner), e, b.dmg, b.charge);
            if (!b.pierce) { dead = true; break; }
          }
        }
        if (b.traveled >= b.range) dead = true;
      }
      if (!dead) keep.push(b);
    }
    this.bullets = keep;
  }

  updateLobs(dt) {
    const keep = [];
    for (const l of this.lobs) {
      l.t += dt;
      if (l.t < l.dur) { keep.push(l); continue; }
      const owner = this.players.get(l.owner);
      if (l.kind === 'spore') {
        const a = BRAWLERS.champi.attack;
        this.events.push({ k: 'boom', x: r1(l.x1), y: r1(l.y1), r: a.radius });
        for (const e of this.players.values()) {
          if (!e.alive || e.team === l.team) continue;
          if (Math.hypot(e.x - l.x1, e.y - l.y1) < a.radius + e.r * 0.5) this.damage(owner, e, a.dmg * l.mult, true);
        }
      } else {
        const s = BRAWLERS.champi.super;
        this.clouds.push({ id: nextId++, x: l.x1, y: l.y1, r: s.radius, dps: s.dps * l.mult, endAt: this.time + s.duration, nextTick: this.time, owner: l.owner, team: l.team });
      }
    }
    this.lobs = keep;
  }

  updateClouds() {
    const now = this.time;
    this.clouds = this.clouds.filter((c) => now < c.endAt);
    for (const c of this.clouds) {
      if (now < c.nextTick) continue;
      c.nextTick += 0.5;
      const owner = this.players.get(c.owner);
      for (const e of this.players.values()) {
        if (!e.alive || Math.hypot(e.x - c.x, e.y - c.y) >= c.r) continue;
        if (c.heal) {
          if (e.team !== c.team || e.hp >= e.maxHp) continue;
          const h = Math.min(e.maxHp - e.hp, Math.round(c.dps * 0.5));
          e.hp += h;
          this.events.push({ k: 'heal', x: r1(e.x), y: r1(e.y), d: h, id: e.id });
        } else if (e.team !== c.team) {
          this.damage(owner, e, c.dps * 0.5, false);
        }
      }
    }
  }

  // Niebla tóxica de Supervivencia: se cierra desde los bordes.
  updateGas() {
    const now = this.time;
    const t = now - this.startAt - 15;
    const maxInset = Math.min(this.map.width, this.map.height) / 2 - 130;
    this.zone = t > 0 ? Math.min(maxInset, (t * maxInset) / 120) : 0;
    if (now < this.nextGasTick) return;
    this.nextGasTick = now + 0.5;
    if (this.zone <= 0) return;
    for (const p of this.players.values()) {
      if (p.alive && !this.inZone(p.x, p.y)) this.damage(null, p, 500, false);
    }
  }

  inZone(x, y, margin = 0) {
    const z = this.zone + margin;
    return x > z && y > z && x < this.map.width - z && y < this.map.height - z;
  }

  teamGems() {
    const g = [0, 0];
    for (const p of this.players.values()) if (p.team === 0 || p.team === 1) g[p.team] += p.gems;
    return g;
  }

  updateGems() {
    const now = this.time;
    if (now >= this.nextGemAt) {
      this.nextGemAt += GEM_INTERVAL;
      const pos = this.map.freeSpotNear(this.map.width / 2, this.map.height / 2, 0, 45);
      this.gems.push({ id: nextId++, x: pos.x, y: pos.y });
    }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      this.gems = this.gems.filter((g) => {
        if (Math.hypot(g.x - p.x, g.y - p.y) < p.r + 18) { p.gems++; return false; }
        return true;
      });
    }
    const tg = this.teamGems();
    let leader = null;
    if (tg[0] >= GEM_TARGET && tg[0] > tg[1]) leader = 0;
    if (tg[1] >= GEM_TARGET && tg[1] > tg[0]) leader = 1;
    if (leader === null) this.countdown = null;
    else if (!this.countdown || this.countdown.team !== leader) this.countdown = { team: leader, endAt: now + GEM_COUNTDOWN };
  }

  dropGems(p) {
    for (let i = 0; i < p.gems; i++) {
      const pos = this.map.freeSpotNear(p.x, p.y, 20, 70);
      this.gems.push({ id: nextId++, x: pos.x, y: pos.y });
    }
    p.gems = 0;
  }

  damage(attacker, target, dmg, charge) {
    if (!target.alive) return;
    if (this.time < target.shieldUntil) dmg *= 1 - target.def.super.reduction;
    dmg = Math.round(dmg);
    target.hp -= dmg;
    target.lastHurt = this.time;
    if (attacker) {
      attacker.damage += dmg;
      if (charge) attacker.superCharge = Math.min(1, attacker.superCharge + dmg / attacker.def.superCost);
    }
    this.events.push({ k: 'hit', x: r1(target.x), y: r1(target.y), d: dmg, id: target.id });
    if (target.hp <= 0) this.kill(target, attacker);
  }

  kill(target, killer) {
    target.alive = false;
    target.hp = 0;
    target.deaths++;
    target.respawnAt = this.time + this.modeDef.respawn;
    target.dash = null;
    target.knock = null;
    target.burst = null;
    if (this.mode === 'survival') this.elim.push(target.id);
    if (killer && killer !== target) {
      killer.kills++;
      if (this.mode === 'tdm' && (killer.team === 0 || killer.team === 1)) this.score[killer.team]++;
    }
    this.dropGems(target);
    this.events.push({ k: 'kill', a: killer ? killer.id : null, v: target.id, x: r1(target.x), y: r1(target.y) });
  }

  respawn(p) {
    p.alive = true;
    p.hp = p.maxHp;
    p.ammo = 3;
    p.lastHurt = -99;
    p.revealUntil = 0;
    this.spawn(p, false);
  }

  checkEnd() {
    const now = this.time;
    let winner;
    const target = this.modeDef.target;
    if (this.mode === 'tdm') {
      if (this.score[0] >= target) winner = 0;
      else if (this.score[1] >= target) winner = 1;
    } else if (this.mode === 'ffa') {
      for (const p of this.players.values()) if (p.kills >= target) winner = p.id;
    } else if (this.mode === 'gems') {
      if (this.countdown && now >= this.countdown.endAt) winner = this.countdown.team;
    } else if (this.mode === 'survival') {
      const alive = [...this.players.values()].filter((p) => p.alive);
      if (alive.length <= 1 && now > this.startAt) winner = alive.length ? alive[0].id : null;
    }
    if (winner === undefined && now >= this.endAt) {
      if (this.mode === 'survival') {
        const alive = [...this.players.values()].filter((p) => p.alive).sort((a, b) => b.hp - a.hp);
        winner = alive.length ? alive[0].id : null;
      } else if (this.mode === 'ffa') {
        const sorted = [...this.players.values()].sort((a, b) => b.kills - a.kills);
        winner = sorted.length && (sorted.length < 2 || sorted[0].kills > sorted[1].kills) ? sorted[0].id : null;
      } else {
        const s = this.mode === 'gems' ? this.teamGems() : this.score;
        winner = s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : null;
      }
    }
    if (winner !== undefined) this.finish(winner);
  }

  // Puesto de cada jugador en los modos individuales.
  ranks() {
    const list = [...this.players.values()];
    const place = new Map();
    if (this.mode === 'survival') {
      const alive = list.filter((p) => p.alive).sort((a, b) => b.hp - a.hp);
      const order = [...alive.map((p) => p.id), ...this.elim.slice().reverse().filter((id) => this.players.has(id))];
      order.forEach((id, i) => place.set(id, i + 1));
    } else {
      const sorted = list.slice().sort((a, b) => b.kills - a.kills);
      sorted.forEach((p) => place.set(p.id, 1 + sorted.filter((q) => q.kills > p.kills).length));
    }
    return place;
  }

  finish(winner) {
    this.over = true;
    const place = this.modeDef.team ? null : this.ranks();
    const results = {
      mode: this.mode,
      winner,
      total: this.players.size,
      players: [...this.players.values()]
        .map((p) => ({
          id: p.id, pid: p.pid, name: p.name, brawler: p.brawler, skin: p.skin, team: p.team, isBot: p.isBot, look: p.look,
          kills: p.kills, deaths: p.deaths, damage: p.damage, place: place ? place.get(p.id) : null,
        }))
        .sort((a, b) => (place ? a.place - b.place : 0) || b.kills - a.kills || b.damage - a.damage),
    };
    if (this.onEnd) this.onEnd(results);
  }

  // ---------------------------------------------------------- visibilidad
  isVisibleTo(team, q) {
    if (q.team === team) return true;
    if (!this.map.inBush(q.x, q.y)) return true;
    if (this.time < q.revealUntil) return true;
    for (const v of this.players.values()) {
      if (v.team === team && v.alive && Math.hypot(v.x - q.x, v.y - q.y) < REVEAL_DIST) return true;
    }
    return false;
  }

  sharedSnapshot(team) {
    if (this.snapCache.has(team)) return this.snapCache.get(team);
    const now = this.time;
    const players = [];
    const kills = [];
    for (const q of this.players.values()) {
      kills.push([q.id, q.kills, q.gems]);
      if (!q.alive || !this.isVisibleTo(team, q)) continue;
      const flags = (this.map.inBush(q.x, q.y) ? 1 : 0) | (q.superCharge >= 1 ? 2 : 0) | (q.dash ? 4 : 0)
        | (now < q.shieldUntil ? 8 : 0) | (Math.abs(q.vx) + Math.abs(q.vy) > 20 ? 16 : 0);
      players.push([q.id, r1(q.x), r1(q.y), r1(q.hp), r2(q.aim), flags, q.gems]);
    }
    const snap = {
      p: players,
      k: kills,
      b: this.bullets.map((b) => [b.id, r1(b.x), r1(b.y), b.kind]),
      l: this.lobs.map((l) => [l.id, r1(l.x0), r1(l.y0), r1(l.x1), r1(l.y1), r2(l.t / l.dur), l.kind]),
      c: this.clouds.map((c) => [c.id, r1(c.x), r1(c.y), c.r, c.heal ? 1 : 0]),
      g: this.gems.map((g) => [g.id, r1(g.x), r1(g.y)]),
      s: {
        sc: this.score,
        tg: this.mode === 'gems' ? this.teamGems() : null,
        cd: this.countdown ? { team: this.countdown.team, left: r2(Math.max(0, this.countdown.endAt - now)) } : null,
        tl: r2(Math.max(0, this.endAt - now)),
        si: r2(Math.max(0, this.startAt - now)),
        z: r1(this.zone),
        al: [...this.players.values()].filter((p) => p.alive).length,
      },
      ev: this.events,
    };
    this.snapCache.set(team, snap);
    return snap;
  }

  snapshotFor(id) {
    const me = this.players.get(id);
    if (!me) return null;
    const shared = this.sharedSnapshot(me.team);
    return {
      ...shared,
      me: {
        alive: me.alive, ammo: r2(me.ammo), sup: r2(me.superCharge), hp: r1(me.hp),
        rs: me.alive ? 0 : this.modeDef.respawn === null ? -1 : r2(Math.max(0, me.respawnAt - this.time)),
        x: r1(me.x), y: r1(me.y),
      },
    };
  }
}

module.exports = { Game };
