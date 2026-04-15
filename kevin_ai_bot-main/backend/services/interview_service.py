from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from config import get_settings
from db import database
from services.ai_service import generate_final_report, generate_question
from utils.helpers import generate_question_plan, sanitize_text, utc_now


settings = get_settings()


def _as_utc_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    if getattr(value, "tzinfo", None) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def ensure_plan_access(user: dict) -> None:
    return None


async def start_interview_for_user(user: dict, config: dict) -> dict:
    current_user = user
    if not user.get("resumeText"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a resume before starting an interview.")

    structured_resume = current_user.get("structuredResume") or {"skills": [], "projects": [], "experience": [], "education": [], "tools": []}
    question_plan = generate_question_plan(config, structured_resume)
    now = utc_now()
    expires_at = now + timedelta(minutes=config.get("duration", 15))
    state = {
        "current_question": 1,
        "total_questions": question_plan["total_questions"],
        "covered_sections": {"skills": 0, "projects": 0, "experience": 0, "fundamentals": 0},
        "question_plan": question_plan,
        "config": config,
        "current_section": "introduction",
        "interview_phase": "introduction",
        "meaningful_responses": 0,
        "empty_responses": 0,
        "started_at": now,
        "expires_at": expires_at,
    }
    interview_id = f"int_{utc_now().strftime('%Y%m%d%H%M%S%f')}"
    first_question = await generate_question(
        config=config,
        structured_resume=structured_resume,
        question_plan=question_plan,
        state=state,
        messages=[],
        user_answer="Candidate joined the room. Begin the interview.",
    )
    document = {
        "id": interview_id,
        "userId": user["id"],
        "config": config,
        "resumeData": structured_resume,
        "messages": [{"role": "assistant", "content": first_question["message"], "timestamp": now}],
        "state": state,
        "status": "active",
        "createdAt": now,
        "startedAt": now,
        "expiresAt": expires_at,
        "endedAt": None,
    }
    await database.interviews.insert_one(document)
    await database.users.update_one({"id": user["id"]}, {"$set": {"usageCount": current_user.get("usageCount", 0) + 1}})
    return {"interview_id": interview_id, "status": "active", "config": config, "state": state, "message": first_question["message"]}


async def get_interview_for_user(user_id: str, interview_id: str) -> dict:
    interview = await database.interviews.find_one({"id": interview_id, "userId": user_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    for key in ("createdAt", "startedAt", "expiresAt", "endedAt"):
        if interview.get(key):
            interview[key] = _as_utc_datetime(interview[key]).isoformat()

    state = interview.get("state") or {}
    for key in ("started_at", "expires_at"):
        if state.get(key):
            state[key] = _as_utc_datetime(state[key]).isoformat()
    interview["state"] = state

    for item in interview.get("messages", []):
        if item.get("timestamp"):
            item["timestamp"] = _as_utc_datetime(item["timestamp"]).isoformat()
    return interview


async def progress_interview(user: dict, interview_id: str, user_answer: str) -> dict:
    interview = await get_interview_for_user(user["id"], interview_id)
    if interview["status"] != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interview has already ended.")

    clean_answer = sanitize_text(user_answer)
    if not clean_answer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Answer cannot be empty.")

    state = interview["state"]
    previous_section = state.get("current_section", "introduction")
    if len(clean_answer) < 10:
        state["empty_responses"] = state.get("empty_responses", 0) + 1
    else:
        state["meaningful_responses"] = state.get("meaningful_responses", 0) + 1
        state["empty_responses"] = 0

    if len(clean_answer) >= 10 and previous_section in state["covered_sections"]:
        state["covered_sections"][previous_section] = state["covered_sections"].get(previous_section, 0) + 1

    now = utc_now()
    expires_at = _as_utc_datetime(state.get("expires_at") or interview.get("expiresAt"))
    user_message = {"role": "user", "content": clean_answer, "timestamp": now}
    prior_messages = interview["messages"] + [user_message]

    reached_time_limit = bool(expires_at and now >= expires_at)
    reached_question_limit = state.get("current_question", 1) >= state.get("total_questions", 1)
    if reached_time_limit or reached_question_limit:
        closing_message = (
            "Thanks, that gives me enough signal for this round. I'm ending the interview here and generating your report now."
            if reached_question_limit
            else "We're at time for this interview. Thanks for staying with me. I'm wrapping this up and generating your report now."
        )
        state["interview_phase"] = "wrap_up"
        state["current_question"] = state.get("total_questions", state.get("current_question", 1))
        assistant_message = {"role": "assistant", "content": closing_message, "timestamp": now}
        await database.interviews.update_one(
            {"id": interview_id},
            {"$push": {"messages": {"$each": [user_message, assistant_message]}}, "$set": {"state": state}},
        )
        return {
            "interview_id": interview_id,
            "status": "active",
            "state": state,
            "message": closing_message,
            "auto_end": True,
        }

    next_question = await generate_question(
        config=interview["config"],
        structured_resume=interview["resumeData"],
        question_plan=state["question_plan"],
        state=state,
        messages=prior_messages,
        user_answer=clean_answer,
    )
    state["current_question"] += 1
    state["current_section"] = next_question.get("section", previous_section)
    section_phase_map = {
        "introduction": "introduction",
        "projects": "project_deep_dive",
        "experience": "experience",
        "fundamentals": "fundamentals",
        "skills": "skills_and_wrapup",
    }
    state["interview_phase"] = section_phase_map.get(state["current_section"], state.get("interview_phase", "introduction"))
    current_q = state["current_question"]
    total_q = state["total_questions"]
    new_messages = [
        user_message,
        {"role": "assistant", "content": next_question["message"], "timestamp": now},
    ]
    await database.interviews.update_one({"id": interview_id}, {"$push": {"messages": {"$each": new_messages}}, "$set": {"state": state}})
    return {"interview_id": interview_id, "status": "active", "state": state, "message": next_question["message"], "auto_end": False}


async def finish_interview(user: dict, interview_id: str) -> dict:
    interview = await get_interview_for_user(user["id"], interview_id)
    messages = interview.get("messages", [])
    meaningful_count = sum(1 for item in messages if item["role"] == "user" and len(item["content"].strip()) >= 10)
    now = utc_now()

    if meaningful_count < 2:
        report_payload = {
            "id": f"rpt_{now.strftime('%Y%m%d%H%M%S%f')}",
            "interviewId": interview_id,
            "userId": user["id"],
            "status": "incomplete",
            "scores": {"technical": 0, "communication": 0, "confidence": 0, "problem_solving": 0},
            "strengths": [],
            "weaknesses": [],
            "improvements": ["Complete a full interview with detailed answers to receive a meaningful report."],
            "section_scores": {},
            "verdict": "Incomplete",
            "summary": "Interview ended before enough meaningful responses were captured to evaluate performance.",
            "config": interview["config"],
            "createdAt": now,
        }
    else:
        evaluation = await generate_final_report(interview["config"], interview["state"], messages)
        scores = evaluation.get("scores", {})
        report_payload = {
            "id": f"rpt_{now.strftime('%Y%m%d%H%M%S%f')}",
            "interviewId": interview_id,
            "userId": user["id"],
            "status": evaluation.get("status", "completed"),
            "scores": {
                "technical": float(scores.get("technical", 5)),
                "communication": float(scores.get("communication", 5)),
                "confidence": float(scores.get("confidence", 5)),
                "problem_solving": float(scores.get("problem_solving", 5)),
            },
            "strengths": evaluation.get("strengths", []),
            "weaknesses": evaluation.get("weaknesses", []),
            "improvements": evaluation.get("improvements", []),
            "section_scores": evaluation.get("section_scores", {}),
            "verdict": evaluation.get("verdict", "Needs Improvement"),
            "summary": evaluation.get("summary", ""),
            "config": interview["config"],
            "createdAt": now,
        }

    await database.reports.insert_one(report_payload)
    await database.interviews.update_one({"id": interview_id}, {"$set": {"status": "completed", "endedAt": now}})
    await database.analytics_events.insert_one({"userId": user["id"], "event": "interview_completed", "properties": {"interviewId": interview_id, "status": report_payload["status"]}, "createdAt": now})
    report_payload.pop("_id", None)
    return report_payload
