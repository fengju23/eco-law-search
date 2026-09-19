// 把 docs/*.md 转成自包含的带样式 HTML（手机可直接打开阅读）
// 用法：node scripts/md-to-html.cjs
// 支持：标题 / 段落 / 表格 / 列表 / 代码块 / 引用 / 分隔线 / 行内 **粗体** 与 `代码`
const fs = require('fs')
const path = require('path')

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(s) {
  let out = esc(s)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  return out
}

function slug(s, i) {
  const base = s.replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
  return `h-${base || 'sec'}-${i}`
}

function convert(md) {
  const lines = md.split(/\r?\n/)
  const body = []
  const toc = []
  let i = 0
  let h2 = 0
  let listType = null // 'ul' | 'ol'

  const closeList = () => {
    if (listType) {
      body.push(`</${listType}>`)
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    if (line.trim().startsWith('```')) {
      closeList()
      const buf = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++
      body.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`)
      continue
    }

    // 表格
    if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList()
      const head = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i++
      }
      body.push('<div class="tw"><table>')
      body.push('<thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>')
      body.push('<tbody>')
      for (const r of rows) {
        body.push('<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>')
      }
      body.push('</tbody></table></div>')
      continue
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      closeList()
      const level = h[1].length
      const text = h[2].trim()
      if (level === 2) {
        const id = slug(text, h2++)
        toc.push({ id, text })
        body.push(`<h2 id="${id}">${inline(text)}</h2>`)
      } else {
        body.push(`<h${level}>${inline(text)}</h${level}>`)
      }
      i++
      continue
    }

    // 分隔线
    if (/^\s*---+\s*$/.test(line)) {
      closeList()
      body.push('<hr/>')
      i++
      continue
    }

    // 引用
    if (/^\s*>/.test(line)) {
      closeList()
      const buf = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      body.push(`<blockquote>${buf.map((b) => inline(b)).join('<br/>')}</blockquote>`)
      continue
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList()
        body.push('<ul>')
        listType = 'ul'
      }
      body.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
      i++
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== 'ol') {
        closeList()
        body.push('<ol>')
        listType = 'ol'
      }
      body.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
      i++
      continue
    }

    // 空行
    if (!line.trim()) {
      closeList()
      i++
      continue
    }

    // 段落
    closeList()
    const buf = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|\s*>|\s*\|)/.test(lines[i]) && !lines[i].trim().startsWith('```')) {
      buf.push(lines[i].trim())
      i++
    }
    body.push(`<p>${inline(buf.join(' '))}</p>`)
  }
  closeList()
  return { html: body.join('\n'), toc }
}

const TEMPLATE = (title, toc, content) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(title)}</title>
<style>
  :root{
    --bg:#f7faf8; --card:#fff; --ink:#1f2d27; --ink2:#55685f; --ink3:#8b9c94;
    --line:#e4ece7; --green900:#1b4a36; --green700:#2f7a5e; --green500:#4a9d78;
    --green100:#e8f5ee; --mark:#ffe9a8; --code:#f3f7f4;
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#131a17; --card:#1a231f; --ink:#e6efe9; --ink2:#a9b8b1; --ink3:#7b8a84;
      --line:#2b3733; --green900:#b9e0cb; --green700:#7fc3a2; --green500:#5fae89;
      --green100:#22302b; --code:#1e2925; --mark:#6b5416; }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
    font-size:16.5px;line-height:1.95;-webkit-text-size-adjust:100%;
    text-rendering:optimizeLegibility}
  .wrap{max-width:820px;margin:0 auto;padding:20px 16px 64px}
  header.doc{background:linear-gradient(145deg,var(--green900),var(--green700));color:#fff;
    border-radius:18px;padding:26px 26px 22px;margin-bottom:18px}
  header.doc h1{margin:0;font-size:23px;letter-spacing:1.5px;font-family:"STKaiti","KaiTi",serif;line-height:1.5}
  header.doc p{margin:8px 0 0;font-size:13.5px;opacity:.92;line-height:1.7}
  nav.toc{background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:16px 20px;margin-bottom:18px}
  nav.toc strong{display:block;font-size:14px;color:var(--green700);margin-bottom:10px}
  nav.toc a{display:inline-block;margin:4px 12px 4px 0;font-size:14px;color:var(--ink2);
    text-decoration:none;border-bottom:1px dashed var(--line);line-height:2}
  nav.toc a:active{color:var(--green700)}
  main{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 24px 34px}
  h1{font-size:21px;color:var(--green900);margin:30px 0 12px;line-height:1.5}
  h2{font-size:19.5px;color:var(--green900);margin:38px 0 14px;padding-bottom:10px;
    border-bottom:2px solid var(--green100);line-height:1.5}
  h3{font-size:17px;color:var(--green700);margin:26px 0 10px;line-height:1.5}
  h4{font-size:16px;color:var(--ink);margin:20px 0 8px;line-height:1.5}
  h2:first-child,h1:first-child{margin-top:6px}
  p{margin:12px 0;font-size:16px;line-height:1.95}
  ul,ol{margin:12px 0 12px 22px;padding:0}
  li{margin:7px 0;font-size:16px;line-height:1.9}
  code{background:var(--code);border:1px solid var(--line);border-radius:6px;
    padding:2px 7px;font-size:14.5px;font-family:ui-monospace,Consolas,monospace}
  pre{background:var(--code);border:1px solid var(--line);border-radius:14px;
    padding:16px;overflow-x:auto;margin:14px 0}
  pre code{background:none;border:none;padding:0;font-size:14px;line-height:1.85}
  blockquote{margin:14px 0;padding:14px 20px;background:var(--green100);
    border-left:4px solid var(--green500);border-radius:0 12px 12px 0;color:var(--ink2);
    font-size:15.5px;line-height:1.9}
  hr{border:none;border-top:1px dashed var(--line);margin:30px 0}
  .tw{overflow-x:auto;margin:16px 0;-webkit-overflow-scrolling:touch}
  table{border-collapse:collapse;width:100%;min-width:400px;font-size:15px}
  th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;line-height:1.75}
  th{background:var(--green100);color:var(--green900);font-weight:700;white-space:nowrap}
  tr:nth-child(even) td{background:var(--code)}
  strong{color:var(--green900)}
  footer{margin-top:24px;text-align:center;font-size:13px;color:var(--ink3);line-height:2}
