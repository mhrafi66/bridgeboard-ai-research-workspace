# Discussion Thread

The discussion thread is the primary workspace in BridgeBoard. It is a real-time, multi-user, Slack-like chat interface where researchers share updates, upload documents, and invoke AI agents via slash commands.

## Real-Time Architecture

The thread uses **client-side polling** rather than WebSockets or Server-Sent Events. Every 3 seconds, each connected browser calls `GET /research/messages` and compares the result against a local `Set` of known message IDs.

```
Browser A                     DynamoDB                    Browser B
  |                              |                              |
  |-- POST /research/messages -->|                              |
  |<- {message, id: "abc"} ------|                              |
  |                              |<- POST /research/messages ---|
  |                              |-- {message, id: "xyz"} ----->|
  |                              |                              |
  | [3s poll]                    |                    [3s poll] |
  |-- GET /research/messages  -->|                              |
  |<- [{id:"abc"}, {id:"xyz"}] --|                              |
  | (no new messages, no update) |<-- GET /research/messages ---|
  |                              |-- [{id:"abc"},{id:"xyz"}] -->|
```

### Why polling instead of WebSockets?

- Lambda functions are stateless - they cannot maintain persistent WebSocket connections without additional infrastructure (API Gateway WebSocket + connection state in DynamoDB)
- For a hackathon demo with a small team, 3-second polling provides a sufficiently real-time feel
- Polling is simpler to debug, monitor, and extend
- The poll only triggers a React re-render when `newMsgs.length > 0`, so CPU overhead is minimal when the thread is quiet

### Deduplication

```javascript
// msgIdsRef is a useRef Set - persists across renders without causing re-renders
const newMsgs = result.filter((m) => !msgIdsRef.current.has(m.id || m.sk))
if (newMsgs.length === 0 && result.length === prev.length) return prev
```

The `msgIdsRef` Set tracks every message ID seen. Polling returns the full message list each time (no cursor pagination), so deduplication is done on the client. The `return prev` short-circuit prevents unnecessary React re-renders when nothing changed.

## Message Grouping and Date Separators

Messages are rendered with date separators when consecutive messages fall on different calendar days:

```javascript
function shouldShowDateSep(index) {
  if (index === 0) return true
  const prevMs = toMs(prev.createdAt)
  const currMs = toMs(curr.createdAt)
  return new Date(prevMs).toDateString() !== new Date(currMs).toDateString()
}
```

**Timestamp normalisation (`toMs`):** DynamoDB stores `createdAt` as a numeric JavaScript timestamp (milliseconds since epoch), but it returns all values as strings in JSON. `new Date("1726567200000")` returns `Invalid Date` because `Date` treats numeric strings as invalid. The `toMs()` helper applies `Number()` conversion first, falls back to `new Date()` parsing, and returns null on failure - preventing the "Invalid Date" display bug.

## @Mention System

When a user types `@` in the composer, the thread detects the cursor position and shows a dropdown of team members filtered by what follows the `@`.

```javascript
const atIdx = textBefore.lastIndexOf('@')
if (atIdx !== -1 && (atIdx === 0 || /[\s\n]/.test(textBefore[atIdx - 1]))) {
  const query = textBefore.substring(atIdx + 1)
  // show dropdown filtered by query
}
```

The dropdown supports keyboard navigation (Arrow Up/Down, Enter/Tab to select, Escape to dismiss). Selecting a member inserts `@Full Name ` into the draft and positions the cursor after the name.

Mentions are rendered with highlighted styling in posted messages:
```javascript
const regex = /@([\w]+(?:\s[\w]+)?)/g
// renders as <span className="dt-mention">@Name</span>
```

## Slash Command System

When the composer text starts with `/`, the thread shows a command autocomplete dropdown. See [agent-commands.md](agent-commands.md) for full command documentation.

**Detection logic:**
```javascript
if (val.startsWith('/')) {
  const firstSpace = val.indexOf(' ')
  if (firstSpace === -1) {
    setCommandQuery(val.substring(1).toLowerCase())
    // show command dropdown
  } else {
    setCommandQuery(null)
    // command selected, no dropdown needed
  }
}
```

The dropdown closes as soon as the user types a space (command selected). Commands are filtered in real-time as the user types characters after `/`.

## File Upload System

### In the composer

Files can be added via:
1. The paperclip button (any file type)
2. The image button (filters to `image/*`, then resets to `*/*`)
3. Drag-and-drop onto the composer

```javascript
function processFiles(files) {
  Array.from(files).forEach((file) => {
    const url = URL.createObjectURL(file)
    setAttachments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, url, file }
    ])
  })
}
```

Local `blob://` URLs are created for instant preview before upload. These are revoked after the message sends to prevent memory leaks.

### Upload flow

When the user sends a message with attachments:

```
1. getUploadUrl(name, type)     → POST /research/upload-url
                                  ← { uploadUrl, key, bucket }
2. uploadFileToS3(uploadUrl, file) → PUT directly to S3 (no Lambda)
3. postDiscussionMessage(text, [{ key, name, type, size }])
   → POST /research/messages
   ← message with pre-signed GET URLs attached
```

Files go **directly from the browser to S3** using a pre-signed PUT URL. Lambda is not in the upload path, so there is no 6 MB Lambda payload limit and no invocation cost for file transfers.

### Download / rendering

When messages are fetched, the Lambda generates fresh pre-signed GET URLs for every attachment:

```python
url = _s3.generate_presigned_url(
    "get_object",
    Params={"Bucket": MEDIA_BUCKET, "Key": key},
    ExpiresIn=86400,  # 24 hours
)
```

The pre-signed URL embeds the AWS signature and expiry time. The browser can fetch the file directly from S3 using this URL without any auth headers.

### Supported file types

| Type | Rendered as | Notes |
|------|------------|-------|
| `image/*` | `<img>` with lightbox | Click to open full-size |
| `video/*` | `<video controls>` | In-thread playback |
| `audio/*` | `<audio controls>` | With waveform bar |
| PDF, DOCX, XLSX | File card with icon | Download via pre-signed URL |
| Any other | Generic file card | Download via pre-signed URL |

## Agent Response Messages

When a slash command completes, the Lambda stores the result as a special `entity: "agent-response"` message in DynamoDB. These arrive via the regular 3-second poll like any other message.

The frontend checks `msg.entity`:
```javascript
{msg.entity !== 'agent-response' && <p>{renderMessageText(msg.text)}</p>}
{msg.entity === 'agent-response' && renderAgentResult(msg)}
```

Agent response cards show:
- The command that triggered them (e.g. `/ask`)
- The AWS services used (e.g. `Amazon Textract + Amazon Bedrock`)
- The result in a format appropriate to the command type (prose answer, entity tags, extracted text, etc.)

## Selection Range for Analysis

The header shows a pill showing the total message count. Clicking it enters "selection mode" where researchers can specify a from/to range of messages to feed into the research analysis pipeline. This lets teams focus the AI analysis on a specific part of the conversation rather than all messages.

```javascript
const selectedMessages = () => {
  if (!selection) return messages
  return messages.slice(selection.from, selection.to + 1)
}
// passed to onEntriesReady(entries) -> ResearchAIPage.jsx
```

## New Message Banner

When new messages arrive while the user is scrolled up (reading older messages), a sticky banner appears at the bottom of the message list:

```
↓ 3 new messages
```

Clicking the banner scrolls to the bottom and dismisses it. The scroll position is tracked via an `onScroll` handler that sets `isAtBottom` when the user is within 60px of the bottom.
