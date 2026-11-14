// anto design system: haptics
//
// vibration feedback is opt-in per call but on by default for the
// components that use it (Btn primary/danger press, Checkbox/Radio toggle,
// Tabs activation, Toast dismiss), it is silent wherever the api is missing
// (desktop browsers, iOS Safari) and can be disabled globally for users who
// do not want it
//
// pulses stay short (<=15ms) on purpose: this is a confirmation tick, not a
// notification buzz, anything longer reads as intrusive

let enabled = true;

/** turn haptic feedback on/off app-wide, persists only for the session */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export type HapticPattern = 'tap' | 'toggle' | 'confirm' | 'error' | (string & {});

const PATTERNS: Record<string, number | number[]> = {
  tap:     10,
  toggle:  8,
  confirm: [10, 40, 10],
  error:   [15, 60, 15, 60, 15],
};

/**
 * add or override a named pattern, e.g. registerHapticPattern("success",
 * [8, 30, 8]). keep pulses short, see the module note above
 */
export function registerHapticPattern(name: string, pattern: number | number[]): void {
  PATTERNS[name] = pattern;
}

/**
 * fire a short vibration pulse, accepts a named pattern (built-in or
 * registered via registerHapticPattern) or a raw duration / pattern array
 * for one-off use, no-ops on any platform without navigator.vibrate
 * (desktop, iOS) and when disabled, never throws
 */
export function haptic(pattern: HapticPattern | number | number[] = 'tap'): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const resolved = typeof pattern === 'string' ? (PATTERNS[pattern] ?? PATTERNS.tap) : pattern;
  try {
    navigator.vibrate(resolved);
  } catch {
    // vibration can be blocked (permissions, no user gesture), ignore
  }
}
