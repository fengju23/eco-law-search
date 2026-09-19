// 程序化生成高分辨率山水/分形艺术 PNG（零依赖，手写 PNG 编码器 + zlib）
// 用法：node scripts/gen-art-png.cjs
// 输出：public/gallery/art-XX.png（30 张 1600x1000，预计共 ~10MB）
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ---- PNG 编码 ----
function crc32(buf) {
  let c
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  c = 0 ^ -1
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff]
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function writePNG(fp, w, h, pixels /* RGBA Uint8Array */) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 压缩为无滤波扫描线（filter byte 0）
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
  }
  const src = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  for (let y = 0; y < h; y++) {
    src.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 6 })
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
  fs.writeFileSync(fp, png)
  return png.length
}

// ---- 工具 ----
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 值噪声 + 分形叠加
function makeNoise(seed) {
  const rnd = mulberry32(seed)
  const size = 256
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const smooth = (t) => t * t * (3 - 2 * t)
  const at = (x, y) => {
    const xi = Math.floor(x) % size
    const yi = Math.floor(y) % size
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const x0 = ((xi % size) + size) % size
    const y0 = ((yi % size) + size) % size
    const x1 = (x0 + 1) % size
    const y1 = (y0 + 1) % size
    const v00 = grid[y0 * size + x0]
    const v10 = grid[y0 * size + x1]
    const v01 = grid[y1 * size + x0]
    const v11 = grid[y1 * size + x1]
    const sx = smooth(xf)
    const sy = smooth(yf)
    return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy
  }
  return function fbm(x, y, octaves = 5, lac = 2, gain = 0.5) {
    let amp = 1
    let freq = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += at(x * freq, y * freq) * amp
      norm += amp
      amp *= gain
      freq *= lac
    }
    return sum / norm
  }
}

