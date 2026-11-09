#!/usr/bin/env python3
"""Check art/textures/board.svg against the texture spec. Exit code 1 on any failure.

Checks: parses as XML; width, height and viewBox are exact; no text, image,
filter, script or other forbidden elements; no external references; only the
allowed colors; under 300 KB.
Run: python3 art/check_textures.py
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "textures", "board.svg")
WIDTH, HEIGHT, VIEWBOX = "1024", "820", "0 0 1024 820"
MAX_BYTES = 300 * 1024
FORBIDDEN = {"text", "tspan", "textPath", "image", "filter", "script", "foreignObject", "use", "style",
             "font", "font-face", "a", "iframe", "video", "audio", "feImage"}
ALLOWED_COLORS = {"#000000", "#1e6478", "#7adfff", "#a9d8e8", "none"}

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))


size = os.path.getsize(PATH)
check("file under 300 KB", size < MAX_BYTES, "%d bytes (%.1f KB)" % (size, size / 1024))

raw = open(PATH, encoding="utf-8").read()
try:
    root = ET.fromstring(raw)
    check("parses as XML", True)
except ET.ParseError as e:
    check("parses as XML", False, str(e))
    root = None

if root is not None:
    local = lambda tag: tag.split("}", 1)[-1]
    check("root is <svg>", local(root.tag) == "svg", local(root.tag))
    check("width is 1024", root.get("width") == WIDTH, repr(root.get("width")))
    check("height is 820", root.get("height") == HEIGHT, repr(root.get("height")))
    check("viewBox is '0 0 1024 820'", root.get("viewBox") == VIEWBOX, repr(root.get("viewBox")))

    tags = {}
    for el in root.iter():
        tags[local(el.tag)] = tags.get(local(el.tag), 0) + 1
    bad = sorted(t for t in tags if t in FORBIDDEN)
    check("no text/image/filter/script elements", not bad, ", ".join(bad) or "elements: %s" % tags)

    ext = []
    for el in root.iter():
        for k, v in el.attrib.items():
            if local(k) == "href" or "url(" in v or v.strip().startswith(("http:", "https:", "data:")):
                ext.append("%s=%s" % (local(k), v[:40]))
    check("no external references", not ext, "; ".join(ext[:5]))

    colors = set()
    for el in root.iter():
        for k in ("fill", "stroke"):
            v = el.get(k)
            if v:
                colors.add(v.lower())
    extra = sorted(colors - ALLOWED_COLORS)
    check("only spec colors", not extra, "used: %s" % ", ".join(sorted(colors)) if not extra else ", ".join(extra))

    bg = [el for el in root if local(el.tag) == "rect"]
    first = bg[0] if bg else None
    check("pure black background", first is not None and first.get("fill", "").lower() == "#000000"
          and first.get("width") == WIDTH and first.get("height") == HEIGHT)

check("no forbidden words in the file", not re.search(r"gigabyte|aorus|\bamd\b|radeon", raw, re.I))

w = max(len(n) for n, _, _ in results)
for name, ok, detail in results:
    print("%s  %s  %s" % ("PASS" if ok else "FAIL", name.ljust(w), detail))
failed = [n for n, ok, _ in results if not ok]
print("\n%d checks, %d failed" % (len(results), len(failed)))
sys.exit(1 if failed else 0)
