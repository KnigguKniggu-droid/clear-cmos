// ClearCmosMeshKit.ts
// Owns: the runtime-built bevelled meshes for the named *Visual objects and their bright edge lines.
// Inputs: the Rig and one material to clone for the edges. ClearCmosMain calls applyMeshKit once in onAwake.
// Must not: move, rename, or rescale anything, or touch colliders. It replaces RenderMeshVisual.mesh on the
//           named *Visual objects and adds one "EdgeLines" child under each object it edges.
// The unlit shader has no vertex color, so a bevel is invisible by shading. The bright chamfer strips carry the look.
// Meshes stay in the unit space of the existing cube and cylinder. Bevels are divided per axis by the object's
// local scale, so a bevel keeps the same size in cm on every side.

const EDGE_COLOR = new vec4(0.478, 0.875, 1, 1)
const DANGER_EDGE_COLOR = new vec4(1, 0.239, 0.29, 1)
/** Keeps edge strips off the face they sit on. */
const LIFT_CM = 0.02
const COIN_SIDES = 24
const THIN_RING_SEGMENTS = 64

type Detail = (top: TopFace) => void

interface PartSpec {
  name: string
  kind: "box" | "coin"
  bevelCm: number
  /** Danger-colored edge lines for parts that refuse. */
  danger?: boolean
  detail?: Detail
}

class Sink {
  private verts: number[] = []
  private indices: number[] = []
  private count = 0

  get triangles(): number {
    return this.indices.length / 3
  }

  private push(p: vec3, n: vec3): number {
    this.verts.push(p.x, p.y, p.z, n.x, n.y, n.z, 0, 0)
    return this.count++
  }

  tri(a: vec3, b: vec3, c: vec3, outward: vec3): void {
    const flip = b.sub(a).cross(c.sub(a)).dot(outward) < 0
    const n = outward.normalize()
    const ia = this.push(a, n)
    const ib = this.push(flip ? c : b, n)
    const ic = this.push(flip ? b : c, n)
    this.indices.push(ia, ib, ic)
  }

  quad(a: vec3, b: vec3, c: vec3, d: vec3, outward: vec3): void {
    this.tri(a, b, c, outward)
    this.tri(a, c, d, outward)
  }

  build(): RenderMesh {
    const builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3 },
      { name: "texture0", components: 2 },
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    builder.appendVerticesInterleaved(this.verts)
    builder.appendIndices(this.indices)
    builder.updateMesh()
    return builder.getMesh()
  }
}

/** Flat line art on the +Y face, given in cm from the face center. */
class TopFace {
  private readonly y: number
  constructor(private readonly sink: Sink, private readonly scale: vec3) {
    this.y = 0.5 + (2 * LIFT_CM) / scale.y
  }

  private at(x: number, z: number): vec3 {
    return new vec3(x / this.scale.x, this.y, z / this.scale.z)
  }

  line(x0: number, z0: number, x1: number, z1: number, widthCm: number): void {
    const dx = x1 - x0
    const dz = z1 - z0
    const length = Math.sqrt(dx * dx + dz * dz)
    const nx = (-dz / length) * widthCm * 0.5
    const nz = (dx / length) * widthCm * 0.5
    this.sink.quad(
      this.at(x0 - nx, z0 - nz),
      this.at(x1 - nx, z1 - nz),
      this.at(x1 + nx, z1 + nz),
      this.at(x0 + nx, z0 + nz),
      vec3.up()
    )
  }

  arc(cx: number, cz: number, radius: number, widthCm: number, sides: number, fromRad = 0, toRad = Math.PI * 2): void {
    const inner = radius - widthCm * 0.5
    const outer = radius + widthCm * 0.5
    for (let i = 0; i < sides; i++) {
      const a0 = fromRad + ((toRad - fromRad) * i) / sides
      const a1 = fromRad + ((toRad - fromRad) * (i + 1)) / sides
      this.sink.quad(
        this.at(cx + Math.cos(a0) * inner, cz + Math.sin(a0) * inner),
        this.at(cx + Math.cos(a1) * inner, cz + Math.sin(a1) * inner),
        this.at(cx + Math.cos(a1) * outer, cz + Math.sin(a1) * outer),
        this.at(cx + Math.cos(a0) * outer, cz + Math.sin(a0) * outer),
        vec3.up()
      )
    }
  }

