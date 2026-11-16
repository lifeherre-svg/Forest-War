/* Forest War - efectos de sonido sintetizados con WebAudio (sin archivos). */
(() => {
  'use strict';
  const FW = (window.FW = window.FW || {});
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem('fw-muted') === '1'; } catch (e) { /* nada */ }

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone({ f = 440, f2 = null, d = 0.12, type = 'square', v = 0.15, delay = 0 }) {
    const a = ctx();
    if (!a || muted) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + d + 0.02);
  }

  function noise({ d = 0.2, v = 0.2, f = 1200, delay = 0 }) {
    const a = ctx();
    if (!a || muted) return;
    const t0 = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * d);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const fl = a.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = f;
    const g = a.createGain();
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    src.connect(fl).connect(g).connect(a.destination);
    src.start(t0);
  }

  const last = {};
  const throttle = (k, ms) => {
    const now = performance.now();
    if (last[k] && now - last[k] < ms) return false;
    last[k] = now;
    return true;
  };

  const SHOT = {
    pinon: () => tone({ f: 700, f2: 300, d: 0.08, type: 'triangle', v: 0.12 }),
    brutus: () => noise({ d: 0.12, v: 0.25, f: 900 }),
    ulma: () => tone({ f: 1400, f2: 500, d: 0.15, type: 'sawtooth', v: 0.07 }),
    champi: () => tone({ f: 220, f2: 420, d: 0.18, type: 'sine', v: 0.2 }),
    lumi: () => tone({ f: 900, f2: 1600, d: 0.12, type: 'sine', v: 0.12 }),
    rayo: () => tone({ f: 900, f2: 400, d: 0.06, type: 'square', v: 0.06 }),
    tortu: () => tone({ f: 300, f2: 150, d: 0.15, type: 'triangle', v: 0.18 }),
  };

  FW.Sfx = {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('fw-muted', muted ? '1' : '0'); } catch (e) { /* nada */ }
      return muted;
    },
    unlock() { ctx(); },
    shot(b, mine) { if (throttle('shot' + b + mine, 50)) (SHOT[b] || SHOT.pinon)(); },
    hit() { if (throttle('hit', 60)) noise({ d: 0.07, v: 0.15, f: 2500 }); },
    hurt() { if (throttle('hurt', 120)) tone({ f: 180, f2: 90, d: 0.15, type: 'square', v: 0.12 }); },
    boom() { if (throttle('boom', 80)) noise({ d: 0.35, v: 0.3, f: 500 }); },
    kill() { tone({ f: 500, f2: 900, d: 0.12, type: 'square', v: 0.1 }); tone({ f: 900, f2: 1300, d: 0.12, type: 'square', v: 0.1, delay: 0.1 }); },
    super() { tone({ f: 300, f2: 1200, d: 0.35, type: 'sawtooth', v: 0.1 }); },
    superReady() { tone({ f: 880, d: 0.1, type: 'triangle', v: 0.12 }); tone({ f: 1320, d: 0.15, type: 'triangle', v: 0.12, delay: 0.09 }); },
    gem() { if (throttle('gem', 60)) { tone({ f: 1200, d: 0.08, type: 'sine', v: 0.12 }); tone({ f: 1800, d: 0.12, type: 'sine', v: 0.1, delay: 0.06 }); } },
    heal() { if (throttle('heal', 400)) tone({ f: 600, f2: 900, d: 0.2, type: 'sine', v: 0.08 }); },
    click() { tone({ f: 520, f2: 700, d: 0.06, type: 'triangle', v: 0.12 }); },
    reward() { [660, 880, 1100, 1320].forEach((f, i) => tone({ f, d: 0.14, type: 'triangle', v: 0.12, delay: i * 0.08 })); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.25, type: 'square', v: 0.09, delay: i * 0.13 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone({ f, d: 0.3, type: 'triangle', v: 0.12, delay: i * 0.18 })); },
    tick() { tone({ f: 1000, d: 0.05, type: 'square', v: 0.06 }); },
  };
})();