</style>
</head>
<body>
<div class="wrap">
<header class="doc">
  <h1>生态环境法典检索 · 使用说明书</h1>
  <p>版本 1.0 ｜ 适用于 Android App（APK）与网页版</p>
</header>
<nav class="toc"><strong>目录</strong>${toc.map((t) => `<a href="#${t.id}">${esc(t.text)}</a>`).join('')}</nav>
<main>
${content}
</main>
<footer>
  本说明书随应用一同发布 · 全文数据整理自公开发布文本，仅供普法学习参考<br/>
  扰民问题请拨打 12345 / 12369
</footer>
</div>
</body>
</html>
`

const docsDir = path.join(__dirname, '..', 'docs')
fs.mkdirSync(docsDir, { recursive: true })

const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'))
if (!files.length) {
  console.error('docs/ 下没有 .md 文件')
  process.exit(1)
}

for (const f of files) {
  const md = fs.readFileSync(path.join(docsDir, f), 'utf8')
  const title = (md.match(/^#\s+(.+)$/m) || [, f.replace(/\.md$/, '')])[1]
  const { html, toc } = convert(md)
  const out = path.join(docsDir, f.replace(/\.md$/, '.html'))
  fs.writeFileSync(out, TEMPLATE(title, toc, html), 'utf8')
  const kb = (fs.statSync(out).size / 1024).toFixed(0)
  console.log(`${f}  ->  ${path.basename(out)}  ${kb}KB  （章节导航 ${toc.length} 项）`)
}
