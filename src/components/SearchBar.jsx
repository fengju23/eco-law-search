import { useEffect, useRef, useState } from 'react'
import { SCENE_PRESETS } from '../search/terms.js'

const SYNTAX = [
  { k: '噪声 处罚', d: '空格分隔 = 同时包含多个词' },
  { k: '"生态环境主管部门"', d: '英文双引号 = 精确短语' },
  { k: '噪声 -施工', d: '减号 = 排除该词' },
  { k: '条:570', d: '条号直达' },
  { k: '条:100-200', d: '条号区间' },
  { k: '编:污染防治', d: '限定某一编' },
  { k: '章:噪声', d: '限定某章/节' },
  { k: '噪音 / 广场舞 / 垃圾', d: '生活用语也能搜（自动扩展同义词）' },
]

export default function SearchBar({ value, onChange, onSubmit, autoFocus, compact }) {
  const [help, setHelp] = useState(false)
  const [sug, setSug] = useState(false)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  // 快捷键：/ 聚焦搜索；Esc 关闭提示
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === 'Escape') {
        setHelp(false)
        setSug(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const matchedPresets =
    value && value.trim().length >= 1
      ? SCENE_PRESETS.filter((p) => p.name.includes(value.trim()) || p.q.includes(value.trim())).slice(0, 5)
      : []

  return (
    <div className={`sb ${compact ? 'compact' : ''}`} ref={boxRef}>
      <div className="sb-input">
        <span className="sb-icon">🔍</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setSug(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSug(false)
              onSubmit(value)
            }
          }}
          onFocus={() => setSug(true)}
          placeholder="检索 1242 条法典全文：噪声扰民 / 光污染 / 条:570 / 按日连续处罚"
          aria-label="法典全文检索"
        />
        {value && (
          <button
            className="sb-clear"
            onClick={() => {
              onChange('')
              onSubmit('')
              inputRef.current?.focus()
            }}
            title="清空"
          >
            ✕
          </button>
        )}
        <button className="sb-submit" onClick={() => onSubmit(value)}>
          检索
        </button>
        <button className={`sb-help ${help ? 'on' : ''}`} onClick={() => setHelp((h) => !h)} title="检索语法">
          ?
        </button>
      </div>

      {help && (
        <div className="sb-help-pop">
          <strong>检索语法</strong>
          <ul>
            {SYNTAX.map((s) => (
              <li key={s.k}>
                <code>{s.k}</code>
                <span>{s.d}</span>
              </li>
            ))}
          </ul>
          <p className="sb-help-tip">提示：按 / 可随时聚焦搜索框，Esc 关闭本提示</p>
        </div>
      )}

      {sug && matchedPresets.length > 0 && (
        <div className="sb-sug">
          {matchedPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.q)
                setSug(false)
                onSubmit(p.q)
              }}
            >
              <span>{p.emoji}</span>
              <strong>{p.name}</strong>
              <em>{p.q}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
