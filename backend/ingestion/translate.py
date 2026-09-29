import boto3
from botocore.exceptions import ClientError

_translate = boto3.client(
    "translate",
    region_name="us-east-1",
)

MAX_TEXT_LENGTH = 5000


def translate_text(text, target_language="en"):
    if not text or not text.strip():
        return {
            "error": "Text is required.",
        }

    text = text.strip()[:MAX_TEXT_LENGTH]

    try:
        result = _translate.translate_text(
            Text=text,
            SourceLanguageCode="auto",
            TargetLanguageCode=target_language,
        )

        source_language = result.get(
            "SourceLanguageCode", "auto"
        )

        translated = result.get(
            "TranslatedText", ""
        )

        return {
            "originalText": text,
            "detectedLanguage": source_language,
            "translatedText": translated,
            "targetLanguage": target_language,
        }

    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        error_message = exc.response["Error"]["Message"]
        return {
            "error": f"Translation failed: {error_code} - {error_message}",
        }
