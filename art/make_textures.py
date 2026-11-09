#!/usr/bin/env python3
"""Generate art/textures/board.svg: line art of the B650 AORUS PRO AX on pure black.

Additive display: black renders as transparent, so only the lines glow.
Plain SVG only: paths, circles and a few rects. All lettering is drawn as
stroked paths from a built-in single-stroke font. There are no text, image,
filter or script elements, and no external references.

Frame: the Lens landscape frame from devpost/research/board-layout.md.
  x = 30.5 - v, y = u, in cm. The rear I/O is on the top (far) edge, right half.
Sources:
  MANUAL  = positions read from the vector layout on manual p.4 (PDF points).
  DRAWN   = decorative parts read from a 200 dpi render of p.4 (about +-0.3 cm).
  ATX     = decorative mounting rings, not shown in the manual.

Run: python3 art/make_textures.py   (writes art/textures/board.svg)
"""
import math
import os

W, H = 1024, 820
BW, BH = 30.5, 24.4
SX, SY = W / BW, H / BH

TRACE = "#2E9AB8"
EDGE = "#7ADFFF"
SILK = "#A9D8E8"

# Line weights in texture px. At 85 cm the board spans about 750 display px,
# so 1 texture px is about 0.73 display px.
# Three weight tiers, as in technical illustration: heavy contours on the main
# parts, thin interior detail, faint routing. Hero parts sit above all three.
W_TRACE = 2.6    # tier 3: routing (dim color)
W_MINOR = 2.4   # tier 2: interior detail, small parts
W_MAJOR = 4.0    # tier 1: contours of the main parts
W_HERO = 4.6     # X-ray targets
W_SILK = 2.8
CAP_STD = 0.44   # every label uses one of two sizes
CAP_HERO = 0.6

# ---------------------------------------------------------------- frames
_X0, _X1, _Y0, _Y1 = 42.2, 353.5, 106.2, 496.3  # board outline on p.4, PDF pt


def mpt(x, y):
    """Manual p.4 PDF points -> Lens cm."""
    u = (x - _X0) * 24.4 / (_X1 - _X0)
    v = (y - _Y0) * 30.5 / (_Y1 - _Y0)
    return (30.5 - v, u)


def mpx(x, y):
    """Manual p.4 at 200 dpi, image px -> Lens cm (DRAWN parts)."""
    return mpt(x * 0.36, y * 0.36)


def box(a, b):
    """Two converted corners -> (x0, y0, x1, y1) in cm."""
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))


def mbox(x0, y0, x1, y1):
    return box(mpt(x0, y0), mpt(x1, y1))


def dbox(x0, y0, x1, y1):
    return box(mpx(x0, y0), mpx(x1, y1))


def P(x, y):
    return (x * SX, y * SY)


def f(v):
    s = "%.1f" % v
    return s[:-2] if s.endswith(".0") else s


# ---------------------------------------------------------------- svg output
layers = {"trace": [], "dim": [], "reticle": [], "via": [], "minor": [], "major": [], "hero": [], "silk": [], "silkhero": []}


def poly(layer, pts_cm, closed=False):
    pts = [P(*p) for p in pts_cm]
    d = "M" + " L".join("%s %s" % (f(x), f(y)) for x, y in pts)
    if closed:
        d += "Z"
    layers[layer].append(d)


def rect(layer, b, chamfer=0.0):
    x0, y0, x1, y1 = b
    c = chamfer
    if c <= 0:
        poly(layer, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], closed=True)
    else:
        poly(layer, [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c),
                     (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)], closed=True)


circles = {"lga": [], "fid": [], "via": [], "ring_minor": [], "ring_major": [], "ring_hero": [], "pad": []}


def circle(kind, c, r_cm):
    x, y = P(*c)
    circles[kind].append((x, y, r_cm * SX))


