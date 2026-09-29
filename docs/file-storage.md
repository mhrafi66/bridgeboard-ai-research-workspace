# File Storage

BridgeBoard uses Amazon S3 for all file storage. Files never pass through Lambda - the browser uploads directly to S3 using a pre-signed URL, and downloads directly from S3 using another pre-signed URL.

## Upload Flow

```
Browser                          Lambda                            S3
  |                                 |                               |
  |-- POST /research/upload-url --> |                               |
  |   { filename, contentType }     |                               |
  |                                 |-- generate_presigned_url() -->|
  |                                 |<- presigned PUT URL ----------|
  |<- { uploadUrl, key, bucket } ---|                               |
  |                                 |                               |
  |-- PUT <uploadUrl> + file body --+------------------------------>|
  |<- 200 OK ------------------+---+-------------------------------|
  |                                 |                               |
  |-- POST /research/messages ----->|                               |
  |   { text, attachments: [{key}] }|                               |
  |                                 |-- put_item(DynamoDB) -------> |
  |<- { message with GET URLs } ----|                               |
```

### Pre-signed PUT URL generation

```python
key = f"uploads/{file_id}/{safe_name}"

upload_url = _s3.generate_presigned_url(
    "put_object",
    Params={
        "Bucket": MEDIA_BUCKET,
        "Key": key,
        "ContentType": content_type,
    },
    ExpiresIn=300,  # 5 minutes to complete upload
)
```

**Key structure:** `uploads/<uuid>/<sanitised-filename>`. The UUID prefix means two uploads of `paper.pdf` get different keys and never overwrite each other. The filename is sanitised by replacing `/` and `\` with `_` to prevent path traversal.

**5-minute expiry:** Long enough for a user to start the upload on a slow connection; short enough that a leaked URL cannot be used indefinitely.

**ContentType enforcement:** The pre-signed URL is generated with the specific `ContentType` the browser declared. S3 rejects a PUT with a mismatched `Content-Type` header, providing a basic check that the upload matches what was requested.

## Download Flow

```
Lambda (on GET /research/messages)
  |
  |-- for each attachment in each message:
  |     generate_presigned_url("get_object", ExpiresIn=86400)
  |
  v
Browser receives { ..., attachments: [{ key, url, name, type, size }] }
  |
  |-- <img src={url}> or fetch(url) directly from S3
  v
S3 returns file bytes directly to browser
```

Pre-signed GET URLs are regenerated on every `GET /research/messages` call. This means they are always fresh (24-hour expiry from time of read) regardless of when the file was uploaded.

**Why regenerate every time?** Stored GET URLs would expire after 24 hours, causing broken images. Regenerating them on read ensures the URL the browser receives is always valid. The cost is a few extra Python method calls per message; no S3 API call is made until the browser actually fetches the URL.

## Security Model

| Property | Implementation |
|---|---|
| Public access blocked | `PublicAccessBlockConfiguration` - all four block settings enabled |
| Encryption at rest | AES-256 server-side encryption |
| Isolation | Every upload gets its own `<uuid>` directory |
| Path traversal prevention | `re.sub(r"[/\\]+", "_", raw_name)` before constructing the key |
| Scope validation | `key.startswith("uploads/")` check before storing in DynamoDB |
| No Lambda in data path | Files go browser -> S3 directly; Lambda never touches the bytes |

The `uploads/` prefix check is important: it prevents a malicious client from supplying `key: "../../production-config.json"` or any key that references other bucket prefixes. Only keys starting with `uploads/` can be stored as message attachments.

## Textract Integration

When a slash command targets a document, Lambda passes its S3 key directly to Textract. Textract reads the file from S3 itself - the file bytes never flow through Lambda memory.

**Async API (`start_document_text_detection` + `get_document_text_detection`):**

The async API handles documents of any size, including multi-page research papers. The sync API (`detect_document_text`) is limited to ~3 pages and is not used.

```python
# 1. Start job - Textract reads the file from S3 directly
job = _textract.start_document_text_detection(
    DocumentLocation={
        "S3Object": {"Bucket": MEDIA_BUCKET, "Name": s3_key}
    }
)
job_id = job["JobId"]

# 2. Poll with exponential backoff until SUCCEEDED or timeout
resp = _textract.get_document_text_detection(JobId=job_id)
# status: IN_PROGRESS | SUCCEEDED | FAILED

# 3. Collect LINE blocks across all paginated result pages
lines = [b["Text"] for b in resp["Blocks"] if b["BlockType"] == "LINE"]
while resp.get("NextToken"):
    resp = _textract.get_document_text_detection(
        JobId=job_id, NextToken=resp["NextToken"]
    )
    lines += [b["Text"] for b in resp["Blocks"] if b["BlockType"] == "LINE"]
```

**Document types supported:**
- PDFs (text-based and scanned/image PDFs) - any page count
- JPEG and PNG images with text
- Multi-column layouts (blocks preserve reading order)
- Handwritten text (partial accuracy)

**Plain text files** (`.txt`, `.csv`, `.md`, `.json`) bypass Textract entirely and are read directly from S3 with `get_object` - OCR is not needed for files that are already text.

**Polling timeout:** `_textract_extract_text` polls for up to 25 seconds with 2-5 second intervals. For typical 10-20 page research PDFs, Textract async jobs complete in 5-15 seconds. Very large documents that exceed the timeout receive a clear error message directing the user to `/ask` instead.

## File Lifecycle

The `MediaBucket` has a 7-day lifecycle rule:

```yaml
LifecycleConfiguration:
  Rules:
    - Id: ExpireMedia
      Status: Enabled
      ExpirationInDays: 7
```

Files are automatically deleted after 7 days. For a hackathon demo this is intentional - it keeps storage costs near zero and avoids accumulating test uploads. A production deployment would remove this rule or set a longer retention period.
