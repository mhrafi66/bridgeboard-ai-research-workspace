import { useState, useEffect, useRef } from 'react'
import {
  getDiscussionMessages,
  postDiscussionMessage,
  deleteDiscussionMessage,
  getUploadUrl,
  uploadFileToS3,
  executeAgentCommand,
  reactToMessage,
} from '../../lib/api'
import VoiceInput from '../universal-input/VoiceInput'
import LitStudyResult from '../shared/LitStudyResult'
import './DiscussionThread.css'

const POLL_INTERVAL = 3000

const TEAM_MEMBERS = [
  { id: 'mumtahin', name: 'Mumtahin Chen', initials: 'MC', color: 'coral', role: 'Research' },
  { id: 'jordan', name: 'Jordan Ellis', initials: 'JE', color: 'blue', role: 'Build' },
  { id: 'ari', name: 'Ari Singh', initials: 'AS', color: 'gold', role: 'Community' },
  { id: 'maria', name: 'Maria Lopez', initials: 'ML', color: 'teal', role: 'Research' },
  { id: 'chen', name: 'Chen Wei', initials: 'CW', color: 'green', role: 'Build' },
  { id: 'everyone', name: 'everyone', initials: '@@', color: 'purple', role: 'Notify all members' },
]

function toMs(val) {
  if (!val) return null
  const n = typeof val === 'string' ? Number(val) : val
  if (!isNaN(n) && n > 1e12) return n
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.getTime()
}

