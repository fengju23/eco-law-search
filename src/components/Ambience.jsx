import { useEffect, useRef } from 'react'

// 阅读背景音：取自程序合成的环境音（原"声音馆"模块下沉为阅读辅助）
const TRACKS = [
  { id: 'rain-v1', name: '细雨', emoji: '🌧️' },
  { id: 'stream-v1', name: '溪流', emoji: '💧' },
  { id: 'pinewind-v1', name: '松风', emoji: '🌲' },
  { id: 'bell-v1', name: '钟磬', emoji: '🔔' },
]

export default function Ambience({ prefs, set }) {
  const audioRef = useRef(null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (prefs.ambience) {
      const src = `${import.meta.env.BASE_URL}sounds/${prefs.ambience}.wav`
      if (!a.src.endsWith(src)) a.src = src
      a.play().catch(() => {})
    } else {
      a.pause()
    }
  }, [prefs.ambience])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = prefs.ambienceVol
  }, [prefs.ambienceVol])

  return (
    <div className="amb">
      <span className="amb-icon" title="阅读背景音">
        🎧
      </span>
      <div className="amb-tracks">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            className={prefs.ambience === t.id ? 'on' : ''}
            onClick={() => set({ ambience: prefs.ambience === t.id ? null : t.id })}
            title={`背景音：${t.name}`}
          >
            {t.emoji}
          </button>
        ))}
      </div>
      <input
        className="amb-vol"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={prefs.ambienceVol}
        onChange={(e) => set({ ambienceVol: parseFloat(e.target.value) })}
        title="音量"
        aria-label="背景音音量"
      />
      <audio ref={audioRef} loop preload="none" />
    </div>
  )
}
