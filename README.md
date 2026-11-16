# 🌲 Forest War

Juego **para móvil** de arena multijugador estilo *brawler*: partidas rápidas en vista cenital 2.5D, personajes cartoon, súpers, arbustos para esconderse, progresión, tienda y **Pase del Bosque**. Se juega en horizontal con controles táctiles y se instala en el móvil como una app.

## Instalarlo en el móvil

El servidor tiene que estar en internet (ver abajo) para que tus amigos entren desde sus móviles. Luego:

- **Android (Chrome):** abre la web y pulsa **📲 Instalar** en el menú (o «Añadir a pantalla de inicio»). Se abre a pantalla completa y en horizontal.
- **iPhone (Safari):** botón **Compartir** ⬆️ → **«Añadir a pantalla de inicio»**. El botón 📲 del juego muestra estos pasos.

Si lo abres en el navegador sin instalar, en Android el primer toque pone el juego a pantalla completa. En vertical aparece un aviso para girar el móvil.

## Publicarlo en Render (para jugar con amigos)

El repositorio ya incluye `render.yaml`, configurado para el **plan gratis**.

1. Entra en [render.com](https://render.com) y regístrate con tu cuenta de **GitHub**.
2. Pulsa **New → Blueprint** y conecta el repositorio `Forest-War`. Si no aparece, pulsa *Configure account* y dale acceso a Render.
3. Render leerá `render.yaml` y te enseñará el servicio **forest-war** (plan *Free*). Pulsa **Apply**.
4. Espera a que el despliegue termine (unos minutos) y abre la dirección `https://forest-war-XXXX.onrender.com` que aparece arriba.
5. Pásales ese enlace a tus amigos. Pueden instalarlo como app (📲 en Android, *Compartir → Añadir a pantalla de inicio* en iPhone).

Cada vez que se suban cambios a la rama principal, Render vuelve a desplegar solo.

**Límites del plan gratis:**
- **Las cuentas y el progreso se borran** cada vez que el servidor se reinicia o se actualiza (no hay disco). Hay que volver a registrarse.
- El servidor **se duerme** tras unos 15 minutos sin jugadores; la primera persona que entre esperará alrededor de un minuto.

**Para guardar las cuentas para siempre** (plan de pago): en `render.yaml` cambia `plan: free` por `plan: starter` y añade dentro del servicio:

```yaml
    disk:
      name: forest-war-data
      mountPath: /var/data
      sizeGB: 1
```

y en `envVars` una variable `DATA_DIR` con valor `/var/data`.

**Comprobar que funciona:** `https://tu-direccion.onrender.com/healthz` responde `{"ok":true,...}`.

## Probarlo en tu ordenador

```bash
npm install
npm start          # http://localhost:3000
```

- **Misma wifi:** tus amigos abren `http://IP-DE-TU-PC:3000` (se juega en el navegador, pero no se puede instalar como app sin `https`).
- Los perfiles se guardan en `data/profiles.json` (cambia la carpeta con `DATA_DIR`).

## Cuentas y perfil

- **Registro obligatorio:** la primera vez se elige un **nombre de usuario** (único, de 3 a 14 letras, números o `_`) y una contraseña (mínimo 6 caracteres). Con esa cuenta se entra desde cualquier móvil y el progreso se guarda en el servidor.
- Las contraseñas se guardan cifradas con *scrypt*; tras 5 intentos fallidos se bloquea el inicio de sesión de esa cuenta 30 s.
- Quien ya jugaba antes de existir las cuentas conserva todo su progreso: se le pide crear la cuenta y se le asigna su perfil.
- **Recuperar la contraseña:** al registrarte se muestra un **código de recuperación** (tipo `ABCD-EFGH-JKLM-NPQR`) que hay que guardar; no se puede continuar sin marcar «Lo he guardado». En «Iniciar sesión → ¿Olvidaste tu contraseña?» se pone el usuario, el código y una contraseña nueva. Al usarlo se cierran las sesiones abiertas en otros móviles y se da un código nuevo. Desde «Mi perfil» se puede crear un código nuevo (pide la contraseña). No hace falta email.
- **Mi perfil** (toca tu nombre en el menú): cambiar el nombre de usuario y la contraseña, cerrar sesión, y personalizar **avatar** (cualquier luchador o aspecto que tengas), **color del nombre**, **título** y **fondo de la tarjeta**. Algunos colores, títulos y fondos se desbloquean con trofeos, victorias, derribos, partidas o niveles del pase (`game/cosmetics.js`).
- En una sala privada, toca el nombre de un jugador para ver su tarjeta de perfil.

## Amigos

- En el menú **Amigos** escribe el nombre de usuario de alguien y pulsa **Añadir**: le llega una solicitud (punto rojo en su botón «Amigos») que puede aceptar o rechazar. Si los dos se lo pedís, se aceptan solos.
- La lista muestra quién está **conectado** y qué hace (en el menú, en una sala, buscando partida, jugando o desconectado hace cuánto), y se actualiza al momento.
- **Unirse:** si un amigo está en una sala privada, entra con un toque.
- **Invitar:** desde tu sala, «Invitar amigos» les manda un aviso con un botón «Unirse» (si están en mitad de una partida, lo ven al acabar).
- También puedes ver su perfil o eliminarlo de la lista. Máximo 100 amigos.

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
- `game/constants.js`: luchadores, aspectos, modos, mapas y niveles. `game/pass.js`: recompensas del pase. `game/profiles.js`: cuentas, sesiones, guardado y recompensas. `game/cosmetics.js`: opciones de personalización. `game/friends.js`: amigos y solicitudes.
- `public/js/art.js`: todo el arte vectorial (personajes y escenario). `game.js`: render de partida y controles táctiles. `ui.js`: menús e instalación. `audio.js`: sonidos.
- `public/manifest.webmanifest`, `public/sw.js` y `public/icons/`: lo que permite instalarlo como app.
