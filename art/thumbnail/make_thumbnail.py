#!/usr/bin/env python3
"""Devpost gallery image for Clear CMOS: art/thumbnail/thumbnail.svg and thumbnail.png (1500 x 1000).

v2, type-led hero (studio-web hero.md H4-H7 and its "edge crop" recipe): a huge title, and a macro
hard crop of the board's reset corner in perspective, bleeding off the bottom and right. An amber
HUD target locks on the CLR_CMOS jumper; its vertical hairline rises to the title, so type and
subject interlock instead of sitting in two columns. Board lines keep a constant screen width at
macro zoom (vector-effect non-scaling-stroke), so the art stays hairline and premium.
Type: IBM Plex Sans / Plex Mono (OFL). No brand logos. No first, only or unique.
Run: python3 art/thumbnail/make_thumbnail.py   (needs rsvg-convert and IBM Plex installed)
"""
import math
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
W, H = 1500, 1000

TITLE = "Clear CMOS"
LINE = "Shows where a dead PC’s reset is hidden."
TEXT, SECOND, AMBER = "#F2FBFF", "#A9D8E8", "#FFC14D"

SX, SY = 1024 / 30.5, 820 / 24.4           # board texture px per cm
CLR = (1.38 * SX, 21.53 * SY)              # CLR_CMOS jumper (board-layout.md, Lens frame)
BAT = (5.35 * SX, 12.45 * SY)              # CMOS battery

# Layout knobs, tuned by eye.
SCALE = 2.35        # macro zoom on the board texture
ROT_DEG = -9.0
TILT = 0.6          # foreshortening, about the Lens's 35-degree view
TARGET = (560, 742) # where the CLR_CMOS jumper lands on screen
TITLE_SIZE = 236
TITLE_BASE = 268
LINE_BASE = 340


def matrix():
    r = math.radians(ROT_DEG)
    a, b = math.cos(r) * SCALE, math.sin(r) * SCALE * TILT
    c, d = -math.sin(r) * SCALE, math.cos(r) * SCALE * TILT
    e = TARGET[0] - (a * CLR[0] + c * CLR[1])
    f = TARGET[1] - (b * CLR[0] + d * CLR[1])
    return a, b, c, d, e, f


def apply(m, p):
    a, b, c, d, e, f = m
    return (a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f)


def board_inner():
    s = open(os.path.join(ART, "textures", "board.svg"), encoding="utf-8").read()
    body = s.split(">", 1)[1].rsplit("</svg>", 1)[0]
    body = re.sub(r'<rect x="0" y="0" width="1024" height="820" fill="#000000"/>', "", body, count=1)
    # Constant screen-width strokes at macro zoom.
    body = re.sub(r'<(path|circle|rect) ', r'<\1 vector-effect="non-scaling-stroke" ', body)
    return body


