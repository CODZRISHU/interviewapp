import pytest
import asyncio
from utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    safe_decode_access_token,
)
from services.auth_service import (
    _new_user_document,
    serialize_user,
    register_user,
    verify_email_token,
)
from db import database


@pytest.mark.asyncio
async def test_password_hashing_and_verification():
    raw_pass = "SecureP@ss123"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPass", hashed) is False


@pytest.mark.asyncio
async def test_jwt_token_creation_and_verification():
    user_id = "user_jwt_test_123"
    email = "jwt@testauth.com"
    token, expire = create_access_token(user_id, email)
    assert isinstance(token, str)
    assert len(token) > 20

    payload = safe_decode_access_token(token)
    assert payload["sub"] == user_id
    assert payload["email"] == email


@pytest.mark.asyncio
async def test_user_document_creation_and_serialization():
    doc = _new_user_document("Test Auth User", "authtest@testauth.com", "hashed_pwd_123", "email")
    assert doc["email"] == "authtest@testauth.com"
    assert doc["name"] == "Test Auth User"
    assert doc["referralCode"].startswith("REF-")
    assert doc["isEmailVerified"] is False

    serialized = serialize_user(doc)
    assert serialized.email == "authtest@testauth.com"
    assert serialized.name == "Test Auth User"
    assert serialized.planKey == "free_trial"


from models.schemas import RegisterRequest

@pytest.mark.asyncio
async def test_registration_and_email_verification_flow():
    # Cleanup any old test records
    await database.users.delete_many({"email": "regflow@gmail.com"})

    # 1. Register new candidate (unverified email sends activation link and returns user=None)
    payload = RegisterRequest(name="Reg Flow Candidate", email="regflow@gmail.com", password="Password@123")
    auth_resp = await register_user(payload)
    assert auth_resp.user is None
    assert auth_resp.tokens is None

    unverified_user = await database.users.find_one({"email": "regflow@gmail.com"})
    assert unverified_user["isEmailVerified"] is False
    assert unverified_user["verificationToken"] is not None

    # 2. Verify email token
    verif_res = await verify_email_token(unverified_user["verificationToken"])
    assert verif_res.tokens is not None
    assert verif_res.user.email == "regflow@gmail.com"
    assert "verified" in verif_res.message.lower()

    verified_user = await database.users.find_one({"email": "regflow@gmail.com"})
    assert verified_user["isEmailVerified"] is True

    # Cleanup
    await database.users.delete_many({"email": "regflow@gmail.com"})
