# -*- coding: utf-8 -*-
"""Generates the README diagrams as panels of the console itself.

Run from anywhere:  python3 docs/diagrams/generate.py

Every colour below is lifted from the app rather than picked to look retro —
`lib/console/themes.ts` (the Classic preset), `lib/console/geometry.ts`
(HARDWARE_COLORS) and `app/globals.css` (the design tokens). If a palette value
changes there, change it here too; nothing enforces the link.

The SVGs are committed, so this only needs running when a diagram changes. They
carry no CSS, no scripts and no external references, which is what keeps them
rendering inside GitHub's markdown sanitiser.
"""
import os, html

OUT = os.path.dirname(os.path.abspath(__file__))

SHELL   = "#141412"   # console shell
RECESS  = "#0d0d0c"   # HARDWARE_COLORS.recess, darkened
GLASS   = "#191509"   # screen ground, amber-biased black
AMBER   = "#efc03b"   # HARDWARE_COLORS.screenGlass
BRAND   = "#ffc016"   # --color-brand-500
CREAM   = "#e9dbbf"   # Classic body
RED     = "#d63a2e"   # Classic main key
BLUE    = "#3568c9"   # Classic action key
UP      = "#34d399"   # --color-up
DOWN    = "#ff5a4d"   # --color-down
LABEL   = "#8a8a8a"   # --color-text-3
INK     = "#f2f2f2"   # --color-text
BAND    = "#5f636b"   # HARDWARE_COLORS.metalBand

MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

def esc(t): return html.escape(str(t), quote=False)

def text(x, y, s, size=13, fill=INK, weight="400", anchor="start", track=0, op=1.0):
    return (f'<text x="{x}" y="{y}" font-family="{MONO}" font-size="{size}" fill="{fill}" '
            f'font-weight="{weight}" text-anchor="{anchor}" letter-spacing="{track}" '
            f'fill-opacity="{op}" xml:space="preserve">{esc(s)}</text>')

