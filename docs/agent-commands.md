# Agent Command System

The discussion thread supports a set of slash commands that invoke AI agents on demand. Any team member can trigger an agent by typing a command in the composer. The result is saved to DynamoDB and becomes visible to all users within the next 3-second poll cycle.

## Command Syntax

```
/command @target1 @target2 optional query text
```

**Targets:**

| Target | Syntax | Resolves to |
|---|---|---|
| Uploaded document | `@doc:filename.pdf` | S3 key looked up from message attachment history |
| Thread message | `@msg:3` | Text of the 3rd message in the thread (1-indexed) |

Multiple targets are supported. Query text after the targets is passed to the agent as a question or instruction.

## Command Reference

| Command | Agent Type | AWS Services | What it does |
|---|---|---|---|
| `/ask` | **RAG Agent** (Retrieval-Augmented Generation) | Textract + Bedrock Converse | Retrieves document content via OCR, constructs a grounded prompt, and answers the question using the document as context. Cannot hallucinate facts not in the document. |
| `/summarize` | **RAG Agent** | Textract + Bedrock Converse | Extracts text from one or more documents/messages, then asks Bedrock to produce a structured summary of key points and findings. |
| `/extract` | **Computer Use / Document Reading Agent** | Textract (DetectDocumentText) | Reads the raw bytes of a PDF, PNG, or image from S3, runs full Textract OCR, and returns the extracted text. No LLM involved - pure document reading. |
| `/analyze` | **NLP Tool-Use Agent** | Comprehend (sentiment, entities, key phrases, language detection) | Runs the content through Comprehend's NLP pipeline: detects language, classifies sentiment (positive/negative/neutral/mixed), extracts named entities (people, organisations, places, dates), and surfaces key phrases. |
| `/search` | **Reasoning / Knowledge Agent** | Bedrock Converse | Uses the LLM as a research knowledge base. No live web search - instead uses the model's training knowledge plus reasoning to produce a structured research briefing: key concepts, current state, open questions, suggested search terms. |
| `/translate` | **Tool-Use Agent** | Translate + Textract | Reads source content from documents or messages (OCR if needed), then calls Amazon Translate with auto source-language detection to the requested target language code. |

### Agent Type Definitions

**RAG Agent (Retrieval-Augmented Generation)**
A RAG agent retrieves content from an external source before generating a response. In BridgeBoard, "retrieval" means fetching the document bytes from S3 and running Textract OCR to get the text. That text is then injected into the Bedrock prompt as grounded context. The LLM is explicitly instructed to answer only from this context, not from its training data, which reduces hallucination for document-specific questions.

**Computer Use / Document Reading Agent**
Mimics what a human would do when asked to "open the PDF and read it." The agent fetches the raw file from S3 and passes it to Textract, which handles layout-aware reading of PDFs, scanned images, tables, and handwritten text. The result is the machine-readable text extracted from the visual content of the file.

**NLP Tool-Use Agent**
Calls a specialised NLP tool (Amazon Comprehend) rather than an LLM. Comprehend's models are fine-tuned for specific tasks (sentiment, entity recognition, key phrase detection) and are more accurate and cheaper for those tasks than a general-purpose LLM. The agent chains multiple Comprehend API calls and returns structured, typed results.

**Reasoning / Knowledge Agent**
Uses the LLM directly as a knowledge tool. No retrieval step. The agent formulates a prompt that instructs the model to reason about the query as a research expert, structure its answer with specific sections (key concepts, current state, open questions), and flag uncertainty. This is closest to a "search with reasoning" pattern.

**Tool-Use Agent**
Calls a deterministic AWS service (Translate, Textract) as a tool and returns its output. No LLM reasoning layer - the service itself is the intelligence. These are the most predictable, testable agents because the transformation is deterministic given the same input.

## End-to-End Example: `/ask`

```
User types: /ask @doc:paper.pdf is this method reproducible?
```

### Step 1: Frontend parsing

`parseCommand()` in `DiscussionThread.jsx` splits the text:
- command: `ask`
- targets: `[{ type: "document", name: "paper.pdf", key: "uploads/abc123/paper.pdf" }]`
  - key is resolved by scanning message history for an attachment with that filename
- query: `"is this method reproducible?"`

### Step 2: User message posted

Before calling the agent, the original text is posted as a normal user message via `POST /research/messages`. This preserves the user's intent in the thread and gives other team members context about what was asked.

### Step 3: Agent command dispatched