  square(cx: number, cz: number, half: number, widthCm: number): void {
    this.line(cx - half, cz - half, cx + half, cz - half, widthCm)
    this.line(cx + half, cz - half, cx + half, cz + half, widthCm)
    this.line(cx + half, cz + half, cx - half, cz + half, widthCm)
    this.line(cx - half, cz + half, cx - half, cz - half, widthCm)
  }
}

function fan(top: TopFace, cx: number): void {
  top.arc(cx, 0, 3.9, 0.22, 32)
  top.arc(cx, 0, 1.1, 0.2, 16)
  const blades = 7
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2
    top.line(
      cx + Math.cos(a) * 1.25,
      Math.sin(a) * 1.25,
      cx + Math.cos(a + 0.7) * 3.7,
      Math.sin(a + 0.7) * 3.7,
      0.16
    )
  }
}

const PARTS: PartSpec[] = [
  {
    name: "GpuVisual",
    kind: "box",
    bevelCm: 0.22,
    detail: (top) => {
      fan(top, -9.1)
      fan(top, 0)
      fan(top, 9.1)
    },
  },
  { name: "GlassVisual", kind: "box", bevelCm: 0.05 },
  {
    name: "SocketVisual",
    kind: "box",
    bevelCm: 0.18,
    detail: (top) => {
      top.square(0, 0, 2.2, 0.14)
      top.arc(0, 0, 0.45, 0.12, 12)
      top.line(-2.2, -1.5, -1.5, -2.2, 0.14)
    },
  },
  {
    name: "PlugVisual",
    kind: "box",
    bevelCm: 0.25,
    detail: (top) => {
      top.line(-1.4, -2, -1.4, 2, 0.25)
      top.line(1.4, -2, 1.4, 2, 0.25)
    },
  },
  {
    name: "JumperVisual",
    kind: "box",
    bevelCm: 0.1,
    detail: (top) => {
      top.arc(-0.38, 0, 0.2, 0.09, 10)
      top.arc(0.38, 0, 0.2, 0.09, 10)
    },
  },
  {
    name: "RstJumperVisual",
    kind: "box",
    bevelCm: 0.1,
    detail: (top) => {
      top.arc(-0.38, 0, 0.2, 0.09, 10)
      top.arc(0.38, 0, 0.2, 0.09, 10)
    },
  },
  { name: "BatteryRedVisual", kind: "box", bevelCm: 0.1, danger: true },
  { name: "BatteryPadVisual", kind: "box", bevelCm: 0.08 },
  {
    name: "BatteryVisual",
    kind: "coin",
    bevelCm: 0.08,
    detail: (top) => {
      top.line(-0.4, 0, 0.4, 0, 0.14)
      top.line(0, -0.4, 0, 0.4, 0.14)
    },
  },
  {
    name: "PowerButtonVisual",
    kind: "coin",
    bevelCm: 0.12,
    detail: (top) => {
      top.arc(0, 0, 0.7, 0.18, 20, -Math.PI * 0.33, Math.PI * 1.33)
      top.line(0, -1, 0, -0.1, 0.18)
    },
  },
]

interface EdgeSpec {
  name: string
  barCm: number
  danger?: boolean
  detail?: Detail
  /** Line width in cm of a closed flat frame on the +Z face. A back-culled cage loses its top and side edges, and this frame draws them. */
  frontFrameCm?: number
}

const chipTicks: Detail = (top) => {
  for (let z = -4.8; z <= 4.8; z += 1.6) top.line(-0.18, z, 0.18, z, 0.16)
}

/** These keep their cube mesh and only gain edge lines. */
const EDGE_ONLY: EdgeSpec[] = [
  { name: "Stick1", barCm: 0.08, danger: true, detail: chipTicks },
  { name: "Stick2", barCm: 0.08, danger: true, detail: chipTicks },
  { name: "Stick3", barCm: 0.08, danger: true, detail: chipTicks },
  { name: "Stick4", barCm: 0.08, danger: true, detail: chipTicks },
  { name: "MonitorBody", barCm: 0.2, frontFrameCm: 0.5 },
  { name: "Board", barCm: 0.12 },
  { name: "Table", barCm: 0.25 },
]

