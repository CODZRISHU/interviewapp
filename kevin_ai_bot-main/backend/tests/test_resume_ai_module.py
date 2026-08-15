import pytest
from utils.helpers import sanitize_text, generate_question_plan
from services.ai_service import generate_question, generate_final_report


@pytest.mark.asyncio
async def test_sanitize_text_utility():
    dirty = "   Hello \n\n  World \t  "
    clean = sanitize_text(dirty)
    assert "Hello" in clean and "World" in clean
    assert sanitize_text(None) == ""


@pytest.mark.asyncio
async def test_generate_question_plan_structure():
    config = {"interview_type": "technical", "level": "senior", "duration": 15}
    structured_resume = {
        "skills": ["Python", "System Design", "Docker"],
        "projects": ["Distributed Queue System"],
        "experience": ["Senior Backend Lead at TechCorp"],
    }
    plan = generate_question_plan(config, structured_resume)
    assert "total_questions" in plan
    assert plan["total_questions"] >= 5
    assert "sequence" in plan
    assert "distribution" in plan


@pytest.mark.asyncio
async def test_ai_question_generation_fallback():
    config = {"interview_type": "behavioural", "level": "fresher", "role": "Frontend Engineer", "duration": 10}
    structured_resume = {"skills": ["React", "JavaScript"], "projects": [], "experience": []}
    plan = generate_question_plan(config, structured_resume)
    state = {
        "current_question": 1,
        "total_questions": plan["total_questions"],
        "covered_sections": {},
        "config": config,
    }

    # Calling generate_question with mock messages
    q_res = await generate_question(
        config=config,
        structured_resume=structured_resume,
        question_plan=plan,
        state=state,
        messages=[],
        user_answer="Candidate ready.",
    )
    assert "message" in q_res
    assert isinstance(q_res["message"], str)
    assert len(q_res["message"]) > 10


@pytest.mark.asyncio
async def test_ai_report_generation():
    config = {"interview_type": "mixed", "level": "mid", "role": "Software Engineer", "duration": 10}
    state = {"total_questions": 5, "current_question": 5}
    messages = [
        {"role": "user", "content": "I built microservices using Python FastAPI and MongoDB with index optimization."},
        {"role": "user", "content": "I resolved team conflicts by conducting peer code reviews and architectural alignment meetings."},
    ]

    report = await generate_final_report(config, state, messages)
    assert "scores" in report
    assert "technical" in report["scores"]
    assert "communication" in report["scores"]
    assert isinstance(report["strengths"], list)
    assert isinstance(report["improvements"], list)
