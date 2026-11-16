const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Game } = require('./game/game');
const { BRAWLERS, MODES, MAPS, BOT_NAMES, LEVELS, BOT_LEVEL } = require('./game/constants');
const { PASS } = require('./game/pass');
const COSMETICS = require('./game/cosmetics');
const Profiles = require('./game/profiles');
const Friends = require('./game/friends');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const MAX_TEAM = 4;
const QUEUE_WAIT_MS = 6000;
const DIFFICULTIES = ['facil', 'normal', 'dificil'];

const app = express();
app.get('/healthz', (req, res) => res.json({ ok: true, rooms: rooms.size, players: io.engine ? io.engine.clientsCount : 0 }));
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do {
    c = '';
    for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(c));
  return c;
}

const brawlerIds = Object.keys(BRAWLERS);
const mapIds = Object.keys(MAPS);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const teamCount = (room, t) => room.members.filter((m) => m.team === t).length;
const pickTeam = (room) => (teamCount(room, 0) <= teamCount(room, 1) ? 0 : 1);
const roomCapacity = (room) => {
  const m = MODES[room.mode];
  if (room.public) return m.team ? m.teamSize * 2 : m.size;
  return MAX_PLAYERS;
};

function publicRoom(room) {
  return {
    code: room.code, hostId: room.hostId, mode: room.mode, map: room.map, inGame: !!room.game, public: !!room.public,
    members: room.members.map(({ id, name, brawler, skin, level, team, isBot, difficulty, trophies, look }) => ({ id, name, brawler, skin, level, team, isBot, difficulty, trophies, look })),
  };
}
const broadcastRoom = (room) => {
  if (room.public) {
    io.to(room.code).emit('queue', {
      mode: room.mode, count: room.members.length, max: roomCapacity(room),
      startsIn: Math.max(0, room.startAt - Date.now()), inGame: !!room.game,
    });
  } else {
    io.to(room.code).emit('roomState', publicRoom(room));
  }
};

function makeBot(room, team, difficulty, level) {
  const used = new Set(room.members.map((m) => m.name));
  const free = BOT_NAMES.filter((n) => !used.has('🤖 ' + n));
  const brawler = pick(brawlerIds);
  const skins = Object.keys(BRAWLERS[brawler].skins);
  return {
    id: 'bot-' + room.code + '-' + ++room.botN,
    name: '🤖 ' + (free.length ? pick(free) : 'Bot'),
    brawler, skin: Math.random() < 0.3 ? pick(skins) : 'default', team, isBot: true, difficulty,
    level: level || BOT_LEVEL[difficulty] || 3, trophies: 0,
  };
}

// Datos del luchador elegido por un jugador según su perfil.
function memberFromProfile(prof, socketId, team) {
  const sel = prof.owned[prof.selected] ? prof.selected : 'pinon';
  const o = prof.owned[sel];
  return {
    id: socketId, pid: prof.id, name: prof.name, brawler: sel, skin: o.skin, level: o.level, team, isBot: false,
    trophies: prof.trophies[sel] || 0, look: Profiles.looks(prof),
  };
}

function refreshMember(m) {
  if (m.isBot) return;
  const prof = Profiles.get(m.pid);
  if (!prof) return;
  const fresh = memberFromProfile(prof, m.id, m.team);
  Object.assign(m, fresh);
}

// ------------------------------------------------------------ presencia y amigos
const online = new Map(); // pid -> Set(socketId)

function presence(pid) {
  const ids = online.get(pid);
  if (!ids || !ids.size) {
    const p = Profiles.byId(pid);
    return { status: 'offline', since: p && p.lastSeen ? p.lastSeen : null };
  }
  let best = { status: 'online' };
  for (const sid of ids) {
    const s = io.sockets.sockets.get(sid);
    const room = s && rooms.get(s.data.room);
    if (!room) continue;
    if (room.game) return { status: 'jugando' };
    best = room.public ? { status: 'buscando' } : { status: 'sala', code: room.code, count: room.members.length };
  }
  return best;
}

function emitToPid(pid, ev, data) {
  for (const sid of online.get(pid) || []) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.emit(ev, data);
  }
}

function sendFriends(pid) {
  const p = Profiles.byId(pid);
  if (p && online.has(pid)) emitToPid(pid, 'friends', Friends.listFor(p, presence));
}

