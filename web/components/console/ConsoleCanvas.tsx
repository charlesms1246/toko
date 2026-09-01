"use client";

/**
 * The TOKO console.
 *
 * Vanilla three.js, built imperatively into a canvas — no react-three-fiber and
 * no model files. Every part is generated at runtime from primitives: the shell
 * is one extruded rounded rectangle with holes punched for the keys, the knob
 * pocket, the thumbwheel and the screen; the knob is a lathed profile with a
 * procedurally drawn bump map; the environment map is a tiny baked studio.
 *
 * The screen itself is NOT rendered here — it is a DOM subtree layered under the
 * transparent canvas. Each frame we project the screen cutout to screen space
 * and write its rect onto `screenElRef`, so ordinary React UI appears to live
 * inside the device.
 */

import { useEffect, useRef } from "react";
import { useLatest } from "@/lib/react/hooks";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  BACK_DEPTH,
  BACK_PLATE_TEXT,
  BACK_Z,
  BAND_W,
  BODY_BEVEL,
  BODY_CORNER,
  BODY_DEPTH,
  BODY_H,
  BODY_W,
  BUTTON_KEYS,
  BUTTON_POS,
  BUTTON_SPECS,
  ButtonKey,
  GROUP_Z,
  HARDWARE_COLORS,
  KNOB,
  KNOB_POCKET,
  LIGHTS,
  SCREEN_CORNER,
  SCREEN_POLY,
  SCREEN_Y_OFFSET,
  SEAM_Z,
  SILKSCREEN_FONT,
  WHEEL_POCKET,
  bodyCenterY,
  toX,
  toY,
} from "@/lib/console/geometry";
import { Theme, glowFor } from "@/lib/console/themes";

// ── Shape helpers ────────────────────────────────────────────────────────────

/** Rounded rectangle as a Shape, centred on the origin. */
/** The brand mark's own background tile — skipped when it is put on a key. */
const MARK_TILE_FILL = "#ffc016";

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const radius = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + h - radius);
  shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  shape.lineTo(x + radius, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** Rounded rectangle as a Path, for use as a hole. */
function roundedRectHole(
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
): THREE.Path {
  const path = new THREE.Path();
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = Math.min(r, w / 2, h / 2);
  path.moveTo(x + radius, y);
  path.quadraticCurveTo(x, y, x, y + radius);
  path.lineTo(x, y + h - radius);
  path.quadraticCurveTo(x, y + h, x + radius, y + h);
  path.lineTo(x + w - radius, y + h);
  path.quadraticCurveTo(x + w, y + h, x + w, y + h - radius);
  path.lineTo(x + w, y + radius);
  path.quadraticCurveTo(x + w, y, x + w - radius, y);
  path.lineTo(x + radius, y);
  return path;
}

type Pt = { x: number; y: number };

/** Trace a corner-rounded polygon into an existing Path or Shape. */
function traceRoundedPoly(path: THREE.Path, pts: Pt[], r: number) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];

    let inX = cur.x - prev.x;
    let inY = cur.y - prev.y;
    const inLen = Math.hypot(inX, inY);
    inX /= inLen;
    inY /= inLen;

    let outX = next.x - cur.x;
    let outY = next.y - cur.y;
    const outLen = Math.hypot(outX, outY);
    outX /= outLen;
    outY /= outLen;

    const back = Math.min(r, inLen / 2);
    const fwd = Math.min(r, outLen / 2);
    const a = { x: cur.x - inX * back, y: cur.y - inY * back };
    const b = { x: cur.x + outX * fwd, y: cur.y + outY * fwd };

    if (i === 0) path.moveTo(a.x, a.y);
    else path.lineTo(a.x, a.y);
    path.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  path.closePath();
}

/** Corner-rounded polygon as a hole — wound backwards, as holes must be. */
function roundedPolyHole(points: Pt[], r: number): THREE.Path {
  const path = new THREE.Path();
  traceRoundedPoly(path, [...points].reverse(), r);
  return path;
}

/** Corner-rounded polygon as a fillable Shape. */
function roundedPoly(points: Pt[], r: number): THREE.Shape {
  const shape = new THREE.Shape();
  traceRoundedPoly(shape, points, r);
  return shape;
}

/** Extrude a shape and recentre it on Z so its front face sits at z = 0. */
function extrude(
  shape: THREE.Shape,
  depth: number,
  bevel: number,
): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 12,
    curveSegments: 48,
  });
  geo.computeBoundingBox();
  geo.translate(0, 0, -geo.boundingBox!.max.z);
  geo.computeVertexNormals();
  return geo;
}

/** Recompute planar UVs from the bounding box so skins map predictably. */
function planarUV(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h);
  }
  uv.needsUpdate = true;
}

/** Screen outline in world space. */
function screenPoints(extend = 0): Pt[] {
  return SCREEN_POLY.map((p) => ({
    x: toX(p.x),
    y: toY(p.y) + SCREEN_Y_OFFSET + (p.y === 30 ? extend : 0),
  }));
}

// ── Procedural textures ──────────────────────────────────────────────────────

