import io

from fastapi import HTTPException, UploadFile, status
from PyPDF2 import PdfReader

from config import get_settings
from services.ai_service import structure_resume
from utils.helpers import sanitize_text


settings = get_settings()


async def parse_resume(file: UploadFile) -> tuple[str, dict]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF resumes are supported.")

    file_data = await file.read()
    max_bytes = settings.max_resume_size_mb * 1024 * 1024
    if len(file_data) > max_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume exceeds the maximum file size.")

    reader = PdfReader(io.BytesIO(file_data))
    extracted = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text:
            extracted.append(text)

    resume_text = sanitize_text("\n".join(extracted))
    if not resume_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to extract text from this PDF.")

    structured_resume = await structure_resume(resume_text)
    return resume_text, structured_resume

