import json
import random
import re
from textwrap import dedent
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncOpenAI

from config import get_settings
from utils.helpers import sanitize_text


settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
gemini_endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _json_text(value: Any, limit: int | None = None) -> str:
    text = json.dumps(value, default=str)
    return text[:limit] if limit else text


def _extract_json_object(content: str) -> Dict[str, Any] | None:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = cleaned.removesuffix("```").strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


async def _gemini_chat_json(system_prompt: str, user_prompt: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not settings.gemini_api_key:
        return fallback

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.55,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=40) as http_client:
            response = await http_client.post(
                gemini_endpoint.format(model=settings.gemini_model),
                params={"key": settings.gemini_api_key},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
        candidates = body.get("candidates", [])
        if not candidates:
            return fallback
        parts = candidates[0].get("content", {}).get("parts", [])
        content = "".join(part.get("text", "") for part in parts).strip()
        parsed = _extract_json_object(content)
        return parsed if parsed else fallback
    except Exception:
        return fallback


async def _chat_json(system_prompt: str, user_prompt: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if settings.gemini_api_key:
        return await _gemini_chat_json(system_prompt, user_prompt, fallback)

    if not client:
        return fallback

    response = await client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
    )
    content = response.choices[0].message.content or "{}"
    parsed = _extract_json_object(content)
    return parsed if parsed else fallback


def _difficulty(config: Dict[str, Any]) -> str:
    level = config.get("level", "fresher")
    return {
        "fresher": "easy",
        "mid": "medium",
        "senior": "hard",
    }.get(level, "medium")


def _recent_assistant_messages(messages: List[Dict[str, Any]]) -> List[str]:
    return [item["content"] for item in messages if item["role"] == "assistant"][-6:]


def _pick_non_repeating(options: List[str], recent_messages: List[str]) -> str:
    for option in options:
        if option not in recent_messages:
            return option
    return options[0]


def _is_weak_answer(answer: str) -> bool:
    answer = sanitize_text(answer).lower()
    weak_markers = ["i don't know", "not sure", "maybe", "can't remember", "skip", "pass"]
    return len(answer) < 25 or any(marker in answer for marker in weak_markers)


def _split_sentences(text: str) -> List[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", sanitize_text(text)) if part.strip()]


def _answer_signals(answer: str) -> Dict[str, Any]:
    clean = sanitize_text(answer)
    normalized = clean.lower()
    words = re.findall(r"\b[\w+-]+\b", normalized)
    unique_words = set(words)

    weak_markers = ["i don't know", "not sure", "maybe", "can't remember", "skip", "pass", "not familiar"]
    filler_markers = ["basically", "actually", "like", "sort of", "kind of"]
    action_markers = ["i built", "i implemented", "i designed", "i optimized", "i fixed", "i used", "i created", "i deployed"]
    outcome_markers = ["result", "improved", "reduced", "increased", "faster", "latency", "performance", "users", "%", "ms", "seconds"]
    tradeoff_markers = ["because", "tradeoff", "instead", "rather than", "pros", "cons", "why", "chose", "decision"]
    collaboration_markers = ["team", "mentor", "manager", "review", "stakeholder", "customer", "we ", "collaborated"]
    technical_markers = [
        "api", "backend", "frontend", "database", "sql", "index", "cache", "latency", "react", "fastapi",
        "python", "java", "node", "deployment", "jwt", "authentication", "query", "dsa", "oops", "class",
    ]

    sentence_count = len(_split_sentences(clean))
    has_numbers = bool(re.search(r"\b\d+(\.\d+)?\b|%|ms|seconds?|minutes?\b", normalized))
    specificity_hits = sum(1 for marker in action_markers + technical_markers if marker in normalized)
    outcome_hits = sum(1 for marker in outcome_markers if marker in normalized)
    tradeoff_hits = sum(1 for marker in tradeoff_markers if marker in normalized)
    collaboration_hits = sum(1 for marker in collaboration_markers if marker in normalized)
    weak_hits = sum(1 for marker in weak_markers if marker in normalized)
    filler_hits = sum(normalized.count(marker) for marker in filler_markers)

    evidence_score = 0
    if len(words) >= 45:
        evidence_score += 1
    if sentence_count >= 3:
        evidence_score += 1
    if specificity_hits >= 2:
        evidence_score += 1
    if outcome_hits >= 1 or has_numbers:
        evidence_score += 1
    if tradeoff_hits >= 1:
        evidence_score += 1

    return {
        "word_count": len(words),
        "sentence_count": sentence_count,
        "unique_ratio": round(len(unique_words) / max(len(words), 1), 2),
        "has_numbers": has_numbers,
        "specificity_hits": specificity_hits,
        "outcome_hits": outcome_hits,
        "tradeoff_hits": tradeoff_hits,
        "collaboration_hits": collaboration_hits,
        "weak_hits": weak_hits,
        "filler_hits": filler_hits,
        "evidence_score": evidence_score,
    }


def _section_from_question(question: str) -> str:
    normalized = sanitize_text(question).lower()
    if any(keyword in normalized for keyword in ["project", "architecture", "backend", "frontend", "implementation"]):
        return "projects"
    if any(keyword in normalized for keyword in ["internship", "company", "role at", "experience"]):
        return "experience"
    if any(keyword in normalized for keyword in ["oop", "sql", "dsa", "latency", "fundamental", "complexity", "joins", "rest api"]):
        return "fundamentals"
    if any(keyword in normalized for keyword in ["skill", "react", "python", "java", "fastapi", "tech stack"]):
        return "skills"
    return "general"


def _score_band(value: float) -> float:
    return max(3.0, min(round(value, 1), 9.2))


def _dedupe_keep_order(items: List[str]) -> List[str]:
    result: List[str] = []
    seen = set()
    for item in items:
        clean = sanitize_text(item)
        key = clean.lower()
        if clean and key not in seen:
            seen.add(key)
            result.append(clean)
    return result


def _section_feedback(section: str, answer: str, signals: Dict[str, Any]) -> Dict[str, List[str] | float]:
    strengths: List[str] = []
    weaknesses: List[str] = []
    improvements: List[str] = []

    base_score = 4.2
    base_score += min(signals["evidence_score"] * 0.8, 3.2)
    base_score += 0.5 if signals["collaboration_hits"] and section == "experience" else 0
    base_score += 0.4 if signals["tradeoff_hits"] and section in {"projects", "fundamentals", "skills"} else 0
    base_score += 0.4 if signals["has_numbers"] else 0
    base_score -= min(signals["weak_hits"] * 0.8, 1.6)
    base_score -= 0.3 if signals["word_count"] < 20 else 0
    base_score -= 0.3 if signals["sentence_count"] < 2 else 0
    score = _score_band(base_score)

    if signals["specificity_hits"] >= 2:
        strengths.append(f"{section.capitalize()} answers included concrete implementation details instead of staying generic.")
    if signals["tradeoff_hits"] >= 1:
        strengths.append(f"{section.capitalize()} discussion showed some reasoning behind technical choices and tradeoffs.")
    if signals["has_numbers"] or signals["outcome_hits"] >= 1:
        strengths.append(f"{section.capitalize()} answers referenced outcomes, performance, or measurable impact.")

    if signals["word_count"] < 30 or signals["sentence_count"] < 2:
        weaknesses.append(f"{section.capitalize()} answers were too brief to fully evaluate depth and ownership.")
        improvements.append(f"For {section}, answer in a clearer structure: context, what you owned, what you did, and what happened.")
    if signals["specificity_hits"] < 2:
        weaknesses.append(f"{section.capitalize()} answers stayed high-level and missed implementation specifics.")
        improvements.append(f"Prepare 2-3 concrete examples for {section}, including architecture, bugs, tools, or exact decisions.")
    if section in {"projects", "skills", "fundamentals"} and signals["tradeoff_hits"] == 0:
        weaknesses.append(f"{section.capitalize()} responses did not explain why one approach was chosen over another.")
        improvements.append(f"In {section} questions, explicitly explain tradeoffs, alternatives considered, and why your choice made sense.")
    if section == "experience" and signals["collaboration_hits"] == 0:
        weaknesses.append("Experience answers did not clearly show team communication, ownership boundaries, or stakeholder interaction.")
        improvements.append("Use STAR for internship or work stories and mention who you worked with, the challenge, and the result.")
    if signals["weak_hits"] > 0:
        weaknesses.append(f"{section.capitalize()} confidence dropped in parts of the answer, which made ownership feel uncertain.")
        improvements.append(f"If you are unsure in {section}, anchor your answer in one thing you actually built or debugged instead of speaking broadly.")

    return {
        "score": score,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "improvements": improvements,
    }


def _best_project(structured_resume: Dict[str, Any]) -> Dict[str, Any] | None:
    projects = structured_resume.get("projects", [])
    return projects[0] if projects else None


def _pick_project(structured_resume: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any] | None:
    projects = structured_resume.get("projects", []) or []
    if not projects:
        return None
    index = state.get("active_project_index")
    if not isinstance(index, int):
        index = _project_block_index(state)
    index = index % len(projects)
    return projects[index]


def _best_experience(structured_resume: Dict[str, Any]) -> Dict[str, Any] | None:
    experience = structured_resume.get("experience", [])
    return experience[0] if experience else None


def _pick_experience(structured_resume: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any] | None:
    experience = structured_resume.get("experience", []) or []
    if not experience:
        return None
    index = state.get("covered_sections", {}).get("experience", 0) % len(experience)
    return experience[index]


def _top_skills(structured_resume: Dict[str, Any]) -> List[str]:
    skills = structured_resume.get("skills", []) or []
    tools = structured_resume.get("tools", []) or []
    return [item for item in (skills + tools) if item][:6]


def _lead_in(user_answer: str | None, current_question: int) -> str:
    if not sanitize_text(user_answer or ""):
        return ""
    if current_question <= 1:
        return "Alright,"
    options = ["Mm-hmm,", "Right,", "Okay,", "Got it,", "Umm, yes,"]
    return random.choice(options)


def _project_name(project: Dict[str, Any] | None) -> str:
    return (project or {}).get("name") or "that project"


def _tech_suffix(project: Dict[str, Any] | None) -> str:
    technologies = (project or {}).get("technologies", [])
    if isinstance(technologies, list) and technologies:
        return f" using {', '.join(technologies[:4])}"
    return ""


def _next_stage(state: Dict[str, Any]) -> str:
    sequence = state.get("question_plan", {}).get("sequence", [])
    current_q = state.get("current_question", 1)
    if not sequence:
        return "project_overview"
    return sequence[min(current_q, len(sequence) - 1)]


def _project_block_index(state: Dict[str, Any]) -> int:
    sequence = state.get("question_plan", {}).get("sequence", [])
    upto_index = min(state.get("current_question", 1), len(sequence) - 1)
    seen_overviews = 0
    for idx in range(upto_index + 1):
        if sequence[idx] == "project_overview":
            seen_overviews += 1
    return max(seen_overviews - 1, 0)


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _find_project_index_from_text(structured_resume: Dict[str, Any], text: str | None) -> int | None:
    projects = structured_resume.get("projects", []) or []
    normalized_answer = _normalize_text(text or "")
    if not normalized_answer:
        return None

    for index, project in enumerate(projects):
        normalized_name = _normalize_text(project.get("name", ""))
        if normalized_name and normalized_name in normalized_answer:
            return index

        keywords = [word for word in normalized_name.split() if len(word) > 2]
        if keywords and sum(1 for keyword in keywords if keyword in normalized_answer) >= max(1, min(2, len(keywords))):
            return index

    return None


def _follow_up_intro(config: Dict[str, Any], structured_resume: Dict[str, Any], recent_messages: List[str]) -> Dict[str, Any]:
    project = _best_project(structured_resume)
    experience = _best_experience(structured_resume)
    role = config.get("role", "Software Engineer")

    options = [
        f"Hi, I'm Kevin. We'll do a realistic {role} interview today. Start by giving me a brief introduction focused on your projects, internships, and the tech you've worked with.",
        f"Let's begin. Give me a concise introduction and mention the project or internship you're most confident discussing for this {role} interview.",
    ]
    if project:
        options.append(
            f"Before we get technical, introduce yourself briefly. After that I'll want to go deeper into your project {project.get('name', 'from your resume')}."
        )
    if experience:
        options.append(
            f"Give me a short introduction, then be ready to discuss your experience at {experience.get('company', 'your internship/company')} in detail."
        )
    return {"message": _pick_non_repeating(options, recent_messages), "section": "introduction"}


def _pick_skill(structured_resume: Dict[str, Any], state: Dict[str, Any]) -> str:
    skills = _top_skills(structured_resume)
    if not skills:
        return "your main tech stack"
    index = state.get("covered_sections", {}).get("skills", 0) % len(skills)
    return skills[index]


def _project_overview_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None) -> Dict[str, Any]:
    project = _pick_project(structured_resume, state)
    difficulty = _difficulty(config)
    if not project:
        options = [
            "Walk me through the strongest technical project you've built recently. What problem were you solving, and what exactly did you own?",
            "Pick one project you're proud of and explain the architecture, your role, and the hardest technical decision you made.",
        ]
        return {"message": _pick_non_repeating(options, recent_messages), "section": "projects"}

    name = _project_name(project)
    tech_suffix = _tech_suffix(project)
    lead_in = _lead_in(user_answer, state.get("current_question", 1))

    if weak_answer:
        options = [
            f"{lead_in} let's stay on {name}. Explain the problem statement clearly first, then tell me what part you personally built{tech_suffix}.",
            f"{lead_in} go deeper on {name}. I want the actual flow, your contribution, and what users were trying to do.",
        ]
    elif difficulty == "hard":
        options = [
            f"{lead_in} you mentioned {name} on your resume{tech_suffix}. Start from the top: what problem did it solve, what was the architecture, and what did you personally own?",
            f"{lead_in} on your resume you listed {name}. Walk me through it like I'm the hiring manager. What was the goal, what stack did you choose, and why?",
        ]
    else:
        options = [
            f"{lead_in} you mentioned {name} on your resume{tech_suffix}. Can you explain that project from the problem statement through your implementation?",
            f"{lead_in} let's start with {name}. What was the product goal, what did you build, and what part are you most confident discussing?",
        ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "projects"}


def _project_technical_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None) -> Dict[str, Any]:
    project = _pick_project(structured_resume, state)
    difficulty = _difficulty(config)
    name = _project_name(project)
    tech_suffix = _tech_suffix(project)
    lead_in = _lead_in(user_answer, state.get("current_question", 1))

    if weak_answer:
        options = [
            f"{lead_in} stay with {name}. Pick one technical part{tech_suffix} and explain how data moved through the system.",
            f"{lead_in} I want one concrete technical example from {name}. Which API, component, or database flow was hardest and why?",
        ]
    elif difficulty == "hard":
        options = [
            f"{lead_in} for {name}{tech_suffix}, walk me through one technical design decision you made and the tradeoffs behind it.",
            f"{lead_in} on {name}, if I asked you to review the backend design in detail, what endpoint, data flow, or bottleneck would you start with?",
        ]
    else:
        options = [
            f"{lead_in} on {name}{tech_suffix}, what was the toughest engineering challenge and how did you solve it?",
            f"{lead_in} for {name}, explain one technical problem you ran into and the exact fix you implemented.",
        ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "projects"}


