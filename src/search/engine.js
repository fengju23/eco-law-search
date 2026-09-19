// ============================================================================
// 生态环境法典检索引擎（纯函数，无 React 依赖，可单独测试）
//   · 归一化 + 全文倒排索引（字/二元组）
//   · 查询语法："精确短语" | -排除 | 条:570 | 条:100-200 | 编:污染防治 | 章:噪声
//   · BM25-lite 打分 + 短语加权 + 编章标题加权 + 条号直达
//   · 命中摘要（定位到原文位置并高亮）+ 命中按编分布
//   · 交叉引用解析（本法第X条 / 《某法》）+ 相关条文推荐
// ============================================================================

const DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const UNITS = { 十: 10, 百: 100, 千: 1000 }

/** 中文数字 → 阿拉伯数字（支持 一百二十三 / 一千零二十四） */
export function cnToNum(s) {
  let section = 0
  let num = 0
  for (const ch of s) {
    if (ch in DIGITS) num = DIGITS[ch]
    else if (ch in UNITS) {
      section += (num || 1) * UNITS[ch]
      num = 0
    }
  }
  return section + num
}

/** 归一化：去空白、全角字母数字转半角、拉丁转小写；同时记录归一化位置 → 原文位置映射 */
function normalizeWithMap(text) {
  let norm = ''
  const map = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\u3000') continue
    let c = ch
    const code = ch.charCodeAt(0)
    if (code >= 0xff01 && code <= 0xff5e) c = String.fromCharCode(code - 0xfee0)
    c = c.toLowerCase()
    norm += c
    map.push(i)
  }
  return { norm, map: Int32Array.from(map) }
}

export function normalize(s) {
  return normalizeWithMap(String(s || '')).norm
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** 把文本中出现的若干词打上 <mark>（先分片再转义，避免注入） */
export function highlightHtml(text, variants) {
  const found = []
  for (const v of variants) {
    if (!v) continue
    let i = text.indexOf(v)
    while (i >= 0) {
      found.push([i, i + v.length])
      i = text.indexOf(v, i + v.length)
    }
  }
  if (!found.length) return escapeHtml(text)
  found.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged = []
  for (const r of found) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  let out = ''
  let cur = 0
  for (const [s, e] of merged) {
    out += escapeHtml(text.slice(cur, s)) + '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>'
    cur = e
  }
  return out + escapeHtml(text.slice(cur))
}

// ============================================================================
// 索引构建
// ============================================================================
export function buildIndex(articles) {
  const docs = []
  const uni = new Map() // 单字 → doc 索引数组
  const bi = new Map() // 二元组 → doc 索引数组

  articles.forEach((a, di) => {
    const text = a.paras.join('\n')
    const { norm, map } = normalizeWithMap(text)
    const titleText = [a.book, a.division, a.chapter, a.section].filter(Boolean).join('')
    const uniqUni = new Set()
    const uniqBi = new Set()
    for (let i = 0; i < norm.length; i++) uniqUni.add(norm[i])
    for (let i = 0; i + 1 < norm.length; i++) uniqBi.add(norm.slice(i, i + 2))
    for (const c of uniqUni) {
      let arr = uni.get(c)
      if (!arr) uni.set(c, (arr = []))
      arr.push(di)
    }
    for (const g of uniqBi) {
      let arr = bi.get(g)
      if (!arr) bi.set(g, (arr = []))
      arr.push(di)
    }
    docs.push({
      n: a.n,
      book: a.book || '',
      division: a.division || '',
      chapter: a.chapter || '',
      section: a.section || '',
      titleNorm: normalize(titleText),
      text,
      norm,
      map,
      len: norm.length,
      paras: a.paras,
    })
  })

  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length)
  return { docs, uni, bi, avgLen, N: docs.length }
}

