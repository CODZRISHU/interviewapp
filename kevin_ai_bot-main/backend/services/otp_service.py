import hashlib
import logging
import random
import smtplib
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Optional

from fastapi import HTTPException, status

from config import get_settings
from db import database
from utils.helpers import utc_now

logger = logging.getLogger("kevin_ai.otp")
settings = get_settings()


def _hash_otp(email: str, otp_code: str) -> str:
    raw = f"{email.lower()}:{otp_code}:{settings.jwt_secret_key}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _send_otp_email_smtp(recipient_email: str, otp_code: str) -> bool:
    smtp_host = getattr(settings, "smtp_host", None)
    smtp_port = getattr(settings, "smtp_port", 587)
    smtp_user = getattr(settings, "smtp_user", None)
    smtp_password = getattr(settings, "smtp_password", None)

    if not (smtp_host and smtp_user and smtp_password):
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your Kevin AI Verification Code: {otp_code}"
        msg["From"] = f"Kevin AI <{smtp_user}>"
        msg["To"] = recipient_email

        html_body = f"""
        <div style="font-family: 'Outfit', Helvetica, Arial, sans-serif; background-color: #050505; color: #FFFFFF; padding: 32px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="color: #E50914; margin-top: 0;">Kevin AI Email Verification</h2>
            <p style="color: #A3A3A3; font-size: 14px;">Use the 6-digit code below to verify your email address. This code is valid for 10 minutes.</p>
            <div style="background-color: #0A0A0A; border: 1px solid rgba(255,255,255,0.15); padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #FFFFFF; border-radius: 12px; margin: 24px 0;">
                {otp_code}
            </div>
            <p style="color: #737373; font-size: 12px;">If you did not request this verification code, please ignore this email.</p>
        </div>
        """
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, int(smtp_port), timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.warning(f"SMTP delivery failed for {recipient_email}: {exc}")
        return False


async def request_otp_for_email(email: str) -> Dict[str, Optional[str]]:
    email_clean = email.lower().strip()

    # Check if user already registered
    existing_user = await database.users.find_one({"email": email_clean})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please switch to Login and sign in.",
        )

    now = utc_now()

    # Rate limiting: max 3 requests in 15 minutes

    fifteen_mins_ago = now - timedelta(minutes=15)
    recent_count = await database.otp_verifications.count_documents({
        "email": email_clean,
        "createdAt": {"$gte": fifteen_mins_ago}
    })

    if recent_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests for this email. Please wait 15 minutes before requesting again."
        )

    otp_code = f"{random.randint(100000, 999999)}"
    otp_hash = _hash_otp(email_clean, otp_code)
    expires_at = now + timedelta(minutes=10)

    # Deactivate existing active OTPs for this email
    await database.otp_verifications.update_many(
        {"email": email_clean, "verified": False},
        {"$set": {"expired": True}}
    )

    doc = {
        "email": email_clean,
        "otpHash": otp_hash,
        "attempts": 0,
        "verified": False,
        "expired": False,
        "createdAt": now,
        "expiresAt": expires_at
    }
    await database.otp_verifications.insert_one(doc)

    smtp_sent = _send_otp_email_smtp(email_clean, otp_code)
    logger.info(f"OTP generated for {email_clean}: {otp_code} (SMTP Sent: {smtp_sent})")

    response_payload = {
        "message": f"Verification code sent to {email_clean}.",
        "email": email_clean,
    }

    # In dev/test environment or fallback when SMTP is not configured, provide dev_otp for local testing
    if settings.environment.lower() != "production" or not smtp_sent:
        response_payload["dev_otp"] = otp_code

    return response_payload


async def verify_otp_for_email(email: str, otp_code: str) -> bool:
    email_clean = email.lower().strip()
    now = utc_now()

    record = await database.otp_verifications.find_one(
        {"email": email_clean, "verified": False, "expired": False},
        sort=[("createdAt", -1)]
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found for this email. Please request a new code."
        )

    if record.get("expiresAt") and record["expiresAt"] < now:
        await database.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"expired": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    if record.get("attempts", 0) >= 5:
        await database.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"expired": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new code."
        )

    expected_hash = _hash_otp(email_clean, otp_code.strip())
    if record["otpHash"] != expected_hash:
        await database.otp_verifications.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check and try again."
        )

    # Mark OTP as verified
    await database.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"verified": True, "verifiedAt": now}})
    return True


async def is_email_verified_with_otp(email: str) -> bool:
    email_clean = email.lower().strip()
    fifteen_mins_ago = utc_now() - timedelta(minutes=15)

    record = await database.otp_verifications.find_one(
        {"email": email_clean, "verified": True, "verifiedAt": {"$gte": fifteen_mins_ago}},
        sort=[("verifiedAt", -1)]
    )
    return bool(record)
