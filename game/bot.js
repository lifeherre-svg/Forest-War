const { TILE } = require('./constants');

const DIFF = {
  facil:   { err: 0.32, react: 0.55, lead: 0,   think: 0.35, fireChance: 0.55, aggro: 600, superDelay: 2.5 },
  normal:  { err: 0.14, react: 0.3,  lead: 0.6, think: 0.2,  fireChance: 0.85, aggro: 750, superDelay: 0.8 },
  dificil: { err: 0.05, react: 0.12, lead: 1,   think: 0.1,  fireChance: 1,    aggro: 900, superDelay: 0.1 },
};

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

class Bot {
  constructor(game, p, difficulty) {
    this.g = game;
    this.p = p;
    this.d = DIFF[difficulty] || DIFF.normal;
    this.thinkT = Math.random() * 0.3;
    this.path = [];
    this.pathKey = '';
    this.pathAt = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeAt = 0;
    this.target = null;
    this.targetSince = 0;
    this.goal = null;
    this.state = 'roam';
    this.trigger = true;
    this.lastPos = { x: p.x, y: p.y };
    this.stuckCheckAt = 0;
    this.unstuckUntil = 0;
    this.unstuckDir = { x: 0, y: 0 };
    this.superReadyAt = 0;
  }

  range() {
    const a = this.p.def.attack;
    return a.range;
  }

