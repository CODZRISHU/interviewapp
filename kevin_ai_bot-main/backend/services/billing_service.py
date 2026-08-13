import base64
import csv
import hashlib
import hmac
import io
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

from config import get_settings
from db import database
from services.invoice_service import generate_pdf_invoice
from utils.helpers import utc_now


settings = get_settings()

PlanType = Literal["trial", "one_time", "subscription"]
PurchaseType = Literal["plan", "addon"]


@dataclass(frozen=True)
class PurchaseItem:
    key: str
    purchase_type: PurchaseType
    billing_model: PlanType
    display_name: str
    amount_inr: int
    credits: int
    max_duration_minutes: int
    plan_group: str
    bucket_breakdown: Dict[str, int]
    tag: str = ""
    highlighted: bool = False
    is_limited: bool = False
    trial_only: bool = False
    valid_for_days: Optional[int] = None
    strike_through_amount_inr: Optional[int] = None
    scarcity_text: Optional[str] = None
    urgency_text: Optional[str] = None
    savings_text: Optional[str] = None
    fair_usage_policy: bool = True


PURCHASE_ITEMS: Dict[str, PurchaseItem] = {
    "free_trial": PurchaseItem(
        key="free_trial",
        purchase_type="plan",
        billing_model="trial",
        display_name="Free Plan",
        amount_inr=0,
        credits=1,
        max_duration_minutes=10,
        plan_group="free",
        bucket_breakdown={"10m": 1, "15m": 0, "30m": 0},
        trial_only=True,
        fair_usage_policy=True,
    ),
    "basic_99": PurchaseItem(
        key="basic_99",
        purchase_type="plan",
        billing_model="subscription",
        display_name="Basic Plan",
        amount_inr=99,
        credits=10,
        max_duration_minutes=15,
        plan_group="basic",
        bucket_breakdown={"10m": 7, "15m": 3, "30m": 0},
        valid_for_days=30,
        strike_through_amount_inr=199,
        savings_text="Save 50% monthly",
        fair_usage_policy=True,
    ),
    "premium_199": PurchaseItem(
        key="premium_199",
        purchase_type="plan",
        billing_model="subscription",
        display_name="Premium Plan",
        amount_inr=199,
        credits=11,
        max_duration_minutes=30,
        plan_group="premium",
        bucket_breakdown={"10m": 5, "15m": 5, "30m": 1},
        tag="Recommended",
        highlighted=True,
        valid_for_days=30,
        strike_through_amount_inr=399,
        savings_text="Best Value & Full Unlock",
        fair_usage_policy=True,
    ),
    # Top-Up Plans
    "topup_x_59": PurchaseItem(
        key="topup_x_59",
        purchase_type="addon",
        billing_model="one_time",
        display_name="TOP-X",
        amount_inr=59,
        credits=3,
        max_duration_minutes=10,
        plan_group="topup",
        bucket_breakdown={"10m": 3, "15m": 0, "30m": 0},
        fair_usage_policy=True,
    ),
    "topup_y_99": PurchaseItem(
        key="topup_y_99",
        purchase_type="addon",
        billing_model="one_time",
        display_name="TOP-Y",
        amount_inr=99,
        credits=6,
        max_duration_minutes=10,
        plan_group="topup",
        bucket_breakdown={"10m": 6, "15m": 0, "30m": 0},
        tag="Popular Top-Up",
        highlighted=True,
        fair_usage_policy=True,
    ),
    "topup_z_149": PurchaseItem(
        key="topup_z_149",
        purchase_type="addon",
        billing_model="one_time",
        display_name="TOP-Z",
        amount_inr=149,
        credits=9,
        max_duration_minutes=15,
        plan_group="topup",
        bucket_breakdown={"10m": 6, "15m": 3, "30m": 0},
        fair_usage_policy=True,
    ),
    # Backward compatibility
    "starter_monthly": PurchaseItem(
        key="starter_monthly",
        purchase_type="plan",
        billing_model="subscription",
        display_name="Starter",
        amount_inr=149,
        credits=6,
        max_duration_minutes=15,
        plan_group="starter",
        bucket_breakdown={"10m": 4, "15m": 2, "30m": 0},
        fair_usage_policy=True,
    ),
    "pro_monthly": PurchaseItem(
        key="pro_monthly",
        purchase_type="plan",
        billing_model="subscription",
        display_name="Pro",
        amount_inr=399,
        credits=25,
        max_duration_minutes=30,
        plan_group="pro",
        bucket_breakdown={"10m": 15, "15m": 8, "30m": 2},
        tag="Most Popular",
        highlighted=True,
        fair_usage_policy=True,
    ),
}

