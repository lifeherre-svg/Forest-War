// Pase de batalla: 30 niveles con una vía gratuita y otra premium.
// La vía premium es GRATIS durante los primeros TRIAL_DAYS días desde que el
// jugador empieza a jugar. Después se puede desbloquear con esmeraldas.
const TIERS = 30;
const XP_PER_TIER = 120;
const TRIAL_DAYS = Number(process.env.PASS_TRIAL_DAYS || 7);
const PREMIUM_PRICE = 120;

const c = (n) => ({ t: 'coins', n });
const e = (n) => ({ t: 'emeralds', n });
const b = (id) => ({ t: 'brawler', id });
const s = (b, s) => ({ t: 'skin', b, s });

const FREE = [
  c(40), e(5), b('ulma'), c(60), e(10), c(80), s('pinon', 'nieve'), b('champi'), c(100), e(15),
  c(120), s('brutus', 'polar'), c(150), b('lumi'), e(20), c(150), s('ulma', 'nevada'), c(200), e(20), b('rayo'),
  c(200), s('champi', 'azul'), c(250), e(25), c(250), s('rayo', 'artico'), c(300), e(30), c(300), b('tortu'),
];
const PREMIUM = [
  s('pinon', 'fuego'), c(100), e(15), b('rayo'), c(150), s('brutus', 'panda'), e(20), c(200), s('lumi', 'rosa'), b('tortu'),
  c(200), e(25), s('ulma', 'nocturna'), c(250), s('champi', 'dorada'), e(30), c(300), s('rayo', 'sombra'), c(300), e(40),
  s('tortu', 'roca'), c(350), e(40), c(400), c(400), e(50), c(500), e(60), c(600), e(100),
];

const PASS = {
  season: 1,
  name: 'Temporada 1: Despertar del Bosque',
  tiers: TIERS, xpPerTier: XP_PER_TIER, trialDays: TRIAL_DAYS, premiumPrice: PREMIUM_PRICE,
  free: FREE, premium: PREMIUM,
};

module.exports = { PASS };