// Avisar a los amigos conectados de un cambio de estado (agrupado).
const dirty = new Set();
let flushQueued = false;
function touch(pid) {
  if (!pid) return;
  dirty.add(pid);
  if (flushQueued) return;
  flushQueued = true;
  setImmediate(() => {
    flushQueued = false;
    const targets = new Set();
    for (const id of dirty) {
      const p = Profiles.byId(id);
      if (!p) continue;
      for (const f of Friends.ensure(p).friends) if (online.has(f)) targets.add(f);
    }
    dirty.clear();
    targets.forEach(sendFriends);
  });
}
const touchRoom = (room) => room.members.forEach((m) => { if (!m.isBot) touch(m.pid); });

function startRoomGame(room) {
  room.members.forEach(refreshMember);
  const game = new Game({
    mode: room.mode, mapId: room.map, members: room.members,
    onEnd: (results) => endRoomGame(room, game, results),
  });
  room.game = game;
  io.to(room.code).emit('gameStart', { ...game.startInfo(), public: !!room.public });
  broadcastRoom(room);
  touchRoom(room);
}

function outcomeFor(results, p) {
  if (MODES[results.mode].team) {
    if (results.winner === null) return { outcome: 'draw' };
    return { outcome: results.winner === p.team ? 'win' : 'loss' };
  }
  return { place: p.place, total: results.total };
}

function endRoomGame(room, game, results) {
  if (room.game !== game) return;
  room.game = null;
  const clean = { ...results, players: results.players.map(({ pid, ...rest }) => rest) };
  for (const p of results.players) {
    if (p.isBot) continue;
    const s = io.sockets.sockets.get(p.id);
    const prof = Profiles.get(p.pid);
    let rewards = null;
    if (prof) {
      rewards = Profiles.applyMatch(prof, { brawler: p.brawler, ranked: !!room.public, kills: p.kills, ...outcomeFor(results, p) });
    }
    if (s) {
      s.emit('gameOver', { ...clean, rewards, public: !!room.public });
      if (prof) s.emit('profile', Profiles.publicProfile(prof));
    }
  }
  if (room.public) {
    for (const m of room.members) {
      const s = io.sockets.sockets.get(m.id);
      if (s) { s.leave(room.code); s.data.room = null; }
    }
    rooms.delete(room.code);
  } else {
    broadcastRoom(room);
  }
  touchRoom(room);
}

