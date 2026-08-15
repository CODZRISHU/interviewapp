import pytest
from services.billing_service import (
    _default_credit_fields,
    normalize_user_billing_document,
    _plan_status_for_user,
    check_topup_eligibility,
    build_entitlements,
    ensure_interview_access,
    verify_razorpay_payment,
)
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_default_credit_fields_schema():
    defaults = _default_credit_fields()
    assert defaults["planKey"] == "free_trial"
    assert defaults["billingStatus"] == "trial_available"
    assert defaults["totalCredits"] == 1
    assert defaults["creditsRemaining"] == 1
    assert "referralRewardsClaimed" in defaults
    assert "referralCount" in defaults


@pytest.mark.asyncio
async def test_normalize_user_billing_document_free_trial():
    raw_user = {
        "id": "user_norm_1",
        "planKey": "free_trial",
        "trialUsed": False,
        "creditsRemaining": 1,
    }
    normalized = normalize_user_billing_document(raw_user)
    assert normalized["planKey"] == "free_trial"
    assert normalized["creditsRemaining"] == 1
    assert normalized["creditBuckets"]["10m"]["remaining"] == 1


@pytest.mark.asyncio
async def test_check_topup_eligibility_scenarios():
    # Scenario D: Free trial candidate cannot buy topup before subscribing
    free_trial_user = {"planKey": "free_trial", "billingStatus": "trial_available"}
    elig_d = check_topup_eligibility(free_trial_user)
    assert elig_d["eligible"] is False
    assert elig_d["scenario"] == "D"

    # Scenario A: Active plan with remaining credits cannot buy topup
    active_user_with_credits = {
        "planKey": "basic_99",
        "billingStatus": "active",
        "mainCreditBuckets": {"10m": {"total": 2, "used": 0, "remaining": 2}, "15m": {"total": 0, "used": 0, "remaining": 0}, "30m": {"total": 0, "used": 0, "remaining": 0}},
    }
    elig_a = check_topup_eligibility(active_user_with_credits)
    assert elig_a["eligible"] is False
    assert elig_a["scenario"] == "A"

    # Scenario B: Active plan with 0 main credits is eligible for topup
    active_user_zero_credits = {
        "planKey": "basic_99",
        "billingStatus": "active",
        "mainCreditBuckets": {"10m": {"remaining": 0}, "15m": {"remaining": 0}, "30m": {"remaining": 0}},
        "topupCreditBuckets": {"10m": {"remaining": 0}, "15m": {"remaining": 0}, "30m": {"remaining": 0}},
    }
    elig_b = check_topup_eligibility(active_user_zero_credits)
    assert elig_b["eligible"] is True
    assert elig_b["scenario"] == "B"


@pytest.mark.asyncio
async def test_build_entitlements_structure():
    user = {
        "planKey": "basic_99",
        "billingStatus": "active",
        "creditsRemaining": 3,
        "mainCreditBuckets": {"10m": {"total": 3, "used": 0, "remaining": 3}},
    }
    ent = build_entitlements(user)
    assert ent["planKey"] == "basic_99"
    assert ent["canStartInterview"] is True
    assert ent["remainingCredits"] == 3
    assert ent["maxDurationMinutes"] == 15


@pytest.mark.asyncio
async def test_razorpay_verification_invalid_signature():
    with pytest.raises(HTTPException) as exc_info:
        await verify_razorpay_payment(
            user={"id": "u123", "name": "Razor User", "email": "test@razor.com"},
            order_id="order_123",
            payment_id="pay_123",
            signature="invalid_signature_hash",
            plan_key="basic_99",
        )
    assert exc_info.value.status_code == 400
