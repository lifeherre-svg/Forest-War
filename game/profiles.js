// Perfiles persistentes de jugador guardados en un JSON en disco.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BRAWLERS, LEVELS } = require('./constants');
const { PASS } = require('./pass');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'profiles.json');
const DAY = 24 * 3600 * 1000;

let profiles = {};
try {
  profiles = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  profiles = {};
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

function newProfile(name) {
  const id = crypto.randomBytes(16).toString('hex');
  const p = {
    id, name: cleanName(name), createdAt: Date.now(),
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
    name: p.name, createdAt: p.createdAt, coins: p.coins, emeralds: p.emeralds,
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
  setName(p, { name }) { p.name = cleanName(name); return {}; },

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

module.exports = { newProfile, get, publicProfile, act, applyMatch, totalTrophies, cleanName };
