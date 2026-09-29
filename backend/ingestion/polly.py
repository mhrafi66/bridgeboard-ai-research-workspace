import base64

import boto3
from botocore.exceptions import ClientError

_polly = boto3.client(
    "polly",
    region_name="us-east-1",
)

VOICE_MAP = {
    "en": {"VoiceId": "Joanna", "Engine": "neural"},
    "es": {"VoiceId": "Lupe", "Engine": "neural"},
    "fr": {"VoiceId": "Lea", "Engine": "neural"},
    "de": {"VoiceId": "Vicki", "Engine": "neural"},
    "pt": {"VoiceId": "Camila", "Engine": "neural"},
    "it": {"VoiceId": "Bianca", "Engine": "neural"},
    "ja": {"VoiceId": "Kazuha", "Engine": "neural"},
    "ko": {"VoiceId": "Seoyeon", "Engine": "neural"},
    "zh": {"VoiceId": "Zhiyu", "Engine": "neural"},
    "hi": {"VoiceId": "Kajal", "Engine": "neural"},
    "ar": {"VoiceId": "Zeina", "Engine": "standard"},
    "nl": {"VoiceId": "Laura", "Engine": "neural"},
    "pl": {"VoiceId": "Ola", "Engine": "neural"},
    "ru": {"VoiceId": "Tatyana", "Engine": "standard"},
    "sv": {"VoiceId": "Elin", "Engine": "neural"},
    "tr": {"VoiceId": "Burcu", "Engine": "neural"},
    "da": {"VoiceId": "Naja", "Engine": "standard"},
    "nb": {"VoiceId": "Ida", "Engine": "neural"},
    "ro": {"VoiceId": "Carmen", "Engine": "standard"},
    "cy": {"VoiceId": "Gwyneth", "Engine": "standard"},
}

MAX_TEXT_LENGTH = 2500


def synthesize_speech(text, language_code="en"):
    if not text or not text.strip():
        return {"error": "Text is required."}

    text = text.strip()[:MAX_TEXT_LENGTH]

    voice_config = VOICE_MAP.get(
        language_code,
        VOICE_MAP["en"],
    )

    try:
        result = _polly.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice_config["VoiceId"],
            Engine=voice_config["Engine"],
        )

        audio_stream = result["AudioStream"].read()
        audio_base64 = base64.b64encode(
            audio_stream
        ).decode("utf-8")

        return {
            "audio": audio_base64,
            "contentType": "audio/mpeg",
            "voiceId": voice_config["VoiceId"],
            "languageCode": language_code,
        }

    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        error_message = exc.response["Error"]["Message"]
        return {
            "error": (
                f"Speech synthesis failed: "
                f"{error_code} - {error_message}"
            ),
        }
