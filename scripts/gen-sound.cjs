// 程序化合成环境音：12 种音景 × N 变奏（默认 48 首 60 秒立体声 WAV）
// 零依赖：手写 WAV 编码 + 滤波 + 物理建模
// 用法示例：
//   node scripts/gen-sound.cjs                        # 桌面/交付：48 首 60s 44.1kHz 立体声（约 485MB）
//   node scripts/gen-sound.cjs --out=public-mobile/sounds --sr=22050 --dur=30 --mono --variants=1 --only=rain,stream,pinewind,bell
//                                                     # 移动端：4 首 30s 22.05kHz 单声道（约 5MB）
const fs = require('fs')
const path = require('path')

const argvEarly = process.argv.slice(2)
const earlyArg = (name, dflt) => {
  const hit = argvEarly.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const SR = parseInt(earlyArg('sr', '44100'), 10)
const DUR = parseInt(earlyArg('dur', '60'), 10)
const N = SR * DUR

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

// ---- 一维极简状态滤波器 ----
class LP {
  constructor(a) {
    this.a = a
    this.y = 0
  }
  run(x) {
    this.y += this.a * (x - this.y)
    return this.y
  }
}
class HP {
  constructor(a) {
    this.lp = new LP(a)
    this.prev = 0
  }
  run(x) {
    const l = this.lp.run(x)
    const out = x - l
    return out
  }
}

// 粉噪（Voss 简化）
function makePink(rnd) {
  const b = new Float64Array(7)
  return function () {
    const w = rnd()
    b[0] = 0.99886 * b[0] + w * 0.0555179
    b[1] = 0.98332 * b[1] + w * 0.0750759
    b[2] = 0.95003 * b[2] + w * 0.153852
    b[3] = 0.95998 * b[3] + w * 0.0990
    b[4] = 0.97017 * b[4] + w * 0.0476
    b[5] = 0.99332 * b[5] + w * 0.0660
    b[6] = 0.99425 * b[6] + w * 0.0294
    const pink = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.2116) / 3.6
    return pink * 0.11
  }
}

// ---- 音景生成器：输出 [0,1) 立体声采样（逐样本惰性，避免 OOM）----
// 每种音景实现 render(t, rnd, ctx) -> [L, R]

// 雨声：粉噪高通 + 随机雨滴敲击
function rain(v) {
  const rnd = mulberry32(1000 + v * 77)
  const pinkL = makePink(rnd)
  const pinkR = makePink(rnd)
  const hpL = new HP(0.72)
  const hpR = new HP(0.74)
  const drops = []
  for (let i = 0; i < DUR * (26 + v * 8); i++) {
    drops.push({ t: rnd() * DUR, pan: rnd() * 2 - 1, f: 900 + rnd() * 3200, dec: 0.012 + rnd() * 0.02, amp: 0.02 + rnd() * 0.06 })
  }
  drops.sort((a, b) => a.t - b.t)
  let di = 0
  const active = []
  return function (t) {
    while (di < drops.length && drops[di].t <= t) {
      active.push(drops[di])
      di++
    }
    let dl = 0
    let dr = 0
    for (let i = active.length - 1; i >= 0; i--) {
      const d = active[i]
      const age = t - d.t
      if (age > d.dec * 4) {
        active.splice(i, 1)
        continue
      }
      const env = Math.exp(-age / d.dec) * d.amp
      const s = Math.sin(2 * Math.PI * d.f * age) * env
      dl += s * (1 - Math.max(0, d.pan)) * 0.5
      dr += s * (1 + Math.min(0, d.pan)) * 0.5
    }
    const bedL = hpL.run(pinkL()) * (0.5 + v * 0.1)
    const bedR = hpR.run(pinkR()) * (0.5 + v * 0.1)
    return [bedL + dl, bedR + dr]
  }
}

// 溪流：粉噪低通 + 湍流幅度调制
function stream(v) {
  const rnd = mulberry32(2000 + v * 77)
  const pinkL = makePink(rnd)
  const pinkR = makePink(rnd)
  const lpL = new LP(0.18 + v * 0.02)
  const lpR = new LP(0.19 + v * 0.02)
  return function (t) {
    const mod = 0.6 + 0.4 * Math.sin(t * (0.8 + v * 0.25)) * Math.sin(t * 0.33 + v)
    return [lpL.run(pinkL()) * mod, lpR.run(pinkR()) * mod * 0.95]
  }
}

