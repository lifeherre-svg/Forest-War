// Datos del juego: luchadores, aspectos, modos, mapas y progresión.
const TILE = 50;

const BRAWLERS = {
  pinon: {
    name: 'Piñón', animal: 'Ardilla', rarity: 'Inicial', price: 0,
    desc: 'Ardilla veloz. Dispara un abanico de bellotas con su tirachinas.',
    hp: 3200, speed: 265, radius: 22, reload: 1.25, superCost: 3800,
    attack: { type: 'spread', name: 'Bellotazo', count: 5, spread: 0.42, dmg: 300, range: 400, speed: 950, bulletR: 7, cooldown: 0.35 },
    superName: 'Tormenta de Bellotas', superDesc: 'Lanza bellotas en todas direcciones.',
    super: { type: 'ring', count: 14, dmg: 420, range: 330, speed: 800, bulletR: 9 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#e8892c', light: '#ffd9a8', dark: '#a65512', accent: '#7b4a1e' } },
      nieve: { name: 'Ardilla de Nieve', price: 40, pal: { main: '#dfe5ec', light: '#ffffff', dark: '#8f98a6', accent: '#5b6472' } },
      fuego: { name: 'Piñón Fuego', pass: true, pal: { main: '#e0402e', light: '#ffd36b', dark: '#8f1d12', accent: '#3a1a10' } },
    },
  },
  brutus: {
    name: 'Brutus', animal: 'Oso', rarity: 'Inicial', price: 0,
    desc: 'Oso tanque. Zarpazos brutales a corta distancia.',
    hp: 6000, speed: 225, radius: 26, reload: 1.5, superCost: 3600,
    attack: { type: 'spread', name: 'Zarpazo', count: 3, spread: 0.6, dmg: 520, range: 190, speed: 850, bulletR: 12, cooldown: 0.4 },
    superName: 'Embestida', superDesc: 'Carga hacia delante, golpea y empuja a los enemigos.',
    super: { type: 'dash', dist: 340, speed: 1100, dmg: 1400, knock: 240, range: 340 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#8a5a3b', light: '#e0bc94', dark: '#5a3720', accent: '#2a1a10' } },
      polar: { name: 'Oso Polar', price: 50, pal: { main: '#eef4fa', light: '#ffffff', dark: '#a9bfd3', accent: '#3b4a5a' } },
      panda: { name: 'Panda Brutus', pass: true, pal: { main: '#f5f5f5', light: '#ffffff', dark: '#26262b', accent: '#111111' } },
    },
  },
  ulma: {
    name: 'Ulma', animal: 'Búho', rarity: 'Rara', price: 500,
    desc: 'Búho francotirador. Plumas afiladas de largo alcance.',
    hp: 2700, speed: 245, radius: 22, reload: 1.9, superCost: 4000,
    attack: { type: 'single', name: 'Pluma', dmg: 1250, range: 720, speed: 1500, bulletR: 8, cooldown: 0.5 },
    superName: 'Pluma Perforante', superDesc: 'Una pluma gigante que atraviesa enemigos.',
    super: { type: 'pierce', dmg: 2300, range: 950, speed: 1700, bulletR: 14 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#9aa3b5', light: '#e8ebf2', dark: '#646d80', accent: '#ffd23d' } },
      nevada: { name: 'Búho Nival', price: 50, pal: { main: '#f4f4f4', light: '#ffffff', dark: '#b9b9b9', accent: '#ffd23d' } },
      nocturna: { name: 'Ulma Nocturna', pass: true, pal: { main: '#3b3f6b', light: '#9f9fe6', dark: '#24264a', accent: '#ff6bd6' } },
    },
  },
  champi: {
    name: 'Champi', animal: 'Seta', rarity: 'Rara', price: 500,
    desc: 'Seta lanzadora. Sus esporas vuelan por encima de los muros.',
    hp: 3000, speed: 235, radius: 22, reload: 1.7, superCost: 3800,
    attack: { type: 'lob', name: 'Espora', dmg: 1150, range: 470, radius: 75, flight: 0.7, cooldown: 0.55 },
    superName: 'Nube Tóxica', superDesc: 'Una nube venenosa que daña durante 4 segundos.',
    super: { type: 'cloud', range: 520, radius: 150, dps: 650, duration: 4, flight: 0.8 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#e0443b', light: '#fff4e0', dark: '#8f2019', accent: '#f4e1c1' } },
      azul: { name: 'Seta Azul', price: 40, pal: { main: '#3b7bd8', light: '#e8f4ff', dark: '#1d3f80', accent: '#f4e1c1' } },
      dorada: { name: 'Champi Dorada', pass: true, pal: { main: '#ecb92c', light: '#fff7d6', dark: '#a87510', accent: '#f4e1c1' } },
    },
  },
  lumi: {
    name: 'Lumi', animal: 'Luciérnaga', rarity: 'Épica', price: 1200,
    desc: 'Luciérnaga sanadora. Lanza chispas y cura a su equipo.',
    hp: 2800, speed: 250, radius: 21, reload: 1.4, superCost: 3500,
    attack: { type: 'single', name: 'Chispa', dmg: 880, range: 560, speed: 1000, bulletR: 10, cooldown: 0.45 },
    superName: 'Aura Brillante', superDesc: 'Crea una zona que cura a los aliados durante 3,5 s.',
    super: { type: 'heal', radius: 165, hps: 950, duration: 3.5 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#3a3d5c', light: '#fff27a', dark: '#23253a', accent: '#9fe7ff' } },
      rosa: { name: 'Lumi Rosa', pass: true, pal: { main: '#5c3a54', light: '#ff9ce0', dark: '#3a2335', accent: '#ffd1f2' } },
    },
  },
  rayo: {
    name: 'Rayo', animal: 'Zorro', rarity: 'Épica', price: 1200,
    desc: 'Zorro ágil. Ráfagas de tres disparos y saltos relámpago.',
    hp: 3000, speed: 270, radius: 22, reload: 1.4, superCost: 3300,
    attack: { type: 'burst', name: 'Ráfaga', count: 3, interval: 0.09, dmg: 380, range: 520, speed: 1200, bulletR: 6, cooldown: 0.5 },
    superName: 'Salto Relámpago', superDesc: 'Salta muy rápido golpeando a quien atraviesa.',
    super: { type: 'dash', dist: 420, speed: 1500, dmg: 900, knock: 60, range: 420 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#e2622a', light: '#fff1e6', dark: '#8f3010', accent: '#2a1a10' } },
      artico: { name: 'Zorro Ártico', price: 60, pal: { main: '#e9eef5', light: '#ffffff', dark: '#9aa8ba', accent: '#2a3340' } },
      sombra: { name: 'Rayo Sombra', pass: true, pal: { main: '#3a3346', light: '#bda7ff', dark: '#1e1a26', accent: '#ff5a7a' } },
    },
  },
  tortu: {
    name: 'Tortu', animal: 'Tortuga', rarity: 'Mítica', price: 2000,
    desc: 'Tortuga acorazada. Sus caparazones atraviesan enemigos.',
    hp: 5200, speed: 215, radius: 25, reload: 1.6, superCost: 3600,
    attack: { type: 'single', name: 'Caparazón', pierce: true, dmg: 720, range: 460, speed: 800, bulletR: 13, cooldown: 0.5 },
    superName: 'Escudo Roble', superDesc: 'Reduce el daño recibido un 60% y corre más durante 4 s.',
    super: { type: 'shield', duration: 4, reduction: 0.6, speedMult: 1.25 },
    skins: {
      default: { name: 'Clásico', pal: { main: '#6bbf59', light: '#d6f0a8', dark: '#7a5a2e', accent: '#4a8f3a' } },
      roca: { name: 'Tortuga de Roca', pass: true, pal: { main: '#8d9aa3', light: '#dde3e8', dark: '#55606a', accent: '#6f7b84' } },
    },
  },
};

