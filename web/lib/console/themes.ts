/**
 * Console presets ("skins") and per-part customization.
 *
 * The preset table, swatch palettes and resolution rules are ported from the
 * reference console build, so a preset resolves to exactly the colors and
 * material modes it was authored with.
 */

export type PartKey = "body" | "play" | "buttons" | "knob" | "wheel" | "glow";

export interface Theme {
  id: string;
  code: string;
  name: string;
  badge?: string;
  body: string;
  back: string;
  knob: string;
  main: string;
  action: string;
  pills: string;
  label: string;
  logo: string;
  logoEyes?: string;
  bezelInk?: string;
  ambient?: string;
  skin?: string;
  metallic?: boolean;
  clear?: boolean;
  glow?: string;
  cardBg: string;
  cardInk: string;
  cardSub: string;
  cardImage?: string;
}

export interface ConsoleCustom {
  preset: string;
  parts?: Partial<Record<PartKey, number>>;
}

export interface Swatch {
  name: string;
  hex: string;
}

/** The presets, in carousel order. */
export const THEMES: Theme[] = [
  {
    id: "classic",
    code: "001",
    name: "Classic",
    body: "#e9dbbf",
    back: "#dccdb1",
    knob: "#f2c044",
    main: "#d63a2e",
    action: "#3568c9",
    pills: "#c1c1c1",
    label: "#7c7870",
    logo: "#d02323",
    logoEyes: "#4488ff",
    cardBg: "#e9dbbf",
    cardInk: "#981f14",
    cardSub: "rgba(58,42,22,0.62)",
  },
  {
    id: "somnia",
    // Somnia's mainnet chain id, in the slot the other presets use for a numeral.
    code: "5031",
    name: "Somnia",
    body: "#16161c",
    back: "#101015",
    ambient: "#08080b",
    knob: "#f4f4f6",
    main: "#f4f4f6",
    action: "#2a2a34",
    pills: "#22222b",
    label: "#8f93a0",
    logo: "#f4f4f6",
    cardBg: "#16161c",
    cardInk: "#f4f4f6",
    cardSub: "rgba(244,244,246,0.6)",
    cardImage: "/assets/images/somnia-theme-card.png",
  },
  {
    id: "deepblue",
    code: "042",
    name: "DeepBlue",
    body: "#1f6feb",
    back: "#175ad6",
    knob: "#298DFF",
    main: "#f4f7ff",
    action: "#0838a0",
    pills: "#f4f7ff",
    label: "#e3edfd",
    logo: "#ced2dd",
    cardBg: "#1f6feb",
    cardInk: "#f4f7ff",
    cardSub: "rgba(255,255,255,0.68)",
  },
  {
    id: "aurum",
    code: "24K",
    name: "Aurum",
    badge: "High Roller",
    metallic: true,
    body: "#c9a227",
    back: "#b8922a",
    ambient: "#0e0a03",
    skin: "/assets/aurum-skin.svg",
    knob: "#191309",
    main: "#f0cf5c",
    action: "#221a0d",
    pills: "#241c0e",
    label: "#4a3708",
    logo: "#f6e185",
    cardBg: "#d4ab2f",
    cardInk: "#2d2104",
    cardSub: "rgba(45,33,4,0.66)",
    cardImage: "/assets/aurum-skin.svg",
  },
  {
    id: "clear",
    code: "000",
    name: "Clear",
    clear: true,
    body: "#d7dade",
    back: "#eef1f3",
    ambient: "#080a0e",
    knob: "#eef0f3",
    main: "#e5322b",
    action: "#171a20",
    pills: "#13151a",
    label: "#9aa0a8",
    logo: "#e5322b",
    cardBg: "#15171c",
    cardInk: "#eef0f3",
    cardSub: "rgba(216,222,230,0.6)",
  },
  {
    id: "tangerine",
    code: "2005",
    name: "Teenager",
    body: "#b8bcc2",
    back: "#9ea2a8",
    knob: "#e05a20",
    main: "#e05a20",
    action: "#555a60",
    pills: "#e8ede0",
    label: "#7a3d12",
    logo: "#e8ede0",
    cardBg: "#b8bcc2",
    cardInk: "#e05a20",
    cardSub: "rgba(38,40,44,0.6)",
  },
  {
    id: "moonshot",
    code: "713",
    name: "Moonshot",
    body: "#f2f2ee",
    back: "#e6e6e1",
    knob: "#c9c9c3",
    main: "#d63a2e",
    action: "#2b2b2b",
    pills: "#2b2b2b",
    label: "#8a8a86",
    logo: "#d63a2e",
    cardBg: "#f3f3ef",
    cardInk: "#d2382c",
    cardSub: "rgba(40,44,52,0.5)",
  },
  {
    id: "mint",
    code: "224",
    name: "Wisteria",
    body: "#c2e9d3",
    back: "#a9dcc1",
    skin: "/assets/wisteria-skin.png",
    knob: "#8587ef",
    main: "#8587ef",
    action: "#5fbcee",
    pills: "#8bbaa2",
    label: "#4a7060",
    logo: "#0f5132",
    cardBg: "#c2e9d3",
    cardInk: "#6f72e8",
    cardSub: "rgba(20,72,50,0.6)",
    cardImage: "/assets/wisteria-skin.png",
  },
  {
    id: "carbon",
    code: "212",
    name: "Carbon",
    body: "#16171b",
    back: "#101115",
    knob: "#f2c044",
    main: "#f2c044",
    action: "#2a2d34",
    pills: "#2a2d34",
    label: "#9296a0",
    logo: "#e6b740",
    cardBg: "#15161a",
    cardInk: "#e6b450",
    cardSub: "rgba(228,200,140,0.55)",
  },
  {
    id: "cyberpunk",
    code: "2077",
    name: "Cyberpunk",
    body: "#cf42cf",
    back: "#b943b9",
    knob: "#efd53f",
    main: "#00e5cc",
    bezelInk: "#7a0f4d",
    action: "#4c2399",
    pills: "#9e75f2",
    label: "#e8e8f0",
    logo: "#08cdb6",
    cardBg: "#cf42cf",
    cardInk: "#00e5cc",
    cardSub: "rgba(255,255,255,0.72)",
  },
];

