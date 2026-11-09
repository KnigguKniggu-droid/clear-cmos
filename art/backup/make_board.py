#!/usr/bin/env python3
"""Backup board line art generator (not the final art).

Writes board.svg next to this script: 1024 x 820 px, ATX 30.5 x 24.4 cm,
rear I/O top-left, line art on pure black. All geometry is built in code.
Text is drawn with a small stroke font as <path> data (no <text> elements).
Component positions are ESTIMATES from devpost/research/board-layout.md.

Usage:  python make_board.py [--check]
"""
import math
import os
import sys

W, H = 1024, 820
BW, BH = 30.5, 24.4
KX, KY = W / BW, H / BH
S = (KX + KY) / 2.0  # px per cm for lengths

BLACK = "#000000"
TRACE = "#1E6478"
EDGE = "#7ADFFF"
SILK = "#A9D8E8"

# ----------------------------------------------------------------- layers
LAYER_ORDER = ["bord1", "bord2", "trace", "power", "fine", "dim", "viaF", "ringS", "edgefine", "edge", "silk"]
LAYER_STYLE = {
    "bord1": (TRACE, 2.6),
    "bord2": (TRACE, 1.3),
    "trace": (TRACE, 2.0),
    "power": (TRACE, 4.4),
    "fine": (TRACE, 1.5),
    "dim": (TRACE, 2.5),
    "viaF": (TRACE, 1.5),
    "ringS": (TRACE, 1.6),
    "edgefine": (EDGE, 1.8),
    "edge": (EDGE, 3.4),
    "silk": (SILK, 2.6),
}
LINES = {k: [] for k in LAYER_ORDER}   # list of (pts, closed)
DOTS = {k: [] for k in LAYER_ORDER}    # list of (x, y, r, filled)
TEXT_BOXES = []                        # (x0, y0, x1, y1) px of silkscreen text


def P(x, y):
    return (x * KX, y * KY)


def PS(pts):
    return [P(*p) for p in pts]


def add_line(layer, pts, closed=False):
    if len(pts) >= 2:
        LINES[layer].append(([(float(a), float(b)) for a, b in pts], closed))


def add_dot(layer, x, y, r, filled=False):
    DOTS[layer].append((x, y, r, filled))


# ------------------------------------------------------- routing helpers
def sgn(v, tol=1e-6):
    return 1 if v > tol else (-1 if v < -tol else 0)


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def clean(pts):
    out = []
    for p in pts:
        if not out or dist(p, out[-1]) > 0.75:
            out.append(p)
        elif len(out) > 1 and p is pts[-1]:
            out[-1] = p          # keep the exact end point
    if len(out) < 3:
        return out
    res = [out[0]]
    for i in range(1, len(out) - 1):
        a, b, c = res[-1], out[i], out[i + 1]
        ux, uy = b[0] - a[0], b[1] - a[1]
        vx, vy = c[0] - b[0], c[1] - b[1]
        cr = ux * vy - uy * vx
        dt = ux * vx + uy * vy
        if abs(cr) < 1e-3 * math.hypot(ux, uy) * math.hypot(vx, vy) and dt > 0:
            continue
        res.append(b)
    res.append(out[-1])
    return res


def offset(pts, d):
    """Parallel offset of a polyline with miter joins (normal = (-uy, ux))."""
    pts = clean(pts)
    n = len(pts)
    if n < 2:
        return pts
    nrm = []
    for i in range(n - 1):
        ux, uy = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
        L = math.hypot(ux, uy)
        ux, uy = ux / L, uy / L
        nrm.append((-uy, ux))
    res = [(pts[0][0] + d * nrm[0][0], pts[0][1] + d * nrm[0][1])]
    for i in range(1, n - 1):
        mx, my = nrm[i - 1][0] + nrm[i][0], nrm[i - 1][1] + nrm[i][1]
        k = 1.0 + nrm[i - 1][0] * nrm[i][0] + nrm[i - 1][1] * nrm[i][1]
        res.append((pts[i][0] + d * mx / k, pts[i][1] + d * my / k))
    res.append((pts[-1][0] + d * nrm[-1][0], pts[-1][1] + d * nrm[-1][1]))
    return res


def dog(a, b, style):
    """Axis/45-degree dogleg from a to b. style: hd, dh, vd, dv."""
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    adx, ady = abs(dx), abs(dy)
    if style == "hd":
        c = (bx - sgn(dx) * ady, ay)
    elif style == "dh":
        c = (ax + sgn(dx) * ady, by)
    elif style == "vd":
        c = (ax, by - sgn(dy) * adx)
    elif style == "dv":
        c = (bx, ay + sgn(dy) * adx)
    else:
        raise ValueError(style)
    return [a, c, b]


def chain(pts, styles):
    out = [pts[0]]
    for i, st in enumerate(styles):
        out += dog(pts[i], pts[i + 1], st)[1:]
    return clean(out)


class Frame:
    """Local frame: a along heading d, b lateral (b>0 is to the right-hand side on screen)."""

    def __init__(self, origin, d):
        self.o = origin
        self.u = {"E": (1, 0), "S": (0, 1), "W": (-1, 0), "N": (0, -1)}[d]
        self.v = (-self.u[1], self.u[0])

    def __call__(self, a, b):
        return (self.o[0] + a * self.u[0] + b * self.v[0],
                self.o[1] + a * self.u[1] + b * self.v[1])


def fan(F, bs, a_s, b_ends, a_end):
    out = []
    for b, be in zip(sorted(bs), sorted(b_ends)):
        out.append(clean([F(0, b), F(a_s, b), F(a_s + abs(be - b), be), F(a_end, be)]))
    return out


def bus_lines(center, n, pitch):
    return [offset(center, (i - (n - 1) / 2.0) * pitch) for i in range(n)]


