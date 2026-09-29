import { useState } from 'react'
import TextContribution from './TextContribution'
import VoiceContribution from './VoiceContribution'

const TABS = [
  { id: 'type', label: 'Type', icon: '✎', enabled: true },
  { id: 'speak', label: 'Speak', icon: '🎙', enabled: true },
  { id: 'document', label: 'Document', icon: '📄', enabled: false },
]

function UniversalInputPage() {
  const [activeTab, setActiveTab] = useState('type')

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px',
      }}
    >
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.14em',
            color: '#7654d6',
          }}
        >
          UNIVERSAL INPUT
        </div>

        <h1>Share a research contribution</h1>

        <p
          style={{
            maxWidth: '520px',
            color: '#65616b',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          Contribute in whatever language or medium is natural to you.
          Your original contribution is always preserved alongside the
          shared-language version.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '28px',
          borderBottom: '1px solid #e0ddd9',
          paddingBottom: '0',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '700' : '500',
              color: !tab.enabled
                ? '#ccc'
                : activeTab === tab.id
                  ? '#3a3349'
                  : '#888',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === tab.id
                  ? '2px solid #7654d6'
                  : '2px solid transparent',
              cursor: tab.enabled ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {!tab.enabled && (
              <span
                style={{
                  fontSize: '9px',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  background: '#f0efec',
                  color: '#aaa',
                }}
              >
                soon
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'type' && <TextContribution />}

      {activeTab === 'speak' && <VoiceContribution />}

      {activeTab === 'document' && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: '#aaa',
            border: '1px dashed #ddd',
            borderRadius: '14px',
          }}
        >
          Document upload coming soon — Amazon Textract
        </div>
      )}

      <footer
        style={{
          marginTop: '48px',
          paddingTop: '16px',
          borderTop: '1px solid #e0ddd9',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#aaa6aa',
          fontSize: '9px',
        }}
      >
        <span style={{ color: '#a97bb6', fontSize: '16px' }}>
          ◈
        </span>
        <span>
          Amazon Translate + Transcribe + Polly · <strong style={{ color: '#817d85' }}>preserving original contributions</strong>
        </span>
        <span style={{ marginLeft: 'auto', color: '#89a58c' }}>
          ⌁ private by design
        </span>
      </footer>
    </div>
  )
}

export default UniversalInputPage