def rect(x, y, w, h, r=0, fill="none", stroke=None, sw=1, op=1.0, sop=1.0, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-opacity="{sop}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" fill-opacity="{op}"{st}{d}/>'

def line(x1, y1, x2, y2, stroke=AMBER, sw=1.25, op=0.55, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-opacity="{op}" stroke-linecap="square"{d}/>')

def path(d, stroke=AMBER, sw=1.25, op=0.55, fill="none", dash=None):
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
            f'stroke-opacity="{op}" stroke-linecap="square" stroke-linejoin="round"{da}/>')

def tick(x, y, c=AMBER, s=3.5, op=0.9):
    """Connector terminator — a small square, matching the console's pixel vocabulary."""
    return rect(x - s / 2, y - s / 2, s, s, 0.5, fill=c, op=op)

def screw(x, y):
    return (f'<circle cx="{x}" cy="{y}" r="3.2" fill="{BAND}" fill-opacity="0.5"/>'
            f'<line x1="{x-1.6}" y1="{y}" x2="{x+1.6}" y2="{y}" stroke="{RECESS}" stroke-width="1"/>')

def panel(w, h, title, sub):
    """The device shell: bezel, screws, silkscreen, and the amber screen inside."""
    o = [rect(0, 0, w, h, 18, fill=SHELL)]
    o.append(rect(6, 6, w - 12, h - 12, 14, fill="none", stroke=BAND, sw=1, sop=0.28))
    for sx, sy in ((20, 20), (w - 20, 20), (20, h - 20), (w - 20, h - 20)):
        o.append(screw(sx, sy))
    o.append(text(38, 34, title.upper(), 12.5, AMBER, "700", track=2.4))
    o.append(text(w - 38, 34, sub.upper(), 10.5, LABEL, anchor="end", track=1.6))
    o.append(line(38, 46, w - 38, 46, AMBER, 1, 0.22))
    return o

def screen(x, y, w, h):
    """An LCD cutout: recessed frame, amber-black glass, faint scanlines."""
    o = [rect(x - 5, y - 5, w + 10, h + 10, 10, fill=RECESS),
         rect(x, y, w, h, 6, fill=GLASS),
         rect(x, y, w, h, 6, fill="none", stroke=AMBER, sw=1, sop=0.18)]
    yy = y + 3
    while yy < y + h - 2:
        o.append(line(x + 2, yy, x + w - 2, yy, AMBER, 1, 0.035))
        yy += 4
    return o

def cap(x, y, w, h, label, colour, sub=None, ink=None):
    """A key cap — the console's controls are physical, so a press looks like one."""
    ink = ink or ("#241008" if colour in (AMBER, BRAND, CREAM, UP) else "#fff6ea")
    o = [rect(x, y + 3, w, h, 9, fill="#000", op=0.5),
         rect(x, y, w, h, 9, fill=colour),
         rect(x + 2, y + 2, w - 4, h * 0.42, 7, fill="#ffffff", op=0.16)]
    ty = y + h / 2 + (0 if not sub else -4)
    o.append(text(x + w / 2, ty + 4, label, 12.5, ink, "700", "middle", 1.3))
    if sub:
        o.append(text(x + w / 2, ty + 19, sub, 9.5, ink, "400", "middle", 0.8, op=0.72))
    return o

def node(x, y, w, h, lines, accent=AMBER, fill="#ffffff", op=0.045, dash=None, title_size=12.5):
    """A screen state: a soft slab with a left accent rail."""
    o = [rect(x, y, w, h, 7, fill=fill, op=op, stroke=accent, sw=1, sop=0.34, dash=dash),
         rect(x, y + 7, 2.5, h - 14, 1.5, fill=accent, op=0.85)]
    ty = y + 22 if len(lines) > 1 else y + h / 2 + 4
    for i, (s, size, col, wt) in enumerate(lines):
        o.append(text(x + 16, ty + i * 16, s, size, col, wt, track=0.6 if size < 12 else 0.9))
    return o

def write(name, w, h, body):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" '
           f'height="{h}" role="img" aria-label="{esc(name)}">\n' + "\n".join(body) + "\n</svg>\n")
    with open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8") as f:
        f.write(svg)
    print(name, len(svg), "bytes")

# ── 1. The round ────────────────────────────────────────────────────────────
W, H = 900, 420
o = panel(W, H, "One window is one round", "lib/games/useRound.ts")
o += screen(38, 62, W - 76, H - 104)

o += cap(66, 100, 92, 52, "LONG", UP, "or SHORT")
o += cap(66, 172, 92, 52, "KNOB", BRAND, "your price")
o += cap(66, 244, 92, 52, "PLAY", RED)

# One bus off the three keys — the console reads them together, not in sequence.
for ky in (126, 198, 270):
    o.append(line(158, ky, 190, ky, AMBER, 1.25, 0.45))
o.append(line(190, 126, 190, 270, AMBER, 1.25, 0.45))
o.append(line(190, 198, 226, 198, AMBER, 1.25, 0.5))
o.append(tick(226, 198))

o += node(238, 172, 162, 52, [
    ("IOC order", 12.5, INK, "700"),
    ("to the on-chain book", 10, LABEL, "400")])

o.append(path("M 400 198 L 420 198 L 420 126 L 438 126", DOWN, 1.25, 0.45, dash="4 3"))
o.append(tick(438, 126, DOWN))
o.append(path("M 420 198 L 420 230 L 438 230", AMBER, 1.25, 0.55))
o.append(tick(438, 230))

o += node(444, 100, 186, 52, [
    ("no fill", 12.5, DOWN, "700"),
    ("nobody on the other side", 9.5, LABEL, "400")], accent=DOWN, dash="4 3")
o += node(444, 204, 186, 52, [
    ("you hold N contracts", 11.5, INK, "700"),
    ("max loss = what you paid", 9.5, LABEL, "400")], accent=UP)