// 海浪：慢周期涌浪（粉噪低通 + 涌包络）
function waves(v) {
  const rnd = mulberry32(3000 + v * 77)
  const pinkL = makePink(rnd)
  const pinkR = makePink(rnd)
  const lpL = new LP(0.1 + v * 0.015)
  const lpR = new LP(0.105 + v * 0.015)
  const period = 7 + v * 1.7
  return function (t) {
    const ph = (t % period) / period
    const surge = Math.pow(Math.sin(ph * Math.PI), 1.6)
    const back = Math.pow(Math.sin(((ph + 0.5) % 1) * Math.PI), 3) * 0.35
    const env = surge * 0.8 + back
    return [lpL.run(pinkL()) * env * 1.5, lpR.run(pinkR()) * env * 1.45]
  }
}

// 松风：风穿过松针的啸声（带通噪声 + 缓慢起伏）
function pineWind(v) {
  const rnd = mulberry32(4000 + v * 77)
  const pink = makePink(rnd)
  const bp1 = new LP(0.22)
  const bp2 = new HP(0.4)
  const lpSlow = new LP(0.008 + v * 0.001)
  let gust = 0
  return function (t) {
    gust = lpSlow.run(0.5 + 0.5 * Math.sin(t * 0.21 + v * 3) + (rnd() - 0.5) * 0.2)
    const n = pink() * 4
    const band = bp2.run(bp1.run(n))
    const out = band * gust * 1.6
    return [out, out * 0.9]
  }
}

// 鸟鸣：白腹毛腿燕等音符（正弦调频 + 颤音）
function birds(v) {
  const rnd = mulberry32(5000 + v * 77)
  const songs = []
  for (let i = 0; i < DUR * 0.6; i++) {
    const start = rnd() * (DUR - 2)
    const notes = 2 + Math.floor(rnd() * 4)
    const base = 2200 + rnd() * 1800
    const chirps = []
    for (let j = 0; j < notes; j++) {
      chirps.push({ t0: j * (0.14 + rnd() * 0.1), f: base * (0.85 + rnd() * 0.4), dur: 0.05 + rnd() * 0.09, vib: rnd() > 0.5 ? 30 + rnd() * 40 : 0 })
    }
    songs.push({ start, pan: rnd() * 2 - 1, chirps, far: rnd() > 0.6 })
  }
  songs.sort((a, b) => a.start - b.start)
  let si = 0
  const active = []
  const forestBed = stream(v) // 底噪用溪流声
  return function (t) {
    while (si < songs.length && songs[si].start <= t) {
      active.push(songs[si])
      si++
    }
    let bl = 0
    let br = 0
    for (let i = active.length - 1; i >= 0; i--) {
      const s = active[i]
      if (t > s.start + 1.6) {
        active.splice(i, 1)
        continue
      }
      for (const c of s.chirps) {
        const ct = t - s.start - c.t0
        if (ct < 0 || ct > c.dur) continue
        const env = Math.sin((ct / c.dur) * Math.PI)
        let sig = Math.sin(2 * Math.PI * c.f * ct)
        if (c.vib) sig *= 1 + 0.25 * Math.sin(2 * Math.PI * c.vib * ct)
        const att = s.far ? 0.25 : 1
        bl += sig * env * 0.05 * att * (1 - Math.max(0, s.pan)) * 0.5
        br += sig * env * 0.05 * att * (1 + Math.min(0, s.pan)) * 0.5
      }
    }
    const [bl0, br0] = forestBed(t)
    return [bl0 * 0.45 + bl, br0 * 0.45 + br]
  }
}