/** 某词命中的文档下标（先倒排取候选，再子串校验，保证精确） */
function docsContaining(index, v) {
  if (!v) return []
  let cand
  if (v.length === 1) {
    cand = index.uni.get(v) || []
  } else {
    cand = null
    for (let i = 0; i + 1 < v.length; i++) {
      const g = v.slice(i, i + 2)
      const arr = index.bi.get(g)
      if (!arr) return []
      if (cand === null) cand = new Set(arr)
      else {
        const next = new Set()
        for (const x of cand) if (arr.includes(x)) next.add(x)
        cand = next
        if (!cand.size) return []
      }
    }
    cand = cand ? [...cand] : []
  }
  return cand.filter((di) => index.docs[di].norm.includes(v))
}

function countOcc(text, v, cap = 30) {
  let c = 0
  let i = text.indexOf(v)
  while (i >= 0 && c < cap) {
    c++
    i = text.indexOf(v, i + v.length)
  }
  return c
}

// ============================================================================
// 查询解析
// ============================================================================
export function parseQuery(q, syn) {
  const terms = []
  const excludes = []
  const phrases = []
  const filters = { arts: [], books: [], chapters: [] }
  const raw = String(q || '').trim()
  const re = /"([^"]+)"|(\S+)/g
  let m
  while ((m = re.exec(raw)) !== null) {
    if (m[1] !== undefined) {
      const p = normalize(m[1])
      if (p) {
        phrases.push(p)
        terms.push(expand(p, syn))
      }
      continue
    }
    let tok = m[2]
    let neg = false
    if (tok.startsWith('-') && tok.length > 1) {
      neg = true
      tok = tok.slice(1)
    }
    const fm = tok.match(/^(条|编|章|节)[:：](.+)$/)
    if (fm) {
      if (fm[1] === '条') {
        const r = fm[2].match(/^(\d+)\s*[-~到]\s*(\d+)$/)
        if (r) filters.arts.push([+r[1], +r[2]])
        else if (/^\d+$/.test(fm[2])) filters.arts.push([+fm[2], +fm[2]])
      } else if (fm[1] === '编') filters.books.push(fm[2])
      else filters.chapters.push(fm[2])
      continue
    }
    // 第X条 / 第X条-第Y条
    const am = tok.match(/^第?([一二三四五六七八九十百千零〇\d]+)条?$/)
    if (am && /^[一二三四五六七八九十百千零〇\d]+$/.test(am[1])) {
      const num = /^\d+$/.test(am[1]) ? +am[1] : cnToNum(am[1])
      if (num >= 1 && num <= 1242) {
        filters.arts.push([num, num])
        continue
      }
    }
    const v = normalize(tok)
    if (!v) continue
    if (neg) excludes.push(expand(v, syn))
    else terms.push(expand(v, syn))
  }
  return { terms, excludes, phrases, filters, raw }
}

/** 同义词/术语扩展：返回该词的等价说法集合（含自身） */
function expand(term, syn) {
  const out = new Set([term])
  if (!syn) return [...out]
  const g = syn.get(term)
  if (g) for (const x of g) out.add(normalize(x))
  // 前缀式：未收录的较长词也尝试按组内词扩展（如"餐饮油烟"→"油烟"）
  if (!g) {
    for (const [k, vs] of syn) {
      if (k.length >= 2 && term.includes(k)) for (const x of vs) out.add(normalize(x))
    }
  }
  return [...out]
}

