/**
 * Sound.
 *
 * Two independent buses, as in the original:
 *
 *  - the UI SFX bus, sample-based with a WebAudio synth for stingers
 *  - the console hardware bus, with its own master gain and a round-robin
 *    humanization profile per key so repeated presses never sound identical
 *
 * Plus the background music player, which exposes named parts of one long file.
 */

// ── Shared context ───────────────────────────────────────────────────────────

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") {
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    return ctx;
  }
  const Impl: Ctor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Impl) return null;
  ctx = new Impl();
  return ctx;
}

export function resumeAudio() {
  const c = audio();
  if (c && c.state !== "running") void c.resume().catch(() => {});
}

if (typeof window !== "undefined") {
  const wake = () => resumeAudio();
  window.addEventListener("visibilitychange", wake);
  window.addEventListener("pageshow", wake);
  window.addEventListener("pointerdown", wake, { once: true });
}

// ── Volumes ──────────────────────────────────────────────────────────────────

const VOL_KEY_SFX = "toko_sfx_vol";
const VOL_KEY_MUSIC = "toko_music_vol";

export const VOLUME_DEFAULTS = { sfx: 1, music: 0.72 };
/** The music file is hot; scale it down so it sits under the SFX. */
const MUSIC_TRIM = 0.4;

function readVolume(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const value = Number(JSON.parse(raw));
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  } catch {
    return fallback;
  }
}

let sfxVolume = VOLUME_DEFAULTS.sfx;
let musicVolume = VOLUME_DEFAULTS.music;
let muted = false;

// ── Sample bank ──────────────────────────────────────────────────────────────

interface SampleCategory {
  sources: string[];
  gain: number;
  /** Random pitch drift, in cents. */
  drift: number;
}

const CATEGORIES: Record<string, SampleCategory> = {
  tap: {
    sources: [1, 2, 3, 4, 5].map((n) => `/sounds/ui-sfx/tap/tap_0${n}.wav`),
    gain: 0.45,
    drift: 45,
  },
  swipe: {
    sources: [1, 2, 5].map((n) => `/sounds/ui-sfx/swipes/swipe_0${n}.mp3`),
    gain: 0.4,
    drift: 30,
  },
  toggleOn: {
    sources: ["/sounds/ui-sfx/toggles/toggle_on.mp3"],
    gain: 0.95,
    drift: 0,
  },
  toggleOff: {
    sources: ["/sounds/ui-sfx/toggles/toggle_off.mp3"],
    gain: 0.95,
    drift: 0,
  },
  disabled: { sources: ["/sounds/ui-sfx/disabled.mp3"], gain: 0.75, drift: 0 },
};

export type SfxName = keyof typeof CATEGORIES;

const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer | null>>();
const lastVariant = new Map<string, number>();
const lastPlayed = new Map<string, number>();

/**
 * Find the first sample above the noise floor and start 8 samples earlier, so
 * a tap fires the instant you touch rather than after the file's lead-in.
 */
function trimLeadingSilence(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > 0.002) {
      return Math.max(0, i - 8) / buffer.sampleRate;
    }
  }
  return 0;
}

async function loadSample(url: string): Promise<AudioBuffer | null> {
  if (buffers.has(url)) return buffers.get(url)!;
  if (pending.has(url)) return pending.get(url)!;

  const c = audio();
  if (!c) return null;

  const job = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const bytes = await res.arrayBuffer();
      const decoded = await c.decodeAudioData(bytes);
      buffers.set(url, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      pending.delete(url);
    }
  })();

  pending.set(url, job);
  return job;
}

/** Pick a variant, but never the one we played last. */
function pickVariant(key: string, count: number): number {
  if (count <= 1) return 0;
  const previous = lastVariant.get(key);
  let index = Math.floor(Math.random() * count);
  if (index === previous) index = (index + 1) % count;
  lastVariant.set(key, index);
  return index;
}

export function playSfx(name: SfxName) {
  if (muted) return;
  const category = CATEGORIES[name];
  if (!category) return;

  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < 40) return;
  lastPlayed.set(name, now);

  const url = category.sources[pickVariant(name, category.sources.length)];
  const triggeredAt = now;

  void loadSample(url).then((buffer) => {
    // Drop anything that finished decoding long after the trigger.
    if (!buffer || performance.now() - triggeredAt > 350) return;
    const c = audio();
    if (!c || muted) return;

    const source = c.createBufferSource();
    source.buffer = buffer;
    if (category.drift) {
      const cents = (Math.random() * 2 - 1) * category.drift;
      source.detune.value = cents;
    }
    const gain = c.createGain();
    gain.gain.value = category.gain * 0.2 * sfxVolume;
    source.connect(gain).connect(c.destination);
    source.start(0, trimLeadingSilence(buffer));
  });
}

// ── Synthesized stingers ─────────────────────────────────────────────────────