SUBSCRIPTION_PLAN_KEYS = {"basic_99", "premium_199", "starter_monthly", "pro_monthly"}
TOPUP_PLAN_KEYS = {"topup_x_59", "topup_y_99", "topup_z_149"}
BILLING_STATUSES = {"trial_available", "trial_used", "active", "past_due", "cancelled", "expired"}


async def ensure_pricing_catalog_in_db():
    try:
        count = await database.pricing_catalog.count_documents({})
        if count == 0:
            docs = []
            for key, item in PURCHASE_ITEMS.items():
                data = asdict(item)
                data["_id"] = key
                docs.append(data)
            if docs:
                await database.pricing_catalog.insert_many(docs)
    except Exception as e:
        pass


async def get_purchase_item_from_db(item_key: str) -> PurchaseItem:
    await ensure_pricing_catalog_in_db()
    doc = None
    try:
        doc = await database.pricing_catalog.find_one({"key": item_key})
    except Exception:
        pass

    if doc:
        doc.pop("_id", None)
        return PurchaseItem(**doc)

    item = PURCHASE_ITEMS.get(item_key)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown purchase item '{item_key}'.")
    return item


def get_purchase_item(item_key: str) -> PurchaseItem:
    item = PURCHASE_ITEMS.get(item_key)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown purchase item '{item_key}'.")
    return item


def _now() -> datetime:
    return utc_now()


def _timestamp_to_datetime(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=utc_now().tzinfo)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=utc_now().tzinfo)
        except Exception:
            pass
    try:
        return datetime.fromtimestamp(int(value), tz=_now().tzinfo)
    except Exception:
        return None


def _build_basic_auth_header() -> str:
    key_id = (settings.razorpay_key_id or "").strip()
    key_secret = (settings.razorpay_key_secret or "").strip()
    raw = f"{key_id}:{key_secret}".encode("utf-8")
    return f"Basic {base64.b64encode(raw).decode('utf-8')}"


def _strip_none(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if value is not None}


def _plan_to_public_dict(item: PurchaseItem) -> dict:
    payload = asdict(item)
    payload["displayName"] = payload.pop("display_name")
    payload["purchaseType"] = payload.pop("purchase_type")
    payload["billingModel"] = payload.pop("billing_model")
    payload["amountInr"] = payload.pop("amount_inr")
    payload["maxDurationMinutes"] = payload.pop("max_duration_minutes")
    payload["planGroup"] = payload.pop("plan_group")
    payload["bucketBreakdown"] = payload.pop("bucket_breakdown")
    payload["validForDays"] = payload.pop("valid_for_days")
    payload["strikeThroughAmountInr"] = payload.pop("strike_through_amount_inr")
    payload["isLimited"] = payload.pop("is_limited")
    payload["trialOnly"] = payload.pop("trial_only")
    payload["fairUsagePolicy"] = payload.pop("fair_usage_policy")
    return _strip_none(payload)


async def get_public_catalog() -> dict:
    await ensure_pricing_catalog_in_db()
    
    db_items = []
    try:
        cursor = database.pricing_catalog.find({})
        db_items = await cursor.to_list(length=100)
    except Exception:
        pass

    items_map = {}
    for d in db_items:
        d.pop("_id", None)
        try:
            items_map[d["key"]] = PurchaseItem(**d)
        except Exception:
            pass

    for k, v in PURCHASE_ITEMS.items():
        if k not in items_map:
            items_map[k] = v

    plans = [
        _plan_to_public_dict(items_map[key])
        for key in ["free_trial", "basic_99", "premium_199"]
        if key in items_map
    ]
    topups = [
        _plan_to_public_dict(items_map[key])
        for key in ["topup_x_59", "topup_y_99", "topup_z_149"]
        if key in items_map
    ]

    return {
        "plans": plans,
        "topups": topups,
        "addons": topups,
        "meta": {
            "currency": "INR",
            "supportEmail": settings.support_email,
        },
    }


def _default_credit_fields() -> dict:
    return {
        "planKey": "free_trial",
        "billingStatus": "trial_available",
        "trialUsed": False,
        "totalCredits": 1,
        "creditsUsed": 0,
        "creditsRemaining": 1,
        "mainCreditBuckets": {
            "10m": {"total": 1, "used": 0, "remaining": 1},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        },
        "topupCreditBuckets": {
            "10m": {"total": 0, "used": 0, "remaining": 0},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        },
        "creditBuckets": {
            "10m": {"total": 1, "used": 0, "remaining": 1},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        },
        "bonusCreditsBalance": 0,
        "providerCustomerId": None,
        "providerSubscriptionId": None,
        "providerPaymentLinkId": None,
        "currentPeriodStart": None,
        "currentPeriodEnd": None,
        "paymentProvider": None,
        "cancelAtPeriodEnd": False,
        "fairUsagePolicy": True,
        "feedbackSubmitted": False,
        "referralRewardsClaimed": 0,
        "referralCount": 0,
    }