def sq(x, y, s=6.0, layer="fine"):
    h = s / 2.0
    add_line(layer, [(x - h, y - h), (x + h, y - h), (x + h, y + h), (x - h, y + h)], True)


# ---------------------------------------------------------- shapes in cm
def rect(layer, x0, y0, x1, y1, ch=0.0):
    if ch <= 0:
        pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    else:
        pts = [(x0 + ch, y0), (x1 - ch, y0), (x1, y0 + ch), (x1, y1 - ch),
               (x1 - ch, y1), (x0 + ch, y1), (x0, y1 - ch), (x0, y0 + ch)]
    add_line(layer, PS(pts), True)


def ring(layer, cx, cy, r):
    x, y = P(cx, cy)
    add_dot(layer, x, y, r * S, False)


def poly(layer, pts, closed=False):
    add_line(layer, PS(pts), closed)


# ------------------------------------------------------------ stroke font
# Glyph cell: 5 wide, 8 tall (y down). Octagon-leaning strokes to match 45-degree art.
GL = {
    "A": [[(0, 8), (0, 2), (1.5, 0), (3.5, 0), (5, 2), (5, 8)], [(0, 4.8), (5, 4.8)]],
    "B": [[(0, 8), (0, 0), (3.5, 0), (5, 1.3), (5, 2.7), (3.5, 4), (0, 4)],
          [(3.5, 4), (5, 5.3), (5, 6.7), (3.5, 8), (0, 8)]],
    "C": [[(5, 1.5), (3.5, 0), (1.5, 0), (0, 1.5), (0, 6.5), (1.5, 8), (3.5, 8), (5, 6.5)]],
    "D": [[(0, 0), (0, 8), (3, 8), (5, 6), (5, 2), (3, 0), (0, 0)]],
    "E": [[(5, 0), (0, 0), (0, 8), (5, 8)], [(0, 4), (4, 4)]],
    "I": [[(1, 0), (4, 0)], [(2.5, 0), (2.5, 8)], [(1, 8), (4, 8)]],
    "L": [[(0, 0), (0, 8), (5, 8)]],
    "M": [[(0, 8), (0, 0), (2.5, 3.6), (5, 0), (5, 8)]],
    "O": [[(1.5, 0), (3.5, 0), (5, 1.5), (5, 6.5), (3.5, 8), (1.5, 8), (0, 6.5), (0, 1.5), (1.5, 0)]],
    "P": [[(0, 8), (0, 0), (3.5, 0), (5, 1.5), (5, 3), (3.5, 4.5), (0, 4.5)]],
    "R": [[(0, 8), (0, 0), (3.5, 0), (5, 1.5), (5, 3), (3.5, 4.5), (0, 4.5)], [(2.6, 4.5), (5, 8)]],
    "S": [[(5, 1.5), (3.5, 0), (1.5, 0), (0, 1.5), (0, 3), (1.5, 4), (3.5, 4), (5, 5), (5, 6.5),
           (3.5, 8), (1.5, 8), (0, 6.5)]],
    "T": [[(0, 0), (5, 0)], [(2.5, 0), (2.5, 8)]],
    "U": [[(0, 0), (0, 6.5), (1.5, 8), (3.5, 8), (5, 6.5), (5, 0)]],
    "X": [[(0, 0), (5, 8)], [(5, 0), (0, 8)]],
    "1": [[(0.8, 1.8), (2.8, 0), (2.8, 8)]],
    "2": [[(0, 1.5), (1.5, 0), (3.5, 0), (5, 1.5), (5, 3), (0, 8), (5, 8)]],
    "5": [[(5, 0), (0.4, 0), (0.1, 3.8), (3.5, 3.4), (5, 4.9), (5, 6.5), (3.5, 8), (1.5, 8), (0, 6.5)]],
    "6": [[(4.8, 1), (3.6, 0), (1.5, 0), (0, 1.5), (0, 6.5), (1.5, 8), (3.5, 8), (5, 6.5), (5, 5.2),
           (3.5, 3.8), (1.5, 3.8), (0, 5.2)]],
    "_": [[(0, 9.3), (5, 9.3)]],
}


def text_width(s, h, sp=2.2):
    sc = h / 8.0
    return (len(s) * (5 + sp) - sp) * sc


def text(s, x_cm, y_cm, h, d="E", sp=2.2):
    """Draw s with the stroke font. E: (x,y)=top-left, reads right.
    N: (x,y)=bottom-left of the text box, reads upward (glyph tops face left)."""
    sc = h / 8.0
    x0, y0 = P(x_cm, y_cm)
    ux, uy, vx, vy = (1, 0, 0, 1) if d == "E" else (0, -1, 1, 0)
    boxes = []
    for i, ch in enumerate(s):
        for stroke in GL[ch]:
            pts = []
            for gx, gy in stroke:
                u = (i * (5 + sp) + gx) * sc
                v = gy * sc
                pts.append((x0 + u * ux + v * vx, y0 + u * uy + v * vy))
            add_line("silk", pts)
            boxes += pts
    xs = [p[0] for p in boxes]
    ys = [p[1] for p in boxes]
    TEXT_BOXES.append((min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1, s))


# ======================================================================
#                              THE BOARD
# ======================================================================
def border():
    ch = 14
    m = 3
    pts = [(m + ch, m), (W - m - ch, m), (W - m, m + ch), (W - m, H - m - ch),
           (W - m - ch, H - m), (m + ch, H - m), (m, H - m - ch), (m, m + ch)]
    add_line("bord1", pts, True)
    m = 9
    ch = 12
    pts = [(m + ch, m), (W - m - ch, m), (W - m, m + ch), (W - m, H - m - ch),
           (W - m - ch, H - m), (m + ch, H - m), (m, H - m - ch), (m, m + ch)]
    add_line("bord2", pts, True)