o.append(path("M 537 256 L 537 292", BLUE, 1.25, 0.45, dash="4 3"))
o.append(tick(537, 292, BLUE))
o += node(444, 298, 186, 44, [
    ("CASH OUT — sell into", 10.5, INK, "400"),
    ("the live bid, any time", 10.5, LABEL, "400")], accent=BLUE, dash="4 3")

o.append(line(630, 230, 664, 230, AMBER, 1.25, 0.55))
o.append(tick(664, 230))
o += node(670, 204, 184, 52, [
    ("window closes", 12.5, INK, "700"),
    ("oracle resolves it — 0 s", 9.5, AMBER, "400")], accent=AMBER)

o.append(path("M 762 256 L 762 292", AMBER, 1.25, 0.55))
o.append(tick(762, 292))
o += node(670, 298, 184, 44, [
    ("right → 1.000000 each", 10.5, UP, "700"),
    ("wrong → 0", 10.5, DOWN, "400")], accent=UP)

o.append(text(38, H - 22, "PRICE IS PROBABILITY  ·  PAYOUT = 1 / PRICE  ·  ZERO FEES", 9.5, LABEL, track=1.8))
write("the-round", W, H, o)

# ── 2. The knob is a limit price ────────────────────────────────────────────
W, H = 900, 352
o = panel(W, H, "The knob is a limit price", "app/games/lucky")
o += screen(38, 62, W - 76, H - 104)

RAIL_Y = 158
x0, x1 = 108, W - 108
o.append(line(x0, RAIL_Y, x1, RAIL_Y, AMBER, 1.25, 0.35))

import math
def px(p):  # log scale — the ladder is multiplicative, so the rail must be too
    lo, hi = math.log(0.01), math.log(0.50)
    return x1 - (math.log(p) - lo) / (hi - lo) * (x1 - x0)

for p, mult in [(0.50, "2x"), (0.33, "3x"), (0.20, "5x"), (0.10, "10x"),
                (0.04, "25x"), (0.02, "50x"), (0.01, "100x")]:
    x, hot = px(p), p >= 0.10
    col = BRAND if hot else AMBER
    o.append(line(x, RAIL_Y - 13, x, RAIL_Y + 13, col, 1.25, 0.8 if hot else 0.5))
    o.append(text(x, RAIL_Y - 26, mult, 15 if hot else 13, col, "700", "middle", 0.8))
    o.append(text(x, RAIL_Y + 34, f"{p:.2f}", 11.5, INK if hot else LABEL, "400", "middle", 0.6))

def span(y, a, b, name, col):
    """A range bracket — which game's knob covers which stretch of the rail."""
    xa, xb = px(a), px(b)
    return [path(f"M {xa} {y-6} L {xa} {y} L {xb} {y} L {xb} {y-6}", col, 1.25, 0.55),
            text((xa + xb) / 2, y + 16, name, 9.5, col, "700", "middle", 2.2)]

# One ladder, one game. Lucky covers the whole rail: the near rungs are the
# ordinary bet, the far end is the side the market has nearly written off.
o += span(RAIL_Y + 52, 0.50, 0.10, "LUCKY · THE BET", BRAND)
o += span(RAIL_Y + 84, 0.10, 0.01, "LUCKY · THE DEEP TAIL", AMBER)

o.append(text(x0, RAIL_Y - 52, "YOU ASK FOR", 9, LABEL, "700", track=2.0))
o.append(text(x0, RAIL_Y + 128, "YOU PAY, PER CONTRACT", 9, LABEL, "700", track=2.0))
o.append(text(x1, RAIL_Y + 128, "THE MARKET'S ODDS ON YOU", 9, LABEL, "700", "end", 2.0))