def normalize_user_billing_document(user: dict) -> dict:
    defaults = _default_credit_fields()
    result = {key: user.get(key, value) for key, value in defaults.items()}
    result["feedbackSubmitted"] = bool(user.get("feedbackSubmitted", False))
    if not isinstance(result.get("mainCreditBuckets"), dict):
        result["mainCreditBuckets"] = defaults["mainCreditBuckets"]
    if not isinstance(result.get("topupCreditBuckets"), dict):
        result["topupCreditBuckets"] = defaults["topupCreditBuckets"]

    combined_buckets = {}
    total_combined_remaining = 0
    total_combined_used = 0
    total_combined_capacity = 0

    has_referral_rewards = int(result.get("referralRewardsClaimed", 0)) > 0 or int(user.get("referralRewardsClaimed", 0)) > 0 or int(result.get("creditsRemaining", 0)) > 0
    is_expired_or_trial_used = (
        result.get("billingStatus") in {"expired"}
        or (result.get("billingStatus") == "trial_used" and not has_referral_rewards and result.get("creditsRemaining", 0) <= 0)
        or (result.get("planKey") == "free_trial" and result.get("trialUsed") and not has_referral_rewards and result.get("creditsRemaining", 0) <= 0)
    )

    for b in ("10m", "15m", "30m"):
        if b not in result["mainCreditBuckets"]:
            result["mainCreditBuckets"][b] = {"total": 0, "used": 0, "remaining": 0}
        if b not in result["topupCreditBuckets"]:
            result["topupCreditBuckets"][b] = {"total": 0, "used": 0, "remaining": 0}

        m = result["mainCreditBuckets"][b]
        t = result["topupCreditBuckets"][b]

        m["remaining"] = 0 if is_expired_or_trial_used else max(int(m.get("total", 0)) - int(m.get("used", 0)), 0)
        t["remaining"] = 0 if is_expired_or_trial_used else max(int(t.get("total", 0)) - int(t.get("used", 0)), 0)

        tot = int(m.get("total", 0)) + int(t.get("total", 0))
        used = int(m.get("used", 0)) + int(t.get("used", 0))
        rem = m["remaining"] + t["remaining"]

        combined_buckets[b] = {"total": tot, "used": used, "remaining": rem}
        total_combined_capacity += tot
        total_combined_used += used
        total_combined_remaining += rem

    if result.get("planKey") == "free_trial" and result.get("trialUsed") and not has_referral_rewards and total_combined_remaining <= 0:
        result["mainCreditBuckets"]["10m"] = {"total": 1, "used": 1, "remaining": 0}
        result["creditBuckets"]["10m"] = {"total": 1, "used": 1, "remaining": 0}
        result["totalCredits"] = 1
        result["creditsUsed"] = 1
        result["creditsRemaining"] = 0
    else:
        result["creditBuckets"] = combined_buckets
        result["totalCredits"] = total_combined_capacity
        result["creditsUsed"] = total_combined_used
        result["creditsRemaining"] = total_combined_remaining
    return result


def _plan_status_for_user(user: dict) -> str:
    has_referral = int(user.get("referralRewardsClaimed", 0)) > 0 or user.get("creditsRemaining", 0) > 0
    if user.get("planKey") == "free_trial" and user.get("trialUsed") and not has_referral:
        return "trial_used"
    if user.get("billingStatus") in BILLING_STATUSES and user.get("billingStatus") != "trial_used":
        return user["billingStatus"]
    if has_referral:
        return "trial_available"
    return "trial_used" if (user.get("trialUsed") and not has_referral) else "trial_available"


def check_topup_eligibility(user: dict) -> dict:
    snapshot = normalize_user_billing_document(user)
    status_val = _plan_status_for_user(snapshot)

    if snapshot.get("planKey") == "free_trial" or snapshot.get("plan") == "free":
        return {
            "eligible": False,
            "scenario": "D",
            "message": "Subscribe to a plan first to unlock top-ups.",
            "validUntil": None,
        }

    if status_val == "expired":
        return {
            "eligible": False,
            "scenario": "C",
            "message": "Your subscription has expired. Choose a new plan to continue.",
            "validUntil": None,
        }

    if status_val != "active":
        return {
            "eligible": False,
            "scenario": "C",
            "message": "Subscribe to a plan first to unlock top-ups.",
            "validUntil": None,
        }

    main_buckets = snapshot.get("mainCreditBuckets", {})
    main_remaining = sum(b.get("remaining", 0) for b in main_buckets.values())
    if main_remaining > 0:
        return {
            "eligible": False,
            "scenario": "A",
            "message": "Top-ups are locked until your current plan credits are exhausted.",
            "validUntil": snapshot.get("currentPeriodEnd"),
        }

    topup_buckets = snapshot.get("topupCreditBuckets", {})
    topup_remaining = sum(b.get("remaining", 0) for b in topup_buckets.values())
    if topup_remaining > 0:
        return {
            "eligible": False,
            "scenario": "A_TOPUP_ACTIVE",
            "message": "Your top-up credits are active. Recharge again when current top-up capacity is exhausted.",
            "validUntil": snapshot.get("currentPeriodEnd"),
        }

    return {
        "eligible": True,
        "scenario": "B",
        "message": "Top-up Available",
        "validUntil": snapshot.get("currentPeriodEnd"),
    }


