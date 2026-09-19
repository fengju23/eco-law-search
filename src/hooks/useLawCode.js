import { useEffect, useState } from 'react'
import { buildIndex, indexStats } from '../search/engine.js'

/** 加载法典全文并建立检索索引（数据从 public/data 运行时获取，不进入 JS bundle） */
export function useLawCode() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    index: null,
    toc: null,
    articles: null,
    stats: null,
    buildMs: 0,
  })

  useEffect(() => {
    let alive = true
    const url = `${import.meta.env.BASE_URL}data/law-code.json`
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!alive) return
        const t0 = performance.now()
        const index = buildIndex(json.arts)
        const buildMs = Math.round(performance.now() - t0)
        setState({
          loading: false,
          error: null,
          index,
          toc: json.toc,
          articles: json.arts,
          stats: indexStats(index),
          buildMs,
        })
      })
      .catch((e) => {
        if (alive) setState((s) => ({ ...s, loading: false, error: e.message }))
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}
