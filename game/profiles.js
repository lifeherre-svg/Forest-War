// Perfiles persistentes de jugador guardados en un JSON en disco.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BRAWLERS, LEVELS } = require('./constants');
const { PASS } = require('./pass');
const { NAME_COLORS, TITLES, BANNERS } = require('./cosmetics');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'profiles.json');
const DAY = 24 * 3600 * 1000;

let profiles = {};
try {
  profiles = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  profiles = {};
}

// Índices: nombre de usuario (en minúsculas) -> id, y sesión (hash) -> id.
const byName = new Map();
const bySession = new Map();
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
for (const p of Object.values(profiles)) {
  if (p.auth) byName.set(p.name.toLowerCase(), p.id);
  for (const h of p.sessions || []) bySession.set(h, p.id);
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE + '.tmp', JSON.stringify(profiles));
      fs.renameSync(FILE + '.tmp', FILE);
    } catch (e) {
      console.error('No se pudieron guardar los perfiles:', e.message);
    }
  }, 1000);
}

const cleanName = (n) => String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 14) || 'Jugador';

// ---------------------------------------------------------------- cuentas
const USERNAME_RE = /^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ]{3,14}$/;
const RESERVED = ['admin', 'administrador', 'moderador', 'soporte', 'forestwar', 'bot', 'sistema', 'jugador'];

function checkUsername(name, self) {
  name = String(name || '').trim();
  if (!USERNAME_RE.test(name)) return { error: 'El nombre debe tener de 3 a 14 letras, números o guiones bajos (_), sin espacios.' };
  const low = name.toLowerCase();
  if (RESERVED.includes(low) || low.startsWith('bot')) return { error: 'Ese nombre no está permitido.' };
  const owner = byName.get(low);
  if (owner && (!self || owner !== self.id)) return { error: 'Ese nombre de usuario ya está cogido.' };
  return { name };
}

function checkPassword(pw) {
  pw = String(pw || '');
  if (pw.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (pw.length > 64) return 'La contraseña es demasiado larga.';
  return null;
}

function hashPassword(pw) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve({ salt, hash: key.toString('hex') })));
  });
}

function verifyPassword(pw, auth) {
  return new Promise((resolve) => {
    crypto.scrypt(String(pw || ''), auth.salt, 64, (err, key) => {
      if (err) return resolve(false);
      const a = Buffer.from(auth.hash, 'hex');
      resolve(a.length === key.length && crypto.timingSafeEqual(a, key));
    });
  });
}

function newSession(p) {
  const token = crypto.randomBytes(24).toString('hex');
  const h = sha(token);
  p.sessions = (p.sessions || []).concat(h);
  while (p.sessions.length > 10) bySession.delete(p.sessions.shift());
  bySession.set(h, p.id);
  save();
  return token;
}

// Devuelve { profile } si la sesión es válida, { guest } si es un perfil
// antiguo sin cuenta (se le pedirá registrarse conservando el progreso).
function resolveToken(token) {
  if (typeof token !== 'string') return {};
  const pid = bySession.get(sha(token));
  if (pid && profiles[pid]) return { profile: profiles[pid] };
  if (/^[a-f0-9]{32}$/.test(token) && profiles[token] && !profiles[token].auth) return { guest: profiles[token] };
  return {};
}

// Intentos fallidos de inicio de sesión por nombre.
const failures = new Map();

async function register({ username, password, guest }) {
  const u = checkUsername(username);
  if (u.error) return u;
  const pwErr = checkPassword(password);
  if (pwErr) return { error: pwErr };
  const auth = await hashPassword(String(password));
  // Comprobar otra vez por si alguien lo cogió mientras se calculaba el hash.
  if (byName.has(u.name.toLowerCase())) return { error: 'Ese nombre de usuario ya está cogido.' };
  const p = guest && !guest.auth ? guest : newProfile();
  p.name = u.name;
  p.auth = auth;
  if (!guest) p.createdAt = Date.now();
  byName.set(u.name.toLowerCase(), p.id);
  return { profile: p, token: newSession(p) };
}

