import { REPEALED_LAWS, SCENE_PRESETS } from '../search/terms.js'

/** 首页：检索引导 + 法典档案（原"新旧对比""时间轴"精简为档案信息） */
export default function Home({ stats, buildMs, prefs, onSearch }) {
  return (
    <div className="home">
      <div className="home-hero">
        <h1>
          中华人民共和国<span>生态环境法典</span>
        </h1>
        <p className="home-sub">
          2026年3月12日通过 · 2026年8月15日（全国生态日）起施行 · 继《民法典》之后我国第二部以"法典"命名的法律
        </p>
        <div className="home-stats">
          <div className="home-stat">
            <strong>{stats ? stats.articles : '—'}</strong>
            <span>条正文</span>
          </div>
          <div className="home-stat">
            <strong>{stats ? stats.books.length : '—'}</strong>
            <span>编</span>
          </div>
          <div className="home-stat">
            <strong>{stats ? Math.round(stats.chars / 10000) : '—'}</strong>
            <span>万字（检索范围）</span>
          </div>
          <div className="home-stat">
            <strong>{buildMs ? `${buildMs}ms` : '—'}</strong>
            <span>全量索引耗时</span>
          </div>
        </div>
        <p className="home-hint">
          在顶部搜索框输入关键词即可检索全文 · 按 <kbd>/</kbd> 快速聚焦 · 支持 <code>条:570</code>、
          <code>"精确短语"</code>、<code>-排除词</code>
        </p>
      </div>

      <section className="home-block">
        <h2>🏙️ 从身边事查起</h2>
        <p className="home-block-sub">这些是老百姓最常遇到的问题，点击直接检索对应法条</p>
        <div className="home-scenes">
          {SCENE_PRESETS.map((p) => (
            <button key={p.id} className="home-scene" onClick={() => onSearch(p.q)}>
              <span className="home-scene-emoji">{p.emoji}</span>
              <strong>{p.name}</strong>
              <em>{p.tip}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="home-block">
        <h2>📖 按编浏览</h2>
        <p className="home-block-sub">五编结构，点击进入该编的全部条文</p>
        <div className="home-books">
          {stats &&
            stats.books.map(([name, count], i) => (
              <button key={name} className={`home-book book-${i}`} onClick={() => onSearch(`编:${name}`)}>
                <strong>{name}</strong>
                <span>{count} 条</span>
              </button>
            ))}
        </div>
      </section>

      {prefs.history.length > 0 && (
        <section className="home-block">
          <h2>🕘 继续上次</h2>
          <div className="home-hist">
            {prefs.history.slice(0, 6).map((h) => (
              <button key={h} onClick={() => onSearch(h)}>
                {h}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="home-block">
        <h2>📋 法典档案</h2>
        <div className="home-dossier">
          <div className="home-dossier-row">
            <span>施行</span>
            <strong>2026年8月15日（全国生态日）</strong>
          </div>
          <div className="home-dossier-row">
            <span>同时废止</span>
            <strong>{REPEALED_LAWS.length} 部单行法</strong>
          </div>
          <div className="home-repealed">
            {REPEALED_LAWS.map((l) => (
              <button
                key={l}
                className="home-repealed-chip"
                onClick={() => onSearch('条:1242')}
                title="查看废止条款（第1242条）"
              >
                {l.replace('中华人民共和国', '')}
              </button>
            ))}
          </div>
          <p className="home-dossier-note">
            这 10 部法律的内容已整合进本法典，条文中的《某法》引用会标注"已废止"。点击任一旧法名可查看废止条款。
          </p>
        </div>
      </section>
    </div>
  )
}
