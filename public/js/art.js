/* Forest War - arte vectorial (personajes, escenario y proyectiles). */
(() => {
  'use strict';
  const FW = (window.FW = window.FW || {});
  const TILE = 50;
  const WALL_H = 26;
  const OL = '#15110d';

  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  const memo = new Map();
  const sh = (hex, amt) => {
    const k = hex + amt;
    if (!memo.has(k)) memo.set(k, shade(hex, amt));
    return memo.get(k);
  };

  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
  function fs(ctx, fill, lw = 3) {
    ctx.fillStyle = fill; ctx.fill();
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OL; ctx.stroke(); }
  }
  function vgrad(ctx, y0, y1, color, top = 0.3, bottom = -0.18) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, sh(color, top));
    g.addColorStop(1, sh(color, bottom));
    return g;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function tri(ctx, x1, y1, x2, y2, x3, y3) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); }

  function eye(ctx, x, y, rx, ry, lx, ly, iris) {
    ell(ctx, x, y, rx, ry); fs(ctx, '#fff', 2);
    const px = x + lx * rx * 0.3, py = y + ly * ry * 0.3;
    if (iris) { ell(ctx, px, py, rx * 0.72, ry * 0.72); ctx.fillStyle = iris; ctx.fill(); }
    ell(ctx, px + rx * 0.08, py, rx * 0.45, ry * 0.52); ctx.fillStyle = '#111'; ctx.fill();
    circ(ctx, px - rx * 0.12, py - ry * 0.25, rx * 0.2); ctx.fillStyle = '#fff'; ctx.fill();
  }
  function brow(ctx, x1, y1, x2, y2, w = 3) {
    ctx.lineCap = 'round'; ctx.strokeStyle = OL; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function legs(ctx, col, walk, spread = 7, rx = 6) {
    for (const s of [-1, 1]) {
      const off = s * walk * 4;
      ell(ctx, s * spread + off, -3 - Math.max(0, s * walk) * 2.5, rx, 5);
      fs(ctx, col, 2.5);
    }
  }
  function arm(ctx, sx, sy, ax, ay, len, color, weapon) {
    const hx = sx + ax * len, hy = sy + ay * len * 0.7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    if (weapon) {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(ay * 0.7, ax)); weapon(ctx); ctx.restore();
    }
    circ(ctx, hx, hy, 4.5); fs(ctx, color, 2);
  }

  // ------------------------------------------------------------- personajes
  // Coordenadas locales: pies en (0,0), mirando hacia +x. 'o' trae walk, ax, ay, t.
  const FIG = {};

  FIG.pinon = (ctx, P, o) => {
    const { walk, ax, ay, t } = o;
    // Cola
    ctx.save(); ctx.translate(-10, -18); ctx.rotate(-0.15 + Math.sin(t / 260) * 0.1);
    ctx.beginPath(); ctx.moveTo(2, 0);
    ctx.bezierCurveTo(-24, 2, -30, -30, -14, -46);
    ctx.bezierCurveTo(-2, -58, 14, -46, 4, -36);
    ctx.bezierCurveTo(-4, -30, -8, -16, 6, -8); ctx.closePath();
    fs(ctx, vgrad(ctx, -50, 0, P.main));
    ctx.beginPath(); ctx.moveTo(-12, -40); ctx.bezierCurveTo(-4, -50, 8, -44, 2, -38);
    ctx.lineWidth = 4; ctx.strokeStyle = P.light; ctx.stroke();
    ctx.restore();
    const sling = (c) => {
      c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 6;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 0); c.moveTo(9, 0); c.lineTo(15, -6); c.moveTo(9, 0); c.lineTo(15, 6); c.stroke();
      c.strokeStyle = '#8b5a2b'; c.lineWidth = 3; c.stroke();
    };
    if (ay < -0.25) arm(ctx, 4, -24, ax, ay, 15, P.main, sling);
    legs(ctx, P.dark, walk);
    ell(ctx, 0, -18, 13, 14); fs(ctx, vgrad(ctx, -32, -4, P.main));
    ell(ctx, 4, -16, 7, 9); ctx.fillStyle = P.light; ctx.fill();
    for (const [ex, ey] of [[-9, -58], [6, -60]]) {
      tri(ctx, ex - 7, ey + 10, ex, ey - 9, ex + 7, ey + 10); fs(ctx, P.main);
      tri(ctx, ex - 3, ey + 7, ex, ey - 3, ex + 3, ey + 7); ctx.fillStyle = P.light; ctx.fill();
    }
    circ(ctx, 0, -44, 18); fs(ctx, vgrad(ctx, -62, -26, P.main));
    ell(ctx, 9, -37, 9, 7); fs(ctx, P.light, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(11, -33, 5, 5); ctx.lineWidth = 1.5; ctx.strokeStyle = OL; ctx.strokeRect(11, -33, 5, 5);
    ell(ctx, 17, -40, 3.5, 2.8); ctx.fillStyle = P.accent; ctx.fill();
    eye(ctx, 3, -48, 4.5, 6, ax, ay); eye(ctx, 12, -48, 4, 5.5, ax, ay);
    brow(ctx, -1, -56, 6, -54); brow(ctx, 10, -55, 15, -56);
    if (ay >= -0.25) arm(ctx, 4, -22, ax, ay, 15, P.main, sling);
  };

  FIG.brutus = (ctx, P, o) => {
    const { walk, ax, ay } = o;
    const claws = (c) => {
      for (const a of [-0.5, 0, 0.5]) {
        c.save(); c.rotate(a); tri(c, 3, -2.5, 13, 0, 3, 2.5); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = OL; c.stroke(); c.restore();
      }
    };
    if (ay < -0.25) arm(ctx, 6, -26, ax, ay, 15, P.main, claws);
    legs(ctx, P.dark, walk, 9, 7);
    ell(ctx, 0, -21, 17, 16); fs(ctx, vgrad(ctx, -37, -5, P.main));
    ell(ctx, 4, -18, 10, 10); ctx.fillStyle = P.light; ctx.fill();
    for (const [ex, ey] of [[-12, -63], [9, -66]]) {
      circ(ctx, ex, ey, 7.5); fs(ctx, P.dark);
      circ(ctx, ex, ey, 3.5); ctx.fillStyle = P.light; ctx.fill();
    }
    circ(ctx, 0, -46, 21); fs(ctx, vgrad(ctx, -67, -25, P.main));
    ell(ctx, 10, -39, 10, 8); fs(ctx, P.light, 2);
    ell(ctx, 18, -42, 4.5, 3.4); ctx.fillStyle = P.accent; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.beginPath(); ctx.moveTo(9, -34); ctx.quadraticCurveTo(13, -31, 17, -34); ctx.stroke();
    eye(ctx, 2, -51, 3.6, 4.6, ax, ay); eye(ctx, 12, -51, 3.4, 4.4, ax, ay);
    brow(ctx, -3, -58, 6, -55, 4); brow(ctx, 9, -55, 17, -58, 4);
    if (ay >= -0.25) arm(ctx, 6, -24, ax, ay, 15, P.main, claws);
  };

  FIG.ulma = (ctx, P, o) => {
    const { walk, ax, ay, t } = o;
    const flap = Math.sin(t / 180) * 0.12;
    ell(ctx, -15, -30, 8, 16, -0.25 + flap); fs(ctx, vgrad(ctx, -46, -14, P.dark));
    for (const s of [-1, 1]) { ell(ctx, s * 6 + s * walk * 3, -2, 5, 3.5); fs(ctx, '#f29a1f', 2); }
    const feather = (c) => { ell(c, 8, 0, 9, 3.5); fs(c, P.light, 2); };
    if (ay < -0.25) arm(ctx, 5, -26, ax, ay, 13, P.dark, feather);
    ell(ctx, 0, -31, 19, 27); fs(ctx, vgrad(ctx, -58, -4, P.main));
    ctx.strokeStyle = sh(P.main, -0.3); ctx.lineWidth = 2;
    for (const [vx, vy] of [[-4, -20], [4, -16], [-2, -11]]) { ctx.beginPath(); ctx.moveTo(vx - 3, vy - 2); ctx.lineTo(vx, vy + 1); ctx.lineTo(vx + 3, vy - 2); ctx.stroke(); }
    tri(ctx, -16, -50, -13, -66, -4, -54); fs(ctx, P.dark);
    tri(ctx, 2, -55, 9, -69, 13, -52); fs(ctx, P.dark);
    ell(ctx, 7, -42, 13, 12); fs(ctx, P.light, 2);
    eye(ctx, 2, -44, 6, 6.5, ax, ay, P.accent); eye(ctx, 13, -44, 5.5, 6, ax, ay, P.accent);
    brow(ctx, -3, -52, 7, -49, 3.5); brow(ctx, 10, -49, 18, -52, 3.5);
    tri(ctx, 7, -39, 16, -36, 7, -32); fs(ctx, '#f29a1f', 2);
    if (ay >= -0.25) arm(ctx, 5, -24, ax, ay, 13, P.dark, feather);
  };

  FIG.champi = (ctx, P, o) => {
    const { walk, ax, ay } = o;
    const pouch = (c) => { circ(c, 6, 0, 5); fs(c, '#b7ff6a', 2); };
    if (ay < -0.25) arm(ctx, 3, -20, ax, ay, 13, P.accent, pouch);
    legs(ctx, sh(P.accent, -0.25), walk, 7, 6);
    rrect(ctx, -12, -38, 24, 34, 11); fs(ctx, vgrad(ctx, -38, -4, P.accent));
    eye(ctx, 2, -25, 3.5, 4.5, ax, ay); eye(ctx, 10, -25, 3.2, 4.2, ax, ay);
    ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.beginPath(); ctx.arc(7, -18, 3.5, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -36);
    ctx.quadraticCurveTo(-28, -72, 0, -73);
    ctx.quadraticCurveTo(28, -72, 28, -36);
    ctx.quadraticCurveTo(0, -27, -28, -36); ctx.closePath();
    fs(ctx, vgrad(ctx, -73, -30, P.main));
    for (const [sx, sy, sr] of [[-14, -52, 5.5], [-1, -63, 4.5], [13, -55, 6.5], [21, -42, 3.5], [-21, -41, 3.5], [3, -45, 3]]) {
      ell(ctx, sx, sy, sr, sr * 0.85); ctx.fillStyle = P.light; ctx.fill();
    }
    ctx.globalAlpha *= 0.35; ell(ctx, -10, -62, 9, 4, -0.4); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha /= 0.35;
    if (ay >= -0.25) arm(ctx, 3, -18, ax, ay, 13, P.accent, pouch);
  };

  FIG.rayo = (ctx, P, o) => {
    const { walk, ax, ay, t } = o;
    ctx.save(); ctx.translate(-10, -16); ctx.rotate(0.35 + Math.sin(t / 200) * 0.12);
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.bezierCurveTo(-14, -14, -34, -10, -36, 0); ctx.bezierCurveTo(-30, 8, -12, 8, 0, 4); ctx.closePath();
    fs(ctx, vgrad(ctx, -14, 8, P.main));
    ctx.beginPath(); ctx.moveTo(-26, -8); ctx.bezierCurveTo(-32, -8, -37, -4, -36, 0); ctx.bezierCurveTo(-33, 5, -28, 6, -24, 5); ctx.closePath(); fs(ctx, P.light, 2);
    ctx.restore();
    const blaster = (c) => { rrect(c, -2, -4, 18, 8, 3); fs(c, '#5a6270', 2); rrect(c, 13, -3, 5, 6, 2); fs(c, '#ffb03a', 1.5); };
    if (ay < -0.25) arm(ctx, 4, -23, ax, ay, 14, P.main, blaster);
    legs(ctx, P.dark, walk);
    ell(ctx, 0, -18, 12, 14); fs(ctx, vgrad(ctx, -32, -4, P.main));
    ell(ctx, 5, -20, 6, 9); ctx.fillStyle = P.light; ctx.fill();
    for (const [x1, x2, x3, ty] of [[-12, -8, 1, -82], [2, 10, 14, -81]]) {
      tri(ctx, x1, -56, x2, ty, x3, -58); fs(ctx, P.main);
      tri(ctx, x1 + 3, -60, x2, ty + 8, x3 - 3, -61); ctx.fillStyle = P.dark; ctx.fill();
    }
    circ(ctx, 0, -45, 17); fs(ctx, vgrad(ctx, -62, -28, P.main));
    ctx.beginPath(); ctx.moveTo(6, -47); ctx.quadraticCurveTo(20, -46, 25, -40); ctx.quadraticCurveTo(18, -33, 5, -35); ctx.closePath(); fs(ctx, P.light, 2);
    circ(ctx, 25, -40, 3); ctx.fillStyle = P.accent; ctx.fill();
    eye(ctx, 3, -50, 4, 4.4, ax, ay); eye(ctx, 12, -50, 3.6, 4.1, ax, ay);
    brow(ctx, -2, -55, 7, -56); brow(ctx, 9, -56, 16, -54);
    if (ay >= -0.25) arm(ctx, 4, -21, ax, ay, 14, P.main, blaster);
  };

  FIG.lumi = (ctx, P, o) => {
    const { ax, ay, t } = o;
    const flap = Math.abs(Math.sin(t / 45));
    ctx.globalAlpha *= 0.75;
    for (const [wx, rot] of [[-8, -0.7], [2, -0.35]]) {
      ell(ctx, wx, -62, 8, 17 * (0.5 + flap * 0.5), rot); fs(ctx, 'rgba(225,245,255,0.85)', 2);
    }
    ctx.globalAlpha /= 0.75;
    const g = ctx.createRadialGradient(-7, -26, 2, -7, -26, 30);
    g.addColorStop(0, P.light); g.addColorStop(1, 'rgba(255,255,150,0)');
    ctx.globalAlpha *= 0.55 + Math.sin(t / 250) * 0.15; circ(ctx, -7, -26, 30); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = o.alpha;
    const orb = (c) => { circ(c, 7, 0, 5); fs(c, P.light, 2); };
    if (ay < -0.25) arm(ctx, 4, -36, ax, ay, 12, P.main, orb);
    ell(ctx, -7, -26, 12, 13, 0.3); fs(ctx, vgrad(ctx, -39, -13, P.light, 0.4, -0.05));
    ctx.strokeStyle = sh(P.light, -0.35); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-15, -30); ctx.quadraticCurveTo(-7, -24, 0, -30); ctx.stroke();
    ell(ctx, 2, -38, 11, 11); fs(ctx, vgrad(ctx, -49, -27, P.main));
    circ(ctx, 6, -54, 13); fs(ctx, vgrad(ctx, -67, -41, P.main));
    ctx.lineWidth = 2.5; ctx.strokeStyle = OL;
    ctx.beginPath(); ctx.moveTo(2, -65); ctx.quadraticCurveTo(-2, -75, -4, -80); ctx.moveTo(10, -66); ctx.quadraticCurveTo(14, -75, 16, -80); ctx.stroke();
    for (const x of [-4, 16]) { circ(ctx, x, -80, 3.5); fs(ctx, P.accent, 1.5); }
    eye(ctx, 7, -55, 4.5, 5.5, ax, ay); eye(ctx, 15, -55, 4, 5, ax, ay);
    ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.beginPath(); ctx.arc(12, -48, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
    if (ay >= -0.25) arm(ctx, 4, -34, ax, ay, 12, P.main, orb);
  };

  FIG.tortu = (ctx, P, o) => {
    const { walk, ax, ay } = o;
    const tube = (c) => { rrect(c, -2, -5, 16, 10, 4); fs(c, P.accent, 2); };
    if (ay < -0.25) arm(ctx, 8, -24, ax, ay, 13, P.main, tube);
    legs(ctx, P.main, walk, 10, 7);
    tri(ctx, -20, -14, -28, -10, -20, -8); fs(ctx, P.main, 2);
    ell(ctx, -3, -26, 22, 19); fs(ctx, vgrad(ctx, -45, -8, P.dark, 0.3, -0.2));
    ctx.strokeStyle = sh(P.dark, -0.35); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -38); ctx.lineTo(2, -38); ctx.lineTo(7, -29); ctx.lineTo(2, -20); ctx.lineTo(-10, -20); ctx.lineTo(-15, -29); ctx.closePath();
    ctx.moveTo(-10, -38); ctx.lineTo(-14, -44); ctx.moveTo(2, -38); ctx.lineTo(6, -44); ctx.moveTo(7, -29); ctx.lineTo(17, -29);
    ctx.moveTo(-15, -29); ctx.lineTo(-24, -29); ctx.moveTo(2, -20); ctx.lineTo(6, -12); ctx.moveTo(-10, -20); ctx.lineTo(-14, -12);
    ctx.stroke();
    ell(ctx, -3, -11, 21, 5); fs(ctx, P.light, 2.5);
    circ(ctx, 15, -42, 13); fs(ctx, vgrad(ctx, -55, -29, P.main));
    eye(ctx, 15, -46, 3.8, 4.6, ax, ay); eye(ctx, 23, -46, 3.4, 4.3, ax, ay);
    ctx.lineWidth = 2; ctx.strokeStyle = OL; ctx.beginPath(); ctx.arc(19, -38, 4, 0.2, Math.PI - 0.4); ctx.stroke();
    brow(ctx, 11, -52, 18, -51); brow(ctx, 21, -51, 27, -53);
    if (ay >= -0.25) arm(ctx, 8, -22, ax, ay, 13, P.main, tube);
  };

  /**
   * Dibuja un luchador. o = { x, y (pies), scale, aim, t, moving, alpha, ring, superReady, shield }
   */
  function drawBrawler(ctx, type, pal, o) {
    const fig = FIG[type] || FIG.pinon;
    const s = o.scale || 1;
    const t = o.t || 0;
    const alpha = o.alpha == null ? 1 : o.alpha;
    const aim = o.aim || 0;
    const face = Math.cos(aim) >= 0 ? 1 : -1;
    const walk = o.moving ? Math.sin(t / 65) : 0;
    const floaty = type === 'lumi';
    const bob = floaty ? 6 + Math.sin(t / 220) * 3 : o.moving ? Math.abs(Math.sin(t / 65)) * 2.5 : Math.sin(t / 380) * 1.2;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ell(ctx, 0, 0, floaty ? 15 : 20, floaty ? 6 : 8); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    if (o.superReady) {
      ctx.globalAlpha = alpha * (0.55 + Math.sin(t / 130) * 0.25);
      ell(ctx, 0, 0, 30, 13); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd23d'; ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    if (o.ring) {
      ell(ctx, 0, 0, 25, 11); ctx.lineWidth = 6; ctx.strokeStyle = OL; ctx.stroke();
      ctx.lineWidth = 3.5; ctx.strokeStyle = o.ring; ctx.stroke();
    }
    ctx.save();
    ctx.scale(face, 1);
    ctx.translate(0, -bob);
    // Squash & stretch al caminar.
    if (o.moving && !floaty) ctx.scale(1 + Math.abs(walk) * 0.03, 1 - Math.abs(walk) * 0.03);
    const ax = Math.cos(aim) * face, ay = Math.sin(aim);
    fig(ctx, pal, { walk, ax, ay, t, alpha });
    ctx.restore();
    if (o.shield) {
      ctx.globalAlpha = alpha * 0.8;
      const g = ctx.createRadialGradient(0, -32, 10, 0, -32, 46);
      g.addColorStop(0, 'rgba(140,255,170,0.05)'); g.addColorStop(1, 'rgba(140,255,170,0.45)');
      ell(ctx, 0, -32, 40, 46); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(200,255,210,0.9)'; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- escenario
  function buildMap(rows) {
    const h = rows.length, w = rows[0].length;
    const tiles = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      tiles.push(c === '#' ? 1 : c === '~' ? 2 : c === '*' ? 3 : 0);
    }
    const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= w || ty >= h ? 1 : tiles[ty * w + tx]);
    const isBorder = (x, y) => x === 0 || y === 0 || x === w - 1 || y === h - 1;
    const rowItems = [];
    for (let y = 0; y < h; y++) {
      const list = [];
      for (let x = 0; x < w; x++) {
        const t = tileAt(x, y);
        if (t === 1) list.push({ kind: isBorder(x, y) ? 'tree' : (x * 7 + y * 3) % 5 === 0 ? 'crate' : 'rock', x: x * TILE, y: y * TILE, v: (x * 31 + y * 17) % 7 });
        else if (t === 3) list.push({ kind: 'bush', x: x * TILE, y: y * TILE, v: (x * 13 + y * 7) % 5 });
      }
      rowItems.push(list);
    }

    const layer = document.createElement('canvas');
    layer.width = w * TILE; layer.height = h * TILE;
    const c = layer.getContext('2d');
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const light = (x + y) % 2 === 0;
      c.fillStyle = light ? '#8fcf5c' : '#86c655';
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x * TILE, y * TILE, TILE, 3);
      c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x * TILE, y * TILE + TILE - 3, TILE, 3);
    }
    // Detalles: hierbas, flores y piedrecitas.
    for (let i = 0; i < w * h * 0.9; i++) {
      const gx = rnd() * w * TILE, gy = rnd() * h * TILE;
      if (tileAt(Math.floor(gx / TILE), Math.floor(gy / TILE)) !== 0) continue;
      const r = rnd();
      if (r < 0.6) {
        c.strokeStyle = 'rgba(60,120,40,0.55)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 3, gy - 7); c.moveTo(gx, gy); c.lineTo(gx + 1, gy - 9); c.moveTo(gx, gy); c.lineTo(gx + 4, gy - 6); c.stroke();
      } else if (r < 0.8) {
        const col = ['#fff7d6', '#ffd23d', '#ff9ccb', '#b9d6ff'][Math.floor(rnd() * 4)];
        for (let k = 0; k < 5; k++) { circ(c, gx + Math.cos(k * 1.26) * 3, gy + Math.sin(k * 1.26) * 3, 2.2); c.fillStyle = col; c.fill(); }
        circ(c, gx, gy, 1.8); c.fillStyle = '#e88a1a'; c.fill();
      } else {
        ell(c, gx, gy, 4, 3); c.fillStyle = '#a7a99a'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.3)'; c.stroke();
      }
    }
    // Zonas de aparición
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch !== 'A' && ch !== 'B') continue;
      ell(c, x * TILE + 25, y * TILE + 28, 22, 14);
      c.fillStyle = ch === 'A' ? 'rgba(61,139,255,0.35)' : 'rgba(255,80,70,0.35)'; c.fill();
      c.lineWidth = 2; c.strokeStyle = ch === 'A' ? 'rgba(30,80,200,0.6)' : 'rgba(180,30,30,0.6)'; c.stroke();
    }
    // Agua con orilla de arena.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tileAt(x, y) !== 2) continue;
      const X = x * TILE, Y = y * TILE;
      c.fillStyle = '#e8d29a'; c.fillRect(X - 3, Y - 3, TILE + 6, TILE + 6);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tileAt(x, y) !== 2) continue;
      const X = x * TILE, Y = y * TILE;
      const g = c.createLinearGradient(0, Y, 0, Y + TILE);
      g.addColorStop(0, '#3fa7e0'); g.addColorStop(1, '#2b86c4');
      c.fillStyle = g; c.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
      if (tileAt(x + 1, y) === 2) c.fillRect(X + TILE - 2, Y + 2, 4, TILE - 4);
      if (tileAt(x, y + 1) === 2) c.fillRect(X + 2, Y + TILE - 2, TILE - 4, 4);
      if (tileAt(x + 1, y) === 2 && tileAt(x, y + 1) === 2 && tileAt(x + 1, y + 1) === 2) c.fillRect(X + TILE - 2, Y + TILE - 2, 4, 4);
      if (tileAt(x, y - 1) !== 2) { c.fillStyle = 'rgba(20,70,120,0.35)'; c.fillRect(X + 2, Y + 2, TILE - 4, 6); }
    }
    return { rows, w, h, tiles, tileAt, rowItems, layer, width: w * TILE, height: h * TILE };
  }

  function drawWater(ctx, map, t, x0, y0, x1, y1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (map.tileAt(x, y) !== 2) continue;
      const X = x * TILE, Y = y * TILE;
      for (let k = 0; k < 2; k++) {
        const ph = (t / 900 + x * 0.7 + y * 0.4 + k * 0.5) % 1;
        const yy = Y + 14 + k * 20;
        const xx = X + 6 + ph * 18;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 6, yy - 4, xx + 12, yy); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRock(ctx, X, Y, v) {
    const top = Y - WALL_H;
    rrect(ctx, X + 1, Y + TILE - WALL_H - 4, TILE - 2, WALL_H + 4, 6);
    fs(ctx, vgrad(ctx, Y + TILE - WALL_H, Y + TILE, '#7d8a8f', 0, -0.25), 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X + 12 + v, Y + TILE - 18); ctx.lineTo(X + 18 + v, Y + TILE - 8); ctx.moveTo(X + 34 - v, Y + TILE - 20); ctx.lineTo(X + 30 - v, Y + TILE - 10); ctx.stroke();
    rrect(ctx, X + 1, top + 1, TILE - 2, TILE - 2, 8);
    fs(ctx, vgrad(ctx, top, top + TILE, '#b4c0c2', 0.15, -0.1), 3);
    ell(ctx, X + 16 + v, top + 14, 11, 7); ctx.fillStyle = '#6fbf4a'; ctx.fill();
    ell(ctx, X + 34 - v, top + 30, 8, 5); ctx.fillStyle = '#5fae3e'; ctx.fill();
    ell(ctx, X + 14, top + 8, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  }

  function drawCrate(ctx, X, Y) {
    const top = Y - WALL_H;
    ctx.beginPath(); ctx.rect(X + 2, Y + TILE - WALL_H - 4, TILE - 4, WALL_H + 4);
    fs(ctx, '#9a5f2c', 3);
    ctx.strokeStyle = '#6b3d16'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X + 2, Y + TILE - 12); ctx.lineTo(X + TILE - 2, Y + TILE - 12); ctx.stroke();
    ctx.beginPath(); ctx.rect(X + 2, top + 2, TILE - 4, TILE - 4);
    fs(ctx, vgrad(ctx, top, top + TILE, '#d89a55'), 3);
    ctx.strokeStyle = '#a86a30'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const yy of [16, 32]) { ctx.moveTo(X + 4, top + yy); ctx.lineTo(X + TILE - 4, top + yy); }
    ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X + 6, top + 6); ctx.lineTo(X + TILE - 6, top + TILE - 6); ctx.stroke();
    ctx.strokeStyle = '#c9884a'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawTree(ctx, X, Y, v) {
    rrect(ctx, X + TILE / 2 - 7, Y + TILE - 22, 14, 22, 4); fs(ctx, '#7a4a22', 2.5);
    const cx = X + TILE / 2, cy = Y + 2;
    const base = ['#2f8a3a', '#2b8136', '#34923f'][v % 3];
    circ(ctx, cx, cy, 31); fs(ctx, vgrad(ctx, cy - 31, cy + 31, base, 0.25, -0.3), 3);
    circ(ctx, cx - 9, cy - 10, 15); ctx.fillStyle = sh(base, 0.25); ctx.fill();
    circ(ctx, cx - 12, cy - 14, 6); ctx.fillStyle = sh(base, 0.5); ctx.fill();
    circ(ctx, cx + 12, cy + 10, 7); ctx.fillStyle = sh(base, -0.15); ctx.fill();
  }

  function drawBush(ctx, X, Y, v, t, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const sway = Math.sin(t / 700 + v) * 2.5;
    const by = Y + TILE - 2;
    // Base frondosa que cubre toda la casilla.
    rrect(ctx, X - 1, Y - 6, TILE + 2, TILE + 6, 14);
    fs(ctx, vgrad(ctx, Y - 6, Y + TILE, '#3aa83a', 0.05, -0.3), 3);
    const cols = ['#2f962f', '#3cb03b', '#4fc44a'];
    for (let layer = 0; layer < 3; layer++) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const bx = X + 3 + i * 11 + (layer % 2) * 5;
        const baseY = by - layer * 12;
        const hgt = 26 + ((i * 7 + v + layer * 3) % 4) * 4;
        const tip = sway * (1 + layer * 0.4) + (i % 2 ? 3 : -3);
        ctx.beginPath();
        ctx.moveTo(bx - 8, baseY);
        ctx.quadraticCurveTo(bx - 6, baseY - hgt * 0.6, bx + tip, baseY - hgt);
        ctx.quadraticCurveTo(bx + 6, baseY - hgt * 0.6, bx + 8, baseY);
        ctx.closePath();
        fs(ctx, cols[layer], 2.2);
      }
    }
    ctx.restore();
  }

  function drawGem(ctx, x, y, t) {
    const bob = Math.sin(t / 250 + x) * 3;
    ell(ctx, x, y + 6, 10, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    ctx.save(); ctx.translate(x, y - 10 + bob);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    g.addColorStop(0, 'rgba(220,150,255,0.6)'); g.addColorStop(1, 'rgba(220,150,255,0)');
    circ(ctx, 0, 0, 22); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(11, -3); ctx.lineTo(0, 14); ctx.lineTo(-11, -3); ctx.closePath();
    fs(ctx, '#b25cff', 2.5);
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(5, -3); ctx.lineTo(0, 14); ctx.lineTo(-5, -3); ctx.closePath(); ctx.fillStyle = '#d9a6ff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.strokeStyle = '#7d2fc2'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------- proyectiles
  function drawBullet(ctx, kind, x, y, ang, t) {
    const H = 22;
    ell(ctx, x, y, 7, 3); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
    ctx.save(); ctx.translate(x, y - H); ctx.rotate(ang);
    const sup = kind.endsWith('S');
    const k = sup ? kind.slice(0, -1) : kind;
    if (k === 'pinon') {
      ctx.rotate(t / 60);
      const s = sup ? 1.4 : 1;
      ell(ctx, 2 * s, 0, 7 * s, 6 * s); fs(ctx, '#a8692c', 2);
      ctx.beginPath(); ctx.arc(-1 * s, 0, 6.5 * s, Math.PI * 0.5, Math.PI * 1.5); ctx.closePath(); fs(ctx, '#5a3412', 2);
      if (sup) { circ(ctx, 0, 0, 13); ctx.strokeStyle = 'rgba(255,190,80,0.6)'; ctx.lineWidth = 3; ctx.stroke(); }
    } else if (k === 'brutus') {
      ctx.lineCap = 'round';
      for (const [w, col] of [[9, OL], [5, '#fff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(-8, 0, 14, -0.9, 0.9); ctx.stroke();
      }
    } else if (k === 'ulma') {
      const s = sup ? 1.8 : 1;
      if (sup) { ell(ctx, 0, 0, 30, 14); ctx.fillStyle = 'rgba(140,220,255,0.35)'; ctx.fill(); }
      ell(ctx, 0, 0, 16 * s, 5 * s); fs(ctx, sup ? '#bfeaff' : '#f2f5ff', 2);
      ctx.strokeStyle = '#7d879a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-18 * s, 0); ctx.lineTo(14 * s, 0); ctx.stroke();
    } else if (k === 'lumi') {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
      g.addColorStop(0, 'rgba(255,250,170,1)'); g.addColorStop(1, 'rgba(255,240,100,0)');
      circ(ctx, 0, 0, 20); ctx.fillStyle = g; ctx.fill();
      circ(ctx, 0, 0, 8); fs(ctx, '#fff27a', 2);
    } else if (k === 'rayo') {
      ell(ctx, 0, 0, 13, 4.5); fs(ctx, '#ffb03a', 2);
      ell(ctx, 3, 0, 6, 2); ctx.fillStyle = '#fff6c8'; ctx.fill();
    } else if (k === 'tortu') {
      ctx.rotate(t / 50);
      circ(ctx, 0, 0, 12); fs(ctx, '#7a5a2e', 2.5);
      ctx.strokeStyle = '#4f3a1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    } else {
      circ(ctx, 0, 0, 7); fs(ctx, '#fff', 2);
    }
    ctx.restore();
  }

  function drawLob(ctx, kind, x, y, hgt, x1, y1, radius) {
    ctx.setLineDash([10, 7]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,60,60,0.75)';
    ell(ctx, x1, y1, radius, radius * 0.92); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,60,60,0.12)'; ctx.fill();
    ell(ctx, x, y, 12, 5); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    const cloud = kind === 'cloud';
    circ(ctx, x, y - hgt - 20, cloud ? 15 : 12); fs(ctx, cloud ? '#9b4fd1' : '#e0443b', 2.5);
    for (const [dx, dy] of [[-4, -4], [4, 2], [-2, 5]]) { circ(ctx, x + dx, y - hgt - 20 + dy, 2.5); ctx.fillStyle = '#fff4e0'; ctx.fill(); }
  }

  FW.Art = { TILE, WALL_H, shade, sh, ell, circ, fs, rrect, vgrad, drawBrawler, buildMap, drawWater, drawRock, drawCrate, drawTree, drawBush, drawGem, drawBullet, drawLob };
})();