// ============================================================================
// 检索
// ============================================================================
export function searchLaw(index, query, opts = {}) {
  const { syn, sort = 'relevance', limit = 60, offset = 0 } = opts
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const { terms, excludes, phrases, filters } = parseQuery(query, syn)
  const { docs, N, avgLen } = index

  const passFilter = (d) => {
    if (filters.arts.length && !filters.arts.some(([a, b]) => d.n >= a && d.n <= b)) return false
    if (filters.books.length && !filters.books.some((bk) => d.book.includes(bk))) return false
    if (filters.chapters.length && !filters.chapters.some((c) => d.chapter.includes(c) || d.section.includes(c)))
      return false
    return true
  }

  // 各词族的候选文档集合（取交集）
  const famSets = []
  for (const fam of terms) {
    const s = new Set()
    for (const v of fam) for (const di of docsContaining(index, v)) s.add(di)
    famSets.push(s)
  }
  let cand
  if (!famSets.length) {
    cand = new Set()
    docs.forEach((d, di) => {
      if (passFilter(d)) cand.add(di)
    })
  } else {
    famSets.sort((a, b) => a.size - b.size)
    cand = new Set(famSets[0])
    for (let i = 1; i < famSets.length; i++) {
      const s = famSets[i]
      for (const x of [...cand]) if (!s.has(x)) cand.delete(x)
    }
  }

  const idfOf = (df) => Math.log(1 + (N - df + 0.5) / (df + 0.5))
  const hits = []
  const byBook = new Map()

  for (const di of cand) {
    const d = docs[di]
    if (!passFilter(d)) continue

    // 排除词
    let excluded = false
    for (const fam of excludes) {
      if (fam.some((v) => d.norm.includes(v))) {
        excluded = true
        break
      }
    }
    if (excluded) continue

    const k1 = 1.2
    const b = 0.62
    const norm = 1 - b + (b * d.len) / avgLen
    let score = 0
    const matched = []
    let bestFam = null

    for (const fam of terms) {
      let tf = 0
      let used = null
      for (const v of fam) {
        const c = countOcc(d.norm, v)
        if (c > 0 && (!used || v.length > used.length)) {
          used = v
          tf = Math.max(tf, c)
        }
      }
      if (!used) continue
      matched.push(used)
      const df = docsContaining(index, used).length || 1
      const idf = idfOf(df)
      score += (idf * (tf * (k1 + 1))) / (tf + k1 * norm)
      // 标题（编/章/节）加权
      if (d.titleNorm.includes(used)) score += idf * 1.5
      if (!bestFam || used.length > bestFam.length) bestFam = used
    }

    // 短语加权
    let phraseHit = false
    for (const p of phrases) {
      if (d.norm.includes(p)) {
        phraseHit = true
        const df = docsContaining(index, p).length || 1
        score += idfOf(df) * 2.5
      }
    }

    // 条号直达
    const exactArt = filters.arts.some(([a, bb]) => a === d.n && bb === d.n)
    if (exactArt) score += 500

    if (terms.length && !matched.length) continue

    const snippet = makeSnippet(d, [...matched, ...phrases])
    hits.push({
      n: d.n,
      score: Math.round(score * 1000) / 1000,
      book: d.book,
      division: d.division,
      chapter: d.chapter,
      section: d.section,
      snippet,
      matched,
      phraseHit,
      len: d.len,
      paras: d.paras,
    })
    byBook.set(d.book, (byBook.get(d.book) || 0) + 1)
  }

  if (sort === 'number' || !terms.length) hits.sort((a, b) => a.n - b.n)
  else hits.sort((a, b) => b.score - a.score || a.n - b.n)

  const took = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 10) / 10
  return {
    total: hits.length,
    hits: hits.slice(offset, offset + limit),
    byBook: [...byBook.entries()].sort((a, b) => b[1] - a[1]),
    took,
    parsed: { terms: terms.map((f) => f[0]), excludes: excludes.map((f) => f[0]), phrases, filters },
  }
}