# ---------------------------------------------------------------- stroke font
# Single-stroke glyphs on a cap-height-1 grid, y down. Width in em.
G = {
    "A": (0.60, [[(0, 1), (0.3, 0), (0.6, 1)], [(0.11, 0.64), (0.49, 0.64)]]),
    "B": (0.56, [[(0, 1), (0, 0), (0.42, 0), (0.52, 0.1), (0.52, 0.38), (0.42, 0.48), (0, 0.48)],
                 [(0.42, 0.48), (0.56, 0.6), (0.56, 0.9), (0.46, 1), (0, 1)]]),
    "C": (0.56, [[(0.56, 0.14), (0.42, 0), (0.14, 0), (0, 0.14), (0, 0.86), (0.14, 1), (0.42, 1), (0.56, 0.86)]]),
    "D": (0.56, [[(0, 0), (0.38, 0), (0.56, 0.18), (0.56, 0.82), (0.38, 1), (0, 1), (0, 0)]]),
    "E": (0.50, [[(0.5, 0), (0, 0), (0, 1), (0.5, 1)], [(0, 0.5), (0.38, 0.5)]]),
    "G": (0.56, [[(0.56, 0.14), (0.42, 0), (0.14, 0), (0, 0.14), (0, 0.86), (0.14, 1), (0.42, 1),
                  (0.56, 0.86), (0.56, 0.56), (0.3, 0.56)]]),
    "I": (0.0, [[(0, 0), (0, 1)]]),
    "L": (0.48, [[(0, 0), (0, 1), (0.48, 1)]]),
    "M": (0.66, [[(0, 1), (0, 0), (0.33, 0.56), (0.66, 0), (0.66, 1)]]),
    "O": (0.56, [[(0.14, 0), (0.42, 0), (0.56, 0.14), (0.56, 0.86), (0.42, 1), (0.14, 1), (0, 0.86),
                  (0, 0.14), (0.14, 0)]]),
    "P": (0.54, [[(0, 1), (0, 0), (0.42, 0), (0.54, 0.12), (0.54, 0.42), (0.42, 0.54), (0, 0.54)]]),
    "R": (0.56, [[(0, 1), (0, 0), (0.42, 0), (0.54, 0.12), (0.54, 0.42), (0.42, 0.54), (0, 0.54)],
                 [(0.3, 0.54), (0.56, 1)]]),
    "S": (0.54, [[(0.54, 0.12), (0.42, 0), (0.12, 0), (0, 0.12), (0, 0.38), (0.12, 0.5), (0.42, 0.5),
                  (0.54, 0.62), (0.54, 0.88), (0.42, 1), (0.12, 1), (0, 0.88)]]),
    "T": (0.56, [[(0, 0), (0.56, 0)], [(0.28, 0), (0.28, 1)]]),
    "U": (0.56, [[(0, 0), (0, 0.86), (0.14, 1), (0.42, 1), (0.56, 0.86), (0.56, 0)]]),
    "V": (0.60, [[(0, 0), (0.3, 1), (0.6, 0)]]),
    "X": (0.56, [[(0, 0), (0.56, 1)], [(0.56, 0), (0, 1)]]),
    "1": (0.32, [[(0, 0.2), (0.24, 0), (0.24, 1)]]),
    "2": (0.54, [[(0, 0.14), (0.14, 0), (0.4, 0), (0.54, 0.14), (0.54, 0.38), (0, 1), (0.54, 1)]]),
    "5": (0.54, [[(0.52, 0), (0.04, 0), (0, 0.46), (0.4, 0.44), (0.54, 0.58), (0.54, 0.86), (0.4, 1),
                  (0.12, 1), (0, 0.88)]]),
    "6": (0.54, [[(0.5, 0.06), (0.4, 0), (0.14, 0), (0, 0.14), (0, 0.86), (0.14, 1), (0.4, 1), (0.54, 0.86),
                  (0.54, 0.6), (0.4, 0.46), (0.14, 0.46), (0, 0.6)]]),
    "_": (0.50, [[(0, 1.16), (0.5, 1.16)]]),
    " ": (0.30, []),
}
TRACK = 0.24  # letter spacing in em


def text_width(s, cap):
    w = sum(G[c][0] for c in s) + TRACK * (len(s) - 1)
    return w * cap


def text(s, x, y, cap, anchor="start", layer="silk"):
    """Cap-height text with its top-left at (x, y) cm; anchor sets x alignment."""
    w = text_width(s, cap)
    if anchor == "end":
        x -= w
    elif anchor == "middle":
        x -= w / 2
    cx = x
    for ch in s:
        gw, strokes = G[ch]
        for st in strokes:
            poly(layer, [(cx + px * cap, y + py * cap) for px, py in st])
        cx += (gw + TRACK) * cap
    return (x, y, x + w, y + cap)


