import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import database
from services.auth_service import process_referral_reward, _new_user_document, verify_email_token


async def run_referral_tests():
    print("\n==========================================")
    print("RUNNING REFERRAL SYSTEM UNIT TESTS (EMAIL VERIFIED ONLY)")
    print("==========================================\n")

    # Clean up test users
    await database.users.delete_many({"email": {"$regex": "@testreferral.com$"}})
    await database.referral_rewards.delete_many({"referrerId": "user_referrer_100"})

    # 1. Create Referrer User A
    referrer_doc = _new_user_document("Referrer User", "referrer@testreferral.com", "hash", "email")
    referrer_doc["id"] = "user_referrer_100"
    referrer_doc["referralCode"] = "REF-VERIF100"
    referrer_doc["creditsRemaining"] = 0
    referrer_doc["trialUsed"] = True
    referrer_doc["creditBuckets"]["10m"]["remaining"] = 0
    await database.users.insert_one(referrer_doc)

    print(f"Created Referrer User A (Code: {referrer_doc['referralCode']}, Credits: 0)")

    # 2. Ref 1 registers via Email Auth (unverified)
    ref1_doc = _new_user_document("Ref One", "ref1@testreferral.com", "hash", "email")
    ref1_doc["id"] = "user_ref_101"
    ref1_doc["verificationToken"] = "vtok_ref1_test"
    ref1_doc["pendingReferralCode"] = "REF-VERIF100"
    await database.users.insert_one(ref1_doc)

    # Check referrer BEFORE email verification
    updated_referrer_before = await database.users.find_one({"id": "user_referrer_100"})
    assert updated_referrer_before["referralCount"] == 0
    print("SUCCESS: Ref 1 registered but NOT verified. Referrer referralCount is still 0 (Anti-abuse verified!)")

    # 3. Ref 1 verifies email!
    await verify_email_token("vtok_ref1_test")
    updated_referrer_after1 = await database.users.find_one({"id": "user_referrer_100"})
    assert updated_referrer_after1["referralCount"] == 1
    assert updated_referrer_after1["referralRewardsClaimed"] == 0
    print("SUCCESS: Ref 1 verified Gmail address! Referrer referralCount updated to 1.")

    # 4. Ref 2 and Ref 3 register & verify
    ref2_doc = _new_user_document("Ref Two", "ref2@testreferral.com", "hash", "email")
    ref2_doc["id"] = "user_ref_102"
    ref2_doc["verificationToken"] = "vtok_ref2_test"
    ref2_doc["pendingReferralCode"] = "REF-VERIF100"
    await database.users.insert_one(ref2_doc)
    await verify_email_token("vtok_ref2_test")

    ref3_doc = _new_user_document("Ref Three", "ref3@testreferral.com", "hash", "email")
    ref3_doc["id"] = "user_ref_103"
    ref3_doc["verificationToken"] = "vtok_ref3_test"
    ref3_doc["pendingReferralCode"] = "REF-VERIF100"
    await database.users.insert_one(ref3_doc)
    await verify_email_token("vtok_ref3_test")

    # Check final referrer rewards after 3 verified referrals
    final_referrer = await database.users.find_one({"id": "user_referrer_100"})
    assert final_referrer["referralCount"] == 3
    assert final_referrer["referralRewardsClaimed"] == 1
    assert final_referrer["creditsRemaining"] == 1
    assert final_referrer["creditBuckets"]["10m"]["remaining"] == 1

    print("SUCCESS: 3 Verified Referrals recorded! +1 Free 10-Minute Interview reward granted to Referrer User A!")
    print(f"   Referrer Credits Remaining: {final_referrer['creditsRemaining']} | 10m Bucket: {final_referrer['creditBuckets']['10m']['remaining']}")

    # Clean up test data
    await database.users.delete_many({"email": {"$regex": "@testreferral.com$"}})
    await database.referral_rewards.delete_many({"referrerId": "user_referrer_100"})

    print("\n==========================================")
    print("ALL REFERRAL EMAIL VERIFICATION TESTS PASSED PERFECTLY!")
    print("==========================================\n")


if __name__ == "__main__":
    asyncio.run(run_referral_tests())