def _project_followup_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None) -> Dict[str, Any]:
    project = _pick_project(structured_resume, state)
    difficulty = _difficulty(config)
    name = _project_name(project)
    lead_in = _lead_in(user_answer, state.get("current_question", 1))

    if weak_answer:
        options = [
            f"{lead_in} let's slow down on {name}. What exactly broke, and how did you debug it step by step?",
            f"{lead_in} on {name}, tell me one feature you owned completely and how you tested whether it worked.",
        ]
    elif difficulty == "hard":
        options = [
            f"{lead_in} on {name}, what failure cases worried you most, and how would you scale or redesign it if usage grew 20x?",
            f"{lead_in} if I pushed back on your design for {name}, what tradeoff would you defend and what would you admit needs improvement?",
        ]
    else:
        options = [
            f"{lead_in} on {name}, what would you improve if you rebuilt it today, and what did you learn from the original version?",
            f"{lead_in} for {name}, tell me about one bug, one decision, and one tradeoff that really tested you.",
        ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "projects"}


def _experience_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None, followup: bool = False) -> Dict[str, Any]:
    experience = _pick_experience(structured_resume, state)
    difficulty = _difficulty(config)
    lead_in = _lead_in(user_answer, state.get("current_question", 1))
    if not experience:
        options = [
            f"{lead_in} tell me about any internship, team project, or real collaboration where you had to ship something with deadlines and feedback.",
            f"{lead_in} describe a time you worked in a team and had to balance code quality, speed, and changing requirements.",
        ]
        return {"message": _pick_non_repeating(options, recent_messages), "section": "experience"}

    company = experience.get("company", "that company")
    title = experience.get("title", "that role")
    if weak_answer:
        options = [
            f"{lead_in} let's slow down. In your {title} role at {company}, what were you actually responsible for week to week?",
            f"{lead_in} be specific about {company}. What did you build, who reviewed your work, and how was success measured?",
        ]
    elif followup or difficulty == "hard":
        options = [
            f"{lead_in} in your {title} role at {company}, what challenge or tradeoff really tested you, and how did you handle it?",
            f"{lead_in} tell me about a difficult production-style issue from {company}. How did you debug it, communicate it, and decide on the fix?",
        ]
    else:
        options = [
            f"{lead_in} tell me about your {title} experience at {company}. What did you build, what did you own, and what did you learn from that environment?",
            f"{lead_in} at {company}, what kind of tasks were you trusted with, and where did you add the most value?",
        ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "experience"}


