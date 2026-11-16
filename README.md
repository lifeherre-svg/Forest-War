# 🌲 Forest War

Juego de arena multijugador estilo *brawler* (partidas rápidas, vista cenital, 3 balas que se recargan, súper que se carga haciendo daño, arbustos para esconderse) para jugar con amigos desde el navegador, en PC o móvil.

## Cómo jugar

```bash
npm install
npm start
```

Abre `http://localhost:3000`. Para jugar con amigos:

- **Misma red wifi:** que abran `http://IP-DE-TU-PC:3000` (en Windows mira tu IP con `ipconfig`, en Mac/Linux con `ip a` o en Ajustes de red).
- **Por internet:** despliégalo gratis en Render, Railway o Fly.io (es una app Node normal; usa la variable `PORT`), o expón tu PC con `ngrok http 3000` o `cloudflared tunnel --url http://localhost:3000`.

1. Uno crea una **sala privada** y comparte el código de 5 letras o el enlace (botón *Copiar enlace*).
2. Los amigos entran con el código.
3. El anfitrión elige modo y mapa, y **añade bots** a cualquier equipo con la dificultad que quiera (Fácil / Normal / Difícil). También puede cambiarles el luchador, la dificultad o el equipo, o quitarlos.
4. Si la sala está llena de bots y entra un amigo, ocupa el puesto de un bot.

### Controles

| | PC | Móvil |
|---|---|---|
| Moverse | WASD / flechas | Joystick izquierdo |
| Disparar | Ratón para apuntar + clic izquierdo | Arrastra el joystick derecho y suelta (un toque = apuntado automático) |
| Súper | `E`, espacio o clic derecho | Botón amarillo ★ |

## Modos

- **Cristales** (equipos): salen cristales del centro; si tu equipo lleva 10 o más (y más que el rival) durante 15 s, gana. Al caer sueltas los tuyos.
- **Duelo de Equipos**: primer equipo en llegar a 15 derribos.
- **Todos contra Todos**: el primero en llegar a 8 derribos (hasta 8 jugadores).

## Luchadores

| | Ataque | Súper |
|---|---|---|
| 🐿️ **Piñón** | Abanico de 5 bellotas, rápido | Tormenta de Bellotas: anillo de 360° |
| 🐻 **Brutus** | Zarpazos de corto alcance, mucha vida | Embestida: carga que golpea y empuja |
| 🦉 **Ulma** | Pluma de francotirador de largo alcance | Pluma Perforante: atraviesa enemigos |
| 🍄 **Champi** | Espora que vuela por encima de los muros | Nube Tóxica: daño continuo en área |

## Estructura

- `server.js`: servidor Express + Socket.IO, salas privadas, gestión de bots y bucle de juego a 30 ticks/s.
- `game/game.js`: simulación autoritativa (movimiento, colisiones, proyectiles, súpers, cristales, visibilidad en arbustos).
- `game/bot.js`: IA de los bots (búsqueda de caminos, esquivar en círculo, retirada con poca vida, recoger cristales, apuntado con predicción según dificultad).
- `game/map.js` y `game/constants.js`: mapas (se generan en espejo para que sean justos), luchadores y modos. Para crear un mapa nuevo, añade otra entrada en `MAPS`.
- `public/`: cliente en canvas (interpolación, HUD y controles táctiles).