def target(cx, cy):
    """Amber HUD target on the jumper: lens ring, broken outer ring, crosshair, ticks."""
    rx, ry = 50.0, 50.0 * TILT
    out = []
    # bloom
    out.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="url(#bloom)"/>' % (cx, cy, rx * 3.2, ry * 3.2))
    # glow + crisp ring
    for w, op, filt in ((7, 0.85, ' filter="url(#glow)"'), (2.6, 1.0, "")):
        out.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="none" stroke="%s" stroke-width="%s" '
                   'opacity="%.2f"%s/>' % (cx, cy, rx, ry, AMBER, w, op, filt))
    # broken outer ring: four arcs
    R, Ry = rx * 1.75, ry * 1.75
    for a0 in (20, 110, 200, 290):
        pts = []
        for i in range(13):
            t = math.radians(a0 + 50 * i / 12)
            pts.append("%.1f %.1f" % (cx + R * math.cos(t), cy + Ry * math.sin(t)))
        out.append('<path d="M%s" fill="none" stroke="%s" stroke-width="1.6" opacity="0.8"/>' % (" L".join(pts), AMBER))
    # crosshair hairlines with a gap around the target; the vertical one rises to the title
    gap = R + 18
    out.append('<path d="M0 %.1f H%.1f M%.1f %.1f H%d" stroke="url(#rule)" stroke-width="1.1"/>'
               % (cy, cx - gap, cx + gap, cy, W))
    out.append('<path d="M%.1f %d V%.1f M%.1f %.1f V%d" stroke="%s" stroke-width="1.1" opacity="0.45"/>'
               % (cx, LINE_BASE + 34, cy - Ry - 18, cx, cy + Ry + 18, H, AMBER))
    # tick marks along the horizontal hairline, every 40 px, longer every 200 px
    ticks = []
    for x in range(0, W + 1, 40):
        if abs(x - cx) < gap + 10:
            continue
        L = 14 if x % 200 == 0 else 7
        ticks.append("M%d %.1f V%.1f" % (x, cy - L / 2, cy + L / 2))
    out.append('<path d="%s" stroke="url(#rule)" stroke-width="1.1"/>' % " ".join(ticks))
    return out


def svg():
    m = matrix()
    cx, cy = apply(m, CLR)
    bx, by = apply(m, BAT)
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
           "<defs>",
           '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>',
           '<filter id="holo" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3.2"/></filter>',
           '<radialGradient id="bloom"><stop offset="0" stop-color="%s" stop-opacity="0.42"/>'
           '<stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>' % (AMBER, AMBER),
           '<radialGradient id="bloom2"><stop offset="0" stop-color="%s" stop-opacity="0.18"/>'
           '<stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>' % (AMBER, AMBER),
           # the board fades out toward the title, so the type sits on clean black
           '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">'
           '<stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="0.36" stop-color="#000" stop-opacity="1"/>'
           '<stop offset="0.5" stop-color="#000" stop-opacity="0"/></linearGradient>',
           '<linearGradient id="rule" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="%d" y2="0">'
           '<stop offset="0" stop-color="%s" stop-opacity="0.5"/><stop offset="0.45" stop-color="%s" stop-opacity="0.5"/>'
           '<stop offset="0.75" stop-color="%s" stop-opacity="0"/></linearGradient>' % (W, AMBER, AMBER, AMBER),
           "</defs>",
           '<rect width="%d" height="%d" fill="#000000"/>' % (W, H),
           # hologram bloom: a blurred copy under the crisp lines
           '<g filter="url(#holo)" opacity="0.6"><g transform="matrix(%.5f %.5f %.5f %.5f %.2f %.2f)">%s</g></g>'
           % (*m, board_inner()),
           '<g transform="matrix(%.5f %.5f %.5f %.5f %.2f %.2f)">%s</g>' % (*m, board_inner()),
           '<rect width="%d" height="%d" fill="url(#fade)"/>' % (W, H),
           ]
    out += target(cx, cy)
    out.append('<text x="84" y="%d" font-family="IBM Plex Sans" font-weight="600" font-size="%d" letter-spacing="-7" '
               'fill="%s">%s</text>' % (TITLE_BASE, TITLE_SIZE, TEXT, TITLE))
    out.append('<text x="94" y="%d" font-family="IBM Plex Sans" font-weight="400" font-size="44" fill="%s">%s</text>'
               % (LINE_BASE, SECOND, LINE))
    out.append("</svg>")
    return "\n".join(out) + "\n"


dst = os.path.join(HERE, "thumbnail.svg")
with open(dst, "w", encoding="utf-8") as fh:
    fh.write(svg())
for w_, name in ((1500, "thumbnail.png"), (300, "thumbnail_300_preview.png")):
    subprocess.run(["rsvg-convert", "-w", str(w_), dst, "-o", os.path.join(HERE, name)], check=True)
print("wrote thumbnail.svg, thumbnail.png (1500 x 1000), thumbnail_300_preview.png")