def _skill_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None, quick_fire: bool = False) -> Dict[str, Any]:
    difficulty = _difficulty(config)
    skill = _pick_skill(structured_resume, state)
    lead_in = _lead_in(user_answer, state.get("current_question", 1))
    if weak_answer:
        options = [
            f"{lead_in} let's narrow it down to {skill}. Explain one concept in {skill} that you have actually used in a project, not just studied.",
            f"{lead_in} stay with {skill}. Give me a concrete example of where you used it and why it mattered in your implementation.",
        ]
    elif quick_fire:
        options = [
            f"{lead_in} quick check on {skill}: what is one concept in it that you are genuinely comfortable implementing?",
            f"{lead_in} short follow-up on {skill}: where have you actually used it in a project, and what did it help you do?",
        ]
    elif difficulty == "hard":
        options = [
            f"{lead_in} you listed {skill}. I don't want a definition. Tell me where it breaks, what tradeoffs it introduces, and when you would avoid it.",
            f"{lead_in} on {skill}, compare two practical approaches you've seen or used, and justify which one you would choose for a real product.",
        ]
    else:
        options = [
            f"{lead_in} you mentioned {skill}. What have you actually built with it, and what are two concepts in it that you're confident about?",
            f"{lead_in} let's talk about {skill}. Explain it through a project example instead of a textbook definition.",
        ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "skills"}