/** 生成命中摘要：定位首个命中词，向两侧扩展，返回带 <mark> 的安全 HTML */
function makeSnippet(doc, variants, width = 46) {
  const clean = variants.filter(Boolean).sort((a, b) => b.length - a.length)
  let at = -1
  let hit = null
  for (const v of clean) {
    const i = doc.norm.indexOf(v)
    if (i >= 0 && (at < 0 || i < at)) {
      at = i
      hit = v
    }
  }
  if (at < 0) return { html: escapeHtml(doc.text.slice(0, 96)) + '…', at: 0 }
  const s = Math.max(0, at - width)
  const e = Math.min(doc.norm.length, at + hit.length + width)
  const oS = doc.map[s]
  const oE = doc.map[e - 1] + 1
  const raw = (s > 0 ? '…' : '') + doc.text.slice(oS, oE) + (e < doc.norm.length ? '…' : '')
  return { html: highlightHtml(raw, clean), at }
}

// ============================================================================
// 相关条文推荐（按二元组 idf 加权重合度）
// ============================================================================
export function relatedArticles(index, artNo, k = 6) {
  const target = index.docs.find((d) => d.n === artNo)
  if (!target) return []
  const scores = new Map()
  const seen = new Set()
  for (let i = 0; i + 1 < target.norm.length; i++) {
    const g = target.norm.slice(i, i + 2)
    if (seen.has(g)) continue
    seen.add(g)
    const arr = index.bi.get(g)
    if (!arr || arr.length > index.N * 0.25) continue // 过于常见的二元组不计分
    const idf = Math.log(1 + index.N / arr.length)
    for (const di of arr) {
      const d = index.docs[di]
      if (d.n === artNo) continue
      scores.set(di, (scores.get(di) || 0) + idf)
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([di, sc]) => ({
      n: index.docs[di].n,
      book: index.docs[di].book,
      chapter: index.docs[di].chapter,
      score: Math.round(sc * 10) / 10,
      preview: index.docs[di].text.slice(0, 54) + '…',
    }))
}

// ============================================================================
// 交叉引用解析
// ============================================================================
const REF_RE = /本法第([一二三四五六七八九十百千零〇\d]+)条/g
const LAW_RE = /《([^》]{2,40})》/g

export function parseRefs(text) {
  const segs = []
  const marks = []
  let m
  REF_RE.lastIndex = 0
  while ((m = REF_RE.exec(text)) !== null) {
    const n = /^\d+$/.test(m[1]) ? +m[1] : cnToNum(m[1])
    if (n >= 1 && n <= 1242) marks.push({ i: m.index, e: m.index + m[0].length, type: 'art', n, label: m[0] })
  }
  LAW_RE.lastIndex = 0
  while ((m = LAW_RE.exec(text)) !== null) {
    marks.push({ i: m.index, e: m.index + m[0].length, type: 'law', name: m[1], label: m[0] })
  }
  marks.sort((a, b) => a.i - b.i)
  let cur = 0
  for (const mk of marks) {
    if (mk.i < cur) continue
    if (mk.i > cur) segs.push({ type: 'text', v: text.slice(cur, mk.i) })
    segs.push(mk)
    cur = mk.e
  }
  if (cur < text.length) segs.push({ type: 'text', v: text.slice(cur) })
  return segs
}

/** 条文号 → 中文条号（用于展示与复制引用），支持到 9999 */
export function numToCn(n) {
  if (!n) return '零'
  const units = ['', '十', '百', '千']
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const str = String(n)
  const len = str.length
  let out = ''
  let zeroPending = false
  for (let i = 0; i < len; i++) {
    const d = +str[i]
    const unitIdx = len - 1 - i
    if (d === 0) {
      zeroPending = true
      continue
    }
    if (zeroPending && out) out += '零'
    zeroPending = false
    // "十二" 而非 "一十二"
    if (!(d === 1 && unitIdx === 1 && i === 0)) out += digits[d]
    out += units[unitIdx]
  }
  return out
}

/** 统计信息（首页/侧栏展示） */
export function indexStats(index) {
  const books = new Map()
  for (const d of index.docs) books.set(d.book, (books.get(d.book) || 0) + 1)
  const chars = index.docs.reduce((s, d) => s + d.text.length, 0)
  return { articles: index.N, books: [...books.entries()], chars }
}