def mount(cx, cy, r=0.45, vias=10):
    x, y = P(cx, cy)
    add_dot("ringS", x, y, r * S, False)
    add_dot("ringS", x, y, r * S * 0.45, False)
    for k in range(vias):
        a = 2 * math.pi * k / vias + math.pi / vias
        add_dot("viaF", x + math.cos(a) * r * S * 1.5, y + math.sin(a) * r * S * 1.5, 1.7, True)
    # cross-hair ticks
    for a in (0, 90, 180, 270):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        add_line("fine", [(x + ca * r * S * 0.55, y + sa * r * S * 0.55),
                          (x + ca * r * S * 0.9, y + sa * r * S * 0.9)])


# ------------------------------------------------------------- Rear I/O
def io_block():
    poly("dim", [(0.25, 0.55), (3.95, 0.55), (4.25, 0.85), (4.25, 10.95), (3.95, 11.25), (0.25, 11.25)])
    for cy in (1.55, 3.0):                     # Wi-Fi antenna connectors
        ring("dim", 0.95, cy, 0.4)
        ring("fine", 0.95, cy, 0.17)
    rect("dim", 2.35, 1.05, 3.95, 2.05, 0.18)  # HDMI-like
    poly("fine", [(2.6, 1.3), (3.7, 1.3), (3.7, 1.8), (2.6, 1.8)], True)
    for y0 in (3.95, 5.65):                    # two USB-A stacks
        rect("dim", 0.25, y0, 2.45, y0 + 1.45, 0.1)
        rect("fine", 0.55, y0 + 0.33, 2.15, y0 + 1.12)
        poly("fine", [(0.55, y0 + 0.72), (2.15, y0 + 0.72)])
    rect("dim", 0.25, 7.4, 1.95, 8.2, 0.3)     # USB-C
    rect("fine", 0.55, 7.65, 1.65, 7.95, 0.12)
    rect("dim", 0.25, 8.5, 2.65, 10.7, 0.1)    # LAN
    rect("fine", 0.6, 8.85, 2.3, 10.35)
    for k in range(8):
        x = 0.85 + k * 0.19
        poly("fine", [(x, 9.2), (x, 9.9)])
    for y in (4.25, 5.5, 6.75, 8.0, 9.25):     # audio jacks
        ring("dim", 3.4, y, 0.38)
        ring("fine", 3.4, y, 0.15)


# ----------------------------------------------------------------- VRM
def vrm():
    # left column
    rect("dim", 4.65, 0.85, 6.55, 3.7, 0.2)
    for k in range(3):
        rect("fine", 4.9 + k * 0.58, 1.1, 5.4 + k * 0.58, 3.45)
    for k in range(4):
        y0 = 4.0 + k * 1.0
        rect("dim", 4.65, y0, 6.55, y0 + 0.8, 0.12)
        rect("fine", 5.0, y0 + 0.2, 6.2, y0 + 0.6)
    for k in range(4):
        ring("dim", 5.0 + k * 0.5, 8.75, 0.2)
    # top row
    for k in range(4):
        x0 = 8.6 + k * 1.2
        rect("dim", x0, 0.6, x0 + 1.0, 1.65, 0.12)
        rect("fine", x0 + 0.22, 0.82, x0 + 0.78, 1.43)
    # EPS connector + CPU fan header
    rect("dim", 14.0, 0.5, 17.2, 1.65, 0.12)
    for r_ in range(2):
        for c_ in range(4):
            x, y = P(14.4 + c_ * 0.75, 0.85 + r_ * 0.55)
            sq(x, y, 6)
    rect("dim", 17.5, 0.5, 18.9, 1.4, 0.1)
    for c_ in range(4):
        x, y = P(17.8 + c_ * 0.33, 0.95)
        sq(x, y, 5)


# --------------------------------------------------------------- Socket
SOCK_C = (11.4, 5.7)
SOCK_F = 5.6
SOCK_I = 3.6


def socket():
    cx, cy = SOCK_C
    fx0, fy0, fx1, fy1 = cx - SOCK_F / 2, cy - SOCK_F / 2, cx + SOCK_F / 2, cy + SOCK_F / 2
    ix0, iy0, ix1, iy1 = cx - SOCK_I / 2, cy - SOCK_I / 2, cx + SOCK_I / 2, cy + SOCK_I / 2
    rect("edge", fx0, fy0, fx1, fy1, 0.4)
    rect("edge", ix0, iy0, ix1, iy1, 0.0)
    # load-plate corner brackets
    g = 0.22
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        x = (fx0 + g) if sx > 0 else (fx1 - g)
        y = (fy0 + g) if sy > 0 else (fy1 - g)
        poly("edgefine", [(x + sx * 0.7, y), (x, y), (x, y + sy * 0.7)])
    # pin-1 marker
    poly("edgefine", [(ix0 - 0.1, iy1 + 0.35), (ix0 + 0.3, iy1 + 0.35), (ix0 - 0.1, iy1 - 0.05)], True)
    # land grid
    n = 7
    for i in range(n):
        for j in range(n):
            x = ix0 + 0.28 + i * (SOCK_I - 0.56) / (n - 1)
            y = iy0 + 0.28 + j * (SOCK_I - 0.56) / (n - 1)
            px_, py_ = P(x, y)
            add_dot("viaF", px_, py_, 1.5, True)
    # cooler mounting rings
    for dx in (-4.05, 4.05):
        for dy in (-2.55, 2.55):
            mount(cx + dx, cy + dy, 0.42)


# ----------------------------------------------------------------- DIMMs
DIMM_X0, DIMM_PITCH, DIMM_W = 20.0, 1.9, 1.0
DIMM_Y0, DIMM_Y1 = 1.0, 11.0