/** A filled unit box, for the early warning flash. Its faces point outward, so a back-culled material draws one layer per pixel. */
export function buildSolidBox(): RenderMesh {
  const sink = new Sink()
  addBox(sink, null, new vec3(0.5, 0.5, 0.5), new vec3(0, 0, 0))
  return sink.build()
}

/** Four open walls around a unit footprint, from y 0 to y 1, so a y scale raises them from the base. Draw it two-sided. */
export function buildWallRing(): RenderMesh {
  const sink = new Sink()
  const h = 0.5
  const corners = [new vec2(-h, -h), new vec2(h, -h), new vec2(h, h), new vec2(-h, h)]
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    const mid = a.add(b).uniformScale(0.5)
    sink.quad(new vec3(a.x, 0, a.y), new vec3(b.x, 0, b.y), new vec3(b.x, 1, b.y), new vec3(a.x, 1, a.y), new vec3(mid.x, 0, mid.y))
  }
  return sink.build()
}

/** A unit-box edge cage, for overlays such as the hover outline and the no-go box. */
export function buildCage(scale: vec3, barCm: number): RenderMesh {
  const edges = new Sink()
  const inset = new vec3(bevelFor(barCm, scale.x), bevelFor(barCm, scale.y), bevelFor(barCm, scale.z))
  addBox(null, edges, new vec3(0.5, 0.5, 0.5), inset)
  return edges.build()
}

/** A flat ring of outer radius 1 in the XZ plane, facing +Y. innerRadius is a fraction of the outer radius. */
export function buildThinRing(innerRadius: number): RenderMesh {
  const sink = new Sink()
  const up = new vec3(0, 1, 0)
  const point = (i: number): vec3 => {
    const a = (i / THIN_RING_SEGMENTS) * 2 * Math.PI
    return new vec3(Math.cos(a), 0, Math.sin(a))
  }
  for (let i = 0; i < THIN_RING_SEGMENTS; i++) {
    const outerA = point(i)
    const outerB = point(i + 1)
    sink.quad(outerA, outerB, outerB.uniformScale(innerRadius), outerA.uniformScale(innerRadius), up)
  }
  return sink.build()
}

/** A flat arrow in the XZ plane that points along +Z: a chevron head and a shaft back to tailZ, visible from above and below. */
export function buildArrow(barCm: number, tipZ: number, halfSpanX: number, tailZ: number): RenderMesh {
  const sink = new Sink()
  const tip = new vec3(0, 0, tipZ)
  const halfBar = barCm * 0.5
  for (const outward of [vec3.up(), vec3.up().uniformScale(-1)]) {
    for (const sign of [-1, 1]) {
      const end = new vec3(sign * halfSpanX, 0, 0)
      const along = tip.sub(end).normalize()
      const side = new vec3(-along.z, 0, along.x).uniformScale(halfBar)
      sink.quad(end.sub(side), tip.sub(side), tip.add(side), end.add(side), outward)
    }
    sink.quad(new vec3(-halfBar, 0, tailZ), new vec3(halfBar, 0, tailZ), new vec3(halfBar, 0, tipZ), new vec3(-halfBar, 0, tipZ), outward)
  }
  return sink.build()
}

/** A flat bar in the XZ plane, centered, used for the X-ray sweep. */
export function buildFlatBar(widthCm: number, lengthCm: number): RenderMesh {
  const sink = new Sink()
  const halfX = widthCm * 0.5
  const halfZ = lengthCm * 0.5
  sink.quad(new vec3(-halfX, 0, -halfZ), new vec3(halfX, 0, -halfZ), new vec3(halfX, 0, halfZ), new vec3(-halfX, 0, halfZ), vec3.up())
  return sink.build()
}

