// 生成 Android 应用图标（天平衡器造型）：适配各密度的 ic_launcher / ic_launcher_round / ic_launcher_foreground
// 用法：node scripts/gen-app-icon.cjs
// 输出：android/app/src/main/res/mipmap-*/ 下的 PNG
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
function writePNG(fp, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      const d = y * (w * 4 + 1) + 1 + x * 4
      raw[d] = rgba[s]
      raw[d + 1] = rgba[s + 1]
      raw[d + 2] = rgba[s + 2]
      raw[d + 3] = rgba[s + 3]
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  fs.writeFileSync(fp, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]))
}

const GREEN_DARK = [27, 74, 54]
const GREEN_MID = [47, 122, 94]
const WHITE = [255, 255, 255]
const GOLD = [201, 162, 75]

/** 天平形状判定：返回该点在图形内属于哪一部分（0=外 1=白色主干 2=金色点缀） */
function scaleShape(x, y, cx, cy, s) {
  // 所有尺寸以 s（图标内图形边长）为基准，坐标已归一化到 [-0.5, 0.5] 的比例
  const px = (x - cx) / s
  const py = (y - cy) / s

  // 立柱
  if (Math.abs(px) <= 0.028 && py >= -0.06 && py <= 0.30) return 1
  // 底座
  if (Math.abs(px) <= 0.20 && py > 0.30 && py <= 0.37) return 1
  // 横梁
  if (Math.abs(px) <= 0.30 && py >= -0.20 && py <= -0.155) return 1
  // 顶部支点圆
  if (px * px + (py + 0.235) ** 2 <= 0.052 * 0.052) return 2
  // 立柱顶端连接
  if (Math.abs(px) <= 0.028 && py > -0.235 && py < -0.19) return 1

  // 左右吊线 + 吊盘
  for (const sgn of [-1, 1]) {
    const bx = sgn * 0.29
    // 吊线
    if (Math.abs(px - bx) <= 0.014 && py > -0.155 && py < 0.02) return 1
    // 吊盘（上宽下窄的梯形）
    const pw = 0.115
    const top = 0.02
    const bot = 0.115
    if (py >= top && py <= bot) {
      const t = (py - top) / (bot - top)
      const half = pw * (1 - 0.42 * t)
      if (Math.abs(px - bx) <= half) return 1
    }
  }
  return 0
}

function render(size, { round, foreground }) {
  const out = Buffer.alloc(size * size * 4)
  const SS = 3 // 3x3 超采样抗锯齿
  const cx = size / 2
  const cy = size / 2
  const inner = foreground ? size * 0.62 : size * 0.78 // 前景层留安全边距
  const rCorner = size * 0.22

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0
      let gSum = 0
      let bSum = 0
      let aSum = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS
          const fy = y + (sy + 0.5) / SS
          let r = 0
          let g = 0
          let b = 0
          let a = 0

          // 背景层（自适应图标的前景层不含背景）
          let inBg = false
          if (!foreground) {
            if (round) {
              const dx = fx - cx
              const dy = fy - cy
              inBg = dx * dx + dy * dy <= (size / 2 - size * 0.02) ** 2
            } else {
              // 圆角方形
              const dx = Math.max(Math.abs(fx - cx) - (size / 2 - rCorner), 0)
              const dy = Math.max(Math.abs(fy - cy) - (size / 2 - rCorner), 0)
              inBg = dx * dx + dy * dy <= rCorner * rCorner
            }
          }
          if (inBg) {
            const t = fy / size
            r = GREEN_DARK[0] + (GREEN_MID[0] - GREEN_DARK[0]) * t
            g = GREEN_DARK[1] + (GREEN_MID[1] - GREEN_DARK[1]) * t
            b = GREEN_DARK[2] + (GREEN_MID[2] - GREEN_DARK[2]) * t
            a = 255
          }

          // 天平图形
          const part = scaleShape(fx, fy, cx, cy, inner)
          if (part > 0) {
            const col = part === 2 ? GOLD : WHITE
            r = col[0]
            g = col[1]
            b = col[2]
            a = 255
          }

          rSum += r
          gSum += g
          bSum += b
          aSum += a
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      out[i] = Math.round(rSum / n)
      out[i + 1] = Math.round(gSum / n)
      out[i + 2] = Math.round(bSum / n)
      out[i + 3] = Math.round(aSum / n)
    }
  }
  return out
}

const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res')
const DENSITIES = [
  { dir: 'mipmap-mdpi', launcher: 48, fg: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, fg: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, fg: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, fg: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, fg: 432 },
]

let count = 0
for (const d of DENSITIES) {
  const dir = path.join(RES, d.dir)
  if (!fs.existsSync(dir)) {
    console.log(`跳过（不存在）: ${d.dir}`)
    continue
  }
  writePNG(path.join(dir, 'ic_launcher.png'), d.launcher, d.launcher, render(d.launcher, { round: false }))
  writePNG(path.join(dir, 'ic_launcher_round.png'), d.launcher, d.launcher, render(d.launcher, { round: true }))
  writePNG(path.join(dir, 'ic_launcher_foreground.png'), d.fg, d.fg, render(d.fg, { foreground: true }))
  count += 3
  console.log(`${d.dir}: launcher ${d.launcher}px / foreground ${d.fg}px`)
}
console.log(`\n共生成 ${count} 个图标文件`)
