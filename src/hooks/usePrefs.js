import { useCallback, useEffect, useState } from 'react'

const KEY = 'eco-reader-prefs-v2'

const DEFAULTS = {
  theme: 'light', // light | sepia | dark
  fontSize: 16.5,
  lineHeight: 1.95,
  showToc: true,
  quietType: 'songti', // songti | heiti
  favs: [],
  history: [],
  ambience: null, // 背景音 id
  ambienceVol: 0.55,
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

/** 阅读偏好与个人数据：主题、字号、收藏、历史、背景音 */
export function usePrefs() {
  const [prefs, setPrefs] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
  }, [prefs])

  const set = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), [])

  const toggleFav = useCallback((n) => {
    setPrefs((p) => {
      const has = p.favs.includes(n)
      return { ...p, favs: has ? p.favs.filter((x) => x !== n) : [n, ...p.favs].slice(0, 200) }
    })
  }, [])

  const pushHistory = useCallback((q) => {
    const query = String(q || '').trim()
    if (!query) return
    setPrefs((p) => ({ ...p, history: [query, ...p.history.filter((x) => x !== query)].slice(0, 30) }))
  }, [])

  const clearHistory = useCallback(() => setPrefs((p) => ({ ...p, history: [] })), [])

  // 应用主题到 document
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    document.documentElement.style.setProperty('--reader-font-size', `${prefs.fontSize}px`)
    document.documentElement.style.setProperty('--reader-line-height', String(prefs.lineHeight))
  }, [prefs.theme, prefs.fontSize, prefs.lineHeight])

  return { prefs, set, toggleFav, pushHistory, clearHistory }
}