let noiseBuffer: AudioBuffer | null = null;

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(c.sampleRate * 0.2);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function blip(
  c: AudioContext,
  frequency: number,
  at: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = "triangle",
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(gainValue, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(1e-4, at + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function master(): number {
  return 2 * sfxVolume;
}

/** Ascending arpeggio, G4 -> E5. */
export function playWin() {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime;
  [329.63, 392, 493.88, 659.25].forEach((f, i) => {
    blip(c, f, t + i * 0.075, 0.22, 0.16 * master());
  });
}

/** Descending arpeggio plus a sine sweep and a filtered noise thud. */
export function playLose() {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime;
  [659.25, 493.88, 392, 329.63].forEach((f, i) => {
    blip(c, f, t + i * 0.07, 0.2, 0.12 * master(), "sawtooth");
  });

  const sweep = c.createOscillator();
  const sweepGain = c.createGain();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(180, t);
  sweep.frequency.exponentialRampToValueAtTime(40, t + 0.5);
  sweepGain.gain.setValueAtTime(0.22 * master(), t);
  sweepGain.gain.exponentialRampToValueAtTime(1e-4, t + 0.55);
  sweep.connect(sweepGain).connect(c.destination);
  sweep.start(t);
  sweep.stop(t + 0.6);

  const thud = c.createBufferSource();
  thud.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;
  const thudGain = c.createGain();
  thudGain.gain.setValueAtTime(0.18 * master(), t);
  thudGain.gain.exponentialRampToValueAtTime(1e-4, t + 0.3);
  thud.connect(filter).connect(thudGain).connect(c.destination);
  thud.start(t);
}

export function playCashOut() {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) =>
    blip(c, f, t + i * 0.055, 0.18, 0.14 * master()),
  );
}

export function playAchievement() {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    blip(c, f, t + i * 0.09, 0.3, 0.15 * master()),
  );
}

/** Rises 1.5 octaves over 40 steps from G5. */
export function playStepUp(step: number, total = 40) {
  const c = audio();
  if (!c || muted) return;
  const ratio = Math.max(0, Math.min(1, step / total));
  blip(c, 783.99 * Math.pow(2, ratio * 1.5), c.currentTime, 0.09, 0.1 * master());
}

export function playTick() {
  const c = audio();
  if (!c || muted) return;
  blip(c, 1200, c.currentTime, 0.04, 0.05 * master(), "square");
}

export function playError() {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime;
  blip(c, 220, t, 0.14, 0.14 * master(), "square");
  blip(c, 165, t + 0.1, 0.2, 0.14 * master(), "square");
}

export function playCountdown() {
  const c = audio();
  if (!c || muted) return;
  blip(c, 880, c.currentTime, 0.08, 0.09 * master(), "square");
}

export function playWhoosh() {
  const c = audio();
  if (!c || muted) return;
  const t = c.currentTime;
  const source = c.createBufferSource();
  source.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.12 * master(), t);
  gain.gain.exponentialRampToValueAtTime(1e-4, t + 0.24);
  source.connect(filter).connect(gain).connect(c.destination);
  source.start(t);
}

// ── Console hardware bus ─────────────────────────────────────────────────────

const HARDWARE_SAMPLES: Record<string, string> = {
  mainPress: "/sounds/MAIN_PRESS.MP3",
  mainRelease: "/sounds/MAIN_RELEASE.MP3",
  actionPress: "/sounds/ACTION_PRESS.MP3",
  actionRelease: "/sounds/ACTION_RELEASE.MP3",
  pillPress: "/sounds/PILL_PRESS.MP3",
  pillRelease: "/sounds/PILL_RELEASE.MP3",
  knob: "/sounds/KNOB_RUBBER.mp3",
  roller: "/sounds/SMALL_ROLLER.MP3",
};

export type Voice =
  | "main"
  | "action1"
  | "action2"
  | "menu"
  | "home"
  | "knob"
  | "thumbwheel";

interface VoiceProfile {
  cents: number;
  centsRange: number;
  minCentsChange: number;
  gain: [number, number];
  cutoff: [number, number];
  pan: number;
  q: number;
}

/**
 * Each key gets its own detune centre, gain window, filter cutoff and stereo
 * position, so the two action keys read as physically different buttons.
 */
