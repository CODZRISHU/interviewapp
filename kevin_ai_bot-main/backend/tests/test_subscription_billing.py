import asyncio
from datetime import datetime, timezone, timedelta
from services.billing_service import (
    PURCHASE_ITEMS,
    build_entitlements,
    normalize_user_billing_document,
    reconcile_user_billing_state,
)
from services.auth_service import serialize_user


def test_purchase_items_pricing_and_buckets():
    free = PURCHASE_ITEMS["free_trial"]
    assert free.amount_inr == 0
    assert free.bucket_breakdown == {"10m": 1, "15m": 0, "30m": 0}

    basic = PURCHASE_ITEMS["basic_99"]
    assert basic.amount_inr == 99
    assert basic.bucket_breakdown == {"10m": 7, "15m": 3, "30m": 0}

    premium = PURCHASE_ITEMS["premium_199"]
    assert premium.amount_inr == 199
    assert premium.bucket_breakdown == {"10m": 5, "15m": 5, "30m": 1}


def test_normalize_user_billing_document():
    raw_user = {"id": "usr_123", "email": "test@example.com"}
    normalized = normalize_user_billing_document(raw_user)
    assert normalized["planKey"] == "free_trial"
    assert normalized["billingStatus"] == "trial_available"
    assert "creditBuckets" in normalized
    assert normalized["creditBuckets"]["10m"]["remaining"] == 1


def test_build_entitlements_free_user():
    user = {
        "id": "usr_456",
        "planKey": "free_trial",
        "billingStatus": "trial_available",
        "totalCredits": 1,
        "creditsUsed": 0,
        "creditsRemaining": 1,
        "creditBuckets": {
            "10m": {"total": 1, "used": 0, "remaining": 1},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        },
    }
    entitlements = build_entitlements(user)
    assert entitlements["canStartInterview"] is True
    assert entitlements["remainingCredits"] == 1
    assert entitlements["planKey"] == "free_trial"


def test_serialize_user_includes_credit_buckets():
    now = datetime.now(timezone.utc)
    user_doc = {
        "id": "usr_serialize_1",
        "name": "Test User",
        "email": "test@example.com",
        "createdAt": now,
        "creditBuckets": {
            "10m": {"total": 7, "used": 1, "remaining": 6},
            "15m": {"total": 3, "used": 1, "remaining": 2},
            "30m": {"total": 1, "used": 0, "remaining": 1},
        },
    }
    serialized = serialize_user(user_doc)
    assert serialized.creditBuckets["10m"]["remaining"] == 6
    assert serialized.creditBuckets["15m"]["remaining"] == 2
    assert serialized.creditBuckets["30m"]["remaining"] == 1


async def test_reconcile_expired_subscription():
    now = datetime.now(timezone.utc)
    expired_user = {
        "id": "usr_789",
        "planKey": "basic_99",
        "billingStatus": "active",
        "currentPeriodEnd": (now - timedelta(days=1)).isoformat(),
        "creditsRemaining": 5,
        "creditBuckets": {
            "10m": {"total": 7, "used": 2, "remaining": 5},
        },
    }
    reconciled = await reconcile_user_billing_state(expired_user)
    assert reconciled["billingStatus"] == "expired"


if __name__ == "__main__":
    test_purchase_items_pricing_and_buckets()
    test_normalize_user_billing_document()
    test_build_entitlements_free_user()
    test_serialize_user_includes_credit_buckets()
    asyncio.run(test_reconcile_expired_subscription())
    print("ALL BACKEND BILLING TESTS PASSED SUCCESSFULLY!")