function timeAgo(val) {
  const ms = toMs(val)
  if (!ms) return ''
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDate(val) {
  const ms = toMs(val)
  if (!ms) return 'Today'
  const d = new Date(ms)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function getFileIcon(type, name) {
  if (type?.startsWith('image/')) return '\u{1F5BC}\u{FE0F}'
  if (type?.startsWith('video/')) return '\u{1F3AC}'
  if (type?.startsWith('audio/')) return '\u{1F3B5}'
  if (type === 'application/pdf' || name?.endsWith('.pdf')) return '\u{1F4C4}'
  if (type?.includes('word') || name?.endsWith('.docx') || name?.endsWith('.doc')) return '\u{1F4DD}'
  if (type?.includes('spreadsheet') || name?.endsWith('.xlsx') || name?.endsWith('.csv')) return '\u{1F4CA}'
  if (type?.includes('presentation') || name?.endsWith('.pptx')) return '\u{1F4D1}'
  if (type?.includes('zip') || type?.includes('rar')) return '\u{1F4E6}'
  return '\u{1F4CE}'
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function renderMessageText(text) {
  if (!text) return null
  const regex = /@([\w]+(?:\s[\w]+)?)/g
  const parts = []
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', value: match[0], name: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  if (parts.length === 0) return text
  return parts.map((part, i) =>
    part.type === 'mention'
      ? <span key={i} className="dt-mention" title={`Mention: ${part.name}`}>{part.value}</span>
      : <span key={i}>{part.value}</span>
  )
}

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🤔', '😮']

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function applyInline(str) {
  str = escapeHtml(str)
  str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  str = str.replace(/\*(.+?)\*/g, '<em>$1</em>')
  str = str.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
  return str
}

function markdownToHtml(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(escapeHtml(lines[i])); i++ }
      out.push(`<pre class="md-pre"><code>${code.join('\n')}</code></pre>`)
      i++; continue
    }

    const hm = line.match(/^(#{1,3}) (.+)/)
    if (hm) {
      const lvl = hm[1].length
      out.push(`<h${lvl} class="md-h${lvl}">${applyInline(hm[2])}</h${lvl}>`)
      i++; continue
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      out.push('<hr class="md-hr">'); i++; continue
    }

    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++ }
      const sepIdx = rows.findIndex(r => /^\s*\|[-| :]+\|\s*$/.test(r))
      const heads = sepIdx > 0 ? rows.slice(0, sepIdx) : []
      const body = sepIdx >= 0 ? rows.slice(sepIdx + 1) : rows
      const toRow = (r, tag) => '<tr>' + r.split('|').slice(1, -1).map(c => `<${tag}>${applyInline(c.trim())}</${tag}>`).join('') + '</tr>'
      out.push(`<table class="md-table"><thead>${heads.map(r => toRow(r, 'th')).join('')}</thead><tbody>${body.map(r => toRow(r, 'td')).join('')}</tbody></table>`)
      continue
    }

    if (/^\s*[-*+] /.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*+] /.test(lines[i])) { items.push(`<li>${applyInline(lines[i].replace(/^\s*[-*+] /, ''))}</li>`); i++ }
      out.push(`<ul class="md-ul">${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(`<li>${applyInline(lines[i].replace(/^\d+\. /, ''))}</li>`); i++ }
      out.push(`<ol class="md-ol">${items.join('')}</ol>`)
      continue
    }

    if (line.startsWith('> ')) {
      out.push(`<blockquote class="md-bq">${applyInline(line.substring(2))}</blockquote>`)
      i++; continue
    }

    if (line.trim() === '') { out.push('<br>'); i++; continue }

    out.push(`<p class="md-p">${applyInline(line)}</p>`)
    i++
  }
  return out.join('')
}

const COMMANDS = [
  { name: 'ask', icon: '\u{1F4AC}', description: 'Ask about documents, messages, or topics', usage: '/ask @doc:file.pdf your question' },
  { name: 'summarize', icon: '\u{1F4DD}', description: 'Summarize documents or messages', usage: '/summarize @doc:file.pdf' },
  { name: 'extract', icon: '\u{1F50D}', description: 'Extract text from documents (OCR)', usage: '/extract @doc:file.pdf' },
  { name: 'analyze', icon: '\u{1F4CA}', description: 'NLP analysis - sentiment, entities', usage: '/analyze @msg:3' },
  { name: 'search', icon: '\u{1F310}', description: 'Research topic search', usage: '/search your topic' },
  { name: 'translate', icon: '\u{1F30D}', description: 'Translate content', usage: '/translate @msg:3 es' },
  { name: 'todo', icon: '\u{2705}', description: 'Generate a to-do list from a conversation', usage: '/todo @msg:3' },
  { name: 'litstudy', icon: '\u{1F4DA}', description: 'Literature study - search real papers on a topic', usage: '/litstudy @doc:paper.pdf or /litstudy your topic' },
  { name: 'remember', icon: '\u{1F9E0}', description: 'Save knowledge to Lab Memory', usage: '/remember your insight or finding' },
]

function parseCommand(text, allMessages) {
  if (!text.startsWith('/')) return null
  const parts = text.split(/\s+/)
  const command = parts[0].substring(1).toLowerCase()
  if (!COMMANDS.find((c) => c.name === command)) return null

  const targets = []
  const queryParts = []

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('@doc:')) {
      const fileName = part.substring(5)
      let foundKey = ''
      let foundType = ''
      for (const msg of allMessages) {
        for (const att of msg.attachments || []) {
          if (att.name?.toLowerCase() === fileName.toLowerCase()) {
            foundKey = att.key || ''
            foundType = att.type || ''
            break
          }
        }
        if (foundKey) break
      }
      targets.push({ type: 'document', key: foundKey, name: fileName, fileType: foundType })
    } else if (part.startsWith('@msg:')) {
      const idx = parseInt(part.substring(5)) - 1
      if (idx >= 0 && idx < allMessages.length) {
        const msg = allMessages[idx]
        const text = msg.entity === 'agent-response'
          ? (msg.agentResult?.answer || msg.agentResult?.summary || msg.text || '')
          : (msg.text || '')
        targets.push({ type: 'message', text, name: msg.speaker || '' })
      }
    } else {
      queryParts.push(part)
    }
  }

  return { command, targets, query: queryParts.join(' ') }
}

function renderAgentResult(msg) {
  const r = msg.agentResult
  if (!r) return null
  const inner = renderAgentResultInner(msg)
  const g = r.guardrail
  if (g?.flagged) {
    return (
      <>
        <div className="dt-guardrail-warning" title="Detected by Amazon Comprehend">
          ⚠ Sensitive content detected ({(g.entityTypes || []).join(', ')}). Handle with care.
        </div>
        {inner}
      </>
    )
  }
  return inner
}

function renderAgentResultInner(msg) {
  const r = msg.agentResult
  if (!r) return null
  const cmd = msg.command || r.type

  if (r.type === 'analyze' && r.analysis) {
    const a = r.analysis
    return (
      <div className="dt-agent-card">
        <div className="dt-agent-card-header">
          <span className="dt-agent-badge">/{cmd}</span>
          <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
        </div>
        <div className="dt-agent-card-body">
          {a.sentiment && (
            <div className="dt-agent-section">
              <div className="dt-agent-section-title">Sentiment</div>
              <span className={`dt-sentiment-badge ${a.sentiment.label?.toLowerCase()}`}>
                {a.sentiment.label}
              </span>
            </div>
          )}
          {a.entities?.length > 0 && (
            <div className="dt-agent-section">
              <div className="dt-agent-section-title">Entities</div>
              <div className="dt-agent-tags">
                {a.entities.map((e, i) => (
                  <span key={i} className="dt-agent-tag" title={e.type}>{e.text}</span>
                ))}
              </div>
            </div>
          )}
          {a.keyPhrases?.length > 0 && (
            <div className="dt-agent-section">
              <div className="dt-agent-section-title">Key Phrases</div>
              <div className="dt-agent-tags">
                {a.keyPhrases.map((p, i) => (
                  <span key={i} className="dt-agent-tag phrase">{p.text}</span>
                ))}
              </div>
            </div>
          )}
          {a.language && (
            <div className="dt-agent-meta">Language: {a.language.code} ({(a.language.score * 100).toFixed(0)}%)</div>
          )}
        </div>
      </div>
    )
  }

  if (r.type === 'extract') {
    return (
      <div className="dt-agent-card">
        <div className="dt-agent-card-header">
          <span className="dt-agent-badge">/{cmd}</span>
          <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
        </div>
        <div className="dt-agent-card-body">
          <div className="dt-agent-meta">{r.documentCount} doc(s), {r.characterCount?.toLocaleString()} characters</div>
          <pre className="dt-agent-pre">{r.extractedText?.substring(0, 3000)}{r.extractedText?.length > 3000 ? '\n\n[truncated]' : ''}</pre>
        </div>
      </div>
    )
  }

  if (r.type === 'translate') {
    return (
      <div className="dt-agent-card">
        <div className="dt-agent-card-header">
          <span className="dt-agent-badge">/{cmd}</span>
          <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
        </div>
        <div className="dt-agent-card-body">
          <div className="dt-agent-meta">{r.sourceLanguage} &rarr; {r.targetLanguage}</div>
          <div className="dt-agent-translate-text">{r.translatedText}</div>
        </div>
      </div>
    )
  }

  if (r.type === 'todo' && r.items) {
    return (
      <div className="dt-agent-card">
        <div className="dt-agent-card-header">
          <span className="dt-agent-badge">/{cmd}</span>
          <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
        </div>
        <div className="dt-agent-card-body">
          {r.items.length === 0 && (
            <div className="dt-agent-meta">No action items found.</div>
          )}
          {r.items.map((item, i) => (
            <div
              key={i}
              style={{ display: 'flex', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f0eef4' }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  minWidth: '50px',
                  color: item.priority === 'high' ? '#c0392b' : item.priority === 'low' ? '#8a8f98' : '#b8860b',
                }}
              >
                {item.priority}
              </span>
              <span style={{ flex: 1 }}>
                {item.task}
                {item.owner ? ` — ${item.owner}` : ''}
                {item.due ? ` (${item.due})` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (r.type === 'litstudy') {
    return (
      <div className="dt-agent-card">
        <div className="dt-agent-card-header">
          <span className="dt-agent-badge">/{cmd}</span>
          <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
        </div>
        <div className="dt-agent-card-body">
          <LitStudyResult result={r} />
        </div>
      </div>
    )
  }

  if (r.type === 'ask' && r.ragSources?.length > 0) {
    return (
      <div className="dt-agent-card">
        <div className="dt-agent-card-header">
          <span className="dt-agent-badge">/{cmd}</span>
          <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
        </div>
        <div className="dt-agent-card-body">
          <div className="dt-agent-rag-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', background: '#232f3e', color: '#ff9900', borderRadius: '4px', fontSize: '11px', fontWeight: 600, marginBottom: '10px' }}>
            RAG — {r.retrievedChunks} source{r.retrievedChunks !== 1 ? 's' : ''} retrieved
          </div>
          <div
            className="dt-agent-answer dt-md"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(r.answer || r.summary || '') }}
          />
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e8e6ee' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8a8f98', marginBottom: '6px', textTransform: 'uppercase' }}>Sources Retrieved</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {r.ragSources.map((s, i) => (
                <span key={i} style={{ fontSize: '11px', padding: '2px 8px', background: s.source === 'knowledge-base' ? '#232f3e' : s.source === 'lab-memory' ? '#1d8102' : s.source === 'meeting' ? '#0073bb' : '#8a8f98', color: '#fff', borderRadius: '3px' }}>
                  [{s.index}] {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dt-agent-card">
      <div className="dt-agent-card-header">
        <span className="dt-agent-badge">/{cmd}</span>
        <span className="dt-agent-services">{r.servicesUsed?.join(' + ')}</span>
      </div>
      <div className="dt-agent-card-body">
        <div
          className="dt-agent-answer dt-md"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(r.answer || r.summary || '') }}
        />
      </div>
    </div>
  )
}

function DiscussionThread({ onEntriesReady }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [selection, setSelection] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionStartPos, setMentionStartPos] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [commandQuery, setCommandQuery] = useState(null)
  const [commandIndex, setCommandIndex] = useState(0)
  const [agentProcessing, setAgentProcessing] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState(null)

  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const pollRef = useRef(null)
  const msgIdsRef = useRef(new Set())
  const dragCounterRef = useRef(0)
  const localAttachmentsMapRef = useRef({})
  const userReactedRef = useRef({})

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('bb-user-reactions') || '{}')
      const result = {}
      for (const [sk, arr] of Object.entries(stored)) result[sk] = new Set(arr)
      userReactedRef.current = result
    } catch {}
    loadMessages()
    pollRef.current = setInterval(pollNewMessages, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (!emojiPickerMsgId) return
    function closeOnOutsideClick() { setEmojiPickerMsgId(null) }
    document.addEventListener('click', closeOnOutsideClick)
    return () => document.removeEventListener('click', closeOnOutsideClick)
  }, [emojiPickerMsgId])

  useEffect(() => {
    const entries = selectedMessages().map((m) => ({ speaker: m.speaker, text: m.text }))
    onEntriesReady(entries)
  }, [messages, selection])

  function selectedMessages() {
    if (!selection) return messages
    return messages.slice(selection.from, selection.to + 1)
  }

  async function loadMessages() {
    setLoadError('')
    try {
      const result = await getDiscussionMessages()
      msgIdsRef.current = new Set(result.map((m) => m.id || m.sk))
      setMessages(result)
      scrollToBottom()
    } catch (err) {
      setLoadError(err.message || 'Failed to load messages.')
    }
  }

  async function pollNewMessages() {
    try {
      const result = await getDiscussionMessages()
      setMessages((prev) => {
        const existingIds = msgIdsRef.current
        const newMsgs = result.filter((m) => !existingIds.has(m.id || m.sk))
        if (newMsgs.length === 0 && result.length === prev.length) return prev
        newMsgs.forEach((m) => existingIds.add(m.id || m.sk))
        if (newMsgs.length > 0 && !isAtBottom) {
          setNewMsgCount((c) => c + newMsgs.length)
        } else if (newMsgs.length > 0) {
          setTimeout(scrollToBottom, 50)
        }
        return result
      })
    } catch {
      // silent fail on poll
    }
  }

  function handleScroll() {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 60
    setIsAtBottom(atBottom)
    if (atBottom) setNewMsgCount(0)
  }

  function scrollToBottom() {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    setNewMsgCount(0)
  }

  async function handleSend(e) {
    if (e) e.preventDefault()
    const text = draft.trim()
    if (!text && attachments.length === 0) return
    if (sending || agentProcessing) return
    setSending(true)
    setSendError('')
    try {
      let s3Attachments = []
      for (const att of attachments) {
        let uploadedKey = null
        try {
          const { uploadUrl, key } = await getUploadUrl(att.name, att.type || 'application/octet-stream')
          await uploadFileToS3(uploadUrl, att.file)
          uploadedKey = key
        } catch {
          // fall back to text-only if S3 upload fails
        }
        if (uploadedKey) {
          s3Attachments.push({ key: uploadedKey, name: att.name, type: att.type, size: att.size })
        }
      }

      const msgText = text || `Shared ${s3Attachments.length || attachments.length} file${attachments.length > 1 ? 's' : ''}`
      const msg = await postDiscussionMessage(msgText, s3Attachments, replyTo)
      setReplyTo(null)

      attachments.forEach((a) => { if (a.url) URL.revokeObjectURL(a.url) })

      setDraft('')
      setAttachments([])
      setMessages((prev) => {
        msgIdsRef.current.add(msg.id || msg.sk)
        return [...prev, msg]
      })
      setTimeout(scrollToBottom, 50)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      const parsed = parseCommand(text, messages)
      if (parsed) {
        setAgentProcessing(parsed.command)
        setSending(false)
        try {
          await runAgentCommand(parsed, false)
        } catch (err) {
          setSendError(err.message || `/${parsed.command} failed.`)
        } finally {
          setAgentProcessing(null)
        }
        return
      }
    } catch (err) {
      setSendError(err.message || 'Failed to send.')
    } finally {
      setSending(false)
    }
  }

  // Runs an agent command and handles both guardrails:
  //  - requiresApproval: confirm reading the file, then re-run approved
  //  - blocked: surface a sensitive-content notice, do not proceed
  async function runAgentCommand(parsed, approved) {
    const data = await executeAgentCommand(
      parsed.command,
      parsed.targets,
      parsed.query,
      '',
      approved,
    )

    const g = data.guardrail
    if (g?.requiresApproval) {
      const fileList = (g.files || []).join(', ')
      const ok = window.confirm(
        `${g.reason}\n\nFile(s): ${fileList}\n\nSend these contents to the AI model?`,
      )
      if (ok) {
        await runAgentCommand(parsed, true)
      } else {
        setSendError('Command cancelled - file was not sent to the AI model.')
      }
      return
    }

    if (g?.blocked) {
      const types = (g.highSeverityTypes || g.entityTypes || []).join(', ')
      setSendError(
        `${g.reason}${types ? ` (detected: ${types})` : ''}`,
      )
      return
    }

    const agentMsg = data.message
    if (agentMsg) {
      setMessages((prev) => {
        msgIdsRef.current.add(agentMsg.id || agentMsg.sk)
        return [...prev, agentMsg]
      })
      setTimeout(scrollToBottom, 50)
    }
  }

  function handleReply(msg) {
    const text = msg.entity === 'agent-response'
      ? (msg.agentResult?.summary || msg.text || '')
      : (msg.text || '')
    setReplyTo({ sk: msg.sk, id: msg.id || msg.sk, text, speaker: msg.speaker || '' })
    textareaRef.current?.focus()
    setEmojiPickerMsgId(null)
  }

  async function handleReact(msg, emoji) {
    const sk = msg.sk
    const msgId = msg.id || msg.sk
    if (!sk) return
    const set = userReactedRef.current[sk] || (userReactedRef.current[sk] = new Set())
    const alreadyReacted = set.has(emoji)
    const delta = alreadyReacted ? -1 : 1

    if (alreadyReacted) set.delete(emoji); else set.add(emoji)
    try {
      const stored = {}
      for (const [s, st] of Object.entries(userReactedRef.current)) stored[s] = [...st]
      localStorage.setItem('bb-user-reactions', JSON.stringify(stored))
    } catch {}

    setMessages((prev) => prev.map((m) => {
      if ((m.id || m.sk) !== msgId) return m
      const reactions = { ...(m.reactions || {}) }
      reactions[emoji] = Math.max(0, (reactions[emoji] || 0) + delta)
      return { ...m, reactions }
    }))

    setEmojiPickerMsgId(null)

    try {
      await reactToMessage(sk, emoji, !alreadyReacted)
    } catch {
      if (alreadyReacted) set.add(emoji); else set.delete(emoji)
      setMessages((prev) => prev.map((m) => {
        if ((m.id || m.sk) !== msgId) return m
        const reactions = { ...(m.reactions || {}) }
        reactions[emoji] = Math.max(0, (reactions[emoji] || 0) - delta)
        return { ...m, reactions }
      }))
    }
  }

  async function handleDelete(msg) {
    const sk = msg.sk
    const msgId = msg.id || msg.sk
    if (!sk) return
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => (m.id || m.sk) !== msgId))
    msgIdsRef.current.delete(msgId)
    try {
      await deleteDiscussionMessage(sk)
    } catch (err) {
      // Restore list on failure
      loadMessages()
      setSendError(err.message || 'Failed to delete message.')
    }
  }

  function handleTextareaChange(e) {
    const val = e.target.value
    setDraft(val)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'

    if (val.startsWith('/')) {
      const firstSpace = val.indexOf(' ')
      if (firstSpace === -1) {
        setCommandQuery(val.substring(1).toLowerCase())
        setCommandIndex(0)
      } else {
        setCommandQuery(null)
      }
    } else {
      setCommandQuery(null)
    }

    const pos = el.selectionStart
    const textBefore = val.substring(0, pos)
    const atIdx = textBefore.lastIndexOf('@')
    if (atIdx !== -1 && (atIdx === 0 || /[\s\n]/.test(textBefore[atIdx - 1]))) {
      const query = textBefore.substring(atIdx + 1)
      if (!query.includes(' ') || query.length < 20) {
        setMentionQuery(query.toLowerCase())
        setMentionStartPos(atIdx)
        setMentionIndex(0)
        return
      }
    }
    setMentionQuery(null)
    setMentionStartPos(null)
  }

  function filteredCommands() {
    if (commandQuery === null) return []
    if (commandQuery === '') return COMMANDS
    return COMMANDS.filter((c) => c.name.startsWith(commandQuery))
  }

  function insertCommand(cmd) {
    setDraft('/' + cmd.name + ' ')
    setCommandQuery(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    if (commandQuery !== null) {
      const cmds = filteredCommands()
      if (e.key === 'ArrowDown') { e.preventDefault(); setCommandIndex((i) => Math.min(i + 1, cmds.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCommandIndex((i) => Math.max(i - 1, 0)); return }
      if ((e.key === 'Enter' || e.key === 'Tab') && cmds.length > 0) { e.preventDefault(); insertCommand(cmds[commandIndex]); return }
      if (e.key === 'Escape') { setCommandQuery(null); return }
    }
    if (mentionQuery !== null) {
      const filtered = filteredMembers()
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return }
      if ((e.key === 'Enter' || e.key === 'Tab') && filtered.length > 0) { e.preventDefault(); insertMention(filtered[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionStartPos(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function insertMention(item) {
    const before = draft.substring(0, mentionStartPos)
    const afterCursor = textareaRef.current ? textareaRef.current.selectionStart : draft.length
    const after = draft.substring(afterCursor)

    let insertion
    if (item._kind === 'document') {
      insertion = `@doc:${item.name}`
    } else if (item._kind === 'message') {
      insertion = `@msg:${item.index}`
    } else {
      insertion = `@${item.name}`
    }

    const newDraft = `${before}${insertion} ${after}`
    setDraft(newDraft)
    setMentionQuery(null)
    setMentionStartPos(null)
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + insertion.length + 1
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  // In command mode (@doc: / @msg: targets), returns docs + messages from the thread.
  // In normal mode, returns team members for @mention.
  function filteredMentionItems() {
    if (mentionQuery === null) return []
    const inCommand = draft.trimStart().startsWith('/')

    if (!inCommand) {
      if (mentionQuery === '') return TEAM_MEMBERS.map((m) => ({ ...m, _kind: 'person' }))
      return TEAM_MEMBERS.filter(
        (m) => m.name.toLowerCase().includes(mentionQuery) || m.role.toLowerCase().includes(mentionQuery)
      ).map((m) => ({ ...m, _kind: 'person' }))
    }

    // Collect unique documents from all messages
    const seen = new Set()
    const docs = []
    for (const msg of messages) {
      for (const att of msg.attachments || []) {
        if (att.name && !seen.has(att.name)) {
          seen.add(att.name)
          docs.push({ _kind: 'document', name: att.name, key: att.key || '', fileType: att.type || '', size: att.size || 0, _origType: att.type || '' })
        }
      }
    }

    // All messages as @msg:N targets (1-indexed by raw position)
    const msgTargets = messages
      .map((m, i) => {
        const text = m.entity === 'agent-response'
          ? (m.agentResult?.summary || m.text || '')
          : (m.text || '')
        return { _kind: 'message', index: i + 1, speaker: m.speaker || '', text, isAI: m.entity === 'agent-response' }
      })
      .filter((m) => m.text)

    const combined = [...docs, ...msgTargets]
    if (mentionQuery === '') return combined
    const q = mentionQuery.toLowerCase()
    return combined.filter((item) => {
      if (item._kind === 'document') return item.name.toLowerCase().includes(q) || 'doc'.includes(q)
      return item.text.toLowerCase().includes(q) || item.speaker.toLowerCase().includes(q) || `msg${item.index}`.includes(q)
    })
  }

  // Keep old name as alias so the rest of the code calling filteredMembers() still works
  function filteredMembers() { return filteredMentionItems() }

  function processFiles(files) {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      setAttachments((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, url, file }])
    })
  }

  function handleFilePick(e) { processFiles(e.target.files); e.target.value = '' }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id)
      if (item?.url) URL.revokeObjectURL(item.url)
      return prev.filter((a) => a.id !== id)
    })
  }

  function handleDragEnter(e) { e.preventDefault(); dragCounterRef.current++; setIsDragging(true) }
  function handleDragLeave(e) { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false) } }
  function handleDragOver(e) { e.preventDefault() }
  function handleDrop(e) { e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false); if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files) }

  function toggleRangeMode() {
    if (selection) setSelection(null)
    else if (messages.length > 0) setSelection({ from: 0, to: messages.length - 1 })
  }

  function shouldShowDateSep(index) {
    if (index === 0) return true
    const prev = messages[index - 1]
    const curr = messages[index]
    const prevMs = toMs(prev.createdAt)
    const currMs = toMs(curr.createdAt)
    if (!prevMs || !currMs) return false
    return new Date(prevMs).toDateString() !== new Date(currMs).toDateString()
  }

  const mentionResults = filteredMembers()
  const commandResults = filteredCommands()

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="dt-header">
        <div>
          <span className="dt-kicker">RESEARCH DISCUSSION</span>
          <h2 className="dt-title">Discussion Thread</h2>
        </div>
        <div className="dt-header-right">
          <span className="dt-online-dot" />
          <span style={{ fontSize: '10px', color: '#88848d' }}>Live</span>
          {messages.length > 0 && (
            <button
              onClick={toggleRangeMode}
              className={`dt-date-pill${selection ? ' active' : ''}`}
            >
              {selection
                ? `${selection.to - selection.from + 1} of ${messages.length} selected`
                : `All ${messages.length}`}{' '}
              <b>{selection ? '✕' : '⌄'}</b>
            </button>
          )}
        </div>
      </div>

      {/* Range bar */}
      {selection && (
        <div className="dt-range-bar">
          <span style={{ fontWeight: 700 }}>Analysis range:</span>
          <label>
            From{' '}
            <input
              type="number"
              min={1}
              max={messages.length}
              value={selection.from + 1}
              onChange={(e) => {
                const v = Math.max(0, Math.min(parseInt(e.target.value) - 1 || 0, selection.to))
                setSelection((s) => ({ ...s, from: v }))
              }}
            />
          </label>
          <label>
            To{' '}
            <input
              type="number"
              min={1}
              max={messages.length}
              value={selection.to + 1}
              onChange={(e) => {
                const v = Math.max(selection.from, Math.min(parseInt(e.target.value) - 1 || 0, messages.length - 1))
                setSelection((s) => ({ ...s, to: v }))
              }}
            />
          </label>
          <button className="dt-range-use-all" onClick={() => setSelection(null)}>Use all</button>
        </div>
      )}

      {loadError && <div className="dt-error">{loadError}</div>}

      {/* Composer */}
      <div className="dt-composer-wrap" style={{ position: 'relative', marginBottom: '12px' }}>
        {commandQuery !== null && commandResults.length > 0 && (
          <div className="dt-mentions">
            <div className="dt-mentions-header">AGENT COMMANDS</div>
            {commandResults.map((cmd, i) => (
              <button
                key={cmd.name}
                className={`dt-mention-item${i === commandIndex ? ' highlighted' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); insertCommand(cmd) }}
                onMouseEnter={() => setCommandIndex(i)}
              >
                <div className="dt-cmd-icon">{cmd.icon}</div>
                <div>
                  <div className="dt-mention-item-name">/{cmd.name}</div>
                  <div className="dt-mention-item-role">{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="dt-mentions">
            {mentionResults[0]?._kind === 'person' ? (
              <div className="dt-mentions-header">TEAM MEMBERS</div>
            ) : (
              <div className="dt-mentions-header">THREAD TARGETS — @doc: or @msg:</div>
            )}
            {mentionResults.map((item, i) => (
              <button
                key={item._kind === 'document' ? `doc-${item.name}` : item._kind === 'message' ? `msg-${item.index}` : item.id}
                className={`dt-mention-item${i === mentionIndex ? ' highlighted' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(item) }}
                onMouseEnter={() => setMentionIndex(i)}
              >
                {item._kind === 'document' && (
                  <>
                    <div className="dt-cmd-icon" style={{ background: '#eef5ff', fontSize: '16px' }}>{getFileIcon(item.fileType, item.name)}</div>
                    <div>
                      <div className="dt-mention-item-name">{item.name}</div>
                      <div className="dt-mention-item-role">document &middot; {formatFileSize(item.size) || 'file'}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#9b91c4', fontFamily: 'monospace' }}>@doc:{item.name}</span>
                  </>
                )}
                {item._kind === 'message' && (
                  <>
                    <div className="dt-cmd-icon" style={{ background: item.isAI ? '#f0eafa' : '#f0f7ee', fontSize: '14px' }}>{item.isAI ? '🤖' : '💬'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="dt-mention-item-name">#{item.index} — {item.speaker}{item.isAI ? ' (AI)' : ''}</div>
                      <div className="dt-mention-item-role" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>{item.text.substring(0, 60)}{item.text.length > 60 ? '…' : ''}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#9b91c4', fontFamily: 'monospace' }}>@msg:{item.index}</span>
                  </>
                )}
                {item._kind === 'person' && (
                  <>
                    <div className={`dt-mention-item-avatar ${item.color}`}>{item.initials}</div>
                    <div>
                      <div className="dt-mention-item-name">{item.name}</div>
                      <div className="dt-mention-item-role">{item.role}</div>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        <form
          className={`dt-composer${isDragging ? ' dragging' : ''}`}
          onSubmit={handleSend}
        >
          {isDragging && (
            <div className="dt-drag-overlay">
              <div className="dt-drag-overlay-icon">{'\u{1F4CE}'}</div>
              <div className="dt-drag-overlay-text">Drop files to attach</div>
            </div>
          )}

          {replyTo && (
            <div className="dt-reply-strip">
              <span className="dt-reply-strip-label">↩ Replying to <strong>{replyTo.speaker}</strong></span>
              <span className="dt-reply-strip-preview">{replyTo.text?.substring(0, 80)}{replyTo.text?.length > 80 ? '…' : ''}</span>
              <button type="button" className="dt-reply-strip-close" onClick={() => setReplyTo(null)}>✕</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '11px', padding: '12px 14px 8px' }}>
            <span className="dt-avatar purple" style={{ flexShrink: 0, marginBottom: 2 }}>
              You
            </span>
            <textarea
              ref={textareaRef}
              className="dt-textarea"
              value={draft}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type / for commands, @ to mention, or share an update"
              aria-label="Share a research contribution"
              disabled={sending || !!agentProcessing}
              rows={1}
            />
          </div>

          {attachments.length > 0 && (
            <div className="dt-attach-preview">
              {attachments.map((a) => (
                <div key={a.id} className="dt-attach-chip">
                  {a.type?.startsWith('image/') ? (
                    <img src={a.url} alt={a.name} className="dt-attach-chip-thumb" />
                  ) : (
                    <span className="dt-attach-chip-icon">{getFileIcon(a.type, a.name)}</span>
                  )}
                  <div className="dt-attach-chip-text">
                    <span className="dt-attach-chip-name">{a.name}</span>
                    <span className="dt-attach-chip-size">{formatFileSize(a.size)}</span>
                  </div>
                  <button className="dt-attach-chip-remove" onClick={() => removeAttachment(a.id)} title="Remove">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="dt-toolbar">
            <input ref={fileInputRef} type="file" multiple accept="*/*" style={{ display: 'none' }} onChange={handleFilePick} />
            <button
              type="button"
              className={`dt-tool-btn${attachments.length > 0 ? ' active' : ''}`}
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              {'\u{1F4CE}'}
            </button>
            <button
              type="button"
              className="dt-tool-btn"
              title="Attach image"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'image/*'
                  fileInputRef.current.click()
                  setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = '*/*' }, 100)
                }
              }}
            >
              {'\u{1F5BC}\u{FE0F}'}
            </button>
            <VoiceInput
              onTranscript={(text) => setDraft((d) => (d ? d + ' ' + text : text))}
            />
            <button
              type="button"
              className="dt-tool-btn"
              title={draft.trimStart().startsWith('/') ? 'Add @doc: or @msg: target' : 'Mention someone'}
              onClick={() => {
                const pos = draft.length
                setDraft((d) => d + '@')
                setMentionStartPos(pos)
                setMentionQuery('')
                setMentionIndex(0)
                setTimeout(() => textareaRef.current?.focus(), 0)
              }}
            >
              @
            </button>
            <button
              type="button"
              className={`dt-tool-btn${draft.startsWith('/') ? ' active' : ''}`}
              title="Agent commands"
              onClick={() => {
                setDraft('/')
                setCommandQuery('')
                setCommandIndex(0)
                setTimeout(() => textareaRef.current?.focus(), 0)
              }}
            >
              /
            </button>
            <button
              type="submit"
              className="dt-send-btn"
              title="Post update (Enter)"
              disabled={(!draft.trim() && attachments.length === 0) || sending}
              style={{ marginLeft: 'auto' }}
            >
              {sending ? '...' : '↗'}
            </button>
          </div>
        </form>
      </div>

      {agentProcessing && (
        <div className="dt-agent-processing">
          <div className="dt-agent-processing-spinner" />
          <span>BridgeBoard AI is running <strong>/{agentProcessing}</strong>...</span>
        </div>
      )}

      {sendError && <div className="dt-error">{sendError}</div>}

      {/* Filter row */}
      <div className="dt-filter-row">
        <span>
          {selection
            ? `Showing messages ${selection.from + 1}–${selection.to + 1} of ${messages.length}`
            : `Showing all ${messages.length} updates`}
        </span>
        <button onClick={loadMessages}>Latest first ⌄</button>
      </div>

      {/* Message list */}
      <div
        className="dt-messages"
        ref={listRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 && !loadError && (
          <article className="dt-msg" style={{ textAlign: 'center', color: '#aaa' }}>
            <p style={{ padding: '24px 0' }}>No messages yet. Start the research discussion above.</p>
          </article>
        )}

        {messages.map((msg, index) => {
          const inRange = !selection || (index >= selection.from && index <= selection.to)
          const showDate = shouldShowDateSep(index)
          const msgKey = msg.id || msg.sk
          const files = (msg.attachments && msg.attachments.length > 0)
            ? msg.attachments
            : (localAttachmentsMapRef.current[msgKey] || [])

          return (
            <div key={msg.id || msg.sk || `${msg.createdAt}-${index}`}>
              {showDate && (
                <div className="dt-date-sep">
                  <span>{formatDate(msg.createdAt)}</span>
                </div>
              )}

              <article
                className="dt-msg"
                style={{ opacity: inRange ? 1 : 0.35, transition: 'opacity 0.2s' }}
              >
                <div className="dt-msg-line">
                  <span className={`dt-avatar ${msg.color || 'purple'}`}>
                    {msg.initials || '?'}
                  </span>
                  <div className="dt-msg-main">
                    <div className="dt-msg-meta">
                      <strong>{msg.speaker}</strong>
                      <span className="dt-role">{msg.role || 'Researcher'}</span>
                      <time>{timeAgo(msg.createdAt)}</time>
                    </div>
                    {msg.replyToSk && (
                      <div className="dt-reply-quote">
                        <span className="dt-reply-quote-speaker">{msg.replyToSpeaker}</span>
                        <span className="dt-reply-quote-text">{msg.replyToText}</span>
                      </div>
                    )}

                    {msg.entity !== 'agent-response' && <p>{renderMessageText(msg.text)}</p>}

                    {msg.entity === 'agent-response' && renderAgentResult(msg)}

                    {files.length > 0 && (
                      <div className="dt-attachments">
                        {files.map((f) => {
                          if (f.type?.startsWith('image/')) {
                            return (
                              <img key={f.id} src={f.url} alt={f.name} className="dt-attach-img" onClick={() => setLightboxSrc(f.url)} />
                            )
                          }
                          if (f.type?.startsWith('video/')) {
                            return <video key={f.id} src={f.url} controls className="dt-attach-video" />
                          }
                          if (f.type?.startsWith('audio/')) {
                            return (
                              <div key={f.id} className="dt-attach-file">
                                <span className="dt-attach-file-icon">{'\u{1F3B5}'}</span>
                                <div className="dt-attach-file-info">
                                  <div className="dt-attach-file-name">{f.name}</div>
                                  <div className="dt-attach-file-meta">{formatFileSize(f.size)}</div>
                                  <audio src={f.url} controls style={{ width: '100%', marginTop: '6px', height: '28px' }} />
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={f.id} className="dt-attach-file">
                              <span className="dt-attach-file-icon">{getFileIcon(f.type, f.name)}</span>
                              <div className="dt-attach-file-info">
                                <div className="dt-attach-file-name">{f.name}</div>
                                <div className="dt-attach-file-meta">{formatFileSize(f.size)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="dt-msg-footer">
                      <div className="dt-tags"><span>#research</span></div>
                      {selection && inRange && (
                        <span className="dt-analysis-badge">#{index + 1}</span>
                      )}
                      <div className="dt-reaction-row">
                        {Object.entries(msg.reactions || {})
                          .filter(([, count]) => Number(count) > 0)
                          .map(([emoji, count]) => (
                            <button
                              key={emoji}
                              className={`dt-reaction-badge${userReactedRef.current[msg.sk]?.has(emoji) ? ' active' : ''}`}
                              onClick={() => handleReact(msg, emoji)}
                              title={`${Number(count)} reaction${Number(count) > 1 ? 's' : ''}`}
                            >
                              {emoji} {Number(count)}
                            </button>
                          ))}
                        <div className="dt-emoji-wrap">
                          <button
                            className="dt-reaction-add"
                            onClick={(e) => { e.stopPropagation(); setEmojiPickerMsgId(emojiPickerMsgId === msgKey ? null : msgKey) }}
                            title="React"
                          >
                            {'\u{1F60A}'}
                          </button>
                          {emojiPickerMsgId === msgKey && (
                            <div className="dt-emoji-picker">
                              {REACTION_EMOJIS.map((e) => (
                                <button key={e} className="dt-emoji-opt" onClick={(ev) => { ev.stopPropagation(); handleReact(msg, e) }}>{e}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button className="dt-reply" onClick={() => handleReply(msg)}>↩ Reply</button>
                    </div>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="dt-actions">
                  <button className="dt-action-btn" title="React" onClick={(e) => { e.stopPropagation(); setEmojiPickerMsgId(emojiPickerMsgId === msgKey ? null : msgKey) }}>{'\u{1F60A}'}</button>
                  <button className="dt-action-btn" title="Reply" onClick={() => handleReply(msg)}>{'\u{1F4AC}'}</button>
                  <button
                    className="dt-action-btn dt-action-delete"
                    title="Delete message"
                    onClick={() => handleDelete(msg)}
                  >
                    🗑
                  </button>
                </div>

                {index === 0 && messages.length > 0 && (
                  <div className="dt-thread-note">
                    ✦ AI agents can analyze this discussion <span>Select range to focus →</span>
                  </div>
                )}
              </article>
            </div>
          )
        })}

        {newMsgCount > 0 && (
          <div className="dt-new-banner" onClick={scrollToBottom}>
            ↓ {newMsgCount} new message{newMsgCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {lightboxSrc && (
        <div className="dt-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Full size" />
        </div>
      )}
    </div>
  )
}

export default DiscussionThread