async def reconcile_user_billing_state(user: dict) -> dict:
    snapshot = normalize_user_billing_document(user)
    now = _now()
    updates: Dict[str, Any] = {}
    status_value = _plan_status_for_user(snapshot)
    current_period_end = snapshot.get("currentPeriodEnd")

    if status_value in {"active", "cancelled"} and current_period_end:
        end_dt = _timestamp_to_datetime(current_period_end)
        if end_dt and end_dt <= now:
            if snapshot["planKey"] in SUBSCRIPTION_PLAN_KEYS or snapshot["planKey"] in TOPUP_PLAN_KEYS:
                status_value = "expired"
                zero_buckets = {
                    "10m": {"total": 0, "used": 0, "remaining": 0},
                    "15m": {"total": 0, "used": 0, "remaining": 0},
                    "30m": {"total": 0, "used": 0, "remaining": 0},
                }
                updates.update(
                    {
                        "billingStatus": "expired",
                        "currentPeriodStart": None,
                        "currentPeriodEnd": None,
                        "cancelAtPeriodEnd": False,
                        "mainCreditBuckets": zero_buckets,
                        "topupCreditBuckets": zero_buckets,
                        "creditBuckets": zero_buckets,
                        "totalCredits": 0,
                        "creditsUsed": 0,
                        "creditsRemaining": 0,
                    }
                )

    has_ref = int(snapshot.get("referralRewardsClaimed", 0)) > 0 or snapshot.get("creditsRemaining", 0) > 0
    if snapshot["planKey"] == "free_trial" and snapshot["trialUsed"] and not has_ref and snapshot.get("creditsRemaining", 0) <= 0:
        status_value = "trial_used"
        trial_zero_buckets = {
            "10m": {"total": 1, "used": 1, "remaining": 0},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        }
        updates.update(
            {
                "billingStatus": "trial_used",
                "trialUsed": True,
                "mainCreditBuckets": trial_zero_buckets,
                "creditBuckets": trial_zero_buckets,
                "totalCredits": 1,
                "creditsUsed": 1,
                "creditsRemaining": 0,
            }
        )

    if user.get("creditBuckets") != snapshot["creditBuckets"] or user.get("creditsRemaining") != snapshot["creditsRemaining"]:
        updates["creditBuckets"] = snapshot["creditBuckets"]
        updates["mainCreditBuckets"] = snapshot["mainCreditBuckets"]
        updates["topupCreditBuckets"] = snapshot["topupCreditBuckets"]
        updates["totalCredits"] = snapshot["totalCredits"]
        updates["creditsUsed"] = snapshot["creditsUsed"]
        updates["creditsRemaining"] = snapshot["creditsRemaining"]

    if updates:
        try:
            await database.users.update_one({"id": user["id"]}, {"$set": updates})
        except Exception:
            pass
        user = {**user, **updates}

    return {**user, **normalize_user_billing_document({**user, "billingStatus": status_value})}


def _derive_plan_context(user: dict) -> PurchaseItem:
    plan_key = user.get("planKey") or "free_trial"
    item = PURCHASE_ITEMS.get(plan_key, PURCHASE_ITEMS["free_trial"])
    if item.billing_model == "subscription" and user.get("billingStatus") not in {"active", "cancelled"}:
        return PURCHASE_ITEMS["free_trial"]
    return item


