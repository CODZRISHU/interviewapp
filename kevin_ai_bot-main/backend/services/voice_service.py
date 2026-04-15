import io
import tempfile
from functools import lru_cache

from fastapi import HTTPException, UploadFile, status
from openai import AsyncOpenAI

from config import get_settings


settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


@lru_cache
def _get_faster_whisper_model():
    if settings.stt_provider.lower() != "local":
        return None

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local transcription is enabled, but faster-whisper is not installed on the server.",
        ) from exc

    try:
        return WhisperModel(
            settings.faster_whisper_model,
            device=settings.faster_whisper_device,
            compute_type=settings.faster_whisper_compute_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The local Whisper model could not be loaded. Check the model name and server resources.",
        ) from exc


async def _transcribe_with_openai(file: UploadFile) -> str:
    if not openai_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech transcription is not configured on the server. Use browser voice input, local Whisper, or add an OpenAI key for Whisper.",
        )

    audio_bytes = await file.read()
    buffer = io.BytesIO(audio_bytes)
    buffer.name = file.filename or "recording.webm"
    transcript = await openai_client.audio.transcriptions.create(model="whisper-1", file=buffer)
    return transcript.text.strip()


async def _transcribe_with_local_model(file: UploadFile) -> str:
    model = _get_faster_whisper_model()
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local transcription is not enabled on the server.",
        )

    audio_bytes = await file.read()
    suffix = ".webm"
    if file.filename and "." in file.filename:
        suffix = f".{file.filename.rsplit('.', 1)[-1]}"

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name
        segments, _ = model.transcribe(temp_path, beam_size=5, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments if segment.text).strip()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Local transcription failed while processing the audio file.",
        ) from exc
    finally:
        try:
            import os
            if "temp_path" in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass

    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No speech could be detected in the recording.",
        )
    return text


async def transcribe_audio(file: UploadFile) -> str:
    provider = settings.stt_provider.lower()
    if provider == "local":
        return await _transcribe_with_local_model(file)
    if provider == "openai":
        return await _transcribe_with_openai(file)

    if provider == "browser":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server transcription is disabled because browser speech recognition is the active voice mode.",
        )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unsupported speech transcription provider configuration.",
    )
