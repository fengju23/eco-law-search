import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchLaw } from './search/engine.js'
import { buildSynonymMap } from './search/terms.js'
import { useLawCode } from './hooks/useLawCode.js'
import { usePrefs } from './hooks/usePrefs.js'
import SearchBar from './components/SearchBar.jsx'
import TocTree from './components/TocTree.jsx'
import ResultList from './components/ResultList.jsx'
import ArticleView from './components/ArticleView.jsx'
import SidePanel from './components/SidePanel.jsx'
import Home from './components/Home.jsx'
import Ambience from './components/Ambience.jsx'

const SYN = buildSynonymMap()

// ---- 极简哈希路由：#/ | #/q/<query> | #/a/<n> ----
function parseHash(hash) {
  const h = (hash || '').replace(/^#/, '')
  if (h.startsWith('/a/')) {
    const n = parseInt(h.slice(3), 10)
    return { view: 'article', n: Number.isFinite(n) ? n : null }
  }
  if (h.startsWith('/q/')) return { view: 'search', q: decodeURIComponent(h.slice(3)) }
  return { view: 'home', q: '' }
}

export default function App() {
  const { loading, error, index, toc, articles, stats, buildMs } = useLawCode()
  const { prefs, set, toggleFav, pushHistory, clearHistory } = usePrefs()

  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  const [query, setQuery] = useState(() => parseHash(window.location.hash).q || '')
  const [sort, setSort] = useState('relevance')
  const [result, setResult] = useState(null)
  const [highlightTerms, setHighlightTerms] = useState([])

  // 路由同步
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // 执行检索
  const runSearch = useCallback(
    (q, nextSort = 'relevance') => {
      const query0 = String(q || '').trim()
      setQuery(query0)
      setSort(nextSort)
      if (!query0) {
        setResult(null)
        window.location.hash = '#/'
        return
      }
      const r = searchLaw(index, query0, { syn: SYN, sort: nextSort, limit: 400 })
      setResult(r)
      setHighlightTerms(r.parsed.terms.concat(r.parsed.phrases))
      pushHistory(query0)
      const h = `#/q/${encodeURIComponent(query0)}`
      if (window.location.hash !== h) window.location.hash = h
      else setRoute({ view: 'search', q: query0 })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [index, pushHistory],
  )

  // 打开某一条；第二个参数用于"改为检索"（空结果引导按钮）
  const openArticle = useCallback(
    (n, searchInstead) => {
      if (searchInstead) {
        runSearch(searchInstead)
        return
      }
      if (!n) return
      window.location.hash = `#/a/${n}`
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [runSearch],
  )

  // 首次进入若带 query → 自动检索（索引异步就绪后触发一次；微任务内延后，避免同一次提交内级联渲染）
  const bootedRef = useRef(false)
  useEffect(() => {
    if (!index || bootedRef.current) return
    bootedRef.current = true
    if (route.view !== 'search' || !route.q) return
    const q = route.q
    queueMicrotask(() => runSearch(q, 'relevance'))
  }, [index, route, runSearch])

  const changeSort = useCallback(
    (s) => {
      if (query) runSearch(query, s)
      else setSort(s)
    },
    [query, runSearch],
  )

  const article = useMemo(() => {
    if (route.view !== 'article' || !articles) return null
    return articles.find((a) => a.n === route.n) || null
  }, [route, articles])

  // 当前结果里命中的条号（供目录树显示徽标）
  const hitCounts = useMemo(() => {
    if (!result) return null
    return { ranges: result.hits.map((h) => [h.n, h.n]) }
  }, [result])

  const activeRange = useMemo(() => {
    if (result && result.parsed.filters.arts.length === 1) return result.parsed.filters.arts[0]
    return null
  }, [result])

  const pickRange = (range) => runSearch(`条:${range[0]}-${range[1]}`)
  const pickBook = (book) => runSearch(`编:${book}`)
  const goHome = () => {
    setQuery('')
    setResult(null)
    window.location.hash = '#/'
  }

  return (
    <div className="app">
      <header className="top">
        <button className="top-brand" onClick={goHome} title="回到首页">
          <span className="top-seal">典</span>
          <span className="top-title">
            <strong>生态环境法典检索</strong>
            <em>5 编 · 1242 条 · 全文可检索</em>
          </span>
        </button>

        <SearchBar value={query} onChange={setQuery} onSubmit={runSearch} />

        <div className="top-right">
          <Ambience prefs={prefs} set={set} />
          <div className="top-theme">
            {[
              { id: 'light', n: '☀️' },
              { id: 'sepia', n: '📜' },
              { id: 'dark', n: '🌙' },
            ].map((t) => (
              <button
                key={t.id}
                className={prefs.theme === t.id ? 'on' : ''}
                onClick={() => set({ theme: t.id })}
                title={`主题：${t.id}`}
              >
                {t.n}
              </button>
            ))}
          </div>
          <button
            className={`top-toc-toggle ${prefs.showToc ? 'on' : ''}`}
            onClick={() => set({ showToc: !prefs.showToc })}
            title="显示/隐藏目录"
          >
            ☰
          </button>
        </div>
      </header>

      {loading && (
        <div className="boot">
          <div className="boot-seal">典</div>
          <p>正在载入 1242 条法典全文并建立检索索引…</p>
        </div>
      )}

      {error && (
        <div className="boot err">
          <p>全文数据加载失败：{error}</p>
          <p className="boot-tip">
            请确认 public/data/law-code.json 存在（可运行 node scripts/extract-law.cjs 重新生成）。
          </p>
        </div>
      )}

      {!loading && !error && (
        <div className={`layout ${prefs.showToc ? '' : 'no-toc'}`}>
          <SidePanel
            prefs={prefs}
            onSearch={runSearch}
            onOpen={openArticle}
            clearHistory={clearHistory}
            onClearFavs={() => set({ favs: [] })}
          />

          <main className="main">
            {route.view === 'home' && !query && (
              <Home stats={stats} buildMs={buildMs} prefs={prefs} onSearch={runSearch} />
            )}
            {route.view === 'search' && (
              <ResultList
                result={result}
                sort={sort}
                onSort={changeSort}
                onOpen={openArticle}
                onPickBook={pickBook}
              />
            )}
            {route.view === 'article' &&
              (article ? (
                <ArticleView
                  article={article}
                  index={index}
                  prefs={prefs}
                  set={set}
                  toggleFav={toggleFav}
                  onOpen={openArticle}
                  onBack={() => window.history.back()}
                  highlightTerms={highlightTerms}
                />
              ) : (
                <div className="res-empty">
                  <p>未找到该条文，请输入 1–1242 之间的条号。</p>
                </div>
              ))}
          </main>

          {prefs.showToc && (
            <TocTree toc={toc} activeRange={activeRange} hitCounts={hitCounts} onPick={pickRange} total={1242} />
          )}
        </div>
      )}

      <footer className="foot">
        <p>
          全文数据整理自公开发布文本（新华社受权播发），仅供普法学习参考。噪声、油烟、恶臭、光污染等扰民问题可拨打
          <strong> 12345 / 12369 </strong>热线。
        </p>
        <p className="foot-sub">
          检索索引在浏览器本地构建（{buildMs}ms / {stats ? stats.articles : 0} 条），输入内容不会上传到任何服务器。
        </p>
      </footer>
    </div>
  )
}