// 夏夜虫鸣：纺织娘节奏脉冲（载波脉冲串）
function crickets(v) {
  const rnd = mulberry32(6000 + v * 77)
  const singers = []
  for (let i = 0; i < 7 + v * 2; i++) {
    singers.push({ rate: 3.4 + rnd() * 3.2, phase: rnd() * 100, pan: rnd() * 2 - 1, f: 4100 + rnd() * 900, amp: 0.03 + rnd() * 0.035, on: 0.4 + rnd() * 0.6, duty: 0.5 + rnd() * 0.4 })
  }
  const nightBed = cricketsNoiseBed(rnd)
  return function (t) {
    let l = 0
    let r = 0
    for (const s of singers) {
      const cyc = (t * s.rate + s.phase) % 1
      const window = (t % 60) / 60 < s.on ? 1 : 0.15
      if (cyc < s.duty * 0.5) {
        const sig = Math.sin(2 * Math.PI * s.f * t) * 0.6 + Math.sin(2 * Math.PI * s.f * 2.01 * t) * 0.3
        l += sig * s.amp * window * (1 - Math.max(0, s.pan)) * 0.5
        r += sig * s.amp * window * (1 + Math.min(0, s.pan)) * 0.5
      }
    }
    const [bl, br] = nightBed(t)
    return [l + bl, r + br]
  }
}
function cricketsNoiseBed(rnd) {
  const pink = makePink(rnd)
  const lp = new LP(0.02)
  return function () {
    const v = lp.run(pink()) * 0.7
    return [v, v]
  }
}

// 雷雨：远处雷声（低频冲击波）+ 密雨
function thunder(v) {
  const rnd = mulberry32(7000 + v * 77)
  const rainGen = rain(v)
  const strikes = []
  for (let i = 0; i < 3 + v; i++) {
    strikes.push({ t: 8 + rnd() * (DUR - 20), dur: 1.8 + rnd() * 2.2, pan: rnd() * 2 - 1, dist: rnd() })
  }
  strikes.sort((a, b) => a.t - b.t)
  let si = 0
  let active = []
  return function (t) {
    while (si < strikes.length && strikes[si].t <= t) {
      active.push(strikes[si])
      si++
    }
    let tl = 0
    let tr = 0
    for (let i = active.length - 1; i >= 0; i--) {
      const s = active[i]
      const age = t - s.t
      if (age > s.dur) {
        active.splice(i, 1)
        continue
      }
      const env = age < 0.3 ? age / 0.3 : Math.exp(-age / (s.dur * 0.4))
      const rumble = Math.sin(2 * Math.PI * (45 + s.dist * 30) * age) * 0.4 + Math.sin(2 * Math.PI * (67 + s.dist * 40) * age + 1.3) * 0.3
      const crackle = (rnd() - 0.5) * 0.25 * (1 - s.dist)
      const sig = (rumble + crackle) * env * (0.35 + s.dist * 0.4)
      tl += sig * (1 - Math.max(0, s.pan)) * 0.5
      tr += sig * (1 + Math.min(0, s.pan)) * 0.5
    }
    const [rl, rr] = rainGen(t)
    return [rl + tl, rr + tr]
  }
}

// 竹林：竹叶沙沙 + 风
function bamboo(v) {
  const rnd = mulberry32(8000 + v * 77)
  const windGen = pineWind(v)
  const leaves = []
  for (let i = 0; i < DUR * 30; i++) {
    leaves.push({ t: rnd() * DUR, pan: rnd() * 2 - 1, amp: (rnd() - 0.5) * 0.06 })
  }
  leaves.sort((a, b) => a.t - b.t)
  let li = 0
  return function (t) {
    while (li < leaves.length && leaves[li].t <= t) {
      li++
    }
    let s = 0
    for (let i = li - 1; i >= 0 && li - i < 20; i--) {
      const l = leaves[i]
      const age = t - l.t
      if (age < 0.05) s += l.amp * Math.exp(-age * 90)
    }
    const [wl, wr] = windGen(t)
    return [wl + s, wr - s * 0.6]
  }
}

// 湖畔：轻浪 + 偶尔水鸟
function lakeside(v) {
  const waveGen = waves(v)
  const birdGen = birds(v)
  return function (t) {
    const [wl, wr] = waveGen(t)
    const [bl, br] = birdGen(t)
    return [wl * 0.55 + bl * 0.4, wr * 0.55 + br * 0.4]
  }
}

