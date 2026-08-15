import pytest
import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import database
from services.auth_service import process_referral_reward, _new_user_document
from services.billing_service import ensure_interview_access, reconcile_user_billing_state, build_entitlements


@pytest.mark.asyncio
async def test_referral_credit_playback():
    print("\n==========================================")
    print("TESTING REFERRAL CREDIT INTERVIEW ACCESS PLAYBACK")
    print("==========================================\n")

    # Clean up test users
    await database.users.delete_many({"email": {"$regex": "@testrefaccess.com$"}})

    # 1. Create a Free Trial user who has already used their trial session
    user = _new_user_document("Exhausted Candidate", "exhausted@testrefaccess.com", "hash", "email")
    user["id"] = "user_exhausted_999"
    user["referralCode"] = "REF-PLAY999"
    user["trialUsed"] = True
    user["usageCount"] = 1
    user["billingStatus"] = "trial_used"
    user["creditsRemaining"] = 0
    user["creditsUsed"] = 1
    user["totalCredits"] = 1
    user["creditBuckets"] = {
        "10m": {"total": 1, "used": 1, "remaining": 0},
        "15m": {"total": 0, "used": 0, "remaining": 0},
        "30m": {"total": 0, "used": 0, "remaining": 0},
    }
    user["mainCreditBuckets"] = user["creditBuckets"]
    await database.users.insert_one(user)

    print("Step 1: Created candidate with used free trial (0 credits remaining).")

    # Verify initial entitlements show canStartInterview == False
    reconciled_init = await reconcile_user_billing_state(user)
    ent_init = build_entitlements(reconciled_init)
    assert ent_init["canStartInterview"] is False
    assert ent_init["remainingCredits"] == 0
    print("   Initial entitlements verified: canStartInterview == False, remainingCredits == 0")

    # 2. Simulate earning 1 referral reward (3 referrals completed)
    # Register 3 referred users to trigger process_referral_reward
    user["referralCount"] = 2
    await database.users.update_one({"id": user["id"]}, {"$set": {"referralCount": 2}})

    await database.users.delete_one({"id": "user_ref_333"})
    ref3_doc = _new_user_document("Ref 3", "ref3@testrefaccess.com", "hash", "email")
    ref3_doc["id"] = "user_ref_333"
    await database.users.insert_one(ref3_doc)

    await process_referral_reward(ref3_doc["id"], "REF-PLAY999")

    # Fetch updated user from DB
    updated_user = await database.users.find_one({"id": "user_exhausted_999"})
    print("Step 2: Candidate earned 1 Referral Reward (10-minute session credit).")
    print(f"   Updated user creditsRemaining: {updated_user['creditsRemaining']} | 10m Bucket: {updated_user['creditBuckets']['10m']}")

    assert updated_user["creditsRemaining"] == 1
    assert updated_user["creditBuckets"]["10m"]["remaining"] == 1

    # 3. Test reconcile_user_billing_state and build_entitlements
    reconciled = await reconcile_user_billing_state(updated_user)
    ent = build_entitlements(reconciled)

    print(f"   Reconciled entitlements: canStartInterview == {ent['canStartInterview']}, remainingCredits == {ent['remainingCredits']}")
    assert ent["canStartInterview"] is True
    assert ent["remainingCredits"] == 1

    # 4. Test ensure_interview_access for 10-minute session (SUCCESS)
    accessed_user, bucket_key = await ensure_interview_access(updated_user, 10)
    print(f"Step 3: ensure_interview_access SUCCESSFUL for 10m! Selected duration bucket: {bucket_key}")
    assert bucket_key == "10m"

    # 5. Verify 15-minute and 30-minute sessions are BLOCKED for referral credit users
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_15:
        await ensure_interview_access(updated_user, 15)
    assert exc_15.value.status_code == 403
    assert "10-minute sessions only" in exc_15.value.detail

    with pytest.raises(HTTPException) as exc_30:
        await ensure_interview_access(updated_user, 30)
    assert exc_30.value.status_code == 403
    assert "10-minute sessions only" in exc_30.value.detail
    print("Step 4: Verified 15-minute and 30-minute sessions are strictly BLOCKED for referral credit users!")

    # Clean up test data
    await database.users.delete_many({"email": {"$regex": "@testrefaccess.com$"}})
    await database.referral_rewards.delete_many({"referrerId": "user_exhausted_999"})

    print("\n==========================================")
    print("REFERRAL CREDIT INTERVIEW ACCESS TEST PASSED 100%!")
    print("==========================================\n")


if __name__ == "__main__":
    asyncio.run(test_referral_credit_playback())
