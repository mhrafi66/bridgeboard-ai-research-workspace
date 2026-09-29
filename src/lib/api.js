import { fetchAuthSession } from 'aws-amplify/auth'

export const LANGUAGE_NAMES = {
  af: 'Afrikaans', am: 'Amharic', ar: 'Arabic', az: 'Azerbaijani',
  bg: 'Bulgarian', bn: 'Bangla', bs: 'Bosnian', ca: 'Catalan',
  cs: 'Czech', cy: 'Welsh', da: 'Danish', de: 'German',
  el: 'Greek', en: 'English', es: 'Spanish', et: 'Estonian',
  fa: 'Persian', fi: 'Finnish', fr: 'French', ga: 'Irish',
  gu: 'Gujarati', ha: 'Hausa', he: 'Hebrew', hi: 'Hindi',
  hr: 'Croatian', hu: 'Hungarian', hy: 'Armenian', id: 'Indonesian',
  is: 'Icelandic', it: 'Italian', ja: 'Japanese', ka: 'Georgian',
  kk: 'Kazakh', kn: 'Kannada', ko: 'Korean', lt: 'Lithuanian',
  lv: 'Latvian', mk: 'Macedonian', ml: 'Malayalam', mn: 'Mongolian',
  mr: 'Marathi', ms: 'Malay', mt: 'Maltese', nl: 'Dutch',
  no: 'Norwegian', pa: 'Punjabi', pl: 'Polish', ps: 'Pashto',
  pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', si: 'Sinhala',
  sk: 'Slovak', sl: 'Slovenian', so: 'Somali', sq: 'Albanian',
  sr: 'Serbian', sv: 'Swedish', sw: 'Swahili', ta: 'Tamil',
  te: 'Telugu', th: 'Thai', tl: 'Tagalog', tr: 'Turkish',
  uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese',
  zh: 'Chinese', 'zh-TW': 'Chinese (Traditional)',
}

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || ''

export async function getAuthHeaders() {
  const session = await fetchAuthSession()
  const token =
    session.tokens?.accessToken?.toString()
  return token
    ? { Authorization: `Bearer ${token}` }
    : {}
}

export async function translateText(
  text,
  targetLanguage = 'en',
) {
  if (!API_BASE_URL) {
    throw new Error(
      'The live API is not configured.',
    )
  }

  if (!text?.trim()) {
    throw new Error('Text is required.')
  }

  const response = await fetch(
    `${API_BASE_URL}/ingestion/translate`,
    {
      method: 'POST',
      headers: {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        targetLanguage,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error || 'Translation failed.',
    )
  }

  if (data.translation?.error) {
    throw new Error(data.translation.error)
  }

  return data.translation
}

export async function synthesizeSpeech(
  text,
  languageCode = 'en',
) {
  if (!API_BASE_URL) {
    throw new Error(
      'The live API is not configured.',
    )
  }

  if (!text?.trim()) {
    throw new Error('Text is required.')
  }

  const response = await fetch(
    `${API_BASE_URL}/ingestion/speak`,
    {
      method: 'POST',
      headers: {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        languageCode,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error || 'Speech synthesis failed.',
    )
  }

  if (data.speech?.error) {
    throw new Error(data.speech.error)
  }

  return data.speech
}

export async function startTranscription(
  audioBase64,
  mediaFormat = 'webm',
  languageCode = 'auto',
  maxSpeakers = 2,
) {
  if (!API_BASE_URL) {
    throw new Error(
      'The live API is not configured.',
    )
  }

  const response = await fetch(
    `${API_BASE_URL}/ingestion/transcribe`,
    {
      method: 'POST',
      headers: {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioBase64,
        mediaFormat,
        languageCode,
        maxSpeakers,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error || 'Transcription start failed.',
    )
  }

  return data.transcription
}

export async function pollTranscription(jobName) {
  if (!API_BASE_URL) {
    throw new Error(
      'The live API is not configured.',
    )
  }

  const query = encodeURIComponent(jobName)

  const response = await fetch(
    `${API_BASE_URL}/ingestion/transcribe?jobName=${query}`,
    {
      headers: await getAuthHeaders(),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error || 'Transcription poll failed.',
    )
  }

  return data.transcription
}

export async function getUploadUrl(filename, contentType) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')

  const response = await fetch(`${API_BASE_URL}/research/upload-url`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename, contentType }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not get upload URL.')
  return data  // { uploadUrl, key, bucket }
}

export async function uploadFileToS3(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) throw new Error(`S3 upload failed: ${response.status}`)
}

export async function getDiscussionMessages() {
  if (!API_BASE_URL) {
    throw new Error(
      'The live API is not configured.',
    )
  }

  const response = await fetch(
    `${API_BASE_URL}/research/messages`,
    {
      headers: await getAuthHeaders(),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error || 'Failed to load messages.',
    )
  }

  return data.messages
}

export async function postDiscussionMessage(text, attachments = [], replyTo = null) {
  if (!API_BASE_URL) {
    throw new Error('The live API is not configured.')
  }

  if (!text?.trim() && attachments.length === 0) {
    throw new Error('Message text is required.')
  }

  const body = {
    text: (text || '').trim(),
    attachments,
  }
  if (replyTo?.sk) {
    body.replyToSk = replyTo.sk
    body.replyToText = (replyTo.text || '').substring(0, 300)
    body.replyToSpeaker = replyTo.speaker || ''
  }

  const response = await fetch(`${API_BASE_URL}/research/messages`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to post message.')
  return data.message
}

export async function reactToMessage(sk, emoji, add) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/research/reactions`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sk, emoji, add }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Reaction failed.')
  }
}

export async function executeAgentCommand(command, targets = [], query = '', modelId = '', approved = false) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')

  const body = { command, targets, query }
  if (modelId) body.modelId = modelId
  if (approved) body.approved = true

  const response = await fetch(`${API_BASE_URL}/research/agent-command`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Command /${command} failed.`)
  return data
}

