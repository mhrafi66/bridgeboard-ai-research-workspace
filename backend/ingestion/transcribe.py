import base64
import json
import os
import uuid

import boto3
from botocore.exceptions import ClientError

_s3 = boto3.client("s3", region_name="us-east-1")
_transcribe = boto3.client("transcribe", region_name="us-east-1")

MEDIA_BUCKET = os.environ.get("MEDIA_BUCKET", "")


def start_transcription(
    audio_base64,
    media_format="webm",
    language_code="auto",
    max_speakers=2,
):
    if not MEDIA_BUCKET:
        return {"error": "Media bucket is not configured."}

    job_name = f"bb-{uuid.uuid4().hex[:12]}"
    s3_key = f"audio/{job_name}.{media_format}"

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception:
        return {"error": "Invalid audio data."}

    try:
        _s3.put_object(
            Bucket=MEDIA_BUCKET,
            Key=s3_key,
            Body=audio_bytes,
            ContentType=f"audio/{media_format}",
        )
    except ClientError as exc:
        return {
            "error": f"Upload failed: {exc.response['Error']['Message']}",
        }

    # Speaker diarization: ask Transcribe to label each segment
    # with a speaker (spk_0, spk_1, ...). Clamp to Transcribe's
    # supported range of 2..10 speakers.
    try:
        speaker_count = int(max_speakers)
    except (TypeError, ValueError):
        speaker_count = 2
    speaker_count = max(2, min(speaker_count, 10))

    job_params = {
        "TranscriptionJobName": job_name,
        "Media": {
            "MediaFileUri": f"s3://{MEDIA_BUCKET}/{s3_key}",
        },
        "MediaFormat": media_format,
        "OutputBucketName": MEDIA_BUCKET,
        "OutputKey": f"transcripts/{job_name}.json",
        "Settings": {
            "ShowSpeakerLabels": True,
            "MaxSpeakerLabels": speaker_count,
        },
    }

    if language_code and language_code != "auto":
        job_params["LanguageCode"] = language_code
    else:
        job_params["IdentifyLanguage"] = True

    try:
        _transcribe.start_transcription_job(**job_params)
    except ClientError as exc:
        return {
            "error": (
                f"Transcription failed: "
                f"{exc.response['Error']['Message']}"
            ),
        }

    return {
        "jobName": job_name,
        "status": "IN_PROGRESS",
    }


def _parse_speaker_turns(transcript_data):
    """
    Convert Amazon Transcribe diarization output into an ordered
    list of speaker turns: [{"speaker": "spk_0", "text": "..."}].

    Transcribe returns two parallel structures:
      results.items[]              -> each word/punctuation with a
                                      start_time and content
      results.speaker_labels
        .segments[].items[]        -> each word's start_time mapped
                                      to a speaker_label

    We build a start_time -> speaker_label map from the segments,
    then walk the words in order, grouping consecutive words that
    share a speaker into a single turn.
    """
    results = transcript_data.get("results", {})
    speaker_labels = results.get("speaker_labels", {})
    segments = speaker_labels.get("segments", [])

    if not segments:
        return []

    # Map each word start_time to its speaker label.
    start_to_speaker = {}
    for segment in segments:
        for item in segment.get("items", []):
            start = item.get("start_time")
            speaker = item.get("speaker_label")
            if start is not None and speaker:
                start_to_speaker[start] = speaker

    turns = []
    current_speaker = None
    current_words = []

    for item in results.get("items", []):
        item_type = item.get("type")
        alternatives = item.get("alternatives", [])
        content = alternatives[0].get("content", "") if alternatives else ""

        if item_type == "punctuation":
            # Attach punctuation to the current turn without a space.
            if current_words:
                current_words[-1] = current_words[-1] + content
            continue

        start = item.get("start_time")
        speaker = start_to_speaker.get(start, current_speaker)

        if speaker != current_speaker and current_words:
            turns.append(
                {
                    "speaker": current_speaker or "spk_0",
                    "text": " ".join(current_words).strip(),
                }
            )
            current_words = []

        current_speaker = speaker
        if content:
            current_words.append(content)

    if current_words:
        turns.append(
            {
                "speaker": current_speaker or "spk_0",
                "text": " ".join(current_words).strip(),
            }
        )

    # Drop any empty turns produced by punctuation-only groups.
    return [t for t in turns if t["text"]]


def get_transcription_status(job_name):
    try:
        result = _transcribe.get_transcription_job(
            TranscriptionJobName=job_name,
        )
    except ClientError as exc:
        return {
            "error": (
                f"Status check failed: "
                f"{exc.response['Error']['Message']}"
            ),
        }

    job = result["TranscriptionJob"]
    status = job["TranscriptionJobStatus"]

    if status == "COMPLETED":
        output_key = f"transcripts/{job_name}.json"

        try:
            obj = _s3.get_object(
                Bucket=MEDIA_BUCKET,
                Key=output_key,
            )
            transcript_data = json.loads(
                obj["Body"].read()
            )
        except (ClientError, json.JSONDecodeError):
            return {
                "status": "COMPLETED",
                "transcript": "",
                "error": "Could not read transcript output.",
            }

        transcript_text = (
            transcript_data
            .get("results", {})
            .get("transcripts", [{}])[0]
            .get("transcript", "")
        )

        speaker_turns = _parse_speaker_turns(transcript_data)

        detected_language = job.get(
            "LanguageCode", "en-US"
        )

        return {
            "status": "COMPLETED",
            "transcript": transcript_text,
            "speakerTurns": speaker_turns,
            "detectedLanguage": detected_language,
        }

    if status == "FAILED":
        reason = job.get(
            "FailureReason", "Unknown error"
        )
        return {
            "status": "FAILED",
            "error": reason,
        }

    return {"status": status}