/** One flat line from start to end, in the plane that faces towardViewer. */
export function buildLeader(start: vec3, end: vec3, halfWidthCm: number, towardViewer: vec3): RenderMesh {
  const sink = new Sink()
  const side = end.sub(start).cross(towardViewer).normalize().uniformScale(halfWidthCm)
  sink.quad(start.sub(side), start.add(side), end.add(side), end.sub(side), towardViewer)
  return sink.build()
}

/** Vertical lines from topY to bottomY at each x, z, each with a square on the plane topY. */
export function buildPierce(points: vec2[], topY: number, bottomY: number, lineCm: number, squareHalfCm: number): RenderMesh {
  const sink = new Sink()
  const half = lineCm * 0.5
  for (const point of points) {
    const x = point.x
    const z = point.y
    sink.quad(new vec3(x - half, bottomY, z), new vec3(x + half, bottomY, z), new vec3(x + half, topY, z), new vec3(x - half, topY, z), vec3.forward())
    sink.quad(new vec3(x, bottomY, z - half), new vec3(x, bottomY, z + half), new vec3(x, topY, z + half), new vec3(x, topY, z - half), vec3.right())
    const y = topY + 0.02
    const s = squareHalfCm
    const w = lineCm * 0.5
    sink.quad(new vec3(x - s, y, z - s - w), new vec3(x + s, y, z - s - w), new vec3(x + s, y, z - s + w), new vec3(x - s, y, z - s + w), vec3.up())
    sink.quad(new vec3(x - s, y, z + s - w), new vec3(x + s, y, z + s - w), new vec3(x + s, y, z + s + w), new vec3(x - s, y, z + s + w), vec3.up())
    sink.quad(new vec3(x - s - w, y, z - s), new vec3(x - s + w, y, z - s), new vec3(x - s + w, y, z + s), new vec3(x - s - w, y, z + s), vec3.up())
    sink.quad(new vec3(x + s - w, y, z - s), new vec3(x + s + w, y, z - s), new vec3(x + s + w, y, z + s), new vec3(x + s - w, y, z + s), vec3.up())
  }
  return sink.build()
}

/**
 * The callout mesh in true size, in cm: one wire cage and two pin rings per pin pair. Its parent scales it up.
 * Each pair sits at the given x, z in callout space, with its pins along x or z.
 */
export function buildPinPairCallout(
  pairs: { x: number; z: number; pinsAlongX: boolean }[],
  halfLong: number,
  halfShort: number,
  halfY: number,
  barCm: number,
  pinOffset: number,
  pinRadius: number,
  ringWidthCm: number,
): RenderMesh {
  const sink = new Sink()
  const inner = pinRadius - ringWidthCm
  for (const pair of pairs) {
    const half = pair.pinsAlongX ? new vec3(halfLong, halfY, halfShort) : new vec3(halfShort, halfY, halfLong)
    addWireBox(sink, new vec3(pair.x, 0, pair.z), half, barCm)
    for (const sign of [-1, 1]) {
      const cx = pair.x + (pair.pinsAlongX ? sign * pinOffset : 0)
      const cz = pair.z + (pair.pinsAlongX ? 0 : sign * pinOffset)
      for (let i = 0; i < THIN_RING_SEGMENTS; i++) {
        const a0 = (i / THIN_RING_SEGMENTS) * Math.PI * 2
        const a1 = ((i + 1) / THIN_RING_SEGMENTS) * Math.PI * 2
        sink.quad(
          new vec3(cx + Math.cos(a0) * inner, halfY, cz + Math.sin(a0) * inner),
          new vec3(cx + Math.cos(a1) * inner, halfY, cz + Math.sin(a1) * inner),
          new vec3(cx + Math.cos(a1) * pinRadius, halfY, cz + Math.sin(a1) * pinRadius),
          new vec3(cx + Math.cos(a0) * pinRadius, halfY, cz + Math.sin(a0) * pinRadius),
          vec3.up()
        )
      }
    }
  }
  return sink.build()
}

