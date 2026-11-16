const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Game } = require('./game/game');
const { BRAWLERS, MODES, MAPS, BOT_NAMES } = require('./game/constants');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const MAX_TEAM = 4;
const DIFFICULTIES = ['facil', 'normal', 'dificil'];

const app = express();
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

const cleanName = (n) => String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 14) || 'Jugador';
const brawlerIds = Object.keys(BRAWLERS);
const randomBrawler = () => brawlerIds[Math.floor(Math.random() * brawlerIds.length)];
const teamCount = (room, t) => room.members.filter((m) => m.team === t).length;
const pickTeam = (room) => (teamCount(room, 0) <= teamCount(room, 1) ? 0 : 1);

function publicRoom(room) {
  return {
    code: room.code, hostId: room.hostId, mode: room.mode, map: room.map, inGame: !!room.game,
    members: room.members.map(({ id, name, brawler, team, isBot, difficulty }) => ({ id, name, brawler, team, isBot, difficulty })),
  };
}
const broadcastRoom = (room) => io.to(room.code).emit('roomState', publicRoom(room));

io.on('connection', (socket) => {
  socket.emit('hello', {
    brawlers: BRAWLERS,
    modes: MODES,
    maps: Object.fromEntries(Object.entries(MAPS).map(([k, v]) => [k, { name: v.name }])),
  });

  const getRoom = () => rooms.get(socket.data.room);
  const hostRoom = () => {
    const room = getRoom();
    return room && room.hostId === socket.id && !room.game ? room : null;
  };
  const err = (msg) => socket.emit('errorMsg', msg);

  function joinRoom(room, name) {
    room.members.push({ id: socket.id, name: cleanName(name), brawler: 'pinon', team: pickTeam(room), isBot: false });
    socket.join(room.code);
    socket.data.room = room.code;
    socket.emit('joined', { code: room.code, you: socket.id });
    broadcastRoom(room);
  }

  function leave() {
    const room = getRoom();
    if (!room) return;
    room.members = room.members.filter((m) => m.id !== socket.id);
    socket.leave(room.code);
    socket.data.room = null;
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

  socket.on('createRoom', ({ name } = {}) => {
    leave();
    const room = { code: makeCode(), hostId: socket.id, mode: 'gems', map: 'claro', members: [], game: null, botN: 0 };
    rooms.set(room.code, room);
    joinRoom(room, name);
  });

  socket.on('joinRoom', ({ code, name } = {}) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return err('No existe ninguna sala con ese código.');
    if (room.members.some((m) => m.id === socket.id)) return;
    if (room.members.length >= MAX_PLAYERS) {
      // Si la sala está llena de bots, un amigo sustituye a un bot.
      const botIdx = room.members.map((m) => m.isBot).lastIndexOf(true);
      if (botIdx < 0 || room.game) return err('La sala está llena.');
      room.members.splice(botIdx, 1);
    }
    leave();
    joinRoom(room, name);
  });

  socket.on('leaveRoom', leave);
  socket.on('disconnect', leave);

  socket.on('setBrawler', ({ brawler } = {}) => {
    const room = getRoom();
    if (!room || room.game || !BRAWLERS[brawler]) return;
    const me = room.members.find((m) => m.id === socket.id);
    if (me) me.brawler = brawler;
    broadcastRoom(room);
  });

  socket.on('setTeam', ({ team } = {}) => {
    const room = getRoom();
    if (!room || room.game || (team !== 0 && team !== 1)) return;
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
    const used = new Set(room.members.map((m) => m.name));
    const free = BOT_NAMES.filter((n) => !used.has('🤖 ' + n));
    const name = '🤖 ' + (free.length ? free[Math.floor(Math.random() * free.length)] : 'Bot');
    room.members.push({
      id: 'bot-' + room.code + '-' + ++room.botN, name, brawler: randomBrawler(), team, isBot: true,
      difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'normal',
    });
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
    if (BRAWLERS[brawler]) bot.brawler = brawler;
    if (DIFFICULTIES.includes(difficulty)) bot.difficulty = difficulty;
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
    const game = new Game({
      mode: room.mode, mapId: room.map, members: room.members,
      onEnd: (results) => {
        if (room.game !== game) return;
        room.game = null;
        io.to(room.code).emit('gameOver', results);
        broadcastRoom(room);
      },
    });
    room.game = game;
    io.to(room.code).emit('gameStart', game.startInfo());
    broadcastRoom(room);
  });

  socket.on('input', (inp) => {
    const room = getRoom();
    if (room && room.game) room.game.setInput(socket.id, inp);
  });
});

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

server.listen(PORT, () => {
  console.log(`🌲 Forest War escuchando en http://localhost:${PORT}`);
});