const MODES = {
  gems: { name: 'Cristales', icon: '💎', team: true, duration: 180, respawn: 4, teamSize: 3, desc: 'Consigue 10 cristales en tu equipo y aguanta 15 segundos.' },
  tdm: { name: 'Duelo de Equipos', icon: '⚔️', team: true, duration: 180, respawn: 3, target: 15, teamSize: 3, desc: 'El primer equipo en llegar a 15 derribos gana.' },
  survival: { name: 'Supervivencia', icon: '☠️', team: false, duration: 240, respawn: null, size: 6, desc: 'Sin reapariciones. La niebla tóxica se cierra: sé el último en pie.' },
  ffa: { name: 'Todos contra Todos', icon: '🏆', team: false, duration: 180, respawn: 3, target: 8, size: 6, desc: 'El primero en llegar a 8 derribos gana.' },
};

// Cada mapa define la mitad izquierda (16 columnas); la derecha se genera en espejo.
// '#' muro, '~' agua, '*' arbusto, 'A' aparición azul ('B' en el espejo), 'S' aparición individual.
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
  pantano: {
    name: 'Pantano Brumoso',
    half: [
      '################',
      '#.....~~~......',
      '#.A...~~~..**..',
      '#.....*....**..',
      '#..S..*..#.....',
      '#~~...*..#..S..',
      '#~~..........~~',
      '#.....##.....~~',
      '#.*...##..*....',
      '#.*.......*..#.',
      '#A....~~.....#.',
      '#.S...~~...*...',
      '#.....~~...*...',
      '#A....~~.....#.',
      '#.*.......*..#.',
      '#.*...##..*....',
      '#.....##.....~~',
      '#~~..........~~',
      '#~~...*..#..S..',
      '#..S..*..#.....',
      '#.....*....**..',
      '#.A...~~~..**..',
      '#.....~~~......',
      '################',
    ],
  },
};

const BOT_NAMES = ['Musgo', 'Ramita', 'Bellota', 'Helecho', 'Corteza', 'Liquen', 'Trufa', 'Avellana', 'Ortiga', 'Piña', 'Roble', 'Sauce', 'Brezo', 'Junco', 'Abeto', 'Mora'];

// Niveles de poder: coste en monedas para llegar a cada nivel y multiplicador de vida/daño.
const LEVELS = { max: 7, cost: [0, 0, 40, 90, 160, 260, 400, 600], mult: (lvl) => 1 + 0.08 * (lvl - 1) };
const BOT_LEVEL = { facil: 1, normal: 3, dificil: 6 };

module.exports = { TILE, BRAWLERS, MODES, MAPS, BOT_NAMES, LEVELS, BOT_LEVEL };
