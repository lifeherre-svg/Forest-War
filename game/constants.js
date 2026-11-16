// Datos del juego: luchadores, modos y mapas.
const TILE = 50;

const BRAWLERS = {
  pinon: {
    name: 'Piñón', emoji: '🐿️', color: '#e8892c',
    desc: 'Ardilla veloz. Dispara un abanico de bellotas.',
    hp: 3200, speed: 265, radius: 22, reload: 1.25, superCost: 3800,
    attack: { type: 'spread', count: 5, spread: 0.42, dmg: 300, range: 400, speed: 950, bulletR: 7, cooldown: 0.35 },
    superName: 'Tormenta de Bellotas',
    super: { type: 'ring', count: 14, dmg: 420, range: 330, speed: 800, bulletR: 9 },
  },
  brutus: {
    name: 'Brutus', emoji: '🐻', color: '#8a5a3b',
    desc: 'Oso tanque. Zarpazos brutales a corta distancia.',
    hp: 6000, speed: 225, radius: 26, reload: 1.5, superCost: 3600,
    attack: { type: 'spread', count: 3, spread: 0.6, dmg: 520, range: 190, speed: 850, bulletR: 12, cooldown: 0.4 },
    superName: 'Embestida',
    super: { type: 'dash', dist: 340, speed: 1100, dmg: 1400, knock: 240, range: 340 },
  },
  ulma: {
    name: 'Ulma', emoji: '🦉', color: '#9aa3b5',
    desc: 'Búho francotirador. Plumas de largo alcance.',
    hp: 2700, speed: 245, radius: 22, reload: 1.9, superCost: 4000,
    attack: { type: 'single', dmg: 1250, range: 720, speed: 1500, bulletR: 8, cooldown: 0.5 },
    superName: 'Pluma Perforante',
    super: { type: 'pierce', dmg: 2300, range: 950, speed: 1700, bulletR: 14 },
  },
  champi: {
    name: 'Champi', emoji: '🍄', color: '#d8433b',
    desc: 'Seta lanzadora. Sus esporas vuelan por encima de los muros.',
    hp: 3000, speed: 235, radius: 22, reload: 1.7, superCost: 3800,
    attack: { type: 'lob', dmg: 1150, range: 470, radius: 75, flight: 0.7, cooldown: 0.55 },
    superName: 'Nube Tóxica',
    super: { type: 'cloud', range: 520, radius: 150, dps: 650, duration: 4, flight: 0.8 },
  },
};

const MODES = {
  gems: { name: 'Cristales', team: true, duration: 180, respawn: 4, desc: 'Consigue 10 cristales en tu equipo y aguanta 15 segundos.' },
  tdm: { name: 'Duelo de Equipos', team: true, duration: 180, respawn: 3, target: 15, desc: 'El primer equipo en llegar a 15 derribos gana.' },
  ffa: { name: 'Todos contra Todos', team: false, duration: 180, respawn: 3, target: 8, desc: 'El primero en llegar a 8 derribos gana.' },
};

// Cada mapa define solo la mitad izquierda (16 columnas); la derecha se genera
// en espejo para que sea justo. '#' muro, '~' agua, '*' arbusto,
// 'A' aparición del equipo azul (en el espejo pasa a 'B'), 'S' aparición en Todos contra Todos.
const MAPS = {
  claro: {
    name: 'Claro del Bosque',
    half: [
      '################',
      '#......**......',
      '#.A....**...#..',
      '#.......S...#..',
      '#..###......*..',
      '#..#....~~..*..',
      '#......~~~.....',
      '#**...........#',
      '#**...##.......',
      '#.....##...**..',
      '#.S.........**.',
      '#A......*......',
      '#A......*......',
      '#.S.........**.',
      '#.....##...**..',
      '#**...##.......',
      '#**...........#',
      '#......~~~.....',
      '#..#....~~..*..',
      '#..###......*..',
      '#.......S...#..',
      '#.A....**...#..',
      '#......**......',
      '################',
    ],
  },
  raices: {
    name: 'Raíces Retorcidas',
    half: [
      '################',
      '#A..*****......',
      '#A..*****..#...',
      '#A.....##..#.S.',
      '#......##......',
      '#..~~......**..',
      '#..~~..S...**..',
      '#**....###.....',
      '#**......#.....',
      '#....**..#..~~.',
      '#.S..**.....~~.',
      '#.......*......',
      '#.......*......',
      '#.S..**.....~~.',
      '#....**..#..~~.',
      '#**......#.....',
      '#**....###.....',
      '#..~~..S...**..',
      '#..~~......**..',
      '#......##......',
      '#A.....##..#.S.',
      '#A..*****..#...',
      '#A..*****......',
      '################',
    ],
  },
};

const BOT_NAMES = ['Musgo', 'Ramita', 'Bellota', 'Helecho', 'Corteza', 'Liquen', 'Trufa', 'Avellana', 'Ortiga', 'Piña', 'Roble', 'Sauce'];

module.exports = { TILE, BRAWLERS, MODES, MAPS, BOT_NAMES };