o.append(text(38, H - 22,
  "A CONTRACT PAYS 1 IF YOU ARE RIGHT — SO ITS PRICE IS THE ODDS. A BIG MULTIPLE IS NOT GENEROSITY.",
  9.5, LABEL, track=1.3))
write("the-knob", W, H, o)

# ── 3. Duel — mint a pair ───────────────────────────────────────────────────
W, H = 900, 440
o = panel(W, H, "A duel is a resting order", "lib/dreamdex/coop.ts")
o += screen(38, 62, W - 76, H - 104)

o += node(70, 92, 240, 62, [
    ("CHALLENGER", 11, UP, "700"),
    ("rests BUY UP @ 0.500", 12, INK, "400"),
    ("escrows exactly 0.500000", 9.5, LABEL, "400")], accent=UP)
o += node(W - 310, 92, 240, 62, [
    ("ACCEPTER", 11, DOWN, "700"),
    ("BUY DOWN @ 0.500", 12, INK, "400"),
    ("escrows exactly 0.500000", 9.5, LABEL, "400")], accent=DOWN)

o += node(300, 186, 300, 56, [
    ("the order book", 12, AMBER, "700"),
    ("tagged userData = 0x544f4b4f", 10, LABEL, "400")], accent=AMBER)
o.append(path("M 190 154 L 190 214 L 300 214", UP, 1.25, 0.55))
o.append(path("M 710 154 L 710 214 L 600 214", DOWN, 1.25, 0.55))
o.append(tick(300, 214, UP)); o.append(tick(600, 214, DOWN))

o.append(text(70, 206, "PUBLIC AT", 9, LABEL, "700", track=1.8))
o.append(text(70, 222, "/menu/duels", 10.5, AMBER, "400"))
o.append(text(W - 70, 254, "ANYONE MAY TAKE IT", 9, LABEL, "700", "end", 1.8))

o.append(path("M 450 242 L 450 274", AMBER, 1.4, 0.6))
o.append(tick(450, 274))
o += node(300, 280, 300, 54, [
    ("MINT A PAIR", 13, BRAND, "700"),
    ("no seller · no market maker", 10, LABEL, "400")], accent=BRAND, fill=BRAND, op=0.07)

o.append(path("M 300 307 L 214 307 L 214 346", UP, 1.25, 0.5))
o.append(path("M 600 307 L 686 307 L 686 346", DOWN, 1.25, 0.5))
o.append(tick(214, 346, UP)); o.append(tick(686, 346, DOWN))
o.append(text(214, 368, "1.000 UP", 12.5, UP, "700", "middle", 0.8))
o.append(text(686, 368, "1.000 DOWN", 12.5, DOWN, "700", "middle", 0.8))

o.append(text(38, H - 22,
  "PRICE-TIME PRIORITY: AN ACCEPT CROSSES THE BEST BID — SO A CHALLENGE MUST SIT AT THE FRONT.",
  9.5, LABEL, track=1.3))
write("the-duel", W, H, o)

# ── 4. The Executor seam ────────────────────────────────────────────────────
W, H = 900, 396
o = panel(W, H, "Demo and live differ by one object", "lib/dreamdex/execution.ts")
o += screen(38, 62, W - 76, H - 104)

o += node(150, 90, 600, 46, [
    ("every game screen  ·  the round  ·  the ladder", 12, INK, "700")], accent=CREAM)
o.append(path("M 450 136 L 450 164", CREAM, 1.4, 0.5))
o.append(tick(450, 164, CREAM))

o += node(300, 172, 300, 46, [
    ("Executor", 13, BRAND, "700")], accent=BRAND, fill=BRAND, op=0.07)

o.append(path("M 350 218 L 350 242 L 230 242 L 230 262", BRAND, 1.25, 0.5))
o.append(path("M 550 218 L 550 242 L 670 242 L 670 262", BRAND, 1.25, 0.5))
o.append(tick(230, 262, AMBER)); o.append(tick(670, 262, UP))

