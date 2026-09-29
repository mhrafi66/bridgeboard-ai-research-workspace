import { useEffect, useRef, useState } from 'react'
import {
  API_BASE_URL,
  getAuthHeaders,
  listMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  startTranscription,
  pollTranscription,
  executeAgentCommand,
} from '../../lib/api'
import LitStudyResult from '../shared/LitStudyResult'

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 60

const MODEL_ID = 'us.anthropic.claude-sonnet-4-6'

// Every agent command is available here too, matching the Research Room.
const ROOM_COMMANDS = [
  { name: 'ask', label: 'Ask', hint: 'Ask a question about the transcript' },
  { name: 'summarize', label: 'Summarize', hint: 'Summarize the meeting' },
  { name: 'analyze', label: 'Analyze', hint: 'Sentiment, entities, key phrases' },
  { name: 'search', label: 'Search', hint: 'Research a topic' },
  { name: 'translate', label: 'Translate', hint: 'Translate the transcript (add a language code)' },
  { name: 'todo', label: 'To-do', hint: 'Generate a to-do list' },
  { name: 'litstudy', label: 'Lit study', hint: 'Find and synthesize real papers' },
  { name: 'remember', label: 'Remember', hint: 'Save a finding or insight to Lab Memory' },
]

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Convert stored/parsed speaker turns into research entries using the
// current label -> display-name mapping (spk_0 -> "Maria", etc.).
function turnsToEntries(turns, speakerNames) {
  return (turns || []).map((turn) => ({
    speaker: speakerNames?.[turn.speaker] || turn.speaker || 'Speaker',
    text: turn.text,
  }))
}

