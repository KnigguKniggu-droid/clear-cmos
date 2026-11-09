#!/usr/bin/env python3
"""Clear CMOS Devpost thumbnail v3: art/thumbnail/thumbnail.png (1500 x 1000) and thumbnail_300_preview.png.

The approved design (William, Nov 8): a dark Cycles macro of the board's reset corner, with a
screwdriver and an amber glow at the CLR_CMOS jumper. A faint ASCII ripple centred on the jumper is
masked off the model so it sits only in the dark background, under the title "Clear CMOS".

Pipeline:
1. Board textures from art/textures/board.svg as of commit bfc7899 (read with git show), as a
   copper-trace mask and a silkscreen mask, 6100 x 4880.
2. Blender Cycles (scene.py): 3000 x 2000 at 200 samples, scaled to 1500 x 1000.
3. The same scene with a transparent background, at 8 samples. Its alpha becomes the mask that keeps
   the pattern off the model.
4. SVG: the render, the masked ASCII ripple, a vignette, then the title and subtitle.
5. rsvg-convert, then light grain (ffmpeg noise).

Needs Blender 5.x (set BLENDER, or it defaults to /Applications/Blender.app), ffmpeg, rsvg-convert,
and the IBM Plex Sans and IBM Plex Mono fonts installed. The Cycles render varies slightly from run
to run. Build files go to art/thumbnail/v3/build/, which is not committed.
Run: python3 art/thumbnail/v3/make_v3.py [--skip-render]
"""
import html
import math
import os
import random
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
THUMB = os.path.dirname(HERE)
ART = os.path.dirname(THUMB)
BUILD = os.path.join(HERE, "build")
BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")
W, H = 1500, 1000
JUMPER_PX = (920, 628)        # CLR_CMOS jumper on screen in the render: the ripple's centre


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


BOARD_SVG_COMMIT = "bfc7899"   # board art the approved render used; 8f405fc later restyled it and dropped #1E6478


def textures():
    src = subprocess.run(["git", "-C", ART, "show", BOARD_SVG_COMMIT + ":art/textures/board.svg"],
                         check=True, capture_output=True, text=True).stdout
    traces = src.replace("#1E6478", "#FFFFFF").replace("#7ADFFF", "#000000").replace("#A9D8E8", "#000000")
    silk = re.sub(r'<path fill="none" stroke="#7ADFFF" stroke-width="2" [^>]*/>', "", src)   # drop the reticle marks
    silk = silk.replace("#1E6478", "#000000").replace("#7ADFFF", "#FFFFFF").replace("#A9D8E8", "#FFFFFF")
    for name, svg in (("traces", traces), ("silk", silk)):
        p = os.path.join(BUILD, name + ".svg")
        open(p, "w", encoding="utf-8").write(svg)
        run(["rsvg-convert", "-w", "6100", "-h", "4880", p, "-o", os.path.join(BUILD, "tex_%s.png" % name)])


def render():
    env = dict(os.environ, THUMB_TEX_DIR=BUILD)
    scene = os.path.join(HERE, "scene.py")
    run([BLENDER, "-b", "--factory-startup", "-P", scene, "--", os.path.join(BUILD, "render_2x.png"), "200", "3000", "2000"], env=env)
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(BUILD, "render_2x.png"),
         "-vf", "scale=%d:%d:flags=lanczos" % (W, H), os.path.join(BUILD, "base_1500.png")])
    s = open(scene, encoding="utf-8").read()
    a = "scene.render.film_transparent = False"
    assert s.count(a) == 1, "scene.py film setting changed"
    alpha_scene = os.path.join(BUILD, "scene_alpha.py")
    open(alpha_scene, "w", encoding="utf-8").write(s.replace(a, "scene.render.film_transparent = True")
                                                  .replace('os.path.dirname(os.path.abspath(__file__))', repr(HERE), 1))
    run([BLENDER, "-b", "--factory-startup", "-P", alpha_scene, "--", os.path.join(BUILD, "alpha_1500.png"), "8", str(W), str(H)], env=env)
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(BUILD, "alpha_1500.png"), "-vf",
         "alphaextract,negate,lutyuv=y='if(gt(val,250),255,0)',gblur=sigma=10,"
         "lutyuv=y='if(gt(val,235),255,val*0.6)',gblur=sigma=3", os.path.join(BUILD, "voidmask.png")])


def ripple_rows():
    random.seed(3)
    cw, ch = 6.0, 11.0
    cols, rows = int(W / cw) + 1, int(H / ch) + 1
    jx, jy = JUMPER_PX
    ramp = "  .:-=+"
    lines = []
    for r in range(rows):
        y = r * ch + ch * 0.7
        s = []
        for c in range(cols):
            x = c * cw + cw / 2
            d = math.hypot(x - jx, (y - jy) * 1.08)
            ring = 0.5 + 0.5 * math.cos(d / 64.0 * 2 * math.pi)
            ring = max(0.0, (ring - 0.35) / 0.65) ** 1.5          # blank troughs, soft crests
            fall = max(0.0, 1.0 - d / 1400.0) ** 0.7
            v = ring * fall + random.uniform(-0.03, 0.03)
            s.append(ramp[max(0, min(len(ramp) - 1, int(v * (len(ramp) - 1) + 0.5)))])
        lines.append("".join(s))
    return lines, ch


def compose():
    lines, ch = ripple_rows()
    out = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
           '<defs><radialGradient id="vig" cx="0.6" cy="0.56" r="0.9">',
           '<stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></radialGradient></defs>',
           '<image x="0" y="0" width="%d" height="%d" xlink:href="base_1500.png"/>' % (W, H),
           '<mask id="vm" maskUnits="userSpaceOnUse" x="0" y="0" width="%d" height="%d"><image x="0" y="0" width="%d" height="%d" xlink:href="voidmask.png"/></mask>' % (W, H, W, H),
           '<g mask="url(#vm)" font-family="IBM Plex Mono" font-size="10" fill="#9FC3CC" fill-opacity="0.12">']
    for i, l in enumerate(lines):
        out.append('<text x="0" y="%.1f" xml:space="preserve">%s</text>' % (i * ch + ch * 0.75, html.escape(l)))
    out += ['</g>',
            '<rect width="%d" height="%d" fill="url(#vig)"/>' % (W, H),
            '<text x="90" y="212" font-family="IBM Plex Sans" font-weight="600" font-size="160" letter-spacing="-4" fill="#EDE6DA">Clear CMOS</text>',
            '<text x="96" y="272" font-family="IBM Plex Sans" font-weight="400" font-size="38" letter-spacing="0.2" fill="#A7AFAB">Shows where a dead PC’s reset is hidden.</text>',
            '</svg>']
    svg = os.path.join(BUILD, "thumbnail_v3.svg")
    open(svg, "w", encoding="utf-8").write("\n".join(out) + "\n")
    flat = os.path.join(BUILD, "thumbnail_nograin.png")
    run(["rsvg-convert", "-w", str(W), svg, "-o", flat])
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", flat, "-vf", "noise=alls=3:allf=u", os.path.join(THUMB, "thumbnail.png")])
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(THUMB, "thumbnail.png"),
         "-vf", "scale=300:200:flags=lanczos", os.path.join(THUMB, "thumbnail_300_preview.png")])


if __name__ == "__main__":
    os.makedirs(BUILD, exist_ok=True)
    for tool in ("ffmpeg", "rsvg-convert"):
        assert shutil.which(tool), tool + " not found"
    if "--skip-render" not in sys.argv:
        textures()
        render()
    compose()
    print("wrote art/thumbnail/thumbnail.png (1500 x 1000) and thumbnail_300_preview.png")