o += node(96, 262, 268, 56, [
    ("paper — before signup", 11.5, AMBER, "700"),
    ("walks the real book, level by level", 9.5, LABEL, "400")], accent=AMBER, dash="4 3")
o += node(536, 262, 268, 56, [
    ("chain — funded wallet", 11.5, UP, "700"),
    ("places the order for real", 9.5, LABEL, "400")], accent=UP)

o.append(text(450, 288, "ONE", 10, LABEL, "700", "middle", 2.0))
o.append(text(450, 304, "SWAP", 10, LABEL, "700", "middle", 2.0))

o.append(text(38, H - 22,
  "REAL BOOK · REAL WINDOWS · REAL ORACLE — ONLY YOUR OWN FILL IS HYPOTHETICAL, AND IT NEVER BEATS THE BOOK.",
  9.5, LABEL, track=1.2))
write("the-seam", W, H, o)

# ════════════════════════════════════════════════════════════════════════════
# HOW_TO_PLAY.md — the player's guide. Same device vocabulary, but these carry
# what prose does badly: where a control physically is, and how a number moves
# while a window runs down.
# ════════════════════════════════════════════════════════════════════════════

# ── 5. The console, labelled ────────────────────────────────────────────────
# Drawn from lib/console/geometry.ts, so the map matches the hardware exactly.
SRC_W, SRC_H = 1170, 2532
SCALE, OX, OY = 0.232, 62, 76
def sx(x): return OX + x * SCALE
def sy(y): return OY + y * SCALE
def sw(world): return world * 200 * SCALE          # world units -> diagram px

W, H = 900, 748
o = panel(W, H, "The console", "every game uses the same hardware")

dev_x0, dev_x1 = sx(-35), sx(1205)
o.append(rect(dev_x0, sy(0), dev_x1 - dev_x0, sy(SRC_H) - sy(0), 26,
              fill=CREAM, op=0.10, stroke=CREAM, sw=1.25, sop=0.4))

# The screen is an L — the bottom right is notched out for the big key.
pts = [(0, 30), (1170, 30), (1170, 1325), (760, 1325), (760, 1680), (0, 1680)]
o.append(path("M " + " L ".join(f"{sx(x)} {sy(y)}" for x, y in pts) + " Z",
              AMBER, 1, 0.3, fill=GLASS))
yy = 40
while yy < 1670:
    xr = 1170 if yy < 1325 else 760
    o.append(line(sx(6), sy(yy), sx(xr - 6), sy(yy), AMBER, 1, 0.05))
    yy += 26
o.append(line(sx(6), sy(1560), sx(754), sy(1560), AMBER, 1, 0.22))
o.append(text(sx(380), sy(1640), "BTC · 0:47 · $500.00", 9, AMBER, "400", "middle", 0.6, op=0.75))

def key(cx, cy, ww, hh, colour, label, size=9):
    x, y = sx(cx) - sw(ww) / 2, sy(cy) - sw(hh) / 2
    out = [rect(x, y + 2, sw(ww), sw(hh), 5, fill="#000", op=0.45),
           rect(x, y, sw(ww), sw(hh), 5, fill=colour),
           rect(x + 1.5, y + 1.5, sw(ww) - 3, sw(hh) * 0.4, 4, fill="#ffffff", op=0.16)]
    ink = "#241008" if colour in (AMBER, BRAND, CREAM, UP) else "#fff6ea"
    out.append(text(sx(cx), sy(cy) + 3.2, label, size, ink, "700", "middle", 0.7))
    return out

o += key(965, 1490, 1.6, 1.5, RED, "PLAY")
o += key(200, 1840, 1.72, 1.62, BLUE, "LONG")
o += key(589, 1840, 1.72, 1.62, BLUE, "SHORT")
o += key(150, 2150, 0.98, 0.31, "#c1c1c1", "MENU", 6.5)
o += key(425, 2150, 1.02, 0.31, "#c1c1c1", "HOME", 6.5)

