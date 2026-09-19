// 程序化生成宣纸/绢帛质感纹理 PNG（供前端叠加书法格言展示）
// 用法：node scripts/gen-paper.cjs
// 输出：public/gallery/paper-XX.png（30 张 1600x1000）
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
    let amp = 1
    let freq = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      const xi = Math.floor(x * freq) % size
      const yi = Math.floor(y * freq) % size
      const xf = x * freq - Math.floor(x * freq)
      const yf = y * freq - Math.floor(y * freq)
      const x0 = ((xi % size) + size) % size
      const y0 = ((yi % size) + size) % size
      const x1 = (x0 + 1) % size
      const y1 = (y0 + 1) % size
      const sx = smooth(xf)
      const sy = smooth(yf)
      const v =
        (grid[y0 * size + x0] * (1 - sx) + grid[y0 * size + x1] * sx) * (1 - sy) +
        (grid[y1 * size + x0] * (1 - sx) + grid[y1 * size + x1] * sx) * sy
      sum += v * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}

// 30 种纸色：宣纸米白、绢帛浅金、竹纸青灰、檀皮玉色、洒金笺……
const papers = [
  { name: '宣纸·云母白', base: [244, 240, 230], fiber: [214, 205, 185], ink: [92, 96, 88] },
  { name: '绢帛·麦浪黄', base: [238, 226, 197], fiber: [208, 190, 148], ink: [110, 90, 50] },
  { name: '竹纸·湘妃青', base: [231, 236, 226], fiber: [196, 208, 190], ink: [80, 96, 82] },
  { name: '檀皮·玉版色', base: [242, 238, 231], fiber: [216, 209, 194], ink: [96, 92, 84] },
  { name: '洒金笺·暖霞', base: [240, 228, 214], fiber: [214, 192, 168], ink: [130, 96, 70] },
  { name: '虎皮宣·绛红', base: [235, 224, 218], fiber: [200, 170, 160], ink: [120, 80, 70] },
]

const W = 1600
const H = 1000

function render(n) {
  const p = papers[n % papers.length]
  const seed = n * 6151 + 37
  const fib = makeNoise(seed)
  const grain = makeNoise(seed + 5)
  const blotch = makeNoise(seed + 11)
  const rnd = mulberry32(seed)
  const pixels = new Uint8Array(W * H * 4)

  // 洒金点
  const goldDots = []
  const dotCount = 120 + Math.floor(rnd() * 160)
  for (let i = 0; i < dotCount; i++) {
    goldDots.push({ x: rnd() * W, y: rnd() * H, r: 1 + rnd() * 3.2, a: 0.25 + rnd() * 0.5 })
  }
  // 纤维丝（长曲线）
  const fibers = []
  for (let i = 0; i < 60; i++) {
    fibers.push({ x: rnd() * W, y: rnd() * H, len: 40 + rnd() * 160, ang: (rnd() - 0.5) * 0.8, a: 0.1 + rnd() * 0.2 })
  }

  const gold = [201, 162, 75]

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const u = px / W
      const v = py / H

      // 基底
      let r = p.base[0]
      let g = p.base[1]
      let b = p.base[2]

      // 大块晕染（陈年色斑）
      const bl = blotch(u * 1.4, v * 2.2, 4)
      const blm = Math.max(0, (bl - 0.5)) * 0.22
      r = r * (1 - blm) + p.fiber[0] * blm
      g = g * (1 - blm) + p.fiber[1] * blm
      b = b * (1 - blm) + p.fiber[2] * blm

      // 纤维纹理（高频）
      const f = fib(u * 22, v * 40, 3)
      const fm = (f - 0.5) * 0.16
      r += p.fiber[0] * fm - p.base[0] * fm * 0.5
      g += p.fiber[1] * fm - p.base[1] * fm * 0.5
      b += p.fiber[2] * fm - p.base[2] * fm * 0.5

      // 细颗粒
      const gr = (grain(px * 0.05, py * 0.05, 2) - 0.5) * 10
      r += gr
      g += gr
      b += gr

      // 边缘暗角（旧纸感）
      const dx = (u - 0.5) * 2
      const dy = (v - 0.5) * 2
      const vig = 1 - Math.min(1, (dx * dx + dy * dy) * 0.35)
      r *= 0.86 + vig * 0.14
      g *= 0.86 + vig * 0.14
      b *= 0.84 + vig * 0.16

      // 洒金点
      for (const d of goldDots) {
        const ddx = px - d.x
        const ddy = py - d.y
        const dist2 = ddx * ddx + ddy * ddy
        if (dist2 < d.r * d.r * 4) {
          const fall = Math.max(0, 1 - Math.sqrt(dist2) / (d.r * 2))
          r = r * (1 - d.a * fall) + gold[0] * d.a * fall
          g = g * (1 - d.a * fall) + gold[1] * d.a * fall
          b = b * (1 - d.a * fall) + gold[2] * d.a * fall
        }
      }

      // 纤维丝（近似短线）
      for (const fbr of fibers) {
        const t = ((px - fbr.x) * Math.cos(fbr.ang) + (py - fbr.y) * Math.sin(fbr.ang)) / fbr.len
        if (t > 0 && t < 1) {
          const perp = Math.abs(-(px - fbr.x) * Math.sin(fbr.ang) + (py - fbr.y) * Math.cos(fbr.ang))
          if (perp < 1.4) {
            const a = fbr.a * (1 - t)
            r = r * (1 - a) + p.fiber[0] * a
            g = g * (1 - a) + p.fiber[1] * a
            b = b * (1 - a) + p.fiber[2] * a
          }
        }
      }

      const idx = (py * W + px) * 4
      pixels[idx] = Math.max(0, Math.min(255, r))
      pixels[idx + 1] = Math.max(0, Math.min(255, g))
      pixels[idx + 2] = Math.max(0, Math.min(255, b))
      pixels[idx + 3] = 255
    }
  }
  return { pixels, name: p.name }
}

const outDir = path.join(__dirname, '..', 'public', 'gallery')
fs.mkdirSync(outDir, { recursive: true })

let total = 0
for (let n = 0; n < 30; n++) {
  const { pixels, name } = render(n)
  const fp = path.join(outDir, `paper-${String(n + 1).padStart(2, '0')}.png`)
  const size = writePNG(fp, W, H, pixels)
  total += size
  console.log(`paper-${String(n + 1).padStart(2, '0')}.png  ${(size / 1024).toFixed(0)}KB  ${name}`)
}
console.log(`\ntotal: ${(total / 1024 / 1024).toFixed(2)}MB / 30 张`)
