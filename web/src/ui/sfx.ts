let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, ms: number, gain = 0.04): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  o.start(t0);
  o.stop(t0 + ms / 1000 + 0.02);
  void c.resume();
}

export const Sfx = {
  blip: (): void => tone(520, 55),
  step: (): void => tone(392, 70),
  ok: (): void => {
    tone(523, 60);
    window.setTimeout(() => tone(784, 90), 70);
  },
  tip: (): void => tone(440, 45, 0.03),
};