# Knob: a ridged column. Wheel: a detented drum.
kx, ky, kw, kh = sx(975), sy(1960), sw(1.0), sw(2.4)
o.append(rect(kx - kw / 2, ky - kh / 2, kw, kh, kw / 2, fill=BRAND))
for i in range(9):
    ry = ky - kh / 2 + 8 + i * (kh - 16) / 8
    o.append(line(kx - kw / 2 + 3, ry, kx + kw / 2 - 3, ry, "#241008", 1.1, 0.35))
wx, wy, ww_, wh_ = sx(690), sy(2140), sw(0.86), sw(0.82)
o.append(rect(wx - ww_ / 2, wy - wh_ / 2, ww_, wh_, 3, fill="#080808"))
for i in range(4):
    o.append(line(wx - ww_ / 2 + 2, wy - wh_ / 2 + 4 + i * (wh_ - 8) / 3,
                  wx + ww_ / 2 - 2, wy - wh_ / 2 + 4 + i * (wh_ - 8) / 3, CREAM, 1, 0.28))

CALLOUTS = [
    (585, 700, 118, "SCREEN", "the game, the countdown, what you hold"),
    (585, 1600, 214, "STATUS STRIP", "asset · seconds left in the window · your balance"),
    (965, 1490, 300, "BIG KEY", "the main action — PLAY, TAKE, PRESS, CASH OUT"),
    (0, 0, 332, "", "the label always says which  ·  Enter or Space"),
    (200, 1840, 396, "LONG", "call it up  ·  keyboard ↑"),
    (589, 1840, 452, "SHORT", "call it down  ·  keyboard ↓"),
    (975, 1960, 520, "KNOB", "the payout you are asking for — drag it"),
    (690, 2140, 588, "WHEEL", "how many contracts"),
    (287, 2150, 652, "MENU · HOME", "always navigate, whatever the game is doing"),
]
LX = 430
for cx, cy, ly, head, sub in CALLOUTS:
    if head:
        o.append(line(sx(cx), sy(cy), LX - 14, ly - 4, AMBER, 1, 0.3))
        o.append(tick(sx(cx), sy(cy), AMBER, 3, 0.8))
        o.append(text(LX, ly, head, 11.5, BRAND, "700", track=1.6))
        o.append(text(LX, ly + 16, sub, 10, LABEL, "400", track=0.4))
    else:
        o.append(text(LX, ly, sub, 10, LABEL, "400", track=0.4))

o.append(text(38, H - 22,
  "YOU ARE HOLDING A DEVICE, NOT FILLING IN A FORM. ESC OPENS THE MENU FROM ANYWHERE.",
  9.5, LABEL, track=1.3))
write("play-console", W, H, o)

# ── 6. What a contract pays ─────────────────────────────────────────────────
W, H = 900, 372
o = panel(W, H, "What a contract pays", "the one idea behind every game")
o += screen(38, 62, W - 76, H - 104)

BAR_X, BAR_W = 268, 440
rows = [(0.50, "2x", "a coin flip"), (0.33, "3x", "you are the underdog"),
        (0.10, "10x", "a long shot"), (0.02, "50x", "almost certainly wrong")]
o.append(text(BAR_X, 106, "WHAT YOU PAY", 9, LABEL, "700", track=1.8))
o.append(text(BAR_X + BAR_W, 106, "WHAT IT PAYS IF YOU ARE RIGHT", 9, LABEL, "700", "end", 1.8))

for i, (price, mult, gloss) in enumerate(rows):
    y = 128 + i * 48
    o.append(rect(BAR_X, y, BAR_W, 26, 4, fill=UP, op=0.13, stroke=UP, sw=1, sop=0.4))
    o.append(rect(BAR_X, y, BAR_W * price, 26, 4, fill=BRAND, op=0.9))
    o.append(text(BAR_X - 14, y + 18, f"${price:.2f}", 12.5, BRAND, "700", "end", 0.6))
    o.append(text(BAR_X + BAR_W + 14, y + 18, "$1.00", 12, UP, "700", track=0.6))
    o.append(text(BAR_X + BAR_W + 74, y + 18, mult, 13, INK, "700", track=0.8))
    o.append(text(BAR_X - 78, y + 18, gloss, 10, LABEL, "400", "end", 0.4))

