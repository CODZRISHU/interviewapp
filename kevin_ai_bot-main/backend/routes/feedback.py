from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid
from typing import Optional

from db import database
from controllers.dependencies import get_current_user

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

class FreeTrialFeedback(BaseModel):
    voiceQualityRating: int = Field(default=5, ge=1, le=5)
    questionAccuracyRating: int = Field(default=5, ge=1, le=5)
    targetRole: str = Field(default="Software Engineer", max_length=100)
    experienceLevel: str = Field(default="Fresher", max_length=50)
    perceivedAiQuality: str = Field(..., min_length=1, max_length=2000)
    desiredFeatures: Optional[str] = Field(default=None, max_length=2000)
    generalFeedback: Optional[str] = Field(default=None, max_length=2000)

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_free_trial_feedback(req: FreeTrialFeedback, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    feedback_id = f"fb_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "id": feedback_id,
        "userId": user_id,
        "userName": current_user.get("name"),
        "userEmail": current_user.get("email"),
        "voiceQualityRating": req.voiceQualityRating,
        "questionAccuracyRating": req.questionAccuracyRating,
        "targetRole": req.targetRole.strip(),
        "experienceLevel": req.experienceLevel.strip(),
        "perceivedAiQuality": req.perceivedAiQuality.strip(),
        "desiredFeatures": req.desiredFeatures.strip() if req.desiredFeatures else None,
        "generalFeedback": req.generalFeedback.strip() if req.generalFeedback else None,
        "createdAt": now,
    }
    
    await database.user_feedbacks.insert_one(doc)
    await database.users.update_one({"id": user_id}, {"$set": {"feedbackSubmitted": True}})
    
    doc.pop("_id", None)
    return {"success": True, "message": "Feedback recorded! Thank you for helping us improve Kevin AI.", "feedbackId": feedback_id}
