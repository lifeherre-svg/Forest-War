# 🌲 Forest War

Juego de arena multijugador estilo *brawler* para el navegador (PC y móvil): partidas rápidas en vista cenital 2.5D, personajes cartoon, súpers, arbustos para esconderse, progresión, tienda y **Pase del Bosque**.

## Arrancar

```bash
npm install
npm start          # http://localhost:3000
```

- **Misma wifi:** tus amigos abren `http://IP-DE-TU-PC:3000`.
- **Por internet:** súbelo a Render, Railway o Fly.io (app Node normal, usa `PORT`), o abre tu PC con `ngrok http 3000`.
- Los perfiles se guardan en `data/profiles.json` (cambia la carpeta con `DATA_DIR`). En hostings sin disco persistente, monta un volumen ahí.

## Qué incluye

- **Partida rápida** en 4 modos; si no hay bastante gente, se completa con bots de dificultad acorde a tus trofeos.
  - 💎 **Cristales** (3v3): junta 10 y aguanta 15 s.
  - ⚔️ **Duelo de Equipos** (3v3): primero a 15 derribos.
  - ☠️ **Supervivencia** (6 jugadores): sin reapariciones, la niebla tóxica se cierra.
  - 🏆 **Todos contra Todos**: primero a 8 derribos.
- **Salas privadas** con código o enlace: el anfitrión elige modo y mapa y **añade bots** (Fácil/Normal/Difícil) a cualquier equipo, les cambia el luchador o el equipo, o los quita. Dan XP y monedas, pero no trofeos.
- **7 luchadores**: Piñón (ardilla), Brutus (oso), Ulma (búho), Champi (seta), Lumi (luciérnaga sanadora), Rayo (zorro) y Tortu (tortuga), cada uno con su súper y aspectos.
- **Progresión**: trofeos por luchador, niveles de poder 1–7 con monedas, regalo diario y tienda de luchadores y aspectos.
- **Pase del Bosque** (30 niveles, vía gratis + premium): la vía **premium es gratis durante la primera semana** desde que empiezas a jugar. Lo que reclames esa semana es tuyo para siempre; después, la vía premium se desbloquea con 120 esmeraldas (moneda del juego, no hay pagos reales). Ajusta los días con `PASS_TRIAL_DAYS`.
- 3 mapas, sonidos sintetizados (botón 🔊 para silenciar).

### Controles

| | PC | Móvil |
|---|---|---|
| Moverse | WASD / flechas | Joystick izquierdo |
| Disparar | Apunta con el ratón + clic izquierdo | Arrastra el joystick derecho y suelta (un toque = apuntado automático) |
| Súper | `E`, espacio o clic derecho | Botón ★ |

## Estructura

- `server.js`: Express + Socket.IO, perfiles, emparejamiento, salas privadas, bucle a 30 ticks/s.
- `game/game.js`: simulación autoritativa. `game/bot.js`: IA. `game/map.js`: colisiones y caminos.
- `game/constants.js`: luchadores, aspectos, modos, mapas y niveles. `game/pass.js`: recompensas del pase. `game/profiles.js`: guardado y recompensas.
- `public/js/art.js`: todo el arte vectorial (personajes y escenario). `game.js`: render de partida y controles. `ui.js`: menús. `audio.js`: sonidos.