`executeAgentCommand("ask", targets, query)` calls `POST /research/agent-command` with:
```json
{
  "command": "ask",
  "targets": [{ "type": "document", "key": "uploads/abc123/paper.pdf", "name": "paper.pdf" }],
  "query": "is this method reproducible?"
}
```

### Step 4: Lambda - document retrieval (Textract)

`_extract_document_text(s3_key)` is called. Textract's `detect_document_text` is invoked with the S3 object reference:

```python
result = _textract.detect_document_text(
    Document={"S3Object": {"Bucket": MEDIA_BUCKET, "Name": s3_key}}
)
```

Textract returns `Blocks` - each block has a `BlockType`. Only `LINE` blocks are collected to reconstruct the text in reading order. This handles:
- Multi-column PDF layouts
- Scanned/photographed documents
- Images with embedded text (PNG, JPEG)
- Handwritten notes (partial support)

If Textract returns empty text (e.g. a plain `.txt` file), the code falls back to a raw S3 `get_object` read decoded as UTF-8.

### Step 5: Lambda - answer generation (Bedrock)

The extracted document text is injected into a grounded RAG prompt:

```
You are BridgeBoard AI Agent, a research assistant for a collaborative team.

Context from referenced documents and messages:

[paper.pdf]:
<full extracted text up to 12,000 characters>

---

User question: is this method reproducible?

Provide a clear, accurate, and helpful answer. If referencing documents,
cite specific parts. If the context does not contain enough information, say so.
```

This prompt is sent to Bedrock Converse using the team's selected model (default: Claude Sonnet). The `maxTokens: 2000, temperature: 0.2` settings favour factual, grounded responses over creative speculation.

**Methodology note on temperature:** `temperature: 0.2` is used for question answering because we want the model to stay close to the retrieved context and not stray into plausible-sounding but unsupported statements. Higher temperature (0.3) is used for `/search` where broader exploration is appropriate.

### Step 6: Result stored as agent-response message

The Bedrock response is wrapped in a message item and stored in DynamoDB:

```python
item = {
    "pk": "DISCUSSION",
    "sk": f"MSG#{now}#{msg_id[:8]}",
    "entity": "agent-response",      # distinguishes from regular messages
    "speaker": "BridgeBoard AI",
    "agentResult": {
        "type": "ask",
        "answer": "<full Bedrock response>",
        "summary": "<first 300 chars>",
        "servicesUsed": ["Amazon Textract", "Amazon Bedrock (claude-sonnet-4-6)"]
    },
    "command": "ask",
    "createdAt": now
}
```

### Step 7: Result visible to all users

The 3-second poll in every user's browser calls `GET /research/messages`. Because the agent response is stored as a regular DynamoDB item with `pk=DISCUSSION`, it arrives in the same query as normal messages. The frontend checks `msg.entity === 'agent-response'` and renders a special AI card instead of a chat bubble, including the services used, the command that triggered it, and the full formatted answer.

## Command Examples by Use Case

### Asking questions about a research paper
```
/ask @doc:methodology.pdf what sample size was used and is it statistically adequate?
```
Uses Textract to read the PDF, then Bedrock to answer with citations from the extracted text.

### Summarising multiple documents
```
/summarize @doc:paper1.pdf @doc:paper2.pdf compare the methods used
```
Extracts text from both documents, concatenates with labels, then asks Bedrock for a comparative summary.

### Extracting raw text for clipboard/export
```
/extract @doc:handwritten-notes.png
```
Pure Textract - reads the handwritten image and returns machine-readable text with no LLM involved.

### Understanding a message
```
/analyze @msg:5
```
Runs the message through Comprehend: returns its language, sentiment (was this researcher frustrated or excited?), named entities, and key phrases.

### Research literature search
```
/search attention mechanisms in transformer models
```
Asks Bedrock to produce a structured briefing on the topic using its training knowledge, suggesting search terms for follow-up.

### Translating a document
```
/translate @doc:french-paper.pdf en
```
Textract reads the document, Translate converts French to English.

## Adding New Commands

1. Add the command name to `AGENT_COMMANDS` set in `handler.py`
2. Write a `_handle_newcommand(targets, query, model_id)` function that returns a dict with `type`, `summary`, and `servicesUsed` fields
3. Add it to the `handlers` dict in `handle_agent_command()`
4. Add it to the `COMMANDS` array in `DiscussionThread.jsx` with icon, description, and usage
5. Optionally add a custom renderer in `renderAgentResult()` for richer card display
6. Add the API route to `infrastructure/template.yaml` if needed (the current `/research/agent-command` endpoint handles all commands)