/** Twelve wire edges of one box, each as two crossed quads, so it reads from any angle. */
function addWireBox(sink: Sink, center: vec3, half: vec3, barCm: number): void {
  const h = [half.x, half.y, half.z]
  const c = [center.x, center.y, center.z]
  const w = barCm * 0.5
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3
    for (const su of [1, -1]) {
      for (const sv of [1, -1]) {
        const at = (along: number, du: number, dv: number): vec3 => {
          const p = [0, 0, 0]
          p[axis] = c[axis] + along * h[axis]
          p[u] = c[u] + su * h[u] + du
          p[v] = c[v] + sv * h[v] + dv
          return new vec3(p[0], p[1], p[2])
        }
        const n = pick(axis, 0, su, sv)
        sink.quad(at(-1, -w, -w), at(1, -w, -w), at(1, w, w), at(-1, w, w), n)
        sink.quad(at(-1, -w, w), at(1, -w, w), at(1, w, -w), at(-1, w, -w), n)
      }
    }
  }
}

/** A hollow screwdriver with its tip at the origin and its handle along +Y: a blade across both pins, a shaft, and a handle. About 16 cm long, so it reads at the working view. */
export function buildScrewdriver(): RenderMesh {
  const sink = new Sink()
  addWireBox(sink, new vec3(0, 0.36, 0), new vec3(0.72, 0.36, 0.11), 0.12)
  addWireBox(sink, new vec3(0, 5.67, 0), new vec3(0.14, 4.95, 0.14), 0.14)
  addWireBox(sink, new vec3(0, 13.32, 0), new vec3(0.99, 2.7, 0.99), 0.22)
  return sink.build()
}

/** Filled flat discs, facing +Y. Each vec4 is x, y, z, and radius, in the parent's cm. */
export function buildPadDiscs(discs: vec4[]): RenderMesh {
  const sink = new Sink()
  const sides = 20
  for (const disc of discs) {
    const center = new vec3(disc.x, disc.y, disc.z)
    const point = (i: number): vec3 => {
      const a = (i / sides) * Math.PI * 2
      return new vec3(disc.x + Math.cos(a) * disc.w, disc.y, disc.z + Math.sin(a) * disc.w)
    }
    for (let i = 0; i < sides; i++) sink.tri(center, point(i), point(i + 1), vec3.up())
  }
  return sink.build()
}
/** A closed rectangle of flat lines on the +Z face of a unit box, in the box's own unit space. */
function addFrontFrame(sink: Sink, scale: vec3, lineCm: number): void {
  const z = 0.5 + (2 * LIFT_CM) / scale.z
  const wx = lineCm / scale.x
  const wy = lineCm / scale.y
  const rect = (x0: number, y0: number, x1: number, y1: number): void => {
    sink.quad(new vec3(x0, y0, z), new vec3(x1, y0, z), new vec3(x1, y1, z), new vec3(x0, y1, z), vec3.forward())
  }
  rect(-0.5, 0.5 - wy, 0.5, 0.5)
  rect(-0.5, -0.5, 0.5, -0.5 + wy)
  rect(-0.5, -0.5 + wy, -0.5 + wx, 0.5 - wy)
  rect(0.5 - wx, -0.5 + wy, 0.5, 0.5 - wy)
}

function bevelFor(cm: number, scale: number): number {
  return Math.min(0.45, cm / scale)
}

function pick(axis: number, on: number, a: number, b: number): vec3 {
  const v = [0, 0, 0]
  v[axis] = on
  v[(axis + 1) % 3] = a
  v[(axis + 2) % 3] = b
  return new vec3(v[0], v[1], v[2])
}