def build_entitlements(user: dict) -> dict:
    snapshot = normalize_user_billing_document(user)
    current_item = _derive_plan_context(snapshot)
    topup_eligibility = check_topup_eligibility(snapshot)

    total_remaining = snapshot["creditsRemaining"]

    return {
        "planKey": snapshot["planKey"],
        "planName": current_item.display_name,
        "planGroup": current_item.plan_group,
        "billingStatus": _plan_status_for_user(snapshot),
        "totalCredits": snapshot["totalCredits"],
        "usedCredits": snapshot["creditsUsed"],
        "remainingCredits": total_remaining,
        "creditBuckets": snapshot["creditBuckets"],
        "mainCreditBuckets": snapshot["mainCreditBuckets"],
        "topupCreditBuckets": snapshot["topupCreditBuckets"],
        "topupEligibility": topup_eligibility,
        "maxDurationMinutes": current_item.max_duration_minutes,
        "canStartInterview": total_remaining > 0 and _plan_status_for_user(snapshot) not in {"expired"},
        "trialAvailable": not snapshot.get("trialUsed", False),
        "trialUsed": bool(snapshot.get("trialUsed", False)),
        "nextBillingDate": snapshot.get("currentPeriodEnd"),
        "currentPeriodStart": snapshot.get("currentPeriodStart"),
        "currentPeriodEnd": snapshot.get("currentPeriodEnd"),
        "fairUsagePolicy": True,
        "showUpgradeNudge": total_remaining <= 1 or _plan_status_for_user(snapshot) in {"expired", "trial_used"},
        "creditProgressPercent": 0 if snapshot.get("totalCredits", 0) <= 0 else round((int(snapshot.get("creditsUsed", 0)) / max(int(snapshot.get("totalCredits", 1)), 1)) * 100),
    }


async def get_user_billing_snapshot(user: dict) -> dict:
    refreshed_user = await reconcile_user_billing_state(user)
    catalog = await get_public_catalog()
    return {
        "subscription": {
            "planKey": refreshed_user.get("planKey", "free_trial"),
            "billingStatus": refreshed_user.get("billingStatus", "trial_available"),
            "providerCustomerId": refreshed_user.get("providerCustomerId"),
            "providerSubscriptionId": refreshed_user.get("providerSubscriptionId"),
            "providerPaymentLinkId": refreshed_user.get("providerPaymentLinkId"),
            "currentPeriodStart": refreshed_user.get("currentPeriodStart"),
            "currentPeriodEnd": refreshed_user.get("currentPeriodEnd"),
            "cancelAtPeriodEnd": refreshed_user.get("cancelAtPeriodEnd", False),
        },
        "entitlements": build_entitlements(refreshed_user),
        "plans": catalog["plans"],
        "topups": catalog["topups"],
        "addons": catalog["addons"],
        "meta": catalog["meta"],
        "razorpayKeyId": settings.razorpay_key_id or "rzp_test_mock_key_id",
    }


async def create_razorpay_order(item_key: str, user: dict) -> dict:
    user = await reconcile_user_billing_state(user)
    item = await get_purchase_item_from_db(item_key)

    if item.key == "free_trial":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Free plan does not require payment.")

    snapshot = normalize_user_billing_document(user)
    status_val = _plan_status_for_user(snapshot)

    # 1. Main Subscription Rule: Only 1 active main paid subscription allowed
    if item.purchase_type == "plan":
        if status_val == "active" and snapshot.get("currentPeriodEnd"):
            end_str = str(snapshot["currentPeriodEnd"])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your current plan is active until {end_str}. You cannot purchase another main plan until your current plan expires."
            )

    # 2. Top-Up Eligibility Rule
    if item.purchase_type == "addon":
        eligibility = check_topup_eligibility(user)
        if not eligibility["eligible"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=eligibility["message"]
            )

    amount_paise = item.amount_inr * 100
    receipt_id = f"rcpt_{user['id'][-6:]}_{int(datetime.now().timestamp())}"

    order_data = None
    if settings.razorpay_key_id and settings.razorpay_key_secret and settings.razorpay_key_id != "rzp_test_mock_key_id":
        headers = {
            "Authorization": _build_basic_auth_header(),
            "Content-Type": "application/json",
        }
        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "notes": {
                "userId": user["id"],
                "email": user["email"],
                "planKey": item.key,
            },
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post("https://api.razorpay.com/v1/orders", headers=headers, json=payload)
        if response.status_code == 200:
            order_data = response.json()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Razorpay API Error ({response.status_code}): {response.text}"
            )

    if not order_data:
        mock_order_id = f"order_mock_{utc_now().strftime('%Y%m%d%H%M%S')}"
        order_data = {
            "id": mock_order_id,
            "entity": "order",
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "status": "created",
            "notes": {"userId": user["id"], "planKey": item.key},
        }

    return {
        "orderId": order_data["id"],
        "amount": item.amount_inr,
        "amountPaise": amount_paise,
        "currency": "INR",
        "keyId": (settings.razorpay_key_id or "rzp_test_mock_key_id").strip(),
        "planKey": item.key,
        "planName": item.display_name,
        "user": {"name": user["name"], "email": user["email"]},
    }


