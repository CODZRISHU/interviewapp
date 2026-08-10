from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
import uuid
from typing import Optional

from db import database
from utils.security import safe_decode_access_token

router = APIRouter(prefix="/api/contact", tags=["contact"])

async def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = safe_decode_access_token(token)
    if not payload:
        return None
    return await database.users.find_one({"id": payload["sub"]})

class ContactRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    company: Optional[str] = None
    subject: str = Field(..., min_length=3, max_length=150)
    requestType: str = Field(default="general")
    message: str = Field(..., min_length=10, max_length=2000)

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_contact_request(req: ContactRequest, current_user: Optional[dict] = Depends(get_optional_user)):
    now = datetime.now(timezone.utc)
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "id": request_id,
        "name": req.name.strip(),
        "email": req.email.strip().lower(),
        "company": req.company.strip() if req.company else None,
        "subject": req.subject.strip(),
        "requestType": req.requestType,
        "message": req.message.strip(),
        "userId": current_user.get("id") if current_user else None,
        "status": "pending",
        "createdAt": now,
    }
    
    await database.contact_requests.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "message": "Your request has been submitted successfully!", "requestId": request_id}
