import { useEffect, useState } from 'react'
import ResearchAIPage from './features/research-ai/ResearchAIPage'
import PrivateRoomPage from './features/private-room/PrivateRoomPage'
import ProfileModal from './features/profile/ProfileModal'
import HelpModal from './features/help/HelpModal'
import ProvenancePage from './features/provenance/ProvenancePage'
import LabMemoryPage from './features/lab-memory/LabMemoryPage'
import ManuscriptsPage from './features/manuscripts/ManuscriptsPage'
import AdvisingPage from './features/advising/AdvisingPage'
import { listRooms, createRoom, deleteRoom, getProfile, listUsers } from './lib/api'
import { Amplify } from 'aws-amplify'
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const AUTH_CONFIGURED = Boolean(import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID && import.meta.env.VITE_COGNITO_DOMAIN)

const AFFILIATION_LABELS = {
  undergraduate: 'Undergraduate student',
  masters: "Master's student",
  phd: 'PhD student',
  postdoc: 'Postdoctoral researcher',
  professor: 'Professor',
  researcher: 'Researcher',
  staff: 'Staff',
  other: 'Other',
}

const LAB_ROLE_LABELS = {
  pi: 'Principal Investigator',
  advisor: 'Co-Advisor',
  student: 'Graduate Student',
  collaborator: 'Collaborator',
}

if (AUTH_CONFIGURED) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: import.meta.env.VITE_COGNITO_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [window.location.origin],
            redirectSignOut: [window.location.origin],
            responseType: 'code',
          },
        },
      },
    },
  })
}

const DASHBOARD_FEATURES = [
  {
    key: 'research-ai',
    icon: '✦',
    title: 'Research Hub',
    description: 'Real-time discussion with AI-powered research agents. Analyze papers, run literature studies, and collaborate with your team.',
    stats: [
      { label: 'Agent Commands', value: '8' },
      { label: 'AWS Services', value: '7' },
    ],
    color: '#0073bb',
    bg: '#e9f3fa',
  },
  {
    key: 'provenance',
    icon: '◈',
    title: 'Reproducibility & Provenance',
    description: 'Version-lock every result. Trace any published figure back to the exact data, model checkpoint, and pipeline run.',
    stats: [
      { label: 'Runs Tracked', value: '47' },
      { label: 'Repro Score', value: '94%' },
    ],
    color: '#1d8102',
    bg: '#f2f8f0',
  },
  {
    key: 'lab-memory',
    icon: '⬡',
    title: 'Lab Memory & Onboarding',
    description: 'Institutional knowledge that survives graduation. Past decisions, failed experiments, and protocol quirks searchable forever.',
    stats: [
      { label: 'KB Entries', value: '143' },
      { label: 'Onboard Time', value: '2.3d' },
    ],
    color: '#067f68',
    bg: '#ecfdf5',
  },
  {
    key: 'manuscripts',
    icon: '▤',
    title: 'Research Lifecycle',
    description: 'Track papers from idea to publication. Manage reviewer responses, co-author assignments, and grant aim coverage.',
    stats: [
      { label: 'Active Papers', value: '6' },
      { label: 'Accepted', value: '3' },
    ],
    color: '#ff9900',
    bg: '#fff5e6',
  },
  {
    key: 'advising',
    icon: '◎',
    title: 'Mentorship & Advising',
    description: 'Structured weekly updates, milestone tracking, and advisor dashboards. Built for academic integrity and student success.',
    stats: [
      { label: 'Advisees', value: '5' },
      { label: 'Updates', value: '4/5' },
    ],
    color: '#d13212',
    bg: '#fdf3f1',
  },
]

const AWS_SERVICES = [
  { name: 'Amazon Bedrock', desc: 'Multi-model AI reasoning', icon: '🧠' },
  { name: 'DynamoDB', desc: 'Serverless data store', icon: '🗄' },
  { name: 'Lambda', desc: 'Compute engine', icon: '⚡' },
  { name: 'S3', desc: 'File & artifact storage', icon: '📦' },
  { name: 'Cognito', desc: 'Authentication', icon: '🔐' },
  { name: 'Comprehend', desc: 'NLP & entity extraction', icon: '📊' },
  { name: 'Textract', desc: 'Document OCR', icon: '📄' },
  { name: 'Translate', desc: 'Multi-language support', icon: '🌐' },
  { name: 'Transcribe', desc: 'Speech to text', icon: '🎙' },
  { name: 'Polly', desc: 'Text to speech', icon: '🔊' },
  { name: 'CloudFront', desc: 'Global CDN', icon: '🌍' },
  { name: 'API Gateway', desc: 'REST API management', icon: '🔗' },
]

