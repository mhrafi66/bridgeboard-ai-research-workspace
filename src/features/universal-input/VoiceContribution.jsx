import { useState, useRef } from 'react'
import {
  LANGUAGE_NAMES,
  startTranscription,
  pollTranscription,
  translateText,
} from '../../lib/api'
import AudioPlayer from './AudioPlayer'

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 40

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function VoiceContribution() {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState(null)
  const [translation, setTranslation] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording() {
    setError('')
    setTranscript(null)
    setTranslation(null)
    setAudioBlob(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined,
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: 'audio/webm',
        })
        setAudioBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError(
        'Microphone access denied. Use the file upload instead.',
      )
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setTranscript(null)
    setTranslation(null)
    setAudioBlob(file)
  }

  async function handleTranscribe() {
    if (!audioBlob) return

    setError('')
    setStatus('Uploading audio...')
    setTranscript(null)
    setTranslation(null)

    try {
      const base64 = await blobToBase64(audioBlob)

      const ext = audioBlob.type?.includes('wav')
        ? 'wav'
        : audioBlob.type?.includes('mp3') || audioBlob.type?.includes('mpeg')
          ? 'mp3'
          : audioBlob.type?.includes('flac')
            ? 'flac'
            : 'webm'

      setStatus('Starting transcription...')
      const job = await startTranscription(base64, ext)

      setStatus('Transcribing...')
      let polls = 0

      while (polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        polls++

        const result = await pollTranscription(job.jobName)

        if (result.status === 'COMPLETED') {
          const langCode = result.detectedLanguage?.split('-')[0] || 'en'

          setTranscript({
            text: result.transcript,
            detectedLanguage: langCode,
            fullLanguageCode: result.detectedLanguage,
          })

          if (langCode !== 'en') {
            setStatus('Translating to English...')
            try {
              const tr = await translateText(result.transcript, 'en')
              setTranslation(tr)
            } catch {
              setTranslation(null)
            }
          }

          setStatus('')
          return
        }

        if (result.status === 'FAILED') {
          throw new Error(result.error || 'Transcription failed.')
        }

        setStatus(
          `Transcribing... (${polls * 3}s)`,
        )
      }

      throw new Error('Transcription timed out.')
    } catch (err) {
      setError(err.message || 'Transcription failed.')
      setStatus('')
    }
  }

  const detectedName = transcript
    ? LANGUAGE_NAMES[transcript.detectedLanguage] ||
      transcript.fullLanguageCode
    : null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        {!recording ? (
          <button
            onClick={startRecording}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              color: '#fff',
              background: '#3a3349',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '18px' }}>
              {'\u{1F3A4}'}
            </span>
            Record
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              color: '#fff',
              background: '#c0392b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              animation: 'pulse 1.5s infinite',
            }}
          >
            <span style={{ fontSize: '12px' }}>
              {'\u{23F9}\u{FE0F}'}
            </span>
            Stop recording
          </button>
        )}

        <span
          style={{
            color: '#bbb',
            fontSize: '12px',
          }}
        >
          or
        </span>

        <label
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '700',
            borderRadius: '8px',
            border: '1px solid #d7cff7',
            color: '#7654d6',
            background: '#faf9ff',
            cursor: 'pointer',
          }}
        >
          Upload audio file
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {audioBlob && !recording && (
        <div
          style={{
            padding: '16px',
            border: '1px solid #e0ddd9',
            borderRadius: '10px',
            background: '#fff',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {'\u{1F4E2}'}
          </span>

          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '13px' }}>
              Audio ready
            </strong>

            <small
              style={{
                display: 'block',
                color: '#999',
                fontSize: '11px',
              }}
            >
              {(audioBlob.size / 1024).toFixed(0)} KB
              {audioBlob.name ? ` · ${audioBlob.name}` : ''}
            </small>
          </div>

          <button
            onClick={handleTranscribe}
            disabled={!!status}
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              color: '#fff',
              background: status ? '#b0aab8' : '#3a3349',
              cursor: status ? 'wait' : 'pointer',
            }}
          >
            {status || 'Transcribe'}
          </button>
        </div>
      )}

      {recording && (
        <div
          style={{
            padding: '16px',
            border: '1px solid #e6baba',
            borderRadius: '10px',
            background: '#fff8f7',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#c0392b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#c0392b',
              display: 'inline-block',
              animation: 'pulse 1.5s infinite',
            }}
          />
          Recording... speak now
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '14px',
            background: '#fff1f1',
            border: '1px solid #e6baba',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#a04f48',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {transcript && (
        <div
          style={{
            marginTop: '24px',
            display: 'grid',
            gridTemplateColumns:
              translation ? '1fr 1fr' : '1fr',
            gap: '20px',
          }}
        >
          <div
            style={{
              padding: '20px',
              border: '1px solid #e0ddd9',
              borderRadius: '14px',
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.12em',
                  color: '#7654d6',
                }}
              >
                TRANSCRIPT
              </span>

              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: '#ece8fa',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                {detectedName}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: '15px',
                lineHeight: '1.7',
                color: '#333',
              }}
            >
              {transcript.text}
            </p>

            <div style={{ marginTop: '12px' }}>
              <AudioPlayer
                text={transcript.text}
                languageCode={transcript.detectedLanguage}
              />
            </div>
          </div>

          {translation && (
            <div
              style={{
                padding: '20px',
                border: '1px solid #d7cff7',
                borderRadius: '14px',
                background: '#faf9ff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.12em',
                    color: '#7654d6',
                  }}
                >
                  ENGLISH TRANSLATION
                </span>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: '#333',
                }}
              >
                {translation.translatedText}
              </p>

              <div style={{ marginTop: '12px' }}>
                <AudioPlayer
                  text={translation.translatedText}
                  languageCode="en"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {transcript && (
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <small
            style={{
              color: '#aaa',
              fontSize: '11px',
            }}
          >
            Powered by Amazon Transcribe
            {translation ? ' + Amazon Translate' : ''}
          </small>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default VoiceContribution
