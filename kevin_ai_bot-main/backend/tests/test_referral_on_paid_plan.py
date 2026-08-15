import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from db import database
from services.auth_service import process_referral_reward, _new_user_document
from services.billing_service import normalize_user_billing_document, reconcile_user_billing_state, build_entitlements


@pytest.mark.asyncio
async def test_referral_reward_granted_to_paid_basic_plan_user():
    """
    Test Case 1: Candidate on active basic_99 plan (7 x 10m, 3 x 15m = 10 credits)
    earns 1 referral reward (3 referrals).
    EXPECTED:
    - billingStatus remains 'active'
    - 15m bucket remains 3/3 (NOT reset to 0)
    - 10m bucket becomes 8/8 (7 main + 1 referral)
    - totalCredits = 11, creditsRemaining = 11
    """
    await database.users.delete_many({"email": {"$regex": "@testpaidref.com$"}})

    now = datetime.now(timezone.utc)
    referrer = _new_user_document("Paid Referrer Basic", "basic_referrer@testpaidref.com", "hash", "email")
    referrer["id"] = "user_paid_ref_101"
    referrer["referralCode"] = "REF-PAID101"
    referrer["planKey"] = "basic_99"
    referrer["plan"] = "basic"
    referrer["billingStatus"] = "active"
    referrer["currentPeriodStart"] = now.isoformat()
    referrer["currentPeriodEnd"] = (now + timedelta(days=30)).isoformat()
    referrer["mainCreditBuckets"] = {
        "10m": {"total": 7, "used": 0, "remaining": 7},
        "15m": {"total": 3, "used": 0, "remaining": 3},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    referrer["topupCreditBuckets"] = {
        "10m": {"total": 0, "used": 0, "remaining": 0},
        "15m": {"total": 0, "used": 0, "remaining": 0},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    referrer["usageCount"] = 0
    referrer["referralCount"] = 2
    referrer["referralRewardsClaimed"] = 0
    await database.users.insert_one(referrer)

    # Register 3rd referral to trigger process_referral_reward
    ref3_doc = _new_user_document("Ref 3", "ref3@testpaidref.com", "hash", "email")
    ref3_doc["id"] = "user_ref_paid_333"
    await database.users.insert_one(ref3_doc)

    await process_referral_reward(ref3_doc["id"], "REF-PAID101")

    # Fetch updated user from DB
    updated_user = await database.users.find_one({"id": "user_paid_ref_101"})
    norm = normalize_user_billing_document(updated_user)

    assert norm["planKey"] == "basic_99"
    assert norm["billingStatus"] == "active"
    assert norm["referralRewardsClaimed"] == 1
    assert norm["referralRewardsRemaining"] == 1

    # 15m bucket must NOT be wiped out to 0!
    assert norm["creditBuckets"]["15m"]["total"] == 3
    assert norm["creditBuckets"]["15m"]["remaining"] == 3

    # 10m bucket must be 7 main + 1 referral = 8 total & remaining!
    assert norm["creditBuckets"]["10m"]["total"] == 8
    assert norm["creditBuckets"]["10m"]["remaining"] == 8

    # Total credits remaining must be 8 + 3 = 11!
    assert norm["creditsRemaining"] == 11
    assert norm["totalCredits"] == 11

    # Clean up
    await database.users.delete_many({"email": {"$regex": "@testpaidref.com$"}})
    await database.referral_rewards.delete_many({"referrerId": "user_paid_ref_101"})


@pytest.mark.asyncio
async def test_referral_reward_granted_to_paid_plan_user_with_partial_usage():
    """
    Test Case 2: Candidate on active basic_99 plan who used 2 10m credits (5 main 10m left, 3 15m left)
    earns 1 referral reward.
    EXPECTED:
    - 15m bucket remains 3/3
    - 10m bucket becomes 8 total, 2 used, 6 remaining (5 main + 1 referral)
    - total credits remaining = 6 + 3 = 9
    """
    await database.users.delete_many({"email": {"$regex": "@testpaidref2.com$"}})

    now = datetime.now(timezone.utc)
    referrer = _new_user_document("Paid Referrer Used", "used_referrer@testpaidref2.com", "hash", "email")
    referrer["id"] = "user_paid_ref_102"
    referrer["referralCode"] = "REF-PAID102"
    referrer["planKey"] = "basic_99"
    referrer["plan"] = "basic"
    referrer["billingStatus"] = "active"
    referrer["currentPeriodStart"] = now.isoformat()
    referrer["currentPeriodEnd"] = (now + timedelta(days=30)).isoformat()
    referrer["mainCreditBuckets"] = {
        "10m": {"total": 7, "used": 2, "remaining": 5},
        "15m": {"total": 3, "used": 0, "remaining": 3},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    referrer["topupCreditBuckets"] = {
        "10m": {"total": 0, "used": 0, "remaining": 0},
        "15m": {"total": 0, "used": 0, "remaining": 0},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    referrer["usageCount"] = 2
    referrer["referralCount"] = 2
    referrer["referralRewardsClaimed"] = 0
    await database.users.insert_one(referrer)

    ref_doc = _new_user_document("Ref 3", "ref3@testpaidref2.com", "hash", "email")
    ref_doc["id"] = "user_ref_paid_444"
    await database.users.insert_one(ref_doc)

    await process_referral_reward(ref_doc["id"], "REF-PAID102")

    updated_user = await database.users.find_one({"id": "user_paid_ref_102"})
    norm = normalize_user_billing_document(updated_user)

    assert norm["billingStatus"] == "active"
    assert norm["referralRewardsClaimed"] == 1
    assert norm["creditBuckets"]["15m"]["remaining"] == 3
    assert norm["creditBuckets"]["10m"]["remaining"] == 6
    assert norm["creditsRemaining"] == 9

    await database.users.delete_many({"email": {"$regex": "@testpaidref2.com$"}})
    await database.referral_rewards.delete_many({"referrerId": "user_paid_ref_102"})
