// 二十四节气山水卷：24 幅节气主题画作（1600×1000 PNG）
// 用法：node scripts/gen-solar.cjs
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

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
function writePNG(fp, w, h, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  const src = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    src.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 6 })
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
  fs.writeFileSync(fp, png)
  return png.length
}
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
function makeNoise(seed) {
  const rnd = mulberry32(seed)
  const size = 256
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const smooth = (t) => t * t * (3 - 2 * t)
  return function fbm(x, y, octaves = 5) {
    let amp = 1, freq = 1, sum = 0, norm = 0
    for (let o = 0; o < octaves; o++) {
      const xi = Math.floor(x * freq) % size, yi = Math.floor(y * freq) % size
      const xf = x * freq - Math.floor(x * freq), yf = y * freq - Math.floor(y * freq)
      const x0 = ((xi % size) + size) % size, y0 = ((yi % size) + size) % size
      const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size
      const sx = smooth(xf), sy = smooth(yf)
      sum += ((grid[y0 * size + x0] * (1 - sx) + grid[y0 * size + x1] * sx) * (1 - sy) +
        (grid[y1 * size + x0] * (1 - sx) + grid[y1 * size + x1] * sx) * sy) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}

// 节气定义：名称、色调（天空/远山/中山/近山/水/日）、诗句
const terms = [
  { name: '立春', sky: [236, 243, 234], far: [186, 214, 189], mid: [124, 168, 128], near: [70, 122, 82], water: [100, 150, 120], sun: [222, 196, 120], poem: '东风解冻，蛰虫始振' },
  { name: '雨水', sky: [231, 240, 240], far: [180, 205, 208], mid: [116, 154, 160], near: [66, 108, 114], water: [90, 130, 140], sun: [210, 200, 150], poem: '好雨知时节，当春乃发生' },
  { name: '惊蛰', sky: [240, 244, 230], far: [196, 216, 176], mid: [136, 172, 108], near: [84, 126, 66], water: [110, 150, 100], sun: [228, 196, 90], poem: '微雨众卉新，一雷惊蛰始' },
  { name: '春分', sky: [242, 246, 232], far: [200, 220, 180], mid: [140, 180, 112], near: [86, 132, 68], water: [120, 160, 110], sun: [232, 200, 96], poem: '春分雨脚落声微，柳岸斜风带客归' },
  { name: '清明', sky: [234, 242, 240], far: [184, 208, 204], mid: [118, 158, 150], near: [70, 112, 106], water: [96, 138, 130], sun: [216, 204, 150], poem: '清明时节雨纷纷' },
  { name: '谷雨', sky: [238, 244, 232], far: [192, 216, 180], mid: [128, 170, 118], near: [78, 122, 72], water: [106, 148, 104], sun: [226, 198, 110], poem: '谷雨春光晓，山川黛色青' },
  { name: '立夏', sky: [238, 244, 228], far: [198, 222, 172], mid: [134, 178, 112], near: [80, 128, 70], water: [110, 155, 105], sun: [234, 200, 90], poem: '绿树阴浓夏日长' },
  { name: '小满', sky: [240, 245, 226], far: [204, 224, 168], mid: [142, 184, 106], near: [86, 134, 62], water: [116, 160, 96], sun: [238, 202, 84], poem: '夜莺啼绿柳，皓月醒长空' },
  { name: '芒种', sky: [242, 246, 222], far: [208, 226, 162], mid: [148, 188, 100], near: [92, 138, 58], water: [120, 165, 92], sun: [240, 204, 78], poem: '时雨及芒种，四野皆插秧' },
  { name: '夏至', sky: [244, 247, 224], far: [212, 230, 160], mid: [152, 192, 98], near: [96, 142, 56], water: [124, 168, 90], sun: [242, 206, 72], poem: '昼晷已云极，宵漏自此长' },
  { name: '小暑', sky: [246, 246, 226], far: [216, 228, 168], mid: [156, 190, 112], near: [100, 140, 72], water: [128, 162, 100], sun: [236, 190, 80], poem: '倏忽温风至，因循小暑来' },
  { name: '大暑', sky: [248, 244, 226], far: [220, 224, 172], mid: [160, 186, 118], near: [104, 136, 78], water: [130, 156, 106], sun: [230, 178, 84], poem: '大暑三秋近，林钟九夏移' },
  { name: '立秋', sky: [244, 242, 226], far: [214, 214, 178], mid: [156, 174, 122], near: [104, 128, 80], water: [118, 138, 92], sun: [224, 178, 100], poem: '云天收夏色，木叶动秋声' },
  { name: '处暑', sky: [242, 240, 230], far: [210, 212, 182], mid: [150, 172, 128], near: [98, 124, 84], water: [112, 134, 96], sun: [220, 182, 110], poem: '处暑无三日，新凉直万金' },
  { name: '白露', sky: [238, 242, 240], far: [196, 210, 208], mid: [128, 158, 154], near: [82, 116, 110], water: [100, 128, 122], sun: [212, 196, 140], poem: '蒹葭苍苍，白露为霜' },
  { name: '秋分', sky: [240, 240, 234], far: [204, 208, 190], mid: [140, 160, 130], near: [92, 120, 84], water: [106, 130, 94], sun: [218, 190, 116], poem: '金气秋分，风清露冷秋期半' },
  { name: '寒露', sky: [234, 238, 240], far: [188, 202, 204], mid: [118, 148, 148], near: [74, 106, 104], water: [88, 118, 116], sun: [208, 188, 130], poem: '袅袅凉风动，凄凄寒露零' },
  { name: '霜降', sky: [236, 238, 240], far: [190, 202, 200], mid: [120, 144, 140], near: [78, 106, 100], water: [90, 116, 110], sun: [210, 180, 120], poem: '霜叶红于二月花' },
  { name: '立冬', sky: [232, 236, 240], far: [182, 198, 202], mid: [110, 144, 150], near: [68, 102, 110], water: [80, 112, 122], sun: [202, 186, 132], poem: '细雨生寒未有霜，庭前木叶半青黄' },
  { name: '小雪', sky: [230, 234, 238], far: [178, 194, 200], mid: [104, 138, 148], near: [62, 96, 108], water: [74, 106, 120], sun: [198, 184, 134], poem: '晚来天欲雪，能饮一杯无' },
  { name: '大雪', sky: [228, 233, 240], far: [172, 190, 200], mid: [96, 132, 144], near: [56, 92, 106], water: [68, 100, 116], sun: [194, 182, 136], poem: '千山鸟飞绝，万径人踪灭' },
  { name: '冬至', sky: [226, 232, 240], far: [168, 188, 200], mid: [90, 128, 142], near: [52, 88, 104], water: [62, 96, 112], sun: [190, 180, 138], poem: '天时人事日相催，冬至阳生春又来' },
  { name: '小寒', sky: [230, 236, 242], far: [174, 192, 202], mid: [98, 134, 146], near: [58, 94, 108], water: [66, 98, 114], sun: [196, 186, 140], poem: '小寒连大吕，欢鹊垒新巢' },
  { name: '大寒', sky: [232, 238, 244], far: [180, 196, 206], mid: [104, 138, 150], near: [64, 98, 112], water: [72, 102, 118], sun: [200, 188, 144], poem: '大寒岁底庆团圆' },
]

const W = 1600
const H = 1000

function render(n) {
  const t = terms[n]
  const seed = n * 3251 + 77
  const noises = [makeNoise(seed), makeNoise(seed + 7), makeNoise(seed + 23), makeNoise(seed + 41)]
  const rnd = mulberry32(seed)
  const isWinter = n >= 18
  const horizon = 0.42 + rnd() * 0.1
  const sunX = 0.15 + rnd() * 0.7
  const sunY = 0.08 + rnd() * 0.12
  const pixels = new Uint8Array(W * H * 4)

  // 雪花（冬）/花瓣（春）/落叶（秋）
  const motes = []
  const moteCount = isWinter ? 220 : n < 6 ? 140 : n >= 12 && n < 18 ? 120 : 0
  for (let i = 0; i < moteCount; i++) {
    motes.push({ x: rnd() * W, y: rnd() * H, r: 1 + rnd() * 2.4, spd: 0.3 + rnd() * 1.2, drift: (rnd() - 0.5) * 0.8 })
  }

  const layers = [
    { depth: 0.18, color: t.far, yBase: horizon - 0.12, amp: 0.34 },
    { depth: 0.5, color: t.mid, yBase: horizon + 0.02, amp: 0.3 },
    { depth: 1.0, color: t.near, yBase: horizon + 0.22, amp: 0.26 },
  ]

  function heightField(x, y, depth) {
    const n1 = noises[0](x * 0.0022 + depth * 1.37, y * 0.004, 5)
    const n2 = noises[1](x * 0.0009, y * 0.002, 4)
    const ridge = Math.abs(n1 - 0.5) * 2
    return (n2 * 0.5 + 0.25) * (1 - depth * 0.75) + (1 - ridge) * depth * 0.75
  }

  for (let py = 0; py < H; py++) {
    const v = py / H
    for (let px = 0; px < W; px++) {
      const u = px / W
      let r, g, b

      // 天空
      const tt = v < horizon ? v / horizon : 1
      r = t.sky[0] * (1 - tt * 0.06)
      g = t.sky[1] * (1 - tt * 0.05)
      b = t.sky[2] * (1 - tt * 0.03)

      // 日/月
      const dsun = Math.sqrt((u - sunX) ** 2 + ((v - sunY) * (H / W)) ** 2)
      const glow = Math.max(0, 1 - dsun / 0.26) ** 2
      const disc = Math.max(0, 1 - dsun / 0.032)
      r += t.sun[0] * (glow * 0.4 + disc * 0.85)
      g += t.sun[1] * (glow * 0.35 + disc * 0.8)
      b += t.sun[2] * (glow * 0.25 + disc * 0.65)

      // 云
      if (v < horizon) {
        const cl = noises[2](u * 3 + rnd() * 0.001, v * 7, 4)
        const clMask = Math.max(0, (cl - 0.55) * 2.6) * Math.max(0, 1 - Math.abs(v - horizon * 0.45) * 3.4)
        r = r * (1 - clMask * 0.8) + 250 * clMask * 0.8
        g = g * (1 - clMask * 0.8) + 251 * clMask * 0.8
        b = b * (1 - clMask * 0.8) + 253 * clMask * 0.8
      }

      // 山
      for (let li = layers.length - 1; li >= 0; li--) {
        const L = layers[li]
        const hf = heightField(px, py, L.depth)
        const yBase = L.yBase - hf * L.amp * 0.4
        if (v > yBase) {
          const fade = Math.min(1, (v - yBase) / 0.5)
          // 冬季山头积雪
          let cr = L.color[0], cg = L.color[1], cb = L.color[2]
          if (isWinter && hf > 0.62) {
            const sn = (hf - 0.62) / 0.38
            cr = cr * (1 - sn) + 240 * sn
            cg = cg * (1 - sn) + 244 * sn
            cb = cb * (1 - sn) + 250 * sn
          }
          r = cr * (1 - fade * 0.4) + cr * 0.55 * fade * 0.4
          g = cg * (1 - fade * 0.4) + cg * 0.55 * fade * 0.4
          b = cb * (1 - fade * 0.4) + cb * 0.55 * fade * 0.4
          const air = (1 - L.depth) * 0.3
          r = r * (1 - air) + t.sky[0] * air
          g = g * (1 - air) + t.sky[1] * air
          b = b * (1 - air) + t.sky[2] * air
          break
        }
      }

      // 水
      const waterLine = horizon + 0.34
      if (v > waterLine) {
        const wt = (v - waterLine) / (1 - waterLine)
        const refl = noises[3](u * 2 + wt * 0.2, wt * 22, 3)
        const wave = 0.5 + 0.5 * Math.sin(u * 60 + wt * 40 + refl * 12)
        r = t.water[0] * (1 - wt * 0.5) * (0.9 + wave * 0.15)
        g = t.water[1] * (1 - wt * 0.5) * (0.9 + wave * 0.15)
        b = t.water[2] * (1 - wt * 0.5) * (0.9 + wave * 0.15)
        const dRef = Math.sqrt((u - sunX) ** 2 + ((v - (waterLine + 0.18)) * 1.4) ** 2)
        const shimmer = Math.max(0, 1 - dRef / 0.12) * (0.6 + refl * 0.5)
        r += t.sun[0] * shimmer * 0.5
        g += t.sun[1] * shimmer * 0.42
        b += t.sun[2] * shimmer * 0.3
      }

      // 雪花/花瓣/落叶
      for (const m of motes) {
        const mx = (m.x + m.drift * (py / H) * 220) % W
        const my = (m.y + m.spd * (py / H) * 300) % H
        const dx = px - mx
        const dy = py - my
        const d2 = dx * dx + dy * dy
        if (d2 < m.r * m.r * 2.6) {
          const fall = Math.max(0, 1 - Math.sqrt(d2) / (m.r * 1.6))
          const mc = isWinter ? [252, 253, 255] : n < 6 ? [246, 202, 212] : [222, 168, 90]
          r = r * (1 - fall * 0.85) + mc[0] * fall * 0.85
          g = g * (1 - fall * 0.85) + mc[1] * fall * 0.85
          b = b * (1 - fall * 0.85) + mc[2] * fall * 0.85
        }
      }

      const idx = (py * W + px) * 4
      pixels[idx] = Math.max(0, Math.min(255, r))
      pixels[idx + 1] = Math.max(0, Math.min(255, g))
      pixels[idx + 2] = Math.max(0, Math.min(255, b))
      pixels[idx + 3] = 255
    }
  }
  return { pixels, term: t }
}

const outDir = path.join(__dirname, '..', 'public', 'gallery')
fs.mkdirSync(outDir, { recursive: true })
let total = 0
for (let n = 0; n < 24; n++) {
  const { pixels, term } = render(n)
  const fp = path.join(outDir, `solar-${String(n + 1).padStart(2, '0')}.png`)
  const size = writePNG(fp, W, H, pixels)
  total += size
  console.log(`solar-${String(n + 1).padStart(2, '0')}.png  ${(size / 1024).toFixed(0)}KB  ${term.name}·${term.poem.split('，')[0]}…`)
}
console.log(`\ntotal: ${(total / 1024 / 1024).toFixed(2)}MB / 24 张`)
