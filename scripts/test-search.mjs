// 检索引擎验收测试：node scripts/test-search.mjs
import fs from 'node:fs'
import path from 'node:path'
import { buildIndex, searchLaw, relatedArticles, parseRefs, cnToNum, numToCn } from '../src/search/engine.js'
import { buildSynonymMap, SCENE_PRESETS } from '../src/search/terms.js'

const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'law-code.json'), 'utf8'))
const syn = buildSynonymMap()

const t0 = Date.now()
const index = buildIndex(raw.arts)
const buildMs = Date.now() - t0

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}${extra ? '  ' + extra : ''}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${extra ? '  ' + extra : ''}`)
  }
}

console.log(`\n索引构建：${index.N} 条 / ${buildMs}ms / 平均条长 ${Math.round(index.avgLen)} 字\n`)

console.log('【1】中文数字转换')
ok('第五百七十 → 570', cnToNum('五百七十') === 570)
ok('一千零二十四 → 1024', cnToNum('一千零二十四') === 1024)
ok('一百二十三 → 123', cnToNum('一百二十三') === 123)
ok('numToCn(1242) → 一千二百四十二', numToCn(1242) === '一千二百四十二', `实际 "${numToCn(1242)}"`)

console.log('\n【2】基础检索')
for (const [q, expectMin] of [
  ['噪声', 5],
  ['光污染', 1],
  ['秸秆', 2],
  ['按日连续处罚', 1],
  ['公益诉讼', 1],
  ['生态保护红线', 1],
  ['碳排放', 3],
]) {
  const r = searchLaw(index, q, { syn, limit: 100 })
  ok(`「${q}」命中 ${r.total} 条`, r.total >= expectMin, `耗时 ${r.took}ms`)
}

console.log('\n【3】同义词扩展（生活语言 → 法条语言）')
const rNoise = searchLaw(index, '噪音', { syn, limit: 100 })
ok('搜「噪音」能命中（扩展为"噪声"）', rNoise.total > 0, `${rNoise.total} 条`)
const rGarbage = searchLaw(index, '垃圾', { syn, limit: 100 })
ok('搜「垃圾」命中（含"固体废物"）', rGarbage.total > 3, `${rGarbage.total} 条`)

console.log('\n【4】查询语法')
const rArt = searchLaw(index, '条:1242', { syn })
ok('条:1242 精确定位', rArt.total === 1 && rArt.hits[0].n === 1242)
const rRange = searchLaw(index, '条:100-110', { syn, limit: 100 })
ok('条:100-110 范围检索', rRange.total === 11, `${rRange.total} 条`)
const rBook = searchLaw(index, '编:绿色低碳 碳排放', { syn, limit: 100 })
ok(
  '编:绿色低碳 限定检索',
  rBook.total > 0 && rBook.hits.every((h) => h.book.includes('绿色低碳')),
  `${rBook.total} 条`,
)
const rEx = searchLaw(index, '噪声 -施工', { syn, limit: 200 })
const rNoiseAll = searchLaw(index, '噪声', { syn, limit: 200 })
ok('排除词 -施工 生效', rEx.total < rNoiseAll.total, `${rNoiseAll.total} → ${rEx.total} 条`)
const rPhrase = searchLaw(index, '"生态环境主管部门"', { syn, limit: 300 })
ok('精确短语检索', rPhrase.total > 20, `${rPhrase.total} 条`)
const rCn = searchLaw(index, '第一千二百四十二条', { syn })
ok('中文条号检索', rCn.total === 1 && rCn.hits[0].n === 1242)

console.log('\n【5】排序与相关性')
const rSort = searchLaw(index, '噪声', { syn, limit: 10 })
ok('相关度降序', rSort.hits.every((h, i, a) => i === 0 || a[i - 1].score >= h.score))
const rNum = searchLaw(index, '噪声', { syn, sort: 'number', limit: 10 })
ok('条号升序排序', rNum.hits.every((h, i, a) => i === 0 || a[i - 1].n < h.n))
ok('条号直达排第一', rArt.hits[0].n === 1242)

console.log('\n【6】摘要高亮与安全性')
const hit0 = rSort.hits[0]
ok('摘要含高亮标记', /<mark>/.test(hit0.snippet.html), hit0.snippet.html.slice(0, 56).replace(/\n/g, ' '))
ok('HTML 已转义（无裸标签注入）', !/<(?!\/?mark>)[a-z]/i.test(hit0.snippet.html.replace(/<\/?mark>/g, '')))
const rXss = searchLaw(index, '<script>', { syn })
ok('恶意查询不报错', Array.isArray(rXss.hits))

console.log('\n【7】命中分布与性能')
const rBig = searchLaw(index, '生态环境', { syn, limit: 10 })
ok('返回按编分布', rBig.byBook.length >= 3, JSON.stringify(rBig.byBook.slice(0, 3)))
const tPerf = Date.now()
for (let i = 0; i < 20; i++) searchLaw(index, '噪声 处罚 罚款', { syn, limit: 50 })
const avgMs = (Date.now() - tPerf) / 20
ok('20 次多词检索平均耗时 < 60ms', avgMs < 60, `平均 ${avgMs.toFixed(1)}ms`)

console.log('\n【8】交叉引用解析')
const a570 = raw.arts.find((a) => a.n === 570)
const segs = parseRefs(a570.paras.join('\n'))
ok('第570条解析出片断', segs.length >= 1, `片断 ${segs.length}`)
const a1242 = raw.arts.find((a) => a.n === 1242)
const segs1242 = parseRefs(a1242.paras.join('\n'))
const lawCount = segs1242.filter((s) => s.type === 'law').length
ok('第1242条识别出 10 部被废止法律', lawCount === 10, `${lawCount} 部`)

console.log('\n【9】相关条文推荐')
const rel = relatedArticles(index, 570, 5)
ok('第570条有相关条文推荐', rel.length === 5, rel.map((x) => `第${x.n}条`).join('、'))

console.log('\n【10】全部场景预设可用')
let presetsOk = 0
for (const p of SCENE_PRESETS) {
  const r = searchLaw(index, p.q, { syn, limit: 5 })
  if (r.total > 0) presetsOk++
  else console.log(`     ⚠️  预设「${p.name}」(${p.q}) 命中 0 条`)
}
ok(`${presetsOk}/${SCENE_PRESETS.length} 个场景预设命中`, presetsOk === SCENE_PRESETS.length)

console.log(`\n${'='.repeat(56)}\n通过 ${pass} 项 / 失败 ${fail} 项\n${'='.repeat(56)}\n`)
process.exit(fail ? 1 : 0)