// 空谷：远山回声（脉冲风声 + 回声尾）
function valley(v) {
  const rnd = mulberry32(9000 + v * 77)
  const windGen = pineWind(v)
  const echoes = []
  for (let i = 0; i < 6 + v * 2; i++) {
    echoes.push({ t: 5 + rnd() * (DUR - 10), f: 180 + rnd() * 600, pan: rnd() * 2 - 1 })
  }
  echoes.sort((a, b) => a.t - b.t)
  let ei = 0
  const active = []
  return function (t) {
    while (ei < echoes.length && echoes[ei].t <= t) {
      active.push(echoes[ei])
      ei++
    }
    let l = 0
    let r = 0
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i]
      const age = t - e.t
      if (age > 3) {
        active.splice(i, 1)
        continue
      }
      const env = Math.exp(-age * 1.4)
      const sig = Math.sin(2 * Math.PI * e.f * age * (1 + age * 0.2)) * env * 0.06
      l += sig * (1 - Math.max(0, e.pan)) * 0.5
      r += sig * (1 + Math.min(0, e.pan)) * 0.5
    }
    const [wl, wr] = windGen(t)
    return [wl * 0.6 + l, wr * 0.6 + r]
  }
}

// 落雪：极静的低鸣 + 雪压枝头的闷响
function snowfall(v) {
  const rnd = mulberry32(10000 + v * 77)
  const pink = makePink(rnd)
  const lp = new LP(0.012)
  const creaks = []
  for (let i = 0; i < 4 + v * 3; i++) {
    creaks.push({ t: rnd() * DUR, f: 140 + rnd() * 220, dur: 0.4 + rnd() * 0.8 })
  }
  creaks.sort((a, b) => a.t - b.t)
  let ci = 0
  const active = []
  return function (t) {
    while (ci < creaks.length && creaks[ci].t <= t) {
      active.push(creaks[ci])
      ci++
    }
    let c = 0
    for (let i = active.length - 1; i >= 0; i--) {
      const cr = active[i]
      const age = t - cr.t
      if (age > cr.dur) {
        active.splice(i, 1)
        continue
      }
      c += Math.sin(2 * Math.PI * cr.f * age * (1 + age * 0.05)) * Math.sin((age / cr.dur) * Math.PI) * 0.05
    }
    const bed = lp.run(pink()) * 1.6
    return [bed + c * 0.7, bed - c * 0.5]
  }
}

// 钟磬：古寺钟声 + 山风（泛音衰减 + 拍频）
function templeBell(v) {
  const rnd = mulberry32(11000 + v * 77)
  const windGen = pineWind(v)
  const bells = []
  const intervals = [0, 17, 34, 51]
  const base = 196 - v * 8
  for (let i = 0; i < intervals.length; i++) {
    bells.push({ t: 3 + intervals[i] + rnd() * 2, base, decay: 6 + rnd() * 3 })
  }
  const overtones = [1, 2.02, 2.94, 4.1, 5.43]
  let bi = 0
  const active = []
  return function (t) {
    while (bi < bells.length && bells[bi].t <= t) {
      active.push(bells[bi])
      bi++
    }
    let l = 0
    let r = 0
    for (let i = active.length - 1; i >= 0; i--) {
      const b = active[i]
      const age = t - b.t
      if (age > b.decay * 2) {
        active.splice(i, 1)
        continue
      }
      for (let o = 0; o < overtones.length; o++) {
        const f = b.base * overtones[o]
        const amp = (1 / (o + 1)) * Math.exp(-age / (b.decay / (1 + o * 0.3)))
        const sig = Math.sin(2 * Math.PI * f * age) * amp * 0.08
        l += sig
        r += sig * 0.96
      }
    }
    const [wl, wr] = windGen(t)
    return [l + wl * 0.4, r + wr * 0.38]
  }
}

// ---- WAV 写入（16bit，立体声或单声道）----
const MONO = argvEarly.includes('--mono')
function writeWav(fp, gen) {
  const ch = MONO ? 1 : 2
  const bps = ch * 2
  const dataSize = N * bps
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(ch, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * bps, 28)
  buf.writeUInt16LE(bps, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)

  let offset = 44
  // 淡入淡出
  const fade = Math.min(SR * 2, Math.floor(N / 8))
  for (let i = 0; i < N; i++) {
    const [l, r] = gen(i / SR)
    const lf = i < fade ? i / fade : i > N - fade ? (N - i) / fade : 1
    const li = Math.max(-1, Math.min(1, l * lf))
    if (MONO) {
      const ri = Math.max(-1, Math.min(1, r * lf))
      buf.writeInt16LE((((li + ri) / 2) * 32767) | 0, offset)
      offset += 2
    } else {
      const ri = Math.max(-1, Math.min(1, r * lf))
      buf.writeInt16LE((li * 32767) | 0, offset)
      buf.writeInt16LE((ri * 32767) | 0, offset + 2)
      offset += 4
    }
  }
  fs.writeFileSync(fp, buf)
  return 44 + dataSize
}

