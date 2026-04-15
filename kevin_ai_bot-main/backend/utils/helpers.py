import math
import re
from datetime import datetime, timezone
from typing import Any, Dict


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def sanitize_text(value: str) -> str:
    normalized = re.sub(r"[^\S\r\n]+", " ", value or "").strip()
    return normalized[:4000]


def generate_question_plan(config: Dict[str, Any], structured_resume: Dict[str, Any]) -> Dict[str, Any]:
    duration = config.get("duration", 15)
    total_questions = max(4, math.floor(duration / 2))
    level = config.get("level", "fresher")
    projects = structured_resume.get("projects", []) or []
    skills = (structured_resume.get("skills", []) or []) + (structured_resume.get("tools", []) or [])
    has_experience = bool(structured_resume.get("experience"))

    if duration <= 10:
        sequence = [
            "introduction",
            "project_overview",
            "project_technical",
            "experience_challenge" if has_experience else "skill_deep_dive",
            "skills_quick_fire" if skills else "closeout",
        ]
    elif duration <= 15:
        sequence = [
            "introduction",
            "project_overview",
            "project_technical",
            "project_followup",
            "experience_challenge" if has_experience else "skill_deep_dive",
            "skill_deep_dive" if skills else "fundamentals",
            "closeout",
        ]
    else:
        sequence = [
            "introduction",
            "project_overview",
            "project_technical",
            "project_followup",
            "project_overview",
            "project_technical",
            "project_followup",
            "experience_challenge" if has_experience else "skill_deep_dive",
            "experience_followup" if has_experience else "fundamentals",
            "skill_deep_dive" if skills else "fundamentals",
            "skills_quick_fire" if skills else "fundamentals",
            "fundamentals",
            "fundamentals",
            "closeout",
            "closeout",
        ]

    if level == "fresher" and duration <= 15:
        sequence = [item for item in sequence if item != "project_followup"] + ["closeout"]
    elif level == "senior" and duration >= 30:
        extra_project_rounds = min(len(projects), 3)
        sequence = sequence[:]
        for _ in range(max(0, extra_project_rounds - 2)):
            sequence.insert(7, "project_followup")
            sequence.insert(7, "project_technical")
            sequence.insert(7, "project_overview")

    sequence = sequence[:total_questions]
    if sequence[-1] != "closeout":
        sequence[-1] = "closeout"

    section_map = {
        "introduction": "introduction",
        "project_overview": "projects",
        "project_technical": "projects",
        "project_followup": "projects",
        "experience_challenge": "experience",
        "experience_followup": "experience",
        "skill_deep_dive": "skills",
        "skills_quick_fire": "skills",
        "fundamentals": "fundamentals",
        "closeout": "introduction",
    }
    distribution = {"skills": 0, "projects": 0, "experience": 0, "fundamentals": 0}
    for item in sequence:
        section = section_map[item]
        if section in distribution:
            distribution[section] += 1

    return {"distribution": distribution, "total_questions": total_questions, "sequence": sequence}
