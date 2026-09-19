import { useState } from 'react'
import { numToCn } from '../search/engine.js'

const PAGE = 30

/** 检索结果列表：命中分布、排序、摘要高亮、分页 */
export default function ResultList({ result, sort, onSort, onOpen, onPickBook }) {
  const [shown, setShown] = useState(PAGE)

  if (!result) return null
  const { total, hits, byBook, took, parsed } = result
  const maxBook = Math.max(1, ...byBook.map(([, c]) => c))

  return (
    <div className="results">
      <div className="res-head">
        <div className="res-summary">
          <strong>{total}</strong> 条命中
          <span className="res-took">耗时 {took}ms</span>
          {parsed.terms.length > 0 && (
            <span className="res-parsed">
              关键词：
              {parsed.terms.map((t) => (
                <b key={t}>{t}</b>
              ))}
              {parsed.phrases.length > 0 && (
                <>
                  {' '}
                  · 短语：
                  {parsed.phrases.map((p) => (
                    <b key={p}>“{p}”</b>
                  ))}
                </>
              )}
              {parsed.excludes.length > 0 && (
                <>
                  {' '}
                  · 排除：
                  {parsed.excludes.map((p) => (
                    <i key={p}>{p}</i>
                  ))}
                </>
              )}
            </span>
          )}
        </div>
        <div className="res-sort">
          <button className={sort === 'relevance' ? 'on' : ''} onClick={() => onSort('relevance')}>
            按相关度
          </button>
          <button className={sort === 'number' ? 'on' : ''} onClick={() => onSort('number')}>
            按条号
          </button>
        </div>
      </div>

      {byBook.length > 1 && (
        <div className="res-books">
          <span className="res-books-title">命中分布</span>
          {byBook.map(([b, c]) => (
            <button
              key={b}
              className="res-book-bar"
              onClick={() => onPickBook && onPickBook(b)}
              title={`只看「${b}」中的命中`}
            >
              <span className="res-book-name">{b}</span>
              <span className="res-book-track">
                <span className="res-book-fill" style={{ width: `${(c / maxBook) * 100}%` }} />
              </span>
              <span className="res-book-count">{c}</span>
            </button>
          ))}
        </div>
      )}

      {total === 0 && (
        <div className="res-empty">
          <p>没有命中的条文。</p>
          <ul>
            <li>
              试试更短的词：
              <button onClick={() => onOpen(null, '噪声')}>噪声</button>、
              <button onClick={() => onOpen(null, '罚款')}>罚款</button>
            </li>
            <li>
              用生活用语也行：
              <button onClick={() => onOpen(null, '噪音')}>噪音</button>、
              <button onClick={() => onOpen(null, '垃圾')}>垃圾</button>、
              <button onClick={() => onOpen(null, '广场舞')}>广场舞</button>
            </li>
            <li>
              查具体条号：<code>条:570</code>，或范围 <code>条:100-200</code>
            </li>
          </ul>
        </div>
      )}

      <div className="res-list">
        {hits.slice(0, shown).map((h) => (
          <article className="res-item" key={h.n}>
            <button className="res-item-body" onClick={() => onOpen(h.n)}>
              <div className="res-item-top">
                <span className="res-no">第{numToCn(h.n)}条</span>
                <span className="res-crumb">
                  {h.book && <em>{h.book}</em>}
                  {h.chapter && <span>{h.chapter}</span>}
                  {h.section && <span>{h.section}</span>}
                </span>
                <span className="res-score" title="相关度得分">
                  {h.score}
                </span>
              </div>
              <p className="res-snippet" dangerouslySetInnerHTML={{ __html: h.snippet.html }} />
            </button>
          </article>
        ))}
      </div>

      {total > shown && (
        <button className="res-more" onClick={() => setShown((s) => s + PAGE)}>
          显示更多（还有 {total - shown} 条）
        </button>
      )}
    </div>
  )
}
