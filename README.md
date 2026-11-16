# 🌲 Forest War

Juego **para móvil** de arena multijugador estilo *brawler*: partidas rápidas en vista cenital 2.5D, personajes cartoon, súpers, arbustos para esconderse, progresión, tienda y **Pase del Bosque**. Se juega en horizontal con controles táctiles y se instala en el móvil como una app.

## Instalarlo en el móvil

El servidor tiene que estar en internet (ver abajo) para que tus amigos entren desde sus móviles. Luego:

- **Android (Chrome):** abre la web y pulsa **📲 Instalar** en el menú (o «Añadir a pantalla de inicio»). Se abre a pantalla completa y en horizontal.
- **iPhone (Safari):** botón **Compartir** ⬆️ → **«Añadir a pantalla de inicio»**. El botón 📲 del juego muestra estos pasos.

Si lo abres en el navegador sin instalar, en Android el primer toque pone el juego a pantalla completa. En vertical aparece un aviso para girar el móvil.

## Arrancar

```bash
npm install
npm start          # http://localhost:3000
```

- **Misma wifi:** tus amigos abren `http://IP-DE-TU-PC:3000`.
- **Por internet:** súbelo a Render, Railway o Fly.io (app Node normal, usa `PORT`), o abre tu PC con `ngrok http 3000`.
- Los perfiles se guardan en `data/profiles.json` (cambia la carpeta con `DATA_DIR`). En hostings sin disco persistente, monta un volumen ahí.

## Cuentas y perfil

- **Registro obligatorio:** la primera vez se elige un **nombre de usuario** (único, de 3 a 14 letras, números o `_`) y una contraseña (mínimo 6 caracteres). Con esa cuenta se entra desde cualquier móvil y el progreso se guarda en el servidor.
- Las contraseñas se guardan cifradas con *scrypt*; tras 5 intentos fallidos se bloquea el inicio de sesión de esa cuenta 30 s.
- Quien ya jugaba antes de existir las cuentas conserva todo su progreso: se le pide crear la cuenta y se le asigna su perfil.
- **Mi perfil** (toca tu nombre en el menú): cambiar el nombre de usuario y la contraseña, cerrar sesión, y personalizar **avatar** (cualquier luchador o aspecto que tengas), **color del nombre**, **título** y **fondo de la tarjeta**. Algunos colores, títulos y fondos se desbloquean con trofeos, victorias, derribos, partidas o niveles del pase (`game/cosmetics.js`).
- En una sala privada, toca el nombre de un jugador para ver su tarjeta de perfil.

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

- **Moverse:** joystick izquierdo (aparece donde pongas el dedo).
- **Atacar:** arrastra el joystick rojo para apuntar y suelta. Un toque rápido apunta solo al enemigo más cercano.
- **Súper:** cuando el botón ★ brilla, arrástralo para apuntar (verás el alcance en amarillo) y suelta. Un toque lo lanza con apuntado automático.
- **Pausa / salir:** botón ❚❚ arriba a la izquierda.
- El móvil vibra al disparar, recibir daño y caer (en Android).

Para probar desde un ordenador también funcionan WASD, el ratón y la tecla `E`.

## Estructura

- `server.js`: Express + Socket.IO, perfiles, emparejamiento, salas privadas, bucle a 30 ticks/s.
- `game/game.js`: simulación autoritativa. `game/bot.js`: IA. `game/map.js`: colisiones y caminos.
- `game/constants.js`: luchadores, aspectos, modos, mapas y niveles. `game/pass.js`: recompensas del pase. `game/profiles.js`: cuentas, sesiones, guardado y recompensas. `game/cosmetics.js`: opciones de personalización.
- `public/js/art.js`: todo el arte vectorial (personajes y escenario). `game.js`: render de partida y controles táctiles. `ui.js`: menús e instalación. `audio.js`: sonidos.
- `public/manifest.webmanifest`, `public/sw.js` y `public/icons/`: lo que permite instalarlo como app.