def _fundamentals_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None) -> Dict[str, Any]:
    difficulty = _difficulty(config)
    role = config.get("role", "software engineer")
    skill = _pick_skill(structured_resume, state)
    lead_in = _lead_in(user_answer, state.get("current_question", 1))
    if weak_answer:
        options = [
            f"{lead_in} let's make this simpler. Explain one backend or data-structure concept you know well, and then apply it to a project you've built.",
            f"{lead_in} pick one core concept you are comfortable with, like API design, database indexing, or complexity, and explain it with an example.",
        ]
    elif difficulty == "hard":
        options = [
            f"{lead_in} for a {role} role, suppose your API latency suddenly spikes under load. How would you investigate the root cause step by step?",
            f"{lead_in} let's do a deeper systems question. If one of your project endpoints became slow at scale, where would you look first and why?",
        ]
    elif difficulty == "medium":
        options = [
            f"{lead_in} give me one important backend or problem-solving concept for a {role}, then explain how it appears in real project work.",
            f"{lead_in} you mentioned {skill}. If we connect that to fundamentals, what concept around performance, OOP, SQL, or DSA do you think matters most and why?",
        ]
    else:
        options = [
            f"{lead_in} let's do a fundamentals check. Explain a concept like OOP, SQL joins, time complexity, or REST API design in simple practical terms.",
            f"{lead_in} pick one core concept you know well and explain where it shows up in real software projects.",
        ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "fundamentals"}