export async function deleteDiscussionMessage(sk) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/research/messages?sk=${encodeURIComponent(sk)}`,
    {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete message.')
  return data
}

// === Private rooms and meetings ===

export async function listRooms() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load rooms.')
  return data.rooms || []
}

export async function createRoom(name, members = []) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, members }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to create room.')
  return data.room
}

export async function deleteRoom(roomId) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/rooms?roomId=${encodeURIComponent(roomId)}`,
    { method: 'DELETE', headers: await getAuthHeaders() },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete room.')
  return data
}

export async function listMeetings(roomId) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/rooms/meetings?roomId=${encodeURIComponent(roomId)}`,
    { headers: await getAuthHeaders() },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load meetings.')
  return data.meetings || []
}

export async function createMeeting(roomId, meeting) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/rooms/meetings`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomId, ...meeting }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to create meeting.')
  return data.meeting
}

export async function updateMeeting(roomId, sk, fields) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/rooms/meetings/update`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomId, sk, ...fields }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to update meeting.')
  return data.meeting
}

export async function deleteMeeting(roomId, sk) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/rooms/meetings?roomId=${encodeURIComponent(roomId)}&sk=${encodeURIComponent(sk)}`,
    { method: 'DELETE', headers: await getAuthHeaders() },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete meeting.')
  return data
}

// === User profile ===

export async function getProfile() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/profile`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load profile.')
  return data // { profile, fallback }
}

export async function saveProfile(profile) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to save profile.')
  return data.profile
}

// === Lab memory ===

export async function listLabMemory() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/lab-memory`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load lab memory.')
  return data.entries || []
}

export async function createLabMemoryEntry(entry) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/lab-memory`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to save entry.')
  return data.entry
}

export async function deleteLabMemoryEntry(sk) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/lab-memory?sk=${encodeURIComponent(sk)}`,
    { method: 'DELETE', headers: await getAuthHeaders() },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete entry.')
  return data
}

// === Provenance (Experiments) ===

export async function listExperiments() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/experiments`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load experiments.')
  return data.entries || []
}

export async function createExperiment(entry) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/experiments`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to save experiment.')
  return data.entry
}

export async function deleteExperiment(sk) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/experiments?sk=${encodeURIComponent(sk)}`,
    { method: 'DELETE', headers: await getAuthHeaders() },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete experiment.')
  return data
}

// === Manuscripts ===

export async function listManuscripts() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/manuscripts`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load manuscripts.')
  return data.entries || []
}

export async function createManuscript(entry) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/manuscripts`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to save manuscript.')
  return data.entry
}

export async function deleteManuscript(sk) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(
    `${API_BASE_URL}/manuscripts?sk=${encodeURIComponent(sk)}`,
    { method: 'DELETE', headers: await getAuthHeaders() },
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete manuscript.')
  return data
}

// === Advising (Student Updates) ===

export async function listAdvisingUpdates() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/advising/updates`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load updates.')
  return data.entries || []
}

export async function createAdvisingUpdate(entry) {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/advising/updates`, {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to save update.')
  return data.entry
}

export async function listUsers() {
  if (!API_BASE_URL) throw new Error('The live API is not configured.')
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: await getAuthHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load users.')
  return data.users || []
}
