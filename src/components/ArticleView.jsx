import { useEffect, useMemo, useRef, useState } from 'react'
import { highlightHtml, numToCn, parseRefs, relatedArticles } from '../search/engine.js'
import { GLOSSARY, REPEALED_LAWS } from '../search/terms.js'

/** 条文阅读视图 */
export default function ArticleView({ article, index, prefs, set, toggleFav, onOpen, onBack, highlightTerms }) {
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState('')
  const [jump, setJump] = useState('')
  const [showRelated, setShowRelated] = useState(true)
  const bodyRef = useRef(null)
  const ttsRef = useRef(null) // 惰性加载的 TTS 插件模块

  const related = useMemo(
    () => (index && article && showRelated ? relatedArticles(index, article.n, 6) : []),
    [index, article, showRelated],
  )

  const isFav = prefs.favs.includes(article.n)

  // 朗读：优先原生 TTS（Android WebView 不支持 speechSynthesis），回退 Web Speech，再回退提示
  const stopSpeak = async () => {
    try {
      const m = ttsRef.current || (ttsRef.current = import('@capacitor-community/text-to-speech'))
      const mod = await m
      await mod.TextToSpeech.stop()
    } catch {
      /* 插件不可用则忽略 */
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const speak = async () => {
    if (speaking) {
      await stopSpeak()
      return
    }
    const text = `中华人民共和国生态环境法典 第${numToCn(article.n)}条。${article.paras.join(' ')}`
    setSpeaking(true)

    // 1) 原生 / 插件（Web 端该插件内部也用 SpeechSynthesis）
    try {
      const m = ttsRef.current || (ttsRef.current = import('@capacitor-community/text-to-speech'))
      const { TextToSpeech } = await m
      await TextToSpeech.stop()
      await TextToSpeech.speak({ text, lang: 'zh-CN', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'ambient' })
      setSpeaking(false)
      return
    } catch {
      /* 落到下一步 */
    }

    // 2) 浏览器语音合成
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      u.rate = 1
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
      return
    }

    // 3) 都不支持
    setSpeaking(false)
    setCopied('当前环境不支持朗读')
    setTimeout(() => setCopied(''), 1800)
  }

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      if (ttsRef.current) {
        ttsRef.current
          .then((m) => m.TextToSpeech.stop())
          .catch(() => {})
      }
    }
  }, [article?.n])

  const copy = async (what) => {
    const cite = `《中华人民共和国生态环境法典》第${numToCn(article.n)}条`
    const text = what === 'cite' ? cite : `${cite}\n${article.paras.join('\n')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what === 'cite' ? '已复制引用' : '已复制条文')
    } catch {
      setCopied('复制失败，请手动选择')
    }
    setTimeout(() => setCopied(''), 1600)
  }

  const doJump = () => {
    const n = parseInt(jump, 10)
    if (n >= 1 && n <= 1242) {
      onOpen(n)
      setJump('')
    }
  }

  const glossaryMap = useMemo(() => {
    const m = new Map()
    for (const g of GLOSSARY) {
      const key = g.term.split(' / ')[0]
      m.set(key, g)
    }
    return m
  }, [])

  // 段落渲染：交叉引用可点击 + 命中词高亮 + 术语悬浮解释
  const renderPara = (text, key) => {
    const segs = parseRefs(text)
    return (
      <p key={key} ref={key === 0 ? bodyRef : undefined}>
        {segs.map((s, i) => {
          if (s.type === 'art') {
            return (
              <button key={i} className="ref-art" onClick={() => onOpen(s.n)} title={`跳转到第${numToCn(s.n)}条`}>
                {s.label}
              </button>
            )
          }
          if (s.type === 'law') {
            const repealed = REPEALED_LAWS.includes(s.name)
            return (
              <span key={i} className={`ref-law ${repealed ? 'repealed' : ''}`} title={repealed ? '该法已被本法典整合废止' : '外部法律'}>
                {s.label}
                {repealed && <em>已废止</em>}
              </span>
            )
          }
          // 普通文本：术语悬浮 + 关键词高亮
          let html = highlightTerms && highlightTerms.length ? highlightHtml(s.v, highlightTerms) : highlightHtml(s.v, [])
          for (const [term, g] of glossaryMap) {
            if (s.v.includes(term) && !html.includes('data-term')) {
              html = html.replace(term, `<span class="term" title="${g.def.replace(/"/g, '&quot;')}">${term}</span>`)
            }
          }
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        })}
      </p>
    )
  }

  return (
    <div className="art-view">
      <div className="art-bar">
        <button className="art-back" onClick={onBack}>
          ← 返回
        </button>
        <div className="art-nav">
          <button disabled={article.n <= 1} onClick={() => onOpen(article.n - 1)}>
            ← 上一条
          </button>
          <input
            className="art-jump"
            value={jump}
            placeholder="条号"
            inputMode="numeric"
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doJump()}
          />
          <button disabled={article.n >= 1242} onClick={() => onOpen(article.n + 1)}>
            下一条 →
          </button>
        </div>
        <div className="art-tools">
          <button className={isFav ? 'on' : ''} onClick={() => toggleFav(article.n)} title="收藏本条">
            {isFav ? '⭐' : '☆'}
          </button>
          <button onClick={() => copy('cite')} title="复制规范引用">
            📋
          </button>
          <button onClick={() => copy('full')} title="复制条文全文">
            📄
          </button>
          <button className={speaking ? 'on' : ''} onClick={speak} title="朗读本条">
            {speaking ? '⏹' : '🔊'}
          </button>
          <div className="art-font">
            <button onClick={() => set({ fontSize: Math.max(13, prefs.fontSize - 1) })} title="减小字号">
              A−
            </button>
            <button onClick={() => set({ fontSize: Math.min(24, prefs.fontSize + 1) })} title="增大字号">
              A+
            </button>
          </div>
        </div>
      </div>

      {copied && <div className="art-toast">{copied}</div>}

      <article className="art-paper">
        <header className="art-head">
          <h2>第{numToCn(article.n)}条</h2>
          <div className="art-crumb">
            {article.book && <span className="art-crumb-book">{article.book}</span>}
            {article.division && <span>{article.division}</span>}
            {article.chapter && <span>{article.chapter}</span>}
            {article.section && <span>{article.section}</span>}
          </div>
        </header>
        <div className="art-body">{article.paras.map((p, i) => renderPara(p, i))}</div>
      </article>

      <div className="art-related">
        <button className="art-related-toggle" onClick={() => setShowRelated((v) => !v)}>
          {showRelated ? '▾' : '▸'} 相关条文（按文本相似度推荐）
        </button>
        {showRelated && (
          <div className="art-related-list">
            {related.map((r) => (
              <button key={r.n} className="art-related-item" onClick={() => onOpen(r.n)}>
                <span className="art-related-no">第{numToCn(r.n)}条</span>
                <span className="art-related-crumb">
                  {r.book}
                  {r.chapter ? ` · ${r.chapter}` : ''}
                </span>
                <span className="art-related-preview">{r.preview}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
