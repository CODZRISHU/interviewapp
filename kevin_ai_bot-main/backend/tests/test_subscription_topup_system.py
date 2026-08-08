import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from services.billing_service import (
    PURCHASE_ITEMS,
    check_topup_eligibility,
    normalize_user_billing_document,
    reconcile_user_billing_state,
    build_entitlements,
    create_razorpay_order,
    verify_razorpay_payment,
    ensure_interview_access,
    consume_credit_for_interview,
)


def test_topup_purchase_items():
    topup_x = PURCHASE_ITEMS["topup_x_59"]
    assert topup_x.amount_inr == 59
    assert topup_x.bucket_breakdown == {"10m": 3, "15m": 0, "30m": 0}
    assert topup_x.purchase_type == "addon"

    topup_y = PURCHASE_ITEMS["topup_y_99"]
    assert topup_y.amount_inr == 99
    assert topup_y.bucket_breakdown == {"10m": 6, "15m": 0, "30m": 0}
    assert topup_y.purchase_type == "addon"

    topup_z = PURCHASE_ITEMS["topup_z_149"]
    assert topup_z.amount_inr == 149
    assert topup_z.bucket_breakdown == {"10m": 6, "15m": 3, "30m": 0}
    assert topup_z.purchase_type == "addon"


def test_topup_eligibility_scenarios():
    now = datetime.now(timezone.utc)
    future = (now + timedelta(days=20)).isoformat()

    # Scenario D: Free user
    free_user = {"id": "u_free", "planKey": "free_trial", "billingStatus": "trial_available"}
    res_d = check_topup_eligibility(free_user)
    assert res_d["eligible"] is False
    assert res_d["scenario"] == "D"

    # Scenario C: Expired plan
    expired_user = {"id": "u_exp", "planKey": "basic_99", "billingStatus": "expired"}
    res_c = check_topup_eligibility(expired_user)
    assert res_c["eligible"] is False
    assert res_c["scenario"] == "C"

    # Scenario A: Active plan + main credits remaining
    active_with_credits = {
        "id": "u_act_cred",
        "planKey": "basic_99",
        "plan": "basic",
        "billingStatus": "active",
        "currentPeriodEnd": future,
        "mainCreditBuckets": {"10m": {"total": 7, "used": 4, "remaining": 3}},
    }
    res_a = check_topup_eligibility(active_with_credits)
    assert res_a["eligible"] is False
    assert res_a["scenario"] == "A"

    # Scenario B: Active plan + all main credits exhausted
    active_exhausted = {
        "id": "u_act_exh",
        "planKey": "basic_99",
        "plan": "basic",
        "billingStatus": "active",
        "currentPeriodEnd": future,
        "mainCreditBuckets": {
            "10m": {"total": 7, "used": 7, "remaining": 0},
            "15m": {"total": 3, "used": 3, "remaining": 0},
        },
        "topupCreditBuckets": {
            "10m": {"total": 0, "used": 0, "remaining": 0},
            "15m": {"total": 0, "used": 0, "remaining": 0},
        },
    }
    res_b = check_topup_eligibility(active_exhausted)
    assert res_b["eligible"] is True
    assert res_b["scenario"] == "B"
    assert res_b["validUntil"] == future


async def test_main_plan_single_active_restriction():
    now = datetime.now(timezone.utc)
    future = (now + timedelta(days=25)).isoformat()
    active_user = {
        "id": "u_active_sub",
        "name": "Rishu",
        "email": "rishu@example.com",
        "planKey": "basic_99",
        "billingStatus": "active",
        "currentPeriodEnd": future,
    }

    # Should raise error when attempting to purchase another main plan while active
    try:
        await create_razorpay_order("basic_99", active_user)
        assert False, "Should have raised HTTPException for main plan purchase while active"
    except HTTPException as e:
        assert "You cannot purchase another main plan until your current plan expires" in str(e.detail)

    try:
        await create_razorpay_order("premium_199", active_user)
        assert False, "Should have raised HTTPException for premium plan purchase while active"
    except HTTPException as e:
        assert "You cannot purchase another main plan until your current plan expires" in str(e.detail)


async def test_reconcile_expired_main_plan_clears_topups():
    now = datetime.now(timezone.utc)
    past = (now - timedelta(days=1)).isoformat()
    expired_user = {
        "id": "u_exp_topup",
        "planKey": "basic_99",
        "billingStatus": "active",
        "currentPeriodEnd": past,
        "mainCreditBuckets": {"10m": {"total": 7, "used": 7, "remaining": 0}},
        "topupCreditBuckets": {"10m": {"total": 6, "used": 2, "remaining": 4}},
    }

    reconciled = await reconcile_user_billing_state(expired_user)
    assert reconciled["billingStatus"] == "expired"
    assert reconciled["mainCreditBuckets"]["10m"]["remaining"] == 0
    assert reconciled["topupCreditBuckets"]["10m"]["remaining"] == 0
    assert reconciled["creditsRemaining"] == 0


if __name__ == "__main__":
    test_topup_purchase_items()
    test_topup_eligibility_scenarios()
    asyncio.run(test_main_plan_single_active_restriction())
    asyncio.run(test_reconcile_expired_main_plan_clears_topups())
    print("ALL TOP-UP & MAIN SUBSCRIPTION SYSTEM TESTS PASSED!")
