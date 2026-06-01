// Synthesized call sounds (ringtone / ringback / end tone) via the Web Audio API.
//
// No binary assets and no external library — only the standard browser Web Audio
// API. A single shared AudioContext is lazily created on first use. Browsers gate
// audio behind a user gesture: the outgoing ringback starts from a click (caller
// pressed "call"), so it always plays. The incoming ringtone relies on any prior
// interaction in the page having unlocked the context — if the browser still
// blocks it, the calls below fail silently rather than throwing (the subject
// forbids unhandled console errors).

let audioCtx = null;

const getCtx = () => {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    try { audioCtx = new AC(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
};

// One short sine "beep" scheduled `startOffset` seconds from now.
const beep = (ctx, freq, startOffset, duration, peak = 0.12) => {
  try {
    const t0 = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Tiny attack/release envelope so the tone doesn't click.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch { /* ignore — never surface an audio error to the console */ }
};

// Repeat a burst on an interval. Returns a stop() function.
const startLoop = (renderBurst, periodMs) => {
  const ctx = getCtx();
  if (!ctx) return () => {};
  let stopped = false;
  const tick = () => { if (!stopped) renderBurst(ctx); };
  tick();
  const id = setInterval(tick, periodMs);
  return () => { stopped = true; clearInterval(id); };
};

// Outgoing call: gentle, sparse ringback (caller waiting for an answer).
export const startRingback = () =>
  startLoop((ctx) => {
    beep(ctx, 440, 0, 0.4, 0.07);
    beep(ctx, 480, 0.45, 0.4, 0.07);
  }, 3000);

// Incoming call: more present, repeating ringtone (someone is calling you).
export const startRingtone = () =>
  startLoop((ctx) => {
    beep(ctx, 660, 0, 0.22, 0.13);
    beep(ctx, 550, 0.28, 0.22, 0.13);
    beep(ctx, 660, 0.56, 0.22, 0.13);
  }, 1800);

// Short descending tone played when a connected call ends (softens the cut-off).
export const playEndTone = () => {
  const ctx = getCtx();
  if (!ctx) return;
  beep(ctx, 520, 0, 0.16, 0.11);
  beep(ctx, 390, 0.16, 0.26, 0.11);
};