  update(dt) {
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.d.think * (0.7 + Math.random() * 0.6);
      this.think();
    }
    this.act();
  }

  think() {
    const g = this.g, p = this.p, now = g.time;
    // Elegir objetivo visible más cercano (penaliza los que están tras muros).
    let best = null, bestScore = Infinity;
    for (const q of g.players.values()) {
      if (!q.alive || !g.isEnemy(p, q) || !g.isVisibleTo(p.team, q)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > this.d.aggro) continue;
      const lob = p.def.attack.type === 'lob';
      const score = d * (lob || g.map.los(p.x, p.y, q.x, q.y) ? 1 : 1.6) * (q.hp / q.maxHp < 0.4 ? 0.7 : 1);
      if (score < bestScore) { bestScore = score; best = q; }
    }
    if (best !== this.target) { this.target = best; this.targetSince = now; }
    this.trigger = Math.random() < this.d.fireChance;
    if (p.superCharge >= 1 && !this.superReadyAt) this.superReadyAt = now + this.d.superDelay * Math.random();
    if (p.superCharge < 1) this.superReadyAt = 0;

    const t = this.target;
    const dist = t ? Math.hypot(t.x - p.x, t.y - p.y) : Infinity;
    const lowHp = p.hp < p.maxHp * 0.35;
    const home = this.homePoint(t);

    if (lowHp && t && dist < this.range() + 200) {
      this.state = 'retreat'; this.goal = home; return;
    }
    if (g.mode === 'gems') {
      const ownCountdown = g.countdown && g.countdown.team === p.team;
      if (p.gems > 0 && (ownCountdown || p.gems >= 4)) {
        this.state = 'carry'; this.goal = home; return;
      }
      if (g.gems.length && (!t || dist > 380)) {
        let gem = null, gd = Infinity;
        for (const gm of g.gems) {
          const d = Math.hypot(gm.x - p.x, gm.y - p.y);
          if (d < gd) { gd = d; gem = gm; }
        }
        this.state = 'gem'; this.goal = { x: gem.x, y: gem.y }; return;
      }
    }
    if (t) { this.state = 'fight'; this.goal = { x: t.x, y: t.y }; return; }

    // Sin enemigos a la vista: ir a buscar pelea.
    this.state = 'roam';
    if (g.mode === 'gems') {
      this.goal = { x: g.map.width / 2 + (p.team === 0 ? -150 : 150), y: g.map.height / 2 };
    } else {
      let near = null, nd = Infinity;
      for (const q of g.players.values()) {
        if (!q.alive || !g.isEnemy(p, q)) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < nd) { nd = d; near = q; }
      }
      this.goal = near ? { x: near.x, y: near.y } : { x: g.map.width / 2, y: g.map.height / 2 };
    }
  }

  homePoint(threat) {
    const pts = this.g.spawnPoints(this.p);
    if (!threat) return pts[0];
    let best = pts[0], bd = -1;
    for (const pt of pts) {
      const d = Math.hypot(pt.x - threat.x, pt.y - threat.y);
      if (d > bd) { bd = d; best = pt; }
    }
    return best;
  }

  dirTo(x, y) {
    const p = this.p;
    const g = this.g;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 4) return { x: 0, y: 0 };
    if (d < 260 && g.map.clearWalk(p.x, p.y, x, y, p.r - 4)) return { x: (x - p.x) / d, y: (y - p.y) / d };
    const stx = Math.floor(p.x / TILE), sty = Math.floor(p.y / TILE);
    const gtx = Math.floor(x / TILE), gty = Math.floor(y / TILE);
    const key = gtx + ',' + gty;
    if (key !== this.pathKey || g.time > this.pathAt || !this.path.length) {
      this.path = g.map.findPath(stx, sty, gtx, gty);
      this.pathKey = key;
      this.pathAt = g.time + 0.6;
    }
    while (this.path.length) {
      const n = this.path[0];
      const cx = n.x * TILE + TILE / 2, cy = n.y * TILE + TILE / 2;
      if (Math.hypot(cx - p.x, cy - p.y) < 16) { this.path.shift(); continue; }
      const dd = Math.hypot(cx - p.x, cy - p.y);
      return { x: (cx - p.x) / dd, y: (cy - p.y) / dd };
    }
    return { x: (x - p.x) / d, y: (y - p.y) / d };
  }

  act() {
    const g = this.g, p = this.p, now = g.time, inp = p.input;
    const t = this.target && this.target.alive && g.players.has(this.target.id) ? this.target : null;
    let move = { x: 0, y: 0 };

    if (now > this.strafeAt) {
      this.strafe = -this.strafe;
      this.strafeAt = now + 0.6 + Math.random() * 0.9;
    }

    if (this.state === 'fight' && t) {
      const dx = t.x - p.x, dy = t.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const lob = p.def.attack.type === 'lob';
      const los = lob || g.map.los(p.x, p.y, t.x, t.y);
      const desired = p.brawler === 'brutus' ? 70 : this.range() * 0.7;
      const perp = { x: (-dy / dist) * this.strafe, y: (dx / dist) * this.strafe };
      if (!los) move = this.dirTo(t.x, t.y);
      else if (dist > desired + 60) {
        const to = this.dirTo(t.x, t.y);
        move = { x: to.x + perp.x * 0.35, y: to.y + perp.y * 0.35 };
      } else if (dist < desired - 60) move = { x: -dx / dist + perp.x * 0.6, y: -dy / dist + perp.y * 0.6 };
      else move = perp;
    } else if (this.goal) {
      move = this.dirTo(this.goal.x, this.goal.y);
    }

    // Anti-atascos.
    if (now > this.stuckCheckAt) {
      const moved = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y);
      if (moved < 15 && Math.hypot(move.x, move.y) > 0.3) {
        const a = Math.random() * Math.PI * 2;
        this.unstuckDir = { x: Math.cos(a), y: Math.sin(a) };
        this.unstuckUntil = now + 0.4;
        this.path = [];
      }
      this.lastPos = { x: p.x, y: p.y };
      this.stuckCheckAt = now + 0.7;
    }
    if (now < this.unstuckUntil) move = this.unstuckDir;

    inp.mx = move.x;
    inp.my = move.y;
    inp.fire = false;

    // Apuntar y disparar.
    if (t && now - this.targetSince > this.d.react) {
      const dist = Math.hypot(t.x - p.x, t.y - p.y);
      const a = p.def.attack;
      const lob = a.type === 'lob';
      const los = lob || g.map.los(p.x, p.y, t.x, t.y);
      const travel = lob ? a.flight : dist / a.speed;
      const ax = t.x + t.vx * travel * this.d.lead;
      const ay = t.y + t.vy * travel * this.d.lead;
      inp.aim = Math.atan2(ay - p.y, ax - p.x) + gauss() * this.d.err;
      inp.aimDist = Math.hypot(ax - p.x, ay - p.y) * (1 + gauss() * this.d.err * 0.5);
      if (los && dist < a.range * 0.95 && this.trigger) inp.fire = true;

      if (this.superReadyAt && now >= this.superReadyAt && p.superCharge >= 1) {
        const s = p.def.super;
        let use = false;
        if (s.type === 'dash') use = los && dist < 300;
        else if (s.type === 'ring') use = dist < 260;
        else if (s.type === 'pierce') use = los && dist < 900;
        else if (s.type === 'cloud') use = dist < s.range;
        if (use) inp.ss++;
      }
    } else if (Math.hypot(move.x, move.y) > 0.1) {
      inp.aim = Math.atan2(move.y, move.x);
    }
  }
}

module.exports = { Bot };
