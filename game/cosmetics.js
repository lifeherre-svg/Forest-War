// Opciones de personalización del perfil y cómo se desbloquean.
// req: { t: 'trophies' | 'wins' | 'games' | 'kills' | 'brawlers' | 'passTier', n }
const NAME_COLORS = {
  blanco: { name: 'Blanco', color: '#ffffff' },
  amarillo: { name: 'Amarillo', color: '#ffd23d' },
  verde: { name: 'Verde', color: '#7dff7a' },
  celeste: { name: 'Celeste', color: '#8fd3ff' },
  rosa: { name: 'Rosa', color: '#ff8ad8', req: { t: 'trophies', n: 100 } },
  naranja: { name: 'Naranja', color: '#ff9d2e', req: { t: 'wins', n: 10 } },
  morado: { name: 'Morado', color: '#c49bff', req: { t: 'trophies', n: 400 } },
  rojo: { name: 'Rojo fuego', color: '#ff5a4e', req: { t: 'kills', n: 100 } },
  oro: { name: 'Oro', color: '#ffe066', req: { t: 'trophies', n: 800 } },
};

const TITLES = {
  novato: { name: 'Novato del Bosque' },
  explorador: { name: 'Explorador', req: { t: 'games', n: 10 } },
  cazador: { name: 'Cazador Certero', req: { t: 'kills', n: 50 } },
  guardian: { name: 'Guardián del Claro', req: { t: 'wins', n: 25 } },
  coleccionista: { name: 'Coleccionista', req: { t: 'brawlers', n: 7 } },
  veterano: { name: 'Veterano', req: { t: 'games', n: 100 } },
  maestro: { name: 'Maestro del Pase', req: { t: 'passTier', n: 30 } },
  leyenda: { name: 'Leyenda del Bosque', req: { t: 'trophies', n: 1000 } },
};

const BANNERS = {
  azul: { name: 'Cielo', bg: 'linear-gradient(135deg,#5d9bff,#2557d6)' },
  verde: { name: 'Bosque', bg: 'linear-gradient(135deg,#7fd04f,#2f8a3a)' },
  rojo: { name: 'Fuego', bg: 'linear-gradient(135deg,#ff8a5e,#d23b30)' },
  morado: { name: 'Magia', bg: 'linear-gradient(135deg,#c49bff,#6a2fe0)', req: { t: 'trophies', n: 150 } },
  noche: { name: 'Noche', bg: 'linear-gradient(135deg,#3b3f6b,#141632)', req: { t: 'wins', n: 50 } },
  dorado: { name: 'Dorado', bg: 'linear-gradient(135deg,#ffe36b,#e38f00)', req: { t: 'trophies', n: 500 } },
};

const REQ_TEXT = {
  trophies: (n) => `${n} trofeos`,
  wins: (n) => `${n} victorias`,
  games: (n) => `${n} partidas`,
  kills: (n) => `${n} derribos`,
  brawlers: (n) => `${n} luchadores`,
  passTier: (n) => `nivel ${n} del pase`,
};

module.exports = { NAME_COLORS, TITLES, BANNERS, REQ_TEXT };