export const DEFAULT_PRESET = "classic";

export const THEMES_BY_ID: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

const DEFAULT_THEME = THEMES_BY_ID[DEFAULT_PRESET];

/** Customizable parts. `wheel` has no tab and is ignored by `isCustomized`. */
export const PART_KEYS: PartKey[] = [
  "body",
  "play",
  "buttons",
  "knob",
  "wheel",
  "glow",
];

/** Swatches for body / play / buttons / knob. */
export const BODY_SWATCHES: Swatch[] = [
  { name: "Cream", hex: "#e9dbbf" },
  { name: "Red", hex: "#d63a2e" },
  { name: "Orange", hex: "#ff7a1a" },
  { name: "Gold", hex: "#f2c044" },
  { name: "Green", hex: "#2fbf62" },
  { name: "Teal", hex: "#2ec5c9" },
  { name: "Blue", hex: "#3568c9" },
  { name: "Purple", hex: "#7a5cff" },
  { name: "Pink", hex: "#ff7ba9" },
  { name: "White", hex: "#f2f2ee" },
  { name: "Grey", hex: "#8a8d93" },
  { name: "Black", hex: "#1a1b1e" },
];

/** Swatches for the button bloom color. */
export const GLOW_SWATCHES: Swatch[] = [
  { name: "Cream", hex: "#f2e4c2" },
  { name: "Coral", hex: "#ff8577" },
  { name: "Orange", hex: "#ffa24d" },
  { name: "Gold", hex: "#f7cd4f" },
  { name: "Mint", hex: "#4ee88a" },
  { name: "Teal", hex: "#45dee2" },
  { name: "Sky", hex: "#6cb2ff" },
  { name: "Lavender", hex: "#b39dff" },
  { name: "Pink", hex: "#ff9dc4" },
  { name: "White", hex: "#f4f4f0" },
  { name: "Silver", hex: "#c9ccd2" },
  { name: "Lime", hex: "#cfe84e" },
];