def dimm_cx(k):
    return DIMM_X0 + DIMM_W / 2 + k * DIMM_PITCH


def dimms():
    for k in range(4):
        cx = dimm_cx(k)
        x0, x1 = cx - DIMM_W / 2, cx + DIMM_W / 2
        rect("edge", x0, DIMM_Y0, x1, DIMM_Y1, 0.12)
        rect("edgefine", cx - 0.14, DIMM_Y0 + 0.8, cx + 0.14, DIMM_Y1 - 0.8)
        ky = DIMM_Y0 + 0.8 + (DIMM_Y1 - DIMM_Y0 - 1.6) * (0.38 + 0.03 * (k % 2))
        poly("edgefine", [(cx - 0.14, ky), (cx + 0.14, ky)])
        # latch tab at top end
        poly("edgefine", [(cx - 0.3, DIMM_Y0), (cx - 0.3, DIMM_Y0 - 0.38), (cx + 0.3, DIMM_Y0 - 0.38),
                          (cx + 0.3, DIMM_Y0)])
        # edge pin ticks (left side only, leaves the right gap for the label)
        yy = DIMM_Y0 + 0.8
        while yy < 7.4:
            xa, ya = P(x0 - 0.04, yy)
            xb, _ = P(x0 - 0.13, yy)
            add_line("fine", [(xa, ya), (xb, ya)])
            yy += 0.2


# ----------------------------------------------------------- PCIe / M.2
def pcie_slot(x0, y0, x1, y1, key=0.2, latch=True):
    rect("edge", x0, y0, x1, y1, 0.12)
    cy = (y0 + y1) / 2.0
    hh = 0.17
    xk = x0 + (x1 - x0) * key
    poly("edgefine", [(x0 + 0.3, cy - hh), (xk - 0.07, cy - hh), (xk - 0.07, cy + hh), (x0 + 0.3, cy + hh)], True)
    poly("edgefine", [(xk + 0.07, cy - hh), (x1 - 0.3, cy - hh), (x1 - 0.3, cy + hh), (xk + 0.07, cy + hh)], True)
    if latch:
        poly("edgefine", [(x1, cy - 0.3), (x1 + 0.38, cy - 0.3), (x1 + 0.38, cy + 0.3), (x1, cy + 0.3)])
    xx = x0 + 0.3
    while xx < x1 - 0.25:
        xa, ya = P(xx, y0 - 0.04)
        _, yb = P(xx, y0 - 0.16)
        add_line("fine", [(xa, ya), (xa, yb)])
        xa, ya = P(xx, y1 + 0.04)
        _, yb = P(xx, y1 + 0.16)
        add_line("fine", [(xa, ya), (xa, yb)])
        xx += 0.2


def m2_area(x0, y0, x1, y1):
    rect("edge", x0, y0, x1, y1, 0.2)
    cy = (y0 + y1) / 2.0
    rect("edgefine", x1 - 1.15, y0 + 0.4, x1 - 0.3, y1 - 0.4)
    for k in range(6):
        yy = y0 + 0.62 + k * (y1 - y0 - 1.24) / 5.0
        poly("edgefine", [(x1 - 1.15, yy), (x1 - 0.75, yy)])
    ring("edgefine", x0 + 0.65, cy, 0.3)
    ring("edgefine", x0 + 0.65, cy, 0.12)
    # module outline (22 x 80 style) inside, thin
    poly("fine", [(x0 + 1.2, y0 + 0.3), (x1 - 1.3, y0 + 0.3)])
    poly("fine", [(x0 + 1.2, y1 - 0.3), (x1 - 1.3, y1 - 0.3)])


# ------------------------------------------------- misc secondary parts
def chip(cx, cy, w, h, pins_x=0, pins_y=0, layer="dim"):
    rect(layer, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, 0.1)
    for k in range(pins_x):
        x = cx - w / 2 + (k + 0.5) * w / pins_x
        for sy in (-1, 1):
            xa, ya = P(x, cy + sy * h / 2)
            add_line("fine", [(xa, ya), (xa, ya + sy * 5)])
            add_dot("viaF", xa, ya + sy * 9, 1.6, True)
    for k in range(pins_y):
        y = cy - h / 2 + (k + 0.5) * h / pins_y
        for sx in (-1, 1):
            xa, ya = P(cx + sx * w / 2, y)
            add_line("fine", [(xa, ya), (xa + sx * 5, ya)])
            add_dot("viaF", xa + sx * 9, ya, 1.6, True)


def cap(cx, cy, r=0.3):
    ring("dim", cx, cy, r)
    x, y = P(cx, cy)
    add_line("fine", [(x - r * S * 0.55, y), (x + r * S * 0.55, y)])


def header(x0, y0, cols, rows, pitch=0.42):
    w = cols * pitch + 0.3
    h = rows * pitch + 0.3
    rect("dim", x0, y0, x0 + w, y0 + h, 0.08)
    for r_ in range(rows):
        for c_ in range(cols):
            x, y = P(x0 + 0.15 + (c_ + 0.5) * pitch, y0 + 0.15 + (r_ + 0.5) * pitch)
            add_dot("ringS", x, y, 2.6, False)