const VOICES: Record<Voice, VoiceProfile> = {
  main: { cents: 0, centsRange: 5, minCentsChange: 2, gain: [0.97, 1.03], cutoff: [8200, 10500], pan: 0.07, q: 0.35 },
  action1: { cents: -4, centsRange: 7, minCentsChange: 2.5, gain: [0.965, 1.035], cutoff: [7200, 9200], pan: -0.055, q: 0.45 },
  action2: { cents: 4, centsRange: 7, minCentsChange: 2.5, gain: [0.965, 1.035], cutoff: [7200, 9200], pan: 0.025, q: 0.45 },
  menu: { cents: -3, centsRange: 6, minCentsChange: 2.5, gain: [0.96, 1.04], cutoff: [6800, 8800], pan: -0.05, q: 0.4 },
  home: { cents: 3, centsRange: 6, minCentsChange: 2.5, gain: [0.96, 1.04], cutoff: [6800, 8800], pan: 0.02, q: 0.4 },
  knob: { cents: -5, centsRange: 9, minCentsChange: 3, gain: [0.95, 1.04], cutoff: [1050, 1350], pan: 0.07, q: 0.8 },
  thumbwheel: { cents: 5, centsRange: 8, minCentsChange: 3, gain: [0.95, 1.04], cutoff: [1250, 1650], pan: -0.035, q: 0.7 },
};

const HARDWARE_MASTER = 0.25;

interface Take {
  detune: number;
  gain: number;
  cutoff: number;
}

const lastTake = new Map<Voice, Take>();

/** A fresh take that is audibly different from the previous one. */
function nextTake(voice: Voice): Take {
  const p = VOICES[voice];
  const previous = lastTake.get(voice);
  let detune = p.cents + (Math.random() * 2 - 1) * p.centsRange;
  if (previous && Math.abs(detune - previous.detune) < p.minCentsChange) {
    detune +=
      (detune >= previous.detune ? 1 : -1) * p.minCentsChange;
  }
  const take: Take = {
    detune,
    gain: p.gain[0] + Math.random() * (p.gain[1] - p.gain[0]),
    cutoff: p.cutoff[0] + Math.random() * (p.cutoff[1] - p.cutoff[0]),
  };
  lastTake.set(voice, take);
  return take;
}

/** A release reuses the press take, so the pair reads as one physical event. */
function playHardware(sampleKey: string, voice: Voice, reuse: boolean) {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const url = HARDWARE_SAMPLES[sampleKey];
  if (!url) return;

  const profile = VOICES[voice];
  const take = reuse ? (lastTake.get(voice) ?? nextTake(voice)) : nextTake(voice);

  void loadSample(url).then((buffer) => {
    if (!buffer || muted) return;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.detune.value = take.detune;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = take.cutoff;
    filter.Q.value = profile.q;

    const gain = c.createGain();
    gain.gain.value = take.gain * HARDWARE_MASTER * sfxVolume;

    const panner = c.createStereoPanner();
    panner.pan.value = profile.pan;

    source.connect(filter).connect(gain).connect(panner).connect(c.destination);
    source.start(0);
  });
}

const VOICE_SAMPLE: Record<Voice, string> = {
  main: "main",
  action1: "action",
  action2: "action",
  menu: "pill",
  home: "pill",
  knob: "knob",
  thumbwheel: "roller",
};

/**
 * If a hardware sample fails to load, fall back to a short synth click shaped
 * by the same per-voice profile so the key still feels like it fired.
 */
function fallbackClick(voice: Voice, release: boolean) {
  const c = audio();
  if (!c || muted) return;
  const profile = VOICES[voice];
  const t = c.currentTime;

  const source = c.createBufferSource();
  source.buffer = noise(c);

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = release ? profile.cutoff[0] * 0.6 : profile.cutoff[0];
  filter.Q.value = 2.2;

  const gain = c.createGain();
  const peak = (release ? 0.05 : 0.09) * HARDWARE_MASTER * sfxVolume * 4;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(1e-4, t + (release ? 0.05 : 0.07));

  const panner = c.createStereoPanner();
  panner.pan.value = profile.pan;

  source.connect(filter).connect(gain).connect(panner).connect(c.destination);
  source.start(t);
}

export function playKeyPress(voice: Voice) {
  const kind = VOICE_SAMPLE[voice];
  if (kind === "knob" || kind === "roller") {
    playHardware(kind, voice, false);
    if (!buffers.has(HARDWARE_SAMPLES[kind])) fallbackClick(voice, false);
    return;
  }
  const sampleKey = `${kind}Press`;
  if (buffers.has(HARDWARE_SAMPLES[sampleKey])) {
    playHardware(sampleKey, voice, false);
  } else {
    void loadSample(HARDWARE_SAMPLES[sampleKey]);
    fallbackClick(voice, false);
  }
}

export function playKeyRelease(voice: Voice) {
  const kind = VOICE_SAMPLE[voice];
  if (kind === "knob" || kind === "roller") return;
  const sampleKey = `${kind}Release`;
  if (buffers.has(HARDWARE_SAMPLES[sampleKey])) {
    playHardware(sampleKey, voice, true);
  } else {
    void loadSample(HARDWARE_SAMPLES[sampleKey]);
    fallbackClick(voice, true);
  }
}

// ── Background music ─────────────────────────────────────────────────────────

