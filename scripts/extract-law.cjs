// 从 celg.cn 法典阅读器页面提取全文：ARTS（条文对象）+ TOC（目录树）→ 结构化 JSON
// 用法：node scripts/extract-law.cjs
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, 'law-raw.html'), 'utf8')

// 括号配平扫描：从 `const NAME = ` 后第一个 { 或 [ 开始，找到配对结束符
function extractConst(name) {
  const key = `const ${name}`
  const at = html.indexOf(key)
  if (at < 0) return null
  const eq = html.indexOf('=', at + key.length)
  let i = eq + 1
  while (i < html.length && html[i] !== '{' && html[i] !== '[') i++
  const open = html[i]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let esc = false
  let quote = ''
  for (let j = i; j < html.length; j++) {
    const ch = html[j]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === quote) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") {
      inStr = true
      quote = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        const literal = html.slice(i, j + 1)
        try {
          return JSON.parse(literal)
        } catch (err) {
          throw new Error(`无法解析 ${name} 字面量：${err.message}`)
        }
      }
    }
  }
  return null
}

const artsObj = extractConst('ARTS')
const toc = extractConst('TOC')

if (!artsObj || !toc) {
  console.error('extract failed', { arts: !!artsObj, toc: !!toc })
  process.exit(1)
}

const nums = Object.keys(artsObj).map(Number).sort((a, b) => a - b)
const arts = nums.map((n) => ({ n, paras: artsObj[n] }))

// 目录树扁平化：建立每条所属 编/分编/章/节
const flat = []
function walk(nodes, trail) {
  for (const nd of nodes) {
    const t = [...trail, { l: nd.l, t: nd.t }]
    if (nd.r) {
      // 深层节点覆盖浅层：越具体的归属越优先
      for (let k = nd.r[0]; k <= nd.r[1]; k++) {
        flat[k] = t
      }
    }
    if (nd.c && nd.c.length) walk(nd.c, t)
  }
}
walk(toc, [])

const withCtx = arts.map((a) => {
  const trail = flat[a.n] || []
  return {
    n: a.n,
    book: (trail.find((x) => x.l.includes('编') && !x.l.includes('分编')) || {}).t || '',
    division: (trail.find((x) => x.l.includes('分编')) || {}).t || '',
    chapter: (trail.find((x) => x.l.includes('章')) || {}).t || '',
    section: (trail.find((x) => x.l.includes('节')) || {}).t || '',
    paras: a.paras,
  }
})

console.log(`条文数: ${withCtx.length}（应为 1242）`)
console.log(`首条: 第1条 ${withCtx[0].paras[0].slice(0, 40)}…`)
const last = withCtx[withCtx.length - 1]
console.log(`末条: 第${last.n}条 ${last.paras[0].slice(0, 56)}…`)
console.log(`归属样例: 第100条 → 编「${withCtx[99].book}」分编「${withCtx[99].division}」章「${withCtx[99].chapter}」节「${withCtx[99].section}」`)

const out = {
  arts: withCtx,
  toc,
  meta: {
    title: '中华人民共和国生态环境法典',
    articles: withCtx.length,
    source: '全文整理自公开发布文本（新华社受权播发 / celg.cn 法典阅读器）',
    extractedAt: new Date().toISOString(),
  },
}
const outPath = path.join(__dirname, '..', 'src', 'data', 'law-full.json')
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8')
console.log(`\n已写入 ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`)
