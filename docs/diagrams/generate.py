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
o = panel(W, H, "The knob is a limit price", "app/games/{lucky,moonshot}")
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

o += span(RAIL_Y + 52, 0.50, 0.10, "LUCKY", BRAND)
o += span(RAIL_Y + 84, 0.20, 0.01, "MOONSHOT", AMBER)

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