function mix(a, b, t) {
  return a + (b - a) * t
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

const palettes = [
  { name: '青绿山水', sky: [232, 243, 236], sun: [201, 162, 75], far: [159, 212, 184], mid: [90, 158, 120], near: [47, 122, 94], water: [58, 110, 165] },
  { name: '黛蓝烟雨', sky: [234, 242, 246], sun: [216, 178, 95], far: [163, 196, 217], mid: [93, 137, 168], near: [51, 96, 127], water: [43, 84, 110] },
  { name: '暖金秋色', sky: [246, 239, 223], sun: [201, 118, 43], far: [217, 192, 138], mid: [179, 148, 90], near: [138, 111, 60], water: [122, 95, 55] },
  { name: '暮紫流霞', sky: [240, 234, 243], sun: [208, 120, 75], far: [185, 163, 201], mid: [138, 111, 163], near: [102, 80, 127], water: [86, 68, 110] },
  { name: '雨雾空灵', sky: [238, 242, 241], sun: [154, 168, 127], far: [174, 191, 184], mid: [122, 147, 138], near: [88, 117, 104], water: [70, 96, 85] },
  { name: '朱砂丹霞', sky: [248, 236, 228], sun: [179, 67, 44], far: [212, 164, 136], mid: [176, 118, 90], near: [138, 79, 56], water: [128, 74, 52] },
]

const subjects = [
  '层峦叠翠', '云烟出岫', '湖光潋滟', '松声半岭', '平湖秋月', '远村烟树',
  '溪山清远', '碧涧流泉', '孤峰立雪', '雾锁重楼', '曲岸回沙', '幽谷藏春',
  '柳岸闻莺', '汀洲白鹭', '千岩竞秀', '万壑争流', '山寺鸣钟', '渔舟唱晚',
  '竹外一枝', '霜天竞自由', '空山新雨', '长河落日', '春山可望', '绿野仙踪',
  '苍山如海', '残阳如血', '江山如画', '烟波浩渺', '林深时见鹿', '海晏河清',
]

const W = 1600
const H = 1000

// 山体高度场（多层 fbm，越远越平）
function heightField(noises, x, y, depth) {
  // depth: 0远 1近
  const n1 = noises[0](x * 0.0022 + depth * 1.37, y * 0.004, 5)
  const n2 = noises[1](x * 0.0009, y * 0.002, 4)
  const ridge = Math.abs(n1 - 0.5) * 2 // ridged
  return mix(n2 * 0.5 + 0.25, 1 - ridge, depth * 0.75)
}

function render(n) {
  const p = palettes[n % palettes.length]
  const subject = subjects[n % subjects.length]
  const seed = n * 7919 + 101
  const noises = [makeNoise(seed), makeNoise(seed + 7), makeNoise(seed + 23), makeNoise(seed + 41)]
  const rnd = mulberry32(seed)
  const horizon = 0.42 + rnd() * 0.1 // 归一化地平线
  const sunX = 0.15 + rnd() * 0.7
  const sunY = 0.08 + rnd() * 0.1
  const layers = [
    { depth: 0.18, color: p.far, yBase: horizon - 0.12, amp: 0.34 },
    { depth: 0.5, color: p.mid, yBase: horizon + 0.02, amp: 0.3 },
    { depth: 1.0, color: p.near, yBase: horizon + 0.22, amp: 0.26 },
  ]

  const pixels = new Uint8Array(W * H * 4)

  // 云
  const cloudN = noises[2]
  const cloudX = rnd() * 100
  const cloudY = rnd() * 100

  for (let py = 0; py < H; py++) {
    const v = py / H // 0顶 1底
    for (let px = 0; px < W; px++) {
      const u = px / W
      let r, g, b

      // 天空
      const t = clamp01(v / Math.max(horizon, 0.01))
      r = mix(p.sky[0], p.sky[0] * 0.94, t)
      g = mix(p.sky[1], p.sky[1] * 0.9, t)
      b = mix(p.sky[2], p.sky[2] * 0.86, t)

      // 太阳 + 光晕
      const dsun = Math.sqrt((u - sunX) ** 2 + ((v - sunY) * (H / W)) ** 2)
      const glow = Math.max(0, 1 - dsun / 0.3) ** 2
      const disc = Math.max(0, 1 - dsun / 0.035)
      r += p.sun[0] * (glow * 0.45 + disc * 0.9)
      g += p.sun[1] * (glow * 0.4 + disc * 0.85)
      b += p.sun[2] * (glow * 0.3 + disc * 0.7)

      // 云
      if (v < horizon) {
        const cl = cloudN(u * 3 + cloudX, v * 7 + cloudY, 4)
        const clMask = Math.max(0, (cl - 0.55) * 2.6) * Math.max(0, 1 - Math.abs(v - horizon * 0.45) * 3.4)
        r = mix(r, 250, clMask * 0.8)
        g = mix(g, 251, clMask * 0.8)
        b = mix(b, 253, clMask * 0.8)
      }

      // 山层
      for (let li = layers.length - 1; li >= 0; li--) {
        const L = layers[li]
        const hf = heightField(noises, px, py, L.depth)
        const yBase = L.yBase - hf * L.amp * 0.4
        if (v > yBase) {
          const fade = clamp01((v - yBase) / 0.5)
          const shade = 1 - clamp01((hf - 0.4) * 0.35) * 0.28
          r = mix(L.color[0] * shade, L.color[0] * 0.55, fade * 0.45)
          g = mix(L.color[1] * shade, L.color[1] * 0.55, fade * 0.45)
          b = mix(L.color[2] * shade, L.color[2] * 0.55, fade * 0.45)
          // 大气透视
          const air = (1 - L.depth) * 0.32
          r = mix(r, p.sky[0], air)
          g = mix(g, p.sky[1], air)
          b = mix(b, p.sky[2], air)
          break
        }
      }

      // 水面
      const waterLine = horizon + 0.34
      if (v > waterLine) {
        const wt = (v - waterLine) / (1 - waterLine)
        const refl = noises[3](u * 2 + wt * 0.2, wt * 22, 3)
        const wave = 0.5 + 0.5 * Math.sin(u * 60 + wt * 40 + refl * 12)
        r = mix(p.water[0], p.water[0] * 0.5, wt) * (0.9 + wave * 0.18)
        g = mix(p.water[1], p.water[1] * 0.5, wt) * (0.9 + wave * 0.18)
        b = mix(p.water[2], p.water[2] * 0.5, wt) * (0.9 + wave * 0.18)
        // 倒影太阳
        const dRef = Math.sqrt((u - sunX) ** 2 + ((v - (waterLine + 0.18)) * 1.4) ** 2)
        const shimmer = Math.max(0, 1 - dRef / 0.12) * (0.6 + refl * 0.5)
        r += p.sun[0] * shimmer * 0.55
        g += p.sun[1] * shimmer * 0.45
        b += p.sun[2] * shimmer * 0.3
      }

      const idx = (py * W + px) * 4
      pixels[idx] = Math.max(0, Math.min(255, r))
      pixels[idx + 1] = Math.max(0, Math.min(255, g))
      pixels[idx + 2] = Math.max(0, Math.min(255, b))
      pixels[idx + 3] = 255
    }
  }

  return { pixels, subject, paletteName: p.name }
}

const outDir = path.join(__dirname, '..', 'public', 'gallery')
fs.mkdirSync(outDir, { recursive: true })

let total = 0
for (let n = 0; n < 30; n++) {
  const { pixels, subject, paletteName } = render(n)
  const fp = path.join(outDir, `art-${String(n + 1).padStart(2, '0')}.png`)
  const size = writePNG(fp, W, H, pixels)
  total += size
  console.log(
    `art-${String(n + 1).padStart(2, '0')}.png  ${(size / 1024).toFixed(0)}KB  《${subject}》${paletteName}`,
  )
}
console.log(`\ntotal: ${(total / 1024 / 1024).toFixed(2)}MB / 30 张`)
