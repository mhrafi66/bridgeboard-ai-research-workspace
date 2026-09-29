import { useState } from 'react'
import { saveProfile } from '../../lib/api'

const AFFILIATIONS = [
  { value: '', label: 'Select affiliation…' },
  { value: 'undergraduate', label: 'Undergraduate student' },
  { value: 'masters', label: "Master's student" },
  { value: 'phd', label: 'PhD student' },
  { value: 'postdoc', label: 'Postdoctoral researcher' },
  { value: 'professor', label: 'Professor' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' },
]

const LAB_ROLES = [
  { value: '', label: 'Select lab role…' },
  { value: 'pi', label: 'Principal Investigator (PI)' },
  { value: 'advisor', label: 'Co-Advisor / Senior Researcher' },
  { value: 'student', label: 'Graduate Student (PhD / MS)' },
  { value: 'collaborator', label: 'Lab Collaborator' },
]

/**
 * Profile create/edit modal. Used both for first-login capture
 * (isFirstTime) and later editing from the account area.
 */
function ProfileModal({ initial, fallbackName, isFirstTime, onSaved, onClose }) {
  const [displayName, setDisplayName] = useState(
    initial?.displayName || fallbackName || '',
  )
  const [university, setUniversity] = useState(initial?.university || '')
  const [affiliation, setAffiliation] = useState(initial?.affiliation || '')
  const [labRole, setLabRole] = useState(initial?.labRole || '')
  const [nationality, setNationality] = useState(initial?.nationality || '')
  const [researchExperience, setResearchExperience] = useState(
    initial?.researchExperience || '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (displayName.trim().length < 2) {
      setError('Please enter a display name (at least 2 characters).')
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await saveProfile({
        displayName: displayName.trim(),
        university: university.trim(),
        affiliation,
        labRole,
        nationality: nationality.trim(),
        researchExperience: researchExperience.trim(),
        email: initial?.email || '',
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="room-modal-backdrop" onClick={isFirstTime ? undefined : onClose}>
      <div className="room-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isFirstTime ? 'Complete your profile' : 'Edit profile'}</h2>
        <p className="room-modal-sub">
          {isFirstTime
            ? 'Tell your collaborators who you are. This name appears on your messages.'
            : 'Update your account details.'}
        </p>
        <form onSubmit={handleSubmit}>
          <label className="room-field-label">Display name / username</label>
          <input
            className="room-field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Maria Lopez"
            autoFocus
          />

          <label className="room-field-label">University / institution</label>
          <input
            className="room-field"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="e.g. MIT"
          />

          <label className="room-field-label">Affiliation</label>
          <select
            className="room-field"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
          >
            {AFFILIATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>

          <label className="room-field-label">Lab role</label>
          <select
            className="room-field"
            value={labRole}
            onChange={(e) => setLabRole(e.target.value)}
          >
            {LAB_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <label className="room-field-label">Nationality</label>
          <input
            className="room-field"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="e.g. Bangladesh"
          />

          <label className="room-field-label">Research experience</label>
          <textarea
            className="room-field"
            value={researchExperience}
            onChange={(e) => setResearchExperience(e.target.value)}
            placeholder="Briefly describe your research background and interests."
            rows={4}
            style={{ resize: 'vertical' }}
          />

          {error && <div className="api-error">{error}</div>}

          <div className="room-modal-actions">
            {!isFirstTime && (
              <button type="button" className="room-btn-secondary" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="room-btn-primary"
              disabled={saving || displayName.trim().length < 2}
            >
              {saving ? 'Saving…' : isFirstTime ? 'Save and continue' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfileModal
