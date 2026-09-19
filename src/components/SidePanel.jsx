import { useState } from 'react'
import { GLOSSARY, SCENE_PRESETS } from '../search/terms.js'
import { numToCn } from '../search/engine.js'

const TABS = [
  { id: 'scene', name: '生活场景', icon: '🏙️' },
  { id: 'hist', name: '检索历史', icon: '🕘' },
  { id: 'fav', name: '我的收藏', icon: '⭐' },
  { id: 'term', name: '术语速查', icon: '📖' },
]

/** 侧栏：场景预设 / 历史 / 收藏 / 术语（原"场景剧场""速查卡""生词本"的价值下沉于此） */
export default function SidePanel({ prefs, onSearch, onOpen, clearHistory, onClearFavs }) {
  const [tab, setTab] = useState('scene')

  return (
    <aside className="side">
      <div className="side-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} title={t.name}>
            <span>{t.icon}</span>
            <em>{t.name}</em>
          </button>
        ))}
      </div>

      <div className="side-body">
        {tab === 'scene' && (
          <>
            <p className="side-tip">用生活里的话就能查——点一下直接发起检索</p>
            <div className="scene-list">
              {SCENE_PRESETS.map((p) => (
                <button key={p.id} className="scene-item" onClick={() => onSearch(p.q)}>
                  <span className="scene-emoji">{p.emoji}</span>
                  <span className="scene-main">
                    <strong>{p.name}</strong>
                    <em>{p.tip}</em>
                  </span>
                  <code>{p.q}</code>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'hist' && (
          <>
            <div className="side-row">
              <span className="side-tip inline">最近 {prefs.history.length} 条检索</span>
              {prefs.history.length > 0 && (
                <button className="side-mini" onClick={clearHistory}>
                  清空
                </button>
              )}
            </div>
            {prefs.history.length === 0 ? (
              <p className="side-empty">还没有检索记录。试着搜索「噪声」「油烟」或「条:570」。</p>
            ) : (
              <div className="hist-list">
                {prefs.history.map((h) => (
                  <button key={h} className="hist-item" onClick={() => onSearch(h)}>
                    <span>🕘</span>
                    {h}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'fav' && (
          <>
            <div className="side-row">
              <span className="side-tip inline">已收藏 {prefs.favs.length} 条</span>
              {prefs.favs.length > 0 && (
                <button className="side-mini" onClick={onClearFavs}>
                  清空
                </button>
              )}
            </div>
            {prefs.favs.length === 0 ? (
              <p className="side-empty">在条文页点 ☆ 收藏，方便随时回看。</p>
            ) : (
              <div className="fav-list">
                {prefs.favs.map((n) => (
                  <button key={n} className="fav-item" onClick={() => onOpen(n)}>
                    <span>⭐</span>第{numToCn(n)}条
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'term' && (
          <>
            <p className="side-tip">点击术语直接检索法典中相关条文</p>
            <div className="term-list">
              {GLOSSARY.map((g) => {
                const key = g.term.split(' / ')[0]
                return (
                  <div className="term-item" key={key}>
                    <button className="term-name" onClick={() => onSearch(key)}>
                      {key}
                      <em>{g.pinyin}</em>
                    </button>
                    <p>{g.def}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