io.on('connection', (socket) => {
  socket.emit('hello', {
    brawlers: BRAWLERS, modes: MODES,
    maps: Object.fromEntries(Object.entries(MAPS).map(([k, v]) => [k, { name: v.name }])),
    pass: PASS, levels: { max: LEVELS.max, cost: LEVELS.cost },
    cosmetics: { nameColors: COSMETICS.NAME_COLORS, titles: COSMETICS.TITLES, banners: COSMETICS.BANNERS },
  });

  const getRoom = () => rooms.get(socket.data.room);
  const prof = () => Profiles.get(socket.data.pid);
  const hostRoom = () => {
    const room = getRoom();
    return room && !room.public && room.hostId === socket.id && !room.game ? room : null;
  };
  const err = (msg) => socket.emit('errorMsg', msg);
  const sendProfile = () => { const p = prof(); if (p) socket.emit('profile', Profiles.publicProfile(p)); };

  // ------------------------------------------------------------ cuentas
  function signedIn(p, token) {
    goOffline();
    socket.data.pid = p.id;
    socket.data.guest = null;
    if (!online.has(p.id)) online.set(p.id, new Set());
    online.get(p.id).add(socket.id);
    if (token) socket.emit('token', token);
    sendProfile();
    sendFriends(p.id);
    touch(p.id);
  }

  function goOffline() {
    const pid = socket.data.pid;
    if (!pid) return;
    const set = online.get(pid);
    if (set) {
      set.delete(socket.id);
      if (!set.size) {
        online.delete(pid);
        const p = Profiles.byId(pid);
        if (p) { p.lastSeen = Date.now(); Profiles.save(); }
      }
    }
    touch(pid);
  }

  socket.on('auth', ({ token } = {}) => {
    const r = Profiles.resolveToken(token);
    if (r.profile) return signedIn(r.profile);
    socket.data.pid = null;
    socket.data.guest = r.guest ? r.guest.id : null;
    socket.emit('needAuth', r.guest ? { legacy: true, name: r.guest.name } : {});
  });

  const tooFast = () => {
    const now = Date.now();
    if (socket.data.lastAuth && now - socket.data.lastAuth < 500) return true;
    socket.data.lastAuth = now;
    return false;
  };

  socket.on('register', async ({ username, password } = {}) => {
    if (tooFast()) return socket.emit('authError', 'Espera un momento…');
    if (socket.data.pid) return;
    const guest = socket.data.guest ? Profiles.get(socket.data.guest) : null;
    const r = await Profiles.register({ username, password, guest });
    if (r.error) return socket.emit('authError', r.error);
    signedIn(r.profile, r.token);
    socket.emit('recoveryCode', { code: r.recoveryCode, reason: 'register' });
  });

  socket.on('resetPassword', async ({ username, code, password } = {}) => {
    if (tooFast()) return socket.emit('authError', 'Espera un momento…');
    const r = await Profiles.resetPassword({ username, code, password });
    if (r.error) return socket.emit('authError', r.error);
    signedIn(r.profile, r.token);
    socket.emit('recoveryCode', { code: r.recoveryCode, reason: 'reset' });
  });

  socket.on('newRecoveryCode', async ({ password } = {}) => {
    const p = prof();
    if (!p) return;
    if (tooFast()) return err('Espera un momento…');
    const r = await Profiles.regenerateRecovery(p, { password });
    if (r.error) return err(r.error);
    sendProfile();
    socket.emit('recoveryCode', { code: r.recoveryCode, reason: 'new' });
  });

  socket.on('login', async ({ username, password } = {}) => {
    if (tooFast()) return socket.emit('authError', 'Espera un momento…');
    const r = await Profiles.login({ username, password });
    if (r.error) return socket.emit('authError', r.error);
    signedIn(r.profile, r.token);
  });

  socket.on('logout', ({ token } = {}) => {
    leave();
    Profiles.logout(token);
    goOffline();
    socket.data.pid = null;
    socket.emit('needAuth', {});
  });

  socket.on('changePassword', async (args = {}) => {
    const p = prof();
    if (!p) return;
    const r = await Profiles.changePassword(p, args);
    if (r.error) return err(r.error);
    socket.emit('toast', 'Contraseña cambiada.');
  });

  socket.on('viewProfile', ({ name } = {}) => {
    if (!prof()) return;
    const c = Profiles.findCardByName(name);
    if (!c) return err('Ese jugador no tiene perfil público.');
    socket.emit('profileCard', c);
  });

  socket.on('profileAction', ({ action, args } = {}) => {
    const p = prof();
    if (!p) return err('Perfil no cargado.');
    const res = Profiles.act(p, String(action), args);
    if (res.error) return err(res.error);
    sendProfile();
    if (res.rewards) socket.emit('rewards', res.rewards);
    // Si cambia el luchador o el nombre estando en una sala privada, actualizarla.
    const room = getRoom();
    if (['setUsername', 'customize'].includes(action)) touch(p.id);
    if (room && !room.game && !room.public && ['select', 'setUsername', 'customize'].includes(action)) {
      const m = room.members.find((x) => x.id === socket.id);
      if (m) { refreshMember(m); broadcastRoom(room); }
    }
  });

  function joinRoom(room) {
    const p = prof();
    room.members.push(memberFromProfile(p, socket.id, pickTeam(room)));
    socket.join(room.code);
    socket.data.room = room.code;
    if (!room.public) socket.emit('joined', { code: room.code, you: socket.id });
    broadcastRoom(room);
    touchRoom(room);
  }

  function leave() {
    const room = getRoom();
    if (!room) return;
    room.members = room.members.filter((m) => m.id !== socket.id);
    socket.leave(room.code);
    socket.data.room = null;
    touch(socket.data.pid);
    touchRoom(room);
    if (room.game) room.game.removePlayer(socket.id);
    const humans = room.members.filter((m) => !m.isBot);
    if (!humans.length) {
      room.game = null;
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === socket.id) room.hostId = humans[0].id;
    broadcastRoom(room);
  }

  socket.on('leaveRoom', leave);
  socket.on('disconnect', () => { leave(); goOffline(); });

  // ------------------------------------------------------------ amigos
  const friendAct = (fn) => ({ name } = {}) => {
    const p = prof();
    if (!p) return;
    const r = fn(p, String(name || ''));
    if (r.error) return err(r.error);
    if (r.msg) socket.emit('toast', r.msg);
    sendFriends(p.id);
    for (const pid of r.notify || []) sendFriends(pid);
    if (r.requestTo) emitToPid(r.requestTo, 'toast', `👋 ${p.name} quiere ser tu amigo.`);
  };
  socket.on('friends:get', () => { const p = prof(); if (p) sendFriends(p.id); });
  socket.on('friends:add', friendAct(Friends.request));
  socket.on('friends:accept', friendAct(Friends.accept));
  socket.on('friends:decline', friendAct(Friends.decline));
  socket.on('friends:remove', friendAct(Friends.remove));

  const friendByName = (name) => {
    const p = prof();
    const tid = Profiles.idByName(name);
    const t = tid && Profiles.byId(tid);
    if (!p || !t || !Friends.areFriends(p, t)) return null;
    return t;
  };

  socket.on('friends:invite', ({ name } = {}) => {
    const p = prof();
    const t = friendByName(name);
    if (!t) return err('Solo puedes invitar a tus amigos.');
    const room = getRoom();
    if (!room || room.public) return err('Primero crea una sala privada.');
    if (!online.has(t.id)) return err(`${t.name} no está conectado.`);
    const now = Date.now();
    socket.data.invites = socket.data.invites || {};
    if (socket.data.invites[t.id] && now - socket.data.invites[t.id] < 5000) return err('Ya le has invitado, espera un poco.');
    socket.data.invites[t.id] = now;
    emitToPid(t.id, 'invite', { from: p.name, look: Profiles.looks(p), code: room.code, mode: room.mode });
    socket.emit('toast', `Invitación enviada a ${t.name}.`);
  });

  socket.on('friends:join', ({ name } = {}) => {
    const t = friendByName(name);
    if (!t) return err('Solo puedes unirte a salas de tus amigos.');
    const pr = presence(t.id);
    if (pr.status !== 'sala') return err(pr.status === 'jugando' ? `${t.name} está en mitad de una partida.` : `${t.name} no está en una sala privada.`);
    joinByCode(pr.code);
  });

  // ------------------------------------------------------------ partida rápida
  socket.on('quickPlay', ({ mode } = {}) => {
    if (!prof()) return err('Perfil no cargado.');
    if (!MODES[mode]) return;
    leave();
    let room = [...rooms.values()].find((r) => r.public && !r.game && r.mode === mode && r.members.length < roomCapacity(r));
    if (!room) {
      room = { code: makeCode(), public: true, hostId: null, mode, map: pick(mapIds), members: [], game: null, botN: 0, startAt: Date.now() + QUEUE_WAIT_MS };
      rooms.set(room.code, room);
    } else {
      room.startAt = Math.max(room.startAt, Date.now() + 2500);
    }
    joinRoom(room);
  });

  // ------------------------------------------------------------ salas privadas
  socket.on('createRoom', () => {
    if (!prof()) return err('Perfil no cargado.');
    leave();
    const room = { code: makeCode(), hostId: socket.id, mode: 'gems', map: 'claro', members: [], game: null, botN: 0 };
    rooms.set(room.code, room);
    joinRoom(room);
  });

  socket.on('joinRoom', ({ code } = {}) => joinByCode(code));
  function joinByCode(code) {
    if (!prof()) return err('Perfil no cargado.');
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room || room.public) return err('No existe ninguna sala con ese código.');
    if (room.members.some((m) => m.id === socket.id)) return;
    if (room.members.length >= MAX_PLAYERS) {
      // Si la sala está llena, un amigo sustituye a un bot.
      const botIdx = room.members.map((m) => m.isBot).lastIndexOf(true);
      if (botIdx < 0 || room.game) return err('La sala está llena.');
      room.members.splice(botIdx, 1);
    }
    leave();
    joinRoom(room);
  }

  socket.on('setTeam', ({ team } = {}) => {
    const room = getRoom();
    if (!room || room.public || room.game || (team !== 0 && team !== 1)) return;
    const me = room.members.find((m) => m.id === socket.id);
    if (!me || me.team === team) return;
    if (teamCount(room, team) >= MAX_TEAM) return err('Ese equipo está completo.');
    me.team = team;
    broadcastRoom(room);
  });

  socket.on('setMode', ({ mode } = {}) => {
    const room = hostRoom();
    if (!room || !MODES[mode]) return;
    room.mode = mode;
    broadcastRoom(room);
  });

  socket.on('setMap', ({ map } = {}) => {
    const room = hostRoom();
    if (!room || !MAPS[map]) return;
    room.map = map;
    broadcastRoom(room);
  });

  socket.on('addBot', ({ team, difficulty } = {}) => {
    const room = hostRoom();
    if (!room) return;
    if (room.members.length >= MAX_PLAYERS) return err(`Máximo ${MAX_PLAYERS} jugadores por sala.`);
    if (team !== 0 && team !== 1) team = pickTeam(room);
    if (MODES[room.mode].team && teamCount(room, team) >= MAX_TEAM) return err('Ese equipo está completo.');
    room.members.push(makeBot(room, team, DIFFICULTIES.includes(difficulty) ? difficulty : 'normal'));
    broadcastRoom(room);
  });

  socket.on('removeBot', ({ id } = {}) => {
    const room = hostRoom();
    if (!room) return;
    room.members = room.members.filter((m) => !(m.isBot && m.id === id));
    broadcastRoom(room);
  });

  socket.on('editBot', ({ id, brawler, difficulty, team } = {}) => {
    const room = hostRoom();
    if (!room) return;
    const bot = room.members.find((m) => m.isBot && m.id === id);
    if (!bot) return;
    if (BRAWLERS[brawler]) { bot.brawler = brawler; bot.skin = 'default'; }
    if (DIFFICULTIES.includes(difficulty)) { bot.difficulty = difficulty; bot.level = BOT_LEVEL[difficulty]; }
    if ((team === 0 || team === 1) && team !== bot.team) {
      if (teamCount(room, team) >= MAX_TEAM) return err('Ese equipo está completo.');
      bot.team = team;
    }
    broadcastRoom(room);
  });

  socket.on('startGame', () => {
    const room = hostRoom();
    if (!room) return;
    const mode = MODES[room.mode];
    if (mode.team) {
      const a = teamCount(room, 0), b = teamCount(room, 1);
      if (!a || !b) return err('Cada equipo necesita al menos un jugador. ¡Añade bots!');
      if (a > MAX_TEAM || b > MAX_TEAM) return err(`Máximo ${MAX_TEAM} por equipo.`);
    } else if (room.members.length < 2) {
      return err('Se necesitan al menos 2 jugadores. ¡Añade bots!');
    }
    startRoomGame(room);
  });

  socket.on('input', (inp) => {
    const room = getRoom();
    if (room && room.game) room.game.setInput(socket.id, inp);
  });
});