/** Writes the chamfers and corners to each sink, and the flat faces only to faceSink. */
function addBox(faceSink: Sink | null, edgeSink: Sink | null, half: vec3, inset: vec3): void {
  const h = [half.x, half.y, half.z]
  const b = [inset.x, inset.y, inset.z]
  const point = (axis: number, signs: number[]): vec3 => {
    const v = [0, 0, 0]
    for (let i = 0; i < 3; i++) v[i] = signs[i] * (i === axis ? h[i] : h[i] - b[i])
    return new vec3(v[0], v[1], v[2])
  }
  for (const s of [1, -1]) {
    for (let axis = 0; axis < 3; axis++) {
      const signsAt = (u: number, v: number): number[] => {
        const signs = [0, 0, 0]
        signs[axis] = s
        signs[(axis + 1) % 3] = u
        signs[(axis + 2) % 3] = v
        return signs
      }
      if (faceSink) {
        faceSink.quad(
          point(axis, signsAt(1, 1)),
          point(axis, signsAt(-1, 1)),
          point(axis, signsAt(-1, -1)),
          point(axis, signsAt(1, -1)),
          pick(axis, s, 0, 0)
        )
      }
    }
  }
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3
    for (const su of [1, -1]) {
      for (const sv of [1, -1]) {
        const at = (along: number): number[] => {
          const signs = [0, 0, 0]
          signs[axis] = along
          signs[u] = su
          signs[v] = sv
          return signs
        }
        const a = point(u, at(-1))
        const b2 = point(u, at(1))
        const c = point(v, at(1))
        const d = point(v, at(-1))
        const outward = pick(axis, 0, su, sv)
        if (faceSink) faceSink.quad(a, b2, c, d, outward)
        if (edgeSink) edgeSink.quad(a, b2, c, d, outward)
      }
    }
  }
  for (const x of [1, -1]) {
    for (const y of [1, -1]) {
      for (const z of [1, -1]) {
        const signs = [x, y, z]
        const a = point(0, signs)
        const b2 = point(1, signs)
        const c = point(2, signs)
        const outward = new vec3(x, y, z)
        if (faceSink) faceSink.tri(a, b2, c, outward)
        if (edgeSink) edgeSink.tri(a, b2, c, outward)
      }
    }
  }
}

function addCoin(faceSink: Sink, edgeSink: Sink, scale: vec3, bevelCm: number): void {
  const inset = bevelFor(bevelCm, scale.x)
  const drop = bevelFor(bevelCm, scale.y)
  const liftRadial = LIFT_CM / scale.x
  const liftY = LIFT_CM / scale.y
  const ring = (radius: number, y: number, i: number): vec3 => {
    const a = (i / COIN_SIDES) * Math.PI * 2
    return new vec3(Math.cos(a) * radius, y, Math.sin(a) * radius)
  }
  const up = vec3.up()
  const down = up.uniformScale(-1)
  for (let i = 0; i < COIN_SIDES; i++) {
    const j = i + 1
    const a = (i + 0.5) / COIN_SIDES * Math.PI * 2
    const radial = new vec3(Math.cos(a), 0, Math.sin(a))
    faceSink.tri(new vec3(0, 0.5, 0), ring(0.5 - inset, 0.5, i), ring(0.5 - inset, 0.5, j), up)
    faceSink.tri(new vec3(0, -0.5, 0), ring(0.5 - inset, -0.5, i), ring(0.5 - inset, -0.5, j), down)
    faceSink.quad(ring(0.5, 0.5 - drop, i), ring(0.5, 0.5 - drop, j), ring(0.5, drop - 0.5, j), ring(0.5, drop - 0.5, i), radial)
    const topOut = radial.add(up)
    const bottomOut = radial.add(down)
    faceSink.quad(ring(0.5 - inset, 0.5, i), ring(0.5 - inset, 0.5, j), ring(0.5, 0.5 - drop, j), ring(0.5, 0.5 - drop, i), topOut)
    faceSink.quad(ring(0.5 - inset, -0.5, i), ring(0.5 - inset, -0.5, j), ring(0.5, drop - 0.5, j), ring(0.5, drop - 0.5, i), bottomOut)
    const r0 = 0.5 - inset + liftRadial
    const r1 = 0.5 + liftRadial
    edgeSink.quad(ring(r0, 0.5 + liftY, i), ring(r0, 0.5 + liftY, j), ring(r1, 0.5 - drop + liftY, j), ring(r1, 0.5 - drop + liftY, i), topOut)
    edgeSink.quad(ring(r0, -0.5 - liftY, i), ring(r0, -0.5 - liftY, j), ring(r1, drop - 0.5 - liftY, j), ring(r1, drop - 0.5 - liftY, i), bottomOut)
  }
}