def _closeout_question(config: Dict[str, Any], structured_resume: Dict[str, Any], state: Dict[str, Any], weak_answer: bool, recent_messages: List[str], user_answer: str | None) -> Dict[str, Any]:
    role = config.get("role", "Software Engineer")
    lead_in = _lead_in(user_answer, state.get("current_question", 1))
    options = [
        f"{lead_in} before we wrap, what would you say are your strongest reasons for being a fit for a {role} role right now?",
        f"{lead_in} final question from my side. What part of your background should an interviewer remember after this conversation?",
    ]
    return {"message": _pick_non_repeating(options, recent_messages), "section": "introduction"}


def _local_generate_question(
    config: Dict[str, Any],
    structured_resume: Dict[str, Any],
    state: Dict[str, Any],
    messages: List[Dict[str, Any]],
    user_answer: str | None = None,
) -> Dict[str, Any]:
    recent_messages = _recent_assistant_messages(messages)
    weak_answer = _is_weak_answer(user_answer or "")
    has_user_messages = any(item.get("role") == "user" for item in messages)
    mentioned_project_index = _find_project_index_from_text(structured_resume, user_answer)

    if not messages or (not has_user_messages and state.get("interview_phase") == "introduction" and state.get("current_question", 1) <= 1):
        return _follow_up_intro(config, structured_resume, recent_messages)

    planned_stage = _next_stage(state)
    if planned_stage == "project_overview":
        state["active_project_index"] = _project_block_index(state)
        active_project = _pick_project(structured_resume, state)
        if active_project:
            state["active_project_name"] = active_project.get("name")
    elif mentioned_project_index is not None:
        state["active_project_index"] = mentioned_project_index
        state["active_project_name"] = (structured_resume.get("projects", []) or [])[mentioned_project_index].get("name")
    if weak_answer:
        if state.get("current_section") == "projects":
            planned_stage = "project_followup"
        elif state.get("current_section") == "experience":
            planned_stage = "experience_followup"
        elif state.get("current_section") == "skills":
            planned_stage = "skill_deep_dive"
        elif state.get("current_section") == "fundamentals":
            planned_stage = "fundamentals"

    stage_generators = {
        "introduction": _follow_up_intro,
        "project_overview": _project_overview_question,
        "project_technical": _project_technical_question,
        "project_followup": _project_followup_question,
        "experience_challenge": lambda *args: _experience_question(*args, followup=False),
        "experience_followup": lambda *args: _experience_question(*args, followup=True),
        "skill_deep_dive": lambda *args: _skill_question(*args, quick_fire=False),
        "skills_quick_fire": lambda *args: _skill_question(*args, quick_fire=True),
        "fundamentals": _fundamentals_question,
        "closeout": _closeout_question,
    }

    if planned_stage == "introduction":
        return _follow_up_intro(config, structured_resume, recent_messages)
    return stage_generators[planned_stage](config, structured_resume, state, weak_answer, recent_messages, user_answer)