// Arranque de partidas públicas: cuando se llenan o se acaba la espera, se rellenan con bots.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.public || room.game) continue;
    const cap = roomCapacity(room);
    if (room.members.length < cap && now < room.startAt) { broadcastRoom(room); continue; }
    const humans = room.members.filter((m) => !m.isBot);
    const avgTrophies = humans.reduce((a, m) => a + (m.trophies || 0), 0) / Math.max(1, humans.length);
    const avgLevel = Math.round(humans.reduce((a, m) => a + (m.level || 1), 0) / Math.max(1, humans.length));
    const diff = avgTrophies < 60 ? 'facil' : avgTrophies < 300 ? 'normal' : 'dificil';
    while (room.members.length < cap) {
      const team = MODES[room.mode].team ? pickTeam(room) : 0;
      room.members.push(makeBot(room, team, diff, Math.max(1, Math.min(LEVELS.max, avgLevel + (Math.random() < 0.5 ? 0 : 1)))));
    }
    startRoomGame(room);
  }
}, 500);

// Bucle de simulación a 30 ticks/s.
setInterval(() => {
  for (const room of rooms.values()) {
    const g = room.game;
    if (!g) continue;
    g.update();
    if (room.game !== g) continue;
    for (const m of room.members) {
      if (m.isBot) continue;
      const snap = g.snapshotFor(m.id);
      const s = io.sockets.sockets.get(m.id);
      if (snap && s) s.volatile.emit('state', snap);
    }
  }
}, 1000 / 30);

// Al apagar (p. ej. Render al desplegar una versión nueva) se guarda todo antes de salir.
function shutdown(sig) {
  console.log(`${sig} recibido: guardando perfiles y cerrando…`);
  Profiles.flush();
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  console.log(`🌲 Forest War escuchando en http://localhost:${PORT}`);
});
