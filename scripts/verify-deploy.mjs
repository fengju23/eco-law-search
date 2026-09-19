// 部署冒烟测试：校验线上站点可访问性与关键资源
// 用法：node scripts/verify-deploy.mjs [基础地址]
// 默认校验 GitHub Pages 线上地址
const BASE = (process.argv[2] || 'https://fengju23.github.io/eco-law-search/').replace(/\/?$/, '/')
const ORIGIN = new URL(BASE).origin

/** 把页面里的资源引用解析成绝对 URL（绝对路径按站点根解析，相对路径按 BASE 解析） */
function resolveAsset(ref) {
  if (/^https?:\/\//.test(ref)) return ref
  return ref.startsWith('/') ? ORIGIN + ref : new URL(ref, BASE).href
}

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`)
  ok ? pass++ : fail++
}

async function head(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      const len = r.headers.get('content-length')
      return { ok: r.ok, status: r.status, len: len ? Number(len) : null }
    } catch (e) {
      if (i === tries) return { ok: false, status: 0, err: e.message }
      await new Promise((res) => setTimeout(res, 2000 * i))
    }
  }
}

async function getText(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      return { ok: r.ok, status: r.status, text: await r.text() }
    } catch (e) {
      if (i === tries) return { ok: false, status: 0, text: '', err: e.message }
      await new Promise((res) => setTimeout(res, 2000 * i))
    }
  }
}

console.log(`\n校验目标：${BASE}\n`)

console.log('【1】首页')
const home = await getText(BASE)
const html = home.text
check('首页可访问', home.ok, `HTTP ${home.status}`)
check('标题为应用名', html.includes('生态环境法典'), (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '未找到 title')
check('子路径资源引用正确', html.includes('/eco-law-search/assets/') || /(src|href)="\.?\/?assets\//.test(html))

console.log('\n【2】页面引用的资源')
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])
if (!assets.length) check('解析出资源引用', false, '未找到 js/css 引用')
for (const a of assets) {
  const url = resolveAsset(a)
  const r = await head(url)
  check(`资源 ${a}`, r.ok, `HTTP ${r.status}${r.len ? ' / ' + Math.round(r.len / 1024) + 'KB' : ''}`)
}

console.log('\n【3】核心数据与素材')
const data = await head(BASE + 'data/law-code.json')
check('法典全文数据', data.ok, `HTTP ${data.status}${data.len ? ' / ' + Math.round(data.len / 1024) + 'KB' : ''}`)

const audio = await head(BASE + 'sounds/rain-v1.wav')
check('背景音素材', audio.ok, `HTTP ${audio.status}${audio.len ? ' / ' + Math.round(audio.len / 1024) + 'KB' : ''}`)

console.log('\n【4】深链路由（hash 路由不应 404）')
const deep = await head(BASE + '#/a/570')
check('条文深链可访问', deep.ok, `HTTP ${deep.status}`)

console.log(`\n${'='.repeat(50)}\n通过 ${pass} 项 / 失败 ${fail} 项\n${'='.repeat(50)}\n`)
process.exit(fail ? 1 : 0)
