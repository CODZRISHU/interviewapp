import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from db import database
from services.auth_service import _new_user_document
from services.billing_service import normalize_user_billing_document, build_entitlements, consume_credit_for_interview
from services.interview_service import start_interview_for_user, finish_interview


@pytest.mark.asyncio
async def test_paid_plan_credit_deduction_after_interview():
    """
    Test Case: Candidate on basic_99 (7 x 10m, 3 x 15m) starts and completes interviews.
    EXPECTED:
    - After 10m interview completion, 10m remaining decreases from 7 to 6 (total remaining decreases from 10 to 9).
    - After 15m interview completion, 15m remaining decreases from 3 to 2 (total remaining decreases from 9 to 8).
    """
    await database.users.delete_many({"email": "paid_deduct@testdeduct.com"})
    await database.interviews.delete_many({"userEmail": "paid_deduct@testdeduct.com"})

    now = datetime.now(timezone.utc)
    user = _new_user_document("Deduct Candidate", "paid_deduct@testdeduct.com", "hash", "email")
    user["id"] = "user_deduct_101"
    user["planKey"] = "basic_99"
    user["plan"] = "basic"
    user["billingStatus"] = "active"
    user["currentPeriodStart"] = now.isoformat()
    user["currentPeriodEnd"] = (now + timedelta(days=30)).isoformat()
    user["mainCreditBuckets"] = {
        "10m": {"total": 7, "used": 0, "remaining": 7},
        "15m": {"total": 3, "used": 0, "remaining": 3},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    user["topupCreditBuckets"] = {
        "10m": {"total": 0, "used": 0, "remaining": 0},
        "15m": {"total": 0, "used": 0, "remaining": 0},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    user["usageCount"] = 0
    user["resumeText"] = "Sample resume skills: Python, React, Systems"
    await database.users.insert_one(user)

    # 1. Start & Complete 10-minute interview
    config_10 = {"interview_type": "mixed", "level": "mid", "role": "Software Engineer", "duration": 10}
    int_10 = await start_interview_for_user(user, config_10)
    int_id_10 = int_10["interview_id"]

    # Finish interview after 3 minutes (180 seconds)
    await finish_interview(user, int_id_10)

    # Fetch updated user from DB
    updated_user_1 = await database.users.find_one({"id": "user_deduct_101"})
    norm_1 = normalize_user_billing_document(updated_user_1)

    print(f"After 10m interview: 10m rem = {norm_1['creditBuckets']['10m']['remaining']}, total rem = {norm_1['creditsRemaining']}")

    # 10m bucket MUST decrease from 7 to 6!
    assert norm_1["mainCreditBuckets"]["10m"]["remaining"] == 6
    assert norm_1["creditBuckets"]["10m"]["remaining"] == 6
    assert norm_1["creditsRemaining"] == 9

    # 2. Start & Complete 15-minute interview
    config_15 = {"interview_type": "technical", "level": "mid", "role": "Backend Engineer", "duration": 15}
    int_15 = await start_interview_for_user(updated_user_1, config_15)
    int_id_15 = int_15["interview_id"]

    await finish_interview(updated_user_1, int_id_15)

    updated_user_2 = await database.users.find_one({"id": "user_deduct_101"})
    norm_2 = normalize_user_billing_document(updated_user_2)

    print(f"After 15m interview: 15m rem = {norm_2['creditBuckets']['15m']['remaining']}, total rem = {norm_2['creditsRemaining']}")

    # 15m bucket MUST decrease from 3 to 2!
    assert norm_2["mainCreditBuckets"]["15m"]["remaining"] == 2
    assert norm_2["creditBuckets"]["15m"]["remaining"] == 2
    assert norm_2["creditsRemaining"] == 8

    # Cleanup
    await database.users.delete_many({"email": "paid_deduct@testdeduct.com"})
    await database.interviews.delete_many({"userId": "user_deduct_101"})
