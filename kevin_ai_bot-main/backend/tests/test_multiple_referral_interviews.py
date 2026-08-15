import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import database
from services.auth_service import process_referral_reward, _new_user_document
from services.billing_service import ensure_interview_access, consume_credit_for_interview, reconcile_user_billing_state, build_entitlements
from services.interview_service import start_interview_for_user, finish_interview


async def test_multiple_referral_interviews():
    print("\n==========================================")
    print("TESTING MULTIPLE REFERRAL CREDIT INTERVIEW PLAYBACK (6 REFERRALS = 2 CREDITS)")
    print("==========================================\n")

    # Clean up test users
    await database.users.delete_many({"email": {"$regex": "@testmultiref.com$"}})
    await database.interviews.delete_many({"userId": "user_multiref_666"})

    # 1. Create a candidate with exhausted initial trial
    user = _new_user_document("Multi Ref Candidate", "candidate@testmultiref.com", "hash", "email")
    user["id"] = "user_multiref_666"
    user["referralCode"] = "REF-MULTI666"
    user["trialUsed"] = True
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
    user["resumeText"] = "Sample software engineer resume skills: Python, React, MongoDB"
    await database.users.insert_one(user)

    print("Step 1: Created candidate with exhausted initial free trial.")

    # 2. Grant 6 verified referrals (2 free 10-minute interview credits)
    for i in range(1, 7):
        user["referralCount"] = i - 1
        await database.users.update_one({"id": user["id"]}, {"$set": {"referralCount": i - 1}})
        
        ref_doc = _new_user_document(f"Ref {i}", f"ref{i}@testmultiref.com", "hash", "email")
        ref_doc["id"] = f"user_ref_{i}{i}{i}"
        await database.users.insert_one(ref_doc)
        await process_referral_reward(ref_doc["id"], "REF-MULTI666")

    # Fetch updated user from DB
    u1 = await database.users.find_one({"id": "user_multiref_666"})
    print(f"Step 2: Candidate recorded 6 verified referrals.")
    print(f"   Credits Remaining: {u1['creditsRemaining']} | Claimed: {u1['referralRewardsClaimed']} | 10m Bucket: {u1['creditBuckets']['10m']}")

    assert u1["referralRewardsClaimed"] == 2
    assert u1["creditsRemaining"] == 2
    assert u1["creditBuckets"]["10m"]["remaining"] == 2

    # 3. Start & Complete Interview 1 (Consumes 1st credit)
    config = {"interview_type": "mixed", "level": "fresher", "role": "Software Engineer", "duration": 10}
    int1 = await start_interview_for_user(u1, config)
    print(f"\nStep 3: Started Interview 1 (ID: {int1['interview_id']}).")

    u1_after_start1 = await database.users.find_one({"id": "user_multiref_666"})
    print(f"   After starting Interview 1 -> Credits Remaining: {u1_after_start1['creditsRemaining']}")
    assert u1_after_start1["creditsRemaining"] == 1

    # End Interview 1
    await finish_interview(u1_after_start1, int1["interview_id"])
    u1_after_end1 = await database.users.find_one({"id": "user_multiref_666"})
    print(f"   After completing Interview 1 -> Credits Remaining: {u1_after_end1['creditsRemaining']}")
    assert u1_after_end1["creditsRemaining"] == 1

    # Verify Entitlements after Interview 1
    reconciled1 = await reconcile_user_billing_state(u1_after_end1)
    ent1 = build_entitlements(reconciled1)
    assert ent1["canStartInterview"] is True
    assert ent1["remainingCredits"] == 1
    print("   Entitlements verified: canStartInterview == True, remainingCredits == 1")

    # 4. Start & Complete Interview 2 (Consumes 2nd credit)
    int2 = await start_interview_for_user(u1_after_end1, config)
    print(f"\nStep 4: Started Interview 2 (ID: {int2['interview_id']}).")

    u2_after_start2 = await database.users.find_one({"id": "user_multiref_666"})
    print(f"   After starting Interview 2 -> Credits Remaining: {u2_after_start2['creditsRemaining']}")
    assert u2_after_start2["creditsRemaining"] == 0

    # End Interview 2
    await finish_interview(u2_after_start2, int2["interview_id"])
    u2_after_end2 = await database.users.find_one({"id": "user_multiref_666"})
    print(f"   After completing Interview 2 -> Credits Remaining: {u2_after_end2['creditsRemaining']}")
    assert u2_after_end2["creditsRemaining"] == 0

    # 5. Verify 3rd Interview Attempt is blocked
    reconciled2 = await reconcile_user_billing_state(u2_after_end2)
    ent2 = build_entitlements(reconciled2)
    assert ent2["canStartInterview"] is False
    assert ent2["remainingCredits"] == 0
    print("\nStep 5: Verified 3rd interview attempt is blocked (0 credits remaining).")

    # Clean up test data
    await database.users.delete_many({"email": {"$regex": "@testmultiref.com$"}})
    await database.referral_rewards.delete_many({"referrerId": "user_multiref_666"})
    await database.interviews.delete_many({"userId": "user_multiref_666"})

    print("\n==========================================")
    print("MULTIPLE REFERRAL CREDIT INTERVIEW TEST PASSED 100%!")
    print("==========================================\n")


if __name__ == "__main__":
    asyncio.run(test_multiple_referral_interviews())
