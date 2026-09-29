import { useState, useRef } from 'react'
import {
  startTranscription,
  pollTranscription,
} from '../../lib/api'

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 40

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function VoiceInput({ onTranscript }) {
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  async function processAudio(blob) {
    setError('')
    setStatus('Uploading...')

    try {
      const base64 = await blobToBase64(blob)

      const ext = blob.type?.includes('wav')
        ? 'wav'
        : blob.type?.includes('mp3') || blob.type?.includes('mpeg')
          ? 'mp3'
          : 'webm'

      setStatus('Transcribing...')
      const job = await startTranscription(base64, ext)

      let polls = 0
      while (polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        polls++

        const result = await pollTranscription(job.jobName)

        if (result.status === 'COMPLETED') {
          setStatus('')
          onTranscript(result.transcript)
          return
        }

        if (result.status === 'FAILED') {
          throw new Error(result.error || 'Transcription failed.')
        }

        setStatus(`Transcribing... (${polls * 3}s)`)
      }

      throw new Error('Transcription timed out.')
    } catch (err) {
      setError(err.message || 'Transcription failed.')
      setStatus('')
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }

    setError('')
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined,
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        processAudio(blob)
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError('Mic access denied.')
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (file) processAudio(file)
    e.target.value = ''
  }

  const busy = !!status

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: '6px',
      }}
    >
      <button
        onClick={toggleRecording}
        disabled={busy}
        title={recording ? 'Stop recording' : 'Record voice'}
        style={{
          padding: '3px 8px',
          fontSize: '11px',
          fontWeight: '600',
          borderRadius: '5px',
          border: recording
            ? '1px solid #e6baba'
            : '1px solid #d7cff7',
          color: recording ? '#c0392b' : '#7654d6',
          background: recording ? '#fff8f7' : '#faf9ff',
          cursor: busy ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        {recording ? '\u{23F9}' : '\u{1F3A4}'}
        {recording ? 'Stop' : 'Mic'}
      </button>

      <label
        title="Upload audio file"
        style={{
          padding: '3px 8px',
          fontSize: '11px',
          fontWeight: '600',
          borderRadius: '5px',
          border: '1px solid #d7cff7',
          color: '#7654d6',
          background: '#faf9ff',
          cursor: busy ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        {'\u{1F4C1}'} File
        <input
          type="file"
          accept="audio/*"
          onChange={handleFile}
          disabled={busy}
          style={{ display: 'none' }}
        />
      </label>

      {status && (
        <small style={{ color: '#7654d6', fontSize: '10px' }}>
          {status}
        </small>
      )}

      {error && (
        <small style={{ color: '#a04f48', fontSize: '10px' }}>
          {error}
        </small>
      )}
    </span>
  )
}

export default VoiceInput
