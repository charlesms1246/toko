/**
 * Console layout.
 *
 * The device was authored on a 1170 x 2532 pixel canvas; every position below
 * is still expressed in those source pixels and converted to world units by
 * `toX` / `toY`, exactly as the original build does. Keeping the pixel numbers
 * means the layout can be checked against the reference artwork directly.
 */

/** Source pixels -> world units. */
export const PX = 1 / 200;

/** Horizontal: source x -> world x (585px is the device centerline). */
export const toX = (px: number) => (px - 585) * PX;

/** Vertical: source y -> world y (y grows downward in source space). */
export const toY = (py: number) => (1155 - py) * PX;

export const BODY_W = 6.2;
/** Extra height folded into the shell above the nominal 11.95. */
export const BODY_PAD = 0.14;
export const BODY_H = 11.95 + BODY_PAD;
export const BODY_CORNER = 0.05;
export const BODY_DEPTH = 0.6;
export const BODY_BEVEL = 0.08;

export const BACK_DEPTH = 1.2;
export const BACK_Z = -0.76;
export const SEAM_Z = -0.72;
export const BAND_W = 6.36;

/** The whole device group sits forward of the origin by this much. */
export const GROUP_Z = 1.06;

/** Vertical centre of the shell for a given height extension. */
export const bodyCenterY = (extend = 0) => toY(1130) + (BODY_PAD + extend) / 2;

export type ButtonKey = "play" | "action1" | "action2" | "menu" | "home";

/** Hit-test / press order. Index 0 is the big Play key. */
export const BUTTON_KEYS: ButtonKey[] = [
  "play",
  "action1",
  "action2",
  "menu",
  "home",
];

export interface ButtonSpec {
  w: number;
  h: number;
  r: number;
  depth: number;
  dx: number;
  dy: number;
  baseZ: number;
  pressedZ: number;
  pad: number;
}

/** Per-key plate size, travel and pocket padding — in key order. */
export const BUTTON_SPECS: ButtonSpec[] = [
  { w: 1.6, h: 1.5, r: 0.15, depth: 1, dx: 0, dy: 0, baseZ: 0.35, pressedZ: 0.2, pad: 0.15 },
  { w: 1.72, h: 1.62, r: 0.15, depth: 0.44, dx: 0, dy: 0, baseZ: 0.16, pressedZ: -0.03, pad: 0.09 },
  { w: 1.72, h: 1.62, r: 0.15, depth: 0.44, dx: 0, dy: 0, baseZ: 0.16, pressedZ: -0.03, pad: 0.09 },
  { w: 0.98, h: 0.31, r: 0.15, depth: 0.3, dx: 0, dy: 0, baseZ: 0.2, pressedZ: 0.15, pad: 0.1 },
  { w: 1.02, h: 0.31, r: 0.15, depth: 0.3, dx: 0, dy: 0, baseZ: 0.2, pressedZ: 0.15, pad: 0.1 },
];

/** Key centres, in source pixels. */
export const BUTTON_POS = [
  { x: 965, y: 1490 }, // play
  { x: 200, y: 1840 }, // action1 (LONG)
  { x: 589, y: 1840 }, // action2 (SHORT)
  { x: 150, y: 2150 }, // menu
  { x: 425, y: 2150 }, // home / games
];

export interface Pocket {
  px: number;
  py: number;
  w: number;
  h: number;
  r: number;
  pad: number;
}

export const KNOB_POCKET: Pocket = { px: 975, py: 1960, w: 1, h: 2.4, r: 0.1, pad: 0.08 };
export const WHEEL_POCKET: Pocket = { px: 690, py: 2140, w: 0.86, h: 0.82, r: 0.12, pad: 0.035 };

/**
 * Screen outline, in source pixels. It is an L — the bottom-right is notched
 * out so the big Play key can sit beside the display.
 */
export const SCREEN_POLY = [
  { x: 0, y: 1680 },
  { x: 760, y: 1680 },
  { x: 760, y: 1325 },
  { x: 1170, y: 1325 },
  { x: 1170, y: 30 },
  { x: 0, y: 30 },
];

export const SCREEN_Y_OFFSET = 0.13;
export const SCREEN_CORNER = 0.25;
export const SCREEN_Z = GROUP_Z + 0.06;

/** Knob tunables — ridges are drawn into a procedural bump map. */
export const KNOB = {
  ridgeWidth: 120,
  grooveWidth: 50,
  bumpScale: 45,
  ridgeRepeat: 20,
  cornerCurve: 0.2,
  radius: 1.25,
  height: 0.95,
  edgeCurve: 0.1,
  dragSensitivity: 0.5,
  ridgePhase: 0,
  snapInterval: 20,
  snapSpeed: 5,
  ridgeLength: 0.825,
};

/** Shell / trim colors that are not theme-driven. */
export const HARDWARE_COLORS = {
  metalBand: 0x5f636b,
  seam: 0x8c7f64,
  recess: 0x282218,
  screenGlass: 0xefc03b,
  trimRing: 0x44474e,
  trimScrew: 0x767a83,
  wheelBezel: 0x080808,
  wheelDrum: 0x171717,
  logoLetters: 0xff4444,
  logoEyes: 0x4488ff,
};

export const LIGHTS = {
  hemi: { sky: 0xfffce0, ground: 0xcdbbd8, intensity: 1.73 },
  ambient: { color: 0xffffff, intensity: 0.5 },
  key: {
    color: 0xfff9ca,
    intensity: 2.98,
    position: [-4, 5, 9] as const,
    shadowMapSize: 2048,
    shadowRadius: 4,
    bias: -5e-4,
    normalBias: 0.1,
  },
  fill: { color: 0xfff3cf, intensity: 0.69, position: [5, 1, 6] as const },
};

/** Silkscreen text baked onto the back plate. */
export const BACK_PLATE_TEXT = {
  model: "TOKO-01",
  line2: "SOMNIA NETWORK INSIDE",
  line3: "CE · FCC · RoHS",
  footer: "TOKO",
};

/** Canvas-texture font — deliberately the system stack, not Gabarito. */
export const SILKSCREEN_FONT =
  '-apple-system, "Segoe UI", system-ui, sans-serif';
