import { useState, useRef } from 'react'
import { synthesizeSpeech } from '../../lib/api'

function AudioPlayer({ text, languageCode = 'en' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  async function handleListen() {
    if (!text?.trim()) return

    setLoading(true)
    setError('')

    try {
      const result = await synthesizeSpeech(
        text,
        languageCode,
      )

      const bytes = atob(result.audio)
      const buffer = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) {
        buffer[i] = bytes.charCodeAt(i)
      }

      const blob = new Blob([buffer], {
        type: 'audio/mpeg',
      })

      const url = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }

      const audio = new Audio(url)
      audioRef.current = audio
      audio.addEventListener(
        'ended',
        () => URL.revokeObjectURL(url),
        { once: true },
      )
      await audio.play()
    } catch (err) {
      setError(err.message || 'Could not play audio.')
    } finally {
      setLoading(false)
    }
  }

  if (!text?.trim()) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <button
        onClick={handleListen}
        disabled={loading}
        title={`Listen in ${languageCode}`}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: '600',
          borderRadius: '6px',
          border: '1px solid #d7cff7',
          color: loading ? '#aaa' : '#7654d6',
          background: loading ? '#f5f5f5' : '#faf9ff',
          cursor: loading ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {loading ? '...' : '\u{1F50A}'}
        {' Listen'}
      </button>

      {error && (
        <small style={{ color: '#a04f48', fontSize: '10px' }}>
          {error}
        </small>
      )}
    </span>
  )
}

export default AudioPlayer