// ---- 编排 ----
// 命令行参数（可选）：
//   --out=<目录>        输出目录（默认 public/sounds）
//   --sr=<采样率>       默认 44100
//   --dur=<秒>          默认 60
//   --only=a,b,c        只生成指定音景
//   --variants=<数量>   每种音景的变奏数（默认 4）
//   --mono              单声道（移动端体积减半）
const argv = process.argv.slice(2)
const argOf = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const HAS_MONO = argv.includes('--mono')
const ONLY = argOf('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const VARIANTS = parseInt(argOf('variants', '4'), 10)

const scenes = [
  { id: 'rain', name: '细雨敲窗', gen: rain, desc: '雨点落在窗棂与叶面，粉噪雨幕渐密' },
  { id: 'stream', name: '空山溪涧', gen: stream, desc: '山涧奔流，水花拍打卵石的湍流' },
  { id: 'waves', name: '碧海听涛', gen: waves, desc: '涌浪周期推进，浪头碎成白沫' },
  { id: 'pinewind', name: '松岭长风', gen: pineWind, desc: '风过松针的啸响，忽远忽近的阵风' },
  { id: 'birds', name: '林间鸟语', gen: birds, desc: '晨光里的鸟鸣三重奏与溪流底噪' },
  { id: 'crickets', name: '夏夜虫鸣', gen: crickets, desc: '纺织娘的节奏脉冲，夏夜的合唱团' },
  { id: 'thunder', name: '远山雷雨', gen: thunder, desc: '雷声滚过山谷，雨势由疏到密' },
  { id: 'bamboo', name: '竹径沙沙', gen: bamboo, desc: '竹叶互相摩挲，风穿林而过的沙沙声' },
  { id: 'lakeside', name: '湖畔晨光', gen: lakeside, desc: '轻浪拍岸，水鸟掠过湖面' },
  { id: 'valley', name: '空谷回声', gen: valley, desc: '风声在山壁间往复，回声层层叠叠' },
  { id: 'snowfall', name: '雪落无声', gen: snowfall, desc: '极静的雪原，雪压枝头的闷响' },
  { id: 'bell', name: '山寺钟磬', gen: templeBell, desc: '古钟泛音悠长，与山风交织' },
]

const outDir = path.resolve(__dirname, '..', argOf('out', path.join('public', 'sounds')))
fs.mkdirSync(outDir, { recursive: true })

const picked = ONLY.length ? scenes.filter((s) => ONLY.includes(s.id)) : scenes
if (!picked.length) {
  console.error(`没有匹配的音景：--only=${ONLY.join(',')}`)
  process.exit(1)
}

const jobs = []
for (const s of picked) {
  for (let v = 0; v < VARIANTS; v++) {
    jobs.push({ scene: s, v })
  }
}

const CONCURRENCY = parseInt(argOf('jobs', '3'), 10)
let ji = 0
let total = 0

async function worker(wid) {
  while (ji < jobs.length) {
    const my = ji++
    const { scene, v } = jobs[my]
    const fp = path.join(outDir, `${scene.id}-v${v + 1}.wav`)
    if (fs.existsSync(fp) && fs.statSync(fp).size > 1000000) {
      console.log(`[w${wid}] skip ${path.basename(fp)}`)
      total += fs.statSync(fp).size
      continue
    }
    const size = writeWav(fp, scene.gen(v))
    total += size
    console.log(`[w${wid}] ${path.basename(fp)}  ${(size / 1024 / 1024).toFixed(2)}MB  《${scene.name}·变奏${v + 1}》`)
  }
}

;(async () => {
  const t0 = Date.now()
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)))
  console.log(`\n完成：${jobs.length} 首 / 共 ${(total / 1024 / 1024).toFixed(1)}MB / 用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
})()
