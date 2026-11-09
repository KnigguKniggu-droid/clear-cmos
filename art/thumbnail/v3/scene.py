"""Clear CMOS thumbnail: macro of the board's reset corner, Tenebrism lighting, AR accents.
Units: 1 Blender unit = 1 cm. Board frame: Lens x right, y toward the viewer (board-layout.md);
Blender X = x, Y = -y, Z up. Run: Blender -b --factory-startup -P scene.py -- <out.png> <samples> <w> <h>
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/clear_cmos.png"
SAMPLES = int(argv[1]) if len(argv) > 1 else 64
RW = int(argv[2]) if len(argv) > 2 else 1500
RH = int(argv[3]) if len(argv) > 3 else 1000
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.environ.get("THUMB_TEX_DIR", HERE)   # board textures (make_v3.py writes them to v3/build)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- render
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as e:  # CPU fallback
    print("GPU setup failed:", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = RW, RH
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.016, 0.02, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
scene.view_settings.exposure = 0.55


def mat(name, color=(0.1, 0.1, 0.1), rough=0.5, metal=0.0, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.12
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


PLASTIC = mat("plastic", srgb("#0d0e10"), 0.55)
GOLD = mat("gold", srgb("#d9ad55"), 0.22, 1.0)
STEEL = mat("steel", srgb("#c4c8cc"), 0.28, 1.0)
CHIP = mat("chip", srgb("#111214"), 0.62)
AMBER = mat("amber", (0, 0, 0), 1.0, emit=srgb("#FFC14D"), strength=9.0)
CYAN = mat("cyan", (0, 0, 0), 1.0, emit=srgb("#7ADFFF"), strength=2.2)
HANDLE = mat("handle", srgb("#1b1d20"), 0.4)


# ---------------------------------------------------------------- board
def board():
    bpy.ops.mesh.primitive_plane_add(size=1)
    p = bpy.context.object
    p.scale = (30.5, 24.4, 1)
    p.location = (15.25, -12.2, 0)
    bpy.ops.object.transform_apply(scale=True, location=False)
    # UVs: u = x / 30.5, v = 1 - y / 24.4 (top of the texture = far edge)
    m = bpy.data.materials.new("pcb")
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    bsdf = N["Principled BSDF"]
    tr = N.new("ShaderNodeTexImage")
    tr.image = bpy.data.images.load(os.path.join(TEX, "tex_traces.png"))
    tr.image.colorspace_settings.name = "Non-Color"
    sk = N.new("ShaderNodeTexImage")
    sk.image = bpy.data.images.load(os.path.join(TEX, "tex_silk.png"))
    sk.image.colorspace_settings.name = "Non-Color"
    # solder mask, copper under mask, white silkscreen
    mix1 = N.new("ShaderNodeMix"); mix1.data_type = "RGBA"
    mix1.inputs[6].default_value = (*srgb("#0a1110"), 1)     # mask
    mix1.inputs[7].default_value = (*srgb("#2f3a32"), 1)     # copper seen through green-black mask
    L.new(tr.outputs["Color"], mix1.inputs[0])
    mix2 = N.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    mix2.inputs[7].default_value = (*srgb("#cfd2c8"), 1)     # silkscreen ink
    L.new(mix1.outputs[2], mix2.inputs[6])
    L.new(sk.outputs["Color"], mix2.inputs[0])
    L.new(mix2.outputs[2], bsdf.inputs["Base Color"])
    rough = N.new("ShaderNodeMapRange")
    L.new(sk.outputs["Color"], rough.inputs[0])
    rough.inputs[3].default_value, rough.inputs[4].default_value = 0.38, 0.7
    L.new(rough.outputs[0], bsdf.inputs["Roughness"])
    bsdf.inputs["Coat Weight"].default_value = 0.55
    bsdf.inputs["Coat Roughness"].default_value = 0.18
    add = N.new("ShaderNodeMath"); add.operation = "ADD"
    L.new(tr.outputs["Color"], add.inputs[0]); L.new(sk.outputs["Color"], add.inputs[1])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.02
    L.new(add.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    p.data.materials.append(m)
    # thickness: a thin dark slab under the plane
    bpy.ops.mesh.primitive_cube_add(size=1, location=(15.25, -12.2, -0.0815))   # top 0.1 mm under the PCB plane
    s = bpy.context.object
    s.scale = (30.5, 24.4, 0.16)
    s.data.materials.append(mat("fr4", srgb("#0b1210"), 0.6))


def box(x0, y0, x1, y1, h, material, z0=0.0, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, -(y0 + y1) / 2, z0 + h / 2))
    o = bpy.context.object
    o.scale = (x1 - x0, y1 - y0, h)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("b", "BEVEL"); mod.width = bevel; mod.segments = 2
    o.data.materials.append(material)
    return o


def pin(x, y, h=0.62, base=0.25):
    box(x - 0.032, y - 0.032, x + 0.032, y + 0.032, h, GOLD, z0=0.0, bevel=0.006)


def header(x0, y0, x1, y1, pins_xy, base_h=0.25):
    box(x0, y0, x1, y1, base_h, PLASTIC)
    for x, y in pins_xy:
        pin(x, y, h=base_h + 0.6)


def pin_grid(x0, y0, x1, y1, pitch=0.254):
    """Pins in 2 rows along the long axis of a header footprint."""
    long_y = (y1 - y0) >= (x1 - x0)
    L = (y1 - y0) if long_y else (x1 - x0)
    n = max(1, int(L / pitch) - 1)
    pts = []
    for k in range(n):
        t = (k + 1) / (n + 1)
        for r in (0.33, 0.67):
            if long_y:
                pts.append((x0 + (x1 - x0) * r, y0 + (y1 - y0) * t))
            else:
                pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * r))
    return pts


def edge_cage(x0, y0, x1, y1, z0, z1, r=0.012):
    """The Lens's cyan edge cage: 12 thin emissive edges around a box."""
    xs, ys, zs = (x0, x1), (-y0, -y1), (z0, z1)
    corners = [(x, y, z) for x in xs for y in ys for z in zs]
    edges = [(a, b) for i, a in enumerate(corners) for b in corners[i + 1:]
             if sum(1 for k in range(3) if abs(a[k] - b[k]) > 1e-6) == 1]
    for a, b in edges:
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=(b - a).length, location=(a + b) / 2, vertices=8)
        c = bpy.context.object
        c.rotation_mode = "QUATERNION"
        c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
        c.data.materials.append(CYAN)


board()

# CLR_CMOS: two pins along y (manual p.4 positions, board-layout.md)
CLR = [(1.38, 21.41), (1.38, 21.64)]
header(1.24, 21.27, 1.52, 21.78, CLR)
# RST: two pins along x, and the RST_SW button beside it
header(2.45, 22.87, 2.95, 23.15, [(2.58, 23.01), (2.82, 23.01)])
box(2.43, 23.33, 2.99, 23.87, 0.22, mat("sw", srgb("#cfcfcf"), 0.4, 0.6))
bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.12, location=(2.71, -23.6, 0.28))
bpy.context.object.data.materials.append(PLASTIC)
# F_PANEL 2x9 header beside CLR_CMOS
header(0.37, 20.25, 1.2, 23.27, pin_grid(0.37, 20.25, 1.2, 23.27))
# other edge headers (Lens frame boxes from art/make_textures.py, read from the p.4 render)
for b in [(0.35, 12.8, 1.14, 14.1), (0.35, 14.33, 1.14, 15.78), (0.46, 11.4, 1.0, 12.6), (0.46, 18.6, 1.0, 19.9)]:
    header(*b, pin_grid(*b))
# F_U32 and SATA blocks along the near edge
header(3.34, 23.3, 5.84, 24.4, pin_grid(3.34, 23.3, 5.84, 24.4))
for k in range(4):
    x0 = 6.0 + k * 0.82
    box(x0 + 0.04, 22.98, x0 + 0.76, 24.4, 0.55, PLASTIC)
