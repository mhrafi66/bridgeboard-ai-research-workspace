import { useState } from 'react'
import {
  LANGUAGE_NAMES,
  translateText,
} from '../../lib/api'
import AudioPlayer from './AudioPlayer'


function TextContribution() {
  const [text, setText] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleTranslate() {
    if (!text.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const translation = await translateText(
        text, targetLanguage,
      )
      setResult(translation)
    } catch (requestError) {
      setError(
        requestError.message || 'Translation failed.',
      )
    } finally {
      setLoading(false)
    }
  }

  const detectedName =
    result &&
    (LANGUAGE_NAMES[result.detectedLanguage] ||
      result.detectedLanguage)

  const targetName =
    LANGUAGE_NAMES[targetLanguage] || targetLanguage

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="target-lang"
          style={{
            display: 'block',
            fontWeight: '700',
            marginBottom: '8px',
            fontSize: '13px',
          }}
        >
          Translate to
        </label>

        <select
          id="target-lang"
          value={targetLanguage}
          onChange={(e) =>
            setTargetLanguage(e.target.value)
          }
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            background: '#fff',
            fontSize: '13px',
            minWidth: '200px',
          }}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="pt">Portuguese</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
          <option value="bn">Bangla</option>
          <option value="ru">Russian</option>
        </select>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste your research contribution in any language..."
        rows={6}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #ddd',
          fontSize: '15px',
          lineHeight: '1.6',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '12px',
        }}
      >
        <button
          onClick={handleTranslate}
          disabled={loading || !text.trim()}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            color: '#fff',
            background:
              loading || !text.trim()
                ? '#b0aab8'
                : '#3a3349',
            cursor:
              loading || !text.trim()
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {loading
            ? 'Translating...'
            : `Translate to ${targetName}`}
        </button>

        <small style={{ color: '#999' }}>
          Language is auto-detected from your input
        </small>
      </div>

      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            background: '#fff1f1',
            border: '1px solid #e6baba',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#a04f48',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: '28px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
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
                ORIGINAL
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
              {result.originalText}
            </p>

            <div style={{ marginTop: '12px' }}>
              <AudioPlayer
                text={result.originalText}
                languageCode={result.detectedLanguage}
              />
            </div>
          </div>

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
                SHARED-LANGUAGE VERSION
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
                {targetName}
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
              {result.translatedText}
            </p>

            <div style={{ marginTop: '12px' }}>
              <AudioPlayer
                text={result.translatedText}
                languageCode={result.targetLanguage}
              />
            </div>
          </div>
        </div>
      )}

      {result && (
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
            Powered by Amazon Translate
          </small>
        </div>
      )}
    </div>
  )
}

export default TextContribution