async function login({ username, password }) {
  const low = String(username || '').trim().toLowerCase();
  const f = failures.get(low);
  if (f && f.until > Date.now()) return { error: `Demasiados intentos. Espera ${Math.ceil((f.until - Date.now()) / 1000)} s.` };
  const pid = byName.get(low);
  const p = pid && profiles[pid];
  const ok = p ? await verifyPassword(password, p.auth) : await verifyPassword(password, { salt: 'x', hash: '00' }) && false;
  if (!ok) {
    const n = (f ? f.n : 0) + 1;
    failures.set(low, { n, until: n >= 5 ? Date.now() + 30000 : 0 });
    return { error: 'Usuario o contraseña incorrectos.' };
  }
  failures.delete(low);
  return { profile: p, token: newSession(p) };
}

function logout(token) {
  const h = sha(String(token || ''));
  const pid = bySession.get(h);
  if (!pid) return;
  bySession.delete(h);
  const p = profiles[pid];
  if (p) p.sessions = (p.sessions || []).filter((x) => x !== h);
  save();
}

async function changePassword(p, { current, password }) {
  if (!(await verifyPassword(current, p.auth))) return { error: 'La contraseña actual no es correcta.' };
  const pwErr = checkPassword(password);
  if (pwErr) return { error: pwErr };
  p.auth = await hashPassword(String(password));
  save();
  return {};
}

// ---------------------------------------------------------------- personalización
function statValue(p, t) {
  if (t === 'trophies') return totalTrophies(p);
  if (t === 'wins') return p.stats.wins;
  if (t === 'games') return p.stats.games;
  if (t === 'kills') return p.stats.kills;
  if (t === 'brawlers') return Object.keys(p.owned).length;
  if (t === 'passTier') return passInfo(p).tier;
  return 0;
}
const unlocked = (p, item) => !item.req || statValue(p, item.req.t) >= item.req.n;
const unlockedKeys = (p, table) => Object.keys(table).filter((k) => unlocked(p, table[k]));

function looks(p) {
  const av = p.avatar && p.owned[p.avatar.b] && p.owned[p.avatar.b].skins.includes(p.avatar.s) ? p.avatar : null;
  return {
    avatar: av || { b: p.selected, s: (p.owned[p.selected] || {}).skin || 'default' },
    nameColor: NAME_COLORS[p.nameColor] && unlocked(p, NAME_COLORS[p.nameColor]) ? p.nameColor : 'blanco',
    title: TITLES[p.title] && unlocked(p, TITLES[p.title]) ? p.title : 'novato',
    banner: BANNERS[p.banner] && unlocked(p, BANNERS[p.banner]) ? p.banner : 'azul',
  };
}

// Tarjeta pública que pueden ver otros jugadores.
function card(p) {
  const best = Object.entries(p.trophies).sort((a, b) => b[1] - a[1])[0];
  return {
    name: p.name, ...looks(p), totalTrophies: totalTrophies(p), stats: p.stats,
    brawlers: Object.keys(p.owned).length, best: best ? { b: best[0], t: best[1] } : null, since: p.createdAt,
  };
}

function findCardByName(name) {
  const pid = byName.get(String(name || '').toLowerCase());
  return pid && profiles[pid] ? card(profiles[pid]) : null;
}

function newProfile(name) {
  const id = crypto.randomBytes(16).toString('hex');
  const p = {
    id, name: cleanName(name), createdAt: Date.now(), auth: null, sessions: [],
    coins: 100, emeralds: 0,
    owned: {
      pinon: { level: 1, skins: ['default'], skin: 'default' },
      brutus: { level: 1, skins: ['default'], skin: 'default' },
    },
    trophies: {},
    selected: 'pinon',
    pass: { season: PASS.season, xp: 0, claimedFree: [], claimedPremium: [], premium: false },
    stats: { games: 0, wins: 0, kills: 0 },
    lastDaily: '',
  };
  profiles[id] = p;
  save();
  return p;
}

function get(id) {
  return typeof id === 'string' && /^[a-f0-9]{32}$/.test(id) ? profiles[id] || null : null;
}

function totalTrophies(p) {
  return Object.values(p.trophies).reduce((a, b) => a + b, 0);
}