async def verify_razorpay_payment(user: dict, order_id: str, payment_id: str, signature: str, plan_key: str) -> dict:
    item = await get_purchase_item_from_db(plan_key)

    # Server-Side Signature Verification
    if settings.razorpay_key_secret and not order_id.startswith("order_mock_"):
        generated_signature = hmac.new(
            settings.razorpay_key_secret.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(generated_signature, signature):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Razorpay signature. Payment verification failed.")

    now = _now()
    subtotal = float(item.amount_inr)
    gst_amount = 0.0
    total_amount = float(item.amount_inr)
    invoice_number = f"INV-{now.strftime('%Y%m%d')}-{utc_now().microsecond:06d}"[:18]

    snapshot = normalize_user_billing_document(user)

    if item.purchase_type == "addon":
        # Top-Up inherits current main subscription expiry date!
        period_start = now
        period_end = snapshot.get("currentPeriodEnd") or (now + timedelta(days=30))

        topup_buckets = snapshot.get("topupCreditBuckets", {})
        for b_key, b_count in item.bucket_breakdown.items():
            prev = topup_buckets.get(b_key, {"total": 0, "used": 0, "remaining": 0})
            topup_buckets[b_key] = {
                "total": int(prev.get("total", 0)) + b_count,
                "used": int(prev.get("used", 0)),
                "remaining": int(prev.get("remaining", 0)) + b_count,
            }

        user_updates = {
            "topupCreditBuckets": topup_buckets,
            "paymentProvider": "razorpay",
            "providerSubscriptionId": order_id,
        }
        product_type = "top_up"
    else:
        # Main Subscription Purchase
        period_start = now
        period_end = now + timedelta(days=item.valid_for_days or 30)

        main_buckets = {}
        zero_buckets = {
            "10m": {"total": 0, "used": 0, "remaining": 0},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        }
        for b_key, b_count in item.bucket_breakdown.items():
            main_buckets[b_key] = {"total": b_count, "used": 0, "remaining": b_count}

        user_updates = {
            "planKey": item.key,
            "plan": item.plan_group,
            "billingStatus": "active",
            "currentPeriodStart": period_start,
            "currentPeriodEnd": period_end,
            "mainCreditBuckets": main_buckets,
            "topupCreditBuckets": zero_buckets,
            "paymentProvider": "razorpay",
            "providerSubscriptionId": order_id,
            "cancelAtPeriodEnd": False,
        }
        product_type = "main_plan"

    temp_merged = {**user, **user_updates}
    norm = normalize_user_billing_document(temp_merged)
    user_updates["creditBuckets"] = norm["creditBuckets"]
    user_updates["totalCredits"] = norm["totalCredits"]
    user_updates["creditsUsed"] = norm["creditsUsed"]
    user_updates["creditsRemaining"] = norm["creditsRemaining"]

    await database.users.update_one({"id": user["id"]}, {"$set": user_updates})

    # Payment record
    payment_doc = {
        "id": f"pay_{now.strftime('%Y%m%d%H%M%S%f')}",
        "orderId": order_id,
        "paymentId": payment_id,
        "userId": user["id"],
        "userEmail": user["email"],
        "userName": user["name"],
        "productType": product_type,
        "planKey": item.key,
        "planName": item.display_name,
        "amount": subtotal,
        "gstAmount": gst_amount,
        "totalAmount": total_amount,
        "currency": "INR",
        "status": "success",
        "paymentMethod": "razorpay",
        "invoiceNumber": invoice_number,
        "transactionRef": payment_id,
        "subscriptionStart": period_start,
        "subscriptionEnd": period_end,
        "validUntil": period_end,
        "createdAt": now,
    }
    await database.payments.insert_one(payment_doc)

    # Store Invoice record
    invoice_doc = {
        "id": f"inv_{now.strftime('%Y%m%d%H%M%S%f')}",
        "invoiceNumber": invoice_number,
        "userId": user["id"],
        "paymentId": payment_doc["id"],
        "planName": item.display_name,
        "productType": product_type,
        "subtotal": subtotal,
        "gstAmount": gst_amount,
        "totalAmount": total_amount,
        "validUntil": period_end,
        "createdAt": now,
    }
    await database.invoices.insert_one(invoice_doc)

    # Log to CreditLedger
    ledger_doc = {
        "userId": user["id"],
        "event": "topup_activated" if item.purchase_type == "addon" else "subscription_activated",
        "planKey": item.key,
        "productType": product_type,
        "allocatedBuckets": item.bucket_breakdown,
        "validUntil": period_end,
        "createdAt": now,
    }
    await database.credit_ledger.insert_one(ledger_doc)

    # Log Audit
    audit_doc = {
        "userId": user["id"],
        "action": "payment_verified",
        "details": {"orderId": order_id, "paymentId": payment_id, "amount": total_amount, "productType": product_type},
        "createdAt": now,
    }
    await database.audit_logs.insert_one(audit_doc)

    payment_doc.pop("_id", None)
    return {
        "success": True,
        "message": f"Successfully activated {item.display_name}!",
        "payment": payment_doc,
        "invoiceNumber": invoice_number,
    }


async def get_user_payment_history(user_id: str) -> List[dict]:
    payments = await database.payments.find({"userId": user_id}, {"_id": 0}).sort("createdAt", -1).to_list(100)
    for p in payments:
        for k in ("createdAt", "subscriptionStart", "subscriptionEnd", "validUntil"):
            if p.get(k) and isinstance(p[k], datetime):
                p[k] = p[k].isoformat()
    return payments


async def download_invoice_pdf(user_id: str, invoice_number: str) -> bytes:
    payment = await database.payments.find_one({"invoiceNumber": invoice_number, "userId": user_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    return generate_pdf_invoice(payment)


async def ensure_interview_access(user: dict, duration_minutes: int) -> tuple[dict, str]:
    user = await reconcile_user_billing_state(user)

    # 1. Zero Bypass: Subscription status check
    status_val = _plan_status_for_user(user)
    has_referral_credits = user.get("creditsRemaining", 0) > 0 or int(user.get("referralRewardsClaimed", 0)) > 0
    if (user.get("planKey") == "free_trial" or user.get("plan") == "free") and not has_referral_credits and user.get("creditsRemaining", 0) <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your free trial attempt has already been used. Please subscribe to a plan to start a new interview.",
        )

    if status_val in {"expired", "trial_used"} and not has_referral_credits and user.get("creditsRemaining", 0) <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your subscription has expired or credits are exhausted. Please upgrade to continue.",
        )

    # 2. Check duration bucket with strict duration matching
    bucket_key = "10m" if duration_minutes <= 10 else ("15m" if duration_minutes <= 15 else "30m")

    main_b = (user.get("mainCreditBuckets") or {}).get(bucket_key, {"remaining": 0})
    topup_b = (user.get("topupCreditBuckets") or {}).get(bucket_key, {"remaining": 0})
    comb_b = (user.get("creditBuckets") or {}).get(bucket_key, {"remaining": 0})

    if main_b.get("remaining", 0) <= 0 and topup_b.get("remaining", 0) <= 0 and comb_b.get("remaining", 0) <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No credits available for {duration_minutes}-minute interviews on your current plan. Please recharge or upgrade.",
        )

    # 3. Clean up any stale active sessions for this user so starting a new interview works seamlessly
    active_interview = await database.interviews.find_one({"userId": user["id"], "status": "active"})
    if active_interview:
        now = _now()
        await database.interviews.update_one(
            {"id": active_interview["id"]},
            {"$set": {"status": "completed", "endedAt": now}},
        )

    return user, bucket_key


