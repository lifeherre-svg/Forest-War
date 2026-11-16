// Amigos: solicitudes, lista y eliminación. Se guardan como ids de perfil
// (nunca se envían al cliente; el cliente solo ve nombres de usuario).
const Profiles = require('./profiles');

const MAX_FRIENDS = 100;
const MAX_PENDING = 50;

function ensure(p) {
  if (!p.friends) p.friends = [];
  if (!p.reqIn) p.reqIn = [];
  if (!p.reqOut) p.reqOut = [];
  return p;
}
const without = (arr, id) => arr.filter((x) => x !== id);

function befriend(a, b) {
  ensure(a); ensure(b);
  a.reqIn = without(a.reqIn, b.id); a.reqOut = without(a.reqOut, b.id);
  b.reqIn = without(b.reqIn, a.id); b.reqOut = without(b.reqOut, a.id);
  if (!a.friends.includes(b.id)) a.friends.push(b.id);
  if (!b.friends.includes(a.id)) b.friends.push(a.id);
}

// Devuelve { error } o { ok, notify: [pid...], msg }
function request(me, name) {
  ensure(me);
  const tid = Profiles.idByName(name);
  const t = tid && Profiles.byId(tid);
  if (!t || !t.auth) return { error: 'No existe ningún jugador con ese nombre.' };
  if (t.id === me.id) return { error: '¡No puedes añadirte a ti mismo!' };
  ensure(t);
  if (me.friends.includes(t.id)) return { error: `${t.name} ya es tu amigo.` };
  if (me.friends.length >= MAX_FRIENDS) return { error: `Máximo ${MAX_FRIENDS} amigos.` };
  if (me.reqIn.includes(t.id)) {
    // Ya te lo había pedido: se aceptan los dos.
    befriend(me, t);
    Profiles.save();
    return { ok: true, notify: [t.id], msg: `¡Ahora ${t.name} y tú sois amigos!` };
  }
  if (me.reqOut.includes(t.id)) return { error: 'Ya le enviaste una solicitud.' };
  if (t.reqIn.length >= MAX_PENDING) return { error: 'Ese jugador tiene demasiadas solicitudes pendientes.' };
  me.reqOut.push(t.id);
  t.reqIn.push(me.id);
  Profiles.save();
  return { ok: true, notify: [t.id], msg: `Solicitud enviada a ${t.name}.`, requestTo: t.id };
}

function accept(me, name) {
  ensure(me);
  const tid = Profiles.idByName(name);
  const t = tid && Profiles.byId(tid);
  if (!t || !me.reqIn.includes(t.id)) return { error: 'Esa solicitud ya no existe.' };
  if (me.friends.length >= MAX_FRIENDS) return { error: `Máximo ${MAX_FRIENDS} amigos.` };
  befriend(me, t);
  Profiles.save();
  return { ok: true, notify: [t.id], msg: `¡Ahora ${t.name} y tú sois amigos!` };
}

function decline(me, name) {
  ensure(me);
  const tid = Profiles.idByName(name);
  const t = tid && Profiles.byId(tid);
  if (!t) return { error: 'Esa solicitud ya no existe.' };
  ensure(t);
  me.reqIn = without(me.reqIn, t.id); t.reqOut = without(t.reqOut, me.id);
  me.reqOut = without(me.reqOut, t.id); t.reqIn = without(t.reqIn, me.id);
  Profiles.save();
  return { ok: true, notify: [t.id] };
}

function remove(me, name) {
  ensure(me);
  const tid = Profiles.idByName(name);
  const t = tid && Profiles.byId(tid);
  if (!t || !me.friends.includes(t.id)) return { error: 'No es tu amigo.' };
  ensure(t);
  me.friends = without(me.friends, t.id);
  t.friends = without(t.friends, me.id);
  Profiles.save();
  return { ok: true, notify: [t.id], msg: `${t.name} ya no está en tu lista de amigos.` };
}

const areFriends = (a, b) => ensure(a).friends.includes(b.id);

// Lista para el cliente. presence(pid) -> { status, code, since }
function listFor(me, presence) {
  ensure(me);
  const entry = (pid) => {
    const p = Profiles.byId(pid);
    if (!p) return null;
    return { name: p.name, look: Profiles.looks(p), trophies: Profiles.totalTrophies(p), ...presence(pid) };
  };
  const order = { sala: 0, online: 1, buscando: 2, jugando: 3, offline: 4 };
  const friends = me.friends.map(entry).filter(Boolean).sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  return {
    friends,
    incoming: me.reqIn.map(entry).filter(Boolean),
    outgoing: me.reqOut.map(entry).filter(Boolean).map((x) => ({ name: x.name, look: x.look })),
  };
}

module.exports = { request, accept, decline, remove, listFor, areFriends, ensure };