function PrivateRoomPage({ room }) {
  const [meetings, setMeetings] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selectedSk, setSelectedSk] = useState(null)

  // New-meeting form
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [meetingType, setMeetingType] = useState('physical')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [creating, setCreating] = useState(false)

  // Recording / transcription
  const [recording, setRecording] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState('')
  const [transcribeError, setTranscribeError] = useState('')
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  // Per-meeting local edits to speaker names (label -> name)
  const [nameDraft, setNameDraft] = useState({})

  // AI analysis
  const [aiBusy, setAiBusy] = useState('')
  const [aiError, setAiError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [critic, setCritic] = useState(null)
  const [facilitator, setFacilitator] = useState(null)
  const [todo, setTodo] = useState(null)

  // General slash-command runner (mirrors the Research Room)
  const [cmdName, setCmdName] = useState('ask')
  const [cmdQuery, setCmdQuery] = useState('')
  const [cmdBusy, setCmdBusy] = useState(false)
  const [cmdError, setCmdError] = useState('')
  const [cmdResults, setCmdResults] = useState([])

  const selectedMeeting = meetings.find((m) => m.sk === selectedSk) || null

  useEffect(() => {
    loadRoomMeetings()
    // Reset transient AI state when switching rooms.
    setSelectedSk(null)
    resetAi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roomId])

  useEffect(() => {
    // When the selected meeting changes, seed the name draft from stored names.
    if (selectedMeeting) {
      setNameDraft(selectedMeeting.speakerNames || {})
      resetAi()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSk])

  function resetAi() {
    setAnalysis(null)
    setCritic(null)
    setFacilitator(null)
    setTodo(null)
    setAiError('')
    setAiBusy('')
    setCmdResults([])
    setCmdError('')
  }

  async function loadRoomMeetings() {
    if (!room?.roomId) return
    setLoadError('')
    if (!API_BASE_URL) {
      setLoadError('The live API is not configured. Deploy or set VITE_API_URL.')
      return
    }
    try {
      const result = await listMeetings(room.roomId)
      setMeetings(result)
    } catch (err) {
      setLoadError(err.message || 'Failed to load meetings.')
    }
  }

  async function handleCreateMeeting(e) {
    e.preventDefault()
    if (title.trim().length < 2) return
    setCreating(true)
    setLoadError('')
    try {
      const meeting = await createMeeting(room.roomId, {
        title: title.trim(),
        meetingType,
        date,
        location,
      })
      setMeetings((prev) => [meeting, ...prev])
      setSelectedSk(meeting.sk)
      setTitle('')
      setDate('')
      setLocation('')
      setMeetingType('physical')
      setShowForm(false)
    } catch (err) {
      setLoadError(err.message || 'Failed to create meeting.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteMeeting(meeting) {
    try {
      await deleteMeeting(room.roomId, meeting.sk)
      setMeetings((prev) => prev.filter((m) => m.sk !== meeting.sk))
      if (selectedSk === meeting.sk) setSelectedSk(null)
    } catch (err) {
      setLoadError(err.message || 'Failed to delete meeting.')
    }
  }

  // === Recording + diarized transcription ===

  async function processAudio(blob) {
    setTranscribeError('')
    setTranscribeStatus('Uploading...')
    try {
      const base64 = await blobToBase64(blob)
      const ext = blob.type?.includes('wav')
        ? 'wav'
        : blob.type?.includes('mp3') || blob.type?.includes('mpeg')
          ? 'mp3'
          : 'webm'

      setTranscribeStatus('Transcribing with speaker labels...')
      const job = await startTranscription(base64, ext, 'auto', 2)

      let polls = 0
      while (polls < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        polls++
        const result = await pollTranscription(job.jobName)

        if (result.status === 'COMPLETED') {
          setTranscribeStatus('')
          const turns = result.speakerTurns || []
          // Seed a default name mapping for detected labels.
          const labels = [...new Set(turns.map((t) => t.speaker))]
          const names = { ...(selectedMeeting?.speakerNames || {}) }
          labels.forEach((label, i) => {
            if (!names[label]) names[label] = `Speaker ${i + 1}`
          })
          const saved = await updateMeeting(room.roomId, selectedMeeting.sk, {
            transcript: result.transcript || '',
            speakerTurns: turns,
            speakerNames: names,
          })
          setMeetings((prev) =>
            prev.map((m) => (m.sk === saved.sk ? saved : m)),
          )
          setNameDraft(names)
          return
        }
        if (result.status === 'FAILED') {
          throw new Error(result.error || 'Transcription failed.')
        }
        setTranscribeStatus(`Transcribing... (${polls * 3}s)`)
      }
      throw new Error('Transcription timed out.')
    } catch (err) {
      setTranscribeError(err.message || 'Transcription failed.')
      setTranscribeStatus('')
    }
  }

  async function toggleRecording() {
    if (!selectedMeeting) return
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }
    setTranscribeError('')
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined,
      })
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
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
      setTranscribeError('Microphone access was denied.')
    }
  }

  function handleAudioFile(e) {
    const file = e.target.files?.[0]
    if (file && selectedMeeting) processAudio(file)
    e.target.value = ''
  }

  // === Speaker name mapping ===

  async function saveSpeakerNames() {
    if (!selectedMeeting) return
    try {
      const saved = await updateMeeting(room.roomId, selectedMeeting.sk, {
        speakerNames: nameDraft,
      })
      setMeetings((prev) => prev.map((m) => (m.sk === saved.sk ? saved : m)))
    } catch (err) {
      setTranscribeError(err.message || 'Failed to save speaker names.')
    }
  }

  // === AI analysis over the transcript ===

  function currentEntries() {
    return turnsToEntries(
      selectedMeeting?.speakerTurns,
      selectedMeeting?.speakerNames,
    )
  }

  async function callResearch(pathSuffix, extraBody, setter, busyLabel) {
    const entries = currentEntries()
    if (entries.length < 1) {
      setAiError('Record and transcribe the meeting first.')
      return
    }
    if (!API_BASE_URL) {
      setAiError('The live API is not configured.')
      return
    }
    setAiBusy(busyLabel)
    setAiError('')
    try {
      const result = await fetch(`${API_BASE_URL}${pathSuffix}`, {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId: MODEL_ID, entries, ...extraBody }),
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error || 'AI request failed.')
      setter(data)
    } catch (err) {
      setAiError(err.message || 'AI request failed.')
    } finally {
      setAiBusy('')
    }
  }

  function runAnalyze() {
    callResearch(
      '/research/analyze-discussion',
      {},
      (d) => setAnalysis(d.analysis),
      'analyze',
    )
  }

  function runCritic() {
    callResearch(
      '/research/critic',
      { analysis },
      (d) => setCritic(d.critic),
      'critic',
    )
  }

  function runFacilitator() {
    callResearch(
      '/research/facilitator',
      { analysis, critic },
      (d) => setFacilitator(d.facilitator),
      'facilitator',
    )
  }

  async function runTodo() {
    const entries = currentEntries()
    if (entries.length < 1) {
      setAiError('Record and transcribe the meeting first.')
      return
    }
    setAiBusy('todo')
    setAiError('')
    try {
      const conversation = entries
        .map((e) => `${e.speaker}: ${e.text}`)
        .join('\n')
      const data = await executeAgentCommand(
        'todo',
        [{ type: 'message', text: conversation, name: 'meeting' }],
        '',
        MODEL_ID,
      )
      if (data.guardrail?.blocked) {
        setAiError(
          `${data.guardrail.reason}${
            data.guardrail.highSeverityTypes?.length
              ? ` (detected: ${data.guardrail.highSeverityTypes.join(', ')})`
              : ''
          }`,
        )
        return
      }
      setTodo(data.message?.agentResult)
    } catch (err) {
      setAiError(err.message || '/todo failed.')
    } finally {
      setAiBusy('')
    }
  }

  // Run ANY agent command against the meeting transcript, mirroring
  // the Research Room. The transcript is passed as a message target so
  // commands like /ask, /summarize, /translate, /litstudy all work.
  async function runCommand(e) {
    if (e) e.preventDefault()
    const entries = currentEntries()
    const conversation = entries
      .map((en) => `${en.speaker}: ${en.text}`)
      .join('\n')

    // Commands that need source text require a transcript; /search and
    // /litstudy can run from the typed query alone.
    const needsTranscript = !['search', 'litstudy'].includes(cmdName)
    if (needsTranscript && entries.length < 1) {
      setCmdError('Record and transcribe the meeting first.')
      return
    }
    if (cmdName === 'search' && !cmdQuery.trim() && entries.length < 1) {
      setCmdError('Enter a topic to search.')
      return
    }

    setCmdBusy(true)
    setCmdError('')
    try {
      const targets =
        conversation && needsTranscript
          ? [{ type: 'message', text: conversation, name: 'meeting' }]
          : conversation && cmdName === 'litstudy' && !cmdQuery.trim()
            ? [{ type: 'message', text: conversation, name: 'meeting' }]
            : []
      const data = await executeAgentCommand(
        cmdName,
        targets,
        cmdQuery.trim(),
        MODEL_ID,
      )
      const g = data.guardrail
      if (g?.requiresApproval) {
        const ok = window.confirm(
          `${g.reason}\n\nFile(s): ${(g.files || []).join(', ')}\n\nSend to the AI model?`,
        )
        if (!ok) {
          setCmdError('Command cancelled - file was not sent to the AI model.')
          return
        }
        const approvedData = await executeAgentCommand(
          cmdName,
          targets,
          cmdQuery.trim(),
          MODEL_ID,
          true,
        )
        if (approvedData.message?.agentResult) {
          setCmdResults((prev) => [approvedData.message.agentResult, ...prev])
          setCmdQuery('')
        }
        return
      }
      if (g?.blocked) {
        setCmdError(
          `${g.reason}${
            g.highSeverityTypes?.length
              ? ` (detected: ${g.highSeverityTypes.join(', ')})`
              : ''
          }`,
        )
        return
      }
      if (data.message?.agentResult) {
        setCmdResults((prev) => [data.message.agentResult, ...prev])
        setCmdQuery('')
      }
    } catch (err) {
      setCmdError(err.message || `/${cmdName} failed.`)
    } finally {
      setCmdBusy(false)
    }
  }

  const entries = currentEntries()
  const speakerLabels = [
    ...new Set((selectedMeeting?.speakerTurns || []).map((t) => t.speaker)),
  ]

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#0073bb',
          }}
        >
          PRIVATE ROOM
        </div>
        <h1 style={{ margin: '4px 0' }}>{room?.name || 'Private room'}</h1>
        <p style={{ color: '#65616b', fontSize: '14px' }}>
          {(room?.members || []).map((m) => m.name).join(', ')}
        </p>
      </div>

      {loadError && (
        <div className="api-error" style={{ marginBottom: '16px' }}>
          {loadError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Meetings list */}
        <div style={{ flex: '0 0 280px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <strong style={{ fontSize: '13px' }}>Meetings</strong>
            <button
              onClick={() => setShowForm((s) => !s)}
              style={{
                border: '1px solid #b5d6e9',
                background: '#e9f3fa',
                color: '#0073bb',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {showForm ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreateMeeting}
              style={{
                border: '1px solid #e0ddd9',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
                style={{ padding: '6px 8px', fontSize: '13px' }}
              />
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '13px' }}
              >
                <option value="physical">Physical (in person)</option>
                <option value="zoom">Zoom / online</option>
              </select>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '13px' }}
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={
                  meetingType === 'zoom' ? 'Meeting link' : 'Location'
                }
                style={{ padding: '6px 8px', fontSize: '13px' }}
              />
              <button
                type="submit"
                disabled={creating || title.trim().length < 2}
                style={{
                  padding: '6px 8px',
                  background: '#0073bb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {creating ? 'Adding...' : 'Add meeting'}
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {meetings.length === 0 && (
              <p style={{ color: '#9b969f', fontSize: '13px' }}>
                No meetings yet. Add one to start recording.
              </p>
            )}
            {meetings.map((m) => (
              <div
                key={m.sk}
                onClick={() => setSelectedSk(m.sk)}
                style={{
                  border:
                    selectedSk === m.sk
                      ? '1px solid #0073bb'
                      : '1px solid #e0ddd9',
                  background: selectedSk === m.sk ? '#e9f3fa' : '#fff',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <strong style={{ fontSize: '13px' }}>{m.title}</strong>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation()
                      handleDeleteMeeting(m)
                    }}
                    title="Delete meeting"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#c0392b',
                    }}
                  >
                    🗑
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#88848d' }}>
                  {m.meetingType === 'zoom' ? '💻 Zoom' : '📍 Physical'}
                  {m.date ? ` · ${m.date}` : ''}
                  {m.speakerTurns?.length ? ' · transcribed' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meeting detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedMeeting && (
            <p style={{ color: '#9b969f' }}>
              Select or add a meeting to record and transcribe it.
            </p>
          )}

          {selectedMeeting && (
            <div>
              <h2 style={{ marginTop: 0 }}>{selectedMeeting.title}</h2>

              {/* Recording controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={toggleRecording}
                  disabled={!!transcribeStatus}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: recording
                      ? '1px solid #e6baba'
                      : '1px solid #b5d6e9',
                    color: recording ? '#c0392b' : '#0073bb',
                    background: recording ? '#fff8f7' : '#e9f3fa',
                    cursor: transcribeStatus ? 'wait' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {recording ? '⏹ Stop recording' : '🎤 Record meeting'}
                </button>
                <label
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #b5d6e9',
                    color: '#0073bb',
                    background: '#e9f3fa',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  📁 Upload audio
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFile}
                    disabled={!!transcribeStatus}
                    style={{ display: 'none' }}
                  />
                </label>
                {transcribeStatus && (
                  <small style={{ color: '#0073bb' }}>{transcribeStatus}</small>
                )}
                {transcribeError && (
                  <small style={{ color: '#a04f48' }}>{transcribeError}</small>
                )}
              </div>

              {/* Speaker name mapping */}
              {speakerLabels.length > 0 && (
                <div
                  style={{
                    border: '1px solid #e0ddd9',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '8px',
                    }}
                  >
                    Who is who? (map detected speakers to names)
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    {speakerLabels.map((label) => (
                      <label
                        key={label}
                        style={{ fontSize: '13px', color: '#65616b' }}
                      >
                        <span style={{ fontFamily: 'monospace' }}>{label}</span>{' '}
                        →{' '}
                        <input
                          value={nameDraft[label] || ''}
                          onChange={(e) =>
                            setNameDraft((prev) => ({
                              ...prev,
                              [label]: e.target.value,
                            }))
                          }
                          placeholder="name"
                          style={{ padding: '4px 6px', fontSize: '13px' }}
                        />
                      </label>
                    ))}
                    <button
                      onClick={saveSpeakerNames}
                      style={{
                        padding: '5px 10px',
                        background: '#0073bb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Save names
                    </button>
                  </div>
                </div>
              )}

              {/* Transcript */}
              {entries.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '8px',
                    }}
                  >
                    Transcript
                  </div>
                  <div
                    style={{
                      border: '1px solid #e0ddd9',
                      borderRadius: '8px',
                      padding: '12px',
                      maxHeight: '260px',
                      overflowY: 'auto',
                    }}
                  >
                    {entries.map((entry, i) => (
                      <p key={i} style={{ margin: '0 0 8px' }}>
                        <strong style={{ color: '#0073bb' }}>
                          {entry.speaker}:
                        </strong>{' '}
                        {entry.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* AI actions */}
              {entries.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                  }}
                >
                  {[
                    ['analyze', 'Analyze', runAnalyze],
                    ['critic', 'Critique', runCritic],
                    ['facilitator', 'Facilitator', runFacilitator],
                    ['todo', 'Generate to-do list', runTodo],
                  ].map(([id, label, fn]) => (
                    <button
                      key={id}
                      onClick={fn}
                      disabled={!!aiBusy}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: '1px solid #b5d6e9',
                        background: aiBusy === id ? '#e9f3fa' : '#e9f3fa',
                        color: '#0073bb',
                        cursor: aiBusy ? 'wait' : 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {aiBusy === id ? `${label}...` : label}
                    </button>
                  ))}
                </div>
              )}

              {aiError && (
                <div className="api-error" style={{ marginBottom: '12px' }}>
                  {aiError}
                </div>
              )}

              {/* General command runner - every command, like the Research Room */}
              <div style={cardStyle}>
                <div style={cardTitleStyle}>Run a command</div>
                <form
                  onSubmit={runCommand}
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <select
                    value={cmdName}
                    onChange={(e) => setCmdName(e.target.value)}
                    style={{ padding: '7px 8px', fontSize: '13px' }}
                  >
                    {ROOM_COMMANDS.map((c) => (
                      <option key={c.name} value={c.name}>
                        /{c.name} — {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={cmdQuery}
                    onChange={(e) => setCmdQuery(e.target.value)}
                    placeholder={
                      ROOM_COMMANDS.find((c) => c.name === cmdName)?.hint || ''
                    }
                    style={{ flex: 1, minWidth: '200px', padding: '7px 9px', fontSize: '13px' }}
                  />
                  <button
                    type="submit"
                    disabled={cmdBusy}
                    style={{
                      padding: '7px 14px',
                      background: '#0073bb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: cmdBusy ? 'wait' : 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    {cmdBusy ? 'Running...' : 'Run'}
                  </button>
                </form>
                {cmdError && (
                  <div className="api-error" style={{ marginTop: '8px' }}>
                    {cmdError}
                  </div>
                )}
              </div>

              {cmdResults.map((res, i) => (
                <div key={i} style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={cardTitleStyle}>/{res.type}</span>
                    <small style={{ color: '#9b969f' }}>
                      {res.servicesUsed?.join(' + ')}
                    </small>
                  </div>
                  {res.guardrail?.flagged && (
                    <div
                      style={{
                        background: '#fff7ed',
                        border: '1px solid #f3cfa0',
                        color: '#9a5b1a',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        marginBottom: '8px',
                      }}
                      title="Detected by Amazon Comprehend"
                    >
                      ⚠ Sensitive content detected (
                      {(res.guardrail.entityTypes || []).join(', ')}). Handle with care.
                    </div>
                  )}
                  {res.type === 'litstudy' ? (
                    <LitStudyResult result={res} />
                  ) : res.type === 'todo' && res.items ? (
                    res.items.map((item, j) => (
                      <div key={j} style={{ padding: '4px 0' }}>
                        <strong style={{ textTransform: 'uppercase', fontSize: '10px', color: '#0073bb' }}>
                          {item.priority}
                        </strong>{' '}
                        {item.task}
                        {item.owner ? ` — ${item.owner}` : ''}
                        {item.due ? ` (${item.due})` : ''}
                      </div>
                    ))
                  ) : res.type === 'analyze' && res.analysis ? (
                    <div style={{ fontSize: '13px' }}>
                      {res.analysis.sentiment && (
                        <div>Sentiment: {res.analysis.sentiment.label}</div>
                      )}
                      {res.analysis.keyPhrases?.length > 0 && (
                        <div>
                          Key phrases:{' '}
                          {res.analysis.keyPhrases.map((p) => p.text).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : res.type === 'translate' ? (
                    <div style={{ fontSize: '13px' }}>
                      <small style={{ color: '#9b969f' }}>
                        {res.sourceLanguage} → {res.targetLanguage}
                      </small>
                      <div>{res.translatedText}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                      {res.answer || res.summary}
                    </div>
                  )}
                </div>
              ))}

              {/* AI results */}
              {todo?.items?.length > 0 && (
                <div style={cardStyle}>
                  <div style={cardTitleStyle}>To-do list</div>
                  {todo.items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '6px 0',
                        borderBottom: '1px solid #f0eef4',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color:
                            item.priority === 'high'
                              ? '#c0392b'
                              : item.priority === 'low'
                                ? '#8a8f98'
                                : '#b8860b',
                          minWidth: '54px',
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
                  <small style={{ color: '#9b969f' }}>
                    {todo.servicesUsed?.join(' + ')}
                  </small>
                </div>
              )}

              {analysis && (
                <div style={cardStyle}>
                  <div style={cardTitleStyle}>Discussion analysis</div>
                  {analysis.researchQuestion && (
                    <p>
                      <strong>Question:</strong> {analysis.researchQuestion}
                    </p>
                  )}
                  {analysis.facilitatorNote && (
                    <p style={{ color: '#65616b' }}>
                      {analysis.facilitatorNote}
                    </p>
                  )}
                  <small style={{ color: '#9b969f' }}>
                    {analysis.generatedBy}
                  </small>
                </div>
              )}

              {critic && (
                <div style={cardStyle}>
                  <div style={cardTitleStyle}>Scientific critique</div>
                  {critic.summary && <p>{critic.summary}</p>}
                  {critic.criticNote && (
                    <p style={{ color: '#65616b' }}>{critic.criticNote}</p>
                  )}
                  <small style={{ color: '#9b969f' }}>
                    {critic.generatedBy}
                  </small>
                </div>
              )}

              {facilitator && (
                <div style={cardStyle}>
                  <div style={cardTitleStyle}>Facilitator</div>
                  {facilitator.priorityIssue && (
                    <p>
                      <strong>Priority:</strong> {facilitator.priorityIssue}
                    </p>
                  )}
                  {facilitator.facilitatorMessage && (
                    <p style={{ color: '#65616b' }}>
                      {facilitator.facilitatorMessage}
                    </p>
                  )}
                  <small style={{ color: '#9b969f' }}>
                    {facilitator.generatedBy}
                  </small>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const cardStyle = {
  border: '1px solid #e0ddd9',
  borderRadius: '8px',
  padding: '14px',
  marginBottom: '12px',
}

const cardTitleStyle = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#0073bb',
  marginBottom: '8px',
}

export default PrivateRoomPage