# chips: Super I/O and chipset packages
box(3.0, 17.9, 4.4, 19.1, 0.12, CHIP, bevel=0.01)
box(8.12, 17.63, 10.23, 19.77, 0.14, CHIP, bevel=0.01)
box(8.5, 18.0, 9.85, 19.4, 0.05, mat("die", srgb("#2a2d31"), 0.3, 0.5), z0=0.14, bevel=0.005)
# a few SMD capacitors around the chips (decorative)
for (x, y) in [(4.7, 18.2), (4.7, 18.6), (2.7, 18.3), (7.7, 18.1), (7.7, 18.5), (7.7, 18.9), (10.6, 18.3), (10.6, 18.7)]:
    box(x - 0.05, y - 0.1, x + 0.05, y + 0.1, 0.08, mat("cap", srgb("#7a6a55"), 0.45), bevel=0.01)

# AR layer: amber ring on the board around the jumper, cyan edge cage on its header
bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.014, location=(1.38, -21.525, 0.02),
                                 major_segments=96, minor_segments=8)
bpy.context.object.data.materials.append(AMBER)
edge_cage(1.21, 21.24, 1.55, 21.81, 0.0, 0.92)

# Screwdriver: steel shaft and a flat tip descending to the pins
tip = Vector((1.38, -21.525, 1.05))
direction = Vector((0.9, 0.25, 0.85)).normalized()
shaft_len = 9.0
centre = tip + direction * (shaft_len / 2 + 0.35)
bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=shaft_len, location=centre, vertices=48)
sh = bpy.context.object
sh.rotation_mode = "QUATERNION"
sh.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
sh.data.materials.append(STEEL)
bpy.ops.mesh.primitive_cube_add(size=1, location=tip + direction * 0.2)
bl = bpy.context.object
bl.rotation_mode = "QUATERNION"
bl.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
bl.scale = (0.44, 0.07, 0.42)
bl.data.materials.append(STEEL)
bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=6, location=tip + direction * (shaft_len + 3.2), vertices=48)
hd = bpy.context.object
hd.rotation_mode = "QUATERNION"
hd.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
hd.data.materials.append(HANDLE)

# ---------------------------------------------------------------- light (Tenebrism: one warm light)
def light(kind, loc, target, energy, color, size, spot=None):
    ld = bpy.data.lights.new(kind + str(len(bpy.data.lights)), kind)
    ld.energy = energy
    ld.color = color
    if kind == "SPOT":
        ld.spot_size = math.radians(spot)
        ld.spot_blend = 0.6
        ld.shadow_soft_size = size
    elif kind == "AREA":
        ld.size = size
    o = bpy.data.objects.new(ld.name, ld)
    scene.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
    return o


light("SPOT", (7.0, -31.0, 15.0), (1.8, -20.8, 0.0), 52000, (1.0, 0.78, 0.55), 1.2, spot=30)
light("AREA", (6.0, -18.0, 24.0), (5.0, -18.0, 0.0), 1100, (0.85, 0.9, 1.0), 22.0)
light("AREA", (-12.0, -8.0, 7.0), (2.0, -20.0, 0.0), 1600, (0.55, 0.72, 0.9), 8.0)

# ---------------------------------------------------------------- camera
cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 62
cam_d.clip_start = 0.1
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 5.6
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (6.0, -36.5, 15.5)
look = Vector((-0.6, -20.6, 0.0))
d = look - cam.location
cam.rotation_mode = "QUATERNION"
cam.rotation_quaternion = d.to_track_quat("-Z", "Y")
cam_d.dof.focus_distance = (Vector((1.38, -21.5, 0.4)) - cam.location).length

bpy.ops.render.render(write_still=True)
print("rendered", OUT)