def chipset():
    cx, cy, s = 23.6, 17.3, 3.8
    rect("dim", cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2, 0.3)
    rect("fine", cx - s / 2 + 0.3, cy - s / 2 + 0.3, cx + s / 2 - 0.3, cy + s / 2 - 0.3, 0.15)
    rect("fine", cx - s / 2 + 0.6, cy - s / 2 + 0.6, cx + s / 2 - 0.6, cy + s / 2 - 0.6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = P(cx + sx * (s / 2 - 0.15), cy + sy * (s / 2 - 0.15))
            add_dot("viaF", x, y, 2.0, True)


def sata_ports():
    for k in range(5):
        y0 = 14.95 + k * 1.0
        rect("dim", 26.55, y0, 29.35, y0 + 0.8, 0.1)
        rect("fine", 28.1, y0 + 0.2, 29.15, y0 + 0.6)
        poly("fine", [(26.75, y0 + 0.2), (27.8, y0 + 0.2), (27.8, y0 + 0.6), (26.75, y0 + 0.6)])


def atx24():
    rect("dim", 28.1, 8.2, 29.45, 13.35, 0.1)
    for r_ in range(12):
        for c_ in range(2):
            x, y = P(28.45 + c_ * 0.6, 8.5 + r_ * 0.4)
            sq(x, y, 5.5)


def debug_leds():
    for k in range(4):
        rect("edgefine", 28.0, 4.75 + k * 0.6, 28.38, 4.75 + k * 0.6 + 0.38)


def lower_left():
    chip(2.0, 14.5, 1.2, 1.2, 4, 4)
    for k in range(3):
        cap(0.85, 17.0 + k * 1.2)
    header(1.4, 21.0, 5, 2, 0.42)


def lower_mid():
    chip(14.7, 20.3, 1.1, 1.1, 4, 0)         # SPI flash style
    for k in range(5):
        cap(10.4 + k * 0.85, 21.0, 0.22)


def lower_right():
    header(24.2, 22.4, 10, 2, 0.42)      # front panel style
    header(27.35, 20.3, 5, 2, 0.42)      # USB style


# ======================================================================
#                              BUSES
# ======================================================================
def comb_tail(traces, pad_y, pad_x0, pitch_px, heading):
    """Traces end heading W or E; each peels at 45 degrees onto a pad row at pad_y.
    The lane closest to the pad row takes the first pad (no crossings)."""
    order = sorted(range(len(traces)), key=lambda i: abs(traces[i][-1][1] - pad_y))
    out = [None] * len(traces)
    for rank, i in enumerate(order):
        x0, y = traces[i][-1]
        px = pad_x0 - rank * pitch_px if heading == "W" else pad_x0 + rank * pitch_px
        dy = abs(pad_y - y)
        xs = px + dy if heading == "W" else px - dy
        out[i] = clean(list(traces[i]) + [(xs, y), (px, pad_y)])
    return out


def ends_pad(lines):
    for ln in lines:
        add_line("trace", ln)
        add_dot("viaF", ln[0][0], ln[0][1], 2.2, True)
        sq(ln[-1][0], ln[-1][1], 6.0)


def ends_via(lines):
    for ln in lines:
        add_line("trace", ln)
        add_dot("viaF", ln[0][0], ln[0][1], 2.2, True)
        add_dot("viaF", ln[-1][0], ln[-1][1], 2.2, True)


def pads_to_lanes(pads, lanes, heading):
    pads = sorted(pads, key=lambda p: p[1])
    lanes = sorted(lanes, key=lambda l: l[0][1])
    out = []
    for (px, py), ln in zip(pads, lanes):
        lx, ly = ln[0]
        dy = abs(ly - py)
        xs = lx - dy if heading == "E" else lx + dy
        out.append(clean([(px, py), (xs, py)] + list(ln)))
    return out


def buses():
    # ---- A: socket right edge -> DIMM 1 left pad column (fan out upward) ----
    fa = Frame(P(14.2, 4.6), "E")
    n = 10
    bs = [(i - (n - 1) / 2) * 5.5 for i in range(n)]
    pad_x = P(19.55, 0)[0] - fa.o[0]
    ends = [P(0, 1.9 + 0.4 * i)[1] - fa.o[1] for i in range(n)]
    ends_pad(fan(fa, bs, P(15.9, 0)[0] - fa.o[0], ends, pad_x))

    # ---- B: 15 traces -> three lanes under the DIMM bank -> slots 2..4 ----
    pitch = 6.0
    per = 4
    xc = P(17.55, 0)[0]
    y0 = P(0, 6.65)[1]
    x_sock = P(14.2, 0)[0]
    t1 = 1.0 * S
    center = [(x_sock, y0), (xc - t1, y0), (xc, y0 + t1), (xc, P(0, 10.8)[1])]
    gap = per * pitch
    lane_y = [P(0, 11.95)[1], P(0, 12.75)[1], P(0, 13.55)[1]]
    peel_x = [P(dimm_cx(k), 0)[0] for k in (1, 2, 3)]
    stub_end = P(0, 11.5)[1]
    tt = 14.0
    for g in range(3):
        o = (1 - g) * gap
        head = offset(center, -o)
        hx, hy = head[-1]
        path = head[:-1] + [(hx, lane_y[g] - tt), (hx + tt, lane_y[g]), (peel_x[g] - tt, lane_y[g]),
                            (peel_x[g], lane_y[g] - tt), (peel_x[g], stub_end)]
        path = clean(path)
        ends_via([offset(path, (j - (per - 1) / 2.0) * pitch) for j in range(per)])

    # ---- M2A: socket bottom edge -> M2A top edge ----
    c = [P(12.6, 8.5), P(12.6, 8.62), P(12.95, 8.97), P(12.95, 9.6)]
    ends_via(bus_lines(c, 10, 5.0))

    # ---- chipset left edge bundle (20) splits: PCIe1 / M2B / PCIe2 ----
    p = 5.2
    ych = P(0, 17.3)[1]
    xch = P(21.7, 0)[0]
    n1, n2, n3 = 6, 8, 6
    off1 = (n1 / 2.0 - 0.5 - (n1 + n2 + n3) / 2.0 + 0.5) * p     # centre of first group relative to bundle centre
    off3 = ((n1 + n2) + n3 / 2.0 - 0.5 - (n1 + n2 + n3) / 2.0 + 0.5) * p
    y1 = ych + off1
    y3 = ych + off3
    a_ = (xch - 0.8 * S, y1)
    y_t = P(0, 14.55)[1]
    cP1 = [(xch, y1)] + chain([a_, (P(18.9, 0)[0], y_t)], ["dh"])
    xb = cP1[-1][0] - 40.0
    amp1 = 10.0
    cP1 += [(xb, y_t), (xb - amp1, y_t + amp1), (xb - amp1 - 14.0, y_t + amp1), (xb - 2 * amp1 - 14.0, y_t),
            (P(14.9, 0)[0], y_t)]
    lanes = bus_lines(cP1, n1, p)
    ends_pad(comb_tail(lanes, P(0, 13.85)[1], P(13.0, 0)[0], 0.417 * KX, "W"))
    cM = chain([(xch, ych), P(16.0, 16.5)], ["hd"])
    ends_via(bus_lines(cM, n2, p))
    amp = 9.0
    cP2 = [(xch, y3), (P(20.2, 0)[0], y3), (P(20.2, 0)[0] - amp, y3 + amp), (P(19.0, 0)[0] + amp, y3 + amp),
           (P(19.0, 0)[0], y3), (P(14.0, 0)[0], y3)]
    lanes = bus_lines(cP2, n3, p)
    ends_pad(comb_tail(lanes, P(0, 18.98)[1], P(13.0, 0)[0], 0.417 * KX, "W"))

    # ---- chipset bottom -> front-panel header (fan) ----
    F = Frame(P(24.3, 19.2), "S")
    bs = [(i - 2.5) * 5.5 for i in range(6)]
    hx0 = 24.2 + 0.15 + 0.21
    pads_b = [-(P(hx0 + k * 0.42, 0)[0] - F.o[0]) for k in range(6)]
    a_end = P(0, 22.3)[1] - F.o[1]
    ends_pad(fan(F, bs, 30.0, pads_b, a_end))

    # ---- chipset right edge -> SATA ports ----
    ys = [15.8, 16.6, 17.35, 18.15, 18.9]
    ps = [15.35 + k * 1.0 for k in range(5)]
    for yy, pyy in zip(ys, ps):
        a = P(25.5, yy)
        b = P(26.55, pyy)
        tl = clean(dog(a, b, "dh"))
        add_line("trace", tl)
        add_dot("viaF", a[0], a[1], 2.2, True)
        add_dot("viaF", b[0], b[1], 2.2, True)

    # ---- chipset top edge -> ATX 24-pin bottom edge ----
    x0c = P(24.4, 0)[0]
    y_h = P(0, 14.35)[1]
    x_up = P(28.8, 0)[0]
    tq = 14.0
    c = [(x0c, P(0, 15.4)[1]), (x0c, y_h + tq), (x0c + tq, y_h), (x_up - tq, y_h), (x_up, y_h - tq),
         (x_up, P(0, 13.4)[1])]
    ends_via(bus_lines(c, 5, 5.0))

    # ---- power: VRM -> socket (fat traces) ----
    for k in range(4):
        yy = P(0, 4.4 + k * 1.0)[1]
        x0_, x1_ = P(6.55, 0)[0], P(8.6, 0)[0]
        add_line("power", [(x0_, yy), (x1_, yy)])
        add_dot("viaF", x0_ + 6, yy, 3.0, True)
        add_dot("viaF", x1_, yy, 3.0, True)
    for k in range(4):
        xx = P(9.1 + k * 1.2, 0)[0]
        y0_, y1_ = P(0, 1.65)[1], P(0, 2.9)[1]
        add_line("power", [(xx, y0_), (xx, y1_)])
        add_dot("viaF", xx, y0_ + 6, 3.0, True)
        add_dot("viaF", xx, y1_, 3.0, True)
    # EPS connector -> socket top edge (thin bus)
    a0 = P(14.5, 1.65)
    a1 = (a0[0], a0[1] + 12)
    ytop = P(0, 2.9)[1]
    a2 = (a1[0] - (ytop - a1[1]), ytop)
    ends_via(bus_lines([a0, a1, a2], 6, 5.0))

    # ---- M2B left end <-> audio codec, codec -> audio header ----
    cA = chain([P(2.6, 14.5), P(8.0, 16.5)], ["hd"])
    ends_via(bus_lines(cA, 4, 5.5))
    F = Frame(P(2.0, 15.2), "S")
    hx0 = 1.4 + 0.15 + 0.21
    bs = [(i - 2) * 5.5 for i in range(5)]
    pads_b = [-(P(hx0 + k * 0.42, 0)[0] - F.o[0]) for k in range(5)]
    ends_pad(fan(F, bs, 4.5 * S, pads_b, P(0, 20.85)[1] - F.o[1]))

    # ---- VRM bottom -> M2A left end ----
    cV = chain([P(6.65, 9.2), P(8.0, 10.7)], ["vd"])
    ends_via(bus_lines(cV, 5, 5.0))

    # ---- I/O block bottom -> PCIEX16 left end ----
    cI = chain([P(3.4, 11.25), P(4.55, 12.95)], ["vd"])
    ends_via(bus_lines(cI, 6, 5.0))

    # ---- USB header -> front-panel header ----
    ends_via(bus_lines([P(28.35, 21.5), P(28.35, 22.3)], 5, 5.0))

    # ---- audio codec top -> I/O block bottom ----
    ends_via(bus_lines([P(2.0, 13.85), P(2.0, 11.3)], 6, 5.0))

    # ---- audio header -> PCIEX1 slot (comb onto its top edge) ----
    lanes = bus_lines([P(4.0, 21.1), P(4.95, 21.1)], 6, 5.0)
    ends_pad(comb_tail(lanes, P(0, 21.77)[1], P(5.3, 0)[0], 0.417 * KX, "E"))

    # ---- debug LEDs -> ATX 24-pin top edge ----
    yc = P(0, 5.84)[1]
    xa = P(29.1, 0)[0]
    xb2 = P(29.75, 0)[0]
    t = 14.0
    yd = P(0, 7.35)[1]
    cen = [(xa, yc), (xb2 - t, yc), (xb2, yc + t), (xb2, yd), (xb2 - 0.6 * S, yd + 0.6 * S),
           (xb2 - 0.6 * S, P(0, 8.2)[1])]
    lanes = bus_lines(cen, 4, 5.0)
    pads = [P(28.38, 4.75 + k * 0.6 + 0.19) for k in range(4)]
    ends_via(pads_to_lanes(pads, lanes, "E"))


def make_free():
    segs = []
    for name in LAYER_ORDER:
        if name in ("bord1", "bord2"):
            continue
        for pts, _ in LINES[name]:
            for a, b in zip(pts, pts[1:]):
                segs.append((a, b))
    circles = [(x, y, r) for name in LAYER_ORDER for (x, y, r, _) in DOTS[name]]

    def free(x, y, clear=9.0):
        for a, b in segs:
            if seg_pt_dist((x, y), a, b) < clear:
                return False
        for cx, cy, r in circles:
            if math.hypot(x - cx, y - cy) < r + clear:
                return False
        for (x0, y0, x1, y1, _s) in TEXT_BOXES:
            if x0 - clear < x < x1 + clear and y0 - clear < y < y1 + clear:
                return False
        for _n, zx, zy, zr in ZONES:
            if math.hypot(x - zx, y - zy) < zr + clear:
                return False
        return True

    return free


def finish():
    """Late, collision-checked decoration: silkscreen accents and ground-stitching via rows."""
    free = make_free()

    def silk_arm(p0, p1, clear=6.0):
        n = max(2, int(dist(p0, p1) / 4))
        for i in range(n + 1):
            x = p0[0] + (p1[0] - p0[0]) * i / n
            y = p0[1] + (p1[1] - p0[1]) * i / n
            if not free(x, y, clear):
                return
        add_line("silk", [p0, p1])

    def brackets(x0, y0, x1, y1, grow, arm):
        """Four silkscreen corner brackets around a component (cm)."""
        x0, y0, x1, y1 = x0 - grow, y0 - grow, x1 + grow, y1 + grow
        for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            silk_arm(P(cx, cy), P(cx + sx * arm, cy))
            silk_arm(P(cx, cy), P(cx, cy + sy * arm))

    cx, cy = SOCK_C
    brackets(cx - SOCK_F / 2, cy - SOCK_F / 2, cx + SOCK_F / 2, cy + SOCK_F / 2, 0.3, 0.55)
    brackets(21.7, 15.4, 25.5, 19.2, 0.3, 0.55)                       # chipset
    brackets(DIMM_X0, DIMM_Y0 - 0.4, DIMM_X0 + 3 * DIMM_PITCH + DIMM_W, DIMM_Y1, 0.35, 0.7)
    brackets(8.0, 9.6, 16.0, 11.8, 0.25, 0.5)                          # M2A
    brackets(8.0, 15.4, 16.0, 17.6, 0.25, 0.5)                         # M2B

    def pin1(x, y, s=0.16):
        pts = [P(x, y), P(x + s, y), P(x, y + s)]
        ok = all(free(p[0], p[1], 4.0) for p in pts)
        if ok:
            add_line("silk", pts, True)

    pin1(24.2 - 0.12, 22.4 - 0.3)       # front panel header
    pin1(1.4 - 0.12, 21.0 - 0.3)        # audio header
    pin1(27.35 - 0.12, 20.3 - 0.3)      # USB header
    pin1(14.0 - 0.3, 0.5)               # EPS connector
    pin1(28.1 - 0.12, 8.2 - 0.3)        # ATX 24-pin

    def row(p0, p1, pitch):
        n = max(1, int(dist(p0, p1) / pitch))
        for i in range(n + 1):
            x = p0[0] + (p1[0] - p0[0]) * i / n
            y = p0[1] + (p1[1] - p0[1]) * i / n
            if free(x, y):
                add_dot("viaF", x, y, 1.9, True)

    row((1010 - 14, 60), (1010 - 14, 790), 19.0)       # right edge
    row((60, 806 - 12), (990, 806 - 12), 19.0)         # bottom edge
    row((26, 440), (26, 790), 19.0)                    # left edge, below the I/O block


# ======================================================================
#                              LABELS
# ======================================================================
def labels():
    text("CPU", 10.45, 3.0, 26)
    text("M2A", 9.4, 10.3, 24)
    text("PCIEX16", 4.7, 11.55, 18)
    for k, nm in enumerate(("DDR5_A1", "DDR5_A2", "DDR5_B1", "DDR5_B2")):
        text(nm, dimm_cx(k) + DIMM_W / 2 + 0.09, 10.7, 18, "N")
    text("BAT", 21.9, 20.6, 24)
    text("CLR_CMOS", 11.0, 22.7, 22)
    text("D_LED", 27.55, 3.95, 17)


# ======================================================================
#                          EMIT / CHECKS
# ======================================================================
def fmt(v):
    s = ("%.1f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def path_d(pts, closed):
    d = "M" + fmt(pts[0][0]) + " " + fmt(pts[0][1])
    for x, y in pts[1:]:
        d += "L" + fmt(x) + " " + fmt(y)
    return d + ("Z" if closed else "")


def build_svg():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
           '<rect width="%d" height="%d" fill="%s"/>' % (W, H, BLACK)]
    for name in LAYER_ORDER:
        color, width = LAYER_STYLE[name]
        lines, dots = LINES[name], DOTS[name]
        if lines:
            d = "".join(path_d(p, c) for p, c in lines)
            out.append('<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" '
                       'stroke-linejoin="round"/>' % (d, color, fmt(width)))
        filled = [x for x in dots if x[3]]
        stroked = [x for x in dots if not x[3]]
        if filled:
            out.append('<g fill="%s">' % color)
            for x, y, r, _ in filled:
                out.append('<circle cx="%s" cy="%s" r="%s"/>' % (fmt(x), fmt(y), fmt(r)))
            out.append("</g>")
        if stroked:
            out.append('<g fill="none" stroke="%s" stroke-width="%s">' % (color, fmt(width)))
            for x, y, r, _ in stroked:
                out.append('<circle cx="%s" cy="%s" r="%s"/>' % (fmt(x), fmt(y), fmt(r)))
            out.append("</g>")
    out.append("</svg>")
    return "\n".join(out)


def seg_pt_dist(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


ZONES = []  # (name, cx_px, cy_px, r_px)


def seg_cross(a, b, c, d):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    o1, o2, o3, o4 = o(a, b, c), o(a, b, d), o(c, d, a), o(c, d, b)
    return o1 * o2 < -1e-6 and o3 * o4 < -1e-6


def checks():
    problems = 0
    # 45-degree rule on trace layers
    for name in ("trace", "power"):
        for pts, _ in LINES[name]:
            for a, b in zip(pts, pts[1:]):
                dx, dy = abs(b[0] - a[0]), abs(b[1] - a[1])
                if dx > 0.3 and dy > 0.3 and abs(dx - dy) > 0.4:
                    print("non-45 segment", name, a, b)
                    problems += 1
    # clean zones
    for zn, zx, zy, zr in ZONES:
        for name in LAYER_ORDER:
            if name in ("silk", "bord1", "bord2"):
                continue
            for pts, _ in LINES[name]:
                for a, b in zip(pts, pts[1:]):
                    if seg_pt_dist((zx, zy), a, b) < zr:
                        print("zone %s hit by %s line near %s" % (zn, name, a))
                        problems += 1
                        break
            for x, y, r, _ in DOTS[name]:
                if math.hypot(x - zx, y - zy) < zr + r:
                    print("zone %s hit by %s dot at %s" % (zn, name, (x, y)))
                    problems += 1
    # traces vs text
    for (x0, y0, x1, y1, s) in TEXT_BOXES:
        for name in ("trace", "power", "fine", "dim", "edge", "edgefine"):
            for pts, _ in LINES[name]:
                for a, b in zip(pts, pts[1:]):
                    # coarse: sample the segment
                    n = max(2, int(dist(a, b) / 3))
                    for i in range(n + 1):
                        x = a[0] + (b[0] - a[0]) * i / n
                        y = a[1] + (b[1] - a[1]) * i / n
                        if x0 <= x <= x1 and y0 <= y <= y1:
                            print("text %s overlapped by %s near (%.0f,%.0f)" % (s, name, x, y))
                            problems += 1
                            break
                    else:
                        continue
                    break
    # crossings between different traces
    segs = []
    for name in ("trace", "power"):
        for li, (pts, _) in enumerate(LINES[name]):
            for a, b in zip(pts, pts[1:]):
                segs.append((name, li, a, b, min(a[0], b[0]), max(a[0], b[0]), min(a[1], b[1]), max(a[1], b[1])))
    cr = 0
    for i in range(len(segs)):
        s1 = segs[i]
        for j in range(i + 1, len(segs)):
            s2 = segs[j]
            if s1[0] == s2[0] and s1[1] == s2[1]:
                continue
            if s1[5] < s2[4] or s2[5] < s1[4] or s1[7] < s2[6] or s2[7] < s1[6]:
                continue
            if seg_cross(s1[2], s1[3], s2[2], s2[3]):
                cr += 1
                if cr <= 12:
                    print("trace crossing near (%.0f,%.0f)" % s1[2])
    problems += cr
    print("segments: %d, crossings: %d, problems: %d" % (len(segs), cr, problems))
    return problems


def main():
    border()
    io_block()
    vrm()
    socket()
    dimms()
    pcie_slot(4.6, 12.4, 13.5, 13.5)           # PCIEX16
    pcie_slot(4.6, 19.3, 13.5, 20.4, key=0.3)  # x4 slot
    pcie_slot(4.6, 22.1, 8.4, 23.2, key=0.45)  # x1 slot
    m2_area(8.0, 9.6, 16.0, 11.8)              # M2A
    m2_area(8.0, 15.4, 16.0, 17.6)             # M2B
    chipset()
    sata_ports()
    atx24()
    debug_leds()
    lower_left()
    lower_mid()
    lower_right()
    for hx, hy in ((0.9, 11.9), (0.9, 23.4), (9.9, 23.4), (22.0, 23.4), (29.6, 23.4), (29.7, 14.0),
                   (29.6, 0.95), (19.55, 0.95), (5.6, 10.7)):
        mount(hx, hy)
    # clean zones: battery and CLR_CMOS jumper (estimates from board-layout.md)
    ZONES.append(("BAT",) + P(20.0, 21.0) + (1.7 * S,))
    ZONES.append(("CLR_CMOS",) + P(17.0, 23.0) + (1.3 * S,))
    buses()
    labels()
    finish()

    svg = build_svg()
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "board.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(svg)
    print("wrote board.svg: %d bytes" % len(svg.encode("utf-8")))
    if "--check" in sys.argv:
        checks()


if __name__ == "__main__":
    main()