async def consume_credit_for_interview(user_id: str, interview_id: str, duration_minutes: int, elapsed_seconds: float) -> dict:
    user = await database.users.find_one({"id": user_id})
    if not user:
        return {"deducted": False, "reason": "user_not_found"}

    now = _now()

    # Free Trial users: Always mark trial used and zero out free credit regardless of duration!
    if user.get("planKey") == "free_trial":
        zero_b = {
            "10m": {"total": 1, "used": 1, "remaining": 0},
            "15m": {"total": 0, "used": 0, "remaining": 0},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        }
        await database.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "trialUsed": True,
                    "billingStatus": "trial_used",
                    "mainCreditBuckets": zero_b,
                    "creditBuckets": zero_b,
                    "totalCredits": 1,
                    "creditsUsed": 1,
                    "creditsRemaining": 0,
                }
            },
        )
        await database.interviews.update_one(
            {"id": interview_id},
            {"$set": {"creditDeducted": True, "deductedBucket": "10m", "creditSource": "free_trial", "deductedAt": now}}
        )
        return {"deducted": True, "bucket": "10m", "source": "free_trial", "elapsed_seconds": elapsed_seconds}

    if elapsed_seconds < 120:
        return {"deducted": False, "reason": "duration_under_2_minutes", "elapsed_seconds": elapsed_seconds}

    # Ensure atomic deduction once per interview for paid plans
    interview = await database.interviews.find_one({"id": interview_id, "userId": user_id})
    if not interview or interview.get("creditDeducted"):
        return {"deducted": False, "reason": "already_deducted_or_not_found"}

    bucket_key = "10m" if duration_minutes <= 10 else ("15m" if duration_minutes <= 15 else "30m")
    user = normalize_user_billing_document(user)
    main_b = user.get("mainCreditBuckets", {}).get(bucket_key, {})
    topup_b = user.get("topupCreditBuckets", {}).get(bucket_key, {})

    now = _now()

    # Priority: Consume MAIN PLAN credit first!
    if main_b.get("remaining", 0) > 0:
        update_result = await database.users.update_one(
            {"id": user_id, f"mainCreditBuckets.{bucket_key}.remaining": {"$gt": 0}},
            {
                "$inc": {
                    f"mainCreditBuckets.{bucket_key}.used": 1,
                    f"mainCreditBuckets.{bucket_key}.remaining": -1,
                    f"creditBuckets.{bucket_key}.used": 1,
                    f"creditBuckets.{bucket_key}.remaining": -1,
                    "creditsUsed": 1,
                    "creditsRemaining": -1,
                },
                "$set": {"trialUsed": True},
            },
        )
        credit_source = "main"
    elif topup_b.get("remaining", 0) > 0:
        update_result = await database.users.update_one(
            {"id": user_id, f"topupCreditBuckets.{bucket_key}.remaining": {"$gt": 0}},
            {
                "$inc": {
                    f"topupCreditBuckets.{bucket_key}.used": 1,
                    f"topupCreditBuckets.{bucket_key}.remaining": -1,
                    f"creditBuckets.{bucket_key}.used": 1,
                    f"creditBuckets.{bucket_key}.remaining": -1,
                    "creditsUsed": 1,
                    "creditsRemaining": -1,
                },
                "$set": {"trialUsed": True},
            },
        )
        credit_source = "topup"
    else:
        return {"deducted": False, "reason": "no_credit_available"}

    if update_result.modified_count == 1:
        await database.interviews.update_one(
            {"id": interview_id},
            {"$set": {"creditDeducted": True, "deductedBucket": bucket_key, "creditSource": credit_source, "deductedAt": now}}
        )
        await database.credit_ledger.insert_one(
            {
                "ledgerId": f"ldg_{now.strftime('%Y%m%d%H%M%S%f')}",
                "id": f"ldg_{now.strftime('%Y%m%d%H%M%S%f')}",
                "userId": user_id,
                "interviewId": interview_id,
                "event": "credit_consumed",
                "bucket": bucket_key,
                "source": credit_source,
                "elapsedSeconds": elapsed_seconds,
                "createdAt": now,
            }
        )
        return {"deducted": True, "bucket": bucket_key, "source": credit_source, "elapsed_seconds": elapsed_seconds}

    return {"deducted": False, "reason": "no_credit_available_or_race"}