def _fallback_report(config: Dict[str, Any], state: Dict[str, Any], messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    user_messages = [item for item in messages if item["role"] == "user"]
    assistant_messages = [item for item in messages if item["role"] == "assistant"]
    paired_turns = list(zip(assistant_messages[-len(user_messages):], user_messages))
    coverage = state.get("covered_sections", {})

    section_feedback: Dict[str, Dict[str, Any]] = {}
    all_strengths: List[str] = []
    all_weaknesses: List[str] = []
    all_improvements: List[str] = []
    communication_samples: List[Dict[str, Any]] = []

    for question_item, answer_item in paired_turns:
        section = _section_from_question(question_item["content"])
        if section == "general":
            continue
        signals = _answer_signals(answer_item["content"])
        feedback = _section_feedback(section, answer_item["content"], signals)
        bucket = section_feedback.setdefault(
            section,
            {"scores": [], "strengths": [], "weaknesses": [], "improvements": [], "signals": []},
        )
        bucket["scores"].append(feedback["score"])
        bucket["strengths"].extend(feedback["strengths"])
        bucket["weaknesses"].extend(feedback["weaknesses"])
        bucket["improvements"].extend(feedback["improvements"])
        bucket["signals"].append(signals)
        communication_samples.append(signals)

    for section, data in section_feedback.items():
        all_strengths.extend(data["strengths"])
        all_weaknesses.extend(data["weaknesses"])
        all_improvements.extend(data["improvements"])

    avg_section_scores = {
        section: _score_band(sum(data["scores"]) / max(len(data["scores"]), 1))
        for section, data in section_feedback.items()
    }

    technical_inputs = [avg_section_scores.get(section) for section in ("projects", "skills", "fundamentals") if avg_section_scores.get(section) is not None]
    technical = _score_band(sum(technical_inputs) / max(len(technical_inputs), 1)) if technical_inputs else 4.5

    avg_words = sum(item["word_count"] for item in communication_samples) / max(len(communication_samples), 1)
    avg_sentences = sum(item["sentence_count"] for item in communication_samples) / max(len(communication_samples), 1)
    avg_weak_hits = sum(item["weak_hits"] for item in communication_samples) / max(len(communication_samples), 1)
    avg_tradeoffs = sum(item["tradeoff_hits"] for item in communication_samples) / max(len(communication_samples), 1)
    avg_outcomes = sum(item["outcome_hits"] + (1 if item["has_numbers"] else 0) for item in communication_samples) / max(len(communication_samples), 1)

    communication = _score_band(4.2 + min(avg_words / 35, 2.4) + min(avg_sentences / 2.5, 1.1) - min(avg_weak_hits * 0.5, 1.3))
    confidence = _score_band(communication - 0.2 + min(avg_outcomes * 0.25, 0.8))
    problem_solving = _score_band(4.0 + min(avg_tradeoffs * 0.9, 2.0) + min(avg_outcomes * 0.6, 1.6) + (0.4 if avg_section_scores.get("projects") else 0))

    covered_count = sum(1 for value in coverage.values() if value > 0)
    if covered_count < 3:
        all_weaknesses.append("The interview did not cover enough areas in depth to create a very strong signal.")
        all_improvements.append("Complete a longer interview and stay detailed across projects, experience, and fundamentals for a more reliable result.")

    overall = (technical + communication + confidence + problem_solving) / 4
    verdict = "Hire" if overall >= 7.8 else "Borderline" if overall >= 6.3 else "Needs Improvement"

    if avg_outcomes >= 1 and avg_tradeoffs >= 1:
        all_strengths.append("Several answers linked decisions to outcomes, which made the performance feel more credible.")
    if avg_words < 35:
        all_weaknesses.append("Many answers were too short, so the interview did not consistently show depth, ownership, or confidence.")
        all_improvements.append("Slow down and answer with more structure: situation, action, technical decision, and result.")
    if avg_tradeoffs < 0.6:
        all_weaknesses.append("Technical answers rarely explained tradeoffs, alternatives, or why a solution was chosen.")
        all_improvements.append("When discussing projects, always explain why you chose that design and what you would do differently now.")

    strengths = _dedupe_keep_order(all_strengths)[:4] or ["Stayed engaged and attempted to answer across the interview."]
    weaknesses = _dedupe_keep_order(all_weaknesses)[:4] or ["The interview showed partial knowledge, but not enough consistent evidence for a stronger recommendation."]
    improvements = _dedupe_keep_order(all_improvements)[:4] or ["Practice answering with clearer ownership, deeper implementation detail, and stronger outcomes."]

    section_scores = {
        "skills": avg_section_scores.get("skills"),
        "projects": avg_section_scores.get("projects"),
        "experience": avg_section_scores.get("experience"),
        "fundamentals": avg_section_scores.get("fundamentals"),
    }

    summary_parts = []
    if verdict == "Hire":
        summary_parts.append("The student showed a solid interview signal overall, especially where answers were specific and evidence-backed.")
    elif verdict == "Borderline":
        summary_parts.append("The student showed some real ability, but the interview signal stayed mixed because depth and consistency varied across answers.")
    else:
        summary_parts.append("The report suggests the student is still developing interview readiness and needs more precise, better-supported answers.")
    if section_scores.get("projects"):
        summary_parts.append(f"Project discussion was strongest around {section_scores['projects']}/10-level signal, while weaker areas need more ownership, tradeoffs, and measurable outcomes.")
    summary_parts.append("This report focuses on coaching value rather than praise, so weaknesses and improvement steps are intentionally direct.")

    return {
        "status": "completed",
        "scores": {
            "technical": technical,
            "communication": communication,
            "confidence": confidence,
            "problem_solving": problem_solving,
        },
        "strengths": strengths,
        "weaknesses": weaknesses,
        "improvements": improvements,
        "section_scores": section_scores,
        "verdict": verdict,
        "summary": " ".join(summary_parts),
    }


async def structure_resume(resume_text: str) -> Dict[str, Any]:
    clean_resume = sanitize_text(resume_text)
    fallback = {"skills": [], "projects": [], "experience": [], "education": [], "tools": []}
    if not clean_resume:
        return fallback

    prompt = dedent(
        f"""
        Parse this resume into JSON with keys: skills, projects, experience, education, tools.
        Keep values factual and avoid hallucinations.
        Resume:
        {clean_resume[:6000]}
        """
    ).strip()
    return await _chat_json(
        system_prompt="You extract structured resume data and respond with valid JSON only.",
        user_prompt=prompt,
        fallback=fallback,
    )


async def generate_question(
    config: Dict[str, Any],
    structured_resume: Dict[str, Any],
    question_plan: Dict[str, Any],
    state: Dict[str, Any],
    messages: List[Dict[str, Any]],
    user_answer: str | None = None,
) -> Dict[str, Any]:
    fallback_question = _local_generate_question(
        config=config,
        structured_resume=structured_resume,
        state=state,
        messages=messages,
        user_answer=user_answer,
    )
    history = "\n".join(f"{item['role']}: {item['content']}" for item in messages[-10:])
    prompt = dedent(
        f"""
        You are Kevin AI, a realistic human interviewer for interview practice.
        Return JSON with keys: message, section.
        The tone should feel human, direct, and resume-aware.
        Avoid repeating the same wording from earlier questions.
        Difficulty mapping:
        - fresher: easier and more guided
        - mid: practical and probing
        - senior: deep tradeoffs, scale, failure cases

        Requirements:
        - Start from the candidate's resume
        - Ask about project, internship/experience, skills, and fundamentals over time
        - For project questions, explicitly mention the project name from the resume whenever possible
        - For technical follow-ups, use the technologies listed on the resume if available
        - Sound like a real interviewer in conversation, using short transitions like "Mm-hmm", "Right", "Okay", "Got it"
        - In a 10-minute interview, prioritize intro, strongest project, project technical follow-up, internship challenge, one skill/fundamentals check, then close
        - In medium interviews, spend more time on the project and one or two skill-based follow-ups
        - In hard 30-minute interviews, go deeper across multiple projects, internship tradeoffs, and fundamentals
        - If the answer is weak, ask a more focused follow-up on the same topic
        - Ask only one question at a time

        Config: {_json_text(config)}
        Question plan: {_json_text(question_plan)}
        Current state: {_json_text(state)}
        Structured resume: {_json_text(structured_resume, 5000)}
        Recent history:
        {history}
        Latest user answer:
        {sanitize_text(user_answer or '')}
        """
    ).strip()
    return await _chat_json(
        system_prompt="You generate human-like interviewer responses as structured JSON.",
        user_prompt=prompt,
        fallback=fallback_question,
    )


async def generate_final_report(config: Dict[str, Any], state: Dict[str, Any], messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    fallback = _fallback_report(config, state, messages)
    history = "\n".join(f"{item['role']}: {item['content']}" for item in messages[-20:])
    prompt = dedent(
        f"""
        Evaluate this interview honestly and return JSON only with keys:
        status, scores, strengths, weaknesses, improvements, section_scores, verdict, summary.
        Scoring rules:
        - Be conservative. Do not exaggerate or flatter weak answers.
        - Judge only from the actual conversation, not from what the resume might imply.
        - Reward specific technical details, ownership, tradeoffs, debugging, outcomes, and clarity.
        - Penalize vague answers, generic theory, missing examples, unsupported confidence, and unclear ownership.
        - `strengths` must mention what the student actually did well in this interview.
        - `weaknesses` must mention what the student failed to show or explain in this interview.
        - `improvements` must be coaching-oriented and actionable for the next interview.
        - `communication` should reflect clarity, structure, and conciseness.
        - `confidence` should reflect how assured and ownership-driven the answers sounded, not optimism.
        - `problem_solving` should reflect debugging, tradeoffs, root-cause thinking, and decision quality.
        - Use a 0-10 scale, but avoid giving very high scores unless the evidence is strong.
        - `verdict` must be one of: Hire, Borderline, Needs Improvement.
        - `summary` should be 2-3 sentences, direct and improvement-focused.
        Config: {_json_text(config)}
        State: {_json_text(state)}
        Conversation:
        {history[:10000]}
        """
    ).strip()
    return await _chat_json(
        system_prompt="You are a strict but fair interview evaluator. Respond with valid JSON only.",
        user_prompt=prompt,
        fallback=fallback,
    )
