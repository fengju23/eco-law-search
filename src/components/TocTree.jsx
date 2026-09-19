import { useState } from 'react'

/** 目录树：编 → 章 → 节，支持命中数徽标与区间浏览 */
export default function TocTree({ toc, activeRange, hitCounts, onPick, total }) {
  const [openBooks, setOpenBooks] = useState(() => toc.map((b) => b.id))
  const [openChaps, setOpenChaps] = useState([])

  const isBookOpen = (id) => openBooks.includes(id)
  const isChapOpen = (id) => openChaps.includes(id)

  const countIn = (r) => {
    if (!hitCounts) return null
    let c = 0
    for (const [a, b] of hitCounts.ranges) {
      if (b >= r[0] && a <= r[1]) c++
    }
    return c
  }

  const isActive = (r) => activeRange && activeRange[0] === r[0] && activeRange[1] === r[1]

  return (
    <div className="toc">
      <div className="toc-head">
        <span>📚 目录导览</span>
        <span className="toc-total">{total} 条</span>
      </div>
      <div className="toc-scroll">
        {toc.map((b) => {
          const c = countIn(b.r)
          return (
            <div className="toc-book" key={b.id}>
              <div className="toc-book-row">
                <button
                  className={`toc-caret ${isBookOpen(b.id) ? 'open' : ''}`}
                  onClick={() =>
                    setOpenBooks((o) => (o.includes(b.id) ? o.filter((x) => x !== b.id) : [...o, b.id]))
                  }
                  aria-label={isBookOpen(b.id) ? '收起' : '展开'}
                >
                  ▸
                </button>
                <button className={`toc-book-btn ${isActive(b.r) ? 'on' : ''}`} onClick={() => onPick(b.r, b.l + ' ' + b.t)}>
                  <span className="toc-l">{b.l}</span>
                  <span className="toc-t">{b.t}</span>
                  <span className="toc-r">{b.r[0]}–{b.r[1]}</span>
                  {c > 0 && <span className="toc-hit">{c}</span>}
                </button>
              </div>

              {isBookOpen(b.id) && b.c && (
                <div className="toc-chapters">
                  {b.c.map((ch) => {
                    const cc = countIn(ch.r)
                    const hasKids = ch.c && ch.c.length > 0
                    return (
                      <div key={ch.id}>
                        <div className="toc-ch-row">
                          {hasKids ? (
                            <button
                              className={`toc-caret sm ${isChapOpen(ch.id) ? 'open' : ''}`}
                              onClick={() =>
                                setOpenChaps((o) => (o.includes(ch.id) ? o.filter((x) => x !== ch.id) : [...o, ch.id]))
                              }
                              aria-label="展开小节"
                            >
                              ▸
                            </button>
                          ) : (
                            <span className="toc-caret sm ghost" />
                          )}
                          <button
                            className={`toc-ch-btn ${isActive(ch.r) ? 'on' : ''}`}
                            onClick={() => onPick(ch.r, ch.l + ' ' + ch.t)}
                          >
                            <span>{ch.l} {ch.t}</span>
                            {cc > 0 && <span className="toc-hit sm">{cc}</span>}
                          </button>
                        </div>
                        {hasKids && isChapOpen(ch.id) && (
                          <div className="toc-sections">
                            {ch.c.map((sec) => {
                              const sc = countIn(sec.r)
                              return (
                                <button
                                  key={sec.id}
                                  className={`toc-sec-btn ${isActive(sec.r) ? 'on' : ''}`}
                                  onClick={() => onPick(sec.r, sec.l + ' ' + sec.t)}
                                >
                                  <span>{sec.l} {sec.t}</span>
                                  {sc > 0 && <span className="toc-hit sm">{sc}</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