# Admin Operations
async def get_admin_payments(status_filter: Optional[str] = None, search: Optional[str] = None) -> List[dict]:
    query = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if search:
        query["$or"] = [
            {"invoiceNumber": {"$regex": search, "$options": "i"}},
            {"userEmail": {"$regex": search, "$options": "i"}},
            {"userName": {"$regex": search, "$options": "i"}},
            {"paymentId": {"$regex": search, "$options": "i"}},
        ]
    payments = await database.payments.find(query, {"_id": 0}).sort("createdAt", -1).to_list(200)
    for p in payments:
        for k in ("createdAt", "subscriptionStart", "subscriptionEnd", "validUntil"):
            if p.get(k) and isinstance(p[k], datetime):
                p[k] = p[k].isoformat()
    return payments


async def get_admin_payment_analytics() -> dict:
    total_payments = await database.payments.count_documents({"status": "success"})
    total_revenue_pipeline = [{"$match": {"status": "success"}}, {"$group": {"_id": None, "total": {"$sum": "$totalAmount"}}}]
    rev_res = await database.payments.aggregate(total_revenue_pipeline).to_list(1)
    total_revenue = rev_res[0]["total"] if rev_res else 0.0

    active_subscriptions = await database.users.count_documents({"billingStatus": "active"})
    basic_subs = await database.users.count_documents({"planKey": "basic_99", "billingStatus": "active"})
    premium_subs = await database.users.count_documents({"planKey": "premium_199", "billingStatus": "active"})

    return {
        "totalPaymentsCount": total_payments,
        "totalRevenueInr": total_revenue,
        "activeSubscriptions": active_subscriptions,
        "basicSubscriptions": basic_subs,
        "premiumSubscriptions": premium_subs,
    }


async def export_admin_payments_csv() -> StreamingResponse:
    payments = await database.payments.find({}, {"_id": 0}).sort("createdAt", -1).to_list(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Invoice Number", "User Name", "User Email", "Plan Name", "Product Type", "Amount (INR)", "GST Amount", "Total Paid", "Status", "Payment Method", "Transaction ID", "Date"])

    for p in payments:
        created = p.get("createdAt")
        date_str = created.strftime("%Y-%m-%d %H:%M:%S") if isinstance(created, datetime) else str(created or "")
        writer.writerow([
            p.get("invoiceNumber", ""),
            p.get("userName", ""),
            p.get("userEmail", ""),
            p.get("planName", ""),
            p.get("productType", "main_plan"),
            p.get("amount", 0),
            p.get("gstAmount", 0),
            p.get("totalAmount", 0),
            p.get("status", ""),
            p.get("paymentMethod", ""),
            p.get("paymentId", ""),
            date_str,
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=kevin_ai_payments_export.csv"},
    )