# ---------------------------------------------------------------- routing
def _offset(pts, off):
    """Parallel polyline at distance off (left of travel is negative y side)."""
    n = len(pts)
    segs = []
    for i in range(n - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        dx, dy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = -dy, dx
        segs.append(((x0 + nx * off, y0 + ny * off), (x1 + nx * off, y1 + ny * off), (dx, dy)))
    out = [segs[0][0]]
    for i in range(len(segs) - 1):
        (a0, a1, da), (b0, b1, db) = segs[i], segs[i + 1]
        den = da[0] * db[1] - da[1] * db[0]
        if abs(den) < 1e-9:
            out.append(a1)
            continue
        t = ((b0[0] - a0[0]) * db[1] - (b0[1] - a0[1]) * db[0]) / den
        out.append((a0[0] + da[0] * t, a0[1] + da[1] * t))
    out.append(segs[-1][1])
    return out


def bundle(center_path, n, pitch, vias=(True, True)):
    for k in range(n):
        off = (k - (n - 1) / 2) * pitch
        pts = _offset(center_path, off)
        poly("trace", pts)
        if vias[0]:
            circle("via", pts[0], 0.07)
        if vias[1]:
            circle("via", pts[-1], 0.07)


# ================================================================ PARTS
# ---- MANUAL p.4 (vector coordinates, PDF pt)
CLR_PINS = [mpt(315.3, 478.7), mpt(318.35, 478.7)]
RST_PINS = [mpt(335.8, 460.25), mpt(335.8, 463.3)]
RST_SW = mbox(339.9, 458.0, 346.8, 465.2)
BAT_C = mpt(201.1, 428.1)          # center of the holder; p.4 shows a tab at each end
BAT_R = 1.0                       # CR2032, 20 mm
BAT_HOLDER = mbox(187.9, 411.1, 214.3, 445.1)
LED_BLOCK = mbox(340.5, 299.2, 345.8, 306.5)
DIMM_SLOTS = [mbox(x0, 139.5, x0 + 9.2, 328.7) for x0 in (271.4, 282.4, 293.4, 304.4)]
PCIE16 = mbox(96.9, 337.4, 208.6, 348.5)
PCIE4 = mbox(95.6, 465.6, 207.3, 476.7)
M2_CONN = {"A": mbox(223.7, 301.8, 234.9, 328.7), "B": mbox(223.7, 377.1, 234.9, 404.1),
           "C": mbox(223.7, 408.6, 234.9, 435.6)}
SOCKET_HOLES = [mpx(467, 477), mpx(655, 477), mpx(467, 780), mpx(655, 780)]
F_PANEL = mbox(300.6, 481.0, 339.1, 491.6)
SATA = mbox(335.4, 377.7, 353.5, 419.7)
F_U32 = mbox(339.6, 421.6, 353.5, 453.5)
M_BIOS = mbox(204.2, 364.1, 212.0, 376.1)
PW_SW = mbox(335.1, 129.3, 347.8, 142.0)

# ---- DRAWN (200 dpi image px)
PCIE1 = dbox(265, 1222, 355, 1252)
CHIPSET = dbox(742, 1015, 818, 1090)
SUPER_IO = dbox(752, 1222, 795, 1272)
CODEC = dbox(152, 1192, 172, 1215)
LAN_CHIP = dbox(190, 935, 207, 955)
HUB3 = dbox(190, 1055, 209, 1077)
HUB2 = mbox(76.8, 159.6, 81.5, 164.1)
ATX24 = dbox(930, 528, 968, 722)
ATX12V = [dbox(285, 300, 322, 342), dbox(325, 300, 395, 342)]
QFLASH = dbox(103, 312, 135, 340)
M2_WIFI = dbox(133, 352, 213, 382)
IO_BLOCKS = [dbox(113, 418, 200, 470), dbox(113, 492, 160, 552), dbox(113, 572, 175, 622),
             dbox(113, 647, 200, 705), dbox(113, 718, 210, 788), dbox(113, 797, 188, 845)]
TOP_HEADERS = [dbox(722, 305, 760, 330), dbox(765, 305, 803, 330), dbox(808, 305, 846, 330),
               dbox(852, 312, 882, 325), dbox(900, 312, 935, 325), dbox(900, 337, 935, 350)]
RIGHT_HEADERS = [dbox(940, 732, 968, 765), dbox(940, 773, 968, 808), dbox(942, 970, 965, 1015),
                 dbox(885, 845, 905, 910)]
BOTTOM_HEADERS = [dbox(180, 1338, 232, 1366), dbox(245, 1355, 282, 1366), dbox(297, 1355, 333, 1366),
                  dbox(341, 1338, 390, 1366), dbox(395, 1338, 445, 1366), dbox(452, 1338, 517, 1366),
                  dbox(527, 1347, 565, 1366), dbox(571, 1338, 620, 1366), dbox(625, 1338, 676, 1366),
                  dbox(745, 1347, 783, 1366), dbox(787, 1347, 825, 1366)]
M2_STANDOFF_Y = {"110": mpx(252, 875)[1], "80": mpx(362, 875)[1]}

# ---- ATX mounting rings (decorative; not drawn in the manual)
MOUNT = [(0.65, 0.65), (14.3, 0.75), (29.8, 3.3), (29.8, 23.75)]
# PCB fiducials: copper dot in a clearance ring (decorative positions, three corners).
FIDUCIALS = [(2.4, 0.8), (29.35, 10.6), (25.6, 23.25)]

# ---------------------------------------------------------------- keep-outs
CLR_C = ((CLR_PINS[0][0] + CLR_PINS[1][0]) / 2, (CLR_PINS[0][1] + CLR_PINS[1][1]) / 2)
RST_C = ((RST_PINS[0][0] + RST_PINS[1][0]) / 2, (RST_PINS[0][1] + RST_PINS[1][1]) / 2)
KEEP_OUT = [(CLR_C, 1.8), (RST_C, 1.1), (BAT_C, 2.1)]


def check_keepouts():
    """Fail loudly if any trace point enters a keep-out zone."""
    bad = 0
    for d in layers["trace"]:
        nums = [float(t) for t in d.replace("M", " ").replace("L", " ").replace("Z", " ").split()]
        for x, y in zip(nums[0::2], nums[1::2]):
            cx, cy = x / SX, y / SY
            for (kx, ky), r in KEEP_OUT:
                if math.hypot(cx - kx, cy - ky) < r:
                    bad += 1
    for x, y, _ in circles["via"]:
        for (kx, ky), r in KEEP_OUT:
            if math.hypot(x / SX - kx, y / SY - ky) < r:
                bad += 1
    if bad:
        raise SystemExit("keep-out violated at %d points" % bad)


# ================================================================ DRAW
# ---- traces first (lowest layer)
# Memory fan: socket edge to the DIMM row. Parallel 45-degree chevrons.
sock_cx = sum(h[0] for h in SOCKET_HOLES) / 4
sock_cy = sum(h[1] for h in SOCKET_HOLES) / 4
n_fan, p_fan = 16, 0.24
for k in range(n_fan):
    s = (k - (n_fan - 1) / 2) * p_fan
    sx, tx = sock_cx + s, sock_cx + 2 * s
    yb = 15.25
    yd = yb + abs(tx - sx)
    pts = [(sx, 14.85), (sx, yb), (tx, yd)]
    slack = 2.5 - abs(tx - sx)          # shorter traces get more meander
    if slack > 1.4:
        y = yd + 0.15
        amp = 0.09
        n_m = int(min(slack, 2.4) * 2)
        pts.append((tx, y))
        for m in range(n_m):
            side = amp if m % 2 == 0 else -amp
            pts += [(tx + side, y), (tx + side, y + 0.1), (tx, y + 0.1)]
            y += 0.16
            pts.append((tx, y))
    pts.append((tx, 17.72))
    poly("trace", pts)
    circle("via", (tx, 17.72), 0.07)

# PCIe x16 lanes: socket top-left to the x16 slot, above the M2A footprint.
bundle([(18.9, 10.4), (18.9, 9.0), (15.6, 5.7), (13.0, 5.7)], 8, 0.22)
# Chipset link: from under the socket bracket to the chipset.
cx0, cy0, cx1, cy1 = CHIPSET
bundle([(16.9, 15.8), (16.9, 16.75), (16.35, 17.3), (10.4, 17.3), (9.8, 17.9)], 3, 0.2, vias=(True, False))
# Chipset to M2B and M2C connectors.
mbx = (M2_CONN["B"][0] + M2_CONN["B"][2]) / 2
bundle([(mbx + 0.15, cy0 - 0.05), (mbx + 0.15, 15.4)], 4, 0.2)
mcx = (M2_CONN["C"][0] + M2_CONN["C"][2]) / 2
bundle([(cx0 - 0.05, 18.2), (mcx + 0.5, 18.2), (mcx, 17.7), (mcx, 15.4)], 3, 0.2)
# Chipset to SATA.
sx_mid = (SATA[0] + SATA[2]) / 2
bundle([(cx0 + 0.9, cy1 + 0.05), (cx0 + 0.9, 21.2), (sx_mid, 22.0), (sx_mid, SATA[1] - 0.15)], 4, 0.2)
# Chipset to the front USB headers on the board edge.
bundle([(cx0 - 0.05, 19.55), (4.9, 19.55), (4.2, 19.95), (2.75, 19.95), (2.1, 19.3), (2.1, 15.4)], 3, 0.2,
       vias=(False, True))
# LAN: rear I/O block to the LAN chip.
bundle([(17.1, IO_BLOCKS[4][3] + 0.1), (17.1, 3.15), (16.7, 3.45), (13.2, 3.45), (12.8, 3.05),
        (12.8, LAN_CHIP[3] + 0.1)], 4, 0.18)
# Audio: codec toward the audio jacks, on its own island.
bundle([(CODEC[2] + 0.1, 1.28), (9.0, 1.28), (9.4, 1.68), (10.9, 1.68)], 3, 0.18)
# USB 2.0 hub to its I/O stack.
bundle([(HUB2[0] - 0.1, 3.0), (25.0, 3.0), (24.6, 2.6), (24.6, 2.0)], 3, 0.16, vias=(False, True))
# Super I/O to the fan headers on the board edge.
bundle([(SUPER_IO[0] - 0.05, 18.35), (2.75, 18.35)], 2, 0.2, vias=(False, True))

# Chipset to the PCIe x4 slot, running beside the slot.
for i in range(8):
    y = PCIE4[1] + 0.9 + i * 0.9
    poly("trace", [(PCIE4[2] + 0.05, y), (PCIE4[2] + 0.35, y), (PCIE4[2] + 0.6, y + 0.25)])
    circle("via", (PCIE4[2] + 0.6, y + 0.25), 0.06)
# PCIe x1 lanes and USB 3.2 hub stubs.
bundle([((PCIE1[0] + PCIE1[2]) / 2, PCIE1[3] + 0.15), ((PCIE1[0] + PCIE1[2]) / 2, 8.9)], 2, 0.2)
bundle([(HUB3[2] + 0.1, 2.32), (11.3, 2.32)], 2, 0.18, vias=(False, True))


def escape(b, side, n, length, skip=()):
    """Short 45-degree escape stubs with vias from one side of a chip."""
    x0, y0, x1, y1 = b
    for i in range(n):
        if i in skip:
            continue
        t = (i + 1) / (n + 1)
        if side == "top":
            a = (x0 + (x1 - x0) * t, y0 - 0.05)
            pts = [a, (a[0], a[1] - length * 0.4), (a[0] - length * 0.6, a[1] - length)]
        elif side == "bottom":
            a = (x0 + (x1 - x0) * t, y1 + 0.05)
            pts = [a, (a[0], a[1] + length * 0.4), (a[0] + length * 0.6, a[1] + length)]
        elif side == "left":
            a = (x0 - 0.05, y0 + (y1 - y0) * t)
            pts = [a, (a[0] - length * 0.4, a[1]), (a[0] - length, a[1] + length * 0.6)]
        else:
            a = (x1 + 0.05, y0 + (y1 - y0) * t)
            pts = [a, (a[0] + length * 0.4, a[1]), (a[0] + length, a[1] - length * 0.6)]
        poly("trace", pts)
        circle("via", pts[-1], 0.06)


escape(CHIPSET, "right", 6, 0.4)
escape(CHIPSET, "bottom", 5, 0.5, skip=(1, 2, 3))
escape(SUPER_IO, "right", 3, 0.5)
escape(SUPER_IO, "bottom", 2, 0.45)
escape(CODEC, "bottom", 2, 0.45)
escape(M_BIOS, "right", 2, 0.4)
escape(LAN_CHIP, "left", 2, 0.4)

# Plane boundaries (outlines only, no fill): audio island and VRM power plane.
poly("trace", [(3.6, 0.35), (11.5, 0.35), (11.5, 1.95), (11.0, 2.45), (4.2, 2.45), (3.6, 1.85)], closed=True)
poly("trace", [(16.55, 3.45), (28.25, 3.45), (28.25, 15.6), (27.75, 16.1), (26.15, 16.1), (26.15, 5.45),
               (25.7, 5.0), (16.55, 5.0)], closed=True)

# Edge stitching vias along the board border.
for i in range(37):
    x = 0.45 + i * 0.8
    if not any(b[0] - 0.3 < x < b[2] + 0.3 for b in IO_BLOCKS + [QFLASH]):
        circle("via", (x, 0.42), 0.05)
for i in range(29):
    y = 0.45 + i * 0.8
    if 4.0 < y < 18.5:
        circle("via", (BW - 0.42, y), 0.05) if not any(b[1] - 0.3 < y < b[3] + 0.3 for b in RIGHT_HEADERS + ATX12V) else None

# Power vias along the socket bracket and VRM chokes (trace weight, background).
for i in range(14):
    circle("via", (17.55 + i * 0.5, 9.25), 0.06)
    circle("via", (17.55 + i * 0.5, 15.65), 0.06) if 21.0 < 17.55 + i * 0.5 < 24.9 else None
for i in range(8):
    x = 17.0 + i * 1.18
    rect("trace", (x, 3.9, x + 0.9, 4.8), chamfer=0.12)
    poly("trace", [(x + 0.3, 4.35), (x + 0.6, 4.35)])
for j in range(6):
    y = 7.2 + j * 1.18
    rect("trace", (26.6, y, 27.5, y + 0.9), chamfer=0.12)
    poly("trace", [(27.05, y + 0.3), (27.05, y + 0.6)])

# ---- board edge and mounting rings
inset = 0.18
poly("minor", [(inset, inset), (BW - inset, inset), (BW - inset, BH - inset), (inset, BH - inset)], closed=True)
for m in MOUNT:
    circle("ring_minor", m, 0.33)
    circle("ring_minor", m, 0.16)
for fd in FIDUCIALS:
    circle("ring_minor", fd, 0.24)
    circle("fid", fd, 0.09)

# ---- components
# Rear I/O stacks, top edge.
for b in IO_BLOCKS:
    rect("minor", (b[0], 0.0, b[2], b[3]))
# Port shapes inside the rear I/O stacks (depth runs along y from the far edge).
def port_rows(b, kind):
    x0, y0, x1, y1 = b
    w, d = x1 - x0, y1
    if kind == "usb":
        for k in range(2):
            px0 = x0 + 0.18 + k * (w - 0.36) / 2
            px1 = px0 + (w - 0.36) / 2 - 0.12
            rect("minor", (px0, 0.25, px1, d - 0.25), chamfer=0.04)
            poly("trace", [((px0 + px1) / 2, 0.45), ((px0 + px1) / 2, d - 0.45)])
    elif kind == "hdmi":
        poly("minor", [(x0 + 0.2, 0.25), (x1 - 0.2, 0.25), (x1 - 0.2, d - 0.45), (x1 - 0.42, d - 0.25),
                       (x0 + 0.42, d - 0.25), (x0 + 0.2, d - 0.45)], closed=True)
    elif kind == "lan":
        rect("minor", (x0 + 0.2, 0.25, x0 + w * 0.55, d - 0.25), chamfer=0.04)
        rect("minor", (x0 + w * 0.42 - 0.3, d - 0.55, x0 + w * 0.42 + 0.3, d - 0.25))
        rect("minor", (x0 + w * 0.62, 0.25, x1 - 0.2, d - 0.25), chamfer=0.04)
    elif kind == "audio":
        for k in range(3):
            circle("ring_minor", (x0 + w * (k + 1) / 4, d * 0.5), min(0.24, w / 9))


for b, kind in zip(IO_BLOCKS, ("usb", "hdmi", "usb", "usb", "lan", "audio")):
    port_rows(b, kind)
rect("minor", QFLASH)
rect("minor", M2_WIFI, chamfer=0.08)

# CPU socket: retention brackets, load frame, package, lid.
hx = sorted(set(round(h[0], 3) for h in SOCKET_HOLES))
hy = sorted(set(round(h[1], 3) for h in SOCKET_HOLES))
for x in hx:
    out = 1 if x > sock_cx else -1
    poly("minor", [(x - 0.55 * out, hy[0] - 0.55), (x + 0.45 * out, hy[0] - 0.55), (x + 0.45 * out, hy[0] + 1.2),
                   (x + 0.05 * out, hy[0] + 1.6), (x + 0.05 * out, hy[1] - 1.6), (x + 0.45 * out, hy[1] - 1.2),
                   (x + 0.45 * out, hy[1] + 0.55), (x - 0.55 * out, hy[1] + 0.55)], closed=True)
for h in SOCKET_HOLES:
    circle("ring_minor", h, 0.32)
    circle("ring_minor", h, 0.14)
frame = (sock_cx - 3.2, sock_cy - 2.45, sock_cx + 3.2, sock_cy + 2.45)
rect("minor", frame, chamfer=0.25)
pkg = (sock_cx - 2.0, sock_cy - 2.0, sock_cx + 2.0, sock_cy + 2.0)
rect("major", pkg, chamfer=0.18)
# LGA pad field: a quiet dot grid inside the package; pin-1 triangle in one corner.
n_pad = 12
for i in range(n_pad):
    for j in range(n_pad):
        px_ = pkg[0] + 0.42 + i * (pkg[2] - pkg[0] - 0.84) / (n_pad - 1)
        py_ = pkg[1] + 0.42 + j * (pkg[3] - pkg[1] - 0.84) / (n_pad - 1)
        if (i, j) in ((0, 0),):
            continue
        circle("lga", (px_, py_), 0.035)
poly("minor", [(pkg[0] + 0.3, pkg[1] + 0.3), (pkg[0] + 0.75, pkg[1] + 0.3), (pkg[0] + 0.3, pkg[1] + 0.75)], closed=True)
poly("minor", [(frame[0] + 0.5, frame[3] + 0.0), (frame[0] + 0.5, frame[3] + 0.45),
               (frame[2] - 1.2, frame[3] + 0.45)])

# DIMM slots: body, latches, key break.
for b in DIMM_SLOTS:
    x0, y0, x1, y1 = b
    ym = (y0 + y1) / 2
    rect("major", (x0 + 0.55, y0 + 0.08, x1 - 0.55, y1 - 0.08), chamfer=0.08)
    rect("minor", (x0, y0 + 0.16, x0 + 0.45, y1 - 0.16))
    rect("minor", (x1 - 0.45, y0 + 0.16, x1, y1 - 0.16))
    key = x0 + (x1 - x0) * 0.53
    poly("trace", [(x0 + 0.85, ym), (key - 0.12, ym)])
    poly("trace", [(key + 0.12, ym), (x1 - 0.85, ym)])

# PCIe slots.
for b, layer in ((PCIE16, "major"), (PCIE4, "minor")):
    x0, y0, x1, y1 = b
    xm = (x0 + x1) / 2
    rect(layer, b, chamfer=0.06)
    key = y0 + 1.15
    poly("trace", [(xm, y0 + 0.25), (xm, key - 0.1)])
    poly("trace", [(xm, key + 0.1), (xm, y1 - 0.25)])
rect("major", (PCIE16[0] + 0.12, PCIE16[3] + 0.15, PCIE16[2] - 0.12, PCIE16[3] + 1.25), chamfer=0.1)
rect("minor", PCIE1, chamfer=0.06)

# M.2: connectors, standoffs, and the M2A module footprint (dashed).
for k, b in M2_CONN.items():
    x0, y0, x1, y1 = b
    rect("major" if k == "A" else "minor", b, chamfer=0.05)
    xm = (x0 + x1) / 2
    for y in M2_STANDOFF_Y.values():
        circle("ring_minor", (xm, y), 0.22)
        circle("via", (xm, y), 0.06)
ax0, ay0, ax1, ay1 = M2_CONN["A"]
dashed_a = (ax0 + 0.05, M2_STANDOFF_Y["80"] - 0.05, ax1 - 0.05, ay0 - 0.08)
bx0, by0, bx1, by1 = M2_CONN["B"]
dashed_b = (bx0 + 0.05, M2_STANDOFF_Y["80"] - 0.05, bx1 - 0.05, by0 - 0.08)

# Chips.
for b, ch in ((CHIPSET, 0.2), (SUPER_IO, 0.08), (M_BIOS, 0.05), (CODEC, 0.05), (LAN_CHIP, 0.05),
              (HUB3, 0.05), (HUB2, 0.04)):
    rect("minor", b, chamfer=ch)
x0, y0, x1, y1 = CHIPSET
rect("trace", (x0 + 0.35, y0 + 0.35, x1 - 0.35, y1 - 0.35), chamfer=0.12)

# Power connectors with pin grids.
rect("minor", ATX24, chamfer=0.08)
x0, y0, x1, y1 = ATX24
for i in range(12):
    for j in range(2):
        cxp = x0 + 0.3 + i * (x1 - x0 - 0.6) / 11
        cyp = y0 + 0.3 + j * (y1 - y0 - 0.6)
        circle("pad", (cxp, cyp), 0.07)
for b in ATX12V:
    rect("minor", b, chamfer=0.06)

# Headers on the edges (trace weight near the hero corner to keep it clean).
for b in TOP_HEADERS + RIGHT_HEADERS:
    rect("minor", b)
def pins(b, pitch=0.26):
    """Two rows of pin dots along the long axis of a header outline."""
    x0, y0, x1, y1 = b
    long_y = (y1 - y0) >= (x1 - x0)
    L = (y1 - y0) if long_y else (x1 - x0)
    n = max(1, int((L - 0.2) / pitch))
    rows = 2 if min(x1 - x0, y1 - y0) > 0.45 else 1
    for r_ in range(rows):
        for k in range(n):
            t = (k + 0.5) / n
            if long_y:
                cx_ = x0 + (x1 - x0) * ((r_ + 1) / (rows + 1))
                cy_ = y0 + (y1 - y0) * t
            else:
                cx_ = x0 + (x1 - x0) * t
                cy_ = y0 + (y1 - y0) * ((r_ + 1) / (rows + 1))
            circle("lga", (cx_, cy_), 0.035)


for b in BOTTOM_HEADERS + TOP_HEADERS[:3] + RIGHT_HEADERS[:3] + [F_U32]:
    if math.hypot((b[0] + b[2]) / 2 - CLR_C[0], (b[1] + b[3]) / 2 - CLR_C[1]) > 3.5:
        pins(b)
for b in BOTTOM_HEADERS:
    near = math.hypot((b[0] + b[2]) / 2 - CLR_C[0], (b[1] + b[3]) / 2 - CLR_C[1]) < 3.5
    rect("dim" if near else "minor", b)
rect("dim", F_PANEL)
for b in (SATA, F_U32):
    rect("minor", b, chamfer=0.05)
# SATA: four L-keyed ports side by side.
sx0, sy0, sx1, sy1 = SATA
for k in range(4):
    a0 = sx0 + 0.12 + k * (sx1 - sx0 - 0.24) / 4
    a1 = a0 + (sx1 - sx0 - 0.24) / 4 - 0.12
    poly("minor", [(a0, sy0 + 0.25), (a1, sy0 + 0.25), (a1, sy1 - 0.2), (a0 + 0.22, sy1 - 0.2), (a0 + 0.22, sy1 - 0.42),
                   (a0, sy1 - 0.42)], closed=True)
rect("minor", PW_SW)
circle("ring_minor", ((PW_SW[0] + PW_SW[2]) / 2, (PW_SW[1] + PW_SW[3]) / 2), 0.28)

# Status LEDs: 2 x 2 block.
x0, y0, x1, y1 = LED_BLOCK
for i in range(2):
    for j in range(2):
        lx = x0 + i * (x1 - x0) / 2
        ly = y0 + j * (y1 - y0) / 2
        rect("major", (lx + 0.03, ly + 0.03, lx + (x1 - x0) / 2 - 0.03, ly + (y1 - y0) / 2 - 0.03))

# ---- hero parts (the X-ray reveals these)
# Battery: holder outline plus cell.
circle("ring_hero", BAT_C, BAT_R)
circle("ring_minor", BAT_C, BAT_R - 0.22)
hx0, hy0, hx1, hy1 = BAT_HOLDER
# Holder tabs: p.4 draws one at each end of the holder, which is the x axis in the Lens frame.
for side in (-1, 1):
    edge = hx1 if side > 0 else hx0
    poly("major", [(BAT_C[0] + side * BAT_R, BAT_C[1] - 0.42), (edge, BAT_C[1] - 0.42), (edge, BAT_C[1] + 0.42),
                   (BAT_C[0] + side * BAT_R, BAT_C[1] + 0.42)])
# CLR_CMOS and RST: pin pads with a header frame.
for pins, w in ((CLR_PINS, "hero"), (RST_PINS, "major")):
    for p in pins:
        circle("pad", p, 0.105 if w == "hero" else 0.085)
    (ax, ay), (bx, by) = pins
    pad = 0.2
    rect(w, (min(ax, bx) - pad, min(ay, by) - pad, max(ax, bx) + pad, max(ay, by) + pad), chamfer=0.05)
rect("major", RST_SW)
# Reticles: broken rings that mark the two X-ray targets without filled panels.
def reticle(c, r, arcs, span_deg, layer):
    for a0 in arcs:
        a = math.radians(a0 - span_deg / 2)
        b = math.radians(a0 + span_deg / 2)
        steps = 10
        poly(layer, [(c[0] + r * math.cos(a + (b - a) * i / steps), c[1] + r * math.sin(a + (b - a) * i / steps))
                     for i in range(steps + 1)])


reticle(BAT_C, BAT_R + 0.42, (90, 270), 76, "reticle")   # the holder tabs take the left and right
reticle(CLR_C, 0.6, (270, 0, 90), 64, "reticle")    # open toward F_PANEL on the left
circle("ring_minor", ((RST_SW[0] + RST_SW[2]) / 2, (RST_SW[1] + RST_SW[3]) / 2), 0.16)

# ---- silkscreen
CAP = 0.5
text("CPU", (frame[0] + pkg[0]) / 2, sock_cy - CAP_STD / 2, CAP_STD, anchor="middle")
for b, name in zip(DIMM_SLOTS, ("DDR5_A1", "DDR5_A2", "DDR5_B1", "DDR5_B2")):
    text(name, b[0] - 0.25, (b[1] + b[3]) / 2 - 0.2, 0.4, anchor="end")
text("PCIEX16", PCIE16[0] - 0.35, PCIE16[1] + 0.05, CAP_STD, anchor="end")
text("M2A", M2_CONN["A"][0] + 0.1, M2_CONN["A"][3] + 0.22, CAP_STD)
text("BAT", BAT_C[0], BAT_C[1] - BAT_R - 1.3, CAP_HERO, anchor="middle", layer="silkhero")
text("CLR_CMOS", CLR_C[0] + 0.95, CLR_C[1] - CAP_HERO / 2, CAP_HERO, layer="silkhero")
text("RST", RST_SW[2] + 0.3, RST_C[1] - CAP_STD / 2, CAP_STD)
# The manual draws this legend outside the board (p.4, p.18), so it has no fixed silkscreen spot.
text("CPU DRAM", LED_BLOCK[0] - 0.3, LED_BLOCK[1] - 0.42, 0.36, anchor="end")
text("VGA BOOT", LED_BLOCK[0] - 0.3, LED_BLOCK[1] + 0.2, 0.36, anchor="end")

check_keepouts()


# ================================================================ WRITE
def svg():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
           '<rect x="0" y="0" width="%d" height="%d" fill="#000000"/>' % (W, H)]

    def group(color, width, ds, extra=""):
        if not ds:
            return
        out.append('<path fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" '
                   'stroke-linejoin="round"%s d="%s"/>' % (color, f(width), extra, " ".join(ds)))

    group(TRACE, W_TRACE, layers["trace"])
    group(TRACE, W_MINOR, layers["dim"])
    group(EDGE, W_MINOR, layers["minor"])
    for da in (dashed_a, dashed_b):
        x0, y0 = P(da[0], da[1])
        x1, y1 = P(da[2], da[3])
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="%s" '
                   'stroke-dasharray="6 6"/>' % (f(x0), f(y0), f(x1 - x0), f(y1 - y0), TRACE, f(W_TRACE)))
    group(EDGE, W_MAJOR, layers["major"])
    group(EDGE, W_HERO, layers["hero"])
    group(EDGE, 2.0, layers["reticle"])
    for kind, color, width in (("ring_minor", EDGE, W_MINOR), ("ring_major", EDGE, W_MAJOR),
                               ("ring_hero", EDGE, W_HERO)):
        for x, y, r in circles[kind]:
            out.append('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s"/>'
                       % (f(x), f(y), f(r), color, f(width)))
    for x, y, r in circles["via"]:
        out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(y), f(max(r, 2.2)), TRACE))
    for x, y, r in circles["lga"]:
        out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(y), f(max(r, 1.25)), TRACE))
    for x, y, r in circles["fid"]:
        out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(y), f(r), EDGE))
    for x, y, r in circles["pad"]:
        out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(y), f(max(r, 2.2)), EDGE))
    group(SILK, W_SILK, layers["silk"])
    group(SILK, W_SILK + 0.6, layers["silkhero"])
    out.append("</svg>")
    return "\n".join(out) + "\n"


here = os.path.dirname(os.path.abspath(__file__))
dst = os.path.join(here, "textures", "board.svg")
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, "w") as fh:
    fh.write(svg())
print("wrote %s (%d bytes)" % (dst, os.path.getsize(dst)))