function Dashboard({ onNavigate }) {
  return (
    <div className="dash">
      <div className="dash-hero">
        <div className="dash-hero-text">
          <div className="dash-eyebrow"><span className="live-dot"></span> RESEARCH COLLABORATION PLATFORM</div>
          <h1 className="dash-title">The operating system for<br /><em>research labs.</em></h1>
          <p className="dash-subtitle">BridgeBoard brings AI-powered collaboration, reproducibility tracking, institutional memory, and structured mentorship into one platform — built on AWS.</p>
        </div>
      </div>

      <div className="dash-grid">
        {DASHBOARD_FEATURES.map((f) => (
          <button key={f.key} className="dash-feature-card" onClick={() => onNavigate(f.key)}>
            <div className="dash-feature-icon" style={{ color: f.color, background: f.bg }}>{f.icon}</div>
            <div className="dash-feature-body">
              <h3>{f.title}</h3>
              <p>{f.description}</p>
              <div className="dash-feature-stats">
                {f.stats.map((s) => (
                  <div key={s.label} className="dash-feature-stat">
                    <strong style={{ color: f.color }}>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <span className="dash-feature-arrow" style={{ color: f.color }}>→</span>
          </button>
        ))}
      </div>

      <div className="dash-aws-section">
        <div className="dash-aws-header">
          <div className="dash-section-kicker">POWERED BY</div>
          <h2 className="dash-section-title">12 AWS services, one platform.</h2>
          <p className="dash-section-desc">Every feature runs on fully serverless AWS infrastructure — no servers to manage, scales to zero, pay only for what you use.</p>
        </div>
        <div className="dash-aws-grid">
          {AWS_SERVICES.map((s) => (
            <div key={s.name} className="dash-aws-chip">
              <span className="dash-aws-icon">{s.icon}</span>
              <div>
                <strong>{s.name}</strong>
                <small>{s.desc}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="dash-footer">
        <span className="dash-footer-mark">+</span>
        <span>BridgeBoard · Built for the AWS Hackathon · <strong>API Gateway + Lambda + Bedrock + DynamoDB + Cognito + S3 + Comprehend + Textract + Translate + Transcribe + Polly + CloudFront</strong></span>
        <span className="secure">⌁ private by design</span>
      </footer>
    </div>
  )
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(AUTH_CONFIGURED)

  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [userDirectory, setUserDirectory] = useState([])
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [roomCreating, setRoomCreating] = useState(false)
  const [roomError, setRoomError] = useState('')

  const [profile, setProfile] = useState(null)
  const [profileFallbackName, setProfileFallbackName] = useState('')
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileIsFirstTime, setProfileIsFirstTime] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (!API_BASE_URL || (AUTH_CONFIGURED && !user)) return
    let cancelled = false
    getProfile()
      .then((data) => {
        if (cancelled) return
        setProfileFallbackName(data.fallback?.name || '')
        if (data.profile) {
          setProfile(data.profile)
        } else {
          setProfileIsFirstTime(true)
          setShowProfileModal(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!API_BASE_URL || (AUTH_CONFIGURED && !user)) return
    let cancelled = false
    listRooms()
      .then((result) => { if (!cancelled) setRooms(result) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!AUTH_CONFIGURED) return
    getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setAuthLoading(false))
  }, [])

  function openRoomModal() {
    setShowRoomModal(true)
    setRoomError('')
    setRoomName('')
    setSelectedMemberIds([])
    listUsers().then(setUserDirectory).catch(() => setUserDirectory([]))
  }

  function toggleMember(userId) {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  async function handleCreateRoom(event) {
    event.preventDefault()
    if (roomName.trim().length < 2) { setRoomError('Room name must be at least 2 characters.'); return }
    setRoomCreating(true)
    setRoomError('')
    try {
      const members = userDirectory.filter((u) => selectedMemberIds.includes(u.userId)).map((u) => ({ userId: u.userId, name: u.name }))
      const room = await createRoom(roomName.trim(), members)
      setRooms((prev) => [room, ...prev])
      setActiveRoom(room)
      setActiveView('private-room')
      setRoomName('')
      setSelectedMemberIds([])
      setShowRoomModal(false)
    } catch (err) {
      setRoomError(err.message || 'Failed to create room.')
    } finally {
      setRoomCreating(false)
    }
  }

  async function handleDeleteRoom(room, event) {
    event.stopPropagation()
    try {
      await deleteRoom(room.roomId)
      setRooms((prev) => prev.filter((r) => r.roomId !== room.roomId))
      if (activeRoom?.roomId === room.roomId) { setActiveRoom(null); setActiveView('dashboard') }
    } catch { /* ignore */ }
  }

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-mark">+</span>
          <h1>Loading BridgeBoard</h1>
          <p>Checking your secure project session.</p>
        </div>
      </div>
    )
  }

  if (AUTH_CONFIGURED && !user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="brand-mark">+</span>
          <div className="eyebrow"><span className="live-dot"></span> RESEARCH COLLABORATION PLATFORM</div>
          <h1>The OS for<br /><em>research labs.</em></h1>
          <p>Sign in to access your lab's collaboration suite, AI research tools, and institutional knowledge.</p>
          <button className="login-button" onClick={() => signInWithRedirect()}>Sign in securely <span>→</span></button>
          <small>Protected by Amazon Cognito</small>
        </div>
      </div>
    )
  }

  const NAV_ITEMS = [
    { key: 'dashboard', icon: '⊞', label: 'Dashboard' },
    { section: 'RESEARCH' },
    { key: 'research-ai', icon: '✦', label: 'Research Hub' },
    { key: 'lab-memory', icon: '⬡', label: 'Lab Memory' },
    { section: 'LIFECYCLE' },
    { key: 'manuscripts', icon: '▤', label: 'Manuscripts' },
    { key: 'provenance', icon: '◈', label: 'Provenance' },
    { section: 'LAB MANAGEMENT' },
    { key: 'advising', icon: '◎', label: 'Advising' },
  ]

  function renderMainContent() {
    switch (activeView) {
      case 'research-ai': return <ResearchAIPage />
      case 'provenance': return <ProvenancePage />
      case 'lab-memory': return <LabMemoryPage />
      case 'manuscripts': return <ManuscriptsPage />
      case 'advising': return <AdvisingPage userProfile={profile} />
      case 'private-room': return activeRoom ? <PrivateRoomPage room={activeRoom} /> : <Dashboard onNavigate={setActiveView} />
      default: return <Dashboard onNavigate={setActiveView} />
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">+</span><span>bridgeboard</span></div>

        <div className="workspace-label">LAB</div>
        <button className="workspace-switcher">
          <span className="workspace-avatar">AL</span>
          <span><strong>Anderson Lab</strong><small>Climate ML Research</small></span>
          <span className="chevron">⌄</span>
        </button>

        <nav>
          {NAV_ITEMS.map((item, i) =>
            item.section ? (
              <div key={item.section} className="nav-section-label">{item.section}</div>
            ) : (
              <button
                key={item.key}
                className={activeView === item.key ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveView(item.key)}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            )
          )}
        </nav>

        <div className="private-rooms">
          <div className="private-rooms-head">
            <span className="workspace-label">PRIVATE ROOMS</span>
            <button className="room-add-btn" title="Create a private room" onClick={openRoomModal}>+</button>
          </div>
          {rooms.length === 0 && <small className="room-empty">No private rooms yet</small>}
          {rooms.map((room) => (
            <button
              key={room.roomId}
              className={activeView === 'private-room' && activeRoom?.roomId === room.roomId ? 'nav-item active' : 'nav-item'}
              onClick={() => { setActiveRoom(room); setActiveView('private-room') }}
            >
              <span>#</span> {room.name}
              <i className="room-delete" title="Delete room" onClick={(e) => handleDeleteRoom(room, e)}>×</i>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="help-link" onClick={() => setShowHelp(true)}><span>?</span> How BridgeBoard works</button>
          <div className="profile">
            <span className="avatar purple">{profile?.initials || 'YU'}</span>
            <span className="profile-id">
              <strong>{profile?.displayName || user?.signInDetails?.loginId || 'Your workspace'}</strong>
              <small>
                {profile?.labRole ? LAB_ROLE_LABELS[profile.labRole] || profile.labRole : profile?.affiliation ? AFFILIATION_LABELS[profile.affiliation] || profile.affiliation : 'Complete your profile'}
                {profile?.university ? ` · ${profile.university}` : ''}
              </small>
            </span>
          </div>
          <div className="account-actions">
            <button className="account-edit-btn" onClick={() => { setProfileIsFirstTime(false); setShowProfileModal(true) }}>Edit profile</button>
            <button className="signout-button" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {renderMainContent()}
      </main>

      {showRoomModal && (
        <div className="room-modal-backdrop" onClick={() => setShowRoomModal(false)}>
          <div className="room-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create a private room</h2>
            <p className="room-modal-sub">Only invited members can see this room and its meetings.</p>
            <form onSubmit={handleCreateRoom}>
              <label className="room-field-label">Room name</label>
              <input className="room-field" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. Thesis sync with Dr. Anderson" autoFocus />
              <label className="room-field-label">Members</label>
              {userDirectory.length === 0 ? (
                <p className="room-empty" style={{ margin: '0 0 8px' }}>No other users have completed a profile yet.</p>
              ) : (
                <div className="member-picker">
                  {userDirectory.map((u) => (
                    <label key={u.userId} className="member-option">
                      <input type="checkbox" checked={selectedMemberIds.includes(u.userId)} onChange={() => toggleMember(u.userId)} />
                      <span className="avatar purple member-avatar">{u.initials}</span>
                      <span className="member-info">
                        <strong>{u.name}</strong>
                        <small>{u.affiliation ? AFFILIATION_LABELS[u.affiliation] || u.affiliation : ''}{u.university ? ` · ${u.university}` : ''}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {roomError && <div className="api-error">{roomError}</div>}
              <div className="room-modal-actions">
                <button type="button" className="room-btn-secondary" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button type="submit" className="room-btn-primary" disabled={roomCreating || roomName.trim().length < 2}>
                  {roomCreating ? 'Creating...' : 'Create room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showProfileModal && (
        <ProfileModal
          initial={profile}
          fallbackName={profileFallbackName}
          isFirstTime={profileIsFirstTime}
          onSaved={(saved) => { setProfile(saved); setShowProfileModal(false); setProfileIsFirstTime(false) }}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

export default App
