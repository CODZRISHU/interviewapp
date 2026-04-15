from fastapi import APIRouter, Depends, File, UploadFile

from controllers.dependencies import get_current_user
from db import database
from models.schemas import EndInterviewRequest, InterviewConfig, NextQuestionRequest, ResumeResponse
from services.auth_service import serialize_user
from services.billing_service import reconcile_user_billing_state
from services.interview_service import finish_interview, get_interview_for_user, progress_interview, start_interview_for_user
from services.resume_service import parse_resume
from services.voice_service import transcribe_audio


router = APIRouter(tags=["interviews"])


@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...), user=Depends(get_current_user)):
    resume_text, structured_resume = await parse_resume(file)
    await database.users.update_one(
        {"id": user["id"]},
        {"$set": {"resumeFilename": file.filename, "resumeText": resume_text, "structuredResume": structured_resume}},
    )
    return {"message": "Resume uploaded successfully.", "filename": file.filename, "text_length": len(resume_text), "structured": bool(structured_resume)}


@router.get("/resume", response_model=ResumeResponse)
async def get_resume(user=Depends(get_current_user)):
    return ResumeResponse(
        resumeText=user.get("resumeText", ""),
        resumeFilename=user.get("resumeFilename", ""),
        structuredResume=user.get("structuredResume"),
    )


@router.get("/profile")
async def profile(user=Depends(get_current_user)):
    return serialize_user(await reconcile_user_billing_state(user)).model_dump()


@router.post("/start-interview")
async def start_interview(payload: InterviewConfig, user=Depends(get_current_user)):
    return await start_interview_for_user(user, payload.model_dump())


@router.post("/next-question")
async def next_question(payload: NextQuestionRequest, user=Depends(get_current_user)):
    return await progress_interview(user, payload.interview_id, payload.user_answer)


@router.post("/end-interview")
async def end_interview(payload: EndInterviewRequest, user=Depends(get_current_user)):
    return await finish_interview(user, payload.interview_id)


@router.get("/interviews")
async def list_interviews(user=Depends(get_current_user)):
    return await database.interviews.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)


@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: str, user=Depends(get_current_user)):
    return await get_interview_for_user(user["id"], interview_id)


@router.post("/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...), user=Depends(get_current_user)):
    return {"text": await transcribe_audio(file)}