function passInfo(p) {
  const now = Date.now();
  const trialEndsAt = p.createdAt + PASS.trialDays * DAY;
  const trialActive = now < trialEndsAt;
  const tier = Math.min(PASS.tiers, Math.floor(p.pass.xp / PASS.xpPerTier));
  return {
    ...p.pass, tier, xpInTier: tier >= PASS.tiers ? PASS.xpPerTier : p.pass.xp % PASS.xpPerTier,
    trialEndsAt, trialActive, premiumActive: p.pass.premium || trialActive,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

function publicProfile(p) {
  return {
    name: p.name, ...looks(p), registered: !!p.auth,
    unlocks: { nameColors: unlockedKeys(p, NAME_COLORS), titles: unlockedKeys(p, TITLES), banners: unlockedKeys(p, BANNERS) },
    createdAt: p.createdAt, coins: p.coins, emeralds: p.emeralds,
    owned: p.owned, trophies: p.trophies, totalTrophies: totalTrophies(p), selected: p.selected,
    stats: p.stats, pass: passInfo(p), dailyAvailable: p.lastDaily !== today(), now: Date.now(),
  };
}

// ---------------------------------------------------------------- recompensas
function grant(p, r) {
  if (r.t === 'coins') { p.coins += r.n; return r; }
  if (r.t === 'emeralds') { p.emeralds += r.n; return r; }
  if (r.t === 'brawler') {
    if (p.owned[r.id]) { p.coins += 300; return { t: 'coins', n: 300, dup: r }; }
    p.owned[r.id] = { level: 1, skins: ['default'], skin: 'default' };
    return r;
  }
  if (r.t === 'skin') {
    if (!p.owned[r.b]) {
      // Si aún no tiene el luchador, se lo damos junto con el aspecto.
      p.owned[r.b] = { level: 1, skins: ['default'], skin: 'default' };
    }
    const o = p.owned[r.b];
    if (o.skins.includes(r.s)) { p.emeralds += 10; return { t: 'emeralds', n: 10, dup: r }; }
    o.skins.push(r.s);
    return r;
  }
  return r;
}

// Acciones de la tienda / colección. Devuelven { error } o { rewards }.
const actions = {
  setUsername(p, { name }) {
    const u = checkUsername(name, p);
    if (u.error) return u;
    if (p.auth) byName.delete(p.name.toLowerCase());
    p.name = u.name;
    if (p.auth) byName.set(u.name.toLowerCase(), p.id);
    return {};
  },

  customize(p, { avatar, nameColor, title, banner }) {
    if (avatar) {
      const o = p.owned[avatar.b];
      if (!o || !o.skins.includes(avatar.s)) return { error: 'No tienes ese aspecto.' };
      p.avatar = { b: avatar.b, s: avatar.s };
    }
    if (nameColor) {
      if (!NAME_COLORS[nameColor]) return { error: 'Color no válido.' };
      if (!unlocked(p, NAME_COLORS[nameColor])) return { error: 'Aún no has desbloqueado ese color.' };
      p.nameColor = nameColor;
    }
    if (title) {
      if (!TITLES[title]) return { error: 'Título no válido.' };
      if (!unlocked(p, TITLES[title])) return { error: 'Aún no has desbloqueado ese título.' };
      p.title = title;
    }
    if (banner) {
      if (!BANNERS[banner]) return { error: 'Fondo no válido.' };
      if (!unlocked(p, BANNERS[banner])) return { error: 'Aún no has desbloqueado ese fondo.' };
      p.banner = banner;
    }
    return {};
  },

  select(p, { id, skin }) {
    const o = p.owned[id];
    if (!o) return { error: 'Aún no tienes ese luchador.' };
    if (skin) {
      if (!o.skins.includes(skin)) return { error: 'No tienes ese aspecto.' };
      o.skin = skin;
    }
    p.selected = id;
    return {};
  },

  upgrade(p, { id }) {
    const o = p.owned[id];
    if (!o) return { error: 'Aún no tienes ese luchador.' };
    if (o.level >= LEVELS.max) return { error: 'Ya está al nivel máximo.' };
    const cost = LEVELS.cost[o.level + 1];
    if (p.coins < cost) return { error: `Necesitas ${cost} monedas.` };
    p.coins -= cost;
    o.level++;
    return {};
  },

  buyBrawler(p, { id }) {
    const b = BRAWLERS[id];
    if (!b) return { error: 'Luchador desconocido.' };
    if (p.owned[id]) return { error: 'Ya lo tienes.' };
    if (p.coins < b.price) return { error: `Necesitas ${b.price} monedas.` };
    p.coins -= b.price;
    return { rewards: [grant(p, { t: 'brawler', id })] };
  },

  buySkin(p, { b, s }) {
    const skin = BRAWLERS[b] && BRAWLERS[b].skins[s];
    if (!skin || !skin.price) return { error: 'Ese aspecto no está a la venta.' };
    if (!p.owned[b]) return { error: 'Primero consigue el luchador.' };
    if (p.owned[b].skins.includes(s)) return { error: 'Ya lo tienes.' };
    if (p.emeralds < skin.price) return { error: `Necesitas ${skin.price} esmeraldas.` };
    p.emeralds -= skin.price;
    return { rewards: [grant(p, { t: 'skin', b, s })] };
  },

  buyPass(p) {
    if (p.pass.premium) return { error: 'Ya tienes el Pase Premium.' };
    if (p.emeralds < PASS.premiumPrice) return { error: `Necesitas ${PASS.premiumPrice} esmeraldas.` };
    p.emeralds -= PASS.premiumPrice;
    p.pass.premium = true;
    return { rewards: [{ t: 'pass' }] };
  },

  claim(p, { track, tier }) {
    const info = passInfo(p);
    tier = Number(tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > PASS.tiers) return { error: 'Nivel no válido.' };
    if (tier > info.tier) return { error: 'Todavía no has llegado a ese nivel.' };
    const list = track === 'premium' ? p.pass.claimedPremium : p.pass.claimedFree;
    if (track === 'premium' && !info.premiumActive) return { error: 'Necesitas el Pase Premium.' };
    if (list.includes(tier)) return { error: 'Ya lo has reclamado.' };
    list.push(tier);
    const r = (track === 'premium' ? PASS.premium : PASS.free)[tier - 1];
    return { rewards: [grant(p, { ...r })] };
  },

  claimAll(p) {
    const info = passInfo(p);
    const rewards = [];
    for (let t = 1; t <= info.tier; t++) {
      if (!p.pass.claimedFree.includes(t)) { p.pass.claimedFree.push(t); rewards.push(grant(p, { ...PASS.free[t - 1] })); }
      if (info.premiumActive && !p.pass.claimedPremium.includes(t)) { p.pass.claimedPremium.push(t); rewards.push(grant(p, { ...PASS.premium[t - 1] })); }
    }
    if (!rewards.length) return { error: 'No hay recompensas pendientes.' };
    return { rewards };
  },

  daily(p) {
    if (p.lastDaily === today()) return { error: 'Vuelve mañana a por otro regalo.' };
    p.lastDaily = today();
    return { rewards: [grant(p, { t: 'coins', n: 40 }), grant(p, { t: 'emeralds', n: 5 })] };
  },
};

function act(p, name, args) {
  const fn = actions[name];
  if (!fn) return { error: 'Acción desconocida.' };
  const res = fn(p, args || {});
  if (!res.error) save();
  return res;
}

// Recompensas al acabar una partida.
// result: { brawler, ranked, outcome: 'win'|'loss'|'draw' } o { place, total }, kills
function applyMatch(p, result) {
  let trophies = 0, xp, coins;
  const k = result.kills || 0;
  let win = false;
  if (result.outcome) {
    win = result.outcome === 'win';
    if (result.outcome === 'win') { trophies = 8; xp = 40 + k * 3; coins = 20; }
    else if (result.outcome === 'draw') { trophies = 0; xp = 25 + k * 3; coins = 12; }
    else { trophies = -4; xp = 15 + k * 3; coins = 8; }
  } else {
    const frac = result.total > 1 ? (result.place - 1) / (result.total - 1) : 0;
    win = result.place === 1;
    trophies = Math.round(10 - frac * 14);
    xp = 15 + Math.round((1 - frac) * 30) + k * 3;
    coins = 8 + Math.round((1 - frac) * 12);
  }
  xp = Math.min(90, xp);
  if (!result.ranked) trophies = 0;
  const cur = p.trophies[result.brawler] || 0;
  if (cur + trophies < 0) trophies = -cur;
  p.trophies[result.brawler] = cur + trophies;
  const passBefore = passInfo(p).tier;
  p.pass.xp = Math.min(PASS.tiers * PASS.xpPerTier, p.pass.xp + xp);
  p.coins += coins;
  p.stats.games++;
  if (win) p.stats.wins++;
  p.stats.kills += k;
  save();
  return { trophies, xp, coins, newTier: passInfo(p).tier > passBefore ? passInfo(p).tier : 0 };
}

module.exports = {
  newProfile, get, publicProfile, act, applyMatch, totalTrophies, cleanName,
  register, login, logout, resolveToken, changePassword, looks, card, findCardByName,
};