export interface MusicPart {
  at: number;
  title: string;
}

export const MUSIC_PARTS: MusicPart[] = [
  { at: 0, title: "TOKO - Intro" },
  { at: 32.78, title: "TOKO - Build" },
  { at: 57.6, title: "TOKO - Drop" },
  { at: 98.46, title: "TOKO - Outro" },
];

export interface MusicState {
  sfxVolume: number;
  musicVolume: number;
  playing: boolean;
  title: string;
  isFirstPart: boolean;
  isLastPart: boolean;
}

let element: HTMLAudioElement | null = null;
let musicGain: GainNode | null = null;
let usingGraph = false;

let state: MusicState = {
  sfxVolume: VOLUME_DEFAULTS.sfx,
  musicVolume: VOLUME_DEFAULTS.music,
  playing: false,
  title: MUSIC_PARTS[0].title,
  isFirstPart: true,
  isLastPart: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function partIndexAt(time: number): number {
  let index = 0;
  for (let i = 0; i < MUSIC_PARTS.length; i++) {
    if (time >= MUSIC_PARTS[i].at) index = i;
  }
  return index;
}

function publish() {
  const time = element?.currentTime ?? 0;
  const index = partIndexAt(time);
  state = {
    sfxVolume,
    musicVolume,
    playing: !!element && !element.paused,
    title: MUSIC_PARTS[index].title,
    isFirstPart: index === 0,
    isLastPart: index === MUSIC_PARTS.length - 1,
  };
  emit();
}

function applyMusicVolume() {
  const level = muted ? 0 : musicVolume * MUSIC_TRIM;
  if (usingGraph && musicGain) musicGain.gain.value = level;
  else if (element) element.volume = level;
}

function ensureMusic(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (element) return element;

  element = new Audio("/sounds/TOKO_BGM.mp3");
  element.loop = true;
  element.preload = "auto";
  element.crossOrigin = "anonymous";

  const c = audio();
  if (c) {
    try {
      const source = c.createMediaElementSource(element);
      musicGain = c.createGain();
      source.connect(musicGain).connect(c.destination);
      usingGraph = true;
    } catch {
      // Some iOS builds refuse the media element source; fall back to
      // element.volume, which still gives us a working fader.
      usingGraph = false;
    }
  }

  element.addEventListener("play", publish);
  element.addEventListener("pause", publish);
  element.addEventListener("timeupdate", publish);
  applyMusicVolume();
  return element;
}

export const music = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot(): MusicState {
    return state;
  },
  getServerSnapshot(): MusicState {
    return state;
  },
  play() {
    const el = ensureMusic();
    if (!el) return;
    resumeAudio();
    void el.play().catch(() => {});
  },
  pause() {
    element?.pause();
  },
  toggle() {
    if (element && !element.paused) music.pause();
    else music.play();
  },
  nextPart() {
    const el = ensureMusic();
    if (!el) return;
    const index = partIndexAt(el.currentTime);
    const next = MUSIC_PARTS[Math.min(index + 1, MUSIC_PARTS.length - 1)];
    el.currentTime = next.at;
    publish();
  },
  previousPart() {
    const el = ensureMusic();
    if (!el) return;
    const index = partIndexAt(el.currentTime);
    // Restart the current part first, the way a track skip-back behaves.
    const target =
      el.currentTime - MUSIC_PARTS[index].at > 2
        ? MUSIC_PARTS[index]
        : MUSIC_PARTS[Math.max(index - 1, 0)];
    el.currentTime = target.at;
    publish();
  },
  setSfxVolume(value: number) {
    sfxVolume = Math.max(0, Math.min(1, value));
    try {
      window.localStorage.setItem(VOL_KEY_SFX, JSON.stringify(sfxVolume));
    } catch {
      // not persisted
    }
    publish();
  },
  setMusicVolume(value: number) {
    musicVolume = Math.max(0, Math.min(1, value));
    try {
      window.localStorage.setItem(VOL_KEY_MUSIC, JSON.stringify(musicVolume));
    } catch {
      // not persisted
    }
    applyMusicVolume();
    publish();
  },
  reset() {
    music.setSfxVolume(VOLUME_DEFAULTS.sfx);
    music.setMusicVolume(VOLUME_DEFAULTS.music);
  },
  /** Load persisted volumes. Safe to call more than once. */
  hydrate() {
    sfxVolume = readVolume(VOL_KEY_SFX, VOLUME_DEFAULTS.sfx);
    musicVolume = readVolume(VOL_KEY_MUSIC, VOLUME_DEFAULTS.music);
    applyMusicVolume();
    publish();
  },
};

/** Global mute. Also silences any running music. */
export function setSoundEnabled(next: boolean) {
  muted = !next;
  applyMusicVolume();
  publish();
}

export function isSoundEnabled(): boolean {
  return !muted;
}