function findByName(root: SceneObject, wanted: Map<string, SceneObject>): void {
  if (wanted.has(root.name)) wanted.set(root.name, root)
  for (let i = 0; i < root.getChildrenCount(); i++) findByName(root.getChild(i), wanted)
}

/** The edge-line visual of a named object under the rig, so a caller can give it its own material. */
export function findEdgeLines(rig: SceneObject, name: string): RenderMeshVisual {
  const found = new Map<string, SceneObject>([[name, null]])
  findByName(rig, found)
  const owner = found.get(name)
  const edges = owner ? owner.children.find((c) => c.name === "EdgeLines") : null
  if (!edges) throw new Error("no EdgeLines under " + name)
  return edges.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
}

function addEdgeChild(owner: SceneObject, source: RenderMeshVisual, mesh: RenderMesh, material: Material): void {
  const child = global.scene.createSceneObject("EdgeLines")
  child.setParent(owner)
  const visual = child.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  visual.mesh = mesh
  visual.mainMaterial = material
  visual.setRenderOrder(source.getRenderOrder())
}

/** Builds every mesh synchronously. Returns the triangles added and the edge material, so the Lens can dim the edges. */
export function applyMeshKit(rig: SceneObject, overlayMaterial: Material): { addedTriangles: number; edgeMaterial: Material } {
  const found = new Map<string, SceneObject>()
  for (const part of PARTS) found.set(part.name, null)
  for (const spec of EDGE_ONLY) found.set(spec.name, null)
  findByName(rig, found)

  const edgeMaterial = overlayMaterial.clone()
  edgeMaterial.mainPass.baseColor = EDGE_COLOR
  const dangerEdgeMaterial = overlayMaterial.clone()
  dangerEdgeMaterial.mainPass.baseColor = DANGER_EDGE_COLOR

  let added = 0
  for (const part of PARTS) {
    const owner = found.get(part.name)
    if (!owner) {
      print("[ClearCmos] mesh kit missing " + part.name)
      continue
    }
    const visual = owner.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const scale = owner.getTransform().getLocalScale()
    const faces = new Sink()
    const edges = new Sink()
    if (part.kind === "box") {
      const inset = new vec3(bevelFor(part.bevelCm, scale.x), bevelFor(part.bevelCm, scale.y), bevelFor(part.bevelCm, scale.z))
      addBox(faces, null, new vec3(0.5, 0.5, 0.5), inset)
      const lifted = new vec3(0.5 + LIFT_CM / scale.x, 0.5 + LIFT_CM / scale.y, 0.5 + LIFT_CM / scale.z)
      addBox(null, edges, lifted, inset)
    } else {
      addCoin(faces, edges, scale, part.bevelCm)
    }
    if (part.detail) part.detail(new TopFace(edges, scale))
    visual.mesh = faces.build()
    const material = part.danger ? dangerEdgeMaterial : edgeMaterial
    addEdgeChild(owner, visual, edges.build(), material)
    added += faces.triangles + edges.triangles - (part.kind === "box" ? 12 : 0)
  }

  for (const spec of EDGE_ONLY) {
    const owner = found.get(spec.name)
    if (!owner) {
      print("[ClearCmos] mesh kit missing " + spec.name)
      continue
    }
    const scale = owner.getTransform().getLocalScale()
    const edges = new Sink()
    const inset = new vec3(bevelFor(spec.barCm, scale.x), bevelFor(spec.barCm, scale.y), bevelFor(spec.barCm, scale.z))
    const lifted = new vec3(0.5 + LIFT_CM / scale.x, 0.5 + LIFT_CM / scale.y, 0.5 + LIFT_CM / scale.z)
    addBox(null, edges, lifted, inset)
    if (spec.detail) spec.detail(new TopFace(edges, scale))
    if (spec.frontFrameCm) addFrontFrame(edges, scale, spec.frontFrameCm)
    const material = spec.danger ? dangerEdgeMaterial : edgeMaterial
    addEdgeChild(owner, owner.getComponent("Component.RenderMeshVisual") as RenderMeshVisual, edges.build(), material)
    added += edges.triangles
  }
  return { addedTriangles: added, edgeMaterial }
}