/** Relative luminance of a `#rrggbb` color. */
export function luminance(hex: string): number {
  const t = hex.replace("#", "");
  if (t.length !== 6) return 1;
  const r = parseInt(t.slice(0, 2), 16) / 255;
  const g = parseInt(t.slice(2, 4), 16) / 255;
  const b = parseInt(t.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pick dark or light ink depending on how bright the backing color is. */
export function inkFor(hex: string, dark = "#373737", light = "#e8e6df"): string {
  return hex.replace("#", "").length === 6 && luminance(hex) > 0.58 ? dark : light;
}

/** Page backdrop behind the console — explicit, or body mixed 15% into #0b0b0c. */
export function ambientFor(theme: Theme): string {
  if (theme.ambient) return theme.ambient;
  const t = theme.body.replace("#", "");
  if (t.length !== 6) return "#0b0b0c";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  const mix = (channel: number, base: number) =>
    Math.round(channel * 0.15 + base * 0.85)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r, 11)}${mix(g, 11)}${mix(b, 12)}`;
}

/** True when the user has actually recolored something (`wheel` doesn't count). */
export function isCustomized(custom: ConsoleCustom): boolean {
  return (
    !!custom.parts &&
    Object.entries(custom.parts).some(
      ([key, value]) => key !== "wheel" && value !== undefined,
    )
  );
}

/** Schema check for a persisted `toko_console_custom` blob. */
export function isValidCustom(value: unknown): value is ConsoleCustom {
  if (typeof value !== "object" || !value || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.preset !== "string") return false;
  if (!Object.prototype.hasOwnProperty.call(THEMES_BY_ID, candidate.preset)) {
    return false;
  }
  if (Object.keys(candidate).some((k) => k !== "preset" && k !== "parts")) {
    return false;
  }
  if (candidate.parts === undefined) return true;
  if (
    typeof candidate.parts !== "object" ||
    candidate.parts === null ||
    Array.isArray(candidate.parts)
  ) {
    return false;
  }
  return Object.entries(candidate.parts as Record<string, unknown>).every(
    ([key, index]) =>
      PART_KEYS.includes(key as PartKey) &&
      Number.isInteger(index) &&
      (index as number) >= 0 &&
      (index as number) < BODY_SWATCHES.length,
  );
}

/**
 * Resolve `{preset, parts}` into a concrete theme.
 *
 * Recoloring the body drops the skin and the metallic/clear material modes —
 * you can't repaint a gold or transparent shell — and re-derives the silkscreen
 * ink from the new body's luminance.
 */
export function resolveTheme(custom: ConsoleCustom): Theme {
  const preset = THEMES_BY_ID[custom.preset] ?? DEFAULT_THEME;
  const parts = custom.parts;
  if (!parts || !isCustomized(custom)) return preset;

  const swatch = (index: number | undefined) =>
    index === undefined ? undefined : BODY_SWATCHES[index]?.hex;

  const resolved: Theme = { ...preset };

  const body = swatch(parts.body);
  if (body) {
    resolved.body = body;
    resolved.back = body;
    delete resolved.skin;
    delete resolved.metallic;
    delete resolved.clear;
    delete resolved.ambient;
    delete resolved.cardImage;
    resolved.label = inkFor(body, "#4a463c", "#e8e6df");
    resolved.logo = inkFor(body, "#2a2a2e", "#f0efe8");
  }
  if (body || parts.play !== undefined) delete resolved.bezelInk;

  const play = swatch(parts.play);
  if (play) resolved.main = play;

  const buttons = swatch(parts.buttons);
  if (buttons) {
    resolved.action = buttons;
    resolved.pills = buttons;
  }

  const knob = swatch(parts.knob);
  if (knob) resolved.knob = knob;

  const glow =
    parts.glow === undefined ? undefined : GLOW_SWATCHES[parts.glow]?.hex;
  if (glow) resolved.glow = glow;

  resolved.cardBg = resolved.body;
  resolved.cardInk = inkFor(resolved.body, "#26221a", "#f4f3ee");
  resolved.cardSub = inkFor(
    resolved.body,
    "rgba(38,34,26,0.6)",
    "rgba(244,243,238,0.6)",
  );

  return resolved;
}

export const STORAGE_KEY_CUSTOM = "toko_console_custom";
export const STORAGE_KEY_PRESET = "toko_console_theme";

/** Fast, SSR-safe read of just the preset id. */
export function readStoredPreset(): string {
  if (typeof window === "undefined") return DEFAULT_PRESET;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PRESET);
    const parsed = raw == null ? DEFAULT_PRESET : JSON.parse(raw);
    return Object.prototype.hasOwnProperty.call(THEMES_BY_ID, parsed)
      ? parsed
      : DEFAULT_PRESET;
  } catch {
    return DEFAULT_PRESET;
  }
}

/** Full read of the persisted customization, falling back to the preset key. */
export function readStoredCustom(): ConsoleCustom {
  if (typeof window === "undefined") return { preset: DEFAULT_PRESET };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CUSTOM);
    const parsed = raw == null ? null : JSON.parse(raw);
    if (parsed && isValidCustom(parsed)) return parsed;
  } catch {
    // fall through
  }
  return { preset: readStoredPreset() };
}

export function writeStoredCustom(custom: ConsoleCustom) {
  try {
    window.localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(custom));
    window.localStorage.setItem(
      STORAGE_KEY_PRESET,
      JSON.stringify(custom.preset),
    );
  } catch {
    // storage unavailable — the theme just won't persist
  }
}

/** Button bloom color: explicit override, else the Play key color. */
export function glowFor(theme: Theme): string {
  return theme.glow ?? theme.main;
}
