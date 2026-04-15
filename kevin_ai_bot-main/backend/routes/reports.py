from fastapi import APIRouter, Depends, HTTPException, status

from controllers.dependencies import get_current_user
from db import database


router = APIRouter(tags=["reports"])


@router.get("/reports")
async def list_reports(user=Depends(get_current_user)):
    return await database.reports.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)


@router.get("/reports/{report_id}")
async def get_report(report_id: str, user=Depends(get_current_user)):
    report = await database.reports.find_one({"id": report_id, "userId": user["id"]}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    return report