o.append(text(38, H - 22,
  "SO THE PRICE IS THE ODDS. ASKING FOR A BIG MULTIPLE IS ASKING TO PAY LITTLE — BECAUSE THE MARKET DOUBTS YOU.",
  9.5, LABEL, track=1.1))
write("play-payout", W, H, o)

# ── 7. Snipe — the wall, and the cliff ──────────────────────────────────────
W, H = 900, 360
o = panel(W, H, "Snipe — the wall slides, then it is gone", "one button, one moment")
o += screen(38, 62, W - 76, H - 104)

gx0, gx1, gy0, gy1 = 100, 800, 100, 262
o.append(line(gx0, gy1, gx1, gy1, AMBER, 1, 0.28))
o.append(line(gx0, gy0, gx0, gy1, AMBER, 1, 0.28))

import math as _m
pts = []
for i in range(61):
    t = i / 60                              # 0 = window opens, 1 = it closes
    price = 0.34 * (1 - t) ** 1.7 + 0.02    # the underdog's offer, decaying
    pts.append((gx0 + t * (gx1 - gx0) * 0.93, gy1 - (price / 0.36) * (gy1 - gy0)))
o.append(path("M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts), AMBER, 2, 0.85))

cliff = gx0 + 0.93 * (gx1 - gx0)
o.append(rect(cliff, gy0, gx1 - cliff, gy1 - gy0, 3, fill=DOWN, op=0.13,
              stroke=DOWN, sw=1, sop=0.45, dash="3 3"))
o.append(text((cliff + gx1) / 2, gy0 - 10, "QUOTES PULLED", 9, DOWN, "700", "middle", 1.2))
o.append(text((cliff + gx1) / 2, (gy0 + gy1) / 2, "nothing", 9.5, DOWN, "400", "middle", 0.4))
o.append(text((cliff + gx1) / 2, (gy0 + gy1) / 2 + 14, "left to take", 9.5, DOWN, "400", "middle", 0.4))

for t, mult in ((0.10, "3x"), (0.45, "6x"), (0.80, "20x")):
    x = gx0 + t * (gx1 - gx0) * 0.93
    y = pts[int(t * 60)][1]
    o.append(tick(x, y, BRAND, 6, 1.0))
    o.append(text(x, y - 14, mult, 12, BRAND, "700", "middle", 0.8))

o.append(text(gx0 - 12, gy0 + 6, "OFFER", 9, LABEL, "700", "end", 1.4))
o.append(text(gx0 - 12, gy1, "0", 9, LABEL, "700", "end", 1.4))
o.append(text(gx0, gy1 + 20, "WINDOW OPENS", 9, LABEL, "700", track=1.4))
o.append(text(gx1, gy1 + 20, "IT CLOSES", 9, LABEL, "700", "end", 1.4))
o.append(text(gx0, gy1 + 42, "PRESS TAKE ANYWHERE ALONG THE LINE — LATER IS CHEAPER, AND RISKIER.",
              9.5, INK, "400", track=0.8))

o.append(text(38, H - 22,
  "THE LONGER YOU WAIT THE BIGGER THE MULTIPLE, UNTIL THE MARKET MAKER GOES HOME.",
  9.5, LABEL, track=1.3))
write("play-snipe", W, H, o)

# ── 8. Press — the ladder ───────────────────────────────────────────────────
W, H = 900, 372
o = panel(W, H, "Press — the ladder", "a win stakes the next window")
o += screen(38, 62, W - 76, H - 104)

base_y, step = 268, 46
stakes = ["$1", "$2", "$4", "$8"]
for i, stake in enumerate(stakes):
    x, y = 110 + i * 178, base_y - i * step
    o += node(x, y - 30, 132, 44, [(f"RUNG {i+1}", 9, LABEL, "700"),
                                   (f"{stake} at stake", 11.5, BRAND, "700")], accent=BRAND)
    if i < len(stakes) - 1:
        o.append(path(f"M {x+132} {y-8} L {x+160} {y-8} L {x+160} {y-8-step} L {x+178} {y-8-step}",
                      UP, 1.25, 0.55))
        o.append(tick(x + 178, y - 8 - step, UP))
        o.append(text(x + 146, y - 20 - step / 2, "PRESS", 8.5, UP, "700", "middle", 1.0))
    o.append(path(f"M {x+66} {y+14} L {x+66} {y+42}", DOWN, 1.25, 0.45, dash="4 3"))
    o.append(text(x + 66, y + 58, "lose → it ends", 9, DOWN, "400", "middle", 0.4))

o += node(90, 96, 268, 44, [("FOLD at any rung — stop and keep it", 10, INK, "400")],
          accent=CREAM, dash="4 3")

o.append(text(38, H - 22,
  "YOU PICK A SIDE FRESH ON EVERY RUNG — IT NEVER ROLLS BY ITSELF.",
  9.5, LABEL, track=1.0))
write("play-ladder", W, H, o)

# ── 9. Duel — the player's view ─────────────────────────────────────────────
W, H = 900, 380
o = panel(W, H, "Duel — play against a person", "a challenge is a real order")
o += screen(38, 62, W - 76, H - 104)

o += node(70, 100, 236, 74, [
    ("YOU", 10, UP, "700"),
    ("pick a side and the odds", 11, INK, "400"),
    ("say how long it stands", 11, INK, "400"),
    ("5m · 30m · 1h · 4h", 9.5, LABEL, "400")], accent=UP)

o += node(332, 100, 236, 74, [
    ("SHARE THE LINK", 10, BRAND, "700"),
    ("or leave it on the board", 11, INK, "400"),
    ("Menu → Open duels,", 9.5, LABEL, "400"),
    ("where anyone can take it", 9.5, LABEL, "400")], accent=BRAND)

o += node(594, 100, 236, 74, [
    ("THEY TAKE IT", 10, DOWN, "700"),
    ("the opposite side,", 11, INK, "400"),
    ("at the odds you offered", 11, INK, "400")], accent=DOWN)

for x in (306, 568):
    o.append(line(x, 137, x + 26, 137, AMBER, 1.25, 0.5))
    o.append(tick(x + 26, 137))

o.append(path("M 450 174 L 450 206", AMBER, 1.4, 0.6))
o.append(tick(450, 206))
o += node(280, 212, 340, 50, [
    ("you are now on opposite sides of one window", 11, BRAND, "700")],
    accent=BRAND, fill=BRAND, op=0.07)

o.append(path("M 450 262 L 450 288", AMBER, 1.25, 0.55))
o.append(tick(450, 288))
o += node(280, 294, 340, 44, [
    ("the window closes — one of you is right", 10.5, INK, "400")], accent=AMBER)

o.append(text(70, 272, "NEEDS A", 9, LABEL, "700", track=1.8))
o.append(text(70, 288, "REAL WALLET", 10.5, DOWN, "700", track=0.8))
o.append(text(70, 306, "a pretend order has", 9, LABEL, "400", track=0.3))
o.append(text(70, 318, "nothing to trade against", 9, LABEL, "400", track=0.3))

o.append(text(38, H - 22,
  "WHILE IT WAITS THE CONSOLE KEEPS IT COMPETITIVE — AND HANDS YOUR MONEY BACK IF THE MARKET RUNS AWAY.",
  9.5, LABEL, track=1.1))
write("play-duel", W, H, o)