/** 128x128 groove pattern for the knob's bump map. */
function knobBumpTexture(): {
  texture: THREE.CanvasTexture;
  redraw: () => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const redraw = () => {
    const image = ctx.createImageData(128, 128);
    const period = KNOB.ridgeWidth + KNOB.grooveWidth;
    const margin = (1 - KNOB.ridgeLength) / 2;
    const top = margin * 128;
    const bottom = (1 - margin) * 128;
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        let v = 255;
        if (y >= top && y <= bottom) {
          const phase = x % period;
          if (phase < KNOB.grooveWidth) {
            const t = phase / KNOB.grooveWidth;
            v = Math.round((1 - Math.sin(t * Math.PI)) * KNOB.cornerCurve * 255);
          }
        }
        const i = (y * 128 + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    texture.needsUpdate = true;
  };

  redraw();
  texture.repeat.set(KNOB.ridgeRepeat, 1);
  return { texture, redraw };
}

/** Soft radial falloff, used for the button bloom planes. */
function radialGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Silkscreen printed on the back plate. Drawn in white so the material color
 * can tint it to whatever the current theme's label ink is.
 */
function backPlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 1024, 512);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  ctx.font = `700 66px ${SILKSCREEN_FONT}`;
  ctx.fillText(BACK_PLATE_TEXT.model, 512, 190);

  ctx.globalAlpha = 0.72;
  ctx.font = `600 34px ${SILKSCREEN_FONT}`;
  ctx.fillText(BACK_PLATE_TEXT.line2, 512, 260);

  ctx.globalAlpha = 0.5;
  ctx.font = `500 28px ${SILKSCREEN_FONT}`;
  ctx.fillText(BACK_PLATE_TEXT.line3, 512, 320);
  ctx.fillText(BACK_PLATE_TEXT.footer, 512, 380);
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Key captions (MENU / HOME) printed beside the pill keys. */
function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 34px ${SILKSCREEN_FONT}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(text, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The same silkscreen, but two-tone: white letters with a dark halo.
 *
 * An action cap can be any colour a preset or a game asks for, and a selected
 * key blooms almost to white — so a single-tone caption disappears on one state
 * or the other. Carrying both tones in the texture means the material is not
 * tinted at all and the label reads on every cap.
 */
function capLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 34px ${SILKSCREEN_FONT}`;
  ctx.letterSpacing = "3px";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(8,8,6,0.92)";
  ctx.lineWidth = 7;
  ctx.strokeText(text, 128, 34);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A tiny studio scene baked to an environment map — no HDRI file. */
function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0946);

  const softbox = (
    color: number,
    intensity: number,
    w: number,
    h: number,
    pos: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
      }),
    );
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  softbox(0xffffff, 3.2, 10, 10, [0, 6, 4]);
  softbox(0xfff0d0, 2.1, 8, 12, [-7, 2, 5]);
  softbox(0xd6e6ff, 1.6, 8, 12, [7, 1, 4]);
  softbox(0xffffff, 1.1, 12, 6, [0, -5, 5]);
  softbox(0x9fb4ff, 0.8, 10, 10, [0, 0, -8]);
  softbox(0xffe9cf, 1.3, 6, 6, [3, 5, -3]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
  return target.texture;
}

// ── Component ────────────────────────────────────────────────────────────────

export interface ConsoleKeyView {
  color: string;
  glow: string;
  /** 0..1 bloom, driven by pulse / light show. */
  intensity: number;
}

export interface ConsoleCanvasProps {
  theme: Theme;
  /** Called on key-down, before the release animation. */
  onPress?: (key: ButtonKey) => void;
  /** Knob drag, in detents (positive = clockwise / up). */
  onKnobStep?: (steps: number) => void;
  /** Thumbwheel drag, in detents. */
  onWheelStep?: (steps: number) => void;
  /** Element that receives the projected screen rect. */
  screenElRef?: React.RefObject<HTMLElement | null>;
  /** Which keys should be lit, and how brightly. */
  keyGlow?: Partial<Record<ButtonKey, number>>;
  /**
   * Silkscreen under the two action keys. The pills are captioned MENU and
   * HOME because they are fixed hardware; these two are not, so they say what
   * the screen you are on has programmed them to do.
   */
  actionLabels?: { action1?: string; action2?: string };
  /** Attract mode — dims the device slightly behind the PRESS START marquee. */
  idle?: boolean;
  /**
   * Keep the drawing buffer around after each frame so the canvas can be read
   * back with `toDataURL`. Costs memory, so it is opt-in.
   */
  exportMode?: boolean;
  className?: string;
}

interface KeyMesh extends THREE.Mesh {
  userData: {
    kind: "button";
    key: ButtonKey;
    baseZ: number;
    pressedZ: number;
    pressed: boolean;
    glow: number;
    target: number;
  };
}

export default function ConsoleCanvas({
  theme,
  onPress,
  onKnobStep,
  onWheelStep,
  screenElRef,
  keyGlow,
  actionLabels,
  idle = false,
  exportMode = false,
  className,
}: ConsoleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Mutable scene handles, shared between the build effect and the update
  // effects. Applying a theme mutates materials in place — no scene rebuild.
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    tilt: THREE.Group;
    device: THREE.Group;
    keys: KeyMesh[];
    keyGlowPlanes: Map<ButtonKey, THREE.Mesh>;
    bodyMat: THREE.MeshPhysicalMaterial;
    backMat: THREE.MeshPhysicalMaterial;
    knobMat: THREE.MeshStandardMaterial;
    knobSpin: THREE.Group;
    wheelSpin: THREE.Group;
    logoMats: THREE.MeshStandardMaterial[];
    logoEyeMats: THREE.MeshStandardMaterial[];
    backPlateMat: THREE.MeshBasicMaterial;
    labelMats: THREE.MeshBasicMaterial[];
    actionCaptions: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      text: string;
    }[];
    envMap: THREE.Texture;
    invalidate: () => void;
    setKeyColors: (theme: Theme) => void;
  } | null>(null);

  const handlers = useLatest({ onPress, onKnobStep, onWheelStep });

  // Latest glow map, readable from inside the build closure.
  const keyGlowRef = useLatest<Partial<Record<ButtonKey, number>>>(keyGlow ?? {});

  // Read once when the scene is built; changing it later would need a rebuild.
  const exportModeRef = useRef(exportMode);

  // ── Build ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: exportModeRef.current,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    const envMap = buildEnvironment(renderer);

    // Lights
    scene.add(
      new THREE.HemisphereLight(
        LIGHTS.hemi.sky,
        LIGHTS.hemi.ground,
        LIGHTS.hemi.intensity,
      ),
    );
    scene.add(
      new THREE.AmbientLight(LIGHTS.ambient.color, LIGHTS.ambient.intensity),
    );

    const key = new THREE.DirectionalLight(
      LIGHTS.key.color,
      LIGHTS.key.intensity,
    );
    key.position.set(...LIGHTS.key.position);
    key.castShadow = true;
    key.shadow.mapSize.set(LIGHTS.key.shadowMapSize, LIGHTS.key.shadowMapSize);
    key.shadow.radius = LIGHTS.key.shadowRadius;
    key.shadow.bias = LIGHTS.key.bias;
    key.shadow.normalBias = LIGHTS.key.normalBias;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    scene.add(key);

    const fill = new THREE.DirectionalLight(
      LIGHTS.fill.color,
      LIGHTS.fill.intensity,
    );
    fill.position.set(...LIGHTS.fill.position);
    scene.add(fill);

    // Group hierarchy: tilt (pointer/orientation lean) > device (model space)
    const tilt = new THREE.Group();
    scene.add(tilt);
    const device = new THREE.Group();
    device.position.z = GROUP_Z;
    tilt.add(device);

    const centerY = bodyCenterY(0);
    const centerX = toX(585);
    const disposables: Array<{ dispose: () => void }> = [];

    // ── Front shell, with every cutout punched through ──────────────────────
    const bodyShape = roundedRect(BODY_W, BODY_H, BODY_CORNER);
    BUTTON_POS.forEach((pos, i) => {
      const spec = BUTTON_SPECS[i];
      const x = toX(pos.x) + spec.dx - centerX;
      const y = toY(pos.y) + spec.dy - centerY;
      const w = spec.w + spec.pad * 2;
      const h = spec.h + spec.pad * 2;
      bodyShape.holes.push(
        roundedRectHole(x, y, w, h, Math.min(spec.r + spec.pad, w / 2, h / 2)),
      );
    });
    for (const pocket of [KNOB_POCKET, WHEEL_POCKET]) {
      const w = pocket.w + pocket.pad * 2;
      const h = pocket.h + pocket.pad * 2;
      bodyShape.holes.push(
        roundedRectHole(
          toX(pocket.px) - centerX,
          toY(pocket.py) - centerY,
          w,
          h,
          Math.min(pocket.r + pocket.pad, w / 2, h / 2),
        ),
      );
    }
    bodyShape.holes.push(
      roundedPolyHole(
        screenPoints().map((p) => ({ x: p.x - centerX, y: p.y - centerY })),
        SCREEN_CORNER,
      ),
    );

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: theme.body,
      roughness: 0.82,
      metalness: 0,
    });
    const bodyGeo = extrude(bodyShape, BODY_DEPTH, BODY_BEVEL);
    planarUV(bodyGeo);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(centerX, centerY, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    device.add(body);
    disposables.push(bodyGeo, bodyMat);

    // ── Back shell ──────────────────────────────────────────────────────────
    const backMat = new THREE.MeshPhysicalMaterial({
      color: theme.body,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const backGeo = extrude(
      roundedRect(BODY_W, BODY_H, BODY_CORNER),
      BACK_DEPTH,
      BODY_BEVEL,
    );
    // The back shell has no screen cutout, so it would block the DOM screen
    // showing through the hole. It stays hidden unless the device is turned
    // around — exactly as the original does.
    const backGroup = new THREE.Group();
    backGroup.visible = false;
    device.add(backGroup);

    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(centerX, centerY, BACK_Z);
    back.castShadow = true;
    back.receiveShadow = true;
    backGroup.add(back);
    disposables.push(backGeo, backMat);
    backGeo.computeBoundingBox();
    const backMinZ = backGeo.boundingBox!.min.z;

    // Silkscreen on the back plate
    const backPlateTex = backPlateTexture();
    const backPlateMat = new THREE.MeshBasicMaterial({
      map: backPlateTex,
      color: new THREE.Color(theme.label),
      transparent: true,
      opacity: 0.85,
    });
    const backPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      backPlateMat,
    );
    backPlate.position.set(centerX, centerY - 3.4, backMinZ - 0.01);
    backPlate.rotation.y = Math.PI;
    backGroup.add(backPlate);
    disposables.push(backPlateTex, backPlateMat, backPlate.geometry);

    // ── Side band / seam ────────────────────────────────────────────────────
    const bandMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.metalBand,
      metalness: 0.85,
      roughness: 0.34,
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.seam,
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    // A frame, not a plate — anything solid here would sit behind the screen
    // cutout and hide the DOM screen.
    const bandShape = roundedRect(BAND_W, BODY_H + 0.16, BODY_CORNER + 0.08);
    bandShape.holes.push(
      roundedRectHole(0, 0, BODY_W - 0.12, BODY_H - 0.12, BODY_CORNER),
    );
    const bandGeo = extrude(bandShape, 0.08, 0);
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(centerX, centerY, SEAM_Z + 0.3);
    band.receiveShadow = true;
    device.add(band);
    disposables.push(bandGeo, bandMat, seamMat);

    // ── Keys ────────────────────────────────────────────────────────────────
    const pocketMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.recess,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    disposables.push(pocketMat);

    const trimMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.trimRing,
      metalness: 0.82,
      roughness: 0.34,
    });
    const screwMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.trimScrew,
      metalness: 0.9,
      roughness: 0.28,
    });
    const screwGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.04, 16);
    screwGeo.rotateX(Math.PI / 2);
    disposables.push(trimMat, screwMat, screwGeo);

    const glowTex = radialGlowTexture();
    disposables.push(glowTex);

    const keys: KeyMesh[] = [];
    const keyGlowPlanes = new Map<ButtonKey, THREE.Mesh>();

    const keyColorFor = (t: Theme, k: ButtonKey) =>
      k === "play"
        ? t.main
        : k === "action1" || k === "action2"
          ? t.action
          : t.pills;

    BUTTON_KEYS.forEach((keyName, i) => {
      const spec = BUTTON_SPECS[i];
      const pos = BUTTON_POS[i];
      const x = toX(pos.x) + spec.dx;
      const y = toY(pos.y) + spec.dy;

      // Pocket floor
      const floorW = spec.w + spec.pad * 2 - 0.04;
      const floorH = spec.h + spec.pad * 2 - 0.04;
      const floor = new THREE.Mesh(
        new THREE.ShapeGeometry(
          roundedRect(
            floorW,
            floorH,
            Math.min(spec.r + spec.pad, floorW / 2, floorH / 2),
          ),
          48,
        ),
        pocketMat,
      );
      floor.position.set(x, y, -0.04);
      floor.receiveShadow = true;
      device.add(floor);
      disposables.push(floor.geometry);

      // Key cap
      const capMat = new THREE.MeshStandardMaterial({
        color: keyColorFor(theme, keyName),
        roughness: 0.5,
        metalness: 0,
        emissive: new THREE.Color(glowFor(theme)),
        emissiveIntensity: 0,
      });
      const capGeo = extrude(
        roundedRect(spec.w, spec.h, spec.r),
        spec.depth,
        0.06,
      );
      const cap = new THREE.Mesh(capGeo, capMat) as unknown as KeyMesh;
      cap.position.set(x, y, spec.baseZ);
      cap.castShadow = true;
      cap.receiveShadow = true;
      cap.userData = {
        kind: "button",
        key: keyName,
        baseZ: spec.baseZ,
        pressedZ: spec.pressedZ,
        pressed: false,
        glow: 0,
        target: 0,
      };
      device.add(cap);
      keys.push(cap);
      disposables.push(capGeo, capMat);

      // Metal bezel ring + corner screws around the two action keys
      if (keyName === "action1" || keyName === "action2") {
        const ringW = spec.w + spec.pad * 2 - 0.06;
        const ringH = spec.h + spec.pad * 2 - 0.06;
        const inset = 0.1;
        const ringShape = roundedRect(ringW, ringH, 0.18);
        ringShape.holes.push(
          roundedRectHole(0, 0, ringW - inset * 2, ringH - inset * 2, 0.13),
        );
        const ringGeo = extrude(ringShape, 0.22, 0.025);
        const ring = new THREE.Mesh(ringGeo, trimMat);
        ring.position.set(x, y, spec.baseZ + 0.18);
        ring.castShadow = true;
        ring.receiveShadow = true;
        device.add(ring);
        disposables.push(ringGeo);

        const sx = ringW / 2 - 0.095;
        const sy = ringH / 2 - 0.095;
        for (const [dx, dy] of [
          [-sx, sy],
          [sx, sy],
          [-sx, -sy],
          [sx, -sy],
        ]) {
          const screw = new THREE.Mesh(screwGeo, screwMat);
          screw.position.set(x + dx, y + dy, spec.baseZ + 0.19);
          device.add(screw);
        }
      }

      // Bloom plane above the key
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        color: new THREE.Color(glowFor(theme)),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.w * 2.6, spec.h * 2.6),
        glowMat,
      );
      glowPlane.position.set(x, y, spec.baseZ + spec.depth + 0.05);
      device.add(glowPlane);
      keyGlowPlanes.set(keyName, glowPlane);
      disposables.push(glowPlane.geometry, glowMat);
    });

    // Action-key captions. Same silkscreen treatment as the pills, but their
    // text changes with the route, so the plane is kept and its texture swapped.
    const actionCaptions: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      text: string;
    }[] = [];
    ([1, 2] as const).forEach((i) => {
      const spec = BUTTON_SPECS[i];
      // White ink: the caption now sits on the cap, which is the action colour
      // in every preset, not on the body the silkscreen palette was chosen for.
      const mat = new THREE.MeshBasicMaterial({
        map: capLabelTexture(""),
        color: new THREE.Color("#ffffff"),
        transparent: true,
        opacity: 1,
      });
      // On the cap, not under it — and parented to the cap so it travels with
      // the key on every press, the way the brand mark rides the Play key.
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * 0.82, spec.w * 0.205), mat);
      mesh.position.set(0, 0, spec.depth / 2 + 0.08);
      const cap = keys.find((k) => k.userData.key === BUTTON_KEYS[i]);
      (cap ?? device).add(mesh);
      actionCaptions.push({ mesh, mat, text: "" });
      disposables.push(mesh.geometry, mat);
    });

    // Pill captions
    const labelMats: THREE.MeshBasicMaterial[] = [];
    (
      [
        ["MENU", 3],
        ["HOME", 4],
      ] as const
    ).forEach(([text, i]) => {
      const spec = BUTTON_SPECS[i];
      const pos = BUTTON_POS[i];
      const tex = labelTexture(text);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: new THREE.Color(theme.label),
        transparent: true,
        opacity: 0.9,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), mat);
      plane.position.set(
        toX(pos.x),
        toY(pos.y) - spec.h / 2 - spec.pad - 0.16,
        0.02,
      );
      device.add(plane);
      labelMats.push(mat);
      disposables.push(tex, mat, plane.geometry);
    });

    // ── Knob ────────────────────────────────────────────────────────────────
    const knobFloorW = KNOB_POCKET.w + KNOB_POCKET.pad * 2 - 0.04;
    const knobFloorH = KNOB_POCKET.h + KNOB_POCKET.pad * 2 - 0.04;
    const knobFloor = new THREE.Mesh(
      new THREE.ShapeGeometry(
        roundedRect(
          knobFloorW,
          knobFloorH,
          Math.min(
            KNOB_POCKET.r + KNOB_POCKET.pad,
            knobFloorW / 2,
            knobFloorH / 2,
          ),
        ),
        48,
      ),
      pocketMat,
    );
    knobFloor.position.set(
      toX(KNOB_POCKET.px),
      toY(KNOB_POCKET.py),
      -0.54,
    );
    knobFloor.receiveShadow = true;
    device.add(knobFloor);
    disposables.push(knobFloor.geometry);

    const { texture: knobBump, redraw: redrawKnobBump } = knobBumpTexture();
    void redrawKnobBump;
    const knobMat = new THREE.MeshStandardMaterial({
      color: theme.knob,
      roughness: 0.88,
      metalness: 0,
      bumpMap: knobBump,
      bumpScale: KNOB.bumpScale,
    });
    disposables.push(knobBump, knobMat);

    const knobProfile = () => {
      const { radius, height, edgeCurve } = KNOB;
      const pts: THREE.Vector2[] = [new THREE.Vector2(0, -height / 2)];
      for (let i = 0; i <= 12; i++) {
        const a = -Math.PI / 2 + (i / 12) * (Math.PI / 2);
        pts.push(
          new THREE.Vector2(
            radius - edgeCurve + edgeCurve * Math.cos(a),
            -height / 2 + edgeCurve + edgeCurve * Math.sin(a),
          ),
        );
      }
      pts.push(new THREE.Vector2(radius, height / 2 - edgeCurve));
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * (Math.PI / 2);
        pts.push(
          new THREE.Vector2(
            radius - edgeCurve + edgeCurve * Math.cos(a),
            height / 2 - edgeCurve + edgeCurve * Math.sin(a),
          ),
        );
      }
      pts.push(new THREE.Vector2(0, height / 2));
      return pts;
    };

    // The lathe axis is Y; the outer group turns it on its side so the wheel
    // reads as a vertical dial, and the inner group carries the spin.
    const knobMount = new THREE.Group();
    knobMount.rotation.z = Math.PI / 2;
    knobMount.position.set(toX(KNOB_POCKET.px), toY(KNOB_POCKET.py), -0.5);
    device.add(knobMount);

    const knobSpin = new THREE.Group();
    knobMount.add(knobSpin);

    const knobGeo = new THREE.LatheGeometry(knobProfile(), 64);
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.castShadow = true;
    knob.receiveShadow = true;
    knob.userData = { kind: "knob" };
    knobSpin.add(knob);
    disposables.push(knobGeo);

    // ── Thumbwheel ──────────────────────────────────────────────────────────
    const wheelFloorW = WHEEL_POCKET.w + WHEEL_POCKET.pad * 2 - 0.04;
    const wheelFloorH = WHEEL_POCKET.h + WHEEL_POCKET.pad * 2 - 0.04;
    const wheelFloor = new THREE.Mesh(
      new THREE.ShapeGeometry(
        roundedRect(
          wheelFloorW,
          wheelFloorH,
          Math.min(
            WHEEL_POCKET.r + WHEEL_POCKET.pad,
            wheelFloorW / 2,
            wheelFloorH / 2,
          ),
        ),
        48,
      ),
      pocketMat,
    );
    wheelFloor.position.set(toX(WHEEL_POCKET.px), toY(WHEEL_POCKET.py), -0.24);
    wheelFloor.receiveShadow = true;
    device.add(wheelFloor);
    disposables.push(wheelFloor.geometry);

    const wheelBezelShape = roundedRect(
      WHEEL_POCKET.w,
      WHEEL_POCKET.h,
      WHEEL_POCKET.r,
    );
    wheelBezelShape.holes.push(roundedRectHole(0, 0, 0.78, 0.74, 0.085));
    const wheelBezelMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.wheelBezel,
      roughness: 0.58,
      metalness: 0.08,
    });
    const wheelBezelGeo = extrude(wheelBezelShape, 0.24, 0.025);
    const wheelBezel = new THREE.Mesh(wheelBezelGeo, wheelBezelMat);
    wheelBezel.position.set(toX(WHEEL_POCKET.px), toY(WHEEL_POCKET.py), 0.12);
    wheelBezel.castShadow = true;
    wheelBezel.receiveShadow = true;
    device.add(wheelBezel);
    disposables.push(wheelBezelGeo, wheelBezelMat);

    const wheelMount = new THREE.Group();
    wheelMount.rotation.z = Math.PI / 2;
    wheelMount.position.set(toX(WHEEL_POCKET.px), toY(WHEEL_POCKET.py), -0.14);
    device.add(wheelMount);

    const wheelSpin = new THREE.Group();
    wheelMount.add(wheelSpin);

    const wheelDrumMat = new THREE.MeshStandardMaterial({
      color: HARDWARE_COLORS.wheelDrum,
      roughness: 0.42,
      metalness: 0.18,
      bumpMap: knobBump,
      bumpScale: 12,
    });
    const wheelDrumGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.76, 64, 1, false);
    const wheelDrum = new THREE.Mesh(wheelDrumGeo, wheelDrumMat);
    wheelDrum.castShadow = true;
    wheelDrum.userData = { kind: "wheel" };
    wheelSpin.add(wheelDrum);
    disposables.push(wheelDrumGeo, wheelDrumMat);

    // ── Screen glass ────────────────────────────────────────────────────────
    // The screen is DOM, layered *under* this canvas, so the cover glass has to
    // stay genuinely see-through: an additive sheen only, never a fill.
    const sheenTex = radialGlowTexture();
    const glassMat = new THREE.MeshBasicMaterial({
      map: sheenTex,
      color: 0xbcd4ff,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glassGeo = new THREE.ShapeGeometry(
      roundedPoly(screenPoints(), SCREEN_CORNER),
      32,
    );
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0, 0.07);
    device.add(glass);
    disposables.push(glassGeo, glassMat, sheenTex);

    // ── TOKO mark on the main key ───────────────────────────────────────────
    // Added as a *child* of the cap so it travels with the key on every press
    // rather than floating above a moving surface. The mark's own yellow
    // backing plate is skipped — here the key is the plate — leaving the glyph
    // and its eyes, which is the same fill convention the carved back logo
    // reads: near-black letters, white eyes.
    let markDisposed = false;
    const playCap = keys.find((k) => k.userData.key === "play");
    if (playCap) {
      new SVGLoader().load(
        "/assets/logos/toko-mark.svg",
        (data) => {
          if (markDisposed) return;
          const SRC = 512;
          const playSpec = BUTTON_SPECS[BUTTON_KEYS.indexOf("play")];
          // Wide enough to read at a glance, small enough to leave the cap's
          // bevel and highlight visible.
          const scale = (playSpec.w * 0.62) / SRC;

          const group = new THREE.Group();
          // SVG's y axis runs the other way; z is scaled too so the relief
          // depth below stays in source units like everything else here.
          group.scale.set(scale, -scale, scale);

          // Colours come from the mark's own fills rather than the hardware
          // palette, so the key always carries the real brand mark — and stays
          // right if the asset is ever redrawn.
          const markMats = new Map<string, THREE.MeshStandardMaterial>();
          const matFor = (fill: string, isEye: boolean) => {
            let mat = markMats.get(fill);
            if (!mat) {
              mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(fill),
                roughness: isEye ? 0.55 : 0.72,
                metalness: 0,
              });
              markMats.set(fill, mat);
              disposables.push(mat);
            }
            return mat;
          };

          for (const path of data.paths) {
            const style = path.userData?.style as { fill?: string } | undefined;
            const fill = (style?.fill ?? "").toLowerCase();
            if (!fill || fill === "none") continue;
            // The mark ships on its own rounded tile; here the key *is* the tile.
            if (fill === MARK_TILE_FILL) continue;
            const isEye = fill === "#ffffff" || fill === "#fff";
            for (const shape of SVGLoader.createShapes(path)) {
              const geo = new THREE.ExtrudeGeometry(shape, {
                depth: 10,
                bevelEnabled: false,
              });
              const mesh = new THREE.Mesh(geo, matFor(fill, isEye));
              // Eyes sit a hair proud of the glyph so they never z-fight it.
              if (isEye) mesh.position.z = 1.5;
              group.add(mesh);
              disposables.push(geo);
            }
          }

          // Centre the glyph on the cap's top face.
          const bounds = new THREE.Box3().setFromObject(group);
          const centre = bounds.getCenter(new THREE.Vector3());
          playCap.geometry.computeBoundingBox();
          const topZ = playCap.geometry.boundingBox?.max.z ?? playSpec.depth;
          group.position.set(-centre.x, -centre.y, topZ);

          playCap.add(group);
          invalidate();
        },
        undefined,
        () => {
          // A missing mark just leaves a plain key.
        },
      );
    }

    // ── Carved back logo ────────────────────────────────────────────────────
    const logoMats: THREE.MeshStandardMaterial[] = [];
    const logoEyeMats: THREE.MeshStandardMaterial[] = [];
    let logoDisposed = false;
    new SVGLoader().load(
      "/assets/logos/toko-horizontal-black.svg",
      (data) => {
        if (logoDisposed) return;
        const SRC_W = 1539;
        const scale = 3.6 / SRC_W;
        const group = new THREE.Group();
        group.scale.set(-scale, -scale, 1);

        const letterMat = new THREE.MeshStandardMaterial({
          color: theme.logo,
          roughness: 0.93,
          metalness: 0,
        });
        const eyeMat = new THREE.MeshStandardMaterial({
          color: theme.logoEyes ?? HARDWARE_COLORS.logoEyes,
          roughness: 0.8,
          metalness: 0,
        });
        logoMats.push(letterMat);
        logoEyeMats.push(eyeMat);

        for (const path of data.paths) {
          const style = path.userData?.style as { fill?: string } | undefined;
          const fill = style?.fill ?? "";
          const isEye =
            fill && fill !== "none" && fill.toLowerCase() !== "#000000";
          for (const shape of SVGLoader.createShapes(path)) {
            const geo = new THREE.ExtrudeGeometry(shape, {
              depth: 0.1,
              bevelEnabled: false,
            });
            geo.computeBoundingBox();
            geo.translate(0, 0, -geo.boundingBox!.max.z);
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, isEye ? eyeMat : letterMat);
            mesh.position.z = isEye ? 0.1 : 0.17;
            group.add(mesh);
            disposables.push(geo);
          }
        }

        const bounds = new THREE.Box3().setFromObject(group);
        const size = bounds.getSize(new THREE.Vector3());
        group.position.set(
          centerX + size.x / 2,
          centerY - 4.6 + size.y / 2,
          backMinZ,
        );
        backGroup.add(group);
        disposables.push(letterMat, eyeMat);
        invalidate();
      },
      undefined,
      () => {
        // A missing logo just means an unbranded back shell.
      },
    );

    // ── Theme application (mutates materials in place) ───────────────────────
    const setKeyColors = (t: Theme) => {
      const glow = new THREE.Color(glowFor(t));
      keys.forEach((k) => {
        const mat = k.material as THREE.MeshStandardMaterial;
        mat.color.set(keyColorFor(t, k.userData.key));
        mat.emissive.copy(glow);
      });
      keyGlowPlanes.forEach((plane) => {
        (plane.material as THREE.MeshBasicMaterial).color.copy(glow);
      });
    };

    // ── Render loop (on demand) ─────────────────────────────────────────────
    let dirty = true;
    let raf = 0;
    let width = 0;
    let height = 0;

    const invalidate = () => {
      dirty = true;
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true;
      dirty = true;
    };

    // Frame the device: fit its height into the viewport with a little margin.
    const frameCamera = () => {
      const halfFov = (camera.fov * Math.PI) / 180 / 2;
      const aspect = Math.max(camera.aspect, 1e-4);
      const fitH = BODY_H / 2 / Math.tan(halfFov);
      const fitW = BODY_W / 2 / (Math.tan(halfFov) * aspect);
      const z = Math.max(fitH, fitW) * 1.06 + GROUP_Z;
      camera.position.set(0, bodyCenterY(0), z);
      camera.lookAt(0, bodyCenterY(0), 0);
    };

    // Screen rect projection -> DOM
    const projected = new THREE.Vector3();
    const syncScreenRect = () => {
      const el = screenElRef?.current;
      if (!el || !width || !height) return;
      device.updateWorldMatrix(true, false);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let stepY = Infinity;
      screenPoints().forEach((p, i) => {
        projected
          .set(p.x, p.y, 0.06)
          .applyMatrix4(device.matrixWorld)
          .project(camera);
        const sx = (projected.x * 0.5 + 0.5) * width;
        const sy = (-projected.y * 0.5 + 0.5) * height;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
        // Points 2 and 3 are the inner corner where the aperture steps up.
        if ((i === 2 || i === 3) && sy < stepY) stepY = sy;
      });
      const w = maxX - minX + 8;
      const h = maxY - minY + 8;
      el.style.left = `${minX - 4}px`;
      el.style.top = `${minY - 4}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      const scale = Math.max(0.4, Math.min(1, w / 340));
      el.style.setProperty("--screen-content-scale", scale.toFixed(4));

      // The aperture is an L: the bottom-right is notched out for the Play key.
      // A page laying out against the bounding box would put content behind
      // that key, so publish two more numbers and let the CSS respect them.
      //
      // `--screen-rim` is the inset the bevel overhangs, proportional to how
      // big the device is drawn. `--screen-notch` is the height of the bottom
      // band the key eats into. Both are divided by the content scale, because
      // the content layer is scaled and these are consumed inside it.
      const rim = Math.max(14, Math.round(0.06 * (maxX - minX))) + 4;
      el.style.setProperty("--screen-rim", `${Math.round(rim / scale)}px`);
      el.style.setProperty(
        "--screen-notch",
        `${Math.round(Math.max(0, maxY + 4 - stepY) / scale)}px`,
      );

      // On the document element, not the stage: the menu drawer is portalled to
      // <body> so it can escape the screen's clipping, and it still needs to
      // know where the hardware is.
      const host = document.documentElement;
      {
        let dMinX = Infinity;
        let dMinY = Infinity;
        let dMaxX = -Infinity;
        let dMaxY = -Infinity;
        const half = BODY_W / 2;
        const centre = bodyCenterY(0);
        for (const [bx, by] of [
          [-half, centre - BODY_H / 2],
          [half, centre - BODY_H / 2],
          [half, centre + BODY_H / 2],
          [-half, centre + BODY_H / 2],
        ]) {
          projected.set(bx, by, 0).applyMatrix4(device.matrixWorld).project(camera);
          const px = (projected.x * 0.5 + 0.5) * width;
          const py = (-projected.y * 0.5 + 0.5) * height;
          if (px < dMinX) dMinX = px;
          if (px > dMaxX) dMaxX = px;
          if (py < dMinY) dMinY = py;
          if (py > dMaxY) dMaxY = py;
        }
        host.style.setProperty("--device-left", `${dMinX}px`);
        host.style.setProperty("--device-right", `${width - dMaxX}px`);
        host.style.setProperty("--device-top", `${dMinY}px`);
        host.style.setProperty("--device-bottom", `${height - dMaxY}px`);
        host.style.setProperty("--device-width", `${dMaxX - dMinX}px`);
      }
    };

    let lastTime = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Key travel + bloom easing
      let animating = false;
      for (const k of keys) {
        const targetZ = k.userData.pressed
          ? k.userData.pressedZ
          : k.userData.baseZ;
        if (Math.abs(k.position.z - targetZ) > 1e-4) {
          k.position.z += (targetZ - k.position.z) * Math.min(1, dt * 22);
          animating = true;
        }
        const mat = k.material as THREE.MeshStandardMaterial;
        const targetGlow = k.userData.target;
        if (Math.abs(k.userData.glow - targetGlow) > 1e-3) {
          k.userData.glow += (targetGlow - k.userData.glow) * Math.min(1, dt * 8);
          animating = true;
        }
        mat.emissiveIntensity = k.userData.glow * 1.15;
        const plane = keyGlowPlanes.get(k.userData.key);
        if (plane) {
          (plane.material as THREE.MeshBasicMaterial).opacity =
            k.userData.glow * 0.5;
        }
      }

      // Lean toward the pointer
      if (
        Math.abs(tilt.rotation.x - tiltTarget.x) > 1e-4 ||
        Math.abs(tilt.rotation.y - tiltTarget.y) > 1e-4
      ) {
        tilt.rotation.x += (tiltTarget.x - tilt.rotation.x) * Math.min(1, dt * 6);
        tilt.rotation.y += (tiltTarget.y - tilt.rotation.y) * Math.min(1, dt * 6);
        animating = true;
      }

      // Knob / wheel settle
      if (Math.abs(knobSpin.rotation.y - knobTarget.value) > 1e-4) {
        knobSpin.rotation.y +=
          (knobTarget.value - knobSpin.rotation.y) *
          Math.min(1, dt * KNOB.snapSpeed * 2);
        animating = true;
      }
      if (Math.abs(wheelSpin.rotation.y - wheelTarget.value) > 1e-4) {
        wheelSpin.rotation.y +=
          (wheelTarget.value - wheelSpin.rotation.y) * Math.min(1, dt * 12);
        animating = true;
      }

      if (dirty || animating) {
        dirty = false;
        renderer.render(scene, camera);
        syncScreenRect();
      }
    };

    const tiltTarget = { x: 0, y: 0 };
    const knobTarget = { value: 0 };
    const wheelTarget = { value: 0 };

    // ── Interaction ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let dragging: {
      kind: "knob" | "wheel";
      lastY: number;
      accum: number;
      startY: number;
      startStep: number;
      emitted: number;
    } | null =
      null;
    let heldKey: KeyMesh | null = null;

    const pick = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(
        [...keys, knob, wheelDrum],
        false,
      );
    };

    /**
     * The screen is DOM layered beneath this canvas, so a tap that misses the
     * hardware has to be handed down to whatever is under the cursor — briefly
     * making the canvas transparent to hit-testing to find it.
     */
    const forwardToScreen = (event: PointerEvent) => {
      const screen = screenElRef?.current;
      if (!screen) return;
      const previous = canvas.style.pointerEvents;
      canvas.style.pointerEvents = "none";
      const under = document.elementFromPoint(event.clientX, event.clientY);
      canvas.style.pointerEvents = previous;
      if (under && screen.contains(under)) {
        (under as HTMLElement).click();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const hits = pick(event);
      if (!hits.length) {
        forwardToScreen(event);
        return;
      }
      const obj = hits[0].object;
      canvas.setPointerCapture(event.pointerId);

      if (obj === knob || obj === wheelDrum) {
        dragging = {
          kind: obj === knob ? "knob" : "wheel",
          lastY: event.clientY,
          accum: 0,
          startY: event.clientY,
          startStep: 0,
          emitted: 0,
        };
        return;
      }
      const k = obj as KeyMesh;
      k.userData.pressed = true;
      k.userData.target = Math.max(k.userData.target, 0.85);
      heldKey = k;
      dirty = true;
      handlers.current.onPress?.(k.userData.key);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragging) {
        const perDetent = dragging.kind === "knob" ? 14 : 18;
        const travelled = event.clientY - dragging.startY;
        // Absolute, like dragging a scrollbar thumb: the control sits wherever
        // the pointer has carried it from the grab point, so overshooting and
        // coming back returns you to where you started. Accumulating notches
        // per move event drifts, and never comes home.
        //
        // **Drag up, the value goes up.** `travelled` is positive downwards, so
        // the value takes the opposite sign; the drum keeps spinning with the
        // thumb, which is why the two are computed separately.
        const detents = Math.trunc(travelled / perDetent);
        const steps = -(detents - dragging.emitted);
        dragging.lastY = event.clientY;

        if (steps !== 0) {
          dragging.emitted = detents;
          const turn =
            dragging.kind === "knob"
              ? (Math.PI * 2) / KNOB.snapInterval
              : (Math.PI * 2) / 12;
          // The drum follows the thumb: down-drag rolls it one way whatever the
          // value does.
          const spin = -steps * turn;
          if (dragging.kind === "knob") {
            knobTarget.value += spin;
            handlers.current.onKnobStep?.(steps);
          } else {
            wheelTarget.value += spin;
            handlers.current.onWheelStep?.(steps);
          }
        }
        dirty = true;
        return;
      }

      // Idle lean
      const rect = canvas.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      tiltTarget.y = nx * 0.34;
      tiltTarget.x = ny * 0.18;
    };

    const releaseKey = () => {
      if (!heldKey) return;
      heldKey.userData.pressed = false;
      heldKey.userData.target = keyGlowRef.current[heldKey.userData.key] ?? 0;
      heldKey = null;
      dirty = true;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      dragging = null;
      releaseKey();
    };

    const onPointerLeave = () => {
      tiltTarget.x = 0;
      tiltTarget.y = 0;
      dragging = null;
      releaseKey();
    };

    const KEYBOARD: Record<string, ButtonKey> = {
      Enter: "play",
      " ": "play",
      ArrowUp: "action1",
      ArrowDown: "action2",
      Escape: "menu",
      ArrowLeft: "menu",
      ArrowRight: "home",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const mapped = KEYBOARD[event.key];
      if (!mapped || event.repeat) return;
      const target = keys.find((k) => k.userData.key === mapped);
      if (!target) return;
      event.preventDefault();
      target.userData.pressed = true;
      target.userData.target = Math.max(target.userData.target, 0.85);
      heldKey = target;
      dirty = true;
      handlers.current.onPress?.(mapped);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (KEYBOARD[event.key]) releaseKey();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const observer = new ResizeObserver(() => {
      resize();
      frameCamera();
    });
    observer.observe(wrap);

    resize();
    frameCamera();
    tick();

    sceneRef.current = {
      renderer,
      scene,
      camera,
      tilt,
      device,
      keys,
      keyGlowPlanes,
      bodyMat,
      backMat,
      knobMat,
      knobSpin,
      wheelSpin,
      logoMats,
      logoEyeMats,
      backPlateMat,
      labelMats,
      actionCaptions,
      envMap,
      invalidate,
      setKeyColors,
    };

    return () => {
      logoDisposed = true;
      markDisposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const d of disposables) d.dispose();
      envMap.dispose();
      renderer.dispose();
      sceneRef.current = null;
    };
    // The scene is built once; theme and glow are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Theme -> materials (in place, no rebuild) ──────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    s.bodyMat.color.set(theme.body);
    s.backMat.color.set(theme.back);
    s.knobMat.color.set(theme.knob);
    s.setKeyColors(theme);
    s.logoMats.forEach((m) => m.color.set(theme.logo));
    s.logoEyeMats.forEach((m) =>
      m.color.set(theme.logoEyes ?? `#${HARDWARE_COLORS.logoEyes.toString(16)}`),
    );

    // Material modes
    if (theme.metallic) {
      s.bodyMat.metalness = 1;
      s.bodyMat.roughness = 0.3;
      s.bodyMat.clearcoat = 0.12;
      s.bodyMat.transmission = 0;
      s.bodyMat.transparent = false;
      s.bodyMat.envMap = s.envMap;
      s.bodyMat.envMapIntensity = 1.4;
      s.backMat.metalness = 1;
      s.backMat.roughness = 0.34;
      s.backMat.envMap = s.envMap;
      s.knobMat.metalness = 0.85;
      s.knobMat.envMap = s.envMap;
      s.knobMat.envMapIntensity = 2.6;
    } else if (theme.clear) {
      s.bodyMat.metalness = 0;
      s.bodyMat.roughness = 0.28;
      s.bodyMat.transmission = 1;
      s.bodyMat.transparent = true;
      s.bodyMat.ior = 1.47;
      s.bodyMat.clearcoat = 1;
      s.bodyMat.thickness = 0.6;
      s.bodyMat.envMap = s.envMap;
      s.backMat.metalness = 0;
      s.backMat.roughness = 0.55;
      s.backMat.clearcoat = 0.5;
      s.knobMat.metalness = 0;
      s.knobMat.roughness = 0.55;
    } else {
      s.bodyMat.metalness = 0;
      s.bodyMat.roughness = 0.82;
      s.bodyMat.clearcoat = 0;
      s.bodyMat.transmission = 0;
      s.bodyMat.transparent = false;
      s.bodyMat.envMap = null;
      s.backMat.metalness = 0;
      s.backMat.roughness = 0.88;
      s.backMat.clearcoat = 0;
      s.backMat.envMap = null;
      s.knobMat.metalness = 0;
      s.knobMat.roughness = 0.88;
      s.knobMat.envMap = null;
    }

    // Skin
    const applySkin = (url: string | undefined) => {
      if (!url) {
        if (s.bodyMat.map) {
          s.bodyMat.map.dispose();
          s.bodyMat.map = null;
        }
        s.bodyMat.color.set(theme.body);
        s.bodyMat.needsUpdate = true;
        s.invalidate();
        return;
      }
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          if (!sceneRef.current) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.anisotropy =
            sceneRef.current.renderer.capabilities.getMaxAnisotropy();

          // Aspect-preserving cover fit against the reference 1400 x 2489 art.
          const bodyAspect = BODY_W / BODY_H;
          const imgAspect = tex.image.width / tex.image.height;
          if (imgAspect > bodyAspect) {
            const r = bodyAspect / imgAspect;
            tex.repeat.set(r, 1);
            tex.offset.set((1 - r) / 2, 0);
          } else {
            const r = imgAspect / bodyAspect;
            tex.repeat.set(1, r);
            tex.offset.set(0, (1 - r) / 2);
          }

          s.bodyMat.map = tex;
          s.bodyMat.color.set("#ffffff");
          s.bodyMat.needsUpdate = true;
          s.invalidate();
        },
        undefined,
        () => {
          console.warn("[ConsoleCanvas] body skin failed:", url);
        },
      );
    };
    applySkin(theme.skin);

    s.bodyMat.needsUpdate = true;
    s.backMat.needsUpdate = true;
    s.knobMat.needsUpdate = true;
    s.labelMats.forEach((m) => m.color.set(theme.label));
    s.backPlateMat.color.set(theme.label);
    s.renderer.shadowMap.needsUpdate = true;
    s.invalidate();
  }, [theme]);

  // ── Action-key silkscreen ──────────────────────────────────────────────────
  const a1 = actionLabels?.action1 ?? "";
  const a2 = actionLabels?.action2 ?? "";
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    [a1, a2].forEach((text, i) => {
      const caption = s.actionCaptions[i];
      if (!caption || caption.text === text) return;
      caption.mat.map?.dispose();
      caption.mat.map = capLabelTexture(text);
      caption.mat.needsUpdate = true;
      caption.text = text;
    });
    s.invalidate();
  }, [a1, a2]);

  // ── Key bloom targets ──────────────────────────────────────────────────────
  const glowKey = JSON.stringify(keyGlow ?? {});
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.keys.forEach((k) => {
      k.userData.target = keyGlow?.[k.userData.key] ?? 0;
    });
    s.invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowKey]);

  // The wrapper must stay transparent: the DOM screen sits *underneath* this
  // canvas, and any background here would paint over it.
  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        background: "transparent",
        opacity: idle ? 0.94 : 1,
        transition: "opacity .5s var(--ease-out-quart)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          touchAction: "none",
          display: "block",
        }}
      />
    </div>
  );
}
