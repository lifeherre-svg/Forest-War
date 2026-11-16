const { TILE } = require('./constants');

const T_EMPTY = 0, T_WALL = 1, T_WATER = 2, T_BUSH = 3;

class GameMap {
  constructor(def) {
    const half = def.half.map((r) => (r + '.'.repeat(16)).slice(0, 16));
    this.rows = half.map((r) => r + r.split('').reverse().map((c) => (c === 'A' ? 'B' : c)).join(''));
    this.h = this.rows.length;
    this.w = this.rows[0].length;
    this.width = this.w * TILE;
    this.height = this.h * TILE;
    this.name = def.name;
    this.tiles = new Array(this.w * this.h).fill(T_EMPTY);
    this.spawns = [[], []];
    this.ffaSpawns = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.rows[y][x];
        this.tiles[y * this.w + x] = c === '#' ? T_WALL : c === '~' ? T_WATER : c === '*' ? T_BUSH : T_EMPTY;
        const pos = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
        if (c === 'A') this.spawns[0].push(pos);
        if (c === 'B') this.spawns[1].push(pos);
        if (c === 'S') this.ffaSpawns.push(pos);
      }
    }
    this.ffaSpawns.push(...this.spawns[0], ...this.spawns[1]);
  }

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T_WALL;
    return this.tiles[ty * this.w + tx];
  }
  tileAt(x, y) { return this.tile(Math.floor(x / TILE), Math.floor(y / TILE)); }
  walkable(tx, ty) { const t = this.tile(tx, ty); return t !== T_WALL && t !== T_WATER; }
  blocksShot(x, y) { return this.tileAt(x, y) === T_WALL; }
  blocksMoveAt(x, y) { const t = this.tileAt(x, y); return t === T_WALL || t === T_WATER; }
  inBush(x, y) { return this.tileAt(x, y) === T_BUSH; }

  // Empuja un círculo fuera de muros y agua.
  collide(p, r) {
    const minTx = Math.floor((p.x - r) / TILE), maxTx = Math.floor((p.x + r) / TILE);
    const minTy = Math.floor((p.y - r) / TILE), maxTy = Math.floor((p.y + r) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.walkable(tx, ty)) continue;
        const x0 = tx * TILE, y0 = ty * TILE;
        const nx = Math.max(x0, Math.min(p.x, x0 + TILE));
        const ny = Math.max(y0, Math.min(p.y, y0 + TILE));
        const dx = p.x - nx, dy = p.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 === 0) {
          // Centro dentro del bloque: salir por el lado más cercano.
          const opts = [
            [p.x - x0, -1, 0], [x0 + TILE - p.x, 1, 0], [p.y - y0, 0, -1], [y0 + TILE - p.y, 0, 1],
          ].sort((a, b) => a[0] - b[0]);
          p.x += opts[0][1] * (opts[0][0] + r);
          p.y += opts[0][2] * (opts[0][0] + r);
        } else {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.y += (dy / d) * (r - d);
        }
      }
    }
  }

  // Línea de visión para disparos (el agua no bloquea).
  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 10);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.blocksShot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  // ¿Se puede caminar en línea recta? (comprueba un "pasillo" del ancho del jugador)
  clearWalk(x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 1) return true;
    const nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
    const steps = Math.ceil(d / 12);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (this.blocksMoveAt(x, y) || this.blocksMoveAt(x + nx * r, y + ny * r) || this.blocksMoveAt(x - nx * r, y - ny * r)) return false;
    }
    return true;
  }

  nearestWalkable(tx, ty) {
    if (this.walkable(tx, ty)) return { x: tx, y: ty };
    for (let rad = 1; rad < 6; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (this.walkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
        }
      }
    }
    return null;
  }

  // BFS en 8 direcciones sin cortar esquinas. Devuelve lista de casillas.
  findPath(sx, sy, gx, gy) {
    const start = this.nearestWalkable(sx, sy);
    const goal = this.nearestWalkable(gx, gy);
    if (!start || !goal) return [];
    const W = this.w;
    const prev = new Int32Array(this.w * this.h).fill(-2);
    const startI = start.y * W + start.x, goalI = goal.y * W + goal.x;
    prev[startI] = -1;
    const queue = [startI];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let found = startI === goalI;
    for (let qi = 0; qi < queue.length && !found; qi++) {
      const cur = queue[qi];
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (prev[ni] !== -2) continue;
        prev[ni] = cur;
        if (ni === goalI) { found = true; break; }
        queue.push(ni);
      }
    }
    if (!found) return [];
    const path = [];
    for (let i = goalI; i !== startI && i >= 0; i = prev[i]) path.push({ x: i % W, y: (i / W) | 0 });
    return path.reverse();
  }

  // Posición libre cercana a (x, y).
  freeSpotNear(x, y, minR, maxR) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = minR + Math.random() * (maxR - minR);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (!this.blocksMoveAt(px, py) && px > TILE && py > TILE && px < this.width - TILE && py < this.height - TILE) return { x: px, y: py };
    }
    return { x, y };
  }
}

module.exports = { GameMap, T_EMPTY, T_WALL, T_WATER, T_BUSH };